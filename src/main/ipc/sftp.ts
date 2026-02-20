import type { IpcMainInvokeEvent } from 'electron';
import { dialog } from 'electron';
import { sftpManager } from '../services/sftp-manager';

export const sftpIpcHandlers = {
  async list(event: IpcMainInvokeEvent, sessionId: string, remotePath: string) {
    return sftpManager.list(sessionId, remotePath);
  },

  async download(
    event: IpcMainInvokeEvent,
    sessionId: string,
    remotePath: string,
    localPath: string,
    transferId: string
  ) {
    await sftpManager.download(sessionId, remotePath, localPath, transferId, event.sender);
  },

  async upload(
    event: IpcMainInvokeEvent,
    sessionId: string,
    localPath: string,
    remotePath: string,
    transferId: string
  ) {
    await sftpManager.upload(sessionId, localPath, remotePath, transferId, event.sender);
  },

  async mkdir(event: IpcMainInvokeEvent, sessionId: string, remotePath: string) {
    await sftpManager.mkdir(sessionId, remotePath);
  },

  async rename(event: IpcMainInvokeEvent, sessionId: string, oldPath: string, newPath: string) {
    await sftpManager.rename(sessionId, oldPath, newPath);
  },

  async delete(event: IpcMainInvokeEvent, sessionId: string, remotePath: string, isDir: boolean) {
    await sftpManager.delete(sessionId, remotePath, isDir);
  },

  async chmod(event: IpcMainInvokeEvent, sessionId: string, remotePath: string, mode: number) {
    await sftpManager.chmod(sessionId, remotePath, mode);
  },

  async pickUploadFiles(event: IpcMainInvokeEvent): Promise<string[] | null> {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      title: 'Select files to upload',
    });

    return result.canceled ? null : result.filePaths;
  },
};
