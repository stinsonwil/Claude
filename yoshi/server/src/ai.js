// Single Anthropic client shared by every capability. All model access goes
// through here so retries, configuration checks, and structured output are
// handled once.
import Anthropic from '@anthropic-ai/sdk';
import { config, aiConfigured } from './config.js';

let client = null;
function getClient() {
  if (!aiConfigured()) {
    const err = new Error(
      'AI is not configured. Set the ANTHROPIC_API_KEY environment variable on the Yoshi server and restart it.'
    );
    err.code = 'AI_NOT_CONFIGURED';
    throw err;
  }
  if (!client) {
    client = new Anthropic({ apiKey: config.anthropicApiKey, baseURL: config.anthropicBaseUrl });
  }
  return client;
}

async function withRetry(fn, { retries = 3 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const status = err?.status;
      const retryable = status === 429 || status === 529 || (status >= 500 && status < 600);
      if (!retryable || attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt));
    }
  }
  throw lastErr;
}

/** Plain text completion. `messages` may be a string or an array of {role, content}. */
export async function ask(messages, { system, model = config.model, maxTokens = 4096, signal } = {}) {
  const msgs = typeof messages === 'string' ? [{ role: 'user', content: messages }] : messages;
  const resp = await withRetry(() =>
    getClient().messages.create(
      { model, max_tokens: maxTokens, system, messages: msgs },
      { signal }
    )
  );
  return resp.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
}

/**
 * Structured output: forces the model to "call" a tool whose input schema is
 * the JSON shape we want, and returns that input object.
 */
export async function askJSON(messages, schema, { system, model = config.model, maxTokens = 8192, signal, toolName = 'emit_result' } = {}) {
  const msgs = typeof messages === 'string' ? [{ role: 'user', content: messages }] : messages;
  const resp = await withRetry(() =>
    getClient().messages.create(
      {
        model,
        max_tokens: maxTokens,
        system,
        messages: msgs,
        tools: [{ name: toolName, description: 'Return the result in the required structure.', input_schema: schema }],
        tool_choice: { type: 'tool', name: toolName },
      },
      { signal }
    )
  );
  const block = resp.content.find((b) => b.type === 'tool_use');
  if (!block) throw new Error('Model did not return structured output');
  return block.input;
}

/**
 * Agentic tool-use loop: the model repeatedly picks a tool, we execute it via
 * `execute(name, input)`, feed the result back, and stop when it answers in
 * plain text or `shouldStop` says so. Used by browser automation.
 */
export async function toolLoop({ system, initialMessage, tools, execute, maxTurns = 40, model = config.model, signal, onTurn }) {
  const messages = [{ role: 'user', content: initialMessage }];
  for (let turn = 0; turn < maxTurns; turn++) {
    const resp = await withRetry(() =>
      getClient().messages.create(
        { model, max_tokens: 4096, system, messages, tools },
        { signal }
      )
    );
    messages.push({ role: 'assistant', content: resp.content });
    const toolUses = resp.content.filter((b) => b.type === 'tool_use');
    if (toolUses.length === 0) {
      return resp.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
    }
    const results = [];
    for (const use of toolUses) {
      onTurn?.(use);
      let result;
      try {
        result = await execute(use.name, use.input);
      } catch (err) {
        if (err.code === 'PAUSE_FOR_APPROVAL') throw err; // bubbles up to the task engine
        result = { error: String(err.message || err) };
      }
      results.push({
        type: 'tool_result',
        tool_use_id: use.id,
        content: typeof result === 'string' ? result : JSON.stringify(result),
      });
    }
    messages.push({ role: 'user', content: results });
  }
  throw new Error(`Stopped after ${maxTurns} tool turns without finishing`);
}

/** Completion over rich content blocks (documents, images) for file analysis. */
export async function askWithBlocks(blocks, { system, model = config.model, maxTokens = 4096, signal } = {}) {
  const resp = await withRetry(() =>
    getClient().messages.create(
      { model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: blocks }] },
      { signal }
    )
  );
  return resp.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
}

export { aiConfigured };
