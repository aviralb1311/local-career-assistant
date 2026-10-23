import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openDatabase, closeDatabase, type DbConnection } from '../../db.js';
import { applyMigrations } from '../../migrate.js';
import { registerTrackingHandlers } from '../../ipc/tracking.js';
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

describe('tracking IPC', () => {
  let db: DbConnection;
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'tri-'));
    db = openDatabase(join(dir, 't.db'));
    applyMigrations(db, join(process.cwd(), 'src/main/migrations'));
  });
  afterEach(() => closeDatabase(db));

  it('create and list', async () => {
    const reg = makeRegistrar();
    registerTrackingHandlers(reg as any, () => db);
    const a: any = await reg.invoke('tr:create', { company: 'Acme', role: 'Dev' });
    expect(a.id).toBeGreaterThan(0);
    const list: any = await reg.invoke('tr:list', null);
    expect(list.length).toBe(1);
  });

  it('filter by status', async () => {
    const reg = makeRegistrar();
    registerTrackingHandlers(reg as any, () => db);
    await reg.invoke('tr:create', { company: 'Acme', role: 'Dev', status: 'applied' });
    const filtered: any = await reg.invoke('tr:list', 'applied');
    expect(filtered.length).toBe(1);
    const other: any = await reg.invoke('tr:list', 'saved');
    expect(other.length).toBe(0);
  });

  it('invalid status rejected', async () => {
    const reg = makeRegistrar();
    registerTrackingHandlers(reg as any, () => db);
    await expect(reg.invoke('tr:create', { company: 'Acme', role: 'Dev', status: 'nope' })).rejects.toThrow();
    await expect(reg.invoke('tr:list', 'nope')).rejects.toThrow();
  });

  it('update and delete', async () => {
    const reg = makeRegistrar();
    registerTrackingHandlers(reg as any, () => db);
    const a: any = await reg.invoke('tr:create', { company: 'Acme', role: 'Dev' });
    const r: any = await reg.invoke('tr:update', a.id, { status: 'interview', notes: 'n' });
    expect(r.ok).toBe(true);
    await reg.invoke('tr:delete', a.id);
    const list: any = await reg.invoke('tr:list', null);
    expect(list.length).toBe(0);
  });

  it('invalid id rejected', async () => {
    const reg = makeRegistrar();
    registerTrackingHandlers(reg as any, () => db);
    await expect(reg.invoke('tr:update', 'x', { status: 'saved' })).rejects.toThrow();
    await expect(reg.invoke('tr:delete', 0)).rejects.toThrow();
  });

  it('update not-found throws', async () => {
    const reg = makeRegistrar();
    registerTrackingHandlers(reg as any, () => db);
    await expect(reg.invoke('tr:update', 999, { status: 'saved' })).rejects.toThrow();
  });

  it('search', async () => {
    const reg = makeRegistrar();
    registerTrackingHandlers(reg as any, () => db);
    await reg.invoke('tr:create', { company: 'Acme', role: 'Dev' });
    const res: any = await reg.invoke('tr:search', 'Acme');
    expect(res.length).toBe(1);
    await expect(reg.invoke('tr:search', 123 as any)).rejects.toThrow();
  });

  it('unknown field rejected', async () => {
    const reg = makeRegistrar();
    registerTrackingHandlers(reg as any, () => db);
    await expect(reg.invoke('tr:create', { company: 'A', role: 'B', foo: 'bar' })).rejects.toThrow();
  });

  it('delete nonexistent fails', async () => {
    const reg = makeRegistrar();
    registerTrackingHandlers(reg as any, () => db);
    await expect(reg.invoke('tr:delete', 999)).rejects.toThrow();
  });

  it('search returns matching applications across statuses', async () => {
    const reg = makeRegistrar();
    registerTrackingHandlers(reg as any, () => db);
    await reg.invoke('tr:create', { company: 'Acme', role: 'Dev', status: 'applied' });
    await reg.invoke('tr:create', { company: 'Acme', role: 'PM', status: 'interview' });
    const res: any = await reg.invoke('tr:search', 'Acme');
    expect(res.length).toBe(2);
    expect(res.map((a: any) => a.status).sort()).toEqual(['applied', 'interview']);
  });
});
