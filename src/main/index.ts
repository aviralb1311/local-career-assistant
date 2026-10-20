import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'node:path';
import {
  closeDatabase,
  getActiveDb,
  getDefaultDbPath,
  openDatabase,
} from './db.js';
import { applyMigrations, checkIntegrity } from './migrate.js';
import { AIService } from './ai/service.js';
import { registerAIHandlers } from './ipc/ai.js';
import { registerWorkflowHandlers } from './ipc/workflow.js';
import { registerTrackingHandlers } from './ipc/tracking.js';

let mainWindow: BrowserWindow | null = null;
let dbPath: string = getDefaultDbPath();
let aiService: AIService | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function sanitizeErrorMessage(message: string): string {
  // Strip absolute file paths to avoid leaking userData directory locations.
  return message.replace(/\/[^\s]*/g, '[path]').replace(/[A-Za-z]:\\[^\s]*/g, '[path]');
}

function initializeDatabase(): void {
  try {
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    const db = openDatabase(dbPath);

    const integrityOk = checkIntegrity(db);
    if (!integrityOk) {
      throw new Error(
        'Database integrity check failed. The database file may be corrupted.'
      );
    }

    applyMigrations(db, migrationsDir);

    // Initialize AI service after migrations are applied.
    aiService = new AIService(db);
  } catch (error) {
    const message = sanitizeErrorMessage((error as Error).message);
    dialog.showErrorBox(
      'Database initialization failed',
      `Local Career Assistant could not open its database.\n\n${message}\n\nYour data has not been modified. You may restore from a backup if available.`
    );
    throw error;
  }
}

function requireAIService(): AIService {
  if (!aiService) {
    throw new Error('AI service is not initialized');
  }
  return aiService;
}

app.whenReady().then(() => {
  initializeDatabase();
  createWindow();

  // Read-only IPC handlers only. No migration execution or database access
  // is exposed to the renderer.
  ipcMain.handle('app:ping', () => 'pong');
  ipcMain.handle('db:ping', () => ({ ok: true }));
  ipcMain.handle('db:version', () => {
    const db = getActiveDb();
    if (!db) {
      throw new Error('Database is not initialized');
    }
    const row = db
      .prepare('SELECT MAX(version) AS version FROM schema_migrations')
      .get() as { version: number | null };
    return { version: row.version ?? 0 };
  });

  registerAIHandlers(ipcMain, requireAIService);
  registerWorkflowHandlers(ipcMain, getActiveDb, requireAIService);
  registerTrackingHandlers(ipcMain, getActiveDb);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('will-quit', () => {
  closeDatabase();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
