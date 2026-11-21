-- Transactional regression for the isolated, schema-only local DB. Uses only synthetic fixtures.
\set ON_ERROR_STOP on
begin;
set local plpgsql.check_asserts = on;
set local statement_timeout='15s';
insert into auth.users(id) values ('afd26000-0000-4000-8000-000000000003');
insert into public.users(id,display_name,initial,email,status) values('afd26000-0000-4000-8000-000000000003','QA synthetic','QA','qa@example.test','active');
insert into public.workspaces(id,display_name,status) values('synthetic-advanced-chart-copy-qa','Rollback QA','active');
insert into public.user_memberships(id,workspace_id,user_id,roles,status) values('afd26100-0000-4000-8000-000000000003','synthetic-advanced-chart-copy-qa','afd26000-0000-4000-8000-000000000003',array['vet'],'active');
insert into public.workspace_permission_roles(id,workspace_id,role_key,label,role_type,permissions) values('afd26200-0000-4000-8000-000000000003','synthetic-advanced-chart-copy-qa','qa','QA','standard','{"allowed":["chart:view","chart:update","order:view","order:update","service_catalog:view"]}');
insert into public.workspace_membership_permission_role_assignments(workspace_id,membership_id,permission_role_id) values('synthetic-advanced-chart-copy-qa','afd26100-0000-4000-8000-000000000003','afd26200-0000-4000-8000-000000000003') on conflict(membership_id) do update set permission_role_id=excluded.permission_role_id;
insert into public.patients(id,workspace_id,patient_no,name,species,sex) values('afd26300-0000-4000-8000-000000000001','synthetic-advanced-chart-copy-qa','qa','qa patient','dog','unknown');
insert into public.encounters(id,workspace_id,patient_id,primary_veterinarian_id,encounter_no,reception_type,status) select ('afd26300-0000-4000-8000-00000000000'||i)::uuid,'synthetic-advanced-chart-copy-qa','afd26300-0000-4000-8000-000000000001','afd26000-0000-4000-8000-000000000003','qa'||i,'walk_in',case when i=4 then 'waiting' else 'in_consultation' end from generate_series(2,4) i;
insert into public.patients(id,workspace_id,patient_no,name,species,sex)
values ('afd26300-0000-4000-8000-000000000099','synthetic-advanced-chart-copy-qa','qa-other','second synthetic patient','cat','unknown');
update public.encounters set patient_id='afd26300-0000-4000-8000-000000000099'
where workspace_id='synthetic-advanced-chart-copy-qa' and id in ('afd26300-0000-4000-8000-000000000003','afd26300-0000-4000-8000-000000000004');
insert into auth.users(id) values ('afd26000-0000-4000-8000-000000000009');
insert into public.users(id,display_name,status) values ('afd26000-0000-4000-8000-000000000009','Synthetic colleague','active');
insert into public.user_memberships(workspace_id,user_id,roles,status) values('synthetic-advanced-chart-copy-qa','afd26000-0000-4000-8000-000000000009',array['vet'],'active');
insert into public.soap_notes(id,workspace_id,encounter_id,author_user_id,status,subjective,plan) values('afd26300-0000-4000-8000-000000000005','synthetic-advanced-chart-copy-qa','afd26300-0000-4000-8000-000000000002','afd26000-0000-4000-8000-000000000003','draft','source plain','source plan'),('afd26300-0000-4000-8000-000000000006','synthetic-advanced-chart-copy-qa','afd26300-0000-4000-8000-000000000003','afd26000-0000-4000-8000-000000000009','draft','destination plain','destination plan');
do $fix$
declare rel uuid:=gen_random_uuid(); x uuid:=gen_random_uuid(); t uuid:=gen_random_uuid(); ca uuid:=gen_random_uuid(); cg uuid:=gen_random_uuid(); route uuid:=gen_random_uuid(); med uuid:=gen_random_uuid(); mg uuid:=gen_random_uuid(); mr uuid:=gen_random_uuid();
begin
 insert into master.master_releases(id,record_count,source_fingerprint,status,published_by_label,published_at)
 values(rel,7,repeat('7',64),'published','Synthetic QA',now());
 insert into master.master_records(id,master_key,record_type,lifecycle_status,current_revision,current_release_id,published_at)
 select rec.id,'synthetic.qa.'||rec.k,rec.t,'published',1,rel,now() from(values(x,'X','order_category'),(t,'T','order_category'),(ca,'action','clinical_action'),(cg,'group','chart_group'),(route,'route','task_route'),(med,'med','clinical_action'),(mg,'mg','chart_group'),(mr,'mr','task_route')) rec(id,k,t);
 insert into master.order_categories(master_record_id,category_code,category_level) values(x,'X111111','X'); insert into master.order_categories(master_record_id,category_code,category_level,parent_category_id) values(t,'T111111','T',x);
 insert into master.clinical_actions(master_record_id,action_code,t_category_id,item_type,is_other_unclassified) values(ca,NULL,t,'lab',true),(med,NULL,t,'medication',true);
 insert into master.chart_groups(master_record_id,group_code) values(cg,'CG_EXAM'),(mg,'CG_MEDICATION_SUPPLY');
 insert into master.task_routes(master_record_id,route_code,destination_module,task_required,runtime_status) values(route,'NT_LAB','lab',true,'active'),(mr,'NT_DISPENSING','dispensing',true,'active');
 insert into master.classification_paths(path_key,clinical_action_id,chart_group_id,task_route_id,active_from_release_id) values('qa-lab',ca,cg,route,rel),('qa-med',med,mg,mr,rel);
