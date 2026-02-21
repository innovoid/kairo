# ArchTerm Terminal-Centric Layout Redesign

**Date:** 2025-02-21
**Status:** Approved
**Design Approach:** Terminal-First with Balanced Hybrid Navigation

## Executive Summary

This redesign transforms ArchTerm from a traditional sidebar-based application into a terminal-centric interface that maximizes workspace, eliminates clutter, and provides powerful keyboard-driven navigation while maintaining discoverability for mouse users.

**Key Changes:**
- Remove 260px sidebar → Terminals fill 100% viewport
- Command palette (Cmd+K) as universal interface
- Full-screen overlays for browsing/managing hosts, files, snippets, keys
- Floating tab bar with split view support
- Mini toolbar for visual navigation
- Integrated AI agent support (Claude Code, Codex, etc.)
- SFTP browser with drag-drop file operations
- `@` command system for special terminal operations

**Design Goals:**
1. **Terminal-centric** - Terminals are the primary interface, everything else supports them
2. **Maximum workspace** - Reclaim 260px horizontal space from sidebar
3. **Keyboard-first** - All actions accessible via Cmd+K command palette
4. **Discoverable** - Visual affordances for mouse users and feature discovery
5. **Context-aware** - UI adapts based on connection state and user activity
6. **Modern Depth aesthetic** - Preserve beautiful colors, motion, transitions from recent redesign

---

## 1. Overall Layout Architecture

### Two Primary States

**1. Terminal State (Default - 98% of screen time)**
- Terminals fill entire viewport (100% width × 100% height)
- Floating tab bar at top (48px height, semi-transparent)
- Mini toolbar in top-right corner (48px × 160px, glass effect)
- Everything else hidden until explicitly invoked
- Zero chrome, maximum workspace

**2. Overlay State (When browsing/managing)**
- Terminal dimmed with dark overlay (`bg-black/60 backdrop-blur-sm`)
- Full-screen modal appears in center (max-width: 1200px, max-height: 80vh)
- ESC or click backdrop to dismiss instantly
- Smooth 300ms scale + fade transition

### Spatial Organization

```
Z-Index Layers:
┌─────────────────────────────────────────┐
│ Overlays (z-1000)                       │
│   ├─ Host Browser                       │
│   ├─ SFTP Browser                       │
│   ├─ Snippet Library                    │
│   ├─ SSH Keys Manager                   │
│   └─ Settings                           │
├─────────────────────────────────────────┤
│ Command Palette (z-100)                 │
├─────────────────────────────────────────┤
│ Floating UI (z-10)                      │
│   ├─ Tab Bar (top, full width)         │
│   ├─ Mini Toolbar (top-right)          │
│   └─ AI Agent Panel (right side)       │
├─────────────────────────────────────────┤
│ Terminals (z-0)                         │
│   └─ Full viewport, xterm.js            │
└─────────────────────────────────────────┘
```

### Workspace Context

**No Persistent Breadcrumb:**
- Eliminates visual clutter
- Context shown in:
  - Command palette search results
  - Overlay headers (when open)
  - Tab bar workspace selector (dropdown)

**Workspace Switching:**
- Via command palette: "Switch workspace"
- Via tab bar dropdown (top-right)
- Prompts to close or keep tabs when switching

---

## 2. Terminal Interface & File Operations

### Terminal Display

**Full Viewport Coverage:**
- xterm.js terminal spans 100vw × 100vh
- No margins, no chrome (except floating elements)
- Terminals start at coordinates (0, 0)

**Tab Bar Integration:**
- Floating at top: 48px height
- Semi-transparent: `bg-[var(--surface-1)]/80 backdrop-blur-lg`
- Bottom border: `1px solid var(--border-subtle)`
- Each tab shows: icon, hostname, close button
- Active tab: 3px blue bottom border

### Drag-and-Drop File Upload

**Behavior:**
1. User drags file(s) over terminal window
2. Terminal gets pulsing blue border: `border-[var(--primary)] animate-pulse`
3. Overlay hint appears: "Drop to upload to current directory"
4. On drop → Upload via SFTP to current working directory
5. Progress toast in bottom-right: "Uploading file.txt... 45%"
6. Success toast: "✓ Uploaded file.txt to /home/user/path"

**Visual States:**
- Drag enter: Blue pulsing border (2px)
- Drag over: Blue pulsing border + overlay hint
- Drag leave: Remove border and hint
- Drop: Upload animation + progress indicator

### Special `@` Commands

**Why `@` prefix:**
- Rarely conflicts with shell commands
- Visual indicator (looks like "action")
- Easy to type, memorable
- Clear distinction from file paths (which use `/`)

**Available Commands:**

**File Operations:**
```bash
@download file.txt              # Download file from remote to local
@download /path/to/file.txt     # Download with full path
@upload localfile.txt           # Upload local file to current remote dir
@browse                         # Open SFTP browser overlay
```

**Snippet Operations:**
```bash
@snippet list                   # Show snippet library overlay
@snippet run <name>             # Run saved snippet
@snippet save <name>            # Save last command as snippet
```

**AI Agent Operations:**
```bash
@ask claude "explain this error"         # Quick ask Claude Code
@ask codex "optimize this function"      # Quick ask Codex
@ask cursor --context "last 10 lines"    # Ask with terminal context
```

**System Operations:**
```bash
@split horizontal               # Split terminal horizontally
@split vertical                 # Split terminal vertically
@theme <name>                   # Change color theme
@zoom <size>                    # Change font size
```

**Command Detection:**
- Intercept `@` commands before sending to shell
- Parse command and arguments
- Execute ArchTerm action
- Show result in terminal or trigger overlay

**Alternative Input Method:**
User can also trigger commands via:
- Command palette (Cmd+K) for discoverability
- Mini toolbar buttons for visual access
- Keyboard shortcuts for common actions

---

## 3. Command Palette (Cmd+K)

### Universal Interface

**Activation:**
- Global hotkey: `Cmd+K` (Mac) or `Ctrl+K` (Windows/Linux)
- Always accessible, even with overlays open
- Closes any open overlay before appearing

**Visual Design:**
```
┌──────────────────────────────────────────────┐
│  🔍 Search hosts, snippets, commands...      │
├──────────────────────────────────────────────┤
│  📁 Hosts                                    │
│    🖥 prod-server-01          ssh prod-01   │
│    🖥 dev-server              Cmd+1          │
│    🖥 staging-db              ssh staging    │
│                                              │
│  💬 AI Agents                                │
│    💬 Ask Claude Code         @ask claude    │
│    💬 Ask Codex               @ask codex     │
│                                              │
│  ⚡ Actions                                  │
│    📂 Browse files            Cmd+B          │
│    📝 Snippets                Cmd+;          │
│    🔑 SSH Keys                               │
└──────────────────────────────────────────────┘
```

**Dimensions:**
- Width: 600px
- Max height: 60vh (scrollable)
- Centered on screen
- Dark glass: `bg-[var(--surface-4)]/95 backdrop-blur-xl`
- Border: `1px solid var(--border)`
- Rounded: 12px
- Shadow: Large elevation (`shadow-2xl`)

### Search & Filtering

**Fuzzy Search:**
- Real-time filtering as you type
- Matches: host names, descriptions, tags, command names
- Highlights matched characters
- Scores by relevance + recency

**Search Examples:**
- `prod` → Shows all production hosts
- `ssh` → Shows SSH-related actions and hosts
- `snippet docker` → Filters snippets with "docker"
- `ask` → Shows AI agent actions
- `split` → Shows split view commands

