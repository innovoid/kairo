# ArchTerm Workspace-First Foundation

This repository now includes the mandatory **workspace tenancy** implementation with Supabase RLS, invitation flow, and renderer/main integration scaffolding.

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
