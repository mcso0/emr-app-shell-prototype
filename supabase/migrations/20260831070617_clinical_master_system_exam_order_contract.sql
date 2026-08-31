-- CLINICAL-MASTER-PR-022 system-exam slice.
-- Add one independent, destinationless clinical order type. Existing master
-- orders, workspace catalog rows, confirmed snapshots, and legacy categories
-- are not reclassified by this migration; the authoring artifact is transport
-- only until a separately approved release is published.

set lock_timeout = '5s';
set statement_timeout = '120s';

-- Preserve the current schema wrapper chain. PR-019 already preserved the
-- original v1 implementation under a private name; this layer adds only the
-- system_exam schema and delegates every other type to the previous wrapper.
do $block$
begin
  if pg_catalog.to_regprocedure(
    'private.clair_order_detail_field_schema_v1_pr022_base(text)'
  ) is null then
    alter function private.clair_order_detail_field_schema_v1(text)
      rename to clair_order_detail_field_schema_v1_pr022_base;
  end if;
end;
$block$;

create or replace function private.clair_order_detail_field_schema_v1(
  p_clinical_order_type text
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select case
    when p_clinical_order_type = 'system_exam' then pg_catalog.jsonb_build_object(
      'clinicalOrderType', 'system_exam',
      'label', '계통검사',
      'version', 1,
      'defaultDestinationModule', null,
      'defaultExecutionMode', 'immediate_complete',
      'fields', pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_object(
          'key', 'bodySystem', 'valueType', 'string',
          'label', '검사 계통', 'control', 'select', 'unit', null,
          'options', '["전신상태·활력","심혈관계","호흡기계","소화기·복부","비뇨생식기계","신경계","근골격계","피부·피모","안과","이과","구강·치과","말초 림프계"]'::jsonb,
          'displayOrder', 10, 'required', true, 'defaultValue', null,
          'validation', '{}'::jsonb, 'placement', 'inline',
          'bulkEditable', true, 'semantics', 'clinical',
          'preConfirmEditable', true, 'postConfirmBehavior', 'amendment',
          'snapshotPath', 'detailInputs.bodySystem'
        ),
        pg_catalog.jsonb_build_object(
          'key', 'examScope', 'valueType', 'string',
          'label', '검사 범위', 'control', 'select', 'unit', null,
          'options', '["전신 상태와 활력 평가","심혈관계 평가","호흡기계 평가","소화기 및 복부 평가","비뇨생식기계 평가","신경계 평가","근골격계 평가","피부 및 피모 평가","안과 평가","이과 평가","구강 및 치과 평가","말초 림프계 평가"]'::jsonb,
          'displayOrder', 20, 'required', true, 'defaultValue', null,
          'validation', '{}'::jsonb, 'placement', 'inline',
          'bulkEditable', true, 'semantics', 'clinical',
          'preConfirmEditable', true, 'postConfirmBehavior', 'amendment',
          'snapshotPath', 'detailInputs.examScope'
        ),
        pg_catalog.jsonb_build_object(
          'key', 'examMethod', 'valueType', 'string',
          'label', '검사 방법', 'control', 'select', 'unit', null,
          'options', '["표준 신체검사","시진","청진","촉진","타진","집중 신체검사"]'::jsonb,
          'displayOrder', 30, 'required', true, 'defaultValue', null,
          'validation', '{}'::jsonb, 'placement', 'inline',
          'bulkEditable', true, 'semantics', 'instruction',
          'preConfirmEditable', true, 'postConfirmBehavior', 'amendment',
          'snapshotPath', 'detailInputs.examMethod'
        ),
        pg_catalog.jsonb_build_object(
          'key', 'findingSummary', 'valueType', 'string',
          'label', '소견 요약', 'control', 'textarea', 'unit', null,
          'options', '[]'::jsonb,
          'displayOrder', 40, 'required', true, 'defaultValue', null,
          'validation', '{"minLength":1,"maxLength":4000}'::jsonb,
          'placement', 'inline', 'bulkEditable', false, 'semantics', 'clinical',
          'preConfirmEditable', true, 'postConfirmBehavior', 'amendment',
          'snapshotPath', 'detailInputs.findingSummary'
        ),
        pg_catalog.jsonb_build_object(
          'key', 'siteLaterality', 'valueType', 'string',
          'label', '부위·좌우', 'control', 'select', 'unit', null,
          'options', '["left","right","bilateral","midline","not_applicable"]'::jsonb,
          'displayOrder', 110, 'required', false, 'defaultValue', null,
          'validation', '{}'::jsonb, 'placement', 'detail',
          'bulkEditable', true, 'semantics', 'clinical',
          'preConfirmEditable', true, 'postConfirmBehavior', 'amendment',
          'snapshotPath', 'detailInputs.siteLaterality'
        ),
        pg_catalog.jsonb_build_object(
          'key', 'abnormalFindings', 'valueType', 'string',
          'label', '이상 소견', 'control', 'textarea', 'unit', null,
          'options', '[]'::jsonb,
          'displayOrder', 120, 'required', false, 'defaultValue', null,
          'validation', '{"maxLength":4000}'::jsonb,
          'placement', 'detail', 'bulkEditable', false, 'semantics', 'clinical',
          'preConfirmEditable', true, 'postConfirmBehavior', 'amendment',
          'snapshotPath', 'detailInputs.abnormalFindings'
        ),
        pg_catalog.jsonb_build_object(
          'key', 'attachments', 'valueType', 'attachment_array',
          'label', '첨부', 'control', 'attachments', 'unit', null,
          'options', '[]'::jsonb,
          'displayOrder', 130, 'required', false, 'defaultValue', null,
          'validation', '{}'::jsonb, 'placement', 'detail',
          'bulkEditable', false, 'semantics', 'metadata',
          'preConfirmEditable', true, 'postConfirmBehavior', 'amendment',
          'snapshotPath', 'detailInputs.attachments'
        ),
        pg_catalog.jsonb_build_object(
          'key', 'exceptions', 'valueType', 'string',
          'label', '예외', 'control', 'textarea', 'unit', null,
          'options', '[]'::jsonb,
          'displayOrder', 140, 'required', false, 'defaultValue', null,
          'validation', '{"maxLength":2000}'::jsonb,
          'placement', 'detail', 'bulkEditable', false, 'semantics', 'instruction',
          'preConfirmEditable', true, 'postConfirmBehavior', 'amendment',
          'snapshotPath', 'detailInputs.exceptions'
        )
      )
    )
    -- Cytology and histopathology sampling is valid for in-house clinical
    -- pathology too. Preserve the inherited schema and extend only the
    -- specimen enum that omitted tissue in the legacy contract.
    when p_clinical_order_type = 'clinical_lab' then (
      select pg_catalog.jsonb_set(
        inherited.schema,
        '{fields}',
        coalesce((
          select pg_catalog.jsonb_agg(
            case
              when field.value ->> 'key' = 'specimenType' then
                pg_catalog.jsonb_set(
                  field.value,
                  '{options}',
                  '["blood","serum","plasma","urine","feces","swab","tissue","other"]'::jsonb
                )
              else field.value
            end
            order by (field.value ->> 'displayOrder')::integer
          )
          from pg_catalog.jsonb_array_elements(
            inherited.schema -> 'fields'
          ) field(value)
        ), '[]'::jsonb)
      )
      from (
        select private.clair_order_detail_field_schema_v1_pr022_base(
          p_clinical_order_type
        ) as schema
      ) inherited
    )
    else private.clair_order_detail_field_schema_v1_pr022_base(
      p_clinical_order_type
    )
  end;
