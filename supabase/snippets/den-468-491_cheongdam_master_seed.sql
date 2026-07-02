-- DEN-468/DEN-491 Cheongdam prepared-clinic master seed.
-- Synthetic staging/demo data only. Does not create active daily work.

select 'cheongdam_master_seed_contract_version:2026-06-12-den-468-491' as contract_version;

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

insert into public.user_profiles (user_id, locale, timezone, notification_preferences)
values
  ('49110000-0000-4000-8000-000000000001', 'ko-KR', 'Asia/Seoul', '{"email":false,"browser":true}'::jsonb),
  ('49110000-0000-4000-8000-000000000002', 'ko-KR', 'Asia/Seoul', '{"email":false,"browser":true}'::jsonb),
  ('49110000-0000-4000-8000-000000000003', 'ko-KR', 'Asia/Seoul', '{"email":false,"browser":true}'::jsonb),
  ('49110000-0000-4000-8000-000000000004', 'ko-KR', 'Asia/Seoul', '{"email":false,"browser":true}'::jsonb),
  ('49110000-0000-4000-8000-000000000005', 'ko-KR', 'Asia/Seoul', '{"email":false,"browser":true}'::jsonb),
  ('49110000-0000-4000-8000-000000000006', 'ko-KR', 'Asia/Seoul', '{"email":false,"browser":true}'::jsonb),
  ('49110000-0000-4000-8000-000000000007', 'ko-KR', 'Asia/Seoul', '{"email":false,"browser":true}'::jsonb),
  ('49110000-0000-4000-8000-000000000008', 'ko-KR', 'Asia/Seoul', '{"email":false,"browser":true}'::jsonb),
  ('49110000-0000-4000-8000-000000000009', 'ko-KR', 'Asia/Seoul', '{"email":false,"browser":true}'::jsonb),
  ('49110000-0000-4000-8000-000000000010', 'ko-KR', 'Asia/Seoul', '{"email":false,"browser":true}'::jsonb),
  ('49110000-0000-4000-8000-000000000011', 'ko-KR', 'Asia/Seoul', '{"email":false,"browser":true}'::jsonb),
  ('49110000-0000-4000-8000-000000000012', 'ko-KR', 'Asia/Seoul', '{"email":false,"browser":true}'::jsonb),
  ('49110000-0000-4000-8000-000000000013', 'ko-KR', 'Asia/Seoul', '{"email":false,"browser":true}'::jsonb),
  ('49110000-0000-4000-8000-000000000014', 'ko-KR', 'Asia/Seoul', '{"email":false,"browser":true}'::jsonb)
on conflict (user_id) do update
set
  locale = excluded.locale,
  timezone = excluded.timezone,
  notification_preferences = excluded.notification_preferences,
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

insert into public.permission_policies (workspace_id, name, scope, target_role, permissions)
values
  ('workspace-clair-cheongdam', 'Cheongdam owner/admin full access', 'role', 'hospital_admin', '{"allowed":["*"]}'::jsonb),
  ('workspace-clair-cheongdam', 'Cheongdam veterinarian access', 'role', 'vet', '{"allowed":["reception:view","patient:view","patient:create","patient:update","encounter:view","encounter:create","chart:view","chart:update","order:create","order:update","dispensing:view","lab:view","imaging:view","billing:view"]}'::jsonb),
  ('workspace-clair-cheongdam', 'Cheongdam technician access', 'role', 'technician', '{"allowed":["reception:view","patient:view","encounter:view","chart:view","order:update","dispensing:view","dispensing:complete","lab:view","lab:update","imaging:view","imaging:update"]}'::jsonb),
  ('workspace-clair-cheongdam', 'Cheongdam front desk access', 'role', 'front_desk', '{"allowed":["reception:view","reception:create","reception:update","patient:view","patient:create","patient:update","encounter:view","billing:view","billing:issue"]}'::jsonb)
on conflict (workspace_id, target_role) where scope = 'role' do update
set
  name = excluded.name,
  permissions = excluded.permissions,
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
select
  ('49120000-0000-4000-8000-' || lpad(seq::text, 12, '0'))::uuid,
  'workspace-clair-cheongdam',
  guardian_name,
  '010-4911-' || lpad(seq::text, 4, '0'),
  '0104911' || lpad(seq::text, 4, '0'),
  'cheongdam.guardian' || lpad(seq::text, 2, '0') || '@example.test',
  'Cheongdam synthetic guardian master seed. No active daily work.',
  'CD-G-' || lpad(seq::text, 3, '0'),
  '[]'::jsonb,
  '06' || lpad(seq::text, 3, '0'),
  '서울시 강남구 도산대로 synthetic',
  format('청담 준비 데이터 %s', seq),
  'cheongdam.guardian' || lpad(seq::text, 2, '0'),
  'direct_input',
  'example.test',
  case when seq % 5 = 0 then 'personal_income_deduction' else 'none' end,
  case when seq % 5 = 0 then 'cash-cd-' || lpad(seq::text, 3, '0') else null end,
  null,
  null,
  null,
  'active',
  '49110000-0000-4000-8000-000000000005'::uuid
