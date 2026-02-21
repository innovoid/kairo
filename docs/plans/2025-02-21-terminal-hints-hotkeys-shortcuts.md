# Terminal Command Hints, TanStack Hotkeys Migration, and Shortcuts UI

**Date:** 2025-02-21

**Goal:** Add terminal command hints (@upload, @download, @ai), migrate all keyboard shortcuts to TanStack Hotkeys, and create a discoverable shortcuts reference UI.

**User Requirements:**
1. Terminal command hints that filter as you type (@up... → @upload)
2. @ai command translates natural language to shell command inline
3. Migrate all 15+ keyboard shortcuts from addEventListener to TanStack Hotkeys
4. Shortcuts reference UI as a Settings tab, accessible via Command Palette
5. Fix FloatingTabBar overlap - terminals hiding behind tab bar

---

## Architecture Overview

### High-Level Structure

```
App Root
└─ HotkeyProvider (TanStack Hotkeys context)
   └─ TerminalCentricAppShell
      ├─ FloatingTabBar (normal flow, not absolute)
      └─ MainArea
         └─ TerminalTab
            ├─ CommandHintOverlay (intercepts @ keystrokes)
            └─ XTerm (no hidden content)
```

### Key Components

**1. CommandHintOverlay**
- Transparent React overlay on top of terminal
- Intercepts keyboard events to detect `@` character
- Maintains input buffer state
- Shows filtered autocomplete menu
- Handles @upload, @download, @ai commands

**2. Hotkeys Registry**
- Central `hotkeys-registry.ts` defining all shortcuts
- Single source of truth for keybindings
- Used by both runtime handlers and shortcuts documentation

**3. Shortcuts Settings Tab**
- New tab in Settings alongside Terminal, Appearance, AI
- Reads from hotkeys registry
- Grouped by category with search/filter
- Accessible via Command Palette entry

**4. Layout Fix**
- FloatingTabBar uses normal document flow (not absolute)
- Terminals no longer hide behind tab bar

---

## Component Design

### 1. CommandHintOverlay

**Location:** `src/renderer/src/features/terminal/CommandHintOverlay.tsx`

**Props:**
```typescript
interface CommandHintOverlayProps {
  terminalRef: React.RefObject<Terminal>;
  sessionId: string;
  currentRemotePath?: string; // For SFTP context
}
```

**State:**
```typescript
const [inputBuffer, setInputBuffer] = useState('');
const [showMenu, setShowMenu] = useState(false);
const [filteredCommands, setFilteredCommands] = useState<CommandHint[]>([]);
const [selectedIndex, setSelectedIndex] = useState(0);
const [isTranslating, setIsTranslating] = useState(false);
```

**Command Definitions:**
```typescript
interface CommandHint {
  command: string;
  description: string;
  icon: LucideIcon;
  usage: string;
}

const COMMANDS: CommandHint[] = [
  {
    command: '@upload',
    description: 'Upload files to remote server',
    icon: Upload,
    usage: '@upload [path]'
  },
  {
    command: '@download',
    description: 'Download file from remote server',
    icon: Download,
    usage: '@download <filename>'
  },
  {
    command: '@ai',
    description: 'Translate natural language to shell command',
    icon: Sparkles,
    usage: '@ai <describe what you want>'
  }
];
```

**Behavior:**
- Listens to XTerm's `onData` event
- Detects `@` character → shows autocomplete menu
- Filters commands as user types: `@up` → shows `@upload`
- Arrow keys navigate menu, Enter selects
- ESC closes menu
- For `@upload`: Opens file picker, uploads to current SFTP path
- For `@download <file>`: Downloads specified file
- For `@ai <text>`: Calls AI translation, replaces entire input with command

### 2. Hotkeys Registry

**Location:** `src/renderer/src/lib/hotkeys-registry.ts`

