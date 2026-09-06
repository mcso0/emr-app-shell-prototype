-- Actual execution is an append-only fact attached to one immutable task attempt.
-- Existing attempts retain their legacy completion contract; new non-lab attempts
-- require an actual record. Laboratory results use their separate typed graph.
set lock_timeout = '5s';
set statement_timeout = '120s';

alter table public.order_tasks add column execution_result_schema_version integer not null default 0
  check (execution_result_schema_version in (0,1));
alter table public.order_tasks alter column execution_result_schema_version set default 1;

-- The re-request link is permanent, but pending is an INSERT-only precondition.
-- Applying it to UPDATE prevents a legitimate second attempt from ever starting.
do $patch$
declare definition text;
begin
  definition:=pg_get_functiondef('private.clair_assert_order_task_identity_and_history()'::regprocedure);
  if (length(definition)-length(replace(definition,$a$or new.status <> 'pending'$a$,'')))/length($a$or new.status <> 'pending'$a$)<>1 then
    raise exception 'execution_history_guard_anchor_mismatch'; end if;
  execute replace(definition,$a$or new.status <> 'pending'$a$,$a$or (tg_op = 'INSERT' and new.status <> 'pending')$a$);
end $patch$;

create table public.order_execution_result_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  task_id uuid not null,
  task_attempt_no integer not null,
  order_id uuid not null,
  encounter_id uuid not null,
  version integer not null check (version > 0),
  previous_result_id uuid,
  schema_version integer not null default 1 check (schema_version=1),
  clinical_order_type text not null,
  plan_snapshot jsonb not null check (jsonb_typeof(plan_snapshot)='object'),
  plan_sha256 text not null check (plan_sha256 ~ '^[0-9a-f]{64}$'),
  payload jsonb not null check (jsonb_typeof(payload)='object'),
  performed_by_user_id uuid not null references public.users(id) on delete restrict,
  performed_at timestamptz not null,
  recorded_by_user_id uuid not null references public.users(id) on delete restrict,
  recorded_at timestamptz not null default now(),
  variance_reason text,
  amendment_reason text,
  command_id uuid not null,
  command_sha256 text not null,
  unique(workspace_id,id),
  unique(workspace_id,command_id),
  unique(workspace_id,task_id,task_attempt_no,version),
  foreign key(workspace_id,task_id,task_attempt_no) references public.order_tasks(workspace_id,id,attempt_no) on delete restrict,
  foreign key(workspace_id,order_id) references public.orders(workspace_id,id) on delete restrict,
  foreign key(workspace_id,encounter_id) references public.encounters(workspace_id,id) on delete restrict,
  foreign key(workspace_id,previous_result_id) references public.order_execution_result_versions(workspace_id,id) on delete restrict,
  check ((version=1 and previous_result_id is null and amendment_reason is null)
    or (version>1 and previous_result_id is not null and length(btrim(amendment_reason)) between 1 and 500)),
  check (variance_reason is null or length(btrim(variance_reason)) between 1 and 500)
);
alter table public.order_execution_result_versions enable row level security;
revoke all on public.order_execution_result_versions from public,anon,authenticated,service_role;

create function private.clair_guard_execution_result_history() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,private as $f$
begin
  raise exception 'execution_result_immutable' using errcode='55000';
end $f$;
revoke all on function private.clair_guard_execution_result_history() from public,anon,authenticated,service_role;
create trigger order_execution_result_history_immutable before update or delete
  on public.order_execution_result_versions for each row execute function private.clair_guard_execution_result_history();

