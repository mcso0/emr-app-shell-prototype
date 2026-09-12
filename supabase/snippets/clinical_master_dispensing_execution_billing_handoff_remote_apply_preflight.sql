-- Release-only prefix for the approved remote application of
-- 20260912230700_dispensing_execution_billing_candidate_handoff.sql.
-- Concatenate this file, the exact migration, and the matching postflight file
-- into one apply_migration query. Do not run the three parts separately.

begin;
set local lock_timeout = '5s';

lock table public.orders,
  public.order_billing_candidates,
  public.invoices,
  public.invoice_lines,
  public.order_execution_result_versions
in share mode;

do $remote_apply_preflight$
declare
  v_execution_definition text := pg_get_functiondef(
    'public.clair_record_order_execution_result(text,uuid,uuid,bigint,text,integer,uuid,timestamptz,jsonb,text,text)'::regprocedure
  );
  v_linker_definition text := pg_get_functiondef(
    'private.clair_link_chart_order_billing_candidates_internal(text,uuid,uuid,uuid[])'::regprocedure
  );
  v_anchor text :=
    'perform public.clair_sync_billing_invoice_candidates_from_fulfillment(p_workspace_id,p_actor_user_id,t.encounter_id,array[t.order_id]);';
  v_state_fingerprint text;
begin
  if encode(extensions.digest(v_execution_definition, 'sha256'), 'hex')
      is distinct from '33763f9994cc60979c301435793c7c71207e5b41f4400a7c24d40d34340c4a7b'
    or encode(extensions.digest(v_linker_definition, 'sha256'), 'hex')
      is distinct from '6e5ca8e3e043cb653cb0049c2d6864a8420a4bd1df47c0753c8d11f905b57ccc'
    or (
      length(v_execution_definition)
        - length(replace(v_execution_definition, v_anchor, ''))
    ) / length(v_anchor) <> 1
    or v_execution_definition like
      '%private.clair_link_chart_order_billing_candidates_internal(%'
  then
    raise exception 'dispensing_execution_billing_handoff_remote_preflight_drift';
  end if;

  select md5(coalesce(string_agg(
    snapshot.table_name || ':' || snapshot.row_id || ':' || snapshot.row_data::text,
    E'\n' order by snapshot.table_name, snapshot.row_id
  ), ''))
  into v_state_fingerprint
  from (
    select 'orders' table_name, orders.workspace_id || ':' || orders.id::text row_id,
      to_jsonb(orders) row_data from public.orders
    union all
    select 'order_billing_candidates', candidate.workspace_id || ':' || candidate.id,
      to_jsonb(candidate) from public.order_billing_candidates candidate
    union all
    select 'invoices', invoice.workspace_id || ':' || invoice.id::text,
      to_jsonb(invoice) from public.invoices invoice
    union all
    select 'invoice_lines', invoice_line.workspace_id || ':' || invoice_line.id::text,
      to_jsonb(invoice_line) from public.invoice_lines invoice_line
    union all
    select 'order_execution_result_versions', result.workspace_id || ':' || result.id::text,
      to_jsonb(result) from public.order_execution_result_versions result
  ) snapshot;

  perform set_config(
    'clair.release.pr024_billing_state_fingerprint',
    v_state_fingerprint,
    true
  );
end;
$remote_apply_preflight$;
