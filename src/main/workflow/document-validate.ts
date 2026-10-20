import { ValidationError } from '../ai/validation.js';

const KINDS = new Set(['tailored-cv', 'cover-letter']);

export function validateDocumentKind(kind: unknown): string {
  if (typeof kind !== 'string' || !KINDS.has(kind)) throw new ValidationError('Invalid document kind.');
  return kind;
}

export function validateDocumentContent(content: unknown): string {
  if (typeof content !== 'string' || !content.trim()) throw new ValidationError('Invalid document content.');
  if (content.length > 200000) throw new ValidationError('Document content too long.');
  return content;
}

export function validateDocumentResponse(raw: unknown): { content: string } {
  if (!raw || typeof raw !== 'object') throw new ValidationError('Invalid document response.');
  const o = raw as Record<string, unknown>;
  const known = new Set(['content']);
  for (const k of Object.keys(o)) if (!known.has(k)) throw new ValidationError(`Unknown field: ${k}`);
  return { content: validateDocumentContent(o.content) };
}
