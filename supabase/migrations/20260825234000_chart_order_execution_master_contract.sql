-- CLAiR chart order execution system, Phase 1.
-- Additive order-master and order snapshot contract. Existing four execution
-- order_type values and legacy catalog columns remain authoritative for the
-- currently deployed application until the v2 feature is activated.

set lock_timeout = '5s';
set statement_timeout = '120s';

create or replace function private.clair_order_detail_field_schema_v1(
  p_clinical_order_type text
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $function$
  with field_definitions(
    clinical_order_type,
    field_key,
    value_type,
    field_label,
    control,
    unit,
    options,
    display_order,
    required,
    default_value,
    validation,
    placement,
    bulk_editable,
    semantics
  ) as (
    values
      ('consultation','responsibleClinicianId','string','담당자','select',null,'[]'::jsonb,10,true,null,'{}'::jsonb,'inline',true,'metadata'),
      ('consultation','occurrenceCount','number','횟수','number','회','[]'::jsonb,20,true,'1'::jsonb,'{"min":1,"precision":0}'::jsonb,'inline',true,'calculation_input'),
      ('consultation','timing','string','실행 시점','select',null,'["now","scheduled"]'::jsonb,30,true,'"now"'::jsonb,'{}'::jsonb,'inline',true,'clinical'),
      ('consultation','instructionSummary','string','지시 요약','input',null,'[]'::jsonb,40,true,null,'{"minLength":1,"maxLength":300}'::jsonb,'inline',false,'instruction'),
      ('consultation','consultationNote','string','상담 메모','textarea',null,'[]'::jsonb,110,false,null,'{"maxLength":4000}'::jsonb,'detail',false,'instruction'),
      ('consultation','attachments','attachment_array','첨부','attachments',null,'[]'::jsonb,120,false,null,'{}'::jsonb,'detail',false,'metadata'),
      ('clinical_lab','specimenType','string','검체','select',null,'["blood","serum","plasma","urine","feces","swab","other"]'::jsonb,10,true,null,'{}'::jsonb,'inline',true,'clinical'),
      ('clinical_lab','testPanel','string','패널/항목','input',null,'[]'::jsonb,20,true,null,'{"minLength":1,"maxLength":200}'::jsonb,'inline',false,'clinical'),
      ('clinical_lab','collectionCondition','string','채취 조건','input',null,'[]'::jsonb,30,true,null,'{"minLength":1,"maxLength":300}'::jsonb,'inline',true,'instruction'),
      ('clinical_lab','pretreatment','string','전처리','textarea',null,'[]'::jsonb,110,false,null,'{"maxLength":1000}'::jsonb,'detail',false,'instruction'),
      ('clinical_lab','clinicalContext','string','추가 임상정보','textarea',null,'[]'::jsonb,120,false,null,'{"maxLength":4000}'::jsonb,'detail',false,'clinical'),
      ('imaging','bodyRegion','string','부위','input',null,'[]'::jsonb,10,true,null,'{"minLength":1,"maxLength":120}'::jsonb,'inline',true,'clinical'),
      ('imaging','position','string','자세','input',null,'[]'::jsonb,20,true,null,'{"minLength":1,"maxLength":120}'::jsonb,'inline',true,'clinical'),
      ('imaging','viewCount','number','View 수','number','view','[]'::jsonb,30,true,'1'::jsonb,'{"min":1,"max":20,"precision":0}'::jsonb,'inline',true,'calculation_input'),
      ('imaging','contrastRequired','boolean','조영','switch',null,'[]'::jsonb,40,true,'false'::jsonb,'{}'::jsonb,'inline',true,'clinical'),
      ('imaging','sedationRequired','boolean','진정','switch',null,'[]'::jsonb,50,true,'false'::jsonb,'{}'::jsonb,'inline',true,'clinical'),
      ('imaging','imagingProtocol','string','촬영 프로토콜','textarea',null,'[]'::jsonb,110,false,null,'{"maxLength":4000}'::jsonb,'detail',false,'instruction'),
      ('imaging','exceptions','string','예외','textarea',null,'[]'::jsonb,120,false,null,'{"maxLength":2000}'::jsonb,'detail',false,'instruction'),
      ('external_lab','providerId','string','검사 기관','select',null,'[]'::jsonb,10,true,null,'{}'::jsonb,'inline',true,'metadata'),
      ('external_lab','specimenType','string','검체','select',null,'["blood","serum","plasma","urine","feces","swab","tissue","other"]'::jsonb,20,true,null,'{}'::jsonb,'inline',true,'clinical'),
      ('external_lab','testItem','string','검사항목','input',null,'[]'::jsonb,30,true,null,'{"minLength":1,"maxLength":200}'::jsonb,'inline',false,'clinical'),
      ('external_lab','shippingCondition','string','발송 조건','input',null,'[]'::jsonb,40,true,null,'{"minLength":1,"maxLength":300}'::jsonb,'inline',true,'instruction'),
      ('external_lab','providerForm','attachment_array','기관 양식','attachments',null,'[]'::jsonb,110,false,null,'{}'::jsonb,'detail',false,'metadata'),
      ('external_lab','packaging','string','포장 정보','textarea',null,'[]'::jsonb,120,false,null,'{"maxLength":1000}'::jsonb,'detail',false,'instruction'),
      ('external_lab','tracking','string','추적 정보','input',null,'[]'::jsonb,130,false,null,'{"maxLength":200}'::jsonb,'detail',false,'metadata'),
      ('dispensing','doseBasis','string','용량 기준','select',null,'["patient","kg","body_surface_area"]'::jsonb,10,true,null,'{}'::jsonb,'inline',true,'calculation_input'),
      ('dispensing','dose','number','용량','number',null,'[]'::jsonb,20,true,null,'{"min":0,"precision":3}'::jsonb,'inline',false,'calculation_input'),
      ('dispensing','doseUnit','string','단위','select',null,'["mg","mg/kg","ml","ml/kg","tablet","capsule","drop"]'::jsonb,30,true,null,'{}'::jsonb,'inline',true,'calculation_input'),
      ('dispensing','route','string','경로','select',null,'["PO","IV","IM","SC","topical","otic","ophthalmic","other"]'::jsonb,40,true,null,'{}'::jsonb,'inline',true,'instruction'),
      ('dispensing','frequency','string','빈도','select',null,'["once","sid","bid","tid","qid","prn","custom"]'::jsonb,50,true,null,'{}'::jsonb,'inline',true,'calculation_input'),
      ('dispensing','durationDays','number','일수','number','일','[]'::jsonb,60,true,null,'{"min":1,"precision":0}'::jsonb,'inline',false,'calculation_input'),
      ('dispensing','totalQuantity','number','총량','number',null,'[]'::jsonb,70,true,null,'{"min":0,"precision":3}'::jsonb,'inline',false,'calculation_input'),
      ('dispensing','taperSchedule','string','증감 스케줄','schedule',null,'[]'::jsonb,110,false,null,'{"maxLength":4000}'::jsonb,'detail',false,'instruction'),
      ('dispensing','compoundNote','string','조제 메모','textarea',null,'[]'::jsonb,120,false,null,'{"maxLength":2000}'::jsonb,'detail',false,'instruction'),
      ('dispensing','guardianNote','string','보호자 전달 메모','textarea',null,'[]'::jsonb,130,false,null,'{"maxLength":2000}'::jsonb,'detail',false,'instruction'),
      ('treatment','method','string','방법','input',null,'[]'::jsonb,10,true,null,'{"minLength":1,"maxLength":200}'::jsonb,'inline',true,'instruction'),
      ('treatment','site','string','부위','input',null,'[]'::jsonb,20,true,null,'{"minLength":1,"maxLength":120}'::jsonb,'inline',true,'clinical'),
      ('treatment','administeredAmount','number','투여량','number',null,'[]'::jsonb,30,true,null,'{"min":0,"precision":3}'::jsonb,'inline',false,'calculation_input'),
      ('treatment','frequency','string','횟수','select',null,'["once","sid","bid","tid","qid","custom"]'::jsonb,40,true,null,'{}'::jsonb,'inline',true,'instruction'),
      ('treatment','schedule','string','실행 일정','schedule',null,'[]'::jsonb,50,true,null,'{"minLength":1,"maxLength":1000}'::jsonb,'inline',false,'instruction'),
      ('treatment','stagedInstructions','string','단계별 지시','textarea',null,'[]'::jsonb,110,false,null,'{"maxLength":4000}'::jsonb,'detail',false,'instruction'),
      ('treatment','exceptions','string','예외','textarea',null,'[]'::jsonb,120,false,null,'{"maxLength":2000}'::jsonb,'detail',false,'instruction'),
      ('hospitalization','durationDays','number','기간','number','일','[]'::jsonb,10,true,null,'{"min":1,"precision":0}'::jsonb,'inline',false,'calculation_input'),
      ('hospitalization','wardOrCage','string','병동/케이지','select',null,'[]'::jsonb,20,true,null,'{}'::jsonb,'inline',true,'metadata'),
      ('hospitalization','careLevel','string','관리 수준','select',null,'["standard","enhanced","intensive","isolation"]'::jsonb,30,true,null,'{}'::jsonb,'inline',true,'instruction'),
      ('hospitalization','monitoringInterval','number','모니터링 주기','number','분','[]'::jsonb,40,true,null,'{"min":1,"precision":0}'::jsonb,'inline',true,'instruction'),
      ('hospitalization','nursingPlan','string','간호 계획','textarea',null,'[]'::jsonb,110,false,null,'{"maxLength":4000}'::jsonb,'detail',false,'instruction'),
      ('hospitalization','dietPlan','string','식이 계획','textarea',null,'[]'::jsonb,120,false,null,'{"maxLength":2000}'::jsonb,'detail',false,'instruction'),
      ('hospitalization','isolationPlan','string','격리 계획','textarea',null,'[]'::jsonb,130,false,null,'{"maxLength":2000}'::jsonb,'detail',false,'instruction'),
      ('other','structuredValue','string','구조화 입력','input',null,'[]'::jsonb,10,true,null,'{"minLength":1,"maxLength":500}'::jsonb,'inline',false,'clinical'),
      ('other','description','string','설명','textarea',null,'[]'::jsonb,110,false,null,'{"maxLength":4000}'::jsonb,'detail',false,'instruction'),
      ('other','attachments','attachment_array','첨부','attachments',null,'[]'::jsonb,120,false,null,'{}'::jsonb,'detail',false,'metadata'),
      ('other','exceptions','string','예외','textarea',null,'[]'::jsonb,130,false,null,'{"maxLength":2000}'::jsonb,'detail',false,'instruction')
  ),
  schema_defaults as (
    select
      case p_clinical_order_type
        when 'consultation' then '진료'
        when 'clinical_lab' then '임상'
        when 'imaging' then '영상'
        when 'external_lab' then '원외(검사)'
        when 'dispensing' then '조제'
        when 'treatment' then '처치'
        when 'hospitalization' then '입원'
        else '기타'
      end as schema_label,
      case p_clinical_order_type
        when 'consultation' then null
        when 'clinical_lab' then 'lab'
        when 'imaging' then 'imaging'
        when 'external_lab' then 'external_lab'
        when 'dispensing' then 'dispensing'
        when 'treatment' then 'treatment'
        when 'hospitalization' then 'hospitalization'
        else null
      end as default_destination,
      case when p_clinical_order_type in ('consultation','other')
        then 'immediate_complete' else 'routed' end as default_execution_mode
  )
  select jsonb_build_object(
    'clinicalOrderType', p_clinical_order_type,
    'label', d.schema_label,
    'version', 1,
    'defaultDestinationModule', d.default_destination,
    'defaultExecutionMode', d.default_execution_mode,
    'fields', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'key', f.field_key,
          'valueType', f.value_type,
          'label', f.field_label,
          'control', f.control,
          'unit', f.unit,
          'options', f.options,
          'displayOrder', f.display_order,
          'required', f.required,
          'defaultValue', f.default_value,
          'validation', f.validation,
          'placement', f.placement,
          'bulkEditable', f.bulk_editable,
          'semantics', f.semantics,
          'preConfirmEditable', true,
          'postConfirmBehavior', 'amendment',
          'snapshotPath', 'detailInputs.' || f.field_key
        ) order by f.display_order
      )
      from field_definitions f
      where f.clinical_order_type = p_clinical_order_type
    ), '[]'::jsonb)
  )
  from schema_defaults d;
