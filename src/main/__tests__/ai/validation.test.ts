import { describe, it, expect } from 'vitest';
import {
  validateProviderId,
  validateEndpoint,
  validateModel,
  validateBoolean,
  validatePrompt,
  validateMaxTokens,
  validateTimeoutMs,
  validateSettings,
  validateGenerateTextInput,
  validateGenerateJSONInput,
  validateSecretOperation,
  ValidationError,
  MAX_TIMEOUT_MS,
} from '../../ai/validation.js';

describe('validation', () => {
  describe('validateProviderId', () => {
    it('accepts ollama', () => {
      expect(validateProviderId('ollama')).toBe('ollama');
    });

    it('accepts openai-compatible', () => {
      expect(validateProviderId('openai-compatible')).toBe(
        'openai-compatible'
      );
    });

    it('rejects invalid provider IDs', () => {
      expect(() => validateProviderId('unknown')).toThrow(ValidationError);
      expect(() => validateProviderId('')).toThrow(ValidationError);
      expect(() => validateProviderId(null)).toThrow(ValidationError);
      expect(() => validateProviderId(123)).toThrow(ValidationError);
    });
  });

  describe('validateEndpoint', () => {
    it('accepts valid http URLs', () => {
      expect(validateEndpoint('http://localhost:11434', 'test')).toBe(
        'http://localhost:11434'
      );
    });

    it('accepts valid https URLs', () => {
      expect(validateEndpoint('https://api.example.com/v1', 'test')).toBe(
        'https://api.example.com/v1'
      );
    });

    it('rejects invalid endpoints', () => {
      expect(() => validateEndpoint('', 'test')).toThrow(ValidationError);
      expect(() => validateEndpoint('ftp://example.com', 'test')).toThrow(
        ValidationError
      );
      expect(() => validateEndpoint('not-a-url', 'test')).toThrow(
        ValidationError
      );
      expect(() => validateEndpoint(null, 'test')).toThrow(ValidationError);
    });
  });

  describe('validateModel', () => {
    it('accepts valid model names', () => {
      expect(validateModel('llama3.1', 'model')).toBe('llama3.1');
    });

    it('rejects empty or non-string models', () => {
      expect(() => validateModel('', 'model')).toThrow(ValidationError);
      expect(() => validateModel(null, 'model')).toThrow(ValidationError);
    });

    it('rejects overly long model names', () => {
      expect(() => validateModel('x'.repeat(257), 'model')).toThrow(
        ValidationError
      );
    });
  });

  describe('validateBoolean', () => {
    it('accepts booleans', () => {
      expect(validateBoolean(true, 'flag')).toBe(true);
      expect(validateBoolean(false, 'flag')).toBe(false);
    });

    it('rejects non-booleans', () => {
      expect(() => validateBoolean('true', 'flag')).toThrow(ValidationError);
      expect(() => validateBoolean(1, 'flag')).toThrow(ValidationError);
      expect(() => validateBoolean(null, 'flag')).toThrow(ValidationError);
    });
  });

  describe('validatePrompt', () => {
    it('accepts non-empty strings', () => {
      expect(validatePrompt('hello', 'prompt')).toBe('hello');
    });

    it('rejects empty or non-string prompts', () => {
      expect(() => validatePrompt('', 'prompt')).toThrow(ValidationError);
      expect(() => validatePrompt(null, 'prompt')).toThrow(ValidationError);
    });

    it('rejects overly long prompts', () => {
      expect(() => validatePrompt('x'.repeat(100001), 'prompt')).toThrow(
        ValidationError
      );
    });
  });

  describe('validateMaxTokens', () => {
    it('accepts valid token counts', () => {
      expect(validateMaxTokens(100)).toBe(100);
      expect(validateMaxTokens(1)).toBe(1);
    });

    it('accepts undefined/null', () => {
      expect(validateMaxTokens(undefined)).toBeUndefined();
      expect(validateMaxTokens(null)).toBeUndefined();
    });

    it('rejects invalid values', () => {
      expect(() => validateMaxTokens(0)).toThrow(ValidationError);
      expect(() => validateMaxTokens(-1)).toThrow(ValidationError);
      expect(() => validateMaxTokens(1.5)).toThrow(ValidationError);
      expect(() => validateMaxTokens('100')).toThrow(ValidationError);
    });
  });

  describe('validateTimeoutMs', () => {
    it('returns default for undefined/null', () => {
      expect(validateTimeoutMs(undefined)).toBe(30000);
      expect(validateTimeoutMs(null)).toBe(30000);
    });

    it('caps at MAX_TIMEOUT_MS', () => {
      expect(validateTimeoutMs(MAX_TIMEOUT_MS + 1)).toBe(MAX_TIMEOUT_MS);
      expect(validateTimeoutMs(999999)).toBe(MAX_TIMEOUT_MS);
    });

    it('accepts values within range', () => {
      expect(validateTimeoutMs(5000)).toBe(5000);
      expect(validateTimeoutMs(MAX_TIMEOUT_MS)).toBe(MAX_TIMEOUT_MS);
    });

    it('rejects invalid values', () => {
      expect(() => validateTimeoutMs(0)).toThrow(ValidationError);
      expect(() => validateTimeoutMs(-1)).toThrow(ValidationError);
      expect(() => validateTimeoutMs('5000')).toThrow(ValidationError);
    });
  });

  describe('validateSettings', () => {
    it('accepts empty object', () => {
      expect(validateSettings({})).toEqual({});
    });

    it('accepts all known fields', () => {
      const result = validateSettings({
        provider: 'ollama',
        ollamaEndpoint: 'http://localhost:11434',
        ollamaModel: 'llama3.1',
        openaiCompatibleEndpoint: 'https://api.example.com/v1',
        openaiCompatibleModel: 'gpt-4',
        allowCloud: false,
      });
      expect(result.provider).toBe('ollama');
      expect(result.allowCloud).toBe(false);
    });

    it('rejects unknown fields', () => {
      expect(() =>
        validateSettings({ provider: 'ollama', unknownField: 'x' })
      ).toThrow(ValidationError);
    });

    it('rejects non-objects', () => {
      expect(() => validateSettings(null)).toThrow(ValidationError);
      expect(() => validateSettings('string')).toThrow(ValidationError);
      expect(() => validateSettings(123)).toThrow(ValidationError);
    });

    it('rejects invalid field values', () => {
      expect(() =>
        validateSettings({ provider: 'invalid-provider' })
      ).toThrow(ValidationError);
      expect(() =>
        validateSettings({ ollamaEndpoint: 'ftp://bad' })
      ).toThrow(ValidationError);
      expect(() =>
        validateSettings({ allowCloud: 'yes' })
      ).toThrow(ValidationError);
    });
  });

  describe('validateGenerateTextInput', () => {
    it('accepts valid input', () => {
      const result = validateGenerateTextInput({
        systemPrompt: 'sys',
        userPrompt: 'user',
      });
      expect(result.systemPrompt).toBe('sys');
      expect(result.userPrompt).toBe('user');
    });

    it('rejects missing fields', () => {
      expect(() =>
        validateGenerateTextInput({ userPrompt: 'user' })
      ).toThrow(ValidationError);
      expect(() =>
        validateGenerateTextInput({ systemPrompt: 'sys' })
      ).toThrow(ValidationError);
    });

    it('rejects non-objects', () => {
      expect(() => validateGenerateTextInput(null)).toThrow(ValidationError);
      expect(() => validateGenerateTextInput('string')).toThrow(
        ValidationError
      );
    });
  });

  describe('validateGenerateJSONInput', () => {
    it('accepts valid input', () => {
      const result = validateGenerateJSONInput({
        systemPrompt: 'sys',
        userPrompt: 'user',
        schema: { type: 'object' },
      });
      expect(result.systemPrompt).toBe('sys');
      expect(result.userPrompt).toBe('user');
      expect(result.schema).toEqual({ type: 'object' });
    });

    it('rejects missing fields', () => {
      expect(() =>
        validateGenerateJSONInput({ userPrompt: 'user', schema: {} })
      ).toThrow(ValidationError);
    });

    it('rejects non-objects', () => {
      expect(() => validateGenerateJSONInput(null)).toThrow(ValidationError);
    });
  });

  describe('validateSecretOperation', () => {
    it('accepts valid provider and secret', () => {
      const result = validateSecretOperation('ollama', 'my-secret');
      expect(result.provider).toBe('ollama');
      expect(result.secret).toBe('my-secret');
    });

    it('accepts provider without secret', () => {
      const result = validateSecretOperation('openai-compatible');
      expect(result.provider).toBe('openai-compatible');
      expect(result.secret).toBeUndefined();
    });

    it('rejects invalid provider', () => {
      expect(() => validateSecretOperation('bad')).toThrow(ValidationError);
    });

    it('rejects invalid secret', () => {
      expect(() => validateSecretOperation('ollama', '')).toThrow(
        ValidationError
      );
      expect(() => validateSecretOperation('ollama', null)).toThrow(
        ValidationError
      );
    });
  });
});
