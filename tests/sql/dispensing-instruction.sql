-- Isolated synthetic schema; actual stored functions are loaded by the runner.
create schema if not exists private;
create schema if not exists auth;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
do $$ begin create role anon; exception when duplicate_object then null; end $$;
do $$ begin create role service_role; exception when duplicate_object then null; end $$;
create or replace function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
create or replace function auth.role() returns text language sql stable as $$select coalesce(nullif(current_setting('test.role',true),''),'authenticated')$$;
create function private.clair_is_active_workspace_member(text) returns boolean language sql stable as $$ select $1='workspace-a' and auth.uid() is not null $$;
create function private.clair_user_has_workspace_permission(text,uuid,text) returns boolean language sql stable as $$select $1='workspace-a' and ($2 in ('00000000-0000-4000-8000-000000000001'::uuid,'00000000-0000-4000-8000-000000000002'::uuid) or ($2='00000000-0000-4000-8000-000000000003'::uuid and $3 in ('chart:view','chart:update')))$$;
create function private.clair_current_user_has_workspace_permission(text,text) returns boolean language sql stable as $$select private.clair_user_has_workspace_permission($1,auth.uid(),$2)$$;
create function private.clair_queue_permission_for_destination(text,text) returns text language sql immutable as $$select $1||':'||$2$$;

create table public.users(id uuid primary key,display_name text,status text);
create table public.user_memberships(workspace_id text,user_id uuid,status text);
create table public.encounters(id uuid primary key,workspace_id text,status text);
create table public.orders(id uuid primary key,workspace_id text,encounter_id uuid,status text,clinical_order_type text,destination_module text,order_confirmation_status text,row_type text,parent_chart_order_line_id uuid,requested_by_user_id uuid,instruction text,revision_no integer default 0,sort_order integer,invoice_line_id uuid,order_type text default 'dispensing',work_status text default 'pending',task_status text,updated_at timestamptz);
create table public.order_tasks(id uuid primary key,detailed_phase text,paused_from_phase text,returned_at timestamptz,created_at timestamptz default now(),request_cycle integer default 1,workspace_id text,encounter_id uuid,order_id uuid,parent_task_id uuid,task_role text,clinical_order_type text,destination_module text,status text,priority text,attempt_no integer,re_requested_from_task_id uuid,effective_snapshot jsonb,result_snapshot jsonb,assigned_to_user_id uuid,assigned_by_user_id uuid,assigned_at timestamptz,started_at timestamptz,started_by_user_id uuid,completed_at timestamptz,cancelled_at timestamptz,row_revision bigint default 1,execution_result_schema_version integer default 0,updated_at timestamptz,unique(workspace_id,id));
create table public.order_fulfillment_work_items(id uuid primary key,clinical_order_type text default 'dispensing',reason text,detailed_phase text,paused_from_phase text,returned_at timestamptz,requested_by_user_id uuid default '00000000-0000-4000-8000-000000000001',request_cycle integer default 1,destination_module text,order_type text default 'dispensing',created_at timestamptz default now(),workspace_id text,order_id uuid,encounter_id uuid,task_id uuid,task_attempt_no integer,assigned_to_user_id uuid,assigned_by_user_id uuid,assigned_at timestamptz,started_at timestamptz,started_by_user_id uuid,completed_at timestamptz,status text,queue_type text,source_snapshot jsonb,row_revision bigint default 1,updated_at timestamptz);
create table public.order_execution_result_versions(id uuid primary key default gen_random_uuid(),previous_result_id uuid,schema_version integer default 1,payload jsonb,performed_by_user_id uuid,performed_at timestamptz,recorded_by_user_id uuid,recorded_at timestamptz default now(),variance_reason text,amendment_reason text,plan_sha256 text,command_id uuid,command_sha256 text,order_id uuid,encounter_id uuid,clinical_order_type text,workspace_id text,task_id uuid,task_attempt_no integer,version integer,plan_snapshot jsonb);
create table public.order_revisions(id uuid default gen_random_uuid(),workspace_id text,order_id uuid,created_at timestamptz default now(),created_by_user_id uuid,change_type text,before_values jsonb,after_values jsonb,revision_no integer);
create table public.order_billing_candidates(workspace_id text,encounter_id uuid,order_id uuid,status text,invoice_line_id uuid);
create table public.order_task_events(lifecycle_command_id uuid,reason text,created_at timestamptz default now(),workspace_id text,task_id uuid,task_attempt_no integer,order_id uuid,event_type text,actor_user_id uuid,before_values jsonb,after_values jsonb);
-- Match the canonical history reason constraint so child-repeat regressions fail locally.
alter table public.order_task_events add constraint order_task_events_reason_v3_check check (
 event_type not in ('cancelled','returned','amended','re_requested','priority_changed','handed_off')
 or length(btrim(coalesce(reason,'')))>0);
