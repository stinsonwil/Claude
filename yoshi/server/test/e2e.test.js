// End-to-end tests: boots a real Yoshi server on a scratch database and
// exercises auth, the task engine (workflow run → approval gate → completion),
// plan editing, cancel/retry, file storage, monitors (real change detection
// with evidence), schedules, and the document renderers.
import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 4977;
const BASE = `http://127.0.0.1:${PORT}/api`;
let server;
let dataDir;
let token;
let pageBody = 'Welcome to the store\nPrice: $100\nIn stock: yes\nFooter line';
let contentServer;
const CONTENT_PORT = 4978;

async function api(pathname, { method = 'GET', body, formData } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const resp = await fetch(`${BASE}${pathname}`, { method, headers, body: formData || (body ? JSON.stringify(body) : undefined) });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(`${method} ${pathname} -> ${resp.status}: ${data.error}`);
  return data;
}

async function waitFor(fn, { timeout = 30000, interval = 300, label = 'condition' } = {}) {
  const start = Date.now();
  for (;;) {
    const result = await fn();
    if (result) return result;
    if (Date.now() - start > timeout) throw new Error(`Timed out waiting for ${label}`);
    await new Promise((r) => setTimeout(r, interval));
  }
}

before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yoshi-test-'));
  server = spawn(process.execPath, [path.join(__dirname, '..', 'src', 'index.js')], {
    env: { ...process.env, PORT: String(PORT), YOSHI_DATA_DIR: dataDir, HTTPS_PROXY: '', HTTP_PROXY: '', https_proxy: '', http_proxy: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stderr.on('data', (d) => process.stderr.write(`[server] ${d}`));
  contentServer = http.createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(`<html><body>${pageBody.split('\n').map((l) => `<p>${l}</p>`).join('')}</body></html>`); });
  await new Promise((r) => contentServer.listen(CONTENT_PORT, r));
  await waitFor(async () => {
    try { const r = await fetch(`${BASE}/status`); return r.ok; } catch { return false; }
  }, { label: 'server boot' });
});

