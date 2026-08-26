-- CLINICAL-MASTER-PR-017 / Phase 8 fulfillment history read model.
-- Additive read RPC only: no release publish, workspace adoption, or activation.

set lock_timeout = '5s';
set statement_timeout = '120s';

create or replace function private.clair_guard_fulfillment_history_amplification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if tg_table_name = 'order_fulfillment_work_items' then
    if new.reason is distinct from old.reason
      and pg_catalog.length(coalesce(new.reason, '')) > 500 then
      raise exception 'fulfillment_reason_too_long' using errcode = '22023';
    end if;
    if pg_catalog.to_jsonb(new) - 'updated_at'
        = pg_catalog.to_jsonb(old) - 'updated_at' then
      raise exception 'fulfillment_work_item_noop' using errcode = '22023';
    end if;
  elsif new.payload ->> 'action' = 'fulfillment_work_item_update'
    and pg_catalog.length(coalesce(new.payload ->> 'reason', '')) > 500 then
    raise exception 'fulfillment_reason_too_long' using errcode = '22023';
  end if;
  return new;
end;
$function$;

revoke all on function private.clair_guard_fulfillment_history_amplification()
from public, anon, authenticated, service_role;

drop trigger if exists order_fulfillment_work_items_history_amplification_guard
  on public.order_fulfillment_work_items;
create trigger order_fulfillment_work_items_history_amplification_guard
before update on public.order_fulfillment_work_items
for each row execute function private.clair_guard_fulfillment_history_amplification();

drop trigger if exists order_events_fulfillment_reason_guard
  on public.order_events;
create trigger order_events_fulfillment_reason_guard
before insert or update on public.order_events
for each row execute function private.clair_guard_fulfillment_history_amplification();

create or replace function public.clair_list_fulfillment_work_item_history_v2(
  p_workspace_id text,
  p_work_item_id uuid,
  p_limit integer default 50,
  p_before_created_at timestamptz default null,
  p_before_event_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_item public.order_fulfillment_work_items%rowtype;
  v_events jsonb;
  v_has_more boolean;
  v_limit integer;
  v_next_cursor jsonb;
begin
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'history_limit_invalid' using errcode = '22023';
  end if;
  if (p_before_created_at is null) <> (p_before_event_id is null) then
    raise exception 'history_cursor_invalid' using errcode = '22023';
  end if;
  v_limit := p_limit;
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;

  select *
  into v_item
  from public.order_fulfillment_work_items item
  where item.workspace_id = p_workspace_id
    and item.id = p_work_item_id;

  if not found then
    raise exception 'work_item_unavailable';
  end if;

  if not private.clair_current_user_has_workspace_permission(
    p_workspace_id,
    private.clair_queue_permission_for_destination(
      coalesce(v_item.destination_module, v_item.queue_type),
      'read'
    )
  ) then
    raise exception 'permission_missing';
  end if;

  with candidates as materialized (
    select event.*
    from public.order_events event
    where event.workspace_id = p_workspace_id
      and event.order_id = v_item.order_id
      and event.payload ->> 'action' = 'fulfillment_work_item_update'
      and event.payload ->> 'fulfillmentWorkItemId' = p_work_item_id::text
      and (
        p_before_created_at is null
        or (event.created_at, event.id) < (p_before_created_at, p_before_event_id)
      )
    order by event.created_at desc, event.id desc
    limit v_limit + 1
  ), page as (
    select * from candidates
    order by created_at desc, id desc
    limit v_limit
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', event.id,
        'workItemId', p_work_item_id,
        'orderId', event.order_id,
        'previousStatus', event.payload ->> 'previousStatus',
        'nextStatus', event.payload ->> 'nextStatus',
        'actorUserId', event.performed_by_user_id,
        'reason', event.payload ->> 'reason',
        'createdAt', event.created_at,
        'source', 'order_event'
      )
      order by event.created_at, event.id
    ),
    '[]'::jsonb
  ),
  (select pg_catalog.count(*) > v_limit from candidates),
  (
    select jsonb_build_object('createdAt', oldest.created_at, 'eventId', oldest.id)
    from page oldest
    order by oldest.created_at, oldest.id
    limit 1
  )
  into v_events, v_has_more, v_next_cursor
  from page event;

  if not v_has_more then
    v_events := jsonb_build_array(
      jsonb_build_object(
        'id', 'work-item:' || v_item.id::text || ':requested',
        'workItemId', v_item.id,
        'orderId', v_item.order_id,
        'previousStatus', null,
        'nextStatus', 'requested',
        'actorUserId', v_item.requested_by_user_id,
        'reason', null,
        'createdAt', v_item.created_at,
        'source', 'work_item_created'
      )
    ) || v_events;
  end if;

  return jsonb_build_object(
    'workspaceId', v_item.workspace_id,
    'workItemId', v_item.id,
    'orderId', v_item.order_id,
    'queueType', v_item.queue_type,
    'events', v_events,
    'hasMore', v_has_more,
    'nextCursor', case when v_has_more then v_next_cursor else null end
  );
end;
$function$;

revoke all on function public.clair_list_fulfillment_work_item_history_v2(text,uuid,integer,timestamptz,uuid)
  from public, anon, service_role;
grant execute on function public.clair_list_fulfillment_work_item_history_v2(text,uuid,integer,timestamptz,uuid)
  to authenticated;

comment on function public.clair_list_fulfillment_work_item_history_v2(text,uuid,integer,timestamptz,uuid) is
  'Workspace- and queue-permission-scoped, cursor-paginated fulfillment transition history for one work item.';
