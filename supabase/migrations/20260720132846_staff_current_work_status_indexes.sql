-- Query indexes for role-agnostic staff current-work reads.
-- Remote migration history version: 20260720132846.

create index if not exists hospital_schedule_staff_profiles_membership_idx
  on public.hospital_schedule_staff_profiles (membership_id);

create index if not exists hospital_schedule_shifts_staff_day_idx
  on public.hospital_schedule_shifts (staff_profile_id, shift_date);

create index if not exists encounters_current_primary_veterinarian_idx
  on public.encounters (workspace_id, primary_veterinarian_id, checked_in_at desc)
  where status = 'in_consultation';
