/**
 * Terminal-Centric Layout Demo
 *
 * This example demonstrates the refined brutalist aesthetic with:
 * - Full viewport terminals
 * - Floating glass morphism UI
 * - Dramatic animations and micro-interactions
 * - Premium visual details
 * - Accessibility-first design
 *
 * Design Direction: "Refined Technical Brutalism"
 */

import * as React from 'react';
import { TerminalLayout } from '@/components/layout/TerminalLayout';
import { FloatingTabBar } from '@/components/layout/FloatingTabBar';
import { MiniToolbar } from '@/components/layout/MiniToolbar';
import { CommandPalette } from '@/components/layout/CommandPalette';
import { HostBrowserOverlay } from '@/features/hosts/HostBrowserOverlay';

// Example data
const exampleTabs = [
  {
    id: '1',
    title: 'prod-server-01',
    hostname: 'prod-server-01',
    status: 'connected' as const,
    isActive: true,
  },
  {
    id: '2',
    title: 'dev-server',
    hostname: 'dev-server',
    status: 'connected' as const,
    isActive: false,
  },
  {
    id: '3',
    title: 'staging-db',
    hostname: 'staging-db',
    status: 'connecting' as const,
    isActive: false,
  },
];

const exampleHosts = [
  {
    id: '1',
    hostname: 'prod-server-01',
    address: '192.168.1.100',
    username: 'deploy',
    description: 'Production web server',
    status: 'connected' as const,
    folder: 'Production',
    tags: ['web', 'nginx', 'production'],
  },
  {
    id: '2',
    hostname: 'dev-server',
    address: '192.168.1.101',
    username: 'developer',
    description: 'Development environment',
    status: 'connected' as const,
    folder: 'Development',
    tags: ['dev', 'testing'],
  },
  {
    id: '3',
    hostname: 'staging-db',
    address: '192.168.1.102',
    username: 'postgres',
    description: 'Staging database server',
    status: 'connecting' as const,
    folder: 'Staging',
    tags: ['database', 'postgres', 'staging'],
  },
  {
    id: '4',
    hostname: 'build-agent-01',
    address: '192.168.1.103',
    username: 'ci',
    description: 'CI/CD build agent',
    status: 'disconnected' as const,
    folder: 'Infrastructure',
    tags: ['ci', 'jenkins', 'docker'],
  },
];

const exampleCommands = [
  {
    id: 'connect-prod',
    title: 'prod-server-01',
    description: 'user@192.168.1.100 • Connected',
    category: 'hosts',
    shortcut: 'Cmd+1',
    keywords: ['ssh', 'connect', 'prod'],
    onExecute: () => console.log('Connect to prod-server-01'),
  },
  {
    id: 'connect-dev',
    title: 'dev-server',
    description: 'developer@192.168.1.101 • Connected',
    category: 'hosts',
    shortcut: 'Cmd+2',
    keywords: ['ssh', 'connect', 'dev'],
    onExecute: () => console.log('Connect to dev-server'),
  },
  {
    id: 'browse-files',
    title: 'Browse Files',
    description: 'Open SFTP browser',
    category: 'actions',
    shortcut: 'Cmd+B',
    keywords: ['sftp', 'files', 'browser'],
    onExecute: () => console.log('Open SFTP browser'),
  },
  {
    id: 'snippets',
    title: 'Snippets',
    description: 'Manage saved commands',
    category: 'actions',
    shortcut: 'Cmd+;',
    keywords: ['snippets', 'commands', 'saved'],
    onExecute: () => console.log('Open snippets'),
  },
  {
    id: 'ssh-keys',
    title: 'SSH Keys',
    description: 'Manage SSH keys',
    category: 'actions',
    keywords: ['keys', 'ssh', 'authentication'],
    onExecute: () => console.log('Open SSH keys'),
  },
  {
    id: 'settings',
    title: 'Settings',
    description: 'Configure ArchTerm',
    category: 'settings',
    shortcut: 'Cmd+,',
    keywords: ['settings', 'preferences', 'config'],
    onExecute: () => console.log('Open settings'),
  },
  {
    id: 'split-horizontal',
    title: 'Split Horizontal',
    description: 'Split terminal horizontally',
    category: 'terminal',
    shortcut: 'Cmd+D',
    keywords: ['split', 'horizontal', 'pane'],
    onExecute: () => console.log('Split horizontal'),
  },
  {
    id: 'split-vertical',
    title: 'Split Vertical',
    description: 'Split terminal vertically',
    category: 'terminal',
    shortcut: 'Cmd+Shift+D',
    keywords: ['split', 'vertical', 'pane'],
    onExecute: () => console.log('Split vertical'),
  },
];

