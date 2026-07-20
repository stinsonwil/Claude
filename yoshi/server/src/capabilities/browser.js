// Browser automation via Playwright + an agentic tool loop. The model drives
// a real Chromium instance. Irreversible actions (submitting forms, buying,
// publishing, sending, deleting) are gated: the executor raises
// PAUSE_FOR_APPROVAL, the task engine parks the task, and the action only
// runs after the user approves it in the UI.
import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { toolLoop } from '../ai.js';
import { config } from '../config.js';
import { registerFile, getFile } from '../fileStore.js';

function chromiumExecutable() {
  if (config.chromiumPath) return config.chromiumPath;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (base && fs.existsSync(base)) {
    for (const entry of fs.readdirSync(base)) {
      if (/^chromium-\d+$/.test(entry)) {
        const candidates = [
          `${base}/${entry}/chrome-linux/chrome`,
          `${base}/${entry}/chrome-linux/headless_shell`,
        ];
        for (const c of candidates) if (fs.existsSync(c)) return c;
      }
    }
    if (fs.existsSync(`${base}/chromium`)) return `${base}/chromium`;
  }
  return undefined; // let Playwright resolve its default install
}

const IRREVERSIBLE_NOTE =
  'IRREVERSIBLE ACTIONS: You must call request_approval and receive approval BEFORE any form submission, ' +
  'purchase, account creation, publishing, sending an email or message, or deleting information. ' +
  'Navigation, scrolling, reading, searching, and filling fields (without submitting) do not need approval.';

const tools = [
  { name: 'goto', description: 'Navigate to a URL.', input_schema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } },
  { name: 'click', description: 'Click an element identified by the numbered ref from the last page snapshot, e.g. "e12".', input_schema: { type: 'object', properties: { ref: { type: 'string' }, why: { type: 'string', description: 'What this click does' } }, required: ['ref'] } },
  { name: 'type_text', description: 'Type text into an input/textarea identified by ref. Does not submit.', input_schema: { type: 'object', properties: { ref: { type: 'string' }, text: { type: 'string' }, press_enter: { type: 'boolean', description: 'Press Enter after typing (use only for search boxes, never to submit forms with side effects)' } }, required: ['ref', 'text'] } },
  { name: 'scroll', description: 'Scroll the page.', input_schema: { type: 'object', properties: { direction: { type: 'string', enum: ['up', 'down'] }, pages: { type: 'number' } }, required: ['direction'] } },
  { name: 'snapshot', description: 'Get a fresh snapshot of the current page (text + interactive elements with refs).', input_schema: { type: 'object', properties: {} } },
  { name: 'extract', description: 'Record extracted information as a finding. Use for prices, listings, comparison data, etc.', input_schema: { type: 'object', properties: { finding: { type: 'string' } }, required: ['finding'] } },
  { name: 'download_current_page', description: 'Save the current page (HTML) as evidence / a downloadable file.', input_schema: { type: 'object', properties: { filename: { type: 'string' } } } },
  { name: 'upload_file', description: 'Attach a stored file (by file id from the task context) to a file input identified by ref.', input_schema: { type: 'object', properties: { ref: { type: 'string' }, file_id: { type: 'string' } }, required: ['ref', 'file_id'] } },
  { name: 'request_approval', description: 'REQUIRED before any irreversible action. Describe exactly what will happen. Execution pauses until the user approves.', input_schema: { type: 'object', properties: { action: { type: 'string', description: 'Exact action, e.g. "Submit the contact form on example.com with the message ..."' } }, required: ['action'] } },
];

/**
 * `approvedActions` — list of approval descriptions the user has already
 * granted for this step (populated by the task engine on resume-after-approve).
 */
