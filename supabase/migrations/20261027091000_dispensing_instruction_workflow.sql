-- Local candidate only. Apply before enabling the instruction caller.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';

create table private.fulfillment_instruction_state (
  workspace_id text not null,
  root_task_id uuid not null,
  queue_type text not null check (queue_type in ('dispensing','treatment')),
  main_assignee_id uuid references public.users(id),
  finalized boolean not null default false,
  revision bigint not null default 1,
  primary key (workspace_id,root_task_id,queue_type),
  foreign key (workspace_id,root_task_id) references public.order_tasks(workspace_id,id)
);
-- Receipts prevent replay; they are not emitted to clinical/audit/activity history.
create table private.fulfillment_instruction_receipts (
  workspace_id text not null,
  command_id uuid not null,
  actor_id uuid not null,
  work_item_id uuid not null,
  request jsonb not null,
  primary key (workspace_id,command_id)
);
-- A transaction-local capability, never a caller-settable configuration flag.
create table private.fulfillment_instruction_reopen_scope (
  transaction_id bigint not null,
  workspace_id text not null,
  task_id uuid not null,
  actor_id uuid not null,
  primary key (transaction_id,workspace_id,task_id)
);
revoke all on private.fulfillment_instruction_state,private.fulfillment_instruction_receipts,
  private.fulfillment_instruction_reopen_scope from public,anon,authenticated,service_role;

