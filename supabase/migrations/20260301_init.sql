-- ============================================================
-- ArchTerm - Consolidated initial schema
-- Merged from all prior migrations and RLS patch fixes.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- Core tables
-- ------------------------------------------------------------
create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists workspace_members (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  token_hash text not null unique,
  invited_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists user_workspace_settings (
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  is_active boolean not null default false,
  primary key (user_id, workspace_id)
);

create table if not exists host_folders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  parent_id uuid references host_folders(id) on delete cascade,
  name text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists ssh_keys (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  key_type text not null check (key_type in ('rsa', 'ed25519', 'ecdsa', 'other')),
  public_key text not null,
  fingerprint text not null,
  has_encrypted_sync boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists hosts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  folder_id uuid references host_folders(id) on delete set null,
  label text not null,
  hostname text not null,
  port int not null default 22,
  username text not null,
  auth_type text not null check (auth_type in ('password', 'key')),
  key_id uuid references ssh_keys(id) on delete set null,
  tags text[] not null default '{}',
  port_forwards jsonb default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  theme text not null default 'dark',
  terminal_font text not null default 'JetBrains Mono',
  terminal_font_size int not null default 14,
  terminal_theme text not null default 'dracula' check (
    terminal_theme in (
      'dracula',
      'tokyo-night',
      'catppuccin-mocha',
      'nord',
      'gruvbox-dark',
      'one-dark',
      'monokai',
      'material',
      'synthwave',
      'ayu-dark',
      'horizon',
      'github-dark'
    )
  ),
  prompt_style text default 'default',
  scrollback_lines int not null default 1000,
  cursor_style text not null default 'bar' check (cursor_style in ('block', 'underline', 'bar')),
  bell_style text not null default 'none' check (bell_style in ('none', 'sound', 'visual')),
  line_height numeric(3,1) not null default 1.2,
  copy_on_select boolean default false,
  ai_provider text not null default 'openai',
  openai_api_key_encrypted text,
  anthropic_api_key_encrypted text,
  gemini_api_key_encrypted text,
  updated_at timestamptz not null default now()
);

create table if not exists workspace_encryption (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  salt text not null,
  verification_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  avatar_url text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

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

-- ------------------------------------------------------------
-- Storage bucket and policies for encrypted keys
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'encrypted-keys',
  'encrypted-keys',
  false,
  5242880,
  array['application/octet-stream', 'text/plain']
)
on conflict (id) do nothing;

drop policy if exists "Workspace members can upload encrypted keys" on storage.objects;
create policy "Workspace members can upload encrypted keys"
on storage.objects for insert
with check (
  bucket_id = 'encrypted-keys'
  and auth.uid() in (
    select user_id from workspace_members
    where workspace_id::text = (storage.foldername(name))[1]
  )
);

drop policy if exists "Workspace members can read encrypted keys" on storage.objects;
create policy "Workspace members can read encrypted keys"
on storage.objects for select
using (
  bucket_id = 'encrypted-keys'
  and auth.uid() in (
    select user_id from workspace_members
    where workspace_id::text = (storage.foldername(name))[1]
  )
);

drop policy if exists "Workspace members can delete encrypted keys" on storage.objects;
create policy "Workspace members can delete encrypted keys"
on storage.objects for delete
using (
  bucket_id = 'encrypted-keys'
  and auth.uid() in (
    select user_id from workspace_members
    where workspace_id::text = (storage.foldername(name))[1]
  )
);

-- ------------------------------------------------------------
-- Common helper functions and triggers
-- ------------------------------------------------------------
create or replace function update_updated_at_column()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists workspaces_updated_at on workspaces;
create trigger workspaces_updated_at
before update on workspaces
for each row execute function update_updated_at_column();

drop trigger if exists hosts_updated_at on hosts;
create trigger hosts_updated_at
before update on hosts
for each row execute function update_updated_at_column();

drop trigger if exists settings_updated_at on settings;
create trigger settings_updated_at
before update on settings
for each row execute function update_updated_at_column();

drop trigger if exists workspace_encryption_updated_at on workspace_encryption;
create trigger workspace_encryption_updated_at
before update on workspace_encryption
for each row execute function update_updated_at_column();

drop trigger if exists set_updated_at on public.users;
create trigger set_updated_at
before update on public.users
for each row
execute function public.handle_updated_at();

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', new.email),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update
  set
    email = excluded.email,
    name = excluded.name,
    avatar_url = excluded.avatar_url,
    updated_at = now();

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

insert into public.users (id, email, name, avatar_url)
select
  id,
  email,
  coalesce(raw_user_meta_data->>'name', email),
  raw_user_meta_data->>'avatar_url'
from auth.users
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- Membership helpers (RLS recursion-safe)
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table workspace_invites enable row level security;
alter table user_workspace_settings enable row level security;
alter table host_folders enable row level security;
alter table hosts enable row level security;
alter table ssh_keys enable row level security;
alter table settings enable row level security;
alter table workspace_encryption enable row level security;
alter table public.users enable row level security;
alter table snippets enable row level security;

drop policy if exists "members can view their workspaces" on workspaces;
create policy "members can view their workspaces"
  on workspaces for select
  using (is_workspace_member(id));

drop policy if exists "members can update workspaces they own or admin" on workspaces;
create policy "members can update workspaces they own or admin"
  on workspaces for update
  using (is_workspace_admin(id));

drop policy if exists "authenticated users can create workspaces" on workspaces;
create policy "authenticated users can create workspaces"
  on workspaces for insert
  with check (created_by = auth.uid());

drop policy if exists "members can view workspace members" on workspace_members;
create policy "members can view workspace members"
  on workspace_members for select
  using (is_workspace_member(workspace_id));

drop policy if exists "owners and admins can manage members" on workspace_members;
create policy "owners and admins can manage members"
  on workspace_members for all
  using (is_workspace_admin(workspace_id));

drop policy if exists "users can insert themselves as owner" on workspace_members;
create policy "users can insert themselves as owner"
  on workspace_members for insert
  with check (user_id = auth.uid());

drop policy if exists "members can manage invites" on workspace_invites;
create policy "members can manage invites"
  on workspace_invites for all
  using (is_workspace_admin(workspace_id));

drop policy if exists "anyone can view their own invites by email" on workspace_invites;
create policy "anyone can view their own invites by email"
  on workspace_invites for select
  using (lower(email) = lower(coalesce(auth.email(), '')));

drop policy if exists "users manage own workspace settings" on user_workspace_settings;
create policy "users manage own workspace settings"
  on user_workspace_settings for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "workspace members can manage host_folders" on host_folders;
create policy "workspace members can manage host_folders"
  on host_folders for all
  using (is_workspace_member(workspace_id));

drop policy if exists "workspace members can manage hosts" on hosts;
create policy "workspace members can manage hosts"
  on hosts for all
  using (is_workspace_member(workspace_id));

drop policy if exists "workspace members can manage ssh_keys" on ssh_keys;
create policy "workspace members can manage ssh_keys"
  on ssh_keys for all
  using (is_workspace_member(workspace_id));

drop policy if exists "users manage own settings" on settings;
create policy "users manage own settings"
  on settings for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Workspace members can read encryption info" on workspace_encryption;
create policy "Workspace members can read encryption info"
  on workspace_encryption for select
  using (
    workspace_id in (
      select workspace_id from workspace_members
      where user_id = auth.uid()
    )
  );

drop policy if exists "Workspace owners can manage encryption" on workspace_encryption;
create policy "Workspace owners can manage encryption"
  on workspace_encryption for all
  using (
    workspace_id in (
      select workspace_id from workspace_members
      where user_id = auth.uid()
        and role = 'owner'
    )
  );

drop policy if exists "Users can view all profiles" on public.users;
create policy "Users can view all profiles"
  on public.users for select to authenticated
  using (true);

drop policy if exists "Users can update own profile" on public.users;
create policy "Users can update own profile"
  on public.users for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "members can read workspace snippets" on snippets;
create policy "members can read workspace snippets"
  on snippets for select
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = snippets.workspace_id
        and wm.user_id = auth.uid()
    )
  );

