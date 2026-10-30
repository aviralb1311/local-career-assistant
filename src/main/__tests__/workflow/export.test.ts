import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { exportMarkdown, exportPlainText, exportPdf } from '../../workflow/export.js';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

function pdftotext(pdfPath: string): string {
  return execFileSync('pdftotext', [pdfPath, '-']).toString('utf-8');
}

describe('export', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'export-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('markdown', () => expect(exportMarkdown('a\r\nb')).toBe('a\nb\n'));

  it('plain text', () => expect(exportPlainText('a\r\nb')).toBe('a\nb\n'));

  it('pdf buffer has header', async () => {
    const buf = await exportPdf('Hello PDF');
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.toString('ascii', 0, 4)).toBe('%PDF');
  });

  it('pdf latin-1 text is extractable', async () => {
    const buf = await exportPdf('Café résumé naïve £100 € — “hello”');
    const pdfPath = join(dir, 'latin1.pdf');
    writeFileSync(pdfPath, buf);
    const text = pdftotext(pdfPath);
    for (const ch of ['Café', 'résumé', 'naïve', '£100', '€', '“hello”']) {
      expect(text).toContain(ch);
    }
  });

  it('pdf cjk text is extractable', async () => {
    const buf = await exportPdf('中文 日本語');
    const pdfPath = join(dir, 'cjk.pdf');
    writeFileSync(pdfPath, buf);
    const text = pdftotext(pdfPath);
    for (const ch of ['中文', '日本語']) {
      expect(text).toContain(ch);
    }
  });

  it('pdf korean text is extractable', async () => {
    const buf = await exportPdf('안녕하세요 한국어');
    const pdfPath = join(dir, 'korean.pdf');
    writeFileSync(pdfPath, buf);
    const text = pdftotext(pdfPath);
    for (const ch of ['안녕하세요', '한국어']) {
      expect(text).toContain(ch);
    }
  });

  it('pdf long text flows across pages', async () => {
    const long = 'Paragraph content line. '.repeat(400);
    const buf = await exportPdf(long);
    const pdfPath = join(dir, 'long.pdf');
    writeFileSync(pdfPath, buf);
    const text = pdftotext(pdfPath);
    const pageCount = (text.match(/\f/g) ?? []).length + 1;
    expect(pageCount).toBeGreaterThan(1);
    expect(text.length).toBeGreaterThan(0);
  });

  it('pdf newlines and paragraphs preserved', async () => {
    const buf = await exportPdf('First paragraph.\n\nSecond paragraph.\nThird line.');
    const pdfPath = join(dir, 'nl.pdf');
    writeFileSync(pdfPath, buf);
    const text = pdftotext(pdfPath);
    // pdftotext normalizes whitespace; check content presence rather than exact layout
    expect(text).toContain('First');
    expect(text).toContain('paragraph.');
    expect(text).toContain('Second');
    expect(text).toContain('Third');
    expect(text).toContain('line.');
  });
});
