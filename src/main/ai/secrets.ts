import keytar from 'keytar';
import type { ProviderId, SecretsService } from './types.js';

const SERVICE_NAME = 'local-career-assistant';

export class KeytarSecretsService implements SecretsService {
  constructor(private readonly keytarApi: typeof keytar) {}

  async get(provider: ProviderId): Promise<string | null> {
    return this.keytarApi.getPassword(SERVICE_NAME, provider);
  }

  async set(provider: ProviderId, secret: string): Promise<void> {
    await this.keytarApi.setPassword(SERVICE_NAME, provider, secret);
  }

  async delete(provider: ProviderId): Promise<void> {
    await this.keytarApi.deletePassword(SERVICE_NAME, provider);
  }
}

export function createSecretsService(): SecretsService {
  return new KeytarSecretsService(keytar);
}
