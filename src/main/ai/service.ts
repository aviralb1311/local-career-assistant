import type { DbConnection } from '../db.js';
import type {
  AuditLogEntry,
  GenerateJSONInput,
  GenerateJSONResult,
  GenerateTextInput,
  GenerateTextResult,
  ProviderError,
  ProviderId,
  ProviderInfo,
  ProviderSettings,
} from './types.js';
import { OllamaProvider } from './ollama.js';
import { OpenAICompatibleProvider } from './openai.js';
import { createAuditService, createConsentService } from './consent.js';
import { createSecretsService } from './secrets.js';

const DEFAULT_SETTINGS: ProviderSettings = {
  provider: 'ollama',
  ollamaEndpoint: 'http://localhost:11434',
  ollamaModel: 'llama3.1',
  openaiCompatibleEndpoint: 'http://localhost:11434/v1',
  openaiCompatibleModel: '',
  allowCloud: false,
};

const SETTINGS_KEY = 'provider_settings';
const ALLOW_CLOUD_KEY = 'allow_cloud';

export class AIService {
  private readonly db: DbConnection;
  private readonly auditService;
  private readonly consentService;
  private readonly secretsService;
  private providerCache: Map<ProviderId, import('./types.js').LLMProvider> =
    new Map();

  constructor(db: DbConnection) {
    this.db = db;
    this.auditService = createAuditService(db);
    this.consentService = createConsentService(db);
    this.secretsService = createSecretsService();
  }

  async getProviderInfo(): Promise<ProviderInfo[]> {
    const settings = await this.getSettings();
    const providers: ProviderInfo[] = [
      {
        id: 'ollama',
        name: 'Ollama (local)',
        localOnly: true,
        status: 'not-configured',
        model: settings.ollamaModel,
      },
      {
        id: 'openai-compatible',
        name: 'OpenAI-compatible (cloud)',
        localOnly: false,
        status: 'not-configured',
        model: settings.openaiCompatibleModel,
      },
    ];

    // Actually probe Ollama availability instead of assuming it from config.
    if (!settings.ollamaEndpoint) {
      providers[0].status = 'not-configured';
    } else {
      const ollama = new OllamaProvider(settings.ollamaEndpoint, settings.ollamaModel);
      providers[0].status = (await ollama.isAvailable()) ? 'available' : 'unavailable';
    }

    if (settings.provider === 'openai-compatible' && !settings.allowCloud) {
      providers[1].status = 'unavailable';
    } else if (settings.provider === 'openai-compatible') {
      providers[1].status = 'not-configured';
    }

    return providers;
  }

