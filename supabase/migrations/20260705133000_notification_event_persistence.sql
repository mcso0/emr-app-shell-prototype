-- NOTIFICATION-PR-023: live notification event persistence foundation.
-- Local/dev/test scope only. Route adoption, remote replay, realtime delivery, and production launch remain out of scope.

create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  notification_id text not null check (length(trim(notification_id)) > 0),
  event_scope_id text not null default '' check (length(event_scope_id) <= 128),
  event_key text not null check (
    event_key in (
      'order_urgent_handoff',
      'order_recheck_requested',
      'assigned_order_completed',
      'clinical_result_completed',
      'device_result_received',
      'imaging_result_completed',
      'waiting_over_30m',
      'dispensing_treatment_completed',
      'billing_waiting_ready',
      'inpatient_care_delayed'
    )
  ),
  dedupe_key text not null check (length(trim(dedupe_key)) > 0),
  domain text not null check (
    domain in ('reception', 'chart', 'lab', 'imaging', 'dispensing_treatment', 'billing', 'inpatient')
  ),
  priority text not null check (priority in ('urgent', 'high', 'normal', 'reference')),
  toast_policy text not null default 'role_active' check (
    toast_policy in ('immediate', 'role_active', 'source_context_only', 'drawer_only', 'inline_first')
  ),
  title text not null check (length(trim(title)) > 0 and length(title) <= 160),
  preview text not null check (length(trim(preview)) > 0 and length(preview) <= 240),
  detail text not null check (length(trim(detail)) > 0 and length(detail) <= 1000),
  work_type_label text not null check (length(trim(work_type_label)) > 0 and length(work_type_label) <= 80),
  source_label text not null check (length(trim(source_label)) > 0 and length(source_label) <= 160),
  source_action_label text not null check (length(trim(source_action_label)) > 0 and length(source_action_label) <= 80),
  recipient_kind text not null check (recipient_kind in ('user', 'active_role', 'role_queue')),
  recipient_id text not null check (length(trim(recipient_id)) > 0 and length(recipient_id) <= 120),
  recipient_label text not null check (length(trim(recipient_label)) > 0 and length(recipient_label) <= 120),
  recipient_payload jsonb not null check (jsonb_typeof(recipient_payload) = 'object'),
  source_kind text not null check (
    source_kind in (
      'order',
      'lab_result',
      'imaging_result',
      'reception_queue',
      'dispensing_treatment',
      'billing_candidate',
      'inpatient_care',
      'fallback_detail'
    )
  ),
  source_entity_id text,
  source_route text,
  source_payload jsonb not null check (jsonb_typeof(source_payload) = 'object'),
  fallback_reason text check (
    fallback_reason is null
    or fallback_reason in ('missing_source', 'closed_encounter', 'permission_unavailable')
  ),
  requires_action boolean not null default true,
  badge_count boolean not null default true,
  actor_user_id uuid references public.users(id) on delete set null,
  issued_at_label text not null default '방금 전',
  occurred_at timestamptz not null default now(),
  bump_count integer not null default 1 check (bump_count > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, event_scope_id, dedupe_key),
  check (workspace_id <> '')
);

create table if not exists public.notification_user_states (
  workspace_id text not null references public.workspaces(id) on delete cascade,
  actor_user_id uuid not null references public.users(id) on delete cascade,
  state_scope_id text not null check (length(trim(state_scope_id)) > 0 and length(state_scope_id) <= 180),
  notification_id text not null check (length(trim(notification_id)) > 0),
  read_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, actor_user_id, state_scope_id, notification_id),
  check (workspace_id <> '')
);

create index if not exists notification_events_workspace_updated_idx
  on public.notification_events (workspace_id, event_scope_id, updated_at desc);

create index if not exists notification_events_workspace_recipient_idx
  on public.notification_events (workspace_id, recipient_kind, recipient_id, updated_at desc);

create index if not exists notification_user_states_workspace_notification_idx
  on public.notification_user_states (workspace_id, notification_id, actor_user_id);

alter table public.notification_events enable row level security;
alter table public.notification_user_states enable row level security;

revoke all on public.notification_events from public, anon, authenticated;
revoke all on public.notification_user_states from public, anon, authenticated;

drop policy if exists notification_events_workspace_member_select
  on public.notification_events;
create policy notification_events_workspace_member_select
on public.notification_events
for select
to authenticated
using (private.clair_is_active_workspace_member(workspace_id));

drop policy if exists notification_events_workspace_member_write
  on public.notification_events;
create policy notification_events_workspace_member_write
on public.notification_events
for all
to authenticated
using (private.clair_is_active_workspace_member(workspace_id))
with check (private.clair_is_active_workspace_member(workspace_id));

