-- CLINICAL-MASTER-PR-006 / Phase 1B-3
-- Chart Order Set runtime consumption. Local synthetic/demo replay only.
-- B2 owns the native revision tables and authoring writers; this migration
-- adds only chart runtime lineage, expansion, snapshots, and compatibility
-- replacements.

begin;

set check_function_bodies = off;

create schema if not exists private;

-- B2 deterministic UUIDs use UUIDv8 while auth/order IDs may use UUIDv4. The
-- inherited chart helper only admits UUIDv1-v5, so B3 parses every canonical
-- UUID format locally and keeps all tenant, revision, and leaf ownership
-- checks below authoritative.
create or replace function private.clair_b3_safe_uuid(p_value text)
returns uuid
language sql
immutable
strict
  set search_path = pg_catalog
as $$
  select case
    when p_value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then p_value::uuid
    else null
  end
$$;

revoke all on function private.clair_b3_safe_uuid(text)
  from public, anon, authenticated, service_role;

-- The preflight is intentionally before every B3 DDL mutation. Existing set
-- rows cannot be reinterpreted: native B2 rows must be applied from a fresh
-- B3 path, while legacy set rows stop the migration for review.
do $$
declare
  v_count integer;
  v_constraint text;
  v_constraint_def text;
  v_constraint_type "char";
  v_constraint_validated boolean;
  v_constraint_deferrable boolean;
  v_constraint_deferred boolean;
begin
  if to_regclass('public.order_set_revisions') is null
     or to_regclass('public.order_set_revision_items') is null
     or to_regclass('public.order_set_revision_price_ranges') is null then
    raise exception 'clinical_master_b3_preflight_b2_revision_tables_missing';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'workspace_catalog_item_id'
  ) then
    raise exception 'clinical_master_b3_preflight_a3_catalog_lineage_missing';
  end if;
  for v_constraint in
    select unnest(array[
      'orders_order_type_check',
      'orders_row_type_check',
      'orders_chart_row_hierarchy_check',
      'orders_quantity_source_check',
      'orders_catalog_individual_check'
    ])
  loop
    -- pg_get_constraintdef emits redundant grouping parentheses and implicit
    -- text casts. Remove only those formatting artifacts, then compare the
    -- complete normalized definition against the exact predecessor/B3 shapes;
    -- substring/token checks are intentionally not sufficient here.
    select c.contype,
           c.convalidated,
           c.condeferrable,
           c.condeferred,
           btrim(
             replace(
               replace(
                 replace(
                   lower(regexp_replace(pg_get_constraintdef(c.oid), '\s+', ' ', 'g')),
                   '::text', ''
                 ),
                 '(', ''
               ),
               ')', ''
             )
           )
      into v_constraint_type,
           v_constraint_validated,
           v_constraint_deferrable,
           v_constraint_deferred,
           v_constraint_def
    from pg_constraint c
    where c.conrelid = 'public.orders'::regclass
      and c.conname = v_constraint;
    if not found
       or v_constraint_type <> 'c'
       or not v_constraint_validated
       or v_constraint_deferrable
       or v_constraint_deferred
       or not (case v_constraint
         when 'orders_order_type_check' then
           v_constraint_def = any (array[
             'check order_type = any array[''dispensing'', ''treatment'', ''lab'', ''imaging'']',
             'check row_type = ''set'' and order_type = ''set'' or row_type <> ''set'' and order_type = any array[''dispensing'', ''treatment'', ''lab'', ''imaging'']'
           ])
         when 'orders_row_type_check' then
           v_constraint_def = 'check row_type = any array[''individual'', ''set'', ''set_child'', ''temporary'']'
         when 'orders_chart_row_hierarchy_check' then
           v_constraint_def = any (array[
             'check row_depth >= 0 and row_type <> ''set_child'' or parent_chart_order_line_id is not null and row_type <> ''set_child'' or source_set_id is not null and row_type <> ''set_child'' or set_item_id is not null',
             'check row_depth >= 0 and row_type <> ''set_child'' or parent_chart_order_line_id is not null and source_set_id is not null and source_set_revision_id is not null and source_set_revision_no is not null and source_set_revision_item_id is not null and order_type <> ''set'' and row_type <> ''set'' or row_depth = 0 and row_type <> ''set'' or parent_chart_order_line_id is null'
           ])
         when 'orders_quantity_source_check' then
           v_constraint_def = any (array[
             'check quantity_source = any array[''manual'', ''days'', ''total_count'', ''dispense_quantity'', ''actual_dispense_quantity'', ''fixed_one'']',
             'check row_type = any array[''set'', ''set_child''] and quantity_source = any array[''fixed_one'', ''preset_quantity'', ''manual_at_apply''] or row_type <> all array[''set'', ''set_child''] and quantity_source = any array[''manual'', ''days'', ''total_count'', ''dispense_quantity'', ''actual_dispense_quantity'', ''fixed_one'']'
           ])
         when 'orders_catalog_individual_check' then
           v_constraint_def = any (array[
             'check workspace_catalog_item_id is null or row_type = ''individual''',
             'check workspace_catalog_item_id is null or row_type = any array[''individual'', ''set_child'']'
           ])
         else false
       end) then
      raise exception 'clinical_master_b3_preflight_order_constraint_missing:%', v_constraint;
    end if;
  end loop;
  select count(*) into v_count
  from (
    select workspace_id, id
    from public.order_set_revision_items
    group by workspace_id, id
    having count(*) > 1
  ) duplicate_items;
  if v_count > 0 then
    raise exception 'clinical_master_b3_revision_item_workspace_key_collision';
  end if;
  select count(*) into v_count
  from public.orders
  where row_type in ('set', 'set_child')
    and order_confirmation_status in ('confirmed', 'billed')
    and (
      source_set_id is null
      or to_jsonb(orders) ->> 'source_set_revision_id' is null
      or to_jsonb(orders) ->> 'source_set_revision_no' is null
      or to_jsonb(orders) ->> 'source_set_version' is distinct from
        'order-set-revision-' || (to_jsonb(orders) ->> 'source_set_revision_no')
      or applied_snapshot->>'sourceSetRevisionId' is null
      or coalesce((to_jsonb(orders) ->> 'applied_snapshot_schema_version')::integer, 0) <> 1
      or nullif(to_jsonb(orders) ->> 'applied_snapshot_sha256', '') is null
    );
  if v_count > 0 then
    raise exception 'clinical_master_b3_preflight_confirmed_set_unresolved';
  end if;
  -- A valid B3 draft is already frozen and may pass a reapply. Only rows
  -- lacking the complete schema-1 pin/hash are legacy and must stop here.
  -- Never classify every set draft as legacy merely because it is a draft.
  select count(*) into v_count
  from public.orders
  where row_type in ('set', 'set_child')
    and order_confirmation_status in ('draft', 'pending')
    and (
      source_set_id is null
      or to_jsonb(orders) ->> 'source_set_revision_id' is null
      or to_jsonb(orders) ->> 'source_set_revision_no' is null
      or to_jsonb(orders) ->> 'source_set_version' is distinct from
        'order-set-revision-' || (to_jsonb(orders) ->> 'source_set_revision_no')
      or applied_snapshot->>'sourceSetRevisionId' is null
      or coalesce((to_jsonb(orders) ->> 'applied_snapshot_schema_version')::integer, 0) <> 1
      or nullif(to_jsonb(orders) ->> 'applied_snapshot_sha256', '') is null
      or (row_type = 'set_child'
          and to_jsonb(orders) ->> 'source_set_revision_item_id' is null)
    );
  if v_count > 0 then
    raise exception 'clinical_master_b3_preflight_legacy_set_draft_unresolved';
  end if;
  select count(*) into v_count
  from public.orders
  where row_type in ('set', 'set_child')
    and (
      applied_snapshot->>'sourceSetRevisionId' is null
      or coalesce((to_jsonb(orders) ->> 'applied_snapshot_schema_version')::integer, 0) <> 1
      or nullif(to_jsonb(orders) ->> 'applied_snapshot_sha256', '') is null
    );
  if v_count > 0 then
    raise exception 'clinical_master_b3_preflight_set_snapshot_unresolved';
  end if;
  select count(*) into v_count
  from public.orders
  where row_type = 'temporary';
  if v_count > 0 then
    raise exception 'clinical_master_b3_legacy_temporary_row_present';
  end if;
  select count(*) into v_count
  from public.orders
  where quantity <= 0 or quantity > 999999999.999
    or quantity <> round(quantity, 3);
  if v_count > 0 then
    raise exception 'clinical_master_b3_quantity_precision_conflict';
  end if;
  select count(*) into v_count
  from public.invoice_lines
  where quantity <= 0 or quantity > 999999999.999
    or quantity <> round(quantity, 3);
  if v_count > 0 then
    raise exception 'clinical_master_b3_invoice_quantity_precision_conflict';
  end if;
end
$$;

alter table public.orders
  add column if not exists source_set_revision_id uuid,
  add column if not exists source_set_revision_no integer,
  add column if not exists source_set_revision_item_id uuid,
  add column if not exists applied_snapshot_schema_version integer not null default 0,
  add column if not exists applied_snapshot_sha256 text;

create unique index if not exists order_set_revision_items_workspace_id_key
  on public.order_set_revision_items(workspace_id, id);

alter table public.orders
  drop column line_total_snapshot;

alter table public.invoice_lines
  drop column line_total;

alter table public.orders
  alter column quantity type numeric(12,3)
    using quantity::numeric(12,3);

alter table public.invoice_lines
  alter column quantity type numeric(12,3)
    using quantity::numeric(12,3);

alter table public.orders
  add column line_total_snapshot numeric(12,2)
    generated always as (quantity * coalesce(unit_price_snapshot, 0)) stored;

alter table public.invoice_lines
  add column line_total numeric(12,2)
    generated always as ((quantity * unit_price) - discount_amount) stored;

alter table public.orders
  drop constraint if exists orders_source_set_revision_workspace_fk,
  drop constraint if exists orders_source_set_revision_item_workspace_fk;

alter table public.orders
  add constraint orders_source_set_revision_workspace_fk
  foreign key (workspace_id, source_set_revision_id)
  references public.order_set_revisions(workspace_id, id)
  on delete restrict deferrable initially deferred;

alter table public.orders
  add constraint orders_source_set_revision_item_workspace_fk
  foreign key (workspace_id, source_set_revision_item_id)
  references public.order_set_revision_items(workspace_id, id)
  on delete restrict deferrable initially deferred;

-- A3's catalog check was individual-only. B3 widens that one existing owner
-- to the allowed direct catalog lineage for set_child; the new B3 lineage
-- check still forbids every catalog/service value on a set parent.
alter table public.orders
  drop constraint orders_order_type_check,
  drop constraint orders_row_type_check,
  drop constraint orders_chart_row_hierarchy_check,
  drop constraint orders_quantity_source_check,
  drop constraint orders_catalog_individual_check,
  drop constraint if exists orders_b3_lineage_check,
  drop constraint if exists orders_b3_snapshot_schema_check,
  drop constraint if exists orders_b3_set_quantity_check;

alter table public.orders
  add constraint orders_order_type_check
  check (
    (row_type = 'set' and order_type = 'set')
    or (row_type <> 'set' and order_type in ('dispensing', 'treatment', 'lab', 'imaging'))
  ),
  add constraint orders_row_type_check
  check (row_type in ('individual', 'set', 'set_child', 'temporary')),
  add constraint orders_chart_row_hierarchy_check
  check (
    row_depth >= 0
    and (
      row_type <> 'set_child'
      or (
        parent_chart_order_line_id is not null
        and source_set_id is not null
        and source_set_revision_id is not null
        and source_set_revision_no is not null
        and source_set_revision_item_id is not null
        and order_type <> 'set'
      )
    )
    and (row_type <> 'set' or row_depth = 0)
    and (row_type <> 'set' or parent_chart_order_line_id is null)
  ),
  add constraint orders_quantity_source_check
  check (
    (
      row_type in ('set', 'set_child')
      and quantity_source in ('fixed_one', 'preset_quantity', 'manual_at_apply')
    )
    or (
      row_type not in ('set', 'set_child')
      and quantity_source in (
        'manual',
        'days',
        'total_count',
        'dispense_quantity',
        'actual_dispense_quantity',
        'fixed_one'
      )
    )
  ),
  add constraint orders_catalog_individual_check
  check (workspace_catalog_item_id is null or row_type in ('individual', 'set_child')),
  add constraint orders_b3_lineage_check
  check (
    (
      row_type = 'set'
      and order_type = 'set'
      and source_set_id is not null
      and source_set_revision_id is not null
      and source_set_revision_no > 0
      and source_set_version = 'order-set-revision-' || source_set_revision_no::text
      and source_set_revision_item_id is null
      and set_item_id is null
      and parent_chart_order_line_id is null
      and service_item_id is null
      and workspace_catalog_item_id is null
      and source_master_record_id is null
      and source_master_revision is null
      and workspace_catalog_revision is null
      and quantity = 1
      and quantity_source = 'fixed_one'
    )
    or (
      row_type = 'set_child'
      and order_type in ('dispensing', 'treatment', 'lab', 'imaging')
      and source_set_id is not null
      and source_set_revision_id is not null
      and source_set_revision_no > 0
      and source_set_version = 'order-set-revision-' || source_set_revision_no::text
      and source_set_revision_item_id is not null
      and set_item_id = source_set_revision_item_id::text
      and service_item_id is null
      and workspace_catalog_item_id is not null
      and workspace_catalog_revision is not null
      and workspace_catalog_revision > 0
    )
    or (
      row_type = 'individual'
      and source_set_id is null
      and source_set_version is null
      and source_set_revision_id is null
      and source_set_revision_no is null
      and source_set_revision_item_id is null
      and set_item_id is null
      and parent_chart_order_line_id is null
      and row_depth = 0
    )
    or (
      row_type = 'temporary'
      and source_set_id is null
      and source_set_version is null
      and source_set_revision_id is null
      and source_set_revision_no is null
      and source_set_revision_item_id is null
      and set_item_id is null
      and parent_chart_order_line_id is null
      and workspace_catalog_item_id is null
      and service_item_id is null
    )
  ),
  add constraint orders_b3_snapshot_schema_check
  check (
    (
      row_type = 'individual'
      and applied_snapshot_schema_version = 0
      and applied_snapshot_sha256 is null
    )
    or (
      row_type in ('set', 'set_child')
      and applied_snapshot_schema_version = 1
      and applied_snapshot_sha256 ~ '^[0-9a-f]{64}$'
    )
    or row_type = 'temporary'
  );

alter table public.orders
  add constraint orders_b3_set_quantity_check
  check (
    (
      row_type <> 'set'
      or (quantity = 1 and quantity_source = 'fixed_one')
    )
    and (
      row_type <> 'set_child'
      or quantity_source <> 'fixed_one'
      or quantity = 1
    )
  );

create index if not exists orders_workspace_source_set_revision_idx
  on public.orders (workspace_id, source_set_revision_id, sort_order)
  where source_set_revision_id is not null;

create index if not exists orders_workspace_source_set_revision_item_idx
  on public.orders (workspace_id, source_set_revision_item_id)
  where source_set_revision_item_id is not null;

create or replace function private.clair_b3_sha256(p_value jsonb)
returns text
language sql
immutable
security invoker
set search_path = public, private, extensions, pg_catalog
as $$
  select encode(
    extensions.digest(
      pg_catalog.convert_to(coalesce(p_value, '{}'::jsonb)::text, 'UTF8'),
      'sha256'
    ),
    'hex'
  );
$$;

revoke all on function private.clair_b3_sha256(jsonb)
  from public, anon, authenticated, service_role;

create or replace function private.clair_b3_assert_set_child_lineage()
returns trigger
language plpgsql
security definer
set search_path = public, private, extensions, pg_catalog
as $$
declare
  v_parent public.orders%rowtype;
  v_root public.order_set_revisions%rowtype;
  v_leaf public.order_set_revision_items%rowtype;
  v_root_item public.order_set_revision_items%rowtype;
  v_catalog public.order_catalog_items%rowtype;
  v_expected_hash text;
  v_path jsonb;
