import { test, expect } from '@playwright/test';
import { launchApp, closeApp } from './support/electron';

test.setTimeout(120000);

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

    // The payload should appear as literal text somewhere in the page.
    await expect(page.getByText(payload, { exact: false })).toBeVisible({ timeout: 10000 });
    // No script should have executed.
    const xss = await page.evaluate(() => (window as any).__xss);
    expect(xss).toBeUndefined();
    expect(dialogFired).toBe(false);
  } finally {
    await closeApp(launched);
  }
});
