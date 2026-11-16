-- Real list/save RPC and confirmation assignment trigger on synthetic scoped tables.
-- Task/work-item insertion follows canonical ordering, not the full chart confirmation RPC.
create trigger prework_intended_assignment before insert on public.order_fulfillment_work_items
for each row execute function private.clair_apply_intended_assignee_on_confirmation();
insert into orders(id,workspace_id,encounter_id,status,clinical_order_type,destination_module,order_confirmation_status,row_type,parent_chart_order_line_id,requested_by_user_id,instruction,sort_order,updated_at)
select ('19000000-0000-4000-8000-'||right(id::text,12))::uuid,workspace_id,encounter_id,'draft',clinical_order_type,
case when sort_order=2 then 'treatment' else destination_module end,'draft',row_type,
case when row_type='set_child' then '19000000-0000-4000-8000-000000000001'::uuid end,
'00000000-0000-4000-8000-000000000003','',sort_order,'2026-11-02T01:00:00Z'
from orders where id in ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003') order by sort_order;
do $$
declare root uuid:='19000000-0000-4000-8000-000000000001'; owner uuid:='00000000-0000-4000-8000-000000000001'; requester uuid:='00000000-0000-4000-8000-000000000003'; d jsonb; prior timestamptz:='2026-11-02T01:00:00Z';
begin
 perform set_config('test.actor',requester::text,true);
 begin perform public.clair_save_order_intended_assignee('workspace-a',requester,'19000000-0000-4000-8000-000000000002',prior,owner,'child-request-owner'); raise exception 'child assignment allowed'; exception when raise_exception then if sqlerrm<>'order_unavailable' then raise; end if; end;
 d:=public.clair_list_order_intended_assignees('workspace-a',root);
 if jsonb_array_length(d)<>2 then raise exception 'set eligibility list'; end if;
 begin perform public.clair_save_order_intended_assignee('workspace-a',owner,root,prior,owner,'wrong-actor'); raise exception 'actor allowed'; exception when insufficient_privilege then null; end;
 begin perform public.clair_list_order_intended_assignees('workspace-b',root); raise exception 'workspace allowed'; exception when insufficient_privilege then null; end;
 begin perform public.clair_save_order_intended_assignee('workspace-a',requester,root,prior,requester,'wrong-recipient'); raise exception 'recipient allowed'; exception when insufficient_privilege then null; end;
 d:=public.clair_save_order_intended_assignee('workspace-a',requester,root,prior,owner,'set-owner-command');
 if public.clair_save_order_intended_assignee('workspace-a',requester,root,prior,owner,'set-owner-command')<>d then raise exception 'assignment replay'; end if;
 begin perform public.clair_save_order_intended_assignee('workspace-a',requester,root,prior,owner,'stale-command'); raise exception 'stale allowed'; exception when raise_exception then if sqlerrm<>'revision_conflict' then raise; end if; end;
 if not exists(select 1 from audit_events where target_id=root::text and after_snapshot->>'intendedAssigneeUserId'=owner::text) then raise exception 'assignment audit'; end if;
end $$;
-- A legacy child draft owner cannot override the single set request owner.
update orders set current_assignee_user_id='00000000-0000-4000-8000-000000000002' where id='19000000-0000-4000-8000-000000000003';
update orders set status='requested',order_confirmation_status='confirmed' where id::text like '19000000%';
insert into order_tasks(id,workspace_id,encounter_id,order_id,parent_task_id,task_role,clinical_order_type,destination_module,status,priority,attempt_no,effective_snapshot)
select ('39000000-0000-4000-8000-'||right(id::text,12))::uuid,workspace_id,encounter_id,id,
case when row_type='set_child' then '39000000-0000-4000-8000-000000000001'::uuid else null end,
case when row_type='set' then 'aggregate' else 'execution' end,clinical_order_type,destination_module,'pending','normal',1,'{"displayName":"Synthetic designated set"}'
from orders where id::text like '19000000%' order by sort_order;
-- Ineligible recipient at confirmation rolls back all trigger effects.
do $$ begin
 update orders set current_assignee_user_id='00000000-0000-4000-8000-000000000003' where id='19000000-0000-4000-8000-000000000001';
 begin
 insert into order_fulfillment_work_items(id,workspace_id,order_id,encounter_id,task_id,task_attempt_no,status,queue_type,source_snapshot,requested_by_user_id)
 select ('49000000-0000-4000-8000-'||right(order_id::text,12))::uuid,workspace_id,order_id,encounter_id,id,1,'requested',destination_module,'{}','00000000-0000-4000-8000-000000000003'
 from order_tasks where id::text like '39000000%' and task_role='execution';
 raise exception 'ineligible confirmation accepted';
 exception when insufficient_privilege then null; end;
 if exists(select 1 from private.fulfillment_instruction_state where root_task_id='39000000-0000-4000-8000-000000000001') then raise exception 'failed confirmation effects'; end if;
 update orders set current_assignee_user_id='00000000-0000-4000-8000-000000000001' where id='19000000-0000-4000-8000-000000000001';
