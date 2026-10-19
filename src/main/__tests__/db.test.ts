import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import {
  openDatabase,
  closeDatabase,
  getActiveDb,
} from '../db';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('database service', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'lca-db-test-'));
  });

  afterEach(() => {
    const active = getActiveDb();
    if (active) {
      closeDatabase(active);
    }
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('opens a database at an injected temp path, never the real userData path', () => {
    const dbPath = join(tempDir, 'test.db');
    const db = openDatabase(dbPath);
    expect(db).toBeDefined();
    expect(getActiveDb()).toBe(db);
    closeDatabase(db);
    expect(getActiveDb()).toBeNull();
  });

  it('throws a clear error if the database path cannot be created', () => {
    // Create a regular file where the DB's parent directory should be.
    const blockingFile = join(tempDir, 'blocking-file');
    writeFileSync(blockingFile, 'not a directory');
    const dbPath = join(blockingFile, 'test.db');
    expect(() => openDatabase(dbPath)).toThrow();
  });

  it('enables foreign key enforcement', () => {
    const dbPath = join(tempDir, 'test.db');
    const db = openDatabase(dbPath);
    try {
      const row = db.prepare('PRAGMA foreign_keys').get() as {
        foreign_keys: number;
      };
      expect(row.foreign_keys).toBe(1);
    } finally {
      closeDatabase(db);
    }
  });

  it('uses default rollback journal mode (not WAL) in Phase 1', () => {
    const dbPath = join(tempDir, 'test.db');
    const db = openDatabase(dbPath);
    try {
      const row = db.prepare('PRAGMA journal_mode').get() as {
        journal_mode: string;
      };
      expect(row.journal_mode).toBe('delete');
    } finally {
      closeDatabase(db);
    }
  });

  it('closes cleanly and releases the active connection reference', () => {
    const dbPath = join(tempDir, 'test.db');
    const db = openDatabase(dbPath);
    expect(getActiveDb()).toBe(db);
    closeDatabase(db);
    expect(getActiveDb()).toBeNull();
  });

  it('throws when opening a database while another connection is already open', () => {
    const dbPath = join(tempDir, 'test.db');
    const first = openDatabase(dbPath);
    expect(getActiveDb()).toBe(first);

    const secondPath = join(tempDir, 'second.db');
    expect(() => openDatabase(secondPath)).toThrow(
      /A database connection is already open/
    );

    // The first connection must still be active and unchanged.
    expect(getActiveDb()).toBe(first);
    closeDatabase(first);
  });

  it('closeDatabase is idempotent and safe to call repeatedly', () => {
    const dbPath = join(tempDir, 'test.db');
    const db = openDatabase(dbPath);

    closeDatabase(db);
    expect(getActiveDb()).toBeNull();

    // Calling close again on the same database must not throw.
    expect(() => closeDatabase(db)).not.toThrow();

    // Calling close with no argument when nothing is open must not throw.
    expect(() => closeDatabase()).not.toThrow();
    expect(getActiveDb()).toBeNull();
  });

  it('does not leak a connection when openDatabase fails', () => {
    const blockingFile = join(tempDir, 'blocking-file');
    writeFileSync(blockingFile, 'not a directory');
    const dbPath = join(blockingFile, 'test.db');

    expect(() => openDatabase(dbPath)).toThrow();
    expect(getActiveDb()).toBeNull();
  });
});
