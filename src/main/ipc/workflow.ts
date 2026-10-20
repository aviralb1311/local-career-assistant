import type { IpcRegistrar } from './ai.js';
import type { DbConnection } from '../db.js';
import * as repo from '../workflow/repo.js';
import { evaluate } from '../workflow/evaluation.js';
import { generateDocument } from '../workflow/document.js';
import { ValidationError } from '../ai/validation.js';
import type { AIService } from '../ai/service.js';
import { dialog } from 'electron';
import { writeFile } from 'node:fs/promises';

function isPosInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v > 0 && Number.isSafeInteger(v);
}

function requireDb(db: DbConnection | null): DbConnection {
  if (!db) throw new ValidationError('Database not initialized.');
  return db;
}

export function registerWorkflowHandlers(
  ipcMainLike: IpcRegistrar,
  getDb: () => DbConnection | null,
  getAI: () => AIService
): void {
  ipcMainLike.handle('wf:listCvs', async () => repo.listCvs(requireDb(getDb())));
  ipcMainLike.handle('wf:getCv', async (_e, id: unknown) => {
    if (!isPosInt(id)) throw new ValidationError('Invalid id.');
    return repo.getCv(requireDb(getDb()), id);
  });
  ipcMainLike.handle('wf:createCv', async (_e, title: unknown, content: unknown) => {
    if (typeof title !== 'string' || !title.trim()) throw new ValidationError('Invalid title.');
    if (typeof content !== 'string') throw new ValidationError('Invalid content.');
    return repo.createCv(requireDb(getDb()), title, content);
  });
  ipcMainLike.handle('wf:updateCv', async (_e, id: unknown, title: unknown, content: unknown) => {
    if (!isPosInt(id)) throw new ValidationError('Invalid id.');
    if (typeof title !== 'string' || !title.trim()) throw new ValidationError('Invalid title.');
    if (typeof content !== 'string') throw new ValidationError('Invalid content.');
    repo.updateCv(requireDb(getDb()), id, title, content);
    return { ok: true };
  });
  ipcMainLike.handle('wf:deleteCv', async (_e, id: unknown) => {
    if (!isPosInt(id)) throw new ValidationError('Invalid id.');
    repo.deleteCv(requireDb(getDb()), id);
    return { ok: true };
  });

  ipcMainLike.handle('wf:listJobs', async () => repo.listJobs(requireDb(getDb())));
  ipcMainLike.handle('wf:getJob', async (_e, id: unknown) => {
    if (!isPosInt(id)) throw new ValidationError('Invalid id.');
    return repo.getJob(requireDb(getDb()), id);
  });
  ipcMainLike.handle('wf:createJob', async (_e, title: unknown, company: unknown, url: unknown, description: unknown) => {
    if (typeof title !== 'string' || !title.trim()) throw new ValidationError('Invalid title.');
    if (company !== null && typeof company !== 'string') throw new ValidationError('Invalid company.');
    if (url !== null && typeof url !== 'string') throw new ValidationError('Invalid url.');
    if (typeof description !== 'string') throw new ValidationError('Invalid description.');
    return repo.createJob(requireDb(getDb()), title, company as string | null, url as string | null, description);
  });
  ipcMainLike.handle('wf:updateJob', async (_e, id: unknown, title: unknown, company: unknown, url: unknown, description: unknown) => {
    if (!isPosInt(id)) throw new ValidationError('Invalid id.');
    if (typeof title !== 'string' || !title.trim()) throw new ValidationError('Invalid title.');
    if (company !== null && typeof company !== 'string') throw new ValidationError('Invalid company.');
    if (url !== null && typeof url !== 'string') throw new ValidationError('Invalid url.');
    if (typeof description !== 'string') throw new ValidationError('Invalid description.');
    repo.updateJob(requireDb(getDb()), id, title, company as string | null, url as string | null, description);
    return { ok: true };
  });
  ipcMainLike.handle('wf:deleteJob', async (_e, id: unknown) => {
    if (!isPosInt(id)) throw new ValidationError('Invalid id.');
    repo.deleteJob(requireDb(getDb()), id);
    return { ok: true };
  });

  ipcMainLike.handle('wf:evaluate', async (_e, cvId: unknown, jobId: unknown) => {
    if (!isPosInt(cvId) || !isPosInt(jobId)) throw new ValidationError('Invalid ids.');
    return evaluate(requireDb(getDb()), getAI(), cvId, jobId);
  });

  ipcMainLike.handle('wf:generateDocument', async (_e, cvId: unknown, jobId: unknown, kind: unknown) => {
    if (!isPosInt(cvId) || !isPosInt(jobId)) throw new ValidationError('Invalid ids.');
    if (kind !== 'tailored-cv' && kind !== 'cover-letter') throw new ValidationError('Invalid kind.');
    return generateDocument(requireDb(getDb()), getAI(), cvId, jobId, kind);
  });

  ipcMainLike.handle('wf:listDocuments', async (_e, cvId: unknown, jobId: unknown) => {
    if (!isPosInt(cvId) || !isPosInt(jobId)) throw new ValidationError('Invalid ids.');
    const db = requireDb(getDb());
    interface DocRow { id: number; cv_id: number; job_id: number; kind: string; content: string; created_at: string; updated_at: string; }
    const rows = db.prepare('SELECT id, cv_id, job_id, kind, content, created_at, updated_at FROM documents WHERE cv_id = ? AND job_id = ? ORDER BY created_at DESC').all(cvId, jobId) as DocRow[];
    return rows.map((r) => ({ id: r.id, cvId: r.cv_id, jobId: r.job_id, kind: r.kind, content: r.content, createdAt: r.created_at, updatedAt: r.updated_at }));
  });

  ipcMainLike.handle('wf:exportDocument', async (_e, docId: unknown, format: unknown) => {
    if (!isPosInt(docId)) throw new ValidationError('Invalid id.');
    if (format !== 'md' && format !== 'txt') throw new ValidationError('Invalid format.');
    const db = requireDb(getDb());
    const row = db.prepare('SELECT content FROM documents WHERE id = ?').get(docId) as { content: string } | undefined;
    if (!row) throw new ValidationError('Document not found.');
    const { exportMarkdown, exportPlainText } = await import('../workflow/export.js');
    const data = format === 'md' ? exportMarkdown(row.content) : exportPlainText(row.content);
    const { filePath, canceled } = await dialog.showSaveDialog({ filters: [{ name: format === 'md' ? 'Markdown' : 'Text', extensions: [format] }] });
    if (canceled || !filePath) return { canceled: true };
    await writeFile(filePath, data, 'utf8');
    return { canceled: false, filePath };
  });
}
