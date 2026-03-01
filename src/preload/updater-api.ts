import { contextBridge, ipcRenderer } from 'electron';

export interface UpdateInfo {
  version: string;
  releaseNotes?: string | null;
}

export interface DownloadProgress {
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
}

const updaterApi = {
  checkForUpdates: (): Promise<void> =>
    ipcRenderer.invoke('updater:check-for-updates'),

  downloadUpdate: (): Promise<void> =>
    ipcRenderer.invoke('updater:download-update'),

  installAndRestart: (): Promise<void> =>
    ipcRenderer.invoke('updater:install-and-restart'),

  onUpdateAvailable: (callback: (info: UpdateInfo) => void): (() => void) => {
    const listener = (_e: Electron.IpcRendererEvent, info: UpdateInfo) => callback(info);
    ipcRenderer.on('updater:update-available', listener);
    return () => void ipcRenderer.removeListener('updater:update-available', listener);
  },

  onUpdateNotAvailable: (callback: (info: UpdateInfo) => void): (() => void) => {
    const listener = (_e: Electron.IpcRendererEvent, info: UpdateInfo) => callback(info);
    ipcRenderer.on('updater:update-not-available', listener);
    return () => void ipcRenderer.removeListener('updater:update-not-available', listener);
  },

  onDownloadProgress: (callback: (progress: DownloadProgress) => void): (() => void) => {
    const listener = (_e: Electron.IpcRendererEvent, progress: DownloadProgress) => callback(progress);
    ipcRenderer.on('updater:download-progress', listener);
    return () => void ipcRenderer.removeListener('updater:download-progress', listener);
  },

  onUpdateDownloaded: (callback: (info: UpdateInfo) => void): (() => void) => {
    const listener = (_e: Electron.IpcRendererEvent, info: UpdateInfo) => callback(info);
    ipcRenderer.on('updater:update-downloaded', listener);
    return () => void ipcRenderer.removeListener('updater:update-downloaded', listener);
  },

  onError: (callback: (message: string) => void): (() => void) => {
    const listener = (_e: Electron.IpcRendererEvent, message: string) => callback(message);
    ipcRenderer.on('updater:error', listener);
    return () => void ipcRenderer.removeListener('updater:error', listener);
  },
};

contextBridge.exposeInMainWorld('updaterApi', updaterApi);

export type UpdaterApi = typeof updaterApi;
