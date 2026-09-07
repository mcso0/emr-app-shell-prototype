-- Treatment V2 explicitly separates planned quantities from actual execution.
-- Existing V1 presets/snapshots remain immutable and continue to validate as V1.
set lock_timeout='5s';
set statement_timeout='120s';

create function private.clair_order_detail_field_schema(p_type text,p_version integer) returns jsonb
language sql stable security definer set search_path=pg_catalog,public,private as $f$
  select case when p_version=1 then private.clair_order_detail_field_schema_v1(p_type)
    when p_version=2 and p_type='treatment' then '{"clinicalOrderType":"treatment","label":"처치","version":2,"defaultDestinationModule":"treatment","defaultExecutionMode":"routed","fields":[{"key":"procedureKind","valueType":"string","label":"시행 유형","control":"select","options":["procedure","preparation","monitoring","measurement","administration","device_session","dental","surgery"],"displayOrder":5,"required":true,"placement":"detail","semantics":"metadata","unit":null,"defaultValue":null,"validation":{},"bulkEditable":false,"preConfirmEditable":true,"postConfirmBehavior":"amendment","snapshotPath":"detailInputs.procedureKind"},{"key":"method","valueType":"string","label":"시행 예정 방법","control":"input","displayOrder":10,"required":true,"validation":{"minLength":1,"maxLength":200},"placement":"inline","bulkEditable":true,"semantics":"instruction","unit":null,"options":[],"defaultValue":null,"preConfirmEditable":true,"postConfirmBehavior":"amendment","snapshotPath":"detailInputs.method"},{"key":"site","valueType":"string","label":"시행 예정 부위","control":"input","displayOrder":20,"validation":{"minLength":1,"maxLength":120},"placement":"inline","bulkEditable":true,"unit":null,"options":[],"required":false,"defaultValue":null,"semantics":"clinical","preConfirmEditable":true,"postConfirmBehavior":"amendment","snapshotPath":"detailInputs.site"},{"key":"plannedProcedureCount","valueType":"number","label":"시행 예정 횟수","control":"number","displayOrder":25,"required":true,"validation":{"min":1,"max":1000,"precision":0},"placement":"inline","semantics":"calculation_input","unit":null,"options":[],"defaultValue":null,"bulkEditable":false,"preConfirmEditable":true,"postConfirmBehavior":"amendment","snapshotPath":"detailInputs.plannedProcedureCount"},{"key":"procedureCountUnit","valueType":"string","label":"시행 계수 단위","control":"select","options":["session","site","tooth","specimen","load"],"displayOrder":26,"required":true,"placement":"detail","semantics":"metadata","unit":null,"defaultValue":null,"validation":{},"bulkEditable":false,"preConfirmEditable":true,"postConfirmBehavior":"amendment","snapshotPath":"detailInputs.procedureCountUnit"},{"key":"plannedAmount","valueType":"number","label":"예정 사용·투여량","control":"number","displayOrder":30,"validation":{"min":0,"max":1000000,"precision":3},"placement":"inline","semantics":"calculation_input","unit":null,"options":[],"required":false,"defaultValue":null,"bulkEditable":false,"preConfirmEditable":true,"postConfirmBehavior":"amendment","snapshotPath":"detailInputs.plannedAmount"},{"key":"plannedAmountUnit","valueType":"string","label":"예정량 단위","control":"input","displayOrder":31,"validation":{"minLength":1,"maxLength":80},"placement":"inline","semantics":"metadata","unit":null,"options":[],"required":false,"defaultValue":null,"bulkEditable":false,"preConfirmEditable":true,"postConfirmBehavior":"amendment","snapshotPath":"detailInputs.plannedAmountUnit"},{"key":"frequency","valueType":"string","label":"시행 빈도","control":"select","options":["once","sid","bid","tid","qid","custom"],"displayOrder":40,"required":true,"placement":"inline","bulkEditable":true,"semantics":"instruction","unit":null,"defaultValue":null,"validation":{},"preConfirmEditable":true,"postConfirmBehavior":"amendment","snapshotPath":"detailInputs.frequency"},{"key":"schedule","valueType":"string","label":"시행 예정 일정","control":"schedule","displayOrder":50,"required":true,"validation":{"minLength":1,"maxLength":1000},"placement":"inline","semantics":"instruction","unit":null,"options":[],"defaultValue":null,"bulkEditable":false,"preConfirmEditable":true,"postConfirmBehavior":"amendment","snapshotPath":"detailInputs.schedule"},{"key":"administrationPolicy","valueType":"string","label":"약품·용액 사용 방식","control":"select","options":["not_applicable","separate_medication_order","direct_quantity"],"displayOrder":60,"required":true,"placement":"detail","semantics":"instruction","unit":null,"defaultValue":null,"validation":{},"bulkEditable":false,"preConfirmEditable":true,"postConfirmBehavior":"amendment","snapshotPath":"detailInputs.administrationPolicy"},{"key":"linkedMedicationOrderId","valueType":"string","label":"연결 약품 오더 ID","control":"input","displayOrder":61,"validation":{"minLength":36,"maxLength":36},"placement":"detail","semantics":"metadata","unit":null,"options":[],"required":false,"defaultValue":null,"bulkEditable":false,"preConfirmEditable":true,"postConfirmBehavior":"amendment","snapshotPath":"detailInputs.linkedMedicationOrderId"},{"key":"productReference","valueType":"string","label":"예정 약품·용액 식별","control":"input","displayOrder":62,"validation":{"minLength":1,"maxLength":500},"placement":"detail","semantics":"metadata","unit":null,"options":[],"required":false,"defaultValue":null,"bulkEditable":false,"preConfirmEditable":true,"postConfirmBehavior":"amendment","snapshotPath":"detailInputs.productReference"},{"key":"plannedRoute","valueType":"string","label":"예정 사용 경로","control":"input","displayOrder":63,"validation":{"minLength":1,"maxLength":100},"placement":"detail","semantics":"instruction","unit":null,"options":[],"required":false,"defaultValue":null,"bulkEditable":false,"preConfirmEditable":true,"postConfirmBehavior":"amendment","snapshotPath":"detailInputs.plannedRoute"},{"key":"deviceProtocol","valueType":"string","label":"장비·수기 프로토콜","control":"textarea","displayOrder":70,"validation":{"maxLength":2000},"placement":"detail","semantics":"instruction","unit":null,"options":[],"required":false,"defaultValue":null,"bulkEditable":false,"preConfirmEditable":true,"postConfirmBehavior":"amendment","snapshotPath":"detailInputs.deviceProtocol"},{"key":"measurementUnit","valueType":"string","label":"측정 결과 단위","control":"input","displayOrder":80,"validation":{"minLength":1,"maxLength":80},"placement":"detail","semantics":"metadata","unit":null,"options":[],"required":false,"defaultValue":null,"bulkEditable":false,"preConfirmEditable":true,"postConfirmBehavior":"amendment","snapshotPath":"detailInputs.measurementUnit"},{"key":"observationDomains","valueType":"string_array","label":"관찰 항목","control":"textarea","displayOrder":90,"placement":"detail","semantics":"instruction","unit":null,"options":[],"required":false,"defaultValue":null,"validation":{},"bulkEditable":false,"preConfirmEditable":true,"postConfirmBehavior":"amendment","snapshotPath":"detailInputs.observationDomains"},{"key":"stagedInstructions","valueType":"string","label":"단계별 예정 지시","control":"textarea","displayOrder":110,"required":true,"validation":{"minLength":1,"maxLength":4000},"placement":"detail","semantics":"instruction","unit":null,"options":[],"defaultValue":null,"bulkEditable":false,"preConfirmEditable":true,"postConfirmBehavior":"amendment","snapshotPath":"detailInputs.stagedInstructions"},{"key":"exceptions","valueType":"string","label":"중단·확인 조건","control":"textarea","displayOrder":120,"required":true,"validation":{"minLength":1,"maxLength":2000},"placement":"detail","semantics":"instruction","unit":null,"options":[],"defaultValue":null,"bulkEditable":false,"preConfirmEditable":true,"postConfirmBehavior":"amendment","snapshotPath":"detailInputs.exceptions"}]}'::jsonb
    else null end;
