-- Additive planning contract. No existing master, catalog, order or result is reset here.
set lock_timeout='5s';
set statement_timeout='120s';

alter table public.order_catalog_items add column archived_at timestamptz;
alter table public.order_catalog_items add constraint order_catalog_archive_inactive
  check (archived_at is null or availability_status='inactive');

-- Current administration excludes archived identities; historical FK reads remain valid.
do $patch$
declare body text; anchor text:='where item.workspace_id = p_workspace_id';
begin
  body:=pg_get_functiondef('public.clair_list_order_catalog_admin_v2(text)'::regprocedure);
  if (length(body)-length(replace(body,anchor,'')))/length(anchor)<>1 then raise exception 'catalog_archive_read_anchor'; end if;
  execute replace(body,anchor,anchor||' and item.archived_at is null');
end $patch$;

alter function private.clair_order_detail_field_schema(text,integer) rename to clair_order_detail_field_schema_before_chart_plan;
create function private.clair_order_detail_field_schema(p_type text,p_version integer) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public,private as $f$
declare schema jsonb;
begin
  if p_version=2 and p_type in ('consultation','system_exam','other') then
    schema:=private.clair_order_detail_field_schema_v1(p_type);
    schema:=jsonb_set(schema,'{version}','2'::jsonb);
    if p_type='system_exam' then
      schema:=jsonb_set(schema,'{fields}',(select jsonb_agg(f order by ordinal)
        from jsonb_array_elements(schema->'fields') with ordinality fields(f,ordinal)
        where f->>'key' not in ('findingSummary','abnormalFindings')));
    end if;
    return schema;
  end if;
  return private.clair_order_detail_field_schema_before_chart_plan(p_type,p_version);
end $f$;
revoke all on function private.clair_order_detail_field_schema(text,integer) from public,anon,authenticated,service_role;

do $patch$
declare body text; anchor text:=E'new.detail_schema_version := 1;\n    new.detail_field_schema := private.clair_order_detail_field_schema_v1(''system_exam'');';
begin
  body:=pg_get_functiondef('private.clair_sync_order_catalog_execution_contract()'::regprocedure);
  if (length(body)-length(replace(body,anchor,'')))/length(anchor)<>1 then raise exception 'chart_plan_catalog_version_anchor'; end if;
  execute replace(body,anchor,E'new.detail_schema_version := coalesce(new.detail_schema_version,1);\n    new.detail_field_schema := private.clair_order_detail_field_schema(''system_exam'',new.detail_schema_version);');
end $patch$;

do $patch$
declare body text; anchor text:='p_clinical_order_type = ''treatment''';
begin
  body:=pg_get_functiondef('private.clair_order_field_schema_is_valid(text,integer,jsonb)'::regprocedure);
  if (length(body)-length(replace(body,anchor,'')))/length(anchor)<>1 then raise exception 'chart_plan_schema_validator_anchor'; end if;
  execute replace(body,anchor,'p_clinical_order_type in (''treatment'',''consultation'',''system_exam'',''other'')');
end $patch$;
alter table master.order_execution_presets drop constraint order_execution_presets_detail_schema_version_check;
alter table master.order_execution_presets add constraint order_execution_presets_detail_schema_version_check
  check (detail_schema_version=1 or (detail_schema_version=2 and clinical_order_type in ('treatment','consultation','system_exam','other')));

alter table public.order_tasks drop constraint order_tasks_destinationless_attempt_check;
alter table public.order_tasks add constraint order_tasks_destinationless_attempt_check check (
  task_role='aggregate' or destination_module is not null
  or (attempt_no=1 and status='complete')
  or (attempt_no>1 and re_requested_from_task_id is not null)
  or (effective_snapshot->>'detailSchemaVersion'='2' and clinical_order_type in ('consultation','system_exam','other'))
);

-- The existing legacy routing enum stays intact; V2 chart-owned work is planned,
-- never implicitly performed. Run before identity/history guards on task INSERT.
-- Legacy set expansion omits billing_eligible and receives its column default.
-- New V2 chart leaves must copy catalog eligibility before confirmation checks;
-- billing_reflection_enabled remains the separate per-order user choice.
do $billing_transport$
declare definition text:=pg_get_functiondef('private.clair_sync_order_execution_contract()'::regprocedure);
  anchor text:='  new.billing_eligible := coalesce(new.billing_eligible, v_catalog.billing_eligible, new.billing_reflection_enabled);';
begin
  if position(anchor in definition)=0 then raise exception 'wp10_billing_transport_anchor_missing'; end if;
  execute replace(definition,anchor,anchor||$patch$
  if TG_OP='INSERT' and new.row_type<>'set' and v_catalog.detail_schema_version=2
    and v_catalog.clinical_order_type in ('consultation','system_exam','other') then
    new.billing_eligible:=v_catalog.billing_eligible;
  end if;
$patch$);
end $billing_transport$;

