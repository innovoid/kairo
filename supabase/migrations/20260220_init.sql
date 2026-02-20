-- Change default cursor style from 'block' to 'bar'
alter table settings
alter column cursor_style set default 'bar';
-- Add terminal_theme column to settings table
alter table settings
add column if not exists terminal_theme text not null default 'dracula'
check (terminal_theme in ('dracula', 'tokyo-night', 'catppuccin-mocha', 'nord', 'gruvbox-dark', 'one-dark', 'monokai', 'material', 'synthwave', 'ayu-dark', 'horizon', 'github-dark'));
-- Function to delete all user data before account deletion
CREATE OR REPLACE FUNCTION delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Delete user-specific data
  DELETE FROM user_workspace_settings WHERE user_id = current_user_id;
  DELETE FROM workspace_members WHERE user_id = current_user_id;
  DELETE FROM settings WHERE user_id = current_user_id;

  -- Note: Workspaces where user is sole owner are handled by RLS cascade
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION delete_user_account() TO authenticated;
-- ============================================================================
-- Workspace-Level SSH Key Encryption
-- ============================================================================
-- Enables encrypted sync of SSH private keys to Supabase Storage
-- Keys are encrypted with a workspace-specific passphrase

-- Storage bucket for encrypted keys (if not exists)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'encrypted-keys',
  'encrypted-keys',
  false,
  5242880, -- 5MB limit per key
  array['application/octet-stream', 'text/plain']
)
on conflict (id) do nothing;

-- Storage policies: workspace members can read/write their workspace's encrypted keys
create policy "Workspace members can upload encrypted keys"
on storage.objects for insert
with check (
  bucket_id = 'encrypted-keys'
  and auth.uid() in (
    select user_id from workspace_members
    where workspace_id::text = (storage.foldername(name))[1]
  )
);

create policy "Workspace members can read encrypted keys"
on storage.objects for select
using (
  bucket_id = 'encrypted-keys'
  and auth.uid() in (
    select user_id from workspace_members
    where workspace_id::text = (storage.foldername(name))[1]
  )
);

create policy "Workspace members can delete encrypted keys"
on storage.objects for delete
using (
  bucket_id = 'encrypted-keys'
  and auth.uid() in (
    select user_id from workspace_members
    where workspace_id::text = (storage.foldername(name))[1]
  )
);

-- Table to store encrypted workspace passphrase salts (passphrase itself never stored)
create table if not exists workspace_encryption (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  salt text not null, -- Used to derive encryption key from user passphrase
  verification_hash text not null, -- Hash to verify passphrase is correct
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS for workspace_encryption
alter table workspace_encryption enable row level security;

create policy "Workspace members can read encryption info"
on workspace_encryption for select
using (
  workspace_id in (
    select workspace_id from workspace_members
    where user_id = auth.uid()
  )
);

create policy "Workspace owners can manage encryption"
on workspace_encryption for all
using (
  workspace_id in (
    select workspace_id from workspace_members
    where user_id = auth.uid()
    and role = 'owner'
  )
);

-- Function to initialize workspace encryption (called when first key is synced)
create or replace function init_workspace_encryption(
  p_workspace_id uuid,
  p_salt text,
  p_verification_hash text
)
returns void
language plpgsql
security definer
as $$
begin
  insert into workspace_encryption (workspace_id, salt, verification_hash)
  values (p_workspace_id, p_salt, p_verification_hash)
  on conflict (workspace_id) do nothing;
end;
$$;
-- Create public.users table to mirror auth.users for easy querying
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text,
  avatar_url text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Users can read all profiles
CREATE POLICY "Users can view all profiles"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create user profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Update existing auth.users to create their profiles (if any exist)
INSERT INTO public.users (id, email, name, avatar_url)
SELECT 
  id,
  email,
  COALESCE(raw_user_meta_data->>'name', email),
  raw_user_meta_data->>'avatar_url'
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Add foreign key constraint from workspace_members to public.users
-- This allows Supabase to automatically join the tables
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workspace_members_user_id_fkey'
  ) THEN
    ALTER TABLE workspace_members
      ADD CONSTRAINT workspace_members_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES public.users(id)
      ON DELETE CASCADE;
  END IF;
END $$;
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
create table if not exists snippets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  name text not null,
  command text not null,
  description text,
  tags text[] default '{}',
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table snippets enable row level security;

create policy "members can read workspace snippets" on snippets
  for select using (
    exists (select 1 from workspace_members wm where wm.workspace_id = snippets.workspace_id and wm.user_id = auth.uid())
  );

create policy "members can insert workspace snippets" on snippets
  for insert with check (
    exists (select 1 from workspace_members wm where wm.workspace_id = snippets.workspace_id and wm.user_id = auth.uid())
  );

create policy "members can update workspace snippets" on snippets
  for update using (
    exists (select 1 from workspace_members wm where wm.workspace_id = snippets.workspace_id and wm.user_id = auth.uid())
  );

create policy "members can delete workspace snippets" on snippets
  for delete using (
    exists (select 1 from workspace_members wm where wm.workspace_id = snippets.workspace_id and wm.user_id = auth.uid())
  );
