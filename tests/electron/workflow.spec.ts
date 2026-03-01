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

  test('opens and closes command palette from keyboard', async () => {
    await pressPrimaryShortcut(page, 'K');
    const searchInput = page.getByPlaceholder('Search commands, hosts, and actions...');
    await expect(searchInput).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(searchInput).toHaveCount(0);
  });

  test('opens and cancels new folder dialog from host browser', async () => {
    await pressPrimaryShortcut(page, 'H');
    await expect(page.getByRole('heading', { name: 'Browse Hosts', level: 2 })).toBeVisible();

    await page.getByRole('button', { name: 'New Folder' }).click();
    await expect(page.getByRole('heading', { name: 'New Folder' })).toBeVisible();

    await page.locator('#folder-name').fill('Ops');
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('heading', { name: 'New Folder' })).toHaveCount(0);
  });
});
