# ArchTerm Terminal-Centric Remaining Features Plan (Slices 1, 2, 4, 5)

  ## Summary

  Implement the remaining work for the terminal-centric UI path
  (TerminalCentricAppShell) by finishing:

  1. Folder organization UX (hosts-to-folders drag/drop + folder management in host
     browser overlay)
  2. SFTP transfer completion (API/type alignment, progress queue, drag/drop upload,
     transfer details)
  3. Team collaboration integration for terminal-centric flow (command-palette launched
     overlay)
  4. Settings polish integration for terminal-centric flow (overlay entrypoints + visual
     parity)

  This plan assumes legacy sidebar flows are not the target; we will reuse backend/store
  functionality that already exists and focus on terminal-centric integration and UX
  completion.

  ———

  ## Current State (Grounded)

  - Folder CRUD backend + preload + store already exist (hosts.ts, preload/hosts-api.ts,
    host-store.ts).
  - Team invite/member/role backend + UI already exist (workspace.ts, TeamPage.tsx,
    InviteMemberDialog.tsx).
  - Settings already include scrollback/cursor/bell and collapsible AI provider sections
    (SettingsPage.tsx).
  - SFTP backend emits progress and renderer has transfer store + components, but
    renderer API usage and types are inconsistent (FilePane.tsx, TransferProgress.tsx,
    shared/types/sftp.ts).
  - TerminalCentricAppShell has TODO placeholders and type mismatches around host
    fields/overlays.

  ———

  ## Scope and Order

  ### In scope

  - Terminal-centric integration for slices 1/2/4/5 with redesigned overlay-first UX.
  - Fixes to mismatched data contracts blocking those slices.
  - Command palette actions and hotkeys wired to real overlays.

  ### Out of scope

  - Slice 3 AI enhancements.
  - Rewriting legacy AppShell flows.
  - Folder tree drag/reorder (only hosts-to-folders drag/drop).

  ### Delivery order (locked)

  1. Slice 1: Folders
  2. Slice 2: SFTP
  3. Slice 4: Team (command palette overlay)
  4. Slice 5: Settings polish in terminal-centric context

  ———

  ## Public APIs / Interfaces / Types Changes

  1. src/shared/types/sftp.ts

  - Add optional telemetry fields to TransferProgress:
      - speedBytesPerSec?: number
      - startedAt?: string
      - updatedAt?: string
  - Keep existing fields backward compatible.

  2. src/preload/sftp-api.ts

  - Keep canonical signatures:
      - upload(sessionId, localPath, remotePath, transferId)
      - download(sessionId, remotePath, localPath, transferId)
  - No breaking changes; enforce usage consistency in renderer.

  3. Renderer host mapping contract (no shared type change)

  - In TerminalCentricAppShell, map from canonical Host fields:
      - keyId (not privateKeyId)
      - folderId + folders lookup (not folder)
      - remove notes dependency unless added separately.

  ———

  ## Implementation Plan

  ## Phase 0: Terminal-Centric Stabilization (Prerequisite)

  ### Goal

  Remove integration debt that blocks slices 1/2/4/5 in terminal-centric shell.

  ### Tasks

  1. Fix host field mismatches in TerminalCentricAppShell:

  - Use host.keyId in SSH connect payload.
  - Remove/replace host.notes.
  - Resolve folder label via host.folderId + useHostStore().folders.

  2. Replace placeholder overlay state (settingsOpen, keysOpen, snippetsOpen) with
     actual mounted overlays or tab-based fallbacks used by command palette actions.
  3. Ensure command palette action handlers do not point to TODO no-ops.

  ### Acceptance

  - Terminal-centric app renders without host-field runtime/type errors.
  - Command palette actions for Settings/Team/SFTP/Hosts execute real navigation.

  ———

  ## Slice 1: Folder Organization (Terminal-Centric)

  ### UX target

  Folder management and host organization happen inside HostBrowserOverlay with context
  menus + drag/drop.

  ### Tasks

  1. Data + mapping

  - Load folders from useHostStore.
  - Build overlay view model: root folders, nested folders, root hosts.

  2. Folder actions in overlay

  - Add “New Folder” entry in overlay footer/header.
  - Folder context menu:
      - Rename
      - Delete (with host-to-root warning)
  - Reuse FolderDialog pattern (or implement terminal-centric variant).
  - Persist via hostStore.createFolder/updateFolder/deleteFolder.

  3. Host drag/drop (hosts-to-folders only)

  - Use @dnd-kit/core.
  - Draggable: host rows/cards.
  - Droppable: folder rows + “Unorganized” root drop zone.
  - On drop:
      - folder target => moveToFolder(hostId, folderId)
      - root target => moveToFolder(hostId, null)
  - Add clear visual drop affordances.

  4. Keep folder expand/collapse state stable during drag and search mode.

  ### Files (primary)

  - src/renderer/src/features/hosts/HostBrowserOverlay.tsx
  - src/renderer/src/stores/host-store.ts (only if minor helper additions needed)
  - src/renderer/src/features/hosts/FolderDialog.tsx (reuse/adapt)

  ### Acceptance

  - User can create/rename/delete folders from host browser overlay.
  - User can drag host into folder and back to root.
  - Host organization persists after app restart/refetch.

  ———

  ## Slice 2: SFTP Transfers Completion

  ### UX target

  Global queue + SFTP pane details, reliable progress updates, drag/drop upload.

  ### Tasks

  1. Contract alignment (critical)

  - Update FilePane.tsx calls to match preload signatures with transferId.
  - Resolve local path for download (save dialog or default downloads path flow).
  - Remove invalid speed writes where type doesn’t support it (or after type update,
    populate correctly).

  2. Progress telemetry

  - In main process sftp-manager.ts, include updatedAt timestamps in events and speed
    (if available).
  - If backend speed is not sent, compute in store from deltas over time.

  3. Transfer store behavior

  - addTransfer on start.
  - updateProgress for active updates.
  - Mark done/error and auto-expire completed rows after N seconds (e.g., 5s).
  - Keep explicit dismiss (X) support.

  4. Transfer UI polish

  - TransferProgress.tsx:
      - active + recent completed/error sections
      - filename, direction, %, bytes, speed
      - concise status labels
  - Integrate with status bar count consistently.

  5. Drag/drop upload and download behavior hardening

  - Drag/drop overlay in FilePane should support multi-file and recover from partial
    failures.
  - Double-click/download + context menu download should both use same transfer path.

  ### Files (primary)

  - src/renderer/src/features/sftp/FilePane.tsx
  - src/renderer/src/features/sftp/TransferProgress.tsx
  - src/renderer/src/stores/transfer-store.ts
  - src/main/services/sftp-manager.ts
  - src/shared/types/sftp.ts (optional extensions)

  ### Acceptance

  - Upload/download works with correct API signatures.
  - Progress updates are visible in real time.
  - Queue reflects done/error states correctly.
  - Drag/drop uploads function for multiple files.

  ———

  ## Slice 4: Team Collaboration in Terminal-Centric Flow

  ### UX target

  Team management opened from command palette as full-screen overlay (no sidebar
  dependency).

  ### Tasks

  1. Team overlay integration

  - Add a terminal-centric overlay wrapper around team management UI.
  - Trigger from command palette action: “Team”.

  2. Reuse existing team functionality

  - Keep existing workspaceApi.members.* + workspaceApi.invite.
  - Reuse TeamPage and InviteMemberDialog logic with styling updates for terminal-
    centric visual language.

  3. Entry points

  - Add command palette command + optional hotkey mapping (mod+shift+t if free).
  - Ensure overlay close/escape behavior matches other overlays.

  ### Files (primary)

  - src/renderer/src/components/layout/TerminalCentricAppShell.tsx
  - src/renderer/src/features/team/TeamPage.tsx (styling/layout adaptation)
  - src/renderer/src/features/team/InviteMemberDialog.tsx (visual consistency)

  ### Acceptance

  - Team overlay opens from command palette.
  - Invite, role update, and removal work end-to-end.
  - No dependency on legacy sidebar/workspace tab for team access.

  ———

  ## Slice 5: Settings Polish in Terminal-Centric Context

  ### UX target

  Settings are fully accessible and visually consistent in terminal-centric mode,
  including enhanced terminal settings + collapsible AI providers.

  ### Tasks

  1. Settings entrypoint completion

  - Replace TODO settings flow in TerminalCentricAppShell with real settings overlay/tab
    opening.
  - Keep direct command-palette action + hotkey behavior.

  2. Visual parity pass

  - Ensure TerminalTab and AiTab sections match terminal-centric aesthetic tokens.
  - Preserve existing controls:
      - scrollback, cursor style, bell style
      - AI provider selector + collapsible provider key sections

  3. Optional cleanup

  - Remove dead state flags in shell once overlay routing is complete (settingsOpen,
    etc., if unused).

  ### Files (primary)

  - src/renderer/src/components/layout/TerminalCentricAppShell.tsx
  - src/renderer/src/features/settings/SettingsPage.tsx

  ### Acceptance

  - Settings open reliably in terminal-centric app.
  - Terminal and AI settings remain fully functional and visually aligned.

  ———

  ## Testing and Validation

  ## Automated

  1. Unit/store tests

  - host-store: create/update/delete folder + move host optimistic behavior.
  - transfer-store: add/update/complete/error/auto-expire behavior.

  2. Component tests

  - HostBrowserOverlay: drag host → folder/root, folder context actions.
  - TransferProgress: active/done/error rendering and dismiss behavior.
  - Team overlay: invite flow triggers API and refresh.

  3. Type safety gate

  - Ensure touched files compile cleanly; pre-existing unrelated repo errors are tracked
    separately and not conflated.

  ## Manual QA matrix

  1. Folders

  - Create nested folders, move hosts, refresh app, verify persistence.

  2. SFTP

  - Upload single/multi files, drag/drop uploads, download file, observe queue.

  3. Team

  - Invite valid/invalid email, role change, remove member.

  4. Settings

  - Change scrollback/cursor/bell and AI provider keys; verify persistence + effect.

  5. Terminal-centric UX

  - Command palette opens all implemented overlays without dead paths.

  ———

  ## Rollout Plan

  1. Ship Phase 0 + Slice 1 first behind normal dev branch.
  2. Ship Slice 2 after transfer contract alignment is validated.
  3. Ship Slice 4 + Slice 5 integration after UX polish pass.
  4. Run final regression pass on command palette actions/hotkeys and overlay layering/
     z-index.

  ———

  ## Assumptions and Defaults

  1. We optimize for terminal-centric shell only; legacy AppShell is not part of this
     milestone.
  2. Team feature backend is considered complete enough; this work is integration +
     redesign polish.
  3. Settings feature backend/UI logic is considered complete enough; this work is
     terminal-centric integration + polish.
  4. Folder drag/drop scope is hosts-to-folders only (no folder tree drag/reorder).
  5. Transfer UX is Global Queue + SFTP Pane.
  6. Slice 3 AI enhancements are excluded from this plan.