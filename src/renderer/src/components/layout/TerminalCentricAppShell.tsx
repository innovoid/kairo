/**
 * Terminal-Centric AppShell
 *
 * Modern reimagining of ArchTerm's layout with refined brutalist design.
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

import { useEffect, useState } from 'react';
import { useHotkey } from '@tanstack/react-hotkeys';
import type { RegisterableHotkey } from '@tanstack/hotkeys';
import { getHotkey } from '@/lib/hotkeys-registry';
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
import { MainArea } from './MainArea';
import { useSessionStore } from '@/stores/session-store';
import { useHostStore } from '@/stores/host-store';
import { useSettingsStore } from '@/stores/settings-store';
import { useTransferStore } from '@/stores/transfer-store';
import { useRecordingStore } from '@/stores/recording-store';
import { useBroadcastStore } from '@/stores/broadcast-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useAutoUpdater } from '@/features/updater/useAutoUpdater';
import { UpdateBanner, UpdateReadyModal } from '@/features/updater/UpdateNotification';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { ArchTermLogo } from '@/components/ui/ArchTermLogo';
import type { Workspace } from '@shared/types/workspace';
import type { Host } from '@shared/types/hosts';
import type { SettingsTab } from '@/features/settings/SettingsPage';

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

  // Wire up auto-updater toast notifications
  const [updateState, updateActions] = useAutoUpdater();

  const { updateProgress } = useTransferStore();
  const { settings, fetchSettings } = useSettingsStore();
  const { hosts, fetchHosts } = useHostStore();
  const { workspaces, activeWorkspace, fetchWorkspaces } = useWorkspaceStore();
  const { isRecording, startRecording, stopRecording } = useRecordingStore();
  const { enabled: broadcastEnabled, toggle: toggleBroadcastEnabled, addTarget } = useBroadcastStore();

  const tabs = useSessionStore((s) => s.tabs);
  const activeTabId = useSessionStore((s) => s.activeTabId);
  const openTab = useSessionStore((s) => s.openTab);
  const setActiveTab = useSessionStore((s) => s.setActiveTab);
  const closeTab = useSessionStore((s) => s.closeTab);
  const splitPane = useSessionStore((s) => s.splitPane);
  const activeTab = activeTabId ? tabs.get(activeTabId) : null;
  const resolveHotkey = (id: string): RegisterableHotkey => {
    const definition = getHotkey(id);
    if (!definition) throw new Error(`Missing hotkey definition: ${id}`);
    return definition.key as RegisterableHotkey;
  };

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

  const handleConnectHost = (hostId: string) => {
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
        // password intentionally omitted — fetched from host store at connect/reconnect time
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
      window.sshApi.connect(sessionId, { ...connectConfig, password: host.password ?? undefined });
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

  const handleStartRecording = async (tabId: string) => {
    const tab = tabs.get(tabId);
    if (!tab?.sessionId) return;

    try {
      await window.recordingApi.start(tab.sessionId, 80, 24); // Default terminal size
      startRecording(tab.sessionId);
      toast.success('Recording started');
    } catch (error) {
      toast.error('Failed to start recording');
    }
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

  const handleWorkspaceSwitch = async (nextWorkspaceId: string) => {
    if (!nextWorkspaceId || nextWorkspaceId === workspaceId) return;

    try {
      await window.workspaceApi.switchActive(nextWorkspaceId);
      setWorkspaceId(nextWorkspaceId);
      await Promise.all([fetchHosts(nextWorkspaceId), fetchSettings(), fetchWorkspaces()]);

      setHostBrowserOpen(false);
      setHostFormOpen(false);
      setKeysOpen(false);
      setTeamOpen(false);
      setSettingsOpen(false);

      const workspaceName =
        workspaces.find((workspace) => workspace.id === nextWorkspaceId)?.name ?? 'workspace';
      toast.success(`Switched to ${workspaceName}`);
    } catch (error) {
      toast.error((error as Error).message || 'Failed to switch workspace');
    }
  };

  const handleStopRecording = async (tabId: string) => {
    const tab = tabs.get(tabId);
    if (!tab?.sessionId) return;

    try {
      const filepath = await window.recordingApi.stop(tab.sessionId);
      stopRecording(tab.sessionId);
      if (filepath) {
        toast.success(`Recording saved: ${filepath}`);
      }
    } catch (error) {
      toast.error('Failed to stop recording');
    }
  };

  const handleSplitHorizontal = (tabId: string) => {
    const tab = tabs.get(tabId);
    if (!tab || tab.tabType !== 'terminal') return;

    const newSessionId = `local-${Date.now()}`;
    splitPane(tab.tabId, 'horizontal', newSessionId);

    if (tab.reconnectConfig?.type === 'ssh' && tab.reconnectConfig.hostId) {
      const host = hosts.find(h => h.id === tab.reconnectConfig!.hostId);
      window.sshApi.connect(newSessionId, {
        ...tab.reconnectConfig,
        password: host?.password ?? undefined,
      });
    } else {
      window.sshApi.connect(newSessionId, { type: 'local', promptStyle: settings?.promptStyle });
    }
  };

  const handleSplitVertical = (tabId: string) => {
    const tab = tabs.get(tabId);
    if (!tab || tab.tabType !== 'terminal') return;

    const newSessionId = `local-${Date.now()}`;
    splitPane(tab.tabId, 'vertical', newSessionId);

    if (tab.reconnectConfig?.type === 'ssh' && tab.reconnectConfig.hostId) {
      const host = hosts.find(h => h.id === tab.reconnectConfig!.hostId);
      window.sshApi.connect(newSessionId, {
        ...tab.reconnectConfig,
        password: host?.password ?? undefined,
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

  // Toggle Recording
  useHotkey(resolveHotkey('toggle-recording'), (e) => {
    if (isTerminalFocused()) return;
    e.preventDefault();
    if (activeTabId) {
      const tab = tabs.get(activeTabId);
      if (tab?.sessionId) {
        if (isRecording(tab.sessionId)) {
          handleStopRecording(activeTabId);
        } else {
          handleStartRecording(activeTabId);
        }
      }
    }
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
      status: tab.status as 'connected' | 'connecting' | 'disconnected',
      isActive: tab.tabId === activeTabId,
      sessionId: tab.sessionId,
      isRecording: tab.sessionId ? isRecording(tab.sessionId) : false,
    }));

  const workspaceOptions =
    e2eMode
      ? [{ id: 'e2e-workspace', name: 'E2E Workspace' }]
      : workspaces;

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
      shortcut: 'Cmd+H',
      keywords: ['hosts', 'browse', 'connections'],
      onExecute: () => setHostBrowserOpen(true),
    },
    {
      id: 'browse-files',
      title: 'Browse Files',
      description: 'Open SFTP browser',
      category: 'actions',
      shortcut: 'Cmd+B',
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
      shortcut: 'Cmd+;',
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
      description: 'Configure ArchTerm',
      category: 'settings',
      shortcut: 'Cmd+,',
      keywords: ['settings', 'preferences', 'config'],
      onExecute: () => handleOpenSettings('terminal'),
    },
    {
      id: 'ai-agent',
      title: 'AI Agent',
      description: 'Open AI agent sidebar',
      category: 'actions',
      shortcut: 'Cmd+Shift+A',
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
      shortcut: 'Cmd+T',
      keywords: ['new', 'terminal', 'tab'],
      onExecute: () => setHostBrowserOpen(true),
    },
    {
      id: 'local-terminal',
      title: 'Local Terminal',
      description: 'Open local terminal on this machine',
      category: 'terminal',
      shortcut: 'Cmd+L',
      keywords: ['local', 'terminal', 'shell', 'bash', 'zsh'],
      onExecute: handleOpenLocalTerminal,
    },
    {
      id: 'split-horizontal',
      title: 'Split Horizontal',
      description: 'Split terminal horizontally',
      category: 'terminal',
      shortcut: 'Cmd+D',
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
      shortcut: 'Cmd+Shift+D',
      keywords: ['split', 'vertical', 'pane'],
      onExecute: () => {
        if (activeTabId) handleSplitVertical(activeTabId);
      },
    },
  ];

  if (!workspaceId) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div
            className="inline-block animate-pulse mb-4"
            style={{ filter: 'drop-shadow(0 0 40px var(--primary-glow, rgba(16,185,129,0.4)))' }}
          >
            <ArchTermLogo iconOnly size="md" />
          </div>
          <p className="text-sm text-text-secondary">Loading workspace...</p>
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
            onStartRecording={handleStartRecording}
            onStopRecording={handleStopRecording}
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
          {hostFormOpen && (
            <>
              <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                onClick={handleCloseHostForm}
                aria-hidden="true"
              />
              <div className="fixed inset-y-0 right-0 h-screen">
                <HostForm
                  host={editingHost}
                  workspaceId={workspaceId}
                  onClose={handleCloseHostForm}
                />
              </div>
            </>
          )}
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
                filter: 'drop-shadow(0 0 40px rgba(16,185,129,0.35))',
              }}
            >
              <ArchTermLogo stacked size="lg" />
            </div>
            <div className="flex flex-col gap-2 text-sm font-mono">
              <kbd className="px-4 py-3 bg-[var(--surface-2)] rounded-lg border border-[var(--border)] hover:bg-[var(--surface-3)] hover:scale-105 transition-all cursor-default">
                <span className="text-text-tertiary">Press</span>{' '}
                <span className="text-primary">Cmd+K</span>{' '}
                <span className="text-text-tertiary">to open command palette</span>
              </kbd>
              <kbd className="px-4 py-3 bg-[var(--surface-2)] rounded-lg border border-[var(--border)] hover:bg-[var(--surface-3)] hover:scale-105 transition-all cursor-default">
                <span className="text-text-tertiary">Press</span>{' '}
                <span className="text-primary">Cmd+H</span>{' '}
                <span className="text-text-tertiary">to browse hosts</span>
              </kbd>
              <kbd className="px-4 py-3 bg-[var(--surface-2)] rounded-lg border border-[var(--border)] hover:bg-[var(--surface-3)] hover:scale-105 transition-all cursor-default">
                <span className="text-text-tertiary">Press</span>{' '}
                <span className="text-primary">Cmd+T</span>{' '}
                <span className="text-text-tertiary">for new connection</span>
              </kbd>
            </div>
          </div>

          {/* Grid pattern overlay */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.02]"
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
