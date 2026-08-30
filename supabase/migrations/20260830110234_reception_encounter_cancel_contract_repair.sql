-- RECEPTION-LIVE-PR-018: align the live reception cancel RPC with the app.
-- The migration is additive. The legacy overload remains defined only for
-- historical catalog compatibility; it is not executable or a rollback path.

alter table public.encounters
  add column if not exists cancellation_reason text;

do $$
begin
  if exists (
    select 1
    from public.encounters e
    where e.status = 'cancelled'
      and nullif(btrim(e.cancellation_reason), '') is null
  ) then
    raise exception 'cancelled_encounter_reason_backfill_required';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint c
    where c.conrelid = 'public.encounters'::regclass
      and c.conname = 'encounters_cancelled_reason_check'
  ) then
    alter table public.encounters
      add constraint encounters_cancelled_reason_check
      check (
        status <> 'cancelled'
        or nullif(btrim(cancellation_reason), '') is not null
      ) not valid;
  end if;
end;
$$;

alter table public.encounters
  validate constraint encounters_cancelled_reason_check;

create or replace function public.clair_cancel_reception_encounter(
  p_workspace_id text,
  p_actor_user_id text,
  p_encounter_id text,
  p_cancel_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  v_actor_user_id uuid;
  v_actor_membership_id uuid;
  v_encounter_id uuid;
  v_cancel_reason text := btrim(coalesce(p_cancel_reason, ''));
  v_encounter public.encounters%rowtype;
  v_queue public.waiting_queue_entries%rowtype;
  v_now timestamptz := pg_catalog.now();
  v_encounter_row jsonb;
  v_queue_row jsonb;
  v_before_snapshot jsonb;
  v_after_snapshot jsonb;
  v_audit_event jsonb;
  v_request_id text;
begin
  if auth.uid() is null
     or nullif(btrim(coalesce(p_actor_user_id, '')), '') is distinct from auth.uid()::text then
    raise exception 'actor_mismatch' using errcode = '42501';
  end if;

  v_actor_user_id := auth.uid();

  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing' using errcode = '42501';
  end if;

  if not private.clair_current_user_has_workspace_permission(
    p_workspace_id,
    'reception:update'
  ) then
    raise exception 'permission_missing' using errcode = '42501';
  end if;

  select m.id
    into v_actor_membership_id
  from public.user_memberships m
  where m.workspace_id = p_workspace_id
    and m.user_id = v_actor_user_id
    and m.status = 'active'
  order by m.id
  limit 1;

  if v_actor_membership_id is null then
    raise exception 'workspace_membership_missing' using errcode = '42501';
  end if;

  begin
    v_request_id := nullif(
      btrim(
        coalesce(
          (nullif(pg_catalog.current_setting('request.headers', true), '')::jsonb)
            ->> 'x-request-id',
          ''
        )
      ),
      ''
    );
  exception
    when invalid_text_representation then
      v_request_id := null;
  end;

  if v_request_id is not null
     and v_request_id !~ '^[A-Za-z0-9._:-]{1,128}$' then
    v_request_id := null;
  end if;

  if pg_catalog.length(v_cancel_reason) = 0 then
    raise exception 'cancel_reason_required';
  end if;

  if pg_catalog.length(v_cancel_reason) > 500 then
    raise exception 'cancel_reason_too_long';
  end if;

  begin
    v_encounter_id := nullif(btrim(coalesce(p_encounter_id, '')), '')::uuid;
  exception
    when invalid_text_representation then
      raise exception 'encounter_unavailable';
  end;

  select e.*
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

  select q.*
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

  v_before_snapshot := pg_catalog.jsonb_build_object(
    'status', v_encounter.status,
    'queueStatus', v_queue.status
  );

  update public.encounters e
  set
    status = 'cancelled',
    cancellation_reason = v_cancel_reason,
    updated_at = v_now
  where e.workspace_id = p_workspace_id
    and e.id = v_encounter.id
  returning e.* into v_encounter;

  update public.waiting_queue_entries q
  set
    status = 'cancelled',
    finished_at = v_now
  where q.workspace_id = p_workspace_id
    and q.id = v_queue.id
  returning q.* into v_queue;

  v_after_snapshot := pg_catalog.jsonb_build_object(
    'status', v_encounter.status,
    'queueStatus', v_queue.status,
    'reason', v_cancel_reason
  );

  v_audit_event := public.clair_append_audit_event(
    p_id => 'reception-cancel-' || pg_catalog.gen_random_uuid()::text,
    p_workspace_id => p_workspace_id,
    p_actor_user_id => v_actor_user_id,
    p_actor_membership_id => v_actor_membership_id,
    p_event_type => 'reception.encounter_cancelled',
    p_target_type => 'encounter',
    p_target_id => v_encounter.id::text,
    p_encounter_id => v_encounter.id,
    p_patient_id => v_encounter.patient_id,
    p_guardian_id => v_encounter.guardian_id,
    p_request_id => v_request_id,
    p_reason => v_cancel_reason,
    p_before_snapshot => v_before_snapshot,
    p_after_snapshot => v_after_snapshot,
    p_metadata => pg_catalog.jsonb_build_object(
      'source', 'reception-encounter-cancel-rpc'
    ),
    p_occurred_at => v_now
  );

  select pg_catalog.jsonb_build_object(
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
  where e.workspace_id = p_workspace_id
    and e.id = v_encounter.id;

  select pg_catalog.jsonb_build_object(
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
  where q.workspace_id = p_workspace_id
    and q.id = v_queue.id;

  return pg_catalog.jsonb_build_object(
    'encounter', v_encounter_row,
    'queueEntry', v_queue_row,
    'cancelledByUserId', v_actor_user_id::text,
    'auditHandledBy', 'database_transaction',
    'auditEventId', v_audit_event ->> 'id'
  );
end;
$$;

revoke all on function public.clair_cancel_reception_encounter(text, text, text, text)
  from public, anon;
grant execute on function public.clair_cancel_reception_encounter(text, text, text, text)
  to authenticated;

revoke all on function public.clair_cancel_reception_encounter(text, text, text)
  from public, anon, authenticated;

comment on column public.encounters.cancellation_reason is
  'Required nonblank reason when a reception encounter is cancelled.';

comment on function public.clair_cancel_reception_encounter(text, text, text, text) is
  'Cancels a reception encounter and consultation queue and appends its audit event atomically after actor and reception:update checks.';
