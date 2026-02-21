# Terminal-Centric Layout Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform ArchTerm from sidebar-based to terminal-centric layout with command palette, overlays, and AI integration

**Architecture:** Remove 260px sidebar, terminals fill viewport, floating tab bar, command palette (Cmd+K) as universal interface, full-screen overlays for management, mini toolbar for visual access

**Tech Stack:** React 18, TypeScript, Tailwind CSS, xterm.js, Radix UI, zustand, @dnd-kit

**Design Reference:** `docs/plans/2025-02-21-terminal-centric-layout-redesign.md`

---

## Implementation Strategy

This is a **7-phase implementation** that will take approximately 6 weeks. Each phase builds on the previous one and can be tested independently.

**Critical Path:**
Phase 1 (Layout) → Phase 2 (Overlays) → Phase 3 (SFTP) → Phase 4 (Splits) → Phase 5 (AI) → Phase 6 (Polish) → Phase 7 (A11y)

**Testing Strategy:**
- Manual testing after each task
- Integration testing after each phase
- Accessibility testing in Phase 7
- No unit tests for UI components (manual verification sufficient)

---

## Phase 1: Core Layout Foundation (Week 1)

**Goal:** Remove sidebar, terminals fill viewport, basic command palette, floating tab bar

### Task 1: Create Layout Foundation Components

**Files:**
- Create: `src/renderer/src/components/layout/TerminalLayout.tsx`
- Create: `src/renderer/src/components/layout/FloatingTabBar.tsx`
- Create: `src/renderer/src/components/ui/overlay.tsx`

**Step 1: Create TerminalLayout component**

Create `src/renderer/src/components/layout/TerminalLayout.tsx`:

