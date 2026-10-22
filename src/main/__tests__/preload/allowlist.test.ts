import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { allowedChannels } from '../../../preload/channels.js';

const repoRoot = process.cwd();
const preloadSource = readFileSync(
  join(repoRoot, 'src/preload/index.ts'),
  'utf8'
);

/** Channels the exposed preload API actually invokes. */
function invokedChannels(): string[] {
  const matches = preloadSource.matchAll(/ipcRenderer\.invoke\(\s*'([^']+)'/g);
  return [...new Set([...matches].map((m) => m[1]))].sort();
}

/** Channels the main process registers handlers for. */
function registeredChannels(): string[] {
  const files = [
    join(repoRoot, 'src/main/index.ts'),
    ...readdirSync(join(repoRoot, 'src/main/ipc')).map((f) =>
      join(repoRoot, 'src/main/ipc', f)
    ),
  ];
  const channels = new Set<string>();
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/handle\(\s*'([^']+)'/g)) {
      channels.add(match[1]);
    }
  }
  return [...channels].sort();
}

describe('preload IPC allow-list', () => {
  it('allows every channel invoked by the exposed preload API', () => {
    const used = invokedChannels();
    const missing = used.filter((c) => !allowedChannels.includes(c as never));
    expect(missing).toEqual([]);
  });

  it('does not allow channels the main process never registers', () => {
    const registered = registeredChannels();
    const unknown = allowedChannels.filter(
      (c) => !registered.includes(c)
    );
    expect(unknown).toEqual([]);
  });

  it('exposes no generic or unrestricted channel', () => {
    // The allow-list must stay a concrete set of named channels.
    for (const channel of allowedChannels) {
      expect(channel).toMatch(/^[a-z]+:[a-zA-Z]+$/);
    }
    expect(allowedChannels).toHaveLength(new Set(allowedChannels).size);
  });
});
