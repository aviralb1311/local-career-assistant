import { describe, it, expect } from 'vitest';
import { openDatabase, closeDatabase } from '../../db.js';
import { applyMigrations } from '../../migrate.js';
import * as repo from '../../tracking/repo.js';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('tracking repo', () => {
  it('creates lists filters searches updates deletes', () => {
    const dir = mkdtempSync(join(tmpdir(), 'tr-'));
    const db = openDatabase(join(dir, 't.db'));
    applyMigrations(db, join(process.cwd(), 'src/main/migrations'));
    const a = repo.createApplication(db, { company: 'Acme', role: 'Dev', status: 'applied' });
    expect(a.id).toBeGreaterThan(0);
    expect(repo.listApplications(db, 'applied').length).toBe(1);
    expect(repo.searchApplications(db, 'Acme').length).toBe(1);
    repo.updateApplication(db, a.id, { status: 'interview' });
    expect(repo.getApplication(db, a.id)!.status).toBe('interview');
    repo.deleteApplication(db, a.id);
    expect(repo.listApplications(db).length).toBe(0);
    closeDatabase(db);
  });
});
