begin;
create schema if not exists private;
do $roles$ declare r text; begin
  foreach r in array array['anon','authenticated','service_role'] loop
    if not exists(select 1 from pg_roles where rolname=r) then execute format('create role %I',r); end if;
  end loop;
end $roles$;
create table public.lab_result_entries (
  id uuid primary key, workspace_id text, order_id uuid, result_definition_snapshot jsonb,
  result_status text default 'entered', result_definition_origin text default 'canonical'
);
create table public.lab_result_entry_rows (
  workspace_id text, lab_result_entry_id uuid, row_id text, result_value text, note text,
  result_presence text default 'value', result_qualifier text default 'exact', device_flag text,
  judgment text default 'not_judged', required boolean default true,
  result_state text default 'not_entered' constraint lab_result_entry_rows_result_state_check
    check(result_state in ('not_entered','recorded','recorded_without_interval','instrument_no_result','qualified_result','flagged_result','outside_documented_display_range'))
);
create table public.order_tasks (workspace_id text, order_id uuid, task_role text default 'execution', clinical_order_type text default 'clinical_lab', status text default 'in_progress');
-- BASELINE
-- MIGRATION
do $test$
declare
  r jsonb := '{"testMasterKey":"synthetic.numeric","code":"SYN","resultValueKind":"numeric","unit":"mg/dL","decimalScale":1,"supported":true,"numericMin":0,"numericMax":null,"referenceInterval":{"low":1,"high":10,"lowInclusive":true,"highInclusive":true},"displayRange":null,"codes":[],"referenceStatus":"synthetic_functional_fixture","provenance":{}}';
  coded jsonb; result jsonb; value text; state text; rule jsonb;
