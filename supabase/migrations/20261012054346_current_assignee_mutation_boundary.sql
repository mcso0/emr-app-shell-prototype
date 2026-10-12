-- Local candidate: apply before the app. No historical result or invoice is rewritten.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- Serialize ownership transfer and every result write within the encounter.
create or replace function private.clair_lock_work_ownership(p_workspace_id text, p_order_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare encounter_id uuid;
begin
 select o.encounter_id into encounter_id from public.orders o where o.workspace_id=p_workspace_id and o.id=p_order_id;
 if not found then raise exception 'order_unavailable'; end if;
 perform pg_advisory_xact_lock(hashtextextended('clinical_billing:'||p_workspace_id||':'||encounter_id::text,0));
end $$;

create or replace function private.clair_assert_work_owner(p_workspace_id text, p_order_id uuid, p_actor_user_id uuid, p_lab boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare wi public.order_fulfillment_work_items;
begin
 perform private.clair_lock_work_ownership(p_workspace_id,p_order_id);
 select * into wi from public.order_fulfillment_work_items w where w.workspace_id=p_workspace_id and w.order_id=p_order_id
 and w.status not in ('returned','cancelled') order by w.request_cycle desc,w.created_at desc limit 1 for update;
 if not found or p_actor_user_id is null or wi.assigned_to_user_id is distinct from p_actor_user_id
 then raise exception 'current_assignee_required' using errcode='42501'; end if;
 if not private.clair_user_has_workspace_permission(p_workspace_id,p_actor_user_id,private.clair_queue_permission_for_destination(coalesce(wi.destination_module,wi.queue_type),'mutate'))
 then raise exception 'permission_missing' using errcode='42501'; end if;
 if p_lab and wi.status not in ('requested','in_progress') then raise exception 'lab_result_read_only'; end if;
end $$;
revoke all on function private.clair_lock_work_ownership(text,uuid), private.clair_assert_work_owner(text,uuid,uuid,boolean) from public,anon,authenticated,service_role;

-- Exact anchors fail closed on schema drift; safe to reapply this candidate.
do $patch$
declare d text; old text; new text; signature text;
begin
 signature:='public.clair_transition_fulfillment_work_item(text,uuid,uuid,text,bigint,uuid,uuid,text,text)'; d:=pg_get_functiondef(signature::regprocedure);
 old:=$old$  select * into v_existing
  from public.order_task_events event
  where event.workspace_id = p_workspace_id
    and event.lifecycle_command_id = p_command_id;
  if found then
    if v_existing.after_values ->> 'workItemId' is distinct from p_work_item_id::text
      or v_existing.after_values ->> 'action' is distinct from p_action
    then raise exception 'idempotency_conflict'; end if;
    select * into v_item
    from public.order_fulfillment_work_items item
    where item.workspace_id = p_workspace_id and item.id = p_work_item_id;
    return public.clair_list_fulfillment_work_items(
      p_workspace_id, v_item.queue_type, v_item.encounter_id, v_item.order_id, null
    );
  end if;

  select * into v_item
  from public.order_fulfillment_work_items item
  where item.workspace_id = p_workspace_id and item.id = p_work_item_id
  for update;$old$; new:=$new$  perform private.clair_lock_work_ownership(p_workspace_id,(select order_id from public.order_fulfillment_work_items where workspace_id=p_workspace_id and id=p_work_item_id));
  select * into v_existing
  from public.order_task_events event
  where event.workspace_id = p_workspace_id
    and event.lifecycle_command_id = p_command_id;
  if found then
    if v_existing.after_values ->> 'workItemId' is distinct from p_work_item_id::text
      or v_existing.after_values ->> 'action' is distinct from p_action
    then raise exception 'idempotency_conflict'; end if;
    select * into v_item
    from public.order_fulfillment_work_items item
    where item.workspace_id = p_workspace_id and item.id = p_work_item_id;
    return public.clair_list_fulfillment_work_items(
      p_workspace_id, v_item.queue_type, v_item.encounter_id, v_item.order_id, null
    );
  end if;

  select * into v_item
  from public.order_fulfillment_work_items item
  where item.workspace_id = p_workspace_id and item.id = p_work_item_id
  for update;$new$;
 if strpos(d,new)=0 then
  if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'ownership_anchor_mismatch: %',signature; end if;
  execute replace(d,old,new);
 end if;
 signature:='public.clair_transition_fulfillment_work_item(text,uuid,uuid,text,bigint,uuid,uuid,text,text)'; d:=pg_get_functiondef(signature::regprocedure);
 old:=$old$  v_next_status := v_item.status;$old$; new:=$new$  if p_action = 'claim' and v_item.assigned_to_user_id is not null then
    raise exception 'already_assigned' using errcode='42501';
  end if;
  if p_action <> 'claim' and (v_item.assigned_to_user_id is distinct from p_actor_user_id) then
    raise exception 'current_assignee_required' using errcode='42501';
  end if;
  v_next_status := v_item.status;$new$;
 if strpos(d,new)=0 then
  if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'ownership_anchor_mismatch: %',signature; end if;
  execute replace(d,old,new);
 end if;
 signature:='public.clair_save_lab_result_entry_v2(text,uuid,text,uuid,uuid,uuid,integer,uuid,jsonb)'; d:=pg_get_functiondef(signature::regprocedure);
 old:=$old$  perform 1 from public.encounters where workspace_id=p_workspace_id and id=p_encounter_id and status <> 'cancelled' for update;$old$; new:=$new$  perform private.clair_assert_work_owner(p_workspace_id,p_order_id,p_actor_user_id,true);
  perform 1 from public.encounters where workspace_id=p_workspace_id and id=p_encounter_id and status <> 'cancelled' for update;$new$;
 if strpos(d,new)=0 then
  if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'ownership_anchor_mismatch: %',signature; end if;
  execute replace(d,old,new);
 end if;
 signature:='public.clair_save_lab_result_overall_finding(text,text,integer,text)'; d:=pg_get_functiondef(signature::regprocedure);
 old:=$old$  select * into v_entry from public.lab_result_entries$old$; new:=$new$  perform private.clair_assert_work_owner(p_workspace_id,(select order_id from public.lab_result_entries where workspace_id=p_workspace_id and result_id=p_result_id and result_definition_origin='canonical'),auth.uid(),true);
  select * into v_entry from public.lab_result_entries$new$;
 if strpos(d,new)=0 then
  if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'ownership_anchor_mismatch: %',signature; end if;
  execute replace(d,old,new);
 end if;
 signature:='public.clair_prepare_lab_result_attachment(text,text,text,uuid,text,text,integer)'; d:=pg_get_functiondef(signature::regprocedure);
 old:=$old$  select * into v_entry from public.lab_result_entries$old$; new:=$new$  perform private.clair_assert_work_owner(p_workspace_id,(select order_id from public.lab_result_entries where workspace_id=p_workspace_id and result_id=p_result_id and result_definition_origin='canonical'),auth.uid(),true);
  select * into v_entry from public.lab_result_entries$new$;
 if strpos(d,new)=0 then
  if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'ownership_anchor_mismatch: %',signature; end if;
  execute replace(d,old,new);
 end if;
 signature:='public.clair_get_lab_result_phase2(text,text)'; d:=pg_get_functiondef(signature::regprocedure);
 old:=$old$'editable', v_entry.result_status in ('received', 'entered')$old$; new:=$new$'editable', v_entry.result_status in ('received', 'entered') and exists(select 1 from public.order_fulfillment_work_items wi where wi.workspace_id=p_workspace_id and wi.order_id=v_entry.order_id and wi.assigned_to_user_id=auth.uid() and wi.status in ('requested','in_progress')),
    'canRequestRetest',exists(select 1 from public.order_fulfillment_work_items wi where wi.workspace_id=p_workspace_id and wi.order_id=v_entry.order_id and wi.assigned_to_user_id=auth.uid() and wi.status not in ('returned','cancelled')) and private.clair_current_user_has_workspace_permission(p_workspace_id,'chart:update')$new$;
 if strpos(d,new)=0 then
  if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'ownership_anchor_mismatch: %',signature; end if;
  execute replace(d,old,new);
 end if;
 signature:='public.clair_get_order_execution_context(text,uuid,uuid)'; d:=pg_get_functiondef(signature::regprocedure);
 old:=$old$'canRecord',t.id=wi.task_id and private.clair_current_user_has_workspace_permission$old$; new:=$new$'canRecord',t.id=wi.task_id and wi.assigned_to_user_id=auth.uid() and private.clair_current_user_has_workspace_permission$new$;
 if strpos(d,new)=0 then
  if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'ownership_anchor_mismatch: %',signature; end if;
  execute replace(d,old,new);
 end if;
 signature:='public.clair_record_order_execution_result(text,uuid,uuid,bigint,text,integer,uuid,timestamp with time zone,jsonb,text,text)'; d:=pg_get_functiondef(signature::regprocedure);
 old:=$old$  if wi.row_revision is distinct from p_expected_revision then$old$; new:=$new$  perform private.clair_assert_work_owner(p_workspace_id,wi.order_id,p_actor_user_id);
  if wi.row_revision is distinct from p_expected_revision then$new$;
 if strpos(d,new)=0 then
  if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'ownership_anchor_mismatch: %',signature; end if;
  execute replace(d,old,new);
 end if;
 signature:='public.clair_list_fulfillment_work_items_v2(text,text,uuid,uuid,text,date,uuid,uuid)'; d:=pg_get_functiondef(signature::regprocedure);
 old:=$old$'assignedToUserId', item.assigned_to_user_id,$old$; new:=$new$'assignedToUserId', item.assigned_to_user_id,
    'assignedToDisplayName',(select display_name from public.users where id=item.assigned_to_user_id),
    'canManage',private.clair_current_user_has_workspace_permission(p_workspace_id,private.clair_queue_permission_for_destination(coalesce(item.destination_module,item.queue_type),'mutate')) and (item.assigned_to_user_id is null or item.assigned_to_user_id=auth.uid()),$new$;
 if strpos(d,new)=0 then
  if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'ownership_anchor_mismatch: %',signature; end if;
  execute replace(d,old,new);
 end if;
end $patch$;

-- Invoice ownership is durable and independent of monetary values/status.
alter table public.invoices add column if not exists assigned_to_user_id uuid references public.users(id);
alter table public.invoices add column if not exists assignment_revision bigint not null default 0;
create table if not exists public.billing_assignment_events (
 id bigint generated always as identity primary key, workspace_id text not null,
 invoice_id uuid not null references public.invoices(id), actor_user_id uuid not null references public.users(id),
 previous_assignee_user_id uuid, next_assignee_user_id uuid, revision bigint not null,
 created_at timestamptz not null default now()
);
alter table public.billing_assignment_events enable row level security;
revoke all on public.billing_assignment_events from public,anon,authenticated,service_role;

create or replace function private.clair_assert_invoice_owner(p_workspace_id text,p_invoice_id uuid,p_actor_user_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare i public.invoices;
begin
 if auth.uid() is null or auth.uid() is distinct from p_actor_user_id or not private.clair_is_active_workspace_member(p_workspace_id)
 or not private.clair_current_user_has_workspace_permission(p_workspace_id,'billing:issue')
 then raise exception 'permission_missing' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('clinical_billing:'||p_workspace_id||':'||(select encounter_id::text from public.invoices where workspace_id=p_workspace_id and id=p_invoice_id),0));
 select * into i from public.invoices where workspace_id=p_workspace_id and id=p_invoice_id for update;
 if not found then raise exception 'invoice_unavailable'; end if;
 if i.assigned_to_user_id is distinct from p_actor_user_id then raise exception 'current_assignee_required' using errcode='42501'; end if;
end $$;
revoke all on function private.clair_assert_invoice_owner(text,uuid,uuid) from public,anon,authenticated,service_role;

create or replace function public.clair_get_billing_assignment(p_workspace_id text,p_invoice_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare i public.invoices; eligible jsonb;
begin
 if auth.uid() is null or not private.clair_is_active_workspace_member(p_workspace_id)
 or not private.clair_current_user_has_workspace_permission(p_workspace_id,'billing:view')
 then raise exception 'permission_missing' using errcode='42501'; end if;
 select * into i from public.invoices where workspace_id=p_workspace_id and id=p_invoice_id;
 if not found then raise exception 'invoice_unavailable'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('userId',u.id,'displayName',u.display_name) order by u.display_name,u.id),'[]'::jsonb)
 into eligible from public.user_memberships m join public.users u on u.id=m.user_id
 where m.workspace_id=p_workspace_id and m.status='active' and u.status='active'
 and private.clair_user_has_workspace_permission(p_workspace_id,u.id,'billing:issue');
 return jsonb_build_object('assignedToUserId',i.assigned_to_user_id,'assignedToDisplayName',(select display_name from public.users where id=i.assigned_to_user_id),
 'revision',i.assignment_revision,'canManage',private.clair_current_user_has_workspace_permission(p_workspace_id,'billing:issue') and (i.assigned_to_user_id is null or i.assigned_to_user_id=auth.uid()),'assignees',eligible);
end $$;

create or replace function public.clair_change_billing_assignment(p_workspace_id text,p_invoice_id uuid,p_action text,p_expected_revision bigint,p_assigned_to_user_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare i public.invoices; next_owner uuid;
begin
 if auth.uid() is null or not private.clair_is_active_workspace_member(p_workspace_id)
 or not private.clair_current_user_has_workspace_permission(p_workspace_id,'billing:issue')
 then raise exception 'permission_missing' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('clinical_billing:'||p_workspace_id||':'||(select encounter_id::text from public.invoices where workspace_id=p_workspace_id and id=p_invoice_id),0));
 select * into i from public.invoices where workspace_id=p_workspace_id and id=p_invoice_id for update;
 if not found then raise exception 'invoice_unavailable'; end if;
 if i.assignment_revision is distinct from p_expected_revision then raise exception 'revision_conflict' using errcode='40001'; end if;
 if p_action='claim' then
  if i.assigned_to_user_id is not null then raise exception 'already_assigned' using errcode='42501'; end if;
  next_owner:=auth.uid();
 elsif p_action in ('assign','unassign') then
  if i.assigned_to_user_id is distinct from auth.uid() then raise exception 'current_assignee_required' using errcode='42501'; end if;
  next_owner:=case when p_action='assign' then p_assigned_to_user_id else null end;
  if p_action='assign' and next_owner is null then raise exception 'assignee_ineligible'; end if;
 else raise exception 'invalid_transition'; end if;
 if next_owner is not null and not exists(select 1 from public.user_memberships m join public.users u on u.id=m.user_id
 where m.workspace_id=p_workspace_id and m.user_id=next_owner and m.status='active' and u.status='active'
 and private.clair_user_has_workspace_permission(p_workspace_id,next_owner,'billing:issue'))
 then raise exception 'assignee_ineligible' using errcode='42501'; end if;
 update public.invoices set assigned_to_user_id=next_owner,assignment_revision=assignment_revision+1 where workspace_id=p_workspace_id and id=p_invoice_id;
 insert into public.billing_assignment_events(workspace_id,invoice_id,actor_user_id,previous_assignee_user_id,next_assignee_user_id,revision)
 values(p_workspace_id,p_invoice_id,auth.uid(),i.assigned_to_user_id,next_owner,i.assignment_revision+1);
 return public.clair_get_billing_assignment(p_workspace_id,p_invoice_id);
end $$;
revoke all on function public.clair_get_billing_assignment(text,uuid),public.clair_change_billing_assignment(text,uuid,text,bigint,uuid) from public,anon,authenticated,service_role;
grant execute on function public.clair_get_billing_assignment(text,uuid),public.clair_change_billing_assignment(text,uuid,text,bigint,uuid) to authenticated;

-- Atomic attachment publication. Only the byte-validating server may finalize.
create or replace function public.clair_mutate_lab_attachment(p_workspace_id text,p_result_id text,p_attachment_id uuid,p_action text,p_actor_user_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.lab_result_entries; a public.lab_result_attachments;
begin
 if p_action='finalize' then
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'permission_missing' using errcode='42501'; end if;
 else
  if auth.uid() is null or p_actor_user_id is distinct from auth.uid() then raise exception 'actor_mismatch' using errcode='42501'; end if;
 end if;
 select * into e from public.lab_result_entries where workspace_id=p_workspace_id and result_id=p_result_id and result_definition_origin='canonical';
 if not found then raise exception 'result_unavailable'; end if;
 if p_action<>'discard' then perform private.clair_assert_work_owner(p_workspace_id,e.order_id,p_actor_user_id,true); end if;
 select * into e from public.lab_result_entries where id=e.id for update;
 if p_action<>'discard' and e.result_status not in ('received','entered') then raise exception 'result_unavailable'; end if;
 select * into a from public.lab_result_attachments where workspace_id=p_workspace_id and lab_result_entry_id=e.id and id=p_attachment_id for update;
 if not found or a.deleted_at is not null then raise exception 'attachment_unavailable'; end if;
 if p_action='delete' then
  if a.ready_at is null then raise exception 'attachment_unavailable'; end if;
  update public.lab_result_attachments set deleted_at=now(),deleted_by_user_id=p_actor_user_id where id=a.id;
 elsif p_action in ('finalize','discard') then
  if a.uploaded_by_user_id is distinct from p_actor_user_id then raise exception 'attachment_unavailable'; end if;
  if p_action='finalize' then
   if a.abandoned_at is not null then raise exception 'attachment_unavailable'; end if;
   update public.lab_result_attachments set ready_at=coalesce(ready_at,now()) where id=a.id;
  else
   if a.ready_at is not null then raise exception 'attachment_unavailable'; end if;
   update public.lab_result_attachments set abandoned_at=coalesce(abandoned_at,now()) where id=a.id;
  end if;
 else raise exception 'invalid_transition'; end if;
 return jsonb_build_object('storage_path',a.storage_path,'id',a.id);
end $$;
revoke all on function public.clair_mutate_lab_attachment(text,text,uuid,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.clair_mutate_lab_attachment(text,text,uuid,text,uuid) to authenticated,service_role;
revoke insert,update,delete on public.lab_result_attachments from authenticated;

-- Enforce ownership in existing billing writers without replacing later business rules.
do $patch$
declare d text; signature text; old text; new text;
begin
 foreach signature in array array[
 'public.clair_save_billing_invoice_lines(text,uuid,uuid,jsonb,boolean)',
 'public.clair_transition_billing_invoice_status(text,uuid,uuid,text,text,text)',
 'public.clair_save_billing_payment_status(text,uuid,uuid,text,text,text)',
 'public.clair_reverse_billing_review_invoice(text,uuid,uuid,timestamp with time zone,text,text)'] loop
  d:=pg_get_functiondef(signature::regprocedure);
  old:='begin'; new:=E'begin\n  perform private.clair_assert_invoice_owner(p_workspace_id,p_invoice_id,p_actor_user_id);';
  -- pg_get_functiondef preserves uppercase BEGIN in some baselines.
  if strpos(d,new)=0 then
   if strpos(d,E'\nbegin\n')=0 then raise exception 'billing_ownership_anchor_mismatch: %',signature; end if;
   execute replace(d,E'\nbegin\n',E'\n'||new||E'\n');
  end if;
 end loop;
 signature:='public.clair_prepare_billing_checkout_session(text,uuid,uuid[],text,jsonb,text)';
 d:=pg_get_functiondef(signature::regprocedure);
 new:=E'begin\n  perform pg_advisory_xact_lock(hashtextextended(\'clinical_billing:\'||p_workspace_id||\':\'||owned.encounter_id::text,0)) from (select distinct encounter_id from public.invoices where workspace_id=p_workspace_id and id=any(p_invoice_ids) order by encounter_id) owned;\n  perform private.clair_assert_invoice_owner(p_workspace_id,owned.id,p_actor_user_id) from (select unnest(p_invoice_ids) id order by id) owned;';
 if strpos(d,new)=0 then
  if strpos(d,E'\nbegin\n')=0 then raise exception 'checkout_ownership_anchor_mismatch'; end if;
  execute replace(d,E'\nbegin\n',E'\n'||new||E'\n');
 end if;
end $patch$;
do $legacy$
declare d text;
begin
 if to_regprocedure('public.clair_save_lab_result_entry_legacy_base(text,uuid,text,uuid,uuid,uuid,jsonb)') is not null then
  revoke all on function public.clair_save_lab_result_entry_legacy_base(text,uuid,text,uuid,uuid,uuid,jsonb) from public,anon,authenticated,service_role;
 end if;
 if to_regprocedure('public.clair_save_lab_result_entry(text,uuid,text,uuid,uuid,uuid,jsonb)') is not null then
  d:=pg_get_functiondef('public.clair_save_lab_result_entry(text,uuid,text,uuid,uuid,uuid,jsonb)'::regprocedure);
  if strpos(d,'private.clair_assert_work_owner')=0 then
   if strpos(d,E'\nbegin\n')=0 then raise exception 'legacy_ownership_anchor_mismatch'; end if;
   execute replace(d,E'\nbegin\n',E'\nbegin\n  if auth.uid() is null or auth.uid() is distinct from p_actor_user_id then raise exception \'actor_mismatch\' using errcode=\'42501\'; end if;\n  perform private.clair_assert_work_owner(p_workspace_id,p_order_id,p_actor_user_id,true);\n');
  end if;
 end if;
end $legacy$;
-- Retest starts a new draft but remains a result-sheet action owned by the current assignee.
do $retest$
declare d text; old text; new text;
begin
 if to_regprocedure('public.clair_create_lab_atomic_retest(text,jsonb)') is not null then
  d:=pg_get_functiondef('public.clair_create_lab_atomic_retest(text,jsonb)'::regprocedure);
  old:='  select * into strict old_order from public.orders where workspace_id=p_workspace_id and id=entry.order_id for update;';
  new:=E'  perform private.clair_assert_work_owner(p_workspace_id,entry.order_id,request_actor);\n'||old;
  if strpos(d,new)=0 then
   if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'retest_ownership_anchor_mismatch'; end if;
   execute replace(d,old,new);
  end if;
 end if;
end $retest$;
-- Manual billing sync requires invoice ownership. Verified clinical completion
-- remains a source-derived handoff; its public compatibility wrapper also binds
-- every completed work item to the current actor (no arbitrary invoice edits).
create or replace function private.clair_assert_billing_sync_owner(p_workspace_id text,p_actor_user_id uuid,p_encounter_id uuid,p_order_ids uuid[])
returns void language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
 if auth.uid() is null or auth.uid() is distinct from p_actor_user_id then raise exception 'actor_mismatch' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('clinical_billing:'||p_workspace_id||':'||p_encounter_id::text,0));
 for target in select distinct l.invoice_id from public.orders o join public.invoice_lines l on l.workspace_id=o.workspace_id and l.id=o.invoice_line_id
 where o.workspace_id=p_workspace_id and o.encounter_id=p_encounter_id and o.id=any(p_order_ids) order by l.invoice_id loop
  perform private.clair_assert_invoice_owner(p_workspace_id,target,p_actor_user_id);
 end loop;
 if target is null then
  select id into target from public.invoices where workspace_id=p_workspace_id and encounter_id=p_encounter_id and status='draft' order by created_at,id limit 1;
  if target is not null then perform private.clair_assert_invoice_owner(p_workspace_id,target,p_actor_user_id); end if;
 end if;
end $$;
revoke all on function private.clair_assert_billing_sync_owner(text,uuid,uuid,uuid[]) from public,anon,authenticated,service_role;
do $sync$
declare d text; signature text; new text; old text;
begin
 foreach signature in array array['public.clair_sync_billing_invoice_candidates(text,uuid,uuid,uuid[])','public.clair_sync_billing_invoice_candidates_from_chart(text,uuid,uuid,uuid[])'] loop
  if to_regprocedure(signature) is null then continue; end if;
  d:=pg_get_functiondef(signature::regprocedure);
  new:=E'begin\n  perform private.clair_assert_billing_sync_owner(p_workspace_id,p_actor_user_id,p_encounter_id,p_order_ids);';
  if strpos(d,new)=0 then
   if strpos(d,E'\nbegin\n')=0 then raise exception 'sync_owner_anchor_mismatch'; end if;
   execute replace(d,E'\nbegin\n',E'\n'||new||E'\n');
  end if;
 end loop;
 signature:='public.clair_sync_billing_invoice_candidates_from_fulfillment(text,uuid,uuid,uuid[])';
 if to_regprocedure(signature) is not null then
  d:=pg_get_functiondef(signature::regprocedure);
  old:='  return private.clair_sync_billing_invoice_candidates_internal(';
  new:=E'  if exists(select 1 from public.order_fulfillment_work_items wi where wi.workspace_id=p_workspace_id and wi.encounter_id=p_encounter_id and wi.order_id=any(p_order_ids) and wi.assigned_to_user_id is distinct from p_actor_user_id) then raise exception \'current_assignee_required\' using errcode=\'42501\'; end if;\n'||old;
  if strpos(d,new)=0 then
   if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'fulfillment_sync_owner_anchor_mismatch'; end if;
   execute replace(d,old,new);
  end if;
 end if;
end $sync$;
-- Restore the established private queue transport when absent in hosted history.
create or replace function private.clair_queue_realtime_topic(p_workspace_id text)
returns text
language sql
stable
as $$
  select 'workspace:' || p_workspace_id || ':queue'
$$;

create or replace function private.clair_queue_realtime_workspace_from_topic(p_topic text)
returns text
language sql
stable
as $$
  select substring(p_topic from '^workspace:([^:]+):queue(?:$|:)')
$$;

drop policy if exists clair_queue_realtime_broadcast_receive on realtime.messages;
create policy clair_queue_realtime_broadcast_receive
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and private.clair_queue_realtime_workspace_from_topic((select realtime.topic())) is not null
  and private.clair_is_active_workspace_member(
    private.clair_queue_realtime_workspace_from_topic((select realtime.topic()))
  )
);

create or replace function private.clair_broadcast_queue_changed()
returns trigger
language plpgsql
security definer
set search_path = public, private, realtime
as $$
declare
  v_workspace_id text;
  v_entity_id text;
begin
  if TG_OP = 'DELETE' then
    v_workspace_id := old.workspace_id;
    v_entity_id := old.id::text;
  else
    v_workspace_id := new.workspace_id;
    v_entity_id := new.id::text;
  end if;

  if v_workspace_id is null then
    return null;
  end if;

  perform realtime.send(
    jsonb_build_object(
      'workspaceId', v_workspace_id,
      'domain', 'queue',
      'sourceTable', TG_TABLE_NAME,
      'operation', TG_OP,
      'entityId', v_entity_id,
      'occurredAt', now(),
      'version', 1
    ),
    'queue_changed',
    private.clair_queue_realtime_topic(v_workspace_id),
    true
  );

  return null;
end;
$$;

drop trigger if exists clair_order_fulfillment_work_items_realtime on public.order_fulfillment_work_items;
create trigger clair_order_fulfillment_work_items_realtime
after insert or update or delete on public.order_fulfillment_work_items
for each row
execute function private.clair_broadcast_queue_changed();

grant execute on function private.clair_queue_realtime_topic(text) to authenticated;
grant execute on function private.clair_queue_realtime_workspace_from_topic(text) to authenticated;

revoke all on function private.clair_broadcast_queue_changed() from public,anon,authenticated,service_role;

-- Ownership changes must wake already-open clients on the existing private topic.
drop trigger if exists clair_billing_assignment_realtime on public.invoices;
create trigger clair_billing_assignment_realtime
after update of assigned_to_user_id on public.invoices
for each row when (old.assigned_to_user_id is distinct from new.assigned_to_user_id)
execute function private.clair_broadcast_queue_changed();
commit;
