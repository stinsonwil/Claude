import { Router } from 'express';
import multer from 'multer';
import os from 'node:os';
import fs from 'node:fs';
import { db, uid, now } from '../db.js';
import { register, login, publicUser, requireAuth, httpError } from '../auth.js';
import { addClient, notify } from '../events.js';
import { aiConfigured } from '../ai.js';
import { config } from '../config.js';
import {
  createTask, taskWithDetail, addUserMessage, requestPause, requestResume,
  requestCancel, retryTask, editPlan, resolveApproval,
} from '../taskEngine.js';
import {
  registerUploadedFile, listFiles, getFile, renameFile, duplicateFile, deleteFile,
} from '../fileStore.js';
import { listMemories, createMemory, updateMemory, deleteMemory } from '../memory.js';
import { computeNextRun, runScheduleNow } from '../scheduler.js';
import { checkMonitor } from '../monitors.js';
import { stepsFromWorkflow, validateWorkflowDefinition, WORKFLOW_BLOCK_TYPES } from '../workflowSteps.js';
import { askJSON } from '../ai.js';

export const api = Router();
const upload = multer({ dest: os.tmpdir(), limits: { fileSize: config.maxUploadMb * 1024 * 1024 } });

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ---------- status & auth ----------

api.get('/status', (req, res) => res.json({ ok: true, ai_configured: aiConfigured() }));

api.post('/auth/register', wrap(async (req, res) => res.json(register(req.body))));
api.post('/auth/login', wrap(async (req, res) => res.json(login(req.body))));
api.get('/auth/me', requireAuth, (req, res) => res.json(publicUser(req.user.id)));
api.patch('/auth/me', requireAuth, wrap(async (req, res) => {
  const { name, timezone, memory_enabled } = req.body;
  if (name !== undefined) db.prepare('UPDATE users SET name = ? WHERE id = ?').run(String(name).trim(), req.user.id);
  if (timezone !== undefined) {
    try { new Intl.DateTimeFormat('en', { timeZone: timezone }); } catch { throw httpError(400, 'Invalid timezone'); }
    db.prepare('UPDATE users SET timezone = ? WHERE id = ?').run(timezone, req.user.id);
  }
  if (memory_enabled !== undefined) db.prepare('UPDATE users SET memory_enabled = ? WHERE id = ?').run(memory_enabled ? 1 : 0, req.user.id);
  res.json(publicUser(req.user.id));
}));

// ---------- live events (SSE) ----------

api.get('/events', requireAuth, (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.write('event: hello\ndata: {}\n\n');
  addClient(req.user.id, res);
  const ping = setInterval(() => res.write(': ping\n\n'), 25000);
  res.on('close', () => clearInterval(ping));
});

// ---------- tasks ----------

api.post('/tasks', requireAuth, wrap(async (req, res) => {
  const { goal, file_ids = [] } = req.body;
  if (!goal || !String(goal).trim()) throw httpError(400, 'Describe what you want Yoshi to do');
  const task = createTask({ user: req.user, goal: String(goal).trim(), fileIds: file_ids });
  res.status(201).json(taskWithDetail(req.user.id, task.id));
}));

api.get('/tasks', requireAuth, (req, res) => {
  let sql = 'SELECT * FROM tasks WHERE user_id = ?';
  const args = [req.user.id];
  if (req.query.status) { sql += ' AND status = ?'; args.push(req.query.status); }
  sql += ' ORDER BY updated_at DESC LIMIT 200';
  res.json(db.prepare(sql).all(...args));
});