### Command Categories

**Hosts & Connections:**
- `ssh <hostname>` → Connect to host
- `ssh new` → Create new host
- `switch workspace` → Change workspace
- `recent connections` → Show recently used hosts

**File Operations:**
- `browse files` → Open SFTP browser
- `download <file>` → Download from remote
- `upload <file>` → Upload to remote
- `open local` → Open local terminal

**Snippets:**
- `snippet <name>` → Run snippet in active terminal
- `snippet new` → Create new snippet
- `snippet list` → Browse all snippets
- `snippet save` → Save last command as snippet

**SSH Keys:**
- `keys list` → Manage SSH keys
- `keys import` → Import existing key
- `keys generate` → Generate new key pair
- `keys export` → Export public key

**AI Agents:**
- `ask claude <question>` → Quick ask Claude Code
- `ask codex <question>` → Quick ask Codex
- `ask cursor <question>` → Quick ask Cursor
- `open ai panel` → Open agent chat panel

**Terminal Management:**
- `new terminal` → New terminal tab
- `split horizontal` → Split current terminal
- `split vertical` → Split vertically
- `close tab` → Close current tab

**Settings & Configuration:**
- `settings` → Open settings overlay
- `theme <name>` → Change color theme
- `font size <number>` → Change font size
- `shortcuts` → Show keyboard shortcuts
- `about` → About ArchTerm

### Result Display

**Layout:**
- Grouped by category with headers
- Each result: Icon + Title + Description + Shortcut
- Top 8 results visible, scroll for more
- Recent/frequent items boosted in ranking

**Result Item:**
```
┌──────────────────────────────────────────┐
│  🖥  prod-server-01                  Cmd+1│
│  user@192.168.1.100 • Connected          │
└──────────────────────────────────────────┘
```

### Keyboard Navigation

- `↑/↓` - Navigate results
- `Enter` - Execute selected command
- `Cmd+1-9` - Jump to result 1-9
- `Tab` - Cycle through categories
- `Cmd+Backspace` - Clear search
- `ESC` - Close palette

---

## 4. Full-Screen Overlays

### Common Pattern

All overlays share consistent design:

**Visual Treatment:**
- Backdrop: `bg-black/60 backdrop-blur-sm`
- Modal: `max-w-[1200px] max-h-[80vh]`
- Background: `bg-[var(--surface-2)]`
- Border: `1px solid var(--border)`
- Rounded: 16px
- Shadow: `shadow-2xl`
- Padding: 24px from viewport edges

**Animation:**
- Enter: Scale 0.95→1.0 + Fade 0→1 (300ms)
- Exit: Scale 1.0→0.98 + Fade 1→0 (300ms)
- Easing: `cubic-bezier(0.16, 1, 0.3, 1)`

**Header Pattern:**
- Height: 64px
- Left: Title + Breadcrumb/Context
- Center: Search input (if applicable, 300px)
- Right: Close button (×)
- Bottom border: `border-b border-[var(--border-subtle)]`

**Dismissal:**
- ESC key
- Click backdrop
- Click close button (×)
- Execute action (e.g., connect to host)

---

### Host Browser Overlay

**Trigger:** Command palette "hosts", toolbar icon, or `Cmd+H`

**Layout:**
```
┌─────────────────────────────────────────────────┐
│  Hosts  [Workspace ▼]  [🔍 Search...]      [×] │
├─────────────────────────────────────────────────┤
│  📁 Production (5)                          ▼   │
│    🖥 prod-server-01                          →│
│    user@192.168.1.100:22 • RSA Key            │
│    ● Connected                                 │
│                                                │
│    🖥 prod-db-master                          →│
│    admin@db.prod.com:22 • Password            │
│    ○ Disconnected                             │
│                                                │
│  📁 Development (3)                         ▼   │
│    🖥 dev-server                              →│
│    dev@localhost:2222 • RSA Key               │
│    ○ Disconnected                             │
├─────────────────────────────────────────────────┤
│  [+ Create Folder]              [+ Add Host]   │
└─────────────────────────────────────────────────┘
```

**Features:**
- **List view**: Efficient scanning of many hosts
- **Expandable folders**: Click header to expand/collapse
- **Connection status**: Colored dot + text ("Connected", "Disconnected")
- **Quick connect**: Click host to connect immediately
- **Context menu**: Right arrow (→) opens Edit/Delete/Duplicate
- **Search**: Filter by name, hostname, tags
- **Keyboard nav**: Arrow keys, Enter to connect, Space to expand folder

**List Item Design:**
- Height: 64px
- Padding: 16px
- Hover: `bg-[var(--surface-3)]` with `-translate-y-0.5px`
- Click: Connect and dismiss overlay
- Transition: 200ms all properties

**Folder Header:**
- Clickable to expand/collapse
- Shows host count in parentheses
- Chevron icon rotates 90° on expand
- Slightly darker background: `bg-[var(--surface-1)]`

**Empty State:**
- Centered illustration
- "No hosts yet"
- "Press + to add your first host"
- Large "Add Host" button

---

### SFTP File Browser Overlay

**Trigger:** `@browse`, Command palette "browse files", or `Cmd+B` (when connected)

**Layout: Two-Panel Split**
```
┌──────────────────────────────────────────────────┐
│  SFTP Browser - prod-server-01             [×]  │
├──────────────────────────────────────────────────┤
│  Local                    │  Remote              │
│  /Users/you/Downloads  ↑↓ │  /home/user/     ↑↓  │
├────────────────────────────┼──────────────────────┤
│  📁 Documents              │  📁 projects         │
│  📁 Pictures               │  📁 logs             │
│  📄 report.pdf    2.4MB    │  📄 config.yml  1KB  │
│  📄 data.csv      890KB    │  📄 app.log     45MB │
│  📄 image.png     1.2MB    │  📄 script.sh   2KB  │
│                            │                      │
│  [← Upload]                │  [Download →]        │
└────────────────────────────┴──────────────────────┘
```

**Features:**
- **Dual panes**: Local files (left) | Remote files (right)
- **Drag between panes**: Drag file from one side to other to transfer
- **Breadcrumb navigation**: Click path segments to navigate up
- **File operations**: Context menu (Delete, Rename, Permissions)
- **Transfer progress**: Inline progress bar on transferring files
- **Multi-select**: Cmd+Click or Shift+Click for multiple files
- **Keyboard nav**: Arrow keys, Enter to open folder, Delete key
- **Upload button**: Click to show file picker (bottom-left)
- **Download button**: Download selected files (bottom-right)

**File Item:**
- Shows icon (folder/file type), name, size, modified date
- Folders appear first, then files alphabetically
- Hover: Background highlight
- Double-click folder: Navigate into folder
- Double-click file: Download (remote) or Open (local)

**Transfer Progress:**
```
┌────────────────────────────────────────┐
│  📄 uploading-file.zip                │
│  ████████████░░░░░░░░  62% (4.5MB)    │
└────────────────────────────────────────┘
```

**Permissions Dialog:**
- Shows chmod controls (read/write/execute for owner/group/other)
- Visual checkboxes + numeric representation
- Apply button executes chmod command

---

### Snippet Library Overlay

**Trigger:** Command palette "snippets", toolbar icon, or `Cmd+;`

