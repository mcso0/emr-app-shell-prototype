-- CLINICAL-BILLING-PR-020: return the current billing summary from chart
-- mutations so the client does not need a second GET round trip.

do $block$
begin
  if to_regprocedure('public.clair_save_chart_order_draft(text,text,uuid,jsonb)') is not null
    and to_regprocedure('public.clair_save_chart_order_draft_billing_summary_base(text,text,uuid,jsonb)') is null
  then
    alter function public.clair_save_chart_order_draft(text,text,uuid,jsonb)
      rename to clair_save_chart_order_draft_billing_summary_base;
  end if;

  if to_regprocedure('public.clair_confirm_chart_order_candidates(text,uuid,uuid,uuid[],text,text)') is not null
    and to_regprocedure('public.clair_confirm_chart_order_candidates_billing_summary_base(text,uuid,uuid,uuid[],text,text)') is null
  then
    alter function public.clair_confirm_chart_order_candidates(text,uuid,uuid,uuid[],text,text)
      rename to clair_confirm_chart_order_candidates_billing_summary_base;
  end if;

  if to_regprocedure('public.clair_mutate_chart_order_execution(text,uuid,uuid,text,text,integer,jsonb,text)') is not null
    and to_regprocedure('public.clair_mutate_chart_order_execution_billing_summary_base(text,uuid,uuid,text,text,integer,jsonb,text)') is null
  then
    alter function public.clair_mutate_chart_order_execution(text,uuid,uuid,text,text,integer,jsonb,text)
      rename to clair_mutate_chart_order_execution_billing_summary_base;
  end if;
end;
$block$;

revoke all on function public.clair_save_chart_order_draft_billing_summary_base(text,text,uuid,jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.clair_confirm_chart_order_candidates_billing_summary_base(text,uuid,uuid,uuid[],text,text)
  from public, anon, authenticated, service_role;
revoke all on function public.clair_mutate_chart_order_execution_billing_summary_base(text,uuid,uuid,text,text,integer,jsonb,text)
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
  v_result jsonb;
begin
  if auth.uid() is null or v_actor is null or v_actor is distinct from auth.uid() then
    raise exception 'actor_mismatch' using errcode = '42501';
  end if;
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing' using errcode = '42501';
  end if;
  if not private.clair_current_user_has_workspace_permission(p_workspace_id, 'chart:update')
    or not private.clair_current_user_has_workspace_permission(p_workspace_id, 'chart:view')
  then
    raise exception 'permission_missing' using errcode = '42501';
  end if;

  v_result := public.clair_save_chart_order_draft_billing_summary_base(
    p_workspace_id,
    p_actor_user_id,
    p_encounter_id,
    p_orders
  );

  return v_result || jsonb_build_object(
    'billingSummary',
    private.clair_get_chart_order_billing_summary_internal(
      p_workspace_id,
      p_encounter_id
    )
  );
end;
$function$;

create or replace function public.clair_confirm_chart_order_candidates(
  p_workspace_id text,
  p_actor_user_id uuid,
  p_encounter_id uuid,
  p_selected_root_order_ids uuid[],
  p_expected_draft_etag text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions, pg_temp
as $function$
declare
  v_result jsonb;
begin
  if auth.uid() is null or p_actor_user_id is distinct from auth.uid() then
    raise exception 'actor_mismatch' using errcode = '42501';
  end if;
  if not private.clair_is_active_workspace_member(p_workspace_id)
    or not private.clair_current_user_has_workspace_permission(
      p_workspace_id,
      'chart:update'
    )
    or not private.clair_current_user_has_workspace_permission(
      p_workspace_id,
      'chart:view'
    )
  then
    raise exception 'permission_missing' using errcode = '42501';
  end if;

  v_result := public.clair_confirm_chart_order_candidates_billing_summary_base(
    p_workspace_id,
    p_actor_user_id,
    p_encounter_id,
    p_selected_root_order_ids,
    p_expected_draft_etag,
    p_idempotency_key
  );

  return v_result || jsonb_build_object(
    'billingSummary',
    private.clair_get_chart_order_billing_summary_internal(
      p_workspace_id,
      p_encounter_id
    )
  );
end;
$function$;

create or replace function public.clair_mutate_chart_order_execution(
  p_workspace_id text,
  p_actor_user_id uuid,
  p_order_id uuid,
  p_action text,
  p_reason text,
  p_expected_revision_no integer,
  p_changes jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions, pg_temp
as $function$
declare
  v_encounter_id uuid;
  v_result jsonb;
begin
  if auth.uid() is null or p_actor_user_id is distinct from auth.uid() then
    raise exception 'actor_mismatch' using errcode = '42501';
  end if;
  if not private.clair_is_active_workspace_member(p_workspace_id)
    or not private.clair_current_user_has_workspace_permission(
      p_workspace_id,
      case when btrim(coalesce(p_action, '')) = 'billing_correct'
        then 'billing:issue' else 'order:update' end
    )
    or not private.clair_current_user_has_workspace_permission(
      p_workspace_id,
      'chart:view'
    )
  then
    raise exception 'permission_missing' using errcode = '42501';
  end if;

  select orders.encounter_id
  into v_encounter_id
  from public.orders orders
  where orders.workspace_id = p_workspace_id
    and orders.id = p_order_id;

  if v_encounter_id is null then
    raise exception 'order_unavailable';
  end if;

  v_result := public.clair_mutate_chart_order_execution_billing_summary_base(
    p_workspace_id,
    p_actor_user_id,
    p_order_id,
    p_action,
    p_reason,
    p_expected_revision_no,
    p_changes,
    p_idempotency_key
  );

  return v_result || jsonb_build_object(
    'billingSummary',
    private.clair_get_chart_order_billing_summary_internal(
      p_workspace_id,
      v_encounter_id
    )
  );
end;
$function$;

revoke all on function public.clair_save_chart_order_draft(text,text,uuid,jsonb)
  from public, anon, service_role;
grant execute on function public.clair_save_chart_order_draft(text,text,uuid,jsonb)
  to authenticated;

revoke all on function public.clair_confirm_chart_order_candidates(text,uuid,uuid,uuid[],text,text)
  from public, anon, service_role;
grant execute on function public.clair_confirm_chart_order_candidates(text,uuid,uuid,uuid[],text,text)
  to authenticated;

revoke all on function public.clair_mutate_chart_order_execution(text,uuid,uuid,text,text,integer,jsonb,text)
  from public, anon, service_role;
grant execute on function public.clair_mutate_chart_order_execution(text,uuid,uuid,text,text,integer,jsonb,text)
  to authenticated;

comment on function public.clair_save_chart_order_draft(text,text,uuid,jsonb) is
  'Authorized chart draft mutation returning the current encounter billing summary in the same transaction.';
comment on function public.clair_confirm_chart_order_candidates(text,uuid,uuid,uuid[],text,text) is
  'Authorized atomic chart confirmation returning the current encounter billing summary, including idempotent replay.';
comment on function public.clair_mutate_chart_order_execution(text,uuid,uuid,text,text,integer,jsonb,text) is
  'Authorized chart execution mutation returning the current encounter billing summary, including idempotent replay.';