create table public.order_events(created_at timestamptz default now(),workspace_id text,order_id uuid,event_type text,performed_by_user_id uuid,payload jsonb);
-- NOTIFICATION TABLE
create function private.clair_notification_is_active_workspace_user(text,text) returns boolean language sql stable as $$select exists(select 1 from public.user_memberships where workspace_id=$1 and user_id::text=$2 and status='active')$$;
create table public.synthetic_billing_handoffs(order_id uuid,kind text);
create function private.clair_assert_billing_surface_permission(text,text,uuid[]) returns void language plpgsql as $$begin if not private.clair_current_user_has_workspace_permission($1,'dispensing:mutate') then raise exception 'permission_missing'; end if; end$$;
create function private.clair_sync_billing_invoice_candidates_internal(text,uuid,uuid,uuid[]) returns jsonb language plpgsql as $$begin insert into public.synthetic_billing_handoffs select x,'legacy' from unnest($4) x; return '{}'::jsonb; end$$;
create function private.clair_link_chart_order_billing_candidates_internal(text,uuid,uuid,uuid[]) returns jsonb language plpgsql as $$begin insert into public.synthetic_billing_handoffs select x,'candidate' from unnest($4) x; return '{}'::jsonb; end$$;
create function private.clair_fulfillment_phase_allowed(text,text) returns boolean language sql immutable as $$select $2 is null$$;
create function public.clair_save_chart_order_lifecycle(text,uuid,uuid,uuid,text,text) returns jsonb language plpgsql as $$begin update public.orders set status=$5 where workspace_id=$1 and id=$4; return '{}'::jsonb; end$$;
alter table public.orders add column detail_inputs jsonb default '{}',add column detail_schema_version integer default 1,add column calculation_outputs jsonb default '{"dispenseApplicability":false}',add column calculation_inputs jsonb default '{}',add column confirmed_snapshot jsonb default '{}',add column priority text default 'normal';
alter table public.order_tasks alter column id set default gen_random_uuid(),add column created_by_user_id uuid;
alter table public.order_fulfillment_work_items add column priority text,add column cancelled_at timestamptz;
alter table public.order_revisions add column idempotency_key text,add column request_sha256 text,add column expected_revision_no integer,add column result jsonb,add column reason text,add column affected_tasks jsonb,add column billing_impact jsonb,add column completed_at timestamptz;
alter table public.order_billing_candidates add column billing_snapshot jsonb,add column price_basis_snapshot text,add column quantity numeric,add column amount bigint,add column unit_price numeric,add column source_snapshot jsonb,add column updated_at timestamptz;
alter table public.user_memberships add column id uuid default gen_random_uuid(),add column created_at timestamptz default now();
create table public.invoices(id uuid,workspace_id text,billing_review_required boolean);
create table public.invoice_lines(id uuid,workspace_id text,invoice_id uuid);
create table public.order_revision_fields(workspace_id text,order_revision_id uuid,field_name text,previous_value jsonb,current_value jsonb);
create table public.audit_events(id text,workspace_id text,actor_user_id uuid,actor_membership_id uuid,event_type text,target_type text,target_id text,encounter_id uuid,request_id text,before_snapshot jsonb,after_snapshot jsonb,metadata jsonb,occurred_at timestamptz,created_at timestamptz);
create table public.order_execution_outbox(workspace_id text,confirmation_command_id uuid,order_revision_id uuid,event_key text,event_type text,aggregate_type text,aggregate_id uuid,payload jsonb,created_at timestamptz,updated_at timestamptz);
-- Calculation/clinical validation are unchanged dependencies, stubbed only in this structural attempt test.
create function private.clair_order_detail_inputs_are_valid(text,integer,jsonb,boolean default false) returns boolean language sql immutable as $$select jsonb_typeof($3)='object'$$;
create function private.clair_compute_plan_order_dispense_projection(public.orders,timestamptz) returns jsonb language sql stable as $$select $1.calculation_outputs$$;
-- BASELINE
create trigger history_guard before insert or update on public.order_tasks for each row execute function private.clair_assert_order_task_identity_and_history();
create trigger result_guard before update on public.order_tasks for each row execute function private.clair_guard_execution_result_completion();
-- MIGRATION