from (
  values
    (1, '김서윤'), (2, '박민준'), (3, '이하린'), (4, '최도현'), (5, '정유나'),
    (6, '강지후'), (7, '윤서아'), (8, '장도윤'), (9, '한예린'), (10, '오지민'),
    (11, '신하준'), (12, '임수아'), (13, '권도하'), (14, '송채원'), (15, '홍시우'),
    (16, '문지아'), (17, '백유찬'), (18, '남서연'), (19, '서은우'), (20, '조아린'),
    (21, '배준서'), (22, '유나경'), (23, '심도겸'), (24, '노하은'), (25, '차민성')
) as guardians(seq, guardian_name)
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
  ('49121000-0000-4000-8000-000000000001', 'workspace-clair-cheongdam', 'CD-P-001', '루미', 'dog', 'Maltese', '2025-11-20', 'female', false, null, 'CD-REG-001', null, '어린 강아지 예방 관리 대상', null, true, 'active', 'breed-maltese', 'Maltese', false, '[]'::jsonb, 0, 6, 0, true, 2.1, 'White', 'none', 'Cheongdam puppy seed', '49110000-0000-4000-8000-000000000003', 'granted', 'CD-KAKAO-001', '49110000-0000-4000-8000-000000000005'),
  ('49121000-0000-4000-8000-000000000002', 'workspace-clair-cheongdam', 'CD-P-002', '보리', 'dog', 'Poodle', '2022-04-12', 'male', true, 'CDMICRO000002', 'CD-REG-002', null, null, null, true, 'active', 'breed-poodle', 'Poodle', false, '[]'::jsonb, 4, 2, 0, true, 5.4, 'Apricot', 'internal', 'Cheongdam adult dog seed', '49110000-0000-4000-8000-000000000003', 'granted', 'CD-KAKAO-002', '49110000-0000-4000-8000-000000000005'),
  ('49121000-0000-4000-8000-000000000003', 'workspace-clair-cheongdam', 'CD-P-003', '나나', 'cat', 'Korean shorthair', '2021-08-02', 'female', true, null, 'CD-REG-003', null, '고양이 친화 진료 필요', '이동장 안정을 우선', true, 'active', 'breed-ksh', 'Korean shorthair', false, '[]'::jsonb, 4, 10, 0, true, 4.2, 'Tabby', 'none', 'Cheongdam cat seed', '49110000-0000-4000-8000-000000000003', 'granted', 'CD-KAKAO-003', '49110000-0000-4000-8000-000000000005'),
  ('49121000-0000-4000-8000-000000000004', 'workspace-clair-cheongdam', 'CD-P-004', '초코', 'dog', 'Pomeranian', '2017-02-19', 'male', true, 'CDMICRO000004', 'CD-REG-004', null, '슬개골 병력 문진 필요', null, true, 'active', 'breed-pomeranian', 'Pomeranian', false, '[]'::jsonb, 9, 4, 0, true, 3.5, 'Brown', 'internal', 'Cheongdam senior small dog seed', '49110000-0000-4000-8000-000000000003', 'granted', 'CD-KAKAO-004', '49110000-0000-4000-8000-000000000005'),
  ('49121000-0000-4000-8000-000000000005', 'workspace-clair-cheongdam', 'CD-P-005', '모카', 'cat', 'Russian blue', '2023-06-05', 'male', false, null, 'CD-REG-005', null, null, null, true, 'active', 'breed-russian-blue', 'Russian blue', false, '[]'::jsonb, 3, 0, 0, true, 4.8, 'Blue', 'none', 'Cheongdam young cat seed', '49110000-0000-4000-8000-000000000003', 'granted', 'CD-KAKAO-005', '49110000-0000-4000-8000-000000000005'),
  ('49121000-0000-4000-8000-000000000006', 'workspace-clair-cheongdam', 'CD-P-006', '하루', 'dog', 'Jindo mix', '2020-01-14', 'female', true, 'CDMICRO000006', 'CD-REG-006', null, null, null, true, 'active', 'breed-jindo-mix', 'Jindo mix', true, '["breed-medium-dog"]'::jsonb, 6, 5, 0, true, 16.2, 'Ivory', 'internal', 'Cheongdam medium dog seed', '49110000-0000-4000-8000-000000000003', 'granted', 'CD-KAKAO-006', '49110000-0000-4000-8000-000000000005'),
  ('49121000-0000-4000-8000-000000000007', 'workspace-clair-cheongdam', 'CD-P-007', '콩이', 'dog', 'Bichon frise', '2019-09-09', 'female', true, null, 'CD-REG-007', '닭고기 의심', null, null, true, 'active', 'breed-bichon', 'Bichon frise', false, '[]'::jsonb, 6, 9, 0, true, 6.1, 'White', 'none', 'Cheongdam allergy memo seed', '49110000-0000-4000-8000-000000000003', 'granted', 'CD-KAKAO-007', '49110000-0000-4000-8000-000000000005'),
  ('49121000-0000-4000-8000-000000000008', 'workspace-clair-cheongdam', 'CD-P-008', '레오', 'cat', 'Persian', '2016-12-22', 'male', true, null, 'CD-REG-008', null, '노령묘 정기 검진 대상', '스트레스 최소화', true, 'active', 'breed-persian', 'Persian', false, '[]'::jsonb, 9, 6, 0, true, 5.0, 'Cream', 'none', 'Cheongdam senior cat seed', '49110000-0000-4000-8000-000000000003', 'granted', 'CD-KAKAO-008', '49110000-0000-4000-8000-000000000005'),
  ('49121000-0000-4000-8000-000000000009', 'workspace-clair-cheongdam', 'CD-P-009', '두부', 'dog', 'Corgi', '2021-05-28', 'male', true, 'CDMICRO000009', 'CD-REG-009', null, null, null, true, 'active', 'breed-corgi', 'Corgi', false, '[]'::jsonb, 5, 1, 0, true, 11.8, 'Tan white', 'internal', 'Cheongdam dog seed', '49110000-0000-4000-8000-000000000003', 'granted', 'CD-KAKAO-009', '49110000-0000-4000-8000-000000000005'),
  ('49121000-0000-4000-8000-000000000010', 'workspace-clair-cheongdam', 'CD-P-010', '라떼', 'cat', 'Siamese', '2020-10-30', 'female', true, null, 'CD-REG-010', null, null, null, true, 'active', 'breed-siamese', 'Siamese', false, '[]'::jsonb, 5, 7, 0, true, 3.9, 'Seal point', 'none', 'Cheongdam cat seed', '49110000-0000-4000-8000-000000000003', 'granted', 'CD-KAKAO-010', '49110000-0000-4000-8000-000000000005'),
  ('49121000-0000-4000-8000-000000000011', 'workspace-clair-cheongdam', 'CD-P-011', '마루', 'dog', 'Golden retriever', '2018-03-15', 'male', true, 'CDMICRO000011', 'CD-REG-011', null, '대형견 관절 문진', null, true, 'active', 'breed-golden', 'Golden retriever', false, '[]'::jsonb, 8, 3, 0, true, 28.5, 'Golden', 'internal', 'Cheongdam large dog seed', '49110000-0000-4000-8000-000000000003', 'granted', 'CD-KAKAO-011', '49110000-0000-4000-8000-000000000005'),
  ('49121000-0000-4000-8000-000000000012', 'workspace-clair-cheongdam', 'CD-P-012', '달이', 'cat', 'Munchkin', '2024-08-18', 'female', false, null, 'CD-REG-012', null, '어린 고양이 예방 관리 대상', null, true, 'active', 'breed-munchkin', 'Munchkin', false, '[]'::jsonb, 1, 10, 0, true, 2.7, 'White', 'none', 'Cheongdam kitten seed', '49110000-0000-4000-8000-000000000003', 'granted', 'CD-KAKAO-012', '49110000-0000-4000-8000-000000000005'),
  ('49121000-0000-4000-8000-000000000013', 'workspace-clair-cheongdam', 'CD-P-013', '루루', 'dog', 'Shiba inu', '2022-12-24', 'female', true, null, 'CD-REG-013', null, null, null, true, 'active', 'breed-shiba', 'Shiba inu', false, '[]'::jsonb, 3, 6, 0, true, 8.8, 'Red', 'none', 'Cheongdam dog seed', '49110000-0000-4000-8000-000000000003', 'granted', 'CD-KAKAO-013', '49110000-0000-4000-8000-000000000005'),
  ('49121000-0000-4000-8000-000000000014', 'workspace-clair-cheongdam', 'CD-P-014', '소금', 'cat', 'British shorthair', '2019-07-07', 'male', true, null, 'CD-REG-014', null, null, null, true, 'active', 'breed-british-shorthair', 'British shorthair', false, '[]'::jsonb, 6, 11, 0, true, 5.6, 'Silver', 'none', 'Cheongdam cat seed', '49110000-0000-4000-8000-000000000003', 'granted', 'CD-KAKAO-014', '49110000-0000-4000-8000-000000000005'),
  ('49121000-0000-4000-8000-000000000015', 'workspace-clair-cheongdam', 'CD-P-015', '밤비', 'dog', 'Dachshund', '2015-05-01', 'female', true, 'CDMICRO000015', 'CD-REG-015', null, '노령견 디스크 주의', null, true, 'active', 'breed-dachshund', 'Dachshund', false, '[]'::jsonb, 11, 1, 0, true, 6.9, 'Black tan', 'internal', 'Cheongdam senior dog seed', '49110000-0000-4000-8000-000000000003', 'granted', 'CD-KAKAO-015', '49110000-0000-4000-8000-000000000005'),
  ('49121000-0000-4000-8000-000000000016', 'workspace-clair-cheongdam', 'CD-P-016', '구름', 'dog', 'Samoyed', '2023-02-02', 'male', false, null, 'CD-REG-016', null, null, null, true, 'active', 'breed-samoyed', 'Samoyed', false, '[]'::jsonb, 3, 4, 0, true, 21.5, 'White', 'none', 'Cheongdam young large dog seed', '49110000-0000-4000-8000-000000000003', 'granted', 'CD-KAKAO-016', '49110000-0000-4000-8000-000000000005'),
  ('49121000-0000-4000-8000-000000000017', 'workspace-clair-cheongdam', 'CD-P-017', '미미', 'cat', 'Ragdoll', '2018-11-11', 'female', true, null, 'CD-REG-017', null, null, null, true, 'active', 'breed-ragdoll', 'Ragdoll', false, '[]'::jsonb, 7, 7, 0, true, 4.7, 'Seal bicolor', 'none', 'Cheongdam cat seed', '49110000-0000-4000-8000-000000000003', 'granted', 'CD-KAKAO-017', '49110000-0000-4000-8000-000000000005'),
  ('49121000-0000-4000-8000-000000000018', 'workspace-clair-cheongdam', 'CD-P-018', '탄이', 'dog', 'French bulldog', '2020-06-17', 'male', true, 'CDMICRO000018', 'CD-REG-018', null, '단두종 호흡 문진', '더위 주의', true, 'active', 'breed-french-bulldog', 'French bulldog', false, '[]'::jsonb, 6, 0, 0, true, 12.6, 'Brindle', 'internal', 'Cheongdam brachycephalic dog seed', '49110000-0000-4000-8000-000000000003', 'granted', 'CD-KAKAO-018', '49110000-0000-4000-8000-000000000005'),
  ('49121000-0000-4000-8000-000000000019', 'workspace-clair-cheongdam', 'CD-P-019', '별이', 'cat', 'Scottish fold', '2022-09-19', 'female', true, null, 'CD-REG-019', null, '관절 문진 권장', null, true, 'active', 'breed-scottish-fold', 'Scottish fold', false, '[]'::jsonb, 3, 9, 0, true, 4.4, 'Cream', 'none', 'Cheongdam cat seed', '49110000-0000-4000-8000-000000000003', 'granted', 'CD-KAKAO-019', '49110000-0000-4000-8000-000000000005'),
  ('49121000-0000-4000-8000-000000000020', 'workspace-clair-cheongdam', 'CD-P-020', '호두', 'dog', 'Beagle', '2021-01-30', 'male', false, null, 'CD-REG-020', null, null, null, true, 'active', 'breed-beagle', 'Beagle', false, '[]'::jsonb, 5, 5, 0, true, 10.5, 'Tri-color', 'none', 'Cheongdam dog seed', '49110000-0000-4000-8000-000000000003', 'granted', 'CD-KAKAO-020', '49110000-0000-4000-8000-000000000005'),
  ('49121000-0000-4000-8000-000000000021', 'workspace-clair-cheongdam', 'CD-P-021', '망고', 'dog', 'Welsh corgi', '2024-12-05', 'female', false, null, 'CD-REG-021', null, '어린 강아지 예방 관리 대상', null, true, 'active', 'breed-welsh-corgi', 'Welsh corgi', false, '[]'::jsonb, 1, 6, 0, true, 7.2, 'Sable', 'none', 'Cheongdam puppy seed', '49110000-0000-4000-8000-000000000003', 'granted', 'CD-KAKAO-021', '49110000-0000-4000-8000-000000000005'),
  ('49121000-0000-4000-8000-000000000022', 'workspace-clair-cheongdam', 'CD-P-022', '쿠키', 'cat', 'Abyssinian', '2021-03-03', 'male', true, null, 'CD-REG-022', null, null, null, true, 'active', 'breed-abyssinian', 'Abyssinian', false, '[]'::jsonb, 5, 3, 0, true, 4.1, 'Ruddy', 'none', 'Cheongdam cat seed', '49110000-0000-4000-8000-000000000003', 'granted', 'CD-KAKAO-022', '49110000-0000-4000-8000-000000000005'),
  ('49121000-0000-4000-8000-000000000023', 'workspace-clair-cheongdam', 'CD-P-023', '토리', 'dog', 'Mixed small dog', '2014-09-25', 'female', true, 'CDMICRO000023', 'CD-REG-023', null, '노령견 정기 검진 대상', null, true, 'active', 'breed-small-mix', 'Mixed small dog', true, '["breed-maltese"]'::jsonb, 11, 9, 0, true, 4.9, 'Black white', 'internal', 'Cheongdam senior mixed dog seed', '49110000-0000-4000-8000-000000000003', 'granted', 'CD-KAKAO-023', '49110000-0000-4000-8000-000000000005'),
  ('49121000-0000-4000-8000-000000000024', 'workspace-clair-cheongdam', 'CD-P-024', '아리', 'cat', 'Norwegian forest cat', '2017-12-12', 'female', true, null, 'CD-REG-024', null, '장모 관리 문진', null, true, 'active', 'breed-norwegian-forest', 'Norwegian forest cat', false, '[]'::jsonb, 8, 6, 0, true, 5.8, 'Brown tabby', 'none', 'Cheongdam senior cat seed', '49110000-0000-4000-8000-000000000003', 'granted', 'CD-KAKAO-024', '49110000-0000-4000-8000-000000000005'),
  ('49121000-0000-4000-8000-000000000025', 'workspace-clair-cheongdam', 'CD-P-025', '복실', 'dog', 'Schnauzer', '2019-04-04', 'male', true, null, 'CD-REG-025', null, null, null, true, 'active', 'breed-schnauzer', 'Schnauzer', false, '[]'::jsonb, 7, 2, 0, true, 8.2, 'Salt pepper', 'none', 'Cheongdam dog seed', '49110000-0000-4000-8000-000000000003', 'granted', 'CD-KAKAO-025', '49110000-0000-4000-8000-000000000005')
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
select
  ('49122000-0000-4000-8000-' || lpad(seq::text, 12, '0'))::uuid,
  'workspace-clair-cheongdam',
  ('49121000-0000-4000-8000-' || lpad(seq::text, 12, '0'))::uuid,
  ('49120000-0000-4000-8000-' || lpad((case when seq in (8, 14, 21) then seq - 1 else seq end)::text, 12, '0'))::uuid,
  'primary',
  true,
  true,
  'primary',
  'granted',
  true,
  0,
  '49110000-0000-4000-8000-000000000005'::uuid
