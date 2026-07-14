-- HOSPITAL-ADMIN-LIVE-PR-012: authoritative workspace operating hours.

alter table public.workspaces
  add column if not exists timezone text not null default 'Asia/Seoul',
  add column if not exists holiday_policy text not null default 'closed'
    check (holiday_policy in ('closed', 'weekday', 'custom'));

create table public.workspace_operating_hours (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  is_open boolean not null default true,
  treatment_start time,
  treatment_end time,
  break_start time,
  break_end time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, day_of_week),
  constraint workspace_operating_hours_treatment_check check (
    (not is_open and treatment_start is null and treatment_end is null)
    or (is_open and treatment_start is not null and treatment_end is not null and treatment_start < treatment_end)
  ),
  constraint workspace_operating_hours_break_check check (
    (break_start is null and break_end is null)
    or (is_open and break_start is not null and break_end is not null
      and treatment_start <= break_start and break_start < break_end and break_end <= treatment_end)
  )
);

create table public.workspace_operating_hour_exceptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  operating_date date not null,
  mode text not null check (mode in ('closed', 'custom')),
  treatment_start time,
  treatment_end time,
  break_start time,
  break_end time,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, operating_date),
  constraint workspace_operating_hour_exceptions_treatment_check check (
    (mode = 'closed' and treatment_start is null and treatment_end is null)
    or (mode = 'custom' and treatment_start is not null and treatment_end is not null and treatment_start < treatment_end)
  ),
  constraint workspace_operating_hour_exceptions_break_check check (
    (break_start is null and break_end is null)
    or (mode = 'custom' and break_start is not null and break_end is not null
      and treatment_start <= break_start and break_start < break_end and break_end <= treatment_end)
  )
);

create index workspace_operating_hours_workspace_idx
  on public.workspace_operating_hours (workspace_id, day_of_week);
create index workspace_operating_hour_exceptions_workspace_date_idx
  on public.workspace_operating_hour_exceptions (workspace_id, operating_date);

insert into public.workspace_operating_hours (
  workspace_id, day_of_week, is_open, treatment_start, treatment_end, break_start, break_end
)
select w.id, day.day_of_week, day.day_of_week < 6,
  case when day.day_of_week < 6 then time '09:00' end,
  case when day.day_of_week = 5 then time '17:00' when day.day_of_week < 5 then time '19:00' end,
  case when day.day_of_week = 5 then time '12:30' when day.day_of_week < 5 then time '13:00' end,
  case when day.day_of_week = 5 then time '13:30' when day.day_of_week < 5 then time '14:00' end
from public.workspaces w
cross join generate_series(0, 6) as day(day_of_week)
on conflict (workspace_id, day_of_week) do nothing;

alter table public.workspace_operating_hours enable row level security;
alter table public.workspace_operating_hour_exceptions enable row level security;

create policy workspace_operating_hours_member_select
on public.workspace_operating_hours for select to authenticated
using (private.clair_is_active_workspace_member(workspace_id));
create policy workspace_operating_hours_admin_insert
on public.workspace_operating_hours for insert to authenticated
with check (private.clair_is_workspace_admin(workspace_id));
create policy workspace_operating_hours_admin_update
on public.workspace_operating_hours for update to authenticated
using (private.clair_is_workspace_admin(workspace_id))
with check (private.clair_is_workspace_admin(workspace_id));
create policy workspace_operating_hours_admin_delete
on public.workspace_operating_hours for delete to authenticated
using (private.clair_is_workspace_admin(workspace_id));

create policy workspace_operating_hour_exceptions_member_select
on public.workspace_operating_hour_exceptions for select to authenticated
using (private.clair_is_active_workspace_member(workspace_id));
create policy workspace_operating_hour_exceptions_admin_insert
on public.workspace_operating_hour_exceptions for insert to authenticated
with check (private.clair_is_workspace_admin(workspace_id));
create policy workspace_operating_hour_exceptions_admin_update
on public.workspace_operating_hour_exceptions for update to authenticated
using (private.clair_is_workspace_admin(workspace_id))
with check (private.clair_is_workspace_admin(workspace_id));
create policy workspace_operating_hour_exceptions_admin_delete
on public.workspace_operating_hour_exceptions for delete to authenticated
using (private.clair_is_workspace_admin(workspace_id));

