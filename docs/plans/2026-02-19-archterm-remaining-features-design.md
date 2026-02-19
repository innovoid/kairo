# ArchTerm Remaining Features - Design Document

**Date:** 2026-02-19
**Status:** Approved
**Implementation Approach:** Vertical Slices

## Overview

This document covers the design for completing ArchTerm's remaining features. The existing codebase already has: tab system, SSH terminal, SFTP basic UI, host/key management, AI assistant backend, and auth system. This design adds: folder organization, SFTP transfers with progress, AI command insertion, team collaboration, and enhanced settings.

## Architecture Principles

All features follow the established patterns:
- **Main Process:** SQLite local cache + Supabase sync (dual-write)
- **IPC Layer:** Event-based handlers with `withSupabase` middleware
- **Renderer:** Zustand stores + React components with shadcn/ui Base
- **Data Flow:** User action → Store → IPC → Main process → SQLite + Supabase → Response

## Implementation Approach: Vertical Slices

Complete features as end-to-end slices (backend + IPC + store + UI):

1. **Folder Organization** - Organize hosts into folders
2. **SFTP Transfers** - Upload/download with progress tracking
3. **AI Enhancements** - Command insertion into terminals
4. **Team Collaboration** - Workspace members and sharing
5. **Settings Polish** - Enhanced terminal/appearance/AI settings

---

## Slice 1: Folder Organization

### Backend (Main Process)

**File:** `src/main/ipc/hosts.ts`

Add folder CRUD methods:
- `createFolder(workspaceId, name, parentId?)` - Creates folder in SQLite + Supabase
- `updateFolder(folderId, name)` - Renames folder
- `deleteFolder(folderId)` - Deletes folder, moves child hosts to root (set `folderId = null`)
- `moveHostToFolder(hostId, folderId | null)` - Updates host's `folderId`

Uses existing `host_folders` table (already in schema):
```sql
CREATE TABLE host_folders (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  parent_id TEXT,
  name TEXT NOT NULL,
  position INTEGER DEFAULT 0,
  synced_at INTEGER
);
```

### IPC Bridge

**File:** `src/preload/hosts-api.ts`

Extend with folder methods:
```typescript
folders: {
  create: (workspaceId: string, name: string, parentId?: string) => Promise<HostFolder>,
  update: (folderId: string, name: string) => Promise<void>,
  delete: (folderId: string) => Promise<void>,
},
hosts: {
  moveToFolder: (hostId: string, folderId: string | null) => Promise<void>,
  // ... existing methods
}
```

### Frontend (Renderer)

**Components:**
- `FolderDialog.tsx` - Modal for create/rename folder
  - Input field for folder name
  - Save/Cancel buttons
- `HostsGrid.tsx` - Enhance header with "New Folder" button
- `FolderSection.tsx` (already exists) - Add context menu:
  - Rename, Delete, Add Host to Folder

**Context Menus:**

Host context menu (right-click on host card):
- 🔌 Connect - Opens terminal
- 📁 Open SFTP - Opens SFTP tab
- ✏️ Edit - Opens edit form
- 🗑️ Delete - Confirms and deletes
- 🔗 Share - Opens share dialog (Slice 4)

Folder context menu (right-click on folder):
- ✏️ Rename - Opens rename dialog
- ➕ Add Host - Opens host form with folder pre-selected
- 🔗 Share Folder - Shares all hosts (Slice 4)
- 🗑️ Delete - Confirms and deletes

**Drag-and-Drop:**
- Use `@dnd-kit/core` for drag-and-drop
- Drag host card → Drop on folder → Updates `folderId`
- Visual feedback: Blue highlight on valid drop targets

**Store Updates:**

**File:** `src/renderer/src/stores/host-store.ts`

Add folder methods:
```typescript
createFolder: (workspaceId: string, name: string, parentId?: string) => Promise<void>
updateFolder: (folderId: string, name: string) => Promise<void>
deleteFolder: (folderId: string) => Promise<void>
moveHostToFolder: (hostId: string, folderId: string | null) => Promise<void>
```

