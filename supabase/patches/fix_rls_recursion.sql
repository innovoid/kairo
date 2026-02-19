-- ============================================================
-- Patch: Fix infinite recursion in workspace_members RLS
-- Run this in the Supabase SQL Editor against your project.
-- ============================================================

-- Step 1: Create security definer helper functions.
-- These bypass RLS when querying workspace_members, preventing
-- infinite recursion in policies that check membership.

create or replace function is_workspace_member(wid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = wid
      and user_id = auth.uid()
  );
$$;

create or replace function is_workspace_admin(wid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = wid
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;

-- Step 2: Replace all policies that inline workspace_members subqueries.

-- workspaces
drop policy if exists "members can view their workspaces" on workspaces;
drop policy if exists "members can update workspaces they own or admin" on workspaces;

create policy "members can view their workspaces"
  on workspaces for select
  using (is_workspace_member(id));

create policy "members can update workspaces they own or admin"
  on workspaces for update
  using (is_workspace_admin(id));

-- workspace_members
drop policy if exists "members can view workspace members" on workspace_members;
drop policy if exists "owners and admins can manage members" on workspace_members;

create policy "members can view workspace members"
  on workspace_members for select
  using (is_workspace_member(workspace_id));

create policy "owners and admins can manage members"
  on workspace_members for all
  using (is_workspace_admin(workspace_id));

-- workspace_invites
drop policy if exists "members can manage invites" on workspace_invites;

create policy "members can manage invites"
  on workspace_invites for all
  using (is_workspace_admin(workspace_id));

-- host_folders
drop policy if exists "workspace members can manage host_folders" on host_folders;

create policy "workspace members can manage host_folders"
  on host_folders for all
  using (is_workspace_member(workspace_id));

-- hosts
drop policy if exists "workspace members can manage hosts" on hosts;

create policy "workspace members can manage hosts"
  on hosts for all
  using (is_workspace_member(workspace_id));

-- ssh_keys
drop policy if exists "workspace members can manage ssh_keys" on ssh_keys;

create policy "workspace members can manage ssh_keys"
  on ssh_keys for all
  using (is_workspace_member(workspace_id));