api.get('/tasks/:id', requireAuth, (req, res) => {
  const task = taskWithDetail(req.user.id, req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json(task);
});

api.post('/tasks/:id/messages', requireAuth, wrap(async (req, res) => {
  if (!req.body.content?.trim()) throw httpError(400, 'Message content required');
  const task = await addUserMessage(req.user, req.params.id, req.body.content.trim());
  if (!task) throw httpError(404, 'Task not found');
  res.json(taskWithDetail(req.user.id, task.id));
}));

for (const action of ['pause', 'resume', 'cancel', 'retry']) {
  const fns = { pause: requestPause, resume: requestResume, cancel: requestCancel, retry: retryTask };
  api.post(`/tasks/:id/${action}`, requireAuth, wrap(async (req, res) => {
    const task = fns[action](req.user, req.params.id);
    if (!task) throw httpError(404, 'Task not found');
    res.json(taskWithDetail(req.user.id, task.id));
  }));
}

api.post('/tasks/:id/plan', requireAuth, wrap(async (req, res) => {
  const detail = editPlan(req.user, req.params.id, req.body || {});
  if (!detail) throw httpError(404, 'Task not found');
  res.json(detail);
}));

api.get('/approvals', requireAuth, (req, res) => {
  res.json(db.prepare("SELECT * FROM approvals WHERE user_id = ? AND status = 'pending' ORDER BY created_at DESC").all(req.user.id));
});

api.post('/approvals/:id', requireAuth, wrap(async (req, res) => {
  const decision = req.body.decision === 'approve' ? 'approve' : 'reject';
  const approval = resolveApproval(req.user, req.params.id, decision);
  if (!approval) throw httpError(404, 'Approval not found or already resolved');
  res.json(approval);
}));

// ---------- activity history ----------

api.get('/activity', requireAuth, (req, res) => {
  const rows = db.prepare(
    `SELECT e.*, t.title AS task_title FROM task_events e
     JOIN tasks t ON t.id = e.task_id
     WHERE t.user_id = ? ORDER BY e.created_at DESC LIMIT 200`
  ).all(req.user.id);
  res.json(rows);
});

// ---------- files ----------

api.post('/files', requireAuth, upload.array('files', 10), wrap(async (req, res) => {
  if (!req.files?.length) throw httpError(400, 'No files uploaded');
  const out = req.files.map((f) =>
    registerUploadedFile({ userId: req.user.id, taskId: req.body.task_id || null, originalname: f.originalname, mimetype: f.mimetype, tmpPath: f.path })
  );
  res.status(201).json(out);
}));

api.get('/files', requireAuth, (req, res) => res.json(listFiles(req.user.id, { taskId: req.query.task_id })));

api.get('/files/:id/download', requireAuth, (req, res) => {
  const file = getFile(req.user.id, req.params.id);
  if (!file || !fs.existsSync(file.path)) return res.status(404).json({ error: 'File not found' });
  res.setHeader('Content-Type', file.mime);
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.name)}"`);
  fs.createReadStream(file.path).pipe(res);
});

api.patch('/files/:id', requireAuth, wrap(async (req, res) => {
  if (!req.body.name?.trim()) throw httpError(400, 'New name required');
  const file = renameFile(req.user.id, req.params.id, req.body.name.trim());
  if (!file) throw httpError(404, 'File not found');
  res.json(file);
}));

api.post('/files/:id/duplicate', requireAuth, wrap(async (req, res) => {
  const file = duplicateFile(req.user.id, req.params.id);
  if (!file) throw httpError(404, 'File not found');
  res.status(201).json(file);
}));

api.delete('/files/:id', requireAuth, (req, res) => {
  if (!deleteFile(req.user.id, req.params.id)) return res.status(404).json({ error: 'File not found' });
  res.json({ deleted: true });
});

// ---------- notifications ----------