create function private.clair_execution_result_payload_valid(p_type text,p_payload jsonb) returns boolean
language plpgsql immutable set search_path=pg_catalog,public,private as $f$
declare allowed text[]; required text[]; k text;
begin
  if jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>32000 then return false; end if;
  case p_type
    when 'dispensing' then
      allowed:=array['preparedQuantity','preparedUnit','note']; required:=array['preparedUnit'];
      if jsonb_typeof(p_payload->'preparedQuantity') is distinct from 'number'
        or (p_payload->>'preparedQuantity')::numeric<0 or (p_payload->>'preparedQuantity')::numeric>1000000 then return false; end if;
    when 'treatment' then
      allowed:=array['performedProcedure','site','administeredAmount','administeredUnit','outcome','note'];
      required:=array['performedProcedure','outcome'];
      if (p_payload ? 'administeredAmount') is distinct from (p_payload ? 'administeredUnit') then return false; end if;
      if p_payload ? 'administeredAmount' and (jsonb_typeof(p_payload->'administeredAmount') is distinct from 'number'
        or (p_payload->>'administeredAmount')::numeric<0 or (p_payload->>'administeredAmount')::numeric>1000000) then return false; end if;
    when 'imaging' then
      allowed:=array['acquisitionDisposition','acquiredViews','performedProtocol','quality','findings','interpretation','note'];
      required:=array['acquisitionDisposition','performedProtocol','quality','findings','interpretation'];
      if p_payload->>'acquisitionDisposition' not in ('acquired_new','reviewed_existing') then return false; end if;
      if jsonb_typeof(p_payload->'acquiredViews') is distinct from 'array' then return false; end if;
      if jsonb_array_length(p_payload->'acquiredViews') not between 1 and 100 then return false; end if;
      if exists(select 1 from jsonb_array_elements(p_payload->'acquiredViews') e
        where jsonb_typeof(e) is distinct from 'string' or length(btrim(e#>>'{}')) not between 1 and 200) then return false; end if;
      if p_payload->>'quality' not in ('diagnostic','limited','non_diagnostic') then return false; end if;
    when 'hospitalization' then
      allowed:=array['performedActivity','outcome','note']; required:=array['performedActivity','outcome'];
    when 'consultation' then
      allowed:=array['performedActivity','outcome','note']; required:=array['performedActivity','outcome'];
    when 'other' then
      allowed:=array['performedActivity','outcome','note']; required:=array['performedActivity','outcome'];
    else return false;
  end case;
  if exists(select 1 from jsonb_object_keys(p_payload) key where not key=any(allowed)) then return false; end if;
  foreach k in array required loop
    if jsonb_typeof(p_payload->k) is distinct from 'string' or length(btrim(p_payload->>k)) not between 1 and 4000 then return false; end if;
  end loop;
  for k in select jsonb_object_keys(p_payload) loop
    if k not in ('preparedQuantity','administeredAmount','acquiredViews') and
      (jsonb_typeof(p_payload->k) is distinct from 'string' or length(btrim(p_payload->>k)) not between 1 and 4000) then return false; end if;
  end loop;
  return true;
exception when others then return false;
end $f$;
revoke all on function private.clair_execution_result_payload_valid(text,jsonb) from public,anon,authenticated,service_role;

create function public.clair_get_order_execution_context(p_workspace_id text,p_work_item_id uuid,p_task_id uuid default null) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private as $f$
declare wi public.order_fulfillment_work_items; t public.order_tasks; history jsonb; permission text;
begin
  if auth.uid() is null or not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing' using errcode='42501'; end if;
  select * into wi from public.order_fulfillment_work_items where workspace_id=p_workspace_id and id=p_work_item_id;
  if not found or wi.task_id is null then raise exception 'work_item_unavailable'; end if;
  permission:=private.clair_queue_permission_for_destination(coalesce(wi.destination_module,wi.queue_type),'read');
  if not private.clair_current_user_has_workspace_permission(p_workspace_id,permission) then
    raise exception 'permission_missing' using errcode='42501'; end if;
  select * into t from public.order_tasks where workspace_id=p_workspace_id and id=coalesce(p_task_id,wi.task_id)
    and order_id=wi.order_id and encounter_id=wi.encounter_id and task_role='execution';
  if not found then raise exception 'queue_projection_task_mismatch'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',r.id,'version',r.version,'previousResultId',r.previous_result_id,'schemaVersion',r.schema_version,
    'payload',r.payload,'performedByUserId',r.performed_by_user_id,'performedAt',r.performed_at,
    'recordedByUserId',r.recorded_by_user_id,'recordedAt',r.recorded_at,'varianceReason',r.variance_reason,
    'amendmentReason',r.amendment_reason,'planSha256',r.plan_sha256) order by r.version),'[]'::jsonb)
    into history from public.order_execution_result_versions r where r.workspace_id=p_workspace_id and r.task_id=t.id and r.task_attempt_no=t.attempt_no;
  return jsonb_build_object('workspaceId',p_workspace_id,'workItemId',wi.id,'taskId',t.id,'attemptNo',t.attempt_no,
    'orderId',t.order_id,'encounterId',t.encounter_id,'clinicalOrderType',t.clinical_order_type,
    'workItemRevision',wi.row_revision,'status',case when t.id=wi.task_id then wi.status else t.status end,
    'isCurrentAttempt',t.id=wi.task_id,'planSnapshot',t.effective_snapshot,
    'planSha256',encode(extensions.digest(t.effective_snapshot::text,'sha256'),'hex'),
    'resultRequired',t.execution_result_schema_version=1 and t.clinical_order_type not in ('clinical_lab','external_lab'),
    'canRecord',t.id=wi.task_id and private.clair_current_user_has_workspace_permission(p_workspace_id,
      private.clair_queue_permission_for_destination(coalesce(wi.destination_module,wi.queue_type),'mutate')),
    'results',history);