begin
  coded:=r||'{"resultValueKind":"coded","unit":null,"decimalScale":null,"numericMin":null,"referenceInterval":null,"codes":[{"code":"normal","label":"정상","judgment":"normal"},{"code":"not_performed","label":"미수행","judgment":"not_judged"}]}'::jsonb;
  for value,state in values ('4 mg','invalid_numeric_format'),('-1','outside_input_range'),('1e2','invalid_numeric_format'),('1,000','invalid_numeric_format'),('--2','invalid_numeric_format') loop
    result:=private.clair_evaluate_lab_profile_value(r,value);
    if result->>'state'<>state or result->>'judgment'<>'not_judged' or result->>'value'<>value then raise exception 'warning parity: %',result; end if;
  end loop;
  value:=E' \t4 mg\n';
  if private.clair_evaluate_lab_profile_value(r,value)->>'value'<>value then raise exception 'raw text lost'; end if;
  value:=chr(160)||'4'||chr(160);
  if private.clair_evaluate_lab_profile_value(r,value)->>'state'<>'recorded' or private.clair_evaluate_lab_profile_value(r,value)->>'value'<>value then raise exception 'unicode whitespace parity'; end if;
  if private.clair_evaluate_lab_profile_value(r,repeat('9',4096))->>'state'<>'invalid_numeric_format' then raise exception 'overflow parity'; end if;
  if private.clair_evaluate_lab_profile_value(r,'0.'||repeat('0',4000)||'1')->>'judgment'<>'low' then raise exception 'underflow parity'; end if;
  if private.clair_evaluate_lab_profile_value(r,'10.0000000000000001')->>'judgment'<>'high' then raise exception 'decimal precision lost'; end if;
  if private.clair_evaluate_lab_profile_value(r||'{"numericMax":10}','10.0000000000000001')->>'state'<>'outside_input_range' then raise exception 'numeric bound precision lost'; end if;
  if private.clair_evaluate_lab_profile_value(coded,'판독 보류')->>'state'<>'unrecognized_code' then raise exception 'coded warning'; end if;
  if private.clair_evaluate_lab_profile_value(r,'4','less_than')->>'state'<>'qualified_result' then raise exception 'legacy qualifier'; end if;
  if private.clair_evaluate_lab_profile_value(r,'4','exact','old flag')->>'state'<>'flagged_result' then raise exception 'legacy flag'; end if;
  if private.clair_evaluate_lab_profile_value(r||'{"numericMax":10}', '11')->>'state'<>'outside_input_range' then raise exception 'max warning'; end if;
  if private.clair_evaluate_lab_profile_value(r||'{"allowedQualifiers":["exact"]}', '4','less_than')->>'state'<>'unsupported_qualifier' then raise exception 'qualifier warning'; end if;
  foreach rule in array array[r||'{"allowedQualifiers":[]}',r||'{"allowedQualifiers":["greater_than"]}',r||'{"allowedQualifiers":["exact","exact"]}',r||'{"allowedQualifiers":["exact",["less_than"]]}',r||'{"allowedQualifiers":null}',coded||'{"allowedQualifiers":["exact"]}'] loop
    if private.clair_lab_profile_rule_valid(rule) then raise exception 'invalid permission accepted'; end if;
  end loop;
  if not private.clair_lab_profile_rule_valid(r||'{"allowedQualifiers":["exact","greater_than"]}') then raise exception 'valid permission rejected'; end if;
  begin perform private.clair_evaluate_lab_profile_value(r,'4','exact',null,'instrument_no_result'); raise exception 'metadata accepted';
    exception when others then if sqlerrm<>'invalid_result_metadata' then raise; end if; end;
  begin perform private.clair_evaluate_lab_profile_value(r,repeat('x',4097)); raise exception 'oversize accepted';
    exception when others then if sqlerrm<>'invalid_text' then raise; end if; end;
  insert into public.lab_result_entries(id,workspace_id,order_id,result_definition_snapshot) values
    ('97050000-0000-4000-8000-000000000001','synthetic','97050000-0000-4000-8000-000000000002',
      jsonb_build_object('schemaVersion',2,'rows',jsonb_build_array(jsonb_build_object('rowId','warning','interpretationRule',r),jsonb_build_object('rowId','good','interpretationRule',r),jsonb_build_object('rowId','coded','interpretationRule',coded))));
  insert into public.lab_result_entry_rows(workspace_id,lab_result_entry_id,row_id,result_value) values
    ('synthetic','97050000-0000-4000-8000-000000000001','warning',' 4 mg '),('synthetic','97050000-0000-4000-8000-000000000001','good','4'),('synthetic','97050000-0000-4000-8000-000000000001','coded','normal');
  if not exists(select 1 from public.lab_result_entry_rows where row_id='warning' and result_value=' 4 mg ' and result_state='invalid_numeric_format' and judgment='not_judged')
    or not exists(select 1 from public.lab_result_entry_rows where row_id='good' and result_state='recorded' and judgment='normal') then raise exception 'independent row write failed'; end if;
  insert into public.order_tasks(workspace_id,order_id) values ('synthetic','97050000-0000-4000-8000-000000000002');
  begin update public.order_tasks set status='complete'; raise exception 'warning completed';
    exception when others then if sqlerrm<>'required_lab_results_incomplete' then raise; end if; end;
  update public.lab_result_entry_rows set result_value=null,result_presence='instrument_no_result' where row_id='warning';
  begin update public.order_tasks set status='complete'; raise exception 'unavailable completed';
    exception when others then if sqlerrm<>'required_lab_results_incomplete' then raise; end if; end;
  update public.lab_result_entry_rows set result_value='4',result_presence='value' where row_id='warning';
  update public.order_tasks set status='complete';
  foreach value in array array[' not_performed ',chr(160)||'not_performed'||chr(160)] loop
    update public.order_tasks set status='in_progress';
    update public.lab_result_entry_rows set result_value=value where row_id='coded';
    begin update public.order_tasks set status='complete'; raise exception 'whitespace not_performed completed';
      exception when others then if sqlerrm<>'required_lab_results_incomplete' then raise; end if; end;
  end loop;
  insert into public.lab_result_entries(id,workspace_id,order_id,result_definition_snapshot) values
    ('97050000-0000-4000-8000-000000000003','synthetic','97050000-0000-4000-8000-000000000004','{"schemaVersion":1,"rows":[]}');
  insert into public.lab_result_entry_rows(workspace_id,lab_result_entry_id,row_id,result_value) values
    ('synthetic','97050000-0000-4000-8000-000000000003','v1','legacy value');
  if not exists(select 1 from public.lab_result_entry_rows where row_id='v1' and result_value='legacy value' and result_state='not_entered') then raise exception 'V1 changed'; end if;
end $test$;
select 'PASS lab_input_warnings';
rollback;