begin
  if new.row_type not in ('set', 'set_child') then
    return new;
  end if;
  if new.applied_snapshot_schema_version <> 1
     or new.applied_snapshot_sha256 is null
     or jsonb_typeof(new.applied_snapshot) is distinct from 'object'
     or jsonb_typeof(new.applied_price_snapshot) is distinct from 'object'
     or jsonb_typeof(new.calculation_inputs) is distinct from 'object'
     or jsonb_typeof(new.calculation_outputs) is distinct from 'object'
     or new.applied_snapshot ->> 'schemaVersion' is distinct from '1'
     or new.applied_price_snapshot ->> 'schemaVersion' is distinct from '1'
     or new.calculation_inputs ->> 'schemaVersion' is distinct from '1'
     or new.calculation_outputs ->> 'schemaVersion' is distinct from '1' then
    raise exception 'order_set_snapshot_invalid';
  end if;
  v_expected_hash := private.clair_b3_sha256(jsonb_build_object(
    'appliedSnapshot', new.applied_snapshot,
    'appliedPriceSnapshot', new.applied_price_snapshot,
    'calculationInputs', new.calculation_inputs,
    'calculationOutputs', new.calculation_outputs
  ));
  if new.applied_snapshot_sha256 is distinct from v_expected_hash then
    raise exception 'order_set_snapshot_hash_invalid';
  end if;
  -- Schema 1 is one literal four-object envelope.  Reject both missing and
  -- caller-added keys before the lineage checks below; individual/A3 rows do
  -- not enter this trigger and remain schema 0.
  if (select count(*) from jsonb_object_keys(new.applied_price_snapshot)) <> 11
     or exists (
       select 1
       from jsonb_object_keys(new.applied_price_snapshot) as keys(key_name)
       where keys.key_name not in (
         'schemaVersion', 'amountBasis', 'setPriceKrw', 'priceKrw',
         'taxType', 'taxIncluded', 'billedAs',
         'billingReflectionEnabled', 'explicitExtra', 'roundingRule',
         'roundingResultKrw'
       )
     )
     or (select count(*) from jsonb_object_keys(new.calculation_inputs)) <> 9
     or exists (
       select 1
       from jsonb_object_keys(new.calculation_inputs) as keys(key_name)
       where keys.key_name not in (
         'schemaVersion', 'selectionFingerprint', 'selectedSetInput',
         'rangeBasis', 'rangeInput', 'rangeId', 'quantity',
         'roundingRule', 'storageScale'
       )
     )
     or (select count(*) from jsonb_object_keys(new.calculation_outputs)) <> 9
     or exists (
       select 1
       from jsonb_object_keys(new.calculation_outputs) as keys(key_name)
       where keys.key_name not in (
         'schemaVersion', 'childSubtotalKrw', 'explicitExtraSubtotalKrw',
         'taxAmountKrw', 'finalTotalKrw', 'lineTotalKrw', 'taxType',
         'roundingRule', 'roundingResultKrw'
       )
     ) then
    raise exception 'order_set_snapshot_schema_invalid';
  end if;
  if jsonb_typeof(new.applied_snapshot -> 'schemaVersion') is distinct from 'number'
     or jsonb_typeof(new.applied_snapshot -> 'rowType') is distinct from 'string'
     or jsonb_typeof(new.applied_price_snapshot -> 'schemaVersion') is distinct from 'number'
     or jsonb_typeof(new.applied_price_snapshot -> 'amountBasis') is distinct from 'string'
     or jsonb_typeof(new.applied_price_snapshot -> 'setPriceKrw') not in ('number', 'null')
     or jsonb_typeof(new.applied_price_snapshot -> 'priceKrw') not in ('number', 'null')
     or jsonb_typeof(new.applied_price_snapshot -> 'taxType') is distinct from 'string'
     or jsonb_typeof(new.applied_price_snapshot -> 'taxIncluded') not in ('boolean', 'null')
     or jsonb_typeof(new.applied_price_snapshot -> 'billedAs') is distinct from 'string'
     or jsonb_typeof(new.applied_price_snapshot -> 'billingReflectionEnabled') is distinct from 'boolean'
     or jsonb_typeof(new.applied_price_snapshot -> 'explicitExtra') is distinct from 'boolean'
     or jsonb_typeof(new.applied_price_snapshot -> 'roundingRule') is distinct from 'string'
     or jsonb_typeof(new.applied_price_snapshot -> 'roundingResultKrw') not in ('number', 'null')
     or jsonb_typeof(new.calculation_inputs -> 'schemaVersion') is distinct from 'number'
     or jsonb_typeof(new.calculation_inputs -> 'selectionFingerprint') is distinct from 'string'
     or jsonb_typeof(new.calculation_inputs -> 'rangeBasis') not in ('string', 'null')
     or jsonb_typeof(new.calculation_inputs -> 'roundingRule') is distinct from 'string'
     or jsonb_typeof(new.calculation_inputs -> 'storageScale') is distinct from 'number'
     or jsonb_typeof(new.calculation_outputs -> 'schemaVersion') is distinct from 'number'
     or jsonb_typeof(new.calculation_outputs -> 'taxType') is distinct from 'string'
     or jsonb_typeof(new.calculation_outputs -> 'roundingRule') is distinct from 'string' then
    raise exception 'order_set_snapshot_schema_invalid';
  end if;
  if coalesce(new.calculation_inputs ->> 'selectionFingerprint', '')
       !~ '^[0-9a-f]{64}$'
     or jsonb_typeof(new.calculation_inputs -> 'selectedSetInput')
          not in ('number', 'null')
     or jsonb_typeof(new.calculation_inputs -> 'rangeInput')
          not in ('number', 'null')
     or jsonb_typeof(new.calculation_inputs -> 'rangeId')
          not in ('string', 'null')
     or coalesce(new.calculation_inputs ->> 'rangeBasis', '')
          not in ('', 'patient_weight_kg', 'manual_value')
     or jsonb_typeof(new.calculation_inputs -> 'quantity') is distinct from 'number'
     or (new.calculation_inputs ->> 'quantity')::numeric is distinct from new.quantity
     or coalesce(new.calculation_inputs ->> 'roundingRule', '')
          not in ('as_is', 'ceil', 'floor', 'round')
     or (new.calculation_inputs ->> 'storageScale')::integer is distinct from 2
     or jsonb_typeof(new.calculation_outputs -> 'childSubtotalKrw') is distinct from 'number'
     or jsonb_typeof(new.calculation_outputs -> 'explicitExtraSubtotalKrw') is distinct from 'number'
     or jsonb_typeof(new.calculation_outputs -> 'taxAmountKrw') is distinct from 'number'
     or jsonb_typeof(new.calculation_outputs -> 'finalTotalKrw') is distinct from 'number'
     or jsonb_typeof(new.calculation_outputs -> 'lineTotalKrw') is distinct from 'number'
     or jsonb_typeof(new.calculation_outputs -> 'roundingResultKrw')
          not in ('number', 'null')
     or coalesce(new.calculation_outputs ->> 'roundingRule', '')
          not in ('as_is', 'ceil', 'floor', 'round') then
    raise exception 'order_set_snapshot_calculation_invalid';
  end if;

  if new.row_type = 'set' then
    if (select count(*) from jsonb_object_keys(new.applied_snapshot)) <> 42
       or exists (
         select 1
         from jsonb_object_keys(new.applied_snapshot) as keys(key_name)
         where keys.key_name not in (
           'schemaVersion', 'rowType', 'orderId', 'parentOrderId',
           'sourceSetId', 'sourceSetRevisionId', 'sourceSetRevisionNo',
           'sourceSetVersion', 'sourceSetRevisionItemId', 'childSetId',
           'childSetRevisionId', 'childSetRevisionNo', 'sourcePresetId',
           'sourcePresetVersion', 'workspaceCatalogItemId',
           'workspaceCatalogRevision', 'sourceMasterRecordId',
           'sourceMasterRevision', 'path', 'standardOrderName',
           'displayName', 'billingName', 'categoryGroup', 'billingCategory',
           'orderType', 'destinationModule', 'taskRequired', 'targetSpecies',
           'salesUnit', 'careGuide', 'internalInstruction',
           'typeSpecificRuntimeContext', 'sourceOrderId', 'sourceOrderVersion',
           'billingReflectionEnabled', 'taxIncluded', 'quantitySource',
           'defaultQuantity', 'quantity', 'selected', 'roundingRule', 'items'
         )
       ) then
      raise exception 'order_set_snapshot_schema_invalid';
    end if;
    select * into v_root
    from public.order_set_revisions
    where workspace_id = new.workspace_id
      and order_set_id = new.source_set_id
      and id = new.source_set_revision_id;
    if not found or v_root.revision_no is distinct from new.source_set_revision_no then
      raise exception 'order_set_root_revision_invalid';
    end if;
    if new.applied_snapshot ->> 'rowType' is distinct from 'set'
       or new.applied_snapshot ->> 'orderId' is distinct from new.id::text
       or new.applied_snapshot ->> 'parentOrderId' is not null
       or new.applied_snapshot ->> 'sourceSetId' is distinct from new.source_set_id
       or new.applied_snapshot ->> 'sourceSetRevisionId' is distinct from new.source_set_revision_id::text
       or new.applied_snapshot ->> 'sourceSetRevisionNo' is distinct from new.source_set_revision_no::text
       or new.applied_snapshot ->> 'sourceSetVersion' is distinct from new.source_set_version
       or new.applied_snapshot ->> 'sourceSetRevisionItemId' is not null
       or jsonb_typeof(new.applied_snapshot -> 'path') is distinct from 'array'
       or coalesce(jsonb_array_length(new.applied_snapshot -> 'path'), -1) <> 0
       or jsonb_typeof(new.applied_snapshot -> 'items') is distinct from 'array'
       or coalesce(jsonb_array_length(new.applied_snapshot -> 'items'), 0) = 0
       or new.applied_snapshot ->> 'categoryGroup' is distinct from 'set'
       or new.applied_snapshot ->> 'billingCategory' is distinct from 'other'
       or new.applied_snapshot ->> 'orderType' is distinct from 'set'
       or new.applied_snapshot ->> 'workspaceCatalogItemId' is not null
       or new.applied_snapshot ->> 'sourcePresetId' is not null then
      raise exception 'order_set_snapshot_lineage_invalid';
    end if;
    if new.applied_snapshot ->> 'quantity' is null
       or (new.applied_snapshot ->> 'quantity')::numeric is distinct from new.quantity
       or new.applied_snapshot ->> 'quantitySource' is distinct from new.quantity_source
       or new.applied_snapshot ->> 'billingReflectionEnabled'
            is distinct from new.billing_reflection_enabled::text
       or new.applied_price_snapshot ->> 'amountBasis' is distinct from v_root.amount_basis
       or nullif(new.applied_price_snapshot ->> 'priceKrw', '')::numeric
            is distinct from new.unit_price_snapshot
       or nullif(new.applied_price_snapshot ->> 'setPriceKrw', '')::numeric
            is distinct from new.unit_price_snapshot then
      raise exception 'order_set_snapshot_pricing_invalid';
    end if;
    if v_root.amount_basis = 'included_order_sum' then
      if new.applied_price_snapshot ->> 'billedAs' is distinct from 'nonbillable_parent'
         or new.applied_price_snapshot ->> 'taxType' is distinct from 'derived'
         or new.applied_price_snapshot ->> 'taxIncluded' is not null
         or new.applied_snapshot ->> 'taxIncluded' is not null then
        raise exception 'order_set_snapshot_pricing_invalid';
      end if;
    elsif v_root.amount_basis in ('set_fixed_price', 'range_price') then
      if new.applied_price_snapshot ->> 'billedAs' is distinct from 'set_parent'
         or new.applied_price_snapshot ->> 'taxType' is distinct from v_root.tax_type
         or new.applied_price_snapshot ->> 'taxIncluded'
              is distinct from new.applied_snapshot ->> 'taxIncluded'
         or jsonb_typeof(new.applied_snapshot -> 'taxIncluded') is distinct from 'boolean'
         or (new.applied_snapshot ->> 'taxIncluded')::boolean is distinct from (v_root.tax_type = 'taxable') then
        raise exception 'order_set_snapshot_pricing_invalid';
      end if;
    else
      raise exception 'order_set_snapshot_pricing_invalid';
    end if;
    if new.applied_price_snapshot ->> 'billingReflectionEnabled'
         is distinct from new.billing_reflection_enabled::text
       or new.billing_reflection_enabled is distinct from v_root.billing_reflection_enabled
       or new.applied_price_snapshot ->> 'roundingRule' is distinct from 'as_is'
       or coalesce(jsonb_typeof(new.applied_price_snapshot -> 'roundingResultKrw'), 'null') not in ('number', 'null')
       or new.calculation_inputs ->> 'roundingRule' is distinct from new.applied_price_snapshot ->> 'roundingRule'
     or new.calculation_inputs ->> 'roundingRule' is distinct from 'as_is'
     or new.calculation_outputs ->> 'taxType' is distinct from new.applied_price_snapshot ->> 'taxType'
     or new.calculation_outputs ->> 'roundingRule' is distinct from new.applied_price_snapshot ->> 'roundingRule'
     or new.calculation_outputs -> 'roundingResultKrw' is distinct from new.applied_price_snapshot -> 'roundingResultKrw'
     or new.calculation_outputs ->> 'roundingRule' is distinct from 'as_is'
     or new.calculation_outputs -> 'roundingResultKrw' is distinct from new.calculation_outputs -> 'finalTotalKrw'
     or (new.calculation_outputs ->> 'lineTotalKrw')::numeric is distinct from
          coalesce(new.unit_price_snapshot, 0)
     or (new.calculation_outputs ->> 'finalTotalKrw')::numeric is distinct from
          (new.calculation_outputs ->> 'lineTotalKrw')::numeric
            + (new.calculation_outputs ->> 'childSubtotalKrw')::numeric
     or new.calculation_inputs ->> 'selectionFingerprint' is null then
      raise exception 'order_set_snapshot_calculation_invalid';
    end if;
    if exists (
      select 1
      from jsonb_array_elements(new.applied_snapshot -> 'items')
        with ordinality entry(item, item_ordinal)
      where jsonb_typeof(entry.item) is distinct from 'object'
         or (select count(*) from jsonb_object_keys(entry.item)) <> 39
         or exists (
           select 1
           from jsonb_object_keys(entry.item) as keys(key_name)
           where keys.key_name not in (
             'itemIndex', 'revisionItemId', 'itemKind', 'path',
             'rootRevisionItemId', 'directRevisionItemId',
             'nestedRevisionItemId', 'leafRevisionItemId',
             'workspaceCatalogItemId', 'pinnedCompositionCatalogRevision',
             'appliedCatalogRevision', 'defaultSelected',
             'defaultQuantitySource', 'selected', 'standardOrderName',
             'displayName', 'billingName', 'categoryGroup', 'billingCategory',
             'orderType', 'destinationModule', 'taskRequired', 'targetSpecies',
             'salesUnit', 'careGuide', 'internalInstruction',
             'typeSpecificRuntimeContext', 'sourcePresetId',
             'sourcePresetVersion', 'defaultQuantity', 'quantity',
             'quantitySource', 'billingReflectionEnabled', 'priceKrw',
             'taxType', 'taxIncluded', 'roundingRule', 'roundingResultKrw',
             'appliedSnapshot'
           )
         )
         or jsonb_typeof(entry.item -> 'path') is distinct from 'array'
         or jsonb_typeof(entry.item -> 'itemIndex') is distinct from 'number'
         or (entry.item ->> 'itemIndex')::integer is distinct from entry.item_ordinal::integer
         or entry.item ->> 'leafRevisionItemId' is null
         or entry.item ->> 'workspaceCatalogItemId' is null
         or entry.item ->> 'revisionItemId' is distinct from entry.item ->> 'leafRevisionItemId'
         or entry.item ->> 'itemKind' is distinct from 'atomic'
         or jsonb_typeof(entry.item -> 'defaultSelected') is distinct from 'boolean'
         or jsonb_typeof(entry.item -> 'selected') is distinct from 'boolean'
         or jsonb_typeof(entry.item -> 'defaultQuantity') is distinct from 'number'
         or jsonb_typeof(entry.item -> 'quantity') is distinct from 'number'
         or coalesce(entry.item ->> 'defaultQuantitySource', '') not in ('fixed_one', 'preset_quantity', 'manual_at_apply')
         or coalesce(entry.item ->> 'quantitySource', '') not in ('fixed_one', 'preset_quantity', 'manual_at_apply')
         or (entry.item ->> 'defaultQuantity')::numeric <= 0
         or (entry.item ->> 'quantity')::numeric <= 0
         or jsonb_typeof(entry.item -> 'appliedSnapshot') is distinct from 'object'
         or (select count(*) from jsonb_object_keys(entry.item -> 'appliedSnapshot')) <> 52
         or exists (
           select 1
           from jsonb_object_keys(entry.item -> 'appliedSnapshot') as keys(key_name)
           where keys.key_name not in (
             'schemaVersion', 'rowType', 'orderId', 'parentOrderId',
             'sourceSetId', 'sourceSetRevisionId', 'sourceSetRevisionNo',
             'sourceSetVersion', 'sourceSetRevisionItemId', 'childSetId',
             'childSetRevisionId', 'childSetRevisionNo', 'rootRevisionItemId',
             'directRevisionItemId', 'nestedRevisionItemId', 'leafRevisionItemId',
             'path', 'workspaceCatalogItemId',
             'pinnedCompositionCatalogRevision', 'appliedCatalogRevision',
             'sourceMasterRecordId', 'sourceMasterRevision', 'sourcePresetId',
             'sourcePresetVersion', 'sourceOrderId', 'sourceOrderVersion',
             'standardOrderName', 'displayName', 'billingName', 'categoryGroup',
             'billingCategory', 'orderType', 'destinationModule', 'taskRequired',
             'targetSpecies', 'careGuide', 'internalInstruction',
             'typeSpecificRuntimeContext', 'salesUnit', 'defaultQuantity',
             'defaultQuantitySource', 'quantity', 'quantitySource',
             'defaultSelected', 'selected', 'billingReflectionEnabled', 'items',
             'priceKrw', 'taxType', 'taxIncluded', 'roundingRule',
             'roundingResultKrw'
           )
         )
         or entry.item -> 'appliedSnapshot' ->> 'schemaVersion' is distinct from '1'
         or entry.item -> 'appliedSnapshot' ->> 'rowType' is distinct from 'set_child'
         or entry.item -> 'appliedSnapshot' ->> 'leafRevisionItemId'
              is distinct from entry.item ->> 'leafRevisionItemId'
         or entry.item -> 'appliedSnapshot' ->> 'workspaceCatalogItemId'
              is distinct from entry.item ->> 'workspaceCatalogItemId'
         or (entry.item -> 'appliedSnapshot' ->> 'quantity')::numeric
              is distinct from (entry.item ->> 'quantity')::numeric
         or entry.item -> 'appliedSnapshot' ->> 'quantitySource'
              is distinct from entry.item ->> 'quantitySource'
         or private.clair_b3_safe_uuid(entry.item ->> 'leafRevisionItemId') is null
         or (case
             when jsonb_typeof(entry.item -> 'path') = 'array'
               then jsonb_array_length(entry.item -> 'path')
             else -1
           end) not between 1 and 2
         or (case
             when jsonb_typeof(entry.item -> 'path') = 'array'
               then (entry.item -> 'path' -> 0 ->> 'setId')
             else null
           end) is distinct from new.source_set_id
         or (case
             when jsonb_typeof(entry.item -> 'path') = 'array'
               then (entry.item -> 'path' -> 0 ->> 'revisionId')
             else null
           end) is distinct from new.source_set_revision_id::text
         or (case
             when jsonb_typeof(entry.item -> 'path') = 'array'
               then (entry.item -> 'path' -> 0 ->> 'revisionItemId')
             else null
           end) is distinct from entry.item ->> 'rootRevisionItemId'
         or (case
             when jsonb_typeof(entry.item -> 'path') = 'array'
               then (entry.item -> 'path' ->
                 (jsonb_array_length(entry.item -> 'path') - 1) ->> 'revisionItemId')
             else null
           end) is distinct from entry.item ->> 'leafRevisionItemId'
         or (case
             when jsonb_typeof(entry.item -> 'path') = 'array'
                  and jsonb_array_length(entry.item -> 'path') = 2
               then entry.item -> 'path' -> 1 ->> 'setId'
             else null
           end) is distinct from entry.item -> 'appliedSnapshot' ->> 'childSetId'
         or (case
             when jsonb_typeof(entry.item -> 'path') = 'array'
                  and jsonb_array_length(entry.item -> 'path') = 2
               then entry.item -> 'path' -> 1 ->> 'revisionId'
             else null
           end) is distinct from entry.item -> 'appliedSnapshot' ->> 'childSetRevisionId'
         or not exists (
           select 1
           from public.order_set_revision_items root_item
           where root_item.workspace_id = new.workspace_id
             and root_item.order_set_id = new.source_set_id
             and root_item.revision_id = new.source_set_revision_id
             and (
               (
                 root_item.id = private.clair_b3_safe_uuid(
                   entry.item ->> 'leafRevisionItemId'
                 )
                 and root_item.child_kind = 'atomic'
               )
               or (
                 root_item.child_kind = 'order_set'
                 and exists (
                   select 1
                   from public.order_set_revision_items child_item
                   where child_item.workspace_id = root_item.workspace_id
                     and child_item.order_set_id = root_item.child_order_set_id
                     and child_item.revision_id = root_item.child_set_revision_id
                     and child_item.child_kind = 'atomic'
                     and child_item.id = private.clair_b3_safe_uuid(
                       entry.item ->> 'leafRevisionItemId'
                     )
                 )
               )
             )
         )
    ) then
      raise exception 'order_set_snapshot_items_invalid';
    end if;
    if jsonb_array_length(new.applied_snapshot -> 'items') is distinct from (
      select count(*)
      from (
        select root_item.id
        from public.order_set_revision_items root_item
        where root_item.workspace_id = new.workspace_id
          and root_item.order_set_id = new.source_set_id
          and root_item.revision_id = new.source_set_revision_id
          and root_item.child_kind = 'atomic'
        union all
        select child_item.id
        from public.order_set_revision_items root_item
        join public.order_set_revision_items child_item
          on child_item.workspace_id = root_item.workspace_id
         and child_item.order_set_id = root_item.child_order_set_id
         and child_item.revision_id = root_item.child_set_revision_id
         and child_item.child_kind = 'atomic'
        where root_item.workspace_id = new.workspace_id
          and root_item.order_set_id = new.source_set_id
          and root_item.revision_id = new.source_set_revision_id
          and root_item.child_kind = 'order_set'
      ) leaves
    ) then
      raise exception 'order_set_snapshot_items_invalid';
    end if;
    if (
      select count(*)
      from jsonb_array_elements(new.applied_snapshot -> 'items') entry(item)
      where (entry.item ->> 'selected')::boolean
    ) is distinct from (
      select count(*)
      from public.orders child
      where child.workspace_id = new.workspace_id
        and child.parent_chart_order_line_id = new.id
        and child.row_type = 'set_child'
        and child.status <> 'cancelled'
    ) then
      raise exception 'order_set_snapshot_child_mapping_invalid';
    end if;
    if exists (
      select 1
      from public.orders child
      where child.workspace_id = new.workspace_id
        and child.parent_chart_order_line_id = new.id
        and child.row_type = 'set_child'
        and child.status <> 'cancelled'
        and not exists (
          select 1
          from jsonb_array_elements(new.applied_snapshot -> 'items') entry(item)
          where (entry.item ->> 'selected')::boolean
            and entry.item ->> 'leafRevisionItemId'
              = child.source_set_revision_item_id::text
        )
    ) then
      raise exception 'order_set_snapshot_child_mapping_invalid';
    end if;
    if exists (
      select 1
      from jsonb_array_elements(new.applied_snapshot -> 'items') entry(item)
      where (entry.item ->> 'selected')::boolean
        and not exists (
          select 1
          from public.orders child
          where child.workspace_id = new.workspace_id
            and child.parent_chart_order_line_id = new.id
            and child.row_type = 'set_child'
            and child.status <> 'cancelled'
            and child.source_set_revision_item_id = private.clair_b3_safe_uuid(
              entry.item ->> 'leafRevisionItemId'
            )
        )
    ) then
      raise exception 'order_set_snapshot_child_mapping_invalid';
    end if;
    -- The parent item is a frozen, ordered copy of the child payload.  Compare
    -- the complete item projection and the embedded four-object child snapshot
    -- (order IDs are the only persistence-time additions) so a caller cannot
    -- alter a parent item without altering the persisted child, too.
    if exists (
      select 1
      from public.orders child
      join lateral (
        select entry.item
        from jsonb_array_elements(new.applied_snapshot -> 'items') entry(item)
        where (entry.item ->> 'selected')::boolean
          and entry.item ->> 'leafRevisionItemId'
            = child.source_set_revision_item_id::text
        limit 1
      ) parent_item on true
      where child.workspace_id = new.workspace_id
        and child.parent_chart_order_line_id = new.id
        and child.row_type = 'set_child'
        and child.status <> 'cancelled'
        and (
          (parent_item.item - 'itemIndex' - 'appliedSnapshot') is distinct from
            jsonb_build_object(
              'revisionItemId', child.source_set_revision_item_id,
              'itemKind', 'atomic',
              'path', child.applied_snapshot -> 'path',
              'rootRevisionItemId', child.applied_snapshot -> 'rootRevisionItemId',
              'directRevisionItemId', child.applied_snapshot -> 'directRevisionItemId',
              'nestedRevisionItemId', child.applied_snapshot -> 'nestedRevisionItemId',
              'leafRevisionItemId', child.applied_snapshot -> 'leafRevisionItemId',
              'workspaceCatalogItemId', child.applied_snapshot -> 'workspaceCatalogItemId',
              'pinnedCompositionCatalogRevision', child.applied_snapshot -> 'pinnedCompositionCatalogRevision',
              'appliedCatalogRevision', child.applied_snapshot -> 'appliedCatalogRevision',
              'defaultSelected', child.applied_snapshot -> 'defaultSelected',
              'defaultQuantitySource', child.applied_snapshot -> 'defaultQuantitySource',
              'selected', child.applied_snapshot -> 'selected',
              'standardOrderName', child.applied_snapshot -> 'standardOrderName',
              'displayName', child.applied_snapshot -> 'displayName',
              'billingName', child.applied_snapshot -> 'billingName',
              'categoryGroup', child.applied_snapshot -> 'categoryGroup',
              'billingCategory', child.applied_snapshot -> 'billingCategory',
              'orderType', child.applied_snapshot -> 'orderType',
              'destinationModule', child.applied_snapshot -> 'destinationModule',
              'taskRequired', child.applied_snapshot -> 'taskRequired',
              'targetSpecies', child.applied_snapshot -> 'targetSpecies',
              'salesUnit', child.applied_snapshot -> 'salesUnit',
              'careGuide', child.applied_snapshot -> 'careGuide',
              'internalInstruction', child.applied_snapshot -> 'internalInstruction',
              'typeSpecificRuntimeContext', child.applied_snapshot -> 'typeSpecificRuntimeContext',
              'sourcePresetId', child.applied_snapshot -> 'sourcePresetId',
              'sourcePresetVersion', child.applied_snapshot -> 'sourcePresetVersion',
              'defaultQuantity', child.applied_snapshot -> 'defaultQuantity',
              'quantity', child.applied_snapshot -> 'quantity',
              'quantitySource', child.applied_snapshot -> 'quantitySource',
              'billingReflectionEnabled', child.applied_snapshot -> 'billingReflectionEnabled',
              'priceKrw', child.applied_snapshot -> 'priceKrw',
              'taxType', child.applied_snapshot -> 'taxType',
              'taxIncluded', child.applied_snapshot -> 'taxIncluded',
              'roundingRule', child.applied_snapshot -> 'roundingRule',
              'roundingResultKrw', child.applied_snapshot -> 'roundingResultKrw'
            )
          or ((parent_item.item -> 'appliedSnapshot') - 'orderId' - 'parentOrderId') is distinct from
            (child.applied_snapshot - 'orderId' - 'parentOrderId')
        )
    ) then
      raise exception 'order_set_snapshot_child_mapping_invalid';
    end if;
    return new;
  end if;

  if (select count(*) from jsonb_object_keys(new.applied_snapshot)) <> 52
     or exists (
       select 1
       from jsonb_object_keys(new.applied_snapshot) as keys(key_name)
       where keys.key_name not in (
         'schemaVersion', 'rowType', 'orderId', 'parentOrderId',
         'sourceSetId', 'sourceSetRevisionId', 'sourceSetRevisionNo',
         'sourceSetVersion', 'sourceSetRevisionItemId', 'childSetId',
         'childSetRevisionId', 'childSetRevisionNo', 'rootRevisionItemId',
         'directRevisionItemId', 'nestedRevisionItemId', 'leafRevisionItemId',
         'path', 'workspaceCatalogItemId',
         'pinnedCompositionCatalogRevision', 'appliedCatalogRevision',
         'sourceMasterRecordId', 'sourceMasterRevision', 'sourcePresetId',
         'sourcePresetVersion', 'sourceOrderId', 'sourceOrderVersion',
         'standardOrderName', 'displayName', 'billingName', 'categoryGroup',
         'billingCategory', 'orderType', 'destinationModule', 'taskRequired',
         'targetSpecies', 'careGuide', 'internalInstruction',
         'typeSpecificRuntimeContext', 'salesUnit', 'defaultQuantity',
         'defaultQuantitySource', 'quantity', 'quantitySource',
         'defaultSelected', 'selected', 'billingReflectionEnabled', 'items',
         'priceKrw', 'taxType', 'taxIncluded', 'roundingRule',
         'roundingResultKrw'
       )
     ) then
    raise exception 'order_set_snapshot_schema_invalid';
  end if;

  select * into v_parent
  from public.orders
  where workspace_id = new.workspace_id
    and id = new.parent_chart_order_line_id;
  if not found
     or v_parent.workspace_id is distinct from new.workspace_id
     or v_parent.encounter_id is distinct from new.encounter_id
     or v_parent.row_type <> 'set'
     or v_parent.order_type <> 'set'
     or v_parent.source_set_id is distinct from new.source_set_id
     or v_parent.source_set_revision_id is distinct from new.source_set_revision_id
     or v_parent.source_set_revision_no is distinct from new.source_set_revision_no then
    raise exception 'order_set_parent_lineage_invalid';
  end if;
  select * into v_root
  from public.order_set_revisions
  where workspace_id = new.workspace_id
    and id = new.source_set_revision_id
    and order_set_id = new.source_set_id;
  if not found or v_root.revision_no is distinct from new.source_set_revision_no then
    raise exception 'order_set_root_revision_invalid';
  end if;
  select * into v_leaf
  from public.order_set_revision_items
  where workspace_id = new.workspace_id
    and id = new.source_set_revision_item_id;
  if not found or v_leaf.child_kind <> 'atomic' then
    raise exception 'order_set_leaf_revision_item_invalid';
  end if;
  -- Draft/pending reconciliation is allowed to revalidate the live catalog.
  -- Confirmed/billed transitions use only the frozen child snapshot, so a
  -- later catalog retirement or revision cannot block historical billing.
  if new.order_confirmation_status in ('draft', 'pending') then
    select * into v_catalog
    from public.order_catalog_items
    where workspace_id = new.workspace_id
      and id = new.workspace_catalog_item_id;
    if not found then
      raise exception 'order_set_catalog_lineage_invalid';
    end if;
  end if;
  select * into v_root_item
  from public.order_set_revision_items
  where workspace_id = new.workspace_id
    and revision_id = v_root.id
    and (
      (id = v_leaf.id and child_kind = 'atomic')
      or (
        child_kind = 'order_set'
        and child_order_set_id = v_leaf.order_set_id
        and child_set_revision_id = v_leaf.revision_id
      )
    );
  if not found then
    raise exception 'order_set_leaf_path_invalid';
  end if;
  if (v_root_item.child_kind = 'atomic' and new.row_depth <> 1)
     or (v_root_item.child_kind = 'order_set' and new.row_depth <> 2) then
    raise exception 'order_set_leaf_depth_invalid';
  end if;
  if v_leaf.child_order_catalog_item_id is distinct from new.workspace_catalog_item_id then
    raise exception 'order_set_catalog_lineage_invalid';
  end if;
  v_path := new.applied_snapshot -> 'path';
  if new.applied_snapshot ->> 'rowType' is distinct from 'set_child'
     or new.applied_snapshot ->> 'orderId' is distinct from new.id::text
     or new.applied_snapshot ->> 'parentOrderId' is distinct from new.parent_chart_order_line_id::text
     or new.applied_snapshot ->> 'sourceSetId' is distinct from new.source_set_id
     or new.applied_snapshot ->> 'sourceSetRevisionId' is distinct from new.source_set_revision_id::text
     or new.applied_snapshot ->> 'sourceSetRevisionNo' is distinct from new.source_set_revision_no::text
     or new.applied_snapshot ->> 'sourceSetVersion' is distinct from new.source_set_version
     or new.applied_snapshot ->> 'sourceSetRevisionItemId' is distinct from new.source_set_revision_item_id::text
     or new.applied_snapshot ->> 'rootRevisionItemId' is distinct from v_root_item.id::text
     or new.applied_snapshot ->> 'directRevisionItemId' is distinct from v_root_item.id::text
     or new.applied_snapshot ->> 'leafRevisionItemId' is distinct from v_leaf.id::text
     or new.applied_snapshot ->> 'workspaceCatalogItemId' is distinct from new.workspace_catalog_item_id
     or new.applied_snapshot ->> 'appliedCatalogRevision' is distinct from new.workspace_catalog_revision::text
     or new.applied_snapshot ->> 'pinnedCompositionCatalogRevision' is distinct from v_leaf.child_order_catalog_revision::text
     or (
       new.order_confirmation_status in ('draft', 'pending')
       and (
         new.applied_snapshot ->> 'sourcePresetId' is distinct from v_catalog.standard_order_id
         or new.applied_snapshot ->> 'sourcePresetVersion' is distinct from v_catalog.source_preset_version
         or new.applied_snapshot ->> 'sourceMasterRecordId' is distinct from v_catalog.source_master_record_id::text
         or new.applied_snapshot ->> 'sourceMasterRevision' is distinct from v_catalog.source_master_revision::text
         or new.applied_snapshot ->> 'standardOrderName' is distinct from v_catalog.standard_order_name
         or new.applied_snapshot ->> 'displayName' is distinct from v_catalog.in_hospital_order_name
         or new.applied_snapshot ->> 'billingName' is distinct from v_catalog.billing_name
         or new.applied_snapshot ->> 'categoryGroup' is distinct from v_catalog.category_group
         or new.applied_snapshot ->> 'billingCategory'
              is distinct from private.clair_map_catalog_category_to_billing_category(v_catalog.category_group)
         or new.applied_snapshot ->> 'orderType' is distinct from (case v_catalog.category_group
              when 'lab' then 'lab'
              when 'imaging' then 'imaging'
              when 'medication' then 'dispensing'
              else 'treatment'
            end)
         or new.applied_snapshot ->> 'destinationModule' is distinct from v_catalog.default_destination_module
         or (new.applied_snapshot ->> 'taskRequired')::boolean
              is distinct from v_catalog.default_task_required
         or new.applied_snapshot -> 'targetSpecies' is distinct from to_jsonb(v_catalog.target_species)
         or new.applied_snapshot ->> 'salesUnit' is distinct from v_catalog.sales_unit
         or new.applied_snapshot ->> 'careGuide' is distinct from v_catalog.care_guide
         or new.applied_snapshot ->> 'internalInstruction' is distinct from v_catalog.internal_instruction
         or coalesce(new.applied_snapshot -> 'typeSpecificRuntimeContext', 'null'::jsonb)
              is distinct from coalesce(v_catalog.medication_metadata, 'null'::jsonb)
         or new.applied_snapshot ->> 'sourceOrderId' is distinct from v_catalog.standard_order_id
         or new.applied_snapshot ->> 'sourceOrderVersion' is distinct from v_catalog.source_preset_version
       )
     )
     or (new.applied_snapshot ->> 'quantity')::numeric is distinct from new.quantity
     or new.applied_snapshot ->> 'quantitySource' is distinct from new.quantity_source
     or new.applied_snapshot ->> 'billingReflectionEnabled'
          is distinct from new.billing_reflection_enabled::text
     or jsonb_typeof(v_path) is distinct from 'array'
     or (case when jsonb_typeof(v_path) = 'array'
          then coalesce(jsonb_array_length(v_path), -1) else -1 end) <> new.row_depth
     or (case when jsonb_typeof(v_path) = 'array'
          then (v_path -> (jsonb_array_length(v_path) - 1) ->> 'revisionItemId')
          else null end) is distinct from new.source_set_revision_item_id::text
     or new.applied_snapshot ->> 'items' is not null
     or new.applied_snapshot ->> 'categoryGroup' is null
     or new.applied_snapshot ->> 'categoryGroup' = 'set'
     or new.applied_snapshot ->> 'orderType' is null
     or new.applied_snapshot ->> 'orderType' = 'set' then
    raise exception 'order_set_snapshot_lineage_invalid';
  end if;
  if (v_path -> 0 ->> 'setId') is distinct from new.source_set_id
     or (v_path -> 0 ->> 'revisionId') is distinct from new.source_set_revision_id::text
     or (v_path -> 0 ->> 'revisionItemId') is distinct from v_root_item.id::text then
    raise exception 'order_set_snapshot_lineage_invalid';
  end if;
  if v_root_item.child_kind = 'atomic' then
    if jsonb_array_length(v_path) <> 1
       or new.applied_snapshot ->> 'childSetId' is not null
       or new.applied_snapshot ->> 'childSetRevisionId' is not null
       or new.applied_snapshot ->> 'childSetRevisionNo' is not null
       or new.applied_snapshot ->> 'nestedRevisionItemId' is not null then
      raise exception 'order_set_snapshot_nested_invalid';
    end if;
  elsif jsonb_array_length(v_path) <> 2
     or (v_path -> 1 ->> 'setId') is distinct from v_root_item.child_order_set_id
     or (v_path -> 1 ->> 'revisionId') is distinct from v_root_item.child_set_revision_id::text
     or (v_path -> 1 ->> 'revisionItemId') is distinct from v_leaf.id::text
     or new.applied_snapshot ->> 'childSetId' is distinct from v_root_item.child_order_set_id
     or new.applied_snapshot ->> 'childSetRevisionId' is distinct from v_root_item.child_set_revision_id::text
     or new.applied_snapshot ->> 'childSetRevisionNo' is distinct from (
       select child_revision.revision_no::text
       from public.order_set_revisions child_revision
       where child_revision.workspace_id = new.workspace_id
         and child_revision.order_set_id = v_root_item.child_order_set_id
         and child_revision.id = v_root_item.child_set_revision_id
     )
     or new.applied_snapshot ->> 'nestedRevisionItemId' is distinct from v_leaf.id::text then
    raise exception 'order_set_snapshot_nested_invalid';
  end if;
  if not exists (
    select 1
    from jsonb_array_elements(v_parent.applied_snapshot -> 'items') entry(item)
    where entry.item ->> 'leafRevisionItemId' = new.source_set_revision_item_id::text
      and entry.item ->> 'workspaceCatalogItemId' = new.workspace_catalog_item_id
      and entry.item ->> 'appliedCatalogRevision' = new.workspace_catalog_revision::text
  ) then
    raise exception 'order_set_snapshot_parent_item_missing';
  end if;
  if new.status <> 'cancelled'
     and not exists (
       select 1
       from jsonb_array_elements(v_parent.applied_snapshot -> 'items') entry(item)
       where (entry.item ->> 'selected')::boolean
         and entry.item ->> 'leafRevisionItemId' = new.source_set_revision_item_id::text
     ) then
    raise exception 'order_set_snapshot_parent_item_mismatch';
  end if;
  -- Recheck the reverse direction on every child insert/update.  A child
  -- caller cannot recompute its own valid envelope and diverge from the
  -- immutable ordered parent item; only persistence-time order IDs differ.
  if new.status <> 'cancelled'
     and exists (
    select 1
    from jsonb_array_elements(v_parent.applied_snapshot -> 'items') entry(item)
    where (entry.item ->> 'selected')::boolean
      and entry.item ->> 'leafRevisionItemId' = new.source_set_revision_item_id::text
      and (
        (entry.item - 'itemIndex' - 'appliedSnapshot') is distinct from
          jsonb_build_object(
            'revisionItemId', new.source_set_revision_item_id,
            'itemKind', 'atomic',
            'path', new.applied_snapshot -> 'path',
            'rootRevisionItemId', new.applied_snapshot -> 'rootRevisionItemId',
            'directRevisionItemId', new.applied_snapshot -> 'directRevisionItemId',
            'nestedRevisionItemId', new.applied_snapshot -> 'nestedRevisionItemId',
            'leafRevisionItemId', new.applied_snapshot -> 'leafRevisionItemId',
            'workspaceCatalogItemId', new.applied_snapshot -> 'workspaceCatalogItemId',
            'pinnedCompositionCatalogRevision', new.applied_snapshot -> 'pinnedCompositionCatalogRevision',
            'appliedCatalogRevision', new.applied_snapshot -> 'appliedCatalogRevision',
            'defaultSelected', new.applied_snapshot -> 'defaultSelected',
            'defaultQuantitySource', new.applied_snapshot -> 'defaultQuantitySource',
            'selected', new.applied_snapshot -> 'selected',
            'standardOrderName', new.applied_snapshot -> 'standardOrderName',
            'displayName', new.applied_snapshot -> 'displayName',
            'billingName', new.applied_snapshot -> 'billingName',
            'categoryGroup', new.applied_snapshot -> 'categoryGroup',
            'billingCategory', new.applied_snapshot -> 'billingCategory',
            'orderType', new.applied_snapshot -> 'orderType',
            'destinationModule', new.applied_snapshot -> 'destinationModule',
            'taskRequired', new.applied_snapshot -> 'taskRequired',
            'targetSpecies', new.applied_snapshot -> 'targetSpecies',
            'salesUnit', new.applied_snapshot -> 'salesUnit',
            'careGuide', new.applied_snapshot -> 'careGuide',
            'internalInstruction', new.applied_snapshot -> 'internalInstruction',
            'typeSpecificRuntimeContext', new.applied_snapshot -> 'typeSpecificRuntimeContext',
            'sourcePresetId', new.applied_snapshot -> 'sourcePresetId',
            'sourcePresetVersion', new.applied_snapshot -> 'sourcePresetVersion',
            'defaultQuantity', new.applied_snapshot -> 'defaultQuantity',
            'quantity', new.applied_snapshot -> 'quantity',
            'quantitySource', new.applied_snapshot -> 'quantitySource',
            'billingReflectionEnabled', new.applied_snapshot -> 'billingReflectionEnabled',
            'priceKrw', new.applied_snapshot -> 'priceKrw',
            'taxType', new.applied_snapshot -> 'taxType',
            'taxIncluded', new.applied_snapshot -> 'taxIncluded',
            'roundingRule', new.applied_snapshot -> 'roundingRule',
            'roundingResultKrw', new.applied_snapshot -> 'roundingResultKrw'
          )
        or ((entry.item -> 'appliedSnapshot') - 'orderId' - 'parentOrderId') is distinct from
          ((new.applied_snapshot) - 'orderId' - 'parentOrderId')
      )
  ) then
    raise exception 'order_set_snapshot_parent_item_mismatch';
  end if;
  if new.applied_price_snapshot ->> 'billedAs' is distinct from 'atomic_child'
     or (
       new.status <> 'cancelled'
       and new.applied_price_snapshot ->> 'amountBasis'
            is distinct from v_parent.applied_price_snapshot ->> 'amountBasis'
     )
     or nullif(new.applied_price_snapshot ->> 'priceKrw', '')::numeric
          is distinct from new.unit_price_snapshot
     or new.applied_price_snapshot ->> 'taxType' is null
     or new.applied_price_snapshot ->> 'taxType' not in ('taxable', 'non_taxable')
     or (
       new.order_confirmation_status in ('draft', 'pending')
       and (
         new.applied_price_snapshot ->> 'taxType' is distinct from (case
              when v_catalog.tax_included then 'taxable' else 'non_taxable' end)
         or nullif(new.applied_price_snapshot ->> 'priceKrw', '')::numeric
              is distinct from v_catalog.price_krw
         or new.applied_price_snapshot ->> 'roundingRule'
              is distinct from v_catalog.rounding_rule
         or coalesce(new.applied_price_snapshot -> 'roundingResultKrw', 'null'::jsonb)
              is distinct from coalesce((case
                when v_catalog.price_krw is null then null
                else to_jsonb(private.clair_round_catalog_order_amount(
                  v_catalog.price_krw * new.quantity,
                  v_catalog.rounding_rule
                ))
              end), 'null'::jsonb)
       )
     )
     or new.applied_snapshot ->> 'taxType' is distinct from new.applied_price_snapshot ->> 'taxType'
     or jsonb_typeof(new.applied_snapshot -> 'taxIncluded') is distinct from 'boolean'
     or jsonb_typeof(new.applied_price_snapshot -> 'taxIncluded') is distinct from 'boolean'
     or (new.applied_snapshot ->> 'taxIncluded')::boolean is distinct from
          (new.applied_price_snapshot ->> 'taxType' = 'taxable')
     or new.applied_price_snapshot ->> 'taxIncluded'
          is distinct from new.applied_snapshot ->> 'taxIncluded'
     or new.applied_price_snapshot ->> 'billingReflectionEnabled'
          is distinct from new.billing_reflection_enabled::text
     or coalesce(new.applied_price_snapshot ->> 'roundingRule', '')
          not in ('as_is', 'ceil', 'floor', 'round')
     or coalesce(jsonb_typeof(new.applied_price_snapshot -> 'roundingResultKrw'), 'null')
          not in ('number', 'null')
     or new.applied_price_snapshot ->> 'roundingRule' is distinct from new.applied_snapshot ->> 'roundingRule'
     or new.applied_price_snapshot -> 'roundingResultKrw' is distinct from new.applied_snapshot -> 'roundingResultKrw'
     or (
       new.status <> 'cancelled'
       and new.calculation_inputs ->> 'selectionFingerprint'
            is distinct from v_parent.calculation_inputs ->> 'selectionFingerprint'
     )
     or new.calculation_inputs ->> 'roundingRule'
          is distinct from new.applied_price_snapshot ->> 'roundingRule'
     or new.calculation_inputs ->> 'quantity' is null
     or (new.calculation_inputs ->> 'quantity')::numeric is distinct from new.quantity
     or new.calculation_outputs ->> 'taxType' is distinct from new.applied_price_snapshot ->> 'taxType'
     or new.calculation_outputs ->> 'roundingRule' is distinct from new.applied_price_snapshot ->> 'roundingRule'
     or new.calculation_outputs -> 'roundingResultKrw' is distinct from new.applied_price_snapshot -> 'roundingResultKrw'
     or (new.calculation_outputs ->> 'lineTotalKrw')::numeric is distinct from
          coalesce((new.applied_price_snapshot ->> 'roundingResultKrw')::numeric, 0)
     or (new.calculation_outputs ->> 'finalTotalKrw')::numeric is distinct from
          (new.calculation_outputs ->> 'childSubtotalKrw')::numeric then
    raise exception 'order_set_snapshot_calculation_invalid';
  end if;
  return new;