end $f$;
revoke all on function public.clair_get_order_execution_context(text,uuid,uuid) from public,anon,service_role;
grant execute on function public.clair_get_order_execution_context(text,uuid,uuid) to authenticated;

-- Guard the authoritative task, not just the new endpoint. Existing completion
-- wrappers and direct updates cannot silently bypass the actual-result contract.
create function private.clair_guard_execution_result_completion() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,private as $f$
begin
  if new.execution_result_schema_version is distinct from old.execution_result_schema_version then
    raise exception 'execution_result_schema_immutable' using errcode='55000'; end if;
  if new.status='complete' and old.status is distinct from 'complete'
    and new.task_role='execution' and new.execution_result_schema_version=1
    and new.clinical_order_type not in ('clinical_lab','external_lab')
    and not exists(select 1 from public.order_execution_result_versions r
      where r.workspace_id=new.workspace_id and r.task_id=new.id and r.task_attempt_no=new.attempt_no
        and r.version=1 and r.plan_snapshot=new.effective_snapshot
        and new.result_snapshot->>'executionResultId'=r.id::text) then
    raise exception 'actual_execution_result_required';
  end if;
  return new;
end $f$;
revoke all on function private.clair_guard_execution_result_completion() from public,anon,authenticated,service_role;
create trigger order_tasks_actual_execution_required before update on public.order_tasks
  for each row execute function private.clair_guard_execution_result_completion();