$function$;

revoke all on function private.clair_order_detail_field_schema_v1(text) from public;

create or replace function private.clair_order_field_schema_is_valid(
  p_clinical_order_type text,
  p_schema_version integer,
  p_schema jsonb
)
returns boolean
language sql
immutable
security definer
set search_path = pg_catalog
as $function$
  select
    p_schema_version = 1
    and jsonb_typeof(p_schema) = 'object'
    and p_schema ->> 'clinicalOrderType' = p_clinical_order_type
    and (p_schema ->> 'version')::integer = p_schema_version
    and jsonb_typeof(p_schema -> 'fields') = 'array'
    and jsonb_array_length(p_schema -> 'fields') > 0
    and not exists (
      select 1
      from jsonb_array_elements(p_schema -> 'fields') field
      where jsonb_typeof(field) <> 'object'
        or not field ?& array[
          'key','valueType','label','control','unit','options','displayOrder',
          'required','defaultValue','validation','placement','bulkEditable',
          'semantics','preConfirmEditable','postConfirmBehavior','snapshotPath'
        ]
    );
$function$;

revoke all on function private.clair_order_field_schema_is_valid(text, integer, jsonb) from public;

alter table public.order_catalog_items
  add column if not exists clinical_order_type text,
  add column if not exists is_external_lab boolean,
  add column if not exists destination_module text,
  add column if not exists execution_mode text,
  add column if not exists detail_schema_version integer,
  add column if not exists detail_field_schema jsonb,
  add column if not exists billing_eligible boolean;

