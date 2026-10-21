import { closeDatabase, openDatabase } from './db.js';
import { applyMigrations } from './migrate.js';
import fs from 'node:fs';

export interface BackupResult { ok: boolean; error?: string; }

export async function createBackupFile(sourcePath: string, destPath: string): Promise<void> {
  const db = openDatabase(sourcePath);
  try {
    await db.backup(destPath);
  } finally {
    closeDatabase(db);
  }
}

export function validateBackup(candidatePath: string): boolean {
  let db;
  try {
    db = openDatabase(candidatePath);
    const rows = db.pragma('integrity_check') as { integrity_check: string }[];
    if (!Array.isArray(rows) || rows.length === 0 || rows.some((r) => r.integrity_check !== 'ok')) return false;
    return true;
  } catch {
    return false;
  } finally {
    if (db) closeDatabase(db);
  }
}

export async function restoreBackup(dbPath: string, backupPath: string, migrationsDir: string): Promise<BackupResult> {
  if (!fs.existsSync(backupPath)) return { ok: false, error: 'Backup file not found.' };
  if (!validateBackup(backupPath)) return { ok: false, error: 'Backup failed integrity check.' };

  const safetyPath = dbPath + '.safety';
  try {
    // consistent safety snapshot
    const active = openDatabase(dbPath);
    await active.backup(safetyPath);
    closeDatabase(active);

    closeDatabase();
    fs.copyFileSync(backupPath, dbPath);
    const db = openDatabase(dbPath);
    applyMigrations(db, migrationsDir);
    closeDatabase(db);
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
      openDatabase(dbPath);
    } catch {
      // Reopening is best-effort: the previous database file is already
      // restored on disk, so the app can open it again on the next start.
    }
    return { ok: false, error: 'Restore failed; previous database retained.' };
  }
}
