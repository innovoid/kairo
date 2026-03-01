export interface SftpEntry {
  name: string;
  path: string;
  type: 'file' | 'directory' | 'symlink' | 'other';
  size: number;
  permissions: string;
  modifiedAt: string;
  owner: string;
}

export interface TransferProgress {
  transferId: string;
  filename: string;
  direction: 'upload' | 'download';
  sessionId?: string;
  localPath?: string;
  remotePath?: string;
  bytesTransferred: number;
  totalBytes: number;
  status: 'active' | 'done' | 'error' | 'cancelled';
  speedBytesPerSec?: number;
  startedAt?: string;
  updatedAt?: string;
  error?: string;
}
