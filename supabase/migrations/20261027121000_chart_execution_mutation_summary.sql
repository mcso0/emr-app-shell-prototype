begin;

-- Preserve the chart/actor boundary and return the authoritative billing summary
-- in the same transaction as the mutation. Without it, the API reports failure
-- after a successful re-request has already committed.
create or replace function public.clair_mutate_chart_order_execution_for_chart(
  p_workspace_id text, p_actor_user_id uuid, p_chart_id uuid, p_order_id uuid,
  p_action text, p_reason text, p_expected_revision_no integer, p_changes jsonb, p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_encounter_id uuid;
  v_result jsonb;
  v_summary jsonb;
begin
  select encounter_id into v_encounter_id from public.orders where workspace_id = p_workspace_id
    and id = p_order_id and origin_chart_id = p_chart_id;
  if v_encounter_id is null then raise exception 'order_chart_mismatch'; end if;
  perform private.clair_require_order_chart(p_workspace_id,p_actor_user_id::text,v_encounter_id,p_chart_id,false);
  v_result := public.clair_mutate_chart_order_execution_origin_base(p_workspace_id,p_actor_user_id,p_order_id,
    p_action,p_reason,p_expected_revision_no,p_changes,p_idempotency_key);
  v_summary := private.clair_get_chart_order_billing_summary_internal(p_workspace_id,v_encounter_id);
  perform private.clair_broadcast_chart_billing_summary_changed(
    p_workspace_id,v_encounter_id,v_summary->>'etag',txid_current()::text
  );
  return v_result || jsonb_build_object('billingSummary',v_summary);
end;
$$;

commit;
