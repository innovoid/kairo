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
import { isE2EMode } from '@/lib/e2e';
import { TerminalLayout } from './TerminalLayout';
import { FloatingTabBar } from './FloatingTabBar';
import { CommandPalette } from './CommandPalette';
import { HostBrowserOverlay } from '@/features/hosts/HostBrowserOverlay';
import { TeamOverlay } from '@/features/team/TeamOverlay';
import { SettingsOverlay } from '@/features/settings/SettingsOverlay';
import { TransferProgress } from '@/features/sftp/TransferProgress';
import { MainArea } from './MainArea';
import { useSessionStore } from '@/stores/session-store';
import { useHostStore } from '@/stores/host-store';
import { useSettingsStore } from '@/stores/settings-store';
import { useTransferStore } from '@/stores/transfer-store';
import { useRecordingStore } from '@/stores/recording-store';
import { useBroadcastStore } from '@/stores/broadcast-store';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { ArchTermLogoIcon } from '@/components/ui/logo';
import type { Workspace } from '@shared/types/workspace';
import type { SettingsTab } from '@/features/settings/SettingsPage';

export function TerminalCentricAppShell() {
  const e2eMode = isE2EMode();
  const [workspaceId, setWorkspaceId] = useState<string>('');
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [hostBrowserOpen, setHostBrowserOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<SettingsTab>('terminal');

  const { updateProgress } = useTransferStore();
  const { settings, fetchSettings } = useSettingsStore();
  const { hosts, fetchHosts } = useHostStore();
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
    }

    const offProgress = window.sftpApi.onProgress(updateProgress);
    fetchSettings();
    return offProgress;
  }, [e2eMode, updateProgress, fetchSettings]);

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
    openTab({
      tabId: sessionId,
      tabType: 'terminal',
      label: 'Local Terminal',
      sessionId,
      status: 'connecting',
    });
    void window.sshApi.connect(sessionId, { type: 'local', promptStyle: settings?.promptStyle });
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
      openTab({
        tabId: sessionId,
        tabType: 'terminal',
        label: host.label,
        hostId: host.id,
        hostname: host.hostname,
        sessionId,
        status: 'connecting',
      });
      window.sshApi.connect(sessionId, {
        type: 'ssh',
        host: host.hostname,
        port: host.port,
        username: host.username,
        authType: host.authType,
        password: host.password ?? undefined,
        privateKeyId: host.keyId ?? undefined,
        hostId: host.id,
        promptStyle: settings?.promptStyle,
      });
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
    if (tab?.sessionId) {
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
    window.sshApi.connect(newSessionId, { type: 'local', promptStyle: settings?.promptStyle });
  };

  const handleSplitVertical = (tabId: string) => {
    const tab = tabs.get(tabId);
    if (!tab || tab.tabType !== 'terminal') return;

    const newSessionId = `local-${Date.now()}`;
    splitPane(tab.tabId, 'vertical', newSessionId);
    window.sshApi.connect(newSessionId, { type: 'local', promptStyle: settings?.promptStyle });
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
    e.preventDefault();
    setCommandPaletteOpen(true);
  });

  // Browse Hosts
  useHotkey(resolveHotkey('browse-hosts'), (e) => {
    e.preventDefault();
    setHostBrowserOpen(true);
  });

  // New Connection
  useHotkey(resolveHotkey('new-tab'), (e) => {
    e.preventDefault();
    setHostBrowserOpen(true);
  });

  // Local Terminal
  useHotkey(resolveHotkey('local-terminal'), (e) => {
    e.preventDefault();
    handleOpenLocalTerminal();
  });

  // Snippets
  useHotkey(resolveHotkey('snippets'), (e) => {
    e.preventDefault();
    openTab({
      tabId: 'snippets',
      tabType: 'snippets',
      label: 'Snippets',
      closable: false,
    });
  });

  // Settings
  useHotkey(resolveHotkey('settings'), (e) => {
    e.preventDefault();
    handleOpenSettings('terminal');
  });

  // Open SFTP
  useHotkey(resolveHotkey('open-sftp'), (e) => {
    e.preventDefault();
    if (activeTabId) handleOpenSftp(activeTabId);
  });

  // Toggle Recording
  useHotkey(resolveHotkey('toggle-recording'), (e) => {
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
    e.preventDefault();
    if (activeTabId) handleToggleBroadcast(activeTabId);
  });

  // Close Tab
  useHotkey(resolveHotkey('close-tab'), (e) => {
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
      onExecute: () => {
        openTab({
          tabId: 'snippets',
          tabType: 'snippets',
          label: 'Snippets',
          closable: false,
        });
      },
    },
    {
      id: 'ssh-keys',
      title: 'SSH Keys',
      description: 'Manage SSH keys',
      category: 'actions',
      keywords: ['keys', 'ssh', 'authentication'],
      onExecute: () => {
        toast.info('SSH key manager is currently in workspace flow.');
      },
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
            style={{ filter: 'drop-shadow(0 0 40px rgba(59, 130, 246, 0.4))' }}
          >
            <ArchTermLogoIcon size={64} />
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
            currentWorkspace="Default"
            workspaces={['Default', 'Production', 'Development']}
            onTabClick={handleTabClick}
            onTabClose={handleTabClose}
            onNewTab={handleNewTab}
            onWorkspaceChange={(workspace) => {
              // TODO: Implement workspace switching
              console.log('Switch workspace:', workspace);
            }}
            onBrowseHosts={() => setHostBrowserOpen(true)}
            onBrowseFiles={() => {
              if (!activeTabId) {
                toast.info('Open a terminal tab first');
                return;
              }
              handleOpenSftp(activeTabId);
            }}
            onSnippets={() =>
              openTab({
                tabId: 'snippets',
                tabType: 'snippets',
                label: 'Snippets',
                closable: false,
              })
            }
            onKeys={() => {
              toast.info('SSH key manager is currently in workspace flow.');
            }}
            onCommandPalette={() => setCommandPaletteOpen(true)}
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
              // TODO: Open new host form
              setHostBrowserOpen(false);
            }}
          />
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
        </>
      }
    >
      {/* Terminal area */}
      {floatingTabs.length === 0 && activeTab?.tabType !== 'snippets' ? (
        // Empty state - no terminals
        <div className="relative h-full w-full bg-background flex items-center justify-center">
          <div className="text-center space-y-6 p-8 max-w-md">
            <div
              className="inline-block"
              style={{
                animation: 'scaleInElastic 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                filter: 'drop-shadow(0 0 40px rgba(59, 130, 246, 0.4))',
              }}
            >
              <ArchTermLogoIcon size={80} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground tracking-tight mb-2">
                ArchTerm
              </h1>
              <p className="text-text-secondary">
                Terminal-centric SSH client with refined brutalist design
              </p>
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
        <MainArea />
      )}

      <TransferProgress variant="floating" />
      <Toaster />
    </TerminalLayout>
  );
}