revoke all privileges on table public.workspace_operating_hours from public, anon, authenticated;
revoke all privileges on table public.workspace_operating_hour_exceptions from public, anon, authenticated;
grant select on table public.workspace_operating_hours to authenticated;
grant select on table public.workspace_operating_hour_exceptions to authenticated;
grant insert, update, delete on table public.workspace_operating_hours to authenticated;
grant insert, update, delete on table public.workspace_operating_hour_exceptions to authenticated;

create or replace function private.clair_resolve_effective_operating_hours(
  p_workspace_id text,
  p_operating_date date
) returns jsonb
language plpgsql stable security definer
set search_path = public, private, pg_temp
as $$
declare
  v_timezone text;
  v_exception public.workspace_operating_hour_exceptions%rowtype;
  v_weekly public.workspace_operating_hours%rowtype;
begin
  select w.timezone into v_timezone from public.workspaces w where w.id = p_workspace_id;
  if v_timezone is null then raise exception 'workspace_not_found'; end if;

  select * into v_exception
  from public.workspace_operating_hour_exceptions e
  where e.workspace_id = p_workspace_id and e.operating_date = p_operating_date;

  if found then
    return jsonb_build_object(
      'date', p_operating_date, 'timezone', v_timezone,
      'isOpen', v_exception.mode = 'custom', 'source', 'exception',
      'treatmentStart', to_char(v_exception.treatment_start, 'HH24:MI'),
      'treatmentEnd', to_char(v_exception.treatment_end, 'HH24:MI'),
      'breakStart', to_char(v_exception.break_start, 'HH24:MI'),
      'breakEnd', to_char(v_exception.break_end, 'HH24:MI')
    );
  end if;

  select * into v_weekly
  from public.workspace_operating_hours h
  where h.workspace_id = p_workspace_id
    and h.day_of_week = extract(isodow from p_operating_date)::integer - 1;

  return jsonb_build_object(
    'date', p_operating_date, 'timezone', v_timezone,
    'isOpen', coalesce(v_weekly.is_open, false), 'source', 'weekly',
    'treatmentStart', to_char(v_weekly.treatment_start, 'HH24:MI'),
    'treatmentEnd', to_char(v_weekly.treatment_end, 'HH24:MI'),
    'breakStart', to_char(v_weekly.break_start, 'HH24:MI'),
    'breakEnd', to_char(v_weekly.break_end, 'HH24:MI')
  );
end;
$$;

create or replace function public.clair_get_effective_operating_hours(
  p_workspace_id text, p_operating_date date
) returns jsonb
language plpgsql stable security definer
set search_path = public, private, pg_temp
as $$
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;
  return private.clair_resolve_effective_operating_hours(p_workspace_id, p_operating_date);
end;
$$;

create or replace function public.clair_get_workspace_operating_hours(p_workspace_id text)
returns jsonb
language plpgsql stable security definer
set search_path = public, private, pg_temp
as $$
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;
  return jsonb_build_object(
    'timezone', (select timezone from public.workspaces where id = p_workspace_id),
    'holidayPolicy', (select holiday_policy from public.workspaces where id = p_workspace_id),
    'weeklyHours', coalesce((select jsonb_agg(jsonb_build_object(
      'dayOfWeek', day_of_week, 'isOpen', is_open,
      'treatmentStart', to_char(treatment_start, 'HH24:MI'),
      'treatmentEnd', to_char(treatment_end, 'HH24:MI'),
      'breakStart', to_char(break_start, 'HH24:MI'),
      'breakEnd', to_char(break_end, 'HH24:MI')
    ) order by day_of_week) from public.workspace_operating_hours where workspace_id = p_workspace_id), '[]'::jsonb),
    'exceptions', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'date', operating_date, 'mode', mode,
      'treatmentStart', to_char(treatment_start, 'HH24:MI'),
      'treatmentEnd', to_char(treatment_end, 'HH24:MI'),
      'breakStart', to_char(break_start, 'HH24:MI'),
      'breakEnd', to_char(break_end, 'HH24:MI'), 'reason', reason
    ) order by operating_date) from public.workspace_operating_hour_exceptions where workspace_id = p_workspace_id), '[]'::jsonb)
  );
