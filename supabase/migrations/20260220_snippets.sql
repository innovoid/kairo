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