update public.order_catalog_items
set
  clinical_order_type = coalesce(clinical_order_type, case category_group
    when 'consultation' then 'consultation'
    when 'lab' then 'clinical_lab'
    when 'imaging' then 'imaging'
    when 'medication' then 'dispensing'
    when 'treatment' then 'treatment'
    when 'hospitalization' then 'hospitalization'
    else 'other'
  end),
  is_external_lab = coalesce(is_external_lab, false),
  destination_module = case
    when coalesce(execution_mode,
      case when default_task_required and default_destination_module not in ('billing_only','chart_only')
        then 'routed' else 'immediate_complete' end
    ) = 'routed'
      then case default_destination_module
        when 'lab' then 'lab'
        when 'imaging' then 'imaging'
        when 'dispensing' then 'dispensing'
        when 'treatment' then 'treatment'
        else destination_module
      end
    else null
  end,
  execution_mode = coalesce(execution_mode,
    case when default_task_required and default_destination_module not in ('billing_only','chart_only')
      then 'routed' else 'immediate_complete' end
  ),
  detail_schema_version = coalesce(detail_schema_version, 1),
  billing_eligible = coalesce(billing_eligible, billing_reflection_enabled);

update public.order_catalog_items
set detail_field_schema = private.clair_order_detail_field_schema_v1(clinical_order_type)
where detail_field_schema is null
   or not private.clair_order_field_schema_is_valid(
     clinical_order_type,
     detail_schema_version,
     detail_field_schema
   );

