import { describe, it, expect, afterEach } from 'vitest';
import { openDatabase, closeDatabase, getActiveDb, openReadonlyDatabase } from '../../db.js';
import { applyMigrations } from '../../migrate.js';
import { createBackupFile, validateBackup, restoreBackup } from '../../backup.js';
import {
  mkdtempSync,
  writeFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const MIGRATIONS_DIR = join(process.cwd(), 'src/main/migrations');

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), 'bk-'));
}

describe('backup', () => {
  afterEach(() => {
    const active = getActiveDb();
    if (active) {
      closeDatabase(active);
    }
  });

  it('round trip', async () => {
    const dir = tempDir();
    const dbPath = join(dir, 'a.db');
    const backupPath = join(dir, 'b.db');
    const db = openDatabase(dbPath);
    applyMigrations(db, MIGRATIONS_DIR);
    db.prepare('CREATE TABLE IF NOT EXISTS t (x TEXT)').run();
    db.prepare('INSERT INTO t (x) VALUES (?)').run('hello');
    closeDatabase(db);

    await createBackupFile(dbPath, backupPath);
    // modify original
    const db2 = openDatabase(dbPath);
    db2.prepare('DELETE FROM t').run();
    closeDatabase(db2);

    const res = await restoreBackup(dbPath, backupPath, MIGRATIONS_DIR);
    expect(res.ok).toBe(true);
    const db3 = openDatabase(dbPath);
    const row = db3.prepare('SELECT x FROM t').get() as { x: string };
    expect(row.x).toBe('hello');
    closeDatabase(db3);
    rmSync(dir, { recursive: true, force: true });
  });

  it('rejects corrupt backup', () => {
    const dir = tempDir();
    const bad = join(dir, 'bad.db');
    writeFileSync(bad, 'not a db');
    expect(validateBackup(bad)).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });

  it('rejects non-sqlite', () => {
    const dir = tempDir();
    const bad = join(dir, 'bad2.db');
    writeFileSync(bad, 'hello world');
    expect(validateBackup(bad)).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe('backup with active connection', () => {
  afterEach(() => {
    const active = getActiveDb();
    if (active) {
      closeDatabase(active);
    }
  });

  it('validates a valid backup while the main connection remains open', async () => {
    const dir = tempDir();
    const dbPath = join(dir, 'main.db');
    const backupPath = join(dir, 'backup.db');

    const main = openDatabase(dbPath);
    applyMigrations(main, MIGRATIONS_DIR);
    main.prepare('CREATE TABLE IF NOT EXISTS t (x TEXT)').run();
    main.prepare('INSERT INTO t (x) VALUES (?)').run('hello');

    // Backup file does not exist yet.
    expect(validateBackup(backupPath)).toBe(false);

    // Create a backup from the live (read-only) source without closing main.
    await createBackupFile(dbPath, backupPath);

    // Validation succeeds while the main connection is still open.
    expect(validateBackup(backupPath)).toBe(true);

    closeDatabase(main);
    rmSync(dir, { recursive: true, force: true });
  });

  it('rejects a corrupt backup while the main connection remains open', async () => {
    const dir = tempDir();
    const dbPath = join(dir, 'main.db');
    const badPath = join(dir, 'bad.db');

    const main = openDatabase(dbPath);
    applyMigrations(main, MIGRATIONS_DIR);
    writeFileSync(badPath, 'not a database');

    // Validation rejects the corrupt file without disturbing main.
    expect(validateBackup(badPath)).toBe(false);

    // The active connection is still usable (migrations were applied).
    const row = main.prepare('SELECT MAX(version) AS version FROM schema_migrations').get() as { version: number | null };
    expect(row.version).toBeGreaterThan(0);

    closeDatabase(main);
    rmSync(dir, { recursive: true, force: true });
  });

  it('restores a valid backup while the main connection remains open', async () => {
    const dir = tempDir();
    const dbPath = join(dir, 'main.db');
    const backupPath = join(dir, 'backup.db');

    const main = openDatabase(dbPath);
    applyMigrations(main, MIGRATIONS_DIR);
    main.prepare('CREATE TABLE IF NOT EXISTS t (x TEXT)').run();
    main.prepare('INSERT INTO t (x) VALUES (?)').run('original');

    await createBackupFile(dbPath, backupPath);

    // Mutate the live database.
    main.prepare('DELETE FROM t').run();
    main.prepare('INSERT INTO t (x) VALUES (?)').run('modified');

    // Restore while main is still open (restoreBackup closes main internally).
    const res = await restoreBackup(dbPath, backupPath, MIGRATIONS_DIR);
    expect(res.ok).toBe(true);

    // The restored database is usable and contains the original data.
    const restored = openDatabase(dbPath);
    try {
      const row = restored.prepare('SELECT x FROM t').get() as { x: string };
      expect(row.x).toBe('original');
    } finally {
      closeDatabase(restored);
    }

    rmSync(dir, { recursive: true, force: true });
  });

  it('closes temporary connections on restore failure', async () => {
    const dir = tempDir();
    const dbPath = join(dir, 'main.db');
    const backupPath = join(dir, 'backup.db');
    const badMigDir = join(dir, 'migs');

    const { mkdirSync, writeFileSync: wfs } = await import('node:fs');
    mkdirSync(badMigDir);
    wfs(join(badMigDir, '999_bad.sql'), 'THIS IS INVALID SQL;');

    const main = openDatabase(dbPath);
    applyMigrations(main, MIGRATIONS_DIR);
    main.prepare('CREATE TABLE IF NOT EXISTS t (x TEXT)').run();
    main.prepare('INSERT INTO t (x) VALUES (?)').run('original');

    await createBackupFile(dbPath, backupPath);

    // Restore with bad migrations must fail.
    const res = await restoreBackup(dbPath, backupPath, badMigDir);
    expect(res.ok).toBe(false);

    // restoreBackup closes the caller's connection and reopens a fresh one on
    // failure. Query through the active connection to confirm original data is retained.
    const active = getActiveDb();
    expect(active).toBeDefined();
    const rows = active!.prepare('SELECT x FROM t').all() as { x: string }[];
    expect(rows).toHaveLength(1);
    expect(rows[0].x).toBe('original');

    // The reopened connection is the active singleton; no stale closed handle leaked.
    expect(getActiveDb()).toBe(active);

    closeDatabase();
    rmSync(dir, { recursive: true, force: true });
  });

  it('opens a readonly backup connection without registering in the singleton', async () => {
    const dir = tempDir();
    const dbPath = join(dir, 'main.db');
    const backupPath = join(dir, 'backup.db');

    const main = openDatabase(dbPath);
    applyMigrations(main, MIGRATIONS_DIR);

    await createBackupFile(dbPath, backupPath);

    // Open the backup on a standalone readonly handle.
    const ro = openReadonlyDatabase(backupPath);
    try {
      const row = ro.prepare('SELECT MAX(version) AS version FROM schema_migrations').get() as { version: number | null };
      expect(row.version).toBeGreaterThan(0);
    } finally {
      ro.close();
    }

    // The readonly handle never touched the active singleton.
    expect(getActiveDb()).toBe(main);

    closeDatabase(main);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe('backup migration failure', () => {
  afterEach(() => {
    const active = getActiveDb();
    if (active) {
      closeDatabase(active);
    }
  });

  it('preserves original on migration failure', async () => {
    const dir = tempDir();
    const dbPath = join(dir, 'a.db');
    const backupPath = join(dir, 'b.db');
    const badMigDir = join(dir, 'migs');

    const { mkdirSync, writeFileSync } = await import('node:fs');
    mkdirSync(badMigDir);
    writeFileSync(join(badMigDir, '999_bad.sql'), 'THIS IS INVALID SQL;');
    const db = openDatabase(dbPath);
    applyMigrations(db, MIGRATIONS_DIR);
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
    rmSync(dir, { recursive: true, force: true });
  });
});
