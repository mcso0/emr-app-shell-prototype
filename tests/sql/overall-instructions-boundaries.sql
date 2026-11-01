-- Focused real writer/ACL assertions. Dependencies are the runner's synthetic schema.
do $$
declare chart uuid:='51000000-0000-4000-8000-000000000001'; d jsonb; n bigint; command uuid;
begin
 perform set_config('test.actor','00000000-0000-4000-8000-000000000003',true);
 select count(*) into n from notification_events;
 perform public.clair_apply_overall_instructions('workspace-a',chart,jsonb_build_object('commandId',gen_random_uuid(),'changes','[{"scope":"overall","expectedRevision":0,"operation":"delete"}]'::jsonb));
 if (select count(*) from notification_events)<>n or exists(select 1 from private.chart_instruction_revisions where chart_id=chart and scope='overall') then raise exception 'no-op produced clinical history or notification'; end if;
 begin
  perform public.clair_apply_overall_instructions('workspace-a',chart,jsonb_build_object('commandId',gen_random_uuid(),'changes',jsonb_build_array(jsonb_build_object('scope','overall','expectedRevision',0,'operation','set','instruction',repeat('😀',2501)))));
  raise exception 'UTF16 limit bypassed';
 exception when raise_exception then if sqlerrm<>'invalid_input' then raise; end if; end;
 if private.clair_instruction_has_text(E' \n\t'||chr(12288)||chr(160)) then raise exception 'blank text considered clinical content'; end if;
 if private.clair_instruction_text_length(repeat('😀',2500))<>5000 then raise exception 'UTF16 boundary incorrect'; end if;
 -- Route to the actual lab selection key, with a distinct active recipient.
 update order_fulfillment_work_items set due_at='2026-10-30T18:00:00Z',assigned_to_user_id='00000000-0000-4000-8000-000000000002' where id='54000000-0000-4000-8000-000000000003';
 command:=gen_random_uuid();
 perform public.clair_apply_overall_instructions('workspace-a',chart,jsonb_build_object('commandId',command,'changes','[{"scope":"overall","expectedRevision":0,"operation":"set","instruction":"Global boundary fixture"}]'::jsonb));
 if not exists(select 1 from notification_events where dedupe_key like '%'||command||'%' and recipient_id='00000000-0000-4000-8000-000000000002' and source_route like '%date=2026-10-31&%' and source_route like '%&labResultId=live-lab-54000000-0000-4000-8000-000000000003') then raise exception 'lab notification navigation wrong'; end if;
 select count(*) into n from private.chart_instruction_acknowledgements;
 perform public.clair_get_task_instruction_review('workspace-a','53000000-0000-4000-8000-000000000003');
 if (select count(*) from private.chart_instruction_acknowledgements)<>n then raise exception 'read acknowledged'; end if;
 perform set_config('test.actor','',true);
 begin perform public.clair_get_task_instruction_review('workspace-a','53000000-0000-4000-8000-000000000003'); raise exception 'unauthenticated read'; exception when insufficient_privilege then null; end;
 perform set_config('test.actor','00000000-0000-4000-8000-000000000099',true);
 begin perform public.clair_get_overall_instructions('workspace-a',chart); raise exception 'permissionless chart read'; exception when insufficient_privilege then null; end;
 if has_table_privilege('authenticated','private.chart_instruction_acknowledgements','INSERT')
 or has_table_privilege('authenticated','private.chart_instruction_revisions','UPDATE')
 or has_function_privilege('authenticated','private.clair_require_task_instruction_ack(text,uuid,uuid)','EXECUTE')
 or has_function_privilege('anon','public.clair_acknowledge_task_instructions(text,uuid,text)','EXECUTE') then raise exception 'private boundary exposed'; end if;
end $$;

