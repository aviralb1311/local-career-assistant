import type { IpcRegistrar } from './ai.js';
import type { DbConnection } from '../db.js';
import * as repo from '../tracking/repo.js';

const STATUSES = new Set(['saved','applied','interview','offer','rejected','withdrawn']);

function isPosInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v > 0 && Number.isSafeInteger(v);
}

function requireDb(db: DbConnection | null): DbConnection {
  if (!db) throw new Error('Database not initialized.');
  return db;
}

function validateString(v: unknown, field: string): string {
  if (typeof v !== 'string' || !v.trim()) throw new Error(`Invalid ${field}.`);
  if (v.length > 2000) throw new Error(`${field} too long.`);
  return v.trim();
}

export function registerTrackingHandlers(ipcMainLike: IpcRegistrar, getDb: () => DbConnection | null): void {
  ipcMainLike.handle('tr:list', async (_e, status: unknown) => {
    const db = requireDb(getDb());
    if (status === null || status === undefined) return repo.listApplications(db);
    if (typeof status !== 'string' || !STATUSES.has(status)) throw new Error('Invalid status.');
    return repo.listApplications(db, status);
  });

  ipcMainLike.handle('tr:create', async (_e, data: unknown) => {
    if (!data || typeof data !== 'object') throw new Error('Invalid data.');
    const d = data as Record<string, unknown>;
    const company = validateString(d.company, 'company');
    const role = validateString(d.role, 'role');
    const status = d.status === undefined ? 'saved' : (typeof d.status === 'string' && STATUSES.has(d.status) ? d.status : null);
    if (status === null) throw new Error('Invalid status.');
    const jobId = d.jobId === undefined || d.jobId === null ? null : (isPosInt(d.jobId) ? d.jobId : null);
    if (d.jobId !== undefined && d.jobId !== null && !isPosInt(d.jobId)) throw new Error('Invalid jobId.');
    const appliedDate = d.appliedDate === undefined || d.appliedDate === null ? null : (typeof d.appliedDate === 'string' ? d.appliedDate : null);
    if (d.appliedDate !== undefined && d.appliedDate !== null && typeof d.appliedDate !== 'string') throw new Error('Invalid appliedDate.');
    const notes = d.notes === undefined || d.notes === null ? null : (typeof d.notes === 'string' ? d.notes : null);
    if (d.notes !== undefined && d.notes !== null && typeof d.notes !== 'string') throw new Error('Invalid notes.');
    const known = new Set(['company','role','status','jobId','appliedDate','notes']);
    for (const k of Object.keys(d)) if (!known.has(k)) throw new Error(`Unknown field: ${k}`);
    return repo.createApplication(requireDb(getDb()), { jobId, company, role, status, appliedDate, notes });
  });

  ipcMainLike.handle('tr:update', async (_e, id: unknown, data: unknown) => {
    if (!isPosInt(id)) throw new Error('Invalid id.');
    if (!data || typeof data !== 'object') throw new Error('Invalid data.');
    const d = data as Record<string, unknown>;
    const known = new Set(['company','role','status','jobId','appliedDate','notes']);
    for (const k of Object.keys(d)) if (!known.has(k)) throw new Error(`Unknown field: ${k}`);
    const payload: Record<string, unknown> = {};
    if (d.company !== undefined) payload.company = validateString(d.company, 'company');
    if (d.role !== undefined) payload.role = validateString(d.role, 'role');
    if (d.status !== undefined) {
      if (typeof d.status !== 'string' || !STATUSES.has(d.status)) throw new Error('Invalid status.');
      payload.status = d.status;
    }
    if (d.jobId !== undefined) {
      if (d.jobId === null) payload.jobId = null;
      else if (isPosInt(d.jobId)) payload.jobId = d.jobId;
      else throw new Error('Invalid jobId.');
    }
    if (d.appliedDate !== undefined) {
      if (d.appliedDate === null) payload.appliedDate = null;
      else if (typeof d.appliedDate === 'string') payload.appliedDate = d.appliedDate;
      else throw new Error('Invalid appliedDate.');
    }
    if (d.notes !== undefined) {
      if (d.notes === null) payload.notes = null;
      else if (typeof d.notes === 'string') payload.notes = d.notes;
      else throw new Error('Invalid notes.');
    }
    repo.updateApplication(requireDb(getDb()), id, payload as any);
    return { ok: true };
  });

  ipcMainLike.handle('tr:delete', async (_e, id: unknown) => {
    if (!isPosInt(id)) throw new Error('Invalid id.');
    const db = requireDb(getDb());
    if (!repo.getApplication(db, id)) throw new Error('Not found');
    repo.deleteApplication(db, id);
    return { ok: true };
  });

  ipcMainLike.handle('tr:search', async (_e, q: unknown) => {
    if (typeof q !== 'string') throw new Error('Invalid query.');
    return repo.searchApplications(requireDb(getDb()), q);
  });
}
