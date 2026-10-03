-- Audit item 3: atomic waiting-threshold idempotency.
create or replace function public.clair_emit_notification_event(
  p_workspace_id text,
  p_actor_user_id uuid,
  p_event jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
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
  if not private.clair_is_active_workspace_member(p_workspace_id) then raise exception 'workspace_membership_missing'; end if;
  if p_actor_user_id is null or p_actor_user_id <> auth.uid() then raise exception 'notification_actor_mismatch'; end if;
  if coalesce(p_event ->> 'eventScopeId', '') = 'order-set-review' then
    raise exception 'order_set_notification_writer_required' using errcode = '42501';
  end if;
  if coalesce(p_event ->> 'eventKey', '') <> 'waiting_over_30m' then
    return public.clair_emit_notification_event_legacy(p_workspace_id, p_actor_user_id, p_event);
  end if;
  if p_event is null or jsonb_typeof(p_event) <> 'object' then raise exception 'invalid_notification_event_payload'; end if;
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
  if coalesce(v_recipient ->> 'kind', '') not in ('user', 'active_role', 'role_queue') then raise exception 'invalid_notification_event_payload'; end if;
  if (v_recipient ->> 'kind') in ('active_role', 'role_queue')
    and (v_recipient ->> 'id') not in ('hospital_admin', 'vet', 'lab', 'desk', 'billing', 'imaging', 'dispensing_treatment', 'inpatient') then
    raise exception 'invalid_notification_event_payload';
  end if;
  if (v_recipient ->> 'kind') = 'user'
    and not private.clair_notification_is_active_workspace_user(p_workspace_id, v_recipient ->> 'id') then
    raise exception 'invalid_notification_event_payload';
  end if;
  if nullif(v_source ->> 'route', '') is not null
    and ((v_source ->> 'route') not like ('/w/' || p_workspace_id || '/%')
      or position(chr(10) in (v_source ->> 'route')) > 0
      or position(chr(13) in (v_source ->> 'route')) > 0) then
    raise exception 'invalid_notification_event_payload';
  end if;
  if not private.clair_notification_actor_can_emit_event(p_workspace_id, p_event ->> 'eventKey', p_event ->> 'domain') then raise exception 'permission_missing'; end if;
  -- Serialize the absent-row case as well as escalation. The key includes
  -- workspace and normalized scope; collisions only serialize unrelated work.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    jsonb_build_array(p_workspace_id, v_event_scope_id, p_event ->> 'dedupeKey')::text, 0
  ));
  select id into v_existing_id from public.notification_events
  where workspace_id = p_workspace_id and event_scope_id = v_event_scope_id and dedupe_key = p_event ->> 'dedupeKey';
  insert into public.notification_events (
    workspace_id, notification_id, event_scope_id, event_key, dedupe_key, domain,
    priority, toast_policy, title, preview, detail, work_type_label, source_label,
    source_action_label, recipient_kind, recipient_id, recipient_label,
    recipient_payload, source_kind, source_entity_id, source_route, source_payload,
    fallback_reason, requires_action, badge_count, actor_user_id, issued_at_label,
    occurred_at, created_at, updated_at
  ) values (
    p_workspace_id,
    coalesce(nullif(trim(p_event ->> 'id'), ''), 'notif-db-' || replace(gen_random_uuid()::text, '-', '')),
    v_event_scope_id, p_event ->> 'eventKey', p_event ->> 'dedupeKey', p_event ->> 'domain',
    p_event ->> 'priority', coalesce(nullif(p_event ->> 'toastPolicy', ''), 'role_active'),
    p_event ->> 'title', p_event ->> 'preview', p_event ->> 'detail', p_event ->> 'workTypeLabel',
    p_event ->> 'sourceLabel', p_event ->> 'sourceActionLabel', v_recipient ->> 'kind', v_recipient ->> 'id',
    coalesce(nullif(v_recipient ->> 'label', ''), v_recipient ->> 'id'), v_recipient,
    v_source ->> 'kind', nullif(v_source ->> 'entity_id', ''), nullif(v_source ->> 'route', ''), v_source,
    nullif(p_event ->> 'fallbackReason', ''), coalesce((p_event ->> 'requiresAction')::boolean, true),
    coalesce((p_event ->> 'badgeCount')::boolean, true), p_actor_user_id,
    coalesce(nullif(p_event ->> 'issuedAtLabel', ''), '방금 전'),
    coalesce((nullif(p_event ->> 'occurredAt', ''))::timestamptz, v_now), v_now,
    coalesce((nullif(p_event ->> 'occurredAt', ''))::timestamptz, v_now)
  ) on conflict (workspace_id, event_scope_id, dedupe_key)
  do update set
    event_key = excluded.event_key, domain = excluded.domain, priority = excluded.priority,
    toast_policy = excluded.toast_policy, title = excluded.title, preview = excluded.preview,
    detail = excluded.detail, work_type_label = excluded.work_type_label, source_label = excluded.source_label,
    source_action_label = excluded.source_action_label, recipient_kind = excluded.recipient_kind,
    recipient_id = excluded.recipient_id, recipient_label = excluded.recipient_label,
    recipient_payload = excluded.recipient_payload, source_kind = excluded.source_kind,
    source_entity_id = excluded.source_entity_id, source_route = excluded.source_route,
    source_payload = excluded.source_payload, fallback_reason = excluded.fallback_reason,
    requires_action = excluded.requires_action, badge_count = excluded.badge_count,
    actor_user_id = excluded.actor_user_id, issued_at_label = excluded.issued_at_label,
    occurred_at = excluded.occurred_at, updated_at = excluded.updated_at,
    bump_count = public.notification_events.bump_count + 1
  -- INSERT still validates all constraints/casts before the conflict branch.
  -- Within one queue entry only a high -> urgent threshold transition writes.
  -- A stale high request cannot downgrade an already urgent alert.
  where public.notification_events.event_key <> 'waiting_over_30m'
    or (public.notification_events.priority <> 'urgent' and excluded.priority = 'urgent')
  returning * into v_saved_event;
  if v_saved_event.id is null then
    select * into v_saved_event from public.notification_events
    where workspace_id = p_workspace_id and event_scope_id = v_event_scope_id
      and dedupe_key = p_event ->> 'dedupeKey';
    v_action := 'unchanged';
  else
    v_action := case when v_existing_id is null then 'created' else 'bumped' end;
  end if;
  -- Waiting alerts never delete or rewrite per-user acknowledgement, even
  -- during escalation, so concurrent read/archive writes cannot be lost.
  return jsonb_build_object('ok', true, 'status', 200, 'action', v_action,
    'notification', private.clair_notification_event_json(v_saved_event),
    'enforcedBy', 'notification-event-persistence');
end;
$$;

revoke all on function public.clair_emit_notification_event(text, uuid, jsonb)
  from public, anon, service_role;
grant execute on function public.clair_emit_notification_event(text, uuid, jsonb)
  to authenticated;

comment on function public.clair_emit_notification_event(text, uuid, jsonb) is
  'Emits authorized waiting notifications once per queue entry and threshold, preserving user acknowledgement; other events delegate to the legacy emitter.';
