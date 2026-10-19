import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { DbConnection } from './db.js';

interface MigrationFile {
  version: number;
  filename: string;
  sql: string;
}

/**
 * Discovers migration SQL files in the given directory.
 *
 * In development, migrations live at src/main/migrations/.
 * In the packaged build, they are copied to dist/electron/migrations/ by
 * the build step (see package.json "build:copy-migrations").
 * The caller must pass the directory resolved relative to the compiled
 * main-process code (__dirname).
 */
export function discoverMigrations(migrationsDir: string): MigrationFile[] {
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'));

  return files
    .map((filename) => {
      const match = filename.match(/^(\d+)_.*\.sql$/);
      if (!match) {
        throw new Error(
          `Invalid migration filename: ${filename}. Migrations must be named <version>_<name>.sql`
        );
      }
      const version = parseInt(match[1], 10);
      const sql = readFileSync(join(migrationsDir, filename), 'utf8');
      return { version, filename, sql };
    })
    .sort((a, b) => a.version - b.version);
}

/**
 * Ensures the schema_migrations tracking table exists before the first
 * migration is applied. The table itself is created by migration 001, but
 * the runner must query the current version before applying any migration,
 * so the table must exist beforehand.
 */
function ensureTrackingTable(db: DbConnection): void {
  db.exec(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`
  );
}

/**
 * Returns the highest recorded migration version, or 0 if none.
 */
function getCurrentVersion(db: DbConnection): number {
  const row = db
    .prepare('SELECT MAX(version) AS version FROM schema_migrations')
    .get() as { version: number | null };
  return row.version ?? 0;
}

/**
 * Applies all pending migrations in a single transaction per migration.
 * Each migration is atomic: on failure, it rolls back and the recorded
 * version is unchanged. Existing data is never deleted or reset.
 *
 * Migration failure is distinct from database corruption; this function
 * throws a clear error on migration failure without marking the DB corrupt.
 */
export function applyMigrations(db: DbConnection, migrationsDir: string): number[] {
  const migrations = discoverMigrations(migrationsDir);
  ensureTrackingTable(db);
  const currentVersion = getCurrentVersion(db);
  const applied: number[] = [];

  for (const migration of migrations) {
    if (migration.version <= currentVersion) {
      continue;
    }

    const transaction = db.transaction(() => {
      db.exec(migration.sql);
      db.prepare(
        'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)'
      ).run(migration.version, new Date().toISOString());
    });

    try {
      transaction();
      applied.push(migration.version);
    } catch (error) {
      throw new Error(
        `Migration ${migration.filename} (v${migration.version}) failed and was rolled back: ${(error as Error).message}`
      );
    }
  }

  return applied;
}

/**
 * Runs PRAGMA integrity_check and returns true if the database structure
 * is intact. A failure indicates possible corruption and is reported
 * separately from migration errors.
 */
export function checkIntegrity(db: DbConnection): boolean {
  const row = db.prepare('PRAGMA integrity_check').get() as {
    integrity_check: string;
  };
  return row.integrity_check === 'ok';
}
