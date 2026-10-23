import { test, expect } from '@playwright/test';
import { _electron as electron } from '@playwright/test';
import path from 'node:path';

test('Electron smoke: basic window opens', async () => {
  const app = await electron.launch({
    args: ['--disable-gpu', path.join(process.cwd(), 'tests/e2e/support/smoke-main.js')],
    env: process.env as Record<string, string>,
  });
  const proc = app.process();
  proc.stderr?.on('data', (d) => process.stderr.write(`[smoke:stderr] ${d}`));
  proc.on('exit', (code, signal) => console.error(`[smoke:exit] code=${code} signal=${signal}`));
  const page = await app.firstWindow({ timeout: 30000 });
  await expect(page.getByRole('heading', { name: 'smoke' })).toBeVisible({ timeout: 30000 });
  await app.close();
});
