import { describe, it, expect, vi } from 'vitest';
import { registerAIHandlers } from '../../ipc/ai.js';

function makeRegistrar() {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  return {
    handle: (channel: string, fn: (...args: unknown[]) => unknown) => {
      handlers.set(channel, fn);
    },
    invoke: async (channel: string, ...args: unknown[]) => {
      const fn = handlers.get(channel);
      if (!fn) throw new Error('no handler');
      return fn({}, ...args);
    },
    handlers,
  };
}

describe('AI IPC handlers', () => {
  it('rejects invalid inputs and unknown fields', async () => {
    const reg = makeRegistrar();
    const service = { generateText: vi.fn() } as any;
    registerAIHandlers(reg, () => service);
    await expect(reg.invoke('ai:generateText', null)).rejects.toThrow();
    await expect(
      reg.invoke('ai:generateText', { systemPrompt: 's', userPrompt: 'u', foo: 1 })
    ).rejects.toThrow();
  });

  it('blocks cloud generation without consent', async () => {
    const reg = makeRegistrar();
    const service = {
      getSettings: vi.fn().mockResolvedValue({ provider: 'openai-compatible' }),
      requireConsent: vi.fn().mockResolvedValue(false),
      generateText: vi.fn().mockImplementation(async () => {
        const c = await service.requireConsent('ai:generate-text', ['candidate-profile', 'job-description']);
        if (!c) throw new Error('Cloud AI requires explicit consent before sending personal data.');
        return { text: 'ok', provider: 'openai-compatible', model: 'm' };
      }),
    } as any;
    registerAIHandlers(reg, () => service);
    await expect(
      reg.invoke('ai:generateText', { systemPrompt: 's', userPrompt: 'u' })
    ).rejects.toThrow();
  });

  it('blocks cloud generation after consent revoked', async () => {
    const reg = makeRegistrar();
    const service = {
      getSettings: vi.fn().mockResolvedValue({ provider: 'openai-compatible' }),
      requireConsent: vi.fn().mockResolvedValue(false),
      generateText: vi.fn().mockImplementation(async () => {
        const c = await service.requireConsent('ai:generate-text', ['candidate-profile', 'job-description']);
        if (!c) throw new Error('Cloud AI requires explicit consent before sending personal data.');
        return { text: 'ok', provider: 'openai-compatible', model: 'm' };
      }),
    } as any;
    registerAIHandlers(reg, () => service);
    await expect(
      reg.invoke('ai:generateText', { systemPrompt: 's', userPrompt: 'u' })
    ).rejects.toThrow();
  });

  it('authorized generation reaches service', async () => {
    const reg = makeRegistrar();
    const service = {
      getSettings: vi.fn().mockResolvedValue({ provider: 'ollama' }),
      generateText: vi.fn().mockResolvedValue({ text: 'ok', provider: 'ollama', model: 'm' }),
    } as any;
    registerAIHandlers(reg, () => service);
    const r = await reg.invoke('ai:generateText', { systemPrompt: 's', userPrompt: 'u' });
    expect(r).toEqual({ text: 'ok', provider: 'ollama', model: 'm' });
    expect(service.generateText).toHaveBeenCalled();
  });

  it('sanitizes provider errors', async () => {
    const reg = makeRegistrar();
    const service = {
      getSettings: vi.fn().mockResolvedValue({ provider: 'ollama' }),
      generateText: vi.fn().mockRejectedValue(new Error('secret token leaked /tmp/x')),
    } as any;
    registerAIHandlers(reg, () => service);
    try {
      await reg.invoke('ai:generateText', { systemPrompt: 's', userPrompt: 'u' });
    } catch (e: any) {
      expect(e.message).not.toContain('secret token leaked');
      expect(e.message).not.toContain('/tmp/x');
    }
  });
});
