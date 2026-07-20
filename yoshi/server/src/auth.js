import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db, uid } from './db.js';
import { config } from './config.js';

export function register({ email, name, password }) {
  email = String(email || '').trim().toLowerCase();
  name = String(name || '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw httpError(400, 'A valid email is required');
  if (!name) throw httpError(400, 'Name is required');
  if (!password || String(password).length < 8) throw httpError(400, 'Password must be at least 8 characters');
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) throw httpError(409, 'An account with this email already exists');
  const id = uid();
  db.prepare('INSERT INTO users (id, email, name, password_hash) VALUES (?,?,?,?)')
    .run(id, email, name, bcrypt.hashSync(String(password), 10));
  return issueToken(id);
}

export function login({ email, password }) {
  email = String(email || '').trim().toLowerCase();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(String(password || ''), user.password_hash)) {
    throw httpError(401, 'Invalid email or password');
  }
  return issueToken(user.id);
}

function issueToken(userId) {
  const token = jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: config.jwtExpiry });
  return { token, user: publicUser(userId) };
}

export function publicUser(userId) {
  const u = db.prepare('SELECT id, email, name, memory_enabled, timezone, created_at FROM users WHERE id = ?').get(userId);
  return u || null;
}

export function verifyToken(token) {
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    return db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub) || null;
  } catch {
    return null;
  }
}

// Express middleware. Token comes from the Authorization header, or from a
// query param for endpoints that can't set headers (SSE, file downloads).
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : req.query.token;
  const user = token ? verifyToken(token) : null;
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  req.user = user;
  next();
}

export function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}
