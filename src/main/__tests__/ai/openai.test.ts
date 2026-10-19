import { describe, it, expect } from 'vitest';
import { OpenAICompatibleProvider } from '../../ai/openai.js';
import type { GenerateTextInput } from '../../ai/types.js';

describe('OpenAICompatibleProvider (stub)', () => {
  it('is never available (stub)', async () => {
    const provider = new OpenAICompatibleProvider();
    expect(await provider.isAvailable()).toBe(false);
    expect(provider.localOnly).toBe(false);
    expect(provider.id).toBe('openai-compatible');
  });

  it('throws not-configured on generateText', async () => {
    const provider = new OpenAICompatibleProvider();
    await expect(
      provider.generateText({
        systemPrompt: 'sys',
        userPrompt: 'user',
      } as GenerateTextInput)
    ).rejects.toMatchObject({ code: 'not-configured', retryable: false });
  });

  it('throws not-configured on generateJSON', async () => {
    const provider = new OpenAICompatibleProvider();
    await expect(
      provider.generateJSON<{ score: number }>({
        systemPrompt: 'sys',
        userPrompt: 'user',
        schema: { type: 'object' },
      })
    ).rejects.toMatchObject({ code: 'not-configured', retryable: false });
  });
});
