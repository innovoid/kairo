# ArchTerm: Open-Source Termius Alternative — Design Document

**Date:** 2026-02-20
**Status:** Approved
**Goal:** Transform ArchTerm from a functional SSH client into a competitive open-source alternative to Termius, delivered in three phased milestones.

---

## Current State Assessment

### What Works

- Electron + React + TypeScript architecture with Vite build
- Supabase authentication with workspace-scoped multi-tenancy and RLS
- SSH terminal sessions via xterm.js 6.0 with 12 themes
- SFTP file browser (remote only) with upload/download/progress tracking
- SSH key management with import, fingerprinting, and local encrypted storage
- Host management with folder organization and drag-and-drop (dnd-kit)
- AI assistant with OpenAI, Anthropic, and Google Gemini streaming support
- Settings system with terminal, appearance, AI, and account tabs
- Team member management with role-based access
- Command palette with host search and navigation
- Zustand state management across 7 stores
- 100+ shadcn/ui components

### What's Broken or Incomplete

| Issue | Location | Severity |
|---|---|---|
| Hardcoded AES-256-GCM encryption key | `key-manager.ts:34` | **Critical** |
| AI API keys stored in Supabase without client-side encryption | `settings` table | **High** |
| Team invite button renders but has no handler | `TeamPage.tsx:73-76` | Medium |
| Create workspace dialog not connected | `WorkspaceSwitcher.tsx:59` (TODO) | Medium |
| `delete_user_account()` RPC not implemented | Called but no migration exists | Medium |
| General workspace settings tab is placeholder | `GeneralTab.tsx` | Low |
| Workspace encryption UI exists, backend RPCs missing | `EncryptionTab.tsx` | Medium |
| Local SFTP pane shows placeholder, never implemented | `SftpTab.tsx:32-34` | Medium |
| Workspace ID passed via `(window as any).currentWorkspaceId` | `host-store.ts:86` | Low |
| 17 console.log statements in production code | `register.ts`, `hosts.ts`, `host-store.ts` | Low |
| Untyped IPC errors | Throughout IPC layer | Low |

---

## Architecture: Phased Milestones

Three phases, each producing a shippable release. Fix first, then build.

---

## Phase 1 — Stabilization

**Objective:** Make everything that exists production-quality. No new features until the foundation is solid.

### 1.1 Security Fixes (Critical)

**Hardcoded encryption key replacement:**

- Derive encryption key from a user-provided master password using PBKDF2 (100k iterations) or Argon2id
- Store the salt in SQLite alongside encrypted data
- On first launch after migration, prompt user to set a master password and re-encrypt all stored private keys
- Cache the derived key via Electron `safeStorage` so users don't re-enter it every session

**AI API key storage:**

- Move API keys out of Supabase `settings` table
- Store locally only, encrypted via `safeStorage`
- Remove `openai_api_key_encrypted`, `anthropic_api_key_encrypted`, `gemini_api_key_encrypted` columns from Supabase schema

### 1.2 Complete Broken/Stub Features

**Team invite dialog:**

- Create `InviteMemberDialog` component with email input and role selector
- Wire to existing `workspace.inviteMember` IPC handler
- Add success/error toast feedback

**Create workspace dialog:**

- Create `CreateWorkspaceDialog` component with name input
- Wire to `workspace.create` IPC handler
- Trigger from WorkspaceSwitcher's existing TODO location

**Account deletion:**

- Create Supabase migration implementing `delete_user_account()` RPC
- Cascade: remove workspace memberships, revoke sent invites, delete user settings, delete user from `public.users`
- Handle owned workspaces: transfer ownership or delete workspace

**General workspace tab:**

- Implement workspace rename and description edit
- Add danger zone section with delete workspace (confirmation dialog, owner-only)

**Workspace encryption backend:**

- Implement `initializeWorkspaceEncryption()`: generate workspace key from passphrase via Argon2id, store encrypted key blob
- Implement `changeWorkspacePassphrase()`: re-derive key, re-encrypt blob
- Implement `syncKeyToCloud()`: encrypt private key with workspace key, upload to Supabase Storage
- Wire to existing `EncryptionTab` UI

**Local SFTP pane:**

- Implement local filesystem browsing via Node.js `fs` APIs exposed through IPC
- Reuse `FilePane` component with a `source: 'local' | 'remote'` prop
- Or: remove the placeholder entirely (defer to Phase 3 dual-pane SFTP)

### 1.3 Code Quality Cleanup

- Remove all 17 `console.log`/`console.error` statements
- Add a proper logger (electron-log or pino) with log levels (debug, info, warn, error)
- Replace `(window as any).currentWorkspaceId` in `host-store.ts` with proper Zustand workspace store subscription
- Add React error boundaries wrapping terminal and SFTP components for crash isolation
- Add typed error responses to IPC handlers

### 1.4 UX Polish

- Surface SSH error codes as clear toast messages: auth failed, host unreachable, timeout, host key verification
- Add skeleton loaders for hosts grid, keys list, and team page during initial fetch
- Document and standardize keyboard shortcuts (add a shortcuts reference accessible from command palette)

