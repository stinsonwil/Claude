// Persistent scheduler: schedules live in SQLite with a precomputed
// next_run_at, so they survive restarts and run regardless of whether the
// user is online. A 20s loop claims due schedules and creates real tasks.
import { CronExpressionParser } from 'cron-parser';
import { db, uid, now } from './db.js';
import { notify } from './events.js';

export function computeNextRun({ cron, run_once_at, timezone = 'UTC' }, from = new Date()) {
  if (run_once_at) {
    const t = new Date(run_once_at);
    if (Number.isNaN(t.getTime())) throw Object.assign(new Error('Invalid run_once_at datetime'), { status: 400 });
    return t.toISOString();
  }
  if (!cron) return null;
  try {
    const it = CronExpressionParser.parse(cron, { tz: timezone, currentDate: from });
    return it.next().toISOString();
  } catch (err) {
    throw Object.assign(new Error(`Invalid cron expression "${cron}": ${err.message}`), { status: 400 });
  }
}

let createTaskFn = null; // injected by taskEngine to avoid a circular import
export function bindTaskCreator(fn) {
  createTaskFn = fn;
}

export function runScheduleNow(schedule, { reason = 'scheduled run' } = {}) {
  if (!createTaskFn) throw new Error('Task engine not ready');
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(schedule.user_id);
  if (!user) return null;

  let task;
  if (schedule.workflow_id) {
    const wf = db.prepare('SELECT * FROM workflows WHERE id = ? AND user_id = ?').get(schedule.workflow_id, user.id);
    if (!wf) return null;
    task = createTaskFn({
      user,
      goal: `Run workflow "${wf.name}"`,
      source: 'schedule',
      scheduleId: schedule.id,
      workflow: wf,
    });
  } else {
    task = createTaskFn({ user, goal: schedule.goal, source: 'schedule', scheduleId: schedule.id });
  }
  db.prepare('INSERT INTO schedule_runs (id, schedule_id, task_id) VALUES (?,?,?)').run(uid(), schedule.id, task.id);
  db.prepare('UPDATE schedules SET last_run_at = ? WHERE id = ?').run(now(), schedule.id);
  notify(user.id, { taskId: task.id, title: `Schedule started: ${schedule.name}`, body: reason, kind: 'schedule' });
  return task;
}

function tick() {
  const due = db.prepare("SELECT * FROM schedules WHERE enabled = 1 AND next_run_at IS NOT NULL AND next_run_at <= ?").all(now());
  for (const schedule of due) {
    try {
      // Advance next_run_at FIRST so a crash mid-run can't cause a rapid-fire loop.
      if (schedule.run_once_at) {
        db.prepare('UPDATE schedules SET next_run_at = NULL, enabled = 0 WHERE id = ?').run(schedule.id);
      } else {
        const next = computeNextRun(schedule);
        db.prepare('UPDATE schedules SET next_run_at = ? WHERE id = ?').run(next, schedule.id);
      }
      runScheduleNow(schedule);
    } catch (err) {
      console.error(`Schedule ${schedule.id} failed to start:`, err.message);
    }
  }
}

export function startScheduler() {
  setInterval(tick, 20000).unref();
}
