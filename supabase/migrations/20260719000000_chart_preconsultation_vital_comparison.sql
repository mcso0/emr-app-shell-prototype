-- CHART-PR-014: restrict preconsultation vitals to the selected visit and its immediate prior visit.

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
      with current_vital as (
        select
          0 as sort_order,
          vm.id,
          vm.encounter_id,
          vm.measured_at,
          vm.weight_kg,
          vm.temperature_c,
          vm.respiratory_rate_rpm,
          vm.blood_pressure_systolic_mmhg,
          vm.blood_pressure_diastolic_mmhg
        from public.patient_vital_measurements vm
        where vm.workspace_id = p_workspace_id
          and vm.patient_id = e.patient_id
          and vm.encounter_id = e.id
        order by vm.measured_at desc
        limit 1
      ),
      previous_encounter as (
        select prior.id
        from public.encounters prior
        where prior.workspace_id = p_workspace_id
          and prior.patient_id = e.patient_id
          and prior.id <> e.id
          and prior.status <> 'cancelled'
          and prior.checked_in_at < e.checked_in_at
        order by prior.checked_in_at desc, prior.id desc
        limit 1
      ),
      previous_vital as (
        select
          1 as sort_order,
          vm.id,
          vm.encounter_id,
          vm.measured_at,
          vm.weight_kg,
          vm.temperature_c,
          vm.respiratory_rate_rpm,
          vm.blood_pressure_systolic_mmhg,
          vm.blood_pressure_diastolic_mmhg
        from public.patient_vital_measurements vm
        join previous_encounter prior
          on prior.id = vm.encounter_id
        where vm.workspace_id = p_workspace_id
          and vm.patient_id = e.patient_id
        order by vm.measured_at desc
        limit 1
      ),
      comparison_vitals as (
        select * from current_vital
        union all
        select * from previous_vital
      )
      select jsonb_agg(
        jsonb_build_object(
          'id', id::text,
          'encounterId', encounter_id::text,
          'measuredAt', measured_at,
          'weightKg', weight_kg,
          'temperatureC', temperature_c,
          'respiratoryRateRpm', respiratory_rate_rpm,
          'bloodPressureSystolicMmhg', blood_pressure_systolic_mmhg,
          'bloodPressureDiastolicMmhg', blood_pressure_diastolic_mmhg
        )
        order by sort_order
      )
      from comparison_vitals
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
  'CHART-PR-014 workspace-scoped, chart:view-gated selected/current and immediate-prior visit vital comparison read model.';
