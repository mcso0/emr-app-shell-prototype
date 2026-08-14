-- Breaks are warning-only reception periods. Closed days and treatment-hour
-- boundaries remain authoritative for appointment and walk-in writes.

create or replace function private.clair_assert_reception_time_allowed(
  p_workspace_id text,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_error_prefix text
) returns void
language plpgsql stable security definer
set search_path = public, private, pg_temp
as $$
declare
  v_timezone text;
  v_date date;
  v_schedule jsonb;
  v_start time;
  v_end time;
begin
  select timezone into v_timezone
  from public.workspaces
  where id = p_workspace_id;

  v_date := (p_start_at at time zone v_timezone)::date;
  v_start := (p_start_at at time zone v_timezone)::time;
  v_end := (p_end_at at time zone v_timezone)::time;
  v_schedule := private.clair_resolve_effective_operating_hours(
    p_workspace_id,
    v_date
  );

  if not (v_schedule->>'isOpen')::boolean then
    raise exception '%_closed_day', p_error_prefix;
  end if;

  if (p_end_at at time zone v_timezone)::date <> v_date
    or v_start < (v_schedule->>'treatmentStart')::time
    or v_end > (v_schedule->>'treatmentEnd')::time
  then
    raise exception '%_outside_business_hours', p_error_prefix;
  end if;
end;
$$;

revoke all on function private.clair_assert_reception_time_allowed(text, timestamptz, timestamptz, text) from public, anon, authenticated;

-- Operating-hours edits must not reject future appointments solely because
-- they overlap a configured break. True closed-day and treatment-hour
-- conflicts still roll back the full settings replacement transaction.
create or replace function public.clair_replace_workspace_operating_hours(
  p_workspace_id text,
  p_actor_user_id text,
  p_settings jsonb
) returns jsonb
language plpgsql security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  v_actor uuid := nullif(p_actor_user_id, '')::uuid;
  v_membership uuid;
  v_item jsonb;
  v_timezone text := coalesce(nullif(p_settings->>'timezone', ''), 'Asia/Seoul');
  v_conflicts jsonb;
begin
  if v_actor is null or v_actor <> auth.uid() then
    raise exception 'actor_mismatch';
  end if;
  if not private.clair_is_workspace_admin(p_workspace_id) then
    raise exception 'permission_missing';
  end if;
  perform now() at time zone v_timezone;

  update public.workspaces
  set
    timezone = v_timezone,
    holiday_policy = coalesce(p_settings->>'holidayPolicy', 'closed'),
    updated_at = now()
  where id = p_workspace_id;

  delete from public.workspace_operating_hours
  where workspace_id = p_workspace_id;
  for v_item in
    select value
    from jsonb_array_elements(coalesce(p_settings->'weeklyHours', '[]'::jsonb))
  loop
    insert into public.workspace_operating_hours (
      workspace_id,
      day_of_week,
      is_open,
      treatment_start,
      treatment_end,
      break_start,
      break_end
    ) values (
      p_workspace_id,
      (v_item->>'dayOfWeek')::smallint,
      (v_item->>'isOpen')::boolean,
      nullif(v_item->>'treatmentStart', '')::time,
      nullif(v_item->>'treatmentEnd', '')::time,
      nullif(v_item->>'breakStart', '')::time,
      nullif(v_item->>'breakEnd', '')::time
    );
  end loop;

  delete from public.workspace_operating_hour_exceptions
  where workspace_id = p_workspace_id;
  for v_item in
    select value
    from jsonb_array_elements(coalesce(p_settings->'exceptions', '[]'::jsonb))
  loop
    insert into public.workspace_operating_hour_exceptions (
      workspace_id,
      operating_date,
      mode,
      treatment_start,
      treatment_end,
      break_start,
      break_end,
      reason
    ) values (
      p_workspace_id,
      (v_item->>'date')::date,
      v_item->>'mode',
      nullif(v_item->>'treatmentStart', '')::time,
      nullif(v_item->>'treatmentEnd', '')::time,
      nullif(v_item->>'breakStart', '')::time,
      nullif(v_item->>'breakEnd', '')::time,
      nullif(v_item->>'reason', '')
    );
  end loop;

  select jsonb_agg(
    jsonb_build_object(
      'appointmentId',
      a.id,
      'scheduledStartAt',
      a.scheduled_start_at
    )
  )
  into v_conflicts
  from public.appointments a
  cross join lateral (
    select private.clair_resolve_effective_operating_hours(
      p_workspace_id,
      (a.scheduled_start_at at time zone v_timezone)::date
    ) value
  ) resolved
  where a.workspace_id = p_workspace_id
    and a.status in ('requested', 'confirmed', 'changed')
    and a.scheduled_start_at >= now()
    and (
      not (resolved.value->>'isOpen')::boolean
      or (a.scheduled_start_at at time zone v_timezone)::time
        < (resolved.value->>'treatmentStart')::time
      or (a.scheduled_end_at at time zone v_timezone)::time
        > (resolved.value->>'treatmentEnd')::time
    );

  if v_conflicts is not null then
    raise exception 'future_appointment_conflict:%', v_conflicts;
  end if;

  select id into v_membership
  from public.user_memberships
  where workspace_id = p_workspace_id
    and user_id = v_actor
    and status = 'active';

  perform public.clair_append_audit_event(
    'operating-hours-' || gen_random_uuid()::text,
    p_workspace_id,
    v_actor,
    v_membership,
    'hospital.operating_hours_updated',
    'workspace',
    p_workspace_id,
    p_after_snapshot => p_settings
  );

  return public.clair_get_workspace_operating_hours(p_workspace_id);
end;
$$;

revoke all on function public.clair_replace_workspace_operating_hours(text, text, jsonb) from public, anon;
grant execute on function public.clair_replace_workspace_operating_hours(text, text, jsonb) to authenticated;

comment on function public.clair_replace_workspace_operating_hours(text, text, jsonb) is
  'Admin-only atomic operating-hours replacement. Closed-day and treatment-hour conflicts roll back; configured breaks allow warning-confirmed reception writes.';