create function private.clair_initialize_chart_plan_task() returns trigger
language plpgsql set search_path=pg_catalog as $f$
begin
  if new.task_role='execution' and new.destination_module is null
    and new.effective_snapshot->>'detailSchemaVersion'='2'
    and new.clinical_order_type in ('consultation','system_exam','other') then
    new.status:='pending'; new.completed_at:=null; new.started_at:=null; new.started_by_user_id:=null;
  end if;
  return new;
end $f$;
revoke all on function private.clair_initialize_chart_plan_task() from public,anon,authenticated,service_role;
create trigger aaa_order_tasks_chart_plan before insert on public.order_tasks
  for each row execute function private.clair_initialize_chart_plan_task();

-- Old V1 confirmations/retries still require their original actual attestation.
do $patch$
declare body text; anchor text:='and task.execution_result_schema_version=1';
begin
  body:=pg_get_functiondef('public.clair_confirm_chart_order_candidates_with_actual(text,uuid,uuid,uuid[],text,text,jsonb)'::regprocedure);
  if (length(body)-length(replace(body,anchor,'')))/length(anchor)<>1 then raise exception 'chart_plan_actual_scope_anchor'; end if;
  execute replace(body,anchor,anchor||' and task.effective_snapshot->>''detailSchemaVersion'' is distinct from ''2''');
end $patch$;

drop trigger order_tasks_chart_actual_required on public.order_tasks;
create constraint trigger order_tasks_chart_actual_required after insert or update on public.order_tasks
  deferrable initially deferred for each row execute function private.clair_chart_actual_required();

