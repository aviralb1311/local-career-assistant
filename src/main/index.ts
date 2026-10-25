import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
import { registerBackupHandlers } from './ipc/backup.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.error('[main] entry point reached');
process.on('uncaughtException', (err) => console.error('[main] uncaughtException:', err));
process.on('unhandledRejection', (err) => console.error('[main] unhandledRejection:', err));

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
    console.error('[main] loadURL (dev):', process.env.VITE_DEV_SERVER_URL);
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
      .then(() => console.error('[main] loadURL resolved'))
      .catch((err) => console.error('[main] loadURL failed:', err));
  } else {
    const filePath = path.join(__dirname, '../../dist/renderer/index.html');
    console.error('[main] loadFile:', filePath);
    mainWindow.loadFile(filePath)
      .then(() => console.error('[main] loadFile resolved'))
      .catch((err) => console.error('[main] loadFile failed:', err));
  }
  mainWindow.webContents.on('render-process-gone', (_e, details) => console.error('[main] render-process-gone:', details));
  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => console.error('[main] did-fail-load:', code, desc, url));
  mainWindow.webContents.on('did-finish-load', () => console.error('[main] did-finish-load'));

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

app.on('will-finish-launching', () => console.error('[main] will-finish-launching'));
app.on('ready', () => console.error('[main] ready event'));
app.on('window-all-closed', () => console.error('[main] window-all-closed'));
app.on('before-quit', () => console.error('[main] before-quit'));

app.whenReady().then(() => {
  console.error('[main] whenReady resolved');
  console.error('[main] initializing database');
  initializeDatabase();
  console.error('[main] creating window');
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
  registerBackupHandlers(ipcMain);

  console.error('[main] handlers registered');

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}).catch((err) => console.error('[main] whenReady rejected:', err));

app.on('will-quit', () => {
  closeDatabase();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