-- Production has deferred catalog/order lineage constraints. Flush their
-- trigger events before the following ALTER TABLE statements acquire a new
-- table definition in this same transaction.
set constraints all immediate;

alter table public.order_catalog_items
  alter column clinical_order_type set not null,
  alter column is_external_lab set not null,
  alter column execution_mode set not null,
  alter column detail_schema_version set not null,
  alter column detail_field_schema set not null,
  alter column billing_eligible set not null;

alter table public.order_catalog_items
  add constraint order_catalog_items_clinical_order_type_check
    check (clinical_order_type in (
      'consultation','clinical_lab','imaging','external_lab',
      'dispensing','treatment','hospitalization','other'
    )) not valid,
  add constraint order_catalog_items_external_lab_canonical_check
    check (is_external_lab = (clinical_order_type = 'external_lab')) not valid,
  add constraint order_catalog_items_destination_module_check
    check (destination_module is null or destination_module in (
      'consultation','lab','imaging','external_lab','dispensing',
      'treatment','hospitalization','other'
    )) not valid,
  add constraint order_catalog_items_execution_mode_check
    check (execution_mode in ('routed','immediate_complete')) not valid,
  add constraint order_catalog_items_execution_destination_check
    check (
      (execution_mode = 'routed' and destination_module is not null)
      or (execution_mode = 'immediate_complete' and destination_module is null)
    ) not valid,
  add constraint order_catalog_items_detail_schema_check
    check (private.clair_order_field_schema_is_valid(
      clinical_order_type,
      detail_schema_version,
      detail_field_schema
    )) not valid;

alter table public.order_catalog_items
  validate constraint order_catalog_items_clinical_order_type_check,
  validate constraint order_catalog_items_external_lab_canonical_check,
  validate constraint order_catalog_items_destination_module_check,
  validate constraint order_catalog_items_execution_mode_check,
  validate constraint order_catalog_items_execution_destination_check,
  validate constraint order_catalog_items_detail_schema_check;

create index if not exists order_catalog_items_clinical_type_idx
  on public.order_catalog_items(workspace_id, clinical_order_type, availability_status);
create index if not exists order_catalog_items_destination_idx
  on public.order_catalog_items(workspace_id, destination_module, availability_status)
  where destination_module is not null;

create or replace function private.clair_sync_order_catalog_execution_contract()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_legacy_changed boolean := false;
  v_canonical_changed boolean := false;
