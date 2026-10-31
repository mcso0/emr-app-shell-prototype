-- Additional synthetic cases execute inside the existing rollback transaction.
-- Two unassigned items under an untouched set; requester differs from both staff.
insert into orders(id,workspace_id,encounter_id,status,clinical_order_type,destination_module,order_confirmation_status,row_type,parent_chart_order_line_id,requested_by_user_id,sort_order)
select ('12000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'workspace-a','20000000-0000-4000-8000-000000000001','requested','dispensing',
 case when n=1 then null else 'dispensing' end,'confirmed',case when n=1 then 'set' else 'set_child' end,
 case when n=1 then null else '12000000-0000-4000-8000-000000000001'::uuid end,'00000000-0000-4000-8000-000000000003',n
from generate_series(1,3) n;
insert into order_tasks(id,workspace_id,encounter_id,order_id,parent_task_id,task_role,clinical_order_type,destination_module,status,priority,attempt_no,effective_snapshot,execution_result_schema_version)
select ('32000000-0000-4000-8000-'||right(id::text,12))::uuid,workspace_id,encounter_id,id,
 case when row_type='set' then null else '32000000-0000-4000-8000-000000000001'::uuid end,
 case when row_type='set' then 'aggregate' else 'execution' end,'dispensing',destination_module,'pending','normal',1,
 jsonb_build_object('inHospitalOrderName',case when row_type='set' then '원내 합성 세트' else '원내 합성 항목 '||sort_order end,
 'standardOrderName','표준 합성명','calculationOutputs',jsonb_build_object('plannedPracticalTotalQuantity',1,'dispenseUnit','T')),
 case when row_type='set' then 0 else 1 end
from orders where id::text like '12000000%' order by sort_order;
insert into order_fulfillment_work_items(id,workspace_id,order_id,encounter_id,task_id,task_attempt_no,status,queue_type,source_snapshot,requested_by_user_id)
select ('42000000-0000-4000-8000-'||right(order_id::text,12))::uuid,workspace_id,order_id,encounter_id,id,1,'requested','dispensing','{}','00000000-0000-4000-8000-000000000003'
from order_tasks where id::text like '32000000%' and task_role='execution';

-- Blank names fall through to standard names; canonical hospital names win.
update order_tasks set effective_snapshot=jsonb_set(effective_snapshot,'{inHospitalOrderName}','"   "')
 where id='32000000-0000-4000-8000-000000000003';

do $$
declare d jsonb; before_doc jsonb; ctx jsonb; saved jsonb; command uuid:=gen_random_uuid(); event_count bigint; result_count bigint;
 item uuid:='42000000-0000-4000-8000-000000000002'; peer uuid:='42000000-0000-4000-8000-000000000003';
begin
 perform set_config('test.actor','00000000-0000-4000-8000-000000000003',true);
 d:=public.clair_get_fulfillment_instruction('workspace-a',item);
 if d->>'name'<>'원내 합성 세트' or d#>>'{items,0,name}'<>'원내 합성 항목 2' or d#>>'{items,1,name}'<>'표준 합성명' then raise exception 'current snapshot names missing'; end if;
 if not (d->>'canCompleteAll')::boolean or (d->>'canClaim')::boolean then raise exception 'requester capabilities changed'; end if;
 before_doc:=d;
 select count(*) into event_count from order_task_events;
 select count(*) into result_count from order_execution_result_versions;
 ctx:=public.clair_get_order_execution_context('workspace-a',item);
 if ctx->>'status'<>'requested' or not (ctx->>'canRecord')::boolean then raise exception 'requester read capability lost'; end if;
 if public.clair_get_fulfillment_instruction('workspace-a',item) is distinct from before_doc
   or (select count(*) from order_task_events)<>event_count then raise exception 'read mutated instruction'; end if;
 begin
   perform public.clair_mutate_fulfillment_instruction('workspace-a',item,jsonb_build_object('action','start_item','itemId',item,'commandId',gen_random_uuid(),'expectedRevision',d->>'revision'));
   raise exception 'unassigned start allowed';
 exception when insufficient_privilege then null; end;
 begin
   perform public.clair_transition_fulfillment_work_item('workspace-a',auth.uid(),item,'complete',(ctx->>'workItemRevision')::bigint,gen_random_uuid(),null,null,null);
   raise exception 'unscoped direct completion allowed';
 exception when raise_exception then if sqlerrm<>'invalid_transition' then raise; end if; end;
 begin
   perform public.clair_record_order_execution_result('workspace-a',auth.uid(),item,(ctx->>'workItemRevision')::bigint,ctx->>'planSha256',0,gen_random_uuid(),now(),'{}',null,null);
   raise exception 'empty result accepted';
 exception when raise_exception then if sqlerrm<>'invalid_execution_payload' then raise; end if; end;
 begin
   perform public.clair_record_order_execution_result('workspace-a',auth.uid(),item,(ctx->>'workItemRevision')::bigint+1,ctx->>'planSha256',0,gen_random_uuid(),now(),'{"preparedQuantity":1,"preparedUnit":"T"}',null,null);
   raise exception 'stale result revision accepted';
 exception when raise_exception then if sqlerrm<>'revision_conflict' then raise; end if; end;
 begin
   perform public.clair_record_order_execution_result('workspace-a',auth.uid(),item,(ctx->>'workItemRevision')::bigint,repeat('0',64),0,gen_random_uuid(),now(),'{"preparedQuantity":1,"preparedUnit":"T"}',null,null);
   raise exception 'stale plan accepted';
 exception when raise_exception then if sqlerrm<>'plan_revision_conflict' then raise; end if; end;
 perform set_config('test.actor','00000000-0000-4000-8000-000000000002',true);
 begin
   perform public.clair_record_order_execution_result('workspace-a',auth.uid(),item,(ctx->>'workItemRevision')::bigint,ctx->>'planSha256',0,gen_random_uuid(),now(),'{"preparedQuantity":1,"preparedUnit":"T"}',null,null);
   raise exception 'unrelated actor recorded result';
 exception when insufficient_privilege then null; end;
 perform set_config('test.actor','00000000-0000-4000-8000-000000000003',true);
 begin
   perform public.clair_record_order_execution_result('workspace-b',auth.uid(),item,(ctx->>'workItemRevision')::bigint,ctx->>'planSha256',0,gen_random_uuid(),now(),'{"preparedQuantity":1,"preparedUnit":"T"}',null,null);
   raise exception 'foreign workspace result accepted';
 exception when insufficient_privilege then null; end;
 if (select count(*) from order_execution_result_versions)<>result_count or (select count(*) from order_task_events)<>event_count then raise exception 'failed result wrote state'; end if;
 saved:=public.clair_record_order_execution_result('workspace-a',auth.uid(),item,(ctx->>'workItemRevision')::bigint,ctx->>'planSha256',0,command,now(),'{"preparedQuantity":1,"preparedUnit":"T"}',null,null);
 perform public.clair_record_order_execution_result('workspace-a',auth.uid(),item,(ctx->>'workItemRevision')::bigint,ctx->>'planSha256',0,command,now(),'{"preparedQuantity":1,"preparedUnit":"T"}',null,null);
 if saved->>'status'<>'completed' or (select count(*) from order_execution_result_versions)<>result_count+1 then raise exception 'requester completion/retry failed'; end if;
 if exists(select 1 from order_task_events where task_id='32000000-0000-4000-8000-000000000002' and event_type='started')
   or (select assigned_to_user_id from order_fulfillment_work_items where id=item) is not null then raise exception 'save implicitly started or claimed'; end if;
 if (select status from order_tasks where id='32000000-0000-4000-8000-000000000001')<>'partial_complete'
   or (public.clair_get_fulfillment_instruction('workspace-a',item)->>'finalized')::boolean then raise exception 'first child finalized untouched set'; end if;
 if exists(select 1 from private.fulfillment_instruction_completion_scope) then raise exception 'completion scope leaked'; end if;
 -- Legacy main ownership cannot expose a start button for unassigned children.
 perform set_config('test.actor','00000000-0000-4000-8000-000000000001',true);
 insert into private.fulfillment_instruction_state values('workspace-a','32000000-0000-4000-8000-000000000001','dispensing',auth.uid(),false,1);
 d:=public.clair_get_fulfillment_instruction('workspace-a',peer);
 if (d->>'canStart')::boolean then raise exception 'unassigned child start exposed'; end if;
 begin
   perform public.clair_mutate_fulfillment_instruction('workspace-a',peer,jsonb_build_object('action','start','commandId',gen_random_uuid(),'expectedRevision',d->>'revision'));
   raise exception 'group started unassigned child';
 exception when insufficient_privilege then null; end;
 delete from private.fulfillment_instruction_state where root_task_id='32000000-0000-4000-8000-000000000001';
 -- Claim the remaining item, then hand it off. Former owner is not requester.
 perform set_config('test.actor','00000000-0000-4000-8000-000000000001',true);
 d:=public.clair_get_fulfillment_instruction('workspace-a',peer);
 d:=public.clair_mutate_fulfillment_instruction('workspace-a',peer,jsonb_build_object('action','claim','commandId',gen_random_uuid(),'expectedRevision',d->>'revision'));
 if (select status from order_fulfillment_work_items where id=peer)<>'in_progress'
   or (select status from order_fulfillment_work_items where id=item)<>'completed' then raise exception 'claim rewrote completed peer'; end if;
 d:=public.clair_mutate_fulfillment_instruction('workspace-a',peer,jsonb_build_object('action','unassign','commandId',gen_random_uuid(),'expectedRevision',d->>'revision'));
 if (select status from order_fulfillment_work_items where id=peer)<>'paused' then raise exception 'unassign not paused'; end if;
 perform set_config('test.actor','00000000-0000-4000-8000-000000000002',true);
 d:=public.clair_mutate_fulfillment_instruction('workspace-a',peer,jsonb_build_object('action','claim','commandId',gen_random_uuid(),'expectedRevision',d->>'revision'));
 ctx:=public.clair_get_order_execution_context('workspace-a',peer);
 perform set_config('test.actor','00000000-0000-4000-8000-000000000001',true);
 begin
   perform public.clair_record_order_execution_result('workspace-a',auth.uid(),peer,(ctx->>'workItemRevision')::bigint,ctx->>'planSha256',0,gen_random_uuid(),now(),'{"preparedQuantity":1,"preparedUnit":"T"}',null,null);
   raise exception 'previous owner retained write';
 exception when insufficient_privilege then null; end;
 perform set_config('test.actor','00000000-0000-4000-8000-000000000002',true);
 d:=public.clair_mutate_fulfillment_instruction('workspace-a',peer,jsonb_build_object('action','unassign','commandId',gen_random_uuid(),'expectedRevision',d->>'revision'));
 perform set_config('test.actor','00000000-0000-4000-8000-000000000003',true);
 ctx:=public.clair_get_order_execution_context('workspace-a',peer);
 perform public.clair_record_order_execution_result('workspace-a',auth.uid(),peer,(ctx->>'workItemRevision')::bigint,ctx->>'planSha256',0,gen_random_uuid(),now(),'{"preparedQuantity":1,"preparedUnit":"T"}',null,null);
 d:=public.clair_get_fulfillment_instruction('workspace-a',peer);
 if (d->>'finalized')::boolean then raise exception 'all results implicitly finalized set'; end if;
 d:=public.clair_mutate_fulfillment_instruction('workspace-a',peer,jsonb_build_object('action','complete_all','commandId',gen_random_uuid(),'expectedRevision',d->>'revision'));
 if not (d->>'finalized')::boolean then raise exception 'requester cannot finalize set'; end if;
 raise notice 'PASS: current names, read purity, requester requested/paused result completion, rollback on invalid input, old-owner denial, explicit set finalization';
end $$;
