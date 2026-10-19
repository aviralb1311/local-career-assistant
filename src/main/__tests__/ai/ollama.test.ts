import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OllamaProvider } from '../../ai/ollama.js';

describe('OllamaProvider', () => {
  let fetchImpl: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchImpl = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is available when /api/tags returns ok', async () => {
    fetchImpl.mockResolvedValue(new Response(JSON.stringify({ models: [] }), { status: 200 }));
    const provider = new OllamaProvider('http://localhost:11434', 'llama3.1', fetchImpl as typeof fetch);
    expect(await provider.isAvailable()).toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith('http://localhost:11434/api/tags', expect.any(Object));
  });

  it('is unavailable when server refuses connection', async () => {
    const err = new Error('connect ECONNREFUSED') as Error & { code: string };
    err.code = 'ECONNREFUSED';
    fetchImpl.mockRejectedValue(err);
    const provider = new OllamaProvider('http://localhost:11434', 'llama3.1', fetchImpl as typeof fetch);
    expect(await provider.isAvailable()).toBe(false);
  });

  it('generates text successfully', async () => {
    fetchImpl.mockResolvedValue(
      new Response(
        JSON.stringify({
          model: 'llama3.1',
          message: { role: 'assistant', content: 'The candidate is a strong match.' },
        }),
        { status: 200 }
      )
    );
    const provider = new OllamaProvider('http://localhost:11434', 'llama3.1', fetchImpl as typeof fetch);
    const result = await provider.generateText({
      systemPrompt: 'You are an evaluator.',
      userPrompt: 'Evaluate this job.',
    });
    expect(result.text).toBe('The candidate is a strong match.');
    expect(result.provider).toBe('ollama');
    expect(result.model).toBe('llama3.1');
  });

  it('throws malformed-response when content is missing', async () => {
    fetchImpl.mockResolvedValue(
      new Response(JSON.stringify({ model: 'llama3.1' }), { status: 200 })
    );
    const provider = new OllamaProvider('http://localhost:11434', 'llama3.1', fetchImpl as typeof fetch);
    await expect(
      provider.generateText({
        systemPrompt: 'sys',
        userPrompt: 'user',
      })
    ).rejects.toMatchObject({ code: 'malformed-response' });
  });

  it('throws http-error on non-ok response', async () => {
    fetchImpl.mockResolvedValue(new Response('Internal Server Error', { status: 500 }));
    const provider = new OllamaProvider('http://localhost:11434', 'llama3.1', fetchImpl as typeof fetch);
    await expect(
      provider.generateText({
        systemPrompt: 'sys',
        userPrompt: 'user',
      })
    ).rejects.toMatchObject({ code: 'http-error', retryable: true });
  });

  it('generates JSON successfully', async () => {
    fetchImpl.mockResolvedValue(
      new Response(
        JSON.stringify({
          model: 'llama3.1',
          message: { role: 'assistant', content: JSON.stringify({ score: 85, verdict: 'strong' }) },
        }),
        { status: 200 }
      )
    );
    const provider = new OllamaProvider('http://localhost:11434', 'llama3.1', fetchImpl as typeof fetch);
    const result = await provider.generateJSON<{ score: number; verdict: string }>({
      systemPrompt: 'Return JSON.',
      userPrompt: 'Evaluate.',
      schema: { type: 'object' },
    });
    expect(result.data).toEqual({ score: 85, verdict: 'strong' });
    expect(result.provider).toBe('ollama');
  });

  it('throws malformed-response when JSON is invalid', async () => {
    fetchImpl.mockResolvedValue(
      new Response(
        JSON.stringify({
          model: 'llama3.1',
          message: { role: 'assistant', content: 'not valid json {{{' },
        }),
        { status: 200 }
      )
    );
    const provider = new OllamaProvider('http://localhost:11434', 'llama3.1', fetchImpl as typeof fetch);
    await expect(
      provider.generateJSON<{ score: number }>({
        systemPrompt: 'Return JSON.',
        userPrompt: 'Evaluate.',
        schema: { type: 'object' },
      })
    ).rejects.toMatchObject({ code: 'malformed-response' });
  });

  it('supports cancellation via AbortSignal', async () => {
    const controller = new AbortController();
    let abortHandler: (() => void) | null = null;
    fetchImpl.mockImplementation(() => {
      return new Promise<Response>((_resolve, reject) => {
        abortHandler = () => reject(new DOMException('aborted', 'AbortError'));
        controller.signal.addEventListener('abort', abortHandler!, { once: true });
      });
    });
    const provider = new OllamaProvider('http://localhost:11434', 'llama3.1', fetchImpl as typeof fetch);
    const promise = provider.generateText({
      systemPrompt: 'sys',
      userPrompt: 'user',
      signal: controller.signal,
    });
    controller.abort();
    await expect(promise).rejects.toMatchObject({ code: 'cancelled' });
  });

  it('normalizes endpoint with trailing slash', async () => {
    fetchImpl.mockResolvedValue(
      new Response(JSON.stringify({ models: [] }), { status: 200 })
    );
    const provider = new OllamaProvider('http://localhost:11434/', 'llama3.1', fetchImpl as typeof fetch);
    await provider.isAvailable();
    expect(fetchImpl).toHaveBeenCalledWith('http://localhost:11434/api/tags', expect.any(Object));
  });

  it('caps timeout at 120000ms regardless of maxTokens', async () => {
    fetchImpl.mockImplementation((_url, opts) => {
      return new Promise<Response>((_resolve, reject) => {
        const signal = (opts as { signal?: AbortSignal }).signal;
        if (signal) {
          signal.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'));
          }, { once: true });
        }
      });
    });
    const provider = new OllamaProvider('http://localhost:11434', 'llama3.1', fetchImpl as typeof fetch);

    await expect(
      provider.generateText({
        systemPrompt: 'sys',
        userPrompt: 'user',
        maxTokens: 1,
      })
    ).rejects.toMatchObject({ code: 'timeout' });
  });
});