begin
  if tg_op = 'UPDATE' then
    v_legacy_changed :=
      new.category_group is distinct from old.category_group
      or new.default_destination_module is distinct from old.default_destination_module
      or new.default_task_required is distinct from old.default_task_required
      or new.billing_reflection_enabled is distinct from old.billing_reflection_enabled;
    v_canonical_changed :=
      new.clinical_order_type is distinct from old.clinical_order_type
      or new.is_external_lab is distinct from old.is_external_lab
      or new.destination_module is distinct from old.destination_module
      or new.execution_mode is distinct from old.execution_mode
      or new.detail_schema_version is distinct from old.detail_schema_version
      or new.detail_field_schema is distinct from old.detail_field_schema
      or new.billing_eligible is distinct from old.billing_eligible;
  end if;

  if tg_op = 'INSERT'
     or new.clinical_order_type is null
     or (v_legacy_changed and not v_canonical_changed) then
    new.clinical_order_type := case new.category_group
      when 'consultation' then 'consultation'
      when 'lab' then case when coalesce(new.is_external_lab, false)
        then 'external_lab' else 'clinical_lab' end
      when 'imaging' then 'imaging'
      when 'medication' then 'dispensing'
      when 'treatment' then 'treatment'
      when 'hospitalization' then 'hospitalization'
      else 'other'
    end;
    new.is_external_lab := new.clinical_order_type = 'external_lab';
    new.execution_mode := case
      when new.default_task_required
        and new.default_destination_module not in ('billing_only','chart_only')
      then 'routed'
      else 'immediate_complete'
    end;
    new.destination_module := case
      when new.execution_mode = 'immediate_complete' then null
      when new.default_destination_module in ('lab','imaging','dispensing','treatment')
        then new.default_destination_module
      else null
    end;
    new.detail_schema_version := 1;
    new.detail_field_schema := private.clair_order_detail_field_schema_v1(new.clinical_order_type);
    new.billing_eligible := new.billing_reflection_enabled;
  end if;

  if new.detail_field_schema is null then
    new.detail_schema_version := 1;
    new.detail_field_schema := private.clair_order_detail_field_schema_v1(new.clinical_order_type);
  end if;
  return new;
end;
$function$;

revoke all on function private.clair_sync_order_catalog_execution_contract() from public;

drop trigger if exists order_catalog_items_execution_contract_sync_trg
  on public.order_catalog_items;
create trigger order_catalog_items_execution_contract_sync_trg
before insert or update on public.order_catalog_items
for each row execute function private.clair_sync_order_catalog_execution_contract();

alter table public.orders
  add column if not exists clinical_order_type text,
  add column if not exists destination_module text,
  add column if not exists execution_mode text,
  add column if not exists detail_inputs jsonb,
  add column if not exists detail_schema_version integer,
  add column if not exists confirmed_snapshot jsonb,
  add column if not exists revision_no integer,
  add column if not exists billing_eligible boolean;

update public.orders o
set
  clinical_order_type = coalesce(o.clinical_order_type, case
    when o.row_type = 'set' then 'other'
    when o.order_type = 'lab' then 'clinical_lab'
    when o.order_type = 'imaging' then 'imaging'
    when o.order_type = 'dispensing' then 'dispensing'
    when o.order_type = 'treatment' then 'treatment'
    else 'other'
  end),
  destination_module = coalesce(o.destination_module, (
    select case w.queue_type
      when 'lab' then 'lab'
      when 'imaging' then 'imaging'
      when 'dispensing' then 'dispensing'
      when 'treatment' then 'treatment'
      else null
    end
    from public.order_fulfillment_work_items w
    where w.workspace_id = o.workspace_id and w.order_id = o.id
    limit 1
  ), case
    when c.execution_mode = 'routed' then c.destination_module
    else null
  end),
  detail_inputs = coalesce(o.detail_inputs, '{}'::jsonb),
  detail_schema_version = coalesce(o.detail_schema_version, c.detail_schema_version, 1),
  confirmed_snapshot = coalesce(o.confirmed_snapshot, case
    when o.order_confirmation_status in ('confirmed','billed') then
      o.applied_snapshot || jsonb_build_object(
        'clinicalOrderType', coalesce(c.clinical_order_type, case o.order_type
          when 'lab' then 'clinical_lab'
          when 'imaging' then 'imaging'
          when 'dispensing' then 'dispensing'
          else 'treatment'
        end),
        'detailInputs', '{}'::jsonb,
        'detailSchemaVersion', coalesce(c.detail_schema_version, 1),
        'priority', case when o.priority = 'urgent' then 'urgent' else 'normal' end
      )
    else '{}'::jsonb end),
  revision_no = coalesce(o.revision_no, 0),
  billing_eligible = coalesce(o.billing_eligible, o.billing_reflection_enabled)
