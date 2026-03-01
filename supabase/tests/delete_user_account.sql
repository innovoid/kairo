begin;

select plan(11);

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
    '30000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'delete-owner@example.com',
    crypt('password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '30000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'delete-coowner@example.com',
    crypt('password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '30000000-0000-0000-0000-000000000003',
    'authenticated',
    'authenticated',
    'delete-member@example.com',
    crypt('password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now()
  )
on conflict (id) do nothing;

insert into workspaces (id, name, created_by, created_at, updated_at)
values
  (
    '31000000-0000-0000-0000-000000000001',
    'Solo Owned Workspace',
    '30000000-0000-0000-0000-000000000001',
    now(),
    now()
  ),
  (
    '31000000-0000-0000-0000-000000000002',
    'Shared Owned Workspace',
    '30000000-0000-0000-0000-000000000001',
    now(),
    now()
  );

insert into workspace_members (workspace_id, user_id, role, created_at)
values
  ('31000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'owner', now()),
  ('31000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 'owner', now()),
  ('31000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', 'owner', now()),
  ('31000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000003', 'member', now());

insert into user_workspace_settings (user_id, workspace_id, is_active)
values
  ('30000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', true),
  ('30000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000002', false);

insert into settings (id, user_id)
values ('32000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001');

insert into workspace_invites (
  id,
  workspace_id,
  email,
  role,
  token_hash,
  invited_by,
  expires_at
)
values
  (
    '33000000-0000-0000-0000-000000000001',
    '31000000-0000-0000-0000-000000000002',
    'invitee@example.com',
    'member',
    encode(sha256('pending-delete-owner-invite'::bytea), 'hex'),
    '30000000-0000-0000-0000-000000000001',
    now() + interval '1 day'
  ),
  (
    '33000000-0000-0000-0000-000000000002',
    '31000000-0000-0000-0000-000000000002',
    'accepted@example.com',
    'member',
    encode(sha256('accepted-delete-owner-invite'::bytea), 'hex'),
    '30000000-0000-0000-0000-000000000001',
    now() + interval '1 day'
  );

update workspace_invites
set accepted_at = now()
where id = '33000000-0000-0000-0000-000000000002';

insert into hosts (
  id,
  workspace_id,
  label,
  hostname,
  port,
  username,
  auth_type
)
values
  ('34000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', 'Solo Host', '10.10.0.1', 22, 'root', 'password'),
  ('34000000-0000-0000-0000-000000000002', '31000000-0000-0000-0000-000000000002', 'Shared Host', '10.10.0.2', 22, 'root', 'password');

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.email', 'delete-owner@example.com', true);

select lives_ok(
  $$select public.delete_user_account()$$,
  'delete_user_account executes for authenticated user'
);

select is(
  (select count(*)::int from public.users where id = '30000000-0000-0000-0000-000000000001'),
  0,
  'public.users row is removed for deleted user'
);

select is(
  (select count(*)::int from workspace_members where user_id = '30000000-0000-0000-0000-000000000001'),
  0,
  'workspace memberships are removed for deleted user'
);

select is(
  (select count(*)::int from user_workspace_settings where user_id = '30000000-0000-0000-0000-000000000001'),
  0,
  'workspace settings are removed for deleted user'
);

select is(
  (select count(*)::int from settings where user_id = '30000000-0000-0000-0000-000000000001'),
  0,
  'settings row is removed for deleted user'
);

select is(
  (
    select count(*)::int
    from workspace_invites
    where invited_by = '30000000-0000-0000-0000-000000000001'
      and accepted_at is null
      and revoked_at is not null
  ),
  1,
  'pending invites by deleted user are revoked'
);

select is(
  (select count(*)::int from workspaces where id = '31000000-0000-0000-0000-000000000001'),
  0,
  'sole-owned workspace is deleted'
);

select is(
  (select count(*)::int from hosts where workspace_id = '31000000-0000-0000-0000-000000000001'),
  0,
  'hosts in sole-owned workspace are deleted by cascade'
);

select is(
  (select count(*)::int from workspaces where id = '31000000-0000-0000-0000-000000000002'),
  1,
  'shared workspace with another owner remains'
);

select is(
  (
    select count(*)::int
    from workspace_members
    where workspace_id = '31000000-0000-0000-0000-000000000002'
      and user_id = '30000000-0000-0000-0000-000000000002'
      and role = 'owner'
  ),
  1,
  'co-owner membership remains in shared workspace'
);

select is(
  (
    select count(*)::int
    from hosts
    where id = '34000000-0000-0000-0000-000000000002'
      and workspace_id = '31000000-0000-0000-0000-000000000002'
  ),
  1,
  'hosts in shared workspace remain'
);

select * from finish();
rollback;
