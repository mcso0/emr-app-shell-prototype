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