from public.order_catalog_items c
where c.workspace_id = o.workspace_id
  and c.id = o.workspace_catalog_item_id;

update public.orders o
set
  clinical_order_type = coalesce(o.clinical_order_type, case
    when o.row_type = 'set' then 'other'
    when o.order_type = 'lab' then 'clinical_lab'
    when o.order_type = 'imaging' then 'imaging'
    when o.order_type = 'dispensing' then 'dispensing'
    when o.order_type = 'treatment' then 'treatment'
    else 'other'
  end),
  detail_inputs = coalesce(o.detail_inputs, '{}'::jsonb),
  detail_schema_version = coalesce(o.detail_schema_version, 1),
  confirmed_snapshot = coalesce(o.confirmed_snapshot, case
    when o.order_confirmation_status in ('confirmed','billed') then
      o.applied_snapshot || jsonb_build_object(
        'clinicalOrderType', case o.order_type
          when 'lab' then 'clinical_lab'
          when 'imaging' then 'imaging'
          when 'dispensing' then 'dispensing'
          else 'treatment'
        end,
        'detailInputs', '{}'::jsonb,
        'detailSchemaVersion', 1,
        'priority', case when o.priority = 'urgent' then 'urgent' else 'normal' end,
        'legacyClassification', 'catalog_unavailable'
      )
    else '{}'::jsonb end),
  revision_no = coalesce(o.revision_no, 0),
  billing_eligible = coalesce(o.billing_eligible, o.billing_reflection_enabled)
where o.clinical_order_type is null
   or o.detail_inputs is null
   or o.detail_schema_version is null
   or o.confirmed_snapshot is null
   or o.revision_no is null
   or o.billing_eligible is null;

update public.orders
set
  execution_mode = case
    when row_type = 'set' then 'aggregate'
    when destination_module is not null then 'routed'
    else 'immediate_complete'
  end,
  destination_module = case when row_type = 'set' then null else destination_module end
where execution_mode is null
   or row_type = 'set';

set constraints all immediate;

alter table public.orders
  alter column clinical_order_type set not null,
  alter column execution_mode set not null,
  alter column detail_inputs set default '{}'::jsonb,
  alter column detail_inputs set not null,
  alter column detail_schema_version set default 1,
  alter column detail_schema_version set not null,
  alter column confirmed_snapshot set default '{}'::jsonb,
  alter column confirmed_snapshot set not null,
  alter column revision_no set default 0,
  alter column revision_no set not null,
  alter column billing_eligible set default true,
  alter column billing_eligible set not null;

alter table public.orders
  add constraint orders_clinical_order_type_check
    check (clinical_order_type in (
      'consultation','clinical_lab','imaging','external_lab',
      'dispensing','treatment','hospitalization','other'
    )) not valid,
  add constraint orders_destination_module_check
    check (destination_module is null or destination_module in (
      'consultation','lab','imaging','external_lab','dispensing',
      'treatment','hospitalization','other'
    )) not valid,
  add constraint orders_execution_mode_check
    check (execution_mode in ('routed','immediate_complete','aggregate')) not valid,
  add constraint orders_execution_destination_check
    check (
      (row_type = 'set' and execution_mode = 'aggregate' and destination_module is null)
      or (row_type <> 'set' and execution_mode = 'routed' and destination_module is not null)
      or (row_type <> 'set' and execution_mode = 'immediate_complete' and destination_module is null)
    ) not valid,
  add constraint orders_detail_inputs_object_check
    check (jsonb_typeof(detail_inputs) = 'object') not valid,
  add constraint orders_confirmed_snapshot_object_check
    check (jsonb_typeof(confirmed_snapshot) = 'object') not valid,
  add constraint orders_revision_no_check
    check (revision_no >= 0) not valid;

alter table public.orders
  validate constraint orders_clinical_order_type_check,
  validate constraint orders_destination_module_check,
  validate constraint orders_execution_mode_check,
  validate constraint orders_execution_destination_check,
  validate constraint orders_detail_inputs_object_check,
  validate constraint orders_confirmed_snapshot_object_check,
  validate constraint orders_revision_no_check;

create index if not exists orders_clinical_type_idx
  on public.orders(workspace_id, encounter_id, clinical_order_type, order_confirmation_status);
create index if not exists orders_destination_idx
  on public.orders(workspace_id, destination_module, order_confirmation_status)
  where destination_module is not null;

