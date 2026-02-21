# Terminal Command Hints, TanStack Hotkeys, and Shortcuts UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add terminal command hints (@upload, @download, @ai with filter-as-you-type), migrate all keyboard shortcuts to TanStack Hotkeys, create shortcuts reference UI, and fix FloatingTabBar overlap.

**Architecture:** React overlay for command hints, centralized hotkeys registry with TanStack Hotkeys, Settings tab for shortcuts documentation, FloatingTabBar moved to normal document flow.

**Tech Stack:** React, TypeScript, TanStack Hotkeys, XTerm.js, Zustand, shadcn/ui, Tailwind CSS

---

## Pre-Implementation Setup

### Task 0: Install TanStack Hotkeys

**Files:**
- Modify: `package.json`

**Step 1: Install dependency**

Run: `npm install @tanstack/react-hotkeys`
Expected: Package installed successfully

**Step 2: Verify installation**

Run: `npm list @tanstack/react-hotkeys`
Expected: Shows installed version

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install @tanstack/react-hotkeys

Dependency for centralized keyboard shortcut management.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## SLICE 1: LAYOUT FIX

### Task 1.1: Fix FloatingTabBar Positioning

**Files:**
- Modify: `src/renderer/src/components/layout/FloatingTabBar.tsx`

**Step 1: Read current FloatingTabBar implementation**

Run: Read the file to understand current positioning approach

**Step 2: Remove absolute positioning**

Find the outer container div and change from absolute to relative positioning:

```typescript
// Before:
<div className="absolute top-0 left-0 right-0 h-12 px-3 ...">

// After:
<div className="relative w-full h-12 px-3 ...">
```

Remove any `top-0`, `left-0`, `right-0`, `absolute` classes. Keep `relative`, add `w-full` if not present.

**Step 3: Verify z-index is appropriate**

Ensure `z-10` class remains for proper layering.

**Step 4: Test in dev mode**

Run: `npm run dev`
Expected: Tab bar renders at top, terminals start below it (no content hidden)

**Step 5: Commit**

```bash
git add src/renderer/src/components/layout/FloatingTabBar.tsx
git commit -m "fix: change FloatingTabBar from absolute to normal flow

Terminals were hiding behind absolute positioned tab bar.
Now uses relative positioning in normal document flow.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### Task 1.2: Update TerminalCentricAppShell Layout

**Files:**
- Modify: `src/renderer/src/components/layout/TerminalCentricAppShell.tsx`

**Step 1: Read current layout structure**

Run: Read the file to understand current layout

**Step 2: Ensure flex-col layout**

Verify the main container uses flexbox column layout:

```typescript
<div className="flex flex-col h-screen">
  <FloatingTabBar {...props} />
  <MainArea className="flex-1" {...props} />
</div>
```

If not already structured this way, update it.

**Step 3: Test layout**

Run: `npm run dev`
Expected: Tab bar takes natural height, MainArea fills remaining space

**Step 4: Commit (only if changes made)**

```bash
git add src/renderer/src/components/layout/TerminalCentricAppShell.tsx
git commit -m "fix: ensure flex-col layout for TabBar and MainArea

Proper flexbox ensures terminal content starts below tab bar.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## SLICE 2: HOTKEYS REGISTRY & MIGRATION

### Task 2.1: Create Hotkeys Registry

**Files:**
- Create: `src/renderer/src/lib/hotkeys-registry.ts`

**Step 1: Create registry file with types**

```typescript
export interface HotkeyDefinition {
  id: string;
  key: string; // TanStack format: "mod+k", "mod+shift+f"
  description: string;
  category: 'general' | 'terminal' | 'navigation' | 'sftp' | 'recording' | 'broadcast';
}

export type HotkeyHandlers = Record<string, () => void>;
```

**Step 2: Define all shortcuts (without handlers yet)**

```typescript
export const HOTKEY_DEFINITIONS: HotkeyDefinition[] = [
  // General
  { id: 'command-palette', key: 'mod+k', description: 'Open command palette', category: 'general' },
  { id: 'settings', key: 'mod+,', description: 'Open settings', category: 'general' },

  // Terminal
  { id: 'new-tab', key: 'mod+t', description: 'New terminal connection', category: 'terminal' },
  { id: 'close-tab', key: 'mod+w', description: 'Close active tab', category: 'terminal' },
  { id: 'local-terminal', key: 'mod+l', description: 'Open local terminal', category: 'terminal' },
  { id: 'search', key: 'mod+f', description: 'Search in terminal', category: 'terminal' },
  { id: 'split-horizontal', key: 'mod+d', description: 'Split pane horizontally', category: 'terminal' },
  { id: 'split-vertical', key: 'mod+shift+d', description: 'Split pane vertically', category: 'terminal' },
  { id: 'snippet-picker', key: 'mod+shift+s', description: 'Open snippet picker', category: 'terminal' },

  // Navigation
  { id: 'browse-hosts', key: 'mod+h', description: 'Browse hosts', category: 'navigation' },
  { id: 'browse-files', key: 'mod+b', description: 'Open SFTP browser', category: 'navigation' },
  { id: 'snippets', key: 'mod+;', description: 'Open snippets', category: 'navigation' },

  // SFTP
  { id: 'open-sftp', key: 'mod+shift+f', description: 'Open SFTP for active tab', category: 'sftp' },

  // Recording
  { id: 'toggle-recording', key: 'mod+shift+r', description: 'Start/stop recording', category: 'recording' },

  // Broadcast
  { id: 'toggle-broadcast', key: 'mod+shift+b', description: 'Toggle broadcast mode', category: 'broadcast' },
];
```

