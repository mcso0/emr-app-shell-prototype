-- DEN-74: persisted chart order lifecycle status changes.
-- Local-first RPC boundary only. Remote Supabase application is intentionally out of scope.

create or replace function public.clair_get_chart_order_lifecycle(
  p_workspace_id text,
  p_encounter_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_rows jsonb;
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
  ) then
    raise exception 'encounter_unavailable';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'cancellationReason', o.cancellation_reason,
        'encounterId', o.encounter_id,
        'orderId', o.id,
        'status', o.status,
        'updatedAt', o.updated_at,
        'updatedByUserId', null
      )
      order by o.sort_order, o.created_at, o.id
    ),
    '[]'::jsonb
  )
  into v_rows
  from public.orders o
  where o.workspace_id = p_workspace_id
    and o.encounter_id = p_encounter_id;

  return v_rows;
end;
$$;

create or replace function public.clair_save_chart_order_lifecycle(
  p_workspace_id text,
  p_actor_user_id uuid,
  p_encounter_id uuid,
  p_order_id uuid,
  p_status text,
  p_cancellation_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_current_status text;
  v_now timestamptz := now();
  v_rows jsonb;
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
  ) then
    raise exception 'encounter_unavailable';
  end if;

  select o.status
  into v_current_status
  from public.orders o
  where o.workspace_id = p_workspace_id
    and o.encounter_id = p_encounter_id
    and o.id = p_order_id;

  if v_current_status is null then
    raise exception 'order_unavailable';
  end if;

  if p_status not in ('requested', 're_requested', 'in_progress', 'completed', 'cancelled') then
    raise exception 'invalid_transition';
  end if;

  if v_current_status in ('cancelled', 'completed')
    and p_status <> v_current_status then
    raise exception 'invalid_transition';
  end if;

  if v_current_status in ('requested', 're_requested', 'confirmed')
    and p_status not in ('in_progress', 'cancelled', v_current_status) then
    raise exception 'invalid_transition';
  end if;

  if v_current_status = 'in_progress'
    and p_status not in ('completed', 're_requested', 'cancelled', 'in_progress') then
    raise exception 'invalid_transition';
  end if;

  if p_status = 'cancelled' and length(btrim(coalesce(p_cancellation_reason, ''))) = 0 then
    raise exception 'invalid_transition';
  end if;

  update public.orders
  set
    status = p_status,
    work_status = case when p_status = 'completed' then 'completed' else work_status end,
    cancellation_reason = case when p_status = 'cancelled' then btrim(p_cancellation_reason) else cancellation_reason end,
    updated_at = v_now
  where workspace_id = p_workspace_id
    and encounter_id = p_encounter_id
    and id = p_order_id;

  insert into public.order_events (
    workspace_id,
    order_id,
    event_type,
    performed_by_user_id,
    payload,
    created_at
  )
  values (
    p_workspace_id,
    p_order_id,
    case when p_status = 'completed' then 'completed' when p_status = 'cancelled' then 'cancelled' else 'edited' end,
    p_actor_user_id,
    jsonb_build_object(
      'fromStatus', v_current_status,
      'toStatus', p_status,
      'cancellationReason', p_cancellation_reason
    ),
    v_now
  );

  select jsonb_agg(row_data.value)
  into v_rows
  from jsonb_array_elements(public.clair_get_chart_order_lifecycle(p_workspace_id, p_encounter_id)) as row_data(value)
  where nullif(row_data.value->>'orderId', '')::uuid = p_order_id;

  return coalesce(v_rows, '[]'::jsonb);
end;
$$;

revoke all on function public.clair_get_chart_order_lifecycle(text, uuid) from public;
revoke all on function public.clair_save_chart_order_lifecycle(text, uuid, uuid, uuid, text, text) from public;

grant execute on function public.clair_get_chart_order_lifecycle(text, uuid) to authenticated;
grant execute on function public.clair_save_chart_order_lifecycle(text, uuid, uuid, uuid, text, text) to authenticated;
