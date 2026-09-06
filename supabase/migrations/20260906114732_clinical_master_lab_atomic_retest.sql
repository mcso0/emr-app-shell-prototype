-- Atomic retest is a new chart draft. Prior orders, results, task attempts and
-- billing remain untouched. This does not confirm or perform the new order.
set lock_timeout='5s';
set statement_timeout='120s';

create table public.lab_atomic_retest_requests (
  workspace_id text not null references public.workspaces(id) on delete restrict,
  request_id uuid not null,
  actor_user_id uuid not null,
  request_sha256 text not null,
  prior_result_entry_id uuid not null,
  prior_result_row_id text not null,
  prior_entry_write_revision integer not null check(prior_entry_write_revision>0),
  prior_order_id uuid not null,
  original_order_id uuid not null,
  original_parent_order_id uuid,
  new_order_id uuid not null,
  reason text not null check(length(btrim(reason)) between 1 and 2000),
  specimen_decision text not null check(specimen_decision in ('new_specimen','reuse_specimen')),
  specimen_reference text not null check(length(btrim(specimen_reference)) between 1 and 200),
  billing_policy text not null check(billing_policy in ('no_charge','catalog_price')),
  prior_result_snapshot jsonb not null,
  selected_profile_version_id uuid not null references master.lab_result_profile_versions(id),
  selected_device_id uuid not null,
  outcome jsonb not null,
  created_at timestamptz not null default now(),
  primary key(workspace_id,request_id), unique(workspace_id,new_order_id),
  foreign key(workspace_id,prior_result_entry_id) references public.lab_result_entries(workspace_id,id) on delete restrict,
  foreign key(workspace_id,prior_order_id) references public.orders(workspace_id,id) on delete restrict,
  foreign key(workspace_id,new_order_id) references public.orders(workspace_id,id) on delete restrict,
  foreign key(workspace_id,selected_device_id) references public.workspace_lab_devices(workspace_id,id) on delete restrict
);
alter table public.lab_atomic_retest_requests enable row level security;
revoke all on public.lab_atomic_retest_requests from public,anon,authenticated,service_role;
create trigger lab_atomic_retest_requests_immutable before update or delete on public.lab_atomic_retest_requests
  for each row execute function private.clair_guard_lab_profile_history();

