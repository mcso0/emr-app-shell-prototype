-- Synthetic requested set, with a distinct requester. All assertions roll back.
insert into orders(id,workspace_id,encounter_id,status,clinical_order_type,destination_module,order_confirmation_status,row_type,parent_chart_order_line_id,requested_by_user_id,sort_order)
select ('16000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'workspace-a','20000000-0000-4000-8000-000000000001','requested','dispensing',
 case when n=1 then null else 'dispensing' end,'confirmed',case when n=1 then 'set' else 'set_child' end,
 case when n=1 then null else '16000000-0000-4000-8000-000000000001'::uuid end,'00000000-0000-4000-8000-000000000003',n
from generate_series(1,3) n;
insert into order_tasks(id,workspace_id,encounter_id,order_id,parent_task_id,task_role,clinical_order_type,destination_module,status,priority,attempt_no,effective_snapshot,execution_result_schema_version)
select ('36000000-0000-4000-8000-'||right(id::text,12))::uuid,workspace_id,encounter_id,id,
 case when row_type='set' then null else '36000000-0000-4000-8000-000000000001'::uuid end,
 case when row_type='set' then 'aggregate' else 'execution' end,'dispensing',destination_module,'pending','normal',1,
 '{"orderDisplayName":"합성 담당 변경"}',0 from orders where id::text like '16000000%' order by sort_order;
insert into order_fulfillment_work_items(id,workspace_id,order_id,encounter_id,task_id,task_attempt_no,status,queue_type,source_snapshot,requested_by_user_id)
select ('46000000-0000-4000-8000-'||right(order_id::text,12))::uuid,workspace_id,order_id,encounter_id,id,1,'requested','dispensing','{}','00000000-0000-4000-8000-000000000003'
from order_tasks where id::text like '36000000%' and task_role='execution';

do $$
declare d jsonb; cmd jsonb; old_doc jsonb; notes bigint; events bigint;
 item uuid:='46000000-0000-4000-8000-000000000002'; root uuid:='36000000-0000-4000-8000-000000000001';
begin
 perform set_config('test.actor','00000000-0000-4000-8000-000000000001',true);
 d:=public.clair_get_fulfillment_instruction('workspace-a',item);
 if (d->>'canTakeover')::boolean then raise exception 'unassigned takeover'; end if;
 d:=public.clair_mutate_fulfillment_instruction('workspace-a',item,jsonb_build_object('action','claim','commandId',gen_random_uuid(),'expectedRevision',d->>'revision'));
 if exists(select 1 from order_tasks where (id=root or parent_task_id=root) and (status<>'pending' or started_at is not null)) then raise exception 'claim started task'; end if;
 if not (d->>'canStart')::boolean or (d->>'canTakeover')::boolean then raise exception 'owner start capability'; end if;
 old_doc:=d;
 perform set_config('test.actor','00000000-0000-4000-8000-000000000002',true);
 d:=public.clair_get_fulfillment_instruction('workspace-a',item);
 if not (d->>'canTakeover')::boolean or (d->>'canStart')::boolean then raise exception 'nonowner capability'; end if;
 cmd:=jsonb_build_object('action','takeover','commandId',gen_random_uuid(),'expectedRevision',d->>'revision','reason','업무 인계');
 select count(*) into notes from notification_events;
 select count(*) into events from order_task_events;
 begin perform public.clair_mutate_fulfillment_instruction('workspace-a',item,cmd-'reason'); raise exception 'missing reason accepted'; exception when raise_exception then if sqlerrm<>'invalid_transition' then raise; end if; end;
 begin perform public.clair_mutate_fulfillment_instruction('workspace-a',item,jsonb_set(cmd,'{reason}','"  "')); raise exception 'blank reason accepted'; exception when raise_exception then if sqlerrm<>'invalid_transition' then raise; end if; end;
 begin perform public.clair_mutate_fulfillment_instruction('workspace-a',item,jsonb_set(cmd,'{expectedRevision}','"stale"')); raise exception 'stale takeover accepted'; exception when raise_exception then if sqlerrm<>'revision_conflict' then raise; end if; end;
 if (select count(*) from notification_events)<>notes or (select count(*) from order_task_events)<>events then raise exception 'failed command side effects'; end if;
 d:=public.clair_mutate_fulfillment_instruction('workspace-a',item,cmd);
 if d->>'mainAssigneeId'<>auth.uid()::text or not (d->>'canStart')::boolean then raise exception 'takeover owner'; end if;
 if exists(select 1 from order_tasks where (id=root or parent_task_id=root) and (status<>'pending' or started_at is not null or assigned_to_user_id is distinct from auth.uid())) then raise exception 'takeover execution side effect'; end if;
 if (select count(*) from notification_events where source_payload->>'rootTaskId'=root::text and recipient_id='00000000-0000-4000-8000-000000000003' and source_payload->>'reason'='업무 인계' and source_payload->>'queueType'='dispensing')<>1 then raise exception 'requester notification missing'; end if;
 if (select count(*) from order_task_events where after_values->>'commandId'=cmd->>'commandId' and reason='업무 인계' and event_type='handed_off')<>3 then raise exception 'reason audit missing'; end if;
 select count(*) into notes from notification_events; select count(*) into events from order_task_events;
 perform public.clair_mutate_fulfillment_instruction('workspace-a',item,cmd);
 if (select count(*) from notification_events)<>notes or (select count(*) from order_task_events)<>events then raise exception 'replay duplicated side effects'; end if;
 begin perform public.clair_mutate_fulfillment_instruction('workspace-a',item,jsonb_set(cmd,'{reason}','"다른 사유"')); raise exception 'changed replay accepted'; exception when raise_exception then if sqlerrm<>'idempotency_conflict' then raise; end if; end;
 begin perform public.clair_mutate_fulfillment_instruction('workspace-a',item,cmd||jsonb_build_object('commandId',gen_random_uuid(),'expectedRevision',d->>'revision')); raise exception 'self takeover'; exception when insufficient_privilege then null; end;
 perform set_config('test.actor','00000000-0000-4000-8000-000000000001',true);
 d:=public.clair_get_fulfillment_instruction('workspace-a',item);
 if (d->>'canStart')::boolean or (d->>'canCompleteAll')::boolean then raise exception 'old owner retained execution rights'; end if;
 begin perform public.clair_mutate_fulfillment_instruction('workspace-a',item,jsonb_build_object('action','start','commandId',gen_random_uuid(),'expectedRevision',d->>'revision')); raise exception 'old owner started'; exception when insufficient_privilege then null; end;
 perform set_config('test.actor','00000000-0000-4000-8000-000000000003',true);
 d:=public.clair_get_fulfillment_instruction('workspace-a',item);
 if not (d->>'canCompleteAll')::boolean or (d->>'canTakeover')::boolean then raise exception 'requester boundary'; end if;
 begin perform public.clair_mutate_fulfillment_instruction('workspace-a',item,cmd||jsonb_build_object('commandId',gen_random_uuid(),'expectedRevision',d->>'revision')); raise exception 'requester without queue permission took over'; exception when insufficient_privilege then null; end;
 perform set_config('test.actor','00000000-0000-4000-8000-000000000002',true);
 d:=public.clair_get_fulfillment_instruction('workspace-a',item);
 d:=public.clair_mutate_fulfillment_instruction('workspace-a',item,jsonb_build_object('action','start','commandId',gen_random_uuid(),'expectedRevision',d->>'revision'));
 if exists(select 1 from order_tasks where (id=root or parent_task_id=root) and (status<>'in_progress' or started_at is null)) then raise exception 'explicit start failed'; end if;
 perform set_config('test.actor','00000000-0000-4000-8000-000000000001',true);
 d:=public.clair_get_fulfillment_instruction('workspace-a',item);
 if (d->>'canTakeover')::boolean then raise exception 'started takeover'; end if;
 begin perform public.clair_mutate_fulfillment_instruction('workspace-a',item,cmd||jsonb_build_object('commandId',gen_random_uuid(),'expectedRevision',d->>'revision')); raise exception 'started takeover accepted'; exception when insufficient_privilege then null; end;
end $$;

-- Mixed destination queues keep independent main ownership and notifications.
insert into orders(id,workspace_id,encounter_id,status,clinical_order_type,destination_module,order_confirmation_status,row_type,parent_chart_order_line_id,requested_by_user_id,sort_order)
select ('17000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'workspace-a','20000000-0000-4000-8000-000000000001','requested',case when n=4 then 'treatment' else 'dispensing' end,
 case when n=1 then null when n=4 then 'treatment' else 'dispensing' end,'confirmed',case when n=1 then 'set' else 'set_child' end,
 case when n=1 then null else '17000000-0000-4000-8000-000000000001'::uuid end,'00000000-0000-4000-8000-000000000003',n
from generate_series(1,4) n;
insert into order_tasks(id,workspace_id,encounter_id,order_id,parent_task_id,task_role,clinical_order_type,destination_module,status,priority,attempt_no,effective_snapshot,execution_result_schema_version)
select ('37000000-0000-4000-8000-'||right(id::text,12))::uuid,workspace_id,encounter_id,id,
 case when row_type='set' then null else '37000000-0000-4000-8000-000000000001'::uuid end,
 case when row_type='set' then 'aggregate' else 'execution' end,clinical_order_type,destination_module,'pending','normal',1,
 '{"orderDisplayName":"합성 혼합 세트"}',0 from orders where id::text like '17000000%' order by sort_order;
insert into order_fulfillment_work_items(id,workspace_id,order_id,encounter_id,task_id,task_attempt_no,status,queue_type,source_snapshot,requested_by_user_id)
select ('47000000-0000-4000-8000-'||right(order_id::text,12))::uuid,workspace_id,order_id,encounter_id,id,1,'requested',destination_module,'{}','00000000-0000-4000-8000-000000000003'
from order_tasks where id::text like '37000000%' and task_role='execution';
do $$
declare d jsonb; other jsonb; other_before jsonb; cmd jsonb; n bigint;
 item uuid:='47000000-0000-4000-8000-000000000002'; treatment uuid:='47000000-0000-4000-8000-000000000004';
begin
 perform set_config('test.actor','00000000-0000-4000-8000-000000000001',true);
 other_before:=public.clair_get_fulfillment_instruction('workspace-a',treatment);
 d:=public.clair_get_fulfillment_instruction('workspace-a',item);
 select count(*) into n from notification_events where work_type_label='처치';
 d:=public.clair_mutate_fulfillment_instruction('workspace-a',item,jsonb_build_object('action','claim','commandId',gen_random_uuid(),'expectedRevision',d->>'revision'));
 other:=public.clair_get_fulfillment_instruction('workspace-a',treatment);
 if (other-'revision') is distinct from (other_before-'revision') or (select count(*) from notification_events where work_type_label='처치')<>n then raise exception 'claim changed another queue'; end if;
 perform set_config('test.actor','00000000-0000-4000-8000-000000000002',true);
 d:=public.clair_get_fulfillment_instruction('workspace-a',item);
 cmd:=jsonb_build_object('action','takeover','commandId',gen_random_uuid(),'expectedRevision',d->>'revision','reason',repeat('합',1000));
 d:=public.clair_mutate_fulfillment_instruction('workspace-a',item,cmd);
 if not exists(select 1 from notification_events where source_payload->>'commandId'=cmd->>'commandId' and source_payload->>'reason'=repeat('합',1000) and length(detail)<=1000) then raise exception 'max reason notification'; end if;
 if not exists(select 1 from order_task_events where after_values->>'commandId'=cmd->>'commandId' and reason=repeat('합',1000)) then raise exception 'max reason audit'; end if;
 other:=public.clair_get_fulfillment_instruction('workspace-a',treatment);
 if other->>'mainAssigneeId' is not null or other->'items' is distinct from other_before->'items' or (select count(*) from notification_events where work_type_label='처치')<>n then raise exception 'takeover changed another queue'; end if;
 begin perform public.clair_mutate_fulfillment_instruction('workspace-b',item,cmd); raise exception 'foreign workspace takeover'; exception when insufficient_privilege then null; end;
 perform set_config('test.actor','00000000-0000-4000-8000-000000000099',true);
 begin perform public.clair_mutate_fulfillment_instruction('workspace-a',item,cmd); raise exception 'permissionless takeover'; exception when insufficient_privilege then null; end;
 update user_memberships set status='inactive' where workspace_id='workspace-a' and user_id='00000000-0000-4000-8000-000000000003';
 perform set_config('test.actor','00000000-0000-4000-8000-000000000001',true);
 d:=public.clair_get_fulfillment_instruction('workspace-a',item);
 cmd:=jsonb_build_object('action','takeover','commandId',gen_random_uuid(),'expectedRevision',d->>'revision','reason','담당 복귀');
 perform public.clair_mutate_fulfillment_instruction('workspace-a',item,cmd);
 if exists(select 1 from notification_events where source_payload->>'commandId'=cmd->>'commandId' and recipient_id='00000000-0000-4000-8000-000000000003') then raise exception 'inactive recipient notified'; end if;
 update user_memberships set status='active' where workspace_id='workspace-a' and user_id='00000000-0000-4000-8000-000000000003';
 raise notice 'PASS: prework ownership, reason/replay/denial, max reason, requester notification and mixed queue isolation';
end $$;