$function$;

revoke all on function private.clair_order_detail_field_schema_v1(text)
  from public, anon, authenticated, service_role;

-- The generic execution-preset projection and all public runtime tables must
-- accept the additive type. The explicit mode/destination guards prevent a
-- system exam from being routed to a fulfillment queue.
alter table master.order_execution_presets
  drop constraint if exists order_execution_presets_clinical_order_type_check,
  drop constraint if exists order_execution_presets_clinical_order_type_v2_check,
  add constraint order_execution_presets_clinical_order_type_v2_check
    check (clinical_order_type in (
      'consultation','clinical_lab','imaging','external_lab',
      'dispensing','treatment','hospitalization','system_exam','other'
    )) not valid;

alter table master.order_execution_presets
  validate constraint order_execution_presets_clinical_order_type_v2_check;

alter table public.order_catalog_items
  drop constraint if exists order_catalog_items_clinical_order_type_check,
  drop constraint if exists order_catalog_items_clinical_order_type_v2_check,
  drop constraint if exists order_catalog_items_system_exam_execution_check,
  add constraint order_catalog_items_clinical_order_type_v2_check
    check (clinical_order_type in (
      'consultation','clinical_lab','imaging','external_lab',
      'dispensing','treatment','hospitalization','system_exam','other'
    )) not valid,
  add constraint order_catalog_items_system_exam_execution_check
    check (
      clinical_order_type <> 'system_exam'
      or (execution_mode = 'immediate_complete' and destination_module is null)
    ) not valid;

