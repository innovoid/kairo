import { test, expect, type ElectronApplication, type Page } from '@playwright/test';
import { launchArchTerm, closeArchTerm, pressPrimaryShortcut } from './helpers/electron-app';

test.describe('ArchTerm Electron Visual Smoke', () => {
  let app: ElectronApplication;
  let page: Page;

  test.beforeEach(async () => {
    const launched = await launchArchTerm();
    app = launched.app;
    page = launched.page;
    await expect(page.getByText('ArchTerm')).toBeVisible({ timeout: 30_000 });
  });

  test.afterEach(async () => {
    await closeArchTerm(app);
  });

  test('renders terminal-centric shell', async () => {
    await expect(page).toHaveScreenshot('01-shell.png', { fullPage: true });
  });

  test('opens command palette via keyboard', async () => {
    await pressPrimaryShortcut(page, 'K');
    await expect(page.getByPlaceholder('Search commands, hosts, and actions...')).toBeVisible();
    await expect(page).toHaveScreenshot('02-command-palette.png', { fullPage: true });
  });

  test('opens host browser via keyboard', async () => {
    await pressPrimaryShortcut(page, 'H');
    await expect(page.getByRole('heading', { name: 'Browse Hosts', level: 2 })).toBeVisible();
    await expect(page).toHaveScreenshot('03-host-browser.png', { fullPage: true });
  });

  test('opens settings overlay via keyboard', async () => {
    await pressPrimaryShortcut(page, ',');
    await expect(page.getByRole('heading', { name: 'Settings', level: 2 })).toBeVisible();
    await expect(page).toHaveScreenshot('04-settings-overlay.png', { fullPage: true });
  });
});