---

## Phase 2 — Terminal Power

**Objective:** Make the terminal best-in-class. Every feature Termius offers in the terminal, plus extras.

### 2.1 Local Shell Support

- Integrate `node-pty` to spawn local shell processes (bash/zsh/fish/powershell)
- Add "Local Terminal" action in sidebar and hosts grid
- Abstract a `SessionBackend` interface:
  ```
  interface SessionBackend {
    send(data: string): void
    resize(cols: number, rows: number): void
    onData(callback: (data: string) => void): void
    onClose(callback: () => void): void
    disconnect(): void
  }
  ```
- Both `ssh-manager.ts` and new `local-shell-manager.ts` implement this interface
- Existing `TerminalTab` and `useTerminal` hook work unchanged — just swap the backend
- Auto-detect default shell from `$SHELL` environment variable
- Support shell selection in settings (override default)

### 2.2 Split Panes

- Use existing `react-resizable-panels` dependency for split layout
- Support horizontal and vertical splits, nested arbitrarily
- Each pane is an independent terminal session (local or SSH)
- Data model: tree structure in session store
  ```
  type PaneNode = TerminalPane | SplitPane
  type SplitPane = { direction: 'horizontal' | 'vertical', children: PaneNode[], sizes: number[] }
  type TerminalPane = { sessionId: string }
  ```
- Keyboard shortcuts:
  - `Cmd+D` — horizontal split
  - `Cmd+Shift+D` — vertical split
  - `Cmd+W` — close pane
  - `Cmd+[` / `Cmd+]` — navigate between panes
- Draggable dividers with minimum pane size (120px)
- Persist layout in session store across tab switches

### 2.3 Search in Terminal

- Add `@xterm/addon-search` dependency
- Trigger with `Cmd+F` when terminal is focused
- Overlay search bar at top of terminal pane:
  - Match count display
  - Next/prev navigation (`Enter` / `Shift+Enter`)
  - Regex toggle
  - Case sensitivity toggle
- Highlight all matches in terminal scrollback buffer
- `Escape` to dismiss

### 2.4 Snippets / Commands Library

- New Supabase table:
  ```sql
  create table snippets (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid references workspaces(id) on delete cascade,
    name text not null,
    command text not null,
    description text,
    tags text[],
    created_by uuid references auth.users(id),
    created_at timestamptz default now(),
    updated_at timestamptz default now()
  );
  ```
- Local SQLite cache following existing hosts/keys sync pattern
- New `SnippetsPage` in sidebar — CRUD with search and tag filter
- Quick-insert: `Cmd+Shift+S` from terminal opens snippet picker overlay
- Variable support: `{{variable_name}}` syntax prompts user for value before execution
- Import/export as JSON

### 2.5 Broadcast Input

- Toggle in `TerminalToolbar` to enable broadcast mode
- Session picker dialog: checkboxes for which sessions receive broadcast input
- When active, `useTerminal` keyboard handler replicates input to all selected sessions via their `SessionBackend.send()`
- Visual indicator: colored left border on all terminals receiving broadcast
- Safety: explicit opt-in per session, confirmation dialog before first enable

### 2.6 Terminal Recording & Replay

- Record mode: capture terminal I/O with timestamps in asciicast v2 format
- Storage: `~/.config/archterm/recordings/` directory
- Replay mode: read-only terminal pane with:
  - Play/pause toggle
  - Speed control (0.5x, 1x, 2x, 4x)
  - Seekbar / progress indicator
- Export formats: `.cast` (asciinema-compatible)
- Recording indicator in status bar when active
- Start/stop via toolbar button or `Cmd+Shift+R`

### 2.7 Additional Terminal Addons

| Feature | Addon | Purpose |
|---|---|---|
| Copy on select | xterm.js `onSelectionChange` | Auto-copy selected text to clipboard (toggle in settings) |
| Paste warning | Custom middleware | Detect multi-line paste, show confirmation before sending |
| Font ligatures | `@xterm/addon-ligatures` | Support ligature fonts (Fira Code, JetBrains Mono) |
| Inline images | `@xterm/addon-image` | iTerm2/Sixel image protocol support |
| Unicode | `@xterm/addon-unicode11` | Proper wide character and emoji rendering |
| Buffer serialize | `@xterm/addon-serialize` | Save/restore terminal buffer on tab switch |

---

## Phase 3 — Network & Sync Power

**Objective:** Enterprise-grade connectivity and collaboration features.

### 3.1 Port Forwarding

- **Local forwarding** (`-L`): Forward local port to remote host:port via `ssh2` `client.forwardOut()`
- **Remote forwarding** (`-R`): Forward remote port to local service via `client.forwardIn()`
- **Dynamic forwarding** (`-D`): SOCKS5 proxy through SSH via local SOCKS server routing through `client.forwardOut()`
- **UI**: "Port Forwarding" tab per connection — table of active forwards with:
  - Local port, remote host:port
  - Status (active/error/stopped)
  - Traffic counter (bytes in/out)
  - Add/remove while connected
