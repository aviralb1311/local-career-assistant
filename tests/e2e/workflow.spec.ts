import { test, expect } from '@playwright/test';
import { launchApp, closeApp, assertDbCreated } from './support/electron';

test.setTimeout(60000);

test('meaningful workflow: CV, job, tracking persistence', async () => {
  const launched = await launchApp();
  const { page, userDataDir } = launched;
  try {
    await expect(page.locator('h1')).toContainText('Local Career Assistant');

    await page.locator('input[placeholder="Title"]').first().fill('My CV');
    await page.locator('textarea[placeholder="Content"]').first().fill('Experience with TypeScript');
    await page.getByRole('button', { name: 'Create CV' }).click();
    await expect(page.getByRole('listitem').filter({ hasText: 'My CV' })).toBeVisible();

    await page.locator('input[placeholder="Title"]').nth(1).fill('Engineer');
    await page.locator('textarea[placeholder="Description"]').first().fill('Need TypeScript');
    await page.getByRole('button', { name: 'Create Job' }).click();
    await expect(page.getByRole('listitem').filter({ hasText: 'Engineer' })).toBeVisible();

    await page.getByRole('textbox', { name: 'Company', exact: true }).fill('Acme');
    await page.getByRole('textbox', { name: 'Role', exact: true }).fill('Engineer');
    await page.getByRole('button', { name: 'Add Application' }).click();
    await expect(page.getByText('Acme — Engineer')).toBeVisible();

    // Scope to the application list item to target its status dropdown,
    // not the "Add Application" form's status select elsewhere on the page.
    const appItem = page.getByRole('listitem').filter({ hasText: 'Acme — Engineer' });
    const statusSelect = appItem.locator('select').first();
    await statusSelect.selectOption('applied');
    await expect(statusSelect).toHaveValue('applied');

    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText('Acme — Engineer')).toBeVisible();
    const reloadedStatusSelect = page
      .getByRole('listitem')
      .filter({ hasText: 'Acme — Engineer' })
      .locator('select')
      .first();
    await expect(reloadedStatusSelect).toHaveValue('applied');

    assertDbCreated(userDataDir);
  } finally {
    await closeApp(launched);
  }
});
