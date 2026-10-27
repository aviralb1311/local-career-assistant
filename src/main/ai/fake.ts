import type { LLMProvider, GenerateTextInput, GenerateTextResult, GenerateJSONInput, GenerateJSONResult } from './types.js';

export class FakeAIProvider implements LLMProvider {
  readonly id = 'ollama' as const;
  readonly name = 'Fake (test)';
  readonly localOnly = true;

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async generateText(_input: GenerateTextInput): Promise<GenerateTextResult> {
    return { text: JSON.stringify({ content: 'Tailored CV content' }), provider: 'ollama', model: 'fake' };
  }

  async generateJSON<T>(_input: GenerateJSONInput): Promise<GenerateJSONResult<T>> {
    const data = {
      score: 85,
      verdict: 'strong-fit',
      evidence: ['TypeScript'],
      supported: ['TypeScript'],
      missing: [],
      suggestions: [],
    } as T;
    return { data, provider: 'ollama', model: 'fake' };
  }
}