api.get('/notifications', requireAuth, (req, res) => {
  res.json(db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100').all(req.user.id));
});
api.post('/notifications/read-all', requireAuth, (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(req.user.id);
  res.json({ ok: true });
});
api.post('/notifications/:id/read', requireAuth, (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

// ---------- schedules ----------

function scheduleOf(req) {
  const s = db.prepare('SELECT * FROM schedules WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!s) throw httpError(404, 'Schedule not found');
  return s;
}

api.get('/schedules', requireAuth, (req, res) => {
  res.json(db.prepare('SELECT * FROM schedules WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id));
});

api.post('/schedules', requireAuth, wrap(async (req, res) => {
  const { name, goal, workflow_id = null, cron = null, run_once_at = null, timezone } = req.body;
  if (!goal && !workflow_id) throw httpError(400, 'A schedule needs a goal or a workflow');
  if (!cron && !run_once_at) throw httpError(400, 'Provide a cron expression or a one-time datetime');
  const tz = timezone || req.user.timezone || 'UTC';
  const next = computeNextRun({ cron, run_once_at, timezone: tz });
  const id = uid();
  db.prepare('INSERT INTO schedules (id, user_id, name, goal, workflow_id, cron, timezone, run_once_at, next_run_at) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(id, req.user.id, name || (goal || 'Workflow run').slice(0, 60), goal || null, workflow_id, cron, tz, run_once_at, next);
  res.status(201).json(db.prepare('SELECT * FROM schedules WHERE id = ?').get(id));
}));

api.patch('/schedules/:id', requireAuth, wrap(async (req, res) => {
  const s = scheduleOf(req);
  const { name, goal, cron, run_once_at, timezone, enabled } = req.body;
  const nextVals = {
    name: name ?? s.name,
    goal: goal === undefined ? s.goal : goal,
    cron: cron === undefined ? s.cron : cron,
    run_once_at: run_once_at === undefined ? s.run_once_at : run_once_at,
    timezone: timezone ?? s.timezone,
    enabled: enabled === undefined ? s.enabled : (enabled ? 1 : 0),
  };
  const next = nextVals.enabled ? computeNextRun(nextVals) : null;
  db.prepare('UPDATE schedules SET name=?, goal=?, cron=?, run_once_at=?, timezone=?, enabled=?, next_run_at=? WHERE id=?')
    .run(nextVals.name, nextVals.goal, nextVals.cron, nextVals.run_once_at, nextVals.timezone, nextVals.enabled, next, s.id);
  res.json(db.prepare('SELECT * FROM schedules WHERE id = ?').get(s.id));
}));

api.delete('/schedules/:id', requireAuth, wrap(async (req, res) => {
  scheduleOf(req);
  db.prepare('DELETE FROM schedules WHERE id = ?').run(req.params.id);
  res.json({ deleted: true });
}));

api.post('/schedules/:id/run', requireAuth, wrap(async (req, res) => {
  const task = runScheduleNow(scheduleOf(req), { reason: 'run manually' });
  res.json({ task_id: task?.id });
}));

api.get('/schedules/:id/history', requireAuth, wrap(async (req, res) => {
  scheduleOf(req);
  res.json(db.prepare(
    `SELECT r.*, t.status AS task_status, t.title AS task_title, t.progress
     FROM schedule_runs r LEFT JOIN tasks t ON t.id = r.task_id
     WHERE r.schedule_id = ? ORDER BY r.started_at DESC LIMIT 100`
  ).all(req.params.id));
}));

// ---------- monitors ----------

function monitorOf(req) {
  const m = db.prepare('SELECT * FROM monitors WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!m) throw httpError(404, 'Monitor not found');
  return m;
}

api.get('/monitors', requireAuth, (req, res) => {
  res.json(db.prepare('SELECT * FROM monitors WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id));
});

api.post('/monitors', requireAuth, wrap(async (req, res) => {
  const { name, url, kind = 'content', keywords = null, selector = null, interval_minutes = 60 } = req.body;
  if (!url || !/^https?:\/\//.test(url)) throw httpError(400, 'A valid http(s) URL is required');
  const id = uid();
  db.prepare('INSERT INTO monitors (id, user_id, name, url, kind, keywords, selector, interval_minutes) VALUES (?,?,?,?,?,?,?,?)')
    .run(id, req.user.id, name || new URL(url).hostname, url, kind, keywords, selector, Math.max(5, Number(interval_minutes) || 60));
  res.status(201).json(db.prepare('SELECT * FROM monitors WHERE id = ?').get(id));
}));

api.patch('/monitors/:id', requireAuth, wrap(async (req, res) => {
  const m = monitorOf(req);
  const { name, url, kind, keywords, interval_minutes, enabled } = req.body;
  db.prepare('UPDATE monitors SET name=?, url=?, kind=?, keywords=?, interval_minutes=?, enabled=? WHERE id=?').run(
    name ?? m.name, url ?? m.url, kind ?? m.kind,
    keywords === undefined ? m.keywords : keywords,
    interval_minutes ? Math.max(5, Number(interval_minutes)) : m.interval_minutes,
    enabled === undefined ? m.enabled : (enabled ? 1 : 0), m.id
  );
  res.json(db.prepare('SELECT * FROM monitors WHERE id = ?').get(m.id));
}));

api.delete('/monitors/:id', requireAuth, wrap(async (req, res) => {
  monitorOf(req);
  db.prepare('DELETE FROM monitors WHERE id = ?').run(req.params.id);
  res.json({ deleted: true });
}));

api.post('/monitors/:id/check', requireAuth, wrap(async (req, res) => {
  const m = monitorOf(req);
  await checkMonitor(m);
  res.json(db.prepare('SELECT * FROM monitors WHERE id = ?').get(m.id));
}));

api.get('/monitors/:id/events', requireAuth, wrap(async (req, res) => {
  monitorOf(req);
  res.json(db.prepare('SELECT * FROM monitor_events WHERE monitor_id = ? ORDER BY created_at DESC LIMIT 100').all(req.params.id));
}));

// ---------- memories ----------

api.get('/memories', requireAuth, (req, res) => {
  res.json(listMemories(req.user.id, { q: req.query.q, category: req.query.category, project: req.query.project }));
});
api.post('/memories', requireAuth, wrap(async (req, res) => res.status(201).json(createMemory(req.user.id, req.body))));
api.patch('/memories/:id', requireAuth, wrap(async (req, res) => {
  const mem = updateMemory(req.user.id, req.params.id, req.body);
  if (!mem) throw httpError(404, 'Memory not found');
  res.json(mem);
}));
api.delete('/memories/:id', requireAuth, (req, res) => {
  if (!deleteMemory(req.user.id, req.params.id)) return res.status(404).json({ error: 'Memory not found' });
  res.json({ deleted: true });
});

// ---------- workflows ----------

function workflowOf(req) {
  const w = db.prepare('SELECT * FROM workflows WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!w) throw httpError(404, 'Workflow not found');
  return w;
}

api.get('/workflows', requireAuth, (req, res) => {
  res.json(db.prepare('SELECT * FROM workflows WHERE user_id = ? ORDER BY updated_at DESC').all(req.user.id));
});
api.get('/workflows/block-types', requireAuth, (req, res) => res.json(WORKFLOW_BLOCK_TYPES));

api.post('/workflows', requireAuth, wrap(async (req, res) => {
  const { name, description = '', definition = { blocks: [] } } = req.body;
  if (!name?.trim()) throw httpError(400, 'Workflow name required');
  validateWorkflowDefinition(definition);
  const id = uid();
  db.prepare('INSERT INTO workflows (id, user_id, name, description, definition) VALUES (?,?,?,?,?)')
    .run(id, req.user.id, name.trim(), description, JSON.stringify(definition));
  db.prepare('INSERT INTO workflow_versions (id, workflow_id, version, definition) VALUES (?,?,?,?)')
    .run(uid(), id, 1, JSON.stringify(definition));
  res.status(201).json(db.prepare('SELECT * FROM workflows WHERE id = ?').get(id));
}));

// Natural-language workflow generation.
api.post('/workflows/generate', requireAuth, wrap(async (req, res) => {
  if (!req.body.description?.trim()) throw httpError(400, 'Describe the workflow');
  const result = await askJSON(
    `Design a workflow from this description:\n${req.body.description}\n\n` +
      `Block types available: ${WORKFLOW_BLOCK_TYPES.join(', ')}.\n` +
      'Blocks run in dependency order; outputs of depends_on blocks are fed to dependents. ' +
      'Use a condition block plus only_if_block on dependents for branching. Params by type: ' +
      'create_document {format}, setup_monitor {url, kind, interval_minutes}, setup_schedule {name, goal, cron}, ' +
      'notify_user {title, body}, approval {description}, condition {condition}.',
    {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        blocks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' }, type: { type: 'string' }, title: { type: 'string' },
              instructions: { type: 'string' }, params: { type: 'object' },
              depends_on: { type: 'array', items: { type: 'string' } },
              only_if_block: { type: 'string' },
            },
            required: ['id', 'type', 'title', 'instructions'],
          },
        },
      },
      required: ['name', 'blocks'],
    }
  );
  const definition = { blocks: result.blocks };
  validateWorkflowDefinition(definition);
  res.json({ name: result.name, description: result.description || req.body.description, definition });
}));

api.get('/workflows/:id', requireAuth, wrap(async (req, res) => {
  const w = workflowOf(req);
  res.json({
    ...w,
    definition: JSON.parse(w.definition),
    versions: db.prepare('SELECT id, version, created_at FROM workflow_versions WHERE workflow_id = ? ORDER BY version DESC').all(w.id),
  });
}));

api.patch('/workflows/:id', requireAuth, wrap(async (req, res) => {
  const w = workflowOf(req);
  const { name, description, definition, enabled } = req.body;
  let version = w.version;
  if (definition) {
    validateWorkflowDefinition(definition);
    version = w.version + 1;
    db.prepare('INSERT INTO workflow_versions (id, workflow_id, version, definition) VALUES (?,?,?,?)')
      .run(uid(), w.id, version, JSON.stringify(definition));
  }
  db.prepare('UPDATE workflows SET name=?, description=?, definition=?, version=?, enabled=?, updated_at=? WHERE id=?').run(
    name ?? w.name, description ?? w.description,
    definition ? JSON.stringify(definition) : w.definition, version,
    enabled === undefined ? w.enabled : (enabled ? 1 : 0), now(), w.id
  );
  res.json(db.prepare('SELECT * FROM workflows WHERE id = ?').get(w.id));
}));

api.post('/workflows/:id/duplicate', requireAuth, wrap(async (req, res) => {
  const w = workflowOf(req);
  const id = uid();
  db.prepare('INSERT INTO workflows (id, user_id, name, description, definition) VALUES (?,?,?,?,?)')
    .run(id, req.user.id, `${w.name} (copy)`, w.description, w.definition);
  db.prepare('INSERT INTO workflow_versions (id, workflow_id, version, definition) VALUES (?,?,?,?)')
    .run(uid(), id, 1, w.definition);
  res.status(201).json(db.prepare('SELECT * FROM workflows WHERE id = ?').get(id));
}));

api.post('/workflows/:id/restore/:version', requireAuth, wrap(async (req, res) => {
  const w = workflowOf(req);
  const ver = db.prepare('SELECT * FROM workflow_versions WHERE workflow_id = ? AND version = ?').get(w.id, Number(req.params.version));
  if (!ver) throw httpError(404, 'Version not found');
  const newVersion = w.version + 1;
  db.prepare('INSERT INTO workflow_versions (id, workflow_id, version, definition) VALUES (?,?,?,?)')
    .run(uid(), w.id, newVersion, ver.definition);
  db.prepare('UPDATE workflows SET definition = ?, version = ?, updated_at = ? WHERE id = ?').run(ver.definition, newVersion, now(), w.id);
  res.json(db.prepare('SELECT * FROM workflows WHERE id = ?').get(w.id));
}));

api.get('/workflows/:id/versions/:version', requireAuth, wrap(async (req, res) => {
  const w = workflowOf(req);
  const ver = db.prepare('SELECT * FROM workflow_versions WHERE workflow_id = ? AND version = ?').get(w.id, Number(req.params.version));
  if (!ver) throw httpError(404, 'Version not found');
  res.json({ ...ver, definition: JSON.parse(ver.definition) });
}));

api.post('/workflows/:id/run', requireAuth, wrap(async (req, res) => {
  const w = workflowOf(req);
  const definition = JSON.parse(w.definition);
  if (!definition.blocks?.length) throw httpError(400, 'Workflow has no blocks yet');
  const steps = stepsFromWorkflow(definition, { inputText: req.body?.input || '' });
  const runId = uid();
  db.prepare('INSERT INTO workflow_runs (id, workflow_id, version, status) VALUES (?,?,?,?)').run(runId, w.id, w.version, 'started');
  const task = createTask({
    user: req.user,
    goal: `Run workflow "${w.name}"${req.body?.input ? ` — input: ${req.body.input}` : ''}`,
    title: `Workflow: ${w.name}`,
    source: 'workflow',
    workflow: w,
    workflowRunId: runId,
    steps,
  });
  db.prepare('UPDATE workflow_runs SET task_id = ? WHERE id = ?').run(task.id, runId);
  res.status(201).json({ run_id: runId, task_id: task.id });
}));

api.get('/workflows/:id/runs', requireAuth, wrap(async (req, res) => {
  const w = workflowOf(req);
  res.json(db.prepare(
    `SELECT r.*, t.status AS task_status, t.progress, t.title AS task_title
     FROM workflow_runs r LEFT JOIN tasks t ON t.id = r.task_id
     WHERE r.workflow_id = ? ORDER BY r.started_at DESC LIMIT 100`
  ).all(w.id));
}));

api.delete('/workflows/:id', requireAuth, wrap(async (req, res) => {
  workflowOf(req);
  db.prepare('DELETE FROM workflows WHERE id = ?').run(req.params.id);
  res.json({ deleted: true });
}));
