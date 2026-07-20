// Lightweight web access shared by research and monitoring: search, fetch,
// readable-text extraction, and link validation. Browser automation uses
// Playwright separately (capabilities/browser.js).
import { parse } from 'node-html-parser';

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 YoshiAgent/1.0';

export async function fetchUrl(url, { timeoutMs = 20000, signal, method = 'GET' } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new Error('timeout')), timeoutMs);
  signal?.addEventListener('abort', () => ctrl.abort(signal.reason), { once: true });
  try {
    const resp = await fetch(url, {
      method,
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8' },
    });
    const contentType = resp.headers.get('content-type') || '';
    let text = '';
    if (method !== 'HEAD') text = await resp.text();
    return { ok: resp.ok, status: resp.status, contentType, text, finalUrl: resp.url };
  } finally {
    clearTimeout(timer);
  }
}

/** Strips a page down to readable text (scripts/styles/nav removed). */
export function extractText(html, { maxChars = 20000 } = {}) {
  const root = parse(html, { blockTextElements: { script: false, style: false, noscript: false } });
  for (const sel of ['script', 'style', 'noscript', 'svg', 'nav', 'footer', 'iframe']) {
    root.querySelectorAll(sel).forEach((el) => el.remove());
  }
  const title = root.querySelector('title')?.text?.trim() || '';
  const text = root.text.replace(/[ \t]+/g, ' ').replace(/\n\s*\n\s*/g, '\n').trim();
  return { title, text: text.slice(0, maxChars) };
}

/**
 * Web search via DuckDuckGo's HTML endpoint (no API key required).
 * Returns [{title, url, snippet}].
 */
export async function webSearch(query, { maxResults = 8, signal } = {}) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const { ok, status, text } = await fetchUrl(url, { signal });
  if (!ok) throw new Error(`Search request failed (HTTP ${status})`);
  const root = parse(text);
  const results = [];
  for (const el of root.querySelectorAll('.result')) {
    const a = el.querySelector('a.result__a');
    if (!a) continue;
    let href = a.getAttribute('href') || '';
    // DuckDuckGo wraps result URLs in a redirect: //duckduckgo.com/l/?uddg=<encoded>
    const m = href.match(/uddg=([^&]+)/);
    if (m) href = decodeURIComponent(m[1]);
    if (!/^https?:\/\//.test(href)) continue;
    const snippet = el.querySelector('.result__snippet')?.text?.trim() || '';
    results.push({ title: a.text.trim(), url: href, snippet });
    if (results.length >= maxResults) break;
  }
  return results;
}

/** Checks that a URL actually resolves; used before citing sources. */
export async function validateLink(url, { signal } = {}) {
  try {
    const head = await fetchUrl(url, { method: 'HEAD', timeoutMs: 10000, signal });
    if (head.ok) return { valid: true, status: head.status };
    // Some servers reject HEAD; retry with GET before declaring the link dead.
    const get = await fetchUrl(url, { timeoutMs: 10000, signal });
    return { valid: get.ok, status: get.status };
  } catch {
    return { valid: false, status: 0 };
  }
}
