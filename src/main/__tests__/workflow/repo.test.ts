import { describe, it, expect } from 'vitest';
import { openDatabase, closeDatabase } from '../../db.js';
import { applyMigrations } from '../../migrate.js';
import * as repo from '../../workflow/repo.js';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('workflow repo', () => {
  it('creates and lists cv and job', () => {
    const dir = mkdtempSync(join(tmpdir(), 'wf-'));
    const db = openDatabase(join(dir, 't.db'));
    applyMigrations(db, join(process.cwd(), 'src/main/migrations'));
    const cv = repo.createCv(db, 'My CV', 'content');
    expect(cv.id).toBeGreaterThan(0);
    const job = repo.createJob(db, 'Engineer', 'Acme', null, 'desc');
    expect(job.id).toBeGreaterThan(0);
    expect(repo.listCvs(db).length).toBe(1);
    expect(repo.listJobs(db).length).toBe(1);
    repo.updateCv(db, cv.id, 'T2', 'c2');
    expect(repo.getCv(db, cv.id)!.title).toBe('T2');
    repo.deleteCv(db, cv.id);
    expect(repo.listCvs(db).length).toBe(0);
    closeDatabase(db);
  });
});
