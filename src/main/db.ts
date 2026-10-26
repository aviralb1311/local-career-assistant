import { app } from 'electron';
import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

export type DbConnection = Database.Database;

let activeDb: DbConnection | null = null;

export const DEFAULT_DB_FILENAME = 'app.db';

export function getDefaultDbPath(): string {
  return path.join(app.getPath('userData'), DEFAULT_DB_FILENAME);
}

export function openDatabase(dbPath?: string): DbConnection {
  if (activeDb) {
    throw new Error(
      'A database connection is already open. Close it before opening another.'
    );
  }

  const resolvedPath = dbPath ?? getDefaultDbPath();

  // Ensure the parent directory exists (for tests, the temp dir already exists;
  // for production, userData is created by Electron).
  const parentDir = path.dirname(resolvedPath);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }

  const db = new Database(resolvedPath);

  try {
    // Foreign keys are off by default in SQLite; enable them explicitly.
    db.pragma('foreign_keys = ON');
    // Default rollback journal mode (no WAL in Phase 1).
    db.pragma('journal_mode = DELETE');
    // Synchronous NORMAL is safe with rollback journal and balances
    // durability with startup performance.
    db.pragma('synchronous = NORMAL');

    // Verify the connection is usable.
    db.prepare('SELECT 1').get();
  } catch (error) {
    db.close();
    throw new Error(
      `Failed to initialize SQLite database: ${(error as Error).message}`
    );
  }

  activeDb = db;
  return db;
}

/**
 * Opens a database file on a standalone connection that is NOT registered in
 * the active application database singleton.
 *
 * Intended for inspecting backup files without disturbing the live application
 * connection. Opened read-only so the source can never be modified through
 * this handle. The caller is responsible for closing the returned connection,
 * preferably in a `finally` block.
 */
export function openReadonlyDatabase(dbPath: string): DbConnection {
  const db = new Database(dbPath, { readonly: true });

  try {
    // Verify the connection is usable.
    db.prepare('SELECT 1').get();
  } catch (error) {
    db.close();
    throw new Error(
      `Failed to open backup database: ${(error as Error).message}`
    );
  }

  return db;
}

export function closeDatabase(db?: DbConnection): void {
  const target = db ?? activeDb;
  if (!target) {
    return;
  }

  try {
    // Checkpoint any pending changes before closing.
    target.pragma('wal_checkpoint(TRUNCATE)');
  } catch {
    // Ignore checkpoint errors on close; the DB may not be in WAL mode.
  }

  try {
    target.close();
  } catch (error) {
    // better-sqlite3 throws if the database is already closed. Treat that as
    // idempotent, but do not suppress unrelated close errors.
    const message = (error as Error).message;
    if (!/database is already closed/i.test(message)) {
      throw error;
    }
  }

  if (db === undefined || db === activeDb) {
    activeDb = null;
  }
}

export function getActiveDb(): DbConnection | null {
  return activeDb;
}