-- Synthetic fixture: one set with two execution rows; two eligible technicians.
begin;
insert into encounters values('20000000-0000-4000-8000-000000000001','workspace-a','in_progress');
insert into users values ('00000000-0000-4000-8000-000000000001','Main','active'),('00000000-0000-4000-8000-000000000002','Sub','active'),('00000000-0000-4000-8000-000000000003','Requester','active');
insert into user_memberships(workspace_id,user_id,status) select 'workspace-a',id,'active' from users;
insert into orders(id,workspace_id,encounter_id,status,clinical_order_type,destination_module,order_confirmation_status,row_type,parent_chart_order_line_id,requested_by_user_id,instruction,sort_order)
values
('10000000-0000-4000-8000-000000000001','workspace-a','20000000-0000-4000-8000-000000000001','requested','dispensing',null,'confirmed','set',null,'00000000-0000-4000-8000-000000000001','set note',0),
('10000000-0000-4000-8000-000000000002','workspace-a','20000000-0000-4000-8000-000000000001','requested','dispensing','dispensing','confirmed','set_child','10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','item note',1),
('10000000-0000-4000-8000-000000000003','workspace-a','20000000-0000-4000-8000-000000000001','requested','dispensing','dispensing','confirmed','set_child','10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','',2);
insert into order_tasks(id,workspace_id,encounter_id,order_id,parent_task_id,task_role,clinical_order_type,destination_module,status,priority,attempt_no,effective_snapshot)
select ('30000000-0000-4000-8000-'||right(id::text,12))::uuid,workspace_id,encounter_id,id,
case when row_type='set_child' then '30000000-0000-4000-8000-000000000001'::uuid else null end,
case when row_type='set' then 'aggregate' else 'execution' end,clinical_order_type,destination_module,'pending','normal',1,'{"orderDisplayName":"Synthetic"}' from orders order by sort_order;
insert into order_fulfillment_work_items(id,workspace_id,order_id,encounter_id,task_id,task_attempt_no,status,queue_type,source_snapshot)
select ('40000000-0000-4000-8000-'||right(order_id::text,12))::uuid,workspace_id,order_id,encounter_id,id,attempt_no,'requested','dispensing','{"orderDisplayName":"Synthetic"}' from order_tasks where task_role='execution';
select set_config('test.actor','00000000-0000-4000-8000-000000000001',true);
create function pg_temp.command(action text,item_id uuid default null,assignee uuid default null) returns jsonb language plpgsql as $$
declare d jsonb;
begin
 d:=public.clair_get_fulfillment_instruction('workspace-a','40000000-0000-4000-8000-000000000002');
 return public.clair_mutate_fulfillment_instruction('workspace-a','40000000-0000-4000-8000-000000000002',
 jsonb_strip_nulls(jsonb_build_object('action',action,'commandId',gen_random_uuid(),'expectedRevision',d->>'revision','itemId',item_id,'assigneeId',assignee)));