from generate_series(1, 25) as seq
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

insert into public.service_categories (id, workspace_id, parent_id, name, sort_order)
values
  ('49128000-0000-4000-8000-000000000001', 'workspace-clair-cheongdam', null, '진료', 10),
  ('49128000-0000-4000-8000-000000000002', 'workspace-clair-cheongdam', null, '검사/영상', 20),
  ('49128000-0000-4000-8000-000000000003', 'workspace-clair-cheongdam', null, '처치/조제', 30),
  ('49128000-0000-4000-8000-000000000004', 'workspace-clair-cheongdam', null, '예방/입원', 40)
on conflict (id) do update
set name = excluded.name, sort_order = excluded.sort_order, updated_at = now();

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
  ('49129000-0000-4000-8000-000000000001', 'workspace-clair-cheongdam', '49128000-0000-4000-8000-000000000001', '초진 진찰', 'consultation', '초진 기본 진찰료', 20, true, true, true),
  ('49129000-0000-4000-8000-000000000002', 'workspace-clair-cheongdam', '49128000-0000-4000-8000-000000000001', '재진 진찰', 'consultation', '재진 기본 진찰료', 15, true, true, true),
  ('49129000-0000-4000-8000-000000000003', 'workspace-clair-cheongdam', '49128000-0000-4000-8000-000000000002', 'CBC 혈구검사', 'lab', '기본 혈구검사', 20, true, true, true),
  ('49129000-0000-4000-8000-000000000004', 'workspace-clair-cheongdam', '49128000-0000-4000-8000-000000000002', '혈액화학 10종', 'lab', '기본 혈액화학 검사', 25, true, true, true),
  ('49129000-0000-4000-8000-000000000005', 'workspace-clair-cheongdam', '49128000-0000-4000-8000-000000000002', '요검사', 'lab', '요검사 스틱/현미경', 20, true, true, true),
  ('49129000-0000-4000-8000-000000000006', 'workspace-clair-cheongdam', '49128000-0000-4000-8000-000000000002', 'X-ray 2컷', 'imaging', '기본 방사선 2컷', 25, true, true, true),
  ('49129000-0000-4000-8000-000000000007', 'workspace-clair-cheongdam', '49128000-0000-4000-8000-000000000002', '복부 초음파', 'imaging', '복부 초음파 검사', 35, true, true, true),
  ('49129000-0000-4000-8000-000000000008', 'workspace-clair-cheongdam', '49128000-0000-4000-8000-000000000003', '피하수액', 'treatment', '피하 수액 처치', 20, true, true, true),
  ('49129000-0000-4000-8000-000000000009', 'workspace-clair-cheongdam', '49128000-0000-4000-8000-000000000003', '귀 세정', 'treatment', '외이도 세정 처치', 15, true, true, true),
  ('49129000-0000-4000-8000-000000000010', 'workspace-clair-cheongdam', '49128000-0000-4000-8000-000000000003', '경구약 조제', 'medication', '기본 경구약 조제', 10, true, true, true),
  ('49129000-0000-4000-8000-000000000011', 'workspace-clair-cheongdam', '49128000-0000-4000-8000-000000000004', '종합백신', 'treatment', '강아지/고양이 예방접종', 10, true, true, true),
  ('49129000-0000-4000-8000-000000000012', 'workspace-clair-cheongdam', '49128000-0000-4000-8000-000000000004', '입원 1일', 'hospitalization', '일반 입원 1일', 1440, true, true, true)
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