drop policy if exists "members can insert workspace snippets" on snippets;
create policy "members can insert workspace snippets"
  on snippets for insert
  with check (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = snippets.workspace_id
        and wm.user_id = auth.uid()
    )
  );

drop policy if exists "members can update workspace snippets" on snippets;
create policy "members can update workspace snippets"
  on snippets for update
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = snippets.workspace_id
        and wm.user_id = auth.uid()
    )
  );

drop policy if exists "members can delete workspace snippets" on snippets;
create policy "members can delete workspace snippets"
  on snippets for delete
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = snippets.workspace_id
        and wm.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- RPCs
-- ------------------------------------------------------------
create or replace function create_workspace_with_owner(workspace_name text)
returns setof workspaces
language plpgsql
security definer
as $$
declare
  v_workspace workspaces;
begin
  insert into workspaces (name, created_by)
  values (workspace_name, auth.uid())
  returning * into v_workspace;

  insert into workspace_members (workspace_id, user_id, role)
  values (v_workspace.id, auth.uid(), 'owner');

  insert into user_workspace_settings (user_id, workspace_id, is_active)
  values (auth.uid(), v_workspace.id, true)
  on conflict (user_id, workspace_id) do update set is_active = true;

  update user_workspace_settings
  set is_active = false
  where user_id = auth.uid()
    and workspace_id <> v_workspace.id;

  return next v_workspace;