**Step 3: Export helper to find hotkeys**

```typescript
export function getHotkey(id: string): HotkeyDefinition | undefined {
  return HOTKEY_DEFINITIONS.find((h) => h.id === id);
}

export function getHotkeysByCategory(category: HotkeyDefinition['category']): HotkeyDefinition[] {
  return HOTKEY_DEFINITIONS.filter((h) => h.category === category);
}
```

**Step 4: Commit**

```bash
git add src/renderer/src/lib/hotkeys-registry.ts
git commit -m "feat: create hotkeys registry with all 15 shortcuts

Central definition of all keyboard shortcuts.
Supports categories and lookup by id.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### Task 2.2: Migrate TerminalCentricAppShell Shortcuts

**Files:**
- Modify: `src/renderer/src/components/layout/TerminalCentricAppShell.tsx`

**Step 1: Read current implementation**

Run: Read the file and identify all addEventListener calls

**Step 2: Import TanStack Hotkeys and registry**

Add imports at top:

```typescript
import { useHotkeys } from '@tanstack/react-hotkeys';
import { getHotkey } from '@/lib/hotkeys-registry';
```

**Step 3: Remove existing keyboard event listener useEffect**

Find and remove the useEffect that has `addEventListener('keydown', ...)` handling Cmd+K, Cmd+T, Cmd+H, Cmd+L, Cmd+;, Cmd+,.

**Step 4: Add TanStack hotkeys**

Add these hooks after removing the old useEffect:

```typescript
// Command Palette
useHotkeys(getHotkey('command-palette')!.key, (e) => {
  e.preventDefault();
  setCommandPaletteOpen(true);
}, [setCommandPaletteOpen]);

// Browse Hosts
useHotkeys(getHotkey('browse-hosts')!.key, (e) => {
  e.preventDefault();
  setBrowseHostsOpen(true);
}, [setBrowseHostsOpen]);

// New Connection
useHotkeys(getHotkey('new-tab')!.key, (e) => {
  e.preventDefault();
  setBrowseHostsOpen(true);
}, [setBrowseHostsOpen]);

// Local Terminal
useHotkeys(getHotkey('local-terminal')!.key, (e) => {
  e.preventDefault();
  handleOpenLocalTerminal();
}, [handleOpenLocalTerminal]);

// Snippets
useHotkeys(getHotkey('snippets')!.key, (e) => {
  e.preventDefault();
  setSnippetsOpen(true);
}, [setSnippetsOpen]);

// Settings
useHotkeys(getHotkey('settings')!.key, (e) => {
  e.preventDefault();
  openTab({
    tabId: 'settings',
    tabType: 'settings',
    label: 'Settings',
    closable: false,
    settingsTab: 'terminal',
  });
}, [openTab]);
```

**Step 5: Test shortcuts**

Run: `npm run dev`
Test: Press Cmd+K, Cmd+H, Cmd+T, Cmd+L, Cmd+;, Cmd+,
Expected: All shortcuts work as before

**Step 6: Commit**

```bash
git add src/renderer/src/components/layout/TerminalCentricAppShell.tsx
git commit -m "refactor: migrate TerminalCentricAppShell shortcuts to TanStack Hotkeys

Replaced addEventListener with useHotkeys for:
- Command palette (Cmd+K)
- Browse hosts (Cmd+H)
- New connection (Cmd+T)
- Local terminal (Cmd+L)
- Snippets (Cmd+;)
- Settings (Cmd+,)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### Task 2.3: Add Remaining TerminalCentricAppShell Shortcuts

**Files:**
- Modify: `src/renderer/src/components/layout/TerminalCentricAppShell.tsx`

**Step 1: Add SFTP shortcut**

```typescript
// Open SFTP
useHotkeys(getHotkey('open-sftp')!.key, (e) => {
  e.preventDefault();
  if (activeTabId) handleOpenSftp(activeTabId);
}, [activeTabId, handleOpenSftp]);
```

**Step 2: Add recording shortcuts**

```typescript
// Toggle Recording
useHotkeys(getHotkey('toggle-recording')!.key, (e) => {
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
}, [activeTabId, tabs, isRecording, handleStartRecording, handleStopRecording]);
```

**Step 3: Add broadcast shortcut**

```typescript
// Toggle Broadcast
useHotkeys(getHotkey('toggle-broadcast')!.key, (e) => {
  e.preventDefault();
  if (activeTabId) handleToggleBroadcast(activeTabId);
}, [activeTabId, handleToggleBroadcast]);
```

**Step 4: Add close tab shortcut**

```typescript
// Close Tab
useHotkeys(getHotkey('close-tab')!.key, (e) => {
  e.preventDefault();
  if (activeTabId) {
    const tab = tabs.get(activeTabId);
    if (tab?.closable !== false) {
      closeTab(activeTabId);
    }
  }
}, [activeTabId, tabs, closeTab]);
```

**Step 5: Test shortcuts**

Run: `npm run dev`
Test: Cmd+Shift+F, Cmd+Shift+R, Cmd+Shift+B, Cmd+W
Expected: All shortcuts work correctly

**Step 6: Commit**