insert into public.service_item_prices (id, workspace_id, service_item_id, price, currency, effective_from, effective_to)
values
  ('49129100-0000-4000-8000-000000000001', 'workspace-clair-cheongdam', '49129000-0000-4000-8000-000000000001', 30000, 'KRW', '2026-06-12', null),
  ('49129100-0000-4000-8000-000000000002', 'workspace-clair-cheongdam', '49129000-0000-4000-8000-000000000002', 20000, 'KRW', '2026-06-12', null),
  ('49129100-0000-4000-8000-000000000003', 'workspace-clair-cheongdam', '49129000-0000-4000-8000-000000000003', 35000, 'KRW', '2026-06-12', null),
  ('49129100-0000-4000-8000-000000000004', 'workspace-clair-cheongdam', '49129000-0000-4000-8000-000000000004', 55000, 'KRW', '2026-06-12', null),
  ('49129100-0000-4000-8000-000000000005', 'workspace-clair-cheongdam', '49129000-0000-4000-8000-000000000005', 30000, 'KRW', '2026-06-12', null),
  ('49129100-0000-4000-8000-000000000006', 'workspace-clair-cheongdam', '49129000-0000-4000-8000-000000000006', 55000, 'KRW', '2026-06-12', null),
  ('49129100-0000-4000-8000-000000000007', 'workspace-clair-cheongdam', '49129000-0000-4000-8000-000000000007', 80000, 'KRW', '2026-06-12', null),
  ('49129100-0000-4000-8000-000000000008', 'workspace-clair-cheongdam', '49129000-0000-4000-8000-000000000008', 28000, 'KRW', '2026-06-12', null),
  ('49129100-0000-4000-8000-000000000009', 'workspace-clair-cheongdam', '49129000-0000-4000-8000-000000000009', 22000, 'KRW', '2026-06-12', null),
  ('49129100-0000-4000-8000-000000000010', 'workspace-clair-cheongdam', '49129000-0000-4000-8000-000000000010', 15000, 'KRW', '2026-06-12', null),
  ('49129100-0000-4000-8000-000000000011', 'workspace-clair-cheongdam', '49129000-0000-4000-8000-000000000011', 45000, 'KRW', '2026-06-12', null),
  ('49129100-0000-4000-8000-000000000012', 'workspace-clair-cheongdam', '49129000-0000-4000-8000-000000000012', 70000, 'KRW', '2026-06-12', null)
