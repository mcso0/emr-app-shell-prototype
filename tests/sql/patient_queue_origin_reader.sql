-- Local-only synthetic reader proof; run after cloning item4_synthetic, adding origin fixtures and applying the candidate migration. Never run against a hosted project.
do $$begin if current_database() <> 'queue_patient_20261006' then raise exception 'requires queue_patient_20261006 local clone'; end if; end$$;
begin;
-- Local-only synthetic proof; never run against a hosted project.
do $$begin if current_database() <> 'queue_patient_20261006' then raise exception 'requires queue_patient_20261006 local database'; end if; end$$;
-- Run after fixture and migration in the dedicated local DB; wrap proof in BEGIN/ROLLBACK.
create temporary table item4_before as select count(*) n, md5(string_agg(md5(row_to_json(i)::text),'' order by id)) digest from public.order_fulfillment_work_items i;
set local role authenticated;
select set_config('request.jwt.claim.sub','99300000-0000-4000-8000-000000000001',true);
do $$declare q text; s text; actual jsonb; expected jsonb; all_rows jsonb; begin
  foreach q in array array['lab','dispensing','treatment'] loop
    all_rows := public.clair_list_fulfillment_work_items('fulfillment-queue-local-proof',q);
    select coalesce(jsonb_agg(r order by (r->>'updatedAt')::timestamptz desc,r->>'id'),'[]') into expected
      from jsonb_array_elements(all_rows) r
      where (coalesce((r->>'dueAt')::timestamptz,(r->>'createdAt')::timestamptz) at time zone 'Asia/Seoul')::date='2026-10-03';
    actual := public.clair_list_fulfillment_work_items_v2('fulfillment-queue-local-proof',q,p_date=>'2026-10-03');
    if (select coalesce(jsonb_agg(r - 'originChartId' - 'originChartCreatedAt' order by ord),'[]') from jsonb_array_elements(actual) with ordinality x(r,ord)) <> expected then raise exception 'date/full payload/order equivalence failed: %',q; end if;
    if jsonb_array_length(actual) < 1200 then raise exception 'silent truncation: %',q; end if;
    if (select coalesce(jsonb_agg(r - 'originChartId' - 'originChartCreatedAt' order by ord),'[]') from jsonb_array_elements(public.clair_list_fulfillment_work_items_v2('fulfillment-queue-local-proof',q)) with ordinality x(r,ord)) <> all_rows then raise exception 'undated history lost: %',q; end if;
    if (select coalesce(jsonb_agg(r - 'originChartId' - 'originChartCreatedAt' order by ord),'[]') from jsonb_array_elements(public.clair_list_fulfillment_work_items_v2('fulfillment-queue-local-proof',q,p_patient_id=>'99300000-0000-4000-8000-000000000032')) with ordinality x(r,ord)) <> all_rows then raise exception 'patient history lost: %',q; end if;
    if public.clair_list_fulfillment_work_items_v2('fulfillment-queue-local-proof',q,p_patient_id=>'99300000-0000-4000-8000-000000000035') <> '[]'::jsonb then raise exception 'foreign patient leak: %',q; end if;
    foreach s in array array['requested','in_progress','paused','completed','cancelled','returned'] loop
      select coalesce(jsonb_agg(r order by (r->>'updatedAt')::timestamptz desc,r->>'id'),'[]') into expected
      from jsonb_array_elements(actual) r where r->>'status'=s;
      if public.clair_list_fulfillment_work_items_v2('fulfillment-queue-local-proof',q,p_status=>s,p_date=>'2026-10-03') <> expected then raise exception 'status equivalence failed: %, %',q,s; end if;
    end loop;
    raise notice 'MEASURE %: rows % -> %, JSON text bytes % -> %',q,jsonb_array_length(all_rows),jsonb_array_length(actual),octet_length(all_rows::text),octet_length(actual::text);
  end loop;
  actual := public.clair_list_fulfillment_work_items_v2('fulfillment-queue-local-proof','lab',p_date=>'2026-10-03');
  if exists(select 1 from jsonb_array_elements(actual) r where r->>'id' in (md5('boundary-item-1')::uuid::text,md5('boundary-item-4')::uuid::text,md5('boundary-item-5')::uuid::text)) then raise exception 'midnight/future/dueAt precedence failed'; end if;
  if not exists(select 1 from jsonb_array_elements(actual) r where r->>'id'=md5('boundary-item-2')::uuid::text) or not exists(select 1 from jsonb_array_elements(actual) r where r->>'id'=md5('boundary-item-3')::uuid::text) then raise exception 'midnight inclusion failed'; end if;
  -- A prior unfinished item remains reachable by historical day and exact ID.
  actual := public.clair_list_fulfillment_work_items_v2('fulfillment-queue-local-proof','lab',p_work_item_id=>md5('boundary-item-1')::uuid);
  if jsonb_array_length(actual) <> 1 or actual->0->>'status' <> 'requested' then raise exception 'overdue detail lost'; end if;
  if jsonb_array_length(public.clair_list_fulfillment_work_items_v2('fulfillment-queue-local-proof','lab',p_date=>'2026-10-02',p_work_item_id=>md5('boundary-item-1')::uuid)) <> 1 then raise exception 'overdue selected day lost'; end if;
  if public.clair_list_fulfillment_work_items_v2('fulfillment-queue-local-proof','lab',p_encounter_id=>'99300000-0000-4000-8000-000000000034') <> '[]'::jsonb then raise exception 'encounter isolation failed'; end if;
  if jsonb_array_length(public.clair_list_fulfillment_work_items_v2('fulfillment-queue-local-proof','lab',p_order_id=>md5('boundary-order-1')::uuid)) <> 1 then raise exception 'order detail lost'; end if;
  begin perform public.clair_list_fulfillment_work_items_v2('fulfillment-queue-foreign-proof','lab'); raise exception 'foreign workspace allowed'; exception when others then if sqlerrm <> 'workspace_membership_missing' then raise; end if; end;
  begin perform public.clair_list_fulfillment_work_items_v2('fulfillment-queue-local-proof','bad'); raise exception 'bad queue allowed'; exception when others then if sqlerrm <> 'unsupported_order_type' then raise; end if; end;
  begin perform public.clair_list_fulfillment_work_items_v2('fulfillment-queue-local-proof','lab',p_status=>'accepted'); raise exception 'bad status allowed'; exception when others then if sqlerrm <> 'invalid_status' then raise; end if; end;
  if has_function_privilege('anon','public.clair_list_fulfillment_work_items_v2(text,text,uuid,uuid,text,date,uuid,uuid)','execute') or has_function_privilege('service_role','public.clair_list_fulfillment_work_items_v2(text,text,uuid,uuid,text,date,uuid,uuid)','execute') then raise exception 'unexpected execute grant'; end if;