-- Trusted post-completion access lasts only for the issuing transaction.
create table private.fulfillment_instruction_completion_scope (
 transaction_id bigint not null, workspace_id text not null, work_item_id uuid not null,
 task_id uuid not null, actor_id uuid not null, command_id uuid not null,
 primary key(transaction_id,workspace_id,work_item_id,actor_id,command_id)
);
revoke all on private.fulfillment_instruction_completion_scope from public,anon,authenticated,service_role;
create function private.clair_instruction_has_completion_scope(p_workspace_id text,p_work_item_id uuid,p_actor_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select p_actor_id=auth.uid() and exists(select 1 from private.fulfillment_instruction_completion_scope s
 join public.order_fulfillment_work_items wi on wi.workspace_id=s.workspace_id and wi.id=s.work_item_id and wi.task_id=s.task_id
 where s.transaction_id=txid_current() and s.workspace_id=p_workspace_id and s.work_item_id=p_work_item_id and s.actor_id=p_actor_id);
$$;
revoke all on function private.clair_instruction_has_completion_scope(text,uuid,uuid) from public,anon,authenticated,service_role;

create function private.clair_instruction_may_reopen(p_workspace_id text,p_task_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.fulfillment_instruction_reopen_scope s
 where s.transaction_id=txid_current() and s.workspace_id=p_workspace_id
 and s.task_id=p_task_id and s.actor_id=auth.uid());
$$;
revoke all on function private.clair_instruction_may_reopen(text,uuid) from public,anon,authenticated,service_role;

do $patch$
declare d text; anchor text := $anchor$if old.status in ('complete','returned','cancelled')
      and ($anchor$;
begin
 d:=pg_get_functiondef('private.clair_assert_order_task_identity_and_history()'::regprocedure);
 if (length(d)-length(replace(d,anchor,'')))/length(anchor)<>1 then raise exception 'instruction_history_guard_anchor'; end if;
 execute replace(d,anchor,$replacement$if old.status in ('complete','returned','cancelled')
      and not (old.status='complete' and new.status in ('in_progress','partial_complete')
        and new.effective_snapshot is not distinct from old.effective_snapshot
        and new.priority is not distinct from old.priority
        and new.destination_module is not distinct from old.destination_module
        and private.clair_instruction_may_reopen(old.workspace_id,old.id))
      and ($replacement$);
end $patch$;

create function public.clair_get_fulfillment_instruction(p_workspace_id text,p_work_item_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare wi public.order_fulfillment_work_items; t public.order_tasks; root public.order_tasks;
 state private.fulfillment_instruction_state; root_order public.orders;
 actor uuid:=auth.uid(); main uuid; manager boolean; completer boolean; mutate boolean; requester boolean;
 items jsonb; changes jsonb; revision text; finalized boolean;
begin
 if actor is null or not private.clair_is_active_workspace_member(p_workspace_id) then
   raise exception 'permission_missing' using errcode='42501'; end if;
 select * into wi from public.order_fulfillment_work_items where workspace_id=p_workspace_id and id=p_work_item_id;
 if not found or wi.queue_type not in ('dispensing','treatment') then raise exception 'work_item_unavailable'; end if;
 if not private.clair_current_user_has_workspace_permission(p_workspace_id,
   private.clair_queue_permission_for_destination(wi.queue_type,'read'))
   and not private.clair_current_user_has_workspace_permission(p_workspace_id,'chart:view') then
   raise exception 'permission_missing' using errcode='42501'; end if;
 select * into t from public.order_tasks where workspace_id=p_workspace_id and id=wi.task_id and attempt_no=wi.task_attempt_no;
 if not found then raise exception 'work_item_unavailable'; end if;
 select * into root from public.order_tasks where workspace_id=p_workspace_id and id=coalesce(t.parent_task_id,t.id);
 if exists(select 1 from public.order_tasks newer where newer.workspace_id=p_workspace_id
   and newer.order_id=root.order_id and newer.attempt_no>root.attempt_no) then raise exception 'work_item_unavailable'; end if;
 select * into root_order from public.orders where workspace_id=p_workspace_id and id=root.order_id;
 select * into state from private.fulfillment_instruction_state where workspace_id=p_workspace_id
   and root_task_id=root.id and queue_type=wi.queue_type;
 main:=case when found then state.main_assignee_id else root.assigned_to_user_id end;
 finalized:=case when root.task_role='aggregate' then coalesce(state.finalized,root.status='complete') else root.status='complete' end;
 mutate:=private.clair_current_user_has_workspace_permission(p_workspace_id,
   private.clair_queue_permission_for_destination(wi.queue_type,'mutate'));
 requester:=root_order.requested_by_user_id=actor
   and private.clair_current_user_has_workspace_permission(p_workspace_id,'chart:update');
 manager:=coalesce(main=actor and mutate,false);
 completer:=manager or coalesce(requester,false);
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',w.id,'orderId',w.order_id,'taskId',child.id,'attemptNo',child.attempt_no,'revision',w.row_revision,
   'name',coalesce(w.source_snapshot->>'orderDisplayName',''), 'status',w.status,
   'assigneeId',w.assigned_to_user_id,'assigneeName',u.display_name,
   'instruction',coalesce(o.instruction,''),'plan',child.effective_snapshot,'sourceSnapshot',w.source_snapshot,
   'canAssign',coalesce(manager,false) and w.status not in ('completed','cancelled','returned'),
   'canComplete',(completer or coalesce(mutate and w.assigned_to_user_id=actor,false)) and w.status in ('requested','in_progress','paused'),
   'canReopen',(manager or coalesce(mutate and w.assigned_to_user_id=actor,false)) and w.status='completed',
   'hasResult',exists(select 1 from public.order_execution_result_versions r where r.workspace_id=p_workspace_id and r.task_id=child.id and r.task_attempt_no=child.attempt_no),
   'resultRequired',child.execution_result_schema_version=1 and not exists(select 1 from public.order_execution_result_versions r
      where r.workspace_id=p_workspace_id and r.task_id=child.id and r.task_attempt_no=child.attempt_no
      and r.version=1 and r.plan_snapshot=child.effective_snapshot and child.result_snapshot->>'executionResultId'=r.id::text)
 ) order by o.sort_order,w.id),'[]'::jsonb),
 md5(coalesce(string_agg(w.id::text||':'||w.row_revision||':'||child.row_revision,',' order by w.id),'')||':'||root.row_revision||':'||coalesce(state.revision,0))
 into items,revision
 from public.order_tasks child join public.order_fulfillment_work_items w
 on w.workspace_id=child.workspace_id and w.task_id=child.id and w.task_attempt_no=child.attempt_no
 join public.orders o on o.workspace_id=w.workspace_id and o.id=w.order_id
 left join public.users u on u.id=w.assigned_to_user_id
 where child.workspace_id=p_workspace_id and (child.id=root.id or child.parent_task_id=root.id)
 and w.queue_type=wi.queue_type
 and not exists(select 1 from public.order_tasks newer where newer.workspace_id=child.workspace_id
   and newer.order_id=child.order_id and newer.attempt_no>child.attempt_no);
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'orderId',r.order_id,'createdAt',r.created_at,
   'actorName',u.display_name,'changeType',r.change_type,'before',coalesce(r.before_values,'{}'),
   'after',coalesce(r.after_values,'{}')) order by r.created_at,r.revision_no,r.id),'[]') into changes
 from public.order_revisions r left join public.users u on u.id=r.created_by_user_id
 where r.workspace_id=p_workspace_id and (r.order_id=root.order_id or r.order_id in
   (select (x->>'orderId')::uuid from jsonb_array_elements(items) x));
 return jsonb_build_object('rootOrderId',root.order_id,'rootTaskId',root.id,
 'name',coalesce(root.effective_snapshot->>'orderDisplayName',root.effective_snapshot->>'name','오더'),
 'isSet',root.task_role='aggregate','queueType',wi.queue_type,'revision',revision,
 'mainAssigneeId',main,'mainAssigneeName',(select display_name from public.users where id=main),
 'instruction',coalesce(root_order.instruction,''),'finalized',finalized,
 'canClaim',main is null and mutate and not finalized and root.status not in ('cancelled','returned'),
 'canStart',coalesce(main=actor and mutate,false) and root.status not in ('complete','cancelled','returned') and exists(select 1 from jsonb_array_elements(items) x where x->>'status'='requested'),
 'canResume',coalesce(main=actor and mutate,false) and exists(select 1 from jsonb_array_elements(items) x where x->>'status'='paused'),
 'canUnassign',coalesce(main=actor and mutate and not finalized,false),
 'canEditInstruction',coalesce(requester,false) and root.task_role='aggregate' and root.status not in ('cancelled','returned'),
 'canCompleteAll',completer and not finalized and root.status not in ('cancelled','returned'),
 'items',items,'changes',changes);
