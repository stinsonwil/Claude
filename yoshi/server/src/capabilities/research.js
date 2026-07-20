// Deep research: generate search queries, gather real sources, read them,
// synthesize a cited report, and validate every cited link. Sources are never
// invented — the model only sees material we actually fetched, and citations
// are resolved against that list.
import { ask, askJSON } from '../ai.js';
import { webSearch, fetchUrl, extractText, validateLink } from '../web.js';
import { config } from '../config.js';

export async function runResearch({ instructions, contextText = '', memoryText = '', signal, onProgress }) {
  onProgress?.('Planning search queries');
  const { queries } = await askJSON(
    `You are planning web research. Today's date is ${new Date().toISOString().slice(0, 10)}.\n` +
      `Research request:\n${instructions}\n${contextText ? `\nContext from earlier steps:\n${contextText}\n` : ''}` +
      `Produce 2 to 5 distinct web search queries that together cover this request. Prefer queries that surface current information.`,
    {
      type: 'object',
      properties: { queries: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 5 } },
      required: ['queries'],
    },
    { model: config.fastModel, signal }
  );

  onProgress?.(`Searching the web (${queries.length} queries)`);
  const seen = new Set();
  const candidates = [];
  for (const q of queries) {
    try {
      const results = await webSearch(q, { maxResults: 6, signal });
      for (const r of results) {
        if (seen.has(r.url)) continue;
        seen.add(r.url);
        candidates.push({ ...r, query: q });
      }
    } catch (err) {
      onProgress?.(`Search failed for "${q}": ${err.message}`);
    }
  }
  if (candidates.length === 0) throw new Error('Web search returned no results — cannot research without sources.');

  // Ask the model which candidates are worth reading in full.
  const { picks } = await askJSON(
    `Research request:\n${instructions}\n\nSearch results:\n` +
      candidates.map((c, i) => `${i}. ${c.title} — ${c.url}\n   ${c.snippet}`).join('\n') +
      `\n\nPick the indexes of up to 6 results most likely to contain substantive, current information for this request. Prefer primary sources and reputable publications; avoid duplicates of the same site.`,
    {
      type: 'object',
      properties: { picks: { type: 'array', items: { type: 'integer' }, maxItems: 6 } },
      required: ['picks'],
    },
    { model: config.fastModel, signal }
  );

  const chosen = picks.map((i) => candidates[i]).filter(Boolean);
  const sources = [];
  for (const c of chosen) {
    onProgress?.(`Reading ${new URL(c.url).hostname}`);
    try {
      const page = await fetchUrl(c.url, { signal });
      if (!page.ok || !/html|text|json/.test(page.contentType)) continue;
      const { title, text } = extractText(page.text, { maxChars: 12000 });
      if (text.length < 200) continue; // paywall / empty shell — not usable as evidence
      sources.push({ title: title || c.title, url: page.finalUrl || c.url, text });
    } catch (err) {
      onProgress?.(`Could not read ${c.url}: ${err.message}`);
    }
    if (sources.length >= 6) break;
  }
  if (sources.length === 0) throw new Error('None of the search results could be read — no usable sources.');

  onProgress?.(`Synthesizing report from ${sources.length} sources`);
  const sourceBlock = sources
    .map((s, i) => `SOURCE [${i + 1}] ${s.title}\nURL: ${s.url}\n---\n${s.text}\n`)
    .join('\n==========\n');

  const report = await ask(
    `Write a research report answering this request:\n${instructions}\n${contextText ? `\nContext from earlier steps:\n${contextText}\n` : ''}` +
      `${memoryText}\n\nYou may ONLY use the sources below. Rules:\n` +
      `- Cite every major claim inline with [n] matching the source numbers.\n` +
      `- Never state a statistic that does not appear in a source.\n` +
      `- If the sources conflict or don't cover something, say so explicitly under a "Gaps and uncertainty" heading.\n` +
      `- Use Markdown with clear headings. Start with a short executive summary.\n` +
      `- Do NOT add a sources/references list at the end; the platform renders it from metadata.\n\n${sourceBlock}`,
    { maxTokens: 8000, signal }
  );

  onProgress?.('Validating source links');
  const validated = [];
  for (const s of sources) {
    const check = await validateLink(s.url, { signal });
    validated.push({ title: s.title, url: s.url, valid: check.valid, http_status: check.status });
  }

  return {
    report_markdown: report,
    sources: validated,
    queries,
  };
}