drop policy if exists notification_user_states_workspace_member_select
  on public.notification_user_states;
create policy notification_user_states_workspace_member_select
on public.notification_user_states
for select
to authenticated
using (private.clair_is_active_workspace_member(workspace_id));

drop policy if exists notification_user_states_workspace_member_write
  on public.notification_user_states;
create policy notification_user_states_workspace_member_write
on public.notification_user_states
for all
to authenticated
using (private.clair_is_active_workspace_member(workspace_id))
with check (private.clair_is_active_workspace_member(workspace_id));

create or replace function private.clair_notification_scope_id(p_event_scope_id text)
returns text
language sql
stable
as $$
  select left(coalesce(trim(p_event_scope_id), ''), 128);
$$;

create or replace function private.clair_notification_event_json(p_event public.notification_events)
returns jsonb
language sql
stable
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', p_event.notification_id,
    'event_key', p_event.event_key,
    'dedupe_key', p_event.dedupe_key,
    'domain', p_event.domain,
    'priority', p_event.priority,
    'toast_policy', p_event.toast_policy,
    'sourceActionLabel', p_event.source_action_label,
    'workTypeLabel', p_event.work_type_label,
    'title', p_event.title,
    'preview', p_event.preview,
    'detail', p_event.detail,
    'sourceLabel', p_event.source_label,
    'recipientLabel', p_event.recipient_label,
    'recipient', p_event.recipient_payload,
    'source', p_event.source_payload,
    'fallback_reason', p_event.fallback_reason,
    'bump_count', case when p_event.bump_count > 1 then p_event.bump_count else null end,
    'issuedAtLabel', p_event.issued_at_label,
    'created_at', p_event.created_at,
    'updated_at', p_event.updated_at,
    'read_state_key', 'clair.notifications.v0.read',
    'archive_state_key', 'clair.notifications.v0.archive',
    'unread', true,
    'archived', false,
    'requires_action', p_event.requires_action,
    'badge_count', p_event.badge_count
  ));
$$;

