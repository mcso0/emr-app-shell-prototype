-- Chart-only actual facts use the existing confirmation transaction/result table.
-- No actual defaults enter the master schema or immutable planned snapshot.
set lock_timeout='5s';
set statement_timeout='120s';

-- A chart-only confirmation has no queued start transition. Its explicitly
-- attested performed_at/actor live in the required actual record below; never
-- invent a routed started_at from confirmation time to satisfy this constraint.
alter table public.order_tasks drop constraint order_tasks_started_status_check;
alter table public.order_tasks add constraint order_tasks_started_status_check check (
  status not in ('in_progress','paused','partial_complete','complete')
  or started_at is not null
  or (status='complete' and task_role='execution' and destination_module is null
    and clinical_order_type in ('system_exam','consultation','other'))
);

create function private.clair_chart_actual_payload_valid(p_type text,p_payload jsonb) returns boolean
language plpgsql immutable set search_path=pg_catalog,public,private as $f$
declare keys text[]; k text;
begin
  if p_type not in ('system_exam','consultation','other') or jsonb_typeof(p_payload) is distinct from 'object' then return false; end if;
  keys:=case when p_type='system_exam' then array['findingSummary'] else array['performedActivity','outcome'] end;
  if (select count(*) from jsonb_object_keys(p_payload))<>cardinality(keys) then return false; end if;
  foreach k in array keys loop
    if jsonb_typeof(p_payload->k) is distinct from 'string' or length(btrim(p_payload->>k)) not between 1 and 4000 then return false; end if;
  end loop;
  return true;
end $f$;
revoke all on function private.clair_chart_actual_payload_valid(text,jsonb) from public,anon,authenticated,service_role;

create function private.clair_chart_actual_required() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,private as $f$
begin
  if new.execution_result_schema_version=1 and new.task_role='execution'
    and new.destination_module is null and new.status='complete'
    and new.clinical_order_type in ('system_exam','consultation','other') then
    if not exists(select 1 from public.order_execution_result_versions r join public.order_tasks t
      on t.workspace_id=r.workspace_id and t.id=r.task_id and t.attempt_no=r.task_attempt_no
      where r.workspace_id=new.workspace_id and r.task_id=new.id and r.task_attempt_no=new.attempt_no
        and r.version=1 and r.plan_snapshot=new.effective_snapshot
        and t.result_snapshot->>'executionResultId'=r.id::text
        and private.clair_chart_actual_payload_valid(new.clinical_order_type,r.payload)) then
      raise exception 'chart_actual_record_required';
    end if;
  end if;
  return new;
end $f$;
revoke all on function private.clair_chart_actual_required() from public,anon,authenticated,service_role;
create constraint trigger order_tasks_chart_actual_required after insert on public.order_tasks
  deferrable initially deferred for each row execute function private.clair_chart_actual_required();

