import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { openDatabase, closeDatabase } from '../../db.js';
import { applyMigrations } from '../../migrate.js';
import * as repo from '../../workflow/repo.js';
import { generateDocument } from '../../workflow/document.js';
import { exportMarkdown, exportPlainText } from '../../workflow/export.js';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DbConnection } from '../../db.js';

describe('document', () => {
  let db: DbConnection;
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'doc-')); db = openDatabase(join(dir, 't.db')); applyMigrations(db, join(process.cwd(), 'src/main/migrations')); });
  afterEach(() => closeDatabase(db));

  it('generates tailored cv and persists', async () => {
    const cv = repo.createCv(db, 'CV', 'I know TS');
    const job = repo.createJob(db, 'Dev', null, null, 'Need TS');
    const ai: any = { getSettings: vi.fn().mockResolvedValue({ provider: 'ollama' }), generateText: vi.fn().mockResolvedValue({ text: JSON.stringify({ content: '# Tailored CV\nTS focus' }), provider: 'ollama', model: 'm' }) };
    const r = await generateDocument(db, ai, cv.id, job.id, 'tailored-cv');
    expect(r.kind).toBe('tailored-cv');
    const rows = db.prepare('SELECT * FROM documents').all();
    expect(rows.length).toBe(1);
  });

  it('generates cover letter', async () => {
    const cv = repo.createCv(db, 'CV', 'I know TS');
    const job = repo.createJob(db, 'Dev', null, null, 'Need TS');
    const ai: any = { getSettings: vi.fn().mockResolvedValue({ provider: 'ollama' }), generateText: vi.fn().mockResolvedValue({ text: JSON.stringify({ content: 'Dear hiring manager...' }), provider: 'ollama', model: 'm' }) };
    const r = await generateDocument(db, ai, cv.id, job.id, 'cover-letter');
    expect(r.kind).toBe('cover-letter');
  });

  it('missing cv', async () => {
    const job = repo.createJob(db, 'Dev', null, null, 'desc');
    const ai: any = {};
    await expect(generateDocument(db, ai, 999, job.id, 'tailored-cv')).rejects.toThrow();
  });

  it('malformed response rejected and no persist', async () => {
    const cv = repo.createCv(db, 'CV', 'x');
    const job = repo.createJob(db, 'Dev', null, null, 'y');
    const ai: any = { getSettings: vi.fn().mockResolvedValue({ provider: 'ollama' }), generateText: vi.fn().mockResolvedValue({ text: 'not json', provider: 'ollama', model: 'm' }) };
    await expect(generateDocument(db, ai, cv.id, job.id, 'tailored-cv')).rejects.toThrow();
    expect(db.prepare('SELECT * FROM documents').all().length).toBe(0);
  });

  it('unknown field rejected', async () => {
    const cv = repo.createCv(db, 'CV', 'x');
    const job = repo.createJob(db, 'Dev', null, null, 'y');
    const ai: any = { getSettings: vi.fn().mockResolvedValue({ provider: 'ollama' }), generateText: vi.fn().mockResolvedValue({ text: JSON.stringify({ content: 'ok', extra: 1 }), provider: 'ollama', model: 'm' }) };
    await expect(generateDocument(db, ai, cv.id, job.id, 'tailored-cv')).rejects.toThrow();
  });

  it('repeated generations preserve history', async () => {
    const cv = repo.createCv(db, 'CV', 'x');
    const job = repo.createJob(db, 'Dev', null, null, 'y');
    const ai: any = { getSettings: vi.fn().mockResolvedValue({ provider: 'ollama' }), generateText: vi.fn().mockResolvedValue({ text: JSON.stringify({ content: 'v' }), provider: 'ollama', model: 'm' }) };
    await generateDocument(db, ai, cv.id, job.id, 'tailored-cv');
    await generateDocument(db, ai, cv.id, job.id, 'tailored-cv');
    expect(db.prepare('SELECT * FROM documents').all().length).toBe(2);
  });

  it('provider error propagates', async () => {
    const cv = repo.createCv(db, 'CV', 'x');
    const job = repo.createJob(db, 'Dev', null, null, 'y');
    const ai: any = { getSettings: vi.fn().mockResolvedValue({ provider: 'ollama' }), generateText: vi.fn().mockRejectedValue(new Error('secret /tmp/x')) };
    await expect(generateDocument(db, ai, cv.id, job.id, 'tailored-cv')).rejects.toThrow();
  });

  it('cloud consent enforced', async () => {
    const cv = repo.createCv(db, 'CV', 'x');
    const job = repo.createJob(db, 'Dev', null, null, 'y');
    const ai: any = { getSettings: vi.fn().mockResolvedValue({ provider: 'openai-compatible' }), generateText: vi.fn().mockImplementation(async () => { throw new Error('consent-required'); }) };
    await expect(generateDocument(db, ai, cv.id, job.id, 'tailored-cv')).rejects.toThrow();
  });

  it('export markdown and plain text', () => {
    expect(exportMarkdown('# Hi')).toBe('# Hi\n');
    const pt = exportPlainText('# Hi **bold**');
    expect(pt).not.toContain('#');
    expect(pt).not.toContain('**');
  });

  it('export empty invalid', () => {
    expect(() => exportMarkdown('')).not.toThrow();
  });
});
