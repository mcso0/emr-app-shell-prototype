create or replace function public.clair_list_reception_queue(
  p_workspace_id text,
  p_day date,
  p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_day_start timestamptz := (p_day::text || ' 00:00:00 Asia/Seoul')::timestamptz;
  v_day_end timestamptz := ((p_day + 1)::text || ' 00:00:00 Asia/Seoul')::timestamptz;
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 200);
  v_result jsonb;
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;

  with encounter_records as (
    select
      q.entered_at as sort_at,
      case when q.status = 'cancelled' or e.status = 'cancelled' then 1 else 0 end as status_order,
      jsonb_build_object(
        'kind', 'encounter_queue',
        'encounter',
        jsonb_build_object(
          'id', e.id,
          'workspaceId', e.workspace_id,
          'patientId', e.patient_id,
          'guardianId', e.guardian_id,
          'appointmentId', e.appointment_id,
          'primaryVeterinarianId', e.primary_veterinarian_id,
          'encounterNo', e.encounter_no,
          'receptionType', e.reception_type,
          'department', e.department,
          'durationMinutes', e.duration_minutes,
          'chiefComplaint', e.chief_complaint,
          'visitPurpose', e.visit_purpose,
          'receptionMemo', e.reception_memo,
          'status', e.status,
          'checkedInAt', e.checked_in_at,
          'startedAt', e.started_at,
          'completedAt', e.completed_at,
          'createdAt', e.created_at,
          'updatedAt', e.updated_at
        ),
        'appointment',
        case
          when a.id is null then null
          else jsonb_build_object(
            'id', a.id,
            'workspaceId', a.workspace_id,
            'patientId', a.patient_id,
            'guardianId', a.guardian_id,
            'assignedVeterinarianId', a.assigned_veterinarian_id,
            'scheduledStartAt', a.scheduled_start_at,
            'scheduledEndAt', a.scheduled_end_at,
            'visitPurpose', a.visit_purpose,
            'symptomNote', a.symptom_note,
            'status', a.status,
            'createdByUserId', a.created_by_user_id,
            'createdAt', a.created_at,
            'updatedAt', a.updated_at
          )
        end,
        'patient',
        jsonb_build_object(
          'id', p.id,
          'workspaceId', p.workspace_id,
          'patientNo', p.patient_no,
          'name', p.name,
          'species', p.species,
          'breed', p.breed,
          'birthDate', p.birth_date,
          'estimatedAgeText', p.estimated_age_text,
          'sex', p.sex,
          'neutered', p.neutered,
          'microchipNo', p.microchip_no,
          'patientRegistrationNo', p.patient_registration_no,
          'weightKg', p.weight_kg,
          'allergyNote', p.allergy_note,
          'specialNote', p.special_note,
          'handlingCautionNote', p.handling_caution_note,
          'handlingCautionLocked', p.handling_caution_locked,
          'status', p.status,
          'createdAt', p.created_at,
          'updatedAt', p.updated_at
        ),
        'primaryGuardian',
        case
          when g.id is null then null
          else jsonb_build_object(
            'id', g.id,
            'workspaceId', g.workspace_id,
            'name', g.name,
            'mobilePhone', g.mobile_phone,
            'phone', g.phone,
            'email', g.email,
            'birthDate', g.birth_date,
            'address', g.address,
            'occupation', g.occupation,
            'memo', g.memo,
            'createdAt', g.created_at,
            'updatedAt', g.updated_at
          )
        end,
        'queueEntry',
        jsonb_build_object(
          'id', q.id,
          'workspaceId', q.workspace_id,
          'encounterId', q.encounter_id,
          'queueType', q.queue_type,
          'status', q.status,
          'priority', q.priority,
          'sortOrder', q.sort_order,
          'enteredAt', q.entered_at,
          'calledAt', q.called_at,
          'finishedAt', q.finished_at
        )
      ) as record
    from public.waiting_queue_entries q
    join public.encounters e
      on e.workspace_id = q.workspace_id
      and e.id = q.encounter_id
    left join public.appointments a
      on a.workspace_id = e.workspace_id
      and a.id = e.appointment_id
    join public.patients p
      on p.workspace_id = e.workspace_id
      and p.id = e.patient_id
    left join public.guardians g
      on g.workspace_id = e.workspace_id
      and g.id = e.guardian_id
    where q.workspace_id = p_workspace_id
      and q.queue_type in ('consultation', 'billing')
      and q.status in ('waiting', 'called', 'in_progress', 'cancelled')
      and e.status in ('waiting', 'in_consultation', 'ordered', 'ready_for_billing', 'cancelled')
      and q.entered_at >= v_day_start
      and q.entered_at < v_day_end
  ),
  appointment_records as (
    select
      a.scheduled_start_at as sort_at,
      case when a.status = 'cancelled' then 1 else 0 end as status_order,
      jsonb_build_object(
        'kind', 'appointment',
        'appointment',
        jsonb_build_object(
          'id', a.id,
          'workspaceId', a.workspace_id,
          'patientId', a.patient_id,
          'guardianId', a.guardian_id,
          'assignedVeterinarianId', a.assigned_veterinarian_id,
          'scheduledStartAt', a.scheduled_start_at,
          'scheduledEndAt', a.scheduled_end_at,
          'visitPurpose', a.visit_purpose,
          'symptomNote', a.symptom_note,
          'status', a.status,
          'createdByUserId', a.created_by_user_id,
          'createdAt', a.created_at,
          'updatedAt', a.updated_at
        ),
        'patient',
        jsonb_build_object(
          'id', p.id,
          'workspaceId', p.workspace_id,
          'patientNo', p.patient_no,
          'name', p.name,
          'species', p.species,
          'breed', p.breed,
          'birthDate', p.birth_date,
          'estimatedAgeText', p.estimated_age_text,
          'sex', p.sex,
          'neutered', p.neutered,
          'microchipNo', p.microchip_no,
          'patientRegistrationNo', p.patient_registration_no,
          'weightKg', p.weight_kg,
          'allergyNote', p.allergy_note,
          'specialNote', p.special_note,
          'handlingCautionNote', p.handling_caution_note,
          'handlingCautionLocked', p.handling_caution_locked,
          'status', p.status,
          'createdAt', p.created_at,
          'updatedAt', p.updated_at
        ),
        'primaryGuardian',
        case
          when g.id is null then null
          else jsonb_build_object(
            'id', g.id,
            'workspaceId', g.workspace_id,
            'name', g.name,
            'mobilePhone', g.mobile_phone,
            'phone', g.phone,
            'email', g.email,
            'birthDate', g.birth_date,
            'address', g.address,
            'occupation', g.occupation,
            'memo', g.memo,
            'createdAt', g.created_at,
            'updatedAt', g.updated_at
          )
        end
      ) as record
    from public.appointments a
    join public.patients p
      on p.workspace_id = a.workspace_id
      and p.id = a.patient_id
    left join public.guardians g
      on g.workspace_id = a.workspace_id
      and g.id = a.guardian_id
    where a.workspace_id = p_workspace_id
      and a.status in ('confirmed', 'cancelled')
      and a.scheduled_start_at >= v_day_start
      and a.scheduled_start_at < v_day_end
      and not exists (
        select 1
        from public.encounters e
        where e.workspace_id = a.workspace_id
          and e.appointment_id = a.id
      )
  )
  select coalesce(jsonb_agg(record order by status_order, sort_at) filter (where record is not null), '[]'::jsonb)
  into v_result
  from (
    select sort_at, status_order, record from encounter_records
    union all
    select sort_at, status_order, record from appointment_records
    order by status_order, sort_at
    limit v_limit
  ) queue_records;

  return v_result;
end;
$$;

revoke all on function public.clair_list_reception_queue(text, date, integer) from public;
grant execute on function public.clair_list_reception_queue(text, date, integer) to authenticated;

comment on function public.clair_list_reception_queue(text, date, integer) is
  'Date-scoped reception queue reader that includes cancelled queue/appointment rows for visible restore workflows.';