end;
$$;

alter table public.audit_events drop constraint if exists audit_events_event_type_check;
alter table public.audit_events add constraint audit_events_event_type_check check (event_type in (
  'workspace.created','workspace.invitation_created','workspace.invitation_resent','workspace.invitation_canceled',
  'workspace.invitation_accepted','workspace.membership_roles_changed','workspace.role_catalog_changed',
  'workspace.membership_status_changed','workspace.membership_soft_deleted','workspace.membership_restored',
  'workspace.last_admin_change_blocked','user.profile_updated','reception.patient_guardian_registered',
  'reception.walk_in_created','reception.appointment_created','reception.appointment_checked_in',
  'reception.appointment_restored','reception.encounter_cancelled','reception.encounter_restored',
  'reception.encounter_updated','reception.queue_status_changed','chart.patient_called','chart.consultation_started',
  'chart.consultation_returned_to_waiting','chart.soap_saved','chart.completed','diagnosis.changed',
  'order.draft_changed','order.confirmed','order.billing_candidate_requested','order.status_changed',
  'order_catalog.created','order_catalog.updated','order_catalog.paused','billing.invoice_candidate_generated',
  'billing.invoice_line_changed','billing.invoice_issued','billing.payment_state_changed','billing.refund_requested',
  'hospital.operating_hours_updated'
));

create or replace function public.clair_replace_workspace_operating_hours(
  p_workspace_id text, p_actor_user_id text, p_settings jsonb
) returns jsonb
language plpgsql security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  v_actor uuid := nullif(p_actor_user_id, '')::uuid;
  v_membership uuid;
  v_item jsonb;
  v_schedule jsonb;
  v_timezone text := coalesce(nullif(p_settings->>'timezone', ''), 'Asia/Seoul');
  v_conflicts jsonb;
