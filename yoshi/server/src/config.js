import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const DATA_DIR = process.env.YOSHI_DATA_DIR || path.join(__dirname, '..', 'data');
export const FILES_DIR = path.join(DATA_DIR, 'files');
export const SNAPSHOT_DIR = path.join(DATA_DIR, 'snapshots');
for (const dir of [DATA_DIR, FILES_DIR, SNAPSHOT_DIR]) fs.mkdirSync(dir, { recursive: true });

// Persist a generated JWT secret so sessions survive restarts even without env config.
const secretFile = path.join(DATA_DIR, '.jwt-secret');
function loadSecret() {
  if (process.env.YOSHI_JWT_SECRET) return process.env.YOSHI_JWT_SECRET;
  if (fs.existsSync(secretFile)) return fs.readFileSync(secretFile, 'utf8').trim();
  const secret = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(secretFile, secret, { mode: 0o600 });
  return secret;
}

export const config = {
  port: Number(process.env.PORT || 4020),
  jwtSecret: loadSecret(),
  jwtExpiry: '30d',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  anthropicBaseUrl: process.env.ANTHROPIC_BASE_URL || undefined,
  model: process.env.YOSHI_MODEL || 'claude-sonnet-5',
  plannerModel: process.env.YOSHI_PLANNER_MODEL || 'claude-sonnet-5',
  fastModel: process.env.YOSHI_FAST_MODEL || 'claude-haiku-4-5-20251001',
  taskConcurrency: Number(process.env.YOSHI_TASK_CONCURRENCY || 3),
  chromiumPath: process.env.YOSHI_CHROMIUM_PATH || process.env.PLAYWRIGHT_CHROMIUM_PATH || '',
  maxUploadMb: Number(process.env.YOSHI_MAX_UPLOAD_MB || 30),
};

export function aiConfigured() {
  return Boolean(config.anthropicApiKey);
}
