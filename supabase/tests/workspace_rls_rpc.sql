begin;

select plan(10);

-- Seed auth users used by the RLS/RPC tests.
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'owner@example.com',
    crypt('password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'member@example.com',
    crypt('password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000003',
    'authenticated',
    'authenticated',
    'outsider@example.com',
    crypt('password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now()
  )
on conflict (id) do nothing;

set local role authenticated;

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.email', 'owner@example.com', true);

create temp table created_workspace on commit drop as
select *
from create_workspace_with_owner('RLS RPC Test Workspace')
limit 1;

select is(
  (select count(*)::int from created_workspace),
  1,
  'create_workspace_with_owner returns exactly one workspace'
);

select ok(
  exists (
    select 1
    from workspace_members wm
    join created_workspace w on w.id = wm.workspace_id
    where wm.user_id = '00000000-0000-0000-0000-000000000001'
      and wm.role = 'owner'
  ),
  'workspace owner membership is created'
);

select ok(
  exists (
    select 1
    from user_workspace_settings uws
    join created_workspace w on w.id = uws.workspace_id
    where uws.user_id = '00000000-0000-0000-0000-000000000001'
      and uws.is_active = true
  ),
  'owner active workspace setting is created'
);

insert into hosts (
  id,
  workspace_id,
  label,
  hostname,
  port,
  username,
  auth_type
)
select
  '10000000-0000-0000-0000-000000000001',
  id,
  'RLS Host',
  '127.0.0.1',
  22,
  'root',
  'password'
from created_workspace;

select is(
  (
    select count(*)::int
    from hosts h
    join created_workspace w on w.id = h.workspace_id
  ),
  1,
  'owner can read hosts inside their workspace'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
select set_config('request.jwt.claim.email', 'outsider@example.com', true);

select is(
  (
    select count(*)::int
    from hosts h
    join created_workspace w on w.id = h.workspace_id
  ),
  0,
  'outsider cannot read hosts due to RLS'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.email', 'owner@example.com', true);

insert into workspace_invites (
  id,
  workspace_id,
  email,
  role,
  token_hash,
  invited_by,
  expires_at
)
select
  '20000000-0000-0000-0000-000000000001',
  id,
  'member@example.com',
  'member',
  encode(sha256('invite-token-123'::bytea), 'hex'),
  '00000000-0000-0000-0000-000000000001',
  now() + interval '1 day'
from created_workspace;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.email', 'member@example.com', true);

select lives_ok(
  $$select * from accept_workspace_invite('invite-token-123')$$,
  'accept_workspace_invite accepts valid token'
);

select ok(
  exists (
    select 1
    from workspace_members wm
    join created_workspace w on w.id = wm.workspace_id
    where wm.user_id = '00000000-0000-0000-0000-000000000002'
      and wm.role = 'member'
  ),
  'accepted invite creates workspace membership'
);

select ok(
  exists (
    select 1
    from workspace_invites wi
    where wi.id = '20000000-0000-0000-0000-000000000001'
      and wi.accepted_at is not null
  ),
  'accepted invite is marked as accepted'
);

select throws_ok(
  $$select * from accept_workspace_invite('not-a-real-token')$$,
  'P0001',
  'Invalid or expired invite token',
  'accept_workspace_invite rejects invalid token'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.email', 'member@example.com', true);

select is(
  (
    select count(*)::int
    from hosts h
    join created_workspace w on w.id = h.workspace_id
  ),
  1,
  'new member can read hosts in joined workspace via RLS'
);

select * from finish();
rollback;