on conflict (id) do update
set service_item_id = excluded.service_item_id, price = excluded.price, currency = excluded.currency, effective_from = excluded.effective_from, effective_to = excluded.effective_to;

insert into public.order_catalog_items (
  id,
  workspace_id,
  standard_order_id,
  source_preset_version,
  category_group,
  category_label,
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
  internal_instruction,
  tax_included,
  pricing_rule
)
values
  ('cd-consult-first', 'workspace-clair-cheongdam', 'std-consult-first', 'cheongdam-v1', 'consultation', '진찰', '초진 진찰', '초진 진찰', '초진 진찰료', array['초진','진찰'], 'active', 30000, 'per_order', array['dog','cat'], 'chart_only', false, true, null, '초진 문진 항목 확인', true, '{"priceBasis":"fixed"}'::jsonb),
  ('cd-consult-revisit', 'workspace-clair-cheongdam', 'std-consult-revisit', 'cheongdam-v1', 'consultation', '진찰', '재진 진찰', '재진 진찰', '재진 진찰료', array['재진'], 'active', 20000, 'per_order', array['dog','cat'], 'chart_only', false, true, null, null, true, '{"priceBasis":"fixed"}'::jsonb),
  ('cd-lab-cbc', 'workspace-clair-cheongdam', 'std-lab-cbc', 'cheongdam-v1', 'lab', '임상병리', 'CBC 혈구검사', 'CBC 혈구검사', 'CBC 혈구검사', array['CBC','혈구검사'], 'active', 35000, 'per_order', array['dog','cat'], 'lab', true, true, null, '채혈 후 장비 결과 입력', true, '{"priceBasis":"fixed"}'::jsonb),
  ('cd-lab-chem10', 'workspace-clair-cheongdam', 'std-lab-chem10', 'cheongdam-v1', 'lab', '임상병리', '혈액화학 10종', '혈액화학 10종', '혈액화학 10종', array['chem','혈액화학'], 'active', 55000, 'per_order', array['dog','cat'], 'lab', true, true, null, '혈청 분리 후 검사', true, '{"priceBasis":"fixed"}'::jsonb),
  ('cd-lab-ua', 'workspace-clair-cheongdam', 'std-lab-ua', 'cheongdam-v1', 'lab', '임상병리', '요검사', '요검사', '요검사', array['urinalysis','소변검사'], 'active', 30000, 'per_order', array['dog','cat'], 'lab', true, true, null, null, true, '{"priceBasis":"fixed"}'::jsonb),
  ('cd-imaging-xray2', 'workspace-clair-cheongdam', 'std-img-xray2', 'cheongdam-v1', 'imaging', '영상', 'X-ray 2컷', 'X-ray 2컷', 'X-ray 2컷', array['엑스레이','방사선'], 'active', 55000, 'per_order', array['dog','cat'], 'imaging', true, true, null, '촬영 부위와 컷 수 확인', true, '{"priceBasis":"fixed"}'::jsonb),
  ('cd-imaging-us-abdomen', 'workspace-clair-cheongdam', 'std-img-us-abdomen', 'cheongdam-v1', 'imaging', '영상', '복부 초음파', '복부 초음파', '복부 초음파', array['초음파','복초'], 'active', 80000, 'per_order', array['dog','cat'], 'imaging', true, true, null, '금식 여부 확인', true, '{"priceBasis":"fixed"}'::jsonb),
  ('cd-treatment-fluid-sc', 'workspace-clair-cheongdam', 'std-treat-fluid-sc', 'cheongdam-v1', 'treatment', '처치', '피하수액', '피하수액', '피하수액', array['수액','SC'], 'active', 28000, 'per_order', array['dog','cat'], 'treatment', true, true, null, '수액량과 부위 확인', true, '{"priceBasis":"fixed"}'::jsonb),
  ('cd-treatment-ear-clean', 'workspace-clair-cheongdam', 'std-treat-ear-clean', 'cheongdam-v1', 'treatment', '처치', '귀 세정', '귀 세정', '귀 세정', array['이어클리닝'], 'active', 22000, 'per_order', array['dog','cat'], 'treatment', true, true, null, null, true, '{"priceBasis":"fixed"}'::jsonb),
  ('cd-dispensing-oral-basic', 'workspace-clair-cheongdam', 'std-rx-oral-basic', 'cheongdam-v1', 'medication', '조제', '경구약 조제', '경구약 조제', '경구약 조제료', array['약','내복약'], 'active', 15000, 'per_order', array['dog','cat'], 'dispensing', true, true, '복약 안내문 출력', '일수와 용법 확인', true, '{"priceBasis":"fixed"}'::jsonb),
  ('cd-vaccine-core', 'workspace-clair-cheongdam', 'std-vaccine-core', 'cheongdam-v1', 'treatment', '예방', '종합백신', '종합백신', '종합백신', array['백신','예방접종'], 'active', 45000, 'per_order', array['dog','cat'], 'treatment', true, true, '접종 후 이상반응 안내', '백신 lot 별도 기록', true, '{"priceBasis":"fixed"}'::jsonb),
  ('cd-hospitalization-day', 'workspace-clair-cheongdam', 'std-hosp-day', 'cheongdam-v1', 'hospitalization', '입원', '입원 1일', '입원 1일', '입원료 1일', array['입원료'], 'active', 70000, 'per_day', array['dog','cat'], 'billing_only', false, true, null, '입원 시작 후 청구', true, '{"priceBasis":"per_day"}'::jsonb)
