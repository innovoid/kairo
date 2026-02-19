import ssh2 from 'ssh2';
import type { WebContents } from 'electron';
import { sshManager } from './ssh-manager';
import type { SftpEntry, TransferProgress } from '../../shared/types/sftp';
import { createWriteStream, createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';

type SFTPWrapper = ssh2.SFTPWrapper;
type Stats = ssh2.Stats;

function statsToEntry(name: string, remotePath: string, s: Stats): SftpEntry {
  let type: SftpEntry['type'] = 'other';
  if (s.isDirectory()) type = 'directory';
  else if (s.isFile()) type = 'file';
  else if (s.isSymbolicLink()) type = 'symlink';

  const perms = s.mode ? (s.mode & 0o777).toString(8).padStart(3, '0') : '---';

  return {
    name,
    path: remotePath,
    type,
    size: s.size ?? 0,
    permissions: perms,
    modifiedAt: s.mtime ? new Date(s.mtime * 1000).toISOString() : new Date().toISOString(),
    owner: String(s.uid ?? 0),
  };
}

function getSftp(sessionId: string): Promise<SFTPWrapper> {
  return new Promise((resolve, reject) => {
    const client = sshManager.getSftpClient(sessionId);
    if (!client) {
      reject(new Error(`No SSH session found: ${sessionId}`));
      return;
    }
    client.sftp((err, sftp) => {
      if (err) reject(err);
      else resolve(sftp);
    });
  });
}

export const sftpManager = {
  async list(sessionId: string, remotePath: string): Promise<SftpEntry[]> {
    const sftp = await getSftp(sessionId);
    return new Promise((resolve, reject) => {
      sftp.readdir(remotePath, (err, list) => {
        if (err) { reject(err); return; }
        const entries: SftpEntry[] = list.map((item) =>
          statsToEntry(item.filename, `${remotePath}/${item.filename}`.replace('//', '/'), item.attrs as Stats)
        );
        entries.sort((a, b) => {
          if (a.type === 'directory' && b.type !== 'directory') return -1;
          if (a.type !== 'directory' && b.type === 'directory') return 1;
          return a.name.localeCompare(b.name);
        });
        resolve(entries);
      });
    });
  },

  async download(
    sessionId: string,
    remotePath: string,
    localPath: string,
    transferId: string,
    sender: WebContents
  ): Promise<void> {
    const sftp = await getSftp(sessionId);
    const filename = remotePath.split('/').pop() ?? 'file';

    return new Promise((resolve, reject) => {
      sftp.stat(remotePath, (statErr, stats) => {
        const totalBytes = statErr ? 0 : (stats.size ?? 0);
        let bytesTransferred = 0;
        let lastUpdate = Date.now();

        const readStream = sftp.createReadStream(remotePath);
        const writeStream = createWriteStream(localPath);

        readStream.on('data', (chunk: Buffer) => {
          bytesTransferred += chunk.length;

          // Throttle progress events to every 100ms
          const now = Date.now();
          if (now - lastUpdate > 100) {
            const progress: TransferProgress = {
              transferId,
              filename,
              direction: 'download',
              bytesTransferred,
              totalBytes,
              status: 'active',
            };
            if (!sender.isDestroyed()) sender.send('sftp:progress', progress);
            lastUpdate = now;
          }
        });

        readStream.on('error', (err: Error) => {
          const progress: TransferProgress = {
            transferId, filename, direction: 'download',
            bytesTransferred, totalBytes, status: 'error', error: err.message,
          };
          if (!sender.isDestroyed()) sender.send('sftp:progress', progress);
          reject(err);
        });

        writeStream.on('close', () => {
          const progress: TransferProgress = {
            transferId, filename, direction: 'download',
            bytesTransferred: totalBytes, totalBytes, status: 'done',
          };
          if (!sender.isDestroyed()) sender.send('sftp:progress', progress);
          resolve();
        });

        readStream.pipe(writeStream);
      });
    });
  },

  async upload(
    sessionId: string,
    localPath: string,
    remotePath: string,
    transferId: string,
    sender: WebContents
  ): Promise<void> {
    const sftp = await getSftp(sessionId);
    const filename = localPath.split('/').pop() ?? 'file';
    const fileStat = await stat(localPath);
    const totalBytes = fileStat.size;
    let bytesTransferred = 0;
    let lastUpdate = Date.now();

    return new Promise((resolve, reject) => {
      const readStream = createReadStream(localPath);
      const writeStream = sftp.createWriteStream(remotePath);

      readStream.on('data', (chunk: Buffer) => {
        bytesTransferred += chunk.length;

        // Throttle progress events to every 100ms
        const now = Date.now();
        if (now - lastUpdate > 100) {
          const progress: TransferProgress = {
            transferId, filename, direction: 'upload',
            bytesTransferred, totalBytes, status: 'active',
          };
          if (!sender.isDestroyed()) sender.send('sftp:progress', progress);
          lastUpdate = now;
        }
      });

      readStream.on('error', (err: Error) => {
        const progress: TransferProgress = {
          transferId, filename, direction: 'upload',
          bytesTransferred, totalBytes, status: 'error', error: err.message,
        };
        if (!sender.isDestroyed()) sender.send('sftp:progress', progress);
        reject(err);
      });

      writeStream.on('close', () => {
        const progress: TransferProgress = {
          transferId, filename, direction: 'upload',
          bytesTransferred: totalBytes, totalBytes, status: 'done',
        };
        if (!sender.isDestroyed()) sender.send('sftp:progress', progress);
        resolve();
      });

      readStream.pipe(writeStream);
    });
  },

  async mkdir(sessionId: string, remotePath: string): Promise<void> {
    const sftp = await getSftp(sessionId);
    return new Promise((resolve, reject) => {
      sftp.mkdir(remotePath, (err) => (err ? reject(err) : resolve()));
    });
  },

  async rename(sessionId: string, oldPath: string, newPath: string): Promise<void> {
    const sftp = await getSftp(sessionId);
    return new Promise((resolve, reject) => {
      sftp.rename(oldPath, newPath, (err) => (err ? reject(err) : resolve()));
    });
  },

  async delete(sessionId: string, remotePath: string, isDir: boolean): Promise<void> {
    const sftp = await getSftp(sessionId);
    return new Promise((resolve, reject) => {
      if (isDir) {
        sftp.rmdir(remotePath, (err) => (err ? reject(err) : resolve()));
      } else {
        sftp.unlink(remotePath, (err) => (err ? reject(err) : resolve()));
      }
    });
  },

  async chmod(sessionId: string, remotePath: string, mode: number): Promise<void> {
    const sftp = await getSftp(sessionId);
    return new Promise((resolve, reject) => {
      sftp.chmod(remotePath, mode, (err) => (err ? reject(err) : resolve()));
    });
  },
};
