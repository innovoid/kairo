import type React from 'react';
import { create } from 'zustand';
import type { SshSessionStatus } from '@shared/types/ssh';
import type { SettingsTab } from '@/features/settings/SettingsPage';
import type { PaneNode } from '@shared/types/pane';
import { disposeTerminalSession } from '@/features/terminal/useTerminal';

export type TabType = 'hosts' | 'keys' | 'team' | 'workspace' | 'settings' | 'profile' | 'terminal' | 'sftp' | 'snippets';

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
  // For split pane terminal tabs:
  paneTree?: PaneNode;
}

interface SessionState {
  tabs: Map<string, Tab>;
  activeTabId: string | null;
  openTab: (tab: Omit<Tab, 'closable'> & { closable?: boolean }) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string | null) => void;
  updateTabStatus: (tabId: string, status: SshSessionStatus) => void;
  updateSettingsTab: (activeSettingsTab: SettingsTab) => void;
  splitPane: (tabId: string, direction: 'horizontal' | 'vertical', newSessionId: string) => void;
  closePane: (tabId: string, sessionId: string) => void;
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
      const isStaticTab = tab.tabType === 'hosts' || tab.tabType === 'keys' || tab.tabType === 'team' || tab.tabType === 'workspace' || tab.tabType === 'settings' || tab.tabType === 'profile' || tab.tabType === 'snippets';

      // For static tabs (hosts, keys, team, workspace, settings, profile, snippets): keep only one visible
      if (isStaticTab) {
        // Remove all other static tabs
        for (const [id, t] of newTabs.entries()) {
          if ((t.tabType === 'hosts' || t.tabType === 'keys' || t.tabType === 'team' || t.tabType === 'workspace' || t.tabType === 'settings' || t.tabType === 'profile' || t.tabType === 'snippets') && t.tabType !== tab.tabType) {
            newTabs.delete(id);
          }
        }

        // Add or reuse the requested static tab
        const existingTab = [...newTabs.values()].find(t => t.tabType === tab.tabType);
        if (existingTab) {
          return { tabs: newTabs, activeTabId: existingTab.tabId };
        }
      }

      // Add the new tab (static or dynamic)
      newTabs.set(tab.tabId, { ...tab, closable });
      return { tabs: newTabs, activeTabId: tab.tabId };
    });
  },

  closeTab: (tabId) => {
    set((state) => {
      const tab = state.tabs.get(tabId);
      if (!tab || !tab.closable) return state;

      // Cleanup terminal sessions when closing terminal tabs
      if (tab.tabType === 'terminal') {
        if (tab.paneTree) {
          // Close all sessions in pane tree
          function collectSessionIds(node: PaneNode): string[] {
            if (node.type === 'terminal') {
              return [node.sessionId];
            }
            return node.children.flatMap(collectSessionIds);
          }
          const sessionIds = collectSessionIds(tab.paneTree);
          sessionIds.forEach(sid => disposeTerminalSession(sid));
        } else if (tab.sessionId) {
          // Close single terminal session
          disposeTerminalSession(tab.sessionId);
        }
      }

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

  splitPane: (tabId, direction, newSessionId) => {
    set((state) => {
      const tab = state.tabs.get(tabId);
      if (!tab || tab.tabType !== 'terminal') return state;

      const newTabs = new Map(state.tabs);
      let paneTree: PaneNode;

      if (!tab.paneTree) {
        // No existing pane tree — create one from the current session + new session
        paneTree = {
          type: 'split',
          direction,
          children: [
            { type: 'terminal', sessionId: tab.sessionId! },
            { type: 'terminal', sessionId: newSessionId },
          ],
          sizes: [50, 50],
        };
      } else if (tab.paneTree.type === 'split') {
        // Append to existing split — equal sizes
        const count = tab.paneTree.children.length + 1;
        const equalSize = Math.floor(100 / count);
        const lastSize = 100 - equalSize * (count - 1);
        paneTree = {
          ...tab.paneTree,
          children: [...tab.paneTree.children, { type: 'terminal', sessionId: newSessionId }],
          sizes: [...Array(count - 1).fill(equalSize), lastSize],
        };
      } else {
        // paneTree is a terminal — wrap it in a split
        paneTree = {
          type: 'split',
          direction,
          children: [tab.paneTree, { type: 'terminal', sessionId: newSessionId }],
          sizes: [50, 50],
        };
      }

      newTabs.set(tabId, { ...tab, paneTree });
      return { tabs: newTabs };
    });
  },

  closePane: (tabId, sessionId) => {
    // Cleanup the terminal session for the closed pane
    disposeTerminalSession(sessionId);

    set((state) => {
      const tab = state.tabs.get(tabId);
      if (!tab || !tab.paneTree) return state;

      function removeSessionFromNode(node: PaneNode): PaneNode | null {
        if (node.type === 'terminal') {
          return node.sessionId === sessionId ? null : node;
        }
        // split node
        const newChildren: PaneNode[] = [];
        for (const child of node.children) {
          const result = removeSessionFromNode(child);
          if (result !== null) newChildren.push(result);
        }
        if (newChildren.length === 0) return null;
        if (newChildren.length === 1) return newChildren[0];
        const equalSize = Math.floor(100 / newChildren.length);
        const lastSize = 100 - equalSize * (newChildren.length - 1);
        return {
          ...node,
          children: newChildren,
          sizes: [...Array(newChildren.length - 1).fill(equalSize), lastSize],
        };
      }

      const newPaneTree = removeSessionFromNode(tab.paneTree);
      const newTabs = new Map(state.tabs);

      if (newPaneTree === null || (newPaneTree.type === 'terminal')) {
        // Collapsed back to a single terminal or empty — clear paneTree
        newTabs.set(tabId, { ...tab, paneTree: undefined });
      } else {
        newTabs.set(tabId, { ...tab, paneTree: newPaneTree });
      }

      return { tabs: newTabs };
    });
  },
}));
