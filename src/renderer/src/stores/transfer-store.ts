import { create } from 'zustand';
import type { TransferProgress } from '@shared/types/sftp';

interface TransferState {
  transfers: Map<string, TransferProgress>;
  addTransfer: (progress: TransferProgress) => void;
  updateProgress: (progress: TransferProgress) => void;
  removeTransfer: (transferId: string) => void;
  cancelTransfer: (transferId: string) => Promise<void>;
  retryTransfer: (transferId: string) => Promise<void>;
}

const completionTimers = new Map<string, ReturnType<typeof setTimeout>>();
const autoRetryAttempts = new Map<string, number>();
const MAX_AUTO_RETRIES = 1;
const AUTO_RETRY_DELAY_MS = 600;

function isLikelyTransientTransferError(message: string | undefined): boolean {
  if (!message) return false;
  const normalized = message.toLowerCase();

  const permanentSignals = [
    'permission denied',
    'no such file',
    'not found',
    'authentication',
    'auth failed',
    'invalid path',
    'is a directory',
    'failure',
  ];
  if (permanentSignals.some((signal) => normalized.includes(signal))) return false;

  const transientSignals = [
    'etimedout',
    'timed out',
    'timeout',
    'econnaborted',
    'econnreset',
    'ehostunreach',
    'connection reset',
    'broken pipe',
    'epipe',
    'socket hang up',
    'network',
    'temporarily unavailable',
    'eof',
  ];

  return transientSignals.some((signal) => normalized.includes(signal));
}

function scheduleAutoRetryIfEligible(transferId: string): void {
  const state = useTransferStore.getState();
  const transfer = state.transfers.get(transferId);
  if (!transfer || transfer.status !== 'error') return;

  if (!transfer.sessionId || !transfer.localPath || !transfer.remotePath) return;
  if (!isLikelyTransientTransferError(transfer.error)) return;

  const attempts = autoRetryAttempts.get(transferId) ?? 0;
  if (attempts >= MAX_AUTO_RETRIES) return;
  autoRetryAttempts.set(transferId, attempts + 1);

  setTimeout(() => {
    const latest = useTransferStore.getState().transfers.get(transferId);
    if (!latest || latest.status !== 'error') return;
    void useTransferStore.getState().retryTransfer(transferId);
  }, AUTO_RETRY_DELAY_MS);
}

function scheduleAutoDismiss(transferId: string): void {
  if (completionTimers.has(transferId)) {
    clearTimeout(completionTimers.get(transferId)!);
  }
  const timer = setTimeout(() => {
    useTransferStore.getState().removeTransfer(transferId);
  }, 4000);
  completionTimers.set(transferId, timer);
}

