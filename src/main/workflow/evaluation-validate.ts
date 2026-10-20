import { ValidationError } from '../ai/validation.js';

const VERDICTS = new Set(['strong-fit', 'moderate-fit', 'weak-fit', 'no-fit']);

export function validateEvaluation(raw: unknown): {
  score: number;
  verdict: string;
  evidence: string[];
  supported: string[];
  missing: string[];
  suggestions: string[];
} {
  if (!raw || typeof raw !== 'object') throw new ValidationError('Invalid evaluation: must be object.');
  const o = raw as Record<string, unknown>;
  const known = new Set(['score', 'verdict', 'evidence', 'supported', 'missing', 'suggestions']);
  for (const k of Object.keys(o)) {
    if (!known.has(k)) throw new ValidationError(`Unknown field: ${k}`);
  }
  if (typeof o.score !== 'number' || !Number.isInteger(o.score) || o.score < 0 || o.score > 100) {
    throw new ValidationError('Invalid score');
  }
  if (typeof o.verdict !== 'string' || !VERDICTS.has(o.verdict)) throw new ValidationError('Invalid verdict');
  const arr = (v: unknown, name: string): string[] => {
    if (!Array.isArray(v) || !v.every((x) => typeof x === 'string')) throw new ValidationError(`Invalid ${name}`);
    return v as string[];
  };
  return {
    score: o.score,
    verdict: o.verdict,
    evidence: arr(o.evidence, 'evidence'),
    supported: arr(o.supported, 'supported'),
    missing: arr(o.missing, 'missing'),
    suggestions: arr(o.suggestions, 'suggestions'),
  };
}
