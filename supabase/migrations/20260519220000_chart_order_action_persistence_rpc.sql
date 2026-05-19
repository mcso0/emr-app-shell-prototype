-- DEN-73: chart order confirmation and selected submit persistence.
-- Local-first RPC boundary only. Remote Supabase application is intentionally out of scope.

create or replace function public.clair_get_chart_order_actions(
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
        'billingCandidateId', o.billing_candidate_id,
        'billingCandidateStatus', o.billing_candidate_status,
        'confirmedAt', o.confirmed_at,
        'confirmedByUserId', o.confirmed_by_user_id,
        'encounterId', o.encounter_id,
        'orderConfirmationStatus', o.order_confirmation_status,
        'orderId', o.id,
        'status', o.status,
        'updatedAt', o.updated_at
      )
      order by o.sort_order, o.created_at, o.id
    ),
    '[]'::jsonb
  )
  into v_rows
  from public.orders o
  where o.workspace_id = p_workspace_id
    and o.encounter_id = p_encounter_id
    and o.status <> 'cancelled';

  return v_rows;
end;
$$;

create or replace function public.clair_save_chart_order_action(
  p_workspace_id text,
  p_actor_user_id uuid,
  p_encounter_id uuid,
  p_action text,
  p_order_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_now timestamptz := now();
  v_selected_count integer := coalesce(array_length(p_order_ids, 1), 0);
  v_matched_count integer := 0;
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

  if p_action not in ('confirm', 'bill') or v_selected_count = 0 or v_selected_count > 100 then
    raise exception 'invalid_order_action';
  end if;

  select count(*)
  into v_matched_count
  from public.orders o
  where o.workspace_id = p_workspace_id
    and o.encounter_id = p_encounter_id
    and o.id = any(p_order_ids)
    and o.status <> 'cancelled'
    and o.order_confirmation_status <> 'cancelled';

  if v_matched_count <> v_selected_count then
    raise exception 'order_unavailable';
  end if;

  if p_action = 'confirm' then
    update public.orders o
    set
      status = case
        when o.status in ('draft', 'requested', 're_requested') then 'confirmed'
        else o.status
      end,
      order_confirmation_status = 'confirmed',
      confirmed_by_user_id = p_actor_user_id,
      confirmed_at = coalesce(o.confirmed_at, v_now),
      task_status = coalesce(o.task_status, 'pending'),
      updated_at = v_now
    where o.workspace_id = p_workspace_id
      and o.encounter_id = p_encounter_id
      and o.id = any(p_order_ids)
      and o.status <> 'cancelled'
      and o.order_confirmation_status <> 'cancelled';
  else
    update public.orders o
    set
      billing_candidate_status = 'candidate_created',
      billing_candidate_id = coalesce(o.billing_candidate_id, concat('billcand-', o.id::text)),
      updated_at = v_now
    where o.workspace_id = p_workspace_id
      and o.encounter_id = p_encounter_id
      and o.id = any(p_order_ids)
      and o.status <> 'cancelled'
      and o.order_confirmation_status <> 'cancelled';
  end if;

  insert into public.order_events (
    workspace_id,
    order_id,
    event_type,
    performed_by_user_id,
    payload,
    created_at
  )
  select
    p_workspace_id,
    o.id,
    'edited',
    p_actor_user_id,
    jsonb_build_object(
      'action', p_action,
      'orderConfirmationStatus', o.order_confirmation_status,
      'billingCandidateStatus', o.billing_candidate_status,
      'billingCandidateId', o.billing_candidate_id,
      'billingSyncHookPoint', p_action = 'bill'
    ),
    v_now
  from public.orders o
  where o.workspace_id = p_workspace_id
    and o.encounter_id = p_encounter_id
    and o.id = any(p_order_ids);

  select coalesce(
    jsonb_agg(row_data.value order by row_data.value->>'orderId'),
    '[]'::jsonb
  )
  into v_rows
  from jsonb_array_elements(public.clair_get_chart_order_actions(p_workspace_id, p_encounter_id)) as row_data(value)
  where nullif(row_data.value->>'orderId', '')::uuid = any(p_order_ids);

  return v_rows;
end;
$$;

revoke all on function public.clair_get_chart_order_actions(text, uuid) from public;
revoke all on function public.clair_save_chart_order_action(text, uuid, uuid, text, uuid[]) from public;

grant execute on function public.clair_get_chart_order_actions(text, uuid) to authenticated;
grant execute on function public.clair_save_chart_order_action(text, uuid, uuid, text, uuid[]) to authenticated;
