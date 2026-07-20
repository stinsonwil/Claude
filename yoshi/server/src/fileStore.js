import fs from 'node:fs';
import path from 'node:path';
import { db, uid } from './db.js';
import { FILES_DIR } from './config.js';

const safeName = (name) => String(name || 'file').replace(/[^\w.\- ()]/g, '_').slice(0, 120);

export function registerFile({ userId, taskId = null, name, mime, buffer, kind = 'generated' }) {
  const id = uid();
  const clean = safeName(name);
  const diskPath = path.join(FILES_DIR, `${id}-${clean}`);
  fs.writeFileSync(diskPath, buffer);
  db.prepare('INSERT INTO files (id, user_id, task_id, name, mime, size, path, kind) VALUES (?,?,?,?,?,?,?,?)')
    .run(id, userId, taskId, clean, mime, buffer.length, diskPath, kind);
  return db.prepare('SELECT * FROM files WHERE id = ?').get(id);
}

export function registerUploadedFile({ userId, taskId = null, originalname, mimetype, tmpPath }) {
  const id = uid();
  const clean = safeName(originalname);
  const diskPath = path.join(FILES_DIR, `${id}-${clean}`);
  fs.renameSync(tmpPath, diskPath);
  const size = fs.statSync(diskPath).size;
  db.prepare('INSERT INTO files (id, user_id, task_id, name, mime, size, path, kind) VALUES (?,?,?,?,?,?,?,?)')
    .run(id, userId, taskId, clean, mimetype || 'application/octet-stream', size, diskPath, 'uploaded');
  return db.prepare('SELECT * FROM files WHERE id = ?').get(id);
}

export function getFile(userId, fileId) {
  return db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ?').get(fileId, userId) || null;
}

export function listFiles(userId, { taskId } = {}) {
  if (taskId) {
    return db.prepare('SELECT * FROM files WHERE user_id = ? AND task_id = ? ORDER BY created_at DESC').all(userId, taskId);
  }
  return db.prepare('SELECT * FROM files WHERE user_id = ? ORDER BY created_at DESC').all(userId);
}

export function renameFile(userId, fileId, newName) {
  const file = getFile(userId, fileId);
  if (!file) return null;
  db.prepare('UPDATE files SET name = ? WHERE id = ?').run(safeName(newName), fileId);
  return getFile(userId, fileId);
}

export function duplicateFile(userId, fileId) {
  const file = getFile(userId, fileId);
  if (!file) return null;
  const buffer = fs.readFileSync(file.path);
  const base = file.name.replace(/(\.[^.]+)?$/, (ext) => ` (copy)${ext || ''}`);
  return registerFile({ userId, taskId: file.task_id, name: base, mime: file.mime, buffer, kind: file.kind });
}

export function deleteFile(userId, fileId) {
  const file = getFile(userId, fileId);
  if (!file) return false;
  try { fs.unlinkSync(file.path); } catch { /* already gone */ }
  db.prepare('DELETE FROM files WHERE id = ?').run(fileId);
  return true;
}

export function readFileBuffer(file) {
  return fs.readFileSync(file.path);
}