**Layout:**
```
┌─────────────────────────────────────────────────┐
│  Snippets  [🔍 Search...]                  [×] │
├─────────────────────────────────────────────────┤
│  🏷 Docker (8)                              ▼   │
│    Container logs                             →│
│    docker logs -f --tail 100 [container]      │
│    Tail last 100 lines from container logs    │
│                                                │
│    Stop all containers                        →│
│    docker stop $(docker ps -q)                │
│    Stop all running Docker containers         │
│                                                │
│  🏷 Git (12)                                ▼   │
│    Interactive rebase                         →│
│    git rebase -i HEAD~[n]                     │
│    Rebase and edit last n commits             │
├─────────────────────────────────────────────────┤
│                              [+ Create Snippet]│
└─────────────────────────────────────────────────┘
```

**Features:**
- **Tag-based grouping**: Expandable categories
- **Command preview**: Shows actual command in monospace
- **Description**: Brief explanation of what snippet does
- **Click to insert**: Click snippet to insert into active terminal
- **Right arrow action**: Click → to run immediately (without confirmation)
- **Variables**: Commands with `[variable]` prompt for input before running
- **Search**: Filter by name, command, tags
- **Keyboard nav**: Arrow keys, Enter to insert, Cmd+Enter to run

**Snippet Item:**
- Name: Bold, 16px
- Command: Monospace font, `text-[var(--text-secondary)]`
- Description: Smaller, `text-[var(--text-tertiary)]`
- Height: 80px (auto-expands if long command)

**Variable Input Dialog:**
When snippet has variables like `[container]`:
```
┌─────────────────────────────────────┐
│  Run Snippet: Container logs        │
├─────────────────────────────────────┤
│  container:                         │
│  [nginx-server____________]         │
│                                     │
│              [Cancel]  [Run]        │
└─────────────────────────────────────┘
```

**Create Snippet:**
- Opens form dialog
- Fields: Name, Command, Description, Tags
- Saves to workspace or global
- Instant availability after creation

---

### SSH Keys Overlay

**Trigger:** Command palette "keys", toolbar icon

**Layout:**
```
┌─────────────────────────────────────────────────┐
│  SSH Keys  [🔍 Search...]                  [×] │
├─────────────────────────────────────────────────┤
│  🔑 personal-macbook                          →│
│  RSA 4096 • SHA256:abc123def456...            │
│  Added Jan 15, 2025                            │
│                                                │
│  🔑 work-laptop                               →│
│  ED25519 • SHA256:789ghi012jkl...             │
│  Added Dec 10, 2024                            │
│                                                │
│  🔑 server-deploy                             →│
│  RSA 2048 • SHA256:345mno678pqr...            │
│  Added Nov 5, 2024                             │
├─────────────────────────────────────────────────┤
│  [+ Generate Key]              [+ Import Key]  │
└─────────────────────────────────────────────────┘
```

**Features:**
- **List view**: All keys with metadata
- **Key type**: RSA/ED25519/ECDSA with bit length
- **Fingerprint**: SHA256 hash (truncated)
- **Date added**: When key was imported/generated
- **Click to copy**: Click key to copy public key to clipboard
- **Context menu**: Right arrow (→) for Export/Delete
- **Search**: Filter by name, fingerprint
- **Generate**: Create new key pair with options dialog
- **Import**: Browse for existing private key file

**Generate Key Dialog:**
```
┌─────────────────────────────────────┐
│  Generate SSH Key                   │
├─────────────────────────────────────┤
│  Key name:                          │
│  [new-server-key___________]        │
│                                     │
│  Key type: ⦿ ED25519  ○ RSA        │
│                                     │
│  ☐ Add passphrase protection        │
│                                     │
│           [Cancel]  [Generate]      │
└─────────────────────────────────────┘
```

---

### Settings Overlay

**Trigger:** Command palette "settings", toolbar icon, or `Cmd+,`

**Layout: Vertical Tabs**
```
┌──────────┬────────────────────────────────────┐
│ Terminal │  Font Family: JetBrains Mono    ▼ │
│ Appear.  │  Font Size: 14px                ▼ │
│ AI       │  Color Theme: Modern Depth      ▼ │
│ Keybinds │  Cursor Style: ● Block  ○ Line    │
│ Advanced │  ☑ Confirm before closing tabs    │
│          │  ☑ Restore tabs on startup        │
└──────────┴────────────────────────────────────┘
```

**Tabs:**
1. **Terminal**: Font, theme, cursor, scrollback
2. **Appearance**: Colors, opacity, spacing
3. **AI Agents**: Configure Claude Code, Codex, etc.
4. **Keybindings**: Customize keyboard shortcuts
5. **Advanced**: Debug, performance, experimental

**Behavior:**
- Active tab: Blue left border (3px)
- Settings save automatically (no Apply button)
- Changes reflect immediately in terminal
- Reset to defaults button per section

---

## 5. Mini Toolbar (Floating Top-Right)

### Purpose
Quick visual access to management tools for mouse users who prefer clicking over keyboard shortcuts.

### Position & Design
- **Position**: Fixed top-right corner (16px from top, 16px from right)
- **Shape**: Dark glass pill (`bg-[var(--surface-1)]/90 backdrop-blur-lg`)
- **Size**: 48px height × auto width
- **Border**: `1px solid var(--border)` with subtle glow
- **Rounded**: 24px (full pill)
- **Padding**: 8px
- **Shadow**: `shadow-lg`
- **Z-index**: 10 (above terminals, below overlays)

### Button Layout
```
┌─────────────────────────────────────────┐
│ [🖥] [📁] [📝] [🔑] │ [🔍] [⚙️]        │
└─────────────────────────────────────────┘
```

**Buttons (Left to Right):**

1. **Hosts** (Server icon) - Opens host browser
   - Tooltip: "Hosts (Cmd+H)"
   - Blue dot indicator if any connected sessions

2. **Files** (Folder icon) - Opens SFTP browser
   - Tooltip: "Browse Files (Cmd+B)"
   - Disabled (40% opacity) when not connected

3. **Snippets** (Code icon) - Opens snippet library
   - Tooltip: "Snippets (Cmd+;)"

4. **Keys** (Key icon) - Opens SSH keys manager
   - Tooltip: "SSH Keys"

5. **Divider** (vertical line, subtle)

6. **Command Palette** (Search icon) - Opens Cmd+K
   - Tooltip: "Command Palette (Cmd+K)"

7. **Settings** (Gear icon) - Opens settings
   - Tooltip: "Settings (Cmd+,)"

### Button Styling
- Size: 32px × 32px per button
- Icon: 18px
- Gap: 4px between buttons
- Hover: `bg-[var(--surface-3)]` with `scale(1.05)`
- Active: `bg-[var(--primary)]` with white icon
- Disabled: 40% opacity, no hover
- Transition: 200ms ease-out

### Auto-Hide Behavior
- **Default**: Visible at 100% opacity
- **After 3s inactivity**: Fade to 20% opacity (300ms)
- **On mouse near top-right**: Return to 100% opacity instantly
- **When overlay open**: Always 100% opacity
- **User preference**: Can toggle auto-hide in settings

---

## 6. Tab Management (Floating Tab Bar)

### Position & Design
- **Position**: Fixed at top, full width, 0px from top
- **Height**: 48px
- **Background**: `bg-[var(--surface-1)]/80 backdrop-blur-lg`
- **Border**: Bottom only, `1px solid var(--border-subtle)`
- **Z-index**: 10 (floats above terminal)

### Layout Structure
```
┌─────────────────────────────────────────────────────┐
│ [🖥 prod-01][🖥 dev][🖥 local] [+]     [workspace▼]│
└─────────────────────────────────────────────────────┘
```

### Individual Tab Design

