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
  'wf:exportDocument',
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
  listCvs: (): Promise<unknown> => ipcRenderer.invoke('wf:listCvs'),
  getCv: (id: number): Promise<unknown> => ipcRenderer.invoke('wf:getCv', id),
  createCv: (title: string, content: string): Promise<unknown> => ipcRenderer.invoke('wf:createCv', title, content),
  updateCv: (id: number, title: string, content: string): Promise<unknown> => ipcRenderer.invoke('wf:updateCv', id, title, content),
  deleteCv: (id: number): Promise<unknown> => ipcRenderer.invoke('wf:deleteCv', id),
  listJobs: (): Promise<unknown> => ipcRenderer.invoke('wf:listJobs'),
  getJob: (id: number): Promise<unknown> => ipcRenderer.invoke('wf:getJob', id),
  createJob: (title: string, company: string | null, url: string | null, description: string): Promise<unknown> => ipcRenderer.invoke('wf:createJob', title, company, url, description),
  updateJob: (id: number, title: string, company: string | null, url: string | null, description: string): Promise<unknown> => ipcRenderer.invoke('wf:updateJob', id, title, company, url, description),
  deleteJob: (id: number): Promise<unknown> => ipcRenderer.invoke('wf:deleteJob', id),
  evaluate: (cvId: number, jobId: number): Promise<unknown> => ipcRenderer.invoke('wf:evaluate', cvId, jobId),
  generateDocument: (cvId: number, jobId: number, kind: 'tailored-cv' | 'cover-letter'): Promise<unknown> => ipcRenderer.invoke('wf:generateDocument', cvId, jobId, kind),
  listDocuments: (cvId: number, jobId: number): Promise<unknown> => ipcRenderer.invoke('wf:listDocuments', cvId, jobId),
  listApplications: (status?: string | null): Promise<unknown> => ipcRenderer.invoke('tr:list', status ?? null),
  createApplication: (data: unknown): Promise<unknown> => ipcRenderer.invoke('tr:create', data),
  updateApplication: (id: number, data: unknown): Promise<unknown> => ipcRenderer.invoke('tr:update', id, data),
  deleteApplication: (id: number): Promise<unknown> => ipcRenderer.invoke('tr:delete', id),
  searchApplications: (q: string): Promise<unknown> => ipcRenderer.invoke('tr:search', q),
  createBackup: (): Promise<unknown> => ipcRenderer.invoke('backup:create'),
  restoreBackup: (): Promise<unknown> => ipcRenderer.invoke('backup:restore'),
  exportDocument: (documentId: number, format: 'md' | 'txt'): Promise<unknown> => ipcRenderer.invoke('wf:exportDocument', documentId, format),

};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

export type ElectronAPI = typeof electronAPI;
export type { AllowedChannel };

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
