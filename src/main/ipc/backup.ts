import type { IpcRegistrar } from './ai.js';
import { app, dialog } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { closeDatabase, getActiveDb, openDatabase } from '../db.js';
import { applyMigrations } from '../migrate.js';

export function registerBackupHandlers(ipcMainLike: IpcRegistrar): void {
  ipcMainLike.handle('backup:create', async () => {
    const { filePath, canceled } = await dialog.showSaveDialog({
      title: 'Create backup',
      filters: [{ name: 'SQLite backup', extensions: ['db'] }],
    });
    if (canceled || !filePath) return { canceled: true };
    const db = getActiveDb();
    if (!db) throw new Error('Database not initialized.');
    await db.backup(filePath);
    return { canceled: false, filePath };
  });

  ipcMainLike.handle('backup:restore', async () => {
    const { filePaths, canceled } = await dialog.showOpenDialog({
      title: 'Restore backup',
      properties: ['openFile'],
      filters: [{ name: 'SQLite backup', extensions: ['db'] }],
    });
    if (canceled || !filePaths || filePaths.length === 0) return { canceled: true };
    const backupPath = filePaths[0];
    const dbPath = path.join(app.getPath('userData'), 'app.db');
    const migrationsDir = path.join(__dirname, '..', 'migrations');

    // Validate candidate
    let candidate: ReturnType<typeof openDatabase> | null = null;
    try {
      candidate = openDatabase(backupPath);
    } catch {
      return { canceled: false, ok: false, error: 'Invalid backup file.' };
    }
    // integrity
    try {
      const ok = candidate.pragma('integrity_check') as unknown;
      if (ok !== 'ok') throw new Error('integrity');
    } catch {
      closeDatabase(candidate);
      return { canceled: false, ok: false, error: 'Backup failed integrity check.' };
    }
    closeDatabase(candidate);

    // safety backup
    const safetyPath = dbPath + '.safety';
    if (fs.existsSync(dbPath)) fs.copyFileSync(dbPath, safetyPath);

    try {
      closeDatabase();
      fs.copyFileSync(backupPath, dbPath);
      const db = openDatabase(dbPath);
      applyMigrations(db, migrationsDir);
      closeDatabase(db);
      if (fs.existsSync(safetyPath)) fs.unlinkSync(safetyPath);
      return { canceled: false, ok: true };
    } catch (e) {
      if (fs.existsSync(safetyPath)) {
        fs.copyFileSync(safetyPath, dbPath);
        fs.unlinkSync(safetyPath);
      }
      try { openDatabase(dbPath); } catch {}
      return { canceled: false, ok: false, error: 'Restore failed; previous database retained.' };
    }
  });
}
