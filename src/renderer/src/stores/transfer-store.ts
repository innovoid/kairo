import { create } from 'zustand';
import type { TransferProgress } from '@shared/types/sftp';

interface TransferState {
  transfers: Map<string, TransferProgress>;
  addTransfer: (progress: TransferProgress) => void;
  updateProgress: (progress: TransferProgress) => void;
  removeTransfer: (transferId: string) => void;
}

const completionTimers = new Map<string, ReturnType<typeof setTimeout>>();

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

    if (progress.status === 'done') {
      if (completionTimers.has(progress.transferId)) {
        clearTimeout(completionTimers.get(progress.transferId)!);
      }
      const timer = setTimeout(() => {
        useTransferStore.getState().removeTransfer(progress.transferId);
      }, 4000);
      completionTimers.set(progress.transferId, timer);
    }
  },

  removeTransfer: (transferId) => {
    if (completionTimers.has(transferId)) {
      clearTimeout(completionTimers.get(transferId)!);
      completionTimers.delete(transferId);
    }

    set((state) => {
      const newTransfers = new Map(state.transfers);
      newTransfers.delete(transferId);
      return { transfers: newTransfers };
    });
  },
}));
