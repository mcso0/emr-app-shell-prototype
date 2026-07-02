create extension if not exists pgcrypto with schema extensions;

insert into public.users (id, display_name, initial, email, phone, status)
values
  ('00000000-0000-4000-8000-000000000001', '송민재', 'SM', 'admin@clair.local', '010-0000-0001', 'active')
on conflict (id) do update
set
  display_name = excluded.display_name,
  initial = excluded.initial,
  email = excluded.email,
  phone = excluded.phone,
  status = 'active',
  updated_at = now();

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
  aud = excluded.aud,
  role = excluded.role,
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
  activated_at = coalesce(public.user_memberships.activated_at, excluded.activated_at),
  deactivated_at = null,
  updated_at = now();

with default_permission_roles(role_key, label, role_type, permissions, sort_order) as (
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
  'workspace-clair-cheongdam',
  role.role_key,
  role.label,
  role.role_type,
  role.permissions,
  true,
  true,
  role.sort_order
from default_permission_roles role
on conflict (workspace_id, role_key) do update
set
  label = excluded.label,
  role_type = excluded.role_type,
  permissions = excluded.permissions,
  is_system = true,
  is_assignable = true,
  sort_order = excluded.sort_order,
  updated_at = now();

with default_job_positions(position_key, label, sort_order) as (
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
  'workspace-clair-cheongdam',
  position.position_key,
  position.label,
  true,
  true,
  position.sort_order
from default_job_positions position
on conflict (workspace_id, position_key) do update
set
  label = excluded.label,
  is_system = true,
  is_active = true,
  sort_order = excluded.sort_order,
  updated_at = now();

with seeded(membership_id, workspace_id, permission_role_key, job_position_key, assigned_by_user_id) as (
  values
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
