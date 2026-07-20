-- role_agnostic_staff_current_work_status
-- Remote migration history version: 20260720132051.
-- Every active workspace member can have a published shift and a truthful
-- current-work state. Reception assignments remain outside this read model.

alter table public.hospital_schedule_staff_profiles
  drop constraint if exists hospital_schedule_staff_profiles_operational_role_check;

alter table public.hospital_schedule_staff_profiles
  add constraint hospital_schedule_staff_profiles_operational_role_check
  check (operational_role in ('veterinarian', 'technician', 'reception', 'member'));

alter table public.hospital_schedule_shifts
  add column if not exists leave_subtype text;

alter table public.hospital_schedule_shifts
  drop constraint if exists hospital_schedule_shifts_leave_subtype_check;

alter table public.hospital_schedule_shifts
  add constraint hospital_schedule_shifts_leave_subtype_check
  check (
    leave_subtype is null
    or (shift_kind = 'leave' and leave_subtype in ('annual', 'same_day'))
  );

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
  case
    when membership.roles @> array['vet']::text[] then 'veterinarian'
    when membership.roles @> array['technician']::text[] then 'technician'
    when membership.roles @> array['front_desk']::text[] then 'reception'
    else 'member'
  end,
  0,
  '{}'::jsonb
from public.user_memberships membership
join public.users app_user
  on app_user.id = membership.user_id
 and app_user.status = 'active'
where membership.status = 'active'
on conflict (workspace_id, membership_id) do update
set
  operational_role = excluded.operational_role,
  updated_at = now();

create or replace function private.clair_sync_schedule_profile_for_membership()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if new.status <> 'active' then
    return new;
  end if;

  insert into public.hospital_schedule_staff_profiles (
    workspace_id,
    membership_id,
    operational_role,
    hourly_rate_cents,
    availability
  ) values (
    new.workspace_id,
    new.id,
    case
      when new.roles @> array['vet']::text[] then 'veterinarian'
      when new.roles @> array['technician']::text[] then 'technician'
      when new.roles @> array['front_desk']::text[] then 'reception'
      else 'member'
    end,
    0,
    '{}'::jsonb
  )
  on conflict (workspace_id, membership_id) do update
  set
    operational_role = excluded.operational_role,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists user_membership_schedule_profile_sync
  on public.user_memberships;
create trigger user_membership_schedule_profile_sync
after insert or update of status, roles on public.user_memberships
for each row execute function private.clair_sync_schedule_profile_for_membership();

create or replace function private.clair_staff_current_work_status_snapshot(
  p_workspace_id text,
  p_user_id text,
  p_day date
) returns jsonb
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid := nullif(p_user_id, '')::uuid;
  v_staff_profile_id uuid;
  v_timezone text;
  v_local_now timestamp;
  v_local_today date;
  v_target_minutes integer;
  v_operating_schedule jsonb;
  v_shift record;
  v_clock_out_at timestamptz;
  v_room_name text;
  v_state text;
  v_source text := 'schedule';
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception using
      errcode = '42501',
      message = 'staff_current_work_workspace_membership_required';
  end if;

  select profile.id, workspace.timezone
    into v_staff_profile_id, v_timezone
  from public.user_memberships membership
  join public.users app_user
    on app_user.id = membership.user_id
   and app_user.status = 'active'
  join public.workspaces workspace
    on workspace.id = membership.workspace_id
  left join public.hospital_schedule_staff_profiles profile
    on profile.workspace_id = membership.workspace_id
   and profile.membership_id = membership.id
  where membership.workspace_id = p_workspace_id
    and membership.user_id = v_user_id
    and membership.status = 'active';

  if v_timezone is null then
    return null;
  end if;

  v_local_now := timezone(v_timezone, now());
  v_local_today := v_local_now::date;
  v_target_minutes := case
    when p_day < v_local_today then 1440
    when p_day > v_local_today then -1
    else extract(hour from v_local_now)::integer * 60
      + extract(minute from v_local_now)::integer
  end;
  v_operating_schedule := private.clair_resolve_effective_operating_hours(
    p_workspace_id,
    p_day
  );

  select
    shift.id,
    shift.start_minutes,
    shift.end_minutes,
    shift.shift_kind,
    shift.leave_subtype
    into v_shift
  from public.hospital_schedule_shifts shift
  join public.hospital_schedule_weeks schedule_week
    on schedule_week.id = shift.schedule_week_id
   and schedule_week.workspace_id = p_workspace_id
   and schedule_week.publication_state in ('published', 'changed')
  where shift.workspace_id = p_workspace_id
    and shift.staff_profile_id = v_staff_profile_id
    and shift.shift_date = p_day
  order by
    case when shift.shift_kind in ('leave', 'off') then 0 else 1 end,
    case
      when v_target_minutes between shift.start_minutes and shift.end_minutes - 1 then 0
      when v_target_minutes < shift.start_minutes then 1
      else 2
    end,
    shift.start_minutes
  limit 1;

  if v_shift.id is null then
    if coalesce((v_operating_schedule->>'isOpen')::boolean, false) = false then
      return jsonb_build_object(
        'date', p_day,
        'state', 'hospital_closed',
        'startMinutes', null,
        'endMinutes', null,
        'detailLabel', null,
        'source', 'operating_hours'
      );
    end if;
    return null;
  end if;

  if v_shift.shift_kind = 'leave' then
    v_state := case
      when v_shift.leave_subtype = 'same_day' then 'same_day_leave'
      else 'leave'
    end;
  elsif v_shift.shift_kind = 'off' then
    v_state := 'off';
  else
    select entry.clock_out_at
      into v_clock_out_at
    from public.hospital_time_clock_entries entry
    where entry.workspace_id = p_workspace_id
      and entry.staff_profile_id = v_staff_profile_id
      and entry.shift_id = v_shift.id
    order by entry.clock_in_at desc
    limit 1;

    if v_clock_out_at is not null then
      v_state := 'clocked_out';
      v_source := 'time_clock';
    else
      select call_event.room_name
        into v_room_name
      from public.encounters encounter
      join public.encounter_call_events call_event
        on call_event.workspace_id = encounter.workspace_id
       and call_event.encounter_id = encounter.id
      where encounter.workspace_id = p_workspace_id
        and encounter.primary_veterinarian_id = v_user_id
        and encounter.status = 'in_consultation'
        and timezone(v_timezone, encounter.checked_in_at)::date = p_day
        and nullif(trim(call_event.room_name), '') is not null
      order by call_event.created_at desc
      limit 1;

      if v_room_name is not null then
        v_state := 'in_consultation';
        v_source := 'encounter';
      elsif v_target_minutes >= v_shift.end_minutes then
        v_state := 'shift_ended';
      elsif v_target_minutes < v_shift.start_minutes then
        v_state := 'scheduled';
      else
        v_state := 'working';
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'date', p_day,
    'state', v_state,
    'startMinutes', v_shift.start_minutes,
    'endMinutes', v_shift.end_minutes,
    'detailLabel', case when v_state = 'in_consultation' then v_room_name else null end,
    'source', v_source
  );
