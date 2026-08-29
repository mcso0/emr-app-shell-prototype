-- PR-020: workspace-owned dispensing presets, veterinarian review, and
-- quantity-linked/fixed pricing. All writers remain workspace-scoped and
-- authenticated; hospital-created rows never acquire CLAiR master lineage.

alter table public.order_catalog_items
  add column if not exists workspace_dispensing_review_status text not null
    default 'not_required'
    check (workspace_dispensing_review_status in (
      'not_required', 'pending', 'approved', 'rejected'
    )),
  add column if not exists workspace_dispensing_review_revision integer not null
    default 0 check (workspace_dispensing_review_revision >= 0),
  add column if not exists workspace_dispensing_authored_by_user_id uuid,
  add column if not exists workspace_dispensing_authored_at timestamptz,
  add column if not exists workspace_dispensing_reviewed_by_user_id uuid,
  add column if not exists workspace_dispensing_reviewed_at timestamptz,
  add column if not exists workspace_dispensing_review_note text
    check (
      workspace_dispensing_review_note is null
      or length(workspace_dispensing_review_note) <= 500
    );

-- Existing active workspace-custom dispensing rows predate this lifecycle.
-- Preserve their runtime availability without inventing a reviewer identity.
update public.order_catalog_items
set workspace_dispensing_review_status = 'approved',
    workspace_dispensing_review_revision = greatest(
      workspace_dispensing_review_revision,
      1
    ),
    workspace_dispensing_authored_at = coalesce(
      workspace_dispensing_authored_at,
      created_at
    )
where origin_type = 'workspace_custom'
  and category_group = 'medication'
  and default_destination_module = 'dispensing'
  and workspace_dispensing_review_status = 'not_required';

create index if not exists order_catalog_items_workspace_dispensing_review_idx
  on public.order_catalog_items (
    workspace_id,
    workspace_dispensing_review_status,
    updated_at desc
  )
  where origin_type = 'workspace_custom'
    and category_group = 'medication'
    and default_destination_module = 'dispensing';

alter table public.audit_events
  drop constraint if exists audit_events_event_type_check;

alter table public.audit_events
  add constraint audit_events_event_type_check check (event_type in (
    'workspace.created','workspace.invitation_created','workspace.invitation_resent','workspace.invitation_canceled',
    'workspace.invitation_accepted','workspace.membership_roles_changed','workspace.role_catalog_changed',
    'workspace.membership_status_changed','workspace.membership_soft_deleted','workspace.membership_archived',
    'workspace.membership_deactivated','workspace.membership_reactivated','workspace.membership_restored',
    'workspace.permission_role_deactivated','workspace.permission_role_reactivated',
    'workspace.permission_role_created','workspace.permission_role_updated',
    'workspace.job_position_deactivated','workspace.job_position_reactivated',
    'workspace.last_admin_change_blocked','user.profile_updated','user.workspace_status_message_updated',
    'reception.patient_guardian_registered','reception.walk_in_created','reception.appointment_created',
    'reception.appointment_checked_in','reception.appointment_restored','reception.encounter_cancelled',
    'reception.encounter_restored','reception.encounter_updated','reception.queue_status_changed',
    'chart.patient_called','chart.consultation_started','chart.consultation_returned_to_waiting',
    'chart.soap_saved','chart.completed','diagnosis.changed','order.draft_changed','order.confirmed',
    'order.billing_candidate_requested','order.status_changed','order_catalog.created',
    'order_catalog.updated','order_catalog.paused','order_catalog.review_approved',
    'order_catalog.review_rejected','billing.invoice_candidate_generated',
    'billing.invoice_line_changed','billing.invoice_issued','billing.payment_state_changed',
    'billing.refund_requested','hospital.operating_hours_updated','hospital.schedule_revision_published',
    'hospital.schedule_revision_mutated','hospital.vital_settings_updated',
    'hospital.space_category_created','hospital.space_category_renamed',
    'hospital.space_category_archived','hospital.space_created',
    'hospital.space_updated','hospital.space_archived',
    'hospital.profile_contact_updated','hospital.profile_change_requested',
    'hospital.logo_updated','hospital.logo_removed'
  ));