on conflict (id) do update
set
  standard_order_id = excluded.standard_order_id,
  source_preset_version = excluded.source_preset_version,
  category_group = excluded.category_group,
  category_label = excluded.category_label,
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
  internal_instruction = excluded.internal_instruction,
  tax_included = excluded.tax_included,
  pricing_rule = excluded.pricing_rule,
  updated_at = now();

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
  ('cd-set-basic-checkup-dog', 'workspace-clair-cheongdam', 'cheongdam-v1', 'preventive', '강아지 기본 검진 세트', '강아지 기본 검진 세트', 'active', 'included_order_sum', 0, 'per_order', true, array['dog'], '검진 결과 설명 포함', '진찰 + CBC + 혈액화학 10종'),
  ('cd-set-basic-checkup-cat', 'workspace-clair-cheongdam', 'cheongdam-v1', 'preventive', '고양이 기본 검진 세트', '고양이 기본 검진 세트', 'active', 'included_order_sum', 0, 'per_order', true, array['cat'], '고양이 스트레스 최소화', '진찰 + CBC + 혈액화학 10종'),
  ('cd-set-vomit-initial', 'workspace-clair-cheongdam', 'cheongdam-v1', 'symptom', '구토/식욕부진 초기 평가 세트', '구토/식욕부진 초기 평가 세트', 'active', 'included_order_sum', 0, 'per_order', true, array['dog','cat'], '검사 필요성 보호자 설명', '진찰 + CBC + 복부 초음파')
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
  ('cd-set-item-dog-001', 'workspace-clair-cheongdam', 'cd-set-basic-checkup-dog', 'cd-consult-first', 1, true, true, 1, 'fixed_one', 30000),
  ('cd-set-item-dog-002', 'workspace-clair-cheongdam', 'cd-set-basic-checkup-dog', 'cd-lab-cbc', 2, true, true, 1, 'fixed_one', 35000),
  ('cd-set-item-dog-003', 'workspace-clair-cheongdam', 'cd-set-basic-checkup-dog', 'cd-lab-chem10', 3, true, true, 1, 'fixed_one', 55000),
  ('cd-set-item-cat-001', 'workspace-clair-cheongdam', 'cd-set-basic-checkup-cat', 'cd-consult-first', 1, true, true, 1, 'fixed_one', 30000),
  ('cd-set-item-cat-002', 'workspace-clair-cheongdam', 'cd-set-basic-checkup-cat', 'cd-lab-cbc', 2, true, true, 1, 'fixed_one', 35000),
  ('cd-set-item-cat-003', 'workspace-clair-cheongdam', 'cd-set-basic-checkup-cat', 'cd-lab-chem10', 3, true, true, 1, 'fixed_one', 55000),
  ('cd-set-item-vomit-001', 'workspace-clair-cheongdam', 'cd-set-vomit-initial', 'cd-consult-first', 1, true, true, 1, 'fixed_one', 30000),
  ('cd-set-item-vomit-002', 'workspace-clair-cheongdam', 'cd-set-vomit-initial', 'cd-lab-cbc', 2, true, true, 1, 'fixed_one', 35000),
  ('cd-set-item-vomit-003', 'workspace-clair-cheongdam', 'cd-set-vomit-initial', 'cd-imaging-us-abdomen', 3, true, true, 1, 'fixed_one', 80000)
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

