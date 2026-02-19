import { create } from 'zustand';
import type { Workspace } from '@shared/types/workspace';

interface WorkspaceState {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  isLoading: boolean;
  error: string | null;
  setActiveWorkspace: (workspaceId: string) => Promise<void>;
  fetchWorkspaces: () => Promise<void>;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  workspaces: [],
  activeWorkspace: null,
  isLoading: false,
  error: null,

  fetchWorkspaces: async () => {
    set({ isLoading: true, error: null });
    try {
      const workspaces = await window.workspaceApi.listMine();
      const context = await window.workspaceApi.getActiveContext?.();
      set({
        workspaces: workspaces ?? [],
        activeWorkspace: context?.workspace ?? null,
        isLoading: false,
      });
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
    }
  },

  setActiveWorkspace: async (workspaceId: string) => {
    try {
      await window.workspaceApi.switchActive(workspaceId);
      // Fetch updated data after switch
      await set({ isLoading: true });
      const context = await window.workspaceApi.getActiveContext?.();
      const workspaces = await window.workspaceApi.listMine();
      set({
        activeWorkspace: context?.workspace ?? null,
        workspaces: workspaces ?? [],
        isLoading: false,
      });
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
    }
  },
}));