```tsx
import { ReactNode } from 'react';

interface TerminalLayoutProps {
  children: ReactNode;
  tabBar?: ReactNode;
  toolbar?: ReactNode;
  overlays?: ReactNode;
}

export function TerminalLayout({ children, tabBar, toolbar, overlays }: TerminalLayoutProps) {
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-background">
      {/* Terminal fills viewport (z-0) */}
      <div className="absolute inset-0 z-0">
        {children}
      </div>

      {/* Floating UI elements (z-10) */}
      {tabBar && (
        <div className="absolute top-0 left-0 right-0 z-10">
          {tabBar}
        </div>
      )}

      {toolbar && (
        <div className="absolute top-4 right-4 z-10">
          {toolbar}
        </div>
      )}

      {/* Overlays (z-1000) */}
      {overlays && (
        <div className="absolute inset-0 z-[1000] pointer-events-none">
          <div className="pointer-events-auto">
            {overlays}
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Create base Overlay component**

Create `src/renderer/src/components/ui/overlay.tsx`:

```tsx
import { ReactNode, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface OverlayProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

export function Overlay({ open, onClose, children, className }: OverlayProps) {
  // Close on ESC
  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center p-6">
        <div
          className={cn(
            'relative bg-[var(--surface-2)] border border-[var(--border)] rounded-2xl shadow-2xl',
            'max-w-[1200px] max-h-[80vh] w-full',
            'animate-in zoom-in-95 fade-in duration-300',
            className
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </>
  );
}

interface OverlayHeaderProps {
  title: string;
  onClose: () => void;
  children?: ReactNode;
}

export function OverlayHeader({ title, onClose, children }: OverlayHeaderProps) {
  return (
    <div className="flex items-center justify-between h-16 px-6 border-b border-[var(--border-subtle)]">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="flex items-center gap-4">
        {children}
        <button
          onClick={onClose}
          className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-[var(--surface-3)] transition-colors"
          aria-label="Close"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M12.854 3.646a.5.5 0 0 0-.708-.708L8 6.293 3.854 2.646a.5.5 0 1 0-.708.708L7.293 8l-4.147 4.146a.5.5 0 0 0 .708.708L8 8.707l4.146 4.147a.5.5 0 0 0 .708-.708L8.707 8l4.147-4.146z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export function OverlayContent({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('overflow-y-auto', className)}>
      {children}
    </div>
  );
}

export function OverlayFooter({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-between h-14 px-6 border-t border-[var(--border-subtle)]">
      {children}
    </div>
  );
}
```

**Step 3: Create FloatingTabBar component**

Create `src/renderer/src/components/layout/FloatingTabBar.tsx`:

```tsx
import { useSessionStore } from '@/stores/session-store';
import { cn } from '@/lib/utils';
import { Server, X } from 'lucide-react';

export function FloatingTabBar() {
  const tabs = useSessionStore((s) => s.tabs);
  const activeTabId = useSessionStore((s) => s.activeTabId);
  const setActiveTab = useSessionStore((s) => s.setActiveTab);
  const closeTab = useSessionStore((s) => s.closeTab);

  const terminalTabs = Array.from(tabs.values()).filter(t => t.tabType === 'terminal');

  return (
    <div className="h-12 bg-[var(--surface-1)]/80 backdrop-blur-lg border-b border-[var(--border-subtle)] flex items-center px-2 gap-1">
      {/* Tabs */}
      {terminalTabs.map(tab => (
        <TabItem
          key={tab.tabId}
          label={tab.label}
          active={tab.tabId === activeTabId}
          status={tab.status}
          onClick={() => setActiveTab(tab.tabId)}
          onClose={() => closeTab(tab.tabId)}
        />
      ))}

      {/* New tab button */}
      <button
        className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-[var(--surface-3)] transition-colors"
        aria-label="New connection"
      >
        <span className="text-lg">+</span>
      </button>

      {/* Workspace selector (right side) */}
      <div className="ml-auto flex items-center gap-2">
        <button className="px-3 h-8 text-sm text-[var(--text-secondary)] hover:text-foreground rounded-md hover:bg-[var(--surface-3)] transition-colors">
          Production ▼
        </button>
      </div>
    </div>
  );
}

interface TabItemProps {
  label: string;
  active: boolean;
  status?: 'connected' | 'connecting' | 'disconnected';
  onClick: () => void;
  onClose: () => void;
}

function TabItem({ label, active, status, onClick, onClose }: TabItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative flex items-center gap-2 h-8 px-3 rounded-md transition-all duration-200',
        'max-w-[200px] min-w-[120px]',
        active
          ? 'bg-[var(--surface-2)] text-[var(--primary)] border-b-2 border-[var(--primary)]'
          : 'text-[var(--text-secondary)] hover:text-foreground hover:bg-[var(--surface-2)]'
      )}
    >
      {/* Status indicator */}
      {status && (
        <span className={cn(
          'h-2 w-2 rounded-full',
          status === 'connected' && 'bg-[var(--success)]',
          status === 'connecting' && 'bg-[var(--warning)] animate-pulse',
          status === 'disconnected' && 'bg-[var(--text-tertiary)]'
        )} />
      )}

      {/* Icon */}
      <Server className="h-4 w-4 flex-shrink-0" />

      {/* Label */}
      <span className="text-sm truncate flex-1">{label}</span>

      {/* Close button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className={cn(
          'h-4 w-4 flex items-center justify-center rounded hover:bg-[var(--surface-3)]',
          active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        )}
        aria-label="Close tab"
      >
        <X className="h-3 w-3" />
      </button>
    </button>
  );
}
```

**Step 4: Test components**

Run: `npm run dev`
Expected: App should compile without errors

**Step 5: Commit**

```bash
git add src/renderer/src/components/layout/TerminalLayout.tsx
git add src/renderer/src/components/layout/FloatingTabBar.tsx
git add src/renderer/src/components/ui/overlay.tsx
git commit -m "feat: add terminal-centric layout foundation components

- TerminalLayout: Full-viewport container with z-index layers
- FloatingTabBar: Semi-transparent tab bar for terminal sessions
- Overlay: Reusable full-screen overlay component

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 2: Update AppShell to Use New Layout

**Files:**
- Modify: `src/renderer/src/components/layout/AppShell.tsx`

**Step 1: Update AppShell to remove sidebar**

Replace the current layout structure in `AppShell.tsx`:

```tsx
// Remove Sidebar import
// import { Sidebar } from './Sidebar';

// Add new imports
import { TerminalLayout } from './TerminalLayout';
import { FloatingTabBar } from './FloatingTabBar';

// ... existing code ...

return (
  <TerminalLayout
    tabBar={<FloatingTabBar />}
    toolbar={null} // Will add mini toolbar in Phase 2
    overlays={
      <>
        <CommandPalette
          open={commandPaletteOpen}
          onOpenChange={setCommandPaletteOpen}
          onOpenSettings={handleGoSettings}
          onOpenKeys={handleGoKeys}
        />
        {/* More overlays will be added in Phase 2 */}
      </>
    }
  >
    {/* Terminal content area */}
    <div className="h-full w-full">
      {(activeTab?.tabType === 'terminal' || activeTab?.tabType === 'sftp') && <MainArea />}

      {/* Temporary: Other views will become overlays in Phase 2 */}
      {activeTab?.tabType === 'hosts' && (
        <div className="p-8">
          <HostsGrid
            workspaceId={workspaceId}
            onAddHost={handleAddHost}
            onEditHost={handleEditHost}
            onWorkspaceChange={handleWorkspaceChange}
          />
        </div>
      )}
      {activeTab?.tabType === 'keys' && (
        <div className="p-8">
          <KeysPage
            workspaceId={workspaceId}
            showImportPanel={activePanel === 'import-key'}
            onOpenImport={handleOpenImportKey}
            onCloseImport={handleClosePanel}
          />
        </div>
      )}
      {activeTab?.tabType === 'settings' && (
        <div className="p-8">
          <SettingsPage
            activeTab={activeTab.settingsTab ?? 'terminal'}
            onTabChange={(tab) => useSessionStore.getState().updateSettingsTab(tab as SettingsTab)}
            workspaceId={workspaceId}
          />
        </div>
      )}
    </div>

    <Toaster />
  </TerminalLayout>
);
```

**Step 2: Remove StatusBar and TabBar**

Comment out or remove:
- `<StatusBar />` component
- Old `<TabBar />` component
- Sidebar-related handlers (keep for now, will be used by command palette)

**Step 3: Test new layout**

Run: `npm run dev`
Expected:
- Sidebar gone, terminals fill viewport
- Floating tab bar at top
- 260px horizontal space reclaimed
- Command palette still works (Cmd+K)

**Step 4: Commit**

```bash
git add src/renderer/src/components/layout/AppShell.tsx
git commit -m "feat: integrate terminal-centric layout in AppShell

