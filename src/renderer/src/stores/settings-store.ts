import { create } from 'zustand';
import type { UserSettings, UpdateSettingsInput } from '@shared/types/settings';

interface SettingsState {
  settings: UserSettings | null;
  isLoading: boolean;
  fetchSettings: () => Promise<void>;
  updateSettings: (input: UpdateSettingsInput) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: null,
  isLoading: false,

  fetchSettings: async () => {
    set({ isLoading: true });
    try {
      const settings = await window.settingsApi.get();
      set({ settings, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  updateSettings: async (input) => {
    const settings = await window.settingsApi.update(input);
    set({ settings });
  },
}));
