import { contextBridge, ipcRenderer } from 'electron';

// Allowed IPC channels. Renderer may only invoke these.
// Phase 1 adds read-only database channels; migrations run internally
// at startup and are not exposed to the renderer.
const allowedChannels = ['app:ping', 'db:ping', 'db:version'] as const;

type AllowedChannel = (typeof allowedChannels)[number];

// Build the API object first so its type can be referenced, then expose it.
const electronAPI = {
  invoke: <T = unknown>(channel: AllowedChannel, ...args: unknown[]): Promise<T> => {
    if (!allowedChannels.includes(channel as AllowedChannel)) {
      throw new Error(`IPC channel not allowed: ${String(channel)}`);
    }
    return ipcRenderer.invoke(channel, ...args);
  },

  ping: (): Promise<string> => ipcRenderer.invoke('app:ping'),

  dbPing: (): Promise<{ ok: boolean }> => ipcRenderer.invoke('db:ping'),

  getSchemaVersion: (): Promise<{ version: number }> =>
    ipcRenderer.invoke('db:version'),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

export type ElectronAPI = typeof electronAPI;
export type { AllowedChannel };

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