after(() => {
  server?.kill();
  contentServer?.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test('register and authenticate', async () => {
  const out = await api('/auth/register', { method: 'POST', body: { email: 'e2e@test.dev', name: 'E2E', password: 'supersecret1' } });
  assert.ok(out.token);
  token = out.token;
  const me = await api('/auth/me');
  assert.equal(me.email, 'e2e@test.dev');
});

test('workflow with approval gate runs through the task engine to completion', async () => {
  const wf = await api('/workflows', {
    method: 'POST',
    body: {
      name: 'Notify flow',
      definition: {
        blocks: [
          { id: 'gate', type: 'approval', title: 'Confirm send', instructions: 'Confirm sending the notification', params: { description: 'Send the test notification?' } },
          { id: 'note', type: 'notify_user', title: 'Notify', instructions: 'notify', params: { title: 'Workflow says hi', body: 'from e2e' }, depends_on: ['gate'] },
        ],
      },
    },
  });
  const { task_id } = await api(`/workflows/${wf.id}/run`, { method: 'POST', body: {} });

  // Engine must pause at the approval gate.
  const paused = await waitFor(async () => {
    const t = await api(`/tasks/${task_id}`);
    return t.status === 'awaiting_approval' ? t : null;
  }, { label: 'approval pause' });
  const approval = paused.approvals.find((a) => a.status === 'pending');
  assert.ok(approval, 'pending approval exists');
  assert.match(approval.description, /test notification/);

  await api(`/approvals/${approval.id}`, { method: 'POST', body: { decision: 'approve' } });
  const done = await waitFor(async () => {
    const t = await api(`/tasks/${task_id}`);
    return t.status === 'completed' ? t : null;
  }, { label: 'workflow completion' });
  assert.equal(done.progress, 1);
  assert.ok(done.steps.every((s) => s.status === 'completed'));

  const notifications = await api('/notifications');
  assert.ok(notifications.some((n) => n.title === 'Workflow says hi'), 'workflow notification delivered');

  const runs = await api(`/workflows/${wf.id}/runs`);
  assert.equal(runs[0].status, 'completed');
});

test('rejecting an approval pauses the task; plan editing + retry work', async () => {
  const wf = await api('/workflows', {
    method: 'POST',
    body: {
      name: 'Reject flow',
      definition: { blocks: [{ id: 'g', type: 'approval', title: 'Gate', instructions: 'gate', params: { description: 'Do the thing?' } }] },
    },
  });
  const { task_id } = await api(`/workflows/${wf.id}/run`, { method: 'POST', body: {} });
  const paused = await waitFor(async () => {
    const t = await api(`/tasks/${task_id}`);
    return t.status === 'awaiting_approval' ? t : null;
  }, { label: 'approval pause' });
  await api(`/approvals/${paused.approvals[0].id}`, { method: 'POST', body: { decision: 'reject' } });
  const afterReject = await waitFor(async () => {
    const t = await api(`/tasks/${task_id}`);
    return t.status === 'paused' ? t : null;
  }, { label: 'paused after reject' });
  assert.equal(afterReject.steps[0].status, 'failed');

  // Edit the plan while paused: remove the failed gate, add a notify step.
  const edited = await api(`/tasks/${task_id}/plan`, {
    method: 'POST',
    body: {
      remove: [afterReject.steps[0].id],
      add: [{ title: 'Just notify', capability: 'notify_user', instructions: 'notify', params: { title: 'Edited plan ran', body: '' } }],
    },
  });
  assert.equal(edited.steps.length, 1);
  await api(`/tasks/${task_id}/resume`, { method: 'POST' });
  await waitFor(async () => (await api(`/tasks/${task_id}`)).status === 'completed', { label: 'completion after edit' });
});

test('cancel works from awaiting_approval', async () => {
  const wf = await api('/workflows', {
    method: 'POST',
    body: { name: 'Cancel flow', definition: { blocks: [{ id: 'g', type: 'approval', title: 'Gate', instructions: 'gate' }] } },
  });
  const { task_id } = await api(`/workflows/${wf.id}/run`, { method: 'POST', body: {} });
  await waitFor(async () => (await api(`/tasks/${task_id}`)).status === 'awaiting_approval', { label: 'approval pause' });
  const t = await api(`/tasks/${task_id}/cancel`, { method: 'POST' });
  assert.equal(t.status, 'cancelled');
});

test('file upload, download, rename, duplicate, delete', async () => {
  const fd = new FormData();
  fd.append('files', new Blob(['name,price\nwidget,9.99\n'], { type: 'text/csv' }), 'prices.csv');
  const [file] = await api('/files', { method: 'POST', formData: fd });
  assert.equal(file.name, 'prices.csv');

  const dl = await fetch(`${BASE}/files/${file.id}/download?token=${token}`);
  assert.equal(dl.status, 200);
  assert.match(await dl.text(), /widget,9.99/);

  const renamed = await api(`/files/${file.id}`, { method: 'PATCH', body: { name: 'costs.csv' } });
  assert.equal(renamed.name, 'costs.csv');
  const copy = await api(`/files/${file.id}/duplicate`, { method: 'POST' });
  assert.match(copy.name, /copy/);
  await api(`/files/${copy.id}`, { method: 'DELETE' });
  const all = await api('/files');
  assert.ok(!all.some((f) => f.id === copy.id));
});

test('monitor detects a real change, saves evidence, and never duplicates alerts', async () => {
  const monitor = await api('/monitors', {
    method: 'POST',
    body: { name: 'Local store', url: `http://127.0.0.1:${CONTENT_PORT}/page`, kind: 'content', interval_minutes: 60 },
  });
  // First check establishes the baseline silently.
  await api(`/monitors/${monitor.id}/check`, { method: 'POST' });
  let events = await api(`/monitors/${monitor.id}/events`);
  assert.equal(events.length, 0, 'baseline check should not alert');

  // Change the page meaningfully.
  pageBody = 'Welcome to the store\nPrice: $80\nIn stock: no\nFooter line';
  await api(`/monitors/${monitor.id}/check`, { method: 'POST' });
  events = await api(`/monitors/${monitor.id}/events`);
  assert.equal(events.length, 1, 'change should produce exactly one event');
  assert.ok(events[0].snapshot_file_id, 'evidence snapshot saved');

  // Unchanged page → no new event.
  await api(`/monitors/${monitor.id}/check`, { method: 'POST' });
  events = await api(`/monitors/${monitor.id}/events`);
  assert.equal(events.length, 1, 'no duplicate notifications for unchanged content');
});

test('schedule: manual run creates a task and history entry; timezone cron computes next run', async () => {
  const schedule = await api('/schedules', {
    method: 'POST',
    body: { name: 'Test sched', goal: 'notify me', cron: '0 9 * * *', timezone: 'America/New_York' },
  });
  assert.ok(schedule.next_run_at);
  const hourUtc = new Date(schedule.next_run_at).getUTCHours();
  assert.ok(hourUtc === 13 || hourUtc === 14, `9am ET should be 13/14 UTC, got ${hourUtc}`);

  await api(`/schedules/${schedule.id}/run`, { method: 'POST' });
  const history = await api(`/schedules/${schedule.id}/history`);
  assert.equal(history.length, 1);
  assert.ok(history[0].task_id);

  const disabled = await api(`/schedules/${schedule.id}`, { method: 'PATCH', body: { enabled: false } });
  assert.equal(disabled.enabled, 0);
  assert.equal(disabled.next_run_at, null);
});

test('memories: crud, search, and global toggle', async () => {
  const mem = await api('/memories', { method: 'POST', body: { category: 'preference', content: 'Loves brutalist websites' } });
  const found = await api('/memories?q=brutalist');
  assert.equal(found.length, 1);
  await api(`/memories/${mem.id}`, { method: 'PATCH', body: { content: 'Loves minimalist websites' } });
  assert.equal((await api('/memories?q=brutalist')).length, 0);
  await api('/auth/me', { method: 'PATCH', body: { memory_enabled: false } });
  assert.equal((await api('/auth/me')).memory_enabled, 0);
  await api('/auth/me', { method: 'PATCH', body: { memory_enabled: true } });
  await api(`/memories/${mem.id}`, { method: 'DELETE' });
});

test('workflow versioning and restore', async () => {
  const wf = await api('/workflows', {
    method: 'POST',
    body: { name: 'Versioned', definition: { blocks: [{ id: 'a', type: 'notify_user', title: 'v1 notify', instructions: 'x', params: { title: 'v1' } }] } },
  });
  await api(`/workflows/${wf.id}`, {
    method: 'PATCH',
    body: { definition: { blocks: [{ id: 'a', type: 'notify_user', title: 'v2 notify', instructions: 'x', params: { title: 'v2' } }] } },
  });
  let detail = await api(`/workflows/${wf.id}`);
  assert.equal(detail.version, 2);
  assert.equal(detail.versions.length, 2);
  await api(`/workflows/${wf.id}/restore/1`, { method: 'POST' });
  detail = await api(`/workflows/${wf.id}`);
  assert.equal(detail.version, 3);
  assert.equal(detail.definition.blocks[0].title, 'v1 notify');
});

test('workflow definition validation rejects cycles and unknown types', async () => {
  await assert.rejects(api('/workflows', {
    method: 'POST',
    body: { name: 'Bad', definition: { blocks: [{ id: 'a', type: 'nonsense', title: 'x', instructions: '' }] } },
  }), /Unknown block type/);
  await assert.rejects(api('/workflows', {
    method: 'POST',
    body: {
      name: 'Cycle',
      definition: {
        blocks: [
          { id: 'a', type: 'answer', title: 'A', instructions: '', depends_on: ['b'] },
          { id: 'b', type: 'answer', title: 'B', instructions: '', depends_on: ['a'] },
        ],
      },
    },
  }), /cycle/);
});

test('AI-dependent tasks fail cleanly without a key (no fake results)', async () => {
  const task = await api('/tasks', { method: 'POST', body: { goal: 'Write me a haiku about databases' } });
  const failed = await waitFor(async () => {
    const t = await api(`/tasks/${task.id}`);
    return ['failed'].includes(t.status) ? t : null;
  }, { label: 'clean AI failure' });
  assert.match(failed.error, /ANTHROPIC_API_KEY/);
});

test('document renderers produce real files', async () => {
  const { renderPdf, renderDocx, renderXlsx, renderPptx } = await import('../src/capabilities/documents.js');
  const content = {
    title: 'Test Report', subtitle: 'Subtitle', filename: 'test',
    sections: [
      { heading: 'Overview', paragraphs: ['Hello world.'], bullets: ['Point one', 'Point two'] },
      { heading: 'Data', table: { headers: ['Item', 'Price'], rows: [['Widget', '9.99'], ['Gadget', '19.99']] } },
    ],
  };
  const pdf = await renderPdf(content);
  assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
  for (const buf of [await renderDocx(content), await renderXlsx(content), await renderPptx(content)]) {
    assert.equal(buf.subarray(0, 2).toString(), 'PK', 'OOXML files are zip archives');
    assert.ok(buf.length > 1000);
  }
});

test('users cannot see each other\'s data', async () => {
  const files = await api('/files');
  const myFile = files[0];
  const other = await api('/auth/register', { method: 'POST', body: { email: 'other@test.dev', name: 'Other', password: 'supersecret2' } });
  const prevToken = token;
  token = other.token;
  assert.equal((await api('/files')).length, 0);
  assert.equal((await api('/memories')).length, 0);
  assert.equal((await api('/tasks')).length, 0);
  await assert.rejects(api(`/files/${myFile.id}/download`), /404/);
  token = prevToken;
});