- Remove 260px sidebar
- Terminals now fill full viewport
- Add floating tab bar at top
- Temporary rendering for non-terminal views

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 3: Enhanced Command Palette Foundation

**Files:**
- Modify: `src/renderer/src/features/command-palette/CommandPalette.tsx`
- Create: `src/renderer/src/hooks/use-command-palette-actions.ts`

**Step 1: Create command palette actions hook**

Create `src/renderer/src/hooks/use-command-palette-actions.ts`:

```tsx
import { useCallback } from 'react';
import { useSessionStore } from '@/stores/session-store';
import { useHostStore } from '@/stores/host-store';

export interface CommandAction {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  category: 'hosts' | 'files' | 'snippets' | 'keys' | 'settings' | 'terminal' | 'ai';
  shortcut?: string;
  keywords?: string[];
  onExecute: () => void;
}

export function useCommandPaletteActions() {
  const { hosts } = useHostStore();
  const { openTab } = useSessionStore();

  const connectToHost = useCallback((hostId: string, hostname: string) => {
    const sessionId = `ssh-${Date.now()}`;
    openTab({
      tabId: sessionId,
      tabType: 'terminal',
      label: hostname,
      sessionId,
      status: 'connecting',
    });
    // Connection logic handled by session store
  }, [openTab]);

  const actions: CommandAction[] = [
    // Host connections
    ...Array.from(hosts.values()).map((host, index) => ({
      id: `host-${host.id}`,
      label: host.label,
      description: `${host.username}@${host.hostname}:${host.port}`,
      icon: '🖥',
      category: 'hosts' as const,
      shortcut: index < 9 ? `Cmd+${index + 1}` : undefined,
      keywords: ['ssh', 'connect', host.hostname, host.username],
      onExecute: () => connectToHost(host.id, host.label),
    })),

    // File operations
    {
      id: 'browse-files',
      label: 'Browse Files',
      description: 'Open SFTP browser',
      icon: '📂',
      category: 'files',
      shortcut: 'Cmd+B',
      keywords: ['sftp', 'files', 'browse', 'upload', 'download'],
      onExecute: () => {
        // Will open SFTP overlay in Phase 3
        console.log('Open SFTP browser');
      },
    },

    // Terminal operations
    {
      id: 'new-terminal',
      label: 'New Terminal',
      description: 'Open new terminal connection',
      icon: '➕',
      category: 'terminal',
      shortcut: 'Cmd+T',
      keywords: ['new', 'terminal', 'connection'],
      onExecute: () => {
        // Opens command palette filtered to hosts
        console.log('New terminal');
      },
    },

    {
      id: 'split-horizontal',
      label: 'Split Horizontal',
      description: 'Split terminal horizontally',
      icon: '⬌',
      category: 'terminal',
      shortcut: 'Cmd+Shift+D',
      keywords: ['split', 'horizontal', 'divide'],
      onExecute: () => {
        // Will be implemented in Phase 4
        console.log('Split horizontal');
      },
    },

    // Settings
    {
      id: 'settings',
      label: 'Settings',
      description: 'Open settings',
      icon: '⚙️',
      category: 'settings',
      shortcut: 'Cmd+,',
      keywords: ['settings', 'preferences', 'config'],
      onExecute: () => {
        openTab({ tabId: 'settings', tabType: 'settings', label: 'Settings' });
      },
    },

    // Placeholder for AI agents (Phase 5)
    {
      id: 'ask-ai',
      label: 'Ask AI Assistant',
      description: 'Open AI chat panel',
      icon: '💬',
      category: 'ai',
      shortcut: 'Cmd+Shift+A',
      keywords: ['ai', 'claude', 'assistant', 'help'],
      onExecute: () => {
        console.log('Open AI panel');
      },
    },
  ];

  return { actions };
}
```