export async function runBrowser({ instructions, contextText = '', user, task, signal, onProgress, approvedActions = [] }) {
  const browser = await chromium.launch({
    headless: true,
    executablePath: chromiumExecutable(),
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  page.setDefaultTimeout(20000);

  const findings = [];
  const savedFiles = [];
  let refCounter = 0;
  let refMap = new Map(); // ref -> element handle locator info

  async function snapshotPage() {
    refMap = new Map();
    refCounter = 0;
    const url = page.url();
    const title = await page.title().catch(() => '');
    // Collect visible interactive elements and assign stable refs for this snapshot.
    const elements = await page.evaluate(() => {
      const out = [];
      const els = document.querySelectorAll('a, button, input, textarea, select, [role="button"], [onclick]');
      let i = 0;
      for (const el of els) {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        const tag = el.tagName.toLowerCase();
        const text = (el.innerText || el.value || el.placeholder || el.getAttribute('aria-label') || '').trim().slice(0, 80);
        const type = el.getAttribute('type') || '';
        const href = tag === 'a' ? (el.getAttribute('href') || '').slice(0, 120) : '';
        el.setAttribute('data-yoshi-ref', `e${i}`);
        out.push({ ref: `e${i}`, tag, type, text, href });
        i++;
        if (i >= 120) break;
      }
      return out;
    }).catch(() => []);
    for (const el of elements) refMap.set(el.ref, el);
    const bodyText = await page.evaluate(() => document.body?.innerText || '').catch(() => '');
    return {
      url,
      title,
      text: bodyText.replace(/\n{3,}/g, '\n\n').slice(0, 6000),
      interactive_elements: elements,
    };
  }

  const execute = async (name, input) => {
    if (signal?.aborted) throw new Error('Cancelled');
    switch (name) {
      case 'goto': {
        await page.goto(input.url, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(800);
        return snapshotPage();
      }
      case 'click': {
        if (!refMap.has(input.ref)) return { error: `Unknown ref ${input.ref}; take a fresh snapshot.` };
        await page.click(`[data-yoshi-ref="${input.ref}"]`);
        await page.waitForTimeout(1000);
        return snapshotPage();
      }
      case 'type_text': {
        if (!refMap.has(input.ref)) return { error: `Unknown ref ${input.ref}; take a fresh snapshot.` };
        await page.fill(`[data-yoshi-ref="${input.ref}"]`, input.text);
        if (input.press_enter) {
          await page.press(`[data-yoshi-ref="${input.ref}"]`, 'Enter');
          await page.waitForTimeout(1200);
          return snapshotPage();
        }
        return { ok: true };
      }
      case 'scroll': {
        const dy = (input.pages || 1) * 800 * (input.direction === 'up' ? -1 : 1);
        await page.mouse.wheel(0, dy);
        await page.waitForTimeout(400);
        return snapshotPage();
      }
      case 'snapshot':
        return snapshotPage();
      case 'extract': {
        findings.push(input.finding);
        onProgress?.(`Extracted: ${String(input.finding).slice(0, 100)}`);
        return { recorded: true, total_findings: findings.length };
      }
      case 'download_current_page': {
        const html = await page.content();
        const name_ = input.filename || `page-${Date.now()}.html`;
        const file = registerFile({
          userId: user.id, taskId: task.id, name: name_.endsWith('.html') ? name_ : `${name_}.html`,
          mime: 'text/html', buffer: Buffer.from(html), kind: 'evidence',
        });
        savedFiles.push(file.id);
        return { saved: true, file_id: file.id, name: file.name };
      }
      case 'upload_file': {
        const file = getFile(user.id, input.file_id);
        if (!file) return { error: 'File not found in your storage' };
        await page.setInputFiles(`[data-yoshi-ref="${input.ref}"]`, file.path);
        return { ok: true, attached: file.name };
      }
      case 'request_approval': {
        const already = approvedActions.some((a) => a === input.action);
        if (already) return { approved: true, note: 'The user approved this action. Proceed.' };
        const err = new Error(`Approval required: ${input.action}`);
        err.code = 'PAUSE_FOR_APPROVAL';
        err.approvalDescription = input.action;
        err.approvalDetails = { url: page.url(), capability: 'browser' };
        throw err;
      }
      default:
        return { error: `Unknown tool ${name}` };
    }
  };

  try {
    const summary = await toolLoop({
      system:
        `You are Yoshi's browser automation agent operating a real Chromium browser. ${IRREVERSIBLE_NOTE}\n` +
        'Work step by step. Use extract to record every piece of information the task asks for. ' +
        'When done, respond with plain text summarizing exactly what you did and found — never invent results.',
      initialMessage:
        `Task: ${instructions}\n${contextText ? `Context from earlier steps:\n${contextText}\n` : ''}` +
        (approvedActions.length ? `The user has ALREADY APPROVED these actions: ${approvedActions.join('; ')}\n` : '') +
        'Start by navigating to an appropriate page.',
      tools,
      execute,
      maxTurns: 50,
      signal,
      onTurn: (use) => onProgress?.(`Browser: ${use.name}${use.input?.url ? ` ${use.input.url}` : ''}`),
    });
    return { summary, findings, saved_file_ids: savedFiles };
  } finally {
    await browser.close().catch(() => {});
  }
}
