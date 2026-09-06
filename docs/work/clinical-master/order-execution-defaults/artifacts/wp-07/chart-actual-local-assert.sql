-- Synthetic chart-only confirmation/actual/history proof; enclosing harness rolls back.
insert into public.order_catalog_items(id,workspace_id,standard_order_id,source_preset_version,
  category_group,category_label,standard_order_name,in_hospital_order_name,billing_name,availability_status,
  billing_reflection_enabled,price_krw,default_destination_module,classification_path_id,clinical_order_type,
  is_external_lab,destination_module,execution_mode,detail_schema_version,detail_field_schema,billing_eligible)
select 'wp07-synthetic-'||v.kind,'clair-demo','wp07-synthetic-'||v.kind,'synthetic-chart-actual',
  case when v.kind='consultation' then 'consultation' else 'misc' end,'Synthetic chart-only',
  'WP07 synthetic '||v.kind,'WP07 synthetic '||v.kind,'WP07 synthetic '||v.kind,'active',false,0,'chart_only',p.id,v.kind,
  false,null,'immediate_complete',1,private.clair_order_detail_field_schema_v1(v.kind),false
from (values('system_exam'),('consultation'),('other')) v(kind)
join master.classification_paths p on p.path_key=case when v.kind='consultation'
  then 'cm.path.consultation' else 'cm.path.system-exam.respiratory' end;

insert into public.orders(id,workspace_id,encounter_id,order_type,display_name,status,requested_by_user_id,requested_at,
  clinical_order_type,destination_module,execution_mode,detail_schema_version,detail_inputs,applied_snapshot,billing_eligible,
  billing_reflection_enabled,quantity,unit_price_snapshot,workspace_catalog_item_id,workspace_catalog_revision)
select v.id::uuid,'clair-demo','97030000-0000-4000-8000-000000000002','treatment','WP07 synthetic '||v.kind,
  'requested',actor.user_id,now(),v.kind,null,'immediate_complete',1,
  case v.kind when 'system_exam' then '{"bodySystem":"호흡기계","examScope":"호흡기계 평가","examMethod":"시진","findingSummary":"Synthetic directly observed finding"}'::jsonb
    when 'consultation' then jsonb_build_object('responsibleClinicianId',actor.user_id,'occurrenceCount',1,'timing','now','instructionSummary','Synthetic planned consultation')
    else '{"structuredValue":"Synthetic planned other"}'::jsonb end,
  private.clair_build_catalog_order_snapshot('clair-demo',c.id,1),false,false,1,0,c.id,c.catalog_revision
from (values('97071000-0000-4000-8000-000000000001','system_exam'),('97071000-0000-4000-8000-000000000002','consultation'),
  ('97071000-0000-4000-8000-000000000003','other'),
  ('97071000-0000-4000-8000-000000000004','system_exam'),('97071000-0000-4000-8000-000000000005','consultation'),
  ('97071000-0000-4000-8000-000000000006','other')) v(id,kind)
join public.order_catalog_items c on c.id='wp07-synthetic-'||v.kind cross join wp01b_actor actor;

do $chart$
declare actor uuid:=(select user_id from wp01b_actor); encounter uuid:='97030000-0000-4000-8000-000000000002';
  ids uuid[]:=array['97071000-0000-4000-8000-000000000001','97071000-0000-4000-8000-000000000002','97071000-0000-4000-8000-000000000003']::uuid[];
  etag text; actual jsonb; result jsonb; retry jsonb; context jsonb; task_id uuid; frozen jsonb; stamp text:=to_char(now()-interval '1 minute','YYYY-MM-DD"T"HH24:MI:SS.USOF');
