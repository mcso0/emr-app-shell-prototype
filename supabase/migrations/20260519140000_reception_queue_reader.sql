-- DEN-62: local-first reception queue reader.
-- This migration is not applied to remote Supabase by this work.

create or replace function public.clair_list_reception_queue(
  p_workspace_id uuid,
  p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 200);
  v_result jsonb;
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
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
      )
      order by
        case when q.status = 'waiting' then 0 else 1 end,
        q.sort_order nulls last,
        q.entered_at
    ),
    '[]'::jsonb
  )
  into v_result
  from (
    select q.*
    from public.waiting_queue_entries q
    join public.encounters e on e.id = q.encounter_id and e.workspace_id = q.workspace_id
    where q.workspace_id = p_workspace_id
      and q.queue_type in ('consultation', 'billing')
      and q.status in ('waiting', 'called', 'in_progress')
      and e.status in ('waiting', 'in_consultation', 'ordered', 'ready_for_billing')
    order by
      case when q.status = 'waiting' then 0 else 1 end,
      q.sort_order nulls last,
      q.entered_at
    limit v_limit
  ) q
  join public.encounters e on e.id = q.encounter_id and e.workspace_id = q.workspace_id;

  return v_result;
end;
$$;

comment on function public.clair_list_reception_queue(uuid, integer) is
  'DEN-62 local-first reader for workspace-scoped reception queue and side panel encounters.';

grant execute on function public.clair_list_reception_queue(uuid, integer) to authenticated;
