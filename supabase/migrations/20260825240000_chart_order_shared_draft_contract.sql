-- Chart order execution Phase 3: shared editable candidate details, binary
-- urgency, set-child input persistence, and ETag coverage. The deployed draft
-- RPC signature remains unchanged; legacy four/six-field rows are accepted as
-- a compatibility subset until the new client is deployed.

set lock_timeout = '5s';
set statement_timeout = '120s';

create or replace function private.clair_order_detail_inputs_are_valid(
  p_clinical_order_type text,
  p_schema_version integer,
  p_detail_inputs jsonb,
  p_require_complete boolean default false
)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_schema jsonb;
  v_field jsonb;
  v_key text;
  v_value jsonb;
  v_default jsonb;
  v_validation jsonb;
  v_value_type text;
begin
  if p_schema_version is distinct from 1
    or jsonb_typeof(p_detail_inputs) is distinct from 'object'
  then
    return false;
  end if;

  v_schema := private.clair_order_detail_field_schema_v1(p_clinical_order_type);
  if not private.clair_order_field_schema_is_valid(
    p_clinical_order_type,
    p_schema_version,
    v_schema
  ) then
    return false;
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_detail_inputs) input_key
    where not exists (
      select 1
      from jsonb_array_elements(v_schema -> 'fields') field(value)
      where field.value ->> 'key' = input_key
    )
  ) then
    return false;
  end if;

  for v_field in
    select value from jsonb_array_elements(v_schema -> 'fields') fields(value)
  loop
    v_key := v_field ->> 'key';
    v_value := p_detail_inputs -> v_key;
    v_default := v_field -> 'defaultValue';
    v_validation := v_field -> 'validation';
    v_value_type := v_field ->> 'valueType';

    if v_value is null or jsonb_typeof(v_value) = 'null' then
      v_value := v_default;
    end if;

    if p_require_complete
      and (v_field ->> 'required')::boolean
      and (
        v_value is null
        or jsonb_typeof(v_value) = 'null'
        or (jsonb_typeof(v_value) = 'string' and btrim(v_value #>> '{}') = '')
        or (jsonb_typeof(v_value) = 'array' and jsonb_array_length(v_value) = 0)
      )
    then
      return false;
    end if;

    if v_value is null or jsonb_typeof(v_value) = 'null' then
      continue;
    end if;

    if v_value_type = 'string' then
      if jsonb_typeof(v_value) <> 'string'
        or (
          v_validation ? 'minLength'
          and length(btrim(v_value #>> '{}')) < (v_validation ->> 'minLength')::integer
        )
        or (
          v_validation ? 'maxLength'
          and length(v_value #>> '{}') > (v_validation ->> 'maxLength')::integer
        )
        or (
          jsonb_array_length(v_field -> 'options') > 0
          and not (v_field -> 'options' ? (v_value #>> '{}'))
        )
      then
        return false;
      end if;
    elsif v_value_type = 'number' then
      if jsonb_typeof(v_value) <> 'number'
        or (
          v_validation ? 'min'
          and (v_value #>> '{}')::numeric < (v_validation ->> 'min')::numeric
        )
        or (
          v_validation ? 'max'
          and (v_value #>> '{}')::numeric > (v_validation ->> 'max')::numeric
        )
        or (
          v_validation ->> 'precision' = '0'
          and (v_value #>> '{}')::numeric <> trunc((v_value #>> '{}')::numeric)
        )
      then
        return false;
      end if;
    elsif v_value_type = 'boolean' then
      if jsonb_typeof(v_value) <> 'boolean' then return false; end if;
    elsif v_value_type = 'string_array' then
      if jsonb_typeof(v_value) <> 'array'
        or exists (
          select 1 from jsonb_array_elements(v_value) entry(value)
          where jsonb_typeof(entry.value) <> 'string'
        )
      then
        return false;
      end if;
    elsif v_value_type = 'attachment_array' then
      if jsonb_typeof(v_value) <> 'array' then return false; end if;
    else
      return false;
    end if;
  end loop;

  return true;
end;
$function$;

revoke all on function private.clair_order_detail_inputs_are_valid(text,integer,jsonb,boolean)
  from public, anon, authenticated, service_role;

-- ETag and cross-device readback include every editable candidate value. The
-- legacy order_type remains present for the currently deployed readers.
create or replace function private.clair_b3_runtime_row_json(p_order public.orders)
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog, public, private
as $function$
  select jsonb_build_object(
    'orderId', p_order.id,
    'workspaceId', p_order.workspace_id,
    'encounterId', p_order.encounter_id,
    'rowType', p_order.row_type,
    'orderType', p_order.order_type,
    'clinicalOrderType', p_order.clinical_order_type,
    'destinationModule', p_order.destination_module,
    'executionMode', p_order.execution_mode,
    'detailInputs', p_order.detail_inputs,
    'detailSchemaVersion', p_order.detail_schema_version,
    'priority', case when p_order.priority = 'urgent' then 'urgent' else 'normal' end,
    'billingEligible', p_order.billing_eligible,
    'revisionNo', p_order.revision_no,
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
$function$;

revoke all on function private.clair_b3_runtime_row_json(public.orders)
  from public, anon, authenticated, service_role;

do $block$
begin
  if to_regprocedure('public.clair_list_order_catalog_chart_search_v2(text)') is not null
    and to_regprocedure('public.clair_list_order_catalog_chart_search_v2_phase2_base(text)') is null
  then
    alter function public.clair_list_order_catalog_chart_search_v2(text)
      rename to clair_list_order_catalog_chart_search_v2_phase2_base;
  end if;
end;
$block$;

revoke all on function public.clair_list_order_catalog_chart_search_v2_phase2_base(text)
  from public, anon, authenticated, service_role;

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
set search_path = pg_catalog, public, private
as $function$
  select
    base.row_type,
    base.source_preset_id,
    base.source_preset_version,
    base.display_name,
    base.billing_name,
    base.category_group,
    base.target_species,
    base.applied_snapshot || case
      when base.row_type = 'set' then jsonb_build_object(
        'clinicalOrderType', 'other',
        'destinationModule', null,
        'executionMode', 'aggregate',
        'detailSchemaVersion', 1,
        'billingEligible', false
      )
      else jsonb_build_object(
        'clinicalOrderType', catalog.clinical_order_type,
        'destinationModule', catalog.destination_module,
        'executionMode', catalog.execution_mode,
        'detailSchemaVersion', catalog.detail_schema_version,
        'billingEligible', catalog.billing_eligible
      )
    end as applied_snapshot,
    base.source_set_id,
    base.source_set_revision_id,
    base.source_set_revision_no,
    base.source_set_amount_basis,
    base.source_set_price_krw,
    base.source_set_range_basis,
    base.source_set_tax_type,
    base.source_set_availability_status,
    base.source_set_needs_composition_review,
    base.source_set_validation_status,
    base.source_set_price_ranges,
    base.source_set_pending_review_count
  from public.clair_list_order_catalog_chart_search_v2_phase2_base(
    p_workspace_id
  ) base
  left join public.order_catalog_items catalog
    on base.row_type = 'individual'
   and catalog.workspace_id = p_workspace_id
   and catalog.id = base.applied_snapshot ->> 'workspaceCatalogItemId';
$function$;

revoke all on function public.clair_list_order_catalog_chart_search_v2(text)
  from public, anon, service_role;
grant execute on function public.clair_list_order_catalog_chart_search_v2(text)
  to authenticated;

do $block$
begin
  if to_regprocedure('public.clair_save_chart_order_draft(text,text,uuid,jsonb)') is not null
    and to_regprocedure('public.clair_save_chart_order_draft_phase2_base(text,text,uuid,jsonb)') is null
  then
    alter function public.clair_save_chart_order_draft(text,text,uuid,jsonb)
      rename to clair_save_chart_order_draft_phase2_base;
  end if;
end;
$block$;

revoke all on function public.clair_save_chart_order_draft_phase2_base(text,text,uuid,jsonb)
  from public, anon, authenticated, service_role;

create or replace function public.clair_save_chart_order_draft(
  p_workspace_id text,
  p_actor_user_id text,
  p_encounter_id uuid,
  p_orders jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, master, extensions, pg_temp
as $function$
declare
  v_actor uuid := private.clair_b3_safe_uuid(p_actor_user_id);
  v_rows jsonb := p_orders -> 'rows';
  v_base_rows jsonb;
  v_base_result jsonb;
  v_row jsonb;
  v_child_input jsonb;
  v_order public.orders%rowtype;
  v_child public.orders%rowtype;
  v_order_id uuid;
  v_revision_item_id uuid;
  v_detail_inputs jsonb;
  v_schema_version integer;
  v_priority text;
  v_now timestamptz := now();
begin
  if auth.uid() is null or v_actor is null or v_actor is distinct from auth.uid() then
    raise exception 'actor_mismatch' using errcode = '42501';
  end if;
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;
  if not private.clair_current_user_has_workspace_permission(p_workspace_id, 'chart:update') then
    raise exception 'permission_missing';
  end if;
  if jsonb_typeof(coalesce(p_orders, '{}'::jsonb)) is distinct from 'object'
    or (select count(*) from jsonb_object_keys(p_orders)) <> 2
    or not (p_orders ? 'expectedEtag')
    or not (p_orders ? 'rows')
    or jsonb_typeof(v_rows) is distinct from 'array'
    or jsonb_array_length(v_rows) > 100
  then
    raise exception 'invalid_order_rows';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_rows) entry(value)
    where jsonb_typeof(entry.value) <> 'object'
      or entry.value ->> 'rowType' not in ('individual','set')
      or exists (
        select 1 from jsonb_object_keys(entry.value) key
        where key not in (
          'rowType','orderId','workspaceCatalogItemId','quantity',
          'sourceSetId','sourceSetRevisionId','sourceSetRevisionNo','selectionIntent',
          'detailInputs','detailSchemaVersion','priority','childInputs'
        )
      )
      or (
        entry.value ? 'priority'
        and entry.value ->> 'priority' not in ('normal','urgent')
      )
      or ((entry.value ? 'detailInputs') <> (entry.value ? 'detailSchemaVersion'))
      or (
        entry.value ? 'detailInputs'
        and jsonb_typeof(entry.value -> 'detailInputs') <> 'object'
      )
      or (
        entry.value ->> 'rowType' = 'individual'
        and entry.value ? 'childInputs'
      )
      or (
        entry.value ->> 'rowType' = 'set'
        and entry.value ? 'childInputs'
        and jsonb_typeof(entry.value -> 'childInputs') <> 'array'
      )
  ) then
    raise exception 'invalid_order_rows';
  end if;

  select coalesce(jsonb_agg(
    case entry.value ->> 'rowType'
      when 'individual' then jsonb_build_object(
        'rowType', 'individual',
        'orderId', entry.value -> 'orderId',
        'workspaceCatalogItemId', entry.value -> 'workspaceCatalogItemId',
        'quantity', entry.value -> 'quantity'
      )
      else jsonb_build_object(
        'rowType', 'set',
        'orderId', entry.value -> 'orderId',
        'sourceSetId', entry.value -> 'sourceSetId',
        'sourceSetRevisionId', entry.value -> 'sourceSetRevisionId',
        'sourceSetRevisionNo', entry.value -> 'sourceSetRevisionNo',
        'selectionIntent', entry.value -> 'selectionIntent'
      )
    end order by entry.ordinality
  ), '[]'::jsonb)
  into v_base_rows
  from jsonb_array_elements(v_rows) with ordinality entry(value, ordinality);

  -- The proven B3 writer retains ownership of catalog/set expansion, row
  -- identity, price snapshots, and compare-and-swap. Its writes remain in this
  -- same transaction, so any detail validation below rolls all of them back.
  v_base_result := public.clair_save_chart_order_draft_phase2_base(
    p_workspace_id,
    p_actor_user_id,
    p_encounter_id,
    jsonb_build_object(
      'expectedEtag', p_orders -> 'expectedEtag',
      'rows', v_base_rows
    )
  );

  for v_row in select value from jsonb_array_elements(v_rows) entries(value)
  loop
    v_order_id := private.clair_b3_safe_uuid(v_row ->> 'orderId');
    select * into v_order
    from public.orders orders
    where orders.workspace_id = p_workspace_id
      and orders.encounter_id = p_encounter_id
      and orders.id = v_order_id
      and orders.order_confirmation_status in ('draft','pending')
    for update;
    if not found then raise exception 'order_unavailable'; end if;

    v_priority := case
      when v_row ? 'priority' then v_row ->> 'priority'
      when v_order.priority = 'urgent' then 'urgent'
      else 'normal'
    end;
    v_detail_inputs := case
      when v_row ? 'detailInputs' then v_row -> 'detailInputs'
      else v_order.detail_inputs
    end;
    v_schema_version := case
      when v_row ? 'detailSchemaVersion'
        then (v_row ->> 'detailSchemaVersion')::integer
      else v_order.detail_schema_version
    end;

    if v_order.row_type = 'individual'
      and v_row ? 'detailInputs'
      and not private.clair_order_detail_inputs_are_valid(
        v_order.clinical_order_type,
        v_schema_version,
        v_detail_inputs
      )
    then
      raise exception 'detail_inputs_invalid';
    end if;

    update public.orders orders
    set
      priority = v_priority,
      detail_inputs = v_detail_inputs,
      detail_schema_version = v_schema_version,
      applied_snapshot = orders.applied_snapshot || jsonb_build_object(
        'clinicalOrderType', orders.clinical_order_type,
        'destinationModule', orders.destination_module,
        'executionMode', orders.execution_mode,
        'detailInputs', v_detail_inputs,
        'detailSchemaVersion', v_schema_version,
        'priority', v_priority
      ),
      updated_at = v_now
    where orders.workspace_id = p_workspace_id and orders.id = v_order.id;

    if v_order.row_type <> 'set' or not (v_row ? 'childInputs') then
      continue;
    end if;
    if exists (
      select 1
      from jsonb_array_elements(v_row -> 'childInputs') entry(value)
      where jsonb_typeof(entry.value) <> 'object'
        or (select count(*) from jsonb_object_keys(entry.value)) <> 4
        or not (entry.value ?& array[
          'revisionItemId','detailInputs','detailSchemaVersion','priority'
        ])
        or private.clair_b3_safe_uuid(entry.value ->> 'revisionItemId') is null
        or jsonb_typeof(entry.value -> 'detailInputs') <> 'object'
        or jsonb_typeof(entry.value -> 'detailSchemaVersion') <> 'number'
        or entry.value ->> 'priority' not in ('normal','urgent')
    ) or (
      select count(*) from jsonb_array_elements(v_row -> 'childInputs')
    ) <> (
      select count(distinct entry.value ->> 'revisionItemId')
      from jsonb_array_elements(v_row -> 'childInputs') entry(value)
    ) then
      raise exception 'child_detail_inputs_invalid';
    end if;

    for v_child_input in
      select value from jsonb_array_elements(v_row -> 'childInputs') entries(value)
    loop
      v_revision_item_id := private.clair_b3_safe_uuid(
        v_child_input ->> 'revisionItemId'
      );
      select * into v_child
      from public.orders child
      where child.workspace_id = p_workspace_id
        and child.encounter_id = p_encounter_id
        and child.parent_chart_order_line_id = v_order.id
        and child.source_set_revision_item_id = v_revision_item_id
        and child.row_type = 'set_child'
        and child.status <> 'cancelled'
        and child.order_confirmation_status in ('draft','pending')
      for update;
      if not found then raise exception 'set_child_input_unavailable'; end if;

      v_detail_inputs := v_child_input -> 'detailInputs';
      v_schema_version := (v_child_input ->> 'detailSchemaVersion')::integer;
      v_priority := v_child_input ->> 'priority';
      if not private.clair_order_detail_inputs_are_valid(
        v_child.clinical_order_type,
        v_schema_version,
        v_detail_inputs
      ) then
        raise exception 'child_detail_inputs_invalid';
      end if;

      update public.orders child
      set
        priority = v_priority,
        detail_inputs = v_detail_inputs,
        detail_schema_version = v_schema_version,
        applied_snapshot = child.applied_snapshot || jsonb_build_object(
          'clinicalOrderType', child.clinical_order_type,
          'destinationModule', child.destination_module,
          'executionMode', child.execution_mode,
          'detailInputs', v_detail_inputs,
          'detailSchemaVersion', v_schema_version,
          'priority', v_priority
        ),
        updated_at = v_now
      where child.workspace_id = p_workspace_id and child.id = v_child.id;
    end loop;
  end loop;

  -- No Task, Queue, Billing, notification, or outbox artifact is created by
  -- this Draft writer. The universal Task trigger additionally rejects any
  -- attempt whose Order has not reached confirmed/billed.
  return public.clair_get_chart_order_draft(p_workspace_id, p_encounter_id);
end;
$function$;

revoke all on function public.clair_save_chart_order_draft(text,text,uuid,jsonb)
  from public, anon, service_role;
grant execute on function public.clair_save_chart_order_draft(text,text,uuid,jsonb)
  to authenticated;

comment on function public.clair_save_chart_order_draft(text,text,uuid,jsonb) is
  'Shared candidate CAS writer: compatible legacy rows plus canonical details, urgency, and set-child values; creates no execution artifacts.';
