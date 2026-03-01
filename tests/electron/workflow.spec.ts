import { test, expect, type ElectronApplication, type Page } from '@playwright/test';
import { launchArchTerm, closeArchTerm, pressPrimaryShortcut } from './helpers/electron-app';

test.describe('ArchTerm Electron Workflow', () => {
  let app: ElectronApplication;
  let page: Page;

  test.beforeEach(async () => {
    const launched = await launchArchTerm();
    app = launched.app;
    page = launched.page;
    await expect(page.getByRole('heading', { name: /kairo|archterm/i })).toBeVisible({ timeout: 30_000 });
  });

  test.afterEach(async () => {
    await closeArchTerm(app);
  });

  test('validates SSH key selection before submit', async () => {
    await pressPrimaryShortcut(page, 'H');
    await expect(page.getByRole('heading', { name: 'Browse Hosts', level: 2 })).toBeVisible();

    await page.getByRole('button', { name: 'New Host' }).click();
    await expect(page.locator('#hf-label')).toBeVisible();

    await page.locator('#hf-label').fill('Workflow Host');
    await page.locator('#hf-hostname').fill('example.internal');
    await page.locator('#hf-username').fill('root');
    await page.locator('#hf-port').fill('22');
    await page.getByRole('button', { name: 'SSH Key' }).click();

    await page.getByRole('button', { name: 'Add Host' }).click();
    await expect(page.getByText('Select an SSH key or switch to password authentication.')).toBeVisible();
  });

  test('opens and closes a local terminal tab', async () => {
    await pressPrimaryShortcut(page, 'L');
    const closeButton = page.getByLabel('Close Local Terminal').first();
    await expect(closeButton).toBeVisible({ timeout: 30_000 });

    await closeButton.click();
    await expect(page.getByLabel('Close Local Terminal')).toHaveCount(0);
  });
});
