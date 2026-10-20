import type {
  GenerateJSONInput,
  GenerateJSONResult,
  GenerateTextInput,
  GenerateTextResult,
  LLMProvider,
  ProviderError,
  ProviderId,
} from './types.js';

/**
 * OpenAI-compatible provider STUB.
 *
 * This is intentionally a stub: it implements the LLMProvider interface but
 * does not make any network calls and is not verified against real
 * OpenAI-compatible services. isAvailable() always returns false, and
 * generateText()/generateJSON() throw a not-configured error. Cloud AI
 * remains disabled by default and requires explicit per-action consent
 * before any personal data is transmitted.
 */
export class OpenAICompatibleProvider implements LLMProvider {
  readonly id: ProviderId = 'openai-compatible';
  readonly name = 'OpenAI-compatible (cloud)';
  readonly localOnly = false;

  constructor() {}

  async isAvailable(): Promise<boolean> {
    // Stub: never claim availability without explicit verification.
    return false;
  }

  async generateText(_input: GenerateTextInput): Promise<GenerateTextResult> {
    throw this.makeError(
      'not-configured',
      'OpenAI-compatible provider is not configured or available. Cloud AI requires explicit per-action consent.',
      false
    );
  }

  async generateJSON<T>(_input: GenerateJSONInput): Promise<GenerateJSONResult<T>> {
    throw this.makeError(
      'not-configured',
      'OpenAI-compatible provider is not configured or available. Cloud AI requires explicit per-action consent.',
      false
    );
  }

  private makeError(
    code: ProviderError['code'],
    message: string,
    retryable: boolean
  ): ProviderError {
    const err = new Error(message) as ProviderError;
    err.code = code;
    err.provider = this.id;
    err.retryable = retryable;
    return err;
  }
}