end;
$$;

revoke all on function private.clair_b3_assert_set_child_lineage()
  from public, anon, authenticated, service_role;

drop trigger if exists orders_set_child_parent_lineage_trg on public.orders;
create constraint trigger orders_set_child_parent_lineage_trg
after insert or update on public.orders
deferrable initially deferred
for each row execute function private.clair_b3_assert_set_child_lineage();

-- B2 deliberately leaves the legacy eight-column function atomic-only. B3
-- exposes the closed set union as a separate invoker function so existing
-- atomic callers retain their exact ACL and return shape.
drop function if exists public.clair_list_order_catalog_chart_search_v2(text);
create function public.clair_list_order_catalog_chart_search_v2(
  p_workspace_id text
)
returns table (
  row_type text,
  source_preset_id text,
  source_preset_version text,
  display_name text,
  billing_name text,
  category_group text,
  target_species text[],
  applied_snapshot jsonb,
  source_set_id text,
  source_set_revision_id uuid,
  source_set_revision_no integer,
  source_set_amount_basis text,
  source_set_price_krw integer,
  source_set_range_basis text,
  source_set_tax_type text,
  source_set_availability_status text,
  source_set_needs_composition_review boolean,
  source_set_validation_status text,
  source_set_price_ranges jsonb,
  source_set_pending_review_count integer
)
language sql
security invoker
set search_path = public, pg_catalog
as $$
  with atomic_rows as (
    select
      'individual'::text as row_type,
      item.standard_order_id as source_preset_id,
      item.source_preset_version,
      item.in_hospital_order_name as display_name,
      item.billing_name,
      item.category_group,
      item.target_species,
      jsonb_build_object(
        'sourcePresetId', item.standard_order_id,
        'sourcePresetVersion', item.source_preset_version,
        'workspaceCatalogItemId', item.id,
        'appliedStandardOrderName', item.standard_order_name,
        'appliedDisplayName', item.in_hospital_order_name,
        'appliedBillingName', item.billing_name,
        'appliedPriceKrw', item.price_krw,
        'appliedSalesUnit', item.sales_unit,
        'appliedTaxIncluded', item.tax_included,
        'appliedAmountBasis', item.pricing_rule ->> 'priceBasis',
        'appliedTargetSpecies', to_jsonb(item.target_species),
        'appliedCareGuide', item.care_guide,
        'appliedInternalInstruction', item.internal_instruction,
        'appliedDestinationModule', item.default_destination_module,
        'appliedTaskRequired', item.default_task_required,
        'appliedBillingReflectionEnabled', item.billing_reflection_enabled,
        'roundingRule', item.rounding_rule,
        'billingReflectionEnabled', item.billing_reflection_enabled
      ) as applied_snapshot,
      null::text as source_set_id,
      null::uuid as source_set_revision_id,
      null::integer as source_set_revision_no,
      null::text as source_set_amount_basis,
      null::integer as source_set_price_krw,
      null::text as source_set_range_basis,
      null::text as source_set_tax_type,
      null::text as source_set_availability_status,
      null::boolean as source_set_needs_composition_review,
      null::text as source_set_validation_status,
      null::jsonb as source_set_price_ranges,
      null::integer as source_set_pending_review_count
    from public.order_catalog_items item
    where item.workspace_id = p_workspace_id
      and item.availability_status = 'active'
      and private.clair_current_user_has_workspace_permission(
        p_workspace_id, 'service_catalog:view'
      )
  ),
  set_rows as (
    select
      'set'::text as row_type,
      s.id as source_preset_id,
      ('order-set-revision-' || r.revision_no::text) as source_preset_version,
      r.set_name as display_name,
      r.billing_name,
      'set'::text as category_group,
      r.target_species,
      jsonb_build_object(
        'sourceSetId', s.id,
        'sourceSetRevisionId', r.id,
        'sourceSetRevisionNo', r.revision_no,
        'sourceSetVersion', 'order-set-revision-' || r.revision_no::text,
        'amountBasis', r.amount_basis,
        'setPriceKrw', r.set_price_krw,
        'rangeBasis', r.range_basis,
        'taxType', r.tax_type,
        'priceRanges', coalesce(ranges.price_ranges, '[]'::jsonb),
        'billingReflectionEnabled', r.billing_reflection_enabled
      ) as applied_snapshot,
      s.id as source_set_id,
      r.id as source_set_revision_id,
      r.revision_no as source_set_revision_no,
      r.amount_basis as source_set_amount_basis,
      r.set_price_krw as source_set_price_krw,
      r.range_basis as source_set_range_basis,
      r.tax_type as source_set_tax_type,
      s.availability_status as source_set_availability_status,
      s.needs_composition_review as source_set_needs_composition_review,
      r.validation_status as source_set_validation_status,
      coalesce(ranges.price_ranges, '[]'::jsonb) as source_set_price_ranges,
      coalesce(reviews.pending_review_count, 0)::integer
        as source_set_pending_review_count
    from public.order_sets s
    join public.order_set_revisions r
      on r.workspace_id = s.workspace_id
     and r.order_set_id = s.id
     and r.id = s.current_revision_id
    left join lateral (
      select jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'sortOrder', p.sort_order,
          'lowerBound', p.lower_bound,
          'upperBound', p.upper_bound,
          'priceKrw', p.price_krw
        )
        order by p.sort_order
      ) as price_ranges
      from public.order_set_revision_price_ranges p
      where p.workspace_id = r.workspace_id
        and p.order_set_id = r.order_set_id
        and p.revision_id = r.id
    ) ranges on true
    left join lateral (
      select count(*)::integer as pending_review_count
      from public.order_set_revision_update_reviews review
      where review.workspace_id = r.workspace_id
        and review.parent_order_set_id = r.order_set_id
        and review.parent_revision_id = r.id
        and review.status = 'pending'
    ) reviews on true
    where s.workspace_id = p_workspace_id
      and s.availability_status = 'active'
      and s.needs_composition_review = false
      and r.validation_status = 'valid'
      and (r.amount_basis <> 'range_price' or ranges.price_ranges is not null)
      and (
        (r.amount_basis = 'included_order_sum'
          and r.set_price_krw is null
          and r.range_basis is null
          and r.tax_type = 'derived')
        or (r.amount_basis = 'set_fixed_price'
          and r.set_price_krw is not null
          and r.range_basis is null
          and r.tax_type in ('taxable', 'non_taxable'))
        or (r.amount_basis = 'range_price'
          and r.set_price_krw is null
          and r.range_basis in ('patient_weight_kg', 'manual_value')
          and r.tax_type in ('taxable', 'non_taxable'))
      )
  )
  select * from atomic_rows
  union all
  select * from set_rows;
