# ArchTerm

A modern, workspace-first SSH client built with Electron, React, and Supabase.

## Features

ArchTerm provides a complete SSH client experience with team collaboration and AI-powered assistance:

### 🗂️ Folder Organization
- Create nested folder structures for organizing hosts
- Drag-and-drop hosts between folders and root
- Context menus for rename and delete operations
- Visual hierarchy with collapsible folder sections

### 📁 SFTP File Transfers
- Upload files via button or drag-and-drop
- Download files with double-click
- Real-time progress tracking with speed display
- Multiple concurrent transfers
- Visual progress bars and notifications

### 🤖 AI Command Assistance
- Natural language to command translation
- Multi-provider support (OpenAI, Anthropic, Gemini)
- Command detection in chat messages
- One-click insertion into active terminal
- Fast model defaults for quick responses

### 👥 Team Collaboration
- Workspace-based team management
- Member invitation system
- Role-based access control (Owner, Admin, Member)
- Team page with member list and management
- Supabase RLS for data isolation

### ⚙️ Enhanced Settings
- **Terminal**: Cursor style, scrollback lines, line height, bell style
- **Appearance**: Theme, terminal font, font size
- **AI**: Collapsible provider sections, masked API keys, model selection, test connection
- Clean, professional UI with visual feedback

### Core SSH Features
- Terminal sessions with xterm.js
- Key-based authentication
- Password authentication
- Session management with tabs
- Connection status indicators

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

## Architecture

This repository includes the mandatory **workspace tenancy** implementation with Supabase RLS, invitation flow, and renderer/main integration scaffolding.

## What Was Implemented

- Supabase migration: `supabase/migrations/202602190001_workspace_first_rls.sql`
  - `workspaces`, `workspace_members`, `workspace_invites`
  - `workspace_settings`, `user_workspace_settings`
  - Helper functions for membership/roles and active workspace state
  - RPCs:
    - `create_workspace_with_owner(workspace_name text)`
    - `ensure_personal_workspace(default_name text)`
    - `set_active_workspace(target_workspace_id uuid)`
    - `accept_workspace_invite(raw_token text)`
  - Storage bucket + policies for encrypted keys under `encrypted-keys/<workspace_id>/...`
  - Compatibility rollout for existing tables via `workspace_id` additions

- SQL checks: `supabase/tests/workspace_rls_checks.sql`

- Shared workspace contracts: `src/shared/types/workspace.ts`

- Electron + renderer scaffolding:
  - IPC handlers: `src/main/ipc/workspace.ts`
  - Preload API bridge: `src/preload/workspace-api.ts`
  - Workspace store: `src/renderer/src/stores/workspace-store.ts`
  - Onboarding gate: `src/renderer/src/features/workspaces/WorkspaceGate.tsx`
  - Workspace switcher: `src/renderer/src/features/workspaces/WorkspaceSwitcher.tsx`
  - Members/invites panel: `src/renderer/src/features/workspaces/WorkspaceMembersPanel.tsx`

## Migration Usage

1. Apply migration in Supabase SQL editor or migration runner.
2. Verify checks using `supabase/tests/workspace_rls_checks.sql`.
3. Run backfill for legacy rows and then enforce `workspace_id NOT NULL` in a follow-up migration after `assert_workspace_backfill_ready()` passes.

## Notes

- Workspaces are mandatory by design.
- First-run flow should call `ensure_personal_workspace('Personal Workspace')` when user has none.
- All data authorization should remain RLS-first and workspace membership-based.
