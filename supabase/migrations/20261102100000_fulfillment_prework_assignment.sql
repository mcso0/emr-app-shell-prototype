-- Approved local candidate. No remote application or data backfill.
-- Separate ownership from execution; preserve requester completion and RLS.
begin;
set local lock_timeout='5s';
set local statement_timeout='120s';

-- Only the canonical instruction command calls this private producer.
create function private.clair_emit_instruction_takeover(
 wi public.order_fulfillment_work_items, root_id uuid, previous_owner uuid,
 next_owner uuid, change_reason text, command_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare token text; previous_name text; next_name text; v_notification_id text;
begin
 token:='takeover:'||root_id||':'||wi.queue_type||':'||command_id;
 select display_name into previous_name from public.users where id=previous_owner;
 select display_name into next_name from public.users where id=next_owner;
 perform private.clair_emit_instruction_notifications(wi,'order_assigned','요청한 업무의 담당자가 변경되었습니다',array[wi.requested_by_user_id],token);
 v_notification_id:='instruction:'||token||':order_assigned:'||wi.requested_by_user_id;
 update public.notification_events n set
   preview=left(coalesce(previous_name,'이전 담당자')||' → '||coalesce(next_name,'새 담당자'),240),
   detail=left(coalesce(previous_name,'이전 담당자')||' → '||coalesce(next_name,'새 담당자')||E'\n변경 사유: '||change_reason,1000),
   source_payload=n.source_payload||jsonb_build_object('previousAssigneeId',previous_owner,'assigneeId',next_owner,
     'reason',change_reason,'queueType',wi.queue_type,'commandId',command_id,'rootTaskId',root_id)
 where n.workspace_id=wi.workspace_id and n.notification_id=v_notification_id;
end $$;
revoke all on function private.clair_emit_instruction_takeover(public.order_fulfillment_work_items,uuid,uuid,uuid,text,uuid) from public,anon,authenticated,service_role;

do $patch$
declare d text; old text; replacement text;
begin
 d:=pg_get_functiondef('public.clair_get_fulfillment_instruction(text,uuid)'::regprocedure);
 old:=$old$ 'canClaim',main is null$old$;
 replacement:=$new$ 'canTakeover',coalesce(main<>actor and mutate and not finalized,false)
   and root.status not in ('complete','cancelled','returned')
   and jsonb_array_length(items)>0
   and not exists(select 1 from jsonb_array_elements(items) x where x->>'status'<>'requested'),
 'canClaim',main is null$new$;
 if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'prework_clair_get_fulfillment_instruction_0_anchor'; end if;
 d:=replace(d,old,replacement);
 old:=$old$return jsonb_build_object('rootOrderId',root.order_id,'rootTaskId',root.id,$old$;
 replacement:=$new$return jsonb_build_object('encounterNo',(select to_jsonb(e)->>'encounter_no' from public.encounters e where e.workspace_id=p_workspace_id and e.id=wi.encounter_id),'rootOrderId',root.order_id,'rootTaskId',root.id,$new$;
 if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'prework_encounter_number_anchor'; end if;
 d:=replace(d,old,replacement);
 execute d;
end $patch$;

do $patch$
declare d text; old text; replacement text;
begin
 d:=pg_get_functiondef('public.clair_mutate_fulfillment_instruction(text,uuid,jsonb)'::regprocedure);
 old:=$old$('claim','start','resume','unassign','assign','complete','complete_all','reopen','edit_instruction','start_item')$old$;
 replacement:=$new$('claim','takeover','start','resume','unassign','assign','complete','complete_all','reopen','edit_instruction','start_item')$new$;
 if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'prework_clair_mutate_fulfillment_instruction_0_anchor'; end if;
 d:=replace(d,old,replacement);
 old:=$old$('action','commandId','expectedRevision','itemId','assigneeId','instruction')$old$;
 replacement:=$new$('action','commandId','expectedRevision','itemId','assigneeId','instruction','reason')$new$;
 if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'prework_clair_mutate_fulfillment_instruction_1_anchor'; end if;
 d:=replace(d,old,replacement);
 old:=$old$   or (action<>'edit_instruction' and p_command ? 'instruction')$old$;
 replacement:=$new$   or (action<>'takeover' and p_command ? 'reason')
   or (action='takeover' and (not p_command ? 'reason' or jsonb_typeof(p_command->'reason')<>'string' or length(p_command->>'reason')>1000 or (p_command->>'reason') !~ '[^[:space:]]'))
   or (action<>'edit_instruction' and p_command ? 'instruction')$new$;
 if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'prework_clair_mutate_fulfillment_instruction_2_anchor'; end if;
 d:=replace(d,old,replacement);
 old:=$old$ if action in ('claim','start','resume','unassign','complete_all') and not coalesce((doc->>case action$old$;
 replacement:=$new$ if action in ('claim','takeover','start','resume','unassign','complete_all') and not coalesce((doc->>case action$new$;
 if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'prework_clair_mutate_fulfillment_instruction_3_anchor'; end if;
 d:=replace(d,old,replacement);
 old:=$old$when 'claim' then 'canClaim' when 'start'$old$;
 replacement:=$new$when 'claim' then 'canClaim' when 'takeover' then 'canTakeover' when 'start'$new$;
 if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'prework_clair_mutate_fulfillment_instruction_4_anchor'; end if;
 d:=replace(d,old,replacement);
 old:=$old$if action='claim' then main:=actor;$old$;
 replacement:=$new$if action in ('claim','takeover') then main:=actor;$new$;
 if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'prework_clair_mutate_fulfillment_instruction_5_anchor'; end if;
 d:=replace(d,old,replacement);
 old:=$old$when action in ('claim','start','resume','reopen','start_item') then 'in_progress'$old$;
 replacement:=$new$when action in ('start','resume','reopen','start_item') then 'in_progress'$new$;
 if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'prework_clair_mutate_fulfillment_instruction_6_anchor'; end if;
 d:=replace(d,old,replacement);
 old:=$old$when action='claim' then actor$old$;
 replacement:=$new$when action in ('claim','takeover') then actor$new$;
 if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'prework_clair_mutate_fulfillment_instruction_7_anchor'; end if;
 d:=replace(d,old,replacement);
 old:=$old$if action in ('claim','complete','complete_all','reopen','start','resume','start_item') then$old$;
 replacement:=$new$if action in ('complete','complete_all','reopen','start','resume','start_item') then$new$;
 if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'prework_clair_mutate_fulfillment_instruction_8_anchor'; end if;
 d:=replace(d,old,replacement);
 old:=$old$event_type:=case action when 'claim' then 'assigned'$old$;
 replacement:=$new$event_type:=case action when 'takeover' then 'handed_off' when 'claim' then 'assigned'$new$;
 if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'prework_clair_mutate_fulfillment_instruction_9_anchor'; end if;
 d:=replace(d,old,replacement);
 old:=$old$event_type,actor_user_id,before_values,after_values)$old$;
 replacement:=$new$event_type,actor_user_id,before_values,after_values,reason)$new$;
 if (length(d)-length(replace(d,old,'')))/length(old)<>2 then raise exception 'prework_clair_mutate_fulfillment_instruction_10_anchor'; end if;
 d:=replace(d,old,replacement);
 old:=$old$jsonb_build_object('status',next_status,'assignedToUserId',assignee,'action',action,'commandId',v_command_id));$old$;
 replacement:=$new$jsonb_build_object('status',next_status,'assignedToUserId',assignee,'action',action,'commandId',v_command_id,'queueType',doc->>'queueType'),
       case when action='takeover' then btrim(p_command->>'reason') else null end);$new$;
 if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'prework_clair_mutate_fulfillment_instruction_11_anchor'; end if;
 d:=replace(d,old,replacement);
 old:=$old$   if action in ('claim','unassign') then$old$;
 replacement:=$new$   if action in ('claim','takeover','unassign') and not exists(
     select 1 from public.order_tasks sibling join public.order_fulfillment_work_items other
       on other.workspace_id=sibling.workspace_id and other.task_id=sibling.id
       and other.task_attempt_no=sibling.attempt_no
     where sibling.workspace_id=p_workspace_id and sibling.parent_task_id=root.id
       and other.queue_type<>doc->>'queueType') then$new$;
 if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'prework_clair_mutate_fulfillment_instruction_12_anchor'; end if;
 d:=replace(d,old,replacement);
 old:=$old$   if action in ('claim','unassign','complete_all') then$old$;
 replacement:=$new$   if action in ('claim','takeover','unassign','complete_all') then$new$;
 if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'prework_clair_mutate_fulfillment_instruction_13_anchor'; end if;
 d:=replace(d,old,replacement);
 old:=$old$case when action='complete_all' then 'completed' else 'assigned' end,actor,$old$;
 replacement:=$new$case when action='complete_all' then 'completed' when action='takeover' then 'handed_off' else 'assigned' end,actor,$new$;
 if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'prework_clair_mutate_fulfillment_instruction_14_anchor'; end if;
 d:=replace(d,old,replacement);
 old:=$old$jsonb_build_object('mainAssigneeId',main,'action',action,'commandId',v_command_id));$old$;
 replacement:=$new$jsonb_build_object('mainAssigneeId',main,'action',action,'commandId',v_command_id,'queueType',doc->>'queueType'),
       case when action='takeover' then btrim(p_command->>'reason') else null end);$new$;
 if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'prework_clair_mutate_fulfillment_instruction_15_anchor'; end if;
 d:=replace(d,old,replacement);
 old:=$old$ delete from private.fulfillment_instruction_completion_scope$old$;
 replacement:=$new$ if action='takeover' then
   select * into wi from public.order_fulfillment_work_items where workspace_id=p_workspace_id and id=p_work_item_id;
   select * into root_order from public.orders where workspace_id=p_workspace_id and id=root.order_id;
   wi.requested_by_user_id:=root_order.requested_by_user_id;
   perform private.clair_emit_instruction_takeover(wi,root.id,(doc->>'mainAssigneeId')::uuid,actor,btrim(p_command->>'reason'),v_command_id);
 end if;
 delete from private.fulfillment_instruction_completion_scope$new$;
 if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'prework_clair_mutate_fulfillment_instruction_16_anchor'; end if;
 d:=replace(d,old,replacement);
 execute d;
end $patch$;

-- Root lifecycle events carry a queue scope. Text edits still affect all queues.
do $patch$
declare d text; old text; replacement text;
begin
 d:=pg_get_functiondef('private.clair_notify_instruction_root_event()'::regprocedure);
 old:=$old$action text; token text; event_key text; title text;$old$;
 replacement:=$new$action text; token text; event_key text; title text; event_queue text;$new$;
 if strpos(d,old)=0 then raise exception 'prework_notification_declaration_anchor'; end if;
 d:=replace(d,old,replacement);
 old:=$old$action:=new.after_values->>'action'; token:=new.after_values->>'commandId';$old$;
 replacement:=$new$action:=new.after_values->>'action'; token:=new.after_values->>'commandId'; event_queue:=new.after_values->>'queueType';$new$;
 if strpos(d,old)=0 then raise exception 'prework_notification_queue_anchor'; end if;
 d:=replace(d,old,replacement);
 old:=$old$and w.queue_type in ('dispensing','treatment') order by w.queue_type$old$;
 replacement:=$new$and w.queue_type in ('dispensing','treatment') and (event_queue is null or w.queue_type=event_queue) order by w.queue_type$new$;
 if strpos(d,old)=0 then raise exception 'prework_notification_filter_anchor'; end if;
 execute replace(d,old,replacement);
end $patch$;

-- A set main assignee must be eligible for every requested dispensing/treatment child.
create function private.clair_prework_set_assignable(p_workspace_id text, p_order_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.orders c where c.workspace_id=p_workspace_id
   and c.parent_chart_order_line_id=p_order_id and c.status<>'cancelled')
 and not exists(select 1 from public.orders c where c.workspace_id=p_workspace_id
   and c.parent_chart_order_line_id=p_order_id and c.status<>'cancelled'
   and (c.destination_module is null or c.destination_module not in ('dispensing','treatment')))
$$;
create function private.clair_prework_set_assignee_eligible(p_workspace_id text, p_order_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select private.clair_prework_set_assignable(p_workspace_id,p_order_id)
 and not exists(select 1 from public.orders c where c.workspace_id=p_workspace_id
   and c.parent_chart_order_line_id=p_order_id and c.status<>'cancelled'
   and not private.clair_user_has_workspace_permission(p_workspace_id,p_user_id,
     private.clair_queue_permission_for_destination(c.destination_module,'mutate')))
$$;
revoke all on function private.clair_prework_set_assignable(text,uuid) from public,anon,authenticated,service_role;
revoke all on function private.clair_prework_set_assignee_eligible(text,uuid,uuid) from public,anon,authenticated,service_role;

create or replace function public.clair_list_order_intended_assignees(
  p_workspace_id text,
  p_order_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_order public.orders%rowtype;
  v_permission text;
begin
  if auth.uid() is null
    or not private.clair_is_active_workspace_member(p_workspace_id)
    or not private.clair_current_user_has_workspace_permission(
      p_workspace_id, 'chart:update'
    )
  then raise exception 'permission_missing' using errcode = '42501'; end if;
  select orders.* into v_order
  from public.orders orders
  where orders.workspace_id = p_workspace_id and orders.id = p_order_id;
  if not found or (v_order.destination_module is null and not (v_order.row_type='set' and private.clair_prework_set_assignable(p_workspace_id,p_order_id)))
    or v_order.order_confirmation_status not in ('draft','pending')
  then raise exception 'order_unavailable'; end if;
  if v_order.parent_chart_order_line_id is not null and private.clair_prework_set_assignable(p_workspace_id,v_order.parent_chart_order_line_id)
  then raise exception 'order_unavailable'; end if;
  v_permission := private.clair_queue_permission_for_destination(
    v_order.destination_module, 'mutate'
  );
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'userId', app_user.id,
      'displayName', app_user.display_name,
      'department', membership.department,
      'title', membership.title
    ) order by app_user.display_name, app_user.id)
    from public.user_memberships membership
    join public.users app_user on app_user.id = membership.user_id
    where membership.workspace_id = p_workspace_id
      and membership.status = 'active'
      and app_user.status = 'active'
      and case when v_order.row_type='set' then private.clair_prework_set_assignee_eligible(p_workspace_id,p_order_id,app_user.id)
      else private.clair_user_has_workspace_permission(p_workspace_id,app_user.id,v_permission) end
  ), '[]'::jsonb);
