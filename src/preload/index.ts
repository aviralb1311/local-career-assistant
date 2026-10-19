import { contextBridge, ipcRenderer } from 'electron';

// Allowed IPC channels. Renderer may only invoke these.
// Phase 1 adds read-only database channels; migrations run internally
// at startup and are not exposed to the renderer.
// Phase 2 adds narrowly scoped AI provider, settings, consent, and
// secret-handling channels. No generic invoke passthrough.
export const allowedChannels = [
  'app:ping',
  'db:ping',
  'db:version',
  'ai:providers',
  'ai:getSettings',
  'ai:setSettings',
  'ai:isCloudAllowed',
  'ai:requireConsent',
  'ai:grantConsent',
  'ai:denyConsent',
  'ai:generateText',
  'ai:generateJSON',
  'ai:setSecret',
  'ai:deleteSecret',
  'ai:listAuditLog',
] as const;

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

  // AI provider operations
  listProviders: (): Promise<unknown[]> =>
    ipcRenderer.invoke('ai:providers'),

  getSettings: (): Promise<unknown> => ipcRenderer.invoke('ai:getSettings'),

  setSettings: (partial: Record<string, unknown>): Promise<unknown> =>
    ipcRenderer.invoke('ai:setSettings', partial),

  isCloudAllowed: (): Promise<boolean> =>
    ipcRenderer.invoke('ai:isCloudAllowed'),

  requireConsent: (
    action: string,
    dataCategories: string[]
  ): Promise<boolean> =>
    ipcRenderer.invoke('ai:requireConsent', action, dataCategories),

  grantConsent: (
    action: string,
    dataCategories: string[]
  ): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('ai:grantConsent', action, dataCategories),

  denyConsent: (
    action: string,
    dataCategories: string[]
  ): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('ai:denyConsent', action, dataCategories),

  generateText: (input: Record<string, unknown>): Promise<unknown> =>
    ipcRenderer.invoke('ai:generateText', input),

  generateJSON: (input: Record<string, unknown>): Promise<unknown> =>
    ipcRenderer.invoke('ai:generateJSON', input),

  setSecret: (provider: string, secret: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('ai:setSecret', provider, secret),

  deleteSecret: (provider: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('ai:deleteSecret', provider),

  listAuditLog: (): Promise<unknown[]> =>
    ipcRenderer.invoke('ai:listAuditLog'),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

export type ElectronAPI = typeof electronAPI;
export type { AllowedChannel };

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
