import type { DbConnection } from '../db.js';
import type { Cv, JobDescription } from './types.js';

export function createCv(db: DbConnection, title: string, content: string): Cv {
  const stmt = db.prepare('INSERT INTO cvs (title, content) VALUES (?, ?)');
  const info = stmt.run(title, content);
  return getCv(db, Number(info.lastInsertRowid))!;
}

export function getCv(db: DbConnection, id: number): Cv | undefined {
  const row = db.prepare('SELECT id, title, content, created_at, updated_at FROM cvs WHERE id = ?').get(id) as any;
  if (!row) return undefined;
  return { id: row.id, title: row.title, content: row.content, createdAt: row.created_at, updatedAt: row.updated_at };
}

export function listCvs(db: DbConnection): Cv[] {
  const rows = db.prepare('SELECT id, title, content, created_at, updated_at FROM cvs ORDER BY updated_at DESC').all() as any[];
  return rows.map((r) => ({ id: r.id, title: r.title, content: r.content, createdAt: r.created_at, updatedAt: r.updated_at }));
}

export function updateCv(db: DbConnection, id: number, title: string, content: string): void {
  db.prepare('UPDATE cvs SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(title, content, id);
}

export function deleteCv(db: DbConnection, id: number): void {
  db.prepare('DELETE FROM cvs WHERE id = ?').run(id);
}

export function createJob(db: DbConnection, title: string, company: string | null, url: string | null, description: string): JobDescription {
  const info = db.prepare('INSERT INTO job_descriptions (title, company, url, description) VALUES (?, ?, ?, ?)').run(title, company, url, description);
  return getJob(db, Number(info.lastInsertRowid))!;
}

export function getJob(db: DbConnection, id: number): JobDescription | undefined {
  const row = db.prepare('SELECT id, title, company, url, description, created_at, updated_at FROM job_descriptions WHERE id = ?').get(id) as any;
  if (!row) return undefined;
  return { id: row.id, title: row.title, company: row.company, url: row.url, description: row.description, createdAt: row.created_at, updatedAt: row.updated_at };
}

export function listJobs(db: DbConnection): JobDescription[] {
  const rows = db.prepare('SELECT id, title, company, url, description, created_at, updated_at FROM job_descriptions ORDER BY updated_at DESC').all() as any[];
  return rows.map((r) => ({ id: r.id, title: r.title, company: r.company, url: r.url, description: r.description, createdAt: r.created_at, updatedAt: r.updated_at }));
}

export function updateJob(db: DbConnection, id: number, title: string, company: string | null, url: string | null, description: string): void {
  db.prepare('UPDATE job_descriptions SET title = ?, company = ?, url = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(title, company, url, description, id);
}

export function deleteJob(db: DbConnection, id: number): void {
  db.prepare('DELETE FROM job_descriptions WHERE id = ?').run(id);
}
