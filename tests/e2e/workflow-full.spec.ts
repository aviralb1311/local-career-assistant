import { test, expect } from '@playwright/test';
import { launchApp, closeApp } from './support/electron';

test.setTimeout(120000);

test('workflow persistence and tracking across restart', async () => {
  process.env.LCA_E2E_FAKE_AI = '0';
  const launched = await launchApp();
  const { page } = launched;
  try {
    await page.locator('input[placeholder="Title"]').first().fill('My CV');
    await page.locator('textarea[placeholder="Content"]').first().fill('Experience with TypeScript');
    await page.getByRole('button', { name: 'Create CV' }).click();
    await expect(page.getByRole('listitem').filter({ hasText: 'My CV' })).toBeVisible();

    await page.locator('input[placeholder="Title"]').nth(1).fill('Engineer');
    await page.locator('textarea[placeholder="Description"]').first().fill('Need TypeScript');
    await page.getByRole('button', { name: 'Create Job' }).click();

    await page.getByRole('textbox', { name: 'Company', exact: true }).fill('Acme');
    await page.getByRole('textbox', { name: 'Role', exact: true }).fill('Engineer');
    await page.getByRole('button', { name: 'Add Application' }).click();
    await expect(page.getByText('Acme — Engineer')).toBeVisible();

    const appItem = page.getByRole('listitem').filter({ hasText: 'Acme — Engineer' });
    await appItem.locator('select').first().selectOption('applied');
    await expect(appItem.locator('select').first()).toHaveValue('applied');

    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText('Acme — Engineer')).toBeVisible();
    const reloaded = page.getByRole('listitem').filter({ hasText: 'Acme — Engineer' });
    await expect(reloaded.locator('select').first()).toHaveValue('applied');
  } finally {
    await closeApp(launched);
  }
});

test('evaluation error handling when Ollama unavailable', async () => {
  const launched = await launchApp();
  const { page } = launched;
  try {
    await page.locator('input[placeholder="Title"]').first().fill('CV');
    await page.locator('textarea[placeholder="Content"]').first().fill('TS');
    await page.getByRole('button', { name: 'Create CV' }).click();
    await page.locator('input[placeholder="Title"]').nth(1).fill('Job');
    await page.locator('textarea[placeholder="Description"]').first().fill('TS');
    await page.getByRole('button', { name: 'Create Job' }).click();

    const result = await page.evaluate(async () => {
      try {
        await (window as any).electronAPI.evaluate(1, 1);
        return { ok: true };
      } catch (e: any) {
        return { ok: false, message: e?.message };
      }
    });
    expect(result.ok).toBe(false);
  } finally {
    await closeApp(launched);
  }
});

test('successful AI evaluation and document generation with fake provider', async () => {
  process.env.LCA_E2E_FAKE_AI = '1';
  const launched = await launchApp();
  const { page } = launched;
  try {
    await page.locator('input[placeholder="Title"]').first().fill('CV');
    await page.locator('textarea[placeholder="Content"]').first().fill('TypeScript');
    await page.getByRole('button', { name: 'Create CV' }).click();
    await page.locator('input[placeholder="Title"]').nth(1).fill('Job');
    await page.locator('textarea[placeholder="Description"]').first().fill('TypeScript');
    await page.getByRole('button', { name: 'Create Job' }).click();

    await page.locator('select').first().selectOption('1');
    await page.locator('select').nth(1).selectOption('1');
    await page.getByRole('button', { name: 'Run evaluation' }).click();
    await expect(page.getByText('Score: 85')).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: 'Generate tailored CV' }).click();
    await expect(page.getByText('Tailored CV content')).toBeVisible({ timeout: 10000 });
  } finally {
    await closeApp(launched);
    delete process.env.LCA_E2E_FAKE_AI;
  }
});

test('malicious CV payload is rendered as text, not executed', async () => {
  const launched = await launchApp();
  try {
    const { page } = launched;
    const payload = '<script>window.__xss=1</script>';
    let dialogFired = false;
    page.on('dialog', async (d) => { dialogFired = true; await d.dismiss(); });

    await page.getByPlaceholder('Title').first().fill('XSS CV');
    await page.getByPlaceholder('Content').first().fill(payload);
    await page.getByRole('button', { name: /Create CV/i }).click();

    await expect(page.getByText(payload, { exact: false })).toBeVisible({ timeout: 10000 });
    const xss = await page.evaluate(() => (window as any).__xss);
    expect(xss).toBeUndefined();
    expect(dialogFired).toBe(false);
  } finally {
    await closeApp(launched);
  }
});
