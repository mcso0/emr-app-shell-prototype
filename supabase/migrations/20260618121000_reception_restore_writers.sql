alter table public.audit_events
  drop constraint if exists audit_events_event_type_check;

alter table public.audit_events
  add constraint audit_events_event_type_check check (event_type in (
    'workspace.created',
    'workspace.invitation_created',
    'workspace.invitation_resent',
    'workspace.invitation_canceled',
    'workspace.invitation_accepted',
    'workspace.membership_roles_changed',
    'workspace.membership_status_changed',
    'workspace.last_admin_change_blocked',
    'user.profile_updated',
    'reception.patient_guardian_registered',
    'reception.walk_in_created',
    'reception.appointment_created',
    'reception.appointment_checked_in',
    'reception.appointment_restored',
    'reception.encounter_cancelled',
    'reception.encounter_restored',
    'reception.encounter_updated',
    'reception.queue_status_changed',
    'chart.soap_saved',
    'chart.completed',
    'diagnosis.changed',
    'order.draft_changed',
    'order.confirmed',
    'order.billing_candidate_requested',
    'order.status_changed',
    'order_catalog.created',
    'order_catalog.updated',
    'order_catalog.paused',
    'billing.invoice_candidate_generated',
    'billing.invoice_line_changed',
    'billing.invoice_issued',
    'billing.payment_state_changed',
    'billing.refund_requested'
  ));

alter table if exists public.live_audit_events
  drop constraint if exists live_audit_events_event_type_check;

alter table if exists public.live_audit_events
  add constraint live_audit_events_event_type_check
  check (
    event_type = any(array[
      'auth.login',
      'chart.order_created',
      'fulfillment.status_changed',
      'billing.invoice_created',
      'billing.payment_recorded',
      'customer.profile_updated',
      'reception.walk_in_created',
      'reception.appointment_created',
      'reception.appointment_checked_in',
      'reception.appointment_restored',
      'reception.encounter_cancelled',
      'reception.encounter_restored',
      'reception.encounter_updated',
      'reception.patient_guardian_registered'
    ])
  );

create or replace function public.clair_restore_reception_encounter(
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

  if v_encounter.status <> 'cancelled' then
    raise exception 'encounter_already_active';
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

  if v_queue.status <> 'cancelled' then
    raise exception 'encounter_not_restorable';
  end if;

  update public.encounters
  set
    status = 'waiting',
    updated_at = v_now
  where workspace_id = p_workspace_id
    and id = v_encounter.id
  returning * into v_encounter;

  update public.waiting_queue_entries
  set
    status = 'waiting',
    finished_at = null
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
    'restoredByUserId', v_actor_user_id::text
  );
end;
$$;

revoke all on function public.clair_restore_reception_encounter(text, text, text) from public;
grant execute on function public.clair_restore_reception_encounter(text, text, text) to authenticated;

create or replace function public.clair_restore_reception_appointment(
  p_workspace_id text,
  p_actor_user_id text,
  p_appointment_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_actor_user_id uuid := nullif(p_actor_user_id, '')::uuid;
  v_appointment_id uuid := nullif(p_appointment_id, '')::uuid;
  v_appointment public.appointments%rowtype;
  v_now timestamptz := now();
  v_appointment_row jsonb;
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;

  select *
    into v_appointment
  from public.appointments a
  where a.workspace_id = p_workspace_id
    and a.id = v_appointment_id
  for update;

  if v_appointment.id is null then
    raise exception 'appointment_unavailable';
  end if;

  if v_appointment.status <> 'cancelled' then
    raise exception 'appointment_already_active';
  end if;

  if exists (
    select 1
    from public.encounters e
    where e.workspace_id = p_workspace_id
      and e.appointment_id = v_appointment.id
      and e.status <> 'cancelled'
  ) then
    raise exception 'appointment_active_encounter_exists';
  end if;

  update public.appointments
  set
    status = 'confirmed',
    updated_at = v_now
  where workspace_id = p_workspace_id
    and id = v_appointment.id
  returning * into v_appointment;

  insert into public.appointment_change_logs (
    workspace_id,
    appointment_id,
    changed_by_user_id,
    action,
    before_value,
    after_value,
    created_at
  )
  values (
    p_workspace_id,
    v_appointment.id,
    v_actor_user_id,
    'restore',
    jsonb_build_object('status', 'cancelled'),
    jsonb_build_object('status', 'confirmed'),
    v_now
  );

  select jsonb_build_object(
    'id', a.id::text,
    'workspaceId', a.workspace_id,
    'patientId', a.patient_id::text,
    'guardianId', a.guardian_id::text,
    'assignedVeterinarianId', a.assigned_veterinarian_id::text,
    'scheduledStartAt', a.scheduled_start_at,
    'scheduledEndAt', a.scheduled_end_at,
    'visitPurpose', a.visit_purpose,
    'symptomNote', a.symptom_note,
    'status', a.status,
    'createdByUserId', a.created_by_user_id::text,
    'createdAt', a.created_at,
    'updatedAt', a.updated_at
  )
    into v_appointment_row
  from public.appointments a
  where a.id = v_appointment.id;

  return jsonb_build_object(
    'appointment', v_appointment_row,
    'restoredByUserId', v_actor_user_id::text
  );
end;
$$;

revoke all on function public.clair_restore_reception_appointment(text, text, text) from public;
grant execute on function public.clair_restore_reception_appointment(text, text, text) to authenticated;
