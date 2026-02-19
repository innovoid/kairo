import type React from 'react';
import { create } from 'zustand';
import type { SshSessionStatus } from '@shared/types/ssh';
import type { SettingsTab } from '@/features/settings/SettingsPage';

export type TabType = 'hosts' | 'keys' | 'settings' | 'terminal' | 'sftp';

export interface Tab {
  tabId: string;
  tabType: TabType;
  label: string;
  closable: boolean;
  // For terminal/sftp tabs:
  hostId?: string;
  hostname?: string;
  sessionId?: string;
  status?: SshSessionStatus;
  terminalRef?: React.RefObject<HTMLDivElement>;
  // For settings tab:
  settingsTab?: SettingsTab;
}

interface SessionState {
  tabs: Map<string, Tab>;
  activeTabId: string | null;
  openTab: (tab: Omit<Tab, 'closable'> & { closable?: boolean }) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string | null) => void;
  updateTabStatus: (tabId: string, status: SshSessionStatus) => void;
  updateSettingsTab: (activeSettingsTab: SettingsTab) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  tabs: new Map([
    ['hosts', { tabId: 'hosts', tabType: 'hosts', label: 'Hosts', closable: false }],
  ]),
  activeTabId: 'hosts',

  openTab: (tab) => {
    set((state) => {
      const newTabs = new Map(state.tabs);
      const closable = tab.closable ?? true;

      // Check if tab already exists (for hosts, keys, settings)
      if (tab.tabType === 'hosts' || tab.tabType === 'keys' || tab.tabType === 'settings') {
        const existingTab = [...newTabs.values()].find(t => t.tabType === tab.tabType);
        if (existingTab) {
          return { activeTabId: existingTab.tabId };
        }
      }

      newTabs.set(tab.tabId, { ...tab, closable });
      return { tabs: newTabs, activeTabId: tab.tabId };
    });
  },

  closeTab: (tabId) => {
    set((state) => {
      const tab = state.tabs.get(tabId);
      if (!tab || !tab.closable) return state;

      const newTabs = new Map(state.tabs);
      newTabs.delete(tabId);

      // Find next active tab
      let activeId = state.activeTabId;
      if (state.activeTabId === tabId) {
        const tabArray = [...newTabs.keys()];
        activeId = tabArray.length > 0 ? tabArray[tabArray.length - 1] : null;
      }

      return { tabs: newTabs, activeTabId: activeId };
    });
  },

  setActiveTab: (tabId) => set({ activeTabId: tabId }),

  updateTabStatus: (tabId, status) => {
    set((state) => {
      const tab = state.tabs.get(tabId);
      if (!tab) return state;
      const newTabs = new Map(state.tabs);
      newTabs.set(tabId, { ...tab, status });
      return { tabs: newTabs };
    });
  },

  updateSettingsTab: (activeSettingsTab) => {
    set((state) => {
      const tab = [...state.tabs.values()].find(t => t.tabType === 'settings');
      if (!tab) return state;
      const newTabs = new Map(state.tabs);
      newTabs.set(tab.tabId, { ...tab, settingsTab: activeSettingsTab });
      return { tabs: newTabs };
    });
  },
}));
