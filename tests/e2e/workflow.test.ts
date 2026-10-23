import { test, expect } from '@playwright/test';
import { launchApp, closeApp } from './support/electron';

test('Phase 3 workflow UI is visible', async () => {
  const launched = await launchApp();
  try {
    await expect(launched.page.getByRole('heading', { name: /CVs/i })).toBeVisible();
    await expect(launched.page.getByRole('button', { name: /Create CV/i })).toBeVisible();
  } finally {
    await closeApp(launched);
  }
});
