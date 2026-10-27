-- Extend existing result recording only for the approved instruction roles.
begin;
set local lock_timeout='5s';
set local statement_timeout='120s';

create function private.clair_instruction_can_manage_item(p_workspace_id text,p_work_item_id uuid,p_actor_id uuid)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare d jsonb; item jsonb;
begin
 if p_actor_id is null or p_actor_id is distinct from auth.uid() then return false; end if;
 if not exists(select 1 from public.order_fulfillment_work_items where workspace_id=p_workspace_id
   and id=p_work_item_id and queue_type in ('dispensing','treatment')) then return false; end if;
 d:=public.clair_get_fulfillment_instruction(p_workspace_id,p_work_item_id);
 select x into item from jsonb_array_elements(d->'items') x where x->>'id'=p_work_item_id::text;
 return coalesce((item->>'canComplete')::boolean,false) or coalesce((item->>'canReopen')::boolean,false);
end $$;
revoke all on function private.clair_instruction_can_manage_item(text,uuid,uuid) from public,anon,authenticated,service_role;

create function private.clair_instruction_requester_can_read_result(p_workspace_id text,p_work_item_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select private.clair_is_active_workspace_member(p_workspace_id)
 and private.clair_current_user_has_workspace_permission(p_workspace_id,'chart:view')
 and exists(select 1 from public.order_fulfillment_work_items wi join public.order_tasks t on t.workspace_id=wi.workspace_id and t.id=wi.task_id
 join public.order_tasks root on root.workspace_id=t.workspace_id and root.id=coalesce(t.parent_task_id,t.id)
 join public.orders o on o.workspace_id=root.workspace_id and o.id=root.order_id
 where wi.workspace_id=p_workspace_id and wi.id=p_work_item_id and wi.queue_type in ('dispensing','treatment') and o.requested_by_user_id=auth.uid());
$$;
revoke all on function private.clair_instruction_requester_can_read_result(text,uuid) from public,anon,authenticated,service_role;

do $patch$
declare d text; old text; replacement text; signature text;
begin
 signature:='private.clair_assert_work_owner(text,uuid,uuid,boolean)';
 d:=pg_get_functiondef(signature::regprocedure);
 old:='if not found or p_actor_user_id is null or wi.assigned_to_user_id is distinct from p_actor_user_id';
 replacement:='if not found or p_actor_user_id is null or (wi.assigned_to_user_id is distinct from p_actor_user_id
   and not (not p_lab and private.clair_instruction_can_manage_item(p_workspace_id,wi.id,p_actor_user_id)))';
 if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'instruction_owner_anchor'; end if;
 execute replace(d,old,replacement);

 d:=pg_get_functiondef(signature::regprocedure);
 old:='if not private.clair_user_has_workspace_permission(p_workspace_id,p_actor_user_id,private.clair_queue_permission_for_destination(coalesce(wi.destination_module,wi.queue_type),''mutate''))';
 replacement:='if not private.clair_user_has_workspace_permission(p_workspace_id,p_actor_user_id,private.clair_queue_permission_for_destination(coalesce(wi.destination_module,wi.queue_type),''mutate''))
   and not (not p_lab and private.clair_instruction_can_manage_item(p_workspace_id,wi.id,p_actor_user_id))';
 if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'instruction_result_permission_anchor'; end if;
 execute replace(d,old,replacement);

 signature:='public.clair_get_order_execution_context(text,uuid,uuid)';
 d:=pg_get_functiondef(signature::regprocedure);
 old:='t.id=wi.task_id and coalesce(wi.assigned_to_user_id=auth.uid(),false) and private.clair_current_user_has_workspace_permission';
 replacement:='t.id=wi.task_id and (private.clair_instruction_can_manage_item(p_workspace_id,wi.id,auth.uid()) or coalesce(wi.assigned_to_user_id=auth.uid(),false) and private.clair_current_user_has_workspace_permission';
 if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'instruction_execution_context_anchor'; end if;
 d:=replace(d,old,replacement);
 old:='private.clair_queue_permission_for_destination(coalesce(wi.destination_module,wi.queue_type),''mutate'')),
    ''results'',history)';
 replacement:='private.clair_queue_permission_for_destination(coalesce(wi.destination_module,wi.queue_type),''mutate''))),
    ''results'',history)';
 if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'instruction_context_permission_close_anchor'; end if;
 d:=replace(d,old,replacement);
 old:='if not private.clair_current_user_has_workspace_permission(p_workspace_id,permission) then';
 replacement:='if not private.clair_current_user_has_workspace_permission(p_workspace_id,permission)
   and not private.clair_instruction_can_manage_item(p_workspace_id,wi.id,auth.uid())
   and not private.clair_instruction_requester_can_read_result(p_workspace_id,wi.id) then';
 if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'instruction_context_read_anchor'; end if;
 execute replace(d,old,replacement);

 signature:='public.clair_record_order_execution_result(text,uuid,uuid,bigint,text,integer,uuid,timestamp with time zone,jsonb,text,text)';
 d:=pg_get_functiondef(signature::regprocedure);
 old:='if not private.clair_current_user_has_workspace_permission(p_workspace_id,permission)
    or not private.clair_current_user_has_workspace_permission(p_workspace_id,
      private.clair_queue_permission_for_destination(coalesce(wi.destination_module,wi.queue_type),''read'')) then';
 replacement:='if (not private.clair_current_user_has_workspace_permission(p_workspace_id,permission)
    or not private.clair_current_user_has_workspace_permission(p_workspace_id,
      private.clair_queue_permission_for_destination(coalesce(wi.destination_module,wi.queue_type),''read'')))
    and not private.clair_instruction_can_manage_item(p_workspace_id,wi.id,p_actor_user_id)
    and not exists(select 1 from public.order_execution_result_versions receipt where receipt.workspace_id=p_workspace_id and receipt.command_id=p_command_id and receipt.recorded_by_user_id=auth.uid() and receipt.task_id=wi.task_id) then';
 if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'instruction_record_permission_anchor'; end if;
 execute replace(d,old,replacement);

 d:=pg_get_functiondef(signature::regprocedure);
 old:='  if head.id is null then
    update public.order_tasks set result_snapshot=';
 replacement:='  if head.id is null then
    if wi.queue_type in (''dispensing'',''treatment'') then
      insert into private.fulfillment_instruction_completion_scope values(txid_current(),p_workspace_id,wi.id,t.id,p_actor_user_id,p_command_id) on conflict do nothing;
    end if;
    update public.order_tasks set result_snapshot=';
 if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'instruction_result_scope_anchor'; end if;
 d:=replace(d,old,replacement);
 old:='  return public.clair_get_order_execution_context(p_workspace_id,p_work_item_id);';
 replacement:='  delete from private.fulfillment_instruction_completion_scope where transaction_id=txid_current() and workspace_id=p_workspace_id and actor_id=p_actor_user_id and command_id=p_command_id;
  return public.clair_get_order_execution_context(p_workspace_id,p_work_item_id);';
 if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'instruction_result_scope_cleanup_anchor'; end if;
 execute replace(d,old,replacement);

 signature:='public.clair_transition_fulfillment_work_item(text,uuid,uuid,text,bigint,uuid,uuid,text,text)';
 d:=pg_get_functiondef(signature::regprocedure);
 old:='if p_action <> ''claim'' and (v_item.assigned_to_user_id is distinct from p_actor_user_id) then';
 replacement:='if p_action <> ''claim'' and (v_item.assigned_to_user_id is distinct from p_actor_user_id)
   and not (p_action=''complete'' and private.clair_instruction_can_manage_item(p_workspace_id,p_work_item_id,p_actor_user_id)) then';
 if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'instruction_completion_owner_anchor'; end if;
 execute replace(d,old,replacement);

 d:=pg_get_functiondef(signature::regprocedure);
 old:='if not private.clair_current_user_has_workspace_permission(p_workspace_id, v_permission) then';
 replacement:='if not private.clair_current_user_has_workspace_permission(p_workspace_id, v_permission)
   and not (p_action=''complete'' and private.clair_instruction_can_manage_item(p_workspace_id,p_work_item_id,p_actor_user_id)) then';
 if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'instruction_transition_permission_anchor'; end if;
 execute replace(d,old,replacement);

 -- The result writer ignores this list response. Do not grant general queue-read access.
 d:=pg_get_functiondef(signature::regprocedure);
 old:='  return public.clair_list_fulfillment_work_items(';
 replacement:='  if private.clair_instruction_has_completion_scope(p_workspace_id,p_work_item_id,p_actor_user_id) then return jsonb_build_object(''ok'',true); end if;
  return public.clair_list_fulfillment_work_items(';
 if (length(d)-length(replace(d,old,'')))/length(old)<>2 then raise exception 'instruction_transition_readback_anchor'; end if;
 execute replace(d,old,replacement);

 signature:='public.clair_sync_billing_invoice_candidates_from_fulfillment(text,uuid,uuid,uuid[])';
 d:=pg_get_functiondef(signature::regprocedure);
 old:='wi.assigned_to_user_id is distinct from p_actor_user_id) then raise exception ''current_assignee_required''';
 replacement:='wi.assigned_to_user_id is distinct from p_actor_user_id
   and not private.clair_instruction_has_completion_scope(p_workspace_id,wi.id,p_actor_user_id)) then raise exception ''current_assignee_required''';
 if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'instruction_billing_owner_anchor'; end if;
 execute replace(d,old,replacement);
 d:=pg_get_functiondef(signature::regprocedure);
 old:='  perform private.clair_assert_billing_surface_permission(
    p_workspace_id, ''fulfillment'', p_order_ids
  );';
 replacement:='  if not exists(select 1 from unnest(p_order_ids) requested(order_id) where not exists(
    select 1 from public.order_fulfillment_work_items scoped where scoped.workspace_id=p_workspace_id and scoped.order_id=requested.order_id
      and scoped.encounter_id=p_encounter_id and scoped.status=''completed''
      and private.clair_instruction_has_completion_scope(p_workspace_id,scoped.id,p_actor_user_id))) then
    null;
  else
    perform private.clair_assert_billing_surface_permission(p_workspace_id,''fulfillment'',p_order_ids);
  end if;';
 if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'instruction_billing_surface_anchor'; end if;
 execute replace(d,old,replacement);
end $patch$;
commit;
