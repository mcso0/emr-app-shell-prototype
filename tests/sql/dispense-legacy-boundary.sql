-- Direct authenticated calls must not bypass course-total limits via the old RPC.
insert into orders(id,workspace_id,encounter_id,workspace_catalog_item_id,detail_inputs,applied_snapshot)
values('20000000-0000-4000-8000-000000000090','hospital-a','30000000-0000-4000-8000-000000000090','preset-a',
'{"route":"PO","totalQuantity":1,"dose":1,"doseBasis":"patient","doseUnit":"tablet","frequency":"sid","durationDays":1}',
'{"planOrderAuthority":{"schemaVersion":2,"calculationMode":"product_unit","dispenseUnit":"tablet","priceBasis":"per_product_unit","preparationPolicy":{"quantityScope":"course_total","increment":1,"roundingMode":"nearest","displayPrecision":0,"minimum":0.5,"maximum":2}}}');
create temporary table preserved_legacy_boundary_order as select * from orders where id='20000000-0000-4000-8000-000000000090';
do $$ declare stamp timestamptz; quantity numeric; result jsonb;
begin
 select updated_at into stamp from orders where id='20000000-0000-4000-8000-000000000090';
 perform set_config('role','authenticated',true);
 foreach quantity in array array[10::numeric,0.1::numeric,1::numeric] loop
  begin
   perform public.clair_save_order_actual_dispense_override('hospital-a','00000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000090',stamp,quantity,'synthetic boundary check','legacy-dispensing-'||quantity);
   raise exception 'legacy dispensing call accepted';
  exception when others then if sqlerrm<>'actual_dispense_override_disabled' then raise; end if; end;
 end loop;
 foreach quantity in array array[10::numeric,0.1::numeric] loop
  begin
   perform public.clair_save_order_dispense_request('hospital-a','00000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000090',stamp,quantity,'manual','new-dispensing-'||quantity);
   raise exception 'out-of-bounds course request accepted';
  exception when others then if sqlerrm<>'actual_dispense_out_of_policy' then raise; end if; end;
 end loop;
 perform set_config('role','supabase_admin',true);
 perform pg_temp.assert_true((select to_jsonb(o)=to_jsonb(p) from orders o join preserved_legacy_boundary_order p using(id)),'rejected legacy calls leave order unchanged');
 perform pg_temp.assert_true(not exists(select 1 from order_actual_dispense_overrides where order_id='20000000-0000-4000-8000-000000000090'),'rejected legacy calls create no override history');
 perform set_config('role','authenticated',true);
 result:=public.clair_save_order_dispense_request('hospital-a','00000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000090',stamp,1.2,'manual','new-dispensing-valid');
 perform pg_temp.assert_true((result->>'actualDispenseQuantity')::numeric=1.2,'valid non-step course request uses new RPC');
 perform set_config('role','supabase_admin',true);
end $$;

-- Non-dispensing callers retain the legacy reason, step, bounds and replay contract.
insert into orders(id,workspace_id,encounter_id,clinical_order_type,detail_inputs)
values('20000000-0000-4000-8000-000000000091','hospital-a','30000000-0000-4000-8000-000000000091','treatment','{}');
update orders set calculation_outputs='{"calculationStatus":"ready","dispenseApplicability":true,"actualDispenseQuantity":1,"proposedActualDispenseQuantity":1,"actualDispenseUnit":"mL","totalOccurrences":2,"preparationPolicy":{"increment":0.5,"minimum":0.5,"maximum":2}}'
where id='20000000-0000-4000-8000-000000000091';
do $$ declare stamp timestamptz; result jsonb;
begin
 select updated_at into stamp from orders where id='20000000-0000-4000-8000-000000000091';
 perform set_config('role','authenticated',true);
 begin
  perform public.clair_save_order_actual_dispense_override('hospital-a','00000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000091',stamp,10,'synthetic reason','legacy-treatment-over');
  raise exception 'legacy treatment limit bypassed';
 exception when others then if sqlerrm<>'actual_dispense_out_of_policy' then raise; end if; end;
 begin
  perform public.clair_save_order_actual_dispense_override('hospital-a','00000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000091',stamp,1.5,null,'legacy-treatment-reason');
  raise exception 'legacy treatment reason bypassed';
 exception when others then if sqlerrm<>'actual_dispense_reason_required' then raise; end if; end;
 result:=public.clair_save_order_actual_dispense_override('hospital-a','00000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000091',stamp,1.5,'synthetic reason','legacy-treatment-valid');
 perform pg_temp.assert_true((result->>'actualDispenseQuantity')::numeric=1.5,'valid legacy non-dispensing call preserved');
 perform pg_temp.assert_true(result=public.clair_save_order_actual_dispense_override('hospital-a','00000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000091',stamp,1.5,'synthetic reason','legacy-treatment-valid'),'legacy non-dispensing replay preserved');
 perform set_config('role','supabase_admin',true);
end $$;
select 'PASS legacy dispensing boundary and non-dispensing compatibility';