**Interface:**
```typescript
export interface HotkeyDefinition {
  id: string;
  key: string; // TanStack format: "mod+k", "mod+shift+f"
  description: string;
  category: 'terminal' | 'navigation' | 'sftp' | 'recording' | 'broadcast' | 'general';
  handler: () => void;
}

export const HOTKEYS: HotkeyDefinition[] = [
  // General
  { id: 'command-palette', key: 'mod+k', description: 'Open command palette', category: 'general', handler: openCommandPalette },
  { id: 'settings', key: 'mod+,', description: 'Open settings', category: 'general', handler: openSettings },

  // Terminal
  { id: 'new-tab', key: 'mod+t', description: 'New terminal connection', category: 'terminal', handler: newTab },
  { id: 'close-tab', key: 'mod+w', description: 'Close active tab', category: 'terminal', handler: closeTab },
  { id: 'local-terminal', key: 'mod+l', description: 'Open local terminal', category: 'terminal', handler: openLocalTerminal },
  { id: 'search', key: 'mod+f', description: 'Search in terminal', category: 'terminal', handler: openSearch },

  // Navigation
  { id: 'browse-hosts', key: 'mod+h', description: 'Browse hosts', category: 'navigation', handler: browseHosts },
  { id: 'browse-files', key: 'mod+b', description: 'Open SFTP browser', category: 'navigation', handler: browseFiles },
  { id: 'snippets', key: 'mod+;', description: 'Open snippets', category: 'navigation', handler: openSnippets },

  // SFTP
  { id: 'open-sftp', key: 'mod+shift+f', description: 'Open SFTP for active tab', category: 'sftp', handler: openSftp },

  // Recording
  { id: 'toggle-recording', key: 'mod+shift+r', description: 'Start/stop recording', category: 'recording', handler: toggleRecording },

  // Broadcast
  { id: 'toggle-broadcast', key: 'mod+shift+b', description: 'Toggle broadcast mode', category: 'broadcast', handler: toggleBroadcast },

  // Split Panes
  { id: 'split-horizontal', key: 'mod+d', description: 'Split pane horizontally', category: 'terminal', handler: splitHorizontal },
  { id: 'split-vertical', key: 'mod+shift+d', description: 'Split pane vertically', category: 'terminal', handler: splitVertical },

  // Snippets
  { id: 'snippet-picker', key: 'mod+shift+s', description: 'Open snippet picker overlay', category: 'terminal', handler: openSnippetPicker },
];
```

**Usage Pattern:**
```typescript
// In components:
import { useHotkeys } from '@tanstack/react-hotkeys';
import { HOTKEYS } from '@/lib/hotkeys-registry';

function MyComponent() {
  const hotkey = HOTKEYS.find(h => h.id === 'command-palette');
  useHotkeys(hotkey.key, hotkey.handler, []);
}
```

### 3. ShortcutsSettingsTab

**Location:** `src/renderer/src/features/settings/ShortcutsSettingsTab.tsx`

**Features:**
- Search input to filter shortcuts
- Grouped by category with collapsible sections
- Each shortcut displays:
  - Description
  - Key combination badge (platform-aware: ⌘ on Mac, Ctrl on Windows)
  - Category color coding

**Layout:**
```
┌─────────────────────────────────────┐
│ Search shortcuts...          [🔍]  │
├─────────────────────────────────────┤
│ ▼ General                           │
│   Command Palette        Cmd+K      │
│   Settings               Cmd+,      │
│                                     │
│ ▼ Terminal                          │
│   New Connection         Cmd+T      │
│   Close Tab              Cmd+W      │
│   Local Terminal         Cmd+L      │
│   Search                 Cmd+F      │
│   Split Horizontal       Cmd+D      │
│   Split Vertical         Cmd+Shift+D│
│                                     │
│ ▼ Navigation                        │
│   Browse Hosts           Cmd+H      │
│   SFTP Browser           Cmd+B      │
│   Snippets               Cmd+;      │
└─────────────────────────────────────┘
```

### 4. Layout Changes

**FloatingTabBar:**
```typescript
// Before (absolute positioning):
<div className="absolute top-0 left-0 right-0 z-10 ...">

// After (normal flow):
<div className="relative w-full h-12 z-10 ...">
```

**TerminalCentricAppShell:**
```typescript
<div className="flex flex-col h-screen">
  <FloatingTabBar {...props} />
  <MainArea className="flex-1" />
</div>
```

**Result:** Terminals automatically start below tab bar, no hidden content.

---

## Data Flow & Integration

### Command Hints Flow

