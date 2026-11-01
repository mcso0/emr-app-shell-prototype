-- Selected real stored-function chain on a synthetic schema. No production data.
set check_function_bodies=off;
create schema private;
create schema auth;
create schema extensions;
create extension pgcrypto with schema extensions;
do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
do $$ begin create role anon; exception when duplicate_object then null; end $$;
do $$ begin create role service_role; exception when duplicate_object then null; end $$;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.actor',true),'')::uuid $$;
create function private.clair_is_active_workspace_member(w text) returns boolean language sql stable as $$ select w='hospital-a' and auth.uid() in ('00000000-0000-4000-8000-000000000001'::uuid,'00000000-0000-4000-8000-000000000002'::uuid) $$;
create function private.clair_current_user_has_workspace_permission(w text,p text) returns boolean language sql stable as $$ select private.clair_is_active_workspace_member(w) and (auth.uid()='00000000-0000-4000-8000-000000000001'::uuid or p='service_catalog:view') $$;
create table workspaces(id text primary key);
create table users(id uuid primary key);
create table user_memberships(id uuid primary key default gen_random_uuid(),workspace_id text,user_id uuid,status text,created_at timestamptz default now());
create table orders(id uuid primary key,workspace_id text,encounter_id uuid,clinical_order_type text default 'dispensing',row_type text default 'individual',workspace_catalog_item_id text,
  order_confirmation_status text default 'draft',status text default 'requested',detail_inputs jsonb,applied_snapshot jsonb default '{}',dispensing_authority_snapshot jsonb default '{}',
  calculation_outputs jsonb default '{}',confirmed_snapshot jsonb default '{}',updated_at timestamptz default clock_timestamp(), unique(workspace_id,id));
create table order_catalog_items(id text primary key,workspace_id text,clinical_order_type text,in_hospital_order_name text,default_detail_inputs jsonb,source_medication_product_id uuid);
create table patient_vital_measurements(id uuid primary key default gen_random_uuid(),workspace_id text,encounter_id uuid,weight_kg numeric,measured_at timestamptz,created_at timestamptz default now());
create table order_events(workspace_id text,order_id uuid,event_type text,performed_by_user_id uuid,payload jsonb,created_at timestamptz);
create table audit_events(id text,workspace_id text,actor_user_id uuid,actor_membership_id uuid,event_type text,target_type text,target_id text,encounter_id uuid,request_id text,reason text,before_snapshot jsonb,after_snapshot jsonb,metadata jsonb,occurred_at timestamptz,created_at timestamptz);
-- MUTATION SUPPORT
alter table orders add column destination_module text default 'dispensing',add column parent_chart_order_line_id uuid,
 add column revision_no integer default 0,add column invoice_line_id uuid,add column detail_schema_version integer default 1,
 add column calculation_inputs jsonb default '{}',add column priority text default 'normal',add column task_status text,add column work_status text default 'pending';
-- Real schema and validation functions are loaded at BASELINE.
-- Permission helpers are synthetic dependencies; detail validation, request math and mutation bodies are real.
create table private.fulfillment_instruction_state(workspace_id text,root_task_id uuid,queue_type text,finalized boolean,revision integer);
create table private.fulfillment_instruction_reopen_scope(transaction_id bigint,workspace_id text,task_id uuid,actor_user_id uuid);
-- Confirmation wrapper dependencies: artifact creation is represented by a synthetic predecessor.
alter table orders add column billing_eligible boolean default true,add column billing_reflection_enabled boolean default true,add column quantity numeric default 1;
alter table order_billing_candidates add column id uuid default gen_random_uuid(),add column confirmation_command_id uuid,add column task_id uuid,add column billing_name_snapshot text,add column currency text default 'KRW',add column created_at timestamptz default now();
create unique index synthetic_audit_id on audit_events(id);
create table order_confirmation_commands(id uuid primary key default gen_random_uuid(),workspace_id text,idempotency_key text,result jsonb);
create function public.clair_confirm_chart_order_candidates_plan_order_base(w text,a uuid,e uuid,ids uuid[],etag text,key text) returns jsonb language plpgsql as $$
declare command_id uuid; answer jsonb;
begin
 select result into answer from order_confirmation_commands where workspace_id=w and idempotency_key=key;
 if found then return answer; end if;
 insert into order_confirmation_commands(workspace_id,idempotency_key) values(w,key) returning id into command_id;
 update orders set order_confirmation_status='confirmed' where workspace_id=w and id=any(ids);
 update order_billing_candidates set confirmation_command_id=command_id where workspace_id=w and order_id=any(ids);
 return jsonb_build_object('commandId',command_id);