create or replace function private.clair_notification_actor_has_any_role(
  p_workspace_id text,
  p_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select exists (
    select 1
    from public.user_memberships membership
    join public.users app_user on app_user.id = membership.user_id
    where membership.workspace_id = p_workspace_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
      and app_user.status = 'active'
      and membership.roles && p_roles
  );
$$;

create or replace function private.clair_notification_active_role_ids_for_actor(
  p_workspace_id text
)
returns text[]
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select coalesce(array_agg(distinct role_id), array[]::text[])
  from public.user_memberships membership
  join public.users app_user on app_user.id = membership.user_id
  cross join lateral unnest(
    case
      when membership.roles @> array['hospital_admin']::text[] then
        array['vet', 'lab', 'desk', 'billing', 'imaging', 'dispensing_treatment', 'inpatient']::text[]
      when membership.roles @> array['technician']::text[] then
        array['lab', 'imaging', 'dispensing_treatment', 'inpatient']::text[]
      when membership.roles @> array['front_desk']::text[] then
        array['desk', 'billing']::text[]
      when membership.roles @> array['vet']::text[] then
        array['vet']::text[]
      else array[]::text[]
    end
  ) as role_id
  where membership.workspace_id = p_workspace_id
    and membership.user_id = auth.uid()
    and membership.status = 'active'
    and app_user.status = 'active';
$$;

create or replace function private.clair_notification_actor_can_view_domain(
  p_workspace_id text,
  p_domain text
)
returns boolean
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select
    case
      when p_domain = 'billing' then
        private.clair_notification_actor_has_any_role(
          p_workspace_id,
          array['hospital_admin', 'vet', 'technician', 'front_desk']::text[]
        )
      when p_domain = 'reception' then
        private.clair_notification_actor_has_any_role(
          p_workspace_id,
          array['hospital_admin', 'vet', 'technician', 'front_desk']::text[]
        )
      when p_domain = 'lab' then
        private.clair_notification_actor_has_any_role(
          p_workspace_id,
          array['hospital_admin', 'vet', 'technician']::text[]
        )
      when p_domain = 'imaging' then
        private.clair_notification_actor_has_any_role(
          p_workspace_id,
          array['hospital_admin', 'vet', 'technician']::text[]
        )
      when p_domain = 'dispensing_treatment' then
        private.clair_notification_actor_has_any_role(
          p_workspace_id,
          array['hospital_admin', 'vet', 'technician']::text[]
        )
      when p_domain = 'chart' then
        private.clair_notification_actor_has_any_role(
          p_workspace_id,
          array['hospital_admin', 'vet', 'technician', 'front_desk']::text[]
        )
      else true
    end;
$$;

create or replace function private.clair_notification_event_visible_to_actor(
  p_workspace_id text,
  p_recipient_kind text,
  p_recipient_id text,
  p_domain text
)
returns boolean
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select private.clair_notification_actor_can_view_domain(p_workspace_id, p_domain)
    and (
      private.clair_notification_actor_has_any_role(
        p_workspace_id,
        array['hospital_admin']::text[]
      )
      or (
        p_recipient_kind = 'user'
        and p_recipient_id = auth.uid()::text
      )
      or (
        p_recipient_kind in ('active_role', 'role_queue')
        and p_recipient_id = any(
          private.clair_notification_active_role_ids_for_actor(p_workspace_id)
        )
      )
    );
$$;

create or replace function private.clair_notification_actor_can_emit_event(
  p_workspace_id text,
  p_event_key text,
  p_domain text
)
returns boolean
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select
    case
      when private.clair_notification_actor_has_any_role(
        p_workspace_id,
        array['hospital_admin']::text[]
      ) then true
      when p_event_key = 'clinical_result_completed' and p_domain = 'lab' then
        private.clair_notification_actor_has_any_role(
          p_workspace_id,
          array['technician']::text[]
        )
      when p_event_key = 'order_recheck_requested'
        and p_domain in ('chart', 'lab', 'imaging', 'dispensing_treatment') then
        private.clair_notification_actor_has_any_role(
          p_workspace_id,
          array['vet', 'technician']::text[]
        )
      when p_event_key = 'waiting_over_30m' and p_domain = 'reception' then
        private.clair_notification_actor_has_any_role(
          p_workspace_id,
          array['front_desk']::text[]
        )
      when p_event_key = 'billing_waiting_ready' then
        private.clair_notification_actor_has_any_role(
          p_workspace_id,
          array['vet', 'technician', 'front_desk']::text[]
        )
      else false
    end;
$$;

create or replace function private.clair_notification_is_active_workspace_user(
  p_workspace_id text,
  p_user_id text
)
returns boolean
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select exists (
    select 1
    from public.user_memberships membership
    join public.users app_user on app_user.id = membership.user_id
    where membership.workspace_id = p_workspace_id
      and membership.user_id::text = p_user_id
      and membership.status = 'active'
      and app_user.status = 'active'
  );
$$;

create or replace function public.clair_emit_notification_event(
  p_workspace_id text,
  p_actor_user_id uuid,
  p_event jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_action text;
  v_existing_id uuid;
  v_event_scope_id text;
  v_now timestamptz := now();
  v_saved_event public.notification_events;
  v_source jsonb;
  v_recipient jsonb;
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;

  if p_actor_user_id is null or p_actor_user_id <> auth.uid() then
    raise exception 'notification_actor_mismatch';
  end if;

  if p_event is null or jsonb_typeof(p_event) <> 'object' then
    raise exception 'invalid_notification_event_payload';
  end if;

  v_source := coalesce(p_event -> 'source', '{}'::jsonb);
  v_recipient := coalesce(p_event -> 'recipient', '{}'::jsonb);
  v_event_scope_id := private.clair_notification_scope_id(p_event ->> 'eventScopeId');

  if length(trim(coalesce(p_event ->> 'dedupeKey', ''))) = 0
    or length(trim(coalesce(p_event ->> 'eventKey', ''))) = 0
    or length(trim(coalesce(p_event ->> 'title', ''))) = 0
    or length(trim(coalesce(v_source ->> 'kind', ''))) = 0
    or length(trim(coalesce(v_recipient ->> 'kind', ''))) = 0
    or length(trim(coalesce(v_recipient ->> 'id', ''))) = 0 then
    raise exception 'invalid_notification_event_payload';
  end if;

  if coalesce(v_recipient ->> 'kind', '') not in ('user', 'active_role', 'role_queue') then
    raise exception 'invalid_notification_event_payload';
  end if;

  if (v_recipient ->> 'kind') in ('active_role', 'role_queue')
    and (v_recipient ->> 'id') not in (
      'vet',
      'lab',
      'desk',
      'billing',
      'imaging',
      'dispensing_treatment',
      'inpatient'
    ) then
    raise exception 'invalid_notification_event_payload';
  end if;

  if (v_recipient ->> 'kind') = 'user'
    and not private.clair_notification_is_active_workspace_user(
      p_workspace_id,
      v_recipient ->> 'id'
    ) then
    raise exception 'invalid_notification_event_payload';
  end if;

  if nullif(v_source ->> 'route', '') is not null
    and (
      (v_source ->> 'route') not like ('/w/' || p_workspace_id || '/%')
      or position(chr(10) in (v_source ->> 'route')) > 0
      or position(chr(13) in (v_source ->> 'route')) > 0
    ) then
    raise exception 'invalid_notification_event_payload';
  end if;

  if not private.clair_notification_actor_can_emit_event(
    p_workspace_id,
    p_event ->> 'eventKey',
    p_event ->> 'domain'
  ) then
    raise exception 'permission_missing';
  end if;

  select id
    into v_existing_id
  from public.notification_events
  where workspace_id = p_workspace_id
    and event_scope_id = v_event_scope_id
    and dedupe_key = p_event ->> 'dedupeKey';

  insert into public.notification_events (
    workspace_id,
    notification_id,
    event_scope_id,
    event_key,
    dedupe_key,
    domain,
    priority,
    toast_policy,
    title,
    preview,
    detail,
    work_type_label,
    source_label,
    source_action_label,
    recipient_kind,
    recipient_id,
    recipient_label,
    recipient_payload,
    source_kind,
    source_entity_id,
    source_route,
    source_payload,
    fallback_reason,
    requires_action,
    badge_count,
    actor_user_id,
    issued_at_label,
    occurred_at,
    created_at,
    updated_at
  )
  values (
    p_workspace_id,
    coalesce(nullif(trim(p_event ->> 'id'), ''), 'notif-db-' || replace(gen_random_uuid()::text, '-', '')),
    v_event_scope_id,
    p_event ->> 'eventKey',
    p_event ->> 'dedupeKey',
    p_event ->> 'domain',
    p_event ->> 'priority',
    coalesce(nullif(p_event ->> 'toastPolicy', ''), 'role_active'),
    p_event ->> 'title',
    p_event ->> 'preview',
    p_event ->> 'detail',
    p_event ->> 'workTypeLabel',
    p_event ->> 'sourceLabel',
    p_event ->> 'sourceActionLabel',
    v_recipient ->> 'kind',
    v_recipient ->> 'id',
    coalesce(nullif(v_recipient ->> 'label', ''), v_recipient ->> 'id'),
    v_recipient,
    v_source ->> 'kind',
    nullif(v_source ->> 'entity_id', ''),
    nullif(v_source ->> 'route', ''),
    v_source,
    nullif(p_event ->> 'fallbackReason', ''),
    coalesce((p_event ->> 'requiresAction')::boolean, true),
    coalesce((p_event ->> 'badgeCount')::boolean, true),
    p_actor_user_id,
    coalesce(nullif(p_event ->> 'issuedAtLabel', ''), '방금 전'),
    coalesce((nullif(p_event ->> 'occurredAt', ''))::timestamptz, v_now),
    v_now,
    coalesce((nullif(p_event ->> 'occurredAt', ''))::timestamptz, v_now)
  )
  on conflict (workspace_id, event_scope_id, dedupe_key)
  do update set
    event_key = excluded.event_key,
    domain = excluded.domain,
    priority = excluded.priority,
    toast_policy = excluded.toast_policy,
    title = excluded.title,
    preview = excluded.preview,
    detail = excluded.detail,
    work_type_label = excluded.work_type_label,
    source_label = excluded.source_label,
    source_action_label = excluded.source_action_label,
    recipient_kind = excluded.recipient_kind,
    recipient_id = excluded.recipient_id,
    recipient_label = excluded.recipient_label,
    recipient_payload = excluded.recipient_payload,
    source_kind = excluded.source_kind,
    source_entity_id = excluded.source_entity_id,
    source_route = excluded.source_route,
    source_payload = excluded.source_payload,
    fallback_reason = excluded.fallback_reason,
    requires_action = excluded.requires_action,
    badge_count = excluded.badge_count,
    actor_user_id = excluded.actor_user_id,
    issued_at_label = excluded.issued_at_label,
    occurred_at = excluded.occurred_at,
    updated_at = excluded.updated_at,
    bump_count = public.notification_events.bump_count + 1
  returning * into v_saved_event;

  v_action := case when v_existing_id is null then 'created' else 'bumped' end;

  if v_action = 'bumped' then
    delete from public.notification_user_states
    where workspace_id = p_workspace_id
      and notification_id = v_saved_event.notification_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'status', 200,
    'action', v_action,
    'notification', private.clair_notification_event_json(v_saved_event),
    'enforcedBy', 'notification-event-persistence'
  );
end;
$$;

create or replace function public.clair_list_notification_events(
  p_workspace_id text,
  p_event_scope_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_event_scope_id text;
  v_notifications jsonb;
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;

  v_event_scope_id := private.clair_notification_scope_id(p_event_scope_id);

  select coalesce(
    jsonb_agg(private.clair_notification_event_json(event_row) order by event_row.updated_at desc),
    '[]'::jsonb
  )
    into v_notifications
  from public.notification_events event_row
  where event_row.workspace_id = p_workspace_id
    and (
      event_row.event_scope_id = ''
      or (v_event_scope_id <> '' and event_row.event_scope_id = v_event_scope_id)
    )
    and private.clair_notification_event_visible_to_actor(
      p_workspace_id,
      event_row.recipient_kind,
      event_row.recipient_id,
      event_row.domain
    );

  return jsonb_build_object(
    'ok', true,
    'status', 200,
    'notifications', v_notifications,
    'enforcedBy', 'notification-event-persistence'
  );
end;
$$;

create or replace function public.clair_upsert_notification_user_state(
  p_workspace_id text,
  p_actor_user_id uuid,
  p_state_scope_id text,
  p_notification_id text,
  p_read_at timestamptz default null,
  p_archived_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;

  if p_actor_user_id is null or p_actor_user_id <> auth.uid() then
    raise exception 'notification_actor_mismatch';
  end if;

  if p_actor_user_id is null
    or length(trim(coalesce(p_state_scope_id, ''))) = 0
    or length(trim(coalesce(p_notification_id, ''))) = 0 then
    raise exception 'invalid_notification_event_payload';
  end if;

  if left(trim(p_state_scope_id), 180) <> p_actor_user_id::text then
    raise exception 'notification_actor_mismatch';
  end if;

  if not exists (
    select 1
    from public.notification_events event_row
    where event_row.workspace_id = p_workspace_id
      and event_row.notification_id = p_notification_id
      and private.clair_notification_event_visible_to_actor(
        p_workspace_id,
        event_row.recipient_kind,
        event_row.recipient_id,
        event_row.domain
      )
  ) then
    raise exception 'notification_not_found';
  end if;

  insert into public.notification_user_states (
    workspace_id,
    actor_user_id,
    state_scope_id,
    notification_id,
    read_at,
    archived_at,
    created_at,
    updated_at
  )
  values (
    p_workspace_id,
    p_actor_user_id,
    left(trim(p_state_scope_id), 180),
    p_notification_id,
    p_read_at,
    p_archived_at,
    now(),
    now()
  )
  on conflict (workspace_id, actor_user_id, state_scope_id, notification_id)
  do update set
    read_at = excluded.read_at,
    archived_at = excluded.archived_at,
    updated_at = excluded.updated_at;

  return jsonb_build_object(
    'ok', true,
    'status', 200,
    'enforcedBy', 'notification-user-state-persistence'
  );
end;
$$;

create or replace function public.clair_list_notification_user_states(
  p_workspace_id text,
  p_actor_user_id uuid,
  p_state_scope_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_states jsonb;
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;

  if p_actor_user_id is null or p_actor_user_id <> auth.uid() then
    raise exception 'notification_actor_mismatch';
  end if;

  if p_actor_user_id is null
    or length(trim(coalesce(p_state_scope_id, ''))) = 0 then
    raise exception 'invalid_notification_event_payload';
  end if;

  if left(trim(p_state_scope_id), 180) <> p_actor_user_id::text then
    raise exception 'notification_actor_mismatch';
  end if;

  select coalesce(
    jsonb_agg(jsonb_build_object(
      'notificationId', state.notification_id,
      'readAt', state.read_at,
      'archivedAt', state.archived_at
    )),
    '[]'::jsonb
  )
    into v_states
  from public.notification_user_states state
  where state.workspace_id = p_workspace_id
    and state.actor_user_id = p_actor_user_id
    and state.state_scope_id = left(trim(p_state_scope_id), 180);

  return jsonb_build_object(
    'ok', true,
    'status', 200,
    'states', v_states,
    'enforcedBy', 'notification-user-state-persistence'
  );
end;
$$;

grant execute on function public.clair_emit_notification_event(text, uuid, jsonb)
  to authenticated;
grant execute on function public.clair_list_notification_events(text, text)
  to authenticated;
grant execute on function public.clair_list_notification_user_states(text, uuid, text)
  to authenticated;
grant execute on function public.clair_upsert_notification_user_state(text, uuid, text, text, timestamptz, timestamptz)
  to authenticated;

comment on table public.notification_events is
  'NOTIFICATION-PR-023 local/dev live notification event persistence foundation. Route adoption and remote replay remain out of scope.';
comment on table public.notification_user_states is
  'NOTIFICATION-PR-023 per-user read/archive state persistence foundation for live notifications.';