```bash
git add src/renderer/src/components/layout/TerminalCentricAppShell.tsx
git commit -m "refactor: add remaining TerminalCentricAppShell shortcuts

Added TanStack Hotkeys for:
- Open SFTP (Cmd+Shift+F)
- Toggle recording (Cmd+Shift+R)
- Toggle broadcast (Cmd+Shift+B)
- Close tab (Cmd+W)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### Task 2.4: Migrate MainArea Split Shortcuts

**Files:**
- Modify: `src/renderer/src/components/layout/MainArea.tsx`

**Step 1: Read current implementation**

Run: Read the file to find addEventListener for split shortcuts

**Step 2: Import TanStack Hotkeys**

Add imports:

```typescript
import { useHotkeys } from '@tanstack/react-hotkeys';
import { getHotkey } from '@/lib/hotkeys-registry';
```

**Step 3: Remove old keyboard listener**

Remove the useEffect with addEventListener for Cmd+D and Cmd+Shift+D.

**Step 4: Add TanStack hotkeys for splits**

```typescript
// Split Horizontal
useHotkeys(getHotkey('split-horizontal')!.key, (e) => {
  e.preventDefault();
  handleSplitHorizontal();
}, [handleSplitHorizontal]);

// Split Vertical
useHotkeys(getHotkey('split-vertical')!.key, (e) => {
  e.preventDefault();
  handleSplitVertical();
}, [handleSplitVertical]);
```

**Step 5: Test splits**

Run: `npm run dev`
Test: Cmd+D, Cmd+Shift+D in active terminal
Expected: Panes split horizontally and vertically

**Step 6: Commit**

```bash
git add src/renderer/src/components/layout/MainArea.tsx
git commit -m "refactor: migrate MainArea split shortcuts to TanStack Hotkeys

Replaced addEventListener with useHotkeys for:
- Split horizontal (Cmd+D)
- Split vertical (Cmd+Shift+D)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### Task 2.5: Migrate TerminalTab Shortcuts

**Files:**
- Modify: `src/renderer/src/features/terminal/TerminalTab.tsx`

**Step 1: Read current implementation**

Run: Read the file to find addEventListener for Cmd+F and Cmd+Shift+S

**Step 2: Import TanStack Hotkeys**

Add imports:

```typescript
import { useHotkeys } from '@tanstack/react-hotkeys';
import { getHotkey } from '@/lib/hotkeys-registry';
```

**Step 3: Remove old keyboard listeners**

Remove useEffect with addEventListener for search and snippets.

**Step 4: Add TanStack hotkeys**

```typescript
// Search
useHotkeys(getHotkey('search')!.key, (e) => {
  e.preventDefault();
  setSearchOpen(true);
}, []);

// Snippet Picker
useHotkeys(getHotkey('snippet-picker')!.key, (e) => {
  e.preventDefault();
  setSnippetPickerOpen(true);
}, []);
```

**Step 5: Test shortcuts**

Run: `npm run dev`
Test: Cmd+F, Cmd+Shift+S in terminal
Expected: Search opens, snippet picker opens

**Step 6: Commit**

```bash
git add src/renderer/src/features/terminal/TerminalTab.tsx
git commit -m "refactor: migrate TerminalTab shortcuts to TanStack Hotkeys

Replaced addEventListener with useHotkeys for:
- Search (Cmd+F)
- Snippet picker (Cmd+Shift+S)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### Task 2.6: Update FloatingTabBar Context Menu

**Files:**
- Modify: `src/renderer/src/components/layout/FloatingTabBar.tsx`

**Step 1: Import registry**

Add import:

```typescript
import { getHotkey } from '@/lib/hotkeys-registry';
```

**Step 2: Update context menu items with shortcuts**

Find each ContextMenuItem and add shortcut display from registry:

```typescript
<ContextMenuItem onClick={onOpenSftp} className="gap-2">
  <FolderOpen className="h-4 w-4" />
  <span>Open SFTP</span>
  <span className="ml-auto text-xs text-muted-foreground">
    {getHotkey('open-sftp')!.key.replace('mod', '⌘')}
  </span>
</ContextMenuItem>

<ContextMenuItem onClick={onStartRecording} className="gap-2">
  <Circle className="h-4 w-4" />
  <span>{isRecording ? 'Stop Recording' : 'Start Recording'}</span>
  <span className="ml-auto text-xs text-muted-foreground">
    {getHotkey('toggle-recording')!.key.replace('mod', '⌘')}
  </span>
</ContextMenuItem>

<ContextMenuItem onClick={onSplitHorizontal} className="gap-2">
  <SplitSquareHorizontal className="h-4 w-4" />
  <span>Split Horizontal</span>
  <span className="ml-auto text-xs text-muted-foreground">
    {getHotkey('split-horizontal')!.key.replace('mod', '⌘')}
  </span>
</ContextMenuItem>

<ContextMenuItem onClick={onSplitVertical} className="gap-2">
  <SplitSquareVertical className="h-4 w-4" />
  <span>Split Vertical</span>
  <span className="ml-auto text-xs text-muted-foreground">
    {getHotkey('split-vertical')!.key.replace('mod', '⌘')}
  </span>
</ContextMenuItem>

<ContextMenuItem onClick={onToggleBroadcast} className="gap-2">
  <Radio className="h-4 w-4" />
  <span>Toggle Broadcast</span>
  <span className="ml-auto text-xs text-muted-foreground">
    {getHotkey('toggle-broadcast')!.key.replace('mod', '⌘')}
  </span>
