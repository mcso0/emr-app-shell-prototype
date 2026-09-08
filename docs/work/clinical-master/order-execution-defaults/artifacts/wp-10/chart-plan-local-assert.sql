-- Synthetic chart-only confirmation/actual/history proof; enclosing harness rolls back.
insert into public.order_catalog_items(id,workspace_id,standard_order_id,source_preset_version,
  category_group,category_label,standard_order_name,in_hospital_order_name,billing_name,availability_status,
  billing_reflection_enabled,price_krw,default_destination_module,classification_path_id,clinical_order_type,
  is_external_lab,destination_module,execution_mode,detail_schema_version,detail_field_schema,billing_eligible)
select 'wp10-synthetic-'||v.kind,'clair-demo','wp10-synthetic-'||v.kind,'synthetic-chart-actual',
  case when v.kind='consultation' then 'consultation' else 'misc' end,'Synthetic chart-only',
  'WP07 synthetic '||v.kind,'WP07 synthetic '||v.kind,'WP07 synthetic '||v.kind,'active',false,0,'chart_only',p.id,v.kind,
  false,null,'immediate_complete',2,private.clair_order_detail_field_schema(v.kind,2),false
from (values('system_exam'),('consultation'),('other')) v(kind)
join master.classification_paths p on p.path_key=case when v.kind='consultation'
  then 'cm.path.consultation' else 'cm.path.system-exam.respiratory' end;

insert into public.orders(id,workspace_id,encounter_id,order_type,display_name,status,requested_by_user_id,requested_at,
  clinical_order_type,destination_module,execution_mode,detail_schema_version,detail_inputs,applied_snapshot,billing_eligible,
  billing_reflection_enabled,quantity,unit_price_snapshot,workspace_catalog_item_id,workspace_catalog_revision)
select v.id::uuid,'clair-demo','97030000-0000-4000-8000-000000000002','treatment','WP07 synthetic '||v.kind,
  'requested',actor.user_id,now(),v.kind,null,'immediate_complete',2,
  case v.kind when 'system_exam' then '{"bodySystem":"호흡기계","examScope":"호흡기계 평가","examMethod":"시진"}'::jsonb
    when 'consultation' then jsonb_build_object('responsibleClinicianId',actor.user_id,'occurrenceCount',1,'timing','now','instructionSummary','Synthetic planned consultation')
    else '{"structuredValue":"Synthetic planned other"}'::jsonb end,
  private.clair_build_catalog_order_snapshot('clair-demo',c.id,1),false,false,1,0,c.id,c.catalog_revision
from (values('97081000-0000-4000-8000-000000000001','system_exam'),('97081000-0000-4000-8000-000000000002','consultation'),
  ('97081000-0000-4000-8000-000000000003','other'),
  ('97081000-0000-4000-8000-000000000004','system_exam'),('97081000-0000-4000-8000-000000000005','consultation'),
  ('97081000-0000-4000-8000-000000000006','other')) v(id,kind)
join public.order_catalog_items c on c.id='wp10-synthetic-'||v.kind cross join wp01b_actor actor;