end$$;
select set_config('request.jwt.claim.sub','99300000-0000-4000-8000-000000000002',true);
do $$begin
  begin perform public.clair_list_fulfillment_work_items_v2('fulfillment-queue-local-proof','lab'); raise exception 'reception only allowed'; exception when others then if sqlerrm <> 'permission_missing' then raise; end if; end;
end$$;
select set_config('request.jwt.claim.sub','',true);
do $$begin
  begin perform public.clair_list_fulfillment_work_items_v2('fulfillment-queue-local-proof','lab'); raise exception 'missing actor allowed'; exception when others then if sqlerrm <> 'workspace_membership_missing' then raise; end if; end;
end$$;
reset role;
select set_config('clair.membership_status_rpc','on',true);
update public.user_memberships set status='inactive' where id='99300000-0000-4000-8000-000000000011';
set local role authenticated;
select set_config('request.jwt.claim.sub','99300000-0000-4000-8000-000000000001',true);
do $$begin
  begin perform public.clair_list_fulfillment_work_items_v2('fulfillment-queue-local-proof','lab'); raise exception 'inactive member allowed'; exception when others then if sqlerrm <> 'workspace_membership_missing' then raise; end if; end;
end$$;
reset role;
do $$begin
  if (select n from item4_before) <> (select count(*) from public.order_fulfillment_work_items)
    or (select digest from item4_before) <> (select md5(string_agg(md5(row_to_json(i)::text),'' order by id)) from public.order_fulfillment_work_items i)
  then raise exception 'reader mutated fulfillment data'; end if;
  raise notice 'PASS payload/order/status equivalence, >1000 rows, Seoul boundaries, overdue detail/history, patient/order/encounter, actor/role/workspace/inactive denial, grants, no work writes';
end$$;

-- Restore the local synthetic membership changed by the denial proof.
select set_config('clair.membership_status_rpc','on',true);
update public.user_memberships set status='active' where id='99300000-0000-4000-8000-000000000011';
set local role authenticated;
select set_config('request.jwt.claim.sub','99300000-0000-4000-8000-000000000001',true);
do $$declare rows jsonb; item jsonb; n int; expected uuid; begin
 rows := public.clair_list_fulfillment_work_items_v2('fulfillment-queue-local-proof','lab',p_date=>'2026-10-03');
 for n in 1..6 loop
  select r into item from jsonb_array_elements(rows) r where r->>'id'=md5('lab:'||n||':item')::uuid::text;
  if item is null then raise exception 'origin join dropped work %',n; end if;
  if n <= 3 then
   expected := md5(case when n <= 2 then 'queue-origin-a' else 'queue-origin-b' end)::uuid;
   if (item->>'originChartId')::uuid <> expected or (item->>'originChartCreatedAt')::timestamptz <> '2026-10-02T01:00:00Z'::timestamptz then raise exception 'incorrect exact origin: %',n; end if;
  elsif item->>'originChartId' is not null or item->>'originChartCreatedAt' is not null then raise exception 'foreign/missing/legacy origin leaked: %',n; end if;
 end loop;
 raise notice 'PASS exact chart identity, same-encounter multiple charts, repeated source chart, foreign/missing/legacy fail-closed metadata';
end$$;
rollback;
