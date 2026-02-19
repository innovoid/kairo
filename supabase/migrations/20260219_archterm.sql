-- ============================================================
-- ArchTerm — Complete schema migration (self-contained)
-- Safe to re-run: drops everything first, then recreates.
-- ============================================================

-- ─────────────────────────────────────────────
-- 0. DROP EVERYTHING (reverse dependency order)
-- ─────────────────────────────────────────────

-- Functions
drop function if exists accept_workspace_invite(text);
drop function if exists set_active_workspace(uuid);
drop function if exists ensure_personal_workspace(text);
drop function if exists create_workspace_with_owner(text);
drop function if exists is_workspace_admin(uuid);
drop function if exists is_workspace_member(uuid);
drop function if exists update_updated_at_column() cascade;

-- Tables (children before parents)
drop table if exists settings cascade;
drop table if exists ssh_keys cascade;
drop table if exists hosts cascade;
drop table if exists host_folders cascade;
drop table if exists user_workspace_settings cascade;
drop table if exists workspace_invites cascade;
drop table if exists workspace_members cascade;
drop table if exists workspaces cascade;

-- ─────────────────────────────────────────────
-- 1. WORKSPACES
-- ─────────────────────────────────────────────
create table if not exists workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_by  uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- 2. WORKSPACE MEMBERS
-- ─────────────────────────────────────────────
create table if not exists workspace_members (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null default 'member'
                 check (role in ('owner', 'admin', 'member')),
  created_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

-- ─────────────────────────────────────────────
-- 3. WORKSPACE INVITES
-- ─────────────────────────────────────────────
create table if not exists workspace_invites (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  email        text not null,
  role         text not null default 'member'
                 check (role in ('owner', 'admin', 'member')),
  token_hash   text not null unique,
  invited_by   uuid references auth.users(id) on delete set null,
  expires_at   timestamptz not null,
  accepted_at  timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- 4. USER WORKSPACE SETTINGS (active workspace per user)
-- ─────────────────────────────────────────────
create table if not exists user_workspace_settings (
  user_id      uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  is_active    boolean not null default false,
  primary key (user_id, workspace_id)
);

-- ─────────────────────────────────────────────
-- 5. HOST FOLDERS
-- ─────────────────────────────────────────────
create table if not exists host_folders (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  parent_id    uuid references host_folders(id) on delete cascade,
  name         text not null,
  position     int not null default 0,
  created_at   timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- 6. HOSTS
-- ─────────────────────────────────────────────
create table if not exists hosts (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  folder_id    uuid references host_folders(id) on delete set null,
  label        text not null,
  hostname     text not null,
  port         int not null default 22,
  username     text not null,
  auth_type    text not null check (auth_type in ('password', 'key')),
  key_id       uuid,           -- FK to ssh_keys added below
  tags         text[] not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- 7. SSH KEYS
-- ─────────────────────────────────────────────
create table if not exists ssh_keys (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references workspaces(id) on delete cascade,
  name                text not null,
  key_type            text not null check (key_type in ('rsa', 'ed25519', 'ecdsa', 'other')),
  public_key          text not null,
  fingerprint         text not null,
  has_encrypted_sync  boolean not null default false,
  created_at          timestamptz not null default now()
);

-- Add FK from hosts.key_id → ssh_keys.id now that ssh_keys exists
alter table hosts
  add constraint hosts_key_id_fkey
  foreign key (key_id) references ssh_keys(id) on delete set null
  not valid;

-- ─────────────────────────────────────────────
-- 8. SETTINGS (per-user preferences)
-- ─────────────────────────────────────────────
create table if not exists settings (
  id                           uuid primary key default gen_random_uuid(),
  user_id                      uuid not null unique references auth.users(id) on delete cascade,
  theme                        text not null default 'dark',
  terminal_font                text not null default 'JetBrains Mono',
  terminal_font_size           int  not null default 14,
  ai_provider                  text not null default 'openai',
  openai_api_key_encrypted     text,
  anthropic_api_key_encrypted  text,
  gemini_api_key_encrypted     text,
  updated_at                   timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- 9. updated_at trigger
-- ─────────────────────────────────────────────
create or replace function update_updated_at_column()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger workspaces_updated_at
  before update on workspaces
  for each row execute function update_updated_at_column();

create trigger hosts_updated_at
  before update on hosts
  for each row execute function update_updated_at_column();

create trigger settings_updated_at
  before update on settings
  for each row execute function update_updated_at_column();

-- ─────────────────────────────────────────────
-- 10. ROW-LEVEL SECURITY HELPERS
-- ─────────────────────────────────────────────
-- security definer functions bypass RLS when querying workspace_members,
-- which prevents infinite recursion in policies that check membership.

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

-- ─────────────────────────────────────────────
-- 11. ROW-LEVEL SECURITY
-- ─────────────────────────────────────────────
alter table workspaces             enable row level security;
alter table workspace_members      enable row level security;
alter table workspace_invites      enable row level security;
alter table user_workspace_settings enable row level security;
alter table host_folders           enable row level security;
alter table hosts                  enable row level security;
alter table ssh_keys               enable row level security;
alter table settings               enable row level security;

-- workspaces
create policy "members can view their workspaces"
  on workspaces for select
  using (is_workspace_member(id));

create policy "members can update workspaces they own or admin"
  on workspaces for update
  using (is_workspace_admin(id));

create policy "authenticated users can create workspaces"
  on workspaces for insert
  with check (created_by = auth.uid());

-- workspace_members
create policy "members can view workspace members"
  on workspace_members for select
  using (is_workspace_member(workspace_id));

create policy "owners and admins can manage members"
  on workspace_members for all
  using (is_workspace_admin(workspace_id));

-- Allow users to insert themselves as owner when creating workspace
create policy "users can insert themselves as owner"
  on workspace_members for insert
  with check (user_id = auth.uid());

-- workspace_invites
create policy "members can manage invites"
  on workspace_invites for all
  using (is_workspace_admin(workspace_id));

create policy "anyone can view their own invites by email"
  on workspace_invites for select
  using (email = (select email from auth.users where id = auth.uid()));

-- user_workspace_settings
create policy "users manage own workspace settings"
  on user_workspace_settings for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- host_folders
create policy "workspace members can manage host_folders"
  on host_folders for all
  using (is_workspace_member(workspace_id));

-- hosts
create policy "workspace members can manage hosts"
  on hosts for all
  using (is_workspace_member(workspace_id));

-- ssh_keys
create policy "workspace members can manage ssh_keys"
  on ssh_keys for all
  using (is_workspace_member(workspace_id));

-- settings
create policy "users manage own settings"
  on settings for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ─────────────────────────────────────────────
-- 12. HELPER RPCs
-- ─────────────────────────────────────────────

-- create_workspace_with_owner: creates workspace + inserts owner membership
create or replace function create_workspace_with_owner(workspace_name text)
returns setof workspaces
language plpgsql security definer
as $$
declare
  v_workspace workspaces;
begin
  insert into workspaces (name, created_by)
  values (workspace_name, auth.uid())
  returning * into v_workspace;

  insert into workspace_members (workspace_id, user_id, role)
  values (v_workspace.id, auth.uid(), 'owner');

  -- Activate immediately
  insert into user_workspace_settings (user_id, workspace_id, is_active)
  values (auth.uid(), v_workspace.id, true)
  on conflict (user_id, workspace_id) do update set is_active = true;

  -- Deactivate all others
  update user_workspace_settings
  set is_active = false
  where user_id = auth.uid()
    and workspace_id <> v_workspace.id;

  return next v_workspace;
end;
$$;

-- ensure_personal_workspace: idempotent — returns existing or creates
create or replace function ensure_personal_workspace(default_name text default 'Personal Workspace')
returns setof workspaces
language plpgsql security definer
as $$
declare
  v_workspace workspaces;
begin
  -- Try to find an existing workspace owned by this user
  select w.* into v_workspace
  from workspaces w
  join workspace_members wm on wm.workspace_id = w.id
  where wm.user_id = auth.uid()
    and wm.role = 'owner'
  order by w.created_at asc
  limit 1;

  if v_workspace.id is null then
    select * into v_workspace
    from create_workspace_with_owner(default_name)
    limit 1;
  else
    -- Ensure it is activated
    insert into user_workspace_settings (user_id, workspace_id, is_active)
    values (auth.uid(), v_workspace.id, true)
    on conflict (user_id, workspace_id) do update set is_active = true;
  end if;

  return next v_workspace;
end;
$$;

-- set_active_workspace: switches the active workspace for the current user
create or replace function set_active_workspace(target_workspace_id uuid)
returns void
language plpgsql security definer
as $$
begin
  -- Verify the user is a member
  if not exists (
    select 1 from workspace_members
    where workspace_id = target_workspace_id
      and user_id = auth.uid()
  ) then
    raise exception 'Not a member of this workspace';
  end if;

  -- Deactivate all
  update user_workspace_settings
  set is_active = false
  where user_id = auth.uid();

  -- Activate target
  insert into user_workspace_settings (user_id, workspace_id, is_active)
  values (auth.uid(), target_workspace_id, true)
  on conflict (user_id, workspace_id) do update set is_active = true;
end;
$$;

-- accept_workspace_invite: validates token hash and adds member
create or replace function accept_workspace_invite(raw_token text)
returns table(workspace_id uuid, role text)
language plpgsql security definer
as $$
declare
  v_token_hash text;
  v_invite     workspace_invites;
begin
  -- Hash the incoming token
  v_token_hash := encode(sha256(raw_token::bytea), 'hex');

  select * into v_invite
  from workspace_invites
  where token_hash = v_token_hash
    and accepted_at is null
    and revoked_at  is null
    and expires_at  > now();

  if v_invite.id is null then
    raise exception 'Invalid or expired invite token';
  end if;

  -- Add member (ignore if already exists)
  insert into workspace_members (workspace_id, user_id, role)
  values (v_invite.workspace_id, auth.uid(), v_invite.role)
  on conflict (workspace_id, user_id) do nothing;

  -- Mark accepted
  update workspace_invites
  set accepted_at = now()
  where id = v_invite.id;

  return query select v_invite.workspace_id, v_invite.role;
end;
$$;
