-- Chart CTA direct call/start flow.
-- Keeps the `called` queue enum available for compatibility, but the chart CTA now moves
-- waiting consultation work directly into in-consultation/in-progress.

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
    'chart.patient_called',
    'chart.consultation_started',
    'chart.consultation_returned_to_waiting',
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
      'chart.patient_called',
      'chart.consultation_started',
      'chart.consultation_returned_to_waiting',
      'chart.soap_saved',
      'chart.completed',
      'diagnosis.changed',
      'order.draft_changed',
      'order.confirmed',
      'order.billing_candidate_requested',
      'order.status_changed',
      'fulfillment.status_changed',
      'billing.invoice_created',
      'billing.payment_recorded',
      'billing.payment_state_changed',
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

create or replace function public.clair_call_consultation_queue(
  p_workspace_id text,
  p_actor_user_id text,
  p_encounter_id uuid,
  p_room_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_actor_user_id uuid := nullif(p_actor_user_id, '')::uuid;
  v_now timestamptz := now();
  v_encounter public.encounters%rowtype;
  v_queue public.waiting_queue_entries%rowtype;
  v_call_event public.encounter_call_events%rowtype;
  v_room_name text;
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;

  v_room_name := case p_room_id
    when 'room-consult-1' then '1진료실'
    when 'room-consult-2' then '2진료실'
    when 'room-cat' then '고양이 진료실'
    when 'room-director' then '원장 진료실'
    else null
  end;

  if v_room_name is null then
    raise exception 'room_unavailable';
  end if;

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

  if v_encounter.status <> 'waiting' or v_queue.status <> 'waiting' then
    raise exception 'stale_status';
  end if;

  update public.encounters
  set
    status = 'in_consultation',
    started_at = v_now,
    updated_at = v_now
  where id = v_encounter.id
  returning * into v_encounter;

  update public.waiting_queue_entries
  set
    status = 'in_progress',
    called_at = v_now,
    called_by_user_id = v_actor_user_id,
    started_by_user_id = v_actor_user_id
  where id = v_queue.id
  returning * into v_queue;

  insert into public.encounter_call_events (
    workspace_id,
    encounter_id,
    queue_entry_id,
    event_type,
    display_text,
    delivery_status,
    provider,
    room_id,
    room_name,
    payload,
    created_by_user_id,
    created_at
  )
  values (
    p_workspace_id,
    p_encounter_id,
    v_queue.id,
    'did_call_requested',
    v_room_name || '로 환자를 호출하고 진료를 시작합니다.',
    'queued',
    'local_outbox',
    p_room_id,
    v_room_name,
    jsonb_build_object(
      'didProvider', 'not_configured',
      'roomId', p_room_id,
      'roomName', v_room_name
    ),
    v_actor_user_id,
    v_now
  )
  returning * into v_call_event;

  return jsonb_build_object(
    'encounter', row_to_json(v_encounter),
    'queueEntry', row_to_json(v_queue),
    'callEvent', jsonb_build_object(
      'id', v_call_event.id::text,
      'workspaceId', v_call_event.workspace_id,
      'encounterId', v_call_event.encounter_id::text,
      'queueEntryId', v_call_event.queue_entry_id::text,
      'eventType', v_call_event.event_type,
      'displayText', v_call_event.display_text,
      'deliveryStatus', v_call_event.delivery_status,
      'roomId', v_call_event.room_id,
      'roomName', v_call_event.room_name,
      'createdAt', v_call_event.created_at,
      'createdByUserId', v_call_event.created_by_user_id::text
    )
  );
end;
$$;

create or replace function public.clair_return_consultation_to_waiting(
  p_workspace_id text,
  p_actor_user_id text,
  p_encounter_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_encounter public.encounters%rowtype;
  v_queue public.waiting_queue_entries%rowtype;
  v_now timestamptz := now();
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;

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
  set
    status = 'waiting',
    started_at = null,
    updated_at = v_now
  where id = v_encounter.id
  returning * into v_encounter;

  update public.waiting_queue_entries
  set
    status = 'waiting'
  where id = v_queue.id
  returning * into v_queue;

  return jsonb_build_object(
    'encounter', row_to_json(v_encounter),
    'queueEntry', row_to_json(v_queue)
  );
end;
$$;

create or replace function public.clair_cancel_reception_encounter(
  p_workspace_id text,
  p_actor_user_id text,
  p_encounter_id text,
  p_cancel_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_actor_user_id uuid := nullif(p_actor_user_id, '')::uuid;
  v_encounter_id uuid := nullif(p_encounter_id, '')::uuid;
  v_cancel_reason text := btrim(coalesce(p_cancel_reason, ''));
  v_encounter public.encounters%rowtype;
  v_queue public.waiting_queue_entries%rowtype;
  v_now timestamptz := now();
  v_encounter_row jsonb;
  v_queue_row jsonb;
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;

  if length(v_cancel_reason) = 0 then
    raise exception 'cancel_reason_required';
  end if;

  if length(v_cancel_reason) > 500 then
    raise exception 'cancel_reason_too_long';
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
    cancellation_reason = v_cancel_reason,
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
    'cancellationReason', e.cancellation_reason,
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

revoke all on function public.clair_call_consultation_queue(text, text, uuid, text) from public;
grant execute on function public.clair_call_consultation_queue(text, text, uuid, text) to authenticated;
revoke all on function public.clair_return_consultation_to_waiting(text, text, uuid) from public;
grant execute on function public.clair_return_consultation_to_waiting(text, text, uuid) to authenticated;
revoke all on function public.clair_cancel_reception_encounter(text, text, text, text) from public;
grant execute on function public.clair_cancel_reception_encounter(text, text, text, text) to authenticated;

comment on function public.clair_call_consultation_queue(text, text, uuid, text) is
  'Calls a synthetic consultation patient and immediately starts consultation for the chart CTA direct-start flow.';
comment on function public.clair_return_consultation_to_waiting(text, text, uuid) is
  'Returns an in-progress synthetic consultation encounter and queue row to waiting from the chart CTA secondary action.';
comment on function public.clair_cancel_reception_encounter(text, text, text, text) is
  'Cancels an active reception encounter and consultation queue row with a required cancellation reason.';
