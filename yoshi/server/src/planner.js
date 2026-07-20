// Planning engine: turns a natural-language goal into an executable plan of
// capability steps. The user never picks capabilities — this is the single
// place where requests are routed. Also handles clarification questions and
// adaptive replanning on follow-ups.
import { askJSON } from './ai.js';
import { config } from './config.js';
import { db } from './db.js';
import { capabilityCatalog } from './capabilities/index.js';
import { memoryPrompt } from './memory.js';

const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    needs_clarification: { type: 'boolean' },
    clarification_questions: { type: 'array', items: { type: 'string' } },
    title: { type: 'string', description: 'Short task title (max 8 words)' },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          capability: { type: 'string' },
          instructions: { type: 'string', description: 'Complete, self-contained instructions for this step' },
          params: { type: 'object', description: 'Capability-specific params (see catalog)' },
          depends_on: { type: 'array', items: { type: 'integer' }, description: '0-based indexes of steps whose output this step needs' },
          requires_approval: { type: 'boolean', description: 'true if the user must approve before this step runs' },
        },
        required: ['title', 'capability', 'instructions'],
      },
    },
  },
  required: ['needs_clarification', 'title'],
};

function plannerSystem(user) {
  return (
    'You are the planning engine of Yoshi, a unified AI work agent. You turn a user goal into an executable plan.\n' +
    `Available capabilities:\n${capabilityCatalog()}\n\n` +
    'Rules:\n' +
    '- Choose the minimal set of steps that genuinely completes the goal; a simple question is a single "answer" step.\n' +
    '- Use depends_on so later steps receive earlier outputs (e.g. create_document after research).\n' +
    '- Add a final "answer" verification step for multi-step work: it checks the earlier outputs against the goal and writes the final summary for the user.\n' +
    '- Set requires_approval: true on steps with irreversible external effects (submitting, sending, purchasing, publishing, deleting). Browser steps additionally self-gate at action time.\n' +
    '- Only ask clarification questions when the goal is genuinely ambiguous or missing required facts (e.g. no URL to monitor, no format preference where it matters and no memory covers it). Otherwise plan with sensible defaults.\n' +
    '- Never plan placeholder work. Every step must do something real.\n' +
    `- Today's date: ${new Date().toISOString().slice(0, 10)}. User timezone: ${user.timezone || 'UTC'}.` +
    memoryPrompt(user)
  );
}

function taskFilesNote(taskId) {
  const files = db.prepare("SELECT id, name FROM files WHERE task_id = ? AND kind = 'uploaded'").all(taskId);
  if (!files.length) return '';
  return `\nFiles the user attached to this task:\n${files.map((f) => `- ${f.name} (file_id: ${f.id})`).join('\n')}`;
}

export async function planTask(task, user) {
  const messages = db.prepare('SELECT role, content FROM task_messages WHERE task_id = ? ORDER BY created_at').all(task.id);
  const convo = messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
  return askJSON(
    `Plan this task.\n\nConversation so far:\n${convo}${taskFilesNote(task.id)}\n\n` +
      'If clarification is genuinely required, set needs_clarification=true with 1-3 concise questions and no steps. Otherwise return the full plan.',
    PLAN_SCHEMA,
    { system: plannerSystem(user), model: config.plannerModel, maxTokens: 8000 }
  );
}

/**
 * Adaptive replanning: called when the user sends a follow-up message on an
 * existing task. Sees what already ran (with outputs) and returns only the
 * additional steps needed now.
 */
export async function adaptPlan(task, user) {
  const messages = db.prepare('SELECT role, content FROM task_messages WHERE task_id = ? ORDER BY created_at').all(task.id);
  const convo = messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
  const steps = db.prepare('SELECT idx, title, capability, status, output FROM task_steps WHERE task_id = ? ORDER BY idx').all(task.id);
  const done = steps
    .map((s) => `Step ${s.idx} [${s.status}] ${s.title} (${s.capability})${s.output ? `\nOutput: ${String(s.output).slice(0, 1500)}` : ''}`)
    .join('\n---\n');
  return askJSON(
    `The user sent a follow-up on an existing task.\n\nConversation:\n${convo}${taskFilesNote(task.id)}\n\n` +
      `Steps already in the plan (with results so far):\n${done || '(none)'}\n\n` +
      'Return ONLY the new steps to append now (steps may depends_on existing step indexes shown above). ' +
      'A follow-up question about completed research is usually a single "answer" step depending on the research step. ' +
      'If instead you still need clarification, set needs_clarification=true.',
    PLAN_SCHEMA,
    { system: plannerSystem(user), model: config.plannerModel, maxTokens: 8000 }
  );
}
