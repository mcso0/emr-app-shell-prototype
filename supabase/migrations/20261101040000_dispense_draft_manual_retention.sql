-- Keep the existing operational result while the draft writer rebuilds catalog
-- snapshots. Its subsequent UPDATE projection recalculates against the final
-- detail inputs and retains manual quantity/reconfirmation state.
-- No rows, permissions, historical commands or set-pricing fields are rewritten.
do $patch_draft_dispense_retention$
declare
  v_oid regprocedure := 'public.clair_save_chart_order_draft_phase2_base(text,text,uuid,jsonb)'::regprocedure;
  v_definition text := pg_get_functiondef(v_oid);
  v_owner oid;
  v_acl aclitem[];
  v_anchor text := $anchor$calculation_outputs = case
          when excluded.row_type = 'set_child'
            and excluded.clinical_order_type = 'dispensing'
            and not private.clair_is_set_pricing_calculation_outputs(
              orders.calculation_outputs
            )$anchor$;
begin
  select proowner, proacl into v_owner, v_acl from pg_proc where oid=v_oid;
  if (length(v_definition)-length(replace(v_definition,v_anchor,'')))/length(v_anchor) <> 3 then
    raise exception 'dispense_draft_retention_anchor_drift';
  end if;
  execute replace(v_definition,v_anchor,$replacement$calculation_outputs = case
          when excluded.row_type in ('individual','set_child')
            and orders.row_type = excluded.row_type
            and orders.clinical_order_type = 'dispensing'
            and excluded.clinical_order_type = 'dispensing'
            and not private.clair_is_set_pricing_calculation_outputs(
              orders.calculation_outputs
            )$replacement$);
  if not exists(select from pg_proc where oid=v_oid and proowner=v_owner and proacl is not distinct from v_acl) then
    raise exception 'dispense_draft_retention_permissions_changed';
  end if;
end;
$patch_draft_dispense_retention$;