**Step 2: Update CommandPalette to use actions**

Update `src/renderer/src/features/command-palette/CommandPalette.tsx` to use the new actions hook:

```tsx
import { useCommandPaletteActions } from '@/hooks/use-command-palette-actions';

// Inside CommandPalette component:
const { actions } = useCommandPaletteActions();

// Filter actions based on search query
const filteredActions = actions.filter(action => {
  const query = searchQuery.toLowerCase();
  return (
    action.label.toLowerCase().includes(query) ||
    action.description?.toLowerCase().includes(query) ||
    action.keywords?.some(k => k.toLowerCase().includes(query))
  );
});

// Group by category
const groupedActions = filteredActions.reduce((acc, action) => {
  if (!acc[action.category]) acc[action.category] = [];
  acc[action.category].push(action);
  return acc;
}, {} as Record<string, CommandAction[]>);

// Render grouped results
```

**Step 3: Test command palette**

Run: `npm run dev`
Actions:
1. Press `Cmd+K`
2. Type "prod" → Should show production hosts
3. Type "split" → Should show split commands
4. Press ESC to close

Expected: Command palette filters and groups results correctly

**Step 4: Commit**

```bash
git add src/renderer/src/hooks/use-command-palette-actions.ts
git add src/renderer/src/features/command-palette/CommandPalette.tsx
git commit -m "feat: enhance command palette with action system

- Create reusable action hook
- Add host connections, file ops, terminal ops, settings
- Filter and group actions by category
- Placeholder actions for future phases

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Phase 2: Overlays & Mini Toolbar (Week 2)

**Goal:** Replace sidebar views with full-screen overlays, add mini toolbar

### Task 4: Create Host Browser Overlay

**Files:**
- Create: `src/renderer/src/features/hosts/HostBrowserOverlay.tsx`
- Modify: `src/renderer/src/components/layout/AppShell.tsx`

**Step 1: Create HostBrowserOverlay component**

Create `src/renderer/src/features/hosts/HostBrowserOverlay.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { Overlay, OverlayHeader, OverlayContent, OverlayFooter } from '@/components/ui/overlay';
import { useHostStore } from '@/stores/host-store';
import { useSessionStore } from '@/stores/session-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Server, ChevronDown, Plus, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Host } from '@shared/types/hosts';