begin
  if v_actor is null or v_actor <> auth.uid() then raise exception 'actor_mismatch'; end if;
  if not private.clair_is_workspace_admin(p_workspace_id) then raise exception 'permission_missing'; end if;
  perform now() at time zone v_timezone;

  update public.workspaces set
    timezone = v_timezone,
    holiday_policy = coalesce(p_settings->>'holidayPolicy', 'closed'),
    updated_at = now()
  where id = p_workspace_id;

  delete from public.workspace_operating_hours where workspace_id = p_workspace_id;
  for v_item in select value from jsonb_array_elements(coalesce(p_settings->'weeklyHours', '[]'::jsonb)) loop
    insert into public.workspace_operating_hours (
      workspace_id, day_of_week, is_open, treatment_start, treatment_end, break_start, break_end
    ) values (
      p_workspace_id, (v_item->>'dayOfWeek')::smallint, (v_item->>'isOpen')::boolean,
      nullif(v_item->>'treatmentStart', '')::time, nullif(v_item->>'treatmentEnd', '')::time,
      nullif(v_item->>'breakStart', '')::time, nullif(v_item->>'breakEnd', '')::time
    );
  end loop;

  delete from public.workspace_operating_hour_exceptions where workspace_id = p_workspace_id;
  for v_item in select value from jsonb_array_elements(coalesce(p_settings->'exceptions', '[]'::jsonb)) loop
    insert into public.workspace_operating_hour_exceptions (
      workspace_id, operating_date, mode, treatment_start, treatment_end, break_start, break_end, reason
    ) values (
      p_workspace_id, (v_item->>'date')::date, v_item->>'mode',
      nullif(v_item->>'treatmentStart', '')::time, nullif(v_item->>'treatmentEnd', '')::time,
      nullif(v_item->>'breakStart', '')::time, nullif(v_item->>'breakEnd', '')::time,
      nullif(v_item->>'reason', '')
    );
  end loop;

  select jsonb_agg(jsonb_build_object('appointmentId', a.id, 'scheduledStartAt', a.scheduled_start_at))
  into v_conflicts
  from public.appointments a
  cross join lateral (select private.clair_resolve_effective_operating_hours(
    p_workspace_id, (a.scheduled_start_at at time zone v_timezone)::date
  ) value) resolved
  where a.workspace_id = p_workspace_id
    and a.status in ('requested', 'confirmed', 'changed')
    and a.scheduled_start_at >= now()
    and (
      not (resolved.value->>'isOpen')::boolean
      or (a.scheduled_start_at at time zone v_timezone)::time < (resolved.value->>'treatmentStart')::time
      or (a.scheduled_end_at at time zone v_timezone)::time > (resolved.value->>'treatmentEnd')::time
      or ((resolved.value->>'breakStart') is not null and
        (a.scheduled_start_at at time zone v_timezone)::time < (resolved.value->>'breakEnd')::time and
        (a.scheduled_end_at at time zone v_timezone)::time > (resolved.value->>'breakStart')::time)
    );
  if v_conflicts is not null then raise exception 'future_appointment_conflict:%', v_conflicts; end if;

  select id into v_membership from public.user_memberships
  where workspace_id = p_workspace_id and user_id = v_actor and status = 'active';
  perform public.clair_append_audit_event(
    'operating-hours-' || gen_random_uuid()::text, p_workspace_id, v_actor, v_membership,
    'hospital.operating_hours_updated', 'workspace', p_workspace_id,
    p_after_snapshot => p_settings
  );
  return public.clair_get_workspace_operating_hours(p_workspace_id);
end;
$$;