create or replace function private.clair_pr020_order_catalog_audit_snapshot(
  p_item public.order_catalog_items
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if p_item is null then
    return '{}'::jsonb;
  end if;
  return pg_catalog.jsonb_build_object(
    'id', (p_item).id,
    'standardOrderId', (p_item).standard_order_id,
    'categoryGroup', (p_item).category_group,
    'categoryLabel', (p_item).category_label,
    'standardOrderName', (p_item).standard_order_name,
    'inHospitalOrderName', (p_item).in_hospital_order_name,
    'billingName', (p_item).billing_name,
    'availabilityStatus', (p_item).availability_status,
    'priceKrw', (p_item).price_krw,
    'salesUnit', (p_item).sales_unit,
    'defaultDestinationModule', (p_item).default_destination_module,
    'defaultTaskRequired', (p_item).default_task_required,
    'billingReflectionEnabled', (p_item).billing_reflection_enabled,
    'workspaceDispensingReview', pg_catalog.jsonb_build_object(
      'status', (p_item).workspace_dispensing_review_status,
      'revision', (p_item).workspace_dispensing_review_revision,
      'authoredByUserId', (p_item).workspace_dispensing_authored_by_user_id,
      'authoredAt', (p_item).workspace_dispensing_authored_at,
      'reviewedByUserId', (p_item).workspace_dispensing_reviewed_by_user_id,
      'reviewedAt', (p_item).workspace_dispensing_reviewed_at
    ),
    'pricingRule', pg_catalog.jsonb_build_object(
      'priceBasis', (p_item).pricing_rule ->> 'priceBasis',
      'priceKrw', (p_item).price_krw,
      'salesUnit', (p_item).sales_unit,
      'taxIncluded', (p_item).tax_included,
      'billingReflectionEnabled', (p_item).billing_reflection_enabled
    ),
    'updatedAt', (p_item).updated_at
  );
end;
$function$;

revoke all on function private.clair_pr020_order_catalog_audit_snapshot(
  public.order_catalog_items
) from public, anon, authenticated, service_role;

create or replace function private.clair_pr020_append_order_catalog_audit(
  p_workspace_id text,
  p_event_type text,
  p_target_id text,
  p_before public.order_catalog_items,
  p_after public.order_catalog_items,
  p_action text,
  p_changed_fields text[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if p_event_type not in (
      'order_catalog.created',
      'order_catalog.updated',
      'order_catalog.paused',
      'order_catalog.review_approved',
      'order_catalog.review_rejected'
    ) then
    raise exception 'order_catalog_audit_event_invalid' using errcode = '22023';
  end if;
  if (p_after).workspace_id is distinct from p_workspace_id
     or (p_after).id is distinct from p_target_id then
    raise exception 'order_catalog_audit_target_mismatch' using errcode = '42501';
  end if;

  insert into public.audit_events (
    id, workspace_id, actor_user_id, actor_membership_id,
    event_type, target_type, target_id,
    encounter_id, patient_id, guardian_id, request_id, reason,
    before_snapshot, after_snapshot, metadata, occurred_at
  ) values (
    'audit_pr020_' || pg_catalog.replace(
      extensions.gen_random_uuid()::text,
      '-',
      ''
    ),
    p_workspace_id,
    auth.uid(),
    null,
    p_event_type,
    'order_catalog_item',
    p_target_id,
    null,
    null,
    null,
    null,
    null,
    private.clair_pr020_order_catalog_audit_snapshot(p_before),
    private.clair_pr020_order_catalog_audit_snapshot(p_after),
    pg_catalog.jsonb_build_object(
      'action', p_action,
      'changedFields', pg_catalog.to_jsonb(coalesce(
        p_changed_fields,
        array[]::text[]
      )),
      'source', 'order-catalog-db-mutation'
    ),
    pg_catalog.now()
  );
end;
$function$;

revoke all on function private.clair_pr020_append_order_catalog_audit(
  text,
  text,
  text,
  public.order_catalog_items,
  public.order_catalog_items,
  text,
  text[]
) from public, anon, authenticated, service_role;

create or replace function private.clair_validate_workspace_dispensing_preset(
  p_medication_metadata jsonb,
  p_price_krw integer,
  p_pricing_rule jsonb
)
returns void
language plpgsql
immutable
security definer
set search_path = ''
as $function$
declare
  v_detail jsonb;
  v_auto boolean;
  v_price_basis text;
begin
  if p_medication_metadata is null
     or pg_catalog.jsonb_typeof(p_medication_metadata) <> 'object' then
    raise exception 'dispensing_metadata_object_required' using errcode = '22023';
  end if;
  v_detail := p_medication_metadata -> 'defaultDetailInputs';
  if v_detail is null or pg_catalog.jsonb_typeof(v_detail) <> 'object' then
    raise exception 'dispensing_detail_inputs_required' using errcode = '22023';
  end if;
  if nullif(pg_catalog.btrim(coalesce(
      p_medication_metadata ->> 'ingredientKoreanName',
      p_medication_metadata ->> 'ingredientEnglishName',
      ''
    )), '') is null then
    raise exception 'dispensing_ingredient_required' using errcode = '22023';
  end if;
  if pg_catalog.jsonb_typeof(v_detail -> 'dose') <> 'number'
     or (v_detail ->> 'dose')::numeric <= 0
     or nullif(pg_catalog.btrim(v_detail ->> 'doseUnit'), '') is null
     or nullif(pg_catalog.btrim(v_detail ->> 'route'), '') is null
     or nullif(pg_catalog.btrim(v_detail ->> 'frequency'), '') is null
     or pg_catalog.jsonb_typeof(v_detail -> 'durationDays') <> 'number'
     or (v_detail ->> 'durationDays')::numeric <= 0
     or pg_catalog.jsonb_typeof(v_detail -> 'totalQuantity') <> 'number'
     or (v_detail ->> 'totalQuantity')::numeric <= 0
     or nullif(pg_catalog.btrim(v_detail ->> 'totalQuantityUnit'), '') is null then
    raise exception 'dispensing_required_detail_invalid' using errcode = '22023';
  end if;
  if v_detail ->> 'route' not in (
      'PO', 'IV', 'CRI', 'SC', 'IM', 'topical', 'otic', 'ophthalmic',
      'transdermal', 'oromucosal', 'inhalation', 'nasal', 'other'
    ) then
    raise exception 'dispensing_route_invalid' using errcode = '22023';
  end if;
  if v_detail ->> 'frequency' not in (
      'once', 'sid', 'bid', 'tid', 'qid', 'qod'
    ) then
    raise exception 'dispensing_frequency_invalid' using errcode = '22023';
  end if;
  v_auto := coalesce(
    (p_medication_metadata ->> 'autoDispenseQuantityEnabled')::boolean,
    true
  );
  if not v_auto
     and nullif(pg_catalog.btrim(coalesce(
       v_detail ->> 'manualQuantityReason',
       ''
     )), '') is null then
    raise exception 'dispensing_manual_quantity_reason_required' using errcode = '22023';
  end if;
  if p_price_krw is null or p_price_krw < 0 then
    raise exception 'dispensing_price_invalid' using errcode = '22023';
  end if;
  if p_pricing_rule is null
     or pg_catalog.jsonb_typeof(p_pricing_rule) <> 'object' then
    raise exception 'dispensing_pricing_rule_required' using errcode = '22023';
  end if;
  v_price_basis := coalesce(
    p_pricing_rule ->> 'priceBasis',
    p_pricing_rule ->> 'price_basis'
  );
  if v_price_basis not in ('unit_price', 'fixed_order_price') then
    raise exception 'dispensing_price_basis_invalid' using errcode = '22023';
  end if;
end;
$function$;

revoke all on function private.clair_validate_workspace_dispensing_preset(
  jsonb, integer, jsonb
) from public, anon, authenticated, service_role;

create or replace function public.clair_create_workspace_dispensing_order(
  p_workspace_id text,
  p_item jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_item public.order_catalog_items%rowtype;
  v_id text := 'ord-' ||
    pg_catalog.replace(extensions.gen_random_uuid()::text, '-', '');
  v_path_id uuid;
  v_path master.classification_paths%rowtype;
  v_action master.clinical_actions%rowtype;
  v_chart master.chart_groups%rowtype;
  v_route master.task_routes%rowtype;
  v_t_category master.order_categories%rowtype;
  v_t_record master.master_records%rowtype;
  v_t_code_label text;
  v_price integer;
  v_sales_unit text;
  v_species text[];
  v_tax boolean;
  v_rounding text;
  v_billing boolean;
  v_pricing jsonb;
  v_metadata jsonb;
  v_source_key text;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if not private.clair_is_active_workspace_member(p_workspace_id)
     or not (
       private.clair_is_workspace_admin(p_workspace_id)
       or private.clair_is_active_veterinarian_member(
         p_workspace_id,
         auth.uid()
       )
     ) then
    raise exception 'dispensing_author_required' using errcode = '42501';
  end if;
  if p_item is null or pg_catalog.jsonb_typeof(p_item) <> 'object' then
    raise exception 'catalog_item_object_required' using errcode = '22023';
  end if;
  if coalesce(p_item ->> 'categoryGroup', '') <> 'medication'
     or coalesce(p_item ->> 'defaultDestinationModule', '') <> 'dispensing' then
    raise exception 'workspace_dispensing_create_only' using errcode = '22023';
  end if;
  if p_item ? 'originType' or p_item ? 'origin_type'
     or p_item ? 'sourceMasterRecordId' or p_item ? 'source_master_record_id'
     or p_item ? 'sourceMasterRevision' or p_item ? 'source_master_revision'
     or p_item ? 'sourceProjectionSnapshot'
     or p_item ? 'source_projection_snapshot'
     or p_item ? 'workspaceDispensingReview'
     or p_item ? 'workspace_dispensing_review' then
    raise exception 'catalog_lineage_client_write_rejected' using errcode = '42501';
  end if;

  v_price := (p_item ->> 'priceKrw')::integer;
  v_sales_unit := coalesce(p_item ->> 'salesUnit', 'per_each');
  v_tax := coalesce((p_item ->> 'taxIncluded')::boolean, true);
  v_rounding := coalesce(p_item ->> 'roundingRule', 'as_is');
  v_billing := coalesce((p_item ->> 'billingReflectionEnabled')::boolean, true);
  v_pricing := coalesce(p_item -> 'pricingRule', '{}'::jsonb)
    || pg_catalog.jsonb_build_object(
      'priceKrw', v_price,
      'salesUnit', v_sales_unit,
      'taxIncluded', v_tax,
      'roundingRule', v_rounding,
      'billingReflectionEnabled', v_billing
    );
  v_metadata := coalesce(p_item -> 'medicationMetadata', '{}'::jsonb);
  perform private.clair_validate_workspace_dispensing_preset(
    v_metadata,
    v_price,
    v_pricing
  );
  if v_sales_unit not in (
      'per_order', 'per_each', 'per_day', 'per_frequency', 'per_ml', 'per_kg'
    ) then
    raise exception 'catalog_sales_unit_invalid' using errcode = '22023';
  end if;
  if v_rounding not in ('as_is', 'ceil', 'floor', 'round') then
    raise exception 'catalog_rounding_invalid' using errcode = '22023';
  end if;
  if p_item ? 'targetSpecies'
     and pg_catalog.jsonb_typeof(p_item -> 'targetSpecies') <> 'array' then
    raise exception 'catalog_species_array_required' using errcode = '22023';
  end if;
  v_species := coalesce(
    array(
      select value #>> '{}'
      from pg_catalog.jsonb_array_elements(
        coalesce(p_item -> 'targetSpecies', '["dog","cat"]'::jsonb)
      )
    ),
    '{dog,cat}'::text[]
  );
  if exists (
    select 1 from pg_catalog.unnest(v_species) species_code
    where species_code not in ('dog', 'cat', 'other')
  ) then
    raise exception 'catalog_species_invalid' using errcode = '22023';
  end if;

  v_path_id := private.clinical_master_fallback_path_for_item_type('medication');
  select * into v_path
  from master.classification_paths
  where id = v_path_id and retired_in_release_id is null;
  if not found then
    raise exception 'clinical_master_classification_fallback_missing' using errcode = '23503';
  end if;
  select * into v_action
  from master.clinical_actions where master_record_id = v_path.clinical_action_id;
  select * into v_chart
  from master.chart_groups where master_record_id = v_path.chart_group_id;
  select * into v_route
  from master.task_routes where master_record_id = v_path.task_route_id;
  select * into v_t_category
  from master.order_categories where master_record_id = v_action.t_category_id;
  select * into v_t_record
  from master.master_records where id = v_action.t_category_id;
  if v_route.runtime_status <> 'active'
     or v_route.destination_module <> 'dispensing' then
    raise exception 'clinical_master_dispensing_route_unavailable' using errcode = '23514';
  end if;
  select name_row.name into v_t_code_label
  from master.master_record_names name_row
  where name_row.master_record_id = v_t_record.id
    and name_row.language_code = 'ko'
    and name_row.name_kind = 'preferred'
  order by name_row.sort_order, name_row.id
  limit 1;
  v_source_key := 'workspace-custom-' || v_id;

  insert into public.order_catalog_items (
    id, workspace_id, standard_order_id, source_preset_version,
    initial_imported_preset_version, last_auto_merged_preset_version,
    customization_state, customized_fields, last_customized_at,
    last_customized_by_user_id, preset_merge_status, category_group,
    category_label, t_code, t_code_label, standard_order_name,
    in_hospital_order_name, billing_name, aliases, availability_status,
    price_krw, sales_unit, target_species, default_destination_module,
    default_task_required, billing_reflection_enabled, care_guide,
    care_guide_delivery_enabled, internal_instruction,
    internal_instruction_delivery_enabled, tax_included, rounding_rule,
    pricing_rule, medication_metadata, vaccine_metadata, origin_type,
    classification_path_id, catalog_revision,
    workspace_dispensing_review_status,
    workspace_dispensing_review_revision,
    workspace_dispensing_authored_by_user_id,
    workspace_dispensing_authored_at
  ) values (
    v_id, p_workspace_id, v_source_key,
    coalesce(p_item ->> 'sourcePresetVersion', 'workspace-custom-v1'),
    null, null, 'detached', array['*'], pg_catalog.now(), auth.uid()::text,
    'detached', 'medication', v_chart.group_code,
    v_t_category.category_code, coalesce(v_t_code_label, v_t_category.category_code),
    coalesce(nullif(pg_catalog.btrim(p_item ->> 'standardOrderName'), ''), v_source_key),
    coalesce(nullif(pg_catalog.btrim(p_item ->> 'inHospitalOrderName'), ''), v_source_key),
    coalesce(nullif(pg_catalog.btrim(p_item ->> 'billingName'), ''), v_source_key),
    coalesce(array(
      select value #>> '{}'
      from pg_catalog.jsonb_array_elements(coalesce(p_item -> 'aliases', '[]'::jsonb))
    ), array[]::text[]),
    'pending_activation', v_price, v_sales_unit, v_species, 'dispensing',
    true, v_billing, p_item ->> 'careGuide', false,
    p_item ->> 'internalInstruction', false, v_tax, v_rounding,
    v_pricing, v_metadata, '{}'::jsonb, 'workspace_custom', v_path_id, 1,
    'pending', 1, auth.uid(), pg_catalog.now()
  ) returning * into v_item;

  perform private.clair_pr020_append_order_catalog_audit(
    p_workspace_id,
    'order_catalog.created',
    v_item.id,
    null::public.order_catalog_items,
    v_item,
    'create',
    array['*']::text[]
  );

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'status', 200,
    'item', pg_catalog.to_jsonb(v_item),
    'databaseAuditWritten', true,
    'enforcedBy', 'clair_create_workspace_dispensing_order'
  );
end;
$function$;

revoke all on function public.clair_create_workspace_dispensing_order(text, jsonb)
  from public, anon, service_role;
grant execute on function public.clair_create_workspace_dispensing_order(text, jsonb)
  to authenticated;

-- Keep the generic catalog creation endpoint for non-dispensing categories,
-- but make every medication/dispensing request pass through the veterinarian
-- review lifecycle above.  The prior generic writer defaulted to `active` and
-- must not remain a directly callable bypass after it is renamed.
do $block$
begin
  if pg_catalog.to_regprocedure(
       'public.clair_create_order_catalog_item_pr020_legacy(text,jsonb)'
     ) is null
     and pg_catalog.to_regprocedure(
       'public.clair_create_order_catalog_item(text,jsonb)'
     ) is not null then
    alter function public.clair_create_order_catalog_item(text, jsonb)
      rename to clair_create_order_catalog_item_pr020_legacy;
  end if;
end;
$block$;

revoke all on function public.clair_create_order_catalog_item_pr020_legacy(
  text, jsonb
) from public, anon, authenticated, service_role;

create or replace function public.clair_create_order_catalog_item(
  p_workspace_id text,
  p_item jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_requested_category text := coalesce(
    p_item ->> 'categoryGroup',
    p_item ->> 'category_group'
  );
  v_requested_destination text := coalesce(
    p_item ->> 'defaultDestinationModule',
    p_item ->> 'default_destination_module'
  );
  v_requested_path_text text := nullif(coalesce(
    p_item ->> 'classificationPathId',
    p_item ->> 'classification_path_id'
  ), '');
  v_requested_path_id uuid;
  v_path_item_type text;
  v_path_destination text;
begin
  if p_item is null or pg_catalog.jsonb_typeof(p_item) <> 'object' then
    raise exception 'catalog_item_object_required' using errcode = '22023';
  end if;

  if v_requested_path_text is not null then
    begin
      v_requested_path_id := v_requested_path_text::uuid;
    exception when invalid_text_representation then
      raise exception 'catalog_classification_path_invalid' using errcode = '22023';
    end;

    select action.item_type, route.destination_module
      into v_path_item_type, v_path_destination
    from master.classification_paths path
    join master.clinical_actions action
      on action.master_record_id = path.clinical_action_id
    join master.task_routes route
      on route.master_record_id = path.task_route_id
    where path.id = v_requested_path_id
      and path.retired_in_release_id is null;
  end if;

  if v_requested_category = 'medication'
     or v_requested_destination = 'dispensing'
     or v_path_item_type = 'medication'
     or v_path_destination = 'dispensing' then
    return public.clair_create_workspace_dispensing_order(
      p_workspace_id,
      p_item || pg_catalog.jsonb_build_object(
        'categoryGroup', 'medication',
        'defaultDestinationModule', 'dispensing'
      )
    );
  end if;

  return public.clair_create_order_catalog_item_pr020_legacy(
    p_workspace_id,
    p_item
  );
end;
$function$;

revoke all on function public.clair_create_order_catalog_item(text, jsonb)
  from public, anon, service_role;
grant execute on function public.clair_create_order_catalog_item(text, jsonb)
  to authenticated;

create or replace function private.clair_update_workspace_dispensing_order(
  p_workspace_id text,
  p_item_id text,
  p_expected_catalog_revision integer,
  p_patch jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_item public.order_catalog_items%rowtype;
  v_next public.order_catalog_items%rowtype;
  v_key text;
  v_changed text[] := array[]::text[];
  v_substantive boolean := false;
  v_known text[] := array[
    'inHospitalOrderName', 'billingName', 'aliases', 'availabilityStatus',
    'priceKrw', 'salesUnit', 'targetSpecies', 'billingReflectionEnabled',
    'careGuide', 'internalInstruction', 'taxIncluded', 'roundingRule',
    'pricingRule', 'medicationMetadata'
  ];
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if not private.clair_is_active_workspace_member(p_workspace_id)
     or not (
       private.clair_is_workspace_admin(p_workspace_id)
       or private.clair_is_active_veterinarian_member(p_workspace_id, auth.uid())
     ) then
    raise exception 'dispensing_author_required' using errcode = '42501';
  end if;
  if p_patch is null or pg_catalog.jsonb_typeof(p_patch) <> 'object'
     or p_expected_catalog_revision is null
     or p_expected_catalog_revision <= 0 then
    raise exception 'catalog_patch_invalid' using errcode = '22023';
  end if;
  select * into v_item
  from public.order_catalog_items
  where workspace_id = p_workspace_id and id = p_item_id
  for update;
  if not found then
    raise exception 'order_catalog_item_not_found' using errcode = 'P0002';
  end if;
  if v_item.category_group <> 'medication'
     or v_item.default_destination_module <> 'dispensing' then
    raise exception 'workspace_dispensing_update_only' using errcode = '22023';
  end if;
  if v_item.catalog_revision <> p_expected_catalog_revision then
    raise exception 'catalog_revision_conflict' using errcode = '40001';
  end if;
  for v_key in select pg_catalog.jsonb_object_keys(p_patch) loop
    if not v_key = any(v_known) then
      raise exception 'catalog_patch_field_rejected:%', v_key using errcode = '22023';
    end if;
    v_changed := pg_catalog.array_append(v_changed, v_key);
    if v_key <> 'availabilityStatus' then v_substantive := true; end if;
  end loop;

  v_next := v_item;
  if p_patch ? 'inHospitalOrderName' then
    v_next.in_hospital_order_name := p_patch ->> 'inHospitalOrderName';
  end if;
  if p_patch ? 'billingName' then
    v_next.billing_name := p_patch ->> 'billingName';
  end if;
  if p_patch ? 'aliases' then
    if pg_catalog.jsonb_typeof(p_patch -> 'aliases') <> 'array' then
      raise exception 'catalog_aliases_array_required' using errcode = '22023';
    end if;
    select coalesce(
      pg_catalog.array_agg(value #>> '{}' order by ordinality),
      array[]::text[]
    )
      into v_next.aliases
    from pg_catalog.jsonb_array_elements(p_patch -> 'aliases') with ordinality;
  end if;
  if p_patch ? 'availabilityStatus' then
    v_next.availability_status := p_patch ->> 'availabilityStatus';
  end if;
  if p_patch ? 'priceKrw' then
    v_next.price_krw := (p_patch ->> 'priceKrw')::integer;
  end if;
  if p_patch ? 'salesUnit' then
    v_next.sales_unit := p_patch ->> 'salesUnit';
  end if;
  if p_patch ? 'targetSpecies' then
    if pg_catalog.jsonb_typeof(p_patch -> 'targetSpecies') <> 'array' then
      raise exception 'catalog_species_array_required' using errcode = '22023';
    end if;
    select coalesce(
      pg_catalog.array_agg(value #>> '{}' order by ordinality),
      array[]::text[]
    )
      into v_next.target_species
    from pg_catalog.jsonb_array_elements(p_patch -> 'targetSpecies') with ordinality;
  end if;
  if p_patch ? 'billingReflectionEnabled' then
    v_next.billing_reflection_enabled :=
      (p_patch ->> 'billingReflectionEnabled')::boolean;
  end if;
  if p_patch ? 'careGuide' then v_next.care_guide := p_patch ->> 'careGuide'; end if;
  if p_patch ? 'internalInstruction' then
    v_next.internal_instruction := p_patch ->> 'internalInstruction';
  end if;
  if p_patch ? 'taxIncluded' then
    v_next.tax_included := (p_patch ->> 'taxIncluded')::boolean;
  end if;
  if p_patch ? 'roundingRule' then
    v_next.rounding_rule := p_patch ->> 'roundingRule';
  end if;
  if p_patch ? 'pricingRule' then
    v_next.pricing_rule := p_patch -> 'pricingRule';
  end if;
  if p_patch ? 'medicationMetadata' then
    v_next.medication_metadata := p_patch -> 'medicationMetadata';
  end if;
  v_next.pricing_rule := v_next.pricing_rule || pg_catalog.jsonb_build_object(
    'priceKrw', v_next.price_krw,
    'salesUnit', v_next.sales_unit,
    'taxIncluded', v_next.tax_included,
    'roundingRule', v_next.rounding_rule,
    'billingReflectionEnabled', v_next.billing_reflection_enabled
  );
  perform private.clair_validate_workspace_dispensing_preset(
    v_next.medication_metadata,
    v_next.price_krw,
    v_next.pricing_rule
  );
  if exists (
    select 1 from pg_catalog.unnest(v_next.target_species) species_code
    where species_code not in ('dog', 'cat', 'other')
  ) then
    raise exception 'catalog_species_invalid' using errcode = '22023';
  end if;
  if v_next.availability_status not in (
      'pending_activation', 'active', 'paused', 'inactive'
    ) then
    raise exception 'catalog_availability_invalid' using errcode = '22023';
  end if;

  if v_item.origin_type = 'workspace_custom' and v_substantive then
    v_next.availability_status := 'pending_activation';
    v_next.workspace_dispensing_review_status := 'pending';
    v_next.workspace_dispensing_review_revision :=
      v_item.workspace_dispensing_review_revision + 1;
    v_next.workspace_dispensing_authored_by_user_id := auth.uid();
    v_next.workspace_dispensing_authored_at := pg_catalog.now();
    v_next.workspace_dispensing_reviewed_by_user_id := null;
    v_next.workspace_dispensing_reviewed_at := null;
    v_next.workspace_dispensing_review_note := null;
  elsif v_item.origin_type = 'workspace_custom'
        and v_next.availability_status = 'active'
        and v_item.workspace_dispensing_review_status <> 'approved' then
    raise exception 'dispensing_review_required' using errcode = '42501';
  end if;

  v_next.catalog_revision := v_item.catalog_revision + 1;
  v_next.customization_state := case
    when v_item.customization_state = 'detached' then 'detached'
    else 'customized'
  end;
  select coalesce(
    pg_catalog.array_agg(distinct field_name order by field_name),
    array[]::text[]
  )
    into v_next.customized_fields
  from pg_catalog.unnest(
    coalesce(v_item.customized_fields, array[]::text[]) || v_changed
  )
    as field_name;
  v_next.last_customized_at := pg_catalog.now();
  v_next.last_customized_by_user_id := auth.uid()::text;
  v_next.updated_at := pg_catalog.now();

  update public.order_catalog_items set
    in_hospital_order_name = v_next.in_hospital_order_name,
    billing_name = v_next.billing_name,
    aliases = v_next.aliases,
    availability_status = v_next.availability_status,
    price_krw = v_next.price_krw,
    sales_unit = v_next.sales_unit,
    target_species = v_next.target_species,
    billing_reflection_enabled = v_next.billing_reflection_enabled,
    care_guide = v_next.care_guide,
    internal_instruction = v_next.internal_instruction,
    tax_included = v_next.tax_included,
    rounding_rule = v_next.rounding_rule,
    pricing_rule = v_next.pricing_rule,
    medication_metadata = v_next.medication_metadata,
    catalog_revision = v_next.catalog_revision,
    customization_state = v_next.customization_state,
    customized_fields = v_next.customized_fields,
    last_customized_at = v_next.last_customized_at,
    last_customized_by_user_id = v_next.last_customized_by_user_id,
    workspace_dispensing_review_status = v_next.workspace_dispensing_review_status,
    workspace_dispensing_review_revision = v_next.workspace_dispensing_review_revision,
    workspace_dispensing_authored_by_user_id = v_next.workspace_dispensing_authored_by_user_id,
    workspace_dispensing_authored_at = v_next.workspace_dispensing_authored_at,
    workspace_dispensing_reviewed_by_user_id = v_next.workspace_dispensing_reviewed_by_user_id,
    workspace_dispensing_reviewed_at = v_next.workspace_dispensing_reviewed_at,
    workspace_dispensing_review_note = v_next.workspace_dispensing_review_note,
    updated_at = v_next.updated_at
  where workspace_id = p_workspace_id and id = p_item_id
  returning * into v_next;

  perform private.clair_pr020_append_order_catalog_audit(
    p_workspace_id,
    case
      when pg_catalog.cardinality(v_changed) = 1
        and 'availabilityStatus' = any(v_changed)
        and v_next.availability_status = 'paused'
        then 'order_catalog.paused'
      else 'order_catalog.updated'
    end,
    v_next.id,
    v_item,
    v_next,
    case
      when pg_catalog.cardinality(v_changed) = 1
        and 'availabilityStatus' = any(v_changed)
        and v_next.availability_status = 'paused'
        then 'pause'
      else 'update'
    end,
    v_changed
  );

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'status', 200,
    'item', pg_catalog.to_jsonb(v_next),
    'databaseAuditWritten', true,
    'enforcedBy', 'clair_update_workspace_dispensing_order'
  );
end;
$function$;

revoke all on function private.clair_update_workspace_dispensing_order(
  text, text, integer, jsonb
) from public, anon, authenticated, service_role;

do $block$
begin
  if pg_catalog.to_regprocedure(
       'public.clair_update_order_catalog_item_pr020_legacy(text,text,integer,jsonb)'
     ) is null
     and pg_catalog.to_regprocedure(
       'public.clair_update_order_catalog_item(text,text,integer,jsonb)'
     ) is not null then
    alter function public.clair_update_order_catalog_item(
      text, text, integer, jsonb
    ) rename to clair_update_order_catalog_item_pr020_legacy;
  end if;
end;
$block$;

-- The renamed dispatcher and its older A2 layers are implementation details.
-- Their former authenticated grants would allow direct callers to skip the
-- PR-020 dispensing-review dispatcher, so only the new public wrapper remains
-- executable by authenticated clients.
revoke all on function public.clair_update_order_catalog_item_pr020_legacy(
  text, text, integer, jsonb
) from public, anon, authenticated, service_role;
revoke all on function public.clair_update_order_catalog_item_a2_base(
  text, text, integer, jsonb
) from public, anon, authenticated, service_role;
revoke all on function public.clair_update_order_catalog_item_a2_unlocked(
  text, text, integer, jsonb
) from public, anon, authenticated, service_role;

create or replace function public.clair_update_order_catalog_item(
  p_workspace_id text,
  p_item_id text,
  p_expected_catalog_revision integer,
  p_patch jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_item public.order_catalog_items%rowtype;
begin
  if auth.uid() is null then
    raise exception 'auth_required' using errcode = '42501';
  end if;

  select * into v_item
  from public.order_catalog_items
  where workspace_id = p_workspace_id and id = p_item_id;
  if not found then
    raise exception 'order_catalog_item_not_found' using errcode = 'P0002';
  end if;
  if v_item.category_group = 'medication'
     and v_item.default_destination_module = 'dispensing' then
    return private.clair_update_workspace_dispensing_order(
      p_workspace_id,
      p_item_id,
      p_expected_catalog_revision,
      p_patch
    );
  end if;
  return public.clair_update_order_catalog_item_pr020_legacy(
    p_workspace_id,
    p_item_id,
    p_expected_catalog_revision,
    p_patch
  );
end;
$function$;

revoke all on function public.clair_update_order_catalog_item(
  text, text, integer, jsonb
) from public, anon, service_role;
grant execute on function public.clair_update_order_catalog_item(
  text, text, integer, jsonb
) to authenticated;

create or replace function public.clair_review_workspace_dispensing_order(
  p_workspace_id text,
  p_item_id text,
  p_expected_catalog_revision integer,
  p_action text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_item public.order_catalog_items%rowtype;
  v_before public.order_catalog_items%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if not private.clair_is_active_workspace_member(p_workspace_id)
     or not private.clair_is_active_veterinarian_member(
       p_workspace_id,
       auth.uid()
     ) then
    raise exception 'veterinarian_required' using errcode = '42501';
  end if;
  if p_action not in ('approve', 'reject')
     or length(coalesce(p_note, '')) > 500 then
    raise exception 'dispensing_review_input_invalid' using errcode = '22023';
  end if;
  select * into v_item
  from public.order_catalog_items
  where workspace_id = p_workspace_id and id = p_item_id
  for update;
  if not found then
    raise exception 'order_catalog_item_not_found' using errcode = 'P0002';
  end if;
  if v_item.origin_type <> 'workspace_custom'
     or v_item.category_group <> 'medication'
     or v_item.default_destination_module <> 'dispensing' then
    raise exception 'dispensing_review_workspace_custom_only' using errcode = '22023';
  end if;
  if v_item.catalog_revision <> p_expected_catalog_revision then
    raise exception 'catalog_revision_conflict' using errcode = '40001';
  end if;
  if v_item.workspace_dispensing_review_status <> 'pending' then
    raise exception 'dispensing_review_not_pending' using errcode = '22023';
  end if;
  v_before := v_item;
  perform private.clair_validate_workspace_dispensing_preset(
    v_item.medication_metadata,
    v_item.price_krw,
    v_item.pricing_rule
  );

  update public.order_catalog_items set
    availability_status = case
      when p_action = 'approve' then 'active'
      else 'paused'
    end,
    workspace_dispensing_review_status = case
      when p_action = 'approve' then 'approved'
      else 'rejected'
    end,
    workspace_dispensing_review_revision =
      workspace_dispensing_review_revision + 1,
    workspace_dispensing_reviewed_by_user_id = auth.uid(),
    workspace_dispensing_reviewed_at = pg_catalog.now(),
    workspace_dispensing_review_note = nullif(pg_catalog.btrim(p_note), ''),
    catalog_revision = catalog_revision + 1,
    updated_at = pg_catalog.now()
  where workspace_id = p_workspace_id and id = p_item_id
  returning * into v_item;

  perform private.clair_pr020_append_order_catalog_audit(
    p_workspace_id,
    case
      when p_action = 'approve' then 'order_catalog.review_approved'
      else 'order_catalog.review_rejected'
    end,
    v_item.id,
    v_before,
    v_item,
    'review',
    array['workspaceDispensingReview', 'availabilityStatus']::text[]
  );

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'status', 200,
    'item', pg_catalog.to_jsonb(v_item),
    'databaseAuditWritten', true,
    'enforcedBy', 'clair_review_workspace_dispensing_order'
  );
end;
$function$;

revoke all on function public.clair_review_workspace_dispensing_order(
  text, text, integer, text, text
) from public, anon, service_role;
grant execute on function public.clair_review_workspace_dispensing_order(
  text, text, integer, text, text
) to authenticated;

-- Use the chosen price basis when freezing a chart order. The existing
-- function already owns workspace membership, classification, availability,
-- and service-review checks; this replacement changes only the amount formula
-- and exposes the basis in the immutable snapshot.
create or replace function private.clair_build_catalog_order_snapshot(
  p_workspace_id text,
  p_catalog_item_id text,
  p_quantity numeric
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  c public.order_catalog_items%rowtype;
  v_billing_category text;
  v_order_type text;
  v_rounding_result numeric;
  v_raw_line_total numeric;
  v_line_total numeric;
  v_path_key text;
  v_path_item_type text;
  v_price_basis text;
  v_service_review_allowed boolean := false;
begin
  if p_quantity is null or p_quantity <= 0 or p_quantity > 9999
     or p_quantity::text = 'NaN' then
    raise exception 'invalid_order_quantity';
  end if;
  select * into c
  from public.order_catalog_items
  where workspace_id = p_workspace_id and id = p_catalog_item_id;
  if not found then raise exception 'catalog_item_unavailable'; end if;
  v_service_review_allowed :=
    private.clair_dispensing_service_review_catalog_item_allowed(
      p_workspace_id,
      c.id
    );
  if c.availability_status <> 'active' and not v_service_review_allowed then
    raise exception 'catalog_item_unavailable';
  end if;
  select path.path_key, action.item_type
    into v_path_key, v_path_item_type
  from master.classification_paths path
  join master.clinical_actions action
    on action.master_record_id = path.clinical_action_id
  where path.id = c.classification_path_id
    and path.retired_in_release_id is null;
  if v_path_key is null or v_path_item_type is distinct from c.category_group then
    raise exception 'catalog_classification_unavailable';
  end if;
  v_billing_category :=
    private.clair_map_catalog_category_to_billing_category(c.category_group);
  if v_billing_category is null then raise exception 'unsupported_category_group'; end if;
  if c.billing_reflection_enabled and c.price_krw is null
     and not v_service_review_allowed then
    raise exception 'billable_price_required';
  end if;
  v_order_type := case c.category_group
    when 'lab' then 'lab'
    when 'imaging' then 'imaging'
    when 'medication' then 'dispensing'
    else 'treatment'
  end;
  v_price_basis := coalesce(c.pricing_rule ->> 'priceBasis', 'unit_price');
  v_raw_line_total := case
    when v_price_basis = 'fixed_order_price' then coalesce(c.price_krw, 0)
    else p_quantity * coalesce(c.price_krw, 0)
  end;
  v_rounding_result := private.clair_round_catalog_order_amount(
    v_raw_line_total,
    c.rounding_rule
  );
  if c.price_krw is null then v_rounding_result := null; end if;
  v_line_total := coalesce(v_rounding_result, v_raw_line_total);

  return pg_catalog.jsonb_build_object(
    'workspaceCatalogItemId', c.id,
    'workspaceCatalogRevision', c.catalog_revision,
    'sourceMasterRecordId', c.source_master_record_id,
    'sourceMasterRevision', c.source_master_revision,
    'classificationPathId', c.classification_path_id,
    'classificationPathKey', v_path_key,
    'sourcePresetId', c.standard_order_id,
    'sourcePresetVersion', c.source_preset_version,
    'standardOrderName', c.standard_order_name,
    'inHospitalOrderName', c.in_hospital_order_name,
    'billingName', c.billing_name,
    'categoryGroup', c.category_group,
    'billingCategory', v_billing_category,
    'orderType', v_order_type,
    'priceKrw', c.price_krw,
    'taxType', case when c.tax_included then 'taxable' else 'non_taxable' end,
    'quantity', p_quantity,
    'lineTotalSnapshot', v_line_total,
    'roundingResultKrw', v_rounding_result,
    'salesUnit', c.sales_unit,
    'amountBasis', v_price_basis,
    'taxIncluded', c.tax_included,
    'roundingRule', c.rounding_rule,
    'targetSpecies', pg_catalog.to_jsonb(c.target_species),
    'destinationModule', c.default_destination_module,
    'taskRequired', c.default_task_required,
    'billingReflectionEnabled', case
      when v_service_review_allowed
        then c.billing_reflection_enabled and c.price_krw is not null
      else c.billing_reflection_enabled
    end,
    'careGuide', c.care_guide,
    'careGuideDeliveryEnabled', c.care_guide_delivery_enabled,
    'internalInstruction', c.internal_instruction,
    'internalInstructionDeliveryEnabled', c.internal_instruction_delivery_enabled,
    'defaultDetailInputs', c.medication_metadata -> 'defaultDetailInputs',
    'medicationMetadata', c.medication_metadata,
    'workspaceDispensingReview', pg_catalog.jsonb_build_object(
      'status', c.workspace_dispensing_review_status,
      'revision', c.workspace_dispensing_review_revision,
      'authoredByUserId', c.workspace_dispensing_authored_by_user_id,
      'authoredAt', c.workspace_dispensing_authored_at,
      'reviewedByUserId', c.workspace_dispensing_reviewed_by_user_id,
      'reviewedAt', c.workspace_dispensing_reviewed_at
    ),
    'rowType', 'individual',
    'priceRuleSource', case
      when v_service_review_allowed then 'workspace_service_review_price'
      else 'catalog_price'
    end,
    'snapshotSource', 'order_catalog_items'
  );
end;
$function$;

revoke all on function private.clair_build_catalog_order_snapshot(
  text, text, numeric
) from public, anon, authenticated, service_role;
