import type {
  GenerateJSONInput,
  GenerateJSONResult,
  GenerateTextInput,
  GenerateTextResult,
  LLMProvider,
  ProviderError,
  ProviderId,
} from './types.js';

export class OllamaProvider implements LLMProvider {
  readonly id: ProviderId = 'ollama';
  readonly name = 'Ollama (local)';
  readonly localOnly = true;

  private readonly endpoint: string;
  private readonly model: string;
  private readonly fetchImpl: typeof fetch;

  constructor(endpoint: string, model: string, fetchImpl?: typeof fetch) {
    this.endpoint = endpoint.endsWith('/')
      ? endpoint.slice(0, -1)
      : endpoint;
    this.model = model;
    this.fetchImpl = fetchImpl ?? fetch;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await this.fetchImpl(`${this.endpoint}/api/tags`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return response.ok;
    } catch {
      return false;
    }
  }

  async generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
    const response = await this.callChatApi(input, false);
    const content = this.extractMessageContent(response);
    return {
      text: content,
      provider: this.id,
      model: this.model,
    };
  }

  async generateJSON<T>(
    input: GenerateJSONInput
  ): Promise<GenerateJSONResult<T>> {
    const response = await this.callChatApi(input, true);
    const content = this.extractMessageContent(response);

    let parsed: T;
    try {
      parsed = JSON.parse(content) as T;
    } catch (error) {
      throw this.makeError(
        'malformed-response',
        `Model returned invalid JSON: ${(error as Error).message}`,
        false
      );
    }

    return {
      data: parsed,
      provider: this.id,
      model: this.model,
    };
  }

  private async callChatApi(
    input: GenerateTextInput | GenerateJSONInput,
    expectJson: boolean
  ): Promise<unknown> {
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    if (input.signal) {
      input.signal.addEventListener(
        'abort',
        () => controller.abort(),
        { once: true }
      );
    }

    const MAX_TIMEOUT_MS = 120000;
    const DEFAULT_TIMEOUT_MS = 30000;

    let timeoutMs: number;
    if (input.maxTokens) {
      timeoutMs = Math.min(input.maxTokens * 20, MAX_TIMEOUT_MS);
    } else {
      timeoutMs = DEFAULT_TIMEOUT_MS;
    }
    timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const body = {
        model: this.model,
        messages: [
          { role: 'system', content: input.systemPrompt },
          { role: 'user', content: input.userPrompt },
        ],
        stream: false,
        format: expectJson ? 'json' : '',
        options: {
          temperature: input.temperature ?? 0.7,
          num_predict: input.maxTokens,
        },
      };

      const response = await this.fetchImpl(`${this.endpoint}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw this.makeError(
          'http-error',
          `Ollama HTTP ${response.status}`,
          response.status >= 500
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw this.makeError(
          input.signal?.aborted ? 'cancelled' : 'timeout',
          input.signal?.aborted ? 'Request cancelled' : 'Request timed out',
          false
        );
      }
      if (error && typeof error === 'object' && 'code' in error) {
        throw error;
      }
      throw this.makeError(
        'connection-refused',
        (error as Error)?.message ?? 'Unknown Ollama error',
        true
      );
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  private extractMessageContent(response: unknown): string {
    if (!response || typeof response !== 'object') {
      throw this.makeError(
        'malformed-response',
        'Ollama returned a non-object response',
        false
      );
    }

    const obj = response as Record<string, unknown>;
    const message = obj.message;
    if (!message || typeof message !== 'object') {
      throw this.makeError(
        'malformed-response',
        'Ollama response missing message object',
        false
      );
    }

    const content = (message as Record<string, unknown>).content;
    if (typeof content !== 'string') {
      throw this.makeError(
        'malformed-response',
        'Ollama response content is not a string',
        false
      );
    }

    return content;
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
