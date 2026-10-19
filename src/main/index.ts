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
import {
  validateGenerateJSONInput,
  validateGenerateTextInput,
  validateSecretOperation,
  validateSettings,
  ValidationError,
} from './ai/validation.js';

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

/**
 * Maps any error thrown by the AI service layer to a safe error suitable
 * for IPC transport. Never forwards provider error messages, credentials,
 * prompt content, or sensitive URLs to the renderer.
 */
function safeProviderError(error: unknown): Error {
  if (error instanceof ValidationError) {
    const err = new Error(
      'Invalid request: ' + sanitizeErrorMessage(error.message)
    );
    (err as Error & { code?: string }).code = 'validation-error';
    return err;
  }

  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    const safeCodes = new Set([
      'connection-refused',
      'http-error',
      'malformed-response',
      'timeout',
      'cancelled',
      'not-configured',
      'consent-required',
      'unknown',
      'validation-error',
    ]);
    if (safeCodes.has(code as string)) {
      const err = new Error(
        sanitizeErrorMessage((error as unknown as Error).message)
      );
      (err as Error & { code?: string }).code = code as string;
      return err;
    }
  }

  // Unknown error shape: return a generic safe error.
  return new Error(
    'An unexpected error occurred during AI processing.'
  );
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

  // AI provider IPC handlers (narrowly scoped, typed, validated).
  ipcMain.handle('ai:providers', async () => {
    return requireAIService().getProviderInfo();
  });

  ipcMain.handle('ai:getSettings', async () => {
    return requireAIService().getSettings();
  });

  ipcMain.handle('ai:setSettings', async (_event, partial: unknown) => {
    const validated = validateSettings(partial);
    return requireAIService().setSettings(validated);
  });

  ipcMain.handle('ai:isCloudAllowed', async () => {
    return requireAIService().isCloudAllowed();
  });

  ipcMain.handle(
    'ai:requireConsent',
    async (_event, action: unknown, dataCategories: unknown) => {
      if (typeof action !== 'string' || !action) {
        throw new ValidationError(
          'Invalid action: must be a non-empty string.'
        );
      }
      if (
        !Array.isArray(dataCategories) ||
        !dataCategories.every((c) => typeof c === 'string' && c)
      ) {
        throw new ValidationError(
          'Invalid dataCategories: must be an array of non-empty strings.'
        );
      }
      return requireAIService().requireConsent(action, dataCategories);
    }
  );

  ipcMain.handle(
    'ai:grantConsent',
    async (_event, action: unknown, dataCategories: unknown) => {
      if (typeof action !== 'string' || !action) {
        throw new ValidationError(
          'Invalid action: must be a non-empty string.'
        );
      }
      if (
        !Array.isArray(dataCategories) ||
        !dataCategories.every((c) => typeof c === 'string' && c)
      ) {
        throw new ValidationError(
          'Invalid dataCategories: must be an array of non-empty strings.'
        );
      }
      await requireAIService().grantConsent(action, dataCategories);
      return { ok: true };
    }
  );

  ipcMain.handle(
    'ai:denyConsent',
    async (_event, action: unknown, dataCategories: unknown) => {
      if (typeof action !== 'string' || !action) {
        throw new ValidationError(
          'Invalid action: must be a non-empty string.'
        );
      }
      if (
        !Array.isArray(dataCategories) ||
        !dataCategories.every((c) => typeof c === 'string' && c)
      ) {
        throw new ValidationError(
          'Invalid dataCategories: must be an array of non-empty strings.'
        );
      }
      await requireAIService().denyConsent(action, dataCategories);
      return { ok: true };
    }
  );

  ipcMain.handle(
    'ai:generateText',
    async (_event, input: unknown) => {
      const validated = validateGenerateTextInput(input);
      try {
        return await requireAIService().generateText(validated);
      } catch (error) {
        throw safeProviderError(error);
      }
    }
  );

  ipcMain.handle(
    'ai:generateJSON',
    async (_event, input: unknown) => {
      const validated = validateGenerateJSONInput(input);
      try {
        return await requireAIService().generateJSON(validated);
      } catch (error) {
        throw safeProviderError(error);
      }
    }
  );

  ipcMain.handle(
    'ai:setSecret',
    async (_event, provider: unknown, secret: unknown) => {
      const { provider: validatedProvider, secret: validatedSecret } =
        validateSecretOperation(provider, secret);
      if (validatedSecret === undefined) {
        throw new ValidationError('Invalid secret: must be a non-empty string.');
      }
      await requireAIService().setSecret(validatedProvider, validatedSecret);
      return { ok: true };
    }
  );

  ipcMain.handle('ai:deleteSecret', async (_event, provider: unknown) => {
    const { provider: validatedProvider } = validateSecretOperation(provider);
    await requireAIService().deleteSecret(validatedProvider);
    return { ok: true };
  });

  ipcMain.handle('ai:listAuditLog', async () => {
    return requireAIService().listAuditLog();
  });

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
