import { db, uid, now } from './db.js';

export function listMemories(userId, { q, category, project } = {}) {
  let sql = 'SELECT * FROM memories WHERE user_id = ?';
  const args = [userId];
  if (q) { sql += ' AND content LIKE ?'; args.push(`%${q}%`); }
  if (category) { sql += ' AND category = ?'; args.push(category); }
  if (project) { sql += ' AND project = ?'; args.push(project); }
  sql += ' ORDER BY updated_at DESC';
  return db.prepare(sql).all(...args);
}

export function createMemory(userId, { category = 'general', project = null, content }) {
  if (!content || !String(content).trim()) throw Object.assign(new Error('Memory content is required'), { status: 400 });
  const id = uid();
  db.prepare('INSERT INTO memories (id, user_id, category, project, content) VALUES (?,?,?,?,?)')
    .run(id, userId, category, project, String(content).trim());
  return db.prepare('SELECT * FROM memories WHERE id = ?').get(id);
}

export function updateMemory(userId, memoryId, patch) {
  const mem = db.prepare('SELECT * FROM memories WHERE id = ? AND user_id = ?').get(memoryId, userId);
  if (!mem) return null;
  const next = {
    category: patch.category ?? mem.category,
    project: patch.project === undefined ? mem.project : patch.project,
    content: patch.content ?? mem.content,
    enabled: patch.enabled === undefined ? mem.enabled : (patch.enabled ? 1 : 0),
  };
  db.prepare('UPDATE memories SET category=?, project=?, content=?, enabled=?, updated_at=? WHERE id=?')
    .run(next.category, next.project, next.content, next.enabled, now(), memoryId);
  return db.prepare('SELECT * FROM memories WHERE id = ?').get(memoryId);
}

export function deleteMemory(userId, memoryId) {
  return db.prepare('DELETE FROM memories WHERE id = ? AND user_id = ?').run(memoryId, userId).changes > 0;
}

/**
 * Renders the user's enabled memories as a prompt section. Returns '' when the
 * user has memory disabled — memories then have no influence on responses.
 */
export function memoryPrompt(user) {
  if (!user.memory_enabled) return '';
  const rows = db.prepare('SELECT category, project, content FROM memories WHERE user_id = ? AND enabled = 1 ORDER BY updated_at DESC LIMIT 50')
    .all(user.id);
  if (rows.length === 0) return '';
  const lines = rows.map((m) => `- [${m.category}${m.project ? ` / ${m.project}` : ''}] ${m.content}`);
  return `\n\nSaved memories for this user (apply when relevant):\n${lines.join('\n')}`;
}