export const useTransferStore = create<TransferState>((set) => ({
  transfers: new Map(),

  addTransfer: (progress) => {
    const now = new Date().toISOString();
    const normalized: TransferProgress = {
      ...progress,
      status: progress.status ?? 'active',
      startedAt: progress.startedAt ?? now,
      updatedAt: progress.updatedAt ?? now,
      speedBytesPerSec: progress.speedBytesPerSec ?? 0,
    };

    set((state) => {
      const newTransfers = new Map(state.transfers);
      newTransfers.set(normalized.transferId, normalized);
      return { transfers: newTransfers };
    });
    autoRetryAttempts.delete(normalized.transferId);
  },

  updateProgress: (progress) => {
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();

    set((state) => {
      const newTransfers = new Map(state.transfers);
      const previous = newTransfers.get(progress.transferId);

      let inferredSpeed = progress.speedBytesPerSec;
      if (inferredSpeed == null && previous?.updatedAt) {
        const elapsedSec = Math.max((nowMs - new Date(previous.updatedAt).getTime()) / 1000, 0.001);
        inferredSpeed = Math.max(0, (progress.bytesTransferred - previous.bytesTransferred) / elapsedSec);
      }

      const merged: TransferProgress = {
        ...previous,
        ...progress,
        startedAt: progress.startedAt ?? previous?.startedAt ?? nowIso,
        updatedAt: progress.updatedAt ?? nowIso,
        speedBytesPerSec: inferredSpeed ?? previous?.speedBytesPerSec ?? 0,
      };

      newTransfers.set(progress.transferId, merged);
      return { transfers: newTransfers };
    });

    if (progress.status === 'done' || progress.status === 'cancelled') {
      autoRetryAttempts.delete(progress.transferId);
      scheduleAutoDismiss(progress.transferId);
      return;
    }

    if (progress.status === 'error') {
      scheduleAutoRetryIfEligible(progress.transferId);
    }
  },

  removeTransfer: (transferId) => {
    if (completionTimers.has(transferId)) {
      clearTimeout(completionTimers.get(transferId)!);
      completionTimers.delete(transferId);
    }
    autoRetryAttempts.delete(transferId);

    set((state) => {
      const newTransfers = new Map(state.transfers);
      newTransfers.delete(transferId);
      return { transfers: newTransfers };
    });
  },

  cancelTransfer: async (transferId) => {
    const existing = useTransferStore.getState().transfers.get(transferId);
    if (!existing) return;

    if (existing.status !== 'active') {
      useTransferStore.getState().removeTransfer(transferId);
      return;
    }

    const now = new Date().toISOString();
    set((state) => {
      const newTransfers = new Map(state.transfers);
      const previous = newTransfers.get(transferId);
      if (!previous) return { transfers: newTransfers };
      newTransfers.set(transferId, {
        ...previous,
        status: 'cancelled',
        error: 'Transfer cancelled',
        speedBytesPerSec: 0,
        updatedAt: now,
      });
      return { transfers: newTransfers };
    });
    autoRetryAttempts.delete(transferId);

    scheduleAutoDismiss(transferId);

    try {
      await window.sftpApi.cancel(transferId);
    } catch (error) {
      set((state) => {
        const newTransfers = new Map(state.transfers);
        const previous = newTransfers.get(transferId);
        if (!previous) return { transfers: newTransfers };
        newTransfers.set(transferId, {
          ...previous,
          status: 'error',
          error: error instanceof Error ? error.message : 'Failed to cancel transfer',
          updatedAt: new Date().toISOString(),
        });
        return { transfers: newTransfers };
        });
    }
  },

  retryTransfer: async (transferId) => {
    const existing = useTransferStore.getState().transfers.get(transferId);
    if (!existing) return;

    if (
      !existing.sessionId ||
      !existing.localPath ||
      !existing.remotePath
    ) {
      set((state) => {
        const newTransfers = new Map(state.transfers);
        const previous = newTransfers.get(transferId);
        if (!previous) return { transfers: newTransfers };
        newTransfers.set(transferId, {
          ...previous,
          status: 'error',
          error: 'Retry metadata missing for this transfer',
          updatedAt: new Date().toISOString(),
        });
        return { transfers: newTransfers };
      });
      return;
    }

    if (completionTimers.has(transferId)) {
      clearTimeout(completionTimers.get(transferId)!);
      completionTimers.delete(transferId);
    }

    const now = new Date().toISOString();
    set((state) => {
      const newTransfers = new Map(state.transfers);
      const previous = newTransfers.get(transferId);
      if (!previous) return { transfers: newTransfers };
      newTransfers.set(transferId, {
        ...previous,
        status: 'active',
        error: undefined,
        bytesTransferred: 0,
        speedBytesPerSec: 0,
        startedAt: now,
        updatedAt: now,
      });
      return { transfers: newTransfers };
    });

    try {
      if (existing.direction === 'upload') {
        await window.sftpApi.upload(
          existing.sessionId,
          existing.localPath,
          existing.remotePath,
          transferId
        );
      } else {
        await window.sftpApi.download(
          existing.sessionId,
          existing.remotePath,
          existing.localPath,
          transferId
        );
      }
    } catch (error) {
      set((state) => {
        const newTransfers = new Map(state.transfers);
        const previous = newTransfers.get(transferId);
        if (!previous) return { transfers: newTransfers };
        newTransfers.set(transferId, {
          ...previous,
          status: 'error',
          error: error instanceof Error ? error.message : 'Failed to retry transfer',
          updatedAt: new Date().toISOString(),
        });
        return { transfers: newTransfers };
      });
    }
  },
}));