end;
$$;

revoke all on function private.clair_staff_current_work_status_snapshot(text, text, date)
  from public, anon;
grant execute on function private.clair_staff_current_work_status_snapshot(text, text, date)
  to authenticated;

create or replace function public.staff_current_work_status_snapshot(
  p_workspace_id text,
  p_user_id text,
  p_day date
) returns jsonb
language sql
stable
security invoker
set search_path = public, private, pg_temp
as $$
  select private.clair_staff_current_work_status_snapshot(
    p_workspace_id,
    p_user_id,
    p_day
  );
$$;

revoke all on function public.staff_current_work_status_snapshot(text, text, date)
  from public, anon;
grant execute on function public.staff_current_work_status_snapshot(text, text, date)
  to authenticated;

-- Synthetic Cheongdam demo: publish the current scenario week for every active
-- member so profile cards demonstrate role-agnostic work information.
insert into public.hospital_schedule_weeks (
  workspace_id,
  week_start,
  publication_state,
  published_at
)
values (
  'workspace-clair-cheongdam',
  date '2026-07-20',
  'published',
  timestamptz '2026-07-20 09:00:00+09'
)
on conflict (workspace_id, week_start) do update
set
  publication_state = 'published',
  published_at = coalesce(public.hospital_schedule_weeks.published_at, excluded.published_at),
  updated_at = now();

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
  membership.workspace_id,
  schedule_week.id,
  profile.id,
  date '2026-07-20',
  540,
  1140,
  case profile.operational_role
    when 'veterinarian' then 'clinical'
    when 'reception' then 'reception'
    else 'support'
  end,
  case profile.operational_role
    when 'veterinarian' then '진료'
    when 'reception' then '접수'
    else '지원'
  end,
  null,
  '2026-07-20 청담 전체 직원 합성 근무 시나리오'
from public.user_memberships membership
join public.users app_user
  on app_user.id = membership.user_id
 and app_user.status = 'active'
join public.hospital_schedule_staff_profiles profile
  on profile.workspace_id = membership.workspace_id
 and profile.membership_id = membership.id
join public.hospital_schedule_weeks schedule_week
  on schedule_week.workspace_id = membership.workspace_id
 and schedule_week.week_start = date '2026-07-20'
where membership.workspace_id = 'workspace-clair-cheongdam'
  and membership.status = 'active'
  and not exists (
    select 1
    from public.hospital_schedule_shifts existing_shift
    where existing_shift.workspace_id = membership.workspace_id
      and existing_shift.staff_profile_id = profile.id
      and existing_shift.shift_date = date '2026-07-20'
  );