end $$;
revoke all on function public.clair_get_fulfillment_instruction(text,uuid) from public,anon,service_role;
grant execute on function public.clair_get_fulfillment_instruction(text,uuid) to authenticated;

-- Preserve already-completed historical sets without rewriting clinical records.
insert into private.fulfillment_instruction_state(workspace_id,root_task_id,queue_type,main_assignee_id,finalized)
select root.workspace_id,root.id,child.destination_module,root.assigned_to_user_id,true
from public.order_tasks root join public.order_tasks child on child.workspace_id=root.workspace_id and child.parent_task_id=root.id
where root.task_role='aggregate' and root.status='complete' and child.destination_module in ('dispensing','treatment')
group by root.workspace_id,root.id,child.destination_module,root.assigned_to_user_id;

-- Child completion does not finalize a dispensing/treatment set.
do $patch$
declare d text; anchor text := '  if v_total > 0 and v_complete = v_total then return ''complete''; end if;';
begin
 d:=pg_get_functiondef('private.clair_calculate_aggregate_task_status(text,uuid)'::regprocedure);
 if (length(d)-length(replace(d,anchor,'')))/length(anchor)<>1 then raise exception 'instruction_aggregate_anchor'; end if;
 execute replace(d,anchor,$replacement$  if v_total > 0 and v_terminal = v_total and v_complete > 0
    and exists(select 1 from public.order_tasks child where child.workspace_id=p_workspace_id
      and child.parent_task_id=p_aggregate_task_id and child.destination_module in ('dispensing','treatment')) then
    if exists(select 1 from public.order_tasks child where child.workspace_id=p_workspace_id
      and child.parent_task_id=p_aggregate_task_id and child.status<>'cancelled'
      and child.destination_module in ('dispensing','treatment') and not exists(
        select 1 from private.fulfillment_instruction_state s where s.workspace_id=p_workspace_id
        and s.root_task_id=p_aggregate_task_id and s.queue_type=child.destination_module and s.finalized))
    then return 'partial_complete'; end if;
    return 'complete';
  end if;
  if v_total > 0 and v_complete = v_total then return 'complete'; end if;$replacement$);
end $patch$;