export function TerminalCentricLayoutDemo() {
  const [commandPaletteOpen, setCommandPaletteOpen] = React.useState(false);
  const [hostBrowserOpen, setHostBrowserOpen] = React.useState(false);

  // Cmd+K to open command palette
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'h') {
        e.preventDefault();
        setHostBrowserOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <TerminalLayout
      tabBar={
        <FloatingTabBar
          tabs={exampleTabs}
          currentWorkspace="Default"
          workspaces={['Default', 'Production', 'Development']}
          onTabClick={(id) => console.log('Tab clicked:', id)}
          onTabClose={(id) => console.log('Tab closed:', id)}
          onNewTab={() => console.log('New tab')}
          onWorkspaceChange={(workspace) => console.log('Workspace changed:', workspace)}
        />
      }
      toolbar={
        <MiniToolbar
          onBrowseHosts={() => setHostBrowserOpen(true)}
          onBrowseFiles={() => console.log('Browse files')}
          onSnippets={() => console.log('Snippets')}
          onKeys={() => console.log('SSH Keys')}
          onCommandPalette={() => setCommandPaletteOpen(true)}
          onSettings={() => console.log('Settings')}
        />
      }
      overlays={
        <>
          <CommandPalette
            open={commandPaletteOpen}
            onOpenChange={setCommandPaletteOpen}
            commands={exampleCommands}
          />
          <HostBrowserOverlay
            open={hostBrowserOpen}
            onOpenChange={setHostBrowserOpen}
            hosts={exampleHosts}
            onConnect={(id) => console.log('Connect to:', id)}
            onNewHost={() => console.log('New host')}
          />
        </>
      }
    >
      {/* Terminal content */}
      <div className="relative h-full w-full bg-background">
        {/* Demo terminal content */}
        <div className="flex items-center justify-center h-full">
          <div className="text-center space-y-4 p-8">
            <div className="inline-flex items-center justify-center h-20 w-20 rounded-2xl bg-gradient-to-br from-primary to-cyan-400 shadow-[0_0_40px_rgba(59,130,246,0.4)]">
              <span className="text-3xl font-bold text-white">AT</span>
            </div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">
              ArchTerm
            </h1>
            <p className="text-text-secondary max-w-md">
              Terminal-centric SSH client with refined brutalist design
            </p>
            <div className="flex flex-col gap-2 mt-6 text-sm text-text-tertiary font-mono">
              <kbd className="px-3 py-2 bg-[var(--surface-2)] rounded-lg border border-[var(--border)]">
                Cmd+K to open command palette
              </kbd>
              <kbd className="px-3 py-2 bg-[var(--surface-2)] rounded-lg border border-[var(--border)]">
                Cmd+H to browse hosts
              </kbd>
              <kbd className="px-3 py-2 bg-[var(--surface-2)] rounded-lg border border-[var(--border)]">
                Cmd+T for new connection
              </kbd>
            </div>
          </div>
        </div>

        {/* Subtle grid pattern overlay */}
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
    </TerminalLayout>
  );
}

// Export for easy testing
export default TerminalCentricLayoutDemo;
