-- Keep the instruction RPC's existing permissions, locking and replay boundary.
begin;
set local lock_timeout='5s';
set local statement_timeout='120s';

create function pg_temp.patch_assignment_start(definition text, old text, replacement text)
returns text language plpgsql as $$
begin
  if (length(definition)-length(replace(definition,old,'')))/length(old)<>1 then
    raise exception 'fulfillment_assign_and_start patch drift: %',old;
  end if;
  return replace(definition,old,replacement);
end $$;

do $patch$
declare d text;
begin
  d:=pg_get_functiondef('public.clair_mutate_fulfillment_instruction(text,uuid,jsonb)'::regprocedure);

  d:=pg_temp.patch_assignment_start(d,
    $old$event_type text; main uuid; is_set boolean;$old$,
    $new$event_type text; main uuid; is_set boolean; start_on_assignment boolean:=p_command ? 'startWork';$new$);
  d:=pg_temp.patch_assignment_start(d,
    $old$'itemId','assigneeId','instruction','reason')$old$,
    $new$'itemId','assigneeId','instruction','reason','startWork')$new$);
  d:=pg_temp.patch_assignment_start(d,
    $old$   or (action<>'takeover' and p_command ? 'reason')$old$,
    $new$   or (start_on_assignment and (action not in ('claim','takeover') or p_command->'startWork' is distinct from 'true'::jsonb))
   or (action<>'takeover' and p_command ? 'reason')$new$);
  d:=pg_temp.patch_assignment_start(d,
    $old$ if action in ('assign','complete','reopen','start_item') then
   select x into item$old$,
    $new$ if start_on_assignment and (jsonb_array_length(doc->'items')=0
   or exists(select 1 from jsonb_array_elements(doc->'items') x where x->>'status'<>'requested')) then
   raise exception 'invalid_transition'; end if;
 if action in ('assign','complete','reopen','start_item') then
   select x into item$new$);

  -- As with explicit start, begin all requested items in this queue. An existing
  -- child executor stays assigned on claim. Takeover keeps its ownership rules.
  d:=pg_temp.patch_assignment_start(d,
    $old$if action in ('claim','unassign') and wi.assigned_to_user_id is not null$old$,
    $new$if (action='unassign' or (action='claim' and not start_on_assignment)) and wi.assigned_to_user_id is not null$new$);
  d:=pg_temp.patch_assignment_start(d,
    $old$when action in ('start','resume','reopen','start_item') then 'in_progress'$old$,
    $new$when start_on_assignment or action in ('start','resume','reopen','start_item') then 'in_progress'$new$);
  d:=pg_temp.patch_assignment_start(d,
    $old$when action in ('claim','takeover') then actor$old$,
    $new$when action='claim' then coalesce(wi.assigned_to_user_id,actor) when action='takeover' then actor$new$);
  d:=pg_temp.patch_assignment_start(d,
    $old$if action in ('claim','start','resume','start_item','reopen','complete','complete_all') and next_status in ('in_progress','completed') then$old$,
    $new$if (start_on_assignment or action in ('claim','start','resume','start_item','reopen','complete','complete_all')) and next_status in ('in_progress','completed') then$new$);
  d:=pg_temp.patch_assignment_start(d,
    $old$if action in ('complete','complete_all','reopen','start','resume','start_item') then$old$,
    $new$if start_on_assignment or action in ('complete','complete_all','reopen','start','resume','start_item') then$new$);
  d:=pg_temp.patch_assignment_start(d,
    $old$     insert into public.order_events(workspace_id,order_id,event_type,performed_by_user_id,payload)
     values(p_workspace_id,task.order_id,$old$,
    $new$     if start_on_assignment then
       insert into public.order_task_events(workspace_id,task_id,task_attempt_no,order_id,event_type,actor_user_id,before_values,after_values)
       values(p_workspace_id,task.id,task.attempt_no,task.order_id,'started',actor,
         jsonb_build_object('status',wi.status,'assignedToUserId',wi.assigned_to_user_id),
         jsonb_build_object('status',next_status,'assignedToUserId',assignee,'action','start','commandId',v_command_id));
     end if;
     insert into public.order_events(workspace_id,order_id,event_type,performed_by_user_id,payload)
     values(p_workspace_id,task.order_id,$new$);
  execute d;
end $patch$;

drop function pg_temp.patch_assignment_start(text,text,text);
commit;
