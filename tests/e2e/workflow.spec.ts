import { test, expect } from '@playwright/test';
import { launchApp, closeApp, assertDbCreated } from './support/electron';

test.setTimeout(60000);

test('meaningful workflow: CV, job, tracking persistence', async () => {
  const launched = await launchApp();
  const { page, userDataDir } = launched;
  try {
    await expect(page.locator('h1')).toContainText('Local Career Assistant');

    await page.getByPlaceholder('Title').fill('My CV');
    await page.getByPlaceholder('Content').fill('Experience with TypeScript');
    await page.getByRole('button', { name: 'Create CV' }).click();
    await expect(page.getByText('My CV')).toBeVisible();

    await page.getByPlaceholder('Title').nth(1).fill('Engineer');
    await page.locator('textarea').nth(1).fill('Need TypeScript');
    await page.getByRole('button', { name: 'Create Job' }).click();
    await expect(page.getByText('Engineer')).toBeVisible();

    await page.getByPlaceholder('Company').fill('Acme');
    await page.getByPlaceholder('Role').fill('Engineer');
    await page.getByRole('button', { name: 'Add Application' }).click();
    await expect(page.getByText('Acme — Engineer')).toBeVisible();

    const statusSelect = page.locator('select').filter({ hasText: 'saved' }).first();
    await statusSelect.selectOption('applied');
    await expect(statusSelect).toHaveValue('applied');

    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText('Acme — Engineer')).toBeVisible();
    await expect(page.locator('select').filter({ hasText: 'applied' }).first()).toHaveValue('applied');

    assertDbCreated(userDataDir);
  } finally {
    await closeApp(launched);
  }
});
