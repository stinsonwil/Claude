// Durable task engine — the single execution path for everything Yoshi does.
// Tasks and steps live in SQLite, so work survives page refreshes, browser
// closure, logout, and server restarts: on boot, anything that was mid-flight
// is re-queued and picked up again. Progress reflects actually-completed
// steps; nothing is timer-faked.
import { db, uid, now, touchTask } from './db.js';
import { emitToUser, logTaskEvent, notify } from './events.js';
import { planTask, adaptPlan } from './planner.js';
import { executeCapability } from './capabilities/index.js';
import { bindTaskCreator } from './scheduler.js';
import { config } from './config.js';

const running = new Map(); // taskId -> AbortController
const STEP_TIMEOUT_MS = 20 * 60 * 1000;

// ---------- queries ----------

export function getTask(userId, taskId) {
  return db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(taskId, userId) || null;
}
export function getSteps(taskId) {
  return db.prepare('SELECT * FROM task_steps WHERE task_id = ? ORDER BY idx').all(taskId);
}
export function taskWithDetail(userId, taskId) {
  const task = getTask(userId, taskId);
  if (!task) return null;
  return {
    ...task,
    steps: getSteps(taskId),
    messages: db.prepare('SELECT * FROM task_messages WHERE task_id = ? ORDER BY created_at').all(taskId),
    events: db.prepare('SELECT * FROM task_events WHERE task_id = ? ORDER BY created_at DESC LIMIT 100').all(taskId),
    files: db.prepare('SELECT id, name, mime, size, kind, created_at FROM files WHERE task_id = ? ORDER BY created_at').all(taskId),
    approvals: db.prepare('SELECT * FROM approvals WHERE task_id = ? ORDER BY created_at').all(taskId),
  };
}

function setTask(taskId, fields) {
  const keys = Object.keys(fields);
  db.prepare(`UPDATE tasks SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`)
    .run(...keys.map((k) => fields[k]), now(), taskId);
}
function setStep(stepId, fields) {
  const keys = Object.keys(fields);
  db.prepare(`UPDATE task_steps SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`)
    .run(...keys.map((k) => fields[k]), stepId);
}

function refreshProgress(task) {
  const steps = getSteps(task.id);
  const done = steps.filter((s) => ['completed', 'skipped'].includes(s.status)).length;
  const progress = steps.length ? done / steps.length : 0;
  setTask(task.id, { progress });
  return progress;
}

function broadcast(task) {
  const fresh = db.prepare('SELECT * FROM tasks WHERE id = ?').get(task.id);
  emitToUser(task.user_id, 'task.updated', { ...fresh, steps: getSteps(task.id) });
}

// ---------- creation ----------

export function insertSteps(taskId, steps, startIdx = 0) {
  const stmt = db.prepare(
    'INSERT INTO task_steps (id, task_id, idx, title, capability, instructions, params, depends_on, requires_approval) VALUES (?,?,?,?,?,?,?,?,?)'
  );
  steps.forEach((s, i) => {
    stmt.run(
      uid(), taskId, startIdx + i, s.title, s.capability, s.instructions || '',
      JSON.stringify(s.params || {}), JSON.stringify(s.depends_on || []), s.requires_approval ? 1 : 0
    );
  });
}

export function createTask({ user, goal, title, source = 'chat', scheduleId = null, workflow = null, workflowRunId = null, steps = null, fileIds = [] }) {
  const id = uid();
  db.prepare(
    'INSERT INTO tasks (id, user_id, title, goal, status, source, schedule_id, workflow_id, workflow_run_id) VALUES (?,?,?,?,?,?,?,?,?)'
  ).run(
    id, user.id, title || String(goal).slice(0, 90), goal,
    steps ? 'queued' : 'planning', source, scheduleId, workflow?.id || null, workflowRunId
  );
  db.prepare('INSERT INTO task_messages (id, task_id, role, content) VALUES (?,?,?,?)').run(uid(), id, 'user', goal);
  for (const fid of fileIds) db.prepare('UPDATE files SET task_id = ? WHERE id = ? AND user_id = ?').run(id, fid, user.id);
  if (steps) insertSteps(id, steps);
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!steps) setTask(id, { status: 'queued' }); // planning happens inside the worker
  logTaskEvent(task, 'created', `Task created (${source})`);
  broadcast(task);
  return task;
}
bindTaskCreator(createTask);

// ---------- messaging / clarification ----------

export function addAgentMessage(task, content) {
  db.prepare('INSERT INTO task_messages (id, task_id, role, content) VALUES (?,?,?,?)').run(uid(), task.id, 'agent', content);
  emitToUser(task.user_id, 'task.message', { taskId: task.id, role: 'agent', content });
}