create function public.clair_create_lab_atomic_retest(p_workspace_id text,p_input jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private,master,extensions as $f$
declare entry public.lab_result_entries; old_order public.orders; catalog public.order_catalog_items; prior public.lab_atomic_retest_requests;
  saved_row public.lab_result_entry_rows; requested uuid; created_order uuid; digest text; result jsonb; original uuid; parent uuid;
  chosen_profile uuid; chosen_device uuid; bill boolean; definition jsonb; request_actor uuid:=auth.uid();
begin
  if request_actor is null or not private.clair_is_active_workspace_member(p_workspace_id) then raise exception 'workspace_membership_missing' using errcode='42501'; end if;
  if not private.clair_current_user_has_workspace_permission(p_workspace_id,'chart:update')
    or not private.clair_current_user_has_workspace_permission(p_workspace_id,'lab:view') then raise exception 'permission_missing' using errcode='42501'; end if;
  if jsonb_typeof(p_input) is distinct from 'object' or (select count(*) from jsonb_object_keys(p_input))<>10
    or not p_input ?& array['requestId','resultId','rowId','expectedEntryWriteRevision','reason','specimenDecision','specimenReference','billingPolicy','profileVersionId','deviceId']
    or jsonb_typeof(p_input->'expectedEntryWriteRevision') is distinct from 'number'
    or p_input->>'expectedEntryWriteRevision' !~ '^[1-9][0-9]*$'
    or exists(select 1 from jsonb_each(p_input) kv where kv.key<>'expectedEntryWriteRevision' and jsonb_typeof(kv.value) is distinct from 'string')
    or length(btrim(p_input->>'reason')) not between 1 and 2000 or length(btrim(p_input->>'specimenReference')) not between 1 and 200
    or p_input->>'specimenDecision' not in ('new_specimen','reuse_specimen') or p_input->>'billingPolicy' not in ('no_charge','catalog_price') then raise exception 'invalid_lab_retest_request'; end if;
  begin requested:=(p_input->>'requestId')::uuid; chosen_profile:=(p_input->>'profileVersionId')::uuid; chosen_device:=(p_input->>'deviceId')::uuid;
    exception when others then raise exception 'invalid_lab_retest_request'; end;
  digest:=encode(extensions.digest(convert_to(p_input::text,'UTF8'),'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended('clinical_master_workspace_adoption:'||p_workspace_id,0));
  select * into prior from public.lab_atomic_retest_requests where workspace_id=p_workspace_id and request_id=requested;
  if found then
    if prior.actor_user_id is distinct from request_actor or prior.request_sha256 is distinct from digest then raise exception 'lab_retest_idempotency_conflict'; end if;
    return prior.outcome;
  end if;
  select * into entry from public.lab_result_entries where workspace_id=p_workspace_id and result_id=p_input->>'resultId';
  if not found or entry.result_definition_origin<>'canonical' then raise exception 'lab_result_not_found'; end if;
  select * into strict old_order from public.orders where workspace_id=p_workspace_id and id=entry.order_id for update;
  perform 1 from public.encounters where workspace_id=p_workspace_id and id=old_order.encounter_id and status in ('in_consultation','ordered','ready_for_billing') for update;
  if not found then raise exception 'encounter_unavailable'; end if;
  select * into strict entry from public.lab_result_entries where workspace_id=p_workspace_id and id=entry.id for update;
  if entry.entry_write_revision<>(p_input->>'expectedEntryWriteRevision')::integer then raise exception 'lab_result_revision_conflict'; end if;
  perform private.clair_assert_lab_result_definition_snapshot(p_workspace_id,entry.id);
  select * into saved_row from public.lab_result_entry_rows where workspace_id=p_workspace_id and lab_result_entry_id=entry.id and row_id=p_input->>'rowId';
  if not found or (saved_row.result_value is null and saved_row.result_presence<>'instrument_no_result') then raise exception 'lab_retest_prior_result_required'; end if;
  -- A panel result field is not silently converted into a new atomic order.
  -- New CBC leaves already have independent pinned order identities.
  if (select count(*) from public.lab_result_entry_rows where workspace_id=p_workspace_id and lab_result_entry_id=entry.id)<>1
    or not exists(select 1 from public.order_catalog_lab_test_item_links p where p.workspace_id=p_workspace_id and p.order_catalog_item_id=old_order.workspace_catalog_item_id
      and p.profile_kind='standalone_test' and p.source_master_test_record_id=entry.source_master_test_record_id)
    then raise exception 'lab_retest_atomic_order_required'; end if;
  select * into catalog from public.order_catalog_items where workspace_id=p_workspace_id and id=old_order.workspace_catalog_item_id and availability_status='active' for share;
  if not found then raise exception 'catalog_item_not_found'; end if;
  bill:=p_input->>'billingPolicy'='catalog_price';
  if bill and (not catalog.billing_eligible or not catalog.billing_reflection_enabled or catalog.price_krw is null) then raise exception 'lab_retest_catalog_billing_unavailable'; end if;
  definition:=private.clair_build_catalog_order_snapshot(p_workspace_id,catalog.id,1);
  created_order:=extensions.gen_random_uuid();
  insert into public.orders(id,workspace_id,encounter_id,order_type,display_name,status,requested_by_user_id,requested_at,
    clinical_order_type,destination_module,execution_mode,detail_schema_version,detail_inputs,applied_snapshot,billing_eligible,
    billing_reflection_enabled,quantity,unit_price_snapshot,workspace_catalog_item_id,workspace_catalog_revision,source_master_record_id,source_master_revision,
    selected_lab_profile_version_id,selected_lab_device_id)
  values(created_order,p_workspace_id,old_order.encounter_id,'lab',catalog.in_hospital_order_name,'requested',request_actor,now(),
    catalog.clinical_order_type,catalog.destination_module,catalog.execution_mode,catalog.detail_schema_version,
    catalog.default_detail_inputs||jsonb_build_object('clinicalContext',btrim(p_input->>'reason')),definition,catalog.billing_eligible,bill,1,coalesce(catalog.price_krw,0),
    catalog.id,catalog.catalog_revision,catalog.source_master_record_id,catalog.source_master_revision,chosen_profile,chosen_device);
  select original_order_id,original_parent_order_id into original,parent from public.lab_atomic_retest_requests where workspace_id=p_workspace_id and new_order_id=old_order.id;
  if not found then original:=old_order.id; parent:=old_order.parent_chart_order_line_id; end if;
  result:=jsonb_build_object('ok',true,'status',200,'workspaceId',p_workspace_id,'orderId',created_order,'encounterId',old_order.encounter_id,
    'confirmationStatus','draft','priorOrderId',old_order.id,'requestId',requested);
  insert into public.lab_atomic_retest_requests(workspace_id,request_id,actor_user_id,request_sha256,prior_result_entry_id,prior_result_row_id,
    prior_entry_write_revision,prior_order_id,original_order_id,original_parent_order_id,new_order_id,reason,specimen_decision,specimen_reference,billing_policy,
    prior_result_snapshot,selected_profile_version_id,selected_device_id,outcome)
  values(p_workspace_id,requested,request_actor,digest,entry.id,saved_row.row_id,entry.entry_write_revision,old_order.id,original,parent,created_order,
    btrim(p_input->>'reason'),p_input->>'specimenDecision',btrim(p_input->>'specimenReference'),p_input->>'billingPolicy',
    jsonb_build_object('definition',entry.result_definition_snapshot,'row',to_jsonb(saved_row),'entryWriteRevision',entry.entry_write_revision),chosen_profile,chosen_device,result);
  return result;
end $f$;
revoke all on function public.clair_create_lab_atomic_retest(text,jsonb) from public,anon,service_role;
grant execute on function public.clair_create_lab_atomic_retest(text,jsonb) to authenticated;
