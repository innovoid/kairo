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

  test('allows selecting terminal font inside settings modal', async () => {
    await pressPrimaryShortcut(page, ',');
    await expect(page.getByRole('heading', { name: 'Settings', level: 2 })).toBeVisible();

    const trigger = page.getByRole('combobox').first();
    await trigger.click();
    await page.getByRole('option', { name: /Fira Code/i }).click();
    await expect(trigger).toContainText('Fira Code');
  });

  test('opens host form from host browser new host action', async () => {
    await pressPrimaryShortcut(page, 'H');
    await expect(page.getByRole('heading', { name: 'Browse Hosts', level: 2 })).toBeVisible();
    await page.getByRole('button', { name: 'New Host' }).click();
    await expect(page.locator('#hf-label')).toBeVisible();
    await expect(page).toHaveScreenshot('05-new-host-form.png', { fullPage: true });
  });

  test('opens ssh keys manager from command palette', async () => {
    await pressPrimaryShortcut(page, 'K');
    const searchInput = page.getByPlaceholder('Search commands, hosts, and actions...');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('SSH Keys');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'SSH Keys', level: 2 })).toBeVisible();
    await expect(page).toHaveScreenshot('06-ssh-keys-overlay.png', { fullPage: true });
  });

  test('shows local and remote panes in sftp tab', async () => {
    await pressPrimaryShortcut(page, 'L');
    await expect(page.getByText('Local Terminal')).toBeVisible();
    await page.getByRole('button', { name: 'SFTP Browser' }).click();
    await expect(page.getByText(/SFTP —/)).toBeVisible();
    await expect(page.getByTestId('local-file-pane-title')).toBeVisible();
    await expect(page.getByTestId('remote-file-pane-title')).toBeVisible();
    await expect(page).toHaveScreenshot('07-sftp-local-remote-panes.png', { fullPage: true });
  });
});