export async function addUserMessage(user, taskId, content) {
  const task = getTask(user.id, taskId);
  if (!task) return null;
  db.prepare('INSERT INTO task_messages (id, task_id, role, content) VALUES (?,?,?,?)').run(uid(), taskId, 'user', content);
  if (['completed', 'failed', 'cancelled', 'awaiting_input', 'paused'].includes(task.status)) {
    // Follow-up: adapt the plan with new steps and re-queue.
    setTask(taskId, { status: 'queued', control: null, error: null, completed_at: null });
    db.prepare("UPDATE tasks SET result = NULL WHERE id = ? AND status = 'queued'").run(taskId);
    logTaskEvent(task, 'follow_up', 'User follow-up received — adapting plan');
  }
  broadcast(task);
  return getTask(user.id, taskId);
}

// ---------- controls ----------

export function requestPause(user, taskId) {
  const task = getTask(user.id, taskId);
  if (!task) return null;
  if (['queued', 'running', 'planning'].includes(task.status)) {
    setTask(taskId, { control: 'pause_requested' });
    if (!running.has(taskId) && task.status === 'queued') setTask(taskId, { status: 'paused', control: null });
    logTaskEvent(task, 'control', 'Pause requested');
  }
  broadcast(task);
  return getTask(user.id, taskId);
}

export function requestResume(user, taskId) {
  const task = getTask(user.id, taskId);
  if (!task) return null;
  if (['paused', 'awaiting_approval'].includes(task.status)) {
    setTask(taskId, { status: 'queued', control: null });
    logTaskEvent(task, 'control', 'Resumed');
  }
  broadcast(task);
  return getTask(user.id, taskId);
}

export function requestCancel(user, taskId) {
  const task = getTask(user.id, taskId);
  if (!task) return null;
  if (['completed', 'cancelled'].includes(task.status)) return task;
  if (running.has(taskId)) {
    setTask(taskId, { control: 'cancel_requested' });
    running.get(taskId).abort(new Error('Cancelled by user'));
  } else {
    setTask(taskId, { status: 'cancelled', control: null, completed_at: now() });
  }
  logTaskEvent(task, 'control', 'Cancel requested');
  broadcast(task);
  return getTask(user.id, taskId);
}

export function retryTask(user, taskId) {
  const task = getTask(user.id, taskId);
  if (!task) return null;
  db.prepare("UPDATE task_steps SET status = 'pending', error = NULL WHERE task_id = ? AND status = 'failed'").run(taskId);
  setTask(taskId, { status: 'queued', control: null, error: null, completed_at: null });
  logTaskEvent(task, 'control', 'Retry requested — failed steps reset');
  broadcast(task);
  return getTask(user.id, taskId);
}

// ---------- plan editing ----------

const EDITABLE_STATUSES = ['paused', 'awaiting_input', 'awaiting_approval', 'failed', 'planning', 'queued'];

export function editPlan(user, taskId, { reorder, remove, add, update }) {
  const task = getTask(user.id, taskId);
  if (!task) return null;
  if (!EDITABLE_STATUSES.includes(task.status)) {
    throw Object.assign(new Error('Pause the task before editing its plan'), { status: 409 });
  }
  const tx = db.transaction(() => {
    if (remove?.length) {
      for (const stepId of remove) {
        db.prepare("DELETE FROM task_steps WHERE id = ? AND task_id = ? AND status IN ('pending','failed','skipped')").run(stepId, taskId);
      }
    }
    if (update?.length) {
      for (const u of update) {
        const step = db.prepare('SELECT * FROM task_steps WHERE id = ? AND task_id = ?').get(u.id, taskId);
        if (!step || !['pending', 'failed'].includes(step.status)) continue;
        setStep(u.id, {
          title: u.title ?? step.title,
          instructions: u.instructions ?? step.instructions,
          params: u.params ? JSON.stringify(u.params) : step.params,
          requires_approval: u.requires_approval === undefined ? step.requires_approval : (u.requires_approval ? 1 : 0),
          status: 'pending',
          error: null,
        });
      }
    }
    if (add?.length) {
      const maxIdx = db.prepare('SELECT COALESCE(MAX(idx), -1) m FROM task_steps WHERE task_id = ?').get(taskId).m;
      insertSteps(taskId, add, maxIdx + 1);
    }
    if (reorder?.length) {
      // reorder = full list of step ids in the new order; completed steps keep relative order guarantees via idx rewrite
      reorder.forEach((stepId, i) => {
        db.prepare('UPDATE task_steps SET idx = ? WHERE id = ? AND task_id = ?').run(i, stepId, taskId);
      });
    }
  });
  tx();
  logTaskEvent(task, 'plan_edited', 'Plan edited by user');
  broadcast(task);
  return taskWithDetail(user.id, taskId);
}