### Data Flow

1. User clicks "New Folder" → `FolderDialog` opens
2. Enters "Production" → Clicks Save
3. `hostStore.createFolder(workspaceId, 'Production')`
4. IPC call → Main process writes to SQLite + Supabase
5. Store refetches folders → UI shows new folder
6. User drags host onto folder → `hostStore.moveHostToFolder(hostId, folderId)`
7. Host moves into folder section

---

## Slice 2: SFTP Transfers (Upload/Download + Progress)

### Backend (Main Process)

**File:** `src/main/services/sftp-manager.ts`

Add transfer methods:
```typescript
async uploadFile(sessionId: string, localPath: string, remotePath: string): Promise<void>
async downloadFile(sessionId: string, remotePath: string, localPath: string): Promise<void>
```

Both methods:
- Use Node.js streams for efficient transfer
- Emit progress events: `sftp:progress` with payload:
  ```typescript
  {
    transferId: string,
    filename: string,
    bytesTransferred: number,
    totalBytes: number,
    speed: number, // bytes per second
    direction: 'upload' | 'download'
  }
  ```
- Emit completion: `sftp:complete` or `sftp:error`

**File picker integration:**
- Upload: `dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'] })`
- Download: Use default Downloads folder or `dialog.showSaveDialog()`

### IPC Bridge

**File:** `src/preload/sftp-api.ts`

Add methods:
```typescript
upload: (sessionId: string, localPath: string, remotePath: string) => Promise<void>
download: (sessionId: string, remotePath: string, localPath?: string) => Promise<void>
// Progress already handled via existing onProgress callback
```

### Frontend (Renderer)

**Components:**

**File:** `src/renderer/src/features/sftp/FilePane.tsx` (enhance existing)

Add upload/download UI:
- **Upload button** in toolbar → Opens file picker
- **Drag-drop zone** - Overlay appears when files dragged over pane:
  ```
  ┌─────────────────────────────────┐
  │                                 │
  │   📤 Drop files to upload       │
  │                                 │
  └─────────────────────────────────┘
  ```
- **Download action** - Double-click file or context menu "Download"

**File:** `src/renderer/src/features/sftp/TransferProgress.tsx` (new)

Shows active transfers in bottom panel or floating widget:
```
┌─────────────────────────────────────────────────┐
│ Transfers (2 active)                            │
├─────────────────────────────────────────────────┤
│ ↑ backup.sql      [████████░░] 82%  1.2 MB/s  ✕│
│ ↓ logs.tar.gz     [██░░░░░░░░] 23%  3.5 MB/s  ✕│
└─────────────────────────────────────────────────┘
```

Uses shadcn `Progress` component, shows:
- Direction icon (↑ upload, ↓ download)
- Filename
- Progress bar with percentage
- Transfer speed
- Cancel button (✕)

**Store Updates:**

**File:** `src/renderer/src/stores/transfer-store.ts` (already exists)

Ensure methods exist:
```typescript
addTransfer: (transfer: TransferProgress) => void
updateProgress: (transferId: string, bytes: number, speed: number) => void
removeTransfer: (transferId: string) => void
cancelTransfer: (transferId: string) => void
```

### Data Flow

**Upload:**
1. User drags `database.sql` onto FilePane
2. `handleDrop(files)` extracts file paths
3. For each: `transferStore.addTransfer({ id, filename, direction: 'upload', ... })`
4. `sftpApi.upload(sessionId, localPath, currentPath + '/' + filename)`
5. Main process streams file, emits `sftp:progress` events every 100ms
6. Renderer receives events → `transferStore.updateProgress(id, bytes, speed)`
7. Progress bar updates in real-time
8. On complete → Show success toast, remove from transfers after 3s

