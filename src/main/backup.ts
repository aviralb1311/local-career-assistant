import type { DbConnection } from './db.js';
import { closeDatabase, openDatabase } from './db.js';
import { applyMigrations } from './migrate.js';
import path from 'node:path';
import fs from 'node:fs';

export async function createBackup(db: DbConnection, destPath: string): Promise<void> {
  await db.backup(destPath);
}

export function restoreBackup(dbPath: string, backupPath: string): void {
  // validate file exists
  if (!fs.existsSync(backupPath)) throw new Error('Backup file not found');
  // safety: copy current db
  const safety = dbPath + '.safety';
  if (fs.existsSync(dbPath)) fs.copyFileSync(dbPath, safety);
  try {
    fs.copyFileSync(backupPath, dbPath);
    const db = openDatabase(dbPath);
    // run migrations
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    applyMigrations(db, migrationsDir);
    closeDatabase(db);
  } catch (e) {
    // restore safety
    if (fs.existsSync(safety)) fs.copyFileSync(safety, dbPath);
    throw e;
  }
}