- **Persistent rules**: New `port_forwards` JSONB column on `hosts` table — auto-activate on connect
- **Status bar**: Active forward count and aggregate traffic

### 3.2 Jump Hosts / ProxyJump

- Add `jump_host_id` (FK → hosts) to `hosts` table
- Connection logic: connect to jump host → `client.forwardOut()` to destination → create SSH client over forwarded stream
- Multi-hop: recursive resolution for chains (jump → jump → destination)
- UI: "Jump Host" dropdown in `HostForm` listing workspace hosts
- Visual indicator in `HostCard` showing hop chain (e.g., `bastion → db-server`)

### 3.3 SSH Agent Forwarding

- Toggle `agent` option in ssh2 connection config
- Connect to system SSH agent via `$SSH_AUTH_SOCK` (macOS/Linux)
- Pageant protocol support (Windows)
- Per-host toggle in `HostForm`: "Forward SSH Agent" checkbox
- Security warning tooltip on enable

### 3.4 Dual-Pane SFTP

Full file manager replacing the current remote-only browser.

- **Local file browser**: Node.js `fs` APIs via IPC, same `FilePane` component with `source` prop
- **Side-by-side**: Two `FilePane` in `ResizablePanelGroup` — left local, right remote (swappable)
- **Drag-and-drop transfers**: Drag from one pane to the other initiates upload/download
- **Bulk operations**: Multi-select with `Cmd+Click` / `Shift+Click`, bulk download/upload/delete
- **Resume transfers**: Track byte offset in `transfer-store`, use SFTP `append` mode
- **Bookmarked paths**: Save per-host local and remote paths, quick-nav dropdown
- **Inline editing**: Double-click text file → download to temp → open in CodeMirror editor → save pushes back via SFTP
- **Transfer queue**: Bottom panel showing pending/active/completed transfers with retry for failures

### 3.5 Encrypted Cloud Sync

Complete the existing `EncryptionTab` foundation.

- **Scheme**: libsodium `crypto_secretbox` (XSalsa20-Poly1305), key from workspace passphrase via Argon2id
- **What syncs**: SSH private keys, host passwords, API keys, sensitive snippets
- **Flow**: Client encrypts → Supabase Storage blob → other members decrypt with shared passphrase
- **Key rotation**: `changeWorkspacePassphrase` re-encrypts all blobs, pushes new versions
- **Conflict resolution**: Last-write-wins with `synced_at` timestamps
- **Offline**: Local SQLite is source of truth, sync is eventual

### 3.6 Audit Logs

- New Supabase table:
  ```sql
  create table audit_logs (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid references workspaces(id) on delete cascade,
    user_id uuid references auth.users(id),
    action text not null,
    resource_type text,
    resource_id uuid,
    metadata jsonb default '{}',
    ip_address inet,
    created_at timestamptz default now()
  );
  ```
- Append-only: RLS allows members to read, only system writes (Postgres trigger or Edge Function)
- Logged events: connection open/close, host CRUD, key import/delete, member invite/remove/role-change, settings change, SFTP operations
- UI: "Activity" page for admins — filterable table with user avatar, action, timestamp, resource link
- Retention: configurable per workspace (default 90 days), purge via scheduled Edge Function

### 3.7 Connection Monitoring & Keep-Alive

- **Health dashboard**: Latency, uptime, reconnection count per session in status bar
- **Auto-reconnect**: On SSH disconnect, exponential backoff reconnection (configurable max retries in settings)
- **Idle timeout warning**: Toast before server kills session, with "send keep-alive" action button

---

## Dependencies (New Packages)

| Package | Phase | Purpose |
|---|---|---|
| `node-pty` | 2 | Local shell process spawning |
| `@xterm/addon-search` | 2 | Terminal search |
| `@xterm/addon-ligatures` | 2 | Font ligature support |
| `@xterm/addon-image` | 2 | Inline image rendering |
| `@xterm/addon-unicode11` | 2 | Wide character support |
| `@xterm/addon-serialize` | 2 | Buffer save/restore |
| `electron-log` or `pino` | 1 | Structured logging |
| `libsodium-wrappers` | 1, 3 | Encryption (workspace sync) |
| `codemirror` or `@monaco-editor/react` | 3 | Inline SFTP file editing |

---

## Success Criteria

**Phase 1 complete when:**
- No hardcoded secrets in codebase
- All stub buttons are functional or removed
- Zero console.log in production code
- SSH errors surface as user-readable messages

**Phase 2 complete when:**
- Local shell works on macOS, Linux, Windows
- Split panes support arbitrary nesting
- Snippets can be created, searched, and executed in terminal
- Terminal search finds text in scrollback buffer

**Phase 3 complete when:**
- Local port forwarding works through SSH tunnel
- Jump host chains connect successfully
- Dual-pane SFTP supports drag-and-drop transfer between local and remote
- Workspace encryption encrypts/decrypts on multiple devices with shared passphrase
- Audit log captures all security-relevant events