alter table public.order_catalog_items
  validate constraint order_catalog_items_clinical_order_type_v2_check,
  validate constraint order_catalog_items_system_exam_execution_check;

alter table public.orders
  drop constraint if exists orders_clinical_order_type_check,
  drop constraint if exists orders_clinical_order_type_v2_check,
  drop constraint if exists orders_system_exam_execution_check,
  add constraint orders_clinical_order_type_v2_check
    check (clinical_order_type in (
      'consultation','clinical_lab','imaging','external_lab',
      'dispensing','treatment','hospitalization','system_exam','other'
    )) not valid,
  add constraint orders_system_exam_execution_check
    check (
      clinical_order_type <> 'system_exam'
      or (execution_mode = 'immediate_complete' and destination_module is null)
    ) not valid;

alter table public.orders
  validate constraint orders_clinical_order_type_v2_check,
  validate constraint orders_system_exam_execution_check;

alter table public.order_tasks
  drop constraint if exists order_tasks_clinical_order_type_check,
  drop constraint if exists order_tasks_clinical_order_type_v2_check,
  add constraint order_tasks_clinical_order_type_v2_check
    check (clinical_order_type in (
      'consultation','clinical_lab','imaging','external_lab',
      'dispensing','treatment','hospitalization','system_exam','other'
    )) not valid;

alter table public.order_tasks
  validate constraint order_tasks_clinical_order_type_v2_check;

alter table public.order_fulfillment_work_items
  drop constraint if exists order_fulfillment_work_items_clinical_type_check,
  drop constraint if exists order_fulfillment_work_items_clinical_type_v2_check,
  add constraint order_fulfillment_work_items_clinical_type_v2_check
    check (
      clinical_order_type is null
      or clinical_order_type in (
        'consultation','clinical_lab','imaging','external_lab',
        'dispensing','treatment','hospitalization','other'
      )
    ) not valid;

alter table public.order_fulfillment_work_items
  validate constraint order_fulfillment_work_items_clinical_type_v2_check;

-- Explicit system_exam rows are destinationless completed chart tasks. They
-- must never produce a fulfillment work-item projection, so the legacy queue
-- schema intentionally remains limited to routed destinations.
comment on constraint order_catalog_items_system_exam_execution_check
  on public.order_catalog_items is
  'system_exam is an immediate chart task with no fulfillment destination.';
comment on constraint orders_system_exam_execution_check on public.orders is
  'system_exam is an immediate chart task with no fulfillment destination.';
comment on table master.order_execution_presets is
  'Append-only execution preset projection; system_exam is additive and synthetic until clinical review.';

-- Preserve the existing catalog trigger contract while allowing an explicit
-- system_exam canonical type to pass through a legacy misc category. All
-- other insert/update behavior is unchanged.
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

  if (
    tg_op = 'INSERT'
    or new.clinical_order_type is null
    or (v_legacy_changed and not v_canonical_changed)
  ) and new.clinical_order_type is distinct from 'system_exam' then
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

  if new.clinical_order_type = 'system_exam' then
    new.is_external_lab := false;
    new.execution_mode := 'immediate_complete';
    new.destination_module := null;
    new.detail_schema_version := 1;
    new.detail_field_schema := private.clair_order_detail_field_schema_v1('system_exam');
    new.billing_eligible := coalesce(new.billing_eligible, new.billing_reflection_enabled);
  elsif new.detail_field_schema is null then
    new.detail_schema_version := 1;
    new.detail_field_schema := private.clair_order_detail_field_schema_v1(new.clinical_order_type);
  end if;
  return new;
end;
$function$;

revoke all on function private.clair_sync_order_catalog_execution_contract()
  from public, anon, authenticated, service_role;

comment on column public.order_catalog_items.clinical_order_type is
  'Canonical nine-type clinical classification; system_exam is destinationless and additive.';
