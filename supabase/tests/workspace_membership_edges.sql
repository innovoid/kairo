begin;

select plan(9);

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
    '10000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'owner2@example.com',
    crypt('password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'outsider2@example.com',
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
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.email', 'owner2@example.com', true);

create temp table owner_workspace on commit drop as
select *
from ensure_personal_workspace('Owner 2 Personal')
limit 1;

select is(
  (select count(*)::int from owner_workspace),
  1,
  'ensure_personal_workspace returns one workspace'
);

create temp table owner_workspace_again on commit drop as
select *
from ensure_personal_workspace('Ignored Name')
limit 1;

select is(
  (select id::text from owner_workspace_again limit 1),
  (select id::text from owner_workspace limit 1),
  'ensure_personal_workspace reuses existing owner workspace'
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
  '11000000-0000-0000-0000-000000000001',
  id,
  'Owner Host',
  '10.0.0.1',
  22,
  'root',
  'password'
from owner_workspace;

select is(
  (
    select count(*)::int
    from hosts h
    join owner_workspace ow on ow.id = h.workspace_id
  ),
  1,
  'owner can read hosts in personal workspace'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.email', 'outsider2@example.com', true);

create temp table outsider_workspace on commit drop as
select *
from create_workspace_with_owner('Outsider Workspace')
limit 1;

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.email', 'owner2@example.com', true);

select lives_ok(
  $$select set_active_workspace((select id from owner_workspace limit 1))$$,
  'owner can activate own workspace'
);

select throws_ok(
  $$select set_active_workspace((select id from outsider_workspace limit 1))$$,
  'P0001',
  'Not a member of this workspace',
  'owner cannot activate outsider workspace'
);

select is(
  (
    select count(*)::int
    from workspaces w
    join outsider_workspace ow on ow.id = w.id
  ),
  0,
  'owner cannot read outsider workspace via RLS'
);

select throws_ok(
  $$insert into hosts (workspace_id, label, hostname, port, username, auth_type)
    values ((select id from outsider_workspace limit 1), 'Should Fail', '10.0.0.2', 22, 'root', 'password')$$,
  '42501',
  'new row violates row-level security policy for table "hosts"',
  'owner cannot insert host into outsider workspace'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.email', 'outsider2@example.com', true);

select is(
  (
    select count(*)::int
    from hosts h
    join owner_workspace ow on ow.id = h.workspace_id
  ),
  0,
  'outsider cannot read owner host via RLS'
);

select is(
  (
    select count(*)::int
    from workspaces w
    join outsider_workspace ow on ow.id = w.id
  ),
  1,
  'outsider can read own workspace'
);

select * from finish();
rollback;