create or replace function private.clair_sync_order_execution_contract()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_catalog public.order_catalog_items%rowtype;
begin
  if new.workspace_catalog_item_id is not null then
    select * into v_catalog
    from public.order_catalog_items c
    where c.workspace_id = new.workspace_id
      and c.id = new.workspace_catalog_item_id;
  end if;

  if new.clinical_order_type is null then
    new.clinical_order_type := coalesce(v_catalog.clinical_order_type, case
      when new.row_type = 'set' then 'other'
      when new.order_type = 'lab' then 'clinical_lab'
      when new.order_type = 'imaging' then 'imaging'
      when new.order_type = 'dispensing' then 'dispensing'
      when new.order_type = 'treatment' then 'treatment'
      else 'other'
    end);
  end if;

  if new.row_type = 'set' then
    new.execution_mode := 'aggregate';
    new.destination_module := null;
  elsif new.execution_mode is null then
    new.destination_module := coalesce(new.destination_module, v_catalog.destination_module);
    new.execution_mode := case when new.destination_module is null
      then 'immediate_complete' else 'routed' end;
  end if;

  new.detail_inputs := coalesce(new.detail_inputs, '{}'::jsonb);
  new.detail_schema_version := coalesce(new.detail_schema_version, v_catalog.detail_schema_version, 1);
  new.confirmed_snapshot := coalesce(new.confirmed_snapshot, '{}'::jsonb);
  new.revision_no := coalesce(new.revision_no, 0);
  new.billing_eligible := coalesce(new.billing_eligible, v_catalog.billing_eligible, new.billing_reflection_enabled);

  if new.order_confirmation_status in ('confirmed','billed')
     and new.confirmed_snapshot = '{}'::jsonb then
    new.confirmed_snapshot := new.applied_snapshot || jsonb_build_object(
      'clinicalOrderType', new.clinical_order_type,
      'destinationModule', new.destination_module,
      'executionMode', new.execution_mode,
      'detailInputs', new.detail_inputs,
      'detailSchemaVersion', new.detail_schema_version,
      'priority', case when new.priority = 'urgent' then 'urgent' else 'normal' end
    );
  end if;
  return new;
end;
$function$;

revoke all on function private.clair_sync_order_execution_contract() from public;

drop trigger if exists orders_execution_contract_sync_trg on public.orders;
create trigger orders_execution_contract_sync_trg
before insert or update on public.orders
for each row execute function private.clair_sync_order_execution_contract();

