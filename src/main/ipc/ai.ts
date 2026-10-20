import type { AIService } from '../ai/service.js';
import {
  validateGenerateJSONInput,
  validateGenerateTextInput,
  validateSecretOperation,
  validateSettings,
  ValidationError,
} from '../ai/validation.js';

function sanitizeErrorMessage(message: string): string {
  return message.replace(/\/[^\s]*/g, '[path]').replace(/[A-Za-z]:\\[^\s]*/g, '[path]');
}

export function safeProviderError(error: unknown): Error {
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

  return new Error('An unexpected error occurred during AI processing.');
}

export interface IpcRegistrar {
  handle(channel: string, listener: (...args: unknown[]) => unknown): void;
}

export function registerAIHandlers(
  ipcMainLike: IpcRegistrar,
  getService: () => AIService
): void {
  ipcMainLike.handle('ai:providers', async () => {
    return getService().getProviderInfo();
  });

  ipcMainLike.handle('ai:getSettings', async () => {
    return getService().getSettings();
  });

  ipcMainLike.handle('ai:setSettings', async (_event, partial: unknown) => {
    const validated = validateSettings(partial);
    return getService().setSettings(validated);
  });

  ipcMainLike.handle('ai:isCloudAllowed', async () => {
    return getService().isCloudAllowed();
  });

  ipcMainLike.handle(
    'ai:requireConsent',
    async (_event, action: unknown, dataCategories: unknown) => {
      if (typeof action !== 'string' || !action) {
        throw new ValidationError('Invalid action: must be a non-empty string.');
      }
      if (
        !Array.isArray(dataCategories) ||
        !dataCategories.every((c) => typeof c === 'string' && c)
      ) {
        throw new ValidationError(
          'Invalid dataCategories: must be an array of non-empty strings.'
        );
      }
      return getService().requireConsent(action, dataCategories);
    }
  );

  ipcMainLike.handle(
    'ai:grantConsent',
    async (_event, action: unknown, dataCategories: unknown) => {
      if (typeof action !== 'string' || !action) {
        throw new ValidationError('Invalid action: must be a non-empty string.');
      }
      if (
        !Array.isArray(dataCategories) ||
        !dataCategories.every((c) => typeof c === 'string' && c)
      ) {
        throw new ValidationError(
          'Invalid dataCategories: must be an array of non-empty strings.'
        );
      }
      await getService().grantConsent(action, dataCategories);
      return { ok: true };
    }
  );

  ipcMainLike.handle(
    'ai:denyConsent',
    async (_event, action: unknown, dataCategories: unknown) => {
      if (typeof action !== 'string' || !action) {
        throw new ValidationError('Invalid action: must be a non-empty string.');
      }
      if (
        !Array.isArray(dataCategories) ||
        !dataCategories.every((c) => typeof c === 'string' && c)
      ) {
        throw new ValidationError(
          'Invalid dataCategories: must be an array of non-empty strings.'
        );
      }
      await getService().denyConsent(action, dataCategories);
      return { ok: true };
    }
  );

  ipcMainLike.handle(
    'ai:generateText',
    async (_event, input: unknown) => {
      const validated = validateGenerateTextInput(input);
      try {
        return await getService().generateText(validated);
      } catch (error) {
        throw safeProviderError(error);
      }
    }
  );

  ipcMainLike.handle(
    'ai:generateJSON',
    async (_event, input: unknown) => {
      const validated = validateGenerateJSONInput(input);
      try {
        return await getService().generateJSON(validated);
      } catch (error) {
        throw safeProviderError(error);
      }
    }
  );

  ipcMainLike.handle(
    'ai:setSecret',
    async (_event, provider: unknown, secret: unknown) => {
      const { provider: validatedProvider, secret: validatedSecret } =
        validateSecretOperation(provider, secret);
      if (validatedSecret === undefined) {
        throw new ValidationError('Invalid secret: must be a non-empty string.');
      }
      await getService().setSecret(validatedProvider, validatedSecret);
      return { ok: true };
    }
  );

  ipcMainLike.handle('ai:deleteSecret', async (_event, provider: unknown) => {
    const { provider: validatedProvider } = validateSecretOperation(provider);
    await getService().deleteSecret(validatedProvider);
    return { ok: true };
  });

  ipcMainLike.handle('ai:listAuditLog', async () => {
    return getService().listAuditLog();
  });
}
