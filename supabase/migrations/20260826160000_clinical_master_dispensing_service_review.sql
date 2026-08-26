-- Make the PR-017 dispensing catalog available for service-operations review
-- in the three synthetic review workspaces without claiming clinical approval.

set lock_timeout = '5s';
set statement_timeout = '120s';

create table if not exists private.clinical_master_dispensing_service_review_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete restrict,
  release_id uuid not null references master.master_releases(id) on delete restrict,
  action text not null check (action in ('enabled', 'revoked')),
  review_mode text not null check (review_mode = 'service_operations_review'),
  actor_user_id uuid not null,
  approval_reference text not null check (length(btrim(approval_reference)) between 1 and 200),
  reason text not null check (length(btrim(reason)) between 1 and 500),
  created_at timestamptz not null default now(),
  unique (workspace_id, release_id, action, approval_reference)
);

alter table private.clinical_master_dispensing_service_review_events
  enable row level security;
revoke all on private.clinical_master_dispensing_service_review_events
  from public, anon, authenticated, service_role;

create or replace function private.reject_clinical_master_dispensing_service_review_event_mutation()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  raise exception 'clinical_master_dispensing_service_review_event_immutable'
    using errcode = '55000';
end;
$function$;

drop trigger if exists clinical_master_dispensing_service_review_event_immutable
  on private.clinical_master_dispensing_service_review_events;
create trigger clinical_master_dispensing_service_review_event_immutable
before update or delete on private.clinical_master_dispensing_service_review_events
for each row execute function private.reject_clinical_master_dispensing_service_review_event_mutation();

revoke all on function private.reject_clinical_master_dispensing_service_review_event_mutation()
  from public, anon, authenticated, service_role;

