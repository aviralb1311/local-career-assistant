import { _electron as electron } from '@playwright/test';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ElectronApplication, Page } from '@playwright/test';

export type LaunchedApp = { app: ElectronApplication; page: Page; userDataDir: string };

export async function launchApp(): Promise<LaunchedApp> {
  const userDataDir = mkdtempSync(join(tmpdir(), 'lca-e2e-'));
  let app: ElectronApplication | undefined;
  try {
    app = await electron.launch({
      args: ['.', '--user-data-dir=' + userDataDir],
      env: process.env as Record<string, string>,
      timeout: 30000,
    });
    const proc = app.process();
    proc.stdout?.on('data', (d) => process.stdout.write(`[electron:stdout] ${d}`));
    proc.stderr?.on('data', (d) => process.stderr.write(`[electron:stderr] ${d}`));
    proc.on('exit', (code, signal) => console.error(`[electron:exit] code=${code} signal=${signal}`));
    const page = await app.firstWindow({ timeout: 30000 });
    page.on('console', (msg) => console.log(`[renderer:${msg.type()}] ${msg.text()}`));
    page.on('pageerror', (err) => console.error(`[renderer:pageerror] ${err.message}`));
    await page.waitForLoadState('domcontentloaded');
    return { app, page, userDataDir };
  } catch (error) {
    if (app) {
      try {
        await app.close();
      } catch {
        // Preserve the original launch/window error.
      }
    }
    try {
      rmSync(userDataDir, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup; do not mask the original error.
    }
    throw error;
  }
}

export async function closeApp(launched: LaunchedApp): Promise<void> {
  try {
    await launched.app.close();
  } finally {
    rmSync(launched.userDataDir, { recursive: true, force: true });
  }
}

export function dbPathFor(userDataDir: string): string {
  return join(userDataDir, 'app.db');
}

export function assertDbCreated(userDataDir: string): void {
  if (!existsSync(dbPathFor(userDataDir))) {
    throw new Error('Expected SQLite database was not created in the isolated user data directory.');
  }
}
