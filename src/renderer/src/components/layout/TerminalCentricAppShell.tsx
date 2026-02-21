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
import { TerminalLayout } from './TerminalLayout';
import { FloatingTabBar } from './FloatingTabBar';
import { MiniToolbar } from './MiniToolbar';
import { CommandPalette } from './CommandPalette';
import { HostBrowserOverlay } from '@/features/hosts/HostBrowserOverlay';
import { MainArea } from './MainArea';
import { useSessionStore } from '@/stores/session-store';
import { useHostStore } from '@/stores/host-store';
import { useSettingsStore } from '@/stores/settings-store';
import { useTransferStore } from '@/stores/transfer-store';
import { Toaster } from '@/components/ui/sonner';
import { ArchTermLogoIcon } from '@/components/ui/logo';
import type { Workspace } from '@shared/types/workspace';

export function TerminalCentricAppShell() {
  const [workspaceId, setWorkspaceId] = useState<string>('');
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [hostBrowserOpen, setHostBrowserOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [snippetsOpen, setSnippetsOpen] = useState(false);
  const [keysOpen, setKeysOpen] = useState(false);

  const { updateProgress } = useTransferStore();
  const { settings, fetchSettings } = useSettingsStore();
  const { hosts } = useHostStore();

  const tabs = useSessionStore((s) => s.tabs);
  const activeTabId = useSessionStore((s) => s.activeTabId);
  const openTab = useSessionStore((s) => s.openTab);
  const setActiveTab = useSessionStore((s) => s.setActiveTab);
  const closeTab = useSessionStore((s) => s.closeTab);

  // Initialize workspace and settings
  useEffect(() => {
    window.workspaceApi.getActiveContext().then((ctx) => {
      if (ctx) setWorkspaceId((ctx as { workspace: Workspace }).workspace.id);
    });
    const offProgress = window.sftpApi.onProgress(updateProgress);
    fetchSettings();
    return offProgress;
  }, []);

  // Sync theme
  useEffect(() => {
    const theme = settings?.theme ?? 'dark';
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('archterm-theme', theme);
  }, [settings?.theme]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      // Cmd+K - Command Palette
      if (isMod && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }

      // Cmd+H - Host Browser
      if (isMod && e.key === 'h') {
        e.preventDefault();
        setHostBrowserOpen(true);
      }

      // Cmd+B - SFTP Browser (TODO: implement)
      if (isMod && e.key === 'b') {
        e.preventDefault();
        // Open SFTP browser overlay
      }

      // Cmd+; - Snippets
      if (isMod && e.key === ';') {
        e.preventDefault();
        setSnippetsOpen(true);
      }

      // Cmd+, - Settings
      if (isMod && e.key === ',') {
        e.preventDefault();
        setSettingsOpen(true);
      }

      // Cmd+T - New Connection
      if (isMod && e.key === 't') {
        e.preventDefault();
        setHostBrowserOpen(true);
      }

      // Cmd+L - Local Terminal
      if (isMod && e.key === 'l') {
        e.preventDefault();
        handleOpenLocalTerminal();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [settings?.promptStyle]);

  // Convert tabs to FloatingTabBar format
  const floatingTabs = Array.from(tabs.values())
    .filter((tab) => tab.tabType === 'terminal' || tab.tabType === 'sftp')
    .map((tab) => ({
      id: tab.tabId,
      title: tab.label,
      hostname: tab.hostname,
      status: tab.status as 'connected' | 'connecting' | 'disconnected',
      isActive: tab.tabId === activeTabId,
    }));

  // Convert hosts to HostBrowserOverlay format
  const browserHosts = hosts.map((host) => {
    // Check if host has an active connection
    const activeConnection = Array.from(tabs.values()).find(
      (tab) => tab.hostId === host.id && tab.tabType === 'terminal'
    );

    return {
      id: host.id,
      hostname: host.label,
      address: host.hostname,
      username: host.username,
      description: host.notes,
      status: activeConnection
        ? (activeConnection.status as 'connected' | 'connecting' | 'disconnected')
        : ('disconnected' as const),
      folder: host.folder,
      tags: host.tags,
    };
  });

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
        // TODO: Open SFTP browser
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
      onExecute: () => setKeysOpen(true),
    },
    // Settings
    {
      id: 'settings',
      title: 'Settings',
      description: 'Configure ArchTerm',
      category: 'settings',
      shortcut: 'Cmd+,',
      keywords: ['settings', 'preferences', 'config'],
      onExecute: () => setSettingsOpen(true),
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
        // TODO: Implement split
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
        // TODO: Implement split
      },
    },
  ];

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
        host: {
          hostname: host.hostname,
          port: host.port,
          username: host.username,
          privateKey: host.privateKeyId,
        },
        promptStyle: settings?.promptStyle,
      });
    }
  };

  const handleNewTab = () => {
    setHostBrowserOpen(true);
  };

  const handleOpenLocalTerminal = () => {
    const sessionId = `local-${Date.now()}`;
    openTab({
      tabId: sessionId,
      tabType: 'terminal',
      label: 'Local Terminal',
      sessionId,
      status: 'connecting',
    });
    window.sshApi.connect(sessionId, { type: 'local', promptStyle: settings?.promptStyle });
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
          />
        ) : undefined
      }
      toolbar={
        <MiniToolbar
          onBrowseHosts={() => setHostBrowserOpen(true)}
          onBrowseFiles={() => {
            // TODO: Open SFTP browser
          }}
          onSnippets={() => setSnippetsOpen(true)}
          onKeys={() => setKeysOpen(true)}
          onCommandPalette={() => setCommandPaletteOpen(true)}
          onSettings={() => setSettingsOpen(true)}
        />
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
            hosts={browserHosts}
            onConnect={handleConnectHost}
            onNewHost={() => {
              // TODO: Open new host form
              setHostBrowserOpen(false);
            }}
          />
          {/* TODO: Add other overlays (Settings, Snippets, Keys, SFTP) */}
        </>
      }
    >
      {/* Terminal area */}
      {floatingTabs.length === 0 ? (
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

      <Toaster />
    </TerminalLayout>
  );
}