end $$;
do $$
declare d jsonb; cmd jsonb; previous_result jsonb; events_before bigint; orders_before bigint; notifications_before bigint;
begin
 d:=public.clair_get_fulfillment_instruction('workspace-a','40000000-0000-4000-8000-000000000002');
 begin perform public.clair_mutate_fulfillment_instruction('workspace-a','40000000-0000-4000-8000-000000000002',jsonb_build_object('action','complete_all','commandId',gen_random_uuid(),'expectedRevision',d->>'revision','itemId','40000000-0000-4000-8000-000000000002')); raise exception 'group accepted item scope'; exception when raise_exception then if sqlerrm<>'invalid_transition' then raise; end if; end;
 d:=pg_temp.command('claim');
 if d->>'mainAssigneeId'<>auth.uid()::text then raise exception 'claim failed'; end if;
 d:=pg_temp.command('start');
 d:=pg_temp.command('assign','40000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000002');
 if d->>'mainAssigneeId'<>auth.uid()::text then raise exception 'item transfer changed main'; end if;
 perform set_config('test.actor','00000000-0000-4000-8000-000000000002',true);
 begin perform pg_temp.command('complete','40000000-0000-4000-8000-000000000002'); raise exception 'sub completed peer'; exception when insufficient_privilege then null; end;
 perform pg_temp.command('complete','40000000-0000-4000-8000-000000000003');
 begin perform pg_temp.command('complete_all'); raise exception 'sub finalized set'; exception when insufficient_privilege then null; end;
 perform set_config('test.actor','00000000-0000-4000-8000-000000000001',true);
 insert into public.order_billing_candidates(workspace_id,encounter_id,order_id,status) values('workspace-a','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','candidate_created');
 d:=pg_temp.command('complete','40000000-0000-4000-8000-000000000002');
 if not exists(select 1 from synthetic_billing_handoffs where kind='candidate') or not exists(select 1 from synthetic_billing_handoffs where kind='legacy') then raise exception 'billing handoff missing'; end if;
 if exists(select 1 from order_tasks where task_role='execution' and result_snapshot is null) then raise exception 'legacy completion marker missing'; end if;
 if (d->>'finalized')::boolean or (select status from order_tasks where task_role='aggregate')<>'partial_complete' then raise exception 'implicit set finalization'; end if;
 d:=pg_temp.command('complete_all');
 if not (d->>'finalized')::boolean or (select status from order_tasks where task_role='aggregate')<>'complete' then raise exception 'explicit set incomplete'; end if;
 cmd:=jsonb_build_object('action','edit_instruction','commandId',gen_random_uuid(),'expectedRevision',d->>'revision','instruction','changed common note');
 d:=public.clair_mutate_fulfillment_instruction('workspace-a','40000000-0000-4000-8000-000000000002',cmd);
 if not (d->>'finalized')::boolean or exists(select 1 from order_tasks where status<>'complete') then raise exception 'common instruction reopened completed work'; end if;
 if (select count(distinct recipient_id) from notification_events where title='공통 지시가 수정되었습니다')<>2 then raise exception 'common instruction recipients wrong'; end if;
 if d->>'instruction'<>'changed common note' or (select count(*) from order_revisions)<>1 then raise exception 'common instruction missing history'; end if;
 perform public.clair_mutate_fulfillment_instruction('workspace-a','40000000-0000-4000-8000-000000000002',cmd);
 if (select count(*) from order_revisions)<>1 then raise exception 'common instruction replay duplicated history'; end if;
 perform set_config('test.actor','00000000-0000-4000-8000-000000000002',true);
 begin perform public.clair_mutate_fulfillment_instruction('workspace-a','40000000-0000-4000-8000-000000000002',cmd||jsonb_build_object('commandId',gen_random_uuid(),'expectedRevision',d->>'revision')); raise exception 'sub edited common instruction'; exception when insufficient_privilege then null; end;
 perform set_config('test.actor','00000000-0000-4000-8000-000000000001',true);
 select count(*) into events_before from order_task_events;
 select count(*) into orders_before from order_events;
 select count(*) into notifications_before from notification_events;
 select result_snapshot into previous_result from order_tasks where id='30000000-0000-4000-8000-000000000002';
 d:=pg_temp.command('reopen','40000000-0000-4000-8000-000000000002');
 if (select count(*) from notification_events)<>notifications_before then raise exception 'undo emitted notification'; end if;
 if (select count(*) from order_task_events)<>events_before or (select count(*) from order_events)<>orders_before then raise exception 'reopen emitted history'; end if;
 if (select result_snapshot from order_tasks where id='30000000-0000-4000-8000-000000000002')is distinct from previous_result then raise exception 'result lost'; end if;
 if (d->>'finalized')::boolean or (select status from orders where row_type='set')<>'in_progress' then raise exception 'reopen not reflected'; end if;
 begin update order_tasks set status='in_progress' where id='30000000-0000-4000-8000-000000000003'; raise exception 'direct reopen bypass'; exception when object_not_in_prerequisite_state then null; end;
 d:=pg_temp.command('unassign');
 if d->>'mainAssigneeId' is not null or (select status from order_fulfillment_work_items where id='40000000-0000-4000-8000-000000000002')<>'paused' then raise exception 'unassign did not pause'; end if;
 perform set_config('test.actor','00000000-0000-4000-8000-000000000002',true);
 d:=pg_temp.command('claim'); d:=pg_temp.command('resume');
 if d->>'mainAssigneeId'<>auth.uid()::text then raise exception 'successor not main'; end if;
 cmd:=jsonb_build_object('action','complete','commandId',gen_random_uuid(),'expectedRevision',d->>'revision','itemId','40000000-0000-4000-8000-000000000002');
 d:=public.clair_mutate_fulfillment_instruction('workspace-a','40000000-0000-4000-8000-000000000002',cmd);
 select count(*) into events_before from order_task_events;
 perform public.clair_mutate_fulfillment_instruction('workspace-a','40000000-0000-4000-8000-000000000002',cmd);
 if (select count(*) from order_task_events)<>events_before then raise exception 'duplicate emitted history'; end if;
 begin perform public.clair_mutate_fulfillment_instruction('workspace-a','40000000-0000-4000-8000-000000000002',cmd||'{"action":"reopen"}'); raise exception 'conflicting replay accepted'; exception when raise_exception then if sqlerrm<>'idempotency_conflict' then raise; end if; end;
 begin perform public.clair_mutate_fulfillment_instruction('workspace-a','40000000-0000-4000-8000-000000000002',cmd||jsonb_build_object('commandId',gen_random_uuid())); raise exception 'stale accepted'; exception when raise_exception then if sqlerrm<>'revision_conflict' then raise; end if; end;
 insert into order_billing_candidates(workspace_id,order_id,status) values('workspace-a','10000000-0000-4000-8000-000000000002','invoice_linked');
 begin perform pg_temp.command('reopen','40000000-0000-4000-8000-000000000002'); raise exception 'billed reopened'; exception when raise_exception then if sqlerrm<>'billing_locked' then raise; end if; end;
 begin perform public.clair_get_fulfillment_instruction('workspace-b','40000000-0000-4000-8000-000000000002'); raise exception 'cross workspace'; exception when insufficient_privilege then null; end;
 update public.encounters set status='cancelled';
 begin perform pg_temp.command('complete_all'); raise exception 'cancelled encounter mutated'; exception when raise_exception then if sqlerrm<>'invalid_transition' then raise; end if; end;
 if has_table_privilege('authenticated','private.fulfillment_instruction_completion_scope','INSERT') then raise exception 'completion scope writable'; end if;
 if has_table_privilege('authenticated','private.fulfillment_instruction_reopen_scope','INSERT') then raise exception 'scope writable'; end if;
 -- Actual result path: requesting vet has chart access only and does not own the queue.
 update public.encounters set status='in_progress';
 insert into public.orders(id,workspace_id,encounter_id,status,clinical_order_type,destination_module,order_confirmation_status,row_type,requested_by_user_id,instruction,sort_order)
 values('10000000-0000-4000-8000-000000000004','workspace-a','20000000-0000-4000-8000-000000000001','requested','dispensing','dispensing','confirmed','individual','00000000-0000-4000-8000-000000000003','',4);
 insert into public.order_tasks(id,workspace_id,encounter_id,order_id,task_role,clinical_order_type,destination_module,status,priority,attempt_no,effective_snapshot,execution_result_schema_version,assigned_to_user_id)
 values('30000000-0000-4000-8000-000000000004','workspace-a','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000004','execution','dispensing','dispensing','pending','normal',1,'{"orderDisplayName":"Actual-result synthetic","calculationOutputs":{"plannedPracticalTotalQuantity":1,"dispenseUnit":"T"}}',1,'00000000-0000-4000-8000-000000000001');
 insert into public.order_fulfillment_work_items(id,workspace_id,order_id,encounter_id,task_id,task_attempt_no,status,queue_type,source_snapshot,assigned_to_user_id,requested_by_user_id)
 values('40000000-0000-4000-8000-000000000004','workspace-a','10000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000004',1,'requested','dispensing','{"orderDisplayName":"Synthetic"}','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000003');
 perform set_config('test.actor','00000000-0000-4000-8000-000000000003',true);
 d:=public.clair_get_fulfillment_instruction('workspace-a','40000000-0000-4000-8000-000000000004');
 cmd:=jsonb_build_object('action','complete','commandId',gen_random_uuid(),'expectedRevision',d->>'revision','itemId','40000000-0000-4000-8000-000000000004');
 begin perform public.clair_mutate_fulfillment_instruction('workspace-a','40000000-0000-4000-8000-000000000004',cmd); raise exception 'missing actual result accepted'; exception when raise_exception then if sqlerrm<>'actual_execution_result_required' then raise; end if; end;
 d:=public.clair_mutate_fulfillment_instruction('workspace-a','40000000-0000-4000-8000-000000000004',cmd||jsonb_build_object('action','start_item','commandId',gen_random_uuid()));
 d:=public.clair_get_order_execution_context('workspace-a','40000000-0000-4000-8000-000000000004');
 cmd:=jsonb_build_object('commandId',gen_random_uuid(),'revision',d->'workItemRevision','hash',d->'planSha256');
 d:=public.clair_record_order_execution_result('workspace-a',auth.uid(),'40000000-0000-4000-8000-000000000004',(cmd->>'revision')::bigint,cmd->>'hash',0,(cmd->>'commandId')::uuid,now(),'{"preparedQuantity":1,"preparedUnit":"T"}',null,null);
 if d->>'status'<>'completed' or (d->>'canRecord')::boolean or jsonb_array_length(d->'results')<>1 then raise exception 'requester result completion/read failed'; end if;
 perform public.clair_record_order_execution_result('workspace-a',auth.uid(),'40000000-0000-4000-8000-000000000004',(cmd->>'revision')::bigint,cmd->>'hash',0,(cmd->>'commandId')::uuid,now(),'{"preparedQuantity":1,"preparedUnit":"T"}',null,null);
 if (select count(*) from public.order_execution_result_versions)<>1 then raise exception 'result replay duplicated'; end if;
 begin perform public.clair_record_order_execution_result('workspace-a',auth.uid(),'40000000-0000-4000-8000-000000000004',(d->>'workItemRevision')::bigint,cmd->>'hash',1,gen_random_uuid(),now(),'{"preparedQuantity":2,"preparedUnit":"T"}','changed','amendment'); raise exception 'requester amended completed result'; exception when insufficient_privilege then null; end;
 if exists(select 1 from private.fulfillment_instruction_completion_scope) then raise exception 'completion capability leaked'; end if;
 -- Exercise the canonical mutation body for an independent treatment child.
 perform set_config('test.actor','00000000-0000-4000-8000-000000000001',true);
 insert into orders(id,workspace_id,encounter_id,status,clinical_order_type,destination_module,order_confirmation_status,row_type,parent_chart_order_line_id,requested_by_user_id,instruction,sort_order)
 select ('11000000-0000-4000-8000-'||right(id::text,12))::uuid,workspace_id,encounter_id,'completed','treatment',case when row_type='set' then null else 'treatment' end,'confirmed',row_type,
 case when row_type='set_child' then '11000000-0000-4000-8000-000000000001'::uuid else null end,requested_by_user_id,instruction,sort_order from orders where id in ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003');
 insert into order_tasks(id,workspace_id,encounter_id,order_id,parent_task_id,task_role,clinical_order_type,destination_module,status,priority,attempt_no,effective_snapshot,assigned_to_user_id)
 select ('31000000-0000-4000-8000-'||right(id::text,12))::uuid,workspace_id,encounter_id,id,
 case when row_type='set_child' then '31000000-0000-4000-8000-000000000001'::uuid else null end,
 case when row_type='set' then 'aggregate' else 'execution' end,'treatment',destination_module,'complete','normal',1,'{"orderDisplayName":"Synthetic treatment","billingReflectionEnabled":false}',auth.uid()
 from orders where id::text like '11000000%' order by sort_order;
 insert into order_fulfillment_work_items(id,workspace_id,order_id,encounter_id,task_id,task_attempt_no,status,queue_type,source_snapshot,assigned_to_user_id)
 select ('41000000-0000-4000-8000-'||right(order_id::text,12))::uuid,workspace_id,order_id,encounter_id,id,1,'completed','treatment',effective_snapshot,auth.uid() from order_tasks where id::text like '31000000%' and task_role='execution';
 insert into private.fulfillment_instruction_state values('workspace-a','31000000-0000-4000-8000-000000000001','treatment',auth.uid(),true,1);
 begin perform public.clair_mutate_chart_order_execution_origin_base('workspace-a',auth.uid(),'11000000-0000-4000-8000-000000000002','re_request','synthetic note',0,'{"detailInputs":{},"detailSchemaVersion":1}','unchanged-child-plan'); raise exception 'unchanged child repeated'; exception when raise_exception then if sqlerrm<>'unchanged_instruction' then raise; end if; end;
 d:=public.clair_mutate_chart_order_execution_origin_base('workspace-a',auth.uid(),'11000000-0000-4000-8000-000000000002','re_request','synthetic edit',0,'{"detailInputs":{"method":"synthetic changed instruction"},"detailSchemaVersion":1}','changed-child-plan');
 if (select count(*) from order_tasks where order_id='11000000-0000-4000-8000-000000000002')<>2 then raise exception 'child attempt missing'; end if;
 if not exists(select 1 from order_tasks where order_id='11000000-0000-4000-8000-000000000002' and attempt_no=2 and parent_task_id='31000000-0000-4000-8000-000000000001') then raise exception 'child lost parent'; end if;
 if (select status from order_tasks where id='31000000-0000-4000-8000-000000000003')<>'complete' then raise exception 'unchanged child reset'; end if;
 d:=public.clair_get_fulfillment_instruction('workspace-a','41000000-0000-4000-8000-000000000002');
 if jsonb_array_length(d->'items')<>2 or (d->>'finalized')::boolean then raise exception 'superseded child visible or set finalized'; end if;
 if not exists(select 1 from order_task_events where task_id='31000000-0000-4000-8000-000000000002' and after_values->>'nextAttemptNo'='2') then raise exception 'child next attempt history wrong'; end if;
 d:=public.clair_mutate_chart_order_execution_origin_base('workspace-a',auth.uid(),'11000000-0000-4000-8000-000000000001','re_request','synthetic whole repeat',0,'{}','repeat-whole-after-child');
 if not exists(select 1 from order_fulfillment_work_items where id='41000000-0000-4000-8000-000000000002' and task_attempt_no=3) then raise exception 'whole repeat lost independent child attempt'; end if;
 if not exists(select 1 from order_fulfillment_work_items where id='41000000-0000-4000-8000-000000000003' and task_attempt_no=2) then raise exception 'whole repeat wrong unchanged child attempt'; end if;
 d:=public.clair_get_fulfillment_instruction('workspace-a','41000000-0000-4000-8000-000000000002');
 if d->>'rootTaskId'='31000000-0000-4000-8000-000000000001' or jsonb_array_length(d->'items')<>2 then raise exception 'whole repeat root/readback mismatch'; end if;
 if not exists(select 1 from order_task_events where order_id='11000000-0000-4000-8000-000000000002' and task_attempt_no=2 and after_values->>'nextAttemptNo'='3') then raise exception 'whole repeat next attempt history wrong'; end if;

 raise notice 'PASS: main/sub ownership, explicit finalization, unassign/resume, no-history reopen with preserved results, replay/conflict, billing lock, workspace isolation';
end $$;
rollback;