-- Add a capability for a new plan's initial actual record, separate from amendment.
do $patch$
declare body text; anchor text:='''canAmend'',t.status=';
begin
  body:=pg_get_functiondef('public.clair_get_chart_actual_context(text,uuid)'::regprocedure);
  if (length(body)-length(replace(body,anchor,'')))/length(anchor)<>1 then raise exception 'chart_plan_actual_context_anchor'; end if;
  execute replace(body,anchor,$new$
    'canRecord',t.status in ('pending','in_progress') and t.execution_result_schema_version=1
      and t.effective_snapshot->>'detailSchemaVersion'='2' and jsonb_array_length(history)=0
      and private.clair_current_user_has_workspace_permission(p_workspace_id,'chart:update'),
    'canAmend',t.status=$new$);
end $patch$;

create function public.clair_record_chart_actual_result(p_workspace_id text,p_actor_user_id uuid,p_task_id uuid,
  p_expected_plan_sha256 text,p_command_id uuid,p_performed_at timestamptz,p_payload jsonb,p_self_performed boolean)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $f$
declare t public.order_tasks; r public.order_execution_result_versions; prior public.order_execution_result_versions;
  hash text; plan_hash text; aggregate_status text; order_status text;
begin
  if auth.uid() is null or p_actor_user_id is distinct from auth.uid() then raise exception 'actor_mismatch' using errcode='42501'; end if;
  if not private.clair_is_active_workspace_member(p_workspace_id)
    or not private.clair_current_user_has_workspace_permission(p_workspace_id,'chart:view')
    or not private.clair_current_user_has_workspace_permission(p_workspace_id,'chart:update') then raise exception 'permission_missing' using errcode='42501'; end if;
  select * into t from public.order_tasks where workspace_id=p_workspace_id and id=p_task_id
    and task_role='execution' and destination_module is null and clinical_order_type in ('consultation','system_exam','other')
    and execution_result_schema_version=1 and effective_snapshot->>'detailSchemaVersion'='2';
  if not found then raise exception 'task_unavailable'; end if;
  perform pg_advisory_xact_lock(hashtextextended('clinical_billing:'||p_workspace_id||':'||t.encounter_id::text,0));
  perform 1 from public.orders root where root.workspace_id=p_workspace_id and root.id=(
    select coalesce(child.parent_chart_order_line_id,child.id) from public.orders child
    where child.workspace_id=p_workspace_id and child.id=t.order_id) for update;
  perform 1 from public.orders where workspace_id=p_workspace_id and id=t.order_id for update;
  if t.parent_task_id is not null then perform 1 from public.order_tasks where workspace_id=p_workspace_id and id=t.parent_task_id for update; end if;
  select * into t from public.order_tasks where workspace_id=p_workspace_id and id=p_task_id for update;
  if p_command_id is null or p_self_performed is distinct from true
    or p_expected_plan_sha256 is null or p_expected_plan_sha256 !~ '^[a-f0-9]{64}$'
    or not private.clair_chart_actual_payload_valid(t.clinical_order_type,p_payload) then raise exception 'invalid_chart_actual'; end if;
  if p_performed_at is null or not isfinite(p_performed_at) or p_performed_at>now()+interval '5 minutes'
    or p_performed_at<now()-interval '10 years' then raise exception 'invalid_performed_at'; end if;
  hash:=encode(extensions.digest(jsonb_build_object('taskId',t.id,'actor',p_actor_user_id,'plan',p_expected_plan_sha256,
    'performedAt',p_performed_at,'payload',p_payload,'selfPerformed',p_self_performed)::text,'sha256'),'hex');
  select * into prior from public.order_execution_result_versions where workspace_id=p_workspace_id and command_id=p_command_id;
  if found then
    if prior.command_sha256 is distinct from hash then raise exception 'idempotency_conflict'; end if;
    return public.clair_get_chart_actual_context(p_workspace_id,p_task_id);
  end if;
  if t.status not in ('pending','in_progress') then raise exception 'task_unavailable'; end if;
  if exists(select 1 from public.order_task_events where workspace_id=p_workspace_id and lifecycle_command_id=p_command_id) then raise exception 'idempotency_conflict'; end if;
  if exists(select 1 from public.order_execution_result_versions where workspace_id=p_workspace_id and task_id=t.id and task_attempt_no=t.attempt_no) then raise exception 'result_revision_conflict'; end if;
  select status into order_status from public.orders where workspace_id=p_workspace_id and id=t.order_id;
  if order_status in ('cancelled','completed') or not exists(select 1 from public.encounters where workspace_id=p_workspace_id and id=t.encounter_id and status<>'cancelled') then raise exception 'task_unavailable'; end if;
  plan_hash:=encode(extensions.digest(t.effective_snapshot::text,'sha256'),'hex');
  if plan_hash is distinct from p_expected_plan_sha256 then raise exception 'plan_revision_conflict'; end if;
  insert into public.order_execution_result_versions(workspace_id,task_id,task_attempt_no,order_id,encounter_id,version,
    clinical_order_type,plan_snapshot,plan_sha256,payload,performed_by_user_id,performed_at,recorded_by_user_id,command_id,command_sha256)
  values(p_workspace_id,t.id,t.attempt_no,t.order_id,t.encounter_id,1,t.clinical_order_type,t.effective_snapshot,
    plan_hash,p_payload,p_actor_user_id,p_performed_at,p_actor_user_id,p_command_id,hash) returning * into r;
  update public.order_tasks set status='complete',started_at=coalesce(started_at,p_performed_at),
    started_by_user_id=coalesce(started_by_user_id,p_actor_user_id),completed_at=now(),updated_at=now(),row_revision=row_revision+1,
    result_snapshot=jsonb_build_object('schemaVersion',1,'executionResultId',r.id,'resultVersion',1,'planSha256',plan_hash)
    where workspace_id=p_workspace_id and id=t.id;
  insert into public.order_task_events(workspace_id,task_id,task_attempt_no,order_id,event_type,actor_user_id,before_values,after_values,lifecycle_command_id)
  values(p_workspace_id,t.id,t.attempt_no,t.order_id,'completed',p_actor_user_id,jsonb_build_object('status',t.status),
    jsonb_build_object('status','complete','executionResultId',r.id,'resultVersion',1),p_command_id);
  if t.parent_task_id is not null then
    aggregate_status:=private.clair_calculate_aggregate_task_status(p_workspace_id,t.parent_task_id);
    update public.order_tasks set status=aggregate_status,
      started_at=case when aggregate_status in ('in_progress','partial_complete','complete') then coalesce(started_at,p_performed_at) else started_at end,
      started_by_user_id=case when aggregate_status in ('in_progress','partial_complete','complete') then coalesce(started_by_user_id,p_actor_user_id) else started_by_user_id end,
      completed_at=case when aggregate_status='complete' then now() else null end,updated_at=now(),row_revision=row_revision+1
      where workspace_id=p_workspace_id and id=t.parent_task_id;
  end if;
  if order_status in ('requested','re_requested','confirmed') then
    perform public.clair_save_chart_order_lifecycle(p_workspace_id,p_actor_user_id,t.encounter_id,t.order_id,'in_progress',null);
  end if;
  perform public.clair_save_chart_order_lifecycle(p_workspace_id,p_actor_user_id,t.encounter_id,t.order_id,'completed',null);
  return public.clair_get_chart_actual_context(p_workspace_id,p_task_id);
end $f$;
revoke all on function public.clair_record_chart_actual_result(text,uuid,uuid,text,uuid,timestamptz,jsonb,boolean) from public,anon,service_role;
grant execute on function public.clair_record_chart_actual_result(text,uuid,uuid,text,uuid,timestamptz,jsonb,boolean) to authenticated;