$$;

revoke all on function public.clair_list_order_catalog_chart_search_v2(text)
  from public, anon, service_role;
grant execute on function public.clair_list_order_catalog_chart_search_v2(text)
  to authenticated;

comment on function public.clair_list_order_catalog_chart_search_v2(text) is
  'B3 closed chart search projection; set rows are active, valid, and review-clear.';

create or replace function private.clair_b3_expand_chart_order_set(
  p_workspace_id text,
  p_encounter_id uuid,
  p_set_id text,
  p_revision_id uuid,
  p_selection_intent jsonb,
  p_operation text default 'preview',
  p_parent_order_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, master, extensions, pg_temp, pg_catalog
as $$
declare
  v_set public.order_sets%rowtype;
  v_revision public.order_set_revisions%rowtype;
  v_leaf record;
  v_selection_item jsonb;
  v_explicit_selected boolean;
  v_explicit_quantity numeric;
  v_has_explicit boolean;
  v_default_selected boolean;
  v_selected boolean;
  v_default_quantity numeric;
  v_quantity numeric;
  v_quantity_source text;
  v_billing boolean;
  v_tax_type text;
  v_rounding_rule text;
  v_rounding_result numeric;
  -- The set is an aggregate of already-rounded A3 child line results.  A3
  -- owns each leaf rule/result; this neutral value records that B3 performs no
  -- second aggregate rounding and is independent of leaf selection order.
  v_set_rounding_rule text := 'as_is';
  v_set_rounding_result numeric;
  v_child_subtotal numeric := 0;
  v_explicit_extra_subtotal numeric := 0;
  v_selected_count integer := 0;
  v_item_count integer := 0;
  v_child_sort integer := 0;
  v_set_price numeric;
  v_final_total numeric;
  v_range_input numeric;
  v_range_id uuid;
  v_items jsonb := '[]'::jsonb;
  v_selection_items jsonb := coalesce(p_selection_intent -> 'items', '[]'::jsonb);
  v_canonical_selection jsonb;
  v_fingerprint text;
  v_applied_snapshot jsonb;
  v_applied_price_snapshot jsonb;
  v_calculation_inputs jsonb;
  v_calculation_outputs jsonb;
begin
  if p_operation not in ('preview', 'draft', 'confirm') then
    raise exception 'invalid_order_set_operation';
  end if;
  if p_workspace_id is null or p_encounter_id is null
     or p_set_id is null or p_revision_id is null then
    raise exception 'invalid_order_set_selection';
  end if;
  perform pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'clinical_master_workspace_adoption:' || p_workspace_id,
      0
    )
  );
  if jsonb_typeof(coalesce(p_selection_intent, '{}'::jsonb)) <> 'object'
     or not (p_selection_intent ? 'items')
     or exists (
       select 1
       from jsonb_object_keys(p_selection_intent) key_name
       where key_name not in ('items', 'rangeInput')
     )
     or jsonb_typeof(v_selection_items) is distinct from 'array' then
    raise exception 'invalid_order_set_selection';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(v_selection_items) entry(value)
    where jsonb_typeof(entry.value) is distinct from 'object'
      or (select count(*) from jsonb_object_keys(entry.value)) <> 3
      or exists (
        select 1
        from jsonb_object_keys(entry.value) key_name
        where key_name not in ('revisionItemId', 'selected', 'quantity')
      )
      or private.clair_b3_safe_uuid(entry.value ->> 'revisionItemId') is null
      or jsonb_typeof(entry.value -> 'selected') is distinct from 'boolean'
      or jsonb_typeof(entry.value -> 'quantity') is distinct from 'number'
      or (entry.value ->> 'quantity')::numeric <= 0
      or (entry.value ->> 'quantity')::numeric > 999999999.999
      or (entry.value ->> 'quantity')::numeric
           <> round((entry.value ->> 'quantity')::numeric, 3)
  ) then
    raise exception 'order_set_quantity_invalid';
  end if;
  if (
    select count(*)
    from jsonb_array_elements(v_selection_items) entry(value)
  ) <> (
    select count(distinct private.clair_b3_safe_uuid(entry.value ->> 'revisionItemId'))
    from jsonb_array_elements(v_selection_items) entry(value)
  ) then
    raise exception 'order_set_duplicate_atomic';
  end if;

  if not exists (
    select 1 from public.encounters e
    where e.workspace_id = p_workspace_id
      and e.id = p_encounter_id
      and e.status <> 'cancelled'
    for update
  ) then
    raise exception 'encounter_unavailable';
  end if;

  select * into v_set
  from public.order_sets
  where workspace_id = p_workspace_id
    and id = p_set_id
  for update;
  if not found then
    raise exception 'order_set_not_found';
  end if;
  select * into v_revision
  from public.order_set_revisions
  where workspace_id = p_workspace_id
    and order_set_id = p_set_id
    and id = p_revision_id
  for update;
  if not found then
    raise exception 'order_set_revision_not_found';
  end if;
  if v_revision.amount_basis = 'range_price'
     and (not (p_selection_intent ? 'rangeInput')
       or jsonb_typeof(p_selection_intent -> 'rangeInput') is distinct from 'number') then
    raise exception 'order_set_range_input_required';
  end if;
  if v_revision.amount_basis <> 'range_price'
     and p_selection_intent ? 'rangeInput' then
    raise exception 'invalid_order_set_selection';
  end if;
  if v_set.availability_status <> 'active'
     or v_set.needs_composition_review
     or v_revision.validation_status <> 'valid'
     or v_revision.validation_errors <> '[]'::jsonb then
    raise exception 'order_set_member_unavailable';
  end if;
  if exists (
    select 1
    from public.order_set_revision_items root_item
    join public.order_sets child_set
      on child_set.workspace_id = root_item.workspace_id
     and child_set.id = root_item.child_order_set_id
    join public.order_set_revisions child_revision
      on child_revision.workspace_id = root_item.workspace_id
     and child_revision.order_set_id = root_item.child_order_set_id
     and child_revision.id = root_item.child_set_revision_id
    where root_item.workspace_id = p_workspace_id
      and root_item.order_set_id = p_set_id
      and root_item.revision_id = p_revision_id
      and root_item.child_kind = 'order_set'
      and (
        child_set.availability_status <> 'active'
        or child_set.needs_composition_review
        or child_revision.validation_status <> 'valid'
        or child_revision.validation_errors <> '[]'::jsonb
      )
  ) then
    raise exception 'order_set_member_unavailable';
  end if;
  if v_revision.amount_basis = 'set_fixed_price'
     and v_revision.set_price_krw is null then
    raise exception 'order_set_price_unset';
  end if;
  if v_revision.amount_basis = 'range_price' then
    begin
      v_range_input := (p_selection_intent ->> 'rangeInput')::numeric;
    exception when others then
      raise exception 'order_set_range_input_invalid';
    end;
    if v_range_input < 0 or v_range_input > 999999999.999
       or v_range_input <> round(v_range_input, 3) then
      raise exception 'order_set_range_input_invalid';
    end if;
    select id into v_range_id
    from public.order_set_revision_price_ranges
    where workspace_id = p_workspace_id
      and order_set_id = p_set_id
      and revision_id = p_revision_id
      and lower_bound <= v_range_input
      and (upper_bound is null or v_range_input < upper_bound)
    order by sort_order
    limit 1;
    if v_range_id is null then
      raise exception 'order_set_range_no_match';
    end if;
  end if;
  if exists (
    select 1
    from public.order_set_revision_items root_item
    join public.order_set_revision_items child_item
      on child_item.workspace_id = root_item.workspace_id
     and child_item.order_set_id = root_item.child_order_set_id
     and child_item.revision_id = root_item.child_set_revision_id
     and child_item.child_kind = 'order_set'
     and child_item.child_order_set_id = p_set_id
     and child_item.child_set_revision_id = p_revision_id
    where root_item.workspace_id = p_workspace_id
      and root_item.order_set_id = p_set_id
      and root_item.revision_id = p_revision_id
      and root_item.child_kind = 'order_set'
  ) then
    raise exception 'order_set_cycle_detected';
  end if;
  if exists (
    select 1
    from public.order_set_revision_items root_item
    join public.order_set_revision_items nested_item
      on nested_item.workspace_id = root_item.workspace_id
     and nested_item.order_set_id = root_item.child_order_set_id
     and nested_item.revision_id = root_item.child_set_revision_id
     and nested_item.child_kind = 'order_set'
    where root_item.workspace_id = p_workspace_id
      and root_item.order_set_id = p_set_id
      and root_item.revision_id = p_revision_id
      and root_item.child_kind = 'order_set'
  ) then
    raise exception 'order_set_depth_exceeded';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_selection_items) entry(value)
    where not exists (
      select 1
      from public.order_set_revision_items root_item
      where root_item.workspace_id = p_workspace_id
        and root_item.order_set_id = p_set_id
        and root_item.revision_id = p_revision_id
        and root_item.child_kind = 'atomic'
        and root_item.id = private.clair_b3_safe_uuid(entry.value ->> 'revisionItemId')
      union all
      select 1
      from public.order_set_revision_items root_item
      join public.order_set_revision_items child_item
        on child_item.workspace_id = root_item.workspace_id
       and child_item.order_set_id = root_item.child_order_set_id
       and child_item.revision_id = root_item.child_set_revision_id
       and child_item.child_kind = 'atomic'
       and child_item.id = private.clair_b3_safe_uuid(entry.value ->> 'revisionItemId')
      where root_item.workspace_id = p_workspace_id
        and root_item.order_set_id = p_set_id
        and root_item.revision_id = p_revision_id
        and root_item.child_kind = 'order_set'
    )
  ) then
    raise exception 'order_set_member_unavailable';
  end if;

  select jsonb_build_object(
    'items', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'revisionItemId', private.clair_b3_safe_uuid(entry.value ->> 'revisionItemId')::text,
          'selected', (entry.value ->> 'selected')::boolean,
          'quantity', pg_catalog.trim_scale(
            (entry.value ->> 'quantity')::numeric(12,3)
          )
        )
        order by private.clair_b3_safe_uuid(entry.value ->> 'revisionItemId')
      ),
      '[]'::jsonb
    ),
    'rangeInput', case when p_selection_intent ? 'rangeInput'
      then pg_catalog.trim_scale(
        (p_selection_intent ->> 'rangeInput')::numeric(12,3)
      ) else null end
  )
  into v_canonical_selection
  from jsonb_array_elements(v_selection_items) entry(value);
  v_fingerprint := private.clair_b3_sha256(
    jsonb_build_object(
      'sourceSetId', p_set_id,
      'sourceSetRevisionId', p_revision_id,
      'selectionIntent', v_canonical_selection
    )
  );

  for v_leaf in
    select *
    from (
      select
        root_item.id as leaf_revision_item_id,
        root_item.id as root_revision_item_id,
        root_item.id as direct_revision_item_id,
        null::uuid as nested_revision_item_id,
        null::text as child_set_id,
        null::integer as child_set_revision_no,
        root_item.sort_order as root_sort_order,
        root_item.sort_order as leaf_sort_order,
        root_item.default_selected as root_default_selected,
        root_item.default_selected as leaf_default_selected,
        root_item.default_quantity as root_default_quantity,
        root_item.default_quantity as leaf_default_quantity,
        root_item.quantity_source as root_quantity_source,
        root_item.quantity_source as leaf_quantity_source,
        root_item.billing_reflection_default as root_billing_reflection,
        root_item.billing_reflection_default as leaf_billing_reflection,
        root_item.child_order_catalog_item_id as catalog_item_id,
        root_item.child_order_catalog_revision as pinned_catalog_revision,
        jsonb_build_array(
          jsonb_build_object(
            'setId', p_set_id,
            'revisionId', p_revision_id,
            'revisionItemId', root_item.id
          )
        ) as leaf_path
      from public.order_set_revision_items root_item
      where root_item.workspace_id = p_workspace_id
        and root_item.order_set_id = p_set_id
        and root_item.revision_id = p_revision_id
        and root_item.child_kind = 'atomic'
      union all
      select
        child_item.id as leaf_revision_item_id,
        root_item.id as root_revision_item_id,
        root_item.id as direct_revision_item_id,
        child_item.id as nested_revision_item_id,
        root_item.child_order_set_id as child_set_id,
        child_revision.revision_no as child_set_revision_no,
        root_item.sort_order as root_sort_order,
        child_item.sort_order as leaf_sort_order,
        root_item.default_selected as root_default_selected,
        child_item.default_selected as leaf_default_selected,
        root_item.default_quantity as root_default_quantity,
        child_item.default_quantity as leaf_default_quantity,
        root_item.quantity_source as root_quantity_source,
        child_item.quantity_source as leaf_quantity_source,
        root_item.billing_reflection_default as root_billing_reflection,
        child_item.billing_reflection_default as leaf_billing_reflection,
        child_item.child_order_catalog_item_id as catalog_item_id,
        child_item.child_order_catalog_revision as pinned_catalog_revision,
        jsonb_build_array(
          jsonb_build_object(
            'setId', p_set_id,
            'revisionId', p_revision_id,
            'revisionItemId', root_item.id
          ),
          jsonb_build_object(
            'setId', root_item.child_order_set_id,
            'revisionId', root_item.child_set_revision_id,
            'revisionItemId', child_item.id
          )
        ) as leaf_path
      from public.order_set_revision_items root_item
      join public.order_set_revision_items child_item
        on child_item.workspace_id = root_item.workspace_id
       and child_item.order_set_id = root_item.child_order_set_id
       and child_item.revision_id = root_item.child_set_revision_id
       and child_item.child_kind = 'atomic'
      join public.order_set_revisions child_revision
        on child_revision.workspace_id = child_item.workspace_id
       and child_revision.order_set_id = child_item.order_set_id
       and child_revision.id = child_item.revision_id
      where root_item.workspace_id = p_workspace_id
        and root_item.order_set_id = p_set_id
        and root_item.revision_id = p_revision_id
        and root_item.child_kind = 'order_set'
    ) leaves
    join public.order_catalog_items c
      on c.workspace_id = p_workspace_id
     and c.id = leaves.catalog_item_id
    order by root_sort_order, leaf_sort_order, leaves.catalog_item_id, leaf_revision_item_id
  loop
    v_item_count := v_item_count + 1;
    -- Flatten every active leaf so defaults and provenance are complete.  The
    -- transactional cap is enforced on the selected parent plus children
    -- below, before any draft/confirm write; an unselected leaf is not a row.
    if v_leaf.availability_status <> 'active' then
      raise exception 'order_set_member_unavailable';
    end if;
    if v_leaf.catalog_revision is distinct from v_leaf.pinned_catalog_revision then
      raise exception 'catalog_revision_requires_refresh';
    end if;
    v_default_selected := v_leaf.root_default_selected
      and v_leaf.leaf_default_selected;
    v_default_quantity := case
      when v_leaf.nested_revision_item_id is null
        then v_leaf.root_default_quantity
      else v_leaf.root_default_quantity * v_leaf.leaf_default_quantity
    end;
    v_has_explicit := false;
    v_explicit_selected := null;
    v_explicit_quantity := null;
    select
      (entry.value ->> 'selected')::boolean,
      (entry.value ->> 'quantity')::numeric
    into v_explicit_selected, v_explicit_quantity
    from jsonb_array_elements(v_selection_items) entry(value)
    where private.clair_b3_safe_uuid(entry.value ->> 'revisionItemId')
      = v_leaf.leaf_revision_item_id;
    if found then
      v_has_explicit := true;
    end if;
    v_selected := coalesce(v_explicit_selected, v_default_selected);
    v_quantity := coalesce(v_explicit_quantity, v_default_quantity);
    if v_quantity <= 0 or v_quantity > 999999999.999 then
      raise exception 'order_set_quantity_invalid';
    end if;
    if v_has_explicit
       and (case when v_leaf.nested_revision_item_id is null
           then v_leaf.root_quantity_source else v_leaf.leaf_quantity_source end) = 'fixed_one'
       and v_explicit_quantity is distinct from v_default_quantity then
      raise exception 'order_set_quantity_invalid';
    end if;
    v_quantity := pg_catalog.trim_scale(v_quantity::numeric(12,3));
    v_quantity_source := case
      when v_has_explicit
       and (case when v_leaf.nested_revision_item_id is null
           then v_leaf.root_quantity_source else v_leaf.leaf_quantity_source end) <> 'fixed_one'
        then 'manual_at_apply'
      when v_leaf.nested_revision_item_id is not null then v_leaf.leaf_quantity_source
      else v_leaf.root_quantity_source
    end;
    v_rounding_rule := v_leaf.rounding_rule;
    if v_rounding_rule not in ('as_is', 'ceil', 'floor', 'round') then
      raise exception 'a3_rounding_authority_unavailable';
    end if;
    v_rounding_result := case when v_leaf.price_krw is null then null
      else private.clair_round_catalog_order_amount(
        v_leaf.price_krw * v_quantity,
        v_rounding_rule
      ) end;
    v_billing := case
      when v_leaf.nested_revision_item_id is null then v_leaf.root_billing_reflection
      else v_leaf.leaf_billing_reflection
    end;
    v_tax_type := case
      when v_leaf.tax_included then 'taxable'
      else 'non_taxable'
    end;
    if v_billing and v_leaf.price_krw is null then
      raise exception 'order_set_price_unset';
    end if;
    if v_selected then
      v_selected_count := v_selected_count + 1;
      if v_selected_count > 99 then
        raise exception 'order_set_too_many_rows';
      end if;
      v_child_subtotal := v_child_subtotal
        + coalesce(v_rounding_result, 0)
        * case when v_billing then 1 else 0 end;
      if v_revision.amount_basis in ('set_fixed_price', 'range_price')
         and v_billing then
        v_explicit_extra_subtotal := v_explicit_extra_subtotal
          + coalesce(v_rounding_result, 0);
      end if;
    end if;
    v_applied_snapshot := jsonb_build_object(
      'schemaVersion', 1,
      'rowType', 'set_child',
      'orderId', null,
      'parentOrderId', null,
      'sourceSetId', p_set_id,
      'sourceSetRevisionId', p_revision_id,
      'sourceSetRevisionNo', v_revision.revision_no,
      'sourceSetVersion', 'order-set-revision-' || v_revision.revision_no::text,
      'sourceSetRevisionItemId', v_leaf.leaf_revision_item_id,
      'childSetId', v_leaf.child_set_id,
      'childSetRevisionId', case when v_leaf.nested_revision_item_id is null
        then null else (v_leaf.leaf_path -> 1 ->> 'revisionId')::uuid end,
      'childSetRevisionNo', v_leaf.child_set_revision_no,
      'rootRevisionItemId', v_leaf.root_revision_item_id,
      'directRevisionItemId', v_leaf.direct_revision_item_id,
      'nestedRevisionItemId', v_leaf.nested_revision_item_id,
      'leafRevisionItemId', v_leaf.leaf_revision_item_id,
      'path', v_leaf.leaf_path,
      'workspaceCatalogItemId', v_leaf.id,
      'pinnedCompositionCatalogRevision', v_leaf.pinned_catalog_revision,
      'appliedCatalogRevision', v_leaf.catalog_revision,
      'sourceMasterRecordId', v_leaf.source_master_record_id,
      'sourceMasterRevision', v_leaf.source_master_revision,
      'sourcePresetId', v_leaf.standard_order_id,
      'sourcePresetVersion', v_leaf.source_preset_version,
      'sourceOrderId', v_leaf.standard_order_id,
      'sourceOrderVersion', v_leaf.source_preset_version
    ) || jsonb_build_object(
      'standardOrderName', v_leaf.standard_order_name,
      'displayName', v_leaf.in_hospital_order_name,
      'billingName', v_leaf.billing_name,
      'categoryGroup', v_leaf.category_group,
      'billingCategory', private.clair_map_catalog_category_to_billing_category(v_leaf.category_group),
      'orderType', case v_leaf.category_group
        when 'lab' then 'lab'
        when 'imaging' then 'imaging'
        when 'medication' then 'dispensing'
        else 'treatment'
      end,
      'destinationModule', v_leaf.default_destination_module,
      'taskRequired', v_leaf.default_task_required,
      'targetSpecies', to_jsonb(v_leaf.target_species),
      'careGuide', v_leaf.care_guide,
      'internalInstruction', v_leaf.internal_instruction,
      'typeSpecificRuntimeContext', v_leaf.medication_metadata,
      'salesUnit', v_leaf.sales_unit,
      'defaultQuantity', v_default_quantity,
      'defaultQuantitySource', case when v_leaf.nested_revision_item_id is null
        then v_leaf.root_quantity_source else v_leaf.leaf_quantity_source end,
      'quantity', v_quantity,
      'quantitySource', v_quantity_source,
      'defaultSelected', v_default_selected,
      'selected', v_selected,
      'billingReflectionEnabled', v_billing,
      'items', null,
      'priceKrw', v_leaf.price_krw,
      'taxType', v_tax_type,
      'taxIncluded', v_leaf.tax_included,
      'roundingRule', v_rounding_rule,
      'roundingResultKrw', v_rounding_result
    );
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'itemIndex', v_item_count,
      'revisionItemId', v_leaf.leaf_revision_item_id,
      'itemKind', 'atomic',
      'path', v_leaf.leaf_path,
      'rootRevisionItemId', v_leaf.root_revision_item_id,
      'directRevisionItemId', v_leaf.direct_revision_item_id,
      'nestedRevisionItemId', v_leaf.nested_revision_item_id,
      'leafRevisionItemId', v_leaf.leaf_revision_item_id,
      'workspaceCatalogItemId', v_leaf.id,
      'pinnedCompositionCatalogRevision', v_leaf.pinned_catalog_revision,
      'appliedCatalogRevision', v_leaf.catalog_revision,
      'defaultSelected', v_default_selected,
      'defaultQuantitySource', case when v_leaf.nested_revision_item_id is null
        then v_leaf.root_quantity_source else v_leaf.leaf_quantity_source end,
      'selected', v_selected,
      'standardOrderName', v_leaf.standard_order_name,
      'displayName', v_leaf.in_hospital_order_name,
      'billingName', v_leaf.billing_name,
      'categoryGroup', v_leaf.category_group,
      'billingCategory', private.clair_map_catalog_category_to_billing_category(v_leaf.category_group),
      'orderType', case v_leaf.category_group
        when 'lab' then 'lab'
        when 'imaging' then 'imaging'
        when 'medication' then 'dispensing'
        else 'treatment'
      end,
      'destinationModule', v_leaf.default_destination_module,
      'taskRequired', v_leaf.default_task_required,
      'targetSpecies', to_jsonb(v_leaf.target_species),
      'salesUnit', v_leaf.sales_unit,
      'careGuide', v_leaf.care_guide,
      'internalInstruction', v_leaf.internal_instruction,
      'typeSpecificRuntimeContext', v_leaf.medication_metadata,
      'sourcePresetId', v_leaf.standard_order_id,
      'sourcePresetVersion', v_leaf.source_preset_version,
      'defaultQuantity', v_default_quantity,
      'quantity', v_quantity,
      'quantitySource', v_quantity_source,
      'billingReflectionEnabled', v_billing,
      'priceKrw', v_leaf.price_krw,
      'taxType', v_tax_type,
      'taxIncluded', v_leaf.tax_included,
      'roundingRule', v_rounding_rule,
      'roundingResultKrw', v_rounding_result,
      'appliedSnapshot', v_applied_snapshot
    ));
  end loop;

  if v_item_count = 0 or v_selected_count = 0 then
    raise exception 'order_set_empty_selection';
  end if;
  v_set_price := case
    when v_revision.amount_basis = 'set_fixed_price' then v_revision.set_price_krw
    when v_revision.amount_basis = 'range_price' then (
      select price_krw
      from public.order_set_revision_price_ranges
      where workspace_id = p_workspace_id
        and order_set_id = p_set_id
        and revision_id = p_revision_id
        and id = v_range_id
    )
    else null
  end;
  v_child_subtotal := pg_catalog.trim_scale(v_child_subtotal);
  v_explicit_extra_subtotal := pg_catalog.trim_scale(v_explicit_extra_subtotal);
  v_final_total := coalesce(v_set_price, 0) + v_child_subtotal;
  -- Child results have already passed the A3 catalog calculator.  Do not
  -- choose a first child rule or round the aggregate a second time.
  v_set_rounding_result := v_final_total;
  v_calculation_inputs := jsonb_build_object(
    'schemaVersion', 1,
    'selectionFingerprint', v_fingerprint,
    'selectedSetInput', case when v_revision.amount_basis = 'range_price'
      then v_range_input else null end,
    'rangeBasis', v_revision.range_basis,
    'rangeInput', v_range_input,
    'rangeId', v_range_id,
    'quantity', 1,
    'roundingRule', v_set_rounding_rule,
    'storageScale', 2
  );
  v_calculation_outputs := jsonb_build_object(
    'schemaVersion', 1,
    'childSubtotalKrw', v_child_subtotal,
    'explicitExtraSubtotalKrw', v_explicit_extra_subtotal,
    'taxAmountKrw', 0,
    'finalTotalKrw', v_final_total,
    'lineTotalKrw', coalesce(v_set_price, 0),
    'taxType', case when v_revision.amount_basis = 'included_order_sum'
      then 'derived' else v_revision.tax_type end,
    'roundingRule', v_set_rounding_rule,
    'roundingResultKrw', v_set_rounding_result
  );
  return jsonb_build_object(
    'schemaVersion', 1,
    'operation', p_operation,
    'set', jsonb_build_object(
      'sourceSetId', p_set_id,
      'sourceSetRevisionId', p_revision_id,
      'sourceSetRevisionNo', v_revision.revision_no,
      'sourceSetVersion', 'order-set-revision-' || v_revision.revision_no::text,
      'amountBasis', v_revision.amount_basis,
      'setPriceKrw', v_set_price,
      'rangeBasis', v_revision.range_basis,
      'rangeInput', v_range_input,
      'rangeId', v_range_id,
      'taxType', case when v_revision.amount_basis = 'included_order_sum'
        then 'derived' else v_revision.tax_type end,
      'billingReflectionEnabled', v_revision.billing_reflection_enabled,
      'displayName', v_revision.set_name,
      'billingName', v_revision.billing_name,
      'targetSpecies', to_jsonb(v_revision.target_species),
      'salesUnit', v_revision.sales_unit,
      'careGuide', v_revision.care_guide,
      'internalInstruction', v_revision.internal_instruction
    ),
    'items', v_items,
    'pricing', jsonb_build_object(
      'selectedSetInput', case when v_revision.amount_basis = 'range_price'
        then v_range_input else null end,
      'selectedRangeId', v_range_id,
      'rangeInput', v_range_input,
      'childSubtotalKrw', v_child_subtotal,
      'explicitExtraSubtotalKrw', v_explicit_extra_subtotal,
      'finalTotalKrw', v_final_total
    ),
    'selectionFingerprint', v_fingerprint,
    'calculationInputs', v_calculation_inputs,
    'calculationOutputs', v_calculation_outputs
  );
