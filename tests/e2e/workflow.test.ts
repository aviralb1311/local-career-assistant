import { test, expect } from '@playwright/test';

test('Phase 3 workflow UI is visible', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /CVs/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Create CV/i })).toBeVisible();
});