end;
$function$;

create or replace function public.clair_save_order_intended_assignee(
  p_workspace_id text,
  p_actor_user_id uuid,
  p_order_id uuid,
  p_expected_order_updated_at timestamptz,
  p_intended_assignee_user_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $function$
declare
  v_order public.orders%rowtype;
  v_command public.order_intended_assignee_commands%rowtype;
  v_key text := btrim(coalesce(p_idempotency_key, ''));
  v_hash text;
  v_permission text;
  v_result jsonb;
  v_now timestamptz := now();
  v_actor_membership_id uuid;
  v_previous_assignee uuid;
begin
  if auth.uid() is null or p_actor_user_id is distinct from auth.uid()
    or not private.clair_is_active_workspace_member(p_workspace_id)
    or not private.clair_current_user_has_workspace_permission(
      p_workspace_id, 'chart:update'
    )
  then raise exception 'permission_missing' using errcode = '42501'; end if;
  if p_expected_order_updated_at is null
    or length(v_key) not between 8 and 160
  then raise exception 'invalid_intended_assignee_input'; end if;
  v_hash := encode(digest(jsonb_build_object(
    'actorUserId', p_actor_user_id,
    'orderId', p_order_id,
    'expectedOrderUpdatedAt', p_expected_order_updated_at,
    'intendedAssigneeUserId', p_intended_assignee_user_id
  )::text, 'sha256'), 'hex');
  perform pg_advisory_xact_lock(hashtextextended(
    'order_intended_assignee:' || p_workspace_id || ':' || v_key, 0
  ));
  select * into v_command
  from public.order_intended_assignee_commands command
  where command.workspace_id = p_workspace_id
    and command.idempotency_key = v_key;
  if found then
    if v_command.request_sha256 is distinct from v_hash
      or v_command.order_id is distinct from p_order_id
    then raise exception 'idempotency_conflict'; end if;
    if v_command.result is null then
      raise exception 'intended_assignee_command_in_progress';
    end if;
    return v_command.result;
  end if;

  select orders.* into v_order
  from public.orders orders
  where orders.workspace_id = p_workspace_id and orders.id = p_order_id
  for update;
  if not found or (v_order.destination_module is null and not (v_order.row_type='set' and private.clair_prework_set_assignable(p_workspace_id,p_order_id)))
    or v_order.order_confirmation_status not in ('draft','pending')
    or v_order.invoice_line_id is not null
  then raise exception 'order_unavailable'; end if;
  if v_order.parent_chart_order_line_id is not null and private.clair_prework_set_assignable(p_workspace_id,v_order.parent_chart_order_line_id)
  then raise exception 'order_unavailable'; end if;
  if v_order.updated_at is distinct from p_expected_order_updated_at then
    raise exception 'revision_conflict';
  end if;
  v_permission := private.clair_queue_permission_for_destination(
    v_order.destination_module, 'mutate'
  );
  if p_intended_assignee_user_id is not null
    and not (case when v_order.row_type='set' then private.clair_prework_set_assignee_eligible(p_workspace_id,p_order_id,p_intended_assignee_user_id)
    else private.clair_user_has_workspace_permission(p_workspace_id,p_intended_assignee_user_id,v_permission) end)
  then raise exception 'assignee_ineligible' using errcode = '42501'; end if;
  v_previous_assignee := v_order.current_assignee_user_id;

  insert into public.order_intended_assignee_commands (
    workspace_id, order_id, idempotency_key, request_sha256,
    expected_order_updated_at, intended_assignee_user_id,
    created_by_user_id, created_at
  ) values (
    p_workspace_id, p_order_id, v_key, v_hash,
    p_expected_order_updated_at, p_intended_assignee_user_id,
    p_actor_user_id, v_now
  ) returning * into v_command;

  update public.orders orders
  set current_assignee_user_id = p_intended_assignee_user_id,
      updated_at = v_now
  where orders.workspace_id = p_workspace_id and orders.id = p_order_id
  returning * into v_order;
  v_result := jsonb_build_object(
    'orderId', v_order.id,
    'intendedAssigneeUserId', v_order.current_assignee_user_id,
    'updatedAt', v_order.updated_at,
    'commandId', v_command.id
  );
  update public.order_intended_assignee_commands command
  set result = v_result
  where command.workspace_id = p_workspace_id and command.id = v_command.id;

  insert into public.order_events (
    workspace_id, order_id, event_type, performed_by_user_id, payload, created_at
  ) values (
    p_workspace_id, p_order_id, 'edited', p_actor_user_id,
    jsonb_build_object(
      'action', 'intended_assignee_changed',
      'previousAssigneeUserId', v_previous_assignee,
      'intendedAssigneeUserId', p_intended_assignee_user_id,
      'commandId', v_command.id
    ),
    v_now
  );
  select membership.id into v_actor_membership_id
  from public.user_memberships membership
  where membership.workspace_id = p_workspace_id
    and membership.user_id = p_actor_user_id
    and membership.status = 'active'
  order by membership.created_at
  limit 1;
  insert into public.audit_events (
    id, workspace_id, actor_user_id, actor_membership_id,
    event_type, target_type, target_id, encounter_id, request_id,
    before_snapshot, after_snapshot, metadata, occurred_at, created_at
  ) values (
    'order-intended-assignee-' || v_command.id::text,
    p_workspace_id, p_actor_user_id, v_actor_membership_id,
    'order.draft_changed', 'order', p_order_id::text,
    v_order.encounter_id, v_command.id::text,
    jsonb_build_object('intendedAssigneeUserId', v_previous_assignee),
    jsonb_build_object('intendedAssigneeUserId', p_intended_assignee_user_id),
    jsonb_build_object('source', 'order-intended-assignee-v1'),
    v_now, v_now
  );
  return v_result;
end;
$function$;

create or replace function private.clair_apply_intended_assignee_on_confirmation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_assignee uuid;
  v_permission text;
  v_root_task public.order_tasks%rowtype;
  v_main uuid;
begin
  select orders.current_assignee_user_id into v_assignee
  from public.orders orders
  where orders.workspace_id = new.workspace_id and orders.id = new.order_id;
  if new.queue_type in ('dispensing','treatment') then
    select root.* into v_root_task from public.order_tasks child
    join public.order_tasks root on root.workspace_id=child.workspace_id and root.id=child.parent_task_id
    where child.workspace_id=new.workspace_id and child.id=new.task_id and child.attempt_no=new.task_attempt_no;
    if found and new.task_attempt_no=1 and v_root_task.attempt_no=1
      and not exists(select 1 from public.order_tasks child where child.workspace_id=new.workspace_id
        and child.id=new.task_id and child.re_requested_from_task_id is not null)
      and private.clair_prework_set_assignable(new.workspace_id,v_root_task.order_id) then
      select o.current_assignee_user_id into v_main from public.orders o
      where o.workspace_id=new.workspace_id and o.id=v_root_task.order_id;
      -- The request has one set owner; individual executors can diverge only after request.
      v_assignee:=v_main;
      if v_main is null then
        new.assigned_to_user_id:=null;
        new.assigned_by_user_id:=null;
        new.assigned_at:=null;
        update public.order_tasks set assigned_to_user_id=null,assigned_by_user_id=null,assigned_at=null
        where workspace_id=new.workspace_id and (id=v_root_task.id or (id=new.task_id and attempt_no=new.task_attempt_no));
      end if;
      if v_main is not null then
        if not private.clair_prework_set_assignee_eligible(new.workspace_id,v_root_task.order_id,v_main)
        then raise exception 'assignee_ineligible' using errcode='42501'; end if;
        insert into private.fulfillment_instruction_state(workspace_id,root_task_id,queue_type,main_assignee_id)
        values(new.workspace_id,v_root_task.id,new.queue_type,v_main)
        on conflict(workspace_id,root_task_id,queue_type) do nothing;
        update public.order_tasks set assigned_to_user_id=v_main,
          assigned_by_user_id=new.requested_by_user_id,assigned_at=new.created_at
        where workspace_id=new.workspace_id and id=v_root_task.id;
      end if;
    end if;
  end if;
  if v_assignee is null then return new; end if;
  v_permission := private.clair_queue_permission_for_destination(
    coalesce(new.destination_module, new.queue_type), 'mutate'
  );
  if not private.clair_user_has_workspace_permission(
    new.workspace_id, v_assignee, v_permission
  ) then raise exception 'assignee_ineligible' using errcode = '42501'; end if;

  new.assigned_to_user_id := v_assignee;
  new.assigned_by_user_id := new.requested_by_user_id;
  new.assigned_at := new.created_at;
  update public.order_tasks task
  set assigned_to_user_id = v_assignee,
      assigned_by_user_id = new.requested_by_user_id,
      assigned_at = new.created_at,
      updated_at = greatest(task.updated_at, new.created_at)
  where task.workspace_id = new.workspace_id
    and task.id = new.task_id
    and task.attempt_no = new.task_attempt_no;
  insert into public.order_task_events (
    workspace_id, task_id, task_attempt_no, order_id, event_type,
    actor_user_id, before_values, after_values, created_at
  ) values (
    new.workspace_id, new.task_id, new.task_attempt_no, new.order_id,
    'assigned', new.requested_by_user_id,
    jsonb_build_object('assignedToUserId', null),
    jsonb_build_object(
      'assignedToUserId', v_assignee,
      'source', 'confirmed_intended_assignee'
    ),
    new.created_at
  );
  return new;
end;
$function$;

commit;