create or replace function public.clair_update_order_execution_master_contract(
  p_workspace_id text,
  p_item_id text,
  p_expected_catalog_revision integer,
  p_contract jsonb,
  p_request_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $function$
declare
  v_actor_user_id uuid := auth.uid();
  v_actor_membership_id uuid;
  v_current public.order_catalog_items%rowtype;
  v_updated public.order_catalog_items%rowtype;
  v_type text := p_contract ->> 'clinicalOrderType';
  v_destination text := nullif(p_contract ->> 'destinationModule', '');
  v_execution_mode text := p_contract ->> 'executionMode';
  v_schema_version integer := coalesce((p_contract ->> 'detailSchemaVersion')::integer, 1);
  v_schema jsonb;
  v_billing_eligible boolean := coalesce((p_contract ->> 'billingEligible')::boolean, true);
  v_legacy_category text;
  v_legacy_destination text;
begin
  if v_actor_user_id is null then
    raise exception 'permission_denied';
  end if;
  if not private.clair_is_active_workspace_member(p_workspace_id)
     or not private.clair_current_user_has_workspace_permission(
       p_workspace_id,
       'service_catalog:manage'
     ) then
    raise exception 'permission_denied';
  end if;

  select * into v_current
  from public.order_catalog_items item
  where item.workspace_id = p_workspace_id and item.id = p_item_id
  for update;
  if not found then raise exception 'order_catalog_item_unavailable'; end if;
  if v_current.catalog_revision <> p_expected_catalog_revision then
    raise exception 'catalog_revision_conflict';
  end if;
  if v_type not in (
    'consultation','clinical_lab','imaging','external_lab',
    'dispensing','treatment','hospitalization','other'
  ) then raise exception 'clinical_order_type_invalid'; end if;
  if v_execution_mode not in ('routed','immediate_complete') then
    raise exception 'execution_mode_invalid';
  end if;
  if v_destination is not null and v_destination not in (
    'consultation','lab','imaging','external_lab','dispensing',
    'treatment','hospitalization','other'
  ) then raise exception 'destination_module_invalid'; end if;
  if (v_execution_mode = 'routed') <> (v_destination is not null) then
    raise exception 'execution_destination_invalid';
  end if;

  v_schema := coalesce(
    p_contract -> 'detailFieldSchema',
    private.clair_order_detail_field_schema_v1(v_type)
  );
  if not private.clair_order_field_schema_is_valid(
    v_type,
    v_schema_version,
    v_schema
  ) then raise exception 'detail_field_schema_invalid'; end if;

  v_legacy_category := case v_type
    when 'consultation' then 'consultation'
    when 'clinical_lab' then 'lab'
    when 'external_lab' then 'lab'
    when 'imaging' then 'imaging'
    when 'dispensing' then 'medication'
    when 'treatment' then 'treatment'
    when 'hospitalization' then 'hospitalization'
    else 'misc'
  end;
  v_legacy_destination := case
    when v_execution_mode = 'immediate_complete' then 'chart_only'
    when v_destination in ('lab','external_lab') then 'lab'
    when v_destination = 'imaging' then 'imaging'
    when v_destination = 'dispensing' then 'dispensing'
    else 'treatment'
  end;

  update public.order_catalog_items item
  set
    category_group = v_legacy_category,
    default_destination_module = v_legacy_destination,
    default_task_required = v_execution_mode = 'routed',
    billing_reflection_enabled = v_billing_eligible,
    clinical_order_type = v_type,
    is_external_lab = v_type = 'external_lab',
    destination_module = v_destination,
    execution_mode = v_execution_mode,
    detail_schema_version = v_schema_version,
    detail_field_schema = v_schema,
    billing_eligible = v_billing_eligible,
    catalog_revision = item.catalog_revision + 1,
    updated_at = now()
  where item.workspace_id = p_workspace_id and item.id = p_item_id
  returning * into v_updated;

  select membership.id into v_actor_membership_id
  from public.user_memberships membership
  where membership.workspace_id = p_workspace_id
    and membership.user_id = v_actor_user_id
    and membership.status = 'active'
  order by membership.created_at
  limit 1;

  insert into public.audit_events(
    id, workspace_id, actor_user_id, actor_membership_id,
    event_type, target_type, target_id, request_id,
    before_snapshot, after_snapshot, metadata
  ) values (
    gen_random_uuid()::text,
    p_workspace_id,
    v_actor_user_id,
    v_actor_membership_id,
    'order_catalog.updated',
    'order_catalog_item',
    p_item_id,
    p_request_id::text,
    jsonb_build_object(
      'clinicalOrderType', v_current.clinical_order_type,
      'destinationModule', v_current.destination_module,
      'executionMode', v_current.execution_mode,
      'detailSchemaVersion', v_current.detail_schema_version,
      'billingEligible', v_current.billing_eligible
    ),
    jsonb_build_object(
      'clinicalOrderType', v_updated.clinical_order_type,
      'destinationModule', v_updated.destination_module,
      'executionMode', v_updated.execution_mode,
      'detailSchemaVersion', v_updated.detail_schema_version,
      'billingEligible', v_updated.billing_eligible
    ),
    jsonb_build_object('source', 'order-execution-master-contract-v1')
  );

  return jsonb_build_object(
    'id', v_updated.id,
    'workspaceId', v_updated.workspace_id,
    'catalogRevision', v_updated.catalog_revision,
    'clinicalOrderType', v_updated.clinical_order_type,
    'isExternalLab', v_updated.is_external_lab,
    'destinationModule', v_updated.destination_module,
    'executionMode', v_updated.execution_mode,
    'detailSchemaVersion', v_updated.detail_schema_version,
    'detailFieldSchema', v_updated.detail_field_schema,
    'billingEligible', v_updated.billing_eligible,
    'updatedAt', v_updated.updated_at
  );
end;
$function$;

revoke all on function public.clair_update_order_execution_master_contract(
  text, text, integer, jsonb, uuid
) from public;
grant execute on function public.clair_update_order_execution_master_contract(
  text, text, integer, jsonb, uuid
) to authenticated;

comment on column public.order_catalog_items.clinical_order_type is
  'Canonical eight-type clinical classification; independent from legacy execution order_type.';
comment on column public.order_catalog_items.destination_module is
  'Nullable master-owned routing destination. Veterinarians cannot override it in a chart draft.';
comment on column public.order_catalog_items.detail_field_schema is
  'Versioned structured field contract used by the chart union-column editor and confirmation validator.';
comment on column public.orders.confirmed_snapshot is
  'Immutable v2 confirmation snapshot; later corrections append revisions/events instead of overwriting this value.';