insert into public.consents (
  id,
  workspace_id,
  guardian_id,
  patient_id,
  consent_type,
  status,
  signed_at,
  consented_at,
  source_surface,
  document_version
)
select
  ('49123000-0000-4000-8000-' || lpad(((pg.seq * 10) + consent_type.seq)::text, 12, '0'))::uuid,
  'workspace-clair-cheongdam',
  pg.guardian_id,
  pg.patient_id,
  consent_type.consent_type,
  'granted',
  '2026-05-01T09:00:00+09:00'::timestamptz,
  '2026-05-01T09:00:00+09:00'::timestamptz,
  'guardian_registration',
  'cheongdam-synthetic-demo-v1'
from (
  select
    seq,
    ('49121000-0000-4000-8000-' || lpad(seq::text, 12, '0'))::uuid as patient_id,
    ('49120000-0000-4000-8000-' || lpad((case when seq in (8, 14, 21) then seq - 1 else seq end)::text, 12, '0'))::uuid as guardian_id
  from generate_series(1, 25) as seq
) as pg
cross join (
  values
    (1, 'privacy'),
    (2, 'treatment'),
    (3, 'personal_data_collection'),
    (4, 'third_party_sharing'),
    (5, 'marketing_messages')
) as consent_type(seq, consent_type)
on conflict (id) do update
set
  status = excluded.status,
  signed_at = excluded.signed_at,
  consented_at = excluded.consented_at,
  source_surface = excluded.source_surface,
  document_version = excluded.document_version;