  async getSettings(): Promise<ProviderSettings> {
    const row = this.db
      .prepare(`SELECT value FROM settings WHERE key = ?`)
      .get(SETTINGS_KEY) as { value: string } | undefined;

    if (!row) {
      return { ...DEFAULT_SETTINGS };
    }

    try {
      const parsed = JSON.parse(row.value) as Partial<ProviderSettings>;
      return { ...DEFAULT_SETTINGS, ...parsed };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  async setSettings(partial: Partial<ProviderSettings>): Promise<ProviderSettings> {
    const current = await this.getSettings();
    const updated = { ...current, ...partial };
    const db = this.db;
    db.prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    ).run(SETTINGS_KEY, JSON.stringify(updated));
    // Mirror allowCloud to the dedicated consent key so SqliteConsentService can read it.
    if ('allowCloud' in partial) {
      db.prepare(
        `INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`
      ).run(ALLOW_CLOUD_KEY, String(!!partial.allowCloud));
    }
    // Invalidate provider cache so new settings take effect.
    this.providerCache.clear();
    return updated;
  }

  async isCloudAllowed(): Promise<boolean> {
    return this.consentService.isCloudAllowed();
  }

  async requireConsent(action: string, dataCategories: string[]): Promise<boolean> {
    return this.consentService.requireConsent(action, dataCategories);
  }

  async grantConsent(action: string, dataCategories: string[]): Promise<void> {
    await this.consentService.grantConsent(action, dataCategories);
  }

  async denyConsent(action: string, dataCategories: string[]): Promise<void> {
    await this.consentService.denyConsent(action, dataCategories);
  }

  async listAuditLog(): Promise<AuditLogEntry[]> {
    return this.auditService.list();
  }

  private getProvider(providerId: ProviderId): import('./types.js').LLMProvider {
    const cached = this.providerCache.get(providerId);
    if (cached) {
      return cached;
    }

    const settings = this.getSettingsSync();
    let provider: import('./types.js').LLMProvider;

    if (providerId === 'ollama') {
      provider = new OllamaProvider(
        settings.ollamaEndpoint,
        settings.ollamaModel
      );
    } else {
      provider = new OpenAICompatibleProvider();
    }

    this.providerCache.set(providerId, provider);
    return provider;
  }

  private getSettingsSync(): ProviderSettings {
    const row = this.db
      .prepare(`SELECT value FROM settings WHERE key = ?`)
      .get(SETTINGS_KEY) as { value: string } | undefined;

    if (!row) {
      return { ...DEFAULT_SETTINGS };
    }

    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(row.value) } as ProviderSettings;
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  private sanitizeError(error: unknown): ProviderError {
    // Map any provider error to a safe allow-list code and generic message.
    // Never forward arbitrary provider messages, credentials, prompt content,
    // or sensitive URLs to the renderer.
    const safeCodes: ProviderError['code'][] = [
      'connection-refused',
      'http-error',
      'malformed-response',
      'timeout',
      'cancelled',
      'not-configured',
      'consent-required',
      'unknown',
    ];

    let code: ProviderError['code'] = 'unknown';
    let retryable = false;
    let provider: ProviderId = 'ollama';

    if (error && typeof error === 'object') {
      const err = error as Record<string, unknown>;
      const errCode = err.code;
      if (safeCodes.includes(errCode as ProviderError['code'])) {
        code = errCode as ProviderError['code'];
      }
      if (typeof err.retryable === 'boolean') {
        retryable = err.retryable;
      }
      if (typeof err.provider === 'string') {
        const p = err.provider;
        if (p === 'ollama' || p === 'openai-compatible') {
          provider = p as ProviderId;
        }
      }
    }

    const genericMessages: Record<ProviderError['code'], string> = {
      'connection-refused': 'Unable to connect to the AI provider.',
      'http-error': 'The AI provider returned an error response.',
      'malformed-response': 'The AI provider returned an invalid response.',
      timeout: 'The AI provider request timed out.',
      cancelled: 'The AI provider request was cancelled.',
      'not-configured': 'The AI provider is not configured.',
      'consent-required':
        'Cloud AI requires explicit consent before sending personal data.',
      unknown: 'An unexpected error occurred.',
    };

    return {
      name: 'Error',
      message: genericMessages[code],
      code,
      provider,
      retryable,
      stack: undefined,
    };
  }

  async generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
    const settings = await this.getSettings();
    const providerId = settings.provider;

    // Cloud providers require explicit per-action consent.
    if (providerId === 'openai-compatible') {
      const consented = await this.requireConsent(
        'ai:generate-text',
        ['candidate-profile', 'job-description']
      );
      if (!consented) {
        throw this.sanitizeError({
          name: 'Error',
          message: 'Cloud AI requires explicit consent before sending personal data.',
          code: 'consent-required',
          provider: 'openai-compatible',
          retryable: false,
        } as ProviderError);
      }
    }

    const provider = this.getProvider(providerId);
    try {
      return await provider.generateText(input);
    } catch (error) {
      throw this.sanitizeError(error);
    }
  }

  async generateJSON<T>(
    input: GenerateJSONInput
  ): Promise<GenerateJSONResult<T>> {
    const settings = await this.getSettings();
    const providerId = settings.provider;

    if (providerId === 'openai-compatible') {
      const consented = await this.requireConsent(
        'ai:generate-json',
        ['candidate-profile', 'job-description']
      );
      if (!consented) {
        throw this.sanitizeError({
          name: 'Error',
          message: 'Cloud AI requires explicit consent before sending personal data.',
          code: 'consent-required',
          provider: 'openai-compatible',
          retryable: false,
        } as ProviderError);
      }
    }

    const provider = this.getProvider(providerId);
    try {
      return await provider.generateJSON<T>(input);
    } catch (error) {
      throw this.sanitizeError(error);
    }
  }

  async setSecret(provider: ProviderId, secret: string): Promise<void> {
    await this.secretsService.set(provider, secret);
  }

  async getSecret(provider: ProviderId): Promise<string | null> {
    return this.secretsService.get(provider);
  }

  async deleteSecret(provider: ProviderId): Promise<void> {
    await this.secretsService.delete(provider);
  }
}
