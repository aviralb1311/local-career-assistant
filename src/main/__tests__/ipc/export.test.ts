import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { openDatabase, closeDatabase, type DbConnection } from '../../db.js';
import { applyMigrations } from '../../migrate.js';
import { registerWorkflowHandlers } from '../../ipc/workflow.js';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const mockShowSaveDialog = vi.hoisted(() => vi.fn());
const mockWriteFile = vi.hoisted(() => vi.fn());
const mockRename = vi.hoisted(() => vi.fn());
const mockUnlink = vi.hoisted(() => vi.fn());

vi.mock('electron', async (importOriginal) => {
  const actual = await importOriginal<typeof import('electron')>();
  return {
    ...actual,
    dialog: {
      showSaveDialog: mockShowSaveDialog,
    },
  };
});

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    writeFile: mockWriteFile,
    rename: mockRename,
    unlink: mockUnlink,
  };
});

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

describe('workflow IPC exportDocument', () => {
  let db: DbConnection;
  let dir: string;
  let reg: ReturnType<typeof makeRegistrar>;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'wfexport-'));
    db = openDatabase(join(dir, 't.db'));
    applyMigrations(db, join(process.cwd(), 'src/main/migrations'));
    reg = makeRegistrar();
    registerWorkflowHandlers(reg as any, () => db, () => ({}) as any);
    vi.clearAllMocks();
  });

  afterEach(() => closeDatabase(db));

  async function insertDoc(content: string): Promise<number> {
    db.prepare('INSERT INTO cvs (id, title, content, created_at, updated_at) VALUES (1, \'CV\', \'content\', datetime(\'now\'), datetime(\'now\'))').run();
    db.prepare('INSERT INTO job_descriptions (id, title, company, url, description, created_at, updated_at) VALUES (1, \'Job\', null, null, \'desc\', datetime(\'now\'), datetime(\'now\'))').run();
    const row = db.prepare('INSERT INTO documents (cv_id, job_id, kind, content, created_at, updated_at) VALUES (1, 1, \'tailored-cv\', ?, datetime(\'now\'), datetime(\'now\')) RETURNING id').get(content) as { id: number };
    return row.id;
  }

  it('cancellation returns canceled without writing', async () => {
    const docId = await insertDoc('Hello PDF');
    mockShowSaveDialog.mockResolvedValue({ canceled: true, filePath: '' });
    const result = (await reg.invoke('wf:exportDocument', docId, 'pdf')) as { canceled: boolean; filePath?: string };
    expect(result.canceled).toBe(true);
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it('rejects invalid format', async () => {
    await expect(reg.invoke('wf:exportDocument', 1, 'exe' as any)).rejects.toThrow('Invalid format.');
  });

  it('writes temp file then renames atomically on success', async () => {
    const docId = await insertDoc('Hello PDF');
    const dest = join(dir, 'out.pdf');
    mockShowSaveDialog.mockResolvedValue({ canceled: false, filePath: dest });
    mockWriteFile.mockResolvedValue(undefined);
    mockRename.mockResolvedValue(undefined);

    const result = (await reg.invoke('wf:exportDocument', docId, 'pdf')) as { canceled: boolean; filePath?: string };
    expect(result.canceled).toBe(false);
    expect(result.filePath).toBe(dest);
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    const tmpPath = mockWriteFile.mock.calls[0][0] as string;
    expect(tmpPath).toMatch(/\.tmp\.\d+\.\d+$/);
    expect(tmpPath).toContain(dir);
    expect(mockRename).toHaveBeenCalledWith(tmpPath, dest);
    expect(mockUnlink).not.toHaveBeenCalled();
  });

  it('filter name is PDF for pdf format', async () => {
    const docId = await insertDoc('Hello PDF');
    mockShowSaveDialog.mockResolvedValue({ canceled: false, filePath: join(dir, 'out.pdf') });
    mockWriteFile.mockResolvedValue(undefined);
    mockRename.mockResolvedValue(undefined);
    await reg.invoke('wf:exportDocument', docId, 'pdf');
    expect(mockShowSaveDialog).toHaveBeenCalledWith(
      expect.objectContaining({ filters: [{ name: 'PDF', extensions: ['pdf'] }] })
    );
  });

  it('md and txt filter names preserved', async () => {
    const docId = await insertDoc('Hello');
    mockShowSaveDialog.mockResolvedValue({ canceled: false, filePath: join(dir, 'out.md') });
    mockWriteFile.mockResolvedValue(undefined);
    mockRename.mockResolvedValue(undefined);
    await reg.invoke('wf:exportDocument', docId, 'md');
    expect(mockShowSaveDialog).toHaveBeenCalledWith(
      expect.objectContaining({ filters: [{ name: 'Markdown', extensions: ['md'] }] })
    );
    mockShowSaveDialog.mockClear();
    await reg.invoke('wf:exportDocument', docId, 'txt');
    expect(mockShowSaveDialog).toHaveBeenCalledWith(
      expect.objectContaining({ filters: [{ name: 'Text', extensions: ['txt'] }] })
    );
  });

  it('temp file cleaned up on write failure, destination untouched', async () => {
    const docId = await insertDoc('Hello PDF');
    const dest = join(dir, 'existing.pdf');
    // Pre-create an existing destination file with known content.
    require('node:fs').writeFileSync(dest, 'PRE-EXISTING CONTENT');

    mockShowSaveDialog.mockResolvedValue({ canceled: false, filePath: dest });
    mockWriteFile.mockRejectedValue(new Error('disk full'));

    await expect(reg.invoke('wf:exportDocument', docId, 'pdf')).rejects.toThrow('disk full');

    // The temp file should have been unlinked (mockUnlink called).
    expect(mockUnlink).toHaveBeenCalledTimes(1);
    const unlinkedPath = mockUnlink.mock.calls[0][0] as string;
    expect(unlinkedPath).toMatch(/\.tmp\.\d+\.\d+$/);
    // The existing destination file must not have been modified.
    expect(require('node:fs').readFileSync(dest, 'utf-8')).toBe('PRE-EXISTING CONTENT');
  });

  it('temp file cleaned up on rename failure, destination untouched', async () => {
    const docId = await insertDoc('Hello PDF');
    const dest = join(dir, 'existing.pdf');
    require('node:fs').writeFileSync(dest, 'PRE-EXISTING CONTENT');

    mockShowSaveDialog.mockResolvedValue({ canceled: false, filePath: dest });
    mockWriteFile.mockResolvedValue(undefined);
    mockRename.mockRejectedValue(new Error('cross-device link'));

    await expect(reg.invoke('wf:exportDocument', docId, 'pdf')).rejects.toThrow('cross-device link');

    expect(mockUnlink).toHaveBeenCalledTimes(1);
    expect(require('node:fs').readFileSync(dest, 'utf-8')).toBe('PRE-EXISTING CONTENT');
  });
});