end;
$$;

revoke all on function private.clair_b3_expand_chart_order_set(
  text, uuid, text, uuid, jsonb, text, uuid
) from public, anon, authenticated, service_role;

create or replace function public.clair_preview_chart_order_set(
  workspace_id text,
  encounter_id uuid,
  set_id text,
  revision_id uuid,
  selection_intent jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp, pg_catalog
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;
  if not private.clair_is_active_workspace_member(workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;
  if not private.clair_current_user_has_workspace_permission(workspace_id, 'chart:update') then
    raise exception 'permission_missing';
  end if;
  return private.clair_b3_expand_chart_order_set(
    workspace_id,
    encounter_id,
    set_id,
    revision_id,
    selection_intent,
    'preview',
    null
  );
end;
$$;

revoke all on function public.clair_preview_chart_order_set(text,uuid,text,uuid,jsonb)
  from public, anon, service_role;
grant execute on function public.clair_preview_chart_order_set(text,uuid,text,uuid,jsonb)
  to authenticated;

create or replace function private.clair_b3_runtime_row_json(p_order public.orders)
returns jsonb
language sql
stable
security invoker
set search_path = public, private, pg_catalog
as $$
  select jsonb_build_object(
    'orderId', p_order.id,
    'workspaceId', p_order.workspace_id,
    'encounterId', p_order.encounter_id,
    'rowType', p_order.row_type,
    'orderType', p_order.order_type,
    'parentOrderId', p_order.parent_chart_order_line_id,
    'sourceSetId', p_order.source_set_id,
    'sourceSetRevisionId', p_order.source_set_revision_id,
    'sourceSetRevisionNo', p_order.source_set_revision_no,
    'sourceSetVersion', p_order.source_set_version,
    'sourceSetRevisionItemId', p_order.source_set_revision_item_id,
    'workspaceCatalogItemId', p_order.workspace_catalog_item_id,
    'workspaceCatalogRevision', p_order.workspace_catalog_revision,
    'quantity', p_order.quantity,
    'quantitySource', p_order.quantity_source,
    'unitPriceSnapshot', p_order.unit_price_snapshot,
    'lineTotalSnapshot', case
      when p_order.row_type = 'set'
           and p_order.applied_price_snapshot ->> 'billedAs' = 'nonbillable_parent'
        then null
      else p_order.line_total_snapshot
    end,
    'billingReflectionEnabled', p_order.billing_reflection_enabled,
    'snapshotSchemaVersion', p_order.applied_snapshot_schema_version,
    'snapshotHash', p_order.applied_snapshot_sha256,
    'appliedSnapshot', p_order.applied_snapshot,
    'appliedPriceSnapshot', p_order.applied_price_snapshot,
    'calculationInputs', p_order.calculation_inputs,
    'calculationOutputs', p_order.calculation_outputs,
    'orderConfirmationStatus', p_order.order_confirmation_status,
    'status', p_order.status,
    'updatedAt', p_order.updated_at
  );
$$;

revoke all on function private.clair_b3_runtime_row_json(public.orders)
  from public, anon, authenticated, service_role;

create or replace function private.clair_b3_order_draft_etag(
  p_workspace_id text,
  p_encounter_id uuid
)
returns text
language sql
stable
security invoker
set search_path = public, private, extensions, pg_catalog
as $$
  select '"' || private.clair_b3_sha256(
    coalesce(
      jsonb_agg(
        private.clair_b3_runtime_row_json(o)
        order by o.sort_order, o.created_at, o.id
      ),
      '[]'::jsonb
    )
  ) || '"'
  from public.orders o
  where o.workspace_id = p_workspace_id
    and o.encounter_id = p_encounter_id
    and o.status <> 'cancelled'
    and o.order_confirmation_status in ('draft', 'pending');
$$;

revoke all on function private.clair_b3_order_draft_etag(text,uuid)
  from public, anon, authenticated, service_role;

create or replace function public.clair_get_chart_order_draft(
  p_workspace_id text,
  p_encounter_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp, pg_catalog
as $$
declare
  v_rows jsonb;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;
  if not exists (
    select 1 from public.encounters e
    where e.workspace_id = p_workspace_id
      and e.id = p_encounter_id
      and e.status <> 'cancelled'
  ) then
    raise exception 'encounter_unavailable';
  end if;
  select coalesce(
    jsonb_agg(private.clair_b3_runtime_row_json(o)
      order by o.sort_order, o.created_at, o.id),
    '[]'::jsonb
  )
  into v_rows
  from public.orders o
  where o.workspace_id = p_workspace_id
    and o.encounter_id = p_encounter_id
    and o.status <> 'cancelled'
    and o.order_confirmation_status in ('draft', 'pending');
  return jsonb_build_object(
    'etag', private.clair_b3_order_draft_etag(p_workspace_id, p_encounter_id),
    'rows', v_rows
  );
end;
$$;

revoke all on function public.clair_get_chart_order_draft(text,uuid)
  from public, anon, service_role;
grant execute on function public.clair_get_chart_order_draft(text,uuid)
  to authenticated;

create or replace function public.clair_save_chart_order_draft(
  p_workspace_id text,
  p_actor_user_id text,
  p_encounter_id uuid,
  p_orders jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, master, extensions, pg_temp, pg_catalog
as $$
declare
  v_actor uuid := private.clair_b3_safe_uuid(p_actor_user_id);
  v_expected_etag text := p_orders ->> 'expectedEtag';
  v_rows jsonb := p_orders -> 'rows';
  v_row jsonb;
  v_preview jsonb;
  v_item jsonb;
  v_parent_id uuid;
  v_child_id uuid;
  v_snapshot jsonb;
  v_price_snapshot jsonb;
  v_calc_inputs jsonb;
  v_calc_outputs jsonb;
  v_parent_snapshot jsonb;
  v_parent_price_snapshot jsonb;
  v_parent_calc_inputs jsonb;
  v_parent_calc_outputs jsonb;
  v_parent_hash text;
  v_child_hash text;
  v_current_etag text;
  v_now timestamptz := now();
  v_catalog_snapshot jsonb;
  v_order_type text;
  v_child_sort integer := 0;
  v_set_root_count integer := 0;
  v_set_child_count integer := 0;
begin
  if auth.uid() is null or v_actor is null or v_actor is distinct from auth.uid() then
    raise exception 'workspace_membership_missing';
  end if;
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;
  if not private.clair_current_user_has_workspace_permission(p_workspace_id, 'chart:update') then
    raise exception 'permission_missing';
  end if;
  if jsonb_typeof(coalesce(p_orders, '{}'::jsonb)) is distinct from 'object'
     or (select count(*) from jsonb_object_keys(p_orders))
        <> 2
     or not (p_orders ? 'expectedEtag')
     or not (p_orders ? 'rows')
     or jsonb_typeof(v_rows) is distinct from 'array'
     or jsonb_array_length(v_rows) > 100 then
    raise exception 'invalid_order_rows';
  end if;
  if v_expected_etag is null or v_expected_etag !~ '^"[0-9a-f]{64}"$' then
    raise exception 'if_match_required';
  end if;
  perform pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'clinical_master_workspace_adoption:' || p_workspace_id,
      0
    )
  );
  if not exists (
    select 1 from public.encounters e
    where e.workspace_id = p_workspace_id
      and e.id = p_encounter_id
      and e.status <> 'cancelled'
    for update
  ) then
    raise exception 'encounter_unavailable';
  end if;
  v_current_etag := private.clair_b3_order_draft_etag(p_workspace_id, p_encounter_id);
  if v_expected_etag is distinct from v_current_etag then
    raise exception 'revision_conflict';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(v_rows) entry(value)
    where jsonb_typeof(entry.value) is distinct from 'object'
      or not (entry.value ? 'rowType')
      or (
        entry.value ->> 'rowType' = 'individual'
        and (
          (select count(*) from jsonb_object_keys(entry.value)) <> 4
          or not (entry.value ? 'orderId')
          or not (entry.value ? 'workspaceCatalogItemId')
          or not (entry.value ? 'quantity')
          or private.clair_b3_safe_uuid(entry.value ->> 'orderId') is null
          or jsonb_typeof(entry.value -> 'workspaceCatalogItemId') is distinct from 'string'
          or nullif(btrim(entry.value ->> 'workspaceCatalogItemId'), '') is null
          or jsonb_typeof(entry.value -> 'quantity') is distinct from 'number'
          or (entry.value ->> 'quantity')::numeric <= 0
          or (entry.value ->> 'quantity')::numeric > 999999999.999
          or (entry.value ->> 'quantity')::numeric <> round((entry.value ->> 'quantity')::numeric, 3)
        )
      )
      or (
        entry.value ->> 'rowType' = 'set'
        and (
          (select count(*) from jsonb_object_keys(entry.value)) <> 6
          or private.clair_b3_safe_uuid(entry.value ->> 'orderId') is null
          or jsonb_typeof(entry.value -> 'sourceSetId') is distinct from 'string'
          or nullif(btrim(entry.value ->> 'sourceSetId'), '') is null
          or private.clair_b3_safe_uuid(entry.value ->> 'sourceSetRevisionId') is null
          or jsonb_typeof(entry.value -> 'sourceSetRevisionNo') is distinct from 'number'
          or (entry.value ->> 'sourceSetRevisionNo') !~ '^[0-9]+$'
          or (entry.value ->> 'sourceSetRevisionNo')::numeric > 2147483647
          or (entry.value ->> 'sourceSetRevisionNo')::integer <= 0
          or jsonb_typeof(entry.value -> 'selectionIntent') is distinct from 'object'
        )
      )
      or entry.value ->> 'rowType' not in ('individual', 'set')
  ) then
    raise exception 'invalid_order_rows';
  end if;
  if (select count(*) from jsonb_array_elements(v_rows)) <> (
       select count(distinct private.clair_b3_safe_uuid(entry.value ->> 'orderId'))
       from jsonb_array_elements(v_rows) entry(value)
     ) then
    raise exception 'invalid_order_rows';
  end if;

  -- Expand every set in a read-only pass before the first individual or set
  -- write.  The cap is one transaction-wide parent-plus-selected-leaf count,
  -- not one cap per set root; any failure therefore leaves no partial draft.
  for v_row in
    select value
    from jsonb_array_elements(v_rows) entries(value)
    where value ->> 'rowType' = 'set'
  loop
    v_set_root_count := v_set_root_count + 1;
    v_preview := private.clair_b3_expand_chart_order_set(
      p_workspace_id,
      p_encounter_id,
      v_row ->> 'sourceSetId',
      private.clair_b3_safe_uuid(v_row ->> 'sourceSetRevisionId'),
      v_row -> 'selectionIntent',
      'preview',
      null
    );
    if (v_preview -> 'set' ->> 'sourceSetRevisionNo')::integer
        is distinct from (v_row ->> 'sourceSetRevisionNo')::integer then
      raise exception 'revision_conflict';
    end if;
    v_set_child_count := v_set_child_count + (
      select count(*)
      from jsonb_array_elements(v_preview -> 'items') entries(value)
      where (entries.value ->> 'selected')::boolean
    );
  end loop;
  if v_set_root_count + v_set_child_count > 100 then
    raise exception 'order_set_too_many_rows';
  end if;

  for v_row in select value from jsonb_array_elements(v_rows) entries(value) loop
    v_parent_id := private.clair_b3_safe_uuid(v_row ->> 'orderId');
    if exists (
      select 1 from public.orders existing
      where existing.id = v_parent_id
        and (
          existing.workspace_id is distinct from p_workspace_id
          or existing.encounter_id is distinct from p_encounter_id
        )
    ) then
      raise exception 'order_unavailable';
    end if;
    if exists (
      select 1 from public.orders existing
      where existing.id = v_parent_id
        and existing.order_confirmation_status not in ('draft', 'pending')
    ) then
      raise exception 'revision_conflict';
    end if;
    if v_row ->> 'rowType' = 'individual' then
      if exists (
        select 1 from public.orders existing
        where existing.id = v_parent_id and existing.row_type <> 'individual'
      ) then
        raise exception 'order_unavailable';
      end if;
      if exists (
        select 1 from public.orders existing
        where existing.workspace_id = p_workspace_id
          and existing.id = v_parent_id
          and existing.service_item_id is not null
      ) then
        raise exception 'legacy_order_origin_immutable';
      end if;
      v_catalog_snapshot := private.clair_build_catalog_order_snapshot(
        p_workspace_id,
        v_row ->> 'workspaceCatalogItemId',
        (v_row ->> 'quantity')::numeric
      );
      v_order_type := v_catalog_snapshot ->> 'orderType';
      insert into public.orders (
        id, workspace_id, encounter_id, order_type, display_name,
        billing_display_name, status, work_status, priority, quantity,
        unit_price_snapshot, requested_by_user_id, requested_at, instruction,
        task_status,
        sort_order, row_type, source_order_id, source_order_version,
        applied_snapshot, applied_price_snapshot, calculation_inputs,
        calculation_outputs, quantity_source, price_rule_source,
        billing_reflection_enabled, order_confirmation_status,
        billing_candidate_status, workspace_catalog_item_id,
        source_master_record_id, source_master_revision,
        workspace_catalog_revision, applied_snapshot_schema_version,
        applied_snapshot_sha256, updated_at
      )
      values (
        v_parent_id, p_workspace_id, p_encounter_id, v_order_type,
        v_catalog_snapshot ->> 'inHospitalOrderName',
        v_catalog_snapshot ->> 'billingName', 'draft', 'pending', 'normal',
        (v_row ->> 'quantity')::numeric,
        nullif(v_catalog_snapshot ->> 'priceKrw', '')::numeric,
        v_actor, v_now, v_catalog_snapshot ->> 'internalInstruction',
        case when (v_catalog_snapshot ->> 'taskRequired')::boolean
          then 'pending' else null end,
        (select coalesce(max(sort_order), 0) + 10
          from public.orders where workspace_id = p_workspace_id and encounter_id = p_encounter_id),
        'individual', v_catalog_snapshot ->> 'sourcePresetId',
        v_catalog_snapshot ->> 'sourcePresetVersion',
        v_catalog_snapshot, jsonb_build_object(
          'priceKrw', v_catalog_snapshot -> 'priceKrw',
          'quantity', v_row -> 'quantity',
          'lineTotalSnapshot', v_catalog_snapshot -> 'lineTotalSnapshot',
          'roundingRule', v_catalog_snapshot ->> 'roundingRule',
          'roundingResultKrw', v_catalog_snapshot -> 'roundingResultKrw',
          'taxIncluded', v_catalog_snapshot -> 'taxIncluded',
          'taxType', v_catalog_snapshot ->> 'taxType',
          'workspaceCatalogItemId', v_catalog_snapshot -> 'workspaceCatalogItemId',
          'workspaceCatalogRevision', v_catalog_snapshot -> 'workspaceCatalogRevision',
          'source', 'order_catalog_items'
        ),
        jsonb_build_object(
          'quantitySource', 'manual',
          'roundingRule', v_catalog_snapshot ->> 'roundingRule',
          'storageScale', 2,
          'source', 'order_catalog_items'
        ),
        jsonb_build_object(
          'lineTotalSnapshot', v_catalog_snapshot -> 'lineTotalSnapshot',
          'priceKrw', v_catalog_snapshot -> 'priceKrw',
          'roundingRule', v_catalog_snapshot ->> 'roundingRule',
          'roundingResultKrw', v_catalog_snapshot -> 'roundingResultKrw',
          'taxType', v_catalog_snapshot ->> 'taxType'
        ),
        'manual', 'preset_price',
        (v_catalog_snapshot ->> 'billingReflectionEnabled')::boolean,
        'draft', 'not_requested',
        v_catalog_snapshot ->> 'workspaceCatalogItemId',
        nullif(v_catalog_snapshot ->> 'sourceMasterRecordId', '')::uuid,
        nullif(v_catalog_snapshot ->> 'sourceMasterRevision', '')::integer,
        nullif(v_catalog_snapshot ->> 'workspaceCatalogRevision', '')::integer,
        0, null, v_now
      )
      on conflict (id) do update set
        order_type = excluded.order_type,
        display_name = excluded.display_name,
        billing_display_name = excluded.billing_display_name,
        quantity = excluded.quantity,
        unit_price_snapshot = excluded.unit_price_snapshot,
        source_order_id = excluded.source_order_id,
        source_order_version = excluded.source_order_version,
        workspace_catalog_item_id = excluded.workspace_catalog_item_id,
        source_master_record_id = excluded.source_master_record_id,
        source_master_revision = excluded.source_master_revision,
        workspace_catalog_revision = excluded.workspace_catalog_revision,
        instruction = excluded.instruction,
        applied_snapshot = excluded.applied_snapshot,
        applied_price_snapshot = excluded.applied_price_snapshot,
        calculation_inputs = excluded.calculation_inputs,
        calculation_outputs = excluded.calculation_outputs,
        quantity_source = excluded.quantity_source,
        price_rule_source = excluded.price_rule_source,
        billing_reflection_enabled = excluded.billing_reflection_enabled,
        task_status = excluded.task_status,
        updated_at = excluded.updated_at;
    else
      if exists (
        select 1 from public.orders existing
        where existing.id = v_parent_id and existing.row_type <> 'set'
      ) then
        raise exception 'order_unavailable';
      end if;
      if exists (
        select 1
        from public.orders existing
        where existing.id = v_parent_id
          and existing.row_type = 'set'
          and (
            existing.source_set_id is distinct from v_row ->> 'sourceSetId'
            or existing.source_set_revision_id is distinct from
              private.clair_b3_safe_uuid(v_row ->> 'sourceSetRevisionId')
          )
      ) then
        raise exception 'revision_conflict';
      end if;
      v_preview := private.clair_b3_expand_chart_order_set(
        p_workspace_id,
        p_encounter_id,
        v_row ->> 'sourceSetId',
        private.clair_b3_safe_uuid(v_row ->> 'sourceSetRevisionId'),
        v_row -> 'selectionIntent',
        'draft',
        v_parent_id
      );
      if (v_preview -> 'set' ->> 'sourceSetRevisionNo')::integer
          is distinct from (v_row ->> 'sourceSetRevisionNo')::integer then
        raise exception 'revision_conflict';
      end if;
      v_parent_snapshot := jsonb_build_object(
        'schemaVersion', 1,
        'rowType', 'set',
        'orderId', v_parent_id,
        'parentOrderId', null,
        'sourceSetId', v_preview -> 'set' -> 'sourceSetId',
        'sourceSetRevisionId', v_preview -> 'set' -> 'sourceSetRevisionId',
        'sourceSetRevisionNo', v_preview -> 'set' -> 'sourceSetRevisionNo',
        'sourceSetVersion', v_preview -> 'set' -> 'sourceSetVersion',
        'sourceSetRevisionItemId', null,
        'childSetId', null,
        'childSetRevisionId', null,
        'childSetRevisionNo', null,
        'sourcePresetId', null,
        'sourcePresetVersion', null,
        'workspaceCatalogItemId', null,
        'workspaceCatalogRevision', null,
        'sourceMasterRecordId', null,
        'sourceMasterRevision', null,
        'path', '[]'::jsonb,
        'standardOrderName', v_preview -> 'set' ->> 'displayName',
        'displayName', v_preview -> 'set' ->> 'displayName',
        'billingName', v_preview -> 'set' ->> 'billingName',
        'categoryGroup', 'set',
        'billingCategory', 'other',
        'orderType', 'set',
        'destinationModule', null,
        'taskRequired', false,
        'targetSpecies', v_preview -> 'set' -> 'targetSpecies',
        'salesUnit', v_preview -> 'set' -> 'salesUnit',
        'careGuide', v_preview -> 'set' -> 'careGuide',
        'internalInstruction', v_preview -> 'set' -> 'internalInstruction',
        'typeSpecificRuntimeContext', null,
        'sourceOrderId', null,
        'sourceOrderVersion', null,
        'billingReflectionEnabled', (v_preview -> 'set' ->> 'billingReflectionEnabled')::boolean,
        'taxIncluded', case v_preview -> 'set' ->> 'taxType'
          when 'taxable' then true
          when 'non_taxable' then false
          else null end,
        'quantitySource', 'fixed_one',
        'defaultQuantity', 1,
        'quantity', 1,
        'selected', true,
        'roundingRule', v_preview -> 'calculationInputs' ->> 'roundingRule',
        'items', v_preview -> 'items'
      );
      v_parent_price_snapshot := jsonb_build_object(
        'schemaVersion', 1,
        'amountBasis', v_preview -> 'set' ->> 'amountBasis',
        'setPriceKrw', v_preview -> 'set' -> 'setPriceKrw',
        'priceKrw', v_preview -> 'set' -> 'setPriceKrw',
        'taxType', v_preview -> 'set' ->> 'taxType',
        'taxIncluded', case v_preview -> 'set' ->> 'taxType'
          when 'taxable' then true
          when 'non_taxable' then false
          else null end,
        'billedAs', case when (v_preview -> 'set' ->> 'amountBasis') = 'included_order_sum'
          then 'nonbillable_parent' else 'set_parent' end,
        'billingReflectionEnabled', (v_preview -> 'set' ->> 'billingReflectionEnabled')::boolean,
        'explicitExtra', false,
        'roundingRule', v_preview -> 'calculationOutputs' ->> 'roundingRule',
        'roundingResultKrw', v_preview -> 'calculationOutputs' -> 'roundingResultKrw'
      );
      v_parent_calc_inputs := v_preview -> 'calculationInputs';
      v_parent_calc_outputs := v_preview -> 'calculationOutputs';
      v_parent_hash := private.clair_b3_sha256(jsonb_build_object(
        'appliedSnapshot', v_parent_snapshot,
        'appliedPriceSnapshot', v_parent_price_snapshot,
        'calculationInputs', v_parent_calc_inputs,
        'calculationOutputs', v_parent_calc_outputs
      ));
      insert into public.orders (
        id, workspace_id, encounter_id, order_type, display_name,
        billing_display_name, status, work_status, priority, quantity,
        unit_price_snapshot, requested_by_user_id, requested_at,
        sort_order, row_type, source_set_id, source_set_version,
        source_set_revision_id, source_set_revision_no,
        applied_snapshot, applied_price_snapshot, calculation_inputs,
        calculation_outputs, quantity_source, price_rule_source,
        billing_reflection_enabled, order_confirmation_status,
        billing_candidate_status, applied_snapshot_schema_version,
        applied_snapshot_sha256, updated_at
      )
      values (
        v_parent_id, p_workspace_id, p_encounter_id, 'set',
        v_preview -> 'set' ->> 'displayName',
        v_preview -> 'set' ->> 'billingName', 'draft', 'pending', 'normal', 1,
        nullif(v_preview -> 'set' ->> 'setPriceKrw', '')::numeric,
        v_actor, v_now, (select coalesce(max(sort_order), 0) + 10
          from public.orders where workspace_id = p_workspace_id and encounter_id = p_encounter_id),
        'set', v_preview -> 'set' ->> 'sourceSetId',
        v_preview -> 'set' ->> 'sourceSetVersion',
        (v_preview -> 'set' ->> 'sourceSetRevisionId')::uuid,
        (v_preview -> 'set' ->> 'sourceSetRevisionNo')::integer,
        v_parent_snapshot, v_parent_price_snapshot,
        v_parent_calc_inputs,
        v_parent_calc_outputs, 'fixed_one',
        v_preview -> 'set' ->> 'amountBasis',
        (v_preview -> 'set' ->> 'billingReflectionEnabled')::boolean,
        'draft', 'not_requested', 1, v_parent_hash, v_now
      )
      on conflict (id) do update set
        source_set_id = excluded.source_set_id,
        source_set_version = excluded.source_set_version,
        source_set_revision_id = excluded.source_set_revision_id,
        source_set_revision_no = excluded.source_set_revision_no,
        applied_snapshot = excluded.applied_snapshot,
        applied_price_snapshot = excluded.applied_price_snapshot,
        calculation_inputs = excluded.calculation_inputs,
        calculation_outputs = excluded.calculation_outputs,
        unit_price_snapshot = excluded.unit_price_snapshot,
        billing_reflection_enabled = excluded.billing_reflection_enabled,
        applied_snapshot_sha256 = excluded.applied_snapshot_sha256,
        updated_at = excluded.updated_at;
      v_child_sort := 0;
      for v_item in
        select value from jsonb_array_elements(v_preview -> 'items') entries(value)
      loop
        v_snapshot := v_item -> 'appliedSnapshot';
        v_price_snapshot := jsonb_build_object(
          'schemaVersion', 1,
          'amountBasis', v_preview -> 'set' ->> 'amountBasis',
          'setPriceKrw', v_preview -> 'set' -> 'setPriceKrw',
          'priceKrw', v_item -> 'priceKrw',
          'taxType', v_item ->> 'taxType',
          'taxIncluded', v_item -> 'taxIncluded',
          'billedAs', 'atomic_child',
          'billingReflectionEnabled', (v_item ->> 'billingReflectionEnabled')::boolean,
          'explicitExtra',
            (v_preview -> 'set' ->> 'amountBasis') in ('set_fixed_price', 'range_price')
            and (v_item ->> 'billingReflectionEnabled')::boolean,
          'roundingRule', v_snapshot ->> 'roundingRule',
          'roundingResultKrw', v_snapshot -> 'roundingResultKrw'
        );
        v_calc_inputs := v_preview -> 'calculationInputs' || jsonb_build_object(
          'quantity', v_item -> 'quantity',
          'roundingRule', v_snapshot ->> 'roundingRule'
        );
        v_calc_outputs := jsonb_build_object(
          'schemaVersion', 1,
          'childSubtotalKrw', coalesce((v_snapshot ->> 'roundingResultKrw')::numeric, 0),
          'explicitExtraSubtotalKrw', case
            when (v_preview -> 'set' ->> 'amountBasis') in ('set_fixed_price', 'range_price')
              and (v_item ->> 'billingReflectionEnabled')::boolean
            then coalesce((v_snapshot ->> 'roundingResultKrw')::numeric, 0)
            else 0 end,
          'taxAmountKrw', 0,
          'finalTotalKrw', coalesce((v_snapshot ->> 'roundingResultKrw')::numeric, 0),
          'lineTotalKrw', coalesce((v_snapshot ->> 'roundingResultKrw')::numeric, 0),
          'taxType', v_item ->> 'taxType',
          'roundingRule', v_snapshot ->> 'roundingRule',
          'roundingResultKrw', v_snapshot -> 'roundingResultKrw'
        );
        if (v_item ->> 'selected')::boolean then
          v_child_sort := v_child_sort + 1;
          select o.id into v_child_id
          from public.orders o
          where o.workspace_id = p_workspace_id
            and o.parent_chart_order_line_id = v_parent_id
            and o.source_set_revision_id = (v_preview -> 'set' ->> 'sourceSetRevisionId')::uuid
            and o.source_set_revision_item_id = (v_item ->> 'revisionItemId')::uuid
            and o.row_type = 'set_child'
            and o.status <> 'cancelled'
          for update;
          if not found then v_child_id := gen_random_uuid(); end if;
          v_snapshot := v_snapshot || jsonb_build_object(
            'orderId', v_child_id,
            'parentOrderId', v_parent_id
          );
          insert into public.orders (
            id, workspace_id, encounter_id, parent_chart_order_line_id,
            order_type, display_name, billing_display_name, status,
            work_status, priority, quantity, unit_price_snapshot,
            requested_by_user_id, requested_at, sort_order, row_type,
            source_set_id, source_set_version, source_set_revision_id,
            source_set_revision_no, source_set_revision_item_id, set_item_id,
            row_depth, workspace_catalog_item_id, source_master_record_id,
            source_master_revision, workspace_catalog_revision,
            applied_snapshot, applied_price_snapshot, calculation_inputs,
            calculation_outputs, quantity_source, price_rule_source,
            billing_reflection_enabled, order_confirmation_status,
            billing_candidate_status, applied_snapshot_schema_version,
            applied_snapshot_sha256, updated_at
          )
          values (
            v_child_id, p_workspace_id, p_encounter_id, v_parent_id,
            v_snapshot ->> 'orderType', v_snapshot ->> 'displayName',
            v_snapshot ->> 'billingName', 'draft', 'pending',
            'normal', (v_item ->> 'quantity')::numeric,
            nullif(v_item ->> 'priceKrw', '')::numeric, v_actor, v_now,
            v_child_sort,
            'set_child', v_preview -> 'set' ->> 'sourceSetId',
            v_preview -> 'set' ->> 'sourceSetVersion',
            (v_preview -> 'set' ->> 'sourceSetRevisionId')::uuid,
            (v_preview -> 'set' ->> 'sourceSetRevisionNo')::integer,
            (v_item ->> 'revisionItemId')::uuid,
            (v_item ->> 'revisionItemId'),
            jsonb_array_length(v_item -> 'path'),
            v_item ->> 'workspaceCatalogItemId',
            nullif(v_snapshot ->> 'sourceMasterRecordId', '')::uuid,
            nullif(v_snapshot ->> 'sourceMasterRevision', '')::integer,
            (v_item ->> 'appliedCatalogRevision')::integer,
            v_snapshot, v_price_snapshot, v_calc_inputs, v_calc_outputs,
            v_item ->> 'quantitySource', v_preview -> 'set' ->> 'amountBasis',
            (v_item ->> 'billingReflectionEnabled')::boolean, 'draft',
            'not_requested', 1,
            private.clair_b3_sha256(jsonb_build_object(
              'appliedSnapshot', v_snapshot,
              'appliedPriceSnapshot', v_price_snapshot,
              'calculationInputs', v_calc_inputs,
              'calculationOutputs', v_calc_outputs
            )), v_now
          )
          on conflict (id) do update set
            sort_order = excluded.sort_order,
            order_type = excluded.order_type,
            display_name = excluded.display_name,
            billing_display_name = excluded.billing_display_name,
            quantity = excluded.quantity,
            unit_price_snapshot = excluded.unit_price_snapshot,
            source_master_record_id = excluded.source_master_record_id,
            source_master_revision = excluded.source_master_revision,
            workspace_catalog_revision = excluded.workspace_catalog_revision,
            applied_snapshot = excluded.applied_snapshot,
            applied_price_snapshot = excluded.applied_price_snapshot,
            calculation_inputs = excluded.calculation_inputs,
            calculation_outputs = excluded.calculation_outputs,
            quantity_source = excluded.quantity_source,
            billing_reflection_enabled = excluded.billing_reflection_enabled,
            applied_snapshot_sha256 = excluded.applied_snapshot_sha256,
            updated_at = excluded.updated_at;
        else
          update public.orders
          set status = 'cancelled',
              order_confirmation_status = 'cancelled',
              cancellation_reason = 'set_selection_removed',
              updated_at = v_now
          where workspace_id = p_workspace_id
            and parent_chart_order_line_id = v_parent_id
            and source_set_revision_id = (v_preview -> 'set' ->> 'sourceSetRevisionId')::uuid
            and source_set_revision_item_id = (v_item ->> 'revisionItemId')::uuid
            and row_type = 'set_child'
            and status <> 'cancelled';
        end if;
      end loop;
    end if;
  end loop;
  update public.encounters
  set status = case when status = 'waiting' then 'ordered' else status end,
      started_at = coalesce(started_at, v_now),
      updated_at = v_now
  where workspace_id = p_workspace_id
    and id = p_encounter_id
    and status <> 'cancelled';
  return public.clair_get_chart_order_draft(p_workspace_id, p_encounter_id);
end;
$$;

revoke all on function public.clair_save_chart_order_draft(text,text,uuid,jsonb)
  from public, anon, service_role;
grant execute on function public.clair_save_chart_order_draft(text,text,uuid,jsonb)
  to authenticated;

create or replace function public.clair_get_chart_order_actions(
  p_workspace_id text,
  p_encounter_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp, pg_catalog
as $$
declare
  v_rows jsonb;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;
  if not exists (
    select 1 from public.encounters e
    where e.workspace_id = p_workspace_id
      and e.id = p_encounter_id
      and e.status <> 'cancelled'
  ) then
    raise exception 'encounter_unavailable';
  end if;
  select coalesce(
    jsonb_agg(private.clair_b3_runtime_row_json(o)
      order by o.sort_order, o.created_at, o.id),
    '[]'::jsonb
  )
  into v_rows
  from public.orders o
  where o.workspace_id = p_workspace_id
    and o.encounter_id = p_encounter_id
    and o.status <> 'cancelled';
  return jsonb_build_object(
    'etag', private.clair_b3_order_draft_etag(p_workspace_id, p_encounter_id),
    'rows', v_rows
  );
end;
$$;

revoke all on function public.clair_get_chart_order_actions(text,uuid)
  from public, anon, service_role;
grant execute on function public.clair_get_chart_order_actions(text,uuid)
  to authenticated;

drop function if exists public.clair_save_chart_order_action(text,uuid,uuid,text,uuid[]);

create or replace function public.clair_save_chart_order_action(
  p_workspace_id text,
  p_actor_user_id uuid,
  p_encounter_id uuid,
  p_action text,
  p_order_ids uuid[],
  p_expected_etag text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp, pg_catalog
as $$
declare
  v_now timestamptz := now();
  v_current_etag text;
  v_row public.orders%rowtype;
  v_root public.orders%rowtype;
  v_rows jsonb;
  v_terminal_count integer;
  v_matching_terminal_count integer;
  v_selected_count integer := coalesce(array_length(p_order_ids, 1), 0);
begin
  if auth.uid() is null or p_actor_user_id is distinct from auth.uid() then
    raise exception 'workspace_membership_missing';
  end if;
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;
  if not private.clair_current_user_has_workspace_permission(p_workspace_id, 'chart:update') then
    raise exception 'permission_missing';
  end if;
  if p_action not in ('confirm', 'bill')
     or v_selected_count = 0
     or v_selected_count > 100
     or p_expected_etag is null
     or p_expected_etag !~ '^"[0-9a-f]{64}"$'
     or exists (select 1 from unnest(p_order_ids) ids(id) where id is null)
     or v_selected_count <> (select count(distinct id) from unnest(p_order_ids) ids(id)) then
    raise exception 'invalid_order_action';
  end if;
  perform pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'clinical_master_workspace_adoption:' || p_workspace_id,
      0
    )
  );
  if not exists (
    select 1 from public.encounters e
    where e.workspace_id = p_workspace_id
      and e.id = p_encounter_id
      and e.status <> 'cancelled'
    for update
  ) then
    raise exception 'encounter_unavailable';
  end if;
  -- A confirmed row is a valid first bill transition. Terminal replay is
  -- recognized only when the same operation already has its stored event.
  select count(*) into v_terminal_count
  from public.orders o
  where o.workspace_id = p_workspace_id
    and o.encounter_id = p_encounter_id
    and o.id = any(p_order_ids)
    and o.status <> 'cancelled'
    and o.order_confirmation_status in ('confirmed', 'billed')
    and exists (
      select 1
      from public.order_events event
      where event.workspace_id = o.workspace_id
        and event.order_id = o.id
        and event.payload ->> 'action' = p_action
    );
  if v_terminal_count <> 0 then
    select count(*) into v_matching_terminal_count
    from public.orders o
    where o.workspace_id = p_workspace_id
      and o.encounter_id = p_encounter_id
      and o.id = any(p_order_ids)
      and o.status <> 'cancelled'
      and o.order_confirmation_status in ('confirmed', 'billed')
      and exists (
        select 1
        from public.order_events event
        where event.workspace_id = o.workspace_id
          and event.order_id = o.id
          and event.payload ->> 'action' = p_action
          and coalesce(event.payload ->> 'selectionFingerprint', '')
            is not distinct from coalesce(o.calculation_inputs ->> 'selectionFingerprint', '')
          and coalesce(event.payload ->> 'snapshotHash', '')
            is not distinct from coalesce(o.applied_snapshot_sha256, '')
          and event.payload ->> 'lifecycle'
            = (case when p_action = 'confirm' then 'confirmed' else 'billed' end)
      );
    if v_matching_terminal_count = v_selected_count then
      select coalesce(
        jsonb_agg(private.clair_b3_runtime_row_json(o)
          order by o.sort_order, o.created_at, o.id),
        '[]'::jsonb
      )
      into v_rows
      from public.orders o
      where o.workspace_id = p_workspace_id
        and o.encounter_id = p_encounter_id
        and (
          o.id = any(p_order_ids)
          or o.parent_chart_order_line_id = any(p_order_ids)
        )
        and o.status <> 'cancelled';
      return jsonb_build_object(
        'action', p_action,
        'etag', private.clair_b3_order_draft_etag(p_workspace_id, p_encounter_id),
        'rows', v_rows,
        'stored', true
      );
    end if;
    raise exception 'idempotency_conflict';
  end if;
  v_current_etag := private.clair_b3_order_draft_etag(p_workspace_id, p_encounter_id);
  if p_expected_etag is distinct from v_current_etag then
    raise exception 'revision_conflict';
  end if;
  if exists (
    select 1
    from public.orders o
    where o.workspace_id = p_workspace_id
      and o.encounter_id = p_encounter_id
      and o.id = any(p_order_ids)
      and (
        o.row_type = 'set_child'
        or (
          o.row_type = 'set'
          and exists (
            select 1
            from public.orders child
            where child.workspace_id = o.workspace_id
              and child.parent_chart_order_line_id = o.id
              and child.id = any(p_order_ids)
          )
        )
      )
  ) then
    raise exception 'invalid_order_selection';
  end if;
  if (
    select count(*)
    from public.orders o
    where o.workspace_id = p_workspace_id
      and o.encounter_id = p_encounter_id
      and o.id = any(p_order_ids)
      and o.status <> 'cancelled'
  ) <> v_selected_count then
    raise exception 'order_unavailable';
  end if;

  for v_root in
    select o.*
    from public.orders o
    where o.workspace_id = p_workspace_id
      and o.encounter_id = p_encounter_id
      and o.id = any(p_order_ids)
      and o.status <> 'cancelled'
    order by o.id
    for update
  loop
    if v_root.row_type = 'set' then
      if p_action = 'confirm' and not exists (
        select 1
        from public.order_sets s
        join public.order_set_revisions r
          on r.workspace_id = s.workspace_id
         and r.order_set_id = s.id
         and r.id = v_root.source_set_revision_id
         and r.revision_no = v_root.source_set_revision_no
        where s.workspace_id = v_root.workspace_id
          and s.id = v_root.source_set_id
          and s.availability_status = 'active'
          and s.needs_composition_review = false
          and r.validation_status = 'valid'
          and r.validation_errors = '[]'::jsonb
      ) then
        raise exception 'order_set_member_unavailable';
      end if;
      if p_action = 'confirm' and exists (
        select 1
        from public.orders child
        left join public.order_sets child_set
          on child_set.workspace_id = child.workspace_id
         and child_set.id = child.applied_snapshot ->> 'childSetId'
        left join public.order_set_revisions child_revision
          on child_revision.workspace_id = child.workspace_id
         and child_revision.order_set_id = child.applied_snapshot ->> 'childSetId'
         and child_revision.id = private.clair_b3_safe_uuid(
           child.applied_snapshot ->> 'childSetRevisionId'
         )
        where child.workspace_id = v_root.workspace_id
          and child.parent_chart_order_line_id = v_root.id
          and child.row_type = 'set_child'
          and child.status <> 'cancelled'
          and child.applied_snapshot ->> 'childSetId' is not null
          and (
            child_set.id is null
            or child_set.availability_status <> 'active'
            or child_set.needs_composition_review
             or child_revision.id is null
             or child_revision.revision_no is distinct from nullif(
               child.applied_snapshot ->> 'childSetRevisionNo', ''
             )::integer
             or child_revision.validation_status <> 'valid'
            or child_revision.validation_errors <> '[]'::jsonb
            or not exists (
              select 1
              from public.order_set_revision_items root_item
              where root_item.workspace_id = v_root.workspace_id
                and root_item.order_set_id = v_root.source_set_id
                and root_item.revision_id = v_root.source_set_revision_id
                and root_item.id = private.clair_b3_safe_uuid(
                  child.applied_snapshot ->> 'directRevisionItemId'
                )
                and root_item.child_kind = 'order_set'
                and root_item.child_order_set_id = child.applied_snapshot ->> 'childSetId'
                and root_item.child_set_revision_id = child_revision.id
            )
          )
      ) then
        raise exception 'order_set_member_unavailable';
      end if;
      if p_action = 'confirm' and exists (
        select 1
        from public.orders child
        where child.workspace_id = v_root.workspace_id
          and child.parent_chart_order_line_id = v_root.id
          and child.row_type = 'set_child'
          and child.status <> 'cancelled'
          and (
            not exists (
              select 1
              from public.order_catalog_items catalog
              where catalog.workspace_id = child.workspace_id
                and catalog.id = child.workspace_catalog_item_id
            )
            or exists (
              select 1
              from public.order_catalog_items catalog
              where catalog.workspace_id = child.workspace_id
                and catalog.id = child.workspace_catalog_item_id
                and catalog.availability_status <> 'active'
            )
          )
      ) then
        raise exception 'order_set_member_unavailable';
      end if;
      if p_action = 'confirm' and exists (
        select 1
        from public.orders child
        join public.order_catalog_items catalog
          on catalog.workspace_id = child.workspace_id
         and catalog.id = child.workspace_catalog_item_id
        where child.workspace_id = v_root.workspace_id
          and child.parent_chart_order_line_id = v_root.id
          and child.row_type = 'set_child'
          and child.status <> 'cancelled'
          and catalog.catalog_revision is distinct from child.workspace_catalog_revision
      ) then
        raise exception 'catalog_revision_requires_refresh';
      end if;
      if not exists (
        select 1 from public.orders child
        where child.workspace_id = v_root.workspace_id
          and child.parent_chart_order_line_id = v_root.id
          and child.row_type = 'set_child'
          and child.status <> 'cancelled'
      ) then
        raise exception 'order_set_empty_selection';
      end if;
      if p_action = 'confirm' then
        update public.orders
        set status = case when status in ('draft', 'requested', 're_requested')
          then 'confirmed' else status end,
            order_confirmation_status = 'confirmed',
            confirmed_by_user_id = p_actor_user_id,
            confirmed_at = coalesce(confirmed_at, v_now),
            updated_at = v_now
        where workspace_id = v_root.workspace_id
          and id = v_root.id;
        update public.orders
        set status = case when status in ('draft', 'requested', 're_requested')
          then 'confirmed' else status end,
            order_confirmation_status = 'confirmed',
            confirmed_by_user_id = p_actor_user_id,
            confirmed_at = coalesce(confirmed_at, v_now),
            updated_at = v_now
        where workspace_id = v_root.workspace_id
          and parent_chart_order_line_id = v_root.id
          and row_type = 'set_child'
          and status <> 'cancelled';
      else
        if v_root.order_confirmation_status not in ('confirmed', 'billed') then
          raise exception 'order_unavailable';
        end if;
        update public.orders
        set billing_candidate_status = case
              when invoice_line_id is not null then 'invoice_linked'
              when billing_reflection_enabled then 'candidate_created'
              else billing_candidate_status
            end,
            billing_candidate_id = case
              when billing_reflection_enabled then coalesce(
                billing_candidate_id,
                'billcand-' || id::text
              )
              else billing_candidate_id
            end,
            order_confirmation_status = case
              when invoice_line_id is not null then 'billed'
              else order_confirmation_status
            end,
            updated_at = v_now
        where workspace_id = v_root.workspace_id
          and (
            id = v_root.id
            or parent_chart_order_line_id = v_root.id
          )
          and status <> 'cancelled';
      end if;
    elsif p_action = 'confirm' then
      update public.orders
      set status = case when status in ('draft', 'requested', 're_requested')
        then 'confirmed' else status end,
          order_confirmation_status = 'confirmed',
          confirmed_by_user_id = p_actor_user_id,
          confirmed_at = coalesce(confirmed_at, v_now),
          updated_at = v_now
      where workspace_id = v_root.workspace_id
        and id = v_root.id;
    elsif v_root.order_confirmation_status not in ('confirmed', 'billed') then
      raise exception 'order_unavailable';
    else
      update public.orders
      set billing_candidate_status = case
            when invoice_line_id is not null then 'invoice_linked'
            when billing_reflection_enabled then 'candidate_created'
            else billing_candidate_status
          end,
          billing_candidate_id = case
            when billing_reflection_enabled then coalesce(
              billing_candidate_id,
              'billcand-' || id::text
            )
            else billing_candidate_id
          end,
          order_confirmation_status = case
            when invoice_line_id is not null then 'billed'
            else order_confirmation_status
          end,
          updated_at = v_now
      where workspace_id = v_root.workspace_id and id = v_root.id;
    end if;
    insert into public.order_events (
      workspace_id, order_id, event_type, performed_by_user_id, payload, created_at
    )
    values (
      v_root.workspace_id,
      v_root.id,
      'edited',
      p_actor_user_id,
      jsonb_build_object(
        'action', p_action,
        'selectionFingerprint', v_root.calculation_inputs ->> 'selectionFingerprint',
        'snapshotHash', coalesce(v_root.applied_snapshot_sha256, ''),
        'lifecycle', case when p_action = 'confirm' then 'confirmed' else 'billed' end
      ),
      v_now
    );
  end loop;
  select coalesce(
    jsonb_agg(private.clair_b3_runtime_row_json(o)
      order by o.sort_order, o.created_at, o.id),
    '[]'::jsonb
  )
  into v_rows
  from public.orders o
  where o.workspace_id = p_workspace_id
    and o.encounter_id = p_encounter_id
    and (
      o.id = any(p_order_ids)
      or o.parent_chart_order_line_id = any(p_order_ids)
    )
    and o.status <> 'cancelled';
  return jsonb_build_object(
    'action', p_action,
    'etag', private.clair_b3_order_draft_etag(p_workspace_id, p_encounter_id),
    'rows', v_rows,
    'stored', false
  );
end;
$$;

revoke all on function public.clair_save_chart_order_action(text,uuid,uuid,text,uuid[],text)
  from public, anon, service_role;
grant execute on function public.clair_save_chart_order_action(text,uuid,uuid,text,uuid[],text)
  to authenticated;

commit;
