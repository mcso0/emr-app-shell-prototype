-- Local candidate: approved instruction review; remote apply requires confirmation.
-- Preserve requester completion, main/item roles, RLS, immutable results and billing.
-- No data repair/backfill and no changes to other queues' transition rules.
begin;
set local lock_timeout='5s';
set local statement_timeout='120s';

do $patch$
declare d text; old text; replacement text;
begin
 d:=pg_get_functiondef('public.clair_mutate_fulfillment_instruction(text,uuid,jsonb)'::regprocedure);
 old:=$old$ if action='assign' and (assignee is null$old$;
 replacement:=$new$ -- Completion is a separate requester exception. Starting work requires an
 -- assigned item and a current main/item executor with queue permission.
 if action='start_item' and (item->>'assigneeId' is null
   or not (coalesce(main=actor,false) or item->>'assigneeId'=actor::text)
   or not private.clair_current_user_has_workspace_permission(p_workspace_id,
     private.clair_queue_permission_for_destination(doc->>'queueType','mutate'))) then
   raise exception 'permission_missing' using errcode='42501'; end if;
 if action in ('start','resume') and exists(select 1 from jsonb_array_elements(doc->'items') x
   where x->>'status'=case action when 'start' then 'requested' else 'paused' end
   and x->>'assigneeId' is null) then
   raise exception 'permission_missing' using errcode='42501'; end if;
 if action='assign' and (assignee is null$new$;
 if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'instruction_start_owner_anchor'; end if;
 d:=replace(d,old,replacement);
 old:=$old$when action in ('start','resume','reopen','start_item') then 'in_progress'$old$;
 replacement:=$new$when action in ('claim','start','resume','reopen','start_item') then 'in_progress'$new$;
 if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'instruction_claim_status_anchor'; end if;
 d:=replace(d,old,replacement);
 old:=$old$if action in ('complete','complete_all','reopen','start','resume','start_item') then$old$;
 replacement:=$new$if action in ('claim','complete','complete_all','reopen','start','resume','start_item') then$new$;
 if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'instruction_claim_order_anchor'; end if;
 d:=replace(d,old,replacement);
 execute d;
end $patch$;

do $patch$
declare d text; old text; replacement text;
begin
 d:=pg_get_functiondef('public.clair_record_order_execution_result(text,uuid,uuid,bigint,text,integer,uuid,timestamptz,jsonb,text,text)'::regprocedure);
 old:=$old$if wi.status<>'in_progress' or t.status<>'in_progress' or t.result_snapshot is not null or amendment is not null then raise exception 'invalid_transition'; end if;$old$;
 replacement:=$new$if not (wi.status='in_progress' and t.status='in_progress'
      or wi.queue_type in ('dispensing','treatment')
        and ((wi.status='requested' and t.status='pending') or (wi.status='paused' and t.status='paused'))
        and private.clair_instruction_can_manage_item(p_workspace_id,wi.id,p_actor_user_id))
      or t.result_snapshot is not null or amendment is not null then raise exception 'invalid_transition'; end if;$new$;
 if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'instruction_direct_result_anchor'; end if;
 d:=replace(d,old,replacement);
 execute d;
end $patch$;

do $patch$
declare d text; old text; replacement text;
begin
 d:=pg_get_functiondef('public.clair_transition_fulfillment_work_item(text,uuid,uuid,text,bigint,uuid,uuid,text,text)'::regprocedure);
 old:=$old$elsif p_action = 'complete' then
    if v_item.status <> 'in_progress' then raise exception 'invalid_transition'; end if;$old$;
 replacement:=$new$elsif p_action = 'complete' then
    if v_item.status <> 'in_progress' and not (
      v_item.queue_type in ('dispensing','treatment') and v_item.status in ('requested','paused')
      and private.clair_instruction_has_completion_scope(p_workspace_id,p_work_item_id,p_actor_user_id)
    ) then raise exception 'invalid_transition'; end if;$new$;
 if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'instruction_scoped_complete_anchor'; end if;
 d:=replace(d,old,replacement);
 old:=$old$    started_by_user_id = case when p_action = 'start'
      then p_actor_user_id else task.started_by_user_id end,
    started_at = case when p_action = 'start'
      then v_now else task.started_at end,
$old$;
 replacement:=$new$    started_by_user_id = case when p_action = 'start' then p_actor_user_id
      when p_action='complete' and private.clair_instruction_has_completion_scope(p_workspace_id,p_work_item_id,p_actor_user_id)
      then coalesce(task.started_by_user_id,p_actor_user_id) else task.started_by_user_id end,
    started_at = case when p_action = 'start' then v_now
      when p_action='complete' and private.clair_instruction_has_completion_scope(p_workspace_id,p_work_item_id,p_actor_user_id)
      then coalesce(task.started_at,v_now) else task.started_at end,
$new$;
 if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'instruction_task_timestamps_anchor'; end if;
 d:=replace(d,old,replacement);
 old:=$old$    started_by_user_id = case when p_action = 'start'
      then p_actor_user_id else item.started_by_user_id end,
    started_at = case when p_action = 'start' then v_now else item.started_at end,
$old$;
 replacement:=$new$    started_by_user_id = case when p_action = 'start' then p_actor_user_id
      when p_action='complete' and private.clair_instruction_has_completion_scope(p_workspace_id,p_work_item_id,p_actor_user_id)
      then coalesce(item.started_by_user_id,p_actor_user_id) else item.started_by_user_id end,
    started_at = case when p_action = 'start' then v_now
      when p_action='complete' and private.clair_instruction_has_completion_scope(p_workspace_id,p_work_item_id,p_actor_user_id)
      then coalesce(item.started_at,v_now) else item.started_at end,
$new$;
 if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'instruction_item_timestamps_anchor'; end if;
 d:=replace(d,old,replacement);
 execute d;
end $patch$;

do $patch$
declare d text; old text; replacement text;
begin
 d:=pg_get_functiondef('public.clair_get_fulfillment_instruction(text,uuid)'::regprocedure);
 old:=$old$exists(select 1 from jsonb_array_elements(items) x where x->>'status'='requested')$old$;
 replacement:=$new$exists(select 1 from jsonb_array_elements(items) x where x->>'status'='requested') and not exists(select 1 from jsonb_array_elements(items) x where x->>'status'='requested' and x->>'assigneeId' is null)$new$;
 if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'instruction_can_start_anchor'; end if;
 d:=replace(d,old,replacement);
 old:=$old$exists(select 1 from jsonb_array_elements(items) x where x->>'status'='paused')$old$;
 replacement:=$new$exists(select 1 from jsonb_array_elements(items) x where x->>'status'='paused') and not exists(select 1 from jsonb_array_elements(items) x where x->>'status'='paused' and x->>'assigneeId' is null)$new$;
 if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'instruction_can_resume_anchor'; end if;
 d:=replace(d,old,replacement);
 old:=$old$    nullif(btrim(w.source_snapshot->>'name'),''),'오더')$old$;
 replacement:=$new$    nullif(btrim(w.source_snapshot->>'effectiveDisplayName'),''),
    nullif(btrim(child.effective_snapshot->>'effectiveDisplayName'),''),
    nullif(btrim(w.source_snapshot->>'inHospitalOrderName'),''),
    nullif(btrim(child.effective_snapshot->>'inHospitalOrderName'),''),
    nullif(btrim(w.source_snapshot->>'standardOrderName'),''),
    nullif(btrim(child.effective_snapshot->>'standardOrderName'),''),
    nullif(btrim(w.source_snapshot->>'billingName'),''),
    nullif(btrim(w.source_snapshot->>'name'),''),
    nullif(btrim(child.effective_snapshot->>'name'),''),'오더')$new$;
 if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'instruction_item_name_anchor'; end if;
 d:=replace(d,old,replacement);
 old:=$old$    nullif(btrim(root.effective_snapshot->>'name'),''),'오더')$old$;
 replacement:=$new$    nullif(btrim(root.effective_snapshot->>'effectiveDisplayName'),''),
    nullif(btrim(root.effective_snapshot->>'inHospitalOrderName'),''),
    nullif(btrim(root.effective_snapshot->>'standardOrderName'),''),
    nullif(btrim(root.effective_snapshot->>'billingName'),''),
    nullif(btrim(root.effective_snapshot->>'name'),''),'오더')$new$;
 if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'instruction_root_name_anchor'; end if;
 d:=replace(d,old,replacement);
 execute d;
end $patch$;

commit;
