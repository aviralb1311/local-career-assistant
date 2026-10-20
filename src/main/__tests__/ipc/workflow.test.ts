import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openDatabase, closeDatabase, type DbConnection } from '../../db.js';
import { applyMigrations } from '../../migrate.js';
import { registerWorkflowHandlers } from '../../ipc/workflow.js';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function makeRegistrar() {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  return {
    handle: (ch: string, fn: (...args: unknown[]) => unknown) => handlers.set(ch, fn),
    invoke: async (ch: string, ...args: unknown[]) => {
      const fn = handlers.get(ch);
      if (!fn) throw new Error('no handler');
      return fn({}, ...args);
    },
  };
}

describe('workflow IPC', () => {
  let db: DbConnection;
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'wfi-'));
    db = openDatabase(join(dir, 't.db'));
    applyMigrations(db, join(process.cwd(), 'src/main/migrations'));
  });
  afterEach(() => closeDatabase(db));

  it('create and list cv', async () => {
    const reg = makeRegistrar();
    registerWorkflowHandlers(reg as any, () => db, () => ({}) as any);
    const cv: any = await reg.invoke('wf:createCv', 'T', 'content');
    expect(cv.id).toBeGreaterThan(0);
    const list: any = await reg.invoke('wf:listCvs');
    expect(list.length).toBe(1);
  });

  it('invalid id rejected', async () => {
    const reg = makeRegistrar();
    registerWorkflowHandlers(reg as any, () => db, () => ({}) as any);
    await expect(reg.invoke('wf:getCv', 'x')).rejects.toThrow();
  });

  it('unknown field? createJob validates', async () => {
    const reg = makeRegistrar();
    registerWorkflowHandlers(reg as any, () => db, () => ({}) as any);
    await expect(reg.invoke('wf:createJob', 'T', 123, null, 'd')).rejects.toThrow();
  });
});
