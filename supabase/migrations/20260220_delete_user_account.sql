-- ============================================================
-- delete_user_account() RPC
-- Fully cleans up all user data before account deletion.
-- Replaces the incomplete version in 20260220_user_deletion.sql.
-- ============================================================
-- Tables confirmed to exist in this schema:
--   workspaces, workspace_members, workspace_invites,
--   user_workspace_settings, settings, public.users
--   (hosts, host_folders, ssh_keys, workspace_encryption cascade from workspaces)

create or replace function public.delete_user_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id  uuid := auth.uid();
  owned_workspace_ids uuid[];
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- ── 1. Find workspaces where the caller is the SOLE owner ────────────────
  -- A workspace is included only when no other owner row exists.
  select array_agg(wm.workspace_id) into owned_workspace_ids
  from workspace_members wm
  where wm.user_id = current_user_id
    and wm.role = 'owner'
    and not exists (
      select 1
      from workspace_members wm2
      where wm2.workspace_id = wm.workspace_id
        and wm2.role = 'owner'
        and wm2.user_id != current_user_id
    );

  -- ── 2. Delete solely-owned workspaces ───────────────────────────────────
  -- ON DELETE CASCADE propagates to:
  --   workspace_members, workspace_invites, user_workspace_settings,
  --   host_folders, hosts, ssh_keys, workspace_encryption
  if owned_workspace_ids is not null then
    delete from workspaces
    where id = any(owned_workspace_ids);
  end if;

  -- ── 3. Remove membership from remaining (co-owned / non-owned) workspaces
  delete from workspace_members
  where user_id = current_user_id;

  -- ── 4. Revoke pending invites sent by this user ──────────────────────────
  -- workspace_invites.invited_by is nullable (set null on auth.users delete),
  -- so this is a best-effort soft-revoke for any still-pending invites.
  update workspace_invites
  set revoked_at = now()
  where invited_by = current_user_id
    and accepted_at is null
    and revoked_at  is null;

  -- ── 5. Delete per-user workspace settings ────────────────────────────────
  -- Rows not already removed by workspace cascade (shared workspaces).
  delete from user_workspace_settings
  where user_id = current_user_id;

  -- ── 6. Delete user preferences ───────────────────────────────────────────
  delete from settings
  where user_id = current_user_id;

  -- ── 7. Delete public profile ─────────────────────────────────────────────
  -- auth.users deletion (triggered externally by Supabase Auth admin API)
  -- will cascade here, but we delete explicitly so the RPC is self-contained.
  delete from public.users
  where id = current_user_id;
end;
$$;

-- Revoke default public execute, grant only to authenticated users.
revoke all on function public.delete_user_account() from public;
grant execute on function public.delete_user_account() to authenticated;