**Dimensions:**
- Width: 200px max (auto-shrinks when many tabs)
- Min width: 120px
- Height: 48px (full tab bar height)
- Padding: 12px 16px

**Content:**
- Icon: 16px (host favicon or generic server icon)
- Label: Hostname, truncated with ellipsis
- Close button (×): 16px, appears on hover (always visible on active)

**Visual States:**

**Active Tab:**
- Blue bottom border: 3px solid `var(--primary)`
- Text: `text-[var(--primary)]`
- Background: Slightly lighter than tab bar
- Close button: Always visible

**Inactive Tab:**
- No border
- Text: `text-[var(--text-secondary)]`
- Background: Transparent
- Hover: `bg-[var(--surface-2)]`
- Close button: Appears on hover

**Status Indicators:**
- **Connected**: Small green dot (6px) before icon
- **Connecting**: Pulsing orange dot
- **Disconnected**: Grey dot
- **Error**: Red dot with tooltip on hover

### Tab Interactions

**Click:** Focus that terminal
**Middle Click:** Close tab
**Double Click:** Rename tab (inline edit)
**Right Click:** Context menu
  - Rename
  - Duplicate Connection
  - Close Others
  - Close to Right
  - Move to New Window

**Drag:**
- Drag tab left/right to reorder
- Visual indicator shows drop position
- Smooth animation on reorder

**Close Button (×):**
- Always visible on active tab
- Appears on hover for inactive tabs
- Hover: Background circle highlight
- Confirm if unsaved work or active session

### New Tab Button (+)

**Position:** Immediately after last tab
**Size:** 40px × 48px
**Icon:** Plus symbol (20px)
**Behavior:** Opens command palette filtered to "ssh" commands
**Hover:** `bg-[var(--surface-3)]`
**Tooltip:** "New Connection (Cmd+T)"

### Workspace Selector (Right Side)

**Position:** Fixed right side of tab bar
**Size:** Auto width, 48px height
**Content:** Icon + Workspace name + Chevron
**Click:** Opens dropdown menu
**Menu Items:**
  - List of all workspaces
  - ---
  - Create Workspace
  - Manage Workspaces

**Visual:**
```
[🏢 Production ▼]
```

### Split View Button (Right Side)

**Position:** Between workspace selector and edge
**Size:** 40px × 48px
**Icon:** Split layout icon (two rectangles)
**Behavior:** Toggle split view mode
**States:**
  - Default: Grey icon
  - Active: Blue icon when splits enabled
**Tooltip:** "Split View (Cmd+Shift+D)"

### Tab Overflow Handling

**When >6 tabs:**
- Tab bar becomes horizontally scrollable
- Fade indicators on left/right edges
- Scroll buttons appear (chevron left/right)
- Active tab auto-scrolls into view
- Mouse wheel scrolls tabs horizontally

---

## 7. Split View & Terminal Layout

### Activation
- Click split button in tab bar
- Command palette: "split view"
- Hotkey: `Cmd+Shift+D`
- Menu appears with layout options

### Layout Options

**1. Horizontal Split (50/50)**
```
┌───────────────────────┬───────────────────────┐
│                       │                       │
│    Terminal 1         │    Terminal 2         │
│                       │                       │
└───────────────────────┴───────────────────────┘
```

**2. Vertical Split (50/50)**
```
┌─────────────────────────────────────────────┐
│              Terminal 1                     │
├─────────────────────────────────────────────┤
│              Terminal 2                     │
└─────────────────────────────────────────────┘
```

**3. Grid 2×2**
```
┌─────────────────────┬─────────────────────┐
│    Terminal 1       │    Terminal 2       │
├─────────────────────┼─────────────────────┤
│    Terminal 3       │    Terminal 4       │
└─────────────────────┴─────────────────────┘
```

**4. Sidebar Split (30/70)**
```
┌──────────┬────────────────────────────────┐
│          │                                │
│ Term 1   │        Terminal 2              │
│          │                                │
└──────────┴────────────────────────────────┘
```

### Pane Features

**Resizable Dividers:**
- Drag divider to adjust pane sizes
- Double-click divider to reset to even split
- Divider: 4px width, `bg-[var(--border)]`
- Drag handle appears on hover: `bg-[var(--primary)]`

**Focus Indication:**
- Active pane: 2px solid blue border `border-[var(--primary)]`
- Other panes: Subtle border `border-[var(--border-subtle)]`
- Click pane to focus
- Keyboard input goes to focused pane

**Pane Tabs:**
- Each pane shows which session it displays
- Mini tab indicator at top of pane: 32px height
- Shows hostname + close button
- Click to switch session in that pane

**Keyboard Navigation:**
- `Cmd+Alt+←` - Focus left pane
- `Cmd+Alt+→` - Focus right pane
- `Cmd+Alt+↑` - Focus top pane
- `Cmd+Alt+↓` - Focus bottom pane
- `Cmd+Shift+D` - Close split (return to single view)

### Split Behavior

**Creating Split:**
- Current terminal remains in place
- New pane appears with session selector
- Choose which session to show in new pane
- Animation: Slide in from edge (300ms)

**Closing Split:**
- Drag divider to screen edge, or
- Press `Cmd+Shift+D` again, or
- Close all but one pane
- Remaining pane expands to full viewport
- Animation: Slide out (300ms)

**Session Assignment:**
- Each pane can show any open terminal session
- Panes remember their assignments
- Switching tabs changes all panes
- Can show same session in multiple panes (read-only in non-focused)

---

## 8. AI Agent Integration

### Concept
Integrate local coding agents (Claude Code, Codex, OpenCode, Cursor) directly into terminal workflow for AI-assisted development and system administration.

### Agent Configuration

**Settings Overlay → AI Agents Tab**

```
┌─────────────────────────────────────────────────┐
│  Configured Agents                              │
│                                                 │
│  ✓ Claude Code                         [Edit]  │
│    Path: /usr/local/bin/claude                 │
│    Status: ● Available                         │
│                                                 │
│  ✓ OpenAI Codex                        [Edit]  │
│    Path: /usr/local/bin/codex                  │
│    API Key: ●●●●●●●●●●●●                      │
│    Status: ● Available                         │
│                                                 │
│  ✗ Cursor AI                           [Edit]  │
│    Path: Not configured                        │
│    Status: ○ Not available                     │
│                                                 │
│  [+ Add Agent]                                 │
└─────────────────────────────────────────────────┘
```

**Agent Configuration Dialog:**
- Agent name
- Agent type: Local executable | Cloud API
- Executable path (with file picker for local)
- API key (for cloud agents)
- Environment variables (optional)
- Startup arguments (optional)
- Test button to verify agent works

### Access Methods

**1. Via Command Palette (Cmd+K)**
```
Search: "ask claude"

Results:
  💬 Ask Claude Code       Open chat panel
  💬 Ask Codex            Open chat panel
  💬 Ask Cursor           Open chat panel
  ⚡ Quick ask Claude     Inline prompt
```

**2. Via `@` Commands in Terminal**
```bash
# Quick questions
@ask claude "explain this error"
@ask codex "optimize this function"
@ask cursor "generate tests for main.py"

# With context from terminal
@ask claude --context "explain the last 10 lines"
@ask claude --file config.yml "review this config"
```

**3. Via Mini Toolbar**
New button added: **AI Agent** (sparkle/brain icon)
- Click: Opens agent selector dropdown
- Select agent → Opens agent chat panel
- Badge shows if panel has unread messages

**4. Via Keyboard Shortcut**
- `Cmd+Shift+A` - Open agent panel
- `Cmd+Shift+Q` - Quick ask (inline prompt)

