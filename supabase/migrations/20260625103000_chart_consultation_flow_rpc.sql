-- Chart consultation call/start workflow.
-- Synthetic/local-first boundary only: no DID provider side effect is executed here.

alter table public.waiting_queue_entries
  add column if not exists called_by_user_id uuid references public.users(id) on delete set null,
  add column if not exists started_by_user_id uuid references public.users(id) on delete set null;

create table if not exists public.encounter_call_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  encounter_id uuid not null references public.encounters(id) on delete cascade,
  queue_entry_id uuid not null references public.waiting_queue_entries(id) on delete cascade,
  event_type text not null check (event_type in ('did_call_requested')),
  display_text text not null check (length(trim(display_text)) > 0),
  delivery_status text not null default 'queued' check (delivery_status in ('queued', 'local_acknowledged', 'failed', 'cancelled')),
  provider text not null default 'local_outbox',
  room_id text,
  payload jsonb not null default '{}'::jsonb,
  created_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists encounter_call_events_workspace_encounter_idx
  on public.encounter_call_events (workspace_id, encounter_id, created_at desc);

create index if not exists encounter_call_events_delivery_idx
  on public.encounter_call_events (workspace_id, delivery_status, created_at);

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

create or replace function public.clair_call_consultation_queue(
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
  v_actor_user_id uuid := nullif(p_actor_user_id, '')::uuid;
  v_now timestamptz := now();
  v_encounter public.encounters%rowtype;
  v_queue public.waiting_queue_entries%rowtype;
  v_call_event public.encounter_call_events%rowtype;
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

  if v_encounter.status <> 'waiting' or v_queue.status <> 'waiting' then
    raise exception 'stale_status';
  end if;

  update public.waiting_queue_entries
  set
    status = 'called',
    called_at = v_now,
    called_by_user_id = v_actor_user_id
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
    payload,
    created_by_user_id,
    created_at
  )
  values (
    p_workspace_id,
    p_encounter_id,
    v_queue.id,
    'did_call_requested',
    '대기 환자를 진료실로 호출합니다.',
    'queued',
    'local_outbox',
    jsonb_build_object('didProvider', 'not_configured'),
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
      'createdAt', v_call_event.created_at,
      'createdByUserId', v_call_event.created_by_user_id::text
    )
  );
end;
$$;

create or replace function public.clair_start_consultation(
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
  v_actor_user_id uuid := nullif(p_actor_user_id, '')::uuid;
  v_now timestamptz := now();
  v_encounter public.encounters%rowtype;
  v_queue public.waiting_queue_entries%rowtype;
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

  if v_encounter.status <> 'waiting' or v_queue.status <> 'called' then
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
    started_by_user_id = v_actor_user_id
  where id = v_queue.id
  returning * into v_queue;

  return jsonb_build_object(
    'encounter', row_to_json(v_encounter),
    'queueEntry', row_to_json(v_queue)
  );
end;
$$;

create or replace function public.clair_complete_chart(
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
  v_actor_user_id uuid := nullif(p_actor_user_id, '')::uuid;
  v_now timestamptz := now();
  v_completion_row jsonb;
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;

  if not exists (
    select 1
    from public.encounters e
    where e.workspace_id = p_workspace_id
      and e.id = p_encounter_id
      and e.status <> 'cancelled'
    for update
  ) then
    raise exception 'encounter_unavailable';
  end if;

  if not exists (
    select 1
    from public.encounters e
    where e.workspace_id = p_workspace_id
      and e.id = p_encounter_id
      and e.status in ('in_consultation', 'ordered', 'ready_for_billing', 'completed')
  ) then
    raise exception 'stale_status';
  end if;

  update public.encounters
  set
    status = case
      when status in ('in_consultation', 'ordered') then 'ready_for_billing'
      else status
    end,
    chart_completed_at = coalesce(chart_completed_at, v_now),
    chart_completed_by_user_id = coalesce(chart_completed_by_user_id, v_actor_user_id),
    updated_at = v_now
  where workspace_id = p_workspace_id
    and id = p_encounter_id
    and status <> 'cancelled';

  update public.soap_notes
  set
    status = case when status in ('draft', 'autosaved') then 'signed' else status end,
    signed_at = case when status in ('draft', 'autosaved') then coalesce(signed_at, v_now) else signed_at end,
    updated_at = v_now
  where workspace_id = p_workspace_id
    and encounter_id = p_encounter_id
    and status in ('draft', 'autosaved');

  update public.waiting_queue_entries
  set
    status = 'done',
    finished_at = coalesce(finished_at, v_now)
  where workspace_id = p_workspace_id
    and encounter_id = p_encounter_id
    and queue_type = 'consultation'
    and status = 'in_progress';

  insert into public.waiting_queue_entries (
    workspace_id,
    encounter_id,
    queue_type,
    status,
    priority,
    entered_at
  )
  values (
    p_workspace_id,
    p_encounter_id,
    'billing',
    'waiting',
    'normal',
    v_now
  )
  on conflict (encounter_id, queue_type) do update
  set
    status = case when public.waiting_queue_entries.status = 'cancelled' then 'waiting' else public.waiting_queue_entries.status end,
    entered_at = coalesce(public.waiting_queue_entries.entered_at, excluded.entered_at);

  select public.clair_get_chart_completion(p_workspace_id, p_encounter_id)
    into v_completion_row;

  return v_completion_row;
end;
$$;

revoke all on function public.clair_call_consultation_queue(text, text, uuid) from public;
revoke all on function public.clair_start_consultation(text, text, uuid) from public;
revoke all on function public.clair_complete_chart(text, text, uuid) from public;
grant execute on function public.clair_call_consultation_queue(text, text, uuid) to authenticated;
grant execute on function public.clair_start_consultation(text, text, uuid) to authenticated;
grant execute on function public.clair_complete_chart(text, text, uuid) to authenticated;

comment on table public.encounter_call_events is
  'Local-first outbox for consultation call events. Does not execute DID/provider side effects.';
comment on function public.clair_call_consultation_queue(text, text, uuid) is
  'Moves a consultation queue row from waiting to called and records a local DID-call outbox event.';
comment on function public.clair_start_consultation(text, text, uuid) is
  'Moves called consultation work into in_consultation/in_progress.';
comment on function public.clair_complete_chart(text, text, uuid) is
  'Chart completion writer guarded so waiting/called encounters cannot move directly to ready_for_billing.';