end;$fix$;

insert into public.order_catalog_items (id, workspace_id, standard_order_id, source_preset_version,category_group, category_label, standard_order_name,in_hospital_order_name, billing_name, availability_status, price_krw,default_destination_module, default_task_required,billing_reflection_enabled, origin_type) values ('phase5-lab','synthetic-advanced-chart-copy-qa','phase5-lab','phase5-v1','lab','임상','QA Lab','QA Lab','QA Lab','active',15000,'lab',true,true,'workspace_custom');
insert into public.order_catalog_items (id, workspace_id, standard_order_id, source_preset_version,category_group, category_label, standard_order_name,in_hospital_order_name, billing_name, availability_status, price_krw,default_destination_module, default_task_required,billing_reflection_enabled, origin_type) values ('phase5-med','synthetic-advanced-chart-copy-qa','phase5-med','phase5-v1','medication','약','QA Med','QA Med','QA Med','active',15000,'dispensing',true,true,'workspace_custom');
set local role authenticated;
select set_config('request.jwt.claim.sub','afd26000-0000-4000-8000-000000000003',true),set_config('request.jwt.claim.role','authenticated',true);
create function pg_temp.qa_get(c uuid) returns jsonb language sql as $$ select public.clair_advanced_chart_search_batch('synthetic-advanced-chart-copy-qa',null,c,true,false)->0 $$;
create function pg_temp.qa_cmd(src jsonb,dst jsonb,sel jsonb) returns jsonb language sql as $$ select jsonb_build_object('sourceId',src->>'id','targetId',dst->>'id','sourceVersion',src->>'version','targetVersion',dst->>'version','encounterId',dst->>'encounterId','patientId',dst->>'patientId','selection',sel,'requestId',gen_random_uuid()) $$;
do $test$
declare w text:='synthetic-advanced-chart-copy-qa'; actor text:='afd26000-0000-4000-8000-000000000003'; se uuid:='afd26300-0000-4000-8000-000000000002'; de uuid:='afd26300-0000-4000-8000-000000000003'; we uuid:='afd26300-0000-4000-8000-000000000004'; s uuid:='afd26300-0000-4000-8000-000000000005'; d uuid:='afd26300-0000-4000-8000-000000000006'; p uuid:='afd26300-0000-4000-8000-000000000099'; id uuid:=gen_random_uuid(); base jsonb:='{"paragraphs":[],"diagnoses":[],"orders":[]}'; sr jsonb; ds jsonb; rq jsonb; sel jsonb; res jsonb; saved jsonb; b jsonb; cmp jsonb; ctx text; st text; o jsonb; diag jsonb; sample jsonb; parked jsonb; req2 jsonb; again jsonb;
begin
 sr:=pg_temp.qa_get(s);ds:=pg_temp.qa_get(d);
 assert sr#>>'{paragraphs,0,text}'='source plain' and ds#>>'{paragraphs,1,text}'='destination plan'; raise notice 'PASS plain: %', sr->'paragraphs';
 begin
 sel:=jsonb_set(base,'{paragraphs}','[{"id":"legacy:subjective"},{"id":"legacy:plan","replaceId":"legacy:plan"}]');
 rq:=pg_temp.qa_cmd(sr,ds,sel);
 res:=public.clair_advanced_chart_transfer(w,'apply',rq);
 saved:=public.clair_get_chart_soap_note_by_id(w,de,d);
 assert saved->>'plan'='source plan' and saved->>'subjective' like '%destination plain%source plain%';
 assert public.clair_advanced_chart_transfer(w,'apply',rq)=res;
 assert jsonb_array_length(pg_temp.qa_get(d)->'paragraphs')=3;
 assert sr->>'patientId'<>ds->>'patientId';
 sample:=jsonb_set(saved->'blockDocument','{blocks,0,children,1,content,0,text}',to_jsonb('edited for second patient'::text));
 perform public.clair_save_chart_soap_note_v4(w,actor,de,d,
   jsonb_build_object('blockDocument',sample,'subjective',replace(saved->>'subjective','source plain','edited for second patient'),
     'objective',saved->>'objective','assessment',saved->>'assessment','plan',saved->>'plan'),
   (saved->>'updatedAt')::timestamptz,'manual_save');
 assert pg_temp.qa_get(d)::text like '%edited for second patient%' and pg_temp.qa_get(s)=sr;
 raise notice 'PASS copied text is editable on second patient; source remains unchanged';
 raise notice 'PASS plain->rich append/replace + idempotent replay';
 exception when others then get stacked diagnostics ctx=pg_exception_context; raise exception 'FAIL soap copy % %',sqlerrm,ctx; end;
 begin
 sample:='{"schemaVersion":2,"scopes":[{"scope":"default","scopeKey":"default","systemLabel":"기본 SOAP","blocks":[{"id":"qa-s","type":"soapSection","props":{"kind":"subjective","label":"S","scope":"default","systemLabel":"기본 SOAP"},"children":[{"id":"qa-p","type":"paragraph","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"A split ","styles":{}},{"type":"text","text":"sentence","styles":{}}],"children":[]}]}]}]}'::jsonb;
 saved:=public.clair_get_chart_soap_note_by_id(w,se,s);
 perform public.clair_save_chart_soap_note_v4(w,actor,se,s,jsonb_build_object('blockDocument',sample,'subjective','A split sentence','objective','','assessment','','plan',''),(saved->>'updatedAt')::timestamptz,'manual_save');
 sr:=pg_temp.qa_get(s); assert sr#>>'{paragraphs,0,text}'='A split sentence';raise notice 'PASS rich-inline search';
 exception when others then get stacked diagnostics ctx=pg_exception_context; raise exception 'FAIL rich inline % %',sqlerrm,ctx;end;
 begin
 saved:=public.clair_get_chart_diagnosis_assessments(w,se,s);
 perform public.clair_save_chart_diagnoses_v2(w,actor,se,s,'[{"diagnosisText":"free synthetic diagnosis","diagnosisType":"suspected","isPrimary":true}]',saved->>'version');
 sr:=pg_temp.qa_get(s); ds:=pg_temp.qa_get(d);diag:=sr#>'{diagnoses,0}';
 rq:=pg_temp.qa_cmd(sr,ds,jsonb_set(base,'{diagnoses}',jsonb_build_array(jsonb_build_object('id',diag->>'id','kind','differential','primary',false))));
 res:=public.clair_advanced_chart_transfer(w,'apply',rq);
 assert pg_temp.qa_get(d)#>>'{diagnoses,0,kind}'='differential';assert pg_temp.qa_get(d)#>>'{diagnoses,0,name}'='free synthetic diagnosis'; assert public.clair_advanced_chart_transfer(w,'apply',rq)=res;
 ds:=pg_temp.qa_get(d);
 sel:=jsonb_set(base,'{diagnoses}',jsonb_build_array(jsonb_build_object('id',diag->>'id','kind','confirmed','primary',true)));
 -- Existing diagnosis remains unchanged even with a new request that picked a different review state.
 perform public.clair_advanced_chart_transfer(w,'apply',pg_temp.qa_cmd(sr,ds,sel));
 assert pg_temp.qa_get(d)->'diagnoses'=ds->'diagnoses';
 begin
   perform public.clair_advanced_chart_transfer(w,'apply',rq||jsonb_build_object('selection',sel));
   raise exception 'mismatched idempotency payload accepted';
 exception when others then if sqlerrm<>'request_conflict' then raise;end if;end;
 raise notice 'PASS diagnosis + replay, duplicates retain existing row, mismatched receipt refused';
 exception when others then get stacked diagnostics ctx=pg_exception_context;raise exception 'FAIL dx % %',sqlerrm,ctx;end;
 begin
 saved:=public.clair_get_chart_order_draft(w,se);
 perform public.clair_save_chart_order_draft_for_chart(w,actor,se,s,jsonb_build_object('expectedEtag',saved->'etag','removedOrderIds','[]'::jsonb,'rows',jsonb_build_array(jsonb_build_object('rowType','individual','orderId',id,'workspaceCatalogItemId','phase5-lab','quantity',1))));
 sr:=pg_temp.qa_get(s);ds:=pg_temp.qa_get(d);o:=sr#>'{orders,0}';raise notice 'source_order built %',o;
 assert o->'price'='15000'::jsonb and o->'available'='true'::jsonb;
 rq:=pg_temp.qa_cmd(sr,ds,jsonb_set(base,'{orders}',jsonb_build_array(jsonb_build_object('id',o->>'id','price',o->'price'))));
 res:=public.clair_advanced_chart_transfer(w,'apply',rq);
 assert pg_temp.qa_get(d)#>>'{orders,0,id}'<>id::text; assert pg_temp.qa_get(d)#>>'{orders,0,name}'='QA Lab';assert public.clair_advanced_chart_transfer(w,'apply',rq)=res;
 raise notice 'PASS order+retry';
 exception when others then get stacked diagnostics ctx=pg_exception_context;raise exception 'FAIL order % %',sqlerrm,ctx;end;
 begin
 sr:=pg_temp.qa_get(s);
 sel:=jsonb_set(base,'{paragraphs}',jsonb_build_array(jsonb_build_object('id',sr#>>'{paragraphs,0,id}')));
 sel:=jsonb_set(sel,'{orders}',jsonb_build_array(jsonb_build_object('id',o->>'id','price',o->'price')));
 rq:=jsonb_build_object('sourceId',s,'sourceVersion',sr->>'version','encounterId',we,'patientId',p,'requestId',gen_random_uuid(),'selection',sel);
 parked:=public.clair_advanced_chart_transfer(w,'park',rq);assert parked->>'id'=rq->>'requestId';
 assert parked=public.clair_advanced_chart_transfer(w,'park',rq); raise notice 'PASS park/retry';
 perform set_config('qa.parked',rq::text,true);
 exception when others then get stacked diagnostics ctx=pg_exception_context;raise exception 'FAIL park % %',sqlerrm,ctx;end;
end;$test$;
reset role;
update public.encounters set status='in_consultation' where id='afd26300-0000-4000-8000-000000000004';
savepoint without_catalog;
update public.workspace_permission_roles
set permissions=permissions||jsonb_build_object('allowed',(permissions->'allowed')-'service_catalog:view')
where id='afd26200-0000-4000-8000-000000000003';
update public.soap_notes set status='signed',signed_at=now() where id='afd26300-0000-4000-8000-000000000005';
set local role authenticated;
do $restricted$
declare
  w constant text:='synthetic-advanced-chart-copy-qa';
  actor constant text:='afd26000-0000-4000-8000-000000000003';
  parked jsonb:=current_setting('qa.parked')::jsonb;
  source_chart jsonb:=pg_temp.qa_get((parked->>'sourceId')::uuid);
  dest jsonb:=pg_temp.qa_get('afd26300-0000-4000-8000-000000000006');
  selection jsonb:=parked->'selection';
  first_chart uuid; pending jsonb; item jsonb; action text;
begin
  item:=source_chart#>'{orders,0}';
  assert item->>'name'='QA Lab' and item->'price'='null'::jsonb and item->'available'='null'::jsonb;
  assert public.clair_advanced_chart_recent(w,null)#>'{items,0,orders,0}'=item;
  first_chart:=(public.clair_ensure_encounter_first_chart(w,actor,(parked->>'encounterId')::uuid)->>'id')::uuid;
  pending:=public.clair_advanced_chart_transfer(w,'pending',parked||jsonb_build_object('targetId',first_chart));
  assert pending->>'id'=parked->>'requestId' and pending->'orderPermissionRequired'='true'::jsonb;
  assert pending#>'{selection,orders}'='[]'::jsonb;
  foreach action in array array['apply','park'] loop
    begin
      perform public.clair_advanced_chart_transfer(w,action,pg_temp.qa_cmd(source_chart,dest,selection));
      raise exception 'order permission expected for %',action;
    exception when insufficient_privilege then assert sqlerrm='catalog_permission_missing'; end;
  end loop;
  assert pg_temp.qa_get((dest->>'id')::uuid)=dest;
  perform public.clair_advanced_chart_transfer(w,'apply',pg_temp.qa_cmd(source_chart,dest,jsonb_set(selection,'{orders}','[]')));
  assert jsonb_array_length(pg_temp.qa_get((dest->>'id')::uuid)->'paragraphs')=jsonb_array_length(dest->'paragraphs')+1;
  raise notice 'PASS chart editor without catalog can read historical orders and copy SOAP; current quotes, order selection and pending quotes restricted';
end $restricted$;
rollback to savepoint without_catalog;

savepoint target_archival;
insert into public.encounters(id,workspace_id,patient_id,primary_veterinarian_id,encounter_no,reception_type,status)
values ('afd26300-0000-4000-8000-000000000095','synthetic-advanced-chart-copy-qa','afd26300-0000-4000-8000-000000000099',
        'afd26000-0000-4000-8000-000000000003','qa-park','walk_in','waiting');
set local role authenticated;
do $before_archive$
declare
  w constant text:='synthetic-advanced-chart-copy-qa';
  parked jsonb:=current_setting('qa.parked')::jsonb;
  src jsonb:=pg_temp.qa_get((parked->>'sourceId')::uuid);
  dest jsonb:=pg_temp.qa_get('afd26300-0000-4000-8000-000000000006');
  first_chart uuid; resume jsonb;
begin
  first_chart:=(public.clair_ensure_encounter_first_chart(w,'afd26000-0000-4000-8000-000000000003',(parked->>'encounterId')::uuid)->>'id')::uuid;
  resume:=pg_temp.qa_cmd(src,pg_temp.qa_get(first_chart),parked->'selection')||jsonb_build_object('pendingId',parked->>'requestId');
  perform set_config('qa.archived_resume',resume::text,true);
  perform set_config('qa.archived_existing',pg_temp.qa_cmd(src,dest,parked->'selection')::text,true);
end $before_archive$;
reset role;
create temp view target_write_counts as
  select (select count(*) from public.soap_notes where workspace_id='synthetic-advanced-chart-copy-qa') as notes,
         (select count(*) from public.orders where workspace_id='synthetic-advanced-chart-copy-qa') as orders,
         (select count(*) from private.clair_chart_copy_pending where workspace_id='synthetic-advanced-chart-copy-qa') as pending,
         (select count(*) from private.clair_chart_copy_receipts where workspace_id='synthetic-advanced-chart-copy-qa') as receipts;
create temp table before_target_archive as select * from target_write_counts;
select set_config('qa.replay',jsonb_build_object('input',payload,'result',result)::text,true) is not null
from private.clair_chart_copy_receipts where workspace_id='synthetic-advanced-chart-copy-qa'
  and payload->>'patientId'='afd26300-0000-4000-8000-000000000099' limit 1;
update public.patients set status='soft_deleted' where workspace_id='synthetic-advanced-chart-copy-qa' and id='afd26300-0000-4000-8000-000000000099';
set local role authenticated;
do $after_archive$
declare
  w constant text:='synthetic-advanced-chart-copy-qa';
  resume jsonb:=current_setting('qa.archived_resume')::jsonb;
  existing jsonb:=current_setting('qa.archived_existing')::jsonb;
  replay jsonb:=current_setting('qa.replay')::jsonb;
  test_case record;
begin
  assert public.clair_advanced_chart_transfer(w,'pending',resume)='null'::jsonb;
  assert public.clair_advanced_chart_transfer(w,'apply',replay->'input')=replay->'result';
  for test_case in select * from (values
    ('apply',existing), ('apply',(existing-'targetId'-'targetVersion')||'{"newChart":true}'::jsonb), ('apply',resume),
    ('park',current_setting('qa.parked')::jsonb||jsonb_build_object('encounterId','afd26300-0000-4000-8000-000000000095','requestId',gen_random_uuid()))
  ) as cases(action,input) loop
    begin
      perform public.clair_advanced_chart_transfer(w,test_case.action,test_case.input);
      raise exception 'archived target accepted';
    exception when raise_exception then
      if sqlerrm<>'target_patient_deleted' then raise; end if;
    end;
  end loop;
end $after_archive$;
reset role;
do $$begin
  assert (select a=b from target_write_counts a cross join before_target_archive b);
  raise notice 'PASS archived target rejects existing/new/park/resume, hides pending, preserves successful retry and write counts';
end$$;
rollback to savepoint target_archival;
set local role authenticated;
do $test$
declare w text:='synthetic-advanced-chart-copy-qa';actor text:='afd26000-0000-4000-8000-000000000003';rq jsonb:=current_setting('qa.parked',true)::jsonb; e uuid:='afd26300-0000-4000-8000-000000000004';d uuid;s uuid; pending jsonb;res jsonb;dest jsonb;ctx text;deny boolean:=false;
begin
 if rq is not null then begin
 d:=(public.clair_ensure_encounter_first_chart(w,actor,e)->>'id')::uuid; dest:=pg_temp.qa_get(d);
 pending:=public.clair_advanced_chart_transfer(w,'pending',rq||jsonb_build_object('targetId',d));assert pending->>'id'=rq->>'requestId';
 res:=public.clair_advanced_chart_transfer(w,'apply',rq||jsonb_build_object('requestId',gen_random_uuid(),'pendingId',rq->>'requestId','targetId',d,'targetVersion',dest->>'version'));
 assert (public.clair_advanced_chart_transfer(w,'pending',rq||jsonb_build_object('targetId',d)))='null'::jsonb; raise notice 'PASS resume+consume';
 exception when others then get stacked diagnostics ctx=pg_exception_context;raise exception 'FAIL resume % %',sqlerrm,ctx;end;end if;
 perform set_config('request.jwt.claim.sub','afd26300-0000-4000-8000-000000000099',true);
 begin perform public.clair_advanced_chart_transfer(w,'visits','{}');exception when insufficient_privilege then deny:=true;end;
 assert deny;raise notice 'PASS nonmember denied';
end;$test$;
select set_config('request.jwt.claim.sub','afd26000-0000-4000-8000-000000000003',true);
do $t$
declare w text:='synthetic-advanced-chart-copy-qa';actor text:='afd26000-0000-4000-8000-000000000003';se uuid:='afd26300-0000-4000-8000-000000000002';de uuid:='afd26300-0000-4000-8000-000000000003';s uuid:='afd26300-0000-4000-8000-000000000005';d uuid:='afd26300-0000-4000-8000-000000000006';base jsonb:='{"paragraphs":[],"diagnoses":[],"orders":[]}'; src jsonb; dest jsonb; st jsonb;sel jsonb; denied boolean:=false; prior jsonb; origin jsonb; o jsonb; tag text; ctx text; cmd jsonb; block jsonb; af jsonb; stay jsonb;
begin
 src:=pg_temp.qa_get(s);dest:=pg_temp.qa_get(d);
 -- source read & target writes are evaluated using the same caller permissions
 begin
  perform set_config('request.jwt.claim.sub','afd26300-0000-4000-8000-000000000099',true);
  begin perform public.clair_advanced_chart_search_batch(w);exception when insufficient_privilege then denied:=true;end;assert denied;denied:=false;
  begin perform public.clair_advanced_chart_transfer(w,'apply',pg_temp.qa_cmd(src,dest,base));exception when insufficient_privilege then denied:=true;end;assert denied;denied:=false;
  perform set_config('request.jwt.claim.sub',actor,true);
 end;
 raise notice 'PASS exact nonmember read & write denied';
 begin
 st:=public.clair_get_chart_order_draft(w,se);
 perform public.clair_save_chart_order_draft_for_chart(w,actor,se,s,jsonb_build_object('expectedEtag',st->'etag','removedOrderIds','[]'::jsonb,'rows',jsonb_build_array(jsonb_build_object('rowType','individual','orderId',gen_random_uuid(),'workspaceCatalogItemId','phase5-med','quantity',1,'detailSchemaVersion',1,'detailInputs','{"dose":1,"doseBasis":"patient","doseUnit":"tablet","route":"PO","frequency":"sid","durationDays":2}'::jsonb))));
 src:=pg_temp.qa_get(s);dest:=pg_temp.qa_get(d);
 select v into o from jsonb_array_elements(src->'orders') t(v) where v->>'catalogId'='phase5-med';
 raise notice 'Rx SOURCE %',o;
 sel:=jsonb_set(base,'{orders}',jsonb_build_array(jsonb_build_object('id',o->>'id','price',o->'price','dose',2,'frequency','bid','days',4)));
 cmd:=pg_temp.qa_cmd(src,dest,sel);perform public.clair_advanced_chart_transfer(w,'apply',cmd);
 select v into o from jsonb_array_elements(pg_temp.qa_get(d)->'orders') t(v) where v->>'catalogId'='phase5-med';
 assert o#>>'{inputs,durationDays}'='4' and o#>>'{inputs,frequency}'='bid' and (o#>>'{inputs,dose}')::numeric=2 and o#>>'{inputs,doseUnit}'='tablet';
 raise notice 'PASS Rx edited dose/frequency/days %',o;
 exception when others then get stacked diagnostics ctx=pg_exception_context;raise exception 'FAIL Rx % %',sqlerrm,ctx;end;
 begin
 -- preserve unrelated nested content on A replacement; nondefault system text and free are independently searchable.
 block:='{"id":"sec","type":"soapSection","props":{"kind":"assessment","scope":"default","systemLabel":"기본 SOAP","label":"A"},"children":[{"id":"p","type":"paragraph","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"outer","styles":{}}],"children":[{"id":"child","type":"paragraph","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"child","styles":{}}],"children":[]}]}]}'::jsonb;
 origin:=jsonb_build_object('schemaVersion',2,'scopes',jsonb_build_array(jsonb_build_object('scopeKey','default','scope','default','systemLabel','기본 SOAP','blocks',jsonb_build_array(block)),jsonb_build_object('scopeKey','system:abc','system','unused')-'system'||jsonb_build_object('scope','system','systemId','abc','systemLabel','QA','blocks',jsonb_build_array(jsonb_set(jsonb_set(block,'{props,scope}','"system"'),'{props,systemLabel}','"QA"')))));
 st:=public.clair_get_chart_soap_note_by_id(w,se,s);
 perform public.clair_save_chart_soap_note_v4(w,actor,se,s,jsonb_build_object('blockDocument',origin,'assessment',E'outer\nchild','subjective','','objective','','plan',''),(st->>'updatedAt')::timestamptz,'manual_save');
 src:=pg_temp.qa_get(s);
 assert jsonb_array_length(src->'paragraphs')=4 and src#>>'{paragraphs,3,scope}'='QA' and src#>>'{paragraphs,3,text}'='child';
 st:=public.clair_get_chart_soap_note_by_id(w,de,d);
 perform public.clair_save_chart_soap_note_v4(w,actor,de,d,jsonb_build_object('blockDocument',origin,'assessment',E'outer\nchild','subjective','','objective','','plan',''),(st->>'updatedAt')::timestamptz,'manual_save');
 dest:=pg_temp.qa_get(d);sel:=jsonb_set(base,'{paragraphs}',jsonb_build_array(jsonb_build_object('id',src#>>'{paragraphs,3,id}','replaceId',dest#>>'{paragraphs,0,id}')));
 perform public.clair_advanced_chart_transfer(w,'apply',pg_temp.qa_cmd(src,dest,sel));
 af:=pg_temp.qa_get(d);assert af#>>'{paragraphs,0,text}'='child' and af#>>'{paragraphs,1,text}'='child' and af#>>'{paragraphs,2,text}'='outer';
 raise notice 'PASS nested scope replacement only';
 exception when others then get stacked diagnostics ctx=pg_exception_context;raise exception 'FAIL nested % %',sqlerrm,ctx;end;
 begin
 prior:=pg_temp.qa_get(d);src:=pg_temp.qa_get(s);
 sel:=jsonb_set(jsonb_set(base,'{paragraphs}',jsonb_build_array(jsonb_build_object('id',src#>>'{paragraphs,0,id}'))),'{orders}',jsonb_build_array(jsonb_build_object('id',src#>>'{orders,0,id}','price',1,'duplicate',true)));
 begin perform public.clair_advanced_chart_transfer(w,'apply',pg_temp.qa_cmd(src,prior,sel));exception when others then if sqlerrm='price_changed' then denied:=true;else raise; end if;end;
 assert denied and pg_temp.qa_get(d)=prior;raise notice 'PASS invalid last order rolls back earlier SOAP change';
 exception when others then get stacked diagnostics ctx=pg_exception_context;raise exception 'FAIL atomicity % %',sqlerrm,ctx;end;
end;$t$;

-- Only synthetic object metadata is needed; no storage-object bytes are created.
reset role;
insert into storage.buckets(id,name,public) values('chart-soap-attachments','chart-soap-attachments',false) on conflict (id) do nothing;
insert into storage.objects(bucket_id,name,metadata)
values('chart-soap-attachments','synthetic-advanced-chart-copy-qa/afd26300-0000-4000-8000-000000000002/ready/afd26300-0000-4000-8000-000000000090.png','{"mimetype":"image/png","size":12}');
insert into public.chart_soap_attachments(id,workspace_id,encounter_id,actor_user_id,storage_path,pending_path,mime_type,byte_size,file_name,ready_at)
values('afd26300-0000-4000-8000-000000000090','synthetic-advanced-chart-copy-qa','afd26300-0000-4000-8000-000000000002','afd26000-0000-4000-8000-000000000003',
'synthetic-advanced-chart-copy-qa/afd26300-0000-4000-8000-000000000002/ready/afd26300-0000-4000-8000-000000000090.png',
'synthetic-advanced-chart-copy-qa/afd26300-0000-4000-8000-000000000002/pending/afd26300-0000-4000-8000-000000000090.png','image/png',12,'synthetic.png',now());
set local role authenticated;
do $t$
declare w text:='synthetic-advanced-chart-copy-qa'; actor text:='afd26000-0000-4000-8000-000000000003';other_user text:='afd26000-0000-4000-8000-000000000009'; se uuid:='afd26300-0000-4000-8000-000000000002';de uuid:='afd26300-0000-4000-8000-000000000003';s uuid:='afd26300-0000-4000-8000-000000000005';d uuid:='afd26300-0000-4000-8000-000000000006'; base jsonb:='{"paragraphs":[],"diagnoses":[],"orders":[]}'; src jsonb;dest jsonb;doc jsonb;media jsonb;sel jsonb;rq jsonb;saved jsonb;item jsonb;nowdoc jsonb;prior jsonb;dup boolean; frequency text;changed jsonb;new_target uuid;seen int;after_count int;before_count int;
begin
 select set_config('request.jwt.claim.sub',actor,true) into strict frequency;
 src:=pg_temp.qa_get(s);dest:=pg_temp.qa_get(d);assert dest->>'authorId'=other_user;
 saved:=public.clair_get_chart_soap_note_by_id(w,se,s);
 doc:=saved->'blockDocument';
 media:=jsonb_build_object('id','proof-attachment','type','image','props',jsonb_build_object('backgroundColor','default','textAlignment','left','name','synthetic.png','caption','Example image','showPreview',true,'url','/api/workspaces/'||w||'/chart/soap-attachments/afd26300-0000-4000-8000-000000000090?encounterId='||se::text),'children','[]'::jsonb);
 doc:=jsonb_set(doc,'{scopes,0,blocks,0,children}',doc#>'{scopes,0,blocks,0,children}'||jsonb_build_array(media));
 perform public.clair_save_chart_soap_note_v4(w,actor,se,s,jsonb_build_object('blockDocument',doc,'editorCapability','media_table_v1','assessment',saved->>'assessment','subjective',saved->>'subjective','objective',saved->>'objective','plan',saved->>'plan'),(saved->>'updatedAt')::timestamptz,'manual_save');
 src:=pg_temp.qa_get(s);dest:=pg_temp.qa_get(d);
 assert jsonb_array_length(src->'media')=1 and jsonb_array_length(dest->'media')=0;
 -- The second child is the image. It must never be a selectable paragraph.
 dup:=false;rq:=pg_temp.qa_cmd(src,dest,jsonb_set(base,'{paragraphs}','[{"id":"1.1.2"}]'));
 begin perform public.clair_advanced_chart_transfer(w,'apply',rq); exception when others then if sqlerrm='invalid_selection' then dup:=true;else raise;end if;end;
 assert dup and pg_temp.qa_get(d)=dest;raise notice 'PASS media in detail is excluded from copy selections';
 sel:=jsonb_set(base,'{paragraphs}',jsonb_build_array(jsonb_build_object('id',src#>>'{paragraphs,0,id}')));
 rq:=pg_temp.qa_cmd(src,dest,sel);
 perform public.clair_advanced_chart_transfer(w,'apply',rq);
 changed:=pg_temp.qa_get(d);
 assert changed->>'authorId'=other_user and changed->>'clinicalAt'=dest->>'clinicalAt' and changed->>'version'<>dest->>'version';
 -- Simulate two clients who opened the same target revision, after one committed.
 dup:=false;
 begin perform public.clair_advanced_chart_transfer(w,'apply',rq||jsonb_build_object('requestId',gen_random_uuid())); exception when others then if sqlerrm='revision_conflict' then dup:=true;else raise;end if;end;
 assert dup and pg_temp.qa_get(d)=changed;raise notice 'PASS stale target refused, colleague ownership/existing clinical time preserved';
 before_count:=jsonb_array_length(public.clair_list_encounter_charts(w,de));
 rq:=(pg_temp.qa_cmd(src,changed,sel)-'targetId'-'targetVersion')||jsonb_build_object('newChart',true);
 saved:=public.clair_advanced_chart_transfer(w,'apply',rq);
 new_target:=(saved->>'chartId')::uuid;
 assert new_target<>d and pg_temp.qa_get(new_target)->>'authorId'=actor and pg_temp.qa_get(new_target)->>'encounterId'=de::text;
 assert public.clair_advanced_chart_transfer(w,'apply',rq)=saved;
 assert jsonb_array_length(public.clair_list_encounter_charts(w,de))=before_count+1;
 assert jsonb_array_length(pg_temp.qa_get(new_target)->'media')=0;raise notice 'PASS new chart uses its selected encounter, author and one creation on retry';
 select v into item from jsonb_array_elements(src->'orders') as q(v) where v->>'catalogId'='phase5-med';
 assert item is not null;
 foreach frequency in array array['prn','custom'] loop
  dest:=pg_temp.qa_get(new_target);
  sel:=jsonb_set(base,'{orders}',jsonb_build_array(jsonb_build_object('id',item->>'id','price',item->'price','dose',3,'frequency',frequency,'days',2,'duplicate',true)));
  perform public.clair_advanced_chart_transfer(w,'apply',pg_temp.qa_cmd(src,dest,sel));
  assert exists(select 1 from jsonb_array_elements(pg_temp.qa_get(new_target)->'orders') f where f#>>'{inputs,frequency}'=frequency and f#>>'{inputs,dose}'='3');
 end loop;raise notice 'PASS PRN/custom preserved by unconfirmed prescription drafts';
end;$t$;
do $primary$
declare w constant text:='synthetic-advanced-chart-copy-qa'; actor constant text:='afd26000-0000-4000-8000-000000000003';
  enc constant uuid:='afd26300-0000-4000-8000-000000000003'; dest_id uuid; source_row jsonb; dest_row jsonb; dx jsonb; current_dx jsonb;
begin
  dest_id:=(public.clair_create_encounter_chart(w,actor,enc,gen_random_uuid())->>'id')::uuid;
  current_dx:=public.clair_get_chart_diagnosis_assessments(w,enc,dest_id);
  perform public.clair_save_chart_diagnoses_v2(w,actor,enc,dest_id,'[{"diagnosisText":"existing primary","diagnosisType":"confirmed","isPrimary":true}]',current_dx->>'version');
  source_row:=pg_temp.qa_get('afd26300-0000-4000-8000-000000000005');
  dest_row:=pg_temp.qa_get(dest_id); dx:=source_row#>'{diagnoses,0}';
  perform public.clair_advanced_chart_transfer(w,'apply',pg_temp.qa_cmd(source_row,dest_row,
    jsonb_build_object('paragraphs','[]'::jsonb,'orders','[]'::jsonb,'diagnoses',jsonb_build_array(jsonb_build_object('id',dx->>'id','kind','suspected','primary',true)))));
  assert (select count(*) from jsonb_array_elements(pg_temp.qa_get(dest_id)->'diagnoses') d where (d->>'primary')::boolean)=2;
  raise notice 'PASS explicitly added primary coexists with existing primary';
end $primary$;
reset role;
do $verify$
declare w text:='synthetic-advanced-chart-copy-qa';
begin
 assert not exists(select 1 from public.orders where workspace_id=w and order_confirmation_status not in ('draft','pending'));
 assert not exists(select 1 from public.order_tasks where workspace_id=w);
 assert not exists(select 1 from public.order_fulfillment_work_items where workspace_id=w);
 assert not exists(select 1 from public.order_billing_candidates where workspace_id=w);
 assert not exists(select 1 from public.invoices where workspace_id=w);
 assert (select count(*) from public.chart_soap_attachments where workspace_id=w)=1;
 assert exists(select 1 from private.clair_chart_copy_receipts where actor_id='afd26000-0000-4000-8000-000000000003' and result->>'chartId'='afd26300-0000-4000-8000-000000000006');
 raise notice 'PASS no task, execution, bill, or target attachment created by copying';
end;$verify$;

reset role;
update public.workspace_permission_roles set permissions='{"allowed":["chart:view"]}' where id='afd26200-0000-4000-8000-000000000003';
set local role authenticated;
select set_config('request.jwt.claim.sub','afd26000-0000-4000-8000-000000000003',true);
do $$
declare w text:='synthetic-advanced-chart-copy-qa'; denied boolean:=false; batch jsonb;
begin
batch:=public.clair_advanced_chart_search_batch(w,null,null,true,false);assert jsonb_array_length(batch)>0;
assert public.clair_advanced_chart_search_batch(w,null,null,true,true)='[]';
begin perform public.clair_advanced_chart_transfer(w,'apply','{}');exception when insufficient_privilege then denied:=true;end;
assert denied;raise notice 'PASS view-only role may read, cannot select mutable targets or apply';
end;$$;

reset role;
insert into public.soap_notes(workspace_id,encounter_id,author_user_id,clinical_at,status,subjective)
select 'synthetic-advanced-chart-copy-qa','afd26300-0000-4000-8000-000000000002',
       'afd26000-0000-4000-8000-000000000003','2026-11-18T09:00Z','signed','pagination '||i
from generate_series(1,27) i;
set local role authenticated;
do $recent$
declare w constant text:='synthetic-advanced-chart-copy-qa'; first_page jsonb; last_page jsonb; hist jsonb;
begin
  first_page:=public.clair_advanced_chart_recent(w,null);
  last_page:=public.clair_advanced_chart_recent(w,(first_page->>'nextCursor')::uuid);
  assert (first_page->>'total')::int=27 and jsonb_array_length(first_page->'items')=25;
  assert jsonb_array_length(last_page->'items')=2 and last_page->>'nextCursor' is null;
  assert (select count(distinct row->>'id') from jsonb_array_elements((first_page->'items')||(last_page->'items')) row)=27;
  hist:=public.clair_advanced_chart_copy_history(w,'afd26300-0000-4000-8000-000000000006');
  assert jsonb_array_length(hist)>0 and hist#>>'{0,actor}' is not null;
  raise notice 'PASS recent pages with tied timestamps and authorized copy history';
end $recent$;
rollback;