### Agent Chat Panel (Sliding Side Panel)

**Visual Design:**
- Slides in from right side of screen
- Width: 400px (resizable 300-600px)
- Terminal shrinks to accommodate
- Semi-transparent divider with resize handle
- Same Modern Depth styling

**Layout:**
```
┌────────────────────────────────────────┐
│  💬 Claude Code            [–] [×]     │ Header
├────────────────────────────────────────┤
│                                        │
│  You: Explain this error              │
│  10:30 AM                              │
│                                        │
│  Claude: This is a permission error.  │
│  The script is trying to write to...  │
│  10:30 AM                              │
│                                        │
│  [Copy] [Insert] [Run]                │
│                                        │
│  You: How do I fix it?                │
│  10:31 AM                              │
│                                        │
│  Claude: Run with sudo or change...   │
│  10:31 AM                              │
│                                        │
│  [Copy] [Insert] [Run]                │
│                                        │
│  ▼                                     │
├────────────────────────────────────────┤
│  [📎 Attach ▼]  Type message...       │ Input
│  [Send]                                │
└────────────────────────────────────────┘
```

**Features:**

**Message Display:**
- User messages: Right-aligned, blue background
- Agent messages: Left-aligned, grey background
- Timestamps on all messages
- Code blocks: Syntax highlighted, monospace
- Copy button on all code blocks

**Context Attachment:**
Click "Attach" dropdown to add context:
- [ ] Current directory listing
- [ ] Last 10 lines of terminal output
- [ ] Last 50 lines of terminal output
- [ ] Selected text from terminal
- [ ] Clipboard content
- [ ] Specific file... (file picker)

**Message Actions:**
Each agent response has action buttons:
- **Copy**: Copy text to clipboard
- **Insert**: Insert text into terminal (at cursor)
- **Run**: Insert and execute immediately
- **Save as Snippet**: Save command as reusable snippet

**Panel Header:**
- Agent name and icon
- Minimize button (–): Collapses to floating button
- Close button (×): Closes panel entirely
- Agent switcher dropdown (when multiple agents configured)

**Panel States:**

**Collapsed (Floating Button):**
- Small floating button in bottom-right corner
- Shows agent icon + unread count badge
- Click to expand panel
- Position: 16px from right, 16px from bottom

**Expanded:**
- Full 400px width panel from right
- Can resize by dragging left edge (300-600px)
- Terminal shrinks: `width = 100vw - panelWidth`

**Pinned:**
- Panel stays open across tab switches
- Each tab can have own conversation thread
- Badge on tab shows which has active conversation

### Quick Ask Feature (Inline)

**Trigger:** `@ask <agent> "question"` in terminal

**Behavior:**
1. Command consumed (not sent to shell)
2. Inline overlay appears above terminal cursor
3. Shows thinking indicator → agent response
4. Auto-dismisses after 10 seconds or ESC

**Visual:**
```
┌──────────────────────────────────────────┐
│  💬 Claude Code                   [×]    │
│  This command lists all running          │
│  processes. The 'aux' flags show all     │
│  users (a), without TTY (x), and user-   │
│  oriented format (u).                    │
│                                          │
│  [Copy]  [Insert]  [Full Chat]          │
└──────────────────────────────────────────┘
```

**Dimensions:**
- Width: 500px
- Max height: 300px (scrollable)
- Position: Above terminal cursor, or centered if near top
- Dark glass: `bg-[var(--surface-4)]/95 backdrop-blur-lg`

### Agent Capabilities

**Context-Aware:**
- Sees current working directory
- Can read terminal history (with permission)
- Knows which host you're connected to
- Can reference files in current directory

**Multi-Turn Conversations:**
- Full conversation history
- Reference previous questions/answers
- Build context iteratively

**Command Generation:**
- User: "How do I find large files?"
- Agent: Provides command with explanation
- [Insert] button adds to terminal

**Code Review:**
- Paste code snippet or reference file
- Get review, suggestions, improvements
- Apply suggestions with one click

**Debugging:**
- Share error output
- Get explanation + solution
- Execute suggested fix commands

**System Administration:**
- "How do I set up nginx?"
- Get step-by-step commands
- Execute each with confirmation

### Privacy & Security

**Settings Toggles:**
- [ ] Allow agents to read terminal history
- [ ] Allow agents to read current directory
- [ ] Auto-attach context with every message
- [ ] Confirm before executing agent commands

**Context Warning:**
When attaching sensitive context:
- Preview what will be sent to agent
- Warn if includes credentials, keys, tokens
- Option to redact before sending
- Clear indication of what agent can see

### Agent Suggestions (Proactive)

**Error Detection:**
When terminal shows an error:
- Small button appears: "Ask AI about this error?"
- Click → Quick ask with error pre-filled
- Suggested fix displayed inline

**Pattern Recognition:**
- User types long command → "Save as snippet?"
- User types repetitive commands → "Create macro?"
- User edits config file → "Want AI review?"

### Agent Integration with Existing Features

**Snippets + Agents:**
- "Improve this snippet with AI"
- Agent suggests optimized version
- Save improved version with one click

**SFTP + Agents:**
- "How do I set permissions on these files?"
- Agent suggests chmod commands
- Execute directly in SFTP context

**Settings + Agents:**
- "Help me optimize terminal settings"
- Agent suggests configuration
- Apply with confirmation

### Keyboard Shortcuts

- `Cmd+Shift+A` - Open/close agent panel
- `Cmd+Shift+Q` - Quick ask (inline prompt)
- `Cmd+Shift+H` - Toggle panel visibility
- `Cmd+L` (in panel) - Clear conversation
- `Cmd+Enter` (in input) - Send message
- `ESC` (in panel) - Close panel

---

## 9. Animations & State Transitions

### Overlay Transitions

**Entrance:**
- Duration: 300ms
- Easing: `cubic-bezier(0.16, 1, 0.3, 1)` (smooth spring)
- Transform: Scale 0.95 → 1.0
- Opacity: 0 → 1
- Backdrop: Fade 0 → 60% opacity
- Blur: 0 → sm (4px)

**Exit:**
- Duration: 300ms
- Transform: Scale 1.0 → 0.98
- Opacity: 1 → 0
- Backdrop: Fade out simultaneously

**Code:**
```css
.overlay-enter {
  animation: overlay-in 300ms cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes overlay-in {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1.0);
  }
}
```

### Command Palette

**Faster than overlays:**
- Duration: 200ms (snappier feel)
- Easing: `cubic-bezier(0.4, 0, 0.2, 1)`
- Transform: Scale 0.98 → 1.0
- Opacity: 0 → 1
- Backdrop: Instant blur (no fade)

### Tab Bar Auto-Hide

**Fade Out:**
- Delay: 3 seconds of mouse inactivity
- Duration: 300ms linear
- Target opacity: 20%

**Fade In:**
- Trigger: Mouse movement near top
- Duration: Instant (0ms)
- Target opacity: 100%

### Toolbar Button Interactions

**Hover:**
- Scale: 1.0 → 1.05
- Duration: 200ms
- Easing: ease-out
- Background: Fade to `surface-3`

**Active (Click):**
- Scale: 1.05 → 0.98 → 1.0
- Duration: 150ms
- Easing: ease-in-out
- Background: Flash `primary` color

### List Item Hover (Overlays)

**Host/Snippet Items:**
- Background: Fade to `surface-3` (200ms)
- Transform: translateY(-0.5px) (200ms)
- Shadow: Subtle elevation increase
- Easing: ease-out

