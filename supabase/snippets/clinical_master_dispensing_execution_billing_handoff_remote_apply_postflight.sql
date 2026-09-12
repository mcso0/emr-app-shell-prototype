-- Release-only suffix paired with
-- clinical_master_dispensing_execution_billing_handoff_remote_apply_preflight.sql.
-- The final COMMIT occurs only after the function, grant, and preserved-row
-- postconditions all pass.

do $remote_apply_postflight$
declare
  v_execution_function regprocedure :=
    'public.clair_record_order_execution_result(text,uuid,uuid,bigint,text,integer,uuid,timestamptz,jsonb,text,text)'::regprocedure;
  v_execution_definition text := pg_get_functiondef(v_execution_function);
  v_state_fingerprint text;
begin
  if encode(extensions.digest(v_execution_definition, 'sha256'), 'hex')
      is distinct from 'dbd9321c23391fce6e559e01139fba53c1cfeea431fa2208513062ec4b982a18'
    or (
      length(v_execution_definition) - length(replace(
        v_execution_definition,
        'private.clair_link_chart_order_billing_candidates_internal(',
        ''
      ))
    ) / length('private.clair_link_chart_order_billing_candidates_internal(') <> 1
    or (
      length(v_execution_definition) - length(replace(
        v_execution_definition,
        'public.clair_sync_billing_invoice_candidates_from_fulfillment(',
        ''
      ))
    ) / length('public.clair_sync_billing_invoice_candidates_from_fulfillment(') <> 1
    or (
      length(v_execution_definition) - length(replace(
        v_execution_definition,
        'candidate.status = ''candidate_created''',
        ''
      ))
    ) / length('candidate.status = ''candidate_created''') <> 1
  then
    raise exception 'dispensing_execution_billing_handoff_remote_postflight_drift';
  end if;

  if not (
      select function_row.prosecdef
        and function_row.proconfig
          is not distinct from array['search_path=pg_catalog, public, private']::text[]
      from pg_proc function_row
      where function_row.oid = v_execution_function
    )
    or not has_function_privilege('authenticated', v_execution_function, 'execute')
    or has_function_privilege('anon', v_execution_function, 'execute')
    or has_function_privilege('service_role', v_execution_function, 'execute')
  then
    raise exception 'dispensing_execution_billing_handoff_remote_grant_drift';
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

  if v_state_fingerprint is distinct from current_setting(
    'clair.release.pr024_billing_state_fingerprint'
  ) then
    raise exception 'dispensing_execution_billing_handoff_remote_row_drift';
  end if;
end;
$remote_apply_postflight$;

commit;
