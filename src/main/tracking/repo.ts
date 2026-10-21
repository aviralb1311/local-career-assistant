import type { DbConnection } from '../db.js';

export interface Application {
  id: number;
  jobId: number | null;
  company: string;
  role: string;
  status: string;
  appliedDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUSES = new Set(['saved','applied','interview','offer','rejected','withdrawn']);

export function validateStatus(s: unknown): string {
  if (typeof s !== 'string' || !STATUSES.has(s)) throw new Error('Invalid status');
  return s;
}

export function createApplication(db: DbConnection, data: { jobId?: number | null; company: string; role: string; status?: string; appliedDate?: string | null; notes?: string | null }): Application {
  const status = validateStatus(data.status ?? 'saved');
  const info = db.prepare('INSERT INTO applications (job_id, company, role, status, applied_date, notes) VALUES (?, ?, ?, ?, ?, ?)').run(data.jobId ?? null, data.company, data.role, status, data.appliedDate ?? null, data.notes ?? null);
  return getApplication(db, Number(info.lastInsertRowid))!;
}

export function getApplication(db: DbConnection, id: number): Application | undefined {
  const r = db.prepare('SELECT id, job_id, company, role, status, applied_date, notes, created_at, updated_at FROM applications WHERE id = ?').get(id) as any;
  if (!r) return undefined;
  return { id: r.id, jobId: r.job_id, company: r.company, role: r.role, status: r.status, appliedDate: r.applied_date, notes: r.notes, createdAt: r.created_at, updatedAt: r.updated_at };
}

export function listApplications(db: DbConnection, status?: string): Application[] {
  const rows = status
    ? db.prepare('SELECT id, job_id, company, role, status, applied_date, notes, created_at, updated_at FROM applications WHERE status = ? ORDER BY updated_at DESC').all(status) as any[]
    : db.prepare('SELECT id, job_id, company, role, status, applied_date, notes, created_at, updated_at FROM applications ORDER BY updated_at DESC').all() as any[];
  return rows.map((r) => ({ id: r.id, jobId: r.job_id, company: r.company, role: r.role, status: r.status, appliedDate: r.applied_date, notes: r.notes, createdAt: r.created_at, updatedAt: r.updated_at }));
}

export function searchApplications(db: DbConnection, q: string): Application[] {
  const rows = db.prepare('SELECT id, job_id, company, role, status, applied_date, notes, created_at, updated_at FROM applications WHERE company LIKE ? OR role LIKE ? ORDER BY updated_at DESC').all(`%${q}%`, `%${q}%`) as any[];
  return rows.map((r) => ({ id: r.id, jobId: r.job_id, company: r.company, role: r.role, status: r.status, appliedDate: r.applied_date, notes: r.notes, createdAt: r.created_at, updatedAt: r.updated_at }));
}

export function updateApplication(db: DbConnection, id: number, data: Partial<{ jobId: number | null; company: string; role: string; status: string; appliedDate: string | null; notes: string | null }>): void {
  const existing = getApplication(db, id);
  if (!existing) throw new Error('Not found');
  const company = data.company ?? existing.company;
  const role = data.role ?? existing.role;
  const status = data.status ? validateStatus(data.status) : existing.status;
  const jobId = data.jobId !== undefined ? data.jobId : existing.jobId;
  const appliedDate = data.appliedDate !== undefined ? data.appliedDate : existing.appliedDate;
  const notes = data.notes !== undefined ? data.notes : existing.notes;
  db.prepare('UPDATE applications SET job_id=?, company=?, role=?, status=?, applied_date=?, notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(jobId, company, role, status, appliedDate, notes, id);
}

export function deleteApplication(db: DbConnection, id: number): void {
  db.prepare('DELETE FROM applications WHERE id = ?').run(id);
}
