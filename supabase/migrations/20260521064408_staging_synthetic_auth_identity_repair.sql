-- DEN-200: repair synthetic Supabase Auth email identities for staging login smoke.
-- This is synthetic fixture-only auth repair. It does not create real users or provider secrets.

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
where exists (
  select 1
  from auth.users users
  where users.id = synthetic_users.id
    and users.email = synthetic_users.email
)
on conflict (provider_id, provider) do update
set
  user_id = excluded.user_id,
  identity_data = excluded.identity_data,
  updated_at = now();