create or replace function private.clair_dispensing_service_review_allowed(
  p_workspace_id text,
  p_release_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select
    p_workspace_id = any(array[
      'clair-demo'::text,
      'workspace-clair-cheongdam'::text,
      'workspace-clinical-master-pilot-v1'::text
    ])
    and exists (
      select 1
      from master.master_releases release
      where release.id = p_release_id
        and release.status = 'published'
    )
    and coalesce((
      select event.action = 'enabled'
      from private.clinical_master_dispensing_service_review_events event
      where event.workspace_id = p_workspace_id
        and event.release_id = p_release_id
      order by event.created_at desc, event.id desc
      limit 1
    ), false);
$function$;

revoke all on function private.clair_dispensing_service_review_allowed(text, uuid)
  from public, anon, authenticated, service_role;

insert into private.clinical_master_dispensing_service_review_events (
  workspace_id,
  release_id,
  action,
  review_mode,
  actor_user_id,
  approval_reference,
  reason
)
select
  workspace_id,
  '78a57bf0-10a8-47db-9ae1-8a8cff79b2c4'::uuid,
  'enabled',
  'service_operations_review',
  '00000000-0000-4000-8000-000000000001'::uuid,
  'codex-thread-service-review-2026-08-26',
  'Representative approved customer-facing service operations review in synthetic workspaces; not clinical approval.'
from unnest(array[
  'clair-demo'::text,
  'workspace-clair-cheongdam'::text,
  'workspace-clinical-master-pilot-v1'::text
]) workspace_id
on conflict (workspace_id, release_id, action, approval_reference) do nothing;

create or replace function public.clair_list_order_catalog_chart_search_v2(
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
  with base_rows as (
    select *
    from public.clair_list_order_catalog_chart_search_v2_phase2_base(p_workspace_id)
  ),
  service_review_rows as (
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
    join master.dispensing_order_profiles profile
      on profile.id = item.source_dispensing_profile_id
     and profile.profile_revision = item.source_dispensing_profile_revision
    where item.workspace_id = p_workspace_id
      and item.availability_status = 'pending_activation'
      and item.clinical_use_allowed = false
      and private.clair_dispensing_service_review_allowed(
        p_workspace_id,
        profile.source_release_id
      )
      and private.clair_current_user_has_workspace_permission(
        p_workspace_id,
        'service_catalog:view'
      )
  ),
  catalog_rows as (
    select * from base_rows
    union all
    select * from service_review_rows
  )
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
      ) || case
        when catalog.source_dispensing_profile_id is null then '{}'::jsonb
        else jsonb_build_object(
          'dispensingLineage', jsonb_build_object(
            'schemaVersion', 1,
            'sourceDispensingProfileId', catalog.source_dispensing_profile_id,
            'sourceDispensingProfileRevision', catalog.source_dispensing_profile_revision,
            'sourceMedicationProductId', catalog.source_medication_product_id,
            'sourceMedicationProductRevision', catalog.source_medication_product_revision,
            'sourceClinicalReviewId', catalog.source_clinical_review_id,
            'sourceEvidenceFingerprint', catalog.source_evidence_fingerprint,
            'clinicalUseAllowed', catalog.clinical_use_allowed,
            'serviceReviewOnly', (
              not catalog.clinical_use_allowed
              and catalog.availability_status = 'pending_activation'
              and private.clair_dispensing_service_review_allowed(
                p_workspace_id,
                profile.source_release_id
              )
            ),
            'serviceReviewReleaseId', case
              when not catalog.clinical_use_allowed then profile.source_release_id
              else null
            end,
            'dispensingProfileSnapshot', catalog.dispensing_profile_snapshot,
            'dispensingProfileSnapshotSha256', catalog.dispensing_profile_snapshot_sha256
          )
        )
      end
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
  from catalog_rows base
  left join public.order_catalog_items catalog
    on base.row_type = 'individual'
   and catalog.workspace_id = p_workspace_id
   and catalog.id = base.applied_snapshot ->> 'workspaceCatalogItemId'
  left join master.dispensing_order_profiles profile
    on profile.id = catalog.source_dispensing_profile_id
   and profile.profile_revision = catalog.source_dispensing_profile_revision
  where base.row_type = 'set'
     or catalog.source_dispensing_profile_id is null
     or (
       catalog.clinical_use_allowed
       and master.clair_dispensing_profile_clinical_use_allowed(
         catalog.source_dispensing_profile_id,
         catalog.source_dispensing_profile_revision
       )
     )
     or (
       catalog.availability_status = 'pending_activation'
       and catalog.clinical_use_allowed = false
       and private.clair_dispensing_service_review_allowed(
         p_workspace_id,
         profile.source_release_id
       )
     );
$function$;

revoke all on function public.clair_list_order_catalog_chart_search_v2(text)
  from public, anon, service_role;
grant execute on function public.clair_list_order_catalog_chart_search_v2(text)
  to authenticated;

create or replace function private.clair_set_dispensing_order_lineage()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_catalog public.order_catalog_items%rowtype;
  v_lineage jsonb;
  v_patient_species text;
  v_requested_route text;
  v_master_species_approved boolean;
  v_source_release_id uuid;
  v_service_review_allowed boolean := false;
begin
  if new.workspace_catalog_item_id is null then
    return new;
  end if;

  select catalog.*
  into v_catalog
  from public.order_catalog_items catalog
  where catalog.workspace_id = new.workspace_id
    and catalog.id = new.workspace_catalog_item_id;

  if not found then
    raise exception 'clinical_master_dispensing_catalog_unavailable' using errcode = '23503';
  end if;

  if v_catalog.source_dispensing_profile_id is null then
    if tg_op = 'INSERT' or old.order_confirmation_status in ('draft', 'pending') then
      new.applied_snapshot := coalesce(new.applied_snapshot, '{}'::jsonb) - 'dispensingLineage';
    end if;
    return new;
  end if;

  select profile.source_release_id
  into v_source_release_id
  from master.dispensing_order_profiles profile
  where profile.id = v_catalog.source_dispensing_profile_id
    and profile.profile_revision = v_catalog.source_dispensing_profile_revision;
  v_service_review_allowed := private.clair_dispensing_service_review_allowed(
    new.workspace_id,
    v_source_release_id
  );

  if new.clinical_order_type is distinct from 'dispensing'
    or new.destination_module is distinct from 'dispensing'
    or new.workspace_catalog_revision is distinct from v_catalog.catalog_revision
    or new.source_master_record_id is distinct from v_catalog.source_master_record_id
    or new.source_master_revision is distinct from v_catalog.source_master_revision then
    raise exception 'clinical_master_dispensing_order_lineage_mismatch' using errcode = '23514';
  end if;

  select patient.species
  into v_patient_species
  from public.encounters encounter
  join public.patients patient
    on patient.workspace_id = encounter.workspace_id
   and patient.id = encounter.patient_id
  where encounter.workspace_id = new.workspace_id
    and encounter.id = new.encounter_id;
  if v_patient_species is null
    or not (v_patient_species = any(v_catalog.target_species)) then
    raise exception 'clinical_master_dispensing_species_incompatible' using errcode = '23514';
  end if;

  select exists (
    select 1
    from master.medication_species_applicability applicability
    join master.species species
      on species.master_record_id = applicability.species_record_id
    where applicability.product_id = v_catalog.source_medication_product_id
      and applicability.product_revision = v_catalog.source_medication_product_revision
      and species.species_code = v_patient_species
      and applicability.evidence_mode = 'direct'
      and applicability.review_status = 'approved'
  )
  into v_master_species_approved;

  if not v_master_species_approved
    and (tg_op = 'INSERT' or old.order_confirmation_status in ('draft', 'pending')) then
    if new.detail_inputs ->> 'extraLabelSpeciesConfirmed' is distinct from 'true'
      or length(pg_catalog.btrim(coalesce(
        new.detail_inputs ->> 'extraLabelSpeciesReason',
        ''
      ))) = 0
      or length(new.detail_inputs ->> 'extraLabelSpeciesReason') > 500 then
      raise exception 'clinical_master_dispensing_species_override_confirmation_required'
        using errcode = '23514';
    end if;
    if not private.clair_is_active_veterinarian_member(
      new.workspace_id,
      auth.uid()
    ) then
      raise exception 'clinical_master_dispensing_species_override_veterinarian_required'
        using errcode = '42501';
    end if;
  end if;

  if nullif(pg_catalog.btrim(new.detail_inputs ->> 'route'), '') is not null then
    v_requested_route := case pg_catalog.upper(pg_catalog.btrim(new.detail_inputs ->> 'route'))
      when 'PO' then 'oral'
      when 'TOPICAL' then 'cutaneous'
      when 'OTIC' then 'otic'
      when 'OPHTHALMIC' then 'ophthalmic'
      else pg_catalog.lower(pg_catalog.btrim(new.detail_inputs ->> 'route'))
    end;
    if not exists (
      select 1
      from pg_catalog.jsonb_array_elements_text(
        coalesce(v_catalog.dispensing_profile_snapshot -> 'routes', '[]'::jsonb)
      ) route(value)
      where route.value = v_requested_route
    ) or not exists (
      select 1
      from master.dispensing_order_profiles profile
      where profile.id = v_catalog.source_dispensing_profile_id
        and profile.profile_revision = v_catalog.source_dispensing_profile_revision
        and v_requested_route = any(profile.allowed_routes)
    ) then
      raise exception 'clinical_master_dispensing_route_incompatible' using errcode = '23514';
    end if;
  end if;

  v_lineage := jsonb_build_object(
    'schemaVersion', 1,
    'sourceDispensingProfileId', v_catalog.source_dispensing_profile_id,
    'sourceDispensingProfileRevision', v_catalog.source_dispensing_profile_revision,
    'sourceMedicationProductId', v_catalog.source_medication_product_id,
    'sourceMedicationProductRevision', v_catalog.source_medication_product_revision,
    'sourceClinicalReviewId', v_catalog.source_clinical_review_id,
    'sourceEvidenceFingerprint', v_catalog.source_evidence_fingerprint,
    'clinicalUseAllowed', v_catalog.clinical_use_allowed,
    'serviceReviewOnly', v_service_review_allowed and not v_catalog.clinical_use_allowed,
    'serviceReviewReleaseId', case
      when v_service_review_allowed and not v_catalog.clinical_use_allowed
        then v_source_release_id
      else null
    end,
    'patientSpecies', v_patient_species,
    'speciesUseBasis', case
      when v_master_species_approved then 'master_reviewed'
      else 'workspace_extra_label_override'
    end,
    'extraLabelSpeciesAttestation', case
      when v_master_species_approved then null
      else pg_catalog.jsonb_build_object(
        'actorUserId', auth.uid(),
        'reason', pg_catalog.btrim(new.detail_inputs ->> 'extraLabelSpeciesReason')
      )
    end,
    'dispensingProfileSnapshot', v_catalog.dispensing_profile_snapshot,
    'dispensingProfileSnapshotSha256', v_catalog.dispensing_profile_snapshot_sha256
  );

  if tg_op = 'INSERT' or old.order_confirmation_status in ('draft', 'pending') then
    if not (
      (
        v_catalog.availability_status = 'active'
        and v_catalog.clinical_use_allowed
        and v_catalog.source_clinical_review_id is not null
        and master.clair_dispensing_profile_clinical_use_allowed(
          v_catalog.source_dispensing_profile_id,
          v_catalog.source_dispensing_profile_revision
        )
      )
      or (
        v_catalog.availability_status = 'pending_activation'
        and not v_catalog.clinical_use_allowed
        and v_service_review_allowed
      )
    ) then
      raise exception 'clinical_master_dispensing_clinical_review_required' using errcode = '42501';
    end if;
    new.applied_snapshot := coalesce(new.applied_snapshot, '{}'::jsonb)
      || jsonb_build_object('dispensingLineage', v_lineage);
    if new.applied_snapshot_schema_version = 1
      and new.applied_snapshot_sha256 is not null then
      new.applied_snapshot_sha256 := private.clair_b3_sha256(jsonb_build_object(
        'appliedSnapshot', new.applied_snapshot,
        'appliedPriceSnapshot', new.applied_price_snapshot,
        'calculationInputs', new.calculation_inputs,
        'calculationOutputs', new.calculation_outputs
      ));
    end if;
  elsif new.applied_snapshot -> 'dispensingLineage'
      is distinct from old.applied_snapshot -> 'dispensingLineage' then
    raise exception 'clinical_master_dispensing_confirmed_lineage_immutable' using errcode = '55000';
  end if;

  if new.confirmed_snapshot <> '{}'::jsonb
    and new.confirmed_snapshot -> 'dispensingLineage'
      is distinct from new.applied_snapshot -> 'dispensingLineage' then
    raise exception 'clinical_master_dispensing_confirmed_lineage_mismatch' using errcode = '23514';
  end if;

  return new;
end;
$function$;

revoke all on function private.clair_set_dispensing_order_lineage()
  from public, anon, authenticated, service_role;

comment on table private.clinical_master_dispensing_service_review_events is
  'Append-only representative authorization for synthetic service operations review. It does not assert clinical approval.';
