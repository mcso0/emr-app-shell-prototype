-- DEN-516: server-owned reception appointment creation writer.

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
    'reception.encounter_cancelled',
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
  v_appointment public.appointments%rowtype;
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;

  if v_patient_id is null or v_scheduled_start_at is null or v_duration_minutes is null then
    raise exception 'invalid_input';
  end if;

  if v_duration_minutes < 10 or v_duration_minutes > 240 then
    raise exception 'invalid_input';
  end if;

  v_scheduled_end_at := v_scheduled_start_at + make_interval(mins => v_duration_minutes);

  if extract(dow from timezone('Asia/Seoul', v_scheduled_start_at)) = 0 then
    raise exception 'appointment_closed_day';
  end if;

  if
    (
      extract(hour from timezone('Asia/Seoul', v_scheduled_start_at)) * 60 +
      extract(minute from timezone('Asia/Seoul', v_scheduled_start_at))
    ) < 540
    or
    (
      extract(hour from timezone('Asia/Seoul', v_scheduled_end_at)) * 60 +
      extract(minute from timezone('Asia/Seoul', v_scheduled_end_at))
    ) > 1140
  then
    raise exception 'appointment_outside_business_hours';
  end if;

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
    jsonb_build_object('status', v_appointment.status)
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
  'DEN-516 server-owned writer for reception appointment creation with workspace scope, business-hours validation, and slot conflict checks.';