### Split View

**Creating Split:**
- New pane slides in from edge (300ms)
- Existing pane(s) shrink smoothly
- Divider fades in (200ms)
- Easing: `cubic-bezier(0.16, 1, 0.3, 1)`

**Closing Split:**
- Pane slides out to edge (300ms)
- Remaining pane expands to fill
- Divider fades out (200ms)

**Resizing:**
- Live resize as user drags
- Transition: None (immediate feedback)
- Drop: Snap to nearest 5% increment

### AI Agent Panel

**Slide In:**
- Duration: 300ms
- Easing: `cubic-bezier(0.16, 1, 0.3, 1)`
- Transform: translateX(100%) → 0
- Opacity: 0 → 1
- Terminal shrinks simultaneously

**Slide Out:**
- Duration: 300ms
- Transform: 0 → translateX(100%)
- Terminal expands simultaneously

**Collapse to Button:**
- Duration: 250ms
- Scale panel down to button size
- Move to bottom-right corner
- Easing: `cubic-bezier(0.4, 0, 0.2, 1)`

### Loading States

**Skeleton Screens:**
- Background: `surface-1`
- Shimmer: Gradient sweep (1.5s infinite)
- Used in: Host list, snippet list while loading

**Spinners:**
- Connection status: Rotating (0.8s linear infinite)
- Size: 16px inline, 32px full screen
- Color: `primary` blue

**Progress Bars:**
- File transfers: Smooth width transition
- Color: `primary` with pulse on active
- Shows percentage text inline

### Page Transitions

**Switching Overlays:**
- Old overlay: Fade out + scale down (150ms)
- Slight pause (50ms)
- New overlay: Fade in + scale up (200ms)
- Total: 400ms smooth handoff

### Micro-interactions

**Button Press:**
- Scale: 1.0 → 0.98 → 1.0 (150ms)
- Gives tactile feedback

**Checkbox/Toggle:**
- Scale: 1.0 → 1.1 → 1.0 (200ms)
- Color: Fade to primary (200ms)

**Drag Indicators:**
- Opacity pulse during drag (0.6 → 1.0 → 0.6)
- Drop zone: Border pulse when valid target

---

## 10. Keyboard Shortcuts Reference

### Global Shortcuts (Always Available)

**Command & Navigation:**
- `Cmd/Ctrl + K` - Open command palette
- `Cmd/Ctrl + H` - Open hosts browser
- `Cmd/Ctrl + B` - Open SFTP browser (when connected)
- `Cmd/Ctrl + ;` - Open snippets library
- `Cmd/Ctrl + ,` - Open settings
- `Cmd/Ctrl + /` - Show keyboard shortcuts help
- `ESC` - Close any overlay/palette/panel

**Terminal Management:**
- `Cmd/Ctrl + T` - New terminal connection
- `Cmd/Ctrl + W` - Close current tab
- `Cmd/Ctrl + Shift + T` - Reopen last closed tab
- `Cmd/Ctrl + 1-9` - Jump to tab 1-9
- `Cmd/Ctrl + Tab` - Next tab
- `Cmd/Ctrl + Shift + Tab` - Previous tab
- `Cmd/Ctrl + Shift + D` - Toggle split view

**AI Agents:**
- `Cmd/Ctrl + Shift + A` - Open AI agent panel
- `Cmd/Ctrl + Shift + Q` - Quick ask (inline)
- `Cmd/Ctrl + Shift + H` - Toggle panel visibility
- `Cmd/Ctrl + L` (in panel) - Clear conversation

**Split View Navigation:**
- `Cmd/Ctrl + Alt + ←` - Focus left pane
- `Cmd/Ctrl + Alt + →` - Focus right pane
- `Cmd/Ctrl + Alt + ↑` - Focus top pane
- `Cmd/Ctrl + Alt + ↓` - Focus bottom pane

**File Operations:**
- `Cmd/Ctrl + Shift + U` - Upload file picker
- `Cmd/Ctrl + Shift + S` - Save terminal output to file
- Drag and drop - Upload files to current directory

### In Command Palette

- `↑/↓` - Navigate results
- `Enter` - Execute selected command
- `Cmd/Ctrl + 1-9` - Quick select result 1-9
- `Tab` - Cycle categories
- `Cmd/Ctrl + Backspace` - Clear search
- `ESC` - Close palette

### In Overlays (Host Browser, etc.)

- `↑/↓` - Navigate list items
- `Enter` - Select/execute item
- `Space` - Expand/collapse folder
- `/` or `Cmd/Ctrl + F` - Focus search field
- `ESC` - Close overlay
- `Cmd/Ctrl + A` - Select all (in SFTP browser)

### Terminal-Specific

- `Cmd/Ctrl + C` - Copy (if text selected), else interrupt
- `Cmd/Ctrl + V` - Paste
- `Cmd/Ctrl + Shift + C` - Copy without formatting
- `Cmd/Ctrl + F` - Find in terminal
- `Cmd/Ctrl + +` - Increase font size
- `Cmd/Ctrl + -` - Decrease font size
- `Cmd/Ctrl + 0` - Reset font size to default

### AI Agent Panel

- `Cmd/Ctrl + Enter` - Send message
- `Cmd/Ctrl + L` - Clear conversation
- `Cmd/Ctrl + Shift + H` - Hide panel
- `↑` (in input) - Previous message
- `↓` (in input) - Next message
- `ESC` - Close panel

---

## 11. Context-Aware Features

### Connection State Awareness

**No Terminals Open:**
- Tab bar shows welcome message: "Press Cmd+K to connect"
- Workspace selector visible
- Toolbar visible with full opacity
- Background: Subtle grid pattern or branded illustration
- Centered prompt: "Get started by connecting to a host"

**Terminal Connecting:**
- Tab shows pulsing orange dot
- Tab label: "Connecting to hostname..."
- Can cancel by clicking × on tab
- Status shown in command palette
- Toolbar SFTP button remains disabled

**Terminal Connected:**
- Tab shows solid green dot
- Tab label: Normal hostname
- SFTP browser button becomes enabled
- Drag-and-drop zone activated
- `@` commands become available
- AI agents can access context

**Terminal Disconnected:**
- Tab shows grey dot
- Tab label: "Disconnected - hostname"
- Click tab: Shows reconnect overlay
- SFTP button disabled again
- Toolbar shows warning indicator

### Smart Command Detection

**Pattern Recognition:**
When user types certain patterns, show contextual suggestions:

```bash
# User types: cd /var/log
→ Suggestion: "Press Cmd+B to browse this folder in SFTP"

# User types: nano config.yml
→ Suggestion: "Download and edit locally? (Cmd+D)"

# User pastes long command
→ Suggestion: "Save as snippet? (Cmd+;)"

# User gets permission error
→ Suggestion: "Ask AI about this error?"

# User repeats same command 3+ times
→ Suggestion: "Create snippet or macro?"
```

**Suggestions Display:**
- Small toast in bottom-right corner
- Shows for 5 seconds, then fades
- Dismissible with ×
- Non-intrusive, doesn't steal focus
- User can disable in settings

### Workspace Context

**Command Palette Behavior:**
- Prioritizes current workspace hosts
- Shows workspace name in result descriptions
- Recent items scoped to workspace
- "Switch workspace" at top of results

**Host Browser:**
- Defaults to current workspace view
- Workspace selector dropdown in header
- Can browse all workspaces if needed

**Tab Bar:**
- Workspace name shown in selector (right side)
- Switching workspace prompts: "Close all tabs or keep open?"
- Can move tabs between workspaces (drag to selector)