create function public.clair_record_order_execution_result(
  p_workspace_id text,p_actor_user_id uuid,p_work_item_id uuid,p_expected_revision bigint,
  p_expected_plan_sha256 text,p_expected_result_version integer,p_command_id uuid,
  p_performed_at timestamptz,p_payload jsonb,p_variance_reason text default null,p_amendment_reason text default null
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $f$
declare
  wi public.order_fulfillment_work_items; t public.order_tasks; head public.order_execution_result_versions;
  prior public.order_execution_result_versions; r public.order_execution_result_versions;
  permission text; hash text; plan_hash text; expected_qty numeric; expected_unit text;
  variance text:=nullif(btrim(p_variance_reason),''); amendment text:=nullif(btrim(p_amendment_reason),'');
  order_status text;
begin
  if auth.uid() is null or p_actor_user_id is distinct from auth.uid() then raise exception 'actor_mismatch' using errcode='42501'; end if;
  if not private.clair_is_active_workspace_member(p_workspace_id) then raise exception 'workspace_membership_missing' using errcode='42501'; end if;
  if p_command_id is null or p_expected_revision is null or p_expected_revision<1
    or p_expected_result_version is null or p_expected_result_version<0
    or p_expected_plan_sha256 is null or p_expected_plan_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'invalid_execution_command'; end if;
  if p_performed_at is null or not isfinite(p_performed_at) or p_performed_at>now()+interval '5 minutes'
    or p_performed_at<now()-interval '10 years' then raise exception 'invalid_performed_at'; end if;
  if length(variance)>500 or length(amendment)>500 then raise exception 'reason_too_long'; end if;

  -- Resolve identity before the canonical advisory/order/work-item/task lock chain.
  select * into wi from public.order_fulfillment_work_items where workspace_id=p_workspace_id and id=p_work_item_id;
  if not found or wi.task_id is null then raise exception 'work_item_unavailable'; end if;
  permission:=private.clair_queue_permission_for_destination(coalesce(wi.destination_module,wi.queue_type),'mutate');
  if not private.clair_current_user_has_workspace_permission(p_workspace_id,permission)
    or not private.clair_current_user_has_workspace_permission(p_workspace_id,
      private.clair_queue_permission_for_destination(coalesce(wi.destination_module,wi.queue_type),'read')) then
    raise exception 'permission_missing' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('clinical_billing:'||p_workspace_id||':'||wi.encounter_id::text,0));
  -- Set re-request/cancel owns the root order before aggregate/child tasks.
  -- Take that same root lock before a child order, avoiding child→aggregate cycles.
  perform 1 from public.orders root where root.workspace_id=p_workspace_id and root.id=(
    select coalesce(child.parent_chart_order_line_id,child.id) from public.orders child
    where child.workspace_id=p_workspace_id and child.id=wi.order_id) for update;
  perform 1 from public.orders where workspace_id=p_workspace_id and id=wi.order_id for update;
  select * into wi from public.order_fulfillment_work_items where workspace_id=p_workspace_id and id=p_work_item_id for update;
  select * into t from public.order_tasks where workspace_id=p_workspace_id and id=wi.task_id and attempt_no=wi.task_attempt_no for update;
  if not found or t.order_id is distinct from wi.order_id or t.encounter_id is distinct from wi.encounter_id then raise exception 'queue_projection_task_mismatch'; end if;
  if not private.clair_execution_result_payload_valid(t.clinical_order_type,p_payload) then raise exception 'invalid_execution_payload'; end if;
  hash:=encode(extensions.digest(jsonb_build_object('workItemId',p_work_item_id,'actor',p_actor_user_id,
    'revision',p_expected_revision,'plan',p_expected_plan_sha256,'version',p_expected_result_version,
    'performedAt',p_performed_at,'payload',p_payload,'variance',variance,'amendment',amendment)::text,'sha256'),'hex');
  select * into prior from public.order_execution_result_versions where workspace_id=p_workspace_id and command_id=p_command_id;
  if found then
    if prior.command_sha256 is distinct from hash then raise exception 'idempotency_conflict'; end if;
    return public.clair_get_order_execution_context(p_workspace_id,p_work_item_id,prior.task_id);
  end if;
  if exists(select 1 from public.order_task_events where workspace_id=p_workspace_id and lifecycle_command_id=p_command_id) then raise exception 'idempotency_conflict'; end if;
  if wi.row_revision is distinct from p_expected_revision then raise exception 'revision_conflict'; end if;
  plan_hash:=encode(extensions.digest(t.effective_snapshot::text,'sha256'),'hex');
  if p_expected_plan_sha256 is distinct from plan_hash then raise exception 'plan_revision_conflict'; end if;
  select * into head from public.order_execution_result_versions where workspace_id=p_workspace_id and task_id=t.id and task_attempt_no=t.attempt_no order by version desc limit 1;
  if coalesce(head.version,0) is distinct from p_expected_result_version then raise exception 'result_revision_conflict'; end if;
  if head.id is null then
    if wi.status<>'in_progress' or t.status<>'in_progress' or t.result_snapshot is not null or amendment is not null then raise exception 'invalid_transition'; end if;
    if p_performed_at<t.created_at then raise exception 'invalid_performed_at'; end if;
  else
    if wi.status<>'completed' or t.status<>'complete' or amendment is null then raise exception 'amendment_reason_required'; end if;
    if head.plan_sha256 is distinct from plan_hash or p_performed_at<t.created_at then raise exception 'plan_revision_conflict'; end if;
  end if;
  if t.clinical_order_type='dispensing' then
    expected_qty:=nullif(t.effective_snapshot#>>'{calculationOutputs,plannedPracticalTotalQuantity}','')::numeric;
    expected_unit:=coalesce(nullif(t.effective_snapshot#>>'{calculationOutputs,dispenseUnit}',''),
      nullif(t.effective_snapshot#>>'{appliedSnapshot,planOrderAuthority,dispenseUnit}',''),
      nullif(t.effective_snapshot#>>'{detailInputs,totalQuantityUnit}',''));
    -- Unit changes are never silent conversions. If legacy planned quantity is
    -- unavailable, the performer must explicitly explain the incomparable plan.
    if (expected_qty is null or expected_unit is null or (p_payload->>'preparedQuantity')::numeric is distinct from expected_qty
      or p_payload->>'preparedUnit' is distinct from expected_unit) and variance is null then raise exception 'variance_reason_required'; end if;
  end if;
  insert into public.order_execution_result_versions(workspace_id,task_id,task_attempt_no,order_id,encounter_id,
    version,previous_result_id,clinical_order_type,plan_snapshot,plan_sha256,payload,performed_by_user_id,performed_at,
    recorded_by_user_id,variance_reason,amendment_reason,command_id,command_sha256)
  values(p_workspace_id,t.id,t.attempt_no,t.order_id,t.encounter_id,coalesce(head.version,0)+1,head.id,t.clinical_order_type,
    t.effective_snapshot,plan_hash,p_payload,coalesce(head.performed_by_user_id,p_actor_user_id),p_performed_at,
    p_actor_user_id,variance,amendment,p_command_id,hash) returning * into r;
  if head.id is null then
    update public.order_tasks set result_snapshot=jsonb_build_object('schemaVersion',1,'executionResultId',r.id,
      'resultVersion',1,'planSha256',plan_hash) where workspace_id=p_workspace_id and id=t.id;
    perform public.clair_transition_fulfillment_work_item(p_workspace_id,p_actor_user_id,p_work_item_id,'complete',
      p_expected_revision,p_command_id,null,null,variance);
    -- Keep the existing lifecycle/billing policy: lab/imaging still require
    -- veterinary review; actual variance never silently changes confirmed price.
    select status into order_status from public.orders where workspace_id=p_workspace_id and id=t.order_id;
    if order_status in ('requested','re_requested','confirmed') then
      perform public.clair_save_chart_order_lifecycle(p_workspace_id,p_actor_user_id,t.encounter_id,t.order_id,'in_progress',null);
    end if;
    perform public.clair_save_chart_order_lifecycle(p_workspace_id,p_actor_user_id,t.encounter_id,t.order_id,'completed',null);
    if wi.queue_type not in ('lab','imaging') and coalesce((wi.source_snapshot->>'billingReflectionEnabled')::boolean,true) then
      perform public.clair_sync_billing_invoice_candidates_from_fulfillment(p_workspace_id,p_actor_user_id,t.encounter_id,array[t.order_id]);
    end if;
  else
    insert into public.order_task_events(workspace_id,task_id,task_attempt_no,order_id,event_type,actor_user_id,reason,
      before_values,after_values,lifecycle_command_id)
    values(p_workspace_id,t.id,t.attempt_no,t.order_id,'amended',p_actor_user_id,amendment,
      jsonb_build_object('executionResultId',head.id,'resultVersion',head.version),
      jsonb_build_object('executionResultId',r.id,'resultVersion',r.version,'workItemId',wi.id,'action','amend_execution_result'),p_command_id);
  end if;
  return public.clair_get_order_execution_context(p_workspace_id,p_work_item_id);
end $f$;
revoke all on function public.clair_record_order_execution_result(text,uuid,uuid,bigint,text,integer,uuid,timestamptz,jsonb,text,text) from public,anon,service_role;
grant execute on function public.clair_record_order_execution_result(text,uuid,uuid,bigint,text,integer,uuid,timestamptz,jsonb,text,text) to authenticated;