end $$;
insert into order_fulfillment_work_items(id,workspace_id,order_id,encounter_id,task_id,task_attempt_no,status,queue_type,source_snapshot,requested_by_user_id)
select ('49000000-0000-4000-8000-'||right(order_id::text,12))::uuid,workspace_id,order_id,encounter_id,id,1,'requested',destination_module,'{}','00000000-0000-4000-8000-000000000003'
from order_tasks where id::text like '39000000%' and task_role='execution';
do $$ declare d jsonb; item uuid:='49000000-0000-4000-8000-000000000002'; begin
 if (select count(*) from private.fulfillment_instruction_state where root_task_id='39000000-0000-4000-8000-000000000001' and main_assignee_id='00000000-0000-4000-8000-000000000001')<>2 then raise exception 'per queue main missing'; end if;
 if exists(select 1 from order_fulfillment_work_items where id::text like '49000000%' and (status<>'requested' or started_at is not null or assigned_by_user_id<>'00000000-0000-4000-8000-000000000003' or assigned_at is null)) then raise exception 'confirmation started work or metadata missing: %',(select jsonb_agg(to_jsonb(w)) from order_fulfillment_work_items w where id::text like '49000000%'); end if;
 if (select assigned_to_user_id from order_fulfillment_work_items where id=item)<>'00000000-0000-4000-8000-000000000001' or (select assigned_to_user_id from order_fulfillment_work_items where id='49000000-0000-4000-8000-000000000003')<>'00000000-0000-4000-8000-000000000001' then raise exception 'executor inheritance'; end if;
 perform set_config('test.actor','00000000-0000-4000-8000-000000000001',true);
 d:=public.clair_get_fulfillment_instruction('workspace-a',item);
 if not (d->>'canStart')::boolean or (d->>'canClaim')::boolean then raise exception 'designated capability'; end if;
 perform public.clair_mutate_fulfillment_instruction('workspace-a',item,jsonb_build_object('action','start','commandId',gen_random_uuid(),'expectedRevision',d->>'revision'));
 if (select status from order_fulfillment_work_items where id=item)<>'in_progress' then raise exception 'designated start'; end if;
 if (select status from order_fulfillment_work_items where id='49000000-0000-4000-8000-000000000003')<>'requested' then raise exception 'cross queue start'; end if;
end $$;