insert into public.diagnosis_catalog (
  id,
  workspace_id,
  code,
  name,
  species,
  synonyms,
  is_active
)
values
  ('49124000-0000-4000-8000-000000000001', 'workspace-clair-cheongdam', 'CD-DX-URI-CAT', '고양이 상부호흡기 증후군', 'cat', array['재채기','콧물','허피스 의심'], true),
  ('49124000-0000-4000-8000-000000000002', 'workspace-clair-cheongdam', 'CD-DX-GE-DOG', '급성 위장염', 'dog', array['구토','설사','식욕저하'], true),
  ('49124000-0000-4000-8000-000000000003', 'workspace-clair-cheongdam', 'CD-DX-CKD-CAT', '고양이 만성 신장질환 의심', 'cat', array['다뇨','다음','신장수치'], true),
  ('49124000-0000-4000-8000-000000000004', 'workspace-clair-cheongdam', 'CD-DX-OTITIS', '외이염', null, array['귀냄새','귀가려움','ear'], true),
  ('49124000-0000-4000-8000-000000000005', 'workspace-clair-cheongdam', 'CD-DX-DERM', '알레르기성 피부염', null, array['가려움','피부발적','알러지'], true),
  ('49124000-0000-4000-8000-000000000006', 'workspace-clair-cheongdam', 'CD-DX-PL-DOG', '슬개골 탈구 의심', 'dog', array['파행','무릎','소형견'], true),
  ('49124000-0000-4000-8000-000000000007', 'workspace-clair-cheongdam', 'CD-DX-DENTAL', '치주질환', null, array['구취','스케일링','치석'], true),
  ('49124000-0000-4000-8000-000000000008', 'workspace-clair-cheongdam', 'CD-DX-FLUTD', '고양이 하부요로질환 의심', 'cat', array['빈뇨','혈뇨','배뇨곤란'], true),
  ('49124000-0000-4000-8000-000000000009', 'workspace-clair-cheongdam', 'CD-DX-COUGH-DOG', '기관지염/기침 평가', 'dog', array['기침','호흡기','켁켁'], true),
  ('49124000-0000-4000-8000-000000000010', 'workspace-clair-cheongdam', 'CD-DX-WELLNESS', '예방 검진', null, array['건강검진','백신 전 확인','wellness'], true)
on conflict (id) do update
set
  code = excluded.code,
  name = excluded.name,
  species = excluded.species,
  synonyms = excluded.synonyms,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.lab_test_categories (
  id,
  workspace_id,
  category_name,
  sort_order
)
values
  ('cd-lab-cat-hematology', 'workspace-clair-cheongdam', '혈액학', 10),
  ('cd-lab-cat-chemistry', 'workspace-clair-cheongdam', '혈액화학', 20),
  ('cd-lab-cat-urinalysis', 'workspace-clair-cheongdam', '요검사', 30)
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
  availability_status
)
values
  ('cd-lab-item-wbc', 'workspace-clair-cheongdam', 'cd-lab-cat-hematology', 'WBC', 'number', '10^3/uL', 10, 'active'),
  ('cd-lab-item-rbc', 'workspace-clair-cheongdam', 'cd-lab-cat-hematology', 'RBC', 'number', '10^6/uL', 20, 'active'),
  ('cd-lab-item-hct', 'workspace-clair-cheongdam', 'cd-lab-cat-hematology', 'HCT', 'number', '%', 30, 'active'),
  ('cd-lab-item-alt', 'workspace-clair-cheongdam', 'cd-lab-cat-chemistry', 'ALT', 'number', 'U/L', 10, 'active'),
  ('cd-lab-item-bun', 'workspace-clair-cheongdam', 'cd-lab-cat-chemistry', 'BUN', 'number', 'mg/dL', 20, 'active'),
  ('cd-lab-item-crea', 'workspace-clair-cheongdam', 'cd-lab-cat-chemistry', 'CREA', 'number', 'mg/dL', 30, 'active'),
  ('cd-lab-item-usg', 'workspace-clair-cheongdam', 'cd-lab-cat-urinalysis', 'USG', 'number', null, 10, 'active'),
  ('cd-lab-item-uph', 'workspace-clair-cheongdam', 'cd-lab-cat-urinalysis', 'pH', 'number', null, 20, 'active')
on conflict (id) do update
set
  category_id = excluded.category_id,
  test_item_name = excluded.test_item_name,
  result_input_type = excluded.result_input_type,
  result_unit = excluded.result_unit,
  sort_order = excluded.sort_order,
  availability_status = excluded.availability_status,
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
  ('cd-lab-link-cbc-wbc', 'workspace-clair-cheongdam', 'cd-lab-cbc', 'cd-lab-item-wbc', null, 10, '{"panel":"CBC"}'::jsonb),
  ('cd-lab-link-cbc-rbc', 'workspace-clair-cheongdam', 'cd-lab-cbc', 'cd-lab-item-rbc', null, 20, '{"panel":"CBC"}'::jsonb),
  ('cd-lab-link-cbc-hct', 'workspace-clair-cheongdam', 'cd-lab-cbc', 'cd-lab-item-hct', null, 30, '{"panel":"CBC"}'::jsonb),
  ('cd-lab-link-chem-alt', 'workspace-clair-cheongdam', 'cd-lab-chem10', 'cd-lab-item-alt', null, 10, '{"panel":"Chem10"}'::jsonb),
  ('cd-lab-link-chem-bun', 'workspace-clair-cheongdam', 'cd-lab-chem10', 'cd-lab-item-bun', null, 20, '{"panel":"Chem10"}'::jsonb),
  ('cd-lab-link-chem-crea', 'workspace-clair-cheongdam', 'cd-lab-chem10', 'cd-lab-item-crea', null, 30, '{"panel":"Chem10"}'::jsonb),
  ('cd-lab-link-ua-usg', 'workspace-clair-cheongdam', 'cd-lab-ua', 'cd-lab-item-usg', null, 10, '{"panel":"Urinalysis"}'::jsonb),
  ('cd-lab-link-ua-ph', 'workspace-clair-cheongdam', 'cd-lab-ua', 'cd-lab-item-uph', null, 20, '{"panel":"Urinalysis"}'::jsonb)
on conflict (id) do update
set
  order_catalog_item_id = excluded.order_catalog_item_id,
  lab_test_item_id = excluded.lab_test_item_id,
  lab_test_category_id = excluded.lab_test_category_id,
  sort_order = excluded.sort_order,
  snapshot_metadata = excluded.snapshot_metadata;
