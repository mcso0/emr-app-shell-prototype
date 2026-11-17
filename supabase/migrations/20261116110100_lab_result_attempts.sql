-- Bind examination results to the exact execution attempt. Re-requesting keeps
-- frozen definitions but never copies values, notes, findings or attachments.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';
create function pg_temp.patch_lab_attempt(signature text, old text, replacement text, expected integer default 1)
returns void language plpgsql as $$
declare definition text := pg_get_functiondef(signature::regprocedure);
begin
  if (length(definition)-length(replace(definition,old,'')))/length(old) <> expected then
    raise exception 'lab attempt patch drift: %',signature;
  end if;
  execute replace(definition,old,replacement);
end $$;
alter table public.lab_result_entries add column task_id uuid, add column task_attempt_no integer;
alter table public.lab_result_entries add constraint lab_result_entries_task_pair
  check ((task_id is null)=(task_attempt_no is null) and (task_attempt_no is null or task_attempt_no>0)),
  add constraint lab_result_entries_task_fk foreign key(workspace_id,task_id,task_attempt_no)
  references public.order_tasks(workspace_id,id,attempt_no) on delete restrict;
-- Only the first attempt is unambiguous in pre-existing order-level results.
update public.lab_result_entries e set task_id=w.task_id,task_attempt_no=w.task_attempt_no
from public.order_fulfillment_work_items w where w.workspace_id=e.workspace_id
  and w.id=e.work_item_id and w.order_id=e.order_id and w.queue_type in ('lab','external_lab') and w.task_attempt_no=1;
-- Backfill updates queue the existing deferred canonical-definition trigger.
-- Validate them before index DDL, then retain deferred entry-before-rows creation.
set constraints public.lab_result_entries_canonical_definition_deferred immediate;
set constraints public.lab_result_entries_canonical_definition_deferred deferred;
drop index public.lab_result_entries_canonical_order_unique;
create unique index lab_result_entries_canonical_attempt_unique on public.lab_result_entries(workspace_id,order_id,task_attempt_no) nulls not distinct
  where result_definition_origin='canonical';

select pg_temp.patch_lab_attempt('private.clair_create_lab_result_entry_for_confirmed_order(text,uuid,uuid,uuid)',
$old$on conflict (workspace_id,order_id) where (result_definition_origin='canonical') do nothing$old$,
$new$on conflict do nothing$new$, 1);

