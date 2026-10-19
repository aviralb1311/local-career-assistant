import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import keytar from 'keytar';
import { KeytarSecretsService } from '../../ai/secrets.js';

type KeytarMock = {
  getPassword: ReturnType<typeof vi.fn>;
  setPassword: ReturnType<typeof vi.fn>;
  deletePassword: ReturnType<typeof vi.fn>;
};

describe('KeytarSecretsService', () => {
  let mockKeytar: KeytarMock;

  beforeEach(() => {
    mockKeytar = {
      getPassword: vi.fn(),
      setPassword: vi.fn(),
      deletePassword: vi.fn(),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('get returns null when no secret stored', async () => {
    mockKeytar.getPassword.mockResolvedValue(null);
    const service = new KeytarSecretsService(
      mockKeytar as unknown as typeof keytar
    );
    const result = await service.get('ollama');
    expect(result).toBeNull();
    expect(mockKeytar.getPassword).toHaveBeenCalledWith('local-career-assistant', 'ollama');
  });

  it('get returns stored secret', async () => {
    mockKeytar.getPassword.mockResolvedValue('sk-test-key');
    const service = new KeytarSecretsService(
      mockKeytar as unknown as typeof keytar
    );
    const result = await service.get('openai-compatible');
    expect(result).toBe('sk-test-key');
  });

  it('set stores secret', async () => {
    mockKeytar.setPassword.mockResolvedValue(undefined);
    const service = new KeytarSecretsService(
      mockKeytar as unknown as typeof keytar
    );
    await service.set('openai-compatible', 'sk-secret-123');
    expect(mockKeytar.setPassword).toHaveBeenCalledWith('local-career-assistant', 'openai-compatible', 'sk-secret-123');
  });

  it('delete removes secret', async () => {
    mockKeytar.deletePassword.mockResolvedValue(undefined);
    const service = new KeytarSecretsService(
      mockKeytar as unknown as typeof keytar
    );
    await service.delete('ollama');
    expect(mockKeytar.deletePassword).toHaveBeenCalledWith('local-career-assistant', 'ollama');
  });

  it('keytar get failure does not leak secret', async () => {
    mockKeytar.getPassword.mockRejectedValue(new Error('keychain locked'));
    const service = new KeytarSecretsService(
      mockKeytar as unknown as typeof keytar
    );
    await expect(service.get('ollama')).rejects.toThrow('keychain locked');
  });

  it('keytar set failure does not leak secret', async () => {
    mockKeytar.setPassword.mockRejectedValue(new Error('keychain locked'));
    const service = new KeytarSecretsService(
      mockKeytar as unknown as typeof keytar
    );
    await expect(service.set('ollama', 'sk-secret')).rejects.toThrow('keychain locked');
  });

  it('keytar delete failure does not leak secret', async () => {
    mockKeytar.deletePassword.mockRejectedValue(new Error('keychain locked'));
    const service = new KeytarSecretsService(
      mockKeytar as unknown as typeof keytar
    );
    await expect(service.delete('ollama')).rejects.toThrow('keychain locked');
  });
});