create function public.clair_confirm_chart_order_candidates_with_actual(
  p_workspace_id text,p_actor_user_id uuid,p_encounter_id uuid,p_selected_root_order_ids uuid[],
  p_expected_draft_etag text,p_idempotency_key text,p_actual_records jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $f$
declare result jsonb; t public.order_tasks; a jsonb; r public.order_execution_result_versions;
  at_time timestamptz; hash text; actual_count integer:=0;
begin
  if auth.uid() is null or auth.uid() is distinct from p_actor_user_id then raise exception 'actor_mismatch' using errcode='42501'; end if;
  if not private.clair_is_active_workspace_member(p_workspace_id)
    or not private.clair_current_user_has_workspace_permission(p_workspace_id,'chart:view')
    or not private.clair_current_user_has_workspace_permission(p_workspace_id,'chart:update') then
    raise exception 'permission_missing' using errcode='42501'; end if;
  if jsonb_typeof(p_actual_records) is distinct from 'object' or octet_length(p_actual_records::text)>2000000 then raise exception 'invalid_chart_actual'; end if;
  result:=public.clair_confirm_chart_order_candidates(p_workspace_id,p_actor_user_id,p_encounter_id,
    p_selected_root_order_ids,p_expected_draft_etag,p_idempotency_key);
  for t in select task.* from public.order_tasks task where task.workspace_id=p_workspace_id and task.encounter_id=p_encounter_id
    and task.effective_snapshot->>'confirmationCommandId'=result->>'commandId'
    -- A retry of a pre-contract confirmation must never manufacture actual
    -- history for schema-0 tasks. Extra supplied legacy IDs fail scope below.
    and task.execution_result_schema_version=1
    and task.task_role='execution' and task.destination_module is null
    and task.clinical_order_type in ('system_exam','consultation','other') order by task.id for update
  loop
    actual_count:=actual_count+1;
    a:=p_actual_records->t.order_id::text;
    if jsonb_typeof(a) is distinct from 'object' or a->'selfPerformed' is distinct from 'true'::jsonb
      or (select count(*) from jsonb_object_keys(a))<>3
      or not private.clair_chart_actual_payload_valid(t.clinical_order_type,a->'payload')
      or jsonb_typeof(a->'performedAt') is distinct from 'string'
      or a->>'performedAt' !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$' then raise exception 'invalid_chart_actual'; end if;
    at_time:=(a->>'performedAt')::timestamptz;
    if not isfinite(at_time) or at_time>now()+interval '5 minutes' or at_time<now()-interval '10 years' then raise exception 'invalid_performed_at'; end if;
    if t.clinical_order_type='system_exam' and a#>>'{payload,findingSummary}' is distinct from t.effective_snapshot#>>'{detailInputs,findingSummary}' then
      raise exception 'chart_actual_finding_mismatch'; end if;
    hash:=encode(extensions.digest(jsonb_build_object('taskId',t.id,'actor',p_actor_user_id,'actual',a)::text,'sha256'),'hex');
    select * into r from public.order_execution_result_versions where workspace_id=p_workspace_id and task_id=t.id and task_attempt_no=t.attempt_no and version=1;
    if found then
      if r.command_sha256 is distinct from hash then raise exception 'idempotency_conflict'; end if;
      continue;
    end if;
    insert into public.order_execution_result_versions(workspace_id,task_id,task_attempt_no,order_id,encounter_id,version,
      clinical_order_type,plan_snapshot,plan_sha256,payload,performed_by_user_id,performed_at,recorded_by_user_id,command_id,command_sha256)
    values(p_workspace_id,t.id,t.attempt_no,t.order_id,t.encounter_id,1,t.clinical_order_type,t.effective_snapshot,
      encode(extensions.digest(t.effective_snapshot::text,'sha256'),'hex'),a->'payload',p_actor_user_id,at_time,p_actor_user_id,t.id,hash) returning * into r;
    update public.order_tasks set result_snapshot=jsonb_build_object('schemaVersion',1,'executionResultId',r.id,'resultVersion',1,'planSha256',r.plan_sha256)
      where workspace_id=p_workspace_id and id=t.id;
  end loop;
  if actual_count<>(select count(*) from jsonb_object_keys(p_actual_records)) then raise exception 'chart_actual_scope_mismatch'; end if;
  return result;
end $f$;
revoke all on function public.clair_confirm_chart_order_candidates_with_actual(text,uuid,uuid,uuid[],text,text,jsonb) from public,anon,service_role;
grant execute on function public.clair_confirm_chart_order_candidates_with_actual(text,uuid,uuid,uuid[],text,text,jsonb) to authenticated;

create function public.clair_get_chart_actual_context(p_workspace_id text,p_task_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private as $f$
declare t public.order_tasks; history jsonb;
begin
  if auth.uid() is null or not private.clair_is_active_workspace_member(p_workspace_id)
    or not private.clair_current_user_has_workspace_permission(p_workspace_id,'chart:view') then raise exception 'permission_missing' using errcode='42501'; end if;
  select * into t from public.order_tasks where workspace_id=p_workspace_id and id=p_task_id and task_role='execution'
    and destination_module is null and clinical_order_type in ('system_exam','consultation','other');
  if not found then raise exception 'task_unavailable'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'version',r.version,'previousResultId',r.previous_result_id,
    'payload',r.payload,'performedByUserId',r.performed_by_user_id,'performedAt',r.performed_at,
    'recordedByUserId',r.recorded_by_user_id,'recordedAt',r.recorded_at,'amendmentReason',r.amendment_reason) order by r.version),'[]'::jsonb)
    into history from public.order_execution_result_versions r where r.workspace_id=p_workspace_id and r.task_id=t.id and r.task_attempt_no=t.attempt_no;
  return jsonb_build_object('workspaceId',p_workspace_id,'taskId',t.id,'orderId',t.order_id,'attemptNo',t.attempt_no,
    'clinicalOrderType',t.clinical_order_type,'planSnapshot',t.effective_snapshot,
    'planSha256',encode(extensions.digest(t.effective_snapshot::text,'sha256'),'hex'),
    'canAmend',t.status='complete' and jsonb_array_length(history)>0 and private.clair_current_user_has_workspace_permission(p_workspace_id,'chart:update'),'results',history);
end $f$;
revoke all on function public.clair_get_chart_actual_context(text,uuid) from public,anon,service_role;
grant execute on function public.clair_get_chart_actual_context(text,uuid) to authenticated;

