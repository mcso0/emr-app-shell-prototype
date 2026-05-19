-- DEN-84: implement audit log schema and append helper for live mutations.
-- Local-first audit persistence boundary only. External log sinks, analytics aggregation,
-- production deploy, remote Supabase, and real data access are intentionally out of scope.

create table if not exists public.audit_events (
  id text primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  actor_user_id uuid references public.users(id) on delete set null,
  actor_membership_id uuid references public.user_memberships(id) on delete set null,
  event_type text not null,
  target_type text not null,
  target_id text not null,
  encounter_id uuid references public.encounters(id) on delete set null,
  patient_id uuid references public.patients(id) on delete set null,
  guardian_id uuid references public.guardians(id) on delete set null,
  request_id text,
  reason text,
  before_snapshot jsonb not null default '{}'::jsonb,
  after_snapshot jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint audit_events_event_type_check check (event_type in (
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
    'reception.appointment_checked_in',
    'reception.queue_status_changed',
    'chart.soap_saved',
    'chart.completed',
    'diagnosis.changed',
    'order.draft_changed',
    'order.confirmed',
    'order.billing_candidate_requested',
    'order.status_changed',
    'billing.invoice_candidate_generated',
    'billing.invoice_line_changed',
    'billing.invoice_issued',
    'billing.payment_state_changed',
    'billing.refund_requested'
  )),
  constraint audit_events_json_object_check check (
    jsonb_typeof(before_snapshot) = 'object'
    and jsonb_typeof(after_snapshot) = 'object'
    and jsonb_typeof(metadata) = 'object'
  )
);

alter table public.audit_events enable row level security;

create index if not exists audit_events_workspace_occurred_idx
  on public.audit_events (workspace_id, occurred_at desc, id);

create index if not exists audit_events_workspace_event_type_idx
  on public.audit_events (workspace_id, event_type, occurred_at desc);

create index if not exists audit_events_workspace_target_idx
  on public.audit_events (workspace_id, target_type, target_id, occurred_at desc);

create index if not exists audit_events_workspace_encounter_idx
  on public.audit_events (workspace_id, encounter_id, occurred_at desc)
  where encounter_id is not null;

create index if not exists audit_events_workspace_actor_idx
  on public.audit_events (workspace_id, actor_user_id, occurred_at desc)
  where actor_user_id is not null;

create or replace function public.clair_append_audit_event(
  p_id text,
  p_workspace_id text,
  p_actor_user_id uuid,
  p_actor_membership_id uuid,
  p_event_type text,
  p_target_type text,
  p_target_id text,
  p_encounter_id uuid default null,
  p_patient_id uuid default null,
  p_guardian_id uuid default null,
  p_request_id text default null,
  p_reason text default null,
  p_before_snapshot jsonb default '{}'::jsonb,
  p_after_snapshot jsonb default '{}'::jsonb,
  p_metadata jsonb default '{}'::jsonb,
  p_occurred_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_event public.audit_events%rowtype;
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;

  insert into public.audit_events (
    id,
    workspace_id,
    actor_user_id,
    actor_membership_id,
    event_type,
    target_type,
    target_id,
    encounter_id,
    patient_id,
    guardian_id,
    request_id,
    reason,
    before_snapshot,
    after_snapshot,
    metadata,
    occurred_at
  )
  values (
    p_id,
    p_workspace_id,
    p_actor_user_id,
    p_actor_membership_id,
    p_event_type,
    p_target_type,
    p_target_id,
    p_encounter_id,
    p_patient_id,
    p_guardian_id,
    nullif(btrim(p_request_id), ''),
    nullif(btrim(p_reason), ''),
    coalesce(p_before_snapshot, '{}'::jsonb),
    coalesce(p_after_snapshot, '{}'::jsonb),
    coalesce(p_metadata, '{}'::jsonb),
    coalesce(p_occurred_at, now())
  )
  on conflict (id) do update
    set id = excluded.id
  returning *
  into v_event;

  return jsonb_build_object(
    'id', v_event.id,
    'workspaceId', v_event.workspace_id,
    'actorUserId', v_event.actor_user_id,
    'actorMembershipId', v_event.actor_membership_id,
    'eventType', v_event.event_type,
    'targetType', v_event.target_type,
    'targetId', v_event.target_id,
    'encounterId', v_event.encounter_id,
    'patientId', v_event.patient_id,
    'guardianId', v_event.guardian_id,
    'requestId', v_event.request_id,
    'reason', v_event.reason,
    'before', v_event.before_snapshot,
    'after', v_event.after_snapshot,
    'metadata', v_event.metadata,
    'occurredAt', v_event.occurred_at,
    'createdAt', v_event.created_at
  );
end;
$$;

revoke all on table public.audit_events from public, anon, authenticated;
revoke all on function public.clair_append_audit_event(
  text,
  text,
  uuid,
  uuid,
  text,
  text,
  text,
  uuid,
  uuid,
  uuid,
  text,
  text,
  jsonb,
  jsonb,
  jsonb,
  timestamptz
) from public, anon;

grant execute on function public.clair_append_audit_event(
  text,
  text,
  uuid,
  uuid,
  text,
  text,
  text,
  uuid,
  uuid,
  uuid,
  text,
  text,
  jsonb,
  jsonb,
  jsonb,
  timestamptz
) to authenticated;