-- A mixed lab + dispensing set keeps the existing child-assignment contract.
insert into orders(id,workspace_id,encounter_id,status,clinical_order_type,destination_module,order_confirmation_status,row_type,parent_chart_order_line_id,requested_by_user_id,instruction,sort_order,updated_at)
select ('1a000000-0000-4000-8000-'||right(id::text,12))::uuid,workspace_id,encounter_id,'draft',clinical_order_type,
case when sort_order=2 then 'lab' else destination_module end,'draft',row_type,
case when row_type='set_child' then '1a000000-0000-4000-8000-000000000001'::uuid end,
'00000000-0000-4000-8000-000000000003','',sort_order,'2026-11-02T01:00:00Z'
from orders where id::text like '19000000%' order by sort_order;
select set_config('test.actor','00000000-0000-4000-8000-000000000003',true);
select public.clair_save_order_intended_assignee('workspace-a','00000000-0000-4000-8000-000000000003','1a000000-0000-4000-8000-000000000002','2026-11-02T01:00:00Z','00000000-0000-4000-8000-000000000002','mixed-child-owner');
update orders set status='requested',order_confirmation_status='confirmed' where id::text like '1a000000%';
insert into order_tasks(id,workspace_id,encounter_id,order_id,parent_task_id,task_role,clinical_order_type,destination_module,status,priority,attempt_no,effective_snapshot)
select ('3a000000-0000-4000-8000-'||right(id::text,12))::uuid,workspace_id,encounter_id,id,
case when row_type='set_child' then '3a000000-0000-4000-8000-000000000001'::uuid else null end,
case when row_type='set' then 'aggregate' else 'execution' end,clinical_order_type,destination_module,'pending','normal',1,'{}'
from orders where id::text like '1a000000%' order by sort_order;
insert into order_fulfillment_work_items(id,workspace_id,order_id,encounter_id,task_id,task_attempt_no,status,queue_type,source_snapshot,requested_by_user_id)
select '4a000000-0000-4000-8000-000000000002',workspace_id,order_id,encounter_id,id,1,'requested',destination_module,'{}','00000000-0000-4000-8000-000000000003'
from order_tasks where id='3a000000-0000-4000-8000-000000000002';
do $$ begin
 if (select assigned_to_user_id from order_fulfillment_work_items where id='4a000000-0000-4000-8000-000000000002') is distinct from '00000000-0000-4000-8000-000000000002'::uuid then raise exception 'mixed unsupported set lost child owner'; end if;
 if exists(select 1 from private.fulfillment_instruction_state where root_task_id='3a000000-0000-4000-8000-000000000001') then raise exception 'mixed unsupported set gained main'; end if;
end $$;

-- The unassigned set root also wins over assignment metadata supplied by a caller.
insert into orders(id,workspace_id,encounter_id,status,clinical_order_type,destination_module,order_confirmation_status,row_type,parent_chart_order_line_id,requested_by_user_id,instruction,sort_order,updated_at)
select ('1b000000-0000-4000-8000-'||right(id::text,12))::uuid,workspace_id,encounter_id,'requested',clinical_order_type,destination_module,'confirmed',row_type,
case when row_type='set_child' then '1b000000-0000-4000-8000-000000000001'::uuid end,
requested_by_user_id,'',sort_order,now() from orders where id::text like '19000000%' order by sort_order;
insert into order_tasks(id,workspace_id,encounter_id,order_id,parent_task_id,task_role,clinical_order_type,destination_module,status,priority,attempt_no,effective_snapshot,assigned_to_user_id,assigned_by_user_id,assigned_at)
select ('3b000000-0000-4000-8000-'||right(id::text,12))::uuid,workspace_id,encounter_id,id,
case when row_type='set_child' then '3b000000-0000-4000-8000-000000000001'::uuid else null end,
case when row_type='set' then 'aggregate' else 'execution' end,clinical_order_type,destination_module,'pending','normal',1,'{}',
'00000000-0000-4000-8000-000000000002',requested_by_user_id,now()
from orders where id::text like '1b000000%' order by sort_order;
insert into order_fulfillment_work_items(id,workspace_id,order_id,encounter_id,task_id,task_attempt_no,status,queue_type,source_snapshot,requested_by_user_id,assigned_to_user_id,assigned_by_user_id,assigned_at)
select ('4b000000-0000-4000-8000-'||right(order_id::text,12))::uuid,workspace_id,order_id,encounter_id,id,1,'requested',destination_module,'{}',
'00000000-0000-4000-8000-000000000003',assigned_to_user_id,assigned_by_user_id,assigned_at
from order_tasks where id::text like '3b000000%' and task_role='execution';
do $$ begin
 if exists(select 1 from order_fulfillment_work_items where id::text like '4b000000%' and (assigned_to_user_id is not null or assigned_by_user_id is not null or assigned_at is not null))
 or exists(select 1 from order_tasks where id::text like '3b000000%' and (assigned_to_user_id is not null or assigned_by_user_id is not null or assigned_at is not null))
 then raise exception 'unassigned root retained caller assignment'; end if;
end $$;
