import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { openDatabase, closeDatabase } from '../db';
import {
  applyMigrations,
  checkIntegrity,
  discoverMigrations,
} from '../migrate';
import {
  mkdtempSync,
  writeFileSync,
  rmSync,
  existsSync,
  mkdirSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('migration runner', () => {
  let tempDir: string;
  let migrationsDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'lca-migrate-test-'));
    migrationsDir = join(tempDir, 'migrations');
    mkdirSync(migrationsDir, { recursive: true });
    writeFileSync(
      join(migrationsDir, '001_init.sql'),
      `CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);`
    );
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('discovers migration files in numeric order', () => {
    mkdirSync(migrationsDir, { recursive: true });
    writeFileSync(
      join(migrationsDir, '002_add_extra.sql'),
      'CREATE TABLE IF NOT EXISTS extra (id INTEGER PRIMARY KEY);'
    );
    const migrations = discoverMigrations(migrationsDir);
    expect(migrations.length).toBe(2);
    expect(migrations[0].version).toBe(1);
    expect(migrations[1].version).toBe(2);
  });

  it('throws on invalid migration filenames', () => {
    mkdirSync(migrationsDir, { recursive: true });
    writeFileSync(
      join(migrationsDir, 'not_a_migration.sql'),
      'SELECT 1;'
    );
    expect(() => discoverMigrations(migrationsDir)).toThrow(
      /Invalid migration filename/
    );
  });

  it('applies migration 001 and creates schema_migrations', () => {
    const dbPath = join(tempDir, 'test.db');
    const db = openDatabase(dbPath);
    try {
      const applied = applyMigrations(db, migrationsDir);
      expect(applied).toContain(1);

      const row = db
        .prepare('SELECT MAX(version) AS version FROM schema_migrations')
        .get() as { version: number | null };
      expect(row.version).toBe(1);

      // Verify the tracking table exists
      const tableExists = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'"
        )
        .get();
      expect(tableExists).toBeDefined();
    } finally {
      closeDatabase(db);
    }
  });

  it('is idempotent: re-applying migrations does not duplicate versions', () => {
    const dbPath = join(tempDir, 'test.db');
    const db = openDatabase(dbPath);
    try {
      applyMigrations(db, migrationsDir);
      const appliedAgain = applyMigrations(db, migrationsDir);
      expect(appliedAgain).toEqual([]);

      const rows = db
        .prepare('SELECT version FROM schema_migrations')
        .all() as { version: number }[];
      expect(rows.length).toBe(1);
      expect(rows[0].version).toBe(1);
    } finally {
      closeDatabase(db);
    }
  });

  it('rolls back a failed migration and preserves the recorded version', () => {
    const dbPath = join(tempDir, 'test.db');
    const db = openDatabase(dbPath);
    try {
      applyMigrations(db, migrationsDir);

      // Add a bad migration file
      mkdirSync(migrationsDir, { recursive: true });
      writeFileSync(
        join(migrationsDir, '002_bad.sql'),
        'CREATE TABLE IF NOT EXISTS extra (id INTEGER PRIMARY KEY); INSERT INTO nonexistent_table VALUES (1);'
      );

      expect(() => applyMigrations(db, migrationsDir)).toThrow(
        /rolled back/
      );

      // Version should still be 1
      const row = db
        .prepare('SELECT MAX(version) AS version FROM schema_migrations')
        .get() as { version: number | null };
      expect(row.version).toBe(1);

      // The partial table from the bad migration should not exist
      const tableExists = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='extra'"
        )
        .get();
      expect(tableExists).toBeUndefined();
    } finally {
      closeDatabase(db);
    }
  });

  it('reports integrity check result', () => {
    const dbPath = join(tempDir, 'test.db');
    const db = openDatabase(dbPath);
    try {
      applyMigrations(db, migrationsDir);
      expect(checkIntegrity(db)).toBe(true);
    } finally {
      closeDatabase(db);
    }
  });

  it('does not open the real user database', () => {
    const dbPath = join(tempDir, 'isolated.db');
    const db = openDatabase(dbPath);
    try {
      // The database file should exist only at the temp path
      expect(existsSync(dbPath)).toBe(true);
      // It should be empty except for schema_migrations after migration
      applyMigrations(db, migrationsDir);
      const tables = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        )
        .all() as { name: string }[];
      expect(tables.map((t) => t.name)).toEqual(['schema_migrations']);
    } finally {
      closeDatabase(db);
    }
  });
});
