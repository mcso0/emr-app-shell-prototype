-- RECEPTION-PR-008: read-only, workspace-scoped staff operational status.
-- Schedule and time-clock facts remain the source of truth; this function derives
-- a current label without persisting minute-by-minute status mutations.

create or replace function public.reception_staff_operational_status_snapshot(
  p_workspace_id text,
  p_day date
) returns jsonb
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare
  seoul_now timestamp := timezone('Asia/Seoul', now());
  seoul_today date := seoul_now::date;
  current_minutes integer := extract(hour from seoul_now)::integer * 60
    + extract(minute from seoul_now)::integer;
  target_minutes integer;
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception using
      errcode = '42501',
      message = 'reception_staff_status_workspace_membership_required';
  end if;

  target_minutes := case
    when p_day < seoul_today then 1440
    when p_day > seoul_today then -1
    else current_minutes
  end;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'userId', staff.user_id,
        'statusCode', case
          when relevant_shift.shift_id is null then 'unknown'
          when relevant_shift.shift_kind = 'leave' then 'leave'
          when relevant_shift.shift_kind = 'off' then 'off'
          when latest_clock.clock_out_at is not null then 'clocked_out'
          when target_minutes >= relevant_shift.end_minutes then 'shift_ended'
          when target_minutes < relevant_shift.start_minutes then 'scheduled'
          else 'available'
        end,
        'source', case
          when latest_clock.clock_out_at is not null then 'time_clock'
          else 'schedule'
        end
      ) order by staff.user_id
    )
    from (
      select profile.id as profile_id, membership.user_id
      from public.hospital_schedule_staff_profiles profile
      join public.user_memberships membership
        on membership.id = profile.membership_id
       and membership.workspace_id = p_workspace_id
       and membership.status = 'active'
      join public.users app_user
        on app_user.id = membership.user_id
       and app_user.status = 'active'
      where profile.workspace_id = p_workspace_id
        and profile.operational_role = 'veterinarian'
    ) staff
    left join lateral (
      select
        shift.id as shift_id,
        shift.start_minutes,
        shift.end_minutes,
        shift.shift_kind
      from public.hospital_schedule_shifts shift
      join public.hospital_schedule_weeks schedule_week
        on schedule_week.id = shift.schedule_week_id
       and schedule_week.workspace_id = p_workspace_id
       and schedule_week.publication_state in ('published', 'changed')
      where shift.workspace_id = p_workspace_id
        and shift.staff_profile_id = staff.profile_id
        and shift.shift_date = p_day
      order by
        case
          when target_minutes between shift.start_minutes and shift.end_minutes - 1 then 0
          when target_minutes < shift.start_minutes then 1
          else 2
        end,
        case when target_minutes < shift.start_minutes then shift.start_minutes end,
        shift.end_minutes desc
      limit 1
    ) relevant_shift on true
    left join lateral (
      select entry.clock_out_at
      from public.hospital_time_clock_entries entry
      where entry.workspace_id = p_workspace_id
        and entry.staff_profile_id = staff.profile_id
        and entry.shift_id = relevant_shift.shift_id
      order by entry.clock_in_at desc
      limit 1
    ) latest_clock on true
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.reception_staff_operational_status_snapshot(text, date)
  from public, anon;
grant execute on function public.reception_staff_operational_status_snapshot(text, date)
  to authenticated;
