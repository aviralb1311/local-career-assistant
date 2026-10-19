import type {
  GenerateJSONInput,
  GenerateTextInput,
  ProviderId,
  ProviderSettings,
} from './types.js';

const MAX_TIMEOUT_MS = 120000;
const DEFAULT_TIMEOUT_MS = 30000;
const MAX_TOKENS = 4096;

export class ValidationError extends Error {
  readonly code = 'validation-error';
  readonly retryable = false;

  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isValidProviderId(value: unknown): value is ProviderId {
  return value === 'ollama' || value === 'openai-compatible';
}

function isValidEndpoint(value: unknown): boolean {
  if (!isNonEmptyString(value)) {
    return false;
  }
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isPositiveInteger(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value > 0
  );
}

export function validateProviderId(value: unknown): ProviderId {
  if (!isValidProviderId(value)) {
    throw new ValidationError(
      `Invalid provider ID: ${JSON.stringify(value)}. Expected 'ollama' or 'openai-compatible'.`
    );
  }
  return value;
}

export function validateEndpoint(value: unknown, fieldName: string): string {
  if (!isValidEndpoint(value)) {
    throw new ValidationError(
      `Invalid ${fieldName}: must be a valid http:// or https:// URL.`
    );
  }
  return value as string;
}

export function validateModel(value: unknown, fieldName: string): string {
  if (!isNonEmptyString(value)) {
    throw new ValidationError(`Invalid ${fieldName}: must be a non-empty string.`);
  }
  if (value.length > 256) {
    throw new ValidationError(`Invalid ${fieldName}: must not exceed 256 characters.`);
  }
  return value as string;
}

export function validateBoolean(value: unknown, fieldName: string): boolean {
  if (typeof value !== 'boolean') {
    throw new ValidationError(`Invalid ${fieldName}: must be a boolean.`);
  }
  return value;
}

export function validatePrompt(value: unknown, fieldName: string): string {
  if (!isNonEmptyString(value)) {
    throw new ValidationError(`Invalid ${fieldName}: must be a non-empty string.`);
  }
  if (value.length > 100000) {
    throw new ValidationError(
      `Invalid ${fieldName}: must not exceed 100,000 characters.`
    );
  }
  return value as string;
}

export function validateMaxTokens(value: unknown): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!isPositiveInteger(value)) {
    throw new ValidationError(
      'Invalid maxTokens: must be a positive integer.'
    );
  }
  if (value > MAX_TOKENS) {
    throw new ValidationError(
      `Invalid maxTokens: must not exceed ${MAX_TOKENS}.`
    );
  }
  return value;
}

export function validateTimeoutMs(value: unknown): number {
  if (value === undefined || value === null) {
    return DEFAULT_TIMEOUT_MS;
  }
  if (!isPositiveInteger(value)) {
    throw new ValidationError(
      'Invalid timeout: must be a positive integer.'
    );
  }
  return Math.min(value, MAX_TIMEOUT_MS);
}

export function validateSettings(
  partial: unknown
): Partial<ProviderSettings> {
  if (!partial || typeof partial !== 'object') {
    throw new ValidationError('Invalid settings: must be an object.');
  }

  const obj = partial as Record<string, unknown>;
  const validated: Partial<ProviderSettings> = {};

  if ('provider' in obj) {
    validated.provider = validateProviderId(obj.provider);
  }

  if ('ollamaEndpoint' in obj) {
    validated.ollamaEndpoint = validateEndpoint(
      obj.ollamaEndpoint,
      'ollamaEndpoint'
    );
  }

  if ('ollamaModel' in obj) {
    validated.ollamaModel = validateModel(obj.ollamaModel, 'ollamaModel');
  }

  if ('openaiCompatibleEndpoint' in obj) {
    validated.openaiCompatibleEndpoint = validateEndpoint(
      obj.openaiCompatibleEndpoint,
      'openaiCompatibleEndpoint'
    );
  }

  if ('openaiCompatibleModel' in obj) {
    validated.openaiCompatibleModel = validateModel(
      obj.openaiCompatibleModel,
      'openaiCompatibleModel'
    );
  }

  if ('allowCloud' in obj) {
    validated.allowCloud = validateBoolean(obj.allowCloud, 'allowCloud');
  }

  // Reject unknown fields.
  const knownFields = new Set([
    'provider',
    'ollamaEndpoint',
    'ollamaModel',
    'openaiCompatibleEndpoint',
    'openaiCompatibleModel',
    'allowCloud',
  ]);
  for (const key of Object.keys(obj)) {
    if (!knownFields.has(key)) {
      throw new ValidationError(
        `Unknown settings field: ${key}. Only known fields are permitted.`
      );
    }
  }

  return validated;
}

export function validateGenerateTextInput(
  input: unknown
): GenerateTextInput {
  if (!input || typeof input !== 'object') {
    throw new ValidationError('Invalid generateText input: must be an object.');
  }

  const obj = input as Record<string, unknown>;

  return {
    systemPrompt: validatePrompt(obj.systemPrompt, 'systemPrompt'),
    userPrompt: validatePrompt(obj.userPrompt, 'userPrompt'),
    temperature: validateTemperature(obj.temperature),
    maxTokens: validateMaxTokens(obj.maxTokens),
    signal: obj.signal as AbortSignal | undefined,
  };
}

export function validateGenerateJSONInput(
  input: unknown
): GenerateJSONInput {
  if (!input || typeof input !== 'object') {
    throw new ValidationError(
      'Invalid generateJSON input: must be an object.'
    );
  }

  const obj = input as Record<string, unknown>;

  return {
    systemPrompt: validatePrompt(obj.systemPrompt, 'systemPrompt'),
    userPrompt: validatePrompt(obj.userPrompt, 'userPrompt'),
    schema: obj.schema,
    temperature: validateTemperature(obj.temperature),
    maxTokens: validateMaxTokens(obj.maxTokens),
    signal: obj.signal as AbortSignal | undefined,
  };
}

function validateTemperature(value: unknown): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ValidationError(
      'Invalid temperature: must be a finite number.'
    );
  }
  if (value < 0 || value > 2) {
    throw new ValidationError(
      'Invalid temperature: must be between 0 and 2.'
    );
  }
  return value;
}

export function validateSecretOperation(
  provider: unknown,
  secret?: unknown
): { provider: ProviderId; secret?: string } {
  const validatedProvider = validateProviderId(provider);

  if (secret !== undefined) {
    if (!isNonEmptyString(secret)) {
      throw new ValidationError(
        'Invalid secret: must be a non-empty string.'
      );
    }
    if (secret.length > 4096) {
      throw new ValidationError(
        'Invalid secret: must not exceed 4,096 characters.'
      );
    }
  }

  return { provider: validatedProvider, secret: secret as string | undefined };
}

export { MAX_TIMEOUT_MS, DEFAULT_TIMEOUT_MS };
