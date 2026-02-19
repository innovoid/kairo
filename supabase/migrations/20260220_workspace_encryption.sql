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