// ---------- approvals ----------

function createApproval(task, step, description, details = null) {
  const id = uid();
  db.prepare('INSERT INTO approvals (id, task_id, step_id, user_id, description, details) VALUES (?,?,?,?,?,?)')
    .run(id, task.id, step.id, task.user_id, description, details ? JSON.stringify(details) : null);
  notify(task.user_id, { taskId: task.id, title: 'Approval needed', body: description, kind: 'approval' });
  emitToUser(task.user_id, 'approval.requested', { taskId: task.id, stepId: step.id, approvalId: id, description });
  logTaskEvent(task, 'approval_requested', description);
}

export function resolveApproval(user, approvalId, decision) {
  const approval = db.prepare('SELECT * FROM approvals WHERE id = ? AND user_id = ?').get(approvalId, user.id);
  if (!approval || approval.status !== 'pending') return null;
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(approval.task_id);
  const step = db.prepare('SELECT * FROM task_steps WHERE id = ?').get(approval.step_id);
  const approved = decision === 'approve';
  db.prepare('UPDATE approvals SET status = ?, resolved_at = ? WHERE id = ?')
    .run(approved ? 'approved' : 'rejected', now(), approvalId);

  if (approved) {
    if (step) {
      const params = JSON.parse(step.params || '{}');
      // Browser in-step approvals: remember exactly which action was granted.
      params.approved_actions = [...(params.approved_actions || []), approval.description.replace(/^Approval required: /, '')];
      setStep(step.id, { params: JSON.stringify(params), status: 'pending', error: null });
    }
    setTask(task.id, { status: 'queued', control: null });
    logTaskEvent(task, 'approval_resolved', `Approved: ${approval.description}`);
  } else {
    if (step) setStep(step.id, { status: 'failed', error: 'Rejected by user' });
    setTask(task.id, { status: 'paused', control: null });
    addAgentMessage(task, `You rejected: "${approval.description}". I paused the task — you can edit the plan, retry, send new instructions, or cancel.`);
    logTaskEvent(task, 'approval_resolved', `Rejected: ${approval.description}`);
  }
  broadcast(task);
  return db.prepare('SELECT * FROM approvals WHERE id = ?').get(approvalId);
}

// ---------- execution ----------

function parseJSON(text, fallback) {
  try { return JSON.parse(text); } catch { return fallback; }
}

function contextForStep(task, step) {
  const steps = getSteps(task.id);
  const deps = parseJSON(step.depends_on, []);
  const source = deps.length ? steps.filter((s) => deps.includes(s.idx)) : steps.filter((s) => s.idx < step.idx);
  const parts = [];
  for (const s of source) {
    if (s.status !== 'completed' || !s.output) continue;
    parts.push(`## Output of step ${s.idx} — ${s.title}\n${String(s.output).slice(0, 24000)}`);
  }
  return parts.join('\n\n');
}

function nextEligibleStep(task) {
  const steps = getSteps(task.id);
  const byIdx = new Map(steps.map((s) => [s.idx, s]));
  for (const step of steps) {
    if (step.status !== 'pending') continue;
    const deps = parseJSON(step.depends_on, []);
    if (deps.some((d) => !byIdx.has(d))) { return { step, skip: 'has a dependency that no longer exists' }; }
    if (deps.some((d) => byIdx.get(d).status === 'failed')) return { step, blocked: true };
    if (deps.some((d) => ['skipped'].includes(byIdx.get(d).status))) return { step, skip: 'depends on a skipped step' };
    if (!deps.every((d) => byIdx.get(d).status === 'completed')) continue;
    // Conditional branch: skip when the referenced condition step returned passed=false.
    const params = parseJSON(step.params, {});
    if (params.only_if_step !== undefined) {
      const cond = byIdx.get(Number(params.only_if_step));
      const passed = cond && cond.status === 'completed' && parseJSON(cond.output, {}).passed === true;
      if (!passed) return { step, skip: `condition in step ${params.only_if_step} was not met` };
    }
    return { step };
  }
  return null;
}