interface HostBrowserOverlayProps {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
}

export function HostBrowserOverlay({ open, onClose, workspaceId }: HostBrowserOverlayProps) {
  const { hosts, folders, fetchHosts } = useHostStore();
  const { openTab } = useSessionStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      fetchHosts(workspaceId);
    }
  }, [open, workspaceId]);

  function connectToHost(host: Host) {
    const sessionId = `ssh-${host.id}-${Date.now()}`;
    openTab({
      tabId: sessionId,
      tabType: 'terminal',
      label: host.label,
      sessionId,
      status: 'connecting',
    });
    // Connection handled by session store
    onClose();
  }

  function toggleFolder(folderId: string) {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }

  // Filter hosts by search
  const filteredHosts = Array.from(hosts.values()).filter(host =>
    host.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    host.hostname.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group by folder
  const hostsByFolder = filteredHosts.reduce((acc, host) => {
    const folderId = host.folderId || 'root';
    if (!acc[folderId]) acc[folderId] = [];
    acc[folderId].push(host);
    return acc;
  }, {} as Record<string, Host[]>);

  return (
    <Overlay open={open} onClose={onClose}>
      <OverlayHeader title="Hosts" onClose={onClose}>
        {/* Search */}
        <div className="relative w-[300px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-tertiary)]" />
          <Input
            placeholder="Search hosts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </OverlayHeader>

      <OverlayContent className="p-6 max-h-[calc(80vh-128px)]">
        {/* Folders */}
        <div className="space-y-2">
          {folders.map(folder => {
            const folderHosts = hostsByFolder[folder.id] || [];
            const isExpanded = expandedFolders.has(folder.id);

            return (
              <div key={folder.id}>
                {/* Folder header */}
                <button
                  onClick={() => toggleFolder(folder.id)}
                  className="flex items-center justify-between w-full px-4 py-3 rounded-lg hover:bg-[var(--surface-1)] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <ChevronDown className={cn(
                      'h-4 w-4 transition-transform',
                      !isExpanded && '-rotate-90'
                    )} />
                    <span className="text-sm font-medium">📁 {folder.name} ({folderHosts.length})</span>
                  </div>
                </button>

                {/* Folder hosts */}
                {isExpanded && (
                  <div className="ml-7 mt-1 space-y-1">
                    {folderHosts.map(host => (
                      <HostItem
                        key={host.id}
                        host={host}
                        onClick={() => connectToHost(host)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Root hosts (no folder) */}
          {hostsByFolder['root']?.map(host => (
            <HostItem
              key={host.id}
              host={host}
              onClick={() => connectToHost(host)}
            />
          ))}
        </div>

        {/* Empty state */}
        {filteredHosts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Server className="h-16 w-16 text-[var(--text-tertiary)] mb-4" />
            <h3 className="text-lg font-medium mb-2">No hosts found</h3>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              {searchQuery ? 'Try a different search term' : 'Add your first SSH host to get started'}
            </p>
            {!searchQuery && (
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Host
              </Button>
            )}
          </div>
        )}
      </OverlayContent>

      <OverlayFooter>
        <Button variant="ghost">
          <Plus className="h-4 w-4 mr-2" />
          Create Folder
        </Button>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Host
        </Button>
      </OverlayFooter>
    </Overlay>
  );
}

interface HostItemProps {
  host: Host;
  onClick: () => void;
}

function HostItem({ host, onClick }: HostItemProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-between w-full px-4 py-4 rounded-lg border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--card-hover)] hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
    >
      <div className="flex items-center gap-3">
        <Server className="h-5 w-5 text-[var(--text-tertiary)]" />
        <div className="text-left">
          <div className="font-medium text-sm">{host.label}</div>
          <div className="text-xs text-[var(--text-secondary)] font-mono">
            {host.username}@{host.hostname}:{host.port}
          </div>
        </div>
      </div>
      <span className="text-sm text-[var(--primary)]">→</span>
    </button>
  );
}
```

**Step 2: Add overlay to AppShell**

In `AppShell.tsx`, add state and integrate overlay:

```tsx
const [hostBrowserOpen, setHostBrowserOpen] = useState(false);

// In overlays section:
overlays={
  <>
    <CommandPalette ... />
    <HostBrowserOverlay
      open={hostBrowserOpen}
      onClose={() => setHostBrowserOpen(false)}
      workspaceId={workspaceId}
    />
  </>
}

// Update command palette action to open overlay:
// In useCommandPaletteActions, add:
onExecute: () => setHostBrowserOpen(true)
```

**Step 3: Test host browser overlay**

Run: `npm run dev`
Actions:
1. Press `Cmd+K` and select a host → Opens overlay
2. Search for hosts
3. Click host → Connects and closes overlay
4. Press ESC → Closes overlay

Expected: Full-screen overlay with host list, smooth animations

**Step 4: Commit**

```bash
git add src/renderer/src/features/hosts/HostBrowserOverlay.tsx
git add src/renderer/src/components/layout/AppShell.tsx
git commit -m "feat: add host browser full-screen overlay

- List view with expandable folders
- Search and filter hosts
- Connect on click, closes overlay
- Empty state with call-to-action
- Smooth 300ms animations

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 5: Create Mini Toolbar Component

**Files:**
- Create: `src/renderer/src/components/layout/MiniToolbar.tsx`
- Modify: `src/renderer/src/components/layout/AppShell.tsx`

**Step 1: Create MiniToolbar component**

Create `src/renderer/src/components/layout/MiniToolbar.tsx`:

```tsx
import { Server, Folder, Code2, Key, Search, Settings as SettingsIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MiniToolbarProps {
  onOpenHosts: () => void;
  onOpenFiles: () => void;
  onOpenSnippets: () => void;
  onOpenKeys: () => void;
  onOpenCommandPalette: () => void;
  onOpenSettings: () => void;
  filesEnabled?: boolean;
}

export function MiniToolbar({
  onOpenHosts,
  onOpenFiles,
  onOpenSnippets,
  onOpenKeys,
  onOpenCommandPalette,
  onOpenSettings,
  filesEnabled = false,
}: MiniToolbarProps) {
  return (
    <div className="bg-[var(--surface-1)]/90 backdrop-blur-lg border border-[var(--border)] rounded-full px-2 py-2 shadow-lg flex items-center gap-1">
      {/* Management tools */}
      <ToolbarButton
        icon={Server}
        label="Hosts"
        shortcut="Cmd+H"
        onClick={onOpenHosts}
      />
      <ToolbarButton
        icon={Folder}
        label="Browse Files"
        shortcut="Cmd+B"
        onClick={onOpenFiles}
        disabled={!filesEnabled}
      />
      <ToolbarButton
        icon={Code2}
        label="Snippets"
        shortcut="Cmd+;"
        onClick={onOpenSnippets}
      />
      <ToolbarButton
        icon={Key}
        label="SSH Keys"
        onClick={onOpenKeys}
      />

      {/* Divider */}
      <div className="h-6 w-px bg-[var(--border)]" />

      {/* System */}
      <ToolbarButton
        icon={Search}
        label="Command Palette"
        shortcut="Cmd+K"
        onClick={onOpenCommandPalette}
      />
      <ToolbarButton
        icon={SettingsIcon}
        label="Settings"
        shortcut="Cmd+,"
        onClick={onOpenSettings}
      />
    </div>
  );
}

interface ToolbarButtonProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
}

function ToolbarButton({ icon: Icon, label, shortcut, onClick, disabled }: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'h-8 w-8 flex items-center justify-center rounded-full transition-all duration-200',
        disabled
          ? 'opacity-40 cursor-not-allowed'
          : 'hover:bg-[var(--surface-3)] hover:scale-105 active:scale-95'
      )}
      aria-label={label}
      title={`${label}${shortcut ? ` (${shortcut})` : ''}`}
    >
      <Icon className="h-[18px] w-[18px]" />
    </button>
  );
}
```

**Step 2: Add toolbar to AppShell**

In `AppShell.tsx`:

```tsx
import { MiniToolbar } from './MiniToolbar';

// Add state
const [snippetsOpen, setSnippetsOpen] = useState(false);
const [keysOpen, setKeysOpen] = useState(false);
const [settingsOpen, setSettingsOpen] = useState(false);

// Check if SFTP is available (at least one terminal connected)
const hasConnectedTerminal = Array.from(tabs.values()).some(
  t => t.tabType === 'terminal' && t.status === 'connected'
);

// In TerminalLayout:
toolbar={
  <MiniToolbar
    onOpenHosts={() => setHostBrowserOpen(true)}
    onOpenFiles={() => {/* Will open SFTP in Phase 3 */}}
    onOpenSnippets={() => setSnippetsOpen(true)}
    onOpenKeys={() => setKeysOpen(true)}
    onOpenCommandPalette={() => setCommandPaletteOpen(true)}
    onOpenSettings={() => setSettingsOpen(true)}
    filesEnabled={hasConnectedTerminal}
  />
}
```

**Step 3: Test mini toolbar**

Run: `npm run dev`
Actions:
1. Hover over each toolbar button → Tooltips appear
2. Click Hosts button → Opens host browser overlay
3. Click Settings → Opens settings overlay
4. SFTP button disabled when no terminals connected

Expected: Floating pill in top-right corner, smooth hover effects

**Step 4: Commit**

```bash
git add src/renderer/src/components/layout/MiniToolbar.tsx
git add src/renderer/src/components/layout/AppShell.tsx
git commit -m "feat: add mini toolbar for visual navigation

- Floating pill in top-right corner
- Quick access to hosts, files, snippets, keys, settings
- Tooltips with keyboard shortcuts
- SFTP button disabled when not connected
- Glass morphism effect

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 6: Create Settings, Snippets, and Keys Overlays

**Files:**
- Create: `src/renderer/src/features/settings/SettingsOverlay.tsx`
- Create: `src/renderer/src/features/snippets/SnippetsOverlay.tsx`
- Create: `src/renderer/src/features/keys/KeysOverlay.tsx`

**Step 1: Create SettingsOverlay**

Create `src/renderer/src/features/settings/SettingsOverlay.tsx`:

```tsx
import { Overlay, OverlayHeader, OverlayContent } from '@/components/ui/overlay';
import { SettingsPage } from './SettingsPage';
import { useState } from 'react';

interface SettingsOverlayProps {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
}

export function SettingsOverlay({ open, onClose, workspaceId }: SettingsOverlayProps) {
  const [activeTab, setActiveTab] = useState<'terminal' | 'appearance' | 'ai' | 'keybindings' | 'advanced'>('terminal');

  return (
    <Overlay open={open} onClose={onClose}>
      <OverlayHeader title="Settings" onClose={onClose} />
      <OverlayContent className="p-0">
        <div className="flex h-[calc(80vh-64px)]">
          {/* Vertical tabs */}
          <div className="w-48 border-r border-[var(--border-subtle)] p-4 space-y-1">
            {['terminal', 'appearance', 'ai', 'keybindings', 'advanced'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors capitalize ${
                  activeTab === tab
                    ? 'bg-[var(--surface-3)] text-[var(--primary)] border-l-2 border-[var(--primary)]'
                    : 'text-[var(--text-secondary)] hover:text-foreground hover:bg-[var(--surface-1)]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <SettingsPage
              activeTab={activeTab}
              onTabChange={setActiveTab}
              workspaceId={workspaceId}
            />
          </div>
        </div>
      </OverlayContent>
    </Overlay>
  );
}
```

**Step 2: Create SnippetsOverlay (simplified for now)**

Create `src/renderer/src/features/snippets/SnippetsOverlay.tsx`:

```tsx
import { Overlay, OverlayHeader, OverlayContent, OverlayFooter } from '@/components/ui/overlay';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface SnippetsOverlayProps {
  open: boolean;
  onClose: () => void;
}

export function SnippetsOverlay({ open, onClose }: SnippetsOverlayProps) {
  return (
    <Overlay open={open} onClose={onClose}>
      <OverlayHeader title="Snippets" onClose={onClose} />
      <OverlayContent className="p-6">
        <div className="text-center py-16">
          <p className="text-[var(--text-secondary)]">Snippet library will be implemented here</p>
          <p className="text-sm text-[var(--text-tertiary)] mt-2">Coming in future tasks</p>
        </div>
      </OverlayContent>
      <OverlayFooter>
        <div />
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Snippet
        </Button>
      </OverlayFooter>
    </Overlay>
  );
}
```

**Step 3: Create KeysOverlay (simplified for now)**

Create `src/renderer/src/features/keys/KeysOverlay.tsx`:

```tsx
import { Overlay, OverlayHeader, OverlayContent, OverlayFooter } from '@/components/ui/overlay';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface KeysOverlayProps {
  open: boolean;
  onClose: () => void;
}

export function KeysOverlay({ open, onClose }: KeysOverlayProps) {
  return (
    <Overlay open={open} onClose={onClose}>
      <OverlayHeader title="SSH Keys" onClose={onClose} />
      <OverlayContent className="p-6">
        <div className="text-center py-16">
          <p className="text-[var(--text-secondary)]">SSH Keys manager will be implemented here</p>
          <p className="text-sm text-[var(--text-tertiary)] mt-2">Coming in future tasks</p>
        </div>
      </OverlayContent>
      <OverlayFooter>
        <Button variant="ghost">Generate Key</Button>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Import Key
        </Button>
      </OverlayFooter>
    </Overlay>
  );
}
```

**Step 4: Integrate overlays in AppShell**

**Step 5: Test all overlays**

Run: `npm run dev`
Test each overlay opens/closes correctly with smooth animations

**Step 6: Commit**

```bash
git add src/renderer/src/features/settings/SettingsOverlay.tsx
git add src/renderer/src/features/snippets/SnippetsOverlay.tsx
git add src/renderer/src/features/keys/KeysOverlay.tsx
git add src/renderer/src/components/layout/AppShell.tsx
git commit -m "feat: add settings, snippets, and keys overlays

- Settings: Vertical tabs layout
- Snippets: Placeholder for future implementation
- Keys: Placeholder for future implementation
- All overlays follow consistent pattern

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Phase 3-7: Continuation

**Note:** Due to the massive scope of this redesign, the full implementation plan would be extremely long (100+ tasks). The remaining phases follow the same pattern:

**Phase 3: SFTP & File Operations** - 15 tasks
- SFTP browser overlay with two-panel layout
- Drag-and-drop file upload
- `@` command parser and dispatcher
- File transfer progress indicators

**Phase 4: Split Views** - 10 tasks
- Split view container and layouts
- Resizable panes
- Focus management
- Keyboard navigation

**Phase 5: AI Agent Integration** - 20 tasks
- Agent configuration UI
- Chat panel component
- `@ask` command integration
- Context attachment system

**Phase 6: Polish & Animations** - 15 tasks
- All transition animations
- Context-aware features
- Smart suggestions
- Loading states

**Phase 7: Accessibility** - 10 tasks
- Keyboard navigation audit
- ARIA labels
- Screen reader testing
- Reduced motion support

---

## Execution Options

Plan complete and saved to `docs/plans/2025-02-21-terminal-centric-layout-implementation.md`.

**Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
