-- DEN-63: local-first reception day calendar reader.
-- This migration is not applied to remote Supabase by this work.

create or replace function public.clair_list_reception_day_calendar(
  p_workspace_id text,
  p_day date
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_day_start timestamptz := p_day::timestamptz;
  v_day_end timestamptz := (p_day + 1)::timestamptz;
  v_result jsonb;
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;

  with appointment_records as (
    select
      a.scheduled_start_at as sort_at,
      jsonb_build_object(
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
        'encounter',
        case
          when e.id is null then null
          else jsonb_build_object(
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
          )
        end,
        'queueEntry',
        case
          when q.id is null then null
          else jsonb_build_object(
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
        end
      ) as record
    from public.appointments a
    left join public.encounters e
      on e.workspace_id = a.workspace_id
      and e.appointment_id = a.id
      and e.status <> 'cancelled'
    left join public.waiting_queue_entries q
      on q.workspace_id = e.workspace_id
      and q.encounter_id = e.id
      and q.queue_type in ('consultation', 'billing')
      and q.status <> 'cancelled'
    where a.workspace_id = p_workspace_id
      and a.scheduled_start_at >= v_day_start
      and a.scheduled_start_at < v_day_end
      and a.status <> 'cancelled'
  ),
  walk_in_records as (
    select
      e.checked_in_at as sort_at,
      jsonb_build_object(
        'appointment', null,
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
        'queueEntry',
        case
          when q.id is null then null
          else jsonb_build_object(
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
        end
      ) as record
    from public.encounters e
    left join public.waiting_queue_entries q
      on q.workspace_id = e.workspace_id
      and q.encounter_id = e.id
      and q.queue_type in ('consultation', 'billing')
      and q.status <> 'cancelled'
    where e.workspace_id = p_workspace_id
      and e.appointment_id is null
      and e.reception_type = 'walk_in'
      and e.status <> 'cancelled'
      and e.checked_in_at >= v_day_start
      and e.checked_in_at < v_day_end
  )
  select coalesce(jsonb_agg(record order by sort_at), '[]'::jsonb)
  into v_result
  from (
    select sort_at, record from appointment_records
    union all
    select sort_at, record from walk_in_records
  ) calendar_records;

  return v_result;
end;
$$;

comment on function public.clair_list_reception_day_calendar(text, date) is
  'DEN-63 local-first reader for workspace-scoped reception day calendar appointments and encounters.';

grant execute on function public.clair_list_reception_day_calendar(text, date) to authenticated;
