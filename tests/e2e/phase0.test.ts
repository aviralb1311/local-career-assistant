import { test, expect } from '@playwright/test';
import { launchApp, closeApp } from './support/electron';

test('Phase 0 E2E: app heading is visible', async () => {
  const launched = await launchApp();
  try {
    await expect(launched.page.locator('h1')).toContainText('Local Career Assistant');
    await expect(launched.page.getByRole('button', { name: 'Ping main process' })).toBeVisible();
  } finally {
    await closeApp(launched);
  }
});