**Download:**
1. User double-clicks `backup.tar.gz` in FilePane
2. `handleDownload(entry)` → Creates transfer entry
3. `sftpApi.download(sessionId, entry.path)` (defaults to ~/Downloads)
4. Same progress flow as upload
5. File appears in Downloads folder when complete

---

## Slice 3: AI Enhancements (Command Insertion)

### Backend (Main Process)

**File:** `src/main/services/ai-proxy.ts` (already exists)

No changes needed - `translateCommand()` already implemented.

### Frontend (Renderer)

**Components:**

**File:** `src/renderer/src/features/ai/ChatMessage.tsx` (enhance existing)

Add command detection and insertion:
- Parse assistant messages for code blocks (` ```bash` or ` ```sh`)
- Also detect inline commands (lines starting with `$`, `sudo`, common commands)
- Add "Insert into Terminal" button below each command:
  ```
  ┌─────────────────────────────────────┐
  │ $ du -sh * | sort -rh | head -10    │
  └─────────────────────────────────────┘
  [→ Insert into Terminal]
  ```
- Button calls `insertCommand(command)`

**File:** `src/renderer/src/features/ai/CommandSuggestion.tsx` (new)

Quick command translation widget in AiPanel:
```
┌──────────────────────────────────────┐
│ Quick Command                        │
│ ┌──────────────────────────────────┐ │
│ │ find large files                 │ │
│ └──────────────────────────────────┘ │
│ [Translate]                          │
│                                      │
│ $ find . -type f -size +100M         │
│ [→ Insert]                           │
└──────────────────────────────────────┘
```

**File:** `src/renderer/src/features/ai/AiPanel.tsx` (enhance)

Add mode toggle:
- Tab switcher: "Chat" / "Quick Command"
- Chat mode: Full conversation history (existing)
- Quick Command mode: Shows `CommandSuggestion` component

**Command Insertion Logic:**

```typescript
function insertCommand(command: string, autoExecute = false) {
  const activeTab = sessionStore.activeTab;

  if (!activeTab || activeTab.tabType !== 'terminal') {
    toast.error('Open a terminal first');
    return;
  }

  const sanitized = command.replace(/^\$\s*/, ''); // Remove leading $
  const toSend = autoExecute ? sanitized + '\n' : sanitized;

  window.sshApi.send(activeTab.sessionId!, toSend);
  toast.success('Command inserted');
}
```

**Store Updates:**

**File:** `src/renderer/src/stores/ai-store.ts` (already exists)

Add quick command state:
```typescript
quickCommand: string
setQuickCommand: (cmd: string) => void
translateQuickCommand: () => Promise<void>
```

### Data Flow

