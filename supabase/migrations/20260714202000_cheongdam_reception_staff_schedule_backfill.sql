-- RECEPTION-PR-008 production-demo follow-up.
-- Add only synthetic Cheongdam schedule/time-clock facts for the six veterinarians
-- selected in the 2026-07-14 reception scenario. This is idempotent demo data.

with selected_staff(user_id) as (
  values
    ('49110000-0000-4000-8000-000000000003'::uuid),
    ('49110000-0000-4000-8000-000000000006'::uuid),
    ('49110000-0000-4000-8000-000000000007'::uuid),
    ('49110000-0000-4000-8000-000000000008'::uuid),
    ('49110000-0000-4000-8000-000000000010'::uuid),
    ('49110000-0000-4000-8000-000000000011'::uuid)
)
insert into public.hospital_schedule_staff_profiles (
  workspace_id,
  membership_id,
  operational_role,
  hourly_rate_cents,
  availability
)
select
  membership.workspace_id,
  membership.id,
  'veterinarian',
  0,
  '{}'::jsonb
from public.user_memberships membership
join selected_staff on selected_staff.user_id = membership.user_id
where membership.workspace_id = 'workspace-clair-cheongdam'
  and membership.status = 'active'
  and membership.roles @> array['vet']::text[]
on conflict (workspace_id, membership_id) do nothing;

insert into public.hospital_schedule_weeks (
  workspace_id,
  week_start,
  publication_state,
  published_at
)
values (
  'workspace-clair-cheongdam',
  date '2026-07-13',
  'published',
  timestamptz '2026-07-13 09:00:00+09'
)
on conflict (workspace_id, week_start) do update
set
  publication_state = 'published',
  published_at = coalesce(public.hospital_schedule_weeks.published_at, excluded.published_at),
  updated_at = now();

with selected_staff(user_id) as (
  values
    ('49110000-0000-4000-8000-000000000003'::uuid),
    ('49110000-0000-4000-8000-000000000006'::uuid),
    ('49110000-0000-4000-8000-000000000007'::uuid),
    ('49110000-0000-4000-8000-000000000008'::uuid),
    ('49110000-0000-4000-8000-000000000010'::uuid),
    ('49110000-0000-4000-8000-000000000011'::uuid)
)
insert into public.hospital_schedule_shifts (
  workspace_id,
  schedule_week_id,
  staff_profile_id,
  shift_date,
  start_minutes,
  end_minutes,
  shift_kind,
  work_label,
  location_label,
  note
)
select
  'workspace-clair-cheongdam',
  schedule_week.id,
  profile.id,
  date '2026-07-14',
  540,
  1140,
  'clinical',
  '진료',
  '진료실',
  '2026-07-14 청담 접수 합성 시나리오'
from selected_staff
join public.user_memberships membership
  on membership.workspace_id = 'workspace-clair-cheongdam'
 and membership.user_id = selected_staff.user_id
 and membership.status = 'active'
join public.hospital_schedule_staff_profiles profile
  on profile.workspace_id = membership.workspace_id
 and profile.membership_id = membership.id
join public.hospital_schedule_weeks schedule_week
  on schedule_week.workspace_id = membership.workspace_id
 and schedule_week.week_start = date '2026-07-13'
where not exists (
  select 1
  from public.hospital_schedule_shifts existing_shift
  where existing_shift.workspace_id = membership.workspace_id
    and existing_shift.staff_profile_id = profile.id
    and existing_shift.shift_date = date '2026-07-14'
    and existing_shift.start_minutes = 540
    and existing_shift.end_minutes = 1140
);

insert into public.hospital_time_clock_entries (
  workspace_id,
  staff_profile_id,
  shift_id,
  clock_in_at,
  clock_out_at
)
select
  shift.workspace_id,
  shift.staff_profile_id,
  shift.id,
  timestamptz '2026-07-14 09:00:00+09',
  timestamptz '2026-07-14 19:00:00+09'
from public.hospital_schedule_shifts shift
join public.hospital_schedule_staff_profiles profile
  on profile.id = shift.staff_profile_id
join public.user_memberships membership
  on membership.id = profile.membership_id
where shift.workspace_id = 'workspace-clair-cheongdam'
  and shift.shift_date = date '2026-07-14'
  and shift.start_minutes = 540
  and shift.end_minutes = 1140
  and membership.user_id in (
    '49110000-0000-4000-8000-000000000003'::uuid,
    '49110000-0000-4000-8000-000000000006'::uuid,
    '49110000-0000-4000-8000-000000000007'::uuid,
    '49110000-0000-4000-8000-000000000008'::uuid,
    '49110000-0000-4000-8000-000000000010'::uuid,
    '49110000-0000-4000-8000-000000000011'::uuid
  )
  and not exists (
    select 1
    from public.hospital_time_clock_entries existing_entry
    where existing_entry.workspace_id = shift.workspace_id
      and existing_entry.shift_id = shift.id
  );
