-- DEN-510: local-first reception encounter cancel writer.
-- Remote Supabase application remains approval-gated.

create or replace function public.clair_cancel_reception_encounter(
  p_workspace_id text,
  p_actor_user_id text,
  p_encounter_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_actor_user_id uuid := nullif(p_actor_user_id, '')::uuid;
  v_encounter_id uuid := nullif(p_encounter_id, '')::uuid;
  v_encounter public.encounters%rowtype;
  v_queue public.waiting_queue_entries%rowtype;
  v_now timestamptz := now();
  v_encounter_row jsonb;
  v_queue_row jsonb;
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;

  select *
    into v_encounter
  from public.encounters e
  where e.workspace_id = p_workspace_id
    and e.id = v_encounter_id
  for update;

  if v_encounter.id is null then
    raise exception 'encounter_unavailable';
  end if;

  if v_encounter.status = 'cancelled' then
    raise exception 'encounter_already_cancelled';
  end if;

  if v_encounter.status not in ('waiting', 'in_consultation') then
    raise exception 'encounter_not_cancelable';
  end if;

  select *
    into v_queue
  from public.waiting_queue_entries q
  where q.workspace_id = p_workspace_id
    and q.encounter_id = v_encounter.id
    and q.queue_type = 'consultation'
  for update;

  if v_queue.id is null then
    raise exception 'queue_entry_unavailable';
  end if;

  if v_queue.status = 'cancelled' then
    raise exception 'encounter_already_cancelled';
  end if;

  if v_queue.status not in ('waiting', 'called', 'in_progress') then
    raise exception 'encounter_not_cancelable';
  end if;

  update public.encounters
  set
    status = 'cancelled',
    updated_at = v_now
  where workspace_id = p_workspace_id
    and id = v_encounter.id
  returning * into v_encounter;

  update public.waiting_queue_entries
  set
    status = 'cancelled',
    finished_at = v_now
  where workspace_id = p_workspace_id
    and id = v_queue.id
  returning * into v_queue;

  select jsonb_build_object(
    'id', e.id::text,
    'workspaceId', e.workspace_id,
    'patientId', e.patient_id::text,
    'guardianId', e.guardian_id::text,
    'appointmentId', e.appointment_id::text,
    'primaryVeterinarianId', e.primary_veterinarian_id::text,
    'encounterNo', e.encounter_no,
    'receptionType', e.reception_type,
    'department', e.department,
    'durationMinutes', e.duration_minutes,
    'chiefComplaint', e.chief_complaint,
    'visitPurpose', e.visit_purpose,
    'receptionMemo', e.reception_memo,
    'status', e.status,
    'checkedInAt', e.checked_in_at,
    'checkedInByUserId', e.checked_in_by_user_id::text,
    'startedAt', e.started_at,
    'chartCompletedAt', e.chart_completed_at,
    'chartCompletedByUserId', e.chart_completed_by_user_id::text,
    'completedAt', e.completed_at,
    'createdAt', e.created_at,
    'updatedAt', e.updated_at
  )
    into v_encounter_row
  from public.encounters e
  where e.id = v_encounter.id;

  select jsonb_build_object(
    'id', q.id::text,
    'workspaceId', q.workspace_id,
    'encounterId', q.encounter_id::text,
    'queueType', q.queue_type,
    'status', q.status,
    'priority', q.priority,
    'sortOrder', q.sort_order,
    'enteredAt', q.entered_at,
    'calledAt', q.called_at,
    'finishedAt', q.finished_at
  )
    into v_queue_row
  from public.waiting_queue_entries q
  where q.id = v_queue.id;

  return jsonb_build_object(
    'encounter', v_encounter_row,
    'queueEntry', v_queue_row,
    'cancelledByUserId', v_actor_user_id::text
  );
end;
$$;

revoke all on function public.clair_cancel_reception_encounter(text, text, text) from public;
grant execute on function public.clair_cancel_reception_encounter(text, text, text) to authenticated;

comment on function public.clair_cancel_reception_encounter(text, text, text) is
  'DEN-510 local-first server-owned writer for cancelling an active reception encounter and consultation queue row together.';