**Chat Mode:**
1. User asks: "How do I find large files?"
2. AI responds with command in code block
3. ChatMessage detects ` ```bash` block
4. Renders "Insert into Terminal" button
5. User clicks → `insertCommand()` → Sends to active terminal
6. Command appears in terminal (user presses Enter to execute)

**Quick Command Mode:**
1. User switches to Quick Command tab
2. Types: "compress this directory"
3. Clicks "Translate" → `translateQuickCommand()`
4. AI returns: `tar -czf archive.tar.gz .`
5. Shows in preview box with "Insert" button
6. User clicks Insert → Command sent to terminal

---

## Slice 4: Team Collaboration (Workspace Members + Sharing)

### Backend (Main Process)

**File:** `src/main/ipc/workspace.ts` (enhance existing)

Add member management:
```typescript
inviteMember: (workspaceId: string, email: string, role: WorkspaceRole) => Promise<WorkspaceInvite>
listMembers: (workspaceId: string) => Promise<WorkspaceMember[]>
updateMemberRole: (workspaceId: string, memberId: string, role: WorkspaceRole) => Promise<void>
removeMember: (workspaceId: string, memberId: string) => Promise<void>
acceptInvite: (inviteId: string) => Promise<void>
```

Add sharing methods:
```typescript
shareHost: (hostId: string, memberIds: string[], permission: SharePermission) => Promise<void>
shareFolder: (folderId: string, memberIds: string[], permission: SharePermission) => Promise<void>
shareAllHosts: (workspaceId: string, memberIds: string[], permission: SharePermission) => Promise<void>
```

Types:
```typescript
type SharePermission = 'read-only' | 'full-access'; // Future: read-only = connect only, full = edit/delete
type WorkspaceRole = 'owner' | 'admin' | 'member';
```

**New Database Table (Supabase + SQLite):**
```sql
CREATE TABLE host_shares (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  host_id TEXT,         -- Single host share
  folder_id TEXT,       -- Folder share
  all_hosts BOOLEAN,    -- Workspace-wide share
  member_ids TEXT,      -- JSON array of member IDs
  permission TEXT,      -- 'read-only' | 'full-access'
  created_at INTEGER
);
```

### IPC Bridge

**File:** `src/preload/workspace-api.ts` (enhance)

Add all member and sharing methods as above.

### Frontend (Renderer)

**Sidebar Navigation Changes:**

**File:** `src/renderer/src/components/layout/Sidebar.tsx` (major redesign)

New structure:
```
┌─────────────────────────┐
│ [Production Team ▼]     │ ← WorkspaceSwitcher (moved from HostsGrid)
├─────────────────────────┤
│ □ Hosts                 │
│ □ Keys                  │
│ □ Team        ← NEW     │
├─────────────────────────┤
│ ⚙ Settings   (bottom)  │
└─────────────────────────┘
```

Remove: App logo/branding
Add: Workspace switcher at top, Team nav item

**Components:**

**File:** `src/renderer/src/features/team/TeamPage.tsx` (new)

Full-page team management:
```
┌────────────────────────────────────────────────────┐
│ Team — Production Workspace    [Invite] [Share All]│
├────────────────────────────────────────────────────┤
│ Members (8)                                        │
│ ┌────────────────────────────────────────────────┐ │
│ │ Name         Email              Role    Action │ │
│ │ Alice        alice@co    [Owner ▼]     —      │ │
│ │ Bob          bob@co      [Admin ▼]     Remove │ │
│ │ Charlie      charlie@co  [Member▼]     Remove │ │
│ └────────────────────────────────────────────────┘ │
│                                                    │
│ Pending Invites (2)                                │
│ ┌────────────────────────────────────────────────┐ │
│ │ dave@co      Member     Sent 2d ago    Cancel  │ │
│ └────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────┘
```

**File:** `src/renderer/src/features/team/InviteMemberDialog.tsx` (new)

Modal for inviting:
- Email input field
- Role selector: Member / Admin
- "Send Invite" button

**File:** `src/renderer/src/features/team/ShareDialog.tsx` (new)

Universal sharing dialog:
```
┌─────────────────────────────────────┐
│ Share "Production DB"               │
├─────────────────────────────────────┤
│ Select members:                     │
│ ☑ Alice (Owner)                     │
│ ☑ Bob (Admin)                       │
│ ☐ Charlie (Member)                  │
│                                     │
│ Permission: (Future)                │
│ ○ Read-only  ○ Full access          │
│                                     │
│ [Cancel]  [Share]                   │
└─────────────────────────────────────┘
```

Props:
```typescript
interface ShareDialogProps {
  type: 'host' | 'folder' | 'workspace';
  itemId: string;
  itemName: string;
  onClose: () => void;
}
```

**File:** `src/renderer/src/features/team/SharedWithBadge.tsx` (new)

Small badge on host/folder cards:
```
[🔗 Shared with 3]
```

Clicking shows tooltip with member names.

**Tab System Update:**

**File:** `src/renderer/src/stores/session-store.ts`

Add 'team' to TabType:
```typescript
export type TabType = 'hosts' | 'keys' | 'team' | 'settings' | 'terminal' | 'sftp';
```

Team tab is non-closable like hosts/keys/settings.

**Settings Page Update:**

**File:** `src/renderer/src/features/settings/SettingsPage.tsx`

Remove "Team" tab, keep only:
- Terminal
- Appearance
- AI

### Three Sharing Scenarios

**1. Share Single Host:**
- Right-click host → Share
- Dialog: "Share Production DB"
- Select: Alice, Bob
- Result: Host shared with 2 members, badge shows on card

**2. Share Folder:**
- Right-click "AWS Servers" folder → Share Folder
- Dialog: "Share AWS Servers (12 hosts)"
- Select members
- Result: All 12 hosts in folder shared, folder shows badge

**3. Share All Hosts:**
- In TeamPage → "Share All Hosts" button
- Dialog: "Share all 47 hosts in Production workspace"
- Select members
- Result: Workspace-wide share, banner in TeamPage

**Future: Permission Levels**
- `read-only`: Can connect SSH/SFTP, cannot edit/delete host config
- `full-access`: Can edit host details, change auth, delete host
- For MVP: All shares are full-access

### Data Flow

**Invite Member:**
1. User on TeamPage → Clicks "Invite Member"
2. InviteMemberDialog opens
3. Enters: dave@company.com, Role: Member
4. `workspaceApi.inviteMember(workspaceId, email, 'member')`
5. Main process writes to `workspace_invites` table
6. (Future) Email sent with invite link
7. Dave clicks link → `workspaceApi.acceptInvite(inviteId)`
8. Dave added to `workspace_members`, appears in team list

**Share Host:**
1. User right-clicks "Production DB" host
2. Selects "Share" from context menu
3. ShareDialog opens with member checkboxes
4. Selects Alice, Bob → Clicks "Share"
5. `workspaceApi.shareHost(hostId, [aliceId, bobId], 'full-access')`
6. Main process writes to `host_shares` table
7. UI refreshes, host card shows "Shared with 2" badge
8. Alice and Bob see host in their workspace

---

## Slice 5: Settings Polish (Enhanced Options)

### Backend (Main Process)

**File:** `src/main/ipc/settings.ts` (enhance existing)

Add new settings fields in update handler.

**Database Schema Update:**

Extend `settings` table in Supabase + SQLite:
```sql
ALTER TABLE settings ADD COLUMN scrollback_lines INTEGER DEFAULT 1000;
ALTER TABLE settings ADD COLUMN cursor_style TEXT DEFAULT 'block';
ALTER TABLE settings ADD COLUMN bell_style TEXT DEFAULT 'none';
ALTER TABLE settings ADD COLUMN line_height REAL DEFAULT 1.2;
```

### Frontend (Renderer)

**Terminal Settings Tab:**

**File:** `src/renderer/src/features/settings/SettingsPage.tsx` (TerminalTab section)

Add controls:
- **Font Family** - Dropdown with presets:
  - JetBrains Mono (default)
  - Fira Code
  - Cascadia Code
  - Source Code Pro
  - SF Mono
  - Consolas
  - Menlo
- **Font Size** - Number input (10-24px) with +/- buttons
- **Line Height** - Slider (1.0 - 2.0, step 0.1)
- **Scrollback** - Number input with "lines" suffix (500 - 10000)
- **Cursor Style** - Radio buttons with preview:
  ```
  ○ █ Block   ○ _ Underline   ○ | Bar
  ```
- **Bell** - Dropdown:
  - None (silent)
  - Sound (system beep)
  - Visual (flash screen)
- "Save Changes" button

**Appearance Settings Tab:**

**File:** `src/renderer/src/features/settings/SettingsPage.tsx` (AppearanceTab)

Enhance:
- **Theme** - Toggle: Dark / Light (already exists)
- **Font Preview** - Live preview box:
  ```
  ┌────────────────────────────────┐
  │ $ ls -la ~/.ssh/config         │
  │ -rw------- 1 user staff 2048   │
  └────────────────────────────────┘
  ```
  Updates instantly when font/size changes
- **(Future) Custom Themes** - Color scheme editor for advanced users

**AI Settings Tab:**

**File:** `src/renderer/src/features/settings/SettingsPage.tsx` (AiTab)

Enhance with collapsible sections:
```
┌─────────────────────────────────────────┐
│ AI Providers                            │
│                                         │
│ ▼ OpenAI                                │
│   API Key: [••••••••••••••••] [👁]     │
│   Default Model: [GPT-4o mini ▼]       │
│   [Test Connection] ✓ Connected        │
│                                         │
│ ▶ Anthropic                             │
│                                         │
│ ▶ Google Gemini                         │
│                                         │
│ Default Provider: ○ OpenAI              │
│                   ○ Anthropic           │
│                   ○ Gemini              │
│                                         │
│ Stream Speed: [────●─────] Medium       │
└─────────────────────────────────────────┘
```

Each provider section:
- Masked API key input with show/hide button (eye icon)
- Default model dropdown (different models per provider)
- "Test Connection" button:
  - Makes simple API call to validate key
  - Shows: ✓ green "Connected" or ✗ red "Invalid key"

**Stream Speed:**
- Slider: Fast / Medium / Slow
- Controls typing effect speed in chat

**Components:**

**File:** `src/renderer/src/features/settings/FontPicker.tsx` (new)

Custom dropdown component:
- Each option renders in its actual font
- Shows preview text: `$ ls -la ~/.ssh/config`
- Loads Google Fonts or uses system fonts

**File:** `src/renderer/src/features/settings/ProviderSection.tsx` (new)

Collapsible section for each AI provider:
```typescript
interface ProviderSectionProps {
  provider: 'openai' | 'anthropic' | 'gemini';
  apiKey: string;
  defaultModel: string;
  onApiKeyChange: (key: string) => void;
  onModelChange: (model: string) => void;
  onTest: () => Promise<boolean>;
}
```

### Settings Apply Flow

**Immediate save:**
- All changes save to store immediately
- Call `settingsStore.updateSettings(changes)`
- Main process writes to SQLite + Supabase

**Terminal refresh:**
- Font, size, line height changes → Dispatch event to active terminals
- Each TerminalTab listens for `settings:changed` event
- Calls `terminal.options.fontFamily = newFont` etc.
- Terminal re-renders with new settings

**Theme changes:**
- Already working - instant DOM class toggle
- `document.documentElement.classList.toggle('dark', theme === 'dark')`

**API key validation:**
- "Test Connection" button → Makes lightweight API call:
  - OpenAI: `GET /v1/models`
  - Anthropic: `POST /v1/messages` with minimal input
  - Gemini: `GET /v1/models`
- Success: Show ✓ green checkmark + "Connected"
- Failure: Show ✗ red X + error message

### UI/UX Details

**Dirty state tracking:**
- Track if form has unsaved changes
- Disable "Save" button if pristine
- Show "Unsaved changes" warning if navigating away

**Toast notifications:**
- "Settings saved" on successful update
- "API key validated" on test success
- "Invalid API key" on test failure

**Validation:**
- Scrollback: Must be 500-10000
- Font size: Must be 10-24
- Line height: Must be 1.0-2.0
- API key: Non-empty string

---

## Implementation Order

Implement slices sequentially:

1. **Slice 1: Folder Organization** (Day 1-2)
   - Backend folder CRUD
   - IPC bridge
   - UI components + drag-drop
   - Test: Create folders, move hosts, delete folders

2. **Slice 2: SFTP Transfers** (Day 2-3)
   - Upload/download methods in sftp-manager
   - IPC bridge
   - FilePane drag-drop + buttons
   - TransferProgress component
   - Test: Upload/download files, watch progress

3. **Slice 3: AI Command Insertion** (Day 3-4)
   - ChatMessage command detection
   - CommandSuggestion component
   - Insert logic with terminal integration
   - Test: Translate commands, insert into terminals

4. **Slice 4: Team Collaboration** (Day 4-5)
   - Member management backend
   - Sharing backend (3 types)
   - TeamPage UI
   - ShareDialog + context menus
   - Sidebar restructure
   - Test: Invite members, share hosts/folders/all

5. **Slice 5: Settings Polish** (Day 5-6)
   - Extend settings schema
   - Enhanced Terminal settings
   - Enhanced AI settings with provider sections
   - FontPicker component
   - Terminal refresh logic
   - Test: Change fonts, test API keys, verify terminals update

## Testing Verification

After each slice:

1. **Manual Testing:**
   - Run `npm run dev`
   - Exercise all new features
   - Verify SQLite + Supabase sync

2. **Integration Testing:**
   - Test interactions between features
   - Example: Share a folder, then move hosts into it
   - Example: Insert AI command into terminal, verify execution

3. **Edge Cases:**
   - Delete folder with hosts inside
   - Cancel file transfer mid-upload
   - Invalid API keys in AI settings
   - Remove workspace owner (should fail)

## Future Enhancements

Features marked as "Future" that are not in this implementation:

- **Share Permissions:** Read-only vs full-access enforcement
- **Email Notifications:** Send emails for invites
- **Local Filesystem SFTP:** Browse local files in SFTP split view
- **Custom Color Themes:** Advanced theme editor
- **AI Context Window:** Include terminal output in AI chat context
- **Host Tagging:** Tag-based filtering and organization
- **Connection History:** Track and show recent connections
- **Saved Commands:** Save frequently used commands
- **Multi-hop SSH:** Bastion/jump host support

---

## Success Criteria

Implementation is complete when:

✅ Users can organize hosts into folders with drag-and-drop
✅ Users can upload/download files via SFTP with progress tracking
✅ AI chat provides "Insert into Terminal" buttons for commands
✅ Workspace owners can invite members and manage roles
✅ Hosts, folders, or all hosts can be shared with members
✅ Settings include enhanced terminal, appearance, and AI options
✅ All features work with SQLite + Supabase sync
✅ No regressions in existing features (SSH, terminal, keys, etc.)

## File Summary

**New Files to Create:**
- `src/renderer/src/features/team/TeamPage.tsx`
- `src/renderer/src/features/team/InviteMemberDialog.tsx`
- `src/renderer/src/features/team/ShareDialog.tsx`
- `src/renderer/src/features/team/SharedWithBadge.tsx`
- `src/renderer/src/features/sftp/TransferProgress.tsx`
- `src/renderer/src/features/ai/CommandSuggestion.tsx`
- `src/renderer/src/features/settings/FontPicker.tsx`
- `src/renderer/src/features/settings/ProviderSection.tsx`
- `src/renderer/src/features/hosts/FolderDialog.tsx`

**Files to Modify:**
- `src/main/ipc/hosts.ts` - Add folder CRUD methods
- `src/main/ipc/workspace.ts` - Add member management + sharing
- `src/main/services/sftp-manager.ts` - Add upload/download
- `src/preload/hosts-api.ts` - Add folder methods
- `src/preload/workspace-api.ts` - Add member/sharing methods
- `src/renderer/src/stores/host-store.ts` - Add folder methods
- `src/renderer/src/stores/ai-store.ts` - Add quick command state
- `src/renderer/src/stores/session-store.ts` - Add 'team' TabType
- `src/renderer/src/components/layout/Sidebar.tsx` - Restructure navigation
- `src/renderer/src/features/hosts/HostsGrid.tsx` - Add folder UI + context menus
- `src/renderer/src/features/sftp/FilePane.tsx` - Add upload/download UI
- `src/renderer/src/features/ai/ChatMessage.tsx` - Add command insertion
- `src/renderer/src/features/ai/AiPanel.tsx` - Add Quick Command mode
- `src/renderer/src/features/settings/SettingsPage.tsx` - Enhance all tabs

**Database Migrations:**
- Add `host_shares` table (Supabase + SQLite)
- Extend `settings` table with new columns

---

**End of Design Document**