```
1. User types in terminal
   ↓
2. XTerm fires onData event
   ↓
3. CommandHintOverlay intercepts keystroke
   ↓
4. Detects "@" character
   → showMenu = true
   → inputBuffer = "@"
   ↓
5. User continues typing (e.g., "u", "p")
   → inputBuffer = "@up"
   → filteredCommands = ["@upload"]
   ↓
6. User presses Enter or clicks command:

   IF @upload:
       a. Call window.sftpApi.pickUploadFiles()
       b. Get selected file paths
       c. For each file:
          - Upload to currentRemotePath
          - Show progress toast
       d. Clear "@upload" from terminal input
       e. Close menu

   IF @download <filename>:
       a. Parse filename from inputBuffer
       b. Call window.sftpApi.download(sessionId, filename)
       c. Show progress toast
       d. Clear "@download <filename>" from terminal
       e. Close menu

   IF @ai <natural language>:
       a. Extract text after "@ai "
       b. Show loading indicator in menu
       c. Call window.aiApi.translateCommand({
            provider, apiKey, model,
            naturalLanguage: text,
            requestId: crypto.randomUUID()
          })
       d. Stream result chunks
       e. Replace entire "@ai ..." with translated command
       f. Leave command in terminal (DON'T execute)
       g. Close menu
```

### TanStack Hotkeys Migration

**Components to migrate:**

1. **TerminalCentricAppShell.tsx**
   - Current: 6 shortcuts with addEventListener
   - Migrate to: useHotkeys for each shortcut from registry

2. **FloatingTabBar.tsx**
   - Current: Context menu shortcuts (display only)
   - Update: Show shortcuts from registry in context menu

3. **MainArea.tsx**
   - Current: 3 shortcuts for split panes
   - Migrate to: useHotkeys with registry

4. **TerminalTab.tsx**
   - Current: 2 shortcuts (search, snippets)
   - Migrate to: useHotkeys with registry

5. **CommandPalette.tsx**
   - Current: Uses cmdk library (Cmd+K built-in)
   - Keep as-is: cmdk handles its own shortcuts

**Migration Pattern:**
```typescript
// Before:
useEffect(() => {
  function handleKeyDown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      openCommandPalette();
    }
  }
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, []);

// After:
import { useHotkeys } from '@tanstack/react-hotkeys';
import { HOTKEYS } from '@/lib/hotkeys-registry';

const commandPaletteHotkey = HOTKEYS.find(h => h.id === 'command-palette');
useHotkeys(commandPaletteHotkey.key, openCommandPalette, []);
```

### Shortcuts UI Integration

**Command Palette Entry:**
```typescript
// Add to CommandPalette.tsx commands array:
{
  id: 'keyboard-shortcuts',
  label: 'Keyboard Shortcuts',
  icon: Keyboard,
  keywords: ['hotkeys', 'keys', 'shortcuts', 'keybindings'],
  onSelect: () => {
    setOpen(false);
    openTab({
      tabId: 'settings',
      tabType: 'settings',
      label: 'Settings',
      settingsTab: 'shortcuts'
    });
  }
}
```

**Settings Integration:**
```typescript
// Update SettingsPage.tsx SettingsTab type:
export type SettingsTab = 'terminal' | 'appearance' | 'ai' | 'shortcuts';

// Add Shortcuts tab:
<TabsTrigger value="shortcuts">Shortcuts</TabsTrigger>

<TabsContent value="shortcuts">
  <ShortcutsSettingsTab />
</TabsContent>
```

---

## Error Handling & Edge Cases

### Command Hints Errors

**@upload:**
- No file selected → Do nothing, close menu
- No SFTP session → Toast: "No SFTP connection. Open SFTP first (Cmd+Shift+F)"
- Upload fails → Toast error, keep @upload in history for retry

**@download:**
- No filename provided → Show validation: "Usage: @download <filename>"
- File not found → Toast: "File not found: <filename>"
- No SFTP session → Toast: "No SFTP connection. Open SFTP first"

**@ai:**
- Empty query → Don't trigger (show usage hint)
- AI not configured → Toast: "Configure AI provider in Settings (Cmd+,)"
- Translation fails → Toast error, keep "@ai ..." text
- Translation timeout (30s) → Cancel, show error
- Network error → Toast: "AI service unavailable"

### Hotkeys Edge Cases

**Conflict Resolution:**
- TanStack Hotkeys handles first-registered-wins
- Registry prevents accidental duplicates (compile-time check)
- Test shortcuts on both Mac (cmd) and Windows/Linux (ctrl)

**Focus Scoping:**
- Terminal shortcuts only fire when terminal focused
- Global shortcuts (Cmd+K, Cmd+H) work everywhere
- Settings shortcuts only when settings open

**Escape Hatch:**
- ESC always closes overlays (command hints, search, etc.)
- Can't be overridden

### Layout Edge Cases

**FloatingTabBar:**
- Window resize → Flexbox adjusts naturally
- Many tabs → Horizontal scroll works
- Split panes → Tab bar applies to all panes

