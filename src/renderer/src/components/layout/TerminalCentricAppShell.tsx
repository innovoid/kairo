/**
 * Terminal-Centric AppShell
 *
 * Modern reimagining of Kairo's layout with refined brutalist design.
 * This is a complete replacement for the traditional sidebar-based AppShell.
 *
 * Key Features:
 * - Terminals fill 100% viewport
 * - Floating tab bar (glass morphism)
 * - Mini toolbar (top-right corner)
 * - Command palette (Cmd+K)
 * - Full-screen overlays for management
 * - No sidebar, no status bar
 */

import { useCallback, useEffect, useState } from 'react';
import { useHotkey } from '@tanstack/react-hotkeys';
import type { RegisterableHotkey } from '@tanstack/hotkeys';
import { getHotkey } from '@/lib/hotkeys-registry';
import { formatShortcut } from '@/lib/shortcut-format';
import { isTerminalFocused } from '@/lib/terminal-focus';
import { isE2EMode } from '@/lib/e2e';
import { TerminalLayout } from './TerminalLayout';
import { FloatingTabBar } from './FloatingTabBar';
import { CommandPalette } from './CommandPalette';
import { HostBrowserOverlay } from '@/features/hosts/HostBrowserOverlay';
import { HostForm } from '@/features/hosts/HostForm';
import { KeysPage } from '@/features/keys/KeysPage';
import { TeamOverlay } from '@/features/team/TeamOverlay';
import { SettingsOverlay } from '@/features/settings/SettingsOverlay';
import { SnippetsPage } from '@/features/snippets/SnippetsPage';
import { TransferProgress } from '@/features/sftp/TransferProgress';
import { Overlay, OverlayContent, OverlayHeader } from '@/components/ui/overlay';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { MainArea } from './MainArea';
import { useSessionStore } from '@/stores/session-store';
import { useHostStore } from '@/stores/host-store';
import { useSettingsStore } from '@/stores/settings-store';
import { useTransferStore } from '@/stores/transfer-store';
import { useBroadcastStore } from '@/stores/broadcast-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useAutoUpdater } from '@/features/updater/useAutoUpdater';
import { UpdateBanner, UpdateReadyModal } from '@/features/updater/UpdateNotification';
import {
  clearSessionRecoverySnapshot,
  collectPaneSessionIds,
  createSessionRecoverySnapshot,
  loadSessionRecoverySnapshot,
  saveSessionRecoverySnapshot,
} from '@/features/terminal/session-recovery';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { KairoLogo } from '@/components/ui/KairoLogo';
import type { Workspace } from '@shared/types/workspace';
import type { Host } from '@shared/types/hosts';
import type { SettingsTab } from '@/features/settings/SettingsPage';
import type { Tab } from '@/stores/session-store';

