import { closeDatabase, openDatabase, openReadonlyDatabase, type DbConnection } from './db.js';
import { applyMigrations } from './migrate.js';
import fs from 'node:fs';

export interface BackupResult { ok: boolean; error?: string; }

export async function createBackupFile(sourcePath: string, destPath: string): Promise<void> {
  // Open the source read-only so it can be backed up without conflicting
  // with the active application database connection.
  const db = openReadonlyDatabase(sourcePath);
  try {
    await db.backup(destPath);
  } finally {
    db.close();
  }
}

export function validateBackup(candidatePath: string): boolean {
  let db: DbConnection | undefined;
  try {
    // Open the candidate read-only; never registers in the active singleton.
    db = openReadonlyDatabase(candidatePath);
    const rows = db.pragma('integrity_check') as { integrity_check: string }[];
    if (!Array.isArray(rows) || rows.length === 0 || rows.some((r) => r.integrity_check !== 'ok')) return false;
    return true;
  } catch {
    return false;
  } finally {
    if (db) db.close();
  }
}

export async function restoreBackup(dbPath: string, backupPath: string, migrationsDir: string): Promise<BackupResult> {
  if (!fs.existsSync(backupPath)) return { ok: false, error: 'Backup file not found.' };
  if (!validateBackup(backupPath)) return { ok: false, error: 'Backup failed integrity check.' };

  const safetyPath = dbPath + '.safety';
  try {
    // Consistent safety snapshot of the live database, read-only, without
    // disturbing the active application connection.
    const active = openReadonlyDatabase(dbPath);
    try {
      await active.backup(safetyPath);
    } finally {
      active.close();
    }

    closeDatabase();
    fs.copyFileSync(backupPath, dbPath);
    const db = openDatabase(dbPath);
    try {
      applyMigrations(db, migrationsDir);
    } finally {
      closeDatabase(db);
    }
    if (fs.existsSync(safetyPath)) fs.unlinkSync(safetyPath);
    return { ok: true };
  } catch {
    if (fs.existsSync(safetyPath)) {
      try {
        fs.copyFileSync(safetyPath, dbPath);
      } catch {
        // keep safety file as recovery copy
      }
    }
    try {
      closeDatabase();
      openDatabase(dbPath);
    } catch {
      // Reopening is best-effort: the previous database file is already
      // restored on disk, so the app can open it again on the next start.
    }
    return { ok: false, error: 'Restore failed; previous database retained.' };
  }
}