### Recent Items & Frequency

**Command Palette:**
- Recently connected hosts appear first
- Frequently used commands boosted in ranking
- "Recent" section above categories
- Last 5 connections listed

**Host Browser:**
- "Recent Connections" section at top (collapsible)
- Shows last 5 connected hosts regardless of folder
- Timestamp: "Connected 5 minutes ago"

**Snippets:**
- "Frequently Used" badge on popular snippets
- Sort by: Recent, Frequent, Alphabetical
- Usage count shown in description

### AI Context Intelligence

**Auto-Context:**
When AI panel open, agent automatically has access to:
- Current working directory
- Last 10 lines of terminal output (if permission granted)
- Current hostname and connection info
- Files in current directory listing

**Suggested Questions:**
Based on terminal activity:
- After error: "Want me to explain this error?"
- After git command: "Need help with Git?"
- After docker command: "Docker assistance?"

---

## 12. Error States & Edge Cases

### Connection Failures

**In Terminal Tab:**
- Red pulse animation on tab border
- Content area shows centered error card:
  ```
  ⚠️ Connection Failed

  Could not connect to prod-server-01

  Error: Connection timeout after 30 seconds
  The host might be down or unreachable.

  [Retry]  [Edit Host]  [Close Tab]
  ```

**Error Card Styling:**
- Width: 400px centered
- Background: `surface-2` with red border
- Icon: Warning triangle
- Text hierarchy: Title, message, details
- Action buttons at bottom

**In Host Browser:**
- Failed host shows red indicator (!)
- Tooltip on hover: "Last connection failed"
- Click: Shows same error modal
- Context menu: "View error details"

### SFTP Errors

**Upload Failure:**
```
┌─────────────────────────────────────┐
│  ❌ Upload Failed                   │
│  Insufficient permissions to write  │
│  to /var/www/html                   │
│                                     │
│  [Retry]  [Change Destination]     │
└─────────────────────────────────────┘
```

**Download Failure:**
- Toast notification: "Download failed: disk full"
- [Retry] and [Choose location] buttons
- Option to clear local space

**Permission Denied:**
- Shows chmod dialog
- "Would you like to change permissions?"
- Quick fix: [Make Writable]

### Empty States

**No Hosts Configured:**
```
┌─────────────────────────────────────────────┐
│                                             │
│              [Icon: Server]                 │
│                                             │
│           No hosts configured               │
│                                             │
│      Add your first SSH host to get        │
│              started                        │
│                                             │
│            [+ Add Host]                     │
│                                             │
└─────────────────────────────────────────────┘
```

**No Snippets:**
- Centered illustration: Code icon
- "No snippets saved"
- "Save frequently used commands for quick access"
- [+ Create Snippet] button

**No Search Results:**
```
No results for "production-server"

Suggestions:
• Check your spelling
• Try different keywords
• Browse all hosts instead

[View All Hosts]
```

**No AI Agents Configured:**
```
No AI agents configured

Configure Claude Code, Codex, or other AI
assistants to get help with terminal tasks.

[Configure Agents]
```

### Network Issues

**Lost Connection During Session:**
- Tab shows warning indicator (orange dot)
- Banner in terminal: "Connection lost. Reconnecting..."
- Auto-retry every 5 seconds
- Manual [Reconnect] button available

**Workspace Data Loading Failed:**
- Retry banner at top of host browser
- Shows cached data with warning icon
- "Showing cached data - reconnecting..."
- Auto-retry every 10 seconds

**API Rate Limited (AI Agents):**
```
⏱️ Rate Limit Reached

OpenAI Codex API rate limit exceeded.
Try again in 5 minutes or switch to
a different agent.

[Switch to Claude Code]  [Close]
```

### Session Expired

**Auth Token Expired:**
- Overlay dims all content (100%)
- Modal appears:
  ```
  🔒 Session Expired

  Your session has expired. Please sign in again
  to continue using ArchTerm.

  [Sign In]
  ```
- Redirects to auth flow
- After sign in: Restore all tabs and state

### File Operation Conflicts

**File Already Exists (Upload):**
```
File "config.yml" already exists

[Overwrite]  [Keep Both]  [Cancel]
```

**Large File Warning:**
```
⚠️ Large File

You're about to upload a 1.2GB file.
This may take several minutes.

☐ Don't show this again for files over 1GB

[Continue]  [Cancel]
```

### Agent Errors

**Agent Not Available:**
```
❌ Agent Not Available

Claude Code is not responding. Check that:
• The executable path is correct
• Claude Code is installed
• You have necessary permissions

[Configure Agent]  [Try Again]
```

**Agent Timeout:**
```
⏱️ Request Timeout

The AI agent took too long to respond.

[Retry]  [Cancel]
```

---

## 13. Accessibility Features

### Keyboard Navigation

**All Actions Keyboard Accessible:**
- Every UI element reachable via Tab
- Logical tab order: Top to bottom, left to right
- Skip links for screen readers: "Skip to terminal"
- No keyboard traps in modals/overlays

**Focus Indicators:**
- 3px blue ring: `0 0 0 3px rgba(59, 130, 246, 0.2)`
- Always visible, never hidden
- High contrast: 3:1 minimum against background
- Z-index: 9999 (never obscured)

**Focus Management:**
- Overlays trap focus until dismissed
- Focus returns to trigger element on close
- Command palette focuses search input on open
- New terminals focus terminal input automatically

### Screen Reader Support

**ARIA Labels:**
- All icon buttons: `aria-label="Action name"`
- Status indicators: `aria-label="Connected"` on dots
- Tab status: `aria-current="page"` for active
- Overlay roles: `role="dialog"` with `aria-labelledby`
- Navigation: `<nav aria-label="Main navigation">`

**Live Regions:**
- Connection status changes: `aria-live="polite"`
- Error notifications: `aria-live="assertive"`
- File upload progress: `aria-live="polite"`
- AI agent responses: `aria-live="polite"`

**Semantic HTML:**
- `<nav>` for navigation areas
- `<main>` for terminal content
- `<dialog>` for overlays
- `<button>` for all clickable actions
- `<input>` with proper `<label>` associations
- Logical heading hierarchy (h1 → h2 → h3)

**Alternative Text:**
- Icons: `aria-label` or `role="img"` with description
- Decorative icons: `aria-hidden="true"`
- Status indicators: Text equivalent in `aria-label`
- Images: Descriptive alt text

### Color Independence

**Status Indicators:**
- Connected: Green dot + "Connected" text + icon
- Connecting: Orange dot + "Connecting..." text + animation
- Disconnected: Grey dot + "Disconnected" text
- Error: Red dot + "Error" text + warning icon

**Validation:**
- Error fields: Red border + X icon + error message + `aria-invalid`
- Success: Green border + checkmark + message
- Required: Asterisk + "required" text + `aria-required`

**Actions:**
- Links: Blue + underline on hover + cursor pointer
- Buttons: Shape + label + hover state
- Disabled: Reduced opacity + "disabled" text + no hover

### Contrast Ratios (Maintained from Modern Depth)

