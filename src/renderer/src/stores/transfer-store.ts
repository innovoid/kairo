import { create } from 'zustand';
import type { TransferProgress } from '@shared/types/sftp';

interface TransferState {
  transfers: Map<string, TransferProgress>;
  addTransfer: (progress: TransferProgress) => void;
  updateProgress: (progress: TransferProgress) => void;
  removeTransfer: (transferId: string) => void;
}

export const useTransferStore = create<TransferState>((set) => ({
  transfers: new Map(),

  addTransfer: (progress) => {
    set((state) => {
      const newTransfers = new Map(state.transfers);
      newTransfers.set(progress.transferId, progress);
      return { transfers: newTransfers };
    });
  },

  updateProgress: (progress) => {
    set((state) => {
      const newTransfers = new Map(state.transfers);
      newTransfers.set(progress.transferId, progress);
      return { transfers: newTransfers };
    });
  },

  removeTransfer: (transferId) => {
    set((state) => {
      const newTransfers = new Map(state.transfers);
      newTransfers.delete(transferId);
      return { transfers: newTransfers };
    });
  },
}));