do $plan$
declare actor uuid:=(select user_id from wp01b_actor); encounter uuid:='97030000-0000-4000-8000-000000000002';
ids uuid[]:=array['97081000-0000-4000-8000-000000000001','97081000-0000-4000-8000-000000000002','97081000-0000-4000-8000-000000000003']::uuid[];
etag text; context jsonb; result jsonb; task public.order_tasks; payload jsonb; stamp timestamptz:=now()-interval '1 minute'; command uuid;
begin
etag:=private.clair_b3_order_draft_etag('clair-demo',encounter);
perform public.clair_confirm_chart_order_candidates_with_actual('clair-demo',actor,encounter,ids,etag,'wp10-plan-confirm','{}');
set constraints order_tasks_chart_actual_required immediate;
set constraints order_tasks_chart_actual_required deferred;
if (select count(*) from public.order_tasks where order_id=any(ids) and status='pending' and completed_at is null)<>3
or exists(select 1 from public.order_execution_result_versions where order_id=any(ids)) then raise exception 'test plan fabricated completion'; end if;
for task in select * from public.order_tasks where order_id=any(ids) loop
context:=public.clair_get_chart_actual_context('clair-demo',task.id);
if context->>'canRecord'<>'true' then raise exception 'test plan cannot record actual'; end if;
payload:=case when task.clinical_order_type='system_exam' then '{"findingSummary":"Synthetic explicit finding"}'::jsonb
else '{"performedActivity":"Synthetic explicit activity","outcome":"Synthetic explicit outcome"}'::jsonb end;
command:=extensions.gen_random_uuid();
begin
perform public.clair_record_chart_actual_result('clair-demo',actor,task.id,context->>'planSha256',command,stamp,payload,false);
raise exception 'test absent attestation accepted';
exception when others then if sqlerrm<>'invalid_chart_actual' then raise; end if; end;
result:=public.clair_record_chart_actual_result('clair-demo',actor,task.id,context->>'planSha256',command,stamp,payload,true);
if result is distinct from public.clair_record_chart_actual_result('clair-demo',actor,task.id,context->>'planSha256',command,stamp,payload,true)
then raise exception 'test completion retry unstable'; end if;
if (select status from public.order_tasks where id=task.id)<>'complete' then raise exception 'test actual did not complete task'; end if;
end loop;
set constraints order_tasks_chart_actual_required immediate;
raise notice 'WP10 chart plan confirm without actual; explicit actual completion and retry passed';
end $plan$;

do $mixed_set$
declare actor uuid:=(select user_id from wp01b_actor); encounter uuid:='97030000-0000-4000-8000-000000000002';
  root_id uuid:='97081000-0000-4000-8000-000000000040'; definition jsonb; result jsonb; revision uuid; revision_no integer;
  selection jsonb; children jsonb; item record; task public.order_tasks; context jsonb; actual jsonb; count_complete integer:=0;
begin
  select jsonb_build_object('setCategory','합성 혼합 계획','setName','WP10 synthetic mixed chart plans','billingName','WP10 synthetic mixed chart plans',
    'amountBasis','included_order_sum','setPriceKrw',null,'rangeBasis',null,'salesUnit','per_order','billingReflectionEnabled',false,'taxType','derived',
    'targetSpecies',jsonb_build_array('dog','cat'),'careGuide',null,'internalInstruction',null,'items',jsonb_agg(jsonb_build_object('childKind','atomic','childOrderCatalogItemId',c.id,
      'childOrderCatalogRevision',c.catalog_revision,'childOrderSetId',null,'childSetRevisionId',null,'sortOrder',ordinal,'defaultSelected',true,
      'billingReflectionDefault',false,'defaultQuantity',1,'quantitySource','fixed_one') order by ordinal),'priceRanges','[]'::jsonb)
    into definition from (values('wp10-synthetic-system_exam',1),('wp10-synthetic-consultation',2),('wp10-synthetic-other',3)) selected(id,ordinal)
    join public.order_catalog_items c on c.workspace_id='clair-demo' and c.id=selected.id;
  result:=private.clair_b2_create_core('clair-demo',definition,'active',actor,extensions.gen_random_uuid(),'wp10-mixed-chart');
  if result->'ok' is distinct from 'true'::jsonb then raise exception 'test mixed set creation failed: %',result; end if;
  select s.current_revision_id,r.revision_no into revision,revision_no from public.order_sets s join public.order_set_revisions r on r.id=s.current_revision_id
    where s.workspace_id='clair-demo' and s.id='wp10-mixed-chart';
  select jsonb_build_object('items',jsonb_agg(jsonb_build_object('revisionItemId',i.id,'selected',true,'quantity',1) order by i.sort_order)),
    jsonb_agg(jsonb_build_object('revisionItemId',i.id,'detailInputs',o.detail_inputs,'detailSchemaVersion',2,'priority','normal') order by i.sort_order)
    into selection,children from public.order_set_revision_items i join public.orders o on o.workspace_catalog_item_id=i.child_order_catalog_item_id
      and o.id=any(array['97081000-0000-4000-8000-000000000004','97081000-0000-4000-8000-000000000005','97081000-0000-4000-8000-000000000006']::uuid[])
    where i.workspace_id='clair-demo' and i.revision_id=revision;
  perform public.clair_save_chart_order_draft('clair-demo',actor::text,encounter,jsonb_build_object('expectedEtag',private.clair_b3_order_draft_etag('clair-demo',encounter),
    'rows',jsonb_build_array(jsonb_build_object('rowType','set','orderId',root_id,'sourceSetId','wp10-mixed-chart','sourceSetRevisionId',revision,
      'sourceSetRevisionNo',revision_no,'selectionIntent',selection,'detailInputs','{}'::jsonb,'detailSchemaVersion',1,'priority','normal','childInputs',children))));
  perform public.clair_confirm_chart_order_candidates_with_actual('clair-demo',actor,encounter,array[root_id],
    private.clair_b3_order_draft_etag('clair-demo',encounter),'wp10-mixed-confirm','{}');
  if (select count(*) from public.order_tasks where parent_task_id=(select id from public.order_tasks where order_id=root_id and task_role='aggregate') and status='pending')<>3
    then raise exception 'test mixed children fabricated completion'; end if;
  for task in select t.* from public.order_tasks t join public.orders o on o.id=t.order_id where o.parent_chart_order_line_id=root_id order by t.id loop
    context:=public.clair_get_chart_actual_context('clair-demo',task.id);
    actual:=case when task.clinical_order_type='system_exam' then '{"findingSummary":"Synthetic mixed finding"}'::jsonb
      else '{"performedActivity":"Synthetic mixed activity","outcome":"Synthetic mixed outcome"}'::jsonb end;
    perform public.clair_record_chart_actual_result('clair-demo',actor,task.id,context->>'planSha256',extensions.gen_random_uuid(),now(),actual,true);
    count_complete:=count_complete+1;
    if (select status from public.order_tasks where id=task.parent_task_id) is distinct from
      (case when count_complete=3 then 'complete' else 'partial_complete' end) then raise exception 'test mixed aggregate status invalid'; end if;
  end loop;
  if count_complete<>3 then raise exception 'test mixed expected three actuals'; end if;
  raise notice 'WP10 mixed chart set: three pending leaves and aggregate partial/full actual completion passed';