$f$;
revoke all on function private.clair_order_detail_field_schema(text,integer) from public,anon,authenticated,service_role;

create function private.clair_treatment_plan_combinations_valid(p_type text,p_version integer,p_inputs jsonb,p_complete boolean)
returns boolean language plpgsql immutable set search_path=pg_catalog as $f$
begin
  if p_type<>'treatment' or p_version<>2 then return true; end if;
  p_inputs:=jsonb_strip_nulls(p_inputs);
  if (p_inputs ? 'plannedAmount') is distinct from (p_inputs ? 'plannedAmountUnit') then return false; end if;
  if p_inputs ? 'linkedMedicationOrderId' and coalesce(p_inputs->>'linkedMedicationOrderId','') !~*
    '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then return false; end if;
  if p_complete and p_inputs->>'administrationPolicy'='direct_quantity'
    and not p_inputs ?& array['plannedAmount','plannedAmountUnit','productReference','plannedRoute'] then return false; end if;
  if p_complete and p_inputs->>'administrationPolicy'='separate_medication_order'
    and not p_inputs ? 'linkedMedicationOrderId' then return false; end if;
  if p_complete and p_inputs->>'procedureKind'='measurement' and not p_inputs ? 'measurementUnit' then return false; end if;
  return true;
end $f$;
revoke all on function private.clair_treatment_plan_combinations_valid(text,integer,jsonb,boolean) from public,anon,authenticated,service_role;

