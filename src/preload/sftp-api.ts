import { contextBridge, ipcRenderer } from 'electron';
import type { SftpEntry, TransferProgress } from '../shared/types/sftp';

const sftpApi = {
  list: (sessionId: string, remotePath: string): Promise<SftpEntry[]> =>
    ipcRenderer.invoke('sftp.list', sessionId, remotePath),
  listLocal: (localPath?: string): Promise<SftpEntry[]> =>
    ipcRenderer.invoke('sftp.listLocal', localPath),
  download: (sessionId: string, remotePath: string, localPath: string, transferId: string): Promise<void> =>
    ipcRenderer.invoke('sftp.download', sessionId, remotePath, localPath, transferId),
  upload: (sessionId: string, localPath: string, remotePath: string, transferId: string): Promise<void> =>
    ipcRenderer.invoke('sftp.upload', sessionId, localPath, remotePath, transferId),
  cancel: (transferId: string): Promise<void> =>
    ipcRenderer.invoke('sftp.cancel', transferId),
  mkdir: (sessionId: string, remotePath: string): Promise<void> =>
    ipcRenderer.invoke('sftp.mkdir', sessionId, remotePath),
  rename: (sessionId: string, oldPath: string, newPath: string): Promise<void> =>
    ipcRenderer.invoke('sftp.rename', sessionId, oldPath, newPath),
  delete: (sessionId: string, remotePath: string, isDir: boolean): Promise<void> =>
    ipcRenderer.invoke('sftp.delete', sessionId, remotePath, isDir),
  chmod: (sessionId: string, remotePath: string, mode: number): Promise<void> =>
    ipcRenderer.invoke('sftp.chmod', sessionId, remotePath, mode),

  onProgress: (callback: (progress: TransferProgress) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: TransferProgress) =>
      callback(progress);
    ipcRenderer.on('sftp:progress', listener);
    return () => void ipcRenderer.removeListener('sftp:progress', listener);
  },

  pickUploadFiles: (): Promise<string[] | null> =>
    ipcRenderer.invoke('sftp.pickUploadFiles'),
};

contextBridge.exposeInMainWorld('sftpApi', sftpApi);

export type SftpApi = typeof sftpApi;
