import { test, expect } from '@playwright/test';
import { _electron as electron } from '@playwright/test';
import path from 'node:path';

test.setTimeout(90000);

test('Electron smoke: basic window opens', async () => {
  console.error('[smoke-test] starting launch');
  const app = await electron.launch({
    args: ['--disable-gpu', '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', path.join(process.cwd(), 'tests/e2e/support/smoke-main.js')],
    env: process.env as Record<string, string>,
    timeout: 90000,
  });
  console.error('[smoke-test] launched');
  const proc = app.process();
  proc.stdout?.on('data', (d) => process.stdout.write(`[smoke:stdout] ${d}`));
  proc.stderr?.on('data', (d) => process.stderr.write(`[smoke:stderr] ${d}`));
  proc.on('exit', (code, signal) => console.error(`[smoke:exit] code=${code} signal=${signal}`));
  proc.on('error', (err) => console.error(`[smoke:error] ${err}`));
  console.error('[smoke-test] waiting for window');
  const page = await app.firstWindow({ timeout: 90000 });
  console.error('[smoke-test] got window');
  await expect(page.getByRole('heading', { name: 'smoke' })).toBeVisible({ timeout: 60000 });
  await app.close();
});
