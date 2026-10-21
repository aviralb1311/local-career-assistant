import { describe, it, expect } from 'vitest';
import { openDatabase, closeDatabase, getActiveDb } from '../../db.js';
import { applyMigrations } from '../../migrate.js';
import { createBackupFile, validateBackup, restoreBackup } from '../../backup.js';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';

describe('backup', () => {
  it('round trip', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'bk-'));
    const dbPath = join(dir, 'a.db');
    const backupPath = join(dir, 'b.db');
    const db = openDatabase(dbPath);
    applyMigrations(db, join(process.cwd(), 'src/main/migrations'));
    db.prepare('CREATE TABLE IF NOT EXISTS t (x TEXT)').run();
    db.prepare('INSERT INTO t (x) VALUES (?)').run('hello');
    closeDatabase(db);

    await createBackupFile(dbPath, backupPath);
    // modify original
    const db2 = openDatabase(dbPath);
    db2.prepare('DELETE FROM t').run();
    closeDatabase(db2);

    const res = await restoreBackup(dbPath, backupPath, join(process.cwd(), "src/main/migrations"));
    expect(res.ok).toBe(true);
    const db3 = openDatabase(dbPath);
    const row = db3.prepare('SELECT x FROM t').get() as { x: string };
    expect(row.x).toBe('hello');
    closeDatabase(db3);
  });

  it('rejects corrupt backup', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bk2-'));
    const bad = join(dir, 'bad.db');
    writeFileSync(bad, 'not a db');
    expect(validateBackup(bad)).toBe(false);
  });

  it('rejects non-sqlite', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bk3-'));
    const bad = join(dir, 'bad2.db');
    writeFileSync(bad, 'hello world');
    expect(validateBackup(bad)).toBe(false);
  });
});

describe('backup migration failure', () => {
  it('preserves original on migration failure', async () => {
    const { mkdirSync, writeFileSync } = await import('node:fs');
    const dir = mkdtempSync(join(tmpdir(), 'bkf-'));
    const dbPath = join(dir, 'a.db');
    const backupPath = join(dir, 'b.db');
    const badMigDir = join(dir, 'migs');
    mkdirSync(badMigDir);
    writeFileSync(join(badMigDir, '999_bad.sql'), 'THIS IS INVALID SQL;');
    const db = openDatabase(dbPath);
    applyMigrations(db, join(process.cwd(), 'src/main/migrations'));
    db.prepare('CREATE TABLE IF NOT EXISTS t (x TEXT)').run();
    db.prepare('INSERT INTO t (x) VALUES (?)').run('original');
    closeDatabase(db);
    await createBackupFile(dbPath, backupPath);
    // modify original
    const db2 = openDatabase(dbPath);
    db2.prepare('DELETE FROM t').run();
    closeDatabase(db2);

    const res = await restoreBackup(dbPath, backupPath, badMigDir);
    expect(res.ok).toBe(false);
    // rollback path reopens the database; verify it is usable and intact
    const db3 = getActiveDb();
    expect(db3).toBeDefined();
    // previous database is retained as it was before the restore attempt
    const rows = db3!.prepare('SELECT x FROM t').all() as { x: string }[];
    expect(rows).toHaveLength(0);
    closeDatabase(db3!);
  });
});