export function TerminalCentricAppShell() {
  const e2eMode = isE2EMode();
  const [workspaceId, setWorkspaceId] = useState<string>('');
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [hostBrowserOpen, setHostBrowserOpen] = useState(false);
  const [hostFormOpen, setHostFormOpen] = useState(false);
  const [editingHost, setEditingHost] = useState<Host | null>(null);
  const [keysOpen, setKeysOpen] = useState(false);
  const [keysImportOpen, setKeysImportOpen] = useState(false);
  const [snippetsOpen, setSnippetsOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [agentOpen, setAgentOpen] = useState(true);
  const [settingsInitialTab, setSettingsInitialTab] = useState<SettingsTab>('terminal');
  const [pendingWorkspaceSwitchId, setPendingWorkspaceSwitchId] = useState<string | null>(null);
  const [workspaceSwitching, setWorkspaceSwitching] = useState(false);
  const [sessionRecoveryHydrated, setSessionRecoveryHydrated] = useState(false);

  // Wire up auto-updater toast notifications
  const [updateState, updateActions] = useAutoUpdater();

  const { updateProgress } = useTransferStore();
  const { settings, fetchSettings } = useSettingsStore();
  const { hosts, fetchHosts } = useHostStore();
  const { workspaces, activeWorkspace, fetchWorkspaces } = useWorkspaceStore();
  const { enabled: broadcastEnabled, toggle: toggleBroadcastEnabled, addTarget } = useBroadcastStore();

  const tabs = useSessionStore((s) => s.tabs);
  const activeTabId = useSessionStore((s) => s.activeTabId);
  const openTab = useSessionStore((s) => s.openTab);
  const setActiveTab = useSessionStore((s) => s.setActiveTab);
  const closeTab = useSessionStore((s) => s.closeTab);
  const splitPane = useSessionStore((s) => s.splitPane);
  const updateTabDisconnect = useSessionStore((s) => s.updateTabDisconnect);
  const activeTab = activeTabId ? tabs.get(activeTabId) : null;
  const resolveHotkey = (id: string): RegisterableHotkey => {
    const definition = getHotkey(id);
    if (!definition) throw new Error(`Missing hotkey definition: ${id}`);
    return definition.key as RegisterableHotkey;
  };

  const reconnectRecoveredTabs = useCallback(async (recoveredTabs: Tab[]) => {
    const connectedSessionIds = new Set<string>();

    for (const tab of recoveredTabs) {
      const sessionIds = tab.paneTree
        ? collectPaneSessionIds(tab.paneTree)
        : (tab.sessionId ? [tab.sessionId] : []);
      const uniqueSessionIds = sessionIds.filter((sessionId) => {
        if (connectedSessionIds.has(sessionId)) return false;
        connectedSessionIds.add(sessionId);
        return true;
      });
      if (!uniqueSessionIds.length) continue;

      const reconnectConfig = tab.reconnectConfig;
      const isSshReconnect =
        reconnectConfig?.type === 'ssh'
        && !!reconnectConfig.host
        && !!reconnectConfig.username
        && Number.isInteger(reconnectConfig.port);

      if (isSshReconnect) {
        let password: string | undefined;
        if (reconnectConfig.authType === 'password' && reconnectConfig.hostId) {
          try {
            password = await window.hostsApi.getPassword(reconnectConfig.hostId) ?? undefined;
          } catch {
            // Continue without password; the reconnect attempt will surface auth errors if needed.
          }
        }

        const payload = { ...reconnectConfig, ...(password ? { password } : {}) };
        await Promise.all(
          uniqueSessionIds.map(async (sessionId) => {
            try {
              await window.sshApi.connect(sessionId, payload);
            } catch (error) {
              updateTabDisconnect(
                tab.tabId,
                (error as Error).message || 'Failed to restore SSH session',
                reconnectConfig
              );
            }
          })
        );
        continue;
      }

      const localPayload = {
        type: 'local' as const,
        promptStyle: reconnectConfig?.promptStyle ?? settings?.promptStyle,
      };
      await Promise.all(
        uniqueSessionIds.map(async (sessionId) => {
          try {
            await window.sshApi.connect(sessionId, localPayload);
          } catch (error) {
            updateTabDisconnect(
              tab.tabId,
              (error as Error).message || 'Failed to restore local session',
              reconnectConfig
            );
          }
        })
      );
    }
  }, [settings?.promptStyle, updateTabDisconnect]);

  // Initialize workspace and settings
  useEffect(() => {
    if (e2eMode) {
      setWorkspaceId('e2e-workspace');
    } else {
      window.workspaceApi.getActiveContext().then((ctx) => {
        if (ctx) setWorkspaceId((ctx as { workspace: Workspace }).workspace.id);
      });
      void fetchWorkspaces();
    }

    const offProgress = window.sftpApi.onProgress(updateProgress);
    fetchSettings();
    return offProgress;
  }, [e2eMode, updateProgress, fetchSettings, fetchWorkspaces]);

  useEffect(() => {
    if (!workspaceId) return;
    void fetchHosts(workspaceId);
  }, [workspaceId, fetchHosts]);

  // Sync theme
  useEffect(() => {
    const theme = settings?.theme ?? 'dark';
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('archterm-theme', theme);
  }, [settings?.theme]);

  // Restore session tabs/splits from the previous app run and reconnect them.
  useEffect(() => {
    if (e2eMode || !workspaceId || sessionRecoveryHydrated) return;

    const snapshot = loadSessionRecoverySnapshot();
    if (!snapshot || snapshot.workspaceId !== workspaceId || snapshot.tabs.length === 0) {
      setSessionRecoveryHydrated(true);
      return;
    }

    const now = Date.now();
    const restoredTabs = new Map<string, Tab>();

    for (const restored of snapshot.tabs) {
      if (restored.tabType !== 'terminal' && restored.tabType !== 'sftp') continue;
      const hasTerminalSession = restored.tabType === 'terminal' && (!!restored.sessionId || !!restored.paneTree);
      const hasSftpSession = restored.tabType === 'sftp' && !!restored.sessionId;
      if (!hasTerminalSession && !hasSftpSession) continue;

      const isSplitTerminal = restored.tabType === 'terminal' && !!restored.paneTree;
      const status = restored.tabType === 'sftp' ? 'connected' : (isSplitTerminal ? 'connected' : 'connecting');

      restoredTabs.set(restored.tabId, {
        ...restored,
        closable: true,
        status,
        connectStartedAt: status === 'connecting' ? now : undefined,
        connectedAt: status === 'connected' ? now : undefined,
        connectLatencyMs: undefined,
        lastActivityAt: undefined,
        disconnectReason: undefined,
        disconnectedAt: undefined,
      });
    }

    if (restoredTabs.size === 0) {
      clearSessionRecoverySnapshot();
      setSessionRecoveryHydrated(true);
      return;
    }

    const defaultActiveTabId = restoredTabs.keys().next().value ?? null;
    const restoredActiveTabId =
      snapshot.activeTabId && restoredTabs.has(snapshot.activeTabId)
        ? snapshot.activeTabId
        : defaultActiveTabId;

    useSessionStore.setState({
      tabs: restoredTabs,
      activeTabId: restoredActiveTabId,
    });
    setSessionRecoveryHydrated(true);

    const recoveredTerminalTabs = Array.from(restoredTabs.values()).filter((tab) => tab.tabType === 'terminal');
    void reconnectRecoveredTabs(recoveredTerminalTabs);
    toast.info(`Restored ${restoredTabs.size} session tab${restoredTabs.size === 1 ? '' : 's'}`);
  }, [e2eMode, workspaceId, sessionRecoveryHydrated, reconnectRecoveredTabs]);

  // Persist recoverable session state so tabs/splits can be restored on restart.
  useEffect(() => {
    if (e2eMode || !workspaceId || !sessionRecoveryHydrated) return;
    const snapshot = createSessionRecoverySnapshot(tabs, activeTabId, workspaceId);
    if (snapshot.tabs.length === 0) {
      clearSessionRecoverySnapshot();
      return;
    }
    saveSessionRecoverySnapshot(snapshot);
  }, [e2eMode, workspaceId, sessionRecoveryHydrated, tabs, activeTabId]);

  // Handler functions (defined before use)
  const handleOpenLocalTerminal = () => {
    const sessionId = `local-${Date.now()}`;
    const connectConfig = { type: 'local' as const, promptStyle: settings?.promptStyle };
    openTab({
      tabId: sessionId,
      tabType: 'terminal',
      label: 'Local Terminal',
      sessionId,
      status: 'connecting',
      reconnectConfig: connectConfig,
    });
    void window.sshApi.connect(sessionId, connectConfig);
  };

  const handleConnectHost = async (hostId: string) => {
    const host = hosts.find((h) => h.id === hostId);
    if (!host) return;

    // Check if already connected
    const existingTab = Array.from(tabs.values()).find(
      (t) => t.hostId === hostId && t.tabType === 'terminal'
    );

    if (existingTab) {
      setActiveTab(existingTab.tabId);
    } else {
      const sessionId = crypto.randomUUID();
      const connectConfig = {
        type: 'ssh' as const,
        host: host.hostname,
        port: host.port,
        username: host.username,
        authType: host.authType,
        privateKeyId: host.keyId ?? undefined,
        hostId: host.id,
        promptStyle: settings?.promptStyle,
      };
      openTab({
        tabId: sessionId,
        tabType: 'terminal',
        label: host.label,
        hostId: host.id,
        hostname: host.hostname,
        sessionId,
        status: 'connecting',
        reconnectConfig: connectConfig,
      });

      // Fetch password on-demand from Supabase — never stored in renderer
      let password: string | undefined;
      if (host.authType === 'password') {
        try {
          password = await window.hostsApi.getPassword(host.id) ?? undefined;
        } catch {
          // Continue without password - SSH will fail with auth error
        }
      }
      window.sshApi.connect(sessionId, { ...connectConfig, password });
    }
  };

  const handleNewTab = () => {
    setHostBrowserOpen(true);
  };

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
  };

  const handleTabClose = (tabId: string) => {
    const tab = tabs.get(tabId);
    // SFTP tabs share the sessionId with their parent terminal tab — do NOT
    // disconnect the SSH session when closing an SFTP tab, only for terminal tabs.
    if (tab?.sessionId && tab.tabType !== 'sftp') {
      window.sshApi.disconnect(tab.sessionId);
    }
    closeTab(tabId);
  };

  const handleOpenSftp = (tabId: string) => {
    const tab = tabs.get(tabId);
    if (!tab || !tab.sessionId || tab.tabType !== 'terminal') return;

    const sftpTabId = `sftp-${tab.sessionId}`;
    openTab({
      tabId: sftpTabId,
      tabType: 'sftp',
      label: `SFTP: ${tab.label}`,
      hostId: tab.hostId,
      hostname: tab.hostname,
      sessionId: tab.sessionId,
      status: 'connected',
    });
  };

  const handleOpenSettings = (tab: SettingsTab = 'terminal') => {
    setSettingsInitialTab(tab);
    setSettingsOpen(true);
  };

  const handleOpenHostForm = () => {
    setEditingHost(null);
    setHostFormOpen(true);
  };

  const handleCloseHostForm = () => {
    setHostFormOpen(false);
    setEditingHost(null);
  };

  const handleOpenKeys = () => {
    setKeysImportOpen(false);
    setKeysOpen(true);
  };

  const closeAllSessionTabs = () => {
    const sessionTabIds = Array.from(tabs.values())
      .filter((tab) => tab.tabType === 'terminal' || tab.tabType === 'sftp')
      .map((tab) => tab.tabId);

    for (const tabId of sessionTabIds) {
      handleTabClose(tabId);
    }
  };

  const performWorkspaceSwitch = async (nextWorkspaceId: string, closeSessions: boolean) => {
    if (!nextWorkspaceId || nextWorkspaceId === workspaceId) return;
    setWorkspaceSwitching(true);

    try {
      if (closeSessions) {
        closeAllSessionTabs();
      }
      await window.workspaceApi.switchActive(nextWorkspaceId);
      setWorkspaceId(nextWorkspaceId);
      await Promise.all([fetchHosts(nextWorkspaceId), fetchSettings(), fetchWorkspaces()]);

      setHostBrowserOpen(false);
      setHostFormOpen(false);
      setKeysOpen(false);
      setTeamOpen(false);
      setSettingsOpen(false);
      setPendingWorkspaceSwitchId(null);

      const workspaceName =
        workspaces.find((workspace) => workspace.id === nextWorkspaceId)?.name ?? 'workspace';
      toast.success(`Switched to ${workspaceName}`);
    } catch (error) {
      toast.error((error as Error).message || 'Failed to switch workspace');
    } finally {
      setWorkspaceSwitching(false);
    }
  };

  const handleWorkspaceSwitch = async (nextWorkspaceId: string) => {
    if (!nextWorkspaceId || nextWorkspaceId === workspaceId) return;

    const hasSessionTabs = Array.from(tabs.values()).some(
      (tab) => tab.tabType === 'terminal' || tab.tabType === 'sftp'
    );
    if (hasSessionTabs) {
      setPendingWorkspaceSwitchId(nextWorkspaceId);
      return;
    }

    await performWorkspaceSwitch(nextWorkspaceId, false);
  };

  const handleSplitHorizontal = async (tabId: string) => {
    const tab = tabs.get(tabId);
    if (!tab || tab.tabType !== 'terminal') return;

    const newSessionId = `local-${Date.now()}`;
    splitPane(tab.tabId, 'horizontal', newSessionId);

    if (tab.reconnectConfig?.type === 'ssh' && tab.reconnectConfig.hostId) {
      let password: string | undefined;
      if (tab.reconnectConfig.authType === 'password') {
        try {
          password = await window.hostsApi.getPassword(tab.reconnectConfig.hostId) ?? undefined;
        } catch {}
      }
      window.sshApi.connect(newSessionId, {
        ...tab.reconnectConfig,
        password,
      });
    } else {
      window.sshApi.connect(newSessionId, { type: 'local', promptStyle: settings?.promptStyle });
    }
  };

  const handleSplitVertical = async (tabId: string) => {
    const tab = tabs.get(tabId);
    if (!tab || tab.tabType !== 'terminal') return;

    const newSessionId = `local-${Date.now()}`;
    splitPane(tab.tabId, 'vertical', newSessionId);

    if (tab.reconnectConfig?.type === 'ssh' && tab.reconnectConfig.hostId) {
      let password: string | undefined;
      if (tab.reconnectConfig.authType === 'password') {
        try {
          password = await window.hostsApi.getPassword(tab.reconnectConfig.hostId) ?? undefined;
        } catch {}
      }
      window.sshApi.connect(newSessionId, {
        ...tab.reconnectConfig,
        password,
      });
    } else {
      window.sshApi.connect(newSessionId, { type: 'local', promptStyle: settings?.promptStyle });
    }
  };

  const handleToggleBroadcast = (tabId: string) => {
    const tab = tabs.get(tabId);
    if (!tab?.sessionId) return;

    if (!broadcastEnabled) {
      toggleBroadcastEnabled();
      addTarget(tab.sessionId);
      toast.success('Broadcast enabled');
    } else {
      toggleBroadcastEnabled();
      toast.info('Broadcast disabled');
    }
  };

  // Command Palette
  useHotkey(resolveHotkey('command-palette'), (e) => {
    if (isTerminalFocused()) return;
    e.preventDefault();
    setCommandPaletteOpen(true);
  });

  // Browse Hosts
  useHotkey(resolveHotkey('browse-hosts'), (e) => {
    if (isTerminalFocused()) return;
    e.preventDefault();
    setHostBrowserOpen(true);
  });

  // New Connection
  useHotkey(resolveHotkey('new-tab'), (e) => {
    if (isTerminalFocused()) return;
    e.preventDefault();
    setHostBrowserOpen(true);
  });

  // Local Terminal
  useHotkey(resolveHotkey('local-terminal'), (e) => {
    if (isTerminalFocused()) return;
    e.preventDefault();
    handleOpenLocalTerminal();
  });

  // Snippets
  useHotkey(resolveHotkey('snippets'), (e) => {
    if (isTerminalFocused()) return;
    e.preventDefault();
    setSnippetsOpen(true);
  });

  // Settings
  useHotkey(resolveHotkey('settings'), (e) => {
    if (isTerminalFocused()) return;
    e.preventDefault();
    handleOpenSettings('terminal');
  });

  // AI Agent
  useHotkey(resolveHotkey('ai-agent'), (e) => {
    if (isTerminalFocused()) return;
    e.preventDefault();
    setAgentOpen(true);
  });

  // Open SFTP
  useHotkey(resolveHotkey('open-sftp'), (e) => {
    if (isTerminalFocused()) return;
    e.preventDefault();
    if (activeTabId) handleOpenSftp(activeTabId);
  });

  // Toggle Broadcast
  useHotkey(resolveHotkey('toggle-broadcast'), (e) => {
    if (isTerminalFocused()) return;
    e.preventDefault();
    if (activeTabId) handleToggleBroadcast(activeTabId);
  });

  // Close Tab
  useHotkey(resolveHotkey('close-tab'), (e) => {
    if (isTerminalFocused()) return;
    e.preventDefault();
    if (activeTabId) {
      const tab = tabs.get(activeTabId);
      if (tab?.closable !== false) {
        closeTab(activeTabId);
      }
    }
  });

  // Convert tabs to FloatingTabBar format
  const floatingTabs = Array.from(tabs.values())
    .filter((tab) => tab.tabType === 'terminal' || tab.tabType === 'sftp')
    .map((tab) => ({
      id: tab.tabId,
      title: tab.label,
      hostname: tab.hostname,
      status: tab.status as 'connected' | 'connecting' | 'disconnected' | 'error',
      isActive: tab.tabId === activeTabId,
      sessionId: tab.sessionId,
      reconnectAttempts: tab.reconnectAttempts,
      disconnectReason: tab.disconnectReason,
      connectLatencyMs: tab.connectLatencyMs,
      lastActivityAt: tab.lastActivityAt,
    }));

  const workspaceOptions =
    e2eMode
      ? [{ id: 'e2e-workspace', name: 'E2E Workspace' }]
      : workspaces;
  const shortcutLabel = (hotkeyId: string) => formatShortcut(getHotkey(hotkeyId)?.key);
  const pendingWorkspaceName = pendingWorkspaceSwitchId
    ? workspaces.find((workspace) => workspace.id === pendingWorkspaceSwitchId)?.name ?? 'workspace'
    : 'workspace';

  // Command palette commands
  const commands = [
    // Hosts
    ...hosts.map((host) => ({
      id: `connect-${host.id}`,
      title: host.label,
      description: `${host.username}@${host.hostname}`,
      category: 'hosts',
      keywords: ['ssh', 'connect', host.label, host.hostname, ...(host.tags || [])],
      onExecute: () => handleConnectHost(host.id),
    })),
    // Actions
    {
      id: 'browse-hosts',
      title: 'Browse Hosts',
      description: 'Open host browser',
      category: 'actions',
      shortcut: shortcutLabel('browse-hosts'),
      keywords: ['hosts', 'browse', 'connections'],
      onExecute: () => setHostBrowserOpen(true),
    },
    {
      id: 'browse-files',
      title: 'Browse Files',
      description: 'Open SFTP browser',
      category: 'actions',
      shortcut: shortcutLabel('browse-files'),
      keywords: ['sftp', 'files', 'browser'],
      onExecute: () => {
        if (!activeTabId) {
          toast.info('Open a terminal tab first');
          return;
        }
        handleOpenSftp(activeTabId);
      },
    },
    {
      id: 'snippets',
      title: 'Snippets',
      description: 'Manage saved commands',
      category: 'actions',
      shortcut: shortcutLabel('snippets'),
      keywords: ['snippets', 'commands', 'saved'],
      onExecute: () => setSnippetsOpen(true),
    },
    {
      id: 'ssh-keys',
      title: 'SSH Keys',
      description: 'Manage SSH keys',
      category: 'actions',
      keywords: ['keys', 'ssh', 'authentication'],
      onExecute: handleOpenKeys,
    },
    {
      id: 'team',
      title: 'Team',
      description: 'Invite and manage workspace members',
      category: 'actions',
      keywords: ['team', 'members', 'roles', 'invite'],
      onExecute: () => setTeamOpen(true),
    },
    // Settings
    {
      id: 'settings',
      title: 'Settings',
      description: 'Configure Kairo',
      category: 'settings',
      shortcut: shortcutLabel('settings'),
      keywords: ['settings', 'preferences', 'config'],
      onExecute: () => handleOpenSettings('terminal'),
    },
    {
      id: 'ai-agent',
      title: 'AI Agent',
      description: 'Open AI agent sidebar',
      category: 'actions',
      shortcut: shortcutLabel('ai-agent'),
      keywords: ['ai', 'agent', 'automation', 'playbook'],
      onExecute: () => setAgentOpen(true),
    },
    {
      id: 'keyboard-shortcuts',
      title: 'Keyboard Shortcuts',
      description: 'View all keyboard shortcuts',
      category: 'settings',
      keywords: ['hotkeys', 'keys', 'shortcuts', 'keybindings', 'help'],
      onExecute: () => handleOpenSettings('shortcuts'),
    },
    // Terminal
    {
      id: 'new-terminal',
      title: 'New Terminal',
      description: 'Open new terminal tab',
      category: 'terminal',
      shortcut: shortcutLabel('new-tab'),
      keywords: ['new', 'terminal', 'tab'],
      onExecute: () => setHostBrowserOpen(true),
    },
    {
      id: 'local-terminal',
      title: 'Local Terminal',
      description: 'Open local terminal on this machine',
      category: 'terminal',
      shortcut: shortcutLabel('local-terminal'),
      keywords: ['local', 'terminal', 'shell', 'bash', 'zsh'],
      onExecute: handleOpenLocalTerminal,
    },
    {
      id: 'split-horizontal',
      title: 'Split Horizontal',
      description: 'Split terminal horizontally',
      category: 'terminal',
      shortcut: shortcutLabel('split-horizontal'),
      keywords: ['split', 'horizontal', 'pane'],
      onExecute: () => {
        if (activeTabId) handleSplitHorizontal(activeTabId);
      },
    },
    {
      id: 'split-vertical',
      title: 'Split Vertical',
      description: 'Split terminal vertically',
      category: 'terminal',
      shortcut: shortcutLabel('split-vertical'),
      keywords: ['split', 'vertical', 'pane'],
      onExecute: () => {
        if (activeTabId) handleSplitVertical(activeTabId);
      },
    },
  ];

  if (!workspaceId) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-6">
          <div
            className="inline-block animate-pulse"
            style={{ filter: 'drop-shadow(0 0 40px var(--primary-glow))' }}
          >
            <KairoLogo iconOnly size="md" />
          </div>
          <div className="space-y-3">
            <div className="h-4 w-32 bg-surface-3 rounded animate-pulse mx-auto" />
            <div className="flex items-center justify-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: '0.2s' }} />
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: '0.4s' }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <TerminalLayout
      tabBar={
        floatingTabs.length > 0 ? (
          <FloatingTabBar
            tabs={floatingTabs}
            currentWorkspaceId={e2eMode ? 'e2e-workspace' : activeWorkspace?.id ?? workspaceId}
            workspaces={workspaceOptions}
            onTabClick={handleTabClick}
            onTabClose={handleTabClose}
            onNewTab={handleNewTab}
            onWorkspaceChange={(workspace) => void handleWorkspaceSwitch(workspace)}
            onBrowseHosts={() => setHostBrowserOpen(true)}
            onBrowseFiles={() => {
              if (!activeTabId) {
                toast.info('Open a terminal tab first');
                return;
              }
              handleOpenSftp(activeTabId);
            }}
            onSnippets={() => setSnippetsOpen(true)}
            onKeys={handleOpenKeys}
            onCommandPalette={() => setCommandPaletteOpen(true)}
            onAiAgent={() => setAgentOpen(true)}
            onSettings={() => handleOpenSettings('terminal')}
            onOpenSftp={handleOpenSftp}
            onSplitHorizontal={handleSplitHorizontal}
            onSplitVertical={handleSplitVertical}
            onToggleBroadcast={handleToggleBroadcast}
          />
        ) : undefined
      }
      overlays={
        <>
          <CommandPalette
            open={commandPaletteOpen}
            onOpenChange={setCommandPaletteOpen}
            commands={commands}
          />
          <HostBrowserOverlay
            open={hostBrowserOpen}
            onOpenChange={setHostBrowserOpen}
            workspaceId={workspaceId}
            onConnect={handleConnectHost}
            onNewHost={() => {
              setHostBrowserOpen(false);
              handleOpenHostForm();
            }}
          />
          <Sheet open={hostFormOpen} onOpenChange={(open) => { if (!open) handleCloseHostForm(); }}>
            <SheetContent side="right" showCloseButton={false} className="w-[340px] max-w-[95vw] p-0 border-l-0">
              <HostForm
                host={editingHost}
                workspaceId={workspaceId}
                onClose={handleCloseHostForm}
              />
            </SheetContent>
          </Sheet>
          <Overlay
            open={keysOpen}
            onOpenChange={(open) => {
              setKeysOpen(open);
              if (!open) setKeysImportOpen(false);
            }}
            className="max-w-[1320px] max-h-[92vh]"
          >
            <OverlayHeader
              title="SSH Keys"
              description="Import, rotate, and remove private keys for your hosts"
              onClose={() => {
                setKeysOpen(false);
                setKeysImportOpen(false);
              }}
            />
            <OverlayContent className="p-0 max-h-[calc(92vh-88px)]">
              <KeysPage
                workspaceId={workspaceId}
                showImportPanel={keysImportOpen}
                onOpenImport={() => setKeysImportOpen(true)}
                onCloseImport={() => setKeysImportOpen(false)}
              />
            </OverlayContent>
          </Overlay>
          <Overlay open={snippetsOpen} onOpenChange={setSnippetsOpen} className="max-w-[1320px] max-h-[92vh]">
            <OverlayHeader
              title="Snippets"
              description="Save and execute frequently used commands"
              onClose={() => setSnippetsOpen(false)}
            />
            <OverlayContent className="p-0 max-h-[calc(92vh-88px)]">
              <SnippetsPage />
            </OverlayContent>
          </Overlay>
          <TeamOverlay
            open={teamOpen}
            onOpenChange={setTeamOpen}
            workspaceId={workspaceId}
          />
          <SettingsOverlay
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            workspaceId={workspaceId}
            initialTab={settingsInitialTab}
          />
          <Dialog
            open={pendingWorkspaceSwitchId !== null}
            onOpenChange={(open) => {
              if (!open && !workspaceSwitching) {
                setPendingWorkspaceSwitchId(null);
              }
            }}
          >
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Switch workspace</DialogTitle>
                <DialogDescription>
                  Active terminal/SFTP sessions are open. Choose how to switch to {pendingWorkspaceName}.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 sm:justify-end">
                <Button
                  variant="outline"
                  onClick={() => setPendingWorkspaceSwitchId(null)}
                  disabled={workspaceSwitching}
                >
                  Cancel
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    if (!pendingWorkspaceSwitchId) return;
                    void performWorkspaceSwitch(pendingWorkspaceSwitchId, false);
                  }}
                  disabled={workspaceSwitching}
                >
                  Keep sessions
                </Button>
                <Button
                  onClick={() => {
                    if (!pendingWorkspaceSwitchId) return;
                    void performWorkspaceSwitch(pendingWorkspaceSwitchId, true);
                  }}
                  disabled={workspaceSwitching}
                >
                  Close sessions
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          {/* Agent panel is embedded inline in MainArea */}
        </>
      }
    >
      {/* Terminal area */}
      {floatingTabs.length === 0 ? (
        // Empty state - no terminals
        <div className="relative h-full w-full bg-background flex items-center justify-center">
          <div className="text-center space-y-6 p-8 max-w-md">
            <div
              className="flex justify-center"
              style={{
                animation: 'scaleInElastic 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                filter: 'drop-shadow(0 0 40px var(--primary-glow))',
              }}
            >
              <KairoLogo stacked size="lg" />
            </div>
            <div className="flex flex-col gap-2 text-sm font-mono">
              <kbd className="px-4 py-3 bg-[var(--surface-2)] rounded-lg border border-[var(--border)] hover:bg-[var(--surface-3)] hover:scale-105 transition-all duration-200 cursor-default">
                <span className="text-text-tertiary">Press</span>{' '}
                <span className="text-primary">{shortcutLabel('command-palette')}</span>{' '}
                <span className="text-text-tertiary">to open command palette</span>
              </kbd>
              <kbd className="px-4 py-3 bg-[var(--surface-2)] rounded-lg border border-[var(--border)] hover:bg-[var(--surface-3)] hover:scale-105 transition-all duration-200 cursor-default">
                <span className="text-text-tertiary">Press</span>{' '}
                <span className="text-primary">{shortcutLabel('browse-hosts')}</span>{' '}
                <span className="text-text-tertiary">to browse hosts</span>
              </kbd>
              <kbd className="px-4 py-3 bg-[var(--surface-2)] rounded-lg border border-[var(--border)] hover:bg-[var(--surface-3)] hover:scale-105 transition-all duration-200 cursor-default">
                <span className="text-text-tertiary">Press</span>{' '}
                <span className="text-primary">{shortcutLabel('new-tab')}</span>{' '}
                <span className="text-text-tertiary">for new connection</span>
              </kbd>
            </div>
          </div>

          {/* Grid pattern overlay */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.06]"
            style={{
              backgroundImage: `
                linear-gradient(var(--border) 1px, transparent 1px),
                linear-gradient(90deg, var(--border) 1px, transparent 1px)
              `,
              backgroundSize: '32px 32px',
            }}
          />
        </div>
      ) : (
        // Render terminals
        <MainArea agentOpen={agentOpen} onAgentClose={() => setAgentOpen(false)} workspaceId={workspaceId} />
      )}

      <TransferProgress variant="floating" />
      <Toaster />

      {/* Update notifications */}
      <UpdateBanner state={updateState} actions={updateActions} />
      <UpdateReadyModal state={updateState} actions={updateActions} />
    </TerminalLayout>
  );
}
