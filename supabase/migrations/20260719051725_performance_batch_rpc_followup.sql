-- ENGINEERING-PERF-PR-001: set-based notification and fulfillment mutations.

create or replace function public.clair_mark_notification_user_states_read(
  p_workspace_id text,
  p_actor_user_id uuid,
  p_state_scope_id text,
  p_notification_ids text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_requested_count integer := 0;
  v_updated_count integer := 0;
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;

  if p_actor_user_id is null or p_actor_user_id <> auth.uid() then
    raise exception 'notification_actor_mismatch';
  end if;

  if length(trim(coalesce(p_state_scope_id, ''))) = 0
    or left(trim(p_state_scope_id), 180) <> p_actor_user_id::text then
    raise exception 'notification_actor_mismatch';
  end if;

  select count(distinct trim(notification_id))
  into v_requested_count
  from unnest(coalesce(p_notification_ids, array[]::text[])) notification_id
  where length(trim(notification_id)) > 0;

  if v_requested_count = 0 then
    return jsonb_build_object(
      'ok', true,
      'status', 200,
      'updatedCount', 0,
      'enforcedBy', 'notification-user-state-persistence'
    );
  end if;

  if v_requested_count > 100
    or v_requested_count <> coalesce(array_length(p_notification_ids, 1), 0) then
    raise exception 'invalid_notification_event_payload';
  end if;

  if (
    select count(distinct event_row.notification_id)
    from public.notification_events event_row
    where event_row.workspace_id = p_workspace_id
      and event_row.notification_id = any(p_notification_ids)
      and private.clair_notification_event_visible_to_actor(
        p_workspace_id,
        event_row.recipient_kind,
        event_row.recipient_id,
        event_row.domain
      )
  ) <> v_requested_count then
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
  select
    p_workspace_id,
    p_actor_user_id,
    left(trim(p_state_scope_id), 180),
    selected.notification_id,
    now(),
    null,
    now(),
    now()
  from (
    select distinct trim(notification_id) as notification_id
    from unnest(p_notification_ids) notification_id
  ) selected
  on conflict (workspace_id, actor_user_id, state_scope_id, notification_id)
  do update set
    read_at = coalesce(public.notification_user_states.read_at, excluded.read_at),
    updated_at = now();

  get diagnostics v_updated_count = row_count;

  return jsonb_build_object(
    'ok', true,
    'status', 200,
    'updatedCount', v_updated_count,
    'enforcedBy', 'notification-user-state-persistence'
  );
end;
$$;

create or replace function public.clair_enrich_fulfillment_work_item_snapshots(
  p_workspace_id text,
  p_actor_user_id uuid,
  p_snapshots jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_matched_count integer := 0;
  v_requested_count integer := 0;
  v_rows jsonb;
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;

  if p_actor_user_id is null or p_actor_user_id <> auth.uid() then
    raise exception 'fulfillment_actor_mismatch';
  end if;

  if jsonb_typeof(p_snapshots) <> 'array'
    or jsonb_array_length(p_snapshots) = 0
    or jsonb_array_length(p_snapshots) > 100
    or octet_length(p_snapshots::text) > 1048576 then
    raise exception 'invalid_snapshot_payload';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_snapshots) as snapshot(
      "orderId" text,
      "sourceSnapshot" jsonb
    )
    where snapshot."orderId" is null
      or snapshot."orderId" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or jsonb_typeof(snapshot."sourceSnapshot") <> 'object'
  ) then
    raise exception 'invalid_snapshot_payload';
  end if;

  select count(distinct snapshot."orderId")
  into v_requested_count
  from jsonb_to_recordset(p_snapshots) as snapshot(
    "orderId" text,
    "sourceSnapshot" jsonb
  );

  if v_requested_count <> jsonb_array_length(p_snapshots) then
    raise exception 'invalid_snapshot_payload';
  end if;

  select count(*)
  into v_matched_count
  from public.order_fulfillment_work_items item
  where item.workspace_id = p_workspace_id
    and item.order_id in (
      select snapshot."orderId"::uuid
      from jsonb_to_recordset(p_snapshots) as snapshot(
        "orderId" text,
        "sourceSnapshot" jsonb
      )
    );

  if v_matched_count <> v_requested_count then
    raise exception 'work_item_unavailable';
  end if;

  with snapshots as (
    select
      snapshot."orderId"::uuid as order_id,
      snapshot."sourceSnapshot" as source_snapshot
    from jsonb_to_recordset(p_snapshots) as snapshot(
      "orderId" text,
      "sourceSnapshot" jsonb
    )
  ),
  updated as (
    update public.order_fulfillment_work_items item
    set
      source_snapshot = snapshots.source_snapshot,
      updated_at = now()
    from snapshots
    where item.workspace_id = p_workspace_id
      and item.order_id = snapshots.order_id
    returning item.*
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', item.id,
        'workspaceId', item.workspace_id,
        'encounterId', item.encounter_id,
        'orderId', item.order_id,
        'orderType', item.order_type,
        'queueType', item.queue_type,
        'status', item.status,
        'priority', item.priority,
        'requestedByUserId', item.requested_by_user_id,
        'assignedToUserId', item.assigned_to_user_id,
        'dueAt', item.due_at,
        'completedAt', item.completed_at,
        'cancelledAt', item.cancelled_at,
        'returnedAt', item.returned_at,
        'reason', item.reason,
        'sourceSnapshot', item.source_snapshot,
        'createdAt', item.created_at,
        'updatedAt', item.updated_at
      )
      order by item.updated_at desc, item.id
    ),
    '[]'::jsonb
  )
  into v_rows
  from updated item;

  return v_rows;
end;
$$;

revoke all on function public.clair_emit_notification_event(text, uuid, jsonb)
  from public, anon;
revoke all on function public.clair_list_notification_events(text, text)
  from public, anon;
revoke all on function public.clair_list_notification_user_states(text, uuid, text)
  from public, anon;
revoke all on function public.clair_upsert_notification_user_state(text, uuid, text, text, timestamptz, timestamptz)
  from public, anon;
revoke all on function public.clair_mark_notification_user_states_read(text, uuid, text, text[])
  from public, anon;
grant execute on function public.clair_mark_notification_user_states_read(text, uuid, text, text[])
  to authenticated;

revoke all on function public.clair_list_fulfillment_work_items(text, text, uuid, uuid, text)
  from public, anon;
revoke all on function public.clair_sync_fulfillment_work_items_from_orders(text, uuid, uuid, uuid[])
  from public, anon;
revoke all on function public.clair_update_fulfillment_work_item(text, uuid, uuid, text, uuid, text)
  from public, anon;
revoke all on function public.clair_enrich_fulfillment_work_item_snapshots(text, uuid, jsonb)
  from public, anon;
grant execute on function public.clair_enrich_fulfillment_work_item_snapshots(text, uuid, jsonb)
  to authenticated;

alter function private.clair_fulfillment_transition_allowed(text, text)
  set search_path = public, private, pg_temp;

comment on function public.clair_mark_notification_user_states_read(text, uuid, text, text[])
  is 'Marks a bounded visible notification set read with one authenticated set-based mutation.';
comment on function public.clair_enrich_fulfillment_work_item_snapshots(text, uuid, jsonb)
  is 'Updates a bounded fulfillment source snapshot set with one authenticated mutation.';
