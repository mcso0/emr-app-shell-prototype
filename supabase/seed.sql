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
    extensions.crypt('local-password', extensions.gen_salt('bf')),
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
    extensions.crypt('local-password', extensions.gen_salt('bf')),
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
    extensions.crypt('local-password', extensions.gen_salt('bf')),
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
    extensions.crypt('local-password', extensions.gen_salt('bf')),
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

-- Demo Reality & Launch Readiness: Cheongdam empty-clinic workspace access seed.
-- Keeps the Sales Demo `clair-demo` fixture separate while allowing seeded admin login
-- to enter the prepared Cheongdam workspace route.

select 'cheongdam_workspace_access_seed_contract_version:2026-06-12' as cheongdam_workspace_access_seed_contract_version;

insert into public.workspaces (id, display_name, status, created_by_user_id)
values (
  'workspace-clair-cheongdam',
  'VIP동물의료센터 청담점',
  'active',
  '00000000-0000-4000-8000-000000000001'
)
on conflict (id) do update
set
  display_name = excluded.display_name,
  status = excluded.status,
  created_by_user_id = excluded.created_by_user_id,
  updated_at = now();

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
  ('49110000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'owner@clair.local', extensions.crypt('local-password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"서지훈"}'::jsonb, now(), now()),
  ('49110000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'manager@clair.local', extensions.crypt('local-password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"임유진"}'::jsonb, now(), now()),
  ('49110000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'vet-cheongdam@clair.local', extensions.crypt('local-password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"이수지"}'::jsonb, now(), now()),
  ('49110000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'tech-cheongdam@clair.local', extensions.crypt('local-password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"송하윤"}'::jsonb, now(), now()),
  ('49110000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'desk-cheongdam@clair.local', extensions.crypt('local-password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"최유나"}'::jsonb, now(), now()),
  ('49110000-0000-4000-8000-000000000006', 'authenticated', 'authenticated', 'vet-doyun@clair.local', extensions.crypt('local-password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"김도윤"}'::jsonb, now(), now()),
  ('49110000-0000-4000-8000-000000000007', 'authenticated', 'authenticated', 'vet-seoyeon@clair.local', extensions.crypt('local-password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"박서연"}'::jsonb, now(), now()),
  ('49110000-0000-4000-8000-000000000008', 'authenticated', 'authenticated', 'vet-minjae@clair.local', extensions.crypt('local-password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"정민재"}'::jsonb, now(), now()),
  ('49110000-0000-4000-8000-000000000009', 'authenticated', 'authenticated', 'tech-harin@clair.local', extensions.crypt('local-password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"최하린"}'::jsonb, now(), now()),
  ('49110000-0000-4000-8000-000000000010', 'authenticated', 'authenticated', 'vet-jihoon@clair.local', extensions.crypt('local-password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"오지훈"}'::jsonb, now(), now()),
  ('49110000-0000-4000-8000-000000000011', 'authenticated', 'authenticated', 'vet-gayeon@clair.local', extensions.crypt('local-password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"한가연"}'::jsonb, now(), now()),
  ('49110000-0000-4000-8000-000000000012', 'authenticated', 'authenticated', 'desk-taeo@clair.local', extensions.crypt('local-password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"윤태오"}'::jsonb, now(), now()),
  ('49110000-0000-4000-8000-000000000013', 'authenticated', 'authenticated', 'tech-eunseo@clair.local', extensions.crypt('local-password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"문은서"}'::jsonb, now(), now()),
  ('49110000-0000-4000-8000-000000000014', 'authenticated', 'authenticated', 'desk-jaewon@clair.local', extensions.crypt('local-password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"서재원"}'::jsonb, now(), now())
on conflict (id) do update
set
  email = excluded.email,
  encrypted_password = excluded.encrypted_password,
  email_confirmed_at = excluded.email_confirmed_at,
  raw_app_meta_data = excluded.raw_app_meta_data,
  raw_user_meta_data = excluded.raw_user_meta_data,
  updated_at = now();

insert into auth.identities (
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
select
  seeded.id::text,
  seeded.id,
  jsonb_build_object(
    'sub', seeded.id::text,
    'email', seeded.email,
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  now(),
  now(),
  now()
from (
  values
    ('49110000-0000-4000-8000-000000000001'::uuid, 'owner@clair.local'),
    ('49110000-0000-4000-8000-000000000002'::uuid, 'manager@clair.local'),
    ('49110000-0000-4000-8000-000000000003'::uuid, 'vet-cheongdam@clair.local'),
    ('49110000-0000-4000-8000-000000000004'::uuid, 'tech-cheongdam@clair.local'),
    ('49110000-0000-4000-8000-000000000005'::uuid, 'desk-cheongdam@clair.local'),
    ('49110000-0000-4000-8000-000000000006'::uuid, 'vet-doyun@clair.local'),
    ('49110000-0000-4000-8000-000000000007'::uuid, 'vet-seoyeon@clair.local'),
    ('49110000-0000-4000-8000-000000000008'::uuid, 'vet-minjae@clair.local'),
    ('49110000-0000-4000-8000-000000000009'::uuid, 'tech-harin@clair.local'),
    ('49110000-0000-4000-8000-000000000010'::uuid, 'vet-jihoon@clair.local'),
    ('49110000-0000-4000-8000-000000000011'::uuid, 'vet-gayeon@clair.local'),
    ('49110000-0000-4000-8000-000000000012'::uuid, 'desk-taeo@clair.local'),
    ('49110000-0000-4000-8000-000000000013'::uuid, 'tech-eunseo@clair.local'),
    ('49110000-0000-4000-8000-000000000014'::uuid, 'desk-jaewon@clair.local')
) as seeded(id, email)
on conflict (provider_id, provider) do update
set
  user_id = excluded.user_id,
  identity_data = excluded.identity_data,
  updated_at = now();

update auth.users
set
  instance_id = '00000000-0000-0000-0000-000000000000'::uuid,
  confirmation_token = coalesce(confirmation_token, ''),
  recovery_token = coalesce(recovery_token, ''),
  email_change = coalesce(email_change, ''),
  email_change_token_new = coalesce(email_change_token_new, ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  reauthentication_token = coalesce(reauthentication_token, ''),
  phone_change = coalesce(phone_change, ''),
  phone_change_token = coalesce(phone_change_token, ''),
  updated_at = now()
where id in (
  '49110000-0000-4000-8000-000000000001',
  '49110000-0000-4000-8000-000000000002',
  '49110000-0000-4000-8000-000000000003',
  '49110000-0000-4000-8000-000000000004',
  '49110000-0000-4000-8000-000000000005',
  '49110000-0000-4000-8000-000000000006',
  '49110000-0000-4000-8000-000000000007',
  '49110000-0000-4000-8000-000000000008',
  '49110000-0000-4000-8000-000000000009',
  '49110000-0000-4000-8000-000000000010',
  '49110000-0000-4000-8000-000000000011',
  '49110000-0000-4000-8000-000000000012',
  '49110000-0000-4000-8000-000000000013',
  '49110000-0000-4000-8000-000000000014'
);

insert into public.users (id, display_name, initial, email, phone, status)
values
  ('49110000-0000-4000-8000-000000000001', '서지훈', '서', 'owner@clair.local', '010-4910-0001', 'active'),
  ('49110000-0000-4000-8000-000000000002', '임유진', '임', 'manager@clair.local', '010-4910-0002', 'active'),
  ('49110000-0000-4000-8000-000000000003', '이수지', '이', 'vet-cheongdam@clair.local', '010-4910-0003', 'active'),
  ('49110000-0000-4000-8000-000000000004', '송하윤', '송', 'tech-cheongdam@clair.local', '010-4910-0004', 'active'),
  ('49110000-0000-4000-8000-000000000005', '최유나', '최', 'desk-cheongdam@clair.local', '010-4910-0005', 'active'),
  ('49110000-0000-4000-8000-000000000006', '김도윤', '김', 'vet-doyun@clair.local', '010-4910-0006', 'active'),
  ('49110000-0000-4000-8000-000000000007', '박서연', '박', 'vet-seoyeon@clair.local', '010-4910-0007', 'active'),
  ('49110000-0000-4000-8000-000000000008', '정민재', '정', 'vet-minjae@clair.local', '010-4910-0008', 'active'),
  ('49110000-0000-4000-8000-000000000009', '최하린', '최', 'tech-harin@clair.local', '010-4910-0009', 'active'),
  ('49110000-0000-4000-8000-000000000010', '오지훈', '오', 'vet-jihoon@clair.local', '010-4910-0010', 'active'),
  ('49110000-0000-4000-8000-000000000011', '한가연', '한', 'vet-gayeon@clair.local', '010-4910-0011', 'active'),
  ('49110000-0000-4000-8000-000000000012', '윤태오', '윤', 'desk-taeo@clair.local', '010-4910-0012', 'active'),
  ('49110000-0000-4000-8000-000000000013', '문은서', '문', 'tech-eunseo@clair.local', '010-4910-0013', 'active'),
  ('49110000-0000-4000-8000-000000000014', '서재원', '서', 'desk-jaewon@clair.local', '010-4910-0014', 'active')
on conflict (id) do update
set
  display_name = excluded.display_name,
  initial = excluded.initial,
  email = excluded.email,
  phone = excluded.phone,
  status = excluded.status,
  updated_at = now();

with seeded_workspaces(workspace_id) as (
  values
    ('clair-demo'),
    ('workspace-clair-cheongdam')
),
default_permission_roles(role_key, label, role_type, permissions, sort_order) as (
  values
    ('owner', '소유자', 'owner', '{"allowed":["*"]}'::jsonb, 10),
    ('admin', '관리자', 'admin', '{"allowed":["reception:view","reception:create","reception:update","patient:view","patient:create","patient:update","encounter:view","encounter:create","encounter:update","chart:view","chart:update","order:view","order:request","order:update","dispensing:view","dispensing:complete","lab:view","lab:complete","imaging:view","imaging:complete","billing:view","billing:issue","service_catalog:view","service_catalog:manage","role_permission:view","role_permission:manage"]}'::jsonb, 20),
    ('general', '일반', 'standard', '{"allowed":["reception:view","reception:create","reception:update","patient:view","patient:create","patient:update","encounter:view","encounter:create","encounter:update","chart:view","chart:update","order:view","order:request","order:update","dispensing:view","dispensing:complete","lab:view","lab:complete","imaging:view","imaging:complete","billing:view","billing:issue","service_catalog:view"]}'::jsonb, 30)
)
insert into public.workspace_permission_roles (
  workspace_id,
  role_key,
  label,
  role_type,
  permissions,
  is_system,
  is_assignable,
  sort_order
)
select
  workspace.workspace_id,
  role.role_key,
  role.label,
  role.role_type,
  role.permissions,
  true,
  true,
  role.sort_order
from seeded_workspaces workspace
cross join default_permission_roles role
on conflict (workspace_id, role_key) do update
set
  label = excluded.label,
  role_type = excluded.role_type,
  permissions = excluded.permissions,
  is_system = true,
  is_assignable = true,
  sort_order = excluded.sort_order,
  updated_at = now();

with seeded_workspaces(workspace_id) as (
  values
    ('clair-demo'),
    ('workspace-clair-cheongdam')
),
default_job_positions(position_key, label, sort_order) as (
  values
    ('hospital_director', '병원장', 10),
    ('veterinarian', '수의사', 20),
    ('technician', '테크니션', 30),
    ('front_desk', '데스크', 40)
)
insert into public.workspace_job_positions (
  workspace_id,
  position_key,
  label,
  is_system,
  is_active,
  sort_order
)
select
  workspace.workspace_id,
  position.position_key,
  position.label,
  true,
  true,
  position.sort_order
from seeded_workspaces workspace
cross join default_job_positions position
on conflict (workspace_id, position_key) do update
set
  label = excluded.label,
  is_system = true,
  is_active = true,
  sort_order = excluded.sort_order,
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
  ('49100000-0000-4000-8000-000000000001', 'workspace-clair-cheongdam', '00000000-0000-4000-8000-000000000001', array['hospital_admin'], '운영', '병원장', 'active', now()),
  ('49111000-0000-4000-8000-000000000001', 'workspace-clair-cheongdam', '49110000-0000-4000-8000-000000000001', array['hospital_admin'], '진료', '병원장', 'active', now()),
  ('49111000-0000-4000-8000-000000000002', 'workspace-clair-cheongdam', '49110000-0000-4000-8000-000000000002', array['hospital_admin'], '운영', '데스크', 'active', now()),
  ('49111000-0000-4000-8000-000000000003', 'workspace-clair-cheongdam', '49110000-0000-4000-8000-000000000003', array['vet'], '진료', '수의사', 'active', now()),
  ('49111000-0000-4000-8000-000000000004', 'workspace-clair-cheongdam', '49110000-0000-4000-8000-000000000004', array['technician'], '진료지원', '테크니션', 'active', now()),
  ('49111000-0000-4000-8000-000000000005', 'workspace-clair-cheongdam', '49110000-0000-4000-8000-000000000005', array['front_desk'], '고객응대', '데스크', 'active', now()),
  ('49111000-0000-4000-8000-000000000006', 'workspace-clair-cheongdam', '49110000-0000-4000-8000-000000000006', array['vet'], '진료', '수의사', 'active', now()),
  ('49111000-0000-4000-8000-000000000007', 'workspace-clair-cheongdam', '49110000-0000-4000-8000-000000000007', array['vet'], '진료', '수의사', 'active', now()),
  ('49111000-0000-4000-8000-000000000008', 'workspace-clair-cheongdam', '49110000-0000-4000-8000-000000000008', array['vet'], '진료', '수의사', 'active', now()),
  ('49111000-0000-4000-8000-000000000009', 'workspace-clair-cheongdam', '49110000-0000-4000-8000-000000000009', array['technician'], '진료지원', '테크니션', 'active', now()),
  ('49111000-0000-4000-8000-000000000010', 'workspace-clair-cheongdam', '49110000-0000-4000-8000-000000000010', array['vet'], '진료', '수의사', 'active', now()),
  ('49111000-0000-4000-8000-000000000011', 'workspace-clair-cheongdam', '49110000-0000-4000-8000-000000000011', array['vet'], '진료', '수의사', 'active', now()),
  ('49111000-0000-4000-8000-000000000012', 'workspace-clair-cheongdam', '49110000-0000-4000-8000-000000000012', array['front_desk'], '고객응대', '데스크', 'active', now()),
  ('49111000-0000-4000-8000-000000000013', 'workspace-clair-cheongdam', '49110000-0000-4000-8000-000000000013', array['technician'], '진료지원', '테크니션', 'active', now()),
  ('49111000-0000-4000-8000-000000000014', 'workspace-clair-cheongdam', '49110000-0000-4000-8000-000000000014', array['front_desk'], '고객응대', '데스크', 'active', now())
on conflict (workspace_id, user_id) do update
set
  roles = excluded.roles,
  department = excluded.department,
  title = excluded.title,
  status = excluded.status,
  activated_at = excluded.activated_at,
  updated_at = now();

with seeded(membership_id, workspace_id, permission_role_key, job_position_key, assigned_by_user_id) as (
  values
    ('10000000-0000-4000-8000-000000000001', 'clair-demo', 'owner', 'hospital_director', '00000000-0000-4000-8000-000000000001'),
    ('10000000-0000-4000-8000-000000000002', 'clair-demo', 'general', 'veterinarian', '00000000-0000-4000-8000-000000000001'),
    ('10000000-0000-4000-8000-000000000003', 'clair-demo', 'general', 'technician', '00000000-0000-4000-8000-000000000001'),
    ('10000000-0000-4000-8000-000000000004', 'clair-demo', 'general', 'front_desk', '00000000-0000-4000-8000-000000000001'),
    ('49100000-0000-4000-8000-000000000001', 'workspace-clair-cheongdam', 'owner', 'hospital_director', '00000000-0000-4000-8000-000000000001'),
    ('49111000-0000-4000-8000-000000000001', 'workspace-clair-cheongdam', 'owner', 'hospital_director', '49110000-0000-4000-8000-000000000001'),
    ('49111000-0000-4000-8000-000000000002', 'workspace-clair-cheongdam', 'admin', 'front_desk', '49110000-0000-4000-8000-000000000001'),
    ('49111000-0000-4000-8000-000000000003', 'workspace-clair-cheongdam', 'general', 'veterinarian', '49110000-0000-4000-8000-000000000001'),
    ('49111000-0000-4000-8000-000000000004', 'workspace-clair-cheongdam', 'general', 'technician', '49110000-0000-4000-8000-000000000001'),
    ('49111000-0000-4000-8000-000000000005', 'workspace-clair-cheongdam', 'general', 'front_desk', '49110000-0000-4000-8000-000000000001'),
    ('49111000-0000-4000-8000-000000000006', 'workspace-clair-cheongdam', 'general', 'veterinarian', '49110000-0000-4000-8000-000000000001'),
    ('49111000-0000-4000-8000-000000000007', 'workspace-clair-cheongdam', 'general', 'veterinarian', '49110000-0000-4000-8000-000000000001'),
    ('49111000-0000-4000-8000-000000000008', 'workspace-clair-cheongdam', 'general', 'veterinarian', '49110000-0000-4000-8000-000000000001'),
    ('49111000-0000-4000-8000-000000000009', 'workspace-clair-cheongdam', 'general', 'technician', '49110000-0000-4000-8000-000000000001'),
    ('49111000-0000-4000-8000-000000000010', 'workspace-clair-cheongdam', 'general', 'veterinarian', '49110000-0000-4000-8000-000000000001'),
    ('49111000-0000-4000-8000-000000000011', 'workspace-clair-cheongdam', 'general', 'veterinarian', '49110000-0000-4000-8000-000000000001'),
    ('49111000-0000-4000-8000-000000000012', 'workspace-clair-cheongdam', 'general', 'front_desk', '49110000-0000-4000-8000-000000000001'),
    ('49111000-0000-4000-8000-000000000013', 'workspace-clair-cheongdam', 'general', 'technician', '49110000-0000-4000-8000-000000000001'),
    ('49111000-0000-4000-8000-000000000014', 'workspace-clair-cheongdam', 'general', 'front_desk', '49110000-0000-4000-8000-000000000001')
)
insert into public.workspace_membership_permission_role_assignments (
  workspace_id,
  membership_id,
  permission_role_id,
  assigned_by_user_id,
  assigned_at
)
select
  seeded.workspace_id,
  seeded.membership_id::uuid,
  role.id,
  seeded.assigned_by_user_id::uuid,
  now()
from seeded
join public.workspace_permission_roles role
  on role.workspace_id = seeded.workspace_id
  and role.role_key = seeded.permission_role_key
on conflict (membership_id) do update
set
  workspace_id = excluded.workspace_id,
  permission_role_id = excluded.permission_role_id,
  assigned_by_user_id = excluded.assigned_by_user_id,
  updated_at = now();

with seeded(membership_id, workspace_id, permission_role_key, job_position_key, assigned_by_user_id) as (
  values
    ('10000000-0000-4000-8000-000000000001', 'clair-demo', 'owner', 'hospital_director', '00000000-0000-4000-8000-000000000001'),
    ('10000000-0000-4000-8000-000000000002', 'clair-demo', 'general', 'veterinarian', '00000000-0000-4000-8000-000000000001'),
    ('10000000-0000-4000-8000-000000000003', 'clair-demo', 'general', 'technician', '00000000-0000-4000-8000-000000000001'),
    ('10000000-0000-4000-8000-000000000004', 'clair-demo', 'general', 'front_desk', '00000000-0000-4000-8000-000000000001'),
    ('49100000-0000-4000-8000-000000000001', 'workspace-clair-cheongdam', 'owner', 'hospital_director', '00000000-0000-4000-8000-000000000001'),
    ('49111000-0000-4000-8000-000000000001', 'workspace-clair-cheongdam', 'owner', 'hospital_director', '49110000-0000-4000-8000-000000000001'),
    ('49111000-0000-4000-8000-000000000002', 'workspace-clair-cheongdam', 'admin', 'front_desk', '49110000-0000-4000-8000-000000000001'),
    ('49111000-0000-4000-8000-000000000003', 'workspace-clair-cheongdam', 'general', 'veterinarian', '49110000-0000-4000-8000-000000000001'),
    ('49111000-0000-4000-8000-000000000004', 'workspace-clair-cheongdam', 'general', 'technician', '49110000-0000-4000-8000-000000000001'),
    ('49111000-0000-4000-8000-000000000005', 'workspace-clair-cheongdam', 'general', 'front_desk', '49110000-0000-4000-8000-000000000001'),
    ('49111000-0000-4000-8000-000000000006', 'workspace-clair-cheongdam', 'general', 'veterinarian', '49110000-0000-4000-8000-000000000001'),
    ('49111000-0000-4000-8000-000000000007', 'workspace-clair-cheongdam', 'general', 'veterinarian', '49110000-0000-4000-8000-000000000001'),
    ('49111000-0000-4000-8000-000000000008', 'workspace-clair-cheongdam', 'general', 'veterinarian', '49110000-0000-4000-8000-000000000001'),
    ('49111000-0000-4000-8000-000000000009', 'workspace-clair-cheongdam', 'general', 'technician', '49110000-0000-4000-8000-000000000001'),
    ('49111000-0000-4000-8000-000000000010', 'workspace-clair-cheongdam', 'general', 'veterinarian', '49110000-0000-4000-8000-000000000001'),
    ('49111000-0000-4000-8000-000000000011', 'workspace-clair-cheongdam', 'general', 'veterinarian', '49110000-0000-4000-8000-000000000001'),
    ('49111000-0000-4000-8000-000000000012', 'workspace-clair-cheongdam', 'general', 'front_desk', '49110000-0000-4000-8000-000000000001'),
    ('49111000-0000-4000-8000-000000000013', 'workspace-clair-cheongdam', 'general', 'technician', '49110000-0000-4000-8000-000000000001'),
    ('49111000-0000-4000-8000-000000000014', 'workspace-clair-cheongdam', 'general', 'front_desk', '49110000-0000-4000-8000-000000000001')
)
insert into public.workspace_membership_job_position_assignments (
  workspace_id,
  membership_id,
  job_position_id,
  assigned_by_user_id,
  assigned_at
)
select
  seeded.workspace_id,
  seeded.membership_id::uuid,
  position.id,
  seeded.assigned_by_user_id::uuid,
  now()
from seeded
join public.workspace_job_positions position
  on position.workspace_id = seeded.workspace_id
  and position.position_key = seeded.job_position_key
on conflict (membership_id) do update
set
  workspace_id = excluded.workspace_id,
  job_position_id = excluded.job_position_id,
  assigned_by_user_id = excluded.assigned_by_user_id,
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
    'workspace-clair-cheongdam',
    'Hospital admin full access',
    'role',
    'hospital_admin',
    '{"allowed":["*"]}'::jsonb
  ),
  (
    'workspace-clair-cheongdam',
    'Veterinarian MVP access',
    'role',
    'vet',
    '{"allowed":["reception:view","patient:view","encounter:view","chart:view","chart:update","order:create","order:update","dispensing:view","lab:view","imaging:view","billing:view"]}'::jsonb
  ),
  (
    'workspace-clair-cheongdam',
    'Technician MVP access',
    'role',
    'technician',
    '{"allowed":["reception:view","patient:view","encounter:view","chart:view","order:update","dispensing:view","dispensing:complete","lab:view","lab:update","imaging:view","imaging:update"]}'::jsonb
  ),
  (
    'workspace-clair-cheongdam',
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

-- DEN-56: reception domain synthetic seed contract.
-- Uses local-only synthetic data. Do not replace with production guardian, patient, or clinic data.

select 'reception_domain_seed_contract_version:2026-05-19-den-56' as reception_domain_seed_contract_version;

insert into public.guardians (
  id,
  workspace_id,
  name,
  mobile_phone,
  mobile_phone_normalized,
  email,
  memo
)
values (
  '20000000-0000-4000-8000-000000000001',
  'clair-demo',
  '로컬보호자',
  '010-1111-2222',
  '01011112222',
  'guardian.reception.seed@example.test',
  'DEN-56 synthetic guardian fixture'
)
on conflict (id) do update
set
  name = excluded.name,
  mobile_phone = excluded.mobile_phone,
  mobile_phone_normalized = excluded.mobile_phone_normalized,
  email = excluded.email,
  memo = excluded.memo,
  updated_at = now();

insert into public.patients (
  id,
  workspace_id,
  patient_no,
  name,
  species,
  breed,
  birth_date,
  sex,
  neutered,
  microchip_no,
  patient_registration_no,
  handling_caution_locked,
  status
)
values (
  '21000000-0000-4000-8000-000000000001',
  'clair-demo',
  'P-SEED-0001',
  '로컬환자',
  'dog',
  'Mixed',
  '2021-01-01',
  'female',
  true,
  '999000000000001',
  'REG-SEED-0001',
  true,
  'active'
)
on conflict (id) do update
set
  patient_no = excluded.patient_no,
  name = excluded.name,
  species = excluded.species,
  breed = excluded.breed,
  birth_date = excluded.birth_date,
  sex = excluded.sex,
  neutered = excluded.neutered,
  microchip_no = excluded.microchip_no,
  patient_registration_no = excluded.patient_registration_no,
  handling_caution_locked = excluded.handling_caution_locked,
  status = excluded.status,
  updated_at = now();

insert into public.patient_guardians (
  id,
  workspace_id,
  patient_id,
  guardian_id,
  relationship,
  is_primary,
  can_receive_messages
)
values (
  '22000000-0000-4000-8000-000000000001',
  'clair-demo',
  '21000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  'primary',
  true,
  true
)
on conflict (patient_id, guardian_id) do update
set
  relationship = excluded.relationship,
  is_primary = excluded.is_primary,
  can_receive_messages = excluded.can_receive_messages;

insert into public.consents (
  id,
  workspace_id,
  guardian_id,
  patient_id,
  consent_type,
  status,
  signed_at,
  document_url
)
values
  (
    '23000000-0000-4000-8000-000000000001',
    'clair-demo',
    '20000000-0000-4000-8000-000000000001',
    '21000000-0000-4000-8000-000000000001',
    'privacy',
    'granted',
    now(),
    '/mock-documents/session-consents/den-56-privacy.pdf'
  ),
  (
    '23000000-0000-4000-8000-000000000002',
    'clair-demo',
    '20000000-0000-4000-8000-000000000001',
    '21000000-0000-4000-8000-000000000001',
    'messaging',
    'granted',
    now(),
    '/mock-documents/session-consents/den-56-messaging.pdf'
  )
on conflict (id) do nothing;

insert into public.appointments (
  id,
  workspace_id,
  patient_id,
  guardian_id,
  assigned_veterinarian_id,
  scheduled_start_at,
  scheduled_end_at,
  visit_purpose,
  symptom_note,
  status,
  created_by_user_id
)
values (
  '24000000-0000-4000-8000-000000000001',
  'clair-demo',
  '21000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '2026-05-19T10:00:00+09:00',
  '2026-05-19T10:30:00+09:00',
  'DEN-56 synthetic appointment',
  'Synthetic appointment check-in fixture',
  'confirmed',
  '00000000-0000-4000-8000-000000000004'
)
on conflict (id) do update
set
  assigned_veterinarian_id = excluded.assigned_veterinarian_id,
  scheduled_start_at = excluded.scheduled_start_at,
  scheduled_end_at = excluded.scheduled_end_at,
  visit_purpose = excluded.visit_purpose,
  symptom_note = excluded.symptom_note,
  status = excluded.status,
  updated_at = now();

insert into public.encounters (
  id,
  workspace_id,
  patient_id,
  guardian_id,
  appointment_id,
  primary_veterinarian_id,
  encounter_no,
  reception_type,
  department,
  duration_minutes,
  chief_complaint,
  visit_purpose,
  reception_memo,
  status,
  checked_in_at,
  checked_in_by_user_id
)
values (
  '26000000-0000-4000-8000-000000000001',
  'clair-demo',
  '21000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  null,
  '00000000-0000-4000-8000-000000000002',
  'E-SEED-0001',
  'walk_in',
  '진료',
  30,
  'Synthetic walk-in chief complaint',
  'DEN-56 synthetic walk-in',
  'DEN-56 synthetic reception memo',
  'waiting',
  '2026-05-19T09:30:00+09:00',
  '00000000-0000-4000-8000-000000000004'
)
on conflict (id) do update
set
  primary_veterinarian_id = excluded.primary_veterinarian_id,
  encounter_no = excluded.encounter_no,
  reception_type = excluded.reception_type,
  department = excluded.department,
  duration_minutes = excluded.duration_minutes,
  chief_complaint = excluded.chief_complaint,
  visit_purpose = excluded.visit_purpose,
  reception_memo = excluded.reception_memo,
  status = excluded.status,
  checked_in_at = excluded.checked_in_at,
  checked_in_by_user_id = excluded.checked_in_by_user_id,
  updated_at = now();

insert into public.waiting_queue_entries (
  id,
  workspace_id,
  encounter_id,
  queue_type,
  status,
  priority,
  sort_order,
  entered_at
)
values (
  '27000000-0000-4000-8000-000000000001',
  'clair-demo',
  '26000000-0000-4000-8000-000000000001',
  'consultation',
  'waiting',
  'normal',
  1,
  '2026-05-19T09:30:00+09:00'
)
on conflict (encounter_id, queue_type) do update
set
  status = excluded.status,
  priority = excluded.priority,
  sort_order = excluded.sort_order,
  entered_at = excluded.entered_at;

-- DEN-68: clinical/order/billing synthetic seed contract.
-- Local-only portfolio fixture. Do not replace with production client, patient, or clinic data.

select 'clinical_billing_seed_contract_version:2026-05-19-den-68' as clinical_billing_seed_contract_version;

insert into public.service_categories (
  id,
  workspace_id,
  parent_id,
  name,
  sort_order
)
values (
  '28000000-0000-4000-8000-000000000001',
  'clair-demo',
  null,
  'DEN-68 synthetic clinical orders',
  10
)
on conflict (id) do update
set
  name = excluded.name,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.service_items (
  id,
  workspace_id,
  category_id,
  name,
  item_type,
  description,
  default_duration_minutes,
  is_orderable,
  is_billable,
  is_active
)
values (
  '29000000-0000-4000-8000-000000000001',
  'clair-demo',
  '28000000-0000-4000-8000-000000000001',
  'DEN-68 CBC synthetic order',
  'lab',
  'Synthetic Project 04 service item used for chart/order/billing persistence tests.',
  20,
  true,
  true,
  true
)
on conflict (id) do update
set
  category_id = excluded.category_id,
  name = excluded.name,
  item_type = excluded.item_type,
  description = excluded.description,
  default_duration_minutes = excluded.default_duration_minutes,
  is_orderable = excluded.is_orderable,
  is_billable = excluded.is_billable,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.service_item_prices (
  id,
  workspace_id,
  service_item_id,
  price,
  currency,
  effective_from,
  effective_to
)
values (
  '29100000-0000-4000-8000-000000000001',
  'clair-demo',
  '29000000-0000-4000-8000-000000000001',
  35000.00,
  'KRW',
  '2026-05-19',
  null
)
on conflict (id) do update
set
  service_item_id = excluded.service_item_id,
  price = excluded.price,
  currency = excluded.currency,
  effective_from = excluded.effective_from,
  effective_to = excluded.effective_to;

-- DEMO-DB-PR-002: order catalog and order set seed foundation.
-- Synthetic local/dev demo rows only. These rows mirror DEN-194 service item
-- prices so chart search and hospital-admin catalog reads can prove DB-backed
-- catalog/set presence without UI rewiring.

insert into public.order_catalog_items (
  id,
  workspace_id,
  standard_order_id,
  source_preset_version,
  initial_imported_preset_version,
  last_auto_merged_preset_version,
  customization_state,
  customized_fields,
  preset_merge_status,
  category_group,
  category_label,
  t_code,
  t_code_label,
  standard_order_name,
  in_hospital_order_name,
  billing_name,
  aliases,
  availability_status,
  price_krw,
  sales_unit,
  target_species,
  default_destination_module,
  default_task_required,
  billing_reflection_enabled,
  care_guide,
  care_guide_delivery_enabled,
  internal_instruction,
  internal_instruction_delivery_enabled,
  tax_included,
  rounding_rule,
  pricing_rule,
  medication_metadata,
  vaccine_metadata
)
values
  ('den194-catalog-cbc', 'clair-demo', 'den194-std-cbc', 'demo-db-pr-002', 'demo-db-pr-002', 'demo-db-pr-002', 'unmodified', array[]::text[], 'current', 'lab', 'DEN-194 lab', 'T04', 'Lab', 'DEN-194 CBC synthetic panel', 'DEN-194 CBC kong-vomit', 'DEN-194 CBC kong-vomit billing', array['cbc', 'kong-vomit', 'lab'], 'active', 35000, 'per_order', array['dog', 'cat', 'other'], 'lab', true, true, 'Synthetic care guide for CBC demo order.', true, 'Route to DEN-194 Lab Tech queue after confirmation.', true, true, 'as_is', '{"priceBasis":"fixed_order_price","linkedServiceItemId":"19429000-0000-4000-8000-000000000001","linkedSeedOrderIds":["19429500-0000-4000-8000-000000000001"],"synthetic":true}'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('den194-catalog-abdomen-ultrasound', 'clair-demo', 'den194-std-abdomen-ultrasound', 'demo-db-pr-002', 'demo-db-pr-002', 'demo-db-pr-002', 'unmodified', array[]::text[], 'current', 'imaging', 'DEN-194 imaging', 'T05', 'Imaging', 'DEN-194 Abdominal ultrasound synthetic', 'DEN-194 abdomen ultrasound kong-vomit', 'DEN-194 abdomen ultrasound billing', array['ultrasound', 'abdomen', 'kong-vomit'], 'active', 65000, 'per_order', array['dog', 'cat', 'other'], 'imaging', true, true, 'Synthetic care guide for abdomen ultrasound demo order.', true, 'Route to DEN-194 Imaging Tech queue after confirmation.', true, true, 'as_is', '{"priceBasis":"fixed_order_price","linkedServiceItemId":"19429000-0000-4000-8000-000000000002","linkedSeedOrderIds":["19429500-0000-4000-8000-000000000002"],"synthetic":true}'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('den194-catalog-fluid-therapy', 'clair-demo', 'den194-std-fluid-therapy', 'demo-db-pr-002', 'demo-db-pr-002', 'demo-db-pr-002', 'unmodified', array[]::text[], 'current', 'treatment', 'DEN-194 treatment', 'T03', 'Treatment', 'DEN-194 Fluid therapy synthetic', 'DEN-194 fluid therapy kong-vomit', 'DEN-194 fluid therapy billing', array['fluid', 'iv', 'kong-vomit'], 'active', 28000, 'per_order', array['dog', 'cat', 'other'], 'treatment', true, true, 'Synthetic care guide for fluid therapy demo order.', true, 'Route to DEN-194 Treatment Tech queue after confirmation.', true, true, 'as_is', '{"priceBasis":"fixed_order_price","linkedServiceItemId":"19429000-0000-4000-8000-000000000003","linkedSeedOrderIds":["19429500-0000-4000-8000-000000000003"],"synthetic":true}'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('den194-catalog-maropitant', 'clair-demo', 'den194-std-maropitant', 'demo-db-pr-002', 'demo-db-pr-002', 'demo-db-pr-002', 'unmodified', array[]::text[], 'current', 'medication', 'DEN-194 dispensing', 'T02', 'Dispensing', 'DEN-194 Maropitant dispensing synthetic', 'DEN-194 maropitant dispensing kong-vomit', 'DEN-194 maropitant dispensing billing', array['maropitant', 'dispensing', 'allergy medication'], 'active', 28500, 'per_order', array['dog', 'cat', 'other'], 'dispensing', true, true, 'Synthetic care guide for dispensing demo order.', false, 'Synthetic medication handoff note. No real prescription guidance.', true, true, 'as_is', '{"priceBasis":"fixed_order_price","linkedServiceItemId":"19429000-0000-4000-8000-000000000004","linkedSeedOrderIds":["19429500-0000-4000-8000-000000000004","19429500-0000-4000-8000-000000000008"],"synthetic":true}'::jsonb, '{"form":"synthetic tablet","route":"demo","controlledSubstance":false}'::jsonb, '{}'::jsonb),
  ('den194-catalog-urinalysis', 'clair-demo', 'den194-std-urinalysis', 'demo-db-pr-002', 'demo-db-pr-002', 'demo-db-pr-002', 'unmodified', array[]::text[], 'current', 'lab', 'DEN-194 lab', 'T04', 'Lab', 'DEN-194 Urinalysis synthetic', 'DEN-194 urinalysis nabi-urinary', 'DEN-194 urinalysis billing', array['urinalysis', 'nabi-urinary', 'lab'], 'active', 30000, 'per_order', array['cat', 'dog'], 'lab', true, true, 'Synthetic care guide for urinalysis demo order.', true, 'Route to DEN-194 Lab Tech queue after confirmation.', true, true, 'as_is', '{"priceBasis":"fixed_order_price","linkedServiceItemId":"19429000-0000-4000-8000-000000000005","linkedSeedOrderIds":["19429500-0000-4000-8000-000000000005"],"synthetic":true}'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('den194-catalog-xray', 'clair-demo', 'den194-std-xray', 'demo-db-pr-002', 'demo-db-pr-002', 'demo-db-pr-002', 'unmodified', array[]::text[], 'current', 'imaging', 'DEN-194 imaging', 'T05', 'Imaging', 'DEN-194 X-ray synthetic', 'DEN-194 X-ray synthetic', 'DEN-194 X-ray billing', array['x-ray', 'radiograph', 'nabi-urinary', 'choco-rehab'], 'active', 55000, 'per_order', array['dog', 'cat'], 'imaging', true, true, 'Synthetic care guide for X-ray demo order.', true, 'Route to DEN-194 Imaging Tech queue after confirmation.', true, true, 'as_is', '{"priceBasis":"fixed_order_price","linkedServiceItemId":"19429000-0000-4000-8000-000000000006","linkedSeedOrderIds":["19429500-0000-4000-8000-000000000006","19429500-0000-4000-8000-000000000010"],"synthetic":true}'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('den194-catalog-ear-cleaning', 'clair-demo', 'den194-std-ear-cleaning', 'demo-db-pr-002', 'demo-db-pr-002', 'demo-db-pr-002', 'unmodified', array[]::text[], 'current', 'treatment', 'DEN-194 treatment', 'T03', 'Treatment', 'DEN-194 Ear cleaning synthetic', 'DEN-194 ear cleaning bori-allergy', 'DEN-194 ear cleaning billing', array['ear cleaning', 'bori-allergy', 'treatment'], 'active', 22000, 'per_order', array['dog', 'cat'], 'treatment', true, true, 'Synthetic care guide for ear cleaning demo order.', false, 'Synthetic treatment handoff note.', true, true, 'as_is', '{"priceBasis":"fixed_order_price","linkedServiceItemId":"19429000-0000-4000-8000-000000000007","linkedSeedOrderIds":["19429500-0000-4000-8000-000000000007"],"synthetic":true}'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('den194-catalog-wellness-vaccine', 'clair-demo', 'den194-std-wellness-vaccine', 'demo-db-pr-002', 'demo-db-pr-002', 'demo-db-pr-002', 'unmodified', array[]::text[], 'current', 'treatment', 'DEN-194 wellness', 'T06', 'Wellness', 'DEN-194 Vaccine synthetic', 'DEN-194 wellness vaccine mango', 'DEN-194 wellness vaccine billing', array['vaccine', 'wellness', 'mango-wellness'], 'active', 45000, 'per_order', array['dog'], 'treatment', true, true, 'Synthetic wellness care guide. Not a clinical recommendation.', true, 'Synthetic preventive workflow handoff note.', true, true, 'as_is', '{"priceBasis":"fixed_order_price","linkedServiceItemId":"19429000-0000-4000-8000-000000000008","linkedSeedOrderIds":["19429500-0000-4000-8000-000000000009"],"synthetic":true}'::jsonb, '{}'::jsonb, '{"vaccineTarget":"dog","vaccineClassification":"demo_wellness","doseSequenceEnabled":true,"doseSequenceLabel":"synthetic annual","doseSequenceNumber":1}'::jsonb),
  ('den194-catalog-rehab-consult', 'clair-demo', 'den194-std-rehab-consult', 'demo-db-pr-002', 'demo-db-pr-002', 'demo-db-pr-002', 'unmodified', array[]::text[], 'current', 'treatment', 'DEN-194 rehab', 'T03', 'Treatment', 'DEN-194 Rehab consult synthetic', 'DEN-194 rehab plan choco', 'DEN-194 rehab plan billing', array['rehab', 'choco-rehab', 'treatment'], 'active', 60000, 'per_order', array['dog'], 'treatment', true, true, 'Synthetic rehab follow-up guide.', true, 'Synthetic pending rehab work handoff note.', true, true, 'as_is', '{"priceBasis":"fixed_order_price","linkedServiceItemId":"19429000-0000-4000-8000-000000000009","linkedSeedOrderIds":["19429500-0000-4000-8000-000000000011"],"synthetic":true}'::jsonb, '{}'::jsonb, '{}'::jsonb)
on conflict (id) do update
set
  standard_order_id = excluded.standard_order_id,
  source_preset_version = excluded.source_preset_version,
  initial_imported_preset_version = excluded.initial_imported_preset_version,
  last_auto_merged_preset_version = excluded.last_auto_merged_preset_version,
  customization_state = excluded.customization_state,
  customized_fields = excluded.customized_fields,
  preset_merge_status = excluded.preset_merge_status,
  category_group = excluded.category_group,
  category_label = excluded.category_label,
  t_code = excluded.t_code,
  t_code_label = excluded.t_code_label,
  standard_order_name = excluded.standard_order_name,
  in_hospital_order_name = excluded.in_hospital_order_name,
  billing_name = excluded.billing_name,
  aliases = excluded.aliases,
  availability_status = excluded.availability_status,
  price_krw = excluded.price_krw,
  sales_unit = excluded.sales_unit,
  target_species = excluded.target_species,
  default_destination_module = excluded.default_destination_module,
  default_task_required = excluded.default_task_required,
  billing_reflection_enabled = excluded.billing_reflection_enabled,
  care_guide = excluded.care_guide,
  care_guide_delivery_enabled = excluded.care_guide_delivery_enabled,
  internal_instruction = excluded.internal_instruction,
  internal_instruction_delivery_enabled = excluded.internal_instruction_delivery_enabled,
  tax_included = excluded.tax_included,
  rounding_rule = excluded.rounding_rule,
  pricing_rule = excluded.pricing_rule,
  medication_metadata = excluded.medication_metadata,
  vaccine_metadata = excluded.vaccine_metadata,
  updated_at = now();

-- DEMO-DB-PR-004: lab result-sheet catalog seed foundation.
-- Synthetic CBC and urinalysis result fields only; no clinical reference ranges or real result values.
insert into public.lab_test_categories (
  id,
  workspace_id,
  category_name,
  sort_order
)
values
  ('den194-labcat-hematology', 'clair-demo', 'Hematology', 10),
  ('den194-labcat-urinalysis', 'clair-demo', 'Urinalysis', 20)
on conflict (id) do update
set
  category_name = excluded.category_name,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.lab_test_items (
  id,
  workspace_id,
  category_id,
  test_item_name,
  result_input_type,
  result_unit,
  sort_order,
  availability_status,
  saved_result_usage_count
)
values
  ('den194-labitem-cbc-wbc', 'clair-demo', 'den194-labcat-hematology', 'WBC', 'number', '10^3/uL', 10, 'active', 0),
  ('den194-labitem-cbc-rbc', 'clair-demo', 'den194-labcat-hematology', 'RBC', 'number', '10^6/uL', 20, 'active', 0),
  ('den194-labitem-cbc-hct', 'clair-demo', 'den194-labcat-hematology', 'HCT', 'number', '%', 30, 'active', 0),
  ('den194-labitem-cbc-plt', 'clair-demo', 'den194-labcat-hematology', 'Platelets', 'number', '10^3/uL', 40, 'active', 0),
  ('den194-labitem-ua-protein', 'clair-demo', 'den194-labcat-urinalysis', 'Protein', 'grade', null, 10, 'active', 0),
  ('den194-labitem-ua-ketones', 'clair-demo', 'den194-labcat-urinalysis', 'Ketones', 'positive_negative', null, 20, 'active', 0),
  ('den194-labitem-ua-specific-gravity', 'clair-demo', 'den194-labcat-urinalysis', 'Specific gravity', 'number', null, 30, 'active', 0),
  ('den194-labitem-ua-ph', 'clair-demo', 'den194-labcat-urinalysis', 'pH', 'number', null, 40, 'active', 0)
on conflict (id) do update
set
  category_id = excluded.category_id,
  test_item_name = excluded.test_item_name,
  result_input_type = excluded.result_input_type,
  result_unit = excluded.result_unit,
  sort_order = excluded.sort_order,
  availability_status = excluded.availability_status,
  saved_result_usage_count = excluded.saved_result_usage_count,
  updated_at = now();

insert into public.order_catalog_lab_test_item_links (
  id,
  workspace_id,
  order_catalog_item_id,
  lab_test_item_id,
  lab_test_category_id,
  sort_order,
  snapshot_metadata
)
values
  ('den194-lablink-cbc-wbc', 'clair-demo', 'den194-catalog-cbc', 'den194-labitem-cbc-wbc', null, 10, '{"resultSheet":"cbc","scenarioCodes":["kong-vomit"],"synthetic":true}'::jsonb),
  ('den194-lablink-cbc-rbc', 'clair-demo', 'den194-catalog-cbc', 'den194-labitem-cbc-rbc', null, 20, '{"resultSheet":"cbc","scenarioCodes":["kong-vomit"],"synthetic":true}'::jsonb),
  ('den194-lablink-cbc-hct', 'clair-demo', 'den194-catalog-cbc', 'den194-labitem-cbc-hct', null, 30, '{"resultSheet":"cbc","scenarioCodes":["kong-vomit"],"synthetic":true}'::jsonb),
  ('den194-lablink-cbc-plt', 'clair-demo', 'den194-catalog-cbc', 'den194-labitem-cbc-plt', null, 40, '{"resultSheet":"cbc","scenarioCodes":["kong-vomit"],"synthetic":true}'::jsonb),
  ('den194-lablink-ua-protein', 'clair-demo', 'den194-catalog-urinalysis', 'den194-labitem-ua-protein', null, 10, '{"resultSheet":"urinalysis","scenarioCodes":["nabi-urinary"],"synthetic":true}'::jsonb),
  ('den194-lablink-ua-ketones', 'clair-demo', 'den194-catalog-urinalysis', 'den194-labitem-ua-ketones', null, 20, '{"resultSheet":"urinalysis","scenarioCodes":["nabi-urinary"],"synthetic":true}'::jsonb),
  ('den194-lablink-ua-specific-gravity', 'clair-demo', 'den194-catalog-urinalysis', 'den194-labitem-ua-specific-gravity', null, 30, '{"resultSheet":"urinalysis","scenarioCodes":["nabi-urinary"],"synthetic":true}'::jsonb),
  ('den194-lablink-ua-ph', 'clair-demo', 'den194-catalog-urinalysis', 'den194-labitem-ua-ph', null, 40, '{"resultSheet":"urinalysis","scenarioCodes":["nabi-urinary"],"synthetic":true}'::jsonb)
on conflict (id) do update
set
  order_catalog_item_id = excluded.order_catalog_item_id,
  lab_test_item_id = excluded.lab_test_item_id,
  lab_test_category_id = excluded.lab_test_category_id,
  sort_order = excluded.sort_order,
  snapshot_metadata = excluded.snapshot_metadata;

insert into public.order_sets (
  id,
  workspace_id,
  source_set_version,
  set_category,
  set_name,
  billing_name,
  availability_status,
  amount_basis,
  set_price_krw,
  sales_unit,
  billing_reflection_enabled,
  target_species,
  care_guide,
  internal_instruction
)
values
  ('den194-set-kong-vomit-compact', 'clair-demo', 'demo-db-pr-002', 'DEN-194 outpatient compact set', 'DEN-194 Kong vomiting compact set', 'DEN-194 Kong vomiting compact set billing', 'active', 'included_order_sum', 0, 'per_each', true, array['dog', 'cat', 'other'], 'Synthetic compact set for Kong vomiting outpatient demo.', 'Expands CBC, ultrasound, fluid therapy, and dispensing catalog rows.'),
  ('den194-set-mango-wellness-compact', 'clair-demo', 'demo-db-pr-002', 'DEN-194 wellness compact set', 'DEN-194 Mango wellness compact set', 'DEN-194 Mango wellness compact set billing', 'active', 'included_order_sum', 0, 'per_each', true, array['dog'], 'Synthetic compact set for Mango wellness/preventive demo.', 'Expands the synthetic wellness vaccine catalog row.')
on conflict (id) do update
set
  source_set_version = excluded.source_set_version,
  set_category = excluded.set_category,
  set_name = excluded.set_name,
  billing_name = excluded.billing_name,
  availability_status = excluded.availability_status,
  amount_basis = excluded.amount_basis,
  set_price_krw = excluded.set_price_krw,
  sales_unit = excluded.sales_unit,
  billing_reflection_enabled = excluded.billing_reflection_enabled,
  target_species = excluded.target_species,
  care_guide = excluded.care_guide,
  internal_instruction = excluded.internal_instruction,
  updated_at = now();

insert into public.order_set_items (
  id,
  workspace_id,
  order_set_id,
  child_order_id,
  sort_order,
  default_selected,
  billing_reflection_default,
  default_quantity,
  quantity_source,
  unit_price_snapshot_krw
)
values
  ('den194-setitem-kong-cbc', 'clair-demo', 'den194-set-kong-vomit-compact', 'den194-catalog-cbc', 10, true, true, 1, 'fixed_one', 35000),
  ('den194-setitem-kong-ultrasound', 'clair-demo', 'den194-set-kong-vomit-compact', 'den194-catalog-abdomen-ultrasound', 20, true, true, 1, 'fixed_one', 65000),
  ('den194-setitem-kong-fluid', 'clair-demo', 'den194-set-kong-vomit-compact', 'den194-catalog-fluid-therapy', 30, true, true, 1, 'fixed_one', 28000),
  ('den194-setitem-kong-maropitant', 'clair-demo', 'den194-set-kong-vomit-compact', 'den194-catalog-maropitant', 40, true, true, 1, 'fixed_one', 28500),
  ('den194-setitem-mango-vaccine', 'clair-demo', 'den194-set-mango-wellness-compact', 'den194-catalog-wellness-vaccine', 10, true, true, 1, 'fixed_one', 45000)
on conflict (id) do update
set
  order_set_id = excluded.order_set_id,
  child_order_id = excluded.child_order_id,
  sort_order = excluded.sort_order,
  default_selected = excluded.default_selected,
  billing_reflection_default = excluded.billing_reflection_default,
  default_quantity = excluded.default_quantity,
  quantity_source = excluded.quantity_source,
  unit_price_snapshot_krw = excluded.unit_price_snapshot_krw;

insert into public.soap_notes (
  id,
  workspace_id,
  encounter_id,
  author_user_id,
  subjective,
  objective,
  assessment,
  plan,
  status,
  autosaved_at
)
values (
  '29200000-0000-4000-8000-000000000001',
  'clair-demo',
  '26000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  'Synthetic subjective note for DEN-68.',
  'Synthetic objective note for DEN-68.',
  'Synthetic assessment note for DEN-68.',
  'Synthetic plan note for DEN-68.',
  'autosaved',
  now()
)
on conflict (id) do update
set
  subjective = excluded.subjective,
  objective = excluded.objective,
  assessment = excluded.assessment,
  plan = excluded.plan,
  status = excluded.status,
  autosaved_at = excluded.autosaved_at,
  updated_at = now();

insert into public.diagnoses (
  id,
  workspace_id,
  encounter_id,
  diagnosis_catalog_id,
  diagnosis_text,
  diagnosis_type,
  is_primary,
  sort_order,
  created_by_user_id,
  updated_by_user_id
)
values (
  '29300000-0000-4000-8000-000000000001',
  'clair-demo',
  '26000000-0000-4000-8000-000000000001',
  null,
  'DEN-68 synthetic diagnosis',
  'suspected',
  true,
  1,
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000002'
)
on conflict (id) do update
set
  diagnosis_text = excluded.diagnosis_text,
  diagnosis_type = excluded.diagnosis_type,
  is_primary = excluded.is_primary,
  sort_order = excluded.sort_order,
  updated_by_user_id = excluded.updated_by_user_id,
  updated_at = now();

insert into public.order_groups (
  id,
  workspace_id,
  encounter_id,
  group_type,
  title,
  label,
  status,
  priority,
  sort_order,
  created_by_user_id
)
values (
  '29400000-0000-4000-8000-000000000001',
  'clair-demo',
  '26000000-0000-4000-8000-000000000001',
  'lab',
  'DEN-68 synthetic lab order group',
  'Project 04 synthetic',
  'requested',
  'normal',
  1,
  '00000000-0000-4000-8000-000000000002'
)
on conflict (id) do update
set
  title = excluded.title,
  label = excluded.label,
  status = excluded.status,
  priority = excluded.priority,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.orders (
  id,
  workspace_id,
  encounter_id,
  order_group_id,
  service_item_id,
  order_type,
  display_name,
  billing_display_name,
  status,
  work_status,
  priority,
  quantity,
  unit_price_snapshot,
  requested_by_user_id,
  requested_at,
  confirmed_by_user_id,
  confirmed_at,
  instruction,
  sort_order
)
values (
  '29500000-0000-4000-8000-000000000001',
  'clair-demo',
  '26000000-0000-4000-8000-000000000001',
  '29400000-0000-4000-8000-000000000001',
  '29000000-0000-4000-8000-000000000001',
  'lab',
  'DEN-68 synthetic CBC order',
  'DEN-68 synthetic CBC billing line',
  'ready_for_billing',
  'pending',
  'normal',
  1,
  35000.00,
  '00000000-0000-4000-8000-000000000002',
  now(),
  '00000000-0000-4000-8000-000000000002',
  now(),
  'Synthetic Project 04 order fixture.',
  1
)
on conflict (id) do update
set
  order_group_id = excluded.order_group_id,
  service_item_id = excluded.service_item_id,
  display_name = excluded.display_name,
  billing_display_name = excluded.billing_display_name,
  status = excluded.status,
  work_status = excluded.work_status,
  priority = excluded.priority,
  quantity = excluded.quantity,
  unit_price_snapshot = excluded.unit_price_snapshot,
  confirmed_by_user_id = excluded.confirmed_by_user_id,
  confirmed_at = excluded.confirmed_at,
  instruction = excluded.instruction,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.invoices (
  id,
  workspace_id,
  encounter_id,
  guardian_id,
  invoice_no,
  status,
  payment_state,
  selected_payment_method,
  unpaid_reason,
  subtotal_amount,
  discount_amount,
  tax_amount,
  total_amount,
  issued_by_user_id,
  issued_at
)
values (
  '29600000-0000-4000-8000-000000000001',
  'clair-demo',
  '26000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  'INV-DEN68-0001',
  'issued',
  'unpaid',
  null,
  'Synthetic unpaid state for Project 04 fixture.',
  35000.00,
  0.00,
  0.00,
  35000.00,
  '00000000-0000-4000-8000-000000000004',
  now()
)
on conflict (id) do update
set
  invoice_no = excluded.invoice_no,
  status = excluded.status,
  payment_state = excluded.payment_state,
  unpaid_reason = excluded.unpaid_reason,
  subtotal_amount = excluded.subtotal_amount,
  discount_amount = excluded.discount_amount,
  tax_amount = excluded.tax_amount,
  total_amount = excluded.total_amount,
  issued_by_user_id = excluded.issued_by_user_id,
  issued_at = excluded.issued_at,
  updated_at = now();

insert into public.invoice_lines (
  id,
  workspace_id,
  invoice_id,
  service_item_id,
  order_id,
  description,
  quantity,
  unit_price,
  discount_amount
)
values (
  '29700000-0000-4000-8000-000000000001',
  'clair-demo',
  '29600000-0000-4000-8000-000000000001',
  '29000000-0000-4000-8000-000000000001',
  '29500000-0000-4000-8000-000000000001',
  'DEN-68 synthetic CBC invoice line',
  1,
  35000.00,
  0.00
)
on conflict (id) do update
set
  service_item_id = excluded.service_item_id,
  order_id = excluded.order_id,
  description = excluded.description,
  quantity = excluded.quantity,
  unit_price = excluded.unit_price,
  discount_amount = excluded.discount_amount,
  updated_at = now();

-- DEN-105: customer management synthetic seed contract.
-- Uses local-only portfolio fixture values and masked placeholders.

select 'customer_management_seed_contract_version:2026-05-20-den-105' as customer_management_seed_contract_version;

update public.guardians
set
  guardian_code = 'C-SEED-0001',
  additional_phone_numbers = '["010-1111-3333"]'::jsonb,
  postal_code = '06000',
  address_line1 = 'Synthetic Cheongdam demo address',
  address_line2 = 'Synthetic suite 101',
  email_local_part = 'guardian.reception.seed',
  email_domain_mode = 'direct_input',
  email_domain = 'example.test',
  cash_receipt_type = 'personal_income_deduction',
  cash_receipt_number = 'cash-receipt-demo-placeholder',
  resident_registration_number_masked = '900101-1******',
  resident_registration_number_token = 'masked-demo-rrn-token',
  vehicle_number = 'DEMO-1234',
  status = 'active',
  last_updated_by_user_id = '00000000-0000-4000-8000-000000000004',
  updated_at = now()
where id = '20000000-0000-4000-8000-000000000001';

update public.patients
set
  primary_breed_id = 'breed-demo-mixed',
  primary_breed_name = 'Mixed',
  is_mixed_breed = true,
  additional_breed_ids = '["breed-demo-poodle"]'::jsonb,
  estimated_age_years = 5,
  estimated_age_months = 4,
  estimated_age_days = 0,
  age_is_estimated = true,
  weight_kg = 6.20,
  color = 'Synthetic cream',
  microchip_type = 'internal',
  profile_memo = 'DEN-105 synthetic customer profile memo.',
  primary_attending_vet_id = '00000000-0000-4000-8000-000000000002',
  message_consent_status = 'granted',
  kakao_patient_code = 'KAKAO-DEMO-PATIENT-001',
  last_updated_by_user_id = '00000000-0000-4000-8000-000000000004',
  updated_at = now()
where id = '21000000-0000-4000-8000-000000000001';

update public.patient_guardians
set
  relationship_label = 'primary',
  message_consent_status = 'granted',
  guardian_phone_available = true,
  sort_order = 0,
  linked_by_user_id = '00000000-0000-4000-8000-000000000004',
  updated_at = now()
where id = '22000000-0000-4000-8000-000000000001';

update public.consents
set
  source_surface = 'guardian_registration',
  document_version = 'customer-profile-demo-v1',
  consented_at = coalesce(consented_at, signed_at, now()),
  updated_at = now()
where guardian_id = '20000000-0000-4000-8000-000000000001';

insert into public.guardian_referral_sources (
  id,
  workspace_id,
  guardian_id,
  source_type,
  source_other_text
)
values
  (
    '31000000-0000-4000-8000-000000000001',
    'clair-demo',
    '20000000-0000-4000-8000-000000000001',
    'homepage',
    null
  ),
  (
    '31000000-0000-4000-8000-000000000002',
    'clair-demo',
    '20000000-0000-4000-8000-000000000001',
    'referral',
    null
  )
on conflict (workspace_id, guardian_id, source_type) do update
set
  source_other_text = excluded.source_other_text,
  updated_at = now();

insert into public.patient_staff_assignments (
  id,
  workspace_id,
  patient_id,
  staff_id,
  staff_display_name,
  department_label,
  assignment_role,
  sort_order,
  is_active
)
values (
  '32000000-0000-4000-8000-000000000001',
  'clair-demo',
  '21000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '이수지',
  'Internal medicine demo',
  'primary',
  0,
  true
)
on conflict (id) do update
set
  staff_id = excluded.staff_id,
  staff_display_name = excluded.staff_display_name,
  department_label = excluded.department_label,
  assignment_role = excluded.assignment_role,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = now();

-- DEN-197: synthetic role and tenant isolation fixtures.
-- Staging replay fixture only. Do not replace with production tenant, identity, or staff data.

select 'role_tenant_audit_isolation_seed_contract_version:2026-05-21-den-197' as role_tenant_audit_isolation_seed_contract_version;

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
  ('00000000-0000-4000-8000-000000000012', 'authenticated', 'authenticated', 'foreign-admin@clair.local', extensions.crypt('local-password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"DEN-197 Foreign Admin"}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-000000000013', 'authenticated', 'authenticated', 'inactive-front-desk@clair.local', extensions.crypt('local-password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"DEN-197 Inactive Front Desk"}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-000000000014', 'authenticated', 'authenticated', 'no-membership@clair.local', extensions.crypt('local-password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"DEN-197 No Membership Actor"}'::jsonb, now(), now())
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
  ('00000000-0000-4000-8000-000000000012', 'DEN-197 Foreign Admin', 'FA', 'foreign-admin@clair.local', '010-1970-0012', 'active'),
  ('00000000-0000-4000-8000-000000000013', 'DEN-197 Inactive Front Desk', 'IF', 'inactive-front-desk@clair.local', '010-1970-0013', 'active'),
  ('00000000-0000-4000-8000-000000000014', 'DEN-197 No Membership Actor', 'NM', 'no-membership@clair.local', '010-1970-0014', 'active')
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
  'clair-foreign-demo',
  'CLAiR Foreign Isolation Hospital',
  'active',
  '00000000-0000-4000-8000-000000000012'
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
  activated_at,
  deactivated_at
)
values
  ('10000000-0000-4000-8000-000000000012', 'clair-foreign-demo', '00000000-0000-4000-8000-000000000012', array['hospital_admin'], 'Foreign Ops', 'DEN-197 Foreign Hospital Admin', 'active', now(), null),
  ('10000000-0000-4000-8000-000000000013', 'clair-demo', '00000000-0000-4000-8000-000000000013', array['front_desk'], 'Reception Desk', 'DEN-197 Inactive Front Desk', 'inactive', null, now())
on conflict (workspace_id, user_id) do update
set
  roles = excluded.roles,
  department = excluded.department,
  title = excluded.title,
  status = excluded.status,
  activated_at = excluded.activated_at,
  deactivated_at = excluded.deactivated_at,
  updated_at = now();

insert into public.permission_policies (
  workspace_id,
  name,
  scope,
  target_role,
  permissions
)
values (
  'clair-foreign-demo',
  'DEN-197 foreign admin full access',
  'role',
  'hospital_admin',
  '{"allowed":["*"]}'::jsonb
)
on conflict (workspace_id, target_role) where scope = 'role' do update
set
  name = excluded.name,
  permissions = excluded.permissions,
  updated_at = now();

insert into public.customer_profile_change_logs (
  id,
  workspace_id,
  subject_type,
  subject_id,
  change_type,
  changed_by_user_id,
  before_value,
  after_value,
  reason
)
values (
  '33000000-0000-4000-8000-000000000001',
  'clair-demo',
  'guardian',
  '20000000-0000-4000-8000-000000000001',
  'update',
  '00000000-0000-4000-8000-000000000004',
  '{}'::jsonb,
  '{"guardianCode":"C-SEED-0001","cashReceipt":"masked"}'::jsonb,
  'DEN-105 synthetic customer profile seed'
)
on conflict (id) do update
set
  changed_by_user_id = excluded.changed_by_user_id,
  before_value = excluded.before_value,
  after_value = excluded.after_value,
  reason = excluded.reason;

-- DEN-194: synthetic medium hospital staging seed contract.
-- Staging replay fixture only. Do not replace with production clinic, staff, guardian, patient, or billing data.

select 'synthetic_medium_hospital_seed_contract_version:2026-05-21-den-194' as synthetic_medium_hospital_seed_contract_version;

update public.workspaces
set
  display_name = 'CLAiR Medium Animal Hospital',
  updated_at = now()
where id = 'clair-demo';

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
  ('00000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'vet2@clair.local', extensions.crypt('local-password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"DEN-194 Vet Internal"}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-000000000006', 'authenticated', 'authenticated', 'vet3@clair.local', extensions.crypt('local-password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"DEN-194 Vet Surgery"}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-000000000007', 'authenticated', 'authenticated', 'tech2@clair.local', extensions.crypt('local-password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"DEN-194 Lab Tech"}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-000000000008', 'authenticated', 'authenticated', 'tech3@clair.local', extensions.crypt('local-password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"DEN-194 Imaging Tech"}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-000000000009', 'authenticated', 'authenticated', 'tech4@clair.local', extensions.crypt('local-password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"DEN-194 Treatment Tech"}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-000000000010', 'authenticated', 'authenticated', 'front-desk2@clair.local', extensions.crypt('local-password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"DEN-194 Reception Billing"}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-000000000011', 'authenticated', 'authenticated', 'front-desk3@clair.local', extensions.crypt('local-password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"DEN-194 Reception Triage"}'::jsonb, now(), now())
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
  ('00000000-0000-4000-8000-000000000005', 'DEN-194 Vet Internal', 'VI', 'vet2@clair.local', '010-1940-0005', 'active'),
  ('00000000-0000-4000-8000-000000000006', 'DEN-194 Vet Surgery', 'VS', 'vet3@clair.local', '010-1940-0006', 'active'),
  ('00000000-0000-4000-8000-000000000007', 'DEN-194 Lab Tech', 'LT', 'tech2@clair.local', '010-1940-0007', 'active'),
  ('00000000-0000-4000-8000-000000000008', 'DEN-194 Imaging Tech', 'IT', 'tech3@clair.local', '010-1940-0008', 'active'),
  ('00000000-0000-4000-8000-000000000009', 'DEN-194 Treatment Tech', 'TT', 'tech4@clair.local', '010-1940-0009', 'active'),
  ('00000000-0000-4000-8000-000000000010', 'DEN-194 Reception Billing', 'RB', 'front-desk2@clair.local', '010-1940-0010', 'active'),
  ('00000000-0000-4000-8000-000000000011', 'DEN-194 Reception Triage', 'RT', 'front-desk3@clair.local', '010-1940-0011', 'active')
on conflict (id) do update
set
  display_name = excluded.display_name,
  initial = excluded.initial,
  email = excluded.email,
  phone = excluded.phone,
  status = excluded.status,
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
  ('10000000-0000-4000-8000-000000000005', 'clair-demo', '00000000-0000-4000-8000-000000000005', array['vet'], 'Internal Medicine', 'DEN-194 Internal Veterinarian', 'active', now()),
  ('10000000-0000-4000-8000-000000000006', 'clair-demo', '00000000-0000-4000-8000-000000000006', array['vet'], 'Surgery Rehab', 'DEN-194 Surgery Veterinarian', 'active', now()),
  ('10000000-0000-4000-8000-000000000007', 'clair-demo', '00000000-0000-4000-8000-000000000007', array['technician'], 'Lab', 'DEN-194 Lab Technician', 'active', now()),
  ('10000000-0000-4000-8000-000000000008', 'clair-demo', '00000000-0000-4000-8000-000000000008', array['technician'], 'Imaging', 'DEN-194 Imaging Technician', 'active', now()),
  ('10000000-0000-4000-8000-000000000009', 'clair-demo', '00000000-0000-4000-8000-000000000009', array['technician'], 'Treatment', 'DEN-194 Treatment Technician', 'active', now()),
  ('10000000-0000-4000-8000-000000000010', 'clair-demo', '00000000-0000-4000-8000-000000000010', array['front_desk'], 'Billing Desk', 'DEN-194 Billing Desk', 'active', now()),
  ('10000000-0000-4000-8000-000000000011', 'clair-demo', '00000000-0000-4000-8000-000000000011', array['front_desk'], 'Reception Desk', 'DEN-194 Triage Desk', 'active', now())
on conflict (workspace_id, user_id) do update
set
  roles = excluded.roles,
  department = excluded.department,
  title = excluded.title,
  status = excluded.status,
  activated_at = excluded.activated_at,
  updated_at = now();

-- DEN-200: Supabase Auth email identities for synthetic login smoke.
-- Password login requires an email identity row in addition to auth.users.
insert into auth.identities (
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
select
  synthetic_users.id::text,
  synthetic_users.id,
  jsonb_build_object(
    'sub', synthetic_users.id::text,
    'email', synthetic_users.email,
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  now(),
  now(),
  now()
from (
  values
    ('00000000-0000-4000-8000-000000000001'::uuid, 'admin@clair.local'),
    ('00000000-0000-4000-8000-000000000002'::uuid, 'vet@clair.local'),
    ('00000000-0000-4000-8000-000000000003'::uuid, 'technician@clair.local'),
    ('00000000-0000-4000-8000-000000000004'::uuid, 'front-desk@clair.local'),
    ('00000000-0000-4000-8000-000000000005'::uuid, 'vet2@clair.local'),
    ('00000000-0000-4000-8000-000000000006'::uuid, 'vet3@clair.local'),
    ('00000000-0000-4000-8000-000000000007'::uuid, 'tech2@clair.local'),
    ('00000000-0000-4000-8000-000000000008'::uuid, 'tech3@clair.local'),
    ('00000000-0000-4000-8000-000000000009'::uuid, 'tech4@clair.local'),
    ('00000000-0000-4000-8000-000000000010'::uuid, 'front-desk2@clair.local'),
    ('00000000-0000-4000-8000-000000000011'::uuid, 'front-desk3@clair.local'),
    ('00000000-0000-4000-8000-000000000012'::uuid, 'foreign-admin@clair.local'),
    ('00000000-0000-4000-8000-000000000013'::uuid, 'inactive-front-desk@clair.local'),
    ('00000000-0000-4000-8000-000000000014'::uuid, 'no-membership@clair.local')
) as synthetic_users(id, email)
on conflict (provider_id, provider) do update
set
  user_id = excluded.user_id,
  identity_data = excluded.identity_data,
  updated_at = now();

-- DEN-201: normalize synthetic Supabase Auth users for hosted password login.
-- Synthetic fixture-only repair. No real users, provider secrets, or production data.

update auth.users
set
  instance_id = '00000000-0000-0000-0000-000000000000'::uuid,
  confirmation_token = coalesce(confirmation_token, ''),
  recovery_token = coalesce(recovery_token, ''),
  email_change = coalesce(email_change, ''),
  email_change_token_new = coalesce(email_change_token_new, ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  phone_change = coalesce(phone_change, ''),
  phone_change_token = coalesce(phone_change_token, ''),
  reauthentication_token = coalesce(reauthentication_token, ''),
  is_sso_user = false,
  is_anonymous = false,
  updated_at = now()
where email in (
  'admin@clair.local',
  'vet@clair.local',
  'technician@clair.local',
  'front-desk@clair.local',
  'vet2@clair.local',
  'vet3@clair.local',
  'tech2@clair.local',
  'tech3@clair.local',
  'tech4@clair.local',
  'front-desk2@clair.local',
  'front-desk3@clair.local',
  'foreign-admin@clair.local',
  'inactive-front-desk@clair.local',
  'no-membership@clair.local'
);

insert into public.guardians (
  id,
  workspace_id,
  name,
  mobile_phone,
  mobile_phone_normalized,
  email,
  memo,
  guardian_code,
  additional_phone_numbers,
  postal_code,
  address_line1,
  address_line2,
  email_local_part,
  email_domain_mode,
  email_domain,
  cash_receipt_type,
  cash_receipt_number,
  resident_registration_number_masked,
  resident_registration_number_token,
  vehicle_number,
  status,
  last_updated_by_user_id
)
values
  ('19420000-0000-4000-8000-000000000001', 'clair-demo', 'DEN-194 Guardian 01', '010-1941-0001', '01019410001', 'guardian01@example.test', 'DEN-194 synthetic demo guardian. {"scenario_code":"kong-vomit"}', 'DEN-194-G-01', '["010-1942-0001"]'::jsonb, '19401', 'DEN-194 synthetic address 01', 'Demo suite 01', 'guardian01', 'direct_input', 'example.test', 'personal_income_deduction', 'cash-den194-01', '940101-1******', 'den194-masked-token-01', 'DEMO-194-01', 'active', '00000000-0000-4000-8000-000000000010'),
  ('19420000-0000-4000-8000-000000000002', 'clair-demo', 'DEN-194 Guardian 02', '010-1941-0002', '01019410002', 'guardian02@example.test', 'DEN-194 synthetic demo guardian. {"scenario_code":"nabi-urinary"}', 'DEN-194-G-02', '[]'::jsonb, '19402', 'DEN-194 synthetic address 02', 'Demo suite 02', 'guardian02', 'direct_input', 'example.test', 'none', null, '940102-2******', 'den194-masked-token-02', 'DEMO-194-02', 'active', '00000000-0000-4000-8000-000000000011'),
  ('19420000-0000-4000-8000-000000000003', 'clair-demo', 'DEN-194 Guardian 03', '010-1941-0003', '01019410003', 'guardian03@example.test', 'DEN-194 synthetic demo guardian. {"scenario_code":"bori-allergy"}', 'DEN-194-G-03', '[]'::jsonb, '19403', 'DEN-194 synthetic address 03', 'Demo suite 03', 'guardian03', 'direct_input', 'example.test', 'business_income_deduction', 'cash-den194-03', '940103-1******', 'den194-masked-token-03', 'DEMO-194-03', 'active', '00000000-0000-4000-8000-000000000004'),
  ('19420000-0000-4000-8000-000000000004', 'clair-demo', 'DEN-194 Guardian 04', '010-1941-0004', '01019410004', 'guardian04@example.test', 'DEN-194 synthetic demo guardian. {"scenario_code":"mango-wellness"}', 'DEN-194-G-04', '[]'::jsonb, '19404', 'DEN-194 synthetic address 04', 'Demo suite 04', 'guardian04', 'direct_input', 'example.test', 'none', null, '940104-2******', 'den194-masked-token-04', 'DEMO-194-04', 'active', '00000000-0000-4000-8000-000000000010'),
  ('19420000-0000-4000-8000-000000000005', 'clair-demo', 'DEN-194 Guardian 05', '010-1941-0005', '01019410005', 'guardian05@example.test', 'DEN-194 synthetic demo guardian. {"scenario_code":"choco-rehab"}', 'DEN-194-G-05', '[]'::jsonb, '19405', 'DEN-194 synthetic address 05', 'Demo suite 05', 'guardian05', 'direct_input', 'example.test', 'personal_income_deduction', 'cash-den194-05', '940105-1******', 'den194-masked-token-05', 'DEMO-194-05', 'active', '00000000-0000-4000-8000-000000000011'),
  ('19420000-0000-4000-8000-000000000006', 'clair-demo', 'DEN-194 Guardian 06', '010-1941-0006', '01019410006', 'guardian06@example.test', 'DEN-194 synthetic demo guardian duplicate review case.', 'DEN-194-G-06', '[]'::jsonb, '19406', 'DEN-194 synthetic address 06', 'Demo suite 06', 'guardian06', 'direct_input', 'example.test', 'none', null, '940106-2******', 'den194-masked-token-06', 'DEMO-194-06', 'active', '00000000-0000-4000-8000-000000000004'),
  ('19420000-0000-4000-8000-000000000007', 'clair-demo', 'DEN-194 Guardian 07', '010-1941-0007', '01019410007', 'guardian07@example.test', 'DEN-194 synthetic demo guardian multi-patient case.', 'DEN-194-G-07', '[]'::jsonb, '19407', 'DEN-194 synthetic address 07', 'Demo suite 07', 'guardian07', 'direct_input', 'example.test', 'none', null, '940107-1******', 'den194-masked-token-07', 'DEMO-194-07', 'active', '00000000-0000-4000-8000-000000000010'),
  ('19420000-0000-4000-8000-000000000008', 'clair-demo', 'DEN-194 Guardian 08', '010-1941-0008', '01019410008', 'guardian08@example.test', 'DEN-194 synthetic demo guardian.', 'DEN-194-G-08', '[]'::jsonb, '19408', 'DEN-194 synthetic address 08', 'Demo suite 08', 'guardian08', 'direct_input', 'example.test', 'none', null, '940108-2******', 'den194-masked-token-08', 'DEMO-194-08', 'active', '00000000-0000-4000-8000-000000000011'),
  ('19420000-0000-4000-8000-000000000009', 'clair-demo', 'DEN-194 Guardian 09', '010-1941-0009', '01019410009', 'guardian09@example.test', 'DEN-194 synthetic demo guardian.', 'DEN-194-G-09', '[]'::jsonb, '19409', 'DEN-194 synthetic address 09', 'Demo suite 09', 'guardian09', 'direct_input', 'example.test', 'none', null, '940109-1******', 'den194-masked-token-09', 'DEMO-194-09', 'active', '00000000-0000-4000-8000-000000000004'),
  ('19420000-0000-4000-8000-000000000010', 'clair-demo', 'DEN-194 Guardian 10', '010-1941-0010', '01019410010', 'guardian10@example.test', 'DEN-194 synthetic demo guardian.', 'DEN-194-G-10', '[]'::jsonb, '19410', 'DEN-194 synthetic address 10', 'Demo suite 10', 'guardian10', 'direct_input', 'example.test', 'none', null, '940110-2******', 'den194-masked-token-10', 'DEMO-194-10', 'active', '00000000-0000-4000-8000-000000000010'),
  ('19420000-0000-4000-8000-000000000011', 'clair-demo', 'DEN-194 Guardian 11', '010-1941-0011', '01019410011', 'guardian11@example.test', 'DEN-194 synthetic demo guardian.', 'DEN-194-G-11', '[]'::jsonb, '19411', 'DEN-194 synthetic address 11', 'Demo suite 11', 'guardian11', 'direct_input', 'example.test', 'none', null, '940111-1******', 'den194-masked-token-11', 'DEMO-194-11', 'active', '00000000-0000-4000-8000-000000000011'),
  ('19420000-0000-4000-8000-000000000012', 'clair-demo', 'DEN-194 Guardian 12', '010-1941-0012', '01019410012', 'guardian12@example.test', 'DEN-194 synthetic demo guardian.', 'DEN-194-G-12', '[]'::jsonb, '19412', 'DEN-194 synthetic address 12', 'Demo suite 12', 'guardian12', 'direct_input', 'example.test', 'none', null, '940112-2******', 'den194-masked-token-12', 'DEMO-194-12', 'active', '00000000-0000-4000-8000-000000000004')
on conflict (id) do update
set
  name = excluded.name,
  mobile_phone = excluded.mobile_phone,
  mobile_phone_normalized = excluded.mobile_phone_normalized,
  email = excluded.email,
  memo = excluded.memo,
  guardian_code = excluded.guardian_code,
  additional_phone_numbers = excluded.additional_phone_numbers,
  postal_code = excluded.postal_code,
  address_line1 = excluded.address_line1,
  address_line2 = excluded.address_line2,
  email_local_part = excluded.email_local_part,
  email_domain_mode = excluded.email_domain_mode,
  email_domain = excluded.email_domain,
  cash_receipt_type = excluded.cash_receipt_type,
  cash_receipt_number = excluded.cash_receipt_number,
  resident_registration_number_masked = excluded.resident_registration_number_masked,
  resident_registration_number_token = excluded.resident_registration_number_token,
  vehicle_number = excluded.vehicle_number,
  status = excluded.status,
  last_updated_by_user_id = excluded.last_updated_by_user_id,
  updated_at = now();

insert into public.patients (
  id,
  workspace_id,
  patient_no,
  name,
  species,
  breed,
  birth_date,
  sex,
  neutered,
  microchip_no,
  patient_registration_no,
  allergy_note,
  special_note,
  handling_caution_note,
  handling_caution_locked,
  status,
  primary_breed_id,
  primary_breed_name,
  is_mixed_breed,
  additional_breed_ids,
  estimated_age_years,
  estimated_age_months,
  estimated_age_days,
  age_is_estimated,
  weight_kg,
  color,
  microchip_type,
  profile_memo,
  primary_attending_vet_id,
  message_consent_status,
  kakao_patient_code,
  last_updated_by_user_id
)
values
  ('19421000-0000-4000-8000-000000000001', 'clair-demo', 'P-DEN194-01', 'Kong Synthetic', 'dog', 'Poodle mix', '2021-04-01', 'male', true, '194000000000001', 'REG-DEN194-01', 'Synthetic food sensitivity note', 'DEN-194 fixture id map: patient-kong / encounter-kong-260501 / invoice-kong-260501', 'Synthetic dehydration caution', true, 'active', 'breed-den194-poodle-mix', 'Poodle mix', true, '["breed-den194-small-dog"]'::jsonb, 5, 1, 0, true, 6.80, 'Apricot synthetic', 'internal', 'DEN-194 synthetic patient. {"scenario_code":"kong-vomit","mock_patient_id":"patient-kong"}', '00000000-0000-4000-8000-000000000005', 'granted', 'KAKAO-DEN194-01', '00000000-0000-4000-8000-000000000010'),
  ('19421000-0000-4000-8000-000000000002', 'clair-demo', 'P-DEN194-02', 'Nabi Synthetic', 'cat', 'Korean shorthair', '2020-08-11', 'female', true, '194000000000002', 'REG-DEN194-02', null, 'DEN-194 fixture id map: patient-nabi / encounter-nabi-urinary', 'Synthetic cat-friendly handling', true, 'active', 'breed-den194-ksh', 'Korean shorthair', false, '[]'::jsonb, 5, 9, 0, true, 4.20, 'Tabby synthetic', 'none', 'DEN-194 synthetic patient. {"scenario_code":"nabi-urinary"}', '00000000-0000-4000-8000-000000000002', 'granted', 'KAKAO-DEN194-02', '00000000-0000-4000-8000-000000000011'),
  ('19421000-0000-4000-8000-000000000003', 'clair-demo', 'P-DEN194-03', 'Bori Synthetic', 'dog', 'Maltese', '2019-12-09', 'female', true, '194000000000003', 'REG-DEN194-03', 'Synthetic suspected poultry allergy', 'DEN-194 skin allergy revisit fixture', 'Synthetic ear cleaning caution', true, 'active', 'breed-den194-maltese', 'Maltese', false, '[]'::jsonb, 6, 5, 0, true, 4.90, 'White synthetic', 'internal', 'DEN-194 synthetic patient. {"scenario_code":"bori-allergy"}', '00000000-0000-4000-8000-000000000005', 'granted', 'KAKAO-DEN194-03', '00000000-0000-4000-8000-000000000004'),
  ('19421000-0000-4000-8000-000000000004', 'clair-demo', 'P-DEN194-04', 'Mango Synthetic', 'dog', 'Golden retriever', '2023-05-15', 'male', false, '194000000000004', 'REG-DEN194-04', null, 'DEN-194 wellness vaccine fixture', null, true, 'active', 'breed-den194-golden', 'Golden retriever', false, '[]'::jsonb, 3, 0, 0, false, 24.50, 'Golden synthetic', 'internal', 'DEN-194 synthetic patient. {"scenario_code":"mango-wellness"}', '00000000-0000-4000-8000-000000000006', 'granted', 'KAKAO-DEN194-04', '00000000-0000-4000-8000-000000000010'),
  ('19421000-0000-4000-8000-000000000005', 'clair-demo', 'P-DEN194-05', 'Choco Synthetic', 'dog', 'Pomeranian', '2018-03-20', 'male', true, '194000000000005', 'REG-DEN194-05', null, 'DEN-194 patella rehab fixture', 'Synthetic stair restriction note', true, 'active', 'breed-den194-pomeranian', 'Pomeranian', false, '[]'::jsonb, 8, 2, 0, true, 3.40, 'Brown synthetic', 'internal', 'DEN-194 synthetic patient. {"scenario_code":"choco-rehab"}', '00000000-0000-4000-8000-000000000006', 'granted', 'KAKAO-DEN194-05', '00000000-0000-4000-8000-000000000011'),
  ('19421000-0000-4000-8000-000000000006', 'clair-demo', 'P-DEN194-06', 'Dubu Synthetic', 'cat', 'Persian mix', '2022-06-02', 'male', true, '194000000000006', 'REG-DEN194-06', null, 'DEN-194 secondary synthetic patient', null, true, 'active', 'breed-den194-persian-mix', 'Persian mix', true, '[]'::jsonb, 4, 0, 0, true, 4.80, 'Cream synthetic', 'none', 'DEN-194 synthetic patient.', '00000000-0000-4000-8000-000000000002', 'granted', 'KAKAO-DEN194-06', '00000000-0000-4000-8000-000000000004'),
  ('19421000-0000-4000-8000-000000000007', 'clair-demo', 'P-DEN194-07', 'Tori Synthetic', 'dog', 'Jindo mix', '2020-02-14', 'female', true, '194000000000007', 'REG-DEN194-07', null, 'DEN-194 duplicate name synthetic patient', null, true, 'active', 'breed-den194-jindo-mix', 'Jindo mix', true, '[]'::jsonb, 6, 3, 0, true, 15.70, 'Ivory synthetic', 'internal', 'DEN-194 synthetic patient.', '00000000-0000-4000-8000-000000000005', 'granted', 'KAKAO-DEN194-07', '00000000-0000-4000-8000-000000000010'),
  ('19421000-0000-4000-8000-000000000008', 'clair-demo', 'P-DEN194-08', 'Tori Synthetic Cat', 'cat', 'Russian blue', '2021-09-22', 'female', true, '194000000000008', 'REG-DEN194-08', null, 'DEN-194 same-name search synthetic patient', null, true, 'active', 'breed-den194-russian-blue', 'Russian blue', false, '[]'::jsonb, 4, 8, 0, true, 3.90, 'Blue synthetic', 'none', 'DEN-194 synthetic patient.', '00000000-0000-4000-8000-000000000002', 'granted', 'KAKAO-DEN194-08', '00000000-0000-4000-8000-000000000011'),
  ('19421000-0000-4000-8000-000000000009', 'clair-demo', 'P-DEN194-09', 'Soda Synthetic', 'dog', 'Beagle', '2021-11-30', 'male', true, '194000000000009', 'REG-DEN194-09', null, 'DEN-194 phone search synthetic patient', null, true, 'active', 'breed-den194-beagle', 'Beagle', false, '[]'::jsonb, 4, 6, 0, true, 10.30, 'Tri-color synthetic', 'internal', 'DEN-194 synthetic patient.', '00000000-0000-4000-8000-000000000005', 'granted', 'KAKAO-DEN194-09', '00000000-0000-4000-8000-000000000004'),
  ('19421000-0000-4000-8000-000000000010', 'clair-demo', 'P-DEN194-10', 'Luna Synthetic', 'cat', 'Siamese', '2017-01-08', 'female', true, '194000000000010', 'REG-DEN194-10', null, 'DEN-194 senior synthetic patient', 'Synthetic senior handling note', true, 'active', 'breed-den194-siamese', 'Siamese', false, '[]'::jsonb, 9, 4, 0, true, 4.10, 'Seal synthetic', 'none', 'DEN-194 synthetic patient.', '00000000-0000-4000-8000-000000000002', 'refused', 'KAKAO-DEN194-10', '00000000-0000-4000-8000-000000000010'),
  ('19421000-0000-4000-8000-000000000011', 'clair-demo', 'P-DEN194-11', 'Peanut Synthetic', 'rabbit', 'Mini rex', '2024-01-10', 'unknown', false, '194000000000011', 'REG-DEN194-11', null, 'DEN-194 exotic synthetic patient', null, true, 'active', 'breed-den194-mini-rex', 'Mini rex', false, '[]'::jsonb, 2, 4, 0, true, 1.80, 'Grey synthetic', 'none', 'DEN-194 synthetic patient.', '00000000-0000-4000-8000-000000000005', 'unknown', 'KAKAO-DEN194-11', '00000000-0000-4000-8000-000000000011'),
  ('19421000-0000-4000-8000-000000000012', 'clair-demo', 'P-DEN194-12', 'Latte Synthetic', 'dog', 'Shiba inu', '2022-12-24', 'female', true, '194000000000012', 'REG-DEN194-12', null, 'DEN-194 additional appointment synthetic patient', null, true, 'active', 'breed-den194-shiba', 'Shiba inu', false, '[]'::jsonb, 3, 5, 0, true, 8.70, 'Red synthetic', 'internal', 'DEN-194 synthetic patient.', '00000000-0000-4000-8000-000000000006', 'granted', 'KAKAO-DEN194-12', '00000000-0000-4000-8000-000000000004'),
  ('19421000-0000-4000-8000-000000000013', 'clair-demo', 'P-DEN194-13', 'Mochi Synthetic', 'cat', 'Munchkin', '2023-07-07', 'male', false, '194000000000013', 'REG-DEN194-13', null, 'DEN-194 reminder synthetic patient', null, true, 'active', 'breed-den194-munchkin', 'Munchkin', false, '[]'::jsonb, 2, 10, 0, true, 3.20, 'White synthetic', 'none', 'DEN-194 synthetic patient.', '00000000-0000-4000-8000-000000000002', 'granted', 'KAKAO-DEN194-13', '00000000-0000-4000-8000-000000000010'),
  ('19421000-0000-4000-8000-000000000014', 'clair-demo', 'P-DEN194-14', 'Ruby Synthetic', 'dog', 'Corgi', '2019-05-05', 'female', true, '194000000000014', 'REG-DEN194-14', null, 'DEN-194 recurrence synthetic patient', null, true, 'active', 'breed-den194-corgi', 'Corgi', false, '[]'::jsonb, 7, 0, 0, true, 11.50, 'Tan synthetic', 'internal', 'DEN-194 synthetic patient.', '00000000-0000-4000-8000-000000000006', 'granted', 'KAKAO-DEN194-14', '00000000-0000-4000-8000-000000000011'),
  ('19421000-0000-4000-8000-000000000015', 'clair-demo', 'P-DEN194-15', 'Sunny Synthetic', 'dog', 'Welsh terrier', '2020-10-18', 'male', true, '194000000000015', 'REG-DEN194-15', null, 'DEN-194 boarding consult synthetic patient', null, true, 'active', 'breed-den194-welsh-terrier', 'Welsh terrier', false, '[]'::jsonb, 5, 7, 0, true, 9.60, 'Black tan synthetic', 'internal', 'DEN-194 synthetic patient.', '00000000-0000-4000-8000-000000000005', 'granted', 'KAKAO-DEN194-15', '00000000-0000-4000-8000-000000000004')
on conflict (id) do update
set
  patient_no = excluded.patient_no,
  name = excluded.name,
  species = excluded.species,
  breed = excluded.breed,
  birth_date = excluded.birth_date,
  sex = excluded.sex,
  neutered = excluded.neutered,
  microchip_no = excluded.microchip_no,
  patient_registration_no = excluded.patient_registration_no,
  allergy_note = excluded.allergy_note,
  special_note = excluded.special_note,
  handling_caution_note = excluded.handling_caution_note,
  handling_caution_locked = excluded.handling_caution_locked,
  status = excluded.status,
  primary_breed_id = excluded.primary_breed_id,
  primary_breed_name = excluded.primary_breed_name,
  is_mixed_breed = excluded.is_mixed_breed,
  additional_breed_ids = excluded.additional_breed_ids,
  estimated_age_years = excluded.estimated_age_years,
  estimated_age_months = excluded.estimated_age_months,
  estimated_age_days = excluded.estimated_age_days,
  age_is_estimated = excluded.age_is_estimated,
  weight_kg = excluded.weight_kg,
  color = excluded.color,
  microchip_type = excluded.microchip_type,
  profile_memo = excluded.profile_memo,
  primary_attending_vet_id = excluded.primary_attending_vet_id,
  message_consent_status = excluded.message_consent_status,
  kakao_patient_code = excluded.kakao_patient_code,
  last_updated_by_user_id = excluded.last_updated_by_user_id,
  updated_at = now();

insert into public.patient_guardians (
  id,
  workspace_id,
  patient_id,
  guardian_id,
  relationship,
  is_primary,
  can_receive_messages,
  relationship_label,
  message_consent_status,
  guardian_phone_available,
  sort_order,
  linked_by_user_id
)
values
  ('19422000-0000-4000-8000-000000000001', 'clair-demo', '19421000-0000-4000-8000-000000000001', '19420000-0000-4000-8000-000000000001', 'primary', true, true, 'primary', 'granted', true, 0, '00000000-0000-4000-8000-000000000010'),
  ('19422000-0000-4000-8000-000000000002', 'clair-demo', '19421000-0000-4000-8000-000000000002', '19420000-0000-4000-8000-000000000002', 'primary', true, true, 'primary', 'granted', true, 0, '00000000-0000-4000-8000-000000000011'),
  ('19422000-0000-4000-8000-000000000003', 'clair-demo', '19421000-0000-4000-8000-000000000003', '19420000-0000-4000-8000-000000000003', 'primary', true, true, 'primary', 'granted', true, 0, '00000000-0000-4000-8000-000000000004'),
  ('19422000-0000-4000-8000-000000000004', 'clair-demo', '19421000-0000-4000-8000-000000000004', '19420000-0000-4000-8000-000000000004', 'primary', true, true, 'primary', 'granted', true, 0, '00000000-0000-4000-8000-000000000010'),
  ('19422000-0000-4000-8000-000000000005', 'clair-demo', '19421000-0000-4000-8000-000000000005', '19420000-0000-4000-8000-000000000005', 'primary', true, true, 'primary', 'granted', true, 0, '00000000-0000-4000-8000-000000000011'),
  ('19422000-0000-4000-8000-000000000006', 'clair-demo', '19421000-0000-4000-8000-000000000006', '19420000-0000-4000-8000-000000000006', 'primary', true, true, 'primary', 'granted', true, 0, '00000000-0000-4000-8000-000000000004'),
  ('19422000-0000-4000-8000-000000000007', 'clair-demo', '19421000-0000-4000-8000-000000000007', '19420000-0000-4000-8000-000000000007', 'primary', true, true, 'primary', 'granted', true, 0, '00000000-0000-4000-8000-000000000010'),
  ('19422000-0000-4000-8000-000000000008', 'clair-demo', '19421000-0000-4000-8000-000000000008', '19420000-0000-4000-8000-000000000007', 'primary', true, true, 'primary', 'granted', true, 0, '00000000-0000-4000-8000-000000000011'),
  ('19422000-0000-4000-8000-000000000009', 'clair-demo', '19421000-0000-4000-8000-000000000009', '19420000-0000-4000-8000-000000000008', 'primary', true, true, 'primary', 'granted', true, 0, '00000000-0000-4000-8000-000000000004'),
  ('19422000-0000-4000-8000-000000000010', 'clair-demo', '19421000-0000-4000-8000-000000000010', '19420000-0000-4000-8000-000000000009', 'primary', true, false, 'primary', 'refused', true, 0, '00000000-0000-4000-8000-000000000010'),
  ('19422000-0000-4000-8000-000000000011', 'clair-demo', '19421000-0000-4000-8000-000000000011', '19420000-0000-4000-8000-000000000010', 'primary', true, true, 'primary', 'unknown', true, 0, '00000000-0000-4000-8000-000000000011'),
  ('19422000-0000-4000-8000-000000000012', 'clair-demo', '19421000-0000-4000-8000-000000000012', '19420000-0000-4000-8000-000000000011', 'primary', true, true, 'primary', 'granted', true, 0, '00000000-0000-4000-8000-000000000004'),
  ('19422000-0000-4000-8000-000000000013', 'clair-demo', '19421000-0000-4000-8000-000000000013', '19420000-0000-4000-8000-000000000012', 'primary', true, true, 'primary', 'granted', true, 0, '00000000-0000-4000-8000-000000000010'),
  ('19422000-0000-4000-8000-000000000014', 'clair-demo', '19421000-0000-4000-8000-000000000014', '19420000-0000-4000-8000-000000000001', 'primary', true, true, 'primary', 'granted', true, 0, '00000000-0000-4000-8000-000000000011'),
  ('19422000-0000-4000-8000-000000000015', 'clair-demo', '19421000-0000-4000-8000-000000000015', '19420000-0000-4000-8000-000000000002', 'primary', true, true, 'primary', 'granted', true, 0, '00000000-0000-4000-8000-000000000004')
on conflict (patient_id, guardian_id) do update
set
  relationship = excluded.relationship,
  is_primary = excluded.is_primary,
  can_receive_messages = excluded.can_receive_messages,
  relationship_label = excluded.relationship_label,
  message_consent_status = excluded.message_consent_status,
  guardian_phone_available = excluded.guardian_phone_available,
  sort_order = excluded.sort_order,
  linked_by_user_id = excluded.linked_by_user_id,
  updated_at = now();

insert into public.consents (
  id,
  workspace_id,
  guardian_id,
  patient_id,
  consent_type,
  status,
  signed_at,
  document_url,
  source_surface,
  document_version,
  consented_at
)
values
  ('19423000-0000-4000-8000-000000000001', 'clair-demo', '19420000-0000-4000-8000-000000000001', '19421000-0000-4000-8000-000000000001', 'privacy', 'granted', '2026-05-21T08:30:00+09:00', '/mock-documents/session-consents/den-194-kong-privacy.pdf', 'guardian_registration', 'den-194-synthetic-v1', '2026-05-21T08:30:00+09:00'),
  ('19423000-0000-4000-8000-000000000002', 'clair-demo', '19420000-0000-4000-8000-000000000002', '19421000-0000-4000-8000-000000000002', 'privacy', 'granted', '2026-05-21T08:40:00+09:00', '/mock-documents/session-consents/den-194-nabi-privacy.pdf', 'guardian_registration', 'den-194-synthetic-v1', '2026-05-21T08:40:00+09:00'),
  ('19423000-0000-4000-8000-000000000003', 'clair-demo', '19420000-0000-4000-8000-000000000003', '19421000-0000-4000-8000-000000000003', 'messaging', 'granted', '2026-05-21T08:50:00+09:00', '/mock-documents/session-consents/den-194-bori-messaging.pdf', 'guardian_registration', 'den-194-synthetic-v1', '2026-05-21T08:50:00+09:00'),
  ('19423000-0000-4000-8000-000000000004', 'clair-demo', '19420000-0000-4000-8000-000000000004', '19421000-0000-4000-8000-000000000004', 'treatment', 'granted', '2026-05-21T09:00:00+09:00', '/mock-documents/session-consents/den-194-mango-treatment.pdf', 'guardian_registration', 'den-194-synthetic-v1', '2026-05-21T09:00:00+09:00'),
  ('19423000-0000-4000-8000-000000000005', 'clair-demo', '19420000-0000-4000-8000-000000000005', '19421000-0000-4000-8000-000000000005', 'treatment', 'granted', '2026-05-21T09:10:00+09:00', '/mock-documents/session-consents/den-194-choco-treatment.pdf', 'guardian_registration', 'den-194-synthetic-v1', '2026-05-21T09:10:00+09:00')
on conflict (id) do update
set
  status = excluded.status,
  signed_at = excluded.signed_at,
  document_url = excluded.document_url,
  source_surface = excluded.source_surface,
  document_version = excluded.document_version,
  consented_at = excluded.consented_at,
  updated_at = now();

insert into public.appointments (
  id,
  workspace_id,
  patient_id,
  guardian_id,
  assigned_veterinarian_id,
  scheduled_start_at,
  scheduled_end_at,
  visit_purpose,
  symptom_note,
  status,
  created_by_user_id
)
values
  ('19424000-0000-4000-8000-000000000001', 'clair-demo', '19421000-0000-4000-8000-000000000001', '19420000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000005', '2026-05-21T09:30:00+09:00', '2026-05-21T10:00:00+09:00', 'DEN-194 synthetic appointment. {"scenario_code":"kong-vomit"}', 'Vomiting and diarrhea synthetic replay', 'checked_in', '00000000-0000-4000-8000-000000000010'),
  ('19424000-0000-4000-8000-000000000003', 'clair-demo', '19421000-0000-4000-8000-000000000003', '19420000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000005', '2026-05-21T11:00:00+09:00', '2026-05-21T11:30:00+09:00', 'DEN-194 synthetic revisit. {"scenario_code":"bori-allergy"}', 'Skin and ear allergy synthetic replay', 'checked_in', '00000000-0000-4000-8000-000000000004'),
  ('19424000-0000-4000-8000-000000000004', 'clair-demo', '19421000-0000-4000-8000-000000000004', '19420000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000006', '2026-05-21T13:30:00+09:00', '2026-05-21T14:00:00+09:00', 'DEN-194 synthetic wellness. {"scenario_code":"mango-wellness"}', 'Wellness and vaccine synthetic replay', 'checked_in', '00000000-0000-4000-8000-000000000010')
on conflict (id) do update
set
  assigned_veterinarian_id = excluded.assigned_veterinarian_id,
  scheduled_start_at = excluded.scheduled_start_at,
  scheduled_end_at = excluded.scheduled_end_at,
  visit_purpose = excluded.visit_purpose,
  symptom_note = excluded.symptom_note,
  status = excluded.status,
  updated_at = now();

insert into public.encounters (
  id,
  workspace_id,
  patient_id,
  guardian_id,
  appointment_id,
  primary_veterinarian_id,
  encounter_no,
  reception_type,
  department,
  duration_minutes,
  chief_complaint,
  visit_purpose,
  reception_memo,
  status,
  checked_in_at,
  checked_in_by_user_id,
  started_at,
  completed_at
)
values
  ('19426000-0000-4000-8000-000000000001', 'clair-demo', '19421000-0000-4000-8000-000000000001', '19420000-0000-4000-8000-000000000001', '19424000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000005', 'E-DEN194-0001', 'appointment', 'Internal Medicine', 45, 'DEN-194 synthetic vomiting and diarrhea', 'DEN-194 fixture id map: encounter-kong-260501. {"scenario_code":"kong-vomit"}', 'Synthetic reception memo for kong-vomit.', 'ready_for_billing', '2026-05-21T09:28:00+09:00', '00000000-0000-4000-8000-000000000010', '2026-05-21T09:35:00+09:00', '2026-05-21T10:18:00+09:00'),
  ('19426000-0000-4000-8000-000000000002', 'clair-demo', '19421000-0000-4000-8000-000000000002', '19420000-0000-4000-8000-000000000002', null, '00000000-0000-4000-8000-000000000002', 'E-DEN194-0002', 'walk_in', 'Cat Friendly', 40, 'DEN-194 synthetic urinary signs', 'DEN-194 walk-in. {"scenario_code":"nabi-urinary"}', 'Synthetic cat-friendly walk-in memo.', 'ready_for_billing', '2026-05-21T10:10:00+09:00', '00000000-0000-4000-8000-000000000011', '2026-05-21T10:20:00+09:00', '2026-05-21T11:00:00+09:00'),
  ('19426000-0000-4000-8000-000000000003', 'clair-demo', '19421000-0000-4000-8000-000000000003', '19420000-0000-4000-8000-000000000003', '19424000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000005', 'E-DEN194-0003', 'appointment', 'Dermatology', 35, 'DEN-194 synthetic skin allergy revisit', 'DEN-194 revisit. {"scenario_code":"bori-allergy"}', 'Synthetic allergy revisit memo.', 'ready_for_billing', '2026-05-21T10:55:00+09:00', '00000000-0000-4000-8000-000000000004', '2026-05-21T11:02:00+09:00', '2026-05-21T11:35:00+09:00'),
  ('19426000-0000-4000-8000-000000000004', 'clair-demo', '19421000-0000-4000-8000-000000000004', '19420000-0000-4000-8000-000000000004', '19424000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000006', 'E-DEN194-0004', 'appointment', 'Preventive Care', 25, 'DEN-194 synthetic wellness vaccine', 'DEN-194 wellness. {"scenario_code":"mango-wellness"}', 'Synthetic vaccine reminder memo.', 'completed', '2026-05-21T13:25:00+09:00', '00000000-0000-4000-8000-000000000010', '2026-05-21T13:32:00+09:00', '2026-05-21T13:58:00+09:00'),
  ('19426000-0000-4000-8000-000000000005', 'clair-demo', '19421000-0000-4000-8000-000000000005', '19420000-0000-4000-8000-000000000005', null, '00000000-0000-4000-8000-000000000006', 'E-DEN194-0005', 'walk_in', 'Rehab', 55, 'DEN-194 synthetic patella rehab consult', 'DEN-194 rehab. {"scenario_code":"choco-rehab"}', 'Synthetic rehab/inpatient consult memo.', 'ready_for_billing', '2026-05-21T14:20:00+09:00', '00000000-0000-4000-8000-000000000011', '2026-05-21T14:30:00+09:00', '2026-05-21T15:15:00+09:00')
on conflict (id) do update
set
  primary_veterinarian_id = excluded.primary_veterinarian_id,
  encounter_no = excluded.encounter_no,
  reception_type = excluded.reception_type,
  department = excluded.department,
  duration_minutes = excluded.duration_minutes,
  chief_complaint = excluded.chief_complaint,
  visit_purpose = excluded.visit_purpose,
  reception_memo = excluded.reception_memo,
  status = excluded.status,
  checked_in_at = excluded.checked_in_at,
  checked_in_by_user_id = excluded.checked_in_by_user_id,
  started_at = excluded.started_at,
  completed_at = excluded.completed_at,
  updated_at = now();

insert into public.waiting_queue_entries (
  id,
  workspace_id,
  encounter_id,
  queue_type,
  status,
  priority,
  sort_order,
  entered_at,
  finished_at
)
values
  ('19427000-0000-4000-8000-000000000001', 'clair-demo', '19426000-0000-4000-8000-000000000001', 'billing', 'waiting', 'high', 1, '2026-05-21T10:18:00+09:00', null),
  ('19427000-0000-4000-8000-000000000002', 'clair-demo', '19426000-0000-4000-8000-000000000002', 'billing', 'waiting', 'normal', 2, '2026-05-21T11:00:00+09:00', null),
  ('19427000-0000-4000-8000-000000000003', 'clair-demo', '19426000-0000-4000-8000-000000000003', 'billing', 'waiting', 'normal', 3, '2026-05-21T11:35:00+09:00', null),
  ('19427000-0000-4000-8000-000000000004', 'clair-demo', '19426000-0000-4000-8000-000000000004', 'billing', 'done', 'low', 4, '2026-05-21T13:58:00+09:00', '2026-05-21T14:10:00+09:00'),
  ('19427000-0000-4000-8000-000000000005', 'clair-demo', '19426000-0000-4000-8000-000000000005', 'treatment', 'waiting', 'normal', 5, '2026-05-21T15:15:00+09:00', null)
on conflict (encounter_id, queue_type) do update
set
  status = excluded.status,
  priority = excluded.priority,
  sort_order = excluded.sort_order,
  entered_at = excluded.entered_at,
  finished_at = excluded.finished_at;

insert into public.service_categories (
  id,
  workspace_id,
  parent_id,
  name,
  sort_order
)
values
  ('19428000-0000-4000-8000-000000000001', 'clair-demo', null, 'DEN-194 synthetic lab and imaging', 20),
  ('19428000-0000-4000-8000-000000000002', 'clair-demo', null, 'DEN-194 synthetic treatment and dispensing', 30)
on conflict (id) do update
set
  name = excluded.name,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.service_items (
  id,
  workspace_id,
  category_id,
  name,
  item_type,
  description,
  default_duration_minutes,
  is_orderable,
  is_billable,
  is_active
)
values
  ('19429000-0000-4000-8000-000000000001', 'clair-demo', '19428000-0000-4000-8000-000000000001', 'DEN-194 CBC synthetic panel', 'lab', 'DEN-194 synthetic CBC order for kong-vomit replay.', 20, true, true, true),
  ('19429000-0000-4000-8000-000000000002', 'clair-demo', '19428000-0000-4000-8000-000000000001', 'DEN-194 Abdominal ultrasound synthetic', 'imaging', 'DEN-194 synthetic imaging order for kong-vomit replay.', 30, true, true, true),
  ('19429000-0000-4000-8000-000000000003', 'clair-demo', '19428000-0000-4000-8000-000000000002', 'DEN-194 Fluid therapy synthetic', 'treatment', 'DEN-194 synthetic treatment order.', 25, true, true, true),
  ('19429000-0000-4000-8000-000000000004', 'clair-demo', '19428000-0000-4000-8000-000000000002', 'DEN-194 Maropitant dispensing synthetic', 'medication', 'DEN-194 synthetic dispensing order.', 10, true, true, true),
  ('19429000-0000-4000-8000-000000000005', 'clair-demo', '19428000-0000-4000-8000-000000000001', 'DEN-194 Urinalysis synthetic', 'lab', 'DEN-194 synthetic urinary cat lab order.', 15, true, true, true),
  ('19429000-0000-4000-8000-000000000006', 'clair-demo', '19428000-0000-4000-8000-000000000001', 'DEN-194 X-ray synthetic', 'imaging', 'DEN-194 synthetic x-ray order.', 25, true, true, true),
  ('19429000-0000-4000-8000-000000000007', 'clair-demo', '19428000-0000-4000-8000-000000000002', 'DEN-194 Ear cleaning synthetic', 'treatment', 'DEN-194 synthetic allergy treatment order.', 20, true, true, true),
  ('19429000-0000-4000-8000-000000000008', 'clair-demo', '19428000-0000-4000-8000-000000000002', 'DEN-194 Vaccine synthetic', 'treatment', 'DEN-194 synthetic wellness vaccine order.', 10, true, true, true),
  ('19429000-0000-4000-8000-000000000009', 'clair-demo', '19428000-0000-4000-8000-000000000002', 'DEN-194 Rehab consult synthetic', 'treatment', 'DEN-194 synthetic rehab plan order.', 35, true, true, true)
on conflict (id) do update
set
  category_id = excluded.category_id,
  name = excluded.name,
  item_type = excluded.item_type,
  description = excluded.description,
  default_duration_minutes = excluded.default_duration_minutes,
  is_orderable = excluded.is_orderable,
  is_billable = excluded.is_billable,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.service_item_prices (
  id,
  workspace_id,
  service_item_id,
  price,
  currency,
  effective_from,
  effective_to
)
values
  ('19429100-0000-4000-8000-000000000001', 'clair-demo', '19429000-0000-4000-8000-000000000001', 35000.00, 'KRW', '2026-05-21', null),
  ('19429100-0000-4000-8000-000000000002', 'clair-demo', '19429000-0000-4000-8000-000000000002', 65000.00, 'KRW', '2026-05-21', null),
  ('19429100-0000-4000-8000-000000000003', 'clair-demo', '19429000-0000-4000-8000-000000000003', 28000.00, 'KRW', '2026-05-21', null),
  ('19429100-0000-4000-8000-000000000004', 'clair-demo', '19429000-0000-4000-8000-000000000004', 28500.00, 'KRW', '2026-05-21', null),
  ('19429100-0000-4000-8000-000000000005', 'clair-demo', '19429000-0000-4000-8000-000000000005', 30000.00, 'KRW', '2026-05-21', null),
  ('19429100-0000-4000-8000-000000000006', 'clair-demo', '19429000-0000-4000-8000-000000000006', 55000.00, 'KRW', '2026-05-21', null),
  ('19429100-0000-4000-8000-000000000007', 'clair-demo', '19429000-0000-4000-8000-000000000007', 22000.00, 'KRW', '2026-05-21', null),
  ('19429100-0000-4000-8000-000000000008', 'clair-demo', '19429000-0000-4000-8000-000000000008', 45000.00, 'KRW', '2026-05-21', null),
  ('19429100-0000-4000-8000-000000000009', 'clair-demo', '19429000-0000-4000-8000-000000000009', 60000.00, 'KRW', '2026-05-21', null)
on conflict (id) do update
set
  service_item_id = excluded.service_item_id,
  price = excluded.price,
  currency = excluded.currency,
  effective_from = excluded.effective_from,
  effective_to = excluded.effective_to;

insert into public.soap_notes (
  id,
  workspace_id,
  encounter_id,
  author_user_id,
  subjective,
  objective,
  assessment,
  plan,
  status,
  autosaved_at,
  signed_at
)
values
  ('19429200-0000-4000-8000-000000000001', 'clair-demo', '19426000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000005', 'DEN-194 synthetic kong-vomit subjective.', 'DEN-194 synthetic dehydration objective.', 'DEN-194 synthetic gastroenteritis assessment.', 'DEN-194 synthetic lab/imaging/treatment/dispensing plan.', 'signed', '2026-05-21T09:50:00+09:00', '2026-05-21T10:05:00+09:00'),
  ('19429200-0000-4000-8000-000000000002', 'clair-demo', '19426000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', 'DEN-194 synthetic urinary cat subjective.', 'DEN-194 synthetic bladder discomfort objective.', 'DEN-194 synthetic lower urinary tract assessment.', 'DEN-194 synthetic urinalysis and x-ray plan.', 'signed', '2026-05-21T10:35:00+09:00', '2026-05-21T10:50:00+09:00'),
  ('19429200-0000-4000-8000-000000000003', 'clair-demo', '19426000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000005', 'DEN-194 synthetic allergy revisit subjective.', 'DEN-194 synthetic skin redness objective.', 'DEN-194 synthetic dermatitis assessment.', 'DEN-194 synthetic cytology/treatment/dispensing plan.', 'signed', '2026-05-21T11:15:00+09:00', '2026-05-21T11:25:00+09:00'),
  ('19429200-0000-4000-8000-000000000004', 'clair-demo', '19426000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000006', 'DEN-194 synthetic wellness subjective.', 'DEN-194 synthetic normal exam objective.', 'DEN-194 synthetic preventive care assessment.', 'DEN-194 synthetic vaccine and next appointment plan.', 'signed', '2026-05-21T13:40:00+09:00', '2026-05-21T13:50:00+09:00'),
  ('19429200-0000-4000-8000-000000000005', 'clair-demo', '19426000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000006', 'DEN-194 synthetic patella consult subjective.', 'DEN-194 synthetic gait objective.', 'DEN-194 synthetic patella/rehab assessment.', 'DEN-194 synthetic x-ray and rehab plan.', 'signed', '2026-05-21T14:45:00+09:00', '2026-05-21T15:00:00+09:00')
on conflict (id) do update
set
  subjective = excluded.subjective,
  objective = excluded.objective,
  assessment = excluded.assessment,
  plan = excluded.plan,
  status = excluded.status,
  autosaved_at = excluded.autosaved_at,
  signed_at = excluded.signed_at,
  updated_at = now();

insert into public.diagnoses (
  id,
  workspace_id,
  encounter_id,
  diagnosis_catalog_id,
  diagnosis_text,
  diagnosis_type,
  is_primary,
  sort_order,
  created_by_user_id,
  updated_by_user_id
)
values
  ('19429300-0000-4000-8000-000000000001', 'clair-demo', '19426000-0000-4000-8000-000000000001', null, 'DEN-194 synthetic acute gastroenteritis', 'suspected', true, 1, '00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000005'),
  ('19429300-0000-4000-8000-000000000002', 'clair-demo', '19426000-0000-4000-8000-000000000002', null, 'DEN-194 synthetic feline urinary signs', 'suspected', true, 1, '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002'),
  ('19429300-0000-4000-8000-000000000003', 'clair-demo', '19426000-0000-4000-8000-000000000003', null, 'DEN-194 synthetic allergic dermatitis', 'confirmed', true, 1, '00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000005'),
  ('19429300-0000-4000-8000-000000000004', 'clair-demo', '19426000-0000-4000-8000-000000000004', null, 'DEN-194 synthetic wellness exam', 'confirmed', true, 1, '00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000006'),
  ('19429300-0000-4000-8000-000000000005', 'clair-demo', '19426000-0000-4000-8000-000000000005', null, 'DEN-194 synthetic patella rehab consult', 'suspected', true, 1, '00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000006')
on conflict (id) do update
set
  diagnosis_text = excluded.diagnosis_text,
  diagnosis_type = excluded.diagnosis_type,
  is_primary = excluded.is_primary,
  sort_order = excluded.sort_order,
  updated_by_user_id = excluded.updated_by_user_id,
  updated_at = now();

insert into public.order_groups (
  id,
  workspace_id,
  encounter_id,
  group_type,
  title,
  label,
  status,
  priority,
  sort_order,
  created_by_user_id
)
values
  ('19429400-0000-4000-8000-000000000001', 'clair-demo', '19426000-0000-4000-8000-000000000001', 'mixed', 'DEN-194 kong-vomit multi-order group', 'Project 02 synthetic', 'completed', 'high', 1, '00000000-0000-4000-8000-000000000005'),
  ('19429400-0000-4000-8000-000000000002', 'clair-demo', '19426000-0000-4000-8000-000000000002', 'mixed', 'DEN-194 nabi-urinary order group', 'Project 02 synthetic', 'completed', 'normal', 1, '00000000-0000-4000-8000-000000000002'),
  ('19429400-0000-4000-8000-000000000003', 'clair-demo', '19426000-0000-4000-8000-000000000003', 'mixed', 'DEN-194 bori-allergy order group', 'Project 02 synthetic', 'completed', 'normal', 1, '00000000-0000-4000-8000-000000000005'),
  ('19429400-0000-4000-8000-000000000004', 'clair-demo', '19426000-0000-4000-8000-000000000004', 'treatment', 'DEN-194 mango-wellness vaccine group', 'Project 02 synthetic', 'completed', 'low', 1, '00000000-0000-4000-8000-000000000006'),
  ('19429400-0000-4000-8000-000000000005', 'clair-demo', '19426000-0000-4000-8000-000000000005', 'mixed', 'DEN-194 choco-rehab order group', 'Project 02 synthetic', 'in_progress', 'normal', 1, '00000000-0000-4000-8000-000000000006')
on conflict (id) do update
set
  title = excluded.title,
  label = excluded.label,
  status = excluded.status,
  priority = excluded.priority,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.orders (
  id,
  workspace_id,
  encounter_id,
  order_group_id,
  service_item_id,
  order_type,
  display_name,
  billing_display_name,
  status,
  work_status,
  priority,
  quantity,
  unit_price_snapshot,
  requested_by_user_id,
  requested_at,
  confirmed_by_user_id,
  confirmed_at,
  due_at,
  current_assignee_user_id,
  instruction,
  sort_order
)
values
  ('19429500-0000-4000-8000-000000000001', 'clair-demo', '19426000-0000-4000-8000-000000000001', '19429400-0000-4000-8000-000000000001', '19429000-0000-4000-8000-000000000001', 'lab', 'DEN-194 CBC kong-vomit', 'DEN-194 CBC kong-vomit billing', 'ready_for_billing', 'completed', 'high', 1, 35000.00, '00000000-0000-4000-8000-000000000005', '2026-05-21T09:45:00+09:00', '00000000-0000-4000-8000-000000000005', '2026-05-21T09:47:00+09:00', '2026-05-21T10:05:00+09:00', '00000000-0000-4000-8000-000000000007', 'DEN-194 synthetic CBC result WBC 21.4 marker.', 1),
  ('19429500-0000-4000-8000-000000000002', 'clair-demo', '19426000-0000-4000-8000-000000000001', '19429400-0000-4000-8000-000000000001', '19429000-0000-4000-8000-000000000002', 'imaging', 'DEN-194 abdomen ultrasound kong-vomit', 'DEN-194 abdomen ultrasound billing', 'ready_for_billing', 'completed', 'high', 1, 65000.00, '00000000-0000-4000-8000-000000000005', '2026-05-21T09:46:00+09:00', '00000000-0000-4000-8000-000000000005', '2026-05-21T09:48:00+09:00', '2026-05-21T10:10:00+09:00', '00000000-0000-4000-8000-000000000008', 'DEN-194 synthetic imaging result abdomen marker.', 2),
  ('19429500-0000-4000-8000-000000000003', 'clair-demo', '19426000-0000-4000-8000-000000000001', '19429400-0000-4000-8000-000000000001', '19429000-0000-4000-8000-000000000003', 'treatment', 'DEN-194 fluid therapy kong-vomit', 'DEN-194 fluid therapy billing', 'ready_for_billing', 'completed', 'normal', 1, 28000.00, '00000000-0000-4000-8000-000000000005', '2026-05-21T09:47:00+09:00', '00000000-0000-4000-8000-000000000005', '2026-05-21T09:49:00+09:00', '2026-05-21T10:12:00+09:00', '00000000-0000-4000-8000-000000000009', 'DEN-194 synthetic treatment completion marker.', 3),
  ('19429500-0000-4000-8000-000000000004', 'clair-demo', '19426000-0000-4000-8000-000000000001', '19429400-0000-4000-8000-000000000001', '19429000-0000-4000-8000-000000000004', 'dispensing', 'DEN-194 maropitant dispensing kong-vomit', 'DEN-194 maropitant dispensing billing', 'ready_for_billing', 'completed', 'normal', 1, 28500.00, '00000000-0000-4000-8000-000000000005', '2026-05-21T09:48:00+09:00', '00000000-0000-4000-8000-000000000005', '2026-05-21T09:50:00+09:00', '2026-05-21T10:15:00+09:00', '00000000-0000-4000-8000-000000000009', 'DEN-194 synthetic dispensing completion marker.', 4),
  ('19429500-0000-4000-8000-000000000005', 'clair-demo', '19426000-0000-4000-8000-000000000002', '19429400-0000-4000-8000-000000000002', '19429000-0000-4000-8000-000000000005', 'lab', 'DEN-194 urinalysis nabi-urinary', 'DEN-194 urinalysis billing', 'ready_for_billing', 'completed', 'normal', 1, 30000.00, '00000000-0000-4000-8000-000000000002', '2026-05-21T10:25:00+09:00', '00000000-0000-4000-8000-000000000002', '2026-05-21T10:27:00+09:00', '2026-05-21T10:45:00+09:00', '00000000-0000-4000-8000-000000000007', 'DEN-194 synthetic urinalysis result marker.', 1),
  ('19429500-0000-4000-8000-000000000006', 'clair-demo', '19426000-0000-4000-8000-000000000002', '19429400-0000-4000-8000-000000000002', '19429000-0000-4000-8000-000000000006', 'imaging', 'DEN-194 urinary x-ray nabi-urinary', 'DEN-194 urinary x-ray billing', 'ready_for_billing', 'completed', 'normal', 1, 55000.00, '00000000-0000-4000-8000-000000000002', '2026-05-21T10:28:00+09:00', '00000000-0000-4000-8000-000000000002', '2026-05-21T10:30:00+09:00', '2026-05-21T10:50:00+09:00', '00000000-0000-4000-8000-000000000008', 'DEN-194 synthetic x-ray result marker.', 2),
  ('19429500-0000-4000-8000-000000000007', 'clair-demo', '19426000-0000-4000-8000-000000000003', '19429400-0000-4000-8000-000000000003', '19429000-0000-4000-8000-000000000007', 'treatment', 'DEN-194 ear cleaning bori-allergy', 'DEN-194 ear cleaning billing', 'ready_for_billing', 'completed', 'normal', 1, 22000.00, '00000000-0000-4000-8000-000000000005', '2026-05-21T11:18:00+09:00', '00000000-0000-4000-8000-000000000005', '2026-05-21T11:20:00+09:00', '2026-05-21T11:30:00+09:00', '00000000-0000-4000-8000-000000000009', 'DEN-194 synthetic allergy treatment result marker.', 1),
  ('19429500-0000-4000-8000-000000000008', 'clair-demo', '19426000-0000-4000-8000-000000000003', '19429400-0000-4000-8000-000000000003', '19429000-0000-4000-8000-000000000004', 'dispensing', 'DEN-194 allergy medication bori-allergy', 'DEN-194 allergy medication billing', 'ready_for_billing', 'completed', 'normal', 1, 28500.00, '00000000-0000-4000-8000-000000000005', '2026-05-21T11:19:00+09:00', '00000000-0000-4000-8000-000000000005', '2026-05-21T11:21:00+09:00', '2026-05-21T11:32:00+09:00', '00000000-0000-4000-8000-000000000009', 'DEN-194 synthetic dispensing result marker.', 2),
  ('19429500-0000-4000-8000-000000000009', 'clair-demo', '19426000-0000-4000-8000-000000000004', '19429400-0000-4000-8000-000000000004', '19429000-0000-4000-8000-000000000008', 'treatment', 'DEN-194 wellness vaccine mango', 'DEN-194 wellness vaccine billing', 'ready_for_billing', 'completed', 'low', 1, 45000.00, '00000000-0000-4000-8000-000000000006', '2026-05-21T13:38:00+09:00', '00000000-0000-4000-8000-000000000006', '2026-05-21T13:40:00+09:00', '2026-05-21T13:50:00+09:00', '00000000-0000-4000-8000-000000000009', 'DEN-194 synthetic vaccine completion marker.', 1),
  ('19429500-0000-4000-8000-000000000010', 'clair-demo', '19426000-0000-4000-8000-000000000005', '19429400-0000-4000-8000-000000000005', '19429000-0000-4000-8000-000000000006', 'imaging', 'DEN-194 patella x-ray choco', 'DEN-194 patella x-ray billing', 'ready_for_billing', 'completed', 'normal', 1, 55000.00, '00000000-0000-4000-8000-000000000006', '2026-05-21T14:40:00+09:00', '00000000-0000-4000-8000-000000000006', '2026-05-21T14:42:00+09:00', '2026-05-21T15:00:00+09:00', '00000000-0000-4000-8000-000000000008', 'DEN-194 synthetic patella x-ray result marker.', 1),
  ('19429500-0000-4000-8000-000000000011', 'clair-demo', '19426000-0000-4000-8000-000000000005', '19429400-0000-4000-8000-000000000005', '19429000-0000-4000-8000-000000000009', 'treatment', 'DEN-194 rehab plan choco', 'DEN-194 rehab plan billing', 'confirmed', 'pending', 'normal', 1, 60000.00, '00000000-0000-4000-8000-000000000006', '2026-05-21T14:41:00+09:00', '00000000-0000-4000-8000-000000000006', '2026-05-21T14:43:00+09:00', '2026-05-21T15:20:00+09:00', '00000000-0000-4000-8000-000000000009', 'DEN-194 synthetic rehab treatment pending marker.', 2)
on conflict (id) do update
set
  order_group_id = excluded.order_group_id,
  service_item_id = excluded.service_item_id,
  display_name = excluded.display_name,
  billing_display_name = excluded.billing_display_name,
  status = excluded.status,
  work_status = excluded.work_status,
  priority = excluded.priority,
  quantity = excluded.quantity,
  unit_price_snapshot = excluded.unit_price_snapshot,
  confirmed_by_user_id = excluded.confirmed_by_user_id,
  confirmed_at = excluded.confirmed_at,
  due_at = excluded.due_at,
  current_assignee_user_id = excluded.current_assignee_user_id,
  instruction = excluded.instruction,
  sort_order = excluded.sort_order,
  updated_at = now();

-- DEMO-DB-PR-003: fulfillment work item seed foundation.
-- Direct seed rows keep reset/readback deterministic; the RPC uses now() for completed timestamps.
insert into public.order_fulfillment_work_items (
  id,
  workspace_id,
  encounter_id,
  order_id,
  order_type,
  queue_type,
  status,
  priority,
  requested_by_user_id,
  assigned_to_user_id,
  due_at,
  completed_at,
  reason,
  source_snapshot,
  created_at,
  updated_at
)
values
  ('19431000-0000-4000-8000-000000000001', 'clair-demo', '19426000-0000-4000-8000-000000000001', '19429500-0000-4000-8000-000000000001', 'lab', 'lab', 'completed', 'high', '00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000007', '2026-05-21T10:05:00+09:00', '2026-05-21T10:02:00+09:00', 'DEN-194 synthetic CBC result entered.', '{"patientName":"Kong Synthetic","guardianName":"DEN-194 Guardian 01","orderDisplayName":"DEN-194 CBC kong-vomit","serviceItemId":"19429000-0000-4000-8000-000000000001","billingReflectionEnabled":true,"instruction":"DEN-194 synthetic CBC result WBC 21.4 marker.","detail":{"orderType":"lab","priority":"high","scenarioCode":"kong-vomit","synthetic":true}}'::jsonb, '2026-05-21T09:47:00+09:00', '2026-05-21T10:02:00+09:00'),
  ('19431000-0000-4000-8000-000000000002', 'clair-demo', '19426000-0000-4000-8000-000000000001', '19429500-0000-4000-8000-000000000002', 'imaging', 'imaging', 'completed', 'high', '00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000008', '2026-05-21T10:10:00+09:00', '2026-05-21T10:08:00+09:00', 'DEN-194 synthetic abdomen ultrasound result entered.', '{"patientName":"Kong Synthetic","guardianName":"DEN-194 Guardian 01","orderDisplayName":"DEN-194 abdomen ultrasound kong-vomit","serviceItemId":"19429000-0000-4000-8000-000000000002","billingReflectionEnabled":true,"instruction":"DEN-194 synthetic imaging result abdomen marker.","detail":{"orderType":"imaging","priority":"high","scenarioCode":"kong-vomit","synthetic":true}}'::jsonb, '2026-05-21T09:48:00+09:00', '2026-05-21T10:08:00+09:00'),
  ('19431000-0000-4000-8000-000000000003', 'clair-demo', '19426000-0000-4000-8000-000000000001', '19429500-0000-4000-8000-000000000003', 'treatment', 'treatment', 'completed', 'normal', '00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000009', '2026-05-21T10:12:00+09:00', '2026-05-21T10:12:00+09:00', 'DEN-194 synthetic fluid therapy completed.', '{"patientName":"Kong Synthetic","guardianName":"DEN-194 Guardian 01","orderDisplayName":"DEN-194 fluid therapy kong-vomit","serviceItemId":"19429000-0000-4000-8000-000000000003","billingReflectionEnabled":true,"instruction":"DEN-194 synthetic treatment completion marker.","detail":{"orderType":"treatment","priority":"normal","scenarioCode":"kong-vomit","synthetic":true}}'::jsonb, '2026-05-21T09:49:00+09:00', '2026-05-21T10:12:00+09:00'),
  ('19431000-0000-4000-8000-000000000004', 'clair-demo', '19426000-0000-4000-8000-000000000001', '19429500-0000-4000-8000-000000000004', 'dispensing', 'dispensing', 'completed', 'normal', '00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000009', '2026-05-21T10:15:00+09:00', '2026-05-21T10:15:00+09:00', 'DEN-194 synthetic maropitant dispensing completed.', '{"patientName":"Kong Synthetic","guardianName":"DEN-194 Guardian 01","orderDisplayName":"DEN-194 maropitant dispensing kong-vomit","serviceItemId":"19429000-0000-4000-8000-000000000004","billingReflectionEnabled":true,"instruction":"DEN-194 synthetic dispensing completion marker.","detail":{"orderType":"dispensing","priority":"normal","scenarioCode":"kong-vomit","synthetic":true}}'::jsonb, '2026-05-21T09:50:00+09:00', '2026-05-21T10:15:00+09:00'),
  ('19431000-0000-4000-8000-000000000005', 'clair-demo', '19426000-0000-4000-8000-000000000002', '19429500-0000-4000-8000-000000000005', 'lab', 'lab', 'completed', 'normal', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000007', '2026-05-21T10:45:00+09:00', '2026-05-21T10:45:00+09:00', 'DEN-194 synthetic urinalysis result entered.', '{"patientName":"Nabi Synthetic","guardianName":"DEN-194 Guardian 02","orderDisplayName":"DEN-194 urinalysis nabi-urinary","serviceItemId":"19429000-0000-4000-8000-000000000005","billingReflectionEnabled":true,"instruction":"DEN-194 synthetic urinalysis result marker.","detail":{"orderType":"lab","priority":"normal","scenarioCode":"nabi-urinary","synthetic":true}}'::jsonb, '2026-05-21T10:27:00+09:00', '2026-05-21T10:45:00+09:00'),
  ('19431000-0000-4000-8000-000000000006', 'clair-demo', '19426000-0000-4000-8000-000000000002', '19429500-0000-4000-8000-000000000006', 'imaging', 'imaging', 'completed', 'normal', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000008', '2026-05-21T10:50:00+09:00', '2026-05-21T10:50:00+09:00', 'DEN-194 synthetic urinary x-ray result entered.', '{"patientName":"Nabi Synthetic","guardianName":"DEN-194 Guardian 02","orderDisplayName":"DEN-194 urinary x-ray nabi-urinary","serviceItemId":"19429000-0000-4000-8000-000000000006","billingReflectionEnabled":true,"instruction":"DEN-194 synthetic x-ray result marker.","detail":{"orderType":"imaging","priority":"normal","scenarioCode":"nabi-urinary","synthetic":true}}'::jsonb, '2026-05-21T10:30:00+09:00', '2026-05-21T10:50:00+09:00'),
  ('19431000-0000-4000-8000-000000000007', 'clair-demo', '19426000-0000-4000-8000-000000000003', '19429500-0000-4000-8000-000000000007', 'treatment', 'treatment', 'completed', 'normal', '00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000009', '2026-05-21T11:30:00+09:00', '2026-05-21T11:30:00+09:00', 'DEN-194 synthetic ear cleaning completed.', '{"patientName":"Bori Synthetic","guardianName":"DEN-194 Guardian 03","orderDisplayName":"DEN-194 ear cleaning bori-allergy","serviceItemId":"19429000-0000-4000-8000-000000000007","billingReflectionEnabled":true,"instruction":"DEN-194 synthetic allergy treatment result marker.","detail":{"orderType":"treatment","priority":"normal","scenarioCode":"bori-allergy","synthetic":true}}'::jsonb, '2026-05-21T11:20:00+09:00', '2026-05-21T11:30:00+09:00'),
  ('19431000-0000-4000-8000-000000000008', 'clair-demo', '19426000-0000-4000-8000-000000000003', '19429500-0000-4000-8000-000000000008', 'dispensing', 'dispensing', 'completed', 'normal', '00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000009', '2026-05-21T11:32:00+09:00', '2026-05-21T11:32:00+09:00', 'DEN-194 synthetic allergy medication dispensing completed.', '{"patientName":"Bori Synthetic","guardianName":"DEN-194 Guardian 03","orderDisplayName":"DEN-194 allergy medication bori-allergy","serviceItemId":"19429000-0000-4000-8000-000000000004","billingReflectionEnabled":true,"instruction":"DEN-194 synthetic dispensing result marker.","detail":{"orderType":"dispensing","priority":"normal","scenarioCode":"bori-allergy","synthetic":true}}'::jsonb, '2026-05-21T11:21:00+09:00', '2026-05-21T11:32:00+09:00'),
  ('19431000-0000-4000-8000-000000000009', 'clair-demo', '19426000-0000-4000-8000-000000000004', '19429500-0000-4000-8000-000000000009', 'treatment', 'treatment', 'completed', 'low', '00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000009', '2026-05-21T13:50:00+09:00', '2026-05-21T13:50:00+09:00', 'DEN-194 synthetic wellness vaccine completed.', '{"patientName":"Mango Synthetic","guardianName":"DEN-194 Guardian 04","orderDisplayName":"DEN-194 wellness vaccine mango","serviceItemId":"19429000-0000-4000-8000-000000000008","billingReflectionEnabled":true,"instruction":"DEN-194 synthetic vaccine completion marker.","detail":{"orderType":"treatment","priority":"low","scenarioCode":"mango-wellness","synthetic":true}}'::jsonb, '2026-05-21T13:40:00+09:00', '2026-05-21T13:50:00+09:00'),
  ('19431000-0000-4000-8000-000000000010', 'clair-demo', '19426000-0000-4000-8000-000000000005', '19429500-0000-4000-8000-000000000010', 'imaging', 'imaging', 'completed', 'normal', '00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000008', '2026-05-21T15:00:00+09:00', '2026-05-21T15:00:00+09:00', 'DEN-194 synthetic patella x-ray result entered.', '{"patientName":"Choco Synthetic","guardianName":"DEN-194 Guardian 05","orderDisplayName":"DEN-194 patella x-ray choco","serviceItemId":"19429000-0000-4000-8000-000000000006","billingReflectionEnabled":true,"instruction":"DEN-194 synthetic patella x-ray result marker.","detail":{"orderType":"imaging","priority":"normal","scenarioCode":"choco-rehab","synthetic":true}}'::jsonb, '2026-05-21T14:42:00+09:00', '2026-05-21T15:00:00+09:00'),
  ('19431000-0000-4000-8000-000000000011', 'clair-demo', '19426000-0000-4000-8000-000000000005', '19429500-0000-4000-8000-000000000011', 'treatment', 'treatment', 'in_progress', 'normal', '00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000009', '2026-05-21T15:20:00+09:00', null, 'DEN-194 synthetic rehab work remains in queue.', '{"patientName":"Choco Synthetic","guardianName":"DEN-194 Guardian 05","orderDisplayName":"DEN-194 rehab plan choco","serviceItemId":"19429000-0000-4000-8000-000000000009","billingReflectionEnabled":true,"instruction":"DEN-194 synthetic rehab treatment pending marker.","detail":{"orderType":"treatment","priority":"normal","scenarioCode":"choco-rehab","synthetic":true}}'::jsonb, '2026-05-21T14:43:00+09:00', '2026-05-21T15:05:00+09:00')
on conflict (workspace_id, order_id) do update
set
  id = excluded.id,
  encounter_id = excluded.encounter_id,
  order_type = excluded.order_type,
  queue_type = excluded.queue_type,
  status = excluded.status,
  priority = excluded.priority,
  requested_by_user_id = excluded.requested_by_user_id,
  assigned_to_user_id = excluded.assigned_to_user_id,
  due_at = excluded.due_at,
  completed_at = excluded.completed_at,
  cancelled_at = excluded.cancelled_at,
  returned_at = excluded.returned_at,
  reason = excluded.reason,
  source_snapshot = excluded.source_snapshot,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at;

insert into public.order_events (
  id,
  workspace_id,
  order_id,
  event_type,
  performed_by_user_id,
  payload,
  created_at
)
values
  ('19429800-0000-4000-8000-000000000001', 'clair-demo', '19429500-0000-4000-8000-000000000001', 'result_entered', '00000000-0000-4000-8000-000000000007', '{"scenario_code":"kong-vomit","result":"WBC 21.4 synthetic"}'::jsonb, '2026-05-21T10:02:00+09:00'),
  ('19429800-0000-4000-8000-000000000002', 'clair-demo', '19429500-0000-4000-8000-000000000002', 'result_entered', '00000000-0000-4000-8000-000000000008', '{"scenario_code":"kong-vomit","study":"abdomen ultrasound synthetic"}'::jsonb, '2026-05-21T10:08:00+09:00'),
  ('19429800-0000-4000-8000-000000000003', 'clair-demo', '19429500-0000-4000-8000-000000000003', 'completed', '00000000-0000-4000-8000-000000000009', '{"scenario_code":"kong-vomit","completion":"fluid therapy synthetic"}'::jsonb, '2026-05-21T10:12:00+09:00'),
  ('19429800-0000-4000-8000-000000000004', 'clair-demo', '19429500-0000-4000-8000-000000000004', 'completed', '00000000-0000-4000-8000-000000000009', '{"scenario_code":"kong-vomit","completion":"dispensing synthetic"}'::jsonb, '2026-05-21T10:15:00+09:00'),
  ('19429800-0000-4000-8000-000000000005', 'clair-demo', '19429500-0000-4000-8000-000000000005', 'result_entered', '00000000-0000-4000-8000-000000000007', '{"scenario_code":"nabi-urinary","result":"urinalysis synthetic"}'::jsonb, '2026-05-21T10:45:00+09:00'),
  ('19429800-0000-4000-8000-000000000006', 'clair-demo', '19429500-0000-4000-8000-000000000006', 'result_entered', '00000000-0000-4000-8000-000000000008', '{"scenario_code":"nabi-urinary","study":"x-ray synthetic"}'::jsonb, '2026-05-21T10:50:00+09:00'),
  ('19429800-0000-4000-8000-000000000007', 'clair-demo', '19429500-0000-4000-8000-000000000007', 'completed', '00000000-0000-4000-8000-000000000009', '{"scenario_code":"bori-allergy","completion":"ear cleaning synthetic"}'::jsonb, '2026-05-21T11:30:00+09:00'),
  ('19429800-0000-4000-8000-000000000008', 'clair-demo', '19429500-0000-4000-8000-000000000008', 'completed', '00000000-0000-4000-8000-000000000009', '{"scenario_code":"bori-allergy","completion":"dispensing synthetic"}'::jsonb, '2026-05-21T11:32:00+09:00'),
  ('19429800-0000-4000-8000-000000000009', 'clair-demo', '19429500-0000-4000-8000-000000000009', 'completed', '00000000-0000-4000-8000-000000000009', '{"scenario_code":"mango-wellness","completion":"vaccine synthetic"}'::jsonb, '2026-05-21T13:50:00+09:00'),
  ('19429800-0000-4000-8000-000000000010', 'clair-demo', '19429500-0000-4000-8000-000000000010', 'result_entered', '00000000-0000-4000-8000-000000000008', '{"scenario_code":"choco-rehab","study":"patella x-ray synthetic"}'::jsonb, '2026-05-21T15:00:00+09:00')
on conflict (id) do update
set
  performed_by_user_id = excluded.performed_by_user_id,
  payload = excluded.payload;

insert into public.invoices (
  id,
  workspace_id,
  encounter_id,
  guardian_id,
  invoice_no,
  status,
  payment_state,
  selected_payment_method,
  unpaid_reason,
  subtotal_amount,
  discount_amount,
  tax_amount,
  total_amount,
  issued_by_user_id,
  issued_at,
  paid_at
)
values
  ('19429600-0000-4000-8000-000000000001', 'clair-demo', '19426000-0000-4000-8000-000000000001', '19420000-0000-4000-8000-000000000001', 'INV-DEN194-0001', 'issued', 'unpaid', null, 'DEN-194 synthetic unpaid review state.', 156500.00, 0.00, 0.00, 156500.00, '00000000-0000-4000-8000-000000000010', '2026-05-21T10:20:00+09:00', null),
  ('19429600-0000-4000-8000-000000000002', 'clair-demo', '19426000-0000-4000-8000-000000000002', '19420000-0000-4000-8000-000000000002', 'INV-DEN194-0002', 'paid', 'paid', 'card', null, 85000.00, 0.00, 0.00, 85000.00, '00000000-0000-4000-8000-000000000011', '2026-05-21T11:05:00+09:00', '2026-05-21T11:08:00+09:00'),
  ('19429600-0000-4000-8000-000000000003', 'clair-demo', '19426000-0000-4000-8000-000000000003', '19420000-0000-4000-8000-000000000003', 'INV-DEN194-0003', 'issued', 'unpaid', null, 'DEN-194 synthetic revisit unpaid approval pending.', 50500.00, 0.00, 0.00, 50500.00, '00000000-0000-4000-8000-000000000004', '2026-05-21T11:40:00+09:00', null),
  ('19429600-0000-4000-8000-000000000004', 'clair-demo', '19426000-0000-4000-8000-000000000004', '19420000-0000-4000-8000-000000000004', 'INV-DEN194-0004', 'paid', 'paid', 'cash', null, 45000.00, 0.00, 0.00, 45000.00, '00000000-0000-4000-8000-000000000010', '2026-05-21T14:00:00+09:00', '2026-05-21T14:08:00+09:00'),
  ('19429600-0000-4000-8000-000000000005', 'clair-demo', '19426000-0000-4000-8000-000000000005', '19420000-0000-4000-8000-000000000005', 'INV-DEN194-0005', 'issued', 'unpaid', null, 'DEN-194 synthetic rehab plan not yet closed.', 115000.00, 0.00, 0.00, 115000.00, '00000000-0000-4000-8000-000000000011', '2026-05-21T15:18:00+09:00', null)
on conflict (id) do update
set
  invoice_no = excluded.invoice_no,
  status = excluded.status,
  payment_state = excluded.payment_state,
  selected_payment_method = excluded.selected_payment_method,
  unpaid_reason = excluded.unpaid_reason,
  subtotal_amount = excluded.subtotal_amount,
  discount_amount = excluded.discount_amount,
  tax_amount = excluded.tax_amount,
  total_amount = excluded.total_amount,
  issued_by_user_id = excluded.issued_by_user_id,
  issued_at = excluded.issued_at,
  paid_at = excluded.paid_at,
  updated_at = now();

insert into public.invoice_lines (
  id,
  workspace_id,
  invoice_id,
  service_item_id,
  order_id,
  description,
  quantity,
  unit_price,
  discount_amount
)
values
  ('19429700-0000-4000-8000-000000000001', 'clair-demo', '19429600-0000-4000-8000-000000000001', '19429000-0000-4000-8000-000000000001', '19429500-0000-4000-8000-000000000001', 'DEN-194 CBC kong-vomit invoice line', 1, 35000.00, 0.00),
  ('19429700-0000-4000-8000-000000000002', 'clair-demo', '19429600-0000-4000-8000-000000000001', '19429000-0000-4000-8000-000000000002', '19429500-0000-4000-8000-000000000002', 'DEN-194 abdomen ultrasound invoice line', 1, 65000.00, 0.00),
  ('19429700-0000-4000-8000-000000000003', 'clair-demo', '19429600-0000-4000-8000-000000000001', '19429000-0000-4000-8000-000000000003', '19429500-0000-4000-8000-000000000003', 'DEN-194 fluid therapy invoice line', 1, 28000.00, 0.00),
  ('19429700-0000-4000-8000-000000000004', 'clair-demo', '19429600-0000-4000-8000-000000000001', '19429000-0000-4000-8000-000000000004', '19429500-0000-4000-8000-000000000004', 'DEN-194 maropitant dispensing invoice line', 1, 28500.00, 0.00),
  ('19429700-0000-4000-8000-000000000005', 'clair-demo', '19429600-0000-4000-8000-000000000002', '19429000-0000-4000-8000-000000000005', '19429500-0000-4000-8000-000000000005', 'DEN-194 urinalysis invoice line', 1, 30000.00, 0.00),
  ('19429700-0000-4000-8000-000000000006', 'clair-demo', '19429600-0000-4000-8000-000000000002', '19429000-0000-4000-8000-000000000006', '19429500-0000-4000-8000-000000000006', 'DEN-194 urinary x-ray invoice line', 1, 55000.00, 0.00),
  ('19429700-0000-4000-8000-000000000007', 'clair-demo', '19429600-0000-4000-8000-000000000003', '19429000-0000-4000-8000-000000000007', '19429500-0000-4000-8000-000000000007', 'DEN-194 ear cleaning invoice line', 1, 22000.00, 0.00),
  ('19429700-0000-4000-8000-000000000008', 'clair-demo', '19429600-0000-4000-8000-000000000003', '19429000-0000-4000-8000-000000000004', '19429500-0000-4000-8000-000000000008', 'DEN-194 allergy medication invoice line', 1, 28500.00, 0.00),
  ('19429700-0000-4000-8000-000000000009', 'clair-demo', '19429600-0000-4000-8000-000000000004', '19429000-0000-4000-8000-000000000008', '19429500-0000-4000-8000-000000000009', 'DEN-194 vaccine invoice line', 1, 45000.00, 0.00),
  ('19429700-0000-4000-8000-000000000010', 'clair-demo', '19429600-0000-4000-8000-000000000005', '19429000-0000-4000-8000-000000000006', '19429500-0000-4000-8000-000000000010', 'DEN-194 patella x-ray invoice line', 1, 55000.00, 0.00),
  ('19429700-0000-4000-8000-000000000011', 'clair-demo', '19429600-0000-4000-8000-000000000005', '19429000-0000-4000-8000-000000000009', '19429500-0000-4000-8000-000000000011', 'DEN-194 rehab plan invoice line', 1, 60000.00, 0.00)
on conflict (id) do update
set
  service_item_id = excluded.service_item_id,
  order_id = excluded.order_id,
  description = excluded.description,
  quantity = excluded.quantity,
  unit_price = excluded.unit_price,
  discount_amount = excluded.discount_amount,
  updated_at = now();

insert into public.payments (
  id,
  workspace_id,
  invoice_id,
  payment_method,
  amount,
  status,
  paid_at,
  metadata
)
values
  ('19429900-0000-4000-8000-000000000002', 'clair-demo', '19429600-0000-4000-8000-000000000002', 'card', 85000.00, 'approved', '2026-05-21T11:08:00+09:00', '{"scenario_code":"nabi-urinary","synthetic":true}'::jsonb),
  ('19429900-0000-4000-8000-000000000004', 'clair-demo', '19429600-0000-4000-8000-000000000004', 'cash', 45000.00, 'approved', '2026-05-21T14:08:00+09:00', '{"scenario_code":"mango-wellness","synthetic":true}'::jsonb)
on conflict (id) do update
set
  payment_method = excluded.payment_method,
  amount = excluded.amount,
  status = excluded.status,
  paid_at = excluded.paid_at,
  metadata = excluded.metadata;

-- DEMO-DB-PR-005: billing checkout session family seed foundation.
-- Synthetic checkout snapshots only; no payment provider, receipt, refund, settlement, or accounting integration.
insert into public.billing_checkout_sessions (
  id,
  workspace_id,
  guardian_id,
  payer_snapshot,
  status,
  subtotal_amount,
  discount_amount,
  surcharge_amount,
  tax_amount,
  total_amount,
  selected_payment_method,
  unpaid_reason,
  payment_memo,
  created_by_user_id,
  prepared_at,
  completed_at,
  created_at,
  updated_at
)
values
  ('19433000-0000-4000-8000-000000000002', 'clair-demo', '19420000-0000-4000-8000-000000000002', '{"guardianId":"19420000-0000-4000-8000-000000000002","name":"DEN-194 Guardian 02","mobilePhone":"010-1941-0002","guardianCode":"DEN-194-G-02","scenarioCode":"nabi-urinary","synthetic":true}'::jsonb, 'paid', 85000.00, 0.00, 0.00, 0.00, 85000.00, 'card', null, 'DEN-194 synthetic card checkout for Nabi.', '00000000-0000-4000-8000-000000000011', '2026-05-21T11:06:00+09:00', '2026-05-21T11:08:00+09:00', '2026-05-21T11:06:00+09:00', '2026-05-21T11:08:00+09:00'),
  ('19433000-0000-4000-8000-000000000004', 'clair-demo', '19420000-0000-4000-8000-000000000004', '{"guardianId":"19420000-0000-4000-8000-000000000004","name":"DEN-194 Guardian 04","mobilePhone":"010-1941-0004","guardianCode":"DEN-194-G-04","scenarioCode":"mango-wellness","synthetic":true}'::jsonb, 'paid', 45000.00, 0.00, 0.00, 0.00, 45000.00, 'cash', null, 'DEN-194 synthetic cash checkout for Mango.', '00000000-0000-4000-8000-000000000010', '2026-05-21T14:05:00+09:00', '2026-05-21T14:08:00+09:00', '2026-05-21T14:05:00+09:00', '2026-05-21T14:08:00+09:00')
on conflict (id) do update
set
  guardian_id = excluded.guardian_id,
  payer_snapshot = excluded.payer_snapshot,
  status = excluded.status,
  subtotal_amount = excluded.subtotal_amount,
  discount_amount = excluded.discount_amount,
  surcharge_amount = excluded.surcharge_amount,
  tax_amount = excluded.tax_amount,
  total_amount = excluded.total_amount,
  selected_payment_method = excluded.selected_payment_method,
  unpaid_reason = excluded.unpaid_reason,
  payment_memo = excluded.payment_memo,
  created_by_user_id = excluded.created_by_user_id,
  prepared_at = excluded.prepared_at,
  completed_at = excluded.completed_at,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at;

insert into public.billing_checkout_session_invoices (
  id,
  workspace_id,
  checkout_session_id,
  invoice_id,
  encounter_id,
  patient_id,
  guardian_id,
  invoice_status_snapshot,
  amount_inclusion,
  subtotal_amount,
  discount_amount,
  surcharge_amount,
  tax_amount,
  allocated_amount,
  created_at
)
values
  ('19433100-0000-4000-8000-000000000002', 'clair-demo', '19433000-0000-4000-8000-000000000002', '19429600-0000-4000-8000-000000000002', '19426000-0000-4000-8000-000000000002', '19421000-0000-4000-8000-000000000002', '19420000-0000-4000-8000-000000000002', 'waiting', 'payable', 85000.00, 0.00, 0.00, 0.00, 85000.00, '2026-05-21T11:06:00+09:00'),
  ('19433100-0000-4000-8000-000000000004', 'clair-demo', '19433000-0000-4000-8000-000000000004', '19429600-0000-4000-8000-000000000004', '19426000-0000-4000-8000-000000000004', '19421000-0000-4000-8000-000000000004', '19420000-0000-4000-8000-000000000004', 'waiting', 'payable', 45000.00, 0.00, 0.00, 0.00, 45000.00, '2026-05-21T14:05:00+09:00')
on conflict (id) do update
set
  checkout_session_id = excluded.checkout_session_id,
  invoice_id = excluded.invoice_id,
  encounter_id = excluded.encounter_id,
  patient_id = excluded.patient_id,
  guardian_id = excluded.guardian_id,
  invoice_status_snapshot = excluded.invoice_status_snapshot,
  amount_inclusion = excluded.amount_inclusion,
  subtotal_amount = excluded.subtotal_amount,
  discount_amount = excluded.discount_amount,
  surcharge_amount = excluded.surcharge_amount,
  tax_amount = excluded.tax_amount,
  allocated_amount = excluded.allocated_amount,
  created_at = excluded.created_at;

insert into public.payment_allocations (
  id,
  workspace_id,
  checkout_session_id,
  payment_id,
  invoice_id,
  amount,
  created_at
)
values
  ('19433200-0000-4000-8000-000000000002', 'clair-demo', '19433000-0000-4000-8000-000000000002', '19429900-0000-4000-8000-000000000002', '19429600-0000-4000-8000-000000000002', 85000.00, '2026-05-21T11:08:00+09:00'),
  ('19433200-0000-4000-8000-000000000004', 'clair-demo', '19433000-0000-4000-8000-000000000004', '19429900-0000-4000-8000-000000000004', '19429600-0000-4000-8000-000000000004', 45000.00, '2026-05-21T14:08:00+09:00')
on conflict (workspace_id, payment_id, invoice_id) do update
set
  id = excluded.id,
  checkout_session_id = excluded.checkout_session_id,
  amount = excluded.amount,
  created_at = excluded.created_at;

insert into public.audit_events (
  id,
  workspace_id,
  actor_user_id,
  actor_membership_id,
  event_type,
  target_type,
  target_id,
  encounter_id,
  patient_id,
  guardian_id,
  request_id,
  reason,
  before_snapshot,
  after_snapshot,
  metadata,
  occurred_at
)
values
  ('den-194-audit-kong-order-confirmed', 'clair-demo', '00000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000005', 'order.confirmed', 'encounter', '19426000-0000-4000-8000-000000000001', '19426000-0000-4000-8000-000000000001', '19421000-0000-4000-8000-000000000001', '19420000-0000-4000-8000-000000000001', 'den-194-seed', 'DEN-194 synthetic order confirmation evidence', '{}'::jsonb, '{"orderCount":4}'::jsonb, '{"scenario_code":"kong-vomit","synthetic":true}'::jsonb, '2026-05-21T09:50:00+09:00'),
  ('den-194-audit-nabi-payment', 'clair-demo', '00000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000011', 'billing.payment_state_changed', 'invoice', '19429600-0000-4000-8000-000000000002', '19426000-0000-4000-8000-000000000002', '19421000-0000-4000-8000-000000000002', '19420000-0000-4000-8000-000000000002', 'den-194-seed', 'DEN-194 synthetic paid invoice evidence', '{"paymentState":"none"}'::jsonb, '{"paymentState":"paid"}'::jsonb, '{"scenario_code":"nabi-urinary","synthetic":true}'::jsonb, '2026-05-21T11:08:00+09:00'),
  ('den-194-audit-bori-invoice', 'clair-demo', '00000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000004', 'billing.invoice_issued', 'invoice', '19429600-0000-4000-8000-000000000003', '19426000-0000-4000-8000-000000000003', '19421000-0000-4000-8000-000000000003', '19420000-0000-4000-8000-000000000003', 'den-194-seed', 'DEN-194 synthetic invoice issued evidence', '{}'::jsonb, '{"totalAmount":50500}'::jsonb, '{"scenario_code":"bori-allergy","synthetic":true}'::jsonb, '2026-05-21T11:40:00+09:00'),
  ('den-194-audit-mango-payment', 'clair-demo', '00000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000010', 'billing.payment_state_changed', 'invoice', '19429600-0000-4000-8000-000000000004', '19426000-0000-4000-8000-000000000004', '19421000-0000-4000-8000-000000000004', '19420000-0000-4000-8000-000000000004', 'den-194-seed', 'DEN-194 synthetic wellness paid evidence', '{"paymentState":"none"}'::jsonb, '{"paymentState":"paid"}'::jsonb, '{"scenario_code":"mango-wellness","synthetic":true}'::jsonb, '2026-05-21T14:08:00+09:00'),
  ('den-194-audit-choco-rehab', 'clair-demo', '00000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000006', 'order.status_changed', 'order', '19429500-0000-4000-8000-000000000011', '19426000-0000-4000-8000-000000000005', '19421000-0000-4000-8000-000000000005', '19420000-0000-4000-8000-000000000005', 'den-194-seed', 'DEN-194 synthetic rehab pending evidence', '{"status":"draft"}'::jsonb, '{"status":"confirmed"}'::jsonb, '{"scenario_code":"choco-rehab","synthetic":true}'::jsonb, '2026-05-21T14:43:00+09:00')
on conflict (id) do update
set
  actor_user_id = excluded.actor_user_id,
  actor_membership_id = excluded.actor_membership_id,
  event_type = excluded.event_type,
  target_type = excluded.target_type,
  target_id = excluded.target_id,
  encounter_id = excluded.encounter_id,
  patient_id = excluded.patient_id,
  guardian_id = excluded.guardian_id,
  request_id = excluded.request_id,
  reason = excluded.reason,
  before_snapshot = excluded.before_snapshot,
  after_snapshot = excluded.after_snapshot,
  metadata = excluded.metadata,
  occurred_at = excluded.occurred_at;

insert into public.patient_staff_assignments (
  id,
  workspace_id,
  patient_id,
  staff_id,
  staff_display_name,
  department_label,
  assignment_role,
  sort_order,
  is_active
)
values
  ('19432000-0000-4000-8000-000000000001', 'clair-demo', '19421000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000005', 'DEN-194 Vet Internal', 'Internal Medicine demo', 'primary', 0, true),
  ('19432000-0000-4000-8000-000000000002', 'clair-demo', '19421000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', '이수지', 'Cat Friendly demo', 'primary', 0, true),
  ('19432000-0000-4000-8000-000000000003', 'clair-demo', '19421000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000005', 'DEN-194 Vet Internal', 'Dermatology demo', 'primary', 0, true),
  ('19432000-0000-4000-8000-000000000004', 'clair-demo', '19421000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000006', 'DEN-194 Vet Surgery', 'Preventive demo', 'primary', 0, true),
  ('19432000-0000-4000-8000-000000000005', 'clair-demo', '19421000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000006', 'DEN-194 Vet Surgery', 'Rehab demo', 'primary', 0, true)
on conflict (id) do update
set
  staff_id = excluded.staff_id,
  staff_display_name = excluded.staff_display_name,
  department_label = excluded.department_label,
  assignment_role = excluded.assignment_role,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = now();
