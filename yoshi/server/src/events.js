// Server-Sent-Events bus. Every logged-in browser tab opens /api/events and
// receives live updates for its user: task progress, step changes,
// notifications, approvals, monitor alerts.
import { db, uid, now } from './db.js';

const clients = new Map(); // userId -> Set<res>

export function addClient(userId, res) {
  if (!clients.has(userId)) clients.set(userId, new Set());
  clients.get(userId).add(res);
  res.on('close', () => {
    clients.get(userId)?.delete(res);
  });
}

export function emitToUser(userId, type, data) {
  const set = clients.get(userId);
  if (!set) return;
  const payload = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of set) {
    try { res.write(payload); } catch { /* dropped connection */ }
  }
}

export function logTaskEvent(task, type, message, data = null) {
  db.prepare('INSERT INTO task_events (id, task_id, type, message, data) VALUES (?,?,?,?,?)')
    .run(uid(), task.id, type, message, data ? JSON.stringify(data) : null);
  emitToUser(task.user_id, 'task.event', { taskId: task.id, type, message, data, created_at: now() });
}

export function notify(userId, { taskId = null, title, body = '', kind = 'info' }) {
  const id = uid();
  db.prepare('INSERT INTO notifications (id, user_id, task_id, title, body, kind) VALUES (?,?,?,?,?,?)')
    .run(id, userId, taskId, title, body, kind);
  const row = db.prepare('SELECT * FROM notifications WHERE id = ?').get(id);
  emitToUser(userId, 'notification', row);
  return row;
}
