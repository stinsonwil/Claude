// Website monitoring: a persistent loop checks each enabled monitor on its
// interval, saves the fetched page as evidence, diffs it against the last
// snapshot, filters cosmetic noise, and notifies the user with an explanation
// of what changed. Deduped by content hash, so an unchanged page never
// re-alerts.
import crypto from 'node:crypto';
import { db, uid, now } from './db.js';
import { notify } from './events.js';
import { fetchUrl, extractText } from './web.js';
import { registerFile } from './fileStore.js';
import { askJSON, aiConfigured } from './ai.js';
import { config } from './config.js';

function normalize(text) {
  return text
    .replace(/\b\d{1,2}:\d{2}(:\d{2})?\s?(AM|PM|am|pm)?\b/g, '')   // clocks
    .replace(/\s+/g, ' ')
    .trim();
}

function hashOf(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function relevantText(monitor, html) {
  const { text } = extractText(html, { maxChars: 40000 });
  if (monitor.kind === 'keyword' && monitor.keywords) {
    const kws = monitor.keywords.split(',').map((k) => k.trim().toLowerCase()).filter(Boolean);
    const lines = text.split('\n').filter((l) => kws.some((k) => l.toLowerCase().includes(k)));
    return lines.join('\n') || `(none of the keywords currently appear on the page: ${monitor.keywords})`;
  }
  if (monitor.kind === 'price') {
    const lines = text.split('\n').filter((l) => /[$€£¥]\s?\d|USD|EUR|\d+[.,]\d{2}/.test(l));
    return lines.join('\n') || text.slice(0, 8000);
  }
  return text;
}

function simpleDiff(oldText, newText) {
  const oldLines = new Set(oldText.split('\n').map((l) => l.trim()).filter(Boolean));
  const newLines = new Set(newText.split('\n').map((l) => l.trim()).filter(Boolean));
  const added = [...newLines].filter((l) => !oldLines.has(l)).slice(0, 40);
  const removed = [...oldLines].filter((l) => !newLines.has(l)).slice(0, 40);
  return { added, removed };
}

async function classifyChange(monitor, diff) {
  if (!aiConfigured()) {
    // Heuristic fallback: alert when the change is more than trivial noise.
    const magnitude = diff.added.length + diff.removed.length;
    return {
      significant: magnitude >= 2,
      summary: `Detected ${diff.added.length} added and ${diff.removed.length} removed line(s) on the page.`,
    };
  }
  return askJSON(
    `You review website changes for a "${monitor.kind}" monitor named "${monitor.name}" on ${monitor.url}` +
      `${monitor.keywords ? ` (keywords: ${monitor.keywords})` : ''}.\n` +
      `Lines ADDED since last check:\n${diff.added.join('\n') || '(none)'}\n\n` +
      `Lines REMOVED since last check:\n${diff.removed.join('\n') || '(none)'}\n\n` +
      'Decide whether this is a meaningful change for the monitor\'s purpose (price moved, item back in stock, new posting/article, content the keywords care about) ' +
      'or cosmetic noise (rotating ads, timestamps, session tokens, trending widgets). Summarize the change in 1-3 plain sentences.',
    {
      type: 'object',
      properties: { significant: { type: 'boolean' }, summary: { type: 'string' } },
      required: ['significant', 'summary'],
    },
    { model: config.fastModel }
  );
}

export async function checkMonitor(monitor) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(monitor.user_id);
  if (!user) return;
  let page;
  try {
    page = await fetchUrl(monitor.url, { timeoutMs: 25000 });
  } catch (err) {
    page = { ok: false, status: 0, text: '', error: err.message };
  }

  const checkedAt = now();
  // Uptime monitors alert on status transitions (up->down, down->up).
  const status = page.ok ? 'up' : `down (${page.status || page.error || 'unreachable'})`;
  if (monitor.kind === 'uptime') {
    if (monitor.last_status && monitor.last_status !== status) {
      const summary = page.ok
        ? `${monitor.url} is back UP (HTTP ${page.status}).`
        : `${monitor.url} appears DOWN: ${page.status ? `HTTP ${page.status}` : page.error}.`;
      recordEvent(monitor, user, { summary, diff: null, evidenceHtml: page.text });
    }
    db.prepare('UPDATE monitors SET last_checked_at = ?, last_status = ? WHERE id = ?').run(checkedAt, status, monitor.id);
    return;
  }

  if (!page.ok) {
    db.prepare('UPDATE monitors SET last_checked_at = ?, last_status = ? WHERE id = ?').run(checkedAt, status, monitor.id);
    return; // content monitors don't alert on transient fetch errors
  }

  const text = normalize(relevantText(monitor, page.text));
  const hash = hashOf(text);
  if (monitor.last_hash === hash) {
    db.prepare('UPDATE monitors SET last_checked_at = ?, last_status = ? WHERE id = ?').run(checkedAt, status, monitor.id);
    return; // no change at all — never duplicate a notification
  }

  let summary = null;
  let diff = null;
  if (monitor.last_snapshot_file) {
    const prev = db.prepare('SELECT * FROM files WHERE id = ?').get(monitor.last_snapshot_file);
    if (prev) {
      const fs = await import('node:fs');
      const prevText = normalize(relevantText(monitor, fs.readFileSync(prev.path, 'utf8')));
      diff = simpleDiff(prevText, text);
      if (diff.added.length === 0 && diff.removed.length === 0) {
        // Hash moved but the extracted content didn't — cosmetic.
        db.prepare('UPDATE monitors SET last_checked_at = ?, last_status = ?, last_hash = ? WHERE id = ?').run(checkedAt, status, hash, monitor.id);
        return;
      }
      const verdict = await classifyChange(monitor, diff);
      if (!verdict.significant) {
        db.prepare('UPDATE monitors SET last_checked_at = ?, last_status = ?, last_hash = ? WHERE id = ?').run(checkedAt, status, hash, monitor.id);
        return;
      }
      summary = verdict.summary;
    }
  }

  const snapshot = registerFile({
    userId: user.id,
    name: `${monitor.name.replace(/\W+/g, '-')}-${Date.now()}.html`,
    mime: 'text/html',
    buffer: Buffer.from(page.text),
    kind: 'evidence',
  });

  if (summary) {
    recordEvent(monitor, user, { summary, diff, snapshotFileId: snapshot.id });
  }
  // First successful check just establishes the baseline silently.
  db.prepare('UPDATE monitors SET last_checked_at = ?, last_status = ?, last_hash = ?, last_snapshot_file = ? WHERE id = ?')
    .run(checkedAt, status, hash, snapshot.id, monitor.id);
}

