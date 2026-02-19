import { create } from 'zustand';
import type { SshKey, ImportKeyInput } from '@shared/types/keys';

interface KeyState {
  keys: SshKey[];
  isLoading: boolean;
  error: string | null;
  fetchKeys: (workspaceId: string) => Promise<void>;
  importKey: (input: ImportKeyInput) => Promise<SshKey>;
  deleteKey: (id: string) => Promise<void>;
}

export const useKeyStore = create<KeyState>((set) => ({
  keys: [],
  isLoading: false,
  error: null,

  fetchKeys: async (workspaceId) => {
    set({ isLoading: true, error: null });
    try {
      const keys = await window.keysApi.list(workspaceId);
      set({ keys, isLoading: false });
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
    }
  },

  importKey: async (input) => {
    const key = await window.keysApi.import(input);
    set((state) => ({ keys: [...state.keys, key] }));
    return key;
  },

  deleteKey: async (id) => {
    await window.keysApi.delete(id);
    set((state) => ({ keys: state.keys.filter((k) => k.id !== id) }));
  },
}));
