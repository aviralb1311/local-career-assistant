// Phase 0 E2E smoke test.
// Asserts a real, visible UI element on the dev server.
// Real E2E tests (mocked AI providers, full MVP flow) are implemented in Phase 5.
import { test, expect } from '@playwright/test';

test('Phase 0 E2E: app heading is visible', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('Local Career Assistant');
  await expect(page.getByRole('button', { name: 'Ping main process' })).toBeVisible();
});
