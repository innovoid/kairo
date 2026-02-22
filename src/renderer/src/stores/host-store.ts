import { create } from 'zustand';
import type { Host, HostFolder, CreateHostInput, UpdateHostInput, CreateFolderInput } from '@shared/types/hosts';
import { useWorkspaceStore } from './workspace-store';

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
    // Optimistic update: add placeholder host immediately
    const tempId = `temp-${Date.now()}`;
    const placeholderHost: Host = {
      id: tempId,
      workspaceId: input.workspaceId,
      folderId: input.folderId ?? null,
      label: input.label,
      hostname: input.hostname,
      port: input.port ?? 22,
      username: input.username,
      authType: input.authType,
      password: null,
      keyId: input.keyId ?? null,
      tags: input.tags ?? [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    set((state) => ({ hosts: [...state.hosts, placeholderHost] }));

    // Create in backend and replace placeholder
    const host = await window.hostsApi.create(input);
    set((state) => ({
      hosts: state.hosts.map((h) => (h.id === tempId ? host : h)),
    }));
    return host;
  },

  updateHost: async (id, input) => {
    // Optimistic update: apply changes immediately
    set((state) => ({
      hosts: state.hosts.map((h) =>
        h.id === id ? { ...h, ...input, updatedAt: new Date().toISOString() } : h
      ),
    }));

    try {
      // Update backend and sync full data
      const updated = await window.hostsApi.update(id, input);
      set((state) => ({
        hosts: state.hosts.map((h) => (h.id === id ? updated : h)),
      }));
    } catch (error) {
      // Refetch to restore correct state
      const workspaceId = useWorkspaceStore.getState().activeWorkspace?.id;
      if (workspaceId) {
        const hosts = await window.hostsApi.list(workspaceId);
        set({ hosts });
      }
      throw error;
    }
  },

  deleteHost: async (id) => {
    await window.hostsApi.delete(id);
    set((state) => ({ hosts: state.hosts.filter((h) => h.id !== id) }));
  },

  moveToFolder: async (id, folderId) => {
    // Optimistic update: update UI immediately before API call
    set((state) => ({
      hosts: state.hosts.map((h) =>
        h.id === id ? { ...h, folderId } : h
      ),
    }));

    // Then update backend (local-first, so it's fast)
    try {
      const updated = await window.hostsApi.moveToFolder(id, folderId);
      // Update with full data from backend (in case there are other changes)
      set((state) => ({
        hosts: state.hosts.map((h) => (h.id === id ? updated : h)),
      }));
    } catch (error) {
      // On error, refetch to get correct state
      const workspaceId = useWorkspaceStore.getState().activeWorkspace?.id;
      if (workspaceId) {
        const hosts = await window.hostsApi.list(workspaceId);
        set({ hosts });
      }
    }
  },

  createFolder: async (input) => {
    // Optimistic update: add placeholder folder immediately
    const tempId = `temp-${Date.now()}`;
    const placeholderFolder: HostFolder = {
      id: tempId,
      workspaceId: input.workspaceId,
      parentId: input.parentId ?? null,
      name: input.name,
      position: input.position ?? 0,
      createdAt: new Date().toISOString(),
    };
    set((state) => ({ folders: [...state.folders, placeholderFolder] }));

    try {
      // Create in backend and replace placeholder
      const folder = await window.foldersApi.create(input);
      set((state) => ({
        folders: state.folders.map((f) => (f.id === tempId ? folder : f)),
      }));
      return folder;
    } catch (error) {
      // Roll back optimistic folder on failure.
      set((state) => ({
        folders: state.folders.filter((f) => f.id !== tempId),
        error: error instanceof Error ? error.message : 'Failed to create folder',
      }));
      throw error;
    }
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
