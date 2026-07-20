// Minimal Markdown renderer (headings, lists, bold/italic, links, code,
// tables, hr) with HTML escaping. Keeps the client dependency-free.
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function inline(text) {
  let out = esc(text);
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|\W)\*([^*\n]+)\*(?=\W|$)/g, '$1<em>$2</em>');
  out = out.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  return out;
}

export function renderMarkdown(md) {
  if (!md) return '';
  const lines = String(md).split('\n');
  const html = [];
  let list = null; // 'ul' | 'ol'
  let table = null;

  const closeList = () => { if (list) { html.push(`</${list}>`); list = null; } };
  const closeTable = () => { if (table) { html.push('</table>'); table = null; } };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const h = line.match(/^(#{1,4})\s+(.*)/);
    if (h) { closeList(); closeTable(); html.push(`<h${h[1].length + 1}>${inline(h[2])}</h${h[1].length + 1}>`); continue; }
    if (/^(-{3,}|\*{3,})$/.test(line.trim())) { closeList(); closeTable(); html.push('<hr/>'); continue; }
    const ul = line.match(/^\s*[-*•]\s+(.*)/);
    if (ul) { closeTable(); if (list !== 'ul') { closeList(); html.push('<ul>'); list = 'ul'; } html.push(`<li>${inline(ul[1])}</li>`); continue; }
    const ol = line.match(/^\s*\d+[.)]\s+(.*)/);
    if (ol) { closeTable(); if (list !== 'ol') { closeList(); html.push('<ol>'); list = 'ol'; } html.push(`<li>${inline(ol[1])}</li>`); continue; }
    if (/^\s*\|.*\|\s*$/.test(line)) {
      const cells = line.trim().slice(1, -1).split('|').map((c) => c.trim());
      if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue; // separator row
      if (!table) { closeList(); html.push('<table>'); table = { header: true }; }
      const tag = table.header ? 'th' : 'td';
      html.push(`<tr>${cells.map((c) => `<${tag}>${inline(c)}</${tag}>`).join('')}</tr>`);
      table.header = false;
      continue;
    }
    closeTable();
    if (!line.trim()) { closeList(); continue; }
    closeList();
    html.push(`<p>${inline(line)}</p>`);
  }
  closeList(); closeTable();
  return html.join('\n');
}
