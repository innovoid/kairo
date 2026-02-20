import { create } from 'zustand';

interface BroadcastState {
  enabled: boolean;
  targetSessionIds: string[];
  toggle: () => void;
  setTargets: (ids: string[]) => void;
  addTarget: (id: string) => void;
  removeTarget: (id: string) => void;
}

export const useBroadcastStore = create<BroadcastState>((set) => ({
  enabled: false,
  targetSessionIds: [],
  toggle: () => set((s) => ({ enabled: !s.enabled })),
  setTargets: (ids) => set({ targetSessionIds: ids }),
  addTarget: (id) => set((s) => ({ targetSessionIds: [...new Set([...s.targetSessionIds, id])] })),
  removeTarget: (id) => set((s) => ({ targetSessionIds: s.targetSessionIds.filter((t) => t !== id) })),
}));
