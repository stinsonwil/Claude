// Document creation: the model produces structured content, and real files
// (PDF via pdfkit, DOCX via docx, XLSX via exceljs, PPTX via pptxgenjs) are
// rendered from it and registered in file storage for download.
import PDFDocument from 'pdfkit';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType } from 'docx';
import ExcelJS from 'exceljs';
import pptxgen from 'pptxgenjs';
import { askJSON } from '../ai.js';
import { registerFile } from '../fileStore.js';

const CONTENT_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    subtitle: { type: 'string' },
    filename: { type: 'string', description: 'Suggested filename without extension' },
    sections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          heading: { type: 'string' },
          paragraphs: { type: 'array', items: { type: 'string' } },
          bullets: { type: 'array', items: { type: 'string' } },
          table: {
            type: 'object',
            properties: {
              headers: { type: 'array', items: { type: 'string' } },
              rows: { type: 'array', items: { type: 'array', items: { type: 'string' } } },
            },
          },
        },
        required: ['heading'],
      },
    },
  },
  required: ['title', 'sections', 'filename'],
};

export async function runDocumentCreation({ instructions, format = 'pdf', contextText = '', memoryText = '', user, task, signal, onProgress }) {
  format = String(format || 'pdf').toLowerCase();
  if (!['pdf', 'docx', 'pptx', 'xlsx'].includes(format)) format = 'pdf';

  onProgress?.(`Drafting ${format.toUpperCase()} content`);
  const content = await askJSON(
    `Create the full content for a professional ${format.toUpperCase()} document.\n` +
      `Request: ${instructions}\n${contextText ? `\nUse this material gathered in earlier steps as the factual basis:\n${contextText}\n` : ''}${memoryText}\n` +
      'Write complete, polished, substantive content — not placeholders. ' +
      (format === 'xlsx'
        ? 'Since this is a spreadsheet, put the data into section tables (headers + rows); each section becomes a worksheet.'
        : format === 'pptx'
          ? 'Since this is a presentation, each section becomes one slide: a heading plus 3-6 concise bullets.'
          : 'Use multiple sections with headings, paragraphs, and bullets/tables where they help.'),
    CONTENT_SCHEMA,
    { maxTokens: 16000, signal }
  );

  onProgress?.('Rendering file');
  const renderers = { pdf: renderPdf, docx: renderDocx, pptx: renderPptx, xlsx: renderXlsx };
  const buffer = await renderers[format](content);
  const name = `${(content.filename || content.title || 'document').replace(/[^\w\- ]/g, '').trim().slice(0, 80) || 'document'}.${format}`;
  const mimes = {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
  const file = registerFile({ userId: user.id, taskId: task?.id ?? null, name, mime: mimes[format], buffer, kind: 'generated' });
  return { file_id: file.id, file_name: file.name, format, title: content.title, sections: content.sections.length };
}

export function renderPdf(content) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 54, size: 'A4' });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.font('Helvetica-Bold').fontSize(24).text(content.title);
    if (content.subtitle) doc.moveDown(0.3).font('Helvetica').fontSize(13).fillColor('#555').text(content.subtitle);
    doc.moveDown(1).fillColor('#000');

    for (const s of content.sections || []) {
      doc.moveDown(0.8).font('Helvetica-Bold').fontSize(15).text(s.heading);
      doc.moveDown(0.3).font('Helvetica').fontSize(11);
      for (const p of s.paragraphs || []) doc.text(p, { align: 'justify' }).moveDown(0.4);
      for (const b of s.bullets || []) doc.text(`•  ${b}`, { indent: 12 }).moveDown(0.15);
      if (s.table?.headers?.length) {
        doc.moveDown(0.3).font('Helvetica-Bold').text(s.table.headers.join('  |  '));
        doc.font('Helvetica');
        for (const row of s.table.rows || []) doc.text(row.join('  |  '));
      }
    }
    doc.end();
  });
}

export async function renderDocx(content) {
  const children = [
    new Paragraph({ text: content.title, heading: HeadingLevel.TITLE }),
    ...(content.subtitle ? [new Paragraph({ children: [new TextRun({ text: content.subtitle, italics: true, color: '666666' })] })] : []),
  ];
  for (const s of content.sections || []) {
    children.push(new Paragraph({ text: s.heading, heading: HeadingLevel.HEADING_1, spacing: { before: 300 } }));
    for (const p of s.paragraphs || []) children.push(new Paragraph({ text: p, spacing: { after: 150 } }));
    for (const b of s.bullets || []) children.push(new Paragraph({ text: b, bullet: { level: 0 } }));
    if (s.table?.headers?.length) {
      const mkRow = (cells, bold) =>
        new TableRow({
          children: cells.map((c) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(c ?? ''), bold })] })] })),
        });
      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [mkRow(s.table.headers, true), ...(s.table.rows || []).map((r) => mkRow(r, false))],
      }));
    }
  }
  return Buffer.from(await Packer.toBuffer(new Document({ sections: [{ children }] })));
}

export async function renderXlsx(content) {
  const wb = new ExcelJS.Workbook();
  let sheetIndex = 0;
  for (const s of content.sections || []) {
    const name = (s.heading || `Sheet${++sheetIndex}`).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || `Sheet${sheetIndex}`;
    const ws = wb.addWorksheet(name);
    if (s.table?.headers?.length) {
      const headerRow = ws.addRow(s.table.headers);
      headerRow.font = { bold: true };
      for (const row of s.table.rows || []) {
        ws.addRow(row.map((v) => (v !== '' && !Number.isNaN(Number(v)) ? Number(v) : v)));
      }
      ws.columns.forEach((col) => { col.width = 22; });
    } else {
      for (const p of [...(s.paragraphs || []), ...(s.bullets || [])]) ws.addRow([p]);
    }
  }
  if (wb.worksheets.length === 0) wb.addWorksheet('Sheet1').addRow([content.title]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function renderPptx(content) {
  const pptx = new pptxgen();
  const title = pptx.addSlide();
  title.addText(content.title, { x: 0.6, y: 1.8, w: 8.8, h: 1.2, fontSize: 34, bold: true, color: '1a1a2e' });
  if (content.subtitle) title.addText(content.subtitle, { x: 0.6, y: 3.0, w: 8.8, h: 0.8, fontSize: 18, color: '555555' });
  for (const s of content.sections || []) {
    const slide = pptx.addSlide();
    slide.addText(s.heading, { x: 0.5, y: 0.35, w: 9, h: 0.8, fontSize: 26, bold: true, color: '1a1a2e' });
    const lines = [...(s.bullets || []), ...(s.paragraphs || [])];
    if (lines.length) {
      slide.addText(lines.map((t) => ({ text: t, options: { bullet: true, fontSize: 15, breakLine: true } })), { x: 0.6, y: 1.3, w: 8.8, h: 4.5, valign: 'top' });
    }
    if (s.table?.headers?.length) {
      slide.addTable([s.table.headers, ...(s.table.rows || [])], { x: 0.6, y: 1.3, w: 8.8, fontSize: 12 });
    }
  }
  return Buffer.from(await pptx.write({ outputType: 'nodebuffer' }));
}
