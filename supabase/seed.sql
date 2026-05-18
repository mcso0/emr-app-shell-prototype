-- DEN-35: workspace auth seed contract.
-- Runs after local migrations during `npx supabase db reset --local`.
-- legacy role compatibility: nurse -> technician, billing_admin -> hospital_admin.

select 'workspace_auth_seed_contract_version:2026-05-18-den-35' as workspace_auth_seed_contract_version;

insert into auth.users (
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
    '00000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'admin@clair.local',
    crypt('local-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"송민재"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'vet@clair.local',
    crypt('local-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"이수지"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'technician@clair.local',
    crypt('local-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"송하윤"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000000004',
    'authenticated',
    'authenticated',
    'front-desk@clair.local',
    crypt('local-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"최유나"}'::jsonb,
    now(),
    now()
  )
on conflict (id) do update
set
  email = excluded.email,
  encrypted_password = excluded.encrypted_password,
  email_confirmed_at = excluded.email_confirmed_at,
  raw_app_meta_data = excluded.raw_app_meta_data,
  raw_user_meta_data = excluded.raw_user_meta_data,
  updated_at = now();

insert into public.users (id, display_name, initial, email, phone, status)
values
  ('00000000-0000-4000-8000-000000000001', '송민재', 'SM', 'admin@clair.local', '010-0000-0001', 'active'),
  ('00000000-0000-4000-8000-000000000002', '이수지', 'LS', 'vet@clair.local', '010-0000-0002', 'active'),
  ('00000000-0000-4000-8000-000000000003', '송하윤', 'SH', 'technician@clair.local', '010-0000-0003', 'active'),
  ('00000000-0000-4000-8000-000000000004', '최유나', 'CY', 'front-desk@clair.local', '010-0000-0004', 'active')
on conflict (id) do update
set
  display_name = excluded.display_name,
  initial = excluded.initial,
  email = excluded.email,
  phone = excluded.phone,
  status = excluded.status,
  updated_at = now();

insert into public.workspaces (id, display_name, status, created_by_user_id)
values (
  'clair-demo',
  'CLAiR Demo Hospital',
  'active',
  '00000000-0000-4000-8000-000000000001'
)
on conflict (id) do update
set
  display_name = excluded.display_name,
  status = excluded.status,
  created_by_user_id = excluded.created_by_user_id,
  updated_at = now();

insert into public.user_memberships (
  id,
  workspace_id,
  user_id,
  roles,
  department,
  title,
  status,
  activated_at
)
values
  (
    '10000000-0000-4000-8000-000000000001',
    'clair-demo',
    '00000000-0000-4000-8000-000000000001',
    array['hospital_admin'],
    'Operations',
    'Hospital Admin',
    'active',
    now()
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    'clair-demo',
    '00000000-0000-4000-8000-000000000002',
    array['vet'],
    'Clinical',
    'Veterinarian',
    'active',
    now()
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    'clair-demo',
    '00000000-0000-4000-8000-000000000003',
    array['technician'],
    'Clinical Support',
    'Technician',
    'active',
    now()
  ),
  (
    '10000000-0000-4000-8000-000000000004',
    'clair-demo',
    '00000000-0000-4000-8000-000000000004',
    array['front_desk'],
    'Reception',
    'Front Desk',
    'active',
    now()
  )
on conflict (workspace_id, user_id) do update
set
  roles = excluded.roles,
  department = excluded.department,
  title = excluded.title,
  status = excluded.status,
  activated_at = excluded.activated_at,
  updated_at = now();

insert into public.permission_policies (
  workspace_id,
  name,
  scope,
  target_role,
  permissions
)
values
  (
    'clair-demo',
    'Hospital admin full access',
    'role',
    'hospital_admin',
    '{"allowed":["*"]}'::jsonb
  ),
  (
    'clair-demo',
    'Veterinarian MVP access',
    'role',
    'vet',
    '{"allowed":["reception:view","patient:view","encounter:view","chart:view","chart:update","order:create","order:update","dispensing:view","lab:view","imaging:view","billing:view"]}'::jsonb
  ),
  (
    'clair-demo',
    'Technician MVP access',
    'role',
    'technician',
    '{"allowed":["reception:view","patient:view","encounter:view","chart:view","order:update","dispensing:view","dispensing:complete","lab:view","lab:update","imaging:view","imaging:update"]}'::jsonb
  ),
  (
    'clair-demo',
    'Front desk MVP access',
    'role',
    'front_desk',
    '{"allowed":["reception:view","reception:create","reception:update","patient:view","patient:create","patient:update","encounter:view","billing:view","billing:issue"]}'::jsonb
  )
on conflict (workspace_id, target_role) where scope = 'role' do update
set
  name = excluded.name,
  permissions = excluded.permissions,
  updated_at = now();
