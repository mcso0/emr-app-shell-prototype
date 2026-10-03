-- Run with BEGIN/ROLLBACK only in the dedicated synthetic local DB.
do $$begin if current_database() <> 'item5_synthetic' then raise exception 'requires item5_synthetic local database'; end if; end$$;
create temporary table item5_before as
select t, (xpath('/row/digest/text()', query_to_xml(format('select md5(string_agg(md5(row_to_json(r)::text),'''' order by id)) digest from public.%I r',t),false,true,'')))[1]::text digest
from unnest(array['appointments','encounters','waiting_queue_entries','patients','guardians','invoices','invoice_lines','orders','order_fulfillment_work_items']) t;
set local role authenticated;
select set_config('request.jwt.claim.sub','99500000-0000-4000-8000-000000000001',true);
do $$declare s jsonb; f jsonb; begin
  s := public.clair_get_home_operations_source_snapshot_v2('home-local-proof','2026-10-03',true,true);
  if jsonb_array_length(s->'appointments') <= 1000 then raise exception 'source row cap'; end if;
  if s::text like '%Foreign sentinel%' then raise exception 'workspace name leak'; end if;
  if not exists(select 1 from jsonb_array_elements(s->'waiting_queue_entries') r where r->>'id'=md5('suppression-6006')::uuid::text) then raise exception 'reception suppression dependency lost'; end if;
  if not exists(select 1 from jsonb_array_elements(s->'encounters') r where r->>'id'=md5('encounter-6003')::uuid::text) then raise exception 'old appointment/fulfillment encounter lost'; end if;
  if (select count(*) from jsonb_array_elements(s->'invoice_lines') r where r->>'invoice_id'=md5('invoice-6003')::uuid::text)<>2 then raise exception 'noncandidate invoice line lost'; end if;
  f := public.clair_list_home_fulfillment_work_items('home-local-proof','lab','2026-10-03');
  if f::text like '%unusedHistoricalPayload%' then raise exception 'unconsumed snapshot exported'; end if;
  if (select count(distinct r->>'status') from jsonb_array_elements(public.clair_list_home_fulfillment_work_items('home-local-proof','lab','2026-10-03',true,true)) r)<>6 then raise exception 'six status fixture coverage missing'; end if;
  if jsonb_array_length(public.clair_list_home_fulfillment_work_items('home-local-proof','lab','2026-10-03',true,true))<=1000 then raise exception 'fulfillment row cap fixture missing'; end if;
  if exists(select 1 from jsonb_array_elements(f) r where r->>'id'=md5('boundary-4')::uuid::text) then raise exception 'upper midnight/future inclusion'; end if;
  if (select count(*) from jsonb_array_elements(f) r where r->>'id' in (md5('boundary-1')::uuid::text,md5('boundary-2')::uuid::text,md5('boundary-3')::uuid::text,md5('boundary-5')::uuid::text))<>4 then raise exception 'midnight/carryover/due precedence lost'; end if;
  -- Detail/full snapshot remains reachable through existing item4 reader.
  if jsonb_array_length(public.clair_list_fulfillment_work_items_v2('home-local-proof','lab',p_work_item_id=>md5('boundary-1')::uuid))<>1 then raise exception 'historical exact detail lost'; end if;
  if jsonb_array_length(public.clair_list_fulfillment_work_items_v2('home-local-proof','lab',p_date=>'2026-10-03',p_work_item_id=>md5('boundary-1')::uuid))<>0 then raise exception 'item4 exact-day semantics changed'; end if;
  begin perform public.clair_get_home_operations_source_snapshot_v2('home-foreign-proof','2026-10-03'); raise exception 'foreign workspace allowed'; exception when insufficient_privilege then null; end;
  begin perform public.clair_list_home_fulfillment_work_items('home-foreign-proof','lab','2026-10-03'); raise exception 'foreign fulfillment allowed'; exception when insufficient_privilege then null; end;
  begin perform public.clair_get_home_operations_source_snapshot_v2('home-local-proof',null); raise exception 'null day allowed'; exception when invalid_parameter_value then null; end;
  begin perform public.clair_get_home_operations_source_snapshot_v2('home-local-proof','2026-10-03',null,false); raise exception 'null flags allowed'; exception when invalid_parameter_value then null; end;
  begin perform public.clair_list_home_fulfillment_work_items('home-local-proof',null,'2026-10-03'); raise exception 'null queue allowed'; exception when invalid_parameter_value then null; end;
  begin perform public.clair_list_home_fulfillment_work_items('home-local-proof','consultation','2026-10-03'); raise exception 'unsupported queue allowed'; exception when invalid_parameter_value then null; end;
end$$;
select set_config('request.jwt.claim.sub','99500000-0000-4000-8000-000000000002',true);
do $$declare s jsonb; begin
  s := public.clair_get_home_operations_source_snapshot_v2('home-local-proof','2026-10-03',true,true);
  if jsonb_array_length(s->'invoices')<>0 or jsonb_array_length(s->'invoice_lines')<>0 or jsonb_array_length(s->'orders')<>0 then raise exception 'billing permission lost'; end if;
  if exists(select 1 from jsonb_array_elements(s->'waiting_queue_entries') r where r->>'queue_type'='consultation') then raise exception 'chart permission lost'; end if;
  begin perform public.clair_list_home_fulfillment_work_items('home-local-proof','lab','2026-10-03'); raise exception 'destination permission lost'; exception when insufficient_privilege then null; end;
  begin perform private.clair_home_fulfillment_source_rows('home-local-proof','2026-10-03',true,true); raise exception 'internal helper executable'; exception when insufficient_privilege then null; end;
end$$;
select set_config('request.jwt.claim.sub','99500000-0000-4000-8000-000000000006',true);
do $$begin
  begin perform public.clair_get_home_operations_source_snapshot_v2('home-local-proof','2026-10-03'); raise exception 'missing Home permission allowed'; exception when insufficient_privilege then null; end;
end$$;
select set_config('request.jwt.claim.sub','',true);
do $$begin
  begin perform public.clair_get_home_operations_source_snapshot_v2('home-local-proof','2026-10-03'); raise exception 'missing actor allowed'; exception when insufficient_privilege then null; end;
  begin perform public.clair_list_home_fulfillment_work_items('home-local-proof','lab','2026-10-03'); raise exception 'missing actor fulfillment allowed'; exception when insufficient_privilege then null; end;
end$$;
reset role;
select set_config('clair.membership_status_rpc','on',true);
update public.user_memberships set status='inactive' where user_id='99500000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','99500000-0000-4000-8000-000000000001',true);
do $$begin
  begin perform public.clair_get_home_operations_source_snapshot_v2('home-local-proof','2026-10-03'); raise exception 'inactive actor allowed'; exception when insufficient_privilege then null; end;
  begin perform public.clair_list_home_fulfillment_work_items('home-local-proof','lab','2026-10-03'); raise exception 'inactive fulfillment allowed'; exception when insufficient_privilege then null; end;
end$$;
reset role;
do $$declare fn text; r text; before_digest text; after_digest text; t text; begin
  foreach fn in array array[
    'public.clair_get_home_operations_source_snapshot_v2(text,date,boolean,boolean)',
    'private.clair_get_home_operations_source_snapshot_v2(text,date,boolean,boolean)',
    'public.clair_list_home_fulfillment_work_items(text,text,date,boolean,boolean)',
    'private.clair_list_home_fulfillment_work_items(text,text,date,boolean,boolean)'] loop
    foreach r in array array['anon','service_role'] loop
      if has_function_privilege(r,fn,'execute') then raise exception 'unexpected % execute %',r,fn; end if;
    end loop;
    if not has_function_privilege('authenticated',fn,'execute') then raise exception 'authenticated grant missing %',fn; end if;
    if exists(select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid=fn::regprocedure and a.grantee=0 and a.privilege_type='EXECUTE') then raise exception 'PUBLIC execute %',fn; end if;
  end loop;
  if exists(select 1 from pg_proc where oid in (
    'public.clair_get_home_operations_source_snapshot_v2(text,date,boolean,boolean)'::regprocedure,
    'public.clair_list_home_fulfillment_work_items(text,text,date,boolean,boolean)'::regprocedure) and prosecdef) then raise exception 'public definer'; end if;
  for t,before_digest in select b.t,b.digest from item5_before b loop
    execute format('select md5(string_agg(md5(row_to_json(r)::text),'''' order by id)) from public.%I r',t) into after_digest;
    if before_digest is distinct from after_digest then raise exception 'reader changed business rows %',t; end if;
  end loop;
  raise notice 'PASS actor/Home/destination/role/workspace/inactive denial, private helper and public grants, complete result, midnight/carryover/context/projection/detail, no business writes';
end$$;