create or replace function private.clair_assert_reception_time_allowed(
  p_workspace_id text, p_start_at timestamptz, p_end_at timestamptz, p_error_prefix text
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
  select timezone into v_timezone from public.workspaces where id = p_workspace_id;
  v_date := (p_start_at at time zone v_timezone)::date;
  v_start := (p_start_at at time zone v_timezone)::time;
  v_end := (p_end_at at time zone v_timezone)::time;
  v_schedule := private.clair_resolve_effective_operating_hours(p_workspace_id, v_date);
  if not (v_schedule->>'isOpen')::boolean then raise exception '%_closed_day', p_error_prefix; end if;
  if (p_end_at at time zone v_timezone)::date <> v_date
    or v_start < (v_schedule->>'treatmentStart')::time
    or v_end > (v_schedule->>'treatmentEnd')::time
    or ((v_schedule->>'breakStart') is not null and
      v_start < (v_schedule->>'breakEnd')::time and v_end > (v_schedule->>'breakStart')::time)
  then raise exception '%_outside_business_hours', p_error_prefix; end if;
end;
$$;

-- Stable public error codes: appointment_outside_business_hours and walk_in_outside_business_hours.

-- Walk-in writes keep the existing private atomic implementation and add the shared schedule guard.
create or replace function public.clair_create_reception_walk_in_encounter(
  p_workspace_id text, p_actor_user_id text, p_walk_in jsonb
) returns jsonb
language plpgsql security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  v_actor uuid := nullif(p_actor_user_id, '')::uuid;
  v_start timestamptz := coalesce(nullif(p_walk_in->>'plannedStartAt', '')::timestamptz, now());
  v_duration integer := coalesce(nullif(p_walk_in->>'durationMinutes', '')::integer, 30);
begin
  if v_actor is null or v_actor <> auth.uid() then raise exception 'actor_mismatch'; end if;
  if not private.clair_is_active_workspace_member(p_workspace_id) then raise exception 'workspace_membership_missing'; end if;
  if not private.clair_current_user_has_workspace_permission(p_workspace_id, 'reception:create') then raise exception 'permission_missing'; end if;
  perform private.clair_assert_reception_time_allowed(
    p_workspace_id, v_start, v_start + make_interval(mins => v_duration), 'walk_in'
  );
  return private.clair_create_reception_walk_in_encounter_internal(p_workspace_id, p_actor_user_id, p_walk_in);
end;
$$;

revoke all on function private.clair_resolve_effective_operating_hours(text, date) from public, anon, authenticated;
revoke all on function private.clair_assert_reception_time_allowed(text, timestamptz, timestamptz, text) from public, anon, authenticated;
revoke all on function public.clair_get_effective_operating_hours(text, date) from public, anon;
revoke all on function public.clair_get_workspace_operating_hours(text) from public, anon;
revoke all on function public.clair_replace_workspace_operating_hours(text, text, jsonb) from public, anon;
revoke all on function public.clair_create_reception_walk_in_encounter(text, text, jsonb) from public, anon;
grant execute on function public.clair_get_effective_operating_hours(text, date) to authenticated;
grant execute on function public.clair_get_workspace_operating_hours(text) to authenticated;
grant execute on function public.clair_replace_workspace_operating_hours(text, text, jsonb) to authenticated;
grant execute on function public.clair_create_reception_walk_in_encounter(text, text, jsonb) to authenticated;

comment on table public.workspace_operating_hours is 'Weekly workspace operating hours; day_of_week 0 is Monday.';
comment on function public.clair_replace_workspace_operating_hours(text, text, jsonb) is
  'Admin-only atomic operating-hours replacement. Future appointment conflicts roll back the transaction.';

alter function public.clair_list_reception_day_calendar(text, date) set schema private;
alter function private.clair_list_reception_day_calendar(text, date)
  rename to clair_list_reception_day_calendar_records;
revoke all on function private.clair_list_reception_day_calendar_records(text, date) from public, anon, authenticated;

create or replace function public.clair_list_reception_day_calendar(p_workspace_id text, p_day date)
returns jsonb language plpgsql security definer
set search_path = public, private, pg_temp
as $$
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then raise exception 'workspace_membership_missing'; end if;
  return jsonb_build_object(
    'records', private.clair_list_reception_day_calendar_records(p_workspace_id, p_day),
    'operatingSchedule', private.clair_resolve_effective_operating_hours(p_workspace_id, p_day)
  );
end;
$$;
revoke all on function public.clair_list_reception_day_calendar(text, date) from public, anon;
grant execute on function public.clair_list_reception_day_calendar(text, date) to authenticated;


-- Replace the appointment writer so configured hours, exceptions, breaks, and timezone are authoritative.

create or replace function public.clair_create_reception_appointment(
  p_workspace_id text,
  p_actor_user_id text,
  p_appointment jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_actor_user_id uuid := nullif(p_actor_user_id, '')::uuid;
  v_patient_id uuid := nullif(p_appointment->>'patientId', '')::uuid;
  v_guardian_id uuid := nullif(p_appointment->>'guardianId', '')::uuid;
  v_veterinarian_id uuid := nullif(p_appointment->>'assignedVeterinarianId', '')::uuid;
  v_duration_minutes integer := nullif(p_appointment->>'durationMinutes', '')::integer;
  v_scheduled_start_at timestamptz := nullif(p_appointment->>'scheduledStartAt', '')::timestamptz;
  v_scheduled_end_at timestamptz;
  v_memo text := nullif(trim(p_appointment->>'reservationMemo'), '');
  v_weight_kg numeric(6,2) := nullif(p_appointment->>'weightKg', '')::numeric(6,2);
  v_appointment public.appointments%rowtype;
begin
  if v_actor_user_id is null or v_actor_user_id <> auth.uid() then
    raise exception 'actor_mismatch';
  end if;

  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;

  if not private.clair_current_user_has_workspace_permission(p_workspace_id, 'reception:create') then
    raise exception 'permission_missing';
  end if;

  if v_patient_id is null or v_scheduled_start_at is null or v_duration_minutes is null then
    raise exception 'invalid_input';
  end if;

  if v_duration_minutes < 10 or v_duration_minutes > 240 then
    raise exception 'invalid_input';
  end if;

  if v_weight_kg is not null and v_weight_kg <= 0 then
    raise exception 'invalid_weight_kg';
  end if;

  v_scheduled_end_at := v_scheduled_start_at + make_interval(mins => v_duration_minutes);

  perform private.clair_assert_reception_time_allowed(
    p_workspace_id, v_scheduled_start_at, v_scheduled_end_at, 'appointment'
  );

  if not exists (
    select 1
    from public.patients p
    where p.workspace_id = p_workspace_id
      and p.id = v_patient_id
      and p.status = 'active'
  ) then
    raise exception 'patient_unavailable';
  end if;

  if v_guardian_id is not null and not exists (
    select 1
    from public.guardians g
    where g.workspace_id = p_workspace_id
      and g.id = v_guardian_id
  ) then
    raise exception 'guardian_unavailable';
  end if;

  if v_guardian_id is not null and not exists (
    select 1
    from public.patient_guardians pg
    where pg.patient_id = v_patient_id
      and pg.guardian_id = v_guardian_id
  ) then
    raise exception 'patient_guardian_link_missing';
  end if;

  if v_veterinarian_id is not null and not exists (
    select 1
    from public.user_memberships m
    where m.workspace_id = p_workspace_id
      and m.user_id = v_veterinarian_id
      and m.status = 'active'
  ) then
    raise exception 'primary_veterinarian_unavailable';
  end if;

  if exists (
    select 1
    from public.appointments a
    where a.workspace_id = p_workspace_id
      and a.status in ('requested', 'confirmed', 'changed')
      and v_scheduled_start_at < coalesce(a.scheduled_end_at, a.scheduled_start_at + interval '30 minutes')
      and v_scheduled_end_at > a.scheduled_start_at
  ) then
    raise exception 'appointment_slot_unavailable';
  end if;

  insert into public.appointments (
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
    p_workspace_id,
    v_patient_id,
    v_guardian_id,
    v_veterinarian_id,
    v_scheduled_start_at,
    v_scheduled_end_at,
    v_memo,
    v_memo,
    'confirmed',
    v_actor_user_id
  )
  returning * into v_appointment;

  if v_weight_kg is not null then
    update public.patients
    set
      weight_kg = round(v_weight_kg, 2),
      updated_at = now()
    where workspace_id = p_workspace_id
      and id = v_patient_id;
  end if;

  insert into public.appointment_change_logs (
    workspace_id,
    appointment_id,
    changed_by_user_id,
    change_type,
    before_value,
    after_value
  )
  values (
    p_workspace_id,
    v_appointment.id,
    v_actor_user_id,
    'create',
    '{}'::jsonb,
    jsonb_build_object(
      'status', v_appointment.status,
      'weightKg', v_weight_kg
    )
  );

  return jsonb_build_object(
    'id', v_appointment.id::text,
    'workspaceId', v_appointment.workspace_id,
    'patientId', v_appointment.patient_id::text,
    'guardianId', v_appointment.guardian_id::text,
    'assignedVeterinarianId', v_appointment.assigned_veterinarian_id::text,
    'scheduledStartAt', v_appointment.scheduled_start_at,
    'scheduledEndAt', v_appointment.scheduled_end_at,
    'visitPurpose', v_appointment.visit_purpose,
    'symptomNote', v_appointment.symptom_note,
    'status', v_appointment.status,
    'createdByUserId', v_appointment.created_by_user_id::text,
    'createdAt', v_appointment.created_at,
    'updatedAt', v_appointment.updated_at
  );
end;
$$;

revoke all on function public.clair_create_reception_appointment(text, text, jsonb) from public;
grant execute on function public.clair_create_reception_appointment(text, text, jsonb) to authenticated;

comment on function public.clair_create_reception_appointment(text, text, jsonb) is
  'HOSPITAL-ADMIN-LIVE-PR-012 appointment writer using the shared effective operating-hours resolver.';
