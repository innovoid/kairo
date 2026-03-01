import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'node:path';
import { registerWorkspaceIpcHandlers } from './ipc/register';
import pkg from 'electron-updater';
const { autoUpdater } = pkg;
import log from 'electron-log';

// Configure auto-updater logging
autoUpdater.logger = log;
(autoUpdater.logger as typeof log).transports.file.level = 'info';

// Disable auto-download — notify renderer first, user confirms
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

let mainWindow: BrowserWindow | null = null;

function setupAutoUpdater(): void {
  autoUpdater.on('checking-for-update', () => {
    log.info('Checking for update...');
  });

  autoUpdater.on('update-available', (info) => {
    log.info('Update available:', info.version);
    mainWindow?.webContents.send('updater:update-available', info);
  });

  autoUpdater.on('update-not-available', (info) => {
    log.info('App is up to date:', info.version);
    mainWindow?.webContents.send('updater:update-not-available', info);
  });

  autoUpdater.on('error', (err) => {
    log.error('Auto-updater error:', err);
    mainWindow?.webContents.send('updater:error', err.message);
  });

  autoUpdater.on('download-progress', (progress) => {
    log.info(`Download progress: ${Math.round(progress.percent)}%`);
    mainWindow?.webContents.send('updater:download-progress', progress);
  });

  autoUpdater.on('update-downloaded', (info) => {
    log.info('Update downloaded:', info.version);
    mainWindow?.webContents.send('updater:update-downloaded', info);
  });

  // Renderer-triggered actions
  ipcMain.handle('updater:check-for-updates', async () => {
    try {
      return await autoUpdater.checkForUpdates();
    } catch (e: any) {
      log.error('Manual update check failed:', e);
      return null;
    }
  });

  ipcMain.handle('updater:download-update', async () => {
    try {
      await autoUpdater.downloadUpdate();
    } catch (e: any) {
      log.error('Download update failed:', e);
    }
  });

  ipcMain.handle('updater:install-and-restart', () => {
    autoUpdater.quitAndInstall();
  });

  // Check for updates 5 s after app is ready (not in dev mode)
  if (!process.env.ELECTRON_RENDERER_URL) {
    setTimeout(() => {
      void autoUpdater.checkForUpdates();
    }, 5000);
  }
}

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1380,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#09090b',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: !app.isPackaged,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return window;
}

app.whenReady().then(() => {
  registerWorkspaceIpcHandlers();

  // C-3: Gate E2E mode — renderer may only activate it in dev/test builds
  ipcMain.handle('app.isE2EModeAllowed', () => !app.isPackaged);

  mainWindow = createMainWindow();
  setupAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
