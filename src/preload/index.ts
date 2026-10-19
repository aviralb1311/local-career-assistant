import { contextBridge, ipcRenderer } from 'electron';

// Allowed IPC channels. Renderer may only invoke these.
// Phase 1 adds database-service channels here; nothing is added without review.
const allowedChannels = ['app:ping'] as const;

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
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

export type ElectronAPI = typeof electronAPI;
export type { AllowedChannel };

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
