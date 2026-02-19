import { create } from 'zustand';
import type { Host, HostFolder, CreateHostInput, UpdateHostInput, CreateFolderInput } from '@shared/types/hosts';

interface HostState {
  hosts: Host[];
  folders: HostFolder[];
  isLoading: boolean;
  error: string | null;
  fetchHosts: (workspaceId: string) => Promise<void>;
  createHost: (input: CreateHostInput) => Promise<Host>;
  updateHost: (id: string, input: UpdateHostInput) => Promise<void>;
  deleteHost: (id: string) => Promise<void>;
  moveToFolder: (id: string, folderId: string | null) => Promise<void>;
  createFolder: (input: CreateFolderInput) => Promise<HostFolder>;
  updateFolder: (id: string, name: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
}

export const useHostStore = create<HostState>((set) => ({
  hosts: [],
  folders: [],
  isLoading: false,
  error: null,

  fetchHosts: async (workspaceId) => {
    set({ isLoading: true, error: null });
    try {
      const [hosts, folders] = await Promise.all([
        window.hostsApi.list(workspaceId),
        window.foldersApi.list(workspaceId),
      ]);
      set({ hosts, folders, isLoading: false });
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
    }
  },

  createHost: async (input) => {
    const host = await window.hostsApi.create(input);
    set((state) => ({ hosts: [...state.hosts, host] }));
    return host;
  },

  updateHost: async (id, input) => {
    const updated = await window.hostsApi.update(id, input);
    set((state) => ({
      hosts: state.hosts.map((h) => (h.id === id ? updated : h)),
    }));
  },

  deleteHost: async (id) => {
    await window.hostsApi.delete(id);
    set((state) => ({ hosts: state.hosts.filter((h) => h.id !== id) }));
  },

  moveToFolder: async (id, folderId) => {
    const updated = await window.hostsApi.moveToFolder(id, folderId);
    set((state) => ({
      hosts: state.hosts.map((h) => (h.id === id ? updated : h)),
    }));
  },

  createFolder: async (input) => {
    const folder = await window.foldersApi.create(input);
    set((state) => ({ folders: [...state.folders, folder] }));
    return folder;
  },

  updateFolder: async (id, name) => {
    const updated = await window.foldersApi.update(id, name);
    set((state) => ({
      folders: state.folders.map((f) => (f.id === id ? updated : f)),
    }));
  },

  deleteFolder: async (id) => {
    await window.foldersApi.delete(id);
    set((state) => ({ folders: state.folders.filter((f) => f.id !== id) }));
  },
}));