end;
$$;

create or replace function ensure_personal_workspace(default_name text default 'Personal Workspace')
returns setof workspaces
language plpgsql
security definer
as $$
declare
  v_workspace workspaces;
begin
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
    insert into user_workspace_settings (user_id, workspace_id, is_active)
    values (auth.uid(), v_workspace.id, true)
    on conflict (user_id, workspace_id) do update set is_active = true;
  end if;

  return next v_workspace;
end;
$$;

create or replace function set_active_workspace(target_workspace_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  if not exists (
    select 1 from workspace_members
    where workspace_id = target_workspace_id
      and user_id = auth.uid()
  ) then
    raise exception 'Not a member of this workspace';
  end if;

  update user_workspace_settings
  set is_active = false
  where user_id = auth.uid();

  insert into user_workspace_settings (user_id, workspace_id, is_active)
  values (auth.uid(), target_workspace_id, true)
  on conflict (user_id, workspace_id) do update set is_active = true;
end;
$$;

create or replace function accept_workspace_invite(raw_token text)
returns table(workspace_id uuid, role text)
language plpgsql
security definer
as $$
declare
  v_token_hash text;
  v_invite workspace_invites;
begin
  v_token_hash := encode(sha256(raw_token::bytea), 'hex');

  select * into v_invite
  from workspace_invites
  where token_hash = v_token_hash
    and accepted_at is null
    and revoked_at is null
    and expires_at > now();

  if v_invite.id is null then
    raise exception 'Invalid or expired invite token';
  end if;

  insert into workspace_members (workspace_id, user_id, role)
  values (v_invite.workspace_id, auth.uid(), v_invite.role)
  on conflict on constraint workspace_members_pkey do nothing;

  update workspace_invites
  set accepted_at = now()
  where id = v_invite.id;

  return query select v_invite.workspace_id, v_invite.role;
end;
$$;

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

create or replace function public.delete_user_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  owned_workspace_ids uuid[];
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

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

  if owned_workspace_ids is not null then
    delete from workspaces
    where id = any(owned_workspace_ids);
  end if;

  delete from workspace_members where user_id = current_user_id;

  update workspace_invites
  set revoked_at = now()
  where invited_by = current_user_id
    and accepted_at is null
    and revoked_at is null;

  delete from user_workspace_settings where user_id = current_user_id;
  delete from settings where user_id = current_user_id;
  delete from public.users where id = current_user_id;
end;
$$;

revoke all on function public.delete_user_account() from public;
grant execute on function public.delete_user_account() to authenticated;
