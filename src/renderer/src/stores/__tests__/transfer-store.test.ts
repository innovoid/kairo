import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTransferStore } from '../transfer-store';

const mockSftpApi = {
  cancel: vi.fn(() => Promise.resolve()),
  upload: vi.fn(() => Promise.resolve()),
  download: vi.fn(() => Promise.resolve()),
};

(global as any).window = {
  ...(global as any).window,
  sftpApi: mockSftpApi,
};

describe('useTransferStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTransferStore.setState({ transfers: new Map() });
  });

  it('cancels active transfer via ipc and marks it cancelled', async () => {
    const now = new Date().toISOString();
    useTransferStore.getState().addTransfer({
      transferId: 't-1',
      filename: 'archive.tar.gz',
      direction: 'upload',
      bytesTransferred: 256,
      totalBytes: 1024,
      status: 'active',
      startedAt: now,
      updatedAt: now,
    });

    await useTransferStore.getState().cancelTransfer('t-1');

    expect(mockSftpApi.cancel).toHaveBeenCalledWith('t-1');
    const transfer = useTransferStore.getState().transfers.get('t-1');
    expect(transfer?.status).toBe('cancelled');
    expect(transfer?.error).toBe('Transfer cancelled');
  });

  it('does nothing when cancelling unknown transfer', async () => {
    await useTransferStore.getState().cancelTransfer('missing');
    expect(mockSftpApi.cancel).not.toHaveBeenCalled();
  });

  it('retries failed upload transfer using stored metadata', async () => {
    const now = new Date().toISOString();
    useTransferStore.getState().addTransfer({
      transferId: 't-2',
      filename: 'logs.txt',
      direction: 'upload',
      sessionId: 'session-1',
      localPath: '/tmp/logs.txt',
      remotePath: '/var/log/logs.txt',
      bytesTransferred: 128,
      totalBytes: 1024,
      status: 'error',
      error: 'network dropped',
      startedAt: now,
      updatedAt: now,
    });

    await useTransferStore.getState().retryTransfer('t-2');

    expect(mockSftpApi.upload).toHaveBeenCalledWith(
      'session-1',
      '/tmp/logs.txt',
      '/var/log/logs.txt',
      't-2'
    );
    const transfer = useTransferStore.getState().transfers.get('t-2');
    expect(transfer?.status).toBe('active');
    expect(transfer?.bytesTransferred).toBe(0);
  });

  it('marks transfer as error when retry metadata is missing', async () => {
    useTransferStore.getState().addTransfer({
      transferId: 't-3',
      filename: 'unknown.bin',
      direction: 'download',
      bytesTransferred: 0,
      totalBytes: 100,
      status: 'error',
    });

    await useTransferStore.getState().retryTransfer('t-3');

    const transfer = useTransferStore.getState().transfers.get('t-3');
    expect(transfer?.status).toBe('error');
    expect(transfer?.error).toContain('Retry metadata missing');
    expect(mockSftpApi.upload).not.toHaveBeenCalled();
    expect(mockSftpApi.download).not.toHaveBeenCalled();
  });
});
