import type { IpcRegistrar } from './ai.js';
import type { DbConnection } from '../db.js';
import * as repo from '../tracking/repo.js';

function isPosInt(v: unknown): v is number { return typeof v === 'number' && Number.isInteger(v) && v > 0; }

export function registerTrackingHandlers(ipcMainLike: IpcRegistrar, getDb: () => DbConnection | null): void {
  ipcMainLike.handle('tr:list', async (_e, status: unknown) => {
    const db = getDb();
    if (!db) throw new Error('no db');
    if (status === null || status === undefined) return repo.listApplications(db);
    if (typeof status !== 'string') throw new Error('invalid status');
    return repo.listApplications(db, status);
  });
  ipcMainLike.handle('tr:create', async (_e, data: unknown) => {
    const db = getDb();
    if (!db) throw new Error('no db');
    if (!data || typeof data !== 'object') throw new Error('invalid data');
    const d = data as Record<string, unknown>;
    if (typeof d.company !== 'string' || !d.company.trim()) throw new Error('invalid company');
    if (typeof d.role !== 'string' || !d.role.trim()) throw new Error('invalid role');
    return repo.createApplication(db, {
      jobId: typeof d.jobId === 'number' && isPosInt(d.jobId) ? d.jobId : null,
      company: d.company,
      role: d.role,
      status: typeof d.status === 'string' ? d.status : 'saved',
      appliedDate: typeof d.appliedDate === 'string' ? d.appliedDate : null,
      notes: typeof d.notes === 'string' ? d.notes : null,
    });
  });
  ipcMainLike.handle('tr:update', async (_e, id: unknown, data: unknown) => {
    if (!isPosInt(id)) throw new Error('invalid id');
    const db = getDb();
    if (!db) throw new Error('no db');
    if (!data || typeof data !== 'object') throw new Error('invalid data');
    repo.updateApplication(db, id, data as any);
    return { ok: true };
  });
  ipcMainLike.handle('tr:delete', async (_e, id: unknown) => {
    if (!isPosInt(id)) throw new Error('invalid id');
    const db = getDb();
    if (!db) throw new Error('no db');
    repo.deleteApplication(db, id);
    return { ok: true };
  });
  ipcMainLike.handle('tr:search', async (_e, q: unknown) => {
    if (typeof q !== 'string') throw new Error('invalid query');
    const db = getDb();
    if (!db) throw new Error('no db');
    return repo.searchApplications(db, q);
  });
}