end $$;
-- BASELINE
create trigger orders_plan_order_dispense_projection_trg before insert or update of detail_inputs,applied_snapshot,encounter_id on orders
  for each row execute function private.clair_refresh_plan_order_dispense_projection();
create trigger order_actual_dispense_overrides_immutable_trg before update or delete on order_actual_dispense_overrides
  for each row when (old.result is not null) execute function private.clair_reject_prebilling_override_mutation();
-- MIGRATION

grant usage on schema public,private,auth to authenticated;
create function pg_temp.assert_true(ok boolean,label text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'ASSERT: %',label; end if; end $$;
begin;
insert into workspaces values ('hospital-a'),('hospital-b');
insert into users values ('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002');
insert into user_memberships(workspace_id,user_id,status) values('hospital-a','00000000-0000-4000-8000-000000000001','active');
select set_config('test.actor','00000000-0000-4000-8000-000000000001',true);
insert into order_catalog_items values
('preset-a','hospital-a','dispensing','Synthetic tablet preset A','{"planOrderAuthority":{"schemaVersion":2,"calculationMode":"product_unit","dispenseUnit":"tablet","priceBasis":"per_product_unit"}}','10000000-0000-4000-8000-000000000001'),
('preset-a2','hospital-a','dispensing','Synthetic tablet preset A2','{"planOrderAuthority":{"schemaVersion":2,"calculationMode":"product_unit","dispenseUnit":"tablet","priceBasis":"per_product_unit"}}','10000000-0000-4000-8000-000000000001'),
('preset-b','hospital-b','dispensing','Synthetic foreign preset','{"planOrderAuthority":{"schemaVersion":2,"calculationMode":"product_unit","dispenseUnit":"tablet"}}','10000000-0000-4000-8000-000000000001'),
('liquid','hospital-a','dispensing','Synthetic liquid','{"planOrderAuthority":{"schemaVersion":1,"calculationMode":"ingredient_based","dispenseUnit":"ml","referenceIngredientId":"synthetic","productStrength":{"numeratorValue":5,"numeratorUnit":"mg","denominatorValue":1,"denominatorUnit":"ml"}}}',null);
create temporary table preserved_catalog as select * from order_catalog_items;
-- UNIT CONVERSION TESTS
insert into orders(id,workspace_id,encounter_id,workspace_catalog_item_id,detail_inputs,applied_snapshot) select
  '20000000-0000-4000-8000-000000000001','hospital-a','30000000-0000-4000-8000-000000000001','preset-a',
  '{"route":"PO","totalQuantity":1,"dose":0.25,"doseBasis":"patient","doseUnit":"tablet","frequency":"tid","durationDays":5}',default_detail_inputs from order_catalog_items where id='preset-a';
insert into orders(id,workspace_id,encounter_id,workspace_catalog_item_id,detail_inputs,applied_snapshot) select
  '20000000-0000-4000-8000-000000000002','hospital-a','30000000-0000-4000-8000-000000000002','preset-a',
  '{"route":"PO","totalQuantity":1,"dose":0.25,"doseBasis":"patient","doseUnit":"tablet","frequency":"tid","durationDays":5}',default_detail_inputs from order_catalog_items where id='preset-a';
create temporary table preserved_patient_b as select * from orders where id='20000000-0000-4000-8000-000000000002';
select pg_temp.assert_true((select calculation_outputs->>'actualDispenseQuantity'='3.75' and calculation_outputs->>'theoreticalDispenseQuantity'='0.25' and calculation_outputs#>>'{dispenseRuleSnapshot,source}'='theoretical' from orders where id='20000000-0000-4000-8000-000000000001'),'unconfigured exact course total');

do $$ declare state jsonb; replay jsonb; stamp timestamptz; outputs jsonb; count_before integer;
begin
  select updated_at into stamp from orders where id='20000000-0000-4000-8000-000000000001';
  state:=public.clair_save_order_dispense_request('hospital-a','00000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',stamp,1.2,'manual','manual-command-0001');
  replay:=public.clair_save_order_dispense_request('hospital-a','00000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',stamp,1.2,'manual','manual-command-0001');
  perform pg_temp.assert_true(state=replay,'same command idempotent replay');
  perform pg_temp.assert_true(state->>'actualDispenseSource'='manual_override' and state->>'plannedPracticalTotalQuantity'='1.2','manual no reason no configured policy');
  perform pg_temp.assert_true((select count(*)=1 and bool_and(reason is null and not reason_required) from order_actual_dispense_overrides),'one append-only history entry without reason');
  begin
    perform public.clair_save_order_dispense_request('hospital-a','00000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',stamp,1.3,'manual','manual-command-0001');
    raise exception 'changed payload accepted';
  exception when others then if sqlerrm<>'idempotency_conflict' then raise; end if; end;
  begin
    perform public.clair_save_order_dispense_request('hospital-a','00000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',stamp,1.3,'manual','manual-command-stale');
    raise exception 'stale write accepted';
  exception when others then if sqlerrm<>'revision_conflict' then raise; end if; end;
  update orders set detail_inputs=jsonb_set(detail_inputs,'{durationDays}','7'),updated_at=clock_timestamp() where id='20000000-0000-4000-8000-000000000001';
  select calculation_outputs,updated_at into outputs,stamp from orders where id='20000000-0000-4000-8000-000000000001';
  perform pg_temp.assert_true(outputs->>'actualDispenseQuantity'='1.2' and (outputs->>'requiresReconfirmation')::boolean and (outputs->>'theoreticalTotalQuantity')::numeric=5.25,'condition change retains manual and requires reconfirmation');
  state:=public.clair_save_order_dispense_request('hospital-a','00000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',stamp,1.2,'reconfirm','reconfirm-command-1');
  perform pg_temp.assert_true(state->>'actualDispenseSource'='manual_override' and state->>'requiresReconfirmation'='false','reconfirm retained manual');
  -- Missing required calculation input cannot erase the manual request.
  update orders set detail_inputs=detail_inputs-'dose',updated_at=clock_timestamp() where id='20000000-0000-4000-8000-000000000001';
  select calculation_outputs into outputs from orders where id='20000000-0000-4000-8000-000000000001';
  perform pg_temp.assert_true(outputs->>'calculationStatus'='blocked' and outputs->>'actualDispenseQuantity'='1.2','missing input preserves manual without displaying a valid calculation');
  update orders set detail_inputs=jsonb_set(detail_inputs,'{dose}','0.5'),updated_at=clock_timestamp() where id='20000000-0000-4000-8000-000000000001';
  select updated_at into stamp from orders where id='20000000-0000-4000-8000-000000000001';
  state:=public.clair_save_order_dispense_request('hospital-a','00000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',stamp,999,'automatic','reset-command-0001');
  perform pg_temp.assert_true((state->>'actualDispenseQuantity')::numeric=10.5 and state->>'actualDispenseSource'='preparation_policy','reset uses server current conditions not client proposal');
  select updated_at into stamp from orders where id='20000000-0000-4000-8000-000000000001';
  state:=public.clair_save_order_dispense_request('hospital-a','00000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',stamp,10.5,'manual','same-value-manual-1');
  perform pg_temp.assert_true(state->>'actualDispenseSource'='manual_override','equal proposal manual remains manual');
  begin update order_actual_dispense_overrides set reason='edited history'; raise exception 'history update accepted';
  exception when object_not_in_prerequisite_state then null; end;
end $$;
select pg_temp.assert_true(not exists((select * from order_catalog_items except select * from preserved_catalog) union all (select * from preserved_catalog except select * from order_catalog_items)),'master preset catalog unchanged');
select pg_temp.assert_true((select to_jsonb(o)=to_jsonb(p) from orders o join preserved_patient_b p using(id)),'patient B unchanged');

-- Manage a per-unit hospital default and reusable product exception.
select public.clair_save_dispense_quantity_rules('hospital-a',0,'hospital','{"mode":"up","increment":0.5,"unit":"tablet","displayPrecision":1}',array[]::text[],'tablet');
select public.clair_save_dispense_quantity_rules('hospital-a',1,'products','{"mode":"down","increment":0.5,"unit":"tablet","displayPrecision":1}',array['preset-a'],'tablet');
select pg_temp.assert_true((select revision=2 and (select count(*) from jsonb_object_keys(product_rules))=1 from workspace_dispense_quantity_rules),'one product exception shared by presets');
insert into orders(id,workspace_id,encounter_id,workspace_catalog_item_id,detail_inputs,applied_snapshot,row_type,dispensing_authority_snapshot) select
  '20000000-0000-4000-8000-000000000003','hospital-a','30000000-0000-4000-8000-000000000001','preset-a2',
  '{"route":"PO","totalQuantity":1,"dose":0.25,"doseBasis":"patient","doseUnit":"tablet","frequency":"tid","durationDays":5}','{"exactB3":"unchanged"}','set_child',default_detail_inputs->'planOrderAuthority' from order_catalog_items where id='preset-a2';
select pg_temp.assert_true((select (calculation_outputs->>'actualDispenseQuantity')::numeric=3.5 and applied_snapshot='{"exactB3":"unchanged"}'::jsonb and dispense_request_rule_snapshot->>'source'='product' from orders where id='20000000-0000-4000-8000-000000000003'),'set child shares product rule without modifying B3');
select public.clair_save_dispense_quantity_rules('hospital-a',2,'products',null,array['preset-a'],'tablet');
update orders set detail_inputs=detail_inputs,updated_at=clock_timestamp() where id='20000000-0000-4000-8000-000000000003';
select pg_temp.assert_true((select (calculation_outputs->>'actualDispenseQuantity')::numeric=3.5 and dispense_request_rule_snapshot->>'version'='2' from orders where id='20000000-0000-4000-8000-000000000003'),'existing draft frozen rule after settings changed');
-- New root uses hospital rule and whole-course rounding; liquid does not inherit TAB rounding.
insert into orders(id,workspace_id,encounter_id,workspace_catalog_item_id,detail_inputs,applied_snapshot) select
  '20000000-0000-4000-8000-000000000004','hospital-a','30000000-0000-4000-8000-000000000001','preset-a',
  '{"route":"PO","totalQuantity":1,"dose":0.25,"doseBasis":"patient","doseUnit":"tablet","frequency":"tid","durationDays":5}',default_detail_inputs from order_catalog_items where id='preset-a';
select pg_temp.assert_true((select (calculation_outputs->>'actualDispenseQuantity')::numeric=4 and (calculation_outputs->>'theoreticalDispenseQuantity')::numeric=0.25 from orders where id='20000000-0000-4000-8000-000000000004'),'round total only');
insert into orders(id,workspace_id,encounter_id,workspace_catalog_item_id,detail_inputs,applied_snapshot) select
  '20000000-0000-4000-8000-000000000005','hospital-a','30000000-0000-4000-8000-000000000001','liquid',
  '{"route":"PO","totalQuantity":1,"dose":3,"doseBasis":"patient","doseUnit":"mg","frequency":"bid","durationDays":3}',default_detail_inputs from order_catalog_items where id='liquid';
select pg_temp.assert_true((select (calculation_outputs->>'actualDispenseQuantity')::numeric=3.6 and dispense_request_rule_snapshot->>'source'='theoretical' from orders where id='20000000-0000-4000-8000-000000000005'),'ingredient conversion and unrelated unit exact');
-- Frozen confirmed state remains unchanged when rules change.
update orders set order_confirmation_status='confirmed',confirmed_snapshot=jsonb_build_object('calculationOutputs',calculation_outputs) where id='20000000-0000-4000-8000-000000000004';
create temporary table preserved_confirmed as select * from orders where id='20000000-0000-4000-8000-000000000004';
select public.clair_save_dispense_quantity_rules('hospital-a',3,'hospital','{"mode":"nearest","increment":1,"unit":"tablet","displayPrecision":0}',array[]::text[],'tablet');
select pg_temp.assert_true((select to_jsonb(o)=to_jsonb(p) from orders o join preserved_confirmed p using(id)),'confirmed snapshot and request untouched');

do $$ declare stamp timestamptz; result jsonb;
begin
  select updated_at into stamp from orders where id='20000000-0000-4000-8000-000000000003';
  result:=public.clair_save_order_dispense_request('hospital-a','00000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003',stamp,1.2,'manual','child-manual-0001');
  perform pg_temp.assert_true((result->>'plannedPracticalTotalQuantity')::numeric=1.2,'manual value outside automatic step allowed on child');
  perform pg_temp.assert_true((select (calculation_outputs->>'totalRequiredDispenseQuantity')::numeric=1.2 and (calculation_outputs->>'theoreticalTotalQuantity')::numeric=3.75 from orders where id='20000000-0000-4000-8000-000000000003'),'billing authority receives final total and theory remains');
  begin perform public.clair_save_dispense_quantity_rules('hospital-a',1,'hospital',null,array[]::text[],'tablet'); raise exception 'stale rules accepted'; exception when others then if sqlerrm<>'revision_conflict' then raise; end if; end;
  begin perform public.clair_save_dispense_quantity_rules('hospital-a',4,'products',null,array['preset-b'],'tablet'); raise exception 'foreign product accepted'; exception when others then if sqlerrm<>'catalog_item_unavailable' then raise; end if; end;
  begin perform public.clair_save_dispense_quantity_rules('hospital-a',4,'hospital','{"mode":"up","increment":0.25,"unit":"tablet","displayPrecision":1}',array[]::text[],'tablet'); raise exception 'lossy precision accepted'; exception when others then if sqlerrm<>'invalid_rule_input' then raise; end if; end;
  begin perform public.clair_get_dispense_quantity_rules('hospital-b'); raise exception 'foreign workspace read accepted'; exception when insufficient_privilege then null; end;
  perform set_config('test.actor','00000000-0000-4000-8000-000000000002',true);
  begin perform public.clair_save_dispense_quantity_rules('hospital-a',4,'hospital',null,array[]::text[],'tablet'); raise exception 'viewer edited rules'; exception when insufficient_privilege then null; end;
  begin perform public.clair_save_order_dispense_request('hospital-a','00000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000003',stamp,1.2,'manual','denied-manual-0001'); raise exception 'viewer edited order'; exception when insufficient_privilege then null; end;
  perform set_config('test.actor','00000000-0000-4000-8000-000000000001',true);
end $$;
select pg_temp.assert_true(not has_table_privilege('authenticated','workspace_dispense_quantity_rules','UPDATE') and not has_table_privilege('authenticated','workspace_dispense_quantity_rule_events','DELETE'),'RPC-only rule writes');
select pg_temp.assert_true(not has_function_privilege('anon','public.clair_save_order_dispense_request(text,uuid,uuid,timestamptz,numeric,text,text)','EXECUTE'),'anonymous manual save denied');
-- UPSERT retains the original set-child rule even after settings changed.
insert into orders(id,workspace_id,encounter_id,workspace_catalog_item_id,row_type,detail_inputs,applied_snapshot,dispensing_authority_snapshot)
select id,workspace_id,encounter_id,workspace_catalog_item_id,row_type,detail_inputs,applied_snapshot,dispensing_authority_snapshot
from orders where id='20000000-0000-4000-8000-000000000003'
on conflict(id) do update set detail_inputs=excluded.detail_inputs,applied_snapshot=excluded.applied_snapshot;
select pg_temp.assert_true((select dispense_request_rule_snapshot->>'version'='2' and calculation_outputs->>'actualDispenseQuantity'='1.2' from orders where id='20000000-0000-4000-8000-000000000003'),'upsert preserves frozen child rule and manual value');
-- Real authenticated role: RLS filters foreign rows and direct writes fail.
insert into workspace_dispense_quantity_rules values('hospital-b',1,'{}','{}','00000000-0000-4000-8000-000000000001',now());
set local role authenticated;
select pg_temp.assert_true((select count(*)=1 from workspace_dispense_quantity_rules),'authenticated RLS workspace isolation');
do $$ begin
 begin update workspace_dispense_quantity_rules set revision=99; raise exception 'direct write accepted'; exception when insufficient_privilege then null; end;
 begin delete from workspace_dispense_quantity_rule_events; raise exception 'direct history delete accepted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
-- Real re-request body, with actual calculation and downstream snapshot updates.
update orders set order_confirmation_status='confirmed',status='completed',confirmed_snapshot=jsonb_build_object('calculationOutputs',calculation_outputs)
where id='20000000-0000-4000-8000-000000000005';
insert into order_tasks(id,workspace_id,encounter_id,order_id,task_role,clinical_order_type,destination_module,status,priority,attempt_no,effective_snapshot)
select '40000000-0000-4000-8000-000000000005',workspace_id,encounter_id,id,'execution','dispensing','dispensing','complete','normal',1,confirmed_snapshot from orders where id='20000000-0000-4000-8000-000000000005';
insert into order_fulfillment_work_items(id,workspace_id,order_id,encounter_id,task_id,task_attempt_no,status,queue_type,source_snapshot)
select '50000000-0000-4000-8000-000000000005',workspace_id,order_id,encounter_id,id,1,'completed','dispensing',effective_snapshot from order_tasks where order_id='20000000-0000-4000-8000-000000000005';
insert into order_billing_candidates(workspace_id,encounter_id,order_id,status,price_basis_snapshot,unit_price,quantity,amount)
select workspace_id,encounter_id,id,'candidate_created','per_product_unit',100,3.6,360 from orders where id='20000000-0000-4000-8000-000000000005';
create temporary table preserved_attempt as select * from order_tasks where id='40000000-0000-4000-8000-000000000005';
select public.clair_mutate_chart_order_execution_origin_base('hospital-a','00000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000005','re_request','synthetic order revision',0,'{"actualDispenseMode":"manual","actualDispenseQuantity":1.2,"detailInputs":{"dose":0.6,"doseUnit":"mL","doseBasis":"patient","frequency":"bid","durationDays":3,"route":"PO","totalQuantity":1}}','quantity-rerequest-manual-1');
select pg_temp.assert_true((select (calculation_outputs->>'actualDispenseQuantity')::numeric=1.2 and (calculation_outputs->>'totalRequiredDispenseQuantity')::numeric=1.2 from orders where id='20000000-0000-4000-8000-000000000005'),'rerequest final course total');
select pg_temp.assert_true((select (effective_snapshot#>>'{calculationOutputs,actualDispenseQuantity}')::numeric=1.2 from order_tasks where order_id='20000000-0000-4000-8000-000000000005' and attempt_no=2),'rerequest task snapshot');
select pg_temp.assert_true((select (source_snapshot#>>'{calculationOutputs,totalRequiredDispenseQuantity}')::numeric=1.2 from order_fulfillment_work_items where order_id='20000000-0000-4000-8000-000000000005'),'rerequest fulfillment snapshot');
select pg_temp.assert_true((select quantity=1.2 and amount=120 from order_billing_candidates where order_id='20000000-0000-4000-8000-000000000005'),'rerequest quantity linked billing');
select pg_temp.assert_true((select (calculation_outputs->>'theoreticalTotalQuantity')::numeric=3.6 and detail_inputs->>'doseUnit'='mL' and (detail_inputs->>'dose')::numeric=0.6 from orders where id='20000000-0000-4000-8000-000000000005'),'equivalent unit rerequest preserves physical prescription');
select pg_temp.assert_true((select effective_snapshot#>>'{detailInputs,doseUnit}'='mL' and (effective_snapshot#>>'{detailInputs,dose}')::numeric=0.6 from order_tasks where order_id='20000000-0000-4000-8000-000000000005' and attempt_no=2),'new attempt retains chosen dose representation');

select pg_temp.assert_true((select to_jsonb(t)=to_jsonb(p) from order_tasks t join preserved_attempt p using(id)),'prior completed attempt unchanged');
select pg_temp.assert_true((select reason is null and not reason_required from order_actual_dispense_overrides where order_id='20000000-0000-4000-8000-000000000005'),'rerequest quantity history has no reason');
select pg_temp.assert_true((select reason='synthetic order revision' from order_revisions where order_id='20000000-0000-4000-8000-000000000005'),'order revision retains separate reason');
select public.clair_mutate_chart_order_execution_origin_base('hospital-a','00000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000005','re_request','synthetic order revision',0,'{"actualDispenseMode":"manual","actualDispenseQuantity":1.2,"detailInputs":{"dose":0.6,"doseUnit":"mL","doseBasis":"patient","frequency":"bid","durationDays":3,"route":"PO","totalQuantity":1}}','quantity-rerequest-manual-1');
select pg_temp.assert_true((select count(*)=2 from order_tasks where order_id='20000000-0000-4000-8000-000000000005'),'rerequest replay does not create extra task');
update order_tasks set status='complete' where order_id='20000000-0000-4000-8000-000000000005' and attempt_no=2;
select public.clair_mutate_chart_order_execution_origin_base('hospital-a','00000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000005','re_request','synthetic automatic revision',1,'{"actualDispenseMode":"automatic","detailInputs":{"route":"PO","totalQuantity":1,"dose":5,"doseBasis":"patient","doseUnit":"mg","frequency":"bid","durationDays":3}}','quantity-rerequest-auto-1');
select pg_temp.assert_true((select (calculation_outputs->>'actualDispenseQuantity')::numeric=6 and calculation_outputs->>'actualDispenseSource'='preparation_policy' from orders where id='20000000-0000-4000-8000-000000000005'),'automatic rerequest calculates changed prescription');
-- Actual confirmation wrapper freezes the final amount and rejects unresolved manual changes.
insert into order_tasks(id,workspace_id,encounter_id,order_id,task_role,status,attempt_no,effective_snapshot)
select '40000000-0000-4000-8000-000000000002',workspace_id,encounter_id,id,'execution','pending',1,'{}' from orders where id='20000000-0000-4000-8000-000000000002';
insert into order_fulfillment_work_items(id,workspace_id,encounter_id,order_id,task_id,task_attempt_no)
select '50000000-0000-4000-8000-000000000002',workspace_id,encounter_id,order_id,id,1 from order_tasks where id='40000000-0000-4000-8000-000000000002';
insert into order_billing_candidates(workspace_id,encounter_id,order_id,status,unit_price,quantity,amount)
select workspace_id,encounter_id,id,'candidate_created',100,1,100 from orders where id='20000000-0000-4000-8000-000000000002';
select public.clair_confirm_chart_order_candidates('hospital-a','00000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002',array['20000000-0000-4000-8000-000000000002'::uuid],'synthetic-etag','confirm-course-1');
select pg_temp.assert_true((select quantity=3.75 and amount=375 from order_billing_candidates where order_id='20000000-0000-4000-8000-000000000002'),'confirmation wrapper course billing');
select pg_temp.assert_true((select (source_snapshot#>>'{calculationOutputs,actualDispenseQuantity}')::numeric=3.75 and source_snapshot#>>'{calculationOutputs,dispenseRuleSnapshot,source}'='theoretical' from order_fulfillment_work_items where order_id='20000000-0000-4000-8000-000000000002'),'confirmation wrapper freezes rule and request');
update orders set detail_inputs=jsonb_set(detail_inputs,'{dose}','0.75') where id='20000000-0000-4000-8000-000000000001';
do $$ begin
 begin perform public.clair_confirm_chart_order_candidates('hospital-a','00000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',array['20000000-0000-4000-8000-000000000001'::uuid],'synthetic-etag','confirm-blocked-1'); raise exception 'unconfirmed manual change accepted'; exception when others then if sqlerrm<>'actual_dispense_confirmation_blocked' then raise; end if; end;
end $$;
-- Set-child mode-only reset must create a linked attempt without changing its parent snapshot.
insert into orders(id,workspace_id,encounter_id,row_type,order_confirmation_status,status,detail_inputs,confirmed_snapshot)
values('20000000-0000-4000-8000-000000000006','hospital-a','30000000-0000-4000-8000-000000000001','set','confirmed','completed','{}','{"syntheticSet":"preserved"}');
insert into order_tasks(id,workspace_id,encounter_id,order_id,task_role,status,attempt_no,effective_snapshot)
values('40000000-0000-4000-8000-000000000006','hospital-a','30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000006','aggregate','complete',1,'{"syntheticSet":"preserved"}');
update orders set parent_chart_order_line_id='20000000-0000-4000-8000-000000000006',order_confirmation_status='confirmed',status='completed',confirmed_snapshot=jsonb_build_object('calculationOutputs',calculation_outputs)
where id='20000000-0000-4000-8000-000000000003';
insert into order_tasks(id,workspace_id,encounter_id,order_id,parent_task_id,task_role,clinical_order_type,destination_module,status,priority,attempt_no,effective_snapshot)
select '40000000-0000-4000-8000-000000000003',workspace_id,encounter_id,id,'40000000-0000-4000-8000-000000000006','execution','dispensing','dispensing','complete','normal',1,confirmed_snapshot from orders where id='20000000-0000-4000-8000-000000000003';
select public.clair_mutate_chart_order_execution_origin_base('hospital-a','00000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003','re_request','synthetic mode reset',0,'{"actualDispenseMode":"automatic"}','quantity-child-auto-1');
select pg_temp.assert_true((select (effective_snapshot#>>'{calculationOutputs,actualDispenseQuantity}')::numeric=3.5 and parent_task_id='40000000-0000-4000-8000-000000000006' from order_tasks where order_id='20000000-0000-4000-8000-000000000003' and attempt_no=2),'child mode-only reset keeps original aggregate and frozen rule');
select pg_temp.assert_true((select confirmed_snapshot='{"syntheticSet":"preserved"}'::jsonb from orders where id='20000000-0000-4000-8000-000000000006'),'parent confirmed snapshot unchanged');
-- Historic per-dose manual data is converted once, and its old completed attempt remains untouched.
alter table orders disable trigger orders_execution_contract_zzz_dispense_rule_trg;
update orders set order_confirmation_status='draft',dispense_request_rule_snapshot=null,calculation_outputs='{"actualDispenseQuantity":1,"actualDispenseSource":"manual_override","totalOccurrences":6,"totalRequiredDispenseQuantity":6}' where id='20000000-0000-4000-8000-000000000005';
alter table orders enable trigger orders_execution_contract_zzz_dispense_rule_trg;
select pg_temp.assert_true((select (private.clair_compute_plan_order_dispense_projection(o,now())->>'actualDispenseQuantity')::numeric=6 from orders o where id='20000000-0000-4000-8000-000000000005'),'legacy per-dose manual total converted once');
update orders set detail_inputs=detail_inputs-'dose' where id='20000000-0000-4000-8000-000000000005';
update orders set detail_inputs='{"route":"PO","totalQuantity":1,"dose":5,"doseBasis":"patient","doseUnit":"mg","frequency":"sid","durationDays":7}' where id='20000000-0000-4000-8000-000000000005';
select pg_temp.assert_true((select (calculation_outputs->>'actualDispenseQuantity')::numeric=6 and (calculation_outputs->>'theoreticalTotalQuantity')::numeric=7 and (calculation_outputs->>'requiresReconfirmation')::boolean from orders where id='20000000-0000-4000-8000-000000000005'),'legacy blocked calculation preserves previous course manual total');
-- LEGACY BOUNDARY TESTS
select 'PASS dispense request quantities';
rollback;