-- Change function bodies in place: CHECK constraints retain the same OIDs.
do $patch$
declare body text; anchor text; proc regprocedure;
begin
  proc:='private.clair_order_field_schema_is_valid(text,integer,jsonb)'::regprocedure;
  body:=pg_get_functiondef(proc); anchor:='p_schema_version = 1';
  if (length(body)-length(replace(body,anchor,'')))/length(anchor)<>1 then raise exception 'schema_validator_anchor_mismatch'; end if;
  execute replace(body,anchor,'(p_schema_version = 1 or (p_schema_version = 2 and p_clinical_order_type = ''treatment'' and p_schema = private.clair_order_detail_field_schema(p_clinical_order_type,p_schema_version)))');

  foreach proc in array array[
    'private.clair_order_detail_inputs_are_valid(text,integer,jsonb,boolean)'::regprocedure,
    'private.clair_order_detail_inputs_are_valid_for_schema_v1(text,integer,jsonb,boolean,jsonb)'::regprocedure
  ] loop
    body:=pg_get_functiondef(proc); anchor:='p_schema_version is distinct from 1';
    if (length(body)-length(replace(body,anchor,'')))/length(anchor)<>1 then raise exception 'detail_validator_version_anchor_mismatch: %',proc; end if;
    body:=replace(body,anchor,'(p_schema_version is null or p_schema_version not in (1,2))');
    body:=replace(body,'private.clair_order_detail_field_schema_v1(p_clinical_order_type)',
      'private.clair_order_detail_field_schema(p_clinical_order_type,p_schema_version)');
    anchor:='return true;';
    if (length(body)-length(replace(body,anchor,'')))/length(anchor)<>1 then raise exception 'detail_validator_result_anchor_mismatch: %',proc; end if;
    body:=replace(body,anchor,'return private.clair_treatment_plan_combinations_valid(p_clinical_order_type,p_schema_version,p_detail_inputs,p_require_complete);');
    execute body;
  end loop;
  proc:='private.clair_execution_contract_before_authority(text,integer,jsonb,jsonb)'::regprocedure;
  body:=pg_get_functiondef(proc); anchor:='private.clair_order_detail_field_schema_v1(p_clinical_order_type)';
  if (length(body)-length(replace(body,anchor,'')))/length(anchor)<>1 then raise exception 'preset_schema_getter_anchor_mismatch'; end if;
  execute replace(body,anchor,'private.clair_order_detail_field_schema(p_clinical_order_type,p_detail_schema_version)');

  proc:='private.clair_sync_order_catalog_execution_contract()'::regprocedure;
  body:=pg_get_functiondef(proc);
  anchor:=E'new.detail_schema_version := 1;\n    new.detail_field_schema := private.clair_order_detail_field_schema_v1(new.clinical_order_type);';
  if (length(body)-length(replace(body,anchor,'')))/length(anchor)<>2 then raise exception 'catalog_schema_sync_anchor_mismatch'; end if;
  execute replace(body,anchor,E'new.detail_schema_version := coalesce(new.detail_schema_version,1);\n    new.detail_field_schema := private.clair_order_detail_field_schema(new.clinical_order_type,new.detail_schema_version);');
end $patch$;

