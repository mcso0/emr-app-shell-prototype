-- New treatment V3 plans may confirm before medication linkage. V2 stays intact.
set lock_timeout='5s';
set statement_timeout='120s';

alter function private.clair_order_detail_field_schema(text,integer) rename to clair_order_detail_field_schema_before_treatment_v3;
create function private.clair_order_detail_field_schema(p_type text,p_version integer) returns jsonb
language sql stable security definer set search_path=pg_catalog,private as $f$
  select case when p_type='treatment' and p_version=3
    then jsonb_set(private.clair_order_detail_field_schema_before_treatment_v3(p_type,2),'{version}','3')
    else private.clair_order_detail_field_schema_before_treatment_v3(p_type,p_version) end;
$f$;
revoke all on function private.clair_order_detail_field_schema(text,integer) from public,anon,authenticated,service_role;

create or replace function private.clair_treatment_plan_combinations_valid(p_type text,p_version integer,p_inputs jsonb,p_complete boolean)
returns boolean language plpgsql immutable set search_path=pg_catalog as $f$
begin
  if p_type<>'treatment' or p_version not in (2,3) then return true; end if;
  p_inputs:=jsonb_strip_nulls(p_inputs);
  if (p_inputs ? 'plannedAmount') is distinct from (p_inputs ? 'plannedAmountUnit') then return false; end if;
  if p_inputs ? 'linkedMedicationOrderId' and coalesce(p_inputs->>'linkedMedicationOrderId','') !~*
    '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then return false; end if;
  if p_complete and p_inputs->>'administrationPolicy'='direct_quantity'
    and not p_inputs ?& array['plannedAmount','plannedAmountUnit','productReference','plannedRoute'] then return false; end if;
  if p_complete and p_version=2 and p_inputs->>'administrationPolicy'='separate_medication_order'
    and not p_inputs ? 'linkedMedicationOrderId' then return false; end if;
  if p_complete and p_inputs->>'procedureKind'='measurement' and not p_inputs ? 'measurementUnit' then return false; end if;
  return true;
end $f$;

do $patch$
declare body text; anchor text; proc regprocedure;
begin
  proc:='private.clair_order_field_schema_is_valid(text,integer,jsonb)'::regprocedure;
  body:=pg_get_functiondef(proc); anchor:='p_schema_version = 2';
  if (length(body)-length(replace(body,anchor,'')))/length(anchor)<>1 then raise exception 'treatment_v3_schema_anchor'; end if;
  execute replace(body,anchor,'(p_schema_version = 2 or (p_schema_version = 3 and p_clinical_order_type = ''treatment''))');
  foreach proc in array array[
    'private.clair_order_detail_inputs_are_valid(text,integer,jsonb,boolean)'::regprocedure,
    'private.clair_order_detail_inputs_are_valid_for_schema_v1(text,integer,jsonb,boolean,jsonb)'::regprocedure
  ] loop
    body:=pg_get_functiondef(proc); anchor:='p_schema_version not in (1,2)';
    if (length(body)-length(replace(body,anchor,'')))/length(anchor)<>1 then raise exception 'treatment_v3_inputs_anchor'; end if;
    execute replace(body,anchor,'(p_schema_version not in (1,2) and not (p_schema_version=3 and p_clinical_order_type=''treatment''))');
  end loop;
  proc:='private.clair_guard_treatment_actual_v2()'::regprocedure;
  body:=pg_get_functiondef(proc); anchor:='new.plan_snapshot->>''detailSchemaVersion'' is distinct from ''2''';
  if (length(body)-length(replace(body,anchor,'')))/length(anchor)<>1 then raise exception 'treatment_v3_actual_anchor'; end if;
  execute replace(body,anchor,'coalesce(new.plan_snapshot->>''detailSchemaVersion'','''') not in (''2'',''3'')');
end $patch$;
alter table master.order_execution_presets drop constraint order_execution_presets_detail_schema_version_check;
alter table master.order_execution_presets add constraint order_execution_presets_detail_schema_version_check check (
  detail_schema_version=1 or (detail_schema_version=2 and clinical_order_type in ('treatment','consultation','system_exam','other'))
  or (detail_schema_version=3 and clinical_order_type='treatment'));

-- Supplied links are never accepted across encounters or workspaces, including
-- candidate drafts. Absence is permitted only for the new V3 planning contract.
create or replace function private.clair_assert_treatment_medication_link() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,private as $f$
begin
  if tg_op='UPDATE' and old.clinical_order_type='treatment' and old.detail_schema_version=3
    and (new.clinical_order_type is distinct from old.clinical_order_type or new.detail_schema_version is distinct from 3) then
    raise exception 'treatment_plan_version_downgrade';
  end if;
  -- Cancellation remains available when a medication dependency is invalid.
  if new.status='cancelled' then return new; end if;
  if new.clinical_order_type='treatment' and new.detail_schema_version in (2,3)
    and new.detail_inputs->>'administrationPolicy'='separate_medication_order'
    and ((new.detail_schema_version=2 and new.order_confirmation_status in ('confirmed','billed'))
      or (new.detail_schema_version=3 and nullif(new.detail_inputs->>'linkedMedicationOrderId','') is not null)) then
    perform 1 from public.orders medication where medication.workspace_id=new.workspace_id
      and medication.encounter_id=new.encounter_id and medication.id=nullif(new.detail_inputs->>'linkedMedicationOrderId','')::uuid
      and medication.clinical_order_type='dispensing' and medication.status<>'cancelled' and medication.id<>new.id for share;
    if not found then raise exception 'treatment_medication_link_invalid'; end if;
  end if;
  return new;
end $f$;

-- All task mutation paths, including the fulfillment bridge and direct writes,
-- must validate the immutable effective plan before entering execution. A row lock
-- serializes medication cancellation against this check; completion rechecks it.
create function private.clair_guard_treatment_execution_medication() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,private as $f$
declare link_id uuid;
begin
  if tg_op='UPDATE' and old.clinical_order_type='treatment' and old.effective_snapshot->>'detailSchemaVersion'='3'
    and (new.clinical_order_type is distinct from old.clinical_order_type
      or new.effective_snapshot->>'detailSchemaVersion' is distinct from '3') then
    raise exception 'treatment_plan_version_downgrade';
  end if;
  if new.task_role='aggregate' or new.clinical_order_type<>'treatment'
    or new.effective_snapshot->>'detailSchemaVersion' is distinct from '3'
    or new.effective_snapshot#>>'{detailInputs,administrationPolicy}' is distinct from 'separate_medication_order'
    or new.status not in ('in_progress','complete','partial_complete') then return new; end if;
  if tg_op='UPDATE' and new.status is not distinct from old.status
    and new.effective_snapshot is not distinct from old.effective_snapshot then return new; end if;
  link_id:=nullif(new.effective_snapshot#>>'{detailInputs,linkedMedicationOrderId}','')::uuid;
  if link_id is null then raise exception 'treatment_medication_link_required'; end if;
  perform 1 from public.orders medication where medication.workspace_id=new.workspace_id
    and medication.encounter_id=new.encounter_id and medication.id=link_id
    and medication.clinical_order_type='dispensing' and medication.status<>'cancelled'
    and medication.order_confirmation_status in ('confirmed','billed') for share;
  if not found then raise exception 'treatment_medication_link_invalid'; end if;
  return new;
end $f$;
revoke all on function private.clair_guard_treatment_execution_medication() from public,anon,authenticated,service_role;
create trigger order_tasks_treatment_execution_medication before insert or update on public.order_tasks
  for each row execute function private.clair_guard_treatment_execution_medication();
