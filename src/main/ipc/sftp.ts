import type { IpcMainInvokeEvent } from 'electron';
import { dialog } from 'electron';
import { lstat, readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { sftpManager } from '../services/sftp-manager';
import type { SftpEntry } from '../../shared/types/sftp';

export const sftpIpcHandlers = {
  async list(event: IpcMainInvokeEvent, sessionId: string, remotePath: string) {
    return sftpManager.list(sessionId, remotePath);
  },

  async listLocal(_event: IpcMainInvokeEvent, localPath?: string): Promise<SftpEntry[]> {
    const targetPath = path.resolve(localPath ?? homedir());
    const dirEntries = await readdir(targetPath, { withFileTypes: true });

    const entries = await Promise.all(
      dirEntries.map(async (entry) => {
        const fullPath = path.join(targetPath, entry.name);
        const stats = await lstat(fullPath);
        const permissions = (stats.mode & 0o777).toString(8).padStart(3, '0');
        const type: SftpEntry['type'] = entry.isDirectory()
          ? 'directory'
          : entry.isFile()
            ? 'file'
            : entry.isSymbolicLink()
              ? 'symlink'
              : 'other';

        return {
          name: entry.name,
          path: fullPath,
          type,
          size: stats.size,
          permissions,
          modifiedAt: stats.mtime.toISOString(),
          owner: String(stats.uid ?? 0),
        } as SftpEntry;
      })
    );

    entries.sort((a, b) => {
      if (a.type === 'directory' && b.type !== 'directory') return -1;
      if (a.type !== 'directory' && b.type === 'directory') return 1;
      return a.name.localeCompare(b.name);
    });

    return entries;
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

  async cancel(event: IpcMainInvokeEvent, transferId: string) {
    const cancelled = sftpManager.cancel(transferId);
    if (!cancelled) {
      throw new Error(`Transfer not found or already completed: ${transferId}`);
    }
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
