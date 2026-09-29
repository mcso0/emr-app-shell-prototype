-- Disposable local fixture only. Permission and catalog prerequisites are stubs;
-- the retest RPC, chart-origin guard, and immutable snapshot trigger are real migrations.
begin;
create schema auth;
create schema private;
create schema master;
create schema extensions;
create extension pgcrypto with schema extensions;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('test.actor',true),'')::uuid;
$$;
create function private.clair_is_active_workspace_member(scope text) returns boolean language sql stable as $$
  select auth.uid() is not null and scope='scope-a';
$$;
create function private.clair_current_user_has_workspace_permission(scope text, permission text) returns boolean language sql stable as $$
  select private.clair_is_active_workspace_member(scope) and current_setting('test.editor',true)='yes';
$$;
create function private.clair_require_chart_encounter(scope text, encounter uuid, actor text) returns void language plpgsql as $$
begin
  if not private.clair_current_user_has_workspace_permission(scope,'chart:update') then
    raise exception 'permission_missing' using errcode='42501';
  end if;
end $$;
create function private.clair_guard_lab_profile_history() returns trigger language plpgsql as $$
begin raise exception 'history_immutable'; end $$;
create function private.clair_assert_lab_result_definition_snapshot(scope text, entry uuid) returns void language sql as $$ select; $$;
create function private.clair_build_catalog_order_snapshot(scope text, catalog uuid, quantity integer) returns jsonb language sql as $$ select '{}'::jsonb; $$;
create table public.workspaces(id text primary key);
create table public.users(id uuid primary key, display_name text);
create table public.encounters(id uuid primary key, workspace_id text, status text);
create table public.soap_notes(id uuid primary key, workspace_id text, encounter_id uuid, status text,
  unique(workspace_id,encounter_id,id));
create table master.lab_result_profile_versions(id uuid primary key);
create table public.workspace_lab_devices(workspace_id text, id uuid, primary key(workspace_id,id));
create table public.orders(id uuid primary key, workspace_id text, encounter_id uuid, order_type text, display_name text, status text,
  requested_by_user_id uuid, requested_at timestamptz, clinical_order_type text, destination_module text, execution_mode text,
  detail_schema_version integer, detail_inputs jsonb, applied_snapshot jsonb, billing_eligible boolean,
  billing_reflection_enabled boolean, quantity integer, unit_price_snapshot integer, workspace_catalog_item_id uuid,
  workspace_catalog_revision integer, source_master_record_id text, source_master_revision integer,
  selected_lab_profile_version_id uuid, selected_lab_device_id uuid, parent_chart_order_line_id uuid, origin_chart_id uuid,
  unique(workspace_id,id), foreign key(workspace_id,encounter_id,origin_chart_id) references public.soap_notes(workspace_id,encounter_id,id));
create table public.order_catalog_items(id uuid primary key, workspace_id text, availability_status text, billing_eligible boolean,
  billing_reflection_enabled boolean, price_krw integer, in_hospital_order_name text, clinical_order_type text,
  destination_module text, execution_mode text, detail_schema_version integer, default_detail_inputs jsonb,
  catalog_revision integer, source_master_record_id text, source_master_revision integer);
create table public.order_catalog_lab_test_item_links(workspace_id text, order_catalog_item_id uuid, profile_kind text, source_master_test_record_id text);
create table public.lab_result_entries(id uuid primary key, workspace_id text, result_id text, result_definition_origin text,
  order_id uuid, entry_write_revision integer, source_master_test_record_id text, result_definition_snapshot jsonb, unique(workspace_id,id));
create table public.lab_result_entry_rows(workspace_id text, lab_result_entry_id uuid, row_id text, result_value text,
  result_presence text, analyte_name text, note text, result_unit text, judgment text, sort_order integer);
create table public.lab_result_overall_findings(workspace_id text, lab_result_entry_id uuid, finding text);
create table public.lab_result_revision_events(id bigint generated always as identity, workspace_id text, lab_result_entry_id uuid,
  event_kind text, row_id text, actor_user_id uuid, actor_name text, before_snapshot jsonb, after_snapshot jsonb, created_at timestamptz default now());
insert into public.workspaces values('scope-a');
insert into public.users values('00000000-0000-4000-8000-000000000099','Synthetic Actor');
insert into public.encounters values('00000000-0000-4000-8000-000000000001','scope-a','in_consultation');
insert into public.soap_notes values('00000000-0000-4000-8000-000000000002','scope-a','00000000-0000-4000-8000-000000000001','draft');
insert into master.lab_result_profile_versions values('00000000-0000-4000-8000-000000000003');
insert into public.workspace_lab_devices values('scope-a','00000000-0000-4000-8000-000000000004');
insert into public.order_catalog_items(id,workspace_id,availability_status,in_hospital_order_name,default_detail_inputs,catalog_revision)
  values('00000000-0000-4000-8000-000000000005','scope-a','active','Synthetic potassium','{}',1);
insert into public.orders(id,workspace_id,encounter_id,workspace_catalog_item_id,display_name,status,origin_chart_id)
  values('00000000-0000-4000-8000-000000000006','scope-a','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000005',
    'Synthetic prior order','completed','00000000-0000-4000-8000-000000000002');