create function public.clair_amend_chart_actual_result(p_workspace_id text,p_actor_user_id uuid,p_task_id uuid,
  p_expected_plan_sha256 text,p_expected_result_version integer,p_command_id uuid,p_performed_at timestamptz,p_payload jsonb,p_amendment_reason text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $f$
declare t public.order_tasks; head public.order_execution_result_versions; prior public.order_execution_result_versions;
  r public.order_execution_result_versions; hash text; plan_hash text;
begin
  if auth.uid() is null or p_actor_user_id is distinct from auth.uid() then raise exception 'actor_mismatch' using errcode='42501'; end if;
  if not private.clair_is_active_workspace_member(p_workspace_id)
    or not private.clair_current_user_has_workspace_permission(p_workspace_id,'chart:view')
    or not private.clair_current_user_has_workspace_permission(p_workspace_id,'chart:update') then raise exception 'permission_missing' using errcode='42501'; end if;
  select * into t from public.order_tasks where workspace_id=p_workspace_id and id=p_task_id and task_role='execution'
    and destination_module is null and clinical_order_type in ('system_exam','consultation','other');
  if not found then raise exception 'task_unavailable'; end if;
  -- Match the existing confirmation/lifecycle root-order → child-order → task
  -- lock chain before the result/event foreign keys acquire their row locks.
  perform pg_advisory_xact_lock(hashtextextended('clinical_billing:'||p_workspace_id||':'||t.encounter_id::text,0));
  perform 1 from public.orders root where root.workspace_id=p_workspace_id and root.id=(
    select coalesce(child.parent_chart_order_line_id,child.id) from public.orders child
    where child.workspace_id=p_workspace_id and child.id=t.order_id) for update;
  perform 1 from public.orders where workspace_id=p_workspace_id and id=t.order_id for update;
  select * into t from public.order_tasks where workspace_id=p_workspace_id and id=p_task_id for update;
  if not found or t.status<>'complete' then raise exception 'task_unavailable'; end if;
  if p_command_id is null or p_expected_result_version is null or p_expected_result_version<1
    or p_expected_plan_sha256 is null or p_expected_plan_sha256 !~ '^[0-9a-f]{64}$'
    or p_amendment_reason is null or length(btrim(p_amendment_reason)) not between 1 and 500
    or not private.clair_chart_actual_payload_valid(t.clinical_order_type,p_payload) then raise exception 'invalid_chart_actual'; end if;
  if p_performed_at is null or not isfinite(p_performed_at) or p_performed_at>now()+interval '5 minutes'
    or p_performed_at<now()-interval '10 years' then raise exception 'invalid_performed_at'; end if;
  hash:=encode(extensions.digest(jsonb_build_object('taskId',t.id,'actor',p_actor_user_id,'plan',p_expected_plan_sha256,
    'version',p_expected_result_version,'performedAt',p_performed_at,'payload',p_payload,'reason',btrim(p_amendment_reason))::text,'sha256'),'hex');
  select * into prior from public.order_execution_result_versions where workspace_id=p_workspace_id and command_id=p_command_id;
  if found then
    if prior.command_sha256 is distinct from hash then raise exception 'idempotency_conflict'; end if;
    return public.clair_get_chart_actual_context(p_workspace_id,p_task_id);
  end if;
  if exists(select 1 from public.order_task_events where workspace_id=p_workspace_id and lifecycle_command_id=p_command_id) then raise exception 'idempotency_conflict'; end if;
  plan_hash:=encode(extensions.digest(t.effective_snapshot::text,'sha256'),'hex');
  if plan_hash is distinct from p_expected_plan_sha256 then raise exception 'plan_revision_conflict'; end if;
  select * into head from public.order_execution_result_versions where workspace_id=p_workspace_id and task_id=t.id and task_attempt_no=t.attempt_no order by version desc limit 1;
  if head.id is null or head.version is distinct from p_expected_result_version then raise exception 'result_revision_conflict'; end if;
  insert into public.order_execution_result_versions(workspace_id,task_id,task_attempt_no,order_id,encounter_id,version,previous_result_id,
    clinical_order_type,plan_snapshot,plan_sha256,payload,performed_by_user_id,performed_at,recorded_by_user_id,amendment_reason,command_id,command_sha256)
  values(p_workspace_id,t.id,t.attempt_no,t.order_id,t.encounter_id,head.version+1,head.id,t.clinical_order_type,t.effective_snapshot,
    plan_hash,p_payload,head.performed_by_user_id,p_performed_at,p_actor_user_id,btrim(p_amendment_reason),p_command_id,hash) returning * into r;
  insert into public.order_task_events(workspace_id,task_id,task_attempt_no,order_id,event_type,actor_user_id,reason,before_values,after_values,lifecycle_command_id)
  values(p_workspace_id,t.id,t.attempt_no,t.order_id,'amended',p_actor_user_id,btrim(p_amendment_reason),
    jsonb_build_object('executionResultId',head.id,'resultVersion',head.version),
    jsonb_build_object('executionResultId',r.id,'resultVersion',r.version,'action','amend_execution_result'),p_command_id);
  return public.clair_get_chart_actual_context(p_workspace_id,p_task_id);
end $f$;
revoke all on function public.clair_amend_chart_actual_result(text,uuid,uuid,text,integer,uuid,timestamptz,jsonb,text) from public,anon,service_role;
grant execute on function public.clair_amend_chart_actual_result(text,uuid,uuid,text,integer,uuid,timestamptz,jsonb,text) to authenticated;