function composeResult(task) {
  const steps = getSteps(task.id);
  const parts = [];
  for (const s of steps) {
    if (s.status !== 'completed' || !s.output) continue;
    const out = parseJSON(s.output, {});
    if (out.report_markdown) parts.push(out.report_markdown);
    else if (out.answer_markdown) parts.push(out.answer_markdown);
    else if (out.summary) parts.push(`**${s.title}:** ${out.summary}`);
    else if (out.message) parts.push(`**${s.title}:** ${out.message}`);
    else if (out.file_name) parts.push(`**${s.title}:** created file \`${out.file_name}\` (available in Files).`);
    if (out.sources?.length) {
      parts.push('**Sources:**\n' + out.sources.map((src, i) => `${i + 1}. [${src.title}](${src.url})${src.valid ? '' : ' *(link did not validate)*'}`).join('\n'));
    }
    if (out.findings?.length) parts.push('**Findings:**\n' + out.findings.map((f) => `- ${f}`).join('\n'));
  }
  return parts.length ? parts.join('\n\n---\n\n') : 'Task completed.';
}

async function executeTask(taskId) {
  const abort = new AbortController();
  running.set(taskId, abort);
  let task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(task.user_id);
  try {
    if (!task.started_at) setTask(taskId, { started_at: now() });
    setTask(taskId, { status: 'running' });
    broadcast(task);

    // Plan first if the task has no steps yet, or a follow-up arrived after completion.
    let steps = getSteps(taskId);
    const lastMsg = db.prepare('SELECT role FROM task_messages WHERE task_id = ? ORDER BY created_at DESC LIMIT 1').get(taskId);
    const needsAdapt = steps.length > 0 && lastMsg?.role === 'user' && !steps.some((s) => s.status === 'pending');
    if (steps.length === 0 || needsAdapt) {
      logTaskEvent(task, 'planning', steps.length ? 'Adapting plan for follow-up' : 'Building execution plan');
      const plan = steps.length ? await adaptPlan(task, user) : await planTask(task, user);
      if (plan.needs_clarification && plan.clarification_questions?.length) {
        addAgentMessage(task, `Before I start, I need a bit more detail:\n\n${plan.clarification_questions.map((q) => `- ${q}`).join('\n')}`);
        setTask(taskId, { status: 'awaiting_input' });
        logTaskEvent(task, 'clarification', 'Waiting for user input');
        broadcast(task);
        return;
      }
      const maxIdx = db.prepare('SELECT COALESCE(MAX(idx), -1) m FROM task_steps WHERE task_id = ?').get(taskId).m;
      insertSteps(taskId, plan.steps || [], maxIdx + 1);
      if (!steps.length && plan.title) setTask(taskId, { title: plan.title });
      logTaskEvent(task, 'planned', `Plan ready: ${(plan.steps || []).length} step(s)`, { steps: (plan.steps || []).map((s) => s.title) });
      broadcast(task);
    }

    // Step loop.
    for (;;) {
      task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
      if (task.control === 'cancel_requested') {
        setTask(taskId, { status: 'cancelled', control: null, completed_at: now() });
        logTaskEvent(task, 'cancelled', 'Task cancelled');
        break;
      }
      if (task.control === 'pause_requested') {
        setTask(taskId, { status: 'paused', control: null });
        logTaskEvent(task, 'paused', 'Task paused — resume anytime');
        break;
      }

      const next = nextEligibleStep(task);
      if (!next) {
        const remaining = getSteps(taskId).filter((s) => ['pending', 'running', 'awaiting_approval'].includes(s.status));
        const failed = getSteps(taskId).filter((s) => s.status === 'failed');
        if (failed.length) {
          setTask(taskId, { status: 'failed', error: failed[0].error, completed_at: now() });
          notify(user.id, { taskId, title: `Task failed: ${task.title}`, body: failed[0].error || '', kind: 'error' });
          logTaskEvent(task, 'failed', `Step "${failed[0].title}" failed: ${failed[0].error}`);
        } else if (remaining.length === 0) {
          const result = composeResult(task);
          setTask(taskId, { status: 'completed', result, progress: 1, completed_at: now() });
          addAgentMessage(task, result);
          notify(user.id, { taskId, title: `Task completed: ${task.title}`, body: 'The finished output is ready.', kind: 'success' });
          logTaskEvent(task, 'completed', 'Task completed');
        }
        break;
      }
      if (next.blocked) {
        const failed = getSteps(taskId).find((s) => s.status === 'failed');
        setTask(taskId, { status: 'failed', error: failed?.error || 'A dependency failed', completed_at: now() });
        notify(user.id, { taskId, title: `Task failed: ${task.title}`, body: failed?.error || '', kind: 'error' });
        break;
      }
      if (next.skip) {
        setStep(next.step.id, { status: 'skipped', completed_at: now() });
        logTaskEvent(task, 'step_skipped', `Skipped "${next.step.title}" (${next.skip})`);
        refreshProgress(task);
        broadcast(task);
        continue;
      }

      const step = next.step;
      const params = parseJSON(step.params, {});

      // Approval gate: explicit approval steps and any step flagged requires_approval.
      if (step.requires_approval || step.capability === 'approval') {
        const existing = db.prepare('SELECT * FROM approvals WHERE step_id = ? ORDER BY created_at DESC LIMIT 1').get(step.id);
        if (!existing || existing.status === 'rejected') {
          createApproval(task, step, params.description || `Approve step: ${step.title} — ${step.instructions.slice(0, 300)}`);
          setStep(step.id, { status: 'awaiting_approval' });
          setTask(taskId, { status: 'awaiting_approval' });
          broadcast(task);
          return;
        }
        if (existing.status === 'pending') {
          setStep(step.id, { status: 'awaiting_approval' });
          setTask(taskId, { status: 'awaiting_approval' });
          broadcast(task);
          return;
        }
        // approved → fall through and execute
      }

      setStep(step.id, { status: 'running', started_at: now(), attempts: step.attempts + 1 });
      logTaskEvent(task, 'step_started', `Started: ${step.title}`);
      broadcast(task);
      try {
        const timeout = setTimeout(() => abort.abort(new Error('Step timed out')), STEP_TIMEOUT_MS);
        let output;
        try {
          output = await executeCapability({
            task, step, user, params,
            instructions: step.instructions,
            contextText: contextForStep(task, step),
            signal: abort.signal,
            approvedActions: params.approved_actions || [],
            onProgress: (msg) => logTaskEvent(task, 'step_progress', msg),
          });
        } finally {
          clearTimeout(timeout);
        }
        setStep(step.id, { status: 'completed', output: JSON.stringify(output ?? {}), completed_at: now() });
        logTaskEvent(task, 'step_completed', `Completed: ${step.title}`);
      } catch (err) {
        if (err.code === 'PAUSE_FOR_APPROVAL') {
          createApproval(task, step, err.approvalDescription, err.approvalDetails);
          setStep(step.id, { status: 'awaiting_approval' });
          setTask(taskId, { status: 'awaiting_approval' });
          broadcast(task);
          return;
        }
        const cancelled = abort.signal.aborted && db.prepare('SELECT control FROM tasks WHERE id = ?').get(taskId)?.control === 'cancel_requested';
        if (cancelled) {
          setStep(step.id, { status: 'pending' });
          setTask(taskId, { status: 'cancelled', control: null, completed_at: now() });
          logTaskEvent(task, 'cancelled', 'Task cancelled');
          break;
        }
        setStep(step.id, { status: 'failed', error: String(err.message || err) });
        logTaskEvent(task, 'step_failed', `Failed: ${step.title} — ${err.message}`);
      }
      refreshProgress(task);
      broadcast(task);
    }
  } catch (err) {
    setTask(taskId, { status: 'failed', error: String(err.message || err), completed_at: now() });
    notify(task.user_id, { taskId, title: `Task failed: ${task.title}`, body: String(err.message || err), kind: 'error' });
    logTaskEvent(task, 'failed', String(err.message || err));
  } finally {
    running.delete(taskId);
    const fresh = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
    if (fresh) {
      // Workflow-run bookkeeping.
      if (fresh.workflow_run_id && ['completed', 'failed', 'cancelled'].includes(fresh.status)) {
        db.prepare('UPDATE workflow_runs SET status = ? WHERE id = ?').run(fresh.status, fresh.workflow_run_id);
      }
      broadcast(fresh);
    }
  }
}

// ---------- worker loop & recovery ----------

function tick() {
  const capacity = config.taskConcurrency - running.size;
  if (capacity <= 0) return;
  const queued = db.prepare("SELECT id FROM tasks WHERE status = 'queued' ORDER BY updated_at LIMIT ?").all(capacity);
  for (const { id } of queued) {
    if (running.has(id)) continue;
    setTask(id, { status: 'running' });
    executeTask(id).catch((err) => console.error('Task execution error', id, err));
  }
}

export function startTaskEngine() {
  // Crash/restart recovery: anything mid-flight goes back to the queue.
  db.prepare("UPDATE task_steps SET status = 'pending', started_at = NULL WHERE status = 'running'").run();
  const interrupted = db.prepare("SELECT id FROM tasks WHERE status IN ('running','planning')").all();
  for (const { id } of interrupted) setTask(id, { status: 'queued' });
  if (interrupted.length) console.log(`Recovered ${interrupted.length} interrupted task(s) after restart`);
  setInterval(tick, 2000).unref();
}