-- A schema upgrade is atomic only for an untouched execution copy. Preserve
-- local/legacy whole-object overrides as the existing explicit $schema conflict.
do $patch$
declare body text; anchor text;
begin
  body:=pg_get_functiondef('private.clair_merge_order_execution_fields(text,text)'::regprocedure);
  anchor:='if c.clinical_order_type<>p.clinical_order_type or c.detail_schema_version<>p.detail_schema_version then';
  if (length(body)-length(replace(body,anchor,'')))/length(anchor)<>1 then raise exception 'schema_merge_upgrade_anchor_mismatch'; end if;
  execute replace(body,anchor,$upgrade$
  if c.clinical_order_type=p.clinical_order_type and c.detail_schema_version<>p.detail_schema_version
    and not exists(select 1 from unnest(custom) f where f like 'defaultDetailInputs.%')
    and not exists(select 1 from jsonb_object_keys(vals||policies||b) key
      where private.clair_execution_field_cell(vals,policies,key) is distinct from b->key->'cell') then
    b:='{}'::jsonb;
    for k in select jsonb_object_keys(p.default_detail_inputs||p.field_policies) loop
      b:=jsonb_set(b,array[k],jsonb_build_object('cell',private.clair_execution_field_cell(p.default_detail_inputs,p.field_policies,k),
        'masterRevision',p.order_record_revision,'presetRevision',p.preset_revision,'presetId',p.id,'sha256',p.content_sha256));
    end loop;
    update public.order_catalog_items set default_detail_inputs=p.default_detail_inputs,default_detail_input_policies=p.field_policies,
      detail_schema_version=p.detail_schema_version,detail_field_schema=private.clair_order_detail_field_schema(p.clinical_order_type,p.detail_schema_version),
      source_execution_preset_id=p.id,source_execution_preset_revision=p.preset_revision,source_execution_preset_sha256=p.content_sha256,
      execution_source_baseline=b,execution_merge_conflicts='{}'::jsonb,catalog_revision=catalog_revision+1,updated_at=now()
      where workspace_id=p_workspace_id and id=p_item_id returning * into n;
    perform private.clair_pr020_append_order_catalog_audit(p_workspace_id,'order_catalog.updated',c.id,c,n,
      'execution_schema_source_upgrade',array['defaultDetailInputs','detailSchemaVersion']);
    return true;
  end if;
  if c.clinical_order_type<>p.clinical_order_type or c.detail_schema_version<>p.detail_schema_version then
$upgrade$);
end $patch$;

alter table master.order_execution_presets drop constraint order_execution_presets_detail_schema_version_check;
alter table master.order_execution_presets add constraint order_execution_presets_detail_schema_version_check
  check (detail_schema_version=1 or (detail_schema_version=2 and clinical_order_type='treatment'));

-- Both the exact source copier and frozen snapshot validator must use the
-- source preset's schema version, including any guarded wrapper aliases.
do $patch$
declare p record; body text; a text; b text; n integer:=0;
begin
  a:=E'private.clair_order_detail_field_schema_v1(\n      v_item.preset_clinical_order_type\n    )';
  b:=E'private.clair_order_detail_field_schema_v1(\n    v_preset.clinical_order_type\n  )';
  for p in select oid from pg_proc where pronamespace in ('private'::regnamespace,'public'::regnamespace) and prokind='f'
    and (prosrc like '%'||a||'%' or prosrc like '%'||b||'%') loop
    body:=pg_get_functiondef(p.oid);
    if position(a in body)>0 then n:=n+1; body:=replace(body,a,'private.clair_order_detail_field_schema(v_item.preset_clinical_order_type,v_item.preset_detail_schema_version)'); end if;
    if position(b in body)>0 then n:=n+1; body:=replace(body,b,'private.clair_order_detail_field_schema(v_preset.clinical_order_type,v_preset.detail_schema_version)'); end if;
    execute body;
  end loop;
  if n<>2 then raise exception 'preset_copy_snapshot_schema_anchor_mismatch: %',n; end if;
end $patch$;

-- A patient-specific medication link is only a reference, never a reusable
-- product default. Validate its actual workspace/encounter at confirmation.
create function private.clair_assert_treatment_medication_link() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,private as $f$
begin
  if new.clinical_order_type='treatment' and new.detail_schema_version=2
    and new.order_confirmation_status in ('confirmed','billed')
    and new.detail_inputs->>'administrationPolicy'='separate_medication_order' then
    if not exists(select 1 from public.orders medication where medication.workspace_id=new.workspace_id
      and medication.encounter_id=new.encounter_id
      and medication.id=nullif(new.detail_inputs->>'linkedMedicationOrderId','')::uuid
      and medication.clinical_order_type='dispensing' and medication.status<>'cancelled'
      and medication.id<>new.id) then raise exception 'treatment_medication_link_invalid'; end if;
  end if;
  return new;
end $f$;
revoke all on function private.clair_assert_treatment_medication_link() from public,anon,authenticated,service_role;
create trigger orders_treatment_medication_link before insert or update on public.orders
  for each row execute function private.clair_assert_treatment_medication_link();