insert into public.order_catalog_lab_test_item_links values('scope-a','00000000-0000-4000-8000-000000000005','standalone_test','synthetic-test');
insert into public.lab_result_entries values('00000000-0000-4000-8000-000000000007','scope-a','result-a','canonical',
  '00000000-0000-4000-8000-000000000006',3,'synthetic-test','{}');
insert into public.lab_result_entry_rows values('scope-a','00000000-0000-4000-8000-000000000007','row-a','15','value','Synthetic potassium','ITEM_FINDING','mmol/L','normal',1);
insert into public.lab_result_overall_findings values('scope-a','00000000-0000-4000-8000-000000000007','OVERALL_FINDING');
-- ORIGINAL_RETEST
-- CHART_ORIGIN_GUARD
-- RETEST_HISTORY
set local test.actor='00000000-0000-4000-8000-000000000099';
set local test.editor='yes';
create function public.test_retest_input(request_id uuid) returns jsonb language sql as $$
  select jsonb_build_object('requestId',request_id,'resultId','result-a','rowId','row-a','expectedEntryWriteRevision',3,
    'reason','SYNTHETIC_RETEST','specimenDecision','new_specimen','specimenReference','SYNTHETIC_PLAN','billingPolicy','no_charge',
    'profileVersionId','00000000-0000-4000-8000-000000000003','deviceId','00000000-0000-4000-8000-000000000004');
$$;
do $$ begin
  begin perform public.clair_create_lab_atomic_retest('scope-a',public.test_retest_input('00000000-0000-4000-8000-000000000010'));
    raise exception 'old RPC unexpectedly passed';
  exception when raise_exception then if sqlerrm <> 'chart_id_required' then raise; end if; end;
  if (select count(*) from public.orders)<>1 or exists(select 1 from public.lab_atomic_retest_requests) then
    raise exception 'failed request left side effects'; end if;
end $$;
-- CHART_ORIGIN_PATCH
-- CHART_ORIGIN_PATCH
do $$ declare result jsonb; again jsonb; begin
  result:=public.clair_create_lab_atomic_retest('scope-a',public.test_retest_input('00000000-0000-4000-8000-000000000010'));
  again:=public.clair_create_lab_atomic_retest('scope-a',public.test_retest_input('00000000-0000-4000-8000-000000000010'));
  if result<>again or result->>'confirmationStatus'<>'draft' then raise exception 'idempotent draft failed'; end if;
  if not exists(select 1 from public.orders where id=(result->>'orderId')::uuid
    and origin_chart_id='00000000-0000-4000-8000-000000000002' and status='requested' and billing_reflection_enabled=false)
    then raise exception 'origin or no-charge contract failed'; end if;
  if (select count(*) from public.orders)<>2 or (select count(*) from public.lab_atomic_retest_requests)<>1 then
    raise exception 'duplicate order'; end if;
  if not exists(select 1 from public.lab_result_revision_events where event_kind='retest_requested'
    and after_snapshot->>'overallFinding'='OVERALL_FINDING'
    and after_snapshot->'rows'->0->>'finding'='ITEM_FINDING' and after_snapshot->'rows'->0->>'value'='15')
    then raise exception 'prior findings snapshot missing'; end if;
end $$;
update public.lab_result_entry_rows set result_value='16',note='NEW_FINDING';
update public.lab_result_overall_findings set finding='NEW_OVERALL';
do $$ begin
  if not exists(select 1 from public.lab_result_revision_events where after_snapshot->>'overallFinding'='OVERALL_FINDING'
    and after_snapshot->'rows'->0->>'finding'='ITEM_FINDING' and after_snapshot->'rows'->0->>'value'='15')
    then raise exception 'snapshot was overwritten'; end if;
  begin perform public.clair_create_lab_atomic_retest('scope-b',public.test_retest_input('00000000-0000-4000-8000-000000000011'));
    raise exception 'foreign workspace allowed'; exception when insufficient_privilege then null; end;
end $$;
set local test.editor='no';
do $$ begin
  begin perform public.clair_create_lab_atomic_retest('scope-a',public.test_retest_input('00000000-0000-4000-8000-000000000012'));
    raise exception 'missing permission allowed'; exception when insufficient_privilege then null; end;
end $$;
set local test.editor='yes';
update public.soap_notes set status='finalized';
do $$ begin
  begin perform public.clair_create_lab_atomic_retest('scope-a',public.test_retest_input('00000000-0000-4000-8000-000000000013'));
    raise exception 'closed chart allowed';
  exception when raise_exception then if sqlerrm <> 'chart_unavailable' then raise; end if; end;
  if (select count(*) from public.orders)<>2 or (select count(*) from public.lab_result_revision_events)<>1 then
    raise exception 'rejected retest left side effects'; end if;
  if has_function_privilege('anon','public.clair_create_lab_atomic_retest(text,jsonb)','execute')
    or has_function_privilege('service_role','public.clair_create_lab_atomic_retest(text,jsonb)','execute')
    or not has_function_privilege('authenticated','public.clair_create_lab_atomic_retest(text,jsonb)','execute') then
    raise exception 'RPC privilege changed'; end if;
end $$;
select 'lab retest chart origin checks passed';
rollback;
