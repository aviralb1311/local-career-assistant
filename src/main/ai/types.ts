export type ProviderId = 'ollama' | 'openai-compatible';

export type ProviderStatus =
  | 'available'
  | 'unavailable'
  | 'not-configured'
  | 'error';

export interface ProviderInfo {
  id: ProviderId;
  name: string;
  localOnly: boolean;
  status: ProviderStatus;
  model?: string;
}

export interface GenerateTextInput {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface GenerateTextResult {
  text: string;
  provider: ProviderId;
  model: string;
}

export interface GenerateJSONInput {
  systemPrompt: string;
  userPrompt: string;
  schema: unknown;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface GenerateJSONResult<T = unknown> {
  data: T;
  provider: ProviderId;
  model: string;
}

export interface ProviderError extends Error {
  code: 'connection-refused' | 'http-error' | 'malformed-response' | 'timeout' | 'cancelled' | 'not-configured' | 'consent-required' | 'unknown';
  provider: ProviderId;
  retryable: boolean;
}

export interface ProviderSettings {
  provider: ProviderId;
  ollamaEndpoint: string;
  ollamaModel: string;
  openaiCompatibleEndpoint: string;
  openaiCompatibleModel: string;
  allowCloud: boolean;
}

export interface AuditLogEntry {
  id: number;
  action: string;
  provider: ProviderId | null;
  dataCategories: string[];
  userConsented: boolean;
  timestamp: string;
}

export interface LLMProvider {
  readonly id: ProviderId;
  readonly name: string;
  readonly localOnly: boolean;

  isAvailable(): Promise<boolean>;
  generateText(input: GenerateTextInput): Promise<GenerateTextResult>;
  generateJSON<T>(input: GenerateJSONInput): Promise<GenerateJSONResult<T>>;
}

export interface SettingsService {
  getSettings(): Promise<ProviderSettings>;
  setSettings(partial: Partial<ProviderSettings>): Promise<ProviderSettings>;
}

export interface AuditService {
  record(action: string, params: {
    provider: ProviderId | null;
    dataCategories: string[];
    userConsented: boolean;
  }): Promise<void>;
  list(): Promise<AuditLogEntry[]>;
}

export interface SecretsService {
  get(provider: ProviderId): Promise<string | null>;
  set(provider: ProviderId, secret: string): Promise<void>;
  delete(provider: ProviderId): Promise<void>;
}

export interface ConsentService {
  isCloudAllowed(): Promise<boolean>;
  requireConsent(action: string, dataCategories: string[]): Promise<boolean>;
  grantConsent(action: string, dataCategories: string[]): Promise<void>;
  denyConsent(action: string, dataCategories: string[]): Promise<void>;
}