</ContextMenuItem>

<ContextMenuItem onClick={onClose} className="gap-2 text-destructive">
  <X className="h-4 w-4" />
  <span>Close Tab</span>
  <span className="ml-auto text-xs text-muted-foreground">
    {getHotkey('close-tab')!.key.replace('mod', '⌘')}
  </span>
</ContextMenuItem>
```

**Step 3: Test context menu**

Run: `npm run dev`
Right-click tab → Check shortcuts display correctly
Expected: Shortcuts shown next to each menu item

**Step 4: Commit**

```bash
git add src/renderer/src/components/layout/FloatingTabBar.tsx
git commit -m "feat: display keyboard shortcuts in tab context menu

Context menu now shows shortcuts from registry.
Platform-aware display (⌘ on Mac).

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## SLICE 3: SHORTCUTS UI

### Task 3.1: Create ShortcutsSettingsTab Component

**Files:**
- Create: `src/renderer/src/features/settings/ShortcutsSettingsTab.tsx`

**Step 1: Create component with imports**

```typescript
import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, ChevronDown, ChevronRight } from 'lucide-react';
import { HOTKEY_DEFINITIONS, type HotkeyDefinition } from '@/lib/hotkeys-registry';
import { cn } from '@/lib/utils';

export function ShortcutsSettingsTab() {
  const [search, setSearch] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['general', 'terminal', 'navigation', 'sftp', 'recording', 'broadcast'])
  );

  // Filter shortcuts by search
  const filtered = useMemo(() => {
    if (!search) return HOTKEY_DEFINITIONS;
    const lower = search.toLowerCase();
    return HOTKEY_DEFINITIONS.filter(
      (h) =>
        h.description.toLowerCase().includes(lower) ||
        h.key.toLowerCase().includes(lower) ||
        h.category.toLowerCase().includes(lower)
    );
  }, [search]);

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map<string, HotkeyDefinition[]>();
    for (const hotkey of filtered) {
      if (!map.has(hotkey.category)) {
        map.set(hotkey.category, []);
      }
      map.get(hotkey.category)!.push(hotkey);
    }
    return map;
  }, [filtered]);

  function toggleCategory(category: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }

  function formatKey(key: string): string {
    // Platform-aware formatting
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    return key
      .replace('mod+', isMac ? '⌘' : 'Ctrl+')
      .replace('shift+', isMac ? '⇧' : 'Shift+')
      .replace('alt+', isMac ? '⌥' : 'Alt+')
      .split('+')
      .map((k) => k.charAt(0).toUpperCase() + k.slice(1))
      .join(isMac ? '' : '+');
  }

  const categories = [
    { key: 'general', label: 'General' },
    { key: 'terminal', label: 'Terminal' },
    { key: 'navigation', label: 'Navigation' },
    { key: 'sftp', label: 'SFTP' },
    { key: 'recording', label: 'Recording' },
    { key: 'broadcast', label: 'Broadcast' },
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 max-w-3xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-lg font-semibold mb-1">Keyboard Shortcuts</h1>
          <p className="text-sm text-muted-foreground">
            View and search all available keyboard shortcuts
          </p>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search shortcuts..."
            className="pl-9 h-9"
          />
        </div>

        {/* Shortcuts by Category */}
        <div className="space-y-2">
          {categories.map((cat) => {
            const shortcuts = grouped.get(cat.key);
            if (!shortcuts || shortcuts.length === 0) return null;

            const isExpanded = expandedCategories.has(cat.key);

            return (
              <div key={cat.key} className="border rounded-lg overflow-hidden">
                {/* Category Header */}
                <button
                  onClick={() => toggleCategory(cat.key)}
                  className={cn(
                    'w-full flex items-center justify-between px-4 py-3',
                    'hover:bg-accent/50 transition-colors'
                  )}
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="font-medium text-sm">{cat.label}</span>
                    <Badge variant="secondary" className="text-xs">
                      {shortcuts.length}
                    </Badge>
                  </div>
                </button>

                {/* Shortcuts List */}
                {isExpanded && (
                  <div className="border-t">
                    {shortcuts.map((shortcut) => (
                      <div
                        key={shortcut.id}
                        className="flex items-center justify-between px-4 py-3 border-b last:border-0 hover:bg-accent/20"
                      >
                        <span className="text-sm">{shortcut.description}</span>
                        <kbd className="px-2 py-1 text-xs font-mono bg-muted rounded border">
                          {formatKey(shortcut.key)}
                        </kbd>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* No Results */}
        {filtered.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">No shortcuts found</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/renderer/src/features/settings/ShortcutsSettingsTab.tsx
git commit -m "feat: create ShortcutsSettingsTab component

Displays all keyboard shortcuts grouped by category:
- Search/filter functionality
- Collapsible category sections
- Platform-aware key display (⌘ on Mac, Ctrl on Windows)
- Reads from hotkeys registry

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### Task 3.2: Add Shortcuts Tab to Settings

**Files:**
- Modify: `src/renderer/src/features/settings/SettingsPage.tsx`

**Step 1: Import ShortcutsSettingsTab**

Add import:

```typescript
import { ShortcutsSettingsTab } from './ShortcutsSettingsTab';
```

**Step 2: Update SettingsTab type**

Find the type definition and add 'shortcuts':

```typescript
export type SettingsTab = 'terminal' | 'appearance' | 'ai' | 'shortcuts';
```

**Step 3: Add Shortcuts tab trigger**

In the TabsList, add after 'ai':

```typescript
<TabsTrigger value="shortcuts" className="w-full justify-start px-3 py-1.5 text-sm">
  Shortcuts
