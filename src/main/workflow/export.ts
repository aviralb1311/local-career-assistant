import PDFDocument from 'pdfkit';
import path from 'node:path';

const FONT_NAME = 'NotoSansCJK-KR.ttf';
const fontPath = path.join(__dirname, '..', 'fonts', FONT_NAME);

function hasEmbeddedFont(): boolean {
  try {
    return require('node:fs').existsSync(fontPath);
  } catch {
    return false;
  }
}

export function exportMarkdown(content: string): string {
  return content.replace(/\r\n/g, '\n').trimEnd() + '\n';
}

export function exportPlainText(content: string): string {
  return content.replace(/\r\n/g, '\n').trimEnd() + '\n';
}

export function exportPdf(content: string): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument();
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    if (hasEmbeddedFont()) {
      doc.font(fontPath);
    }
    doc.text(content);
    doc.end();
  });
}