select set_config('test.actor','00000000-0000-4000-8000-000000000003',true);
insert into soap_notes values('61000000-0000-4000-8000-000000000001','workspace-a','20000000-0000-4000-8000-000000000001','draft');
insert into orders(id,workspace_id,encounter_id,origin_chart_id,status,clinical_order_type,destination_module,order_confirmation_status,row_type,requested_by_user_id,sort_order)
select ('62000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'workspace-a','20000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000001',
 'requested',case when n=1 then 'dispensing' else 'consultation' end,case when n=1 then 'dispensing' end,'confirmed','single','00000000-0000-4000-8000-000000000003',n
from generate_series(1,3) n;
insert into order_tasks(id,workspace_id,encounter_id,order_id,task_role,clinical_order_type,destination_module,status,priority,attempt_no,effective_snapshot,execution_result_schema_version,created_at)
select ('63000000-0000-4000-8000-'||right(id::text,12))::uuid,workspace_id,encounter_id,id,'execution',clinical_order_type,destination_module,'pending','normal',1,
 case when clinical_order_type='dispensing' then '{"calculationOutputs":{"plannedPracticalTotalQuantity":1,"dispenseUnit":"T"}}'::jsonb else '{"detailSchemaVersion":2}'::jsonb end,1,now()-interval '1 minute'
from orders where id::text like '62000000%' and sort_order<3;
insert into order_fulfillment_work_items(id,workspace_id,order_id,encounter_id,task_id,task_attempt_no,status,queue_type,clinical_order_type,destination_module,source_snapshot,requested_by_user_id,assigned_to_user_id)
values('64000000-0000-4000-8000-000000000001','workspace-a','62000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','63000000-0000-4000-8000-000000000001',1,'requested','dispensing','dispensing','dispensing','{}','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000001');

do $$
declare chart uuid:='61000000-0000-4000-8000-000000000001'; task uuid:='63000000-0000-4000-8000-000000000001';
 actual uuid:='63000000-0000-4000-8000-000000000002'; wi uuid:='64000000-0000-4000-8000-000000000001';
 immediate uuid:='62000000-0000-4000-8000-000000000003'; d jsonb; plan text; rev bigint; command uuid; result_id uuid; n bigint;
begin
 perform set_config('test.actor','00000000-0000-4000-8000-000000000003',true);
 perform public.clair_apply_overall_instructions('workspace-a',chart,jsonb_build_object('commandId',gen_random_uuid(),'changes','[{"scope":"overall","expectedRevision":0,"operation":"set","instruction":"Confirm before performing"}]'::jsonb));
 select encode(extensions.digest(effective_snapshot::text,'sha256'),'hex') into plan from order_tasks where id=actual;
 command:=gen_random_uuid();
 begin
  perform public.clair_record_chart_actual_result('workspace-a',auth.uid(),actual,plan,command,now(),'{"performedActivity":"synthetic","outcome":"synthetic"}',true);
  raise exception 'chart result skipped review';
 exception when raise_exception then if sqlerrm<>'instruction_ack_required' then raise; end if; end;
 if exists(select 1 from order_execution_result_versions where task_id=actual) or (select status from order_tasks where id=actual)<>'pending' then raise exception 'rejected chart result changed state'; end if;
 d:=public.clair_get_task_instruction_review('workspace-a',actual);
 perform public.clair_acknowledge_task_instructions('workspace-a',actual,d#>>'{current,versionKey}');
 if (public.clair_get_task_instruction_review('workspace-a',task)->>'requiresAcknowledgement')::boolean then raise exception 'same overall-only instruction was not reused across categories'; end if;
 perform public.clair_record_chart_actual_result('workspace-a',auth.uid(),actual,plan,command,now(),'{"performedActivity":"synthetic","outcome":"synthetic"}',true);
 perform public.clair_record_chart_actual_result('workspace-a',auth.uid(),actual,plan,command,now(),'{"performedActivity":"synthetic","outcome":"synthetic"}',true);
 if (select count(*) from order_execution_result_versions where task_id=actual)<>1 or (select count(*) from private.task_instruction_snapshots where task_id=actual and phase='completed')<>1 then raise exception 'chart completion replay duplicated evidence'; end if;
 -- A different category's vector does not inherit the consultation review.
 perform set_config('test.actor','00000000-0000-4000-8000-000000000001',true);
 d:=public.clair_get_task_instruction_review('workspace-a',task);
 perform public.clair_acknowledge_task_instructions('workspace-a',task,d#>>'{current,versionKey}');
 perform public.clair_transition_fulfillment_work_item('workspace-a',auth.uid(),wi,'start',(select row_revision from order_fulfillment_work_items where id=wi),gen_random_uuid(),null,null,null);
 perform set_config('test.actor','00000000-0000-4000-8000-000000000003',true);
 perform public.clair_apply_overall_instructions('workspace-a',chart,jsonb_build_object('commandId',gen_random_uuid(),'changes','[{"scope":"overall","expectedRevision":1,"operation":"set","instruction":"Changed while performing"}]'::jsonb));
 select encode(extensions.digest(effective_snapshot::text,'sha256'),'hex') into plan from order_tasks where id=task;
 select row_revision into rev from order_fulfillment_work_items where id=wi;
 command:=gen_random_uuid();
 begin
  perform public.clair_record_order_execution_result('workspace-a',auth.uid(),wi,rev,plan,0,command,now(),'{"preparedQuantity":1,"preparedUnit":"T"}',null,null);
  raise exception 'requester direct result skipped review';
 exception when raise_exception then if sqlerrm<>'instruction_ack_required' then raise; end if; end;
 if exists(select 1 from order_execution_result_versions where task_id=task) or (select status from order_tasks where id=task)<>'in_progress' then raise exception 'rejected result changed state'; end if;
 d:=public.clair_get_task_instruction_review('workspace-a',task);
 perform public.clair_acknowledge_task_instructions('workspace-a',task,d#>>'{current,versionKey}');
 perform public.clair_record_order_execution_result('workspace-a',auth.uid(),wi,rev,plan,0,command,now(),'{"preparedQuantity":1,"preparedUnit":"T"}',null,null);
 perform public.clair_record_order_execution_result('workspace-a',auth.uid(),wi,rev,plan,0,command,now(),'{"preparedQuantity":1,"preparedUnit":"T"}',null,null);
 if (select count(*) from order_execution_result_versions where task_id=task)<>1 then raise exception 'direct completion/replay failed'; end if;
 -- Immediate INSERT is checked atomically for an actor who has not reviewed.
 perform set_config('test.actor','00000000-0000-4000-8000-000000000002',true);
 begin
  insert into order_tasks(id,workspace_id,encounter_id,order_id,task_role,clinical_order_type,status,attempt_no,priority,effective_snapshot,started_at,started_by_user_id,completed_at)
  values('63000000-0000-4000-8000-000000000003','workspace-a','20000000-0000-4000-8000-000000000001',immediate,'execution','consultation','complete',1,'normal','{}',now(),auth.uid(),now());
  raise exception 'immediate completion skipped review';
 exception when raise_exception then if sqlerrm<>'instruction_ack_required' then raise; end if; end;
 if exists(select 1 from order_tasks where order_id=immediate) then raise exception 'rejected immediate task persisted'; end if;
 d:=public.clair_get_order_instruction_review('workspace-a',immediate);
 perform public.clair_acknowledge_order_instructions('workspace-a',immediate,d#>>'{current,versionKey}');
 insert into order_tasks(id,workspace_id,encounter_id,order_id,task_role,clinical_order_type,status,attempt_no,priority,effective_snapshot,started_at,started_by_user_id,completed_at)
 values('63000000-0000-4000-8000-000000000003','workspace-a','20000000-0000-4000-8000-000000000001',immediate,'execution','consultation','complete',1,'normal','{}',now(),auth.uid(),now());
 if (select count(*) from private.task_instruction_snapshots where task_id='63000000-0000-4000-8000-000000000003')<>2 then raise exception 'immediate snapshots incomplete'; end if;
 raise notice 'PASS: direct result writers, requester authority, immediate completion review, atomic rollback and replay';
end $$;

-- Historical attempts remain queryable after re-request; old attempts cannot ack.
insert into order_tasks(id,workspace_id,encounter_id,order_id,task_role,clinical_order_type,destination_module,status,priority,attempt_no,re_requested_from_task_id,effective_snapshot)
values('63000000-0000-4000-8000-000000000004','workspace-a','20000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000001','execution','dispensing','dispensing','pending','normal',2,'63000000-0000-4000-8000-000000000001','{}');
do $$
declare d jsonb;
begin
 d:=public.clair_get_task_instruction_review('workspace-a','63000000-0000-4000-8000-000000000001');
 if (d->>'requiresAcknowledgement')::boolean or jsonb_array_length(d->'snapshots')<>3
 or not exists(select 1 from jsonb_array_elements(d->'snapshots') s where s->>'attemptNo'='2' and s->>'taskId'='63000000-0000-4000-8000-000000000004') then raise exception 'attempt history inaccessible'; end if;
 begin
  perform public.clair_acknowledge_task_instructions('workspace-a','63000000-0000-4000-8000-000000000001',d#>>'{current,versionKey}');
  raise exception 'old attempt acknowledged';
 exception when raise_exception then if sqlerrm<>'task_unavailable' then raise; end if; end;
 update soap_notes set status='signed' where id='61000000-0000-4000-8000-000000000001';
 if public.clair_get_overall_instructions('workspace-a','61000000-0000-4000-8000-000000000001')->>'readOnlyReason'<>'signed_chart_read_only' then raise exception 'signed chart editable'; end if;
end $$;

-- Frozen old PO snapshots remain readable in the new task review.
insert into private.task_oral_instruction_snapshots(workspace_id,task_id,phase,chart_id,revision,instruction,captured_at)
values('workspace-a','53000000-0000-4000-8000-000000000001','requested','51000000-0000-4000-8000-000000000001',1,'legacy PO only','2026-10-31T03:00:00Z');
do $$
declare d jsonb;
begin
 d:=public.clair_get_task_instruction_review('workspace-a','53000000-0000-4000-8000-000000000001');
 if not exists(select 1 from jsonb_array_elements(d->'snapshots') s where s->>'legacy'='true'
  and s#>>'{document,entries,0,instruction}'='legacy PO only' and s#>>'{document,entries,0,legacy}'='true') then raise exception 'old PO snapshot hidden or relabeled'; end if;
 if (select count(*) from private.task_oral_instruction_snapshots)<>1 then raise exception 'new task transitions wrote obsolete PO snapshots'; end if;
end $$;

set local role authenticated;
do $$ begin
 perform public.clair_get_task_instruction_review('workspace-a','63000000-0000-4000-8000-000000000004');
 begin
  perform 1 from private.chart_instruction_acknowledgements;
  raise exception 'authenticated can directly read private acknowledgements';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
 begin
  perform public.clair_get_task_instruction_review('workspace-a','63000000-0000-4000-8000-000000000004');
  raise exception 'anonymous can execute guarded review';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