</TabsTrigger>
```

**Step 4: Add Shortcuts tab content**

After AiTab content, add:

```typescript
<TabsContent value="shortcuts" className="m-0">
  <ShortcutsSettingsTab />
</TabsContent>
```

**Step 5: Test shortcuts tab**

Run: `npm run dev`
Navigate: Settings → Click Shortcuts tab
Expected: Shortcuts list displays, search works

**Step 6: Commit**

```bash
git add src/renderer/src/features/settings/SettingsPage.tsx
git commit -m "feat: add Shortcuts tab to Settings

New tab displays keyboard shortcuts documentation.
Accessible alongside Terminal, Appearance, AI tabs.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### Task 3.3: Add Keyboard Shortcuts Entry to Command Palette

**Files:**
- Modify: `src/renderer/src/components/layout/CommandPalette.tsx`

**Step 1: Import Keyboard icon**

Add to lucide-react imports:

```typescript
import { ..., Keyboard } from 'lucide-react';
```

**Step 2: Add shortcuts command**

Find the commands array in CommandPalette component and add entry:

```typescript
{
  id: 'keyboard-shortcuts',
  label: 'Keyboard Shortcuts',
  icon: Keyboard,
  keywords: ['hotkeys', 'keys', 'shortcuts', 'keybindings', 'help'],
  onSelect: () => {
    setOpen(false);
    openTab({
      tabId: 'settings',
      tabType: 'settings',
      label: 'Settings',
      closable: false,
      settingsTab: 'shortcuts',
    });
  },
}
```

**Step 3: Test command palette entry**

Run: `npm run dev`
Press: Cmd+K → Type "shortcuts"
Expected: "Keyboard Shortcuts" appears → Selects → Opens Settings/Shortcuts tab

**Step 4: Commit**

