-- CHART-PR-027: explicit, CAS-bound removal of unconfirmed chart order candidates.

do $block$
begin
  if to_regprocedure('public.clair_save_chart_order_draft(text,text,uuid,jsonb)') is not null
    and to_regprocedure('public.clair_save_chart_order_draft_candidate_base(text,text,uuid,jsonb)') is null
  then
    alter function public.clair_save_chart_order_draft(text,text,uuid,jsonb)
      rename to clair_save_chart_order_draft_candidate_base;
  end if;
end;
$block$;

revoke all on function public.clair_save_chart_order_draft_candidate_base(text,text,uuid,jsonb)
  from public, anon, authenticated, service_role;

create or replace function public.clair_save_chart_order_draft(
  p_workspace_id text,
  p_actor_user_id text,
  p_encounter_id uuid,
  p_orders jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, master, extensions, pg_temp
as $function$
declare
  v_actor uuid := private.clair_b3_safe_uuid(p_actor_user_id);
  v_removed_order_ids jsonb := coalesce(p_orders -> 'removedOrderIds', '[]'::jsonb);
  v_removed_count integer;
  v_base_result jsonb;
begin
  if auth.uid() is null or v_actor is null or v_actor is distinct from auth.uid() then
    raise exception 'actor_mismatch' using errcode = '42501';
  end if;
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;
  if not private.clair_current_user_has_workspace_permission(p_workspace_id, 'chart:update') then
    raise exception 'permission_missing';
  end if;
  if jsonb_typeof(coalesce(p_orders, '{}'::jsonb)) is distinct from 'object'
    or (select count(*) from jsonb_object_keys(p_orders)) not in (2, 3)
    or not (p_orders ? 'expectedEtag')
    or not (p_orders ? 'rows')
    or exists (
      select 1 from jsonb_object_keys(p_orders) key
      where key not in ('expectedEtag', 'removedOrderIds', 'rows')
    )
    or jsonb_typeof(v_removed_order_ids) is distinct from 'array'
    or jsonb_array_length(v_removed_order_ids) > 100
  then
    raise exception 'invalid_removed_order_ids';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_removed_order_ids) entry(value)
    where jsonb_typeof(entry.value) is distinct from 'string'
      or private.clair_b3_safe_uuid(entry.value #>> '{}') is null
  ) or (
    select count(*) from jsonb_array_elements(v_removed_order_ids)
  ) <> (
    select count(distinct entry.value #>> '{}')
    from jsonb_array_elements(v_removed_order_ids) entry(value)
  ) or exists (
    select 1
    from jsonb_array_elements(v_removed_order_ids) removed(value)
    join jsonb_array_elements(p_orders -> 'rows') submitted(value)
      on submitted.value ->> 'orderId' = removed.value #>> '{}'
  ) then
    raise exception 'invalid_removed_order_ids';
  end if;

  -- The existing writer retains ownership of validation, row upsert, set
  -- expansion, and compare-and-swap. Passing its original two-key envelope
  -- keeps older clients compatible and all writes inside one transaction.
  v_base_result := public.clair_save_chart_order_draft_candidate_base(
    p_workspace_id,
    p_actor_user_id,
    p_encounter_id,
    jsonb_build_object(
      'expectedEtag', p_orders -> 'expectedEtag',
      'rows', p_orders -> 'rows'
    )
  );

  select count(*)
  into v_removed_count
  from public.orders orders
  join jsonb_array_elements_text(v_removed_order_ids) removed(order_id)
    on orders.id = private.clair_b3_safe_uuid(removed.order_id)
  where orders.workspace_id = p_workspace_id
    and orders.encounter_id = p_encounter_id
    and orders.row_type in ('individual', 'set')
    and orders.status <> 'cancelled'
    and orders.order_confirmation_status in ('draft', 'pending');

  if v_removed_count <> jsonb_array_length(v_removed_order_ids) then
    raise exception 'order_removal_unavailable';
  end if;

  if exists (
    select 1
    from public.orders target
    join jsonb_array_elements_text(v_removed_order_ids) removed(order_id)
      on target.id = private.clair_b3_safe_uuid(removed.order_id)
    where target.workspace_id = p_workspace_id
      and target.encounter_id = p_encounter_id
      and (
        target.confirmed_at is not null
        or target.confirmed_by_user_id is not null
        or target.billing_candidate_id is not null
        or target.billing_candidate_status is distinct from 'not_requested'
        or exists (
          select 1 from public.order_tasks task
          where task.workspace_id = p_workspace_id
            and (
              task.order_id = target.id
              or task.order_id in (
                select child.id from public.orders child
                where child.workspace_id = p_workspace_id
                  and child.parent_chart_order_line_id = target.id
              )
            )
        )
        or exists (
          select 1 from public.order_fulfillment_work_items item
          where item.workspace_id = p_workspace_id
            and (
              item.order_id = target.id
              or item.order_id in (
                select child.id from public.orders child
                where child.workspace_id = p_workspace_id
                  and child.parent_chart_order_line_id = target.id
              )
            )
        )
        or exists (
          select 1 from public.invoice_lines line
          where line.workspace_id = p_workspace_id
            and (
              line.order_id = target.id
              or line.order_id in (
                select child.id from public.orders child
                where child.workspace_id = p_workspace_id
                  and child.parent_chart_order_line_id = target.id
              )
            )
        )
      )
  ) then
    raise exception 'order_removal_has_downstream_artifacts';
  end if;

  with removed_roots as (
    select private.clair_b3_safe_uuid(value) as order_id
    from jsonb_array_elements_text(v_removed_order_ids)
  ), cancelled as (
    update public.orders orders
    set
      status = 'cancelled',
      order_confirmation_status = 'cancelled',
      cancellation_reason = 'draft_candidate_removed',
      updated_at = now()
    where orders.workspace_id = p_workspace_id
      and orders.encounter_id = p_encounter_id
      and orders.status <> 'cancelled'
      and orders.order_confirmation_status in ('draft', 'pending')
      and (
        orders.id in (select order_id from removed_roots)
        or orders.parent_chart_order_line_id in (
          select order_id from removed_roots
        )
      )
    returning orders.id
  )
  insert into public.order_events (
    workspace_id,
    order_id,
    event_type,
    performed_by_user_id,
    payload
  )
  select
    p_workspace_id,
    cancelled.id,
    'cancelled',
    v_actor,
    jsonb_build_object('reason', 'draft_candidate_removed')
  from cancelled;

  return public.clair_get_chart_order_draft(p_workspace_id, p_encounter_id);
end;
$function$;

revoke all on function public.clair_save_chart_order_draft(text,text,uuid,jsonb)
  from public, anon, service_role;
grant execute on function public.clair_save_chart_order_draft(text,text,uuid,jsonb)
  to authenticated;

comment on function public.clair_save_chart_order_draft(text,text,uuid,jsonb) is
  'Shared candidate CAS writer with explicit removedOrderIds soft-cancellation for unconfirmed roots and set children.';