begin
  stamp:=to_char(now() at time zone 'UTC'-interval '1 minute','YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
  etag:=private.clair_b3_order_draft_etag('clair-demo',encounter);
  actual:=jsonb_build_object(ids[1]::text,jsonb_build_object('performedAt',stamp,'selfPerformed',true,'payload',jsonb_build_object('findingSummary','Synthetic directly observed finding')),
    ids[2]::text,jsonb_build_object('performedAt',stamp,'selfPerformed',true,'payload',jsonb_build_object('performedActivity','Synthetic actual consultation','outcome','Synthetic actual consultation outcome')),
    ids[3]::text,jsonb_build_object('performedAt',stamp,'selfPerformed',true,'payload',jsonb_build_object('performedActivity','Synthetic actual other work','outcome','Synthetic actual other outcome')));
  begin
    perform public.clair_confirm_chart_order_candidates('clair-demo',actor,encounter,ids,etag,'wp07-bypass-attempt');
    set constraints order_tasks_chart_actual_required immediate;
    raise exception 'test old RPC bypassed actual guard';
  exception when others then if sqlerrm<>'chart_actual_record_required' then raise; end if; end;
  if exists(select 1 from public.order_tasks where order_id=any(ids)) then raise exception 'test rejected batch leaked tasks'; end if;
  begin
    perform public.clair_confirm_chart_order_candidates_with_actual('clair-demo',actor,encounter,ids,etag,'wp07-missing-actual',actual-ids[2]::text);
    raise exception 'test missing actual accepted';
  exception when others then if sqlerrm<>'invalid_chart_actual' then raise; end if; end;
  begin
    perform public.clair_confirm_chart_order_candidates_with_actual('clair-demo',actor,encounter,ids,etag,'wp07-no-attestation',jsonb_set(actual,array[ids[1]::text,'selfPerformed'],'false'));
    raise exception 'test absent attestation accepted';
  exception when others then if sqlerrm<>'invalid_chart_actual' then raise; end if; end;
  result:=public.clair_confirm_chart_order_candidates_with_actual('clair-demo',actor,encounter,ids,etag,'wp07-actual-confirm',actual);
  set constraints order_tasks_chart_actual_required immediate;
  set constraints order_tasks_chart_actual_required deferred;
  retry:=public.clair_confirm_chart_order_candidates_with_actual('clair-demo',actor,encounter,ids,etag,'wp07-actual-confirm',actual);
  if result is distinct from retry then raise exception 'test chart actual confirmation retry unstable'; end if;
  begin
    perform public.clair_confirm_chart_order_candidates_with_actual('clair-demo',actor,encounter,ids,etag,'wp07-actual-confirm',jsonb_set(actual,array[ids[2]::text,'payload','outcome'],'"Changed actual"'));
    raise exception 'test changed retry accepted';
  exception when others then if sqlerrm<>'idempotency_conflict' then raise; end if; end;
  if (select count(*) from public.order_execution_result_versions where order_id=any(ids))<>3
    or exists(select 1 from public.order_fulfillment_work_items where order_id=any(ids)) then raise exception 'test chart-only actual count/queue mismatch'; end if;
  select id,effective_snapshot into strict task_id,frozen from public.order_tasks where order_id=ids[1];
  context:=public.clair_get_chart_actual_context('clair-demo',task_id);
  if context#>>'{results,0,performedByUserId}' is distinct from actor::text
    or (context#>>'{results,0,performedAt}')::timestamptz is distinct from stamp::timestamptz
    or frozen ? 'actualRecords' then raise exception 'test actual performer/time or plan separation missing'; end if;
  result:=public.clair_amend_chart_actual_result('clair-demo',actor,task_id,context->>'planSha256',1,
    '97071000-0000-4000-8000-000000000010',stamp::timestamptz,'{"findingSummary":"Synthetic corrected observation"}','Synthetic transcription correction');
  retry:=public.clair_amend_chart_actual_result('clair-demo',actor,task_id,context->>'planSha256',1,
    '97071000-0000-4000-8000-000000000010',stamp::timestamptz,'{"findingSummary":"Synthetic corrected observation"}','Synthetic transcription correction');
  if result is distinct from retry or jsonb_array_length(result->'results')<>2
    or result#>>'{results,0,payload,findingSummary}'<>'Synthetic directly observed finding'
    or (select effective_snapshot from public.order_tasks where id=task_id) is distinct from frozen then raise exception 'test chart actual amendment/history changed original'; end if;
  begin
    perform public.clair_amend_chart_actual_result('clair-demo',actor,task_id,context->>'planSha256',1,
      '97071000-0000-4000-8000-000000000011',stamp::timestamptz,'{"findingSummary":"stale"}','Synthetic stale correction');
    raise exception 'test stale chart actual amendment accepted';
  exception when others then if sqlerrm<>'result_revision_conflict' then raise; end if; end;
  begin
    perform public.clair_get_chart_actual_context('clair-foreign-demo',task_id);
    raise exception 'test foreign chart task visible';
  exception when others then if sqlerrm not in ('permission_missing','task_unavailable') then raise; end if; end;
  raise notice 'WP07 chart-only actual three types: direct bypass/missing/attestation deny, atomic record/retry/amend/head CAS/foreign deny passed';
end $chart$;

-- Simulate already-confirmed pre-contract tasks without bypassing any trigger:
-- the original migration assigned schema 0 to preexisting rows, then default 1
-- to new rows. This default is scoped to a rollback-only synthetic fixture.
alter table public.order_tasks alter column execution_result_schema_version set default 0;
do $legacy_chart$
declare actor uuid:=(select user_id from wp01b_actor); encounter uuid:='97030000-0000-4000-8000-000000000002';
  ids uuid[]:=array['97071000-0000-4000-8000-000000000004','97071000-0000-4000-8000-000000000005','97071000-0000-4000-8000-000000000006']::uuid[];
  etag text; original_result jsonb; retry jsonb; task_before jsonb; event_before jsonb; legacy_id uuid; payload jsonb;
  stamp text:=to_char(now() at time zone 'UTC'-interval '1 minute','YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
begin
  etag:=private.clair_b3_order_draft_etag('clair-demo',encounter);
  original_result:=public.clair_confirm_chart_order_candidates('clair-demo',actor,encounter,ids,etag,'wp07-legacy-confirm');
  set constraints order_tasks_chart_actual_required immediate;
  set constraints order_tasks_chart_actual_required deferred;
  if (select count(*) from public.order_tasks where order_id=any(ids) and execution_result_schema_version=0)<>3
    then raise exception 'test legacy chart fixture schema mismatch'; end if;
  select jsonb_agg(to_jsonb(t) order by t.id) into task_before from public.order_tasks t where t.order_id=any(ids);
  select jsonb_agg(to_jsonb(e) order by e.id) into event_before from public.order_task_events e where e.order_id=any(ids);
  retry:=public.clair_confirm_chart_order_candidates_with_actual('clair-demo',actor,encounter,ids,etag,'wp07-legacy-confirm','{}');
  if retry is distinct from original_result then raise exception 'test empty legacy retry response changed'; end if;
  foreach legacy_id in array ids loop
    payload:=case when legacy_id=ids[1] then jsonb_build_object('findingSummary','Synthetic directly observed finding')
      else jsonb_build_object('performedActivity','Fabricated legacy activity','outcome','Fabricated legacy outcome') end;
    begin
      perform public.clair_confirm_chart_order_candidates_with_actual('clair-demo',actor,encounter,ids,etag,'wp07-legacy-confirm',
        jsonb_build_object(legacy_id::text,jsonb_build_object('performedAt',stamp,'selfPerformed',true,'payload',payload)));
      raise exception 'test legacy retry accepted supplied actual';
    exception when others then if sqlerrm<>'chart_actual_scope_mismatch' then raise; end if; end;
  end loop;
  retry:=public.clair_confirm_chart_order_candidates_with_actual('clair-demo',actor,encounter,ids,etag,'wp07-legacy-confirm','{}');
  if retry is distinct from original_result
    or exists(select 1 from public.order_execution_result_versions where order_id=any(ids))
    or (select jsonb_agg(to_jsonb(t) order by t.id) from public.order_tasks t where t.order_id=any(ids)) is distinct from task_before
    or (select jsonb_agg(to_jsonb(e) order by e.id) from public.order_task_events e where e.order_id=any(ids)) is distinct from event_before
    then raise exception 'test legacy retry fabricated or changed task/result/event history'; end if;
  raise notice 'WP07 legacy chart retry: all3 schema0 empty responses/history preserved; supplied actual IDs rejected';
end $legacy_chart$;
alter table public.order_tasks alter column execution_result_schema_version set default 1;
