-- Exercise the exact conflict expression extracted from the real B3 draft
-- writer with real INSERT/UPDATE projection triggers. Expansion/auth helpers
-- remain synthetic; the hosted full-RPC regression is a separate release gate.
savepoint draft_retention_test;
do $test$
declare definition text; conflict text; stmt text; oid uuid; kind text; stamp timestamptz; result jsonb;
  authority jsonb := '{"schemaVersion":1,"calculationMode":"ingredient_based","dispenseUnit":"ml","referenceIngredientId":"synthetic","productStrength":{"numeratorValue":5,"numeratorUnit":"mg","denominatorValue":1,"denominatorUnit":"ml"}}';
  details jsonb := '{"dose":5,"doseUnit":"mg","doseBasis":"patient","frequency":"bid","durationDays":3,"route":"PO","totalQuantity":1}';
begin
  definition:=pg_get_functiondef('public.clair_save_chart_order_draft_phase2_base(text,text,uuid,jsonb)'::regprocedure);
  conflict:=substring(definition from '(calculation_outputs = case[\s\S]+?end),');
  perform pg_temp.assert_true(conflict is not null,'real B3 conflict expression found');
  stmt:='insert into orders(id,workspace_id,encounter_id,row_type,clinical_order_type,workspace_catalog_item_id,detail_inputs,applied_snapshot,dispensing_authority_snapshot) values($1,''hospital-a'',''83000000-0000-4000-8000-000000000001'',$2,''dispensing'',''liquid'',$3,$4,$5) on conflict(id) do update set applied_snapshot=excluded.applied_snapshot, '||conflict;
  foreach kind in array array['individual','set_child'] loop
    oid:=gen_random_uuid();
    execute stmt using oid,kind,details,jsonb_build_object('planOrderAuthority',authority),authority;
    select updated_at into stamp from orders where id=oid;
    perform public.clair_save_order_dispense_request('hospital-a','00000000-0000-4000-8000-000000000001',oid,stamp,5.2,'manual','upsert-manual-'||kind);
    -- Base writer upserts fresh catalog output before the wrapper saves details.
    execute stmt using oid,kind,details,jsonb_build_object('planOrderAuthority',authority),authority;
    update orders set detail_inputs=details||'{"dose":1,"doseUnit":"mL"}' where id=oid;
    select calculation_outputs into result from orders where id=oid;
    perform pg_temp.assert_true((result->>'actualDispenseQuantity')::numeric=5.2 and result->>'requiresReconfirmation'='false','upsert unit-only manual retention '||kind);
    execute stmt using oid,kind,details,jsonb_build_object('planOrderAuthority',authority),authority;
    update orders set detail_inputs=detail_inputs||'{"durationDays":4}' where id=oid;
    select calculation_outputs,updated_at into result,stamp from orders where id=oid;
    perform pg_temp.assert_true((result->>'actualDispenseQuantity')::numeric=5.2 and (result->>'theoreticalTotalQuantity')::numeric=8 and result->>'requiresReconfirmation'='true','upsert duration retains manual and reconfirms '||kind);
    perform public.clair_save_order_dispense_request('hospital-a','00000000-0000-4000-8000-000000000001',oid,stamp,5.2,'reconfirm','upsert-reconfirm-'||kind);
    select updated_at into stamp from orders where id=oid;
    result:=public.clair_save_order_dispense_request('hospital-a','00000000-0000-4000-8000-000000000001',oid,stamp,5.2,'automatic','upsert-auto-'||kind);
    perform pg_temp.assert_true((result->>'actualDispenseQuantity')::numeric=8 and result->>'actualDispenseSource'<>'manual_override','explicit auto reset survives retention '||kind);
  end loop;
end $test$;
rollback to savepoint draft_retention_test;