function recordEvent(monitor, user, { summary, diff, snapshotFileId = null, evidenceHtml = null }) {
  let evidenceId = snapshotFileId;
  if (!evidenceId && evidenceHtml) {
    evidenceId = registerFile({
      userId: user.id, name: `${monitor.name.replace(/\W+/g, '-')}-${Date.now()}.html`,
      mime: 'text/html', buffer: Buffer.from(evidenceHtml), kind: 'evidence',
    }).id;
  }
  db.prepare('INSERT INTO monitor_events (id, monitor_id, summary, diff, snapshot_file_id) VALUES (?,?,?,?,?)')
    .run(uid(), monitor.id, summary, diff ? JSON.stringify(diff) : null, evidenceId);
  notify(user.id, { title: `Change detected: ${monitor.name}`, body: summary, kind: 'monitor' });
}

let sweeping = false;
async function sweep() {
  if (sweeping) return;
  sweeping = true;
  try {
    const monitors = db.prepare('SELECT * FROM monitors WHERE enabled = 1').all();
    for (const m of monitors) {
      const due = !m.last_checked_at || Date.now() - new Date(m.last_checked_at).getTime() >= m.interval_minutes * 60000;
      if (!due) continue;
      try {
        await checkMonitor(m);
      } catch (err) {
        console.error(`Monitor ${m.id} check failed:`, err.message);
        db.prepare('UPDATE monitors SET last_checked_at = ? WHERE id = ?').run(now(), m.id);
      }
    }
  } finally {
    sweeping = false;
  }
}

export function startMonitoring() {
  setInterval(sweep, 30000).unref();
}
