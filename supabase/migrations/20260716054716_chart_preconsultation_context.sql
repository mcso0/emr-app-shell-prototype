-- CHART-PR-012: DB-backed preconsultation context and direct RPC hardening.

alter function public.clair_list_reception_queue(text, date, integer) set schema private;
alter function private.clair_list_reception_queue(text, date, integer)
  rename to clair_list_reception_queue_internal;
revoke all on function private.clair_list_reception_queue_internal(text, date, integer)
  from public, anon, authenticated;

create or replace function public.clair_list_reception_queue(
  p_workspace_id text,
  p_day date,
  p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;

  if not (
    private.clair_current_user_has_workspace_permission(p_workspace_id, 'reception:view')
    or private.clair_current_user_has_workspace_permission(p_workspace_id, 'chart:view')
  ) then
    raise exception 'permission_missing';
  end if;

  return private.clair_list_reception_queue_internal(
    p_workspace_id,
    p_day,
    p_limit
  );
end;
$$;

revoke all on function public.clair_list_reception_queue(text, date, integer)
  from public, anon;
grant execute on function public.clair_list_reception_queue(text, date, integer)
  to authenticated;

comment on function public.clair_list_reception_queue(text, date, integer) is
  'Permission-gated shared reception/chart queue reader.';

alter function public.clair_list_reception_queue(text, integer) set schema private;
alter function private.clair_list_reception_queue(text, integer)
  rename to clair_list_reception_queue_legacy_internal;
revoke all on function private.clair_list_reception_queue_legacy_internal(text, integer)
  from public, anon, authenticated;

create or replace function public.clair_list_reception_queue(
  p_workspace_id text,
  p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;

  if not (
    private.clair_current_user_has_workspace_permission(p_workspace_id, 'reception:view')
    or private.clair_current_user_has_workspace_permission(p_workspace_id, 'chart:view')
  ) then
    raise exception 'permission_missing';
  end if;

  return private.clair_list_reception_queue_legacy_internal(
    p_workspace_id,
    p_limit
  );
end;
$$;

revoke all on function public.clair_list_reception_queue(text, integer)
  from public, anon;
grant execute on function public.clair_list_reception_queue(text, integer)
  to authenticated;

alter function public.clair_call_consultation_queue(text, text, uuid, text)
  set schema private;
alter function private.clair_call_consultation_queue(text, text, uuid, text)
  rename to clair_call_consultation_queue_internal;
revoke all on function private.clair_call_consultation_queue_internal(text, text, uuid, text)
  from public, anon, authenticated;

alter function public.clair_call_consultation_queue(text, text, uuid)
  set schema private;
alter function private.clair_call_consultation_queue(text, text, uuid)
  rename to clair_call_consultation_queue_legacy_internal;
revoke all on function private.clair_call_consultation_queue_legacy_internal(text, text, uuid)
  from public, anon, authenticated;

create or replace function public.clair_call_consultation_queue(
  p_workspace_id text,
  p_actor_user_id text,
  p_encounter_id uuid,
  p_room_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_actor_user_id uuid;
begin
  begin
    v_actor_user_id := nullif(p_actor_user_id, '')::uuid;
  exception
    when invalid_text_representation then
      raise exception 'actor_mismatch';
  end;

  if v_actor_user_id is null or v_actor_user_id <> auth.uid() then
    raise exception 'actor_mismatch';
  end if;

  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;

  if not private.clair_current_user_has_workspace_permission(p_workspace_id, 'chart:update') then
    raise exception 'permission_missing';
  end if;

  return private.clair_call_consultation_queue_internal(
    p_workspace_id,
    p_actor_user_id,
    p_encounter_id,
    p_room_id
  );
end;
$$;

create or replace function public.clair_call_consultation_queue(
  p_workspace_id text,
  p_actor_user_id text,
  p_encounter_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  return public.clair_call_consultation_queue(
    p_workspace_id,
    p_actor_user_id,
    p_encounter_id,
    'room-consult-1'
  );
end;
$$;

revoke all on function public.clair_call_consultation_queue(text, text, uuid, text)
  from public, anon;
revoke all on function public.clair_call_consultation_queue(text, text, uuid)
  from public, anon;
grant execute on function public.clair_call_consultation_queue(text, text, uuid, text)
  to authenticated;
grant execute on function public.clair_call_consultation_queue(text, text, uuid)
  to authenticated;

create or replace function private.clair_return_consultation_to_waiting_internal(
  p_workspace_id text,
  p_actor_user_id text,
  p_encounter_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_encounter public.encounters%rowtype;
  v_queue public.waiting_queue_entries%rowtype;
  v_now timestamptz := now();
begin
  select *
  into v_encounter
  from public.encounters
  where workspace_id = p_workspace_id
    and id = p_encounter_id
    and status <> 'cancelled'
  for update;

  if v_encounter.id is null then
    raise exception 'encounter_unavailable';
  end if;

  select *
  into v_queue
  from public.waiting_queue_entries
  where workspace_id = p_workspace_id
    and encounter_id = p_encounter_id
    and queue_type = 'consultation'
    and status <> 'cancelled'
  for update;

  if v_queue.id is null then
    raise exception 'queue_entry_unavailable';
  end if;

  if v_encounter.status <> 'in_consultation' or v_queue.status <> 'in_progress' then
    raise exception 'stale_status';
  end if;

  update public.encounters
  set status = 'waiting', started_at = null, updated_at = v_now
  where id = v_encounter.id
  returning * into v_encounter;

  update public.waiting_queue_entries
  set status = 'waiting'
  where id = v_queue.id
  returning * into v_queue;

  return jsonb_build_object(
    'encounter', row_to_json(v_encounter),
    'queueEntry', row_to_json(v_queue)
  );
end;
$$;

revoke all on function private.clair_return_consultation_to_waiting_internal(text, text, uuid)
  from public, anon, authenticated;

create or replace function public.clair_return_consultation_to_waiting(
  p_workspace_id text,
  p_actor_user_id text,
  p_encounter_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_actor_user_id uuid;
begin
  begin
    v_actor_user_id := nullif(p_actor_user_id, '')::uuid;
  exception
    when invalid_text_representation then
      raise exception 'actor_mismatch';
  end;

  if v_actor_user_id is null or v_actor_user_id <> auth.uid() then
    raise exception 'actor_mismatch';
  end if;

  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;

  if not private.clair_current_user_has_workspace_permission(p_workspace_id, 'chart:update') then
    raise exception 'permission_missing';
  end if;

  return private.clair_return_consultation_to_waiting_internal(
    p_workspace_id,
    p_actor_user_id,
    p_encounter_id
  );
end;
$$;

revoke all on function public.clair_return_consultation_to_waiting(text, text, uuid)
  from public, anon;
grant execute on function public.clair_return_consultation_to_waiting(text, text, uuid)
  to authenticated;

create or replace function public.clair_get_chart_preconsultation_context(
  p_workspace_id text,
  p_encounter_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_encounter public.encounters%rowtype;
  v_result jsonb;
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;

  if not private.clair_current_user_has_workspace_permission(p_workspace_id, 'chart:view') then
    raise exception 'permission_missing';
  end if;

  select e.*
  into v_encounter
  from public.encounters e
  where e.workspace_id = p_workspace_id
    and e.id = p_encounter_id
    and e.status <> 'cancelled';

  if v_encounter.id is null then
    raise exception 'encounter_unavailable';
  end if;

  select jsonb_build_object(
    'encounter', jsonb_build_object(
      'id', e.id::text,
      'encounterNo', e.encounter_no,
      'appointmentId', e.appointment_id::text,
      'receptionType', e.reception_type,
      'visitPurpose', e.visit_purpose,
      'chiefComplaint', e.chief_complaint,
      'receptionMemo', e.reception_memo,
      'checkedInAt', e.checked_in_at,
      'status', e.status
    ),
    'queue', jsonb_build_object(
      'id', q.id::text,
      'status', q.status
    ),
    'patient', jsonb_build_object(
      'id', p.id::text,
      'patientNo', p.patient_no,
      'name', p.name,
      'species', p.species,
      'breed', coalesce(p.primary_breed_name, p.breed),
      'birthDate', p.birth_date,
      'estimatedAgeText', coalesce(
        p.estimated_age_text,
        case
          when p.estimated_age_years is not null then p.estimated_age_years::text || '세'
          else null
        end
      ),
      'sex', p.sex,
      'neutered', p.neutered,
      'weightKg', p.weight_kg,
      'allergyNote', p.allergy_note,
      'specialNote', coalesce(p.profile_memo, p.special_note),
      'handlingCautionNote', p.handling_caution_note
    ),
    'guardian', case
      when g.id is null then null
      else jsonb_build_object(
        'id', g.id::text,
        'name', g.name,
        'memo', g.memo
      )
    end,
    'appointment', case
      when a.id is null then null
      else jsonb_build_object(
        'id', a.id::text,
        'visitPurpose', a.visit_purpose,
        'symptomNote', a.symptom_note
      )
    end,
    'veterinarian', case
      when u.id is null then null
      else jsonb_build_object(
        'id', u.id::text,
        'displayName', u.display_name
      )
    end,
    'priorEncounterCount', (
      select count(*)
      from public.encounters history_count
      where history_count.workspace_id = p_workspace_id
        and history_count.patient_id = e.patient_id
        and history_count.id <> e.id
        and history_count.status <> 'cancelled'
        and history_count.checked_in_at <= e.checked_in_at
    ),
    'vitals', coalesce((
      select jsonb_agg(vital_row order by vital_row."measuredAt" desc)
      from (
        select
          vm.id::text as "id",
          vm.encounter_id::text as "encounterId",
          vm.measured_at as "measuredAt",
          vm.weight_kg as "weightKg",
          vm.temperature_c as "temperatureC",
          vm.respiratory_rate_rpm as "respiratoryRateRpm",
          vm.blood_pressure_systolic_mmhg as "bloodPressureSystolicMmhg",
          vm.blood_pressure_diastolic_mmhg as "bloodPressureDiastolicMmhg"
        from public.patient_vital_measurements vm
        join public.encounters vital_encounter
          on vital_encounter.workspace_id = vm.workspace_id
         and vital_encounter.id = vm.encounter_id
        where vm.workspace_id = p_workspace_id
          and vm.patient_id = e.patient_id
          and vital_encounter.status <> 'cancelled'
          and (
            vital_encounter.id = e.id
            or vital_encounter.checked_in_at <= e.checked_in_at
          )
        order by vm.measured_at desc
        limit 2
      ) vital_row
    ), '[]'::jsonb),
    'history', coalesce((
      select jsonb_agg(history_row order by history_row."checkedInAt" desc)
      from (
        select
          h.id::text as "encounterId",
          h.encounter_no as "encounterNo",
          h.checked_in_at as "checkedInAt",
          h.visit_purpose as "visitPurpose",
          h.chief_complaint as "chiefComplaint",
          h.reception_memo as "receptionMemo",
          h.status,
          latest_soap.subjective,
          latest_soap.assessment,
          latest_soap.plan,
          primary_diagnosis.diagnosis_text as "primaryDiagnosis"
        from public.encounters h
        left join lateral (
          select s.subjective, s.assessment, s.plan
          from public.soap_notes s
          where s.workspace_id = h.workspace_id
            and s.encounter_id = h.id
            and s.status <> 'voided'
          order by s.updated_at desc
          limit 1
        ) latest_soap on true
        left join lateral (
          select d.diagnosis_text
          from public.diagnoses d
          where d.workspace_id = h.workspace_id
            and d.encounter_id = h.id
          order by d.is_primary desc, d.sort_order, d.updated_at desc
          limit 1
        ) primary_diagnosis on true
        where h.workspace_id = p_workspace_id
          and h.patient_id = e.patient_id
          and h.status <> 'cancelled'
          and h.checked_in_at <= e.checked_in_at
        order by h.checked_in_at desc
        limit 10
      ) history_row
    ), '[]'::jsonb)
  )
  into v_result
  from public.encounters e
  join public.waiting_queue_entries q
    on q.workspace_id = e.workspace_id
   and q.encounter_id = e.id
   and q.queue_type = 'consultation'
   and q.status <> 'cancelled'
  join public.patients p
    on p.workspace_id = e.workspace_id
   and p.id = e.patient_id
   and p.status = 'active'
  left join public.guardians g
    on g.workspace_id = e.workspace_id
   and g.id = e.guardian_id
   and g.status = 'active'
  left join public.appointments a
    on a.workspace_id = e.workspace_id
   and a.id = e.appointment_id
  left join public.users u
    on u.id = e.primary_veterinarian_id
   and u.status = 'active'
  where e.workspace_id = p_workspace_id
    and e.id = p_encounter_id;

  if v_result is null then
    raise exception 'encounter_unavailable';
  end if;

  return v_result;
end;
$$;

revoke all on function public.clair_get_chart_preconsultation_context(text, uuid)
  from public, anon;
grant execute on function public.clair_get_chart_preconsultation_context(text, uuid)
  to authenticated;

comment on function public.clair_get_chart_preconsultation_context(text, uuid) is
  'CHART-PR-012 workspace-scoped, chart:view-gated preconsultation read model.';
