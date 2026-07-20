// File analysis: converts stored files into Claude content blocks (PDFs and
// images natively; DOCX/XLSX/PPTX/CSV/TXT extracted to text with location
// markers) and answers questions about them.
import mammoth from 'mammoth';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { askWithBlocks } from '../ai.js';
import { getFile, readFileBuffer } from '../fileStore.js';

const IMAGE_TYPES = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };

function extOf(name) {
  return (name.split('.').pop() || '').toLowerCase();
}

export async function extractDocxText(buffer) {
  const { value } = await mammoth.extractRawText({ buffer });
  return value;
}

export async function extractXlsxText(buffer, { maxRows = 300 } = {}) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const parts = [];
  wb.eachSheet((sheet) => {
    const rows = [];
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rows.length >= maxRows) return;
      const cells = [];
      row.eachCell({ includeEmpty: true }, (cell) => {
        let v = cell.value;
        if (v && typeof v === 'object') v = v.result ?? v.text ?? v.richText?.map((r) => r.text).join('') ?? JSON.stringify(v);
        cells.push(v == null ? '' : String(v));
      });
      rows.push(`row ${rowNumber}: ${cells.join(' | ')}`);
    });
    parts.push(`### Sheet "${sheet.name}" (${sheet.rowCount} rows)\n${rows.join('\n')}`);
  });
  return parts.join('\n\n');
}

export async function extractPptxText(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const slideNames = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
  const parts = [];
  for (const name of slideNames) {
    const xml = await zip.files[name].async('string');
    const texts = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]).filter(Boolean);
    parts.push(`### Slide ${name.match(/\d+/)[0]}\n${texts.join('\n')}`);
  }
  return parts.join('\n\n') || '(no text found in slides)';
}

/** Converts a stored file into Claude content blocks with a location-labelled header. */
export async function fileToBlocks(file) {
  const ext = extOf(file.name);
  const buffer = readFileBuffer(file);
  const header = { type: 'text', text: `--- File: "${file.name}" (${ext.toUpperCase()}) ---` };

  if (ext === 'pdf') {
    return [header, { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: buffer.toString('base64') }, citations: { enabled: true } }];
  }
  if (IMAGE_TYPES[ext]) {
    return [header, { type: 'image', source: { type: 'base64', media_type: IMAGE_TYPES[ext], data: buffer.toString('base64') } }];
  }
  let text;
  if (ext === 'docx') text = await extractDocxText(buffer);
  else if (ext === 'xlsx') text = await extractXlsxText(buffer);
  else if (ext === 'pptx') text = await extractPptxText(buffer);
  else if (ext === 'csv' || ext === 'txt' || ext === 'md') text = buffer.toString('utf8').slice(0, 150000);
  else throw new Error(`Unsupported file type: .${ext}. Supported: PDF, DOCX, XLSX, CSV, PPTX, TXT, PNG, JPG, JPEG, WEBP.`);
  return [header, { type: 'text', text: text.slice(0, 150000) }];
}

export async function runFileAnalysis({ instructions, fileIds = [], user, contextText = '', memoryText = '', signal, onProgress }) {
  if (!fileIds.length) throw new Error('No files were referenced for analysis. Upload files and attach them to the task.');
  const blocks = [];
  const names = [];
  for (const id of fileIds) {
    const file = getFile(user.id, id);
    if (!file) throw new Error(`File ${id} not found in your storage`);
    onProgress?.(`Reading ${file.name}`);
    blocks.push(...(await fileToBlocks(file)));
    names.push(file.name);
  }
  blocks.push({
    type: 'text',
    text:
      `Task: ${instructions}\n${contextText ? `Context from earlier steps:\n${contextText}\n` : ''}${memoryText}\n` +
      'Answer based ONLY on the files above. Reference the location of evidence (page, sheet/row, slide, or section) wherever possible. ' +
      'If the files do not contain the answer, say so plainly — never guess.',
  });
  onProgress?.('Analyzing files');
  const answer = await askWithBlocks(blocks, { maxTokens: 6000, signal });
  return { answer_markdown: answer, files_analyzed: names };
}