create function public.clair_mutate_fulfillment_instruction(p_workspace_id text,p_work_item_id uuid,p_command jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare doc jsonb; item jsonb; receipt private.fulfillment_instruction_receipts;
 root public.order_tasks; wi public.order_fulfillment_work_items; task public.order_tasks;
 actor uuid:=auth.uid(); action text:=p_command->>'action'; v_command_id uuid;
 root_order public.orders;
 target uuid; assignee uuid; next_status text; event_type text; main uuid; is_set boolean;
begin
 if actor is null or not private.clair_is_active_workspace_member(p_workspace_id) then
   raise exception 'permission_missing' using errcode='42501'; end if;
 if jsonb_typeof(p_command)<>'object' or action is null or action not in
   ('claim','start','resume','unassign','assign','complete','complete_all','reopen','edit_instruction','start_item')
   or not p_command ? 'expectedRevision' or not p_command ? 'commandId' then raise exception 'invalid_transition'; end if;
 if exists(select 1 from jsonb_object_keys(p_command) key where key not in ('action','commandId','expectedRevision','itemId','assigneeId','instruction'))
   or (action not in ('assign','complete','reopen','start_item') and p_command ? 'itemId')
   or (action<>'assign' and p_command ? 'assigneeId')
   or (action<>'edit_instruction' and p_command ? 'instruction')
   or (action='edit_instruction' and (not p_command ? 'instruction' or jsonb_typeof(p_command->'instruction')<>'string' or length(p_command->>'instruction')>5000))
   or jsonb_typeof(p_command->'expectedRevision')<>'string'
 then raise exception 'invalid_transition'; end if;
 v_command_id:=(p_command->>'commandId')::uuid;
 if v_command_id is null then raise exception 'invalid_transition'; end if;
 target:=nullif(p_command->>'itemId','')::uuid;
 assignee:=nullif(p_command->>'assigneeId','')::uuid;
 if action in ('assign','complete','reopen','start_item') and target is null then raise exception 'invalid_transition'; end if;
 -- Reuse the encounter lock used by assignment, actual results and billing.
 perform private.clair_lock_work_ownership(p_workspace_id,(select order_id from public.order_fulfillment_work_items
   where workspace_id=p_workspace_id and id=p_work_item_id));
 perform 1 from public.encounters e where e.workspace_id=p_workspace_id and e.id=(
   select encounter_id from public.order_fulfillment_work_items where workspace_id=p_workspace_id and id=p_work_item_id) for update;
 if exists(select 1 from public.encounters e where e.workspace_id=p_workspace_id and e.id=(
   select encounter_id from public.order_fulfillment_work_items where workspace_id=p_workspace_id and id=p_work_item_id) and e.status='cancelled') then raise exception 'invalid_transition'; end if;
 doc:=public.clair_get_fulfillment_instruction(p_workspace_id,p_work_item_id);
 select * into receipt from private.fulfillment_instruction_receipts where workspace_id=p_workspace_id and command_id=v_command_id;
 if found then
   if receipt.actor_id<>actor or receipt.work_item_id<>p_work_item_id or receipt.request<>p_command then
     raise exception 'idempotency_conflict'; end if;
   return doc;
 end if;
 if doc->>'revision' is distinct from p_command->>'expectedRevision' then raise exception 'revision_conflict'; end if;
 perform 1 from public.orders where workspace_id=p_workspace_id and id=(doc->>'rootOrderId')::uuid for update;
 perform 1 from public.orders where workspace_id=p_workspace_id
   and id in (select (x->>'orderId')::uuid from jsonb_array_elements(doc->'items') x) order by id for update;
 select * into root from public.order_tasks where workspace_id=p_workspace_id and id=(doc->>'rootTaskId')::uuid for update;
 perform 1 from public.order_tasks where workspace_id=p_workspace_id and parent_task_id=root.id order by id for update;
 perform 1 from public.order_fulfillment_work_items where workspace_id=p_workspace_id
   and id in (select (x->>'id')::uuid from jsonb_array_elements(doc->'items') x) order by id for update;
 doc:=public.clair_get_fulfillment_instruction(p_workspace_id,p_work_item_id);
 if doc->>'revision' is distinct from p_command->>'expectedRevision' then raise exception 'revision_conflict'; end if;
 -- Common text is an annotation revision, not a new execution attempt.
 if action='edit_instruction' then
   if not coalesce((doc->>'canEditInstruction')::boolean,false) then raise exception 'permission_missing' using errcode='42501'; end if;
   select * into root_order from public.orders where workspace_id=p_workspace_id and id=root.order_id;
   if coalesce(root_order.instruction,'') is distinct from p_command->>'instruction' then
     update public.orders set instruction=p_command->>'instruction',revision_no=revision_no+1,updated_at=now()
       where workspace_id=p_workspace_id and id=root.order_id;
     insert into public.order_revisions(workspace_id,order_id,revision_no,created_by_user_id,change_type,before_values,after_values)
       values(p_workspace_id,root.order_id,root_order.revision_no+1,actor,'amendment',
         jsonb_build_object('instruction',coalesce(root_order.instruction,'')),jsonb_build_object('instruction',p_command->>'instruction'));
     -- All queue documents share the root order text and must reject stale writes.
     update public.order_tasks set row_revision=row_revision+1,updated_at=now() where workspace_id=p_workspace_id and id=root.id;
     insert into public.order_events(workspace_id,order_id,event_type,performed_by_user_id,payload)
       values(p_workspace_id,root.order_id,'edited',actor,jsonb_build_object('action','instruction_text_changed','commandId',v_command_id));
   end if;
   insert into private.fulfillment_instruction_receipts values(p_workspace_id,v_command_id,actor,p_work_item_id,p_command);
   return public.clair_get_fulfillment_instruction(p_workspace_id,p_work_item_id);
 end if;
 is_set:=(doc->>'isSet')::boolean;
 main:=(doc->>'mainAssigneeId')::uuid;
 if action in ('claim','start','resume','unassign','complete_all') and not coalesce((doc->>case action
   when 'claim' then 'canClaim' when 'start' then 'canStart' when 'resume' then 'canResume'
   when 'unassign' then 'canUnassign' else 'canCompleteAll' end)::boolean,false) then
   raise exception 'permission_missing' using errcode='42501'; end if;
 if action in ('assign','complete','reopen','start_item') then
   select x into item from jsonb_array_elements(doc->'items') x where x->>'id'=target::text;
   if item is null then raise exception 'work_item_unavailable'; end if;
   if not coalesce((item->>case action when 'assign' then 'canAssign' when 'complete' then 'canComplete' when 'start_item' then 'canComplete' else 'canReopen' end)::boolean,false)
   then raise exception 'permission_missing' using errcode='42501'; end if;
 end if;
 if action='assign' and (assignee is null or not private.clair_user_has_workspace_permission(p_workspace_id,assignee,
   private.clair_queue_permission_for_destination(doc->>'queueType','mutate')) or not exists(select 1 from public.user_memberships m
   join public.users u on u.id=m.user_id where m.workspace_id=p_workspace_id and m.user_id=assignee and m.status='active' and u.status='active'))
 then raise exception 'permission_missing' using errcode='42501'; end if;
 if action in ('complete','complete_all') and exists(select 1 from jsonb_array_elements(doc->'items') x
   where (target is null or x->>'id'=target::text) and x->>'status' not in ('completed','cancelled','returned')
   and (x->>'resultRequired')::boolean) then raise exception 'actual_execution_result_required'; end if;
 if action='reopen' and (exists(select 1 from public.orders o where o.workspace_id=p_workspace_id
   and o.id in (root.order_id,(item->>'orderId')::uuid) and o.invoice_line_id is not null)
   or exists(select 1 from public.order_billing_candidates c where c.workspace_id=p_workspace_id
   and c.order_id in (root.order_id,(item->>'orderId')::uuid) and (c.status='invoice_linked' or c.invoice_line_id is not null)))
 then raise exception 'billing_locked'; end if;
 insert into private.fulfillment_instruction_state(workspace_id,root_task_id,queue_type,main_assignee_id,finalized)
 values(p_workspace_id,root.id,doc->>'queueType',main,(doc->>'finalized')::boolean) on conflict do nothing;
 if action='claim' then main:=actor; elsif action='unassign' then main:=null;
 elsif action='assign' and not is_set then main:=assignee; end if;
 update private.fulfillment_instruction_state set main_assignee_id=main,revision=revision+1,
 finalized=case when action='reopen' then false when action='complete_all' or (action='complete' and not is_set) then true else finalized end
 where workspace_id=p_workspace_id and root_task_id=root.id and queue_type=doc->>'queueType';
 for item in select x from jsonb_array_elements(doc->'items') x
   where target is null or x->>'id'=target::text loop
   select * into wi from public.order_fulfillment_work_items where workspace_id=p_workspace_id and id=(item->>'id')::uuid;
   select * into task from public.order_tasks where workspace_id=p_workspace_id and id=wi.task_id;
   if action='start' and wi.status<>'requested' then continue; end if;
   if action='resume' and wi.status<>'paused' then continue; end if;
   if wi.status in ('cancelled','returned') or (wi.status='completed' and action<>'reopen') then continue; end if;
   if action in ('claim','unassign') and wi.assigned_to_user_id is not null and wi.assigned_to_user_id<>actor then continue; end if;
   next_status:=case when action in ('complete','complete_all') then 'completed' when action in ('start','resume','reopen','start_item') then 'in_progress'
     when action='unassign' and wi.status in ('in_progress','paused') then 'paused' else wi.status end;
   assignee:=case when action='assign' then (p_command->>'assigneeId')::uuid when action='claim' then actor
     when action='unassign' then null else wi.assigned_to_user_id end;
   if action='reopen' then
     insert into private.fulfillment_instruction_reopen_scope values(txid_current(),p_workspace_id,task.id,actor) on conflict do nothing;
   end if;
   if next_status='completed' then
     insert into private.fulfillment_instruction_completion_scope values(txid_current(),p_workspace_id,wi.id,task.id,actor,v_command_id) on conflict do nothing;
   end if;
   update public.order_tasks set result_snapshot=case when next_status='completed' and execution_result_schema_version=0 then coalesce(result_snapshot,
       jsonb_build_object('source','queue_projection','workItemId',wi.id,'completedAt',now())) else result_snapshot end,
     status=case next_status when 'completed' then 'complete' when 'requested' then 'pending' else next_status end,
     assigned_to_user_id=assignee,assigned_by_user_id=case when assignee is null then null when assignee is distinct from task.assigned_to_user_id then actor else assigned_by_user_id end,
     assigned_at=case when assignee is null then null when assignee is distinct from task.assigned_to_user_id then now() else assigned_at end,
     started_at=case when next_status in ('in_progress','completed','paused') then coalesce(started_at,now()) else started_at end,
     started_by_user_id=case when next_status in ('in_progress','completed','paused') then coalesce(started_by_user_id,actor) else started_by_user_id end,
     completed_at=case when next_status='completed' then now() when action='reopen' then null else completed_at end,
     row_revision=row_revision+1,updated_at=now()
   where workspace_id=p_workspace_id and id=task.id;
   update public.order_fulfillment_work_items set status=next_status,assigned_to_user_id=assignee,
     assigned_by_user_id=case when assignee is null then null when assignee is distinct from wi.assigned_to_user_id then actor else assigned_by_user_id end,
     assigned_at=case when assignee is null then null when assignee is distinct from wi.assigned_to_user_id then now() else assigned_at end,
     started_at=case when next_status in ('in_progress','completed','paused') then coalesce(started_at,now()) else started_at end,
     started_by_user_id=case when next_status in ('in_progress','completed','paused') then coalesce(started_by_user_id,actor) else started_by_user_id end,
     completed_at=case when next_status='completed' then now() when action='reopen' then null else completed_at end,
     row_revision=row_revision+1,updated_at=now()
   where workspace_id=p_workspace_id and id=wi.id;
   if action in ('complete','complete_all','reopen','start','resume','start_item') then
     update public.orders set status=case when next_status='completed' then 'completed' else 'in_progress' end,
       work_status=case when next_status='completed' then 'completed' else 'pending' end,
       task_status=case when next_status='completed' then 'complete' else 'in_progress' end,updated_at=now()
     where workspace_id=p_workspace_id and id=wi.order_id;
   end if;
   if next_status='completed' and coalesce((wi.source_snapshot->>'billingReflectionEnabled')::boolean,true) then
     if exists(select 1 from public.order_billing_candidates c where c.workspace_id=p_workspace_id and c.encounter_id=wi.encounter_id and c.order_id=wi.order_id and c.status='candidate_created') then
       perform private.clair_link_chart_order_billing_candidates_internal(p_workspace_id,actor,wi.encounter_id,array[wi.order_id]);
     else
       perform public.clair_sync_billing_invoice_candidates_from_fulfillment(p_workspace_id,actor,wi.encounter_id,array[wi.order_id]);
     end if;
   end if;
   if action<>'reopen' then
     event_type:=case action when 'claim' then 'assigned' when 'assign' then 'assigned' when 'unassign' then 'assigned'
       when 'start' then 'started' when 'start_item' then 'started' when 'resume' then 'resumed' else 'completed' end;
     insert into public.order_task_events(workspace_id,task_id,task_attempt_no,order_id,event_type,actor_user_id,before_values,after_values)
     values(p_workspace_id,task.id,task.attempt_no,task.order_id,event_type,actor,
       jsonb_build_object('status',wi.status,'assignedToUserId',wi.assigned_to_user_id),
       jsonb_build_object('status',next_status,'assignedToUserId',assignee,'action',action,'commandId',v_command_id));
     insert into public.order_events(workspace_id,order_id,event_type,performed_by_user_id,payload)
     values(p_workspace_id,task.order_id,case when next_status='completed' then 'completed' else 'edited' end,actor,
       jsonb_build_object('action','instruction_update','instructionAction',action,'commandId',v_command_id));
   end if;
 end loop;
 if is_set then
   if action in ('claim','unassign') then
     update public.order_tasks set assigned_to_user_id=main,
       assigned_by_user_id=case when main is null then null else actor end,
       assigned_at=case when main is null then null else now() end
     where workspace_id=p_workspace_id and id=root.id;
   end if;
   if action in ('claim','unassign','complete_all') then
     insert into public.order_task_events(workspace_id,task_id,task_attempt_no,order_id,event_type,actor_user_id,before_values,after_values)
     values(p_workspace_id,root.id,root.attempt_no,root.order_id,case when action='complete_all' then 'completed' else 'assigned' end,actor,
       jsonb_build_object('mainAssigneeId',doc->'mainAssigneeId','finalized',doc->'finalized'),
       jsonb_build_object('mainAssigneeId',main,'action',action,'commandId',v_command_id));
   end if;
   if action='reopen' then insert into private.fulfillment_instruction_reopen_scope values(txid_current(),p_workspace_id,root.id,actor) on conflict do nothing; end if;
   next_status:=private.clair_calculate_aggregate_task_status(p_workspace_id,root.id);
   update public.order_tasks set status=next_status,
     started_at=case when next_status in ('in_progress','partial_complete','complete','paused') then coalesce(started_at,now()) else started_at end,
     started_by_user_id=case when next_status in ('in_progress','partial_complete','complete','paused') then coalesce(started_by_user_id,actor) else started_by_user_id end,
     completed_at=case when next_status='complete' then coalesce(completed_at,now()) when action='reopen' then null else completed_at end,
     row_revision=row_revision+1,updated_at=now() where workspace_id=p_workspace_id and id=root.id;
   if next_status in ('complete','in_progress','partial_complete','paused') then
     update public.orders set status=case when next_status='complete' then 'completed' else 'in_progress' end,
       work_status=case when next_status='complete' then 'completed' else 'pending' end,
       task_status=case when next_status='paused' then 'in_progress' else next_status end,updated_at=now()
     where workspace_id=p_workspace_id and id=root.order_id;
   end if;
 end if;
 delete from private.fulfillment_instruction_completion_scope where transaction_id=txid_current() and workspace_id=p_workspace_id and actor_id=actor and command_id=v_command_id;
 delete from private.fulfillment_instruction_reopen_scope where transaction_id=txid_current() and workspace_id=p_workspace_id;
 insert into private.fulfillment_instruction_receipts values(p_workspace_id,v_command_id,actor,p_work_item_id,p_command);
 return public.clair_get_fulfillment_instruction(p_workspace_id,p_work_item_id);
end $$;
revoke all on function public.clair_mutate_fulfillment_instruction(text,uuid,jsonb) from public,anon,service_role;
grant execute on function public.clair_mutate_fulfillment_instruction(text,uuid,jsonb) to authenticated;

commit;