All ratios meet WCAG AA minimum:
- Primary text (#FFFFFF on #181818): 15.3:1 (AAA)
- Secondary text (#A1A1AA on #181818): 7.2:1 (AA+)
- Blue accent (#3B82F6 on #181818): 7.8:1 (AA+)
- Tertiary text (#71717A on #181818): 4.6:1 (AA)
- Focus indicators: 3:1 contrast

### Reduced Motion

**Respects `prefers-reduced-motion`:**
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

**Adjustments:**
- No scale animations
- Keep fade transitions only (instant)
- Disable auto-hide behaviors
- No pulsing/rotating animations
- Instant overlay transitions

### Touch Targets

**Minimum Sizes:**
- All buttons: 40px minimum height
- Icon buttons: 32px minimum (toolbar), 40px preferred
- List items: 48px minimum height
- Tab close buttons: 24px hit area (visual can be smaller)

**Spacing:**
- 8px minimum between interactive elements
- 16px preferred for comfortable tapping
- No overlapping hit areas

---

## 14. Implementation Phases

### Phase 1: Core Layout Foundation (Week 1)

**Goals:**
- Remove sidebar completely
- Terminals fill viewport
- Basic tab bar with tabs
- Command palette (Cmd+K) with host search

**Tasks:**
1. Remove Sidebar component and references
2. Update AppShell to full-width layout
3. Create FloatingTabBar component
4. Implement basic tab management (add, close, switch)
5. Create CommandPalette component
6. Implement fuzzy search for hosts
7. Basic connection flow: Search → Connect → Terminal

**Deliverable:** Can connect to hosts via command palette, terminals fill screen, tabs work.

---

### Phase 2: Overlays & Mini Toolbar (Week 2)

**Goals:**
- Host browser full-screen overlay
- Mini toolbar for visual navigation
- Settings overlay
- Snippet library overlay

**Tasks:**
1. Create Overlay component (shared pattern)
2. Build HostBrowserOverlay with list view
3. Implement expandable folder sections
4. Create MiniToolbar component (floating top-right)
5. Build SettingsOverlay with vertical tabs
6. Create SnippetLibraryOverlay with tag groups
7. Wire up toolbar buttons to overlays
8. Implement ESC/backdrop dismiss

**Deliverable:** Full navigation without sidebar, all management via overlays.

---

### Phase 3: SFTP & File Operations (Week 2-3)

**Goals:**
- SFTP browser overlay
- Drag-and-drop file upload
- `@` command system
- File transfer progress

**Tasks:**
1. Build SFTPBrowserOverlay (two-panel design)
2. Implement drag-drop upload to terminal
3. Create progress indicator component
4. Build `@` command parser and dispatcher
5. Implement `@browse`, `@upload`, `@download`
6. Add context menus for file operations
7. Implement chmod/permissions dialog
8. Add transfer error handling

**Deliverable:** Full SFTP functionality integrated into terminal workflow.

---

### Phase 4: Split Views (Week 3)

**Goals:**
- Split view toggle and layouts
- Resizable panes
- Focus management
- Pane navigation

**Tasks:**
1. Create SplitView container component
2. Implement layout modes (horizontal, vertical, grid)
3. Build resizable dividers
4. Implement focus indicators (blue border)
5. Add keyboard navigation between panes
6. Handle session assignment to panes
7. Add animations for split creation/removal
8. Implement pane mini-tabs

**Deliverable:** Can work with multiple terminals side-by-side.

---

### Phase 5: AI Agent Integration (Week 4)

**Goals:**
- Agent configuration
- Chat panel
- `@ask` commands
- Context attachment

**Tasks:**
1. Create AI Agents settings page
2. Build agent configuration storage
3. Create AgentChatPanel component (sliding)
4. Implement `@ask` command dispatcher
5. Build quick ask inline overlay
6. Add context attachment options
7. Implement message actions (Copy, Insert, Run)
8. Build agent selector dropdown
9. Add conversation history storage
10. Implement proactive suggestions

**Deliverable:** AI assistants fully integrated into terminal workflow.

---

### Phase 6: Polish & Animations (Week 5)

**Goals:**
- All transition animations
- Context-aware features
- Smart suggestions
- Error states

**Tasks:**
1. Implement overlay entrance/exit animations
2. Add command palette transitions
3. Implement tab bar auto-hide
4. Add all hover/active states
5. Build loading skeletons
6. Implement smart command detection
7. Add contextual suggestions
8. Build all error state UI
9. Add empty states with illustrations
10. Implement reduced motion support

**Deliverable:** Polished, smooth, context-aware interface.

---

### Phase 7: Accessibility & Testing (Week 6)

**Goals:**
- Full keyboard navigation
- Screen reader support
- Focus management
- WCAG AA compliance verification

**Tasks:**
1. Audit all keyboard navigation paths
2. Add missing ARIA labels
3. Implement focus trapping in overlays
4. Test with VoiceOver/NVDA
5. Verify all contrast ratios
6. Test with keyboard only
7. Add skip links
8. Verify touch target sizes
9. Test reduced motion
10. Document accessibility features

**Deliverable:** Fully accessible, WCAG AA compliant interface.

---

## Success Criteria

**User Experience:**
- [ ] Terminals feel primary, UI secondary
- [ ] Can perform all tasks via keyboard (Cmd+K)
- [ ] Visual navigation discoverable for new users
- [ ] Smooth, polished animations throughout
- [ ] Context-aware features feel intelligent
- [ ] AI agents genuinely useful in workflow

**Technical:**
- [ ] 260px horizontal space reclaimed
- [ ] No layout shift when opening/closing overlays
- [ ] Animations maintain 60fps
- [ ] Command palette responds instantly (<100ms)
- [ ] File transfers show accurate progress
- [ ] Split views resize smoothly

**Accessibility:**
- [ ] All WCAG AA requirements met
- [ ] Screen reader compatible
- [ ] Full keyboard navigation
- [ ] Reduced motion supported
- [ ] High contrast compliant
- [ ] Touch targets adequate

**Modern Depth Aesthetic:**
- [ ] All colors preserved from recent redesign
- [ ] 300ms transitions consistent
- [ ] Hover lifts and shadows consistent
- [ ] Glass morphism effects on floating elements
- [ ] Blue accent used consistently
- [ ] Spatial depth hierarchy clear

---

## Migration Notes

**Breaking Changes:**
- Sidebar removed (users accustomed to it will need adjustment)
- Navigation patterns completely different
- Keyboard shortcuts changed
- Settings moved to overlay

**User Education:**
- Show onboarding overlay on first launch
- Highlight command palette (Cmd+K) as new entry point
- Tutorial: "Press Cmd+K to get started"
- In-app keyboard shortcut reference (Cmd+/)

**Data Migration:**
- Host configurations: No changes needed
- SSH keys: No changes needed
- Snippets: No changes needed
- Settings: UI preferences reset, preserve terminal settings

**Rollback Plan:**
- Feature flag to enable/disable new layout
- "Classic Layout" option in settings (temporary)
- Gather user feedback before removing old layout entirely

---

## Future Enhancements (Out of Scope)

**Potential Future Features:**
- Workspace templates (pre-configured host groups)
- Terminal recording/playback
- Collaborative sessions (share terminal with team)
- Plugin system for custom overlays
- Custom themes and color schemes
- Mobile/tablet companion app
- Browser-based web version
- Terminal multiplexing (tmux/screen integration)

---

## Conclusion

This terminal-centric layout redesign transforms ArchTerm from a traditional application into a modern, keyboard-first terminal management tool that prioritizes the terminal experience while maintaining powerful management features accessible on demand.

The balanced hybrid approach ensures power users can work at keyboard speed while new users can discover features visually. The integration of AI agents, SFTP browsing, and smart context-awareness makes ArchTerm not just a terminal emulator, but an intelligent development environment.

By preserving the Modern Depth aesthetic (colors, motion, spatial hierarchy), we maintain visual continuity while delivering a fundamentally better layout and workflow.
