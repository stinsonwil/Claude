// Capability registry. Every unit of work Yoshi can do — regardless of
// whether it came from chat, a schedule, a monitor, or a workflow — executes
// through one of these entries via the shared task engine.
import { runResearch } from './research.js';
import { runBrowser } from './browser.js';
import { runFileAnalysis } from './files.js';
import { runDocumentCreation } from './documents.js';
import { ask, askJSON } from '../ai.js';
import { db, uid } from '../db.js';
import { notify } from '../events.js';
import { createMemory, updateMemory, deleteMemory, memoryPrompt } from '../memory.js';
import { computeNextRun } from '../scheduler.js';

export const CAPABILITIES = {
  research: {
    label: 'Deep Research',
    description: 'Web research with real sources and citations. Params: none (instructions describe what to research).',
  },
  browser: {
    label: 'Browser Automation',
    description: 'Operates a real browser: navigate, click, type, extract, download. Asks for user approval before irreversible actions. Params: none.',
  },
  file_analysis: {
    label: 'File Analysis',
    description: 'Analyzes uploaded files (PDF, DOCX, XLSX, CSV, PPTX, TXT, images). Params: {file_ids?: string[]} — defaults to all files attached to the task.',
  },
  create_document: {
    label: 'Document Creation',
    description: 'Generates a real downloadable document. Params: {format: "pdf"|"docx"|"pptx"|"xlsx"}.',
  },
  setup_monitor: {
    label: 'Website Monitoring',
    description: 'Creates a persistent website monitor. Params: {url, name, kind: "content"|"price"|"availability"|"keyword"|"uptime", keywords?: string, interval_minutes?: number}.',
  },
  setup_schedule: {
    label: 'Scheduled Task',
    description: 'Creates a recurring or one-time schedule that runs a goal later/repeatedly. Params: {name, goal, cron?: "m h dom mon dow", run_once_at?: ISO datetime, timezone?: IANA tz}.',
  },
  save_memory: {
    label: 'Memory',
    description: 'Saves a long-term memory the user explicitly asked to remember. Params: {content, category: "preference"|"writing_style"|"project"|"company"|"instruction"|"general", project?: string}.',
  },
  approval: {
    label: 'User Approval',
    description: 'Explicit checkpoint: execution pauses until the user approves. Params: {description: what the user is approving}.',
  },
  condition: {
    label: 'Condition',
    description: 'Evaluates a yes/no condition against earlier step outputs. Later steps with params.only_if_step = <this step index> are skipped when it fails. Params: {condition: string}.',
  },
  notify_user: {
    label: 'Notification',
    description: 'Sends the user an in-app notification. Params: {title, body}.',
  },
  answer: {
    label: 'Reasoning / Writing / Verification',
    description: 'General AI step: analyze, summarize, draft text, or verify that earlier outputs satisfy the goal. Params: none.',
  },
};

export function capabilityCatalog() {
  return Object.entries(CAPABILITIES)
    .map(([key, c]) => `- ${key}: ${c.description}`)
    .join('\n');
}

/**
 * Executes one step. `ctx` carries: task, step, user, params, instructions,
 * contextText (outputs of dependency steps), signal, onProgress,
 * approvedActions.
 */
export async function executeCapability(ctx) {
  const { step } = ctx;
  const memoryText = memoryPrompt(ctx.user);
  const common = { ...ctx, memoryText };

  switch (step.capability) {
    case 'research':
      return runResearch(common);
    case 'browser':
      return runBrowser(common);
    case 'file_analysis': {
      let fileIds = ctx.params.file_ids;
      if (!fileIds || !fileIds.length) {
        fileIds = db.prepare("SELECT id FROM files WHERE task_id = ? AND kind = 'uploaded'").all(ctx.task.id).map((r) => r.id);
      }
      return runFileAnalysis({ ...common, fileIds });
    }
    case 'create_document':
      return runDocumentCreation({ ...common, format: ctx.params.format });
    case 'setup_monitor': {
      const p = ctx.params;
      if (!p.url) throw new Error('setup_monitor requires a url param');
      const id = uid();
      db.prepare('INSERT INTO monitors (id, user_id, name, url, kind, keywords, interval_minutes) VALUES (?,?,?,?,?,?,?)').run(
        id, ctx.user.id, p.name || `Monitor ${new URL(p.url).hostname}`, p.url,
        p.kind || 'content', p.keywords || null, Math.max(5, Number(p.interval_minutes) || 60)
      );
      return { monitor_id: id, message: `Monitoring ${p.url} every ${Math.max(5, Number(p.interval_minutes) || 60)} minutes.` };
    }
    case 'setup_schedule': {
      const p = ctx.params;
      if (!p.goal) throw new Error('setup_schedule requires a goal param');
      if (!p.cron && !p.run_once_at) throw new Error('setup_schedule requires cron or run_once_at');
      const tz = p.timezone || ctx.user.timezone || 'UTC';
      const id = uid();
      const nextRun = computeNextRun({ cron: p.cron, run_once_at: p.run_once_at, timezone: tz });
      db.prepare('INSERT INTO schedules (id, user_id, name, goal, cron, timezone, run_once_at, next_run_at) VALUES (?,?,?,?,?,?,?,?)').run(
        id, ctx.user.id, p.name || p.goal.slice(0, 60), p.goal, p.cron || null, tz, p.run_once_at || null, nextRun
      );
      return { schedule_id: id, next_run_at: nextRun, message: `Scheduled: ${p.name || p.goal.slice(0, 60)} (next run ${nextRun}).` };
    }
    case 'save_memory': {
      const p = ctx.params;
      if (!ctx.user.memory_enabled) return { saved: false, message: 'Memory is disabled in the user settings; nothing was stored.' };
      const mem = createMemory(ctx.user.id, { category: p.category || 'general', project: p.project || null, content: p.content || ctx.instructions });
      return { saved: true, memory_id: mem.id };
    }
    case 'approval': {
      // The engine gates this step before execution; reaching here means it was approved.
      return { approved: true };
    }
    case 'condition': {
      const { passed, reason } = await askJSON(
        `Evaluate this condition strictly against the data below.\nCondition: ${ctx.params.condition || ctx.instructions}\n\nData from earlier steps:\n${ctx.contextText || '(none)'}`,
        { type: 'object', properties: { passed: { type: 'boolean' }, reason: { type: 'string' } }, required: ['passed', 'reason'] },
        { signal: ctx.signal }
      );
      return { passed, reason };
    }
    case 'notify_user': {
      notify(ctx.user.id, {
        taskId: ctx.task.id,
        title: ctx.params.title || 'Update from Yoshi',
        body: ctx.params.body || ctx.instructions,
      });
      return { notified: true };
    }
    case 'answer': {
      const text = await ask(
        `${ctx.instructions}\n${ctx.contextText ? `\nMaterial from earlier steps:\n${ctx.contextText}` : ''}${memoryText}\n\n` +
          'Base your answer strictly on the material provided plus general knowledge; clearly flag anything uncertain. Respond in Markdown.',
        { maxTokens: 6000, signal: ctx.signal }
      );
      return { answer_markdown: text };
    }
    default:
      throw new Error(`Unknown capability: ${step.capability}`);
  }
}
