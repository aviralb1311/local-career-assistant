import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { openDatabase, closeDatabase } from '../../db.js';
import { applyMigrations } from '../../migrate.js';
import * as repo from '../../workflow/repo.js';
import { evaluate } from '../../workflow/evaluation.js';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('evaluation', () => {
  let db: any;
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ev-'));
    db = openDatabase(join(dir, 't.db'));
    applyMigrations(db, join(process.cwd(), 'src/main/migrations'));
  });
  afterEach(() => closeDatabase(db));

  it('success and persistence', async () => {
    const cv = repo.createCv(db, 'CV', 'I know TypeScript and Node.');
    const job = repo.createJob(db, 'Dev', null, null, 'Need TypeScript');
    const ai: any = {
      getSettings: vi.fn().mockResolvedValue({ provider: 'ollama' }),
      generateJSON: vi.fn().mockResolvedValue({
        data: { score: 80, verdict: 'strong-fit', evidence: ['I know TypeScript and Node.'], supported: ['TypeScript'], missing: [], suggestions: ['Add tests'] },
        provider: 'ollama',
        model: 'm',
      }),
    };
    const r = await evaluate(db, ai, cv.id, job.id);
    expect(r.score).toBe(80);
    const rows = db.prepare('SELECT * FROM evaluations').all();
    expect(rows.length).toBe(1);
  });

  it('missing cv', async () => {
    const job = repo.createJob(db, 'Dev', null, null, 'desc');
    const ai: any = {};
    await expect(evaluate(db, ai, 999, job.id)).rejects.toThrow();
  });

  it('fabricated evidence marked unverified', async () => {
    const cv = repo.createCv(db, 'CV', 'I know TypeScript.');
    const job = repo.createJob(db, 'Dev', null, null, 'Need TS');
    const ai: any = {
      getSettings: vi.fn().mockResolvedValue({ provider: 'ollama' }),
      generateJSON: vi.fn().mockResolvedValue({
        data: { score: 70, verdict: 'moderate-fit', evidence: ['fabricated quote'], supported: [], missing: [], suggestions: [] },
        provider: 'ollama',
        model: 'm',
      }),
    };
    const r = await evaluate(db, ai, cv.id, job.id);
    expect(r.evidence[0].verified).toBe(false);
  });

  it('invalid score rejected', async () => {
    const cv = repo.createCv(db, 'CV', 'x');
    const job = repo.createJob(db, 'Dev', null, null, 'y');
    const ai: any = {
      getSettings: vi.fn().mockResolvedValue({ provider: 'ollama' }),
      generateJSON: vi.fn().mockResolvedValue({
        data: { score: 200, verdict: 'strong-fit', evidence: [], supported: [], missing: [], suggestions: [] },
        provider: 'ollama',
        model: 'm',
      }),
    };
    await expect(evaluate(db, ai, cv.id, job.id)).rejects.toThrow();
  });

  it('repeated evaluations preserved', async () => {
    const cv = repo.createCv(db, 'CV', 'x');
    const job = repo.createJob(db, 'Dev', null, null, 'y');
    const ai: any = {
      getSettings: vi.fn().mockResolvedValue({ provider: 'ollama' }),
      generateJSON: vi.fn().mockResolvedValue({
        data: { score: 50, verdict: 'weak-fit', evidence: [], supported: [], missing: [], suggestions: [] },
        provider: 'ollama',
        model: 'm',
      }),
    };
    await evaluate(db, ai, cv.id, job.id);
    await evaluate(db, ai, cv.id, job.id);
    const rows = db.prepare('SELECT * FROM evaluations').all();
    expect(rows.length).toBe(2);
  });
});
