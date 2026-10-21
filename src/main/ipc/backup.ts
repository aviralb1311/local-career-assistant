import type { IpcRegistrar } from './ai.js';
import { app, dialog } from 'electron';
import path from 'node:path';
import { closeDatabase, getActiveDb } from '../db.js';
import { restoreBackup } from '../backup.js';

export function registerBackupHandlers(ipcMainLike: IpcRegistrar): void {
  ipcMainLike.handle('backup:create', async () => {
    const { filePath, canceled } = await dialog.showSaveDialog({
      title: 'Create backup',
      filters: [{ name: 'SQLite backup', extensions: ['db'] }],
    });
    if (canceled || !filePath) return { canceled: true };
    const db = getActiveDb();
    if (!db) throw new Error('Database not initialized.');
    // use db.backup directly via active connection
    const tmpPath = filePath;
    await db.backup(tmpPath);
    return { canceled: false, filePath: tmpPath };
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
    closeDatabase();
    const result = await restoreBackup(dbPath, backupPath, migrationsDir);
    return { canceled: false, ...result };
  });
}