create or replace function private.clair_attach_lab_result_work_item(p_workspace_id text,p_actor_user_id uuid,p_order_id uuid,p_work_item_id uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, private as $$
declare w public.order_fulfillment_work_items; e public.lab_result_entries; prior public.lab_result_entries; new_id uuid;
begin
  select * into w from public.order_fulfillment_work_items where workspace_id=p_workspace_id and id=p_work_item_id for update;
  if not found or w.order_id is distinct from p_order_id or w.queue_type not in ('lab','external_lab') or w.task_id is null then raise exception 'work_item_unavailable'; end if;
  select * into e from public.lab_result_entries where workspace_id=p_workspace_id and order_id=p_order_id
    and task_id=w.task_id and task_attempt_no=w.task_attempt_no and result_definition_origin='canonical' for update;
  if found then return jsonb_build_object('attached',true,'resultId',e.result_id); end if;
  select * into prior from public.lab_result_entries where workspace_id=p_workspace_id and order_id=p_order_id
    and result_definition_origin='canonical' order by task_attempt_no desc nulls last,created_at desc limit 1 for update;
  if not found then return jsonb_build_object('attached',false); end if;
  if w.task_attempt_no=1 and prior.task_id is null and prior.result_id='lab-order:'||p_order_id::text then
    update public.lab_result_entries set work_item_id=w.id,task_id=w.task_id,task_attempt_no=w.task_attempt_no where id=prior.id;
    return jsonb_build_object('attached',true,'resultId',prior.result_id);
  end if;
  insert into public.lab_result_entries(workspace_id,result_id,encounter_id,order_id,work_item_id,task_id,task_attempt_no,
    result_status,result_payload,abnormal_flag,entry_write_revision,
    source_workspace_catalog_item_id,source_workspace_catalog_revision,source_master_order_record_id,source_master_order_revision,
    source_master_panel_record_id,source_master_panel_revision,source_master_test_record_id,source_master_test_revision,
    result_definition_snapshot,result_definition_snapshot_sha256,result_definition_origin)
  select p_workspace_id,'lab-order:'||p_order_id::text||':attempt:'||w.task_attempt_no,w.encounter_id,p_order_id,w.id,w.task_id,w.task_attempt_no,
    'received','{}'::jsonb,'not_judged',0,
    prior.source_workspace_catalog_item_id,prior.source_workspace_catalog_revision,prior.source_master_order_record_id,prior.source_master_order_revision,
    prior.source_master_panel_record_id,prior.source_master_panel_revision,prior.source_master_test_record_id,prior.source_master_test_revision,
    prior.result_definition_snapshot,prior.result_definition_snapshot_sha256,'canonical' returning id into new_id;
  insert into public.lab_result_entry_rows(workspace_id,lab_result_entry_id,row_id,lab_test_item_id,analyte_name,
    result_unit,reference_range,sort_order,row_definition_origin,workspace_result_revision,source_master_test_record_id,
    owner_pinned_source_test_revision,item_version_source_master_record_id,item_version_source_test_revision,result_value_kind,
    result_input_type,decimal_scale,source_ordinal,effective_sort_order,required,display_group)
  select workspace_id,new_id,row_id,lab_test_item_id,analyte_name,result_unit,reference_range,sort_order,row_definition_origin,
    workspace_result_revision,source_master_test_record_id,owner_pinned_source_test_revision,item_version_source_master_record_id,
    item_version_source_test_revision,result_value_kind,result_input_type,decimal_scale,source_ordinal,effective_sort_order,required,display_group
  from public.lab_result_entry_rows where workspace_id=p_workspace_id and lab_result_entry_id=prior.id;
  return jsonb_build_object('attached',true,'resultEntryId',new_id);
end $$;
create function private.clair_attach_lab_task_attempt() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
begin
  if new.queue_type in ('lab','external_lab') and new.task_id is not null and (tg_op='INSERT' or new.task_id is distinct from old.task_id) then
    perform private.clair_attach_lab_result_work_item(new.workspace_id,auth.uid(),new.order_id,new.id);
  end if;
  return new;
end $$;
create trigger order_fulfillment_lab_attempt after insert or update of task_id,task_attempt_no on public.order_fulfillment_work_items
for each row execute function private.clair_attach_lab_task_attempt();
-- Existing later attempts had no reliable historical binding. Preserve them and
-- provision a blank current entry instead of attributing old results to it.
select private.clair_attach_lab_result_work_item(w.workspace_id,null,w.order_id,w.id)
from public.order_fulfillment_work_items w where w.queue_type in ('lab','external_lab') and w.task_attempt_no>1 and w.status in ('requested','in_progress','paused')
  and exists(select 1 from public.lab_result_entries e where e.workspace_id=w.workspace_id and e.order_id=w.order_id and e.result_definition_origin='canonical');

select pg_temp.patch_lab_attempt('private.clair_guard_canonical_lab_result_definition()',
$old$    if NEW.result_id is distinct from OLD.result_id$old$,
$new$    if (OLD.task_id is not null and (NEW.task_id is distinct from OLD.task_id or NEW.task_attempt_no is distinct from OLD.task_attempt_no or NEW.work_item_id is distinct from OLD.work_item_id))
       or (OLD.task_id is null and NEW.task_id is not null and (NEW.task_attempt_no<>1 or NEW.result_id<>'lab-order:'||NEW.order_id::text))
       or NEW.result_id is distinct from OLD.result_id$new$, 1);

create function private.clair_lab_result_is_current(p_entry public.lab_result_entries) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
  select p_entry.task_id is not null and exists(select 1 from public.order_fulfillment_work_items w
    where w.workspace_id=p_entry.workspace_id and w.id=p_entry.work_item_id and w.order_id=p_entry.order_id
      and w.task_id=p_entry.task_id and w.task_attempt_no=p_entry.task_attempt_no)
$$;
create function private.clair_assert_lab_result_current(p_workspace_id text,p_result_id text) returns void
language plpgsql security definer set search_path=pg_catalog as $$
declare e public.lab_result_entries;
begin
  select * into e from public.lab_result_entries where workspace_id=p_workspace_id and result_id=p_result_id;
  if not found or not private.clair_lab_result_is_current(e) then raise exception 'lab_result_attempt_changed'; end if;
end $$;

select pg_temp.patch_lab_attempt('private.clair_assert_work_owner(text,uuid,uuid,boolean)',
$old$if p_lab and wi.status not in ('requested','in_progress')$old$,
$new$if p_lab and wi.status<>'in_progress'$new$, 1);

select pg_temp.patch_lab_attempt('private.clair_serialize_lab_result_entry(text,uuid)',
$old$    'workItemId',v_entry.work_item_id,$old$,
$new$    'workItemId',v_entry.work_item_id,
    'taskId',v_entry.task_id,'taskAttemptNo',v_entry.task_attempt_no,
    'priorResults',coalesce((select jsonb_agg(jsonb_build_object('resultId',p.result_id,'taskId',p.task_id,'taskAttemptNo',p.task_attempt_no,'createdAt',p.created_at) order by p.created_at desc)
      from public.lab_result_entries p where p.workspace_id=v_entry.workspace_id and p.order_id=v_entry.order_id and p.id<>v_entry.id
        and (p.task_attempt_no<v_entry.task_attempt_no or p.task_attempt_no is null)), '[]'::jsonb),$new$, 1);

select pg_temp.patch_lab_attempt('public.clair_get_lab_result_entry(text,uuid,text,uuid,uuid)',
$old$(p_order_id is null or entry.order_id=p_order_id)$old$,
$new$(p_order_id is null or entry.order_id=p_order_id) and private.clair_lab_result_is_current(entry)$new$, 2);

select pg_temp.patch_lab_attempt('public.clair_save_lab_result_entry_v2(text,uuid,text,uuid,uuid,uuid,integer,uuid,jsonb)',
$old$where workspace_id=p_workspace_id and order_id=p_order_id and result_definition_origin='canonical' for update;$old$,
$new$where workspace_id=p_workspace_id and order_id=p_order_id and result_id=p_result_id and result_definition_origin='canonical' for update;$new$, 1);

select pg_temp.patch_lab_attempt('public.clair_save_lab_result_entry_v2(text,uuid,text,uuid,uuid,uuid,integer,uuid,jsonb)',
$old$  if not found then raise exception 'lab_result_not_frozen'; end if;$old$,
$new$  if not found then raise exception 'lab_result_not_frozen'; end if;
  perform private.clair_assert_lab_result_current(p_workspace_id,p_result_id);$new$, 1);

select pg_temp.patch_lab_attempt('public.clair_save_lab_result_overall_finding(text,text,integer,text)',
$old$  select * into v_entry from public.lab_result_entries
$old$,
$new$  perform private.clair_assert_lab_result_current(p_workspace_id,p_result_id);
  select * into v_entry from public.lab_result_entries
$new$, 1);

select pg_temp.patch_lab_attempt('public.clair_prepare_lab_result_attachment(text,text,text,uuid,text,text,integer)',
$old$  select * into v_entry from public.lab_result_entries
$old$,
$new$  perform private.clair_assert_lab_result_current(p_workspace_id,p_result_id);
  select * into v_entry from public.lab_result_entries
$new$, 1);

select pg_temp.patch_lab_attempt('public.clair_mutate_lab_attachment(text,text,uuid,text,uuid)',
$old$ if p_action<>'discard' then perform private.clair_assert_work_owner(p_workspace_id,e.order_id,p_actor_user_id,true); end if;$old$,
$new$ if p_action<>'discard' then perform private.clair_assert_work_owner(p_workspace_id,e.order_id,p_actor_user_id,true); perform private.clair_assert_lab_result_current(p_workspace_id,p_result_id); end if;$new$, 1);

select pg_temp.patch_lab_attempt('public.clair_save_lab_result_entry(text,uuid,text,uuid,uuid,uuid,jsonb)',
$old$  return public.clair_save_lab_result_entry_legacy_base$old$,
$new$  perform private.clair_assert_lab_result_current(p_workspace_id,p_result_id);
  return public.clair_save_lab_result_entry_legacy_base$new$, 1);

select pg_temp.patch_lab_attempt('public.clair_create_lab_atomic_retest(text,jsonb)',
$old$  perform private.clair_assert_work_owner(p_workspace_id,entry.order_id,request_actor);$old$,
$new$  perform private.clair_assert_work_owner(p_workspace_id,entry.order_id,request_actor);
  perform private.clair_assert_lab_result_current(p_workspace_id,entry.result_id);$new$, 1);

select pg_temp.patch_lab_attempt('public.clair_get_lab_result_phase2(text,text)',
$old$'editable', v_entry.result_status$old$,
$new$'editable', private.clair_lab_result_is_current(v_entry) and v_entry.result_status$new$, 1);

select pg_temp.patch_lab_attempt('public.clair_get_lab_result_phase2(text,text)',
$old$wi.status in ('requested','in_progress')$old$,
$new$wi.status='in_progress' and (private.clair_active_work_hold(wi.workspace_id,wi.task_id,wi.queue_type)).reason is null$new$, 1);

select pg_temp.patch_lab_attempt('public.clair_get_lab_result_phase2(text,text)',
$old$'canRequestRetest',exists$old$,
$new$'canRequestRetest',private.clair_lab_result_is_current(v_entry) and exists$new$, 1);

select pg_temp.patch_lab_attempt('private.clair_guard_lab_profile_completion()',
$old$and order_id=new.order_id and result_definition_origin='canonical';$old$,
$new$and order_id=new.order_id and task_id=new.id and task_attempt_no=new.attempt_no and result_definition_origin='canonical';$new$, 1);

select pg_temp.patch_lab_attempt('private.clair_guard_lab_profile_completion()',
$old$  if not found or entry.result_definition_snapshot->>'schemaVersion' is distinct from '2' then return new; end if;$old$,
$new$  if not found then
    if new.attempt_no=1 then return new; end if;
    raise exception 'required_lab_results_incomplete';
  end if;$new$, 1);

select pg_temp.patch_lab_attempt('private.clair_guard_lab_profile_completion()',
$old$r.required
      and (r.result_state not in ('recorded','recorded_without_interval') or r.result_value is null$old$,
$new$coalesce(r.required,true)
      and ((entry.result_definition_snapshot->>'schemaVersion'='2' and r.result_state not in ('recorded','recorded_without_interval')) or r.result_value is null$new$, 1);

revoke all on function private.clair_attach_lab_task_attempt(),private.clair_lab_result_is_current(public.lab_result_entries),
  private.clair_assert_lab_result_current(text,text) from public,anon,authenticated,service_role;
select pg_temp.patch_lab_attempt('private.clair_create_lab_result_entry_for_confirmed_order(text,uuid,uuid,uuid)',
$old$entry.result_definition_origin='canonical' for update;$old$,
$new$entry.result_definition_origin='canonical' and entry.result_id=v_result_id for update;$new$);
select pg_temp.patch_lab_attempt('private.clair_create_lab_result_entry_for_confirmed_order(text,uuid,uuid,uuid)',
$old$order_id=p_order_id and result_definition_origin='canonical' for update;$old$,
$new$order_id=p_order_id and result_definition_origin='canonical' and result_id=v_result_id for update;$new$);

-- Unattributed completed legacy attempts remain accessible as historical data;
-- do not invent a blank current result for an already-completed task.
select pg_temp.patch_lab_attempt('public.clair_get_lab_result_entry(text,uuid,text,uuid,uuid)',
$old$if v_count=0 then return jsonb_build_object('ok',true,'status',200,'savedResult',null,'enforcedBy','lab-result-getter'); end if;$old$,
$new$if v_count=0 then return jsonb_build_object('ok',true,'status',200,'savedResult',null,'enforcedBy','lab-result-getter',
 'workspaceId',p_workspace_id,'orderId',coalesce(p_order_id,(select order_id from public.order_fulfillment_work_items where workspace_id=p_workspace_id and id=p_work_item_id)),
 'priorResults',coalesce((select jsonb_agg(jsonb_build_object('resultId',e.result_id,'taskId',e.task_id,'taskAttemptNo',e.task_attempt_no,'createdAt',e.created_at) order by e.created_at desc)
  from public.lab_result_entries e where e.workspace_id=p_workspace_id and (p_order_id is null or e.order_id=p_order_id)
   and (p_work_item_id is null or e.work_item_id=p_work_item_id) and e.result_definition_origin='canonical'),'[]'::jsonb)); end if;$new$);
commit;