**Terminal Spacing:**
- Split panes → Each pane respects layout
- Full screen mode → Future: hide tab bar
- Different themes → Layout works for all themes

### Input Buffer Edge Cases

**CommandHintOverlay:**
- Fast typing → Debounce filtering (100ms)
- Delete back through @ → Hide menu immediately
- Paste with @ → Only typed @ triggers menu (not pasted)
- Multiple @ → Track most recent @
- Terminal resize → Reposition menu automatically

---

## Testing Strategy

### Manual Testing Checklist

**Command Hints:**
- [ ] Type @ → Menu appears with 3 commands
- [ ] Type @up → Filters to @upload only
- [ ] Type @d → Filters to @download only
- [ ] Type @a → Filters to @ai only
- [ ] Arrow keys navigate menu
- [ ] Enter selects command
- [ ] ESC closes menu
- [ ] @upload → Opens file picker, uploads file
- [ ] @download test.txt → Downloads file
- [ ] @ai list files → Translates to command, doesn't execute
- [ ] Delete @ → Menu closes

**Hotkeys Migration:**
- [ ] Cmd+K → Opens command palette
- [ ] Cmd+T → Opens new connection
- [ ] Cmd+W → Closes active tab
- [ ] Cmd+L → Opens local terminal
- [ ] Cmd+H → Opens browse hosts
- [ ] Cmd+B → Opens SFTP browser
- [ ] Cmd+; → Opens snippets
- [ ] Cmd+, → Opens settings
- [ ] Cmd+F → Opens search in terminal
- [ ] Cmd+Shift+F → Opens SFTP for active tab
- [ ] Cmd+Shift+R → Toggles recording
- [ ] Cmd+Shift+B → Toggles broadcast
- [ ] Cmd+D → Splits horizontal
- [ ] Cmd+Shift+D → Splits vertical
- [ ] Cmd+Shift+S → Opens snippet picker in terminal

**Shortcuts UI:**
- [ ] Cmd+K → Type "shortcuts" → Opens Settings/Shortcuts tab
- [ ] Search field filters shortcuts
- [ ] Categories collapse/expand
- [ ] All shortcuts display correct keys
- [ ] Mac shows ⌘, Windows shows Ctrl

**Layout Fix:**
- [ ] Terminal content not hidden behind tab bar
- [ ] First line visible
- [ ] Resize window → Layout adjusts
- [ ] Split panes → Both visible

---

## Implementation Notes

**Dependencies:**
```bash
npm install @tanstack/react-hotkeys
```

**File Structure:**
```
src/renderer/src/
├── features/
│   ├── terminal/
│   │   ├── CommandHintOverlay.tsx (NEW)
│   │   └── TerminalTab.tsx (MODIFIED - add overlay)
│   └── settings/
│       ├── ShortcutsSettingsTab.tsx (NEW)
│       └── SettingsPage.tsx (MODIFIED - add tab)
├── lib/
│   └── hotkeys-registry.ts (NEW)
└── components/
    └── layout/
        ├── FloatingTabBar.tsx (MODIFIED - remove absolute)
        ├── TerminalCentricAppShell.tsx (MODIFIED - wrap in HotkeyProvider, migrate shortcuts)
        ├── MainArea.tsx (MODIFIED - migrate shortcuts)
        └── CommandPalette.tsx (MODIFIED - add shortcuts entry)
```

**Migration Order:**
1. Install TanStack Hotkeys
2. Fix FloatingTabBar layout (remove absolute positioning)
3. Create hotkeys-registry.ts
4. Wrap App in HotkeyProvider
5. Migrate shortcuts component-by-component
6. Create CommandHintOverlay
7. Integrate overlay in TerminalTab
8. Create ShortcutsSettingsTab
9. Add shortcuts entry to command palette
10. Test all features end-to-end

---

## Success Criteria

✅ Users can type @ and see filtered command hints
✅ @upload opens file picker and uploads files via SFTP
✅ @download downloads specified file
✅ @ai translates natural language to shell command inline
✅ All 15+ keyboard shortcuts migrated to TanStack Hotkeys
✅ Shortcuts reference UI accessible via Settings and Command Palette
✅ Terminal content no longer hidden behind FloatingTabBar
✅ All shortcuts work on Mac, Windows, Linux
✅ No breaking changes to existing functionality

---

**Design Complete:** Ready for implementation planning.