```bash
git add src/renderer/src/components/layout/CommandPalette.tsx
git commit -m "feat: add Keyboard Shortcuts entry to command palette

Users can now open shortcuts documentation via:
- Cmd+K → type 'shortcuts'
- Keywords: hotkeys, keys, shortcuts, keybindings, help

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## SLICE 4: COMMAND HINTS

### Task 4.1: Create CommandHintOverlay Component (Part 1: Structure)

**Files:**
- Create: `src/renderer/src/features/terminal/CommandHintOverlay.tsx`

**Step 1: Create basic component structure**

```typescript
import { useState, useEffect, useRef } from 'react';
import type { Terminal } from '@xterm/xterm';
import { Upload, Download, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface CommandHintOverlayProps {
  terminal: Terminal | null;
  sessionId: string;
  currentRemotePath?: string;
}

interface CommandHint {
  command: string;
  description: string;
  icon: typeof Upload;
  usage: string;
}

const COMMANDS: CommandHint[] = [
  {
    command: '@upload',
    description: 'Upload files to remote server',
    icon: Upload,
    usage: '@upload',
  },
  {
    command: '@download',
    description: 'Download file from remote server',
    icon: Download,
    usage: '@download <filename>',
  },
  {
    command: '@ai',
    description: 'Translate natural language to shell command',
    icon: Sparkles,
    usage: '@ai <describe what you want>',
  },
];

export function CommandHintOverlay({
  terminal,
  sessionId,
  currentRemotePath = '/home',
}: CommandHintOverlayProps) {
  const [inputBuffer, setInputBuffer] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [filteredCommands, setFilteredCommands] = useState<CommandHint[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isTranslating, setIsTranslating] = useState(false);
  const disposableRef = useRef<{ dispose: () => void } | null>(null);

  // TODO: Add effects and handlers

  return null; // Will add UI next
}
```

**Step 2: Commit**

```bash
git add src/renderer/src/features/terminal/CommandHintOverlay.tsx
git commit -m "feat: create CommandHintOverlay component structure

Base structure with command definitions and state.
UI and event handlers to be added next.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### Task 4.2: Add Command Detection Logic

**Files:**
- Modify: `src/renderer/src/features/terminal/CommandHintOverlay.tsx`

**Step 1: Add onData listener effect**

Add effect after state declarations:

```typescript
// Listen to terminal input
useEffect(() => {
  if (!terminal) return;

  const disposable = terminal.onData((data) => {
    // Only detect typed @ (not pasted)
    if (data === '@') {
      setInputBuffer('@');
      setShowMenu(true);
      setFilteredCommands(COMMANDS);
      setSelectedIndex(0);
    } else if (showMenu) {
      // Handle input after @
      if (data === '\r') {
        // Enter pressed - select command
        handleSelectCommand(filteredCommands[selectedIndex]);
      } else if (data === '\x1b') {
        // ESC pressed - close menu
        setShowMenu(false);
        setInputBuffer('');
      } else if (data === '\x1b[A') {
        // Up arrow
        setSelectedIndex((prev) => Math.max(0, prev - 1));
      } else if (data === '\x1b[B') {
        // Down arrow
        setSelectedIndex((prev) => Math.min(filteredCommands.length - 1, prev + 1));
      } else if (data === '\x7f') {
        // Backspace
        const newBuffer = inputBuffer.slice(0, -1);
        if (newBuffer.length === 0 || !newBuffer.startsWith('@')) {
          setShowMenu(false);
          setInputBuffer('');
        } else {
          setInputBuffer(newBuffer);
          filterCommands(newBuffer);
        }
      } else if (data.length === 1 && data >= ' ') {
        // Regular character
        const newBuffer = inputBuffer + data;
        setInputBuffer(newBuffer);
        filterCommands(newBuffer);
      }
    }
  });

  disposableRef.current = disposable;

  return () => {
    disposable.dispose();
  };
}, [terminal, showMenu, inputBuffer, filteredCommands, selectedIndex]);
```

**Step 2: Add filter function**

Add helper function before return:

```typescript
function filterCommands(buffer: string) {
  const lower = buffer.toLowerCase();
  const matches = COMMANDS.filter((cmd) => cmd.command.toLowerCase().startsWith(lower));
  setFilteredCommands(matches);
  setSelectedIndex(0);
}
```

**Step 3: Add placeholder select handler**

```typescript
function handleSelectCommand(command: CommandHint | undefined) {
  if (!command) return;

  // TODO: Implement command handlers
  console.log('Selected command:', command.command);
  setShowMenu(false);
  setInputBuffer('');
}
```

**Step 4: Commit**

```bash
git add src/renderer/src/features/terminal/CommandHintOverlay.tsx
git commit -m "feat: add command detection and filtering logic

Detects @ character, maintains input buffer, filters commands.
Handles keyboard navigation (arrows, enter, esc, backspace).

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### Task 4.3: Add Command Hint Menu UI

**Files:**
- Modify: `src/renderer/src/features/terminal/CommandHintOverlay.tsx`

**Step 1: Replace return with menu UI**

Replace `return null` with:

```typescript
if (!showMenu || filteredCommands.length === 0) return null;

return (
  <div className="absolute bottom-4 left-4 z-50">
    <div className="bg-[var(--surface-3)] border border-[var(--border)] rounded-lg shadow-2xl overflow-hidden min-w-[320px]">
      {/* Header */}
      <div className="px-3 py-2 border-b border-[var(--border)] bg-[var(--surface-4)]">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Command Hints</span>
          {isTranslating && (
            <span className="text-xs text-blue-400 flex items-center gap-1">
              <span className="animate-spin">⏳</span>
              Translating...
            </span>
          )}
        </div>
      </div>

      {/* Commands List */}
      <div className="py-1">
        {filteredCommands.map((cmd, index) => {
          const Icon = cmd.icon;
          const isSelected = index === selectedIndex;

          return (
            <button
              key={cmd.command}
              onClick={() => handleSelectCommand(cmd)}
              className={cn(
                'w-full px-3 py-2 flex items-start gap-3 transition-colors text-left',
                isSelected ? 'bg-primary/20' : 'hover:bg-accent/50'
              )}
            >
              <Icon
                className={cn(
                  'h-4 w-4 mt-0.5 shrink-0',
                  isSelected ? 'text-primary' : 'text-muted-foreground'
                )}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{cmd.command}</div>
                <div className="text-xs text-muted-foreground">{cmd.description}</div>
                <div className="text-xs text-muted-foreground/70 font-mono mt-1">
                  {cmd.usage}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-[var(--border)] bg-[var(--surface-4)]">
        <div className="text-xs text-muted-foreground">
          <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">↑↓</kbd> Navigate{' '}
          <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Enter</kbd> Select{' '}
          <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Esc</kbd> Close
        </div>
      </div>
    </div>
  </div>
);
```

**Step 2: Test menu display**

Run: `npm run dev`
Test: Type @ in terminal
Expected: Menu doesn't appear yet (not integrated)

**Step 3: Commit**

```bash
git add src/renderer/src/features/terminal/CommandHintOverlay.tsx
git commit -m "feat: add command hint menu UI

Displays filtered commands with:
- Icons and descriptions
- Keyboard navigation indicators
- Selected state highlighting
- Loading state for @ai translation

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### Task 4.4: Implement @upload Handler

**Files:**
- Modify: `src/renderer/src/features/terminal/CommandHintOverlay.tsx`

**Step 1: Add upload handler**

Replace the placeholder `handleSelectCommand` with:

```typescript
async function handleSelectCommand(command: CommandHint | undefined) {
  if (!command || !terminal) return;

  // Clear the @ command from terminal
  const backspaces = '\x7f'.repeat(inputBuffer.length);
  terminal.write(backspaces);

  if (command.command === '@upload') {
    await handleUpload();
  } else if (command.command === '@download') {
    await handleDownload();
  } else if (command.command === '@ai') {
    await handleAiTranslation();
  }

  setShowMenu(false);
  setInputBuffer('');
}

async function handleUpload() {
  try {
    const files = await window.sftpApi.pickUploadFiles();
    if (!files || files.length === 0) return;

    for (const localPath of files) {
      const filename = localPath.split('/').pop() || 'file';
      const remotePath = `${currentRemotePath}/${filename}`.replace('//', '/');

      toast.promise(
        window.sftpApi.upload(sessionId, localPath, remotePath),
        {
          loading: `Uploading ${filename}...`,
          success: `Uploaded ${filename}`,
          error: (err) => `Upload failed: ${err.message}`,
        }
      );
    }
  } catch (err: any) {
    if (err.message?.includes('SFTP')) {
      toast.error('No SFTP connection. Open SFTP first (Cmd+Shift+F)');
    } else {
      toast.error(`Upload failed: ${err.message}`);
    }
  }
}
```

**Step 2: Commit**

```bash
git add src/renderer/src/features/terminal/CommandHintOverlay.tsx
git commit -m "feat: implement @upload command handler

Opens file picker, uploads selected files via SFTP.
Shows toast progress and error handling.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### Task 4.5: Implement @download Handler

**Files:**
- Modify: `src/renderer/src/features/terminal/CommandHintOverlay.tsx`

**Step 1: Add download handler**

Add function after handleUpload:

```typescript
async function handleDownload() {
  // Parse filename from buffer
  const parts = inputBuffer.split(' ');
  if (parts.length < 2) {
    toast.error('Usage: @download <filename>');
    return;
  }

  const filename = parts.slice(1).join(' ');
  const remotePath = `${currentRemotePath}/${filename}`.replace('//', '/');

  try {
    toast.promise(
      window.sftpApi.download(sessionId, remotePath),
      {
        loading: `Downloading ${filename}...`,
        success: `Downloaded ${filename} to Downloads folder`,
        error: (err) => `Download failed: ${err.message}`,
      }
    );
  } catch (err: any) {
    if (err.message?.includes('not found')) {
      toast.error(`File not found: ${filename}`);
    } else if (err.message?.includes('SFTP')) {
      toast.error('No SFTP connection. Open SFTP first (Cmd+Shift+F)');
    } else {
      toast.error(`Download failed: ${err.message}`);
    }
  }
}
```

**Step 2: Commit**

```bash
git add src/renderer/src/features/terminal/CommandHintOverlay.tsx
git commit -m "feat: implement @download command handler

Parses filename, downloads from SFTP to Downloads folder.
Shows toast progress and error handling.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### Task 4.6: Implement @ai Translation Handler

**Files:**
- Modify: `src/renderer/src/features/terminal/CommandHintOverlay.tsx`

**Step 1: Import settings store**

Add import:

```typescript
import { useSettingsStore } from '@/stores/settings-store';
```

**Step 2: Get AI settings in component**

Add after state declarations:

```typescript
const { settings } = useSettingsStore();
```

**Step 3: Add AI translation handler**

Add function after handleDownload:

```typescript
async function handleAiTranslation() {
  // Parse natural language query from buffer
  const parts = inputBuffer.split(' ');
  if (parts.length < 2) {
    toast.error('Usage: @ai <describe what you want>');
    return;
  }

  const naturalLanguage = parts.slice(1).join(' ');

  // Check AI configuration
  if (!settings?.openaiApiKeyEncrypted && !settings?.anthropicApiKeyEncrypted) {
    toast.error('Configure AI provider in Settings (Cmd+,)');
    return;
  }

  setIsTranslating(true);

  try {
    const requestId = crypto.randomUUID();
    let translatedCommand = '';

    // Listen for chunks
    const offChunk = window.aiApi.onChunk((id, chunk) => {
      if (id === requestId) {
        translatedCommand += chunk;
      }
    });

    const offDone = window.aiApi.onDone((id) => {
      if (id === requestId) {
        setIsTranslating(false);
        // Write translated command to terminal (don't execute)
        if (terminal) {
          terminal.write(translatedCommand);
        }
        toast.success('Command translated');
        offChunk();
        offDone();
        offError();
      }
    });

    const offError = window.aiApi.onError((id, error) => {
      if (id === requestId) {
        setIsTranslating(false);
        toast.error(`AI translation failed: ${error}`);
        offChunk();
        offDone();
        offError();
      }
    });

    // Call AI translation
    await window.aiApi.translateCommand({
      provider: settings?.openaiApiKeyEncrypted ? 'openai' : 'anthropic',
      apiKey: settings?.openaiApiKeyEncrypted || settings?.anthropicApiKeyEncrypted || '',
      model: 'gpt-4o-mini',
      naturalLanguage,
      requestId,
    });
  } catch (err: any) {
    setIsTranslating(false);
    toast.error(`AI translation failed: ${err.message}`);
  }
}
```

**Step 4: Commit**

```bash
git add src/renderer/src/features/terminal/CommandHintOverlay.tsx
git commit -m "feat: implement @ai translation handler

Translates natural language to shell command.
Streams result, writes to terminal without executing.
Shows loading state during translation.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### Task 4.7: Integrate CommandHintOverlay in TerminalTab

**Files:**
- Modify: `src/renderer/src/features/terminal/TerminalTab.tsx`

**Step 1: Import CommandHintOverlay**

Add import:

```typescript
import { CommandHintOverlay } from './CommandHintOverlay';
```

**Step 2: Add overlay to render**

Find the terminal container and wrap it with a relative positioned div, add overlay:

```typescript
<div className="relative w-full h-full overflow-hidden p-3" style={{ backgroundColor: terminalBg }}>
  <div ref={containerRef} className="w-full h-full" />

  {/* Command Hint Overlay */}
  <CommandHintOverlay
    terminal={terminal}
    sessionId={sessionId}
    currentRemotePath="/home" // TODO: Get from SFTP state
  />

  {/* Existing search and snippet overlays */}
  {searchOpen && <TerminalSearch ... />}
  {snippetPickerOpen && <SnippetPicker ... />}
</div>
```

**Step 3: Test command hints**

Run: `npm run dev`
Test: Type @ in terminal
Expected: Menu appears with 3 commands
Test: Type @up
Expected: Filters to @upload
Test: Press Enter on @upload
Expected: File picker opens

**Step 4: Commit**

```bash
git add src/renderer/src/features/terminal/TerminalTab.tsx
git commit -m "feat: integrate CommandHintOverlay in TerminalTab

Command hints now appear when typing @ in terminal.
Overlay positioned absolutely within terminal container.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## FINAL TESTING & DOCUMENTATION

### Task 5.1: Manual End-to-End Testing

**Files:**
- None (testing only)

**Step 1: Test layout fix**

Run: `npm run dev`
- [ ] Terminal content not hidden behind tab bar
- [ ] First line of terminal visible
- [ ] Resize window → Layout adjusts correctly
- [ ] Split panes → Both panes visible

**Step 2: Test all hotkeys**

Test each shortcut:
- [ ] Cmd+K → Command palette opens
- [ ] Cmd+H → Browse hosts opens
- [ ] Cmd+T → New connection dialog opens
- [ ] Cmd+L → Local terminal opens
- [ ] Cmd+; → Snippets opens
- [ ] Cmd+, → Settings opens
- [ ] Cmd+F (in terminal) → Search opens
- [ ] Cmd+Shift+F → SFTP opens for active tab
- [ ] Cmd+Shift+R → Recording toggles
- [ ] Cmd+Shift+B → Broadcast toggles
- [ ] Cmd+D → Split horizontal
- [ ] Cmd+Shift+D → Split vertical
- [ ] Cmd+Shift+S (in terminal) → Snippet picker opens
- [ ] Cmd+W → Active tab closes

**Step 3: Test command hints**

Test command hints:
- [ ] Type @ → Menu appears
- [ ] Type @up → Filters to @upload
- [ ] Type @d → Filters to @download
- [ ] Type @a → Filters to @ai
- [ ] Arrow keys navigate menu
- [ ] Enter selects command
- [ ] ESC closes menu
- [ ] Backspace through @ closes menu
- [ ] @upload → File picker opens
- [ ] @download test.txt → Downloads file (if SFTP connected)
- [ ] @ai list files → Translates to command (if AI configured)

**Step 4: Test shortcuts UI**

Test shortcuts documentation:
- [ ] Cmd+K → Type "shortcuts" → Opens Settings/Shortcuts
- [ ] Search field filters shortcuts
- [ ] Categories collapse/expand
- [ ] All shortcuts display correct keys
- [ ] Mac shows ⌘, Windows shows Ctrl

**Step 5: Test context menu shortcuts**

Right-click tab:
- [ ] All menu items show correct shortcuts
- [ ] Shortcuts match registry

**Step 6: Document any issues found**

If issues found, create TODO items or fix immediately.

**Step 7: Mark testing complete**

No commit needed - testing only.

### Task 5.2: Update README Documentation

**Files:**
- Modify: `README.md`

**Step 1: Add keyboard shortcuts section**

Find or create a "Keyboard Shortcuts" section and add:

```markdown
## Keyboard Shortcuts

View all shortcuts in-app: Press `Cmd+K` and search for "Keyboard Shortcuts"

### General
- `Cmd+K` - Open command palette
- `Cmd+,` - Open settings

### Terminal
- `Cmd+T` - New terminal connection
- `Cmd+L` - Open local terminal
- `Cmd+W` - Close active tab
- `Cmd+F` - Search in terminal
- `Cmd+D` - Split pane horizontally
- `Cmd+Shift+D` - Split pane vertically
- `Cmd+Shift+S` - Open snippet picker

### Navigation
- `Cmd+H` - Browse hosts
- `Cmd+B` - Open SFTP browser
- `Cmd+;` - Open snippets

### SFTP
- `Cmd+Shift+F` - Open SFTP for active tab

### Recording & Broadcast
- `Cmd+Shift+R` - Start/stop recording
- `Cmd+Shift+B` - Toggle broadcast mode

### Command Hints

Type `@` in any terminal to see command hints:
- `@upload` - Upload files to remote server
- `@download <filename>` - Download file from remote server
- `@ai <natural language>` - Translate natural language to shell command

Example: `@ai find all log files` → translates to `find . -name "*.log"`
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add keyboard shortcuts and command hints documentation

Documents all 15 shortcuts and 3 command hints.
Includes examples and navigation instructions.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### Task 5.3: Final Build Verification

**Files:**
- None (build verification)

**Step 1: Clean install**

Run: `npm ci`
Expected: Clean install succeeds

**Step 2: Build production**

Run: `npm run build`
Expected: Build succeeds without errors

**Step 3: Test production build**

Run: `npm run preview`
Expected: App runs, all features work

**Step 4: Commit verification note**

```bash
git commit --allow-empty -m "test: verify production build

✅ Clean install successful
✅ Production build successful
✅ All features working in production mode

All 15 keyboard shortcuts migrated to TanStack Hotkeys
Command hints (@upload, @download, @ai) working
Shortcuts UI accessible and searchable
Terminal layout fix applied

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Plan Complete

**Total Tasks:** 27 granular implementation steps

**Estimated Time:** 3-4 hours

**Testing Strategy:**
- Manual testing after each slice
- End-to-end testing after all implementation
- Production build verification

**Commit Strategy:**
- Frequent commits (every 2-5 minutes)
- Descriptive messages with context
- Co-authored with Claude

---

**Plan saved to:** `docs/plans/2025-02-21-terminal-hints-hotkeys-shortcuts-implementation.md`