end $mixed_set$;

do $location_default$
declare c public.order_catalog_items; original jsonb; inputs jsonb;
begin
  select * into strict c from public.order_catalog_items where workspace_id='clair-demo'
    and clinical_order_type='hospitalization' order by id limit 1;
  original:=c.default_detail_inputs;
  inputs:=private.clair_catalog_effective_default_detail_inputs(c);
  if inputs ? 'wardOrCage' then raise exception 'test default was inferred from an existing location'; end if;
  perform public.clair_save_workspace_inpatient_location('clair-demo',
    '{"id":"97081000-0000-4000-8000-000000000020","label":"Synthetic explicit default ward","kind":"ward","active":true,"expectedRevision":0}');
  update public.workspace_inpatient_locations set is_default=true where workspace_id='clair-demo' and id='97081000-0000-4000-8000-000000000020';
  update public.workspace_inpatient_locations set is_default=true where workspace_id='clair-foreign-demo' and id='97070000-0000-4000-8000-000000000002';
  inputs:=private.clair_catalog_effective_default_detail_inputs(c);
  if inputs->>'wardOrCage'<>'97081000-0000-4000-8000-000000000020'
    or (select default_detail_inputs from public.order_catalog_items where id=c.id) is distinct from original then
    raise exception 'test location resolution crossed workspace or modified catalog source'; end if;
  update public.workspace_inpatient_locations set active=false where workspace_id='clair-demo' and id='97081000-0000-4000-8000-000000000020';
  if private.clair_catalog_effective_default_detail_inputs(c) ? 'wardOrCage' then raise exception 'test inactive default resolved'; end if;
  update public.order_catalog_items set availability_status='inactive',archived_at=now() where id='wp10-synthetic-other';
  if exists(select 1 from public.clair_list_order_catalog_admin_v2('clair-demo') item where item->>'id'='wp10-synthetic-other')
    or not exists(select 1 from public.orders where workspace_catalog_item_id='wp10-synthetic-other') then
    raise exception 'test archived catalog visible or historical reference removed'; end if;
  raise notice 'WP10 explicit local default resolution/inactive exclusion/source preservation/catalog archive history passed';
end $location_default$;
