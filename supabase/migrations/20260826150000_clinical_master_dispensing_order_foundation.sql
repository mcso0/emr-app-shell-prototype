-- CLINICAL-MASTER-PR-017 / Phase 7 local foundation.
-- Additive schema only: no release payload, workspace adoption, activation, or remote application.

set lock_timeout = '5s';
set statement_timeout = '120s';

-- Extend the already-deployed v1 detail schema without rewriting its historical
-- migration. The base function remains private; every existing caller keeps the
-- canonical function name and receives the two audited extra-label fields only
-- for dispensing orders.
do $migration$
begin
  if pg_catalog.to_regprocedure(
    'private.clair_order_detail_field_schema_v1_base(text)'
  ) is null then
    alter function private.clair_order_detail_field_schema_v1(text)
      rename to clair_order_detail_field_schema_v1_base;
  end if;
end;
$migration$;

create or replace function private.clair_order_detail_field_schema_v1(
  p_clinical_order_type text
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, private
as $function$
  with base as (
    select private.clair_order_detail_field_schema_v1_base(
      p_clinical_order_type
    ) as schema
  )
  select case
    when p_clinical_order_type <> 'dispensing' then base.schema
    else base.schema || pg_catalog.jsonb_build_object(
      'fields',
      (base.schema -> 'fields') || pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_object(
          'key', 'extraLabelSpeciesConfirmed',
          'valueType', 'boolean',
          'label', '병원 종 범위 예외 확인',
          'control', 'switch',
          'unit', null,
          'options', '[]'::jsonb,
          'displayOrder', 140,
          'required', false,
          'defaultValue', 'false'::jsonb,
          'validation', '{}'::jsonb,
          'placement', 'detail',
          'bulkEditable', false,
          'semantics', 'clinical',
          'preConfirmEditable', true,
          'postConfirmBehavior', 'amendment',
          'snapshotPath', 'detailInputs.extraLabelSpeciesConfirmed'
        ),
        pg_catalog.jsonb_build_object(
          'key', 'extraLabelSpeciesReason',
          'valueType', 'string',
          'label', '종 범위 예외 사유',
          'control', 'textarea',
          'unit', null,
          'options', '[]'::jsonb,
          'displayOrder', 150,
          'required', false,
          'defaultValue', null,
          'validation', '{"maxLength":500}'::jsonb,
          'placement', 'detail',
          'bulkEditable', false,
          'semantics', 'clinical',
          'preConfirmEditable', true,
          'postConfirmBehavior', 'amendment',
          'snapshotPath', 'detailInputs.extraLabelSpeciesReason'
        )
      )
    )
  end
  from base;
$function$;

revoke all on function private.clair_order_detail_field_schema_v1_base(text)
  from public, anon, authenticated, service_role;
revoke all on function private.clair_order_detail_field_schema_v1(text)
  from public, anon, authenticated, service_role;

create or replace function private.clair_is_active_veterinarian_member(
  p_workspace_id text,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select p_user_id is not null and exists (
    select 1
    from public.user_memberships membership
    where membership.workspace_id = p_workspace_id
      and membership.user_id = p_user_id
      and membership.status = 'active'
      and (
        membership.roles @> array['vet']::text[]
        or exists (
          select 1
          from public.workspace_membership_job_position_assignments assignment
          join public.workspace_job_positions position
            on position.id = assignment.job_position_id
           and position.workspace_id = assignment.workspace_id
          where assignment.workspace_id = membership.workspace_id
            and assignment.membership_id = membership.id
            and position.position_key = 'veterinarian'
            and position.is_active
        )
      )
  );
$function$;

revoke all on function private.clair_is_active_veterinarian_member(text, uuid)
  from public, anon, authenticated, service_role;

-- Keep fulfillment as the operational queue state while exposing the linked
-- universal Task state independently. Patient identity is read from the
-- workspace-scoped encounter instead of being copied into mutable queue data.
create or replace function public.clair_list_fulfillment_work_items(
  p_workspace_id text,
  p_queue_type text,
  p_encounter_id uuid default null,
  p_order_id uuid default null,
  p_status text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_rows jsonb;
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;
  if p_queue_type not in (
    'consultation','lab','imaging','external_lab','dispensing',
    'treatment','hospitalization','other'
  ) then
    raise exception 'unsupported_order_type';
  end if;
  if not private.clair_current_user_has_workspace_permission(
    p_workspace_id,
    private.clair_queue_permission_for_destination(p_queue_type, 'read')
  ) then
    raise exception 'permission_missing';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', item.id,
    'workspaceId', item.workspace_id,
    'patientId', encounter.patient_id,
    'encounterId', item.encounter_id,
    'orderId', item.order_id,
    'taskId', item.task_id,
    'taskAttemptNo', item.task_attempt_no,
    'taskStatus', task.status,
    'clinicalOrderType', item.clinical_order_type,
    'destinationModule', item.destination_module,
    'orderType', item.order_type,
    'queueType', item.queue_type,
    'status', item.status,
    'priority', item.priority,
    'requestedByUserId', item.requested_by_user_id,
    'assignedToUserId', item.assigned_to_user_id,
    'dueAt', item.due_at,
    'completedAt', item.completed_at,
    'cancelledAt', item.cancelled_at,
    'returnedAt', item.returned_at,
    'reason', item.reason,
    'sourceSnapshot', item.source_snapshot,
    'createdAt', item.created_at,
    'updatedAt', item.updated_at
  ) order by item.updated_at desc, item.id), '[]'::jsonb)
  into v_rows
  from public.order_fulfillment_work_items item
  join public.encounters encounter
    on encounter.workspace_id = item.workspace_id
   and encounter.id = item.encounter_id
  left join public.order_tasks task
    on task.workspace_id = item.workspace_id
   and task.id = item.task_id
   and task.attempt_no = item.task_attempt_no
  where item.workspace_id = p_workspace_id
    and item.queue_type = p_queue_type
    and (p_encounter_id is null or item.encounter_id = p_encounter_id)
    and (p_order_id is null or item.order_id = p_order_id)
    and (p_status is null or item.status = p_status);
  return v_rows;
end;
$function$;

revoke all on function public.clair_list_fulfillment_work_items(text,text,uuid,uuid,text)
  from public, anon;
grant execute on function public.clair_list_fulfillment_work_items(text,text,uuid,uuid,text)
  to authenticated;

create table if not exists master.medication_ingredients (
  id uuid primary key default extensions.gen_random_uuid(),
  ingredient_key text not null,
  revision integer not null check (revision > 0),
  normalized_english_name text not null check (length(pg_catalog.btrim(normalized_english_name)) > 0),
  korean_name text,
  korean_review_status text not null default 'pending'
    check (korean_review_status in ('pending', 'approved', 'rejected')),
  lifecycle_status text not null
    check (lifecycle_status in ('technical_validated', 'clinical_review_pending', 'approved', 'blocked')),
  source_release_id uuid not null references master.master_releases(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (ingredient_key, revision),
  unique (id, revision),
  check (ingredient_key = pg_catalog.lower(pg_catalog.btrim(ingredient_key))),
  check (korean_review_status <> 'approved' or length(pg_catalog.btrim(coalesce(korean_name, ''))) > 0)
);

create table if not exists master.evidence_documents (
  id uuid primary key default extensions.gen_random_uuid(),
  document_key text not null,
  revision integer not null check (revision > 0),
  authority text not null check (length(pg_catalog.btrim(authority)) > 0),
  jurisdiction text not null check (length(pg_catalog.btrim(jurisdiction)) > 0),
  document_type text not null check (document_type in ('spc', 'official_label', 'official_database', 'guideline', 'regulation')),
  source_uri text not null check (source_uri ~ '^https://'),
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  page_count integer check (page_count is null or page_count > 0),
  source_revision text,
  accessed_at date not null,
  lifecycle_status text not null default 'captured'
    check (lifecycle_status in ('captured', 'superseded', 'blocked')),
  source_release_id uuid not null references master.master_releases(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (document_key, revision),
  unique (id, revision),
  unique (content_sha256)
);

create table if not exists master.medication_products (
  id uuid primary key default extensions.gen_random_uuid(),
  product_key text not null,
  revision integer not null check (revision > 0),
  authority text not null check (length(pg_catalog.btrim(authority)) > 0),
  source_jurisdiction text not null check (length(pg_catalog.btrim(source_jurisdiction)) > 0),
  source_product_id text not null check (length(pg_catalog.btrim(source_product_id)) > 0),
  authorization_number text,
  authorization_territory text,
  distribution_category text,
  english_product_name text not null check (length(pg_catalog.btrim(english_product_name)) > 0),
  korean_draft_name text,
  korean_review_status text not null default 'pending'
    check (korean_review_status in ('pending', 'approved', 'rejected')),
  dosage_form text not null check (length(pg_catalog.btrim(dosage_form)) > 0),
  routes text[] not null,
  strength_snapshot jsonb not null check (jsonb_typeof(strength_snapshot) = 'array'),
  atcvet_code text,
  coverage_category text not null check (length(pg_catalog.btrim(coverage_category)) > 0),
  manufactured boolean not null default true,
  compounded boolean not null default false,
  lifecycle_status text not null
    check (lifecycle_status in ('technical_validated', 'clinical_review_pending', 'approved', 'blocked')),
  source_release_id uuid not null references master.master_releases(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (product_key, revision),
  unique (id, revision),
  unique (authority, source_jurisdiction, source_product_id, revision),
  check (product_key = pg_catalog.lower(pg_catalog.btrim(product_key))),
  check (pg_catalog.cardinality(routes) > 0),
  check (routes <@ array['oral','cutaneous','ophthalmic','otic','oromucosal','transdermal','inhalation','nasal','parenteral','other']::text[]),
  check (manufactured and not compounded),
  check (korean_review_status <> 'approved' or length(pg_catalog.btrim(coalesce(korean_draft_name, ''))) > 0)
);

create table if not exists master.medication_product_ingredients (
  product_id uuid not null,
  product_revision integer not null check (product_revision > 0),
  ingredient_id uuid not null,
  ingredient_revision integer not null check (ingredient_revision > 0),
  ordinal integer not null check (ordinal > 0),
  strength_kind text not null check (strength_kind in ('presentation', 'concentration', 'unpaired')),
  numerator_value numeric,
  numerator_unit text,
  denominator_value numeric,
  denominator_unit text,
  evidence_mode text not null check (evidence_mode in ('direct', 'inferred', 'not_found')),
  pairing_status text not null check (pairing_status in ('ordinal_direct_pending_review', 'manual_review_required', 'approved')),
  source_release_id uuid not null references master.master_releases(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (product_id, product_revision, ordinal),
  unique (product_id, product_revision, ingredient_id, ingredient_revision),
  foreign key (product_id, product_revision)
    references master.medication_products(id, revision) on delete restrict,
  foreign key (ingredient_id, ingredient_revision)
    references master.medication_ingredients(id, revision) on delete restrict,
  check ((strength_kind = 'unpaired') = (numerator_value is null)),
  check ((numerator_value is null) = (numerator_unit is null)),
  check ((denominator_value is null) = (denominator_unit is null)),
  check (numerator_value is null or numerator_value > 0),
  check (denominator_value is null or denominator_value > 0),
  check ((strength_kind = 'concentration') = (denominator_unit is not null)),
  check (pairing_status <> 'approved' or evidence_mode = 'direct')
);

create table if not exists master.medication_species_applicability (
  product_id uuid not null,
  product_revision integer not null check (product_revision > 0),
  species_record_id uuid not null references master.species(master_record_id) on delete restrict,
  evidence_mode text not null check (evidence_mode in ('direct', 'inferred', 'not_found')),
  review_status text not null default 'pending' check (review_status in ('pending', 'approved', 'rejected')),
  source_release_id uuid not null references master.master_releases(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (product_id, product_revision, species_record_id),
  foreign key (product_id, product_revision)
    references master.medication_products(id, revision) on delete restrict,
  check (review_status <> 'approved' or evidence_mode = 'direct')
);

create table if not exists master.medication_product_handling (
  product_id uuid not null,
  product_revision integer not null check (product_revision > 0),
  packaged_shelf_life_value numeric,
  packaged_shelf_life_unit text,
  opened_shelf_life_value numeric,
  opened_shelf_life_unit text,
  storage_codes text[] not null default '{}',
  beyond_use_date_rule jsonb,
  extraction_status text not null check (extraction_status in ('direct_spc_text_clinical_review_pending', 'approved', 'not_found')),
  source_release_id uuid not null references master.master_releases(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (product_id, product_revision),
  foreign key (product_id, product_revision)
    references master.medication_products(id, revision) on delete restrict,
  check ((packaged_shelf_life_value is null) = (packaged_shelf_life_unit is null)),
  check ((opened_shelf_life_value is null) = (opened_shelf_life_unit is null)),
  check (packaged_shelf_life_value is null or packaged_shelf_life_value > 0),
  check (opened_shelf_life_value is null or opened_shelf_life_value > 0),
  check (beyond_use_date_rule is null)
);

create table if not exists master.dispensing_order_profiles (
  id uuid primary key default extensions.gen_random_uuid(),
  profile_key text not null,
  profile_revision integer not null check (profile_revision > 0),
  order_record_id uuid not null,
  order_record_revision integer not null check (order_record_revision > 0),
  product_id uuid not null,
  product_revision integer not null check (product_revision > 0),
  allowed_routes text[] not null,
  prescription_default_status text not null default 'none'
    check (prescription_default_status in ('none', 'reviewed')),
  prescription_defaults jsonb,
  korean_translation_review_status text not null default 'pending'
    check (korean_translation_review_status in ('pending', 'approved', 'rejected')),
  evidence_fingerprint text not null check (evidence_fingerprint ~ '^[0-9a-f]{64}$'),
  lifecycle_status text not null
    check (lifecycle_status in ('technical_validated', 'clinical_review_pending', 'approved', 'blocked')),
  source_release_id uuid not null references master.master_releases(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (profile_key, profile_revision),
  unique (id, profile_revision),
  unique (order_record_id, order_record_revision),
  foreign key (order_record_id, order_record_revision)
    references master.master_record_versions(master_record_id, revision) on delete restrict,
  foreign key (order_record_id)
    references master.orders(master_record_id) on delete restrict,
  foreign key (product_id, product_revision)
    references master.medication_products(id, revision) on delete restrict,
  check (profile_key = pg_catalog.lower(pg_catalog.btrim(profile_key))),
  check (pg_catalog.cardinality(allowed_routes) > 0),
  check (allowed_routes <@ array['oral','cutaneous','ophthalmic','otic','oromucosal','transdermal','inhalation','nasal','parenteral','other']::text[]),
  check ((prescription_default_status = 'none' and prescription_defaults is null)
    or (prescription_default_status = 'reviewed' and jsonb_typeof(prescription_defaults) = 'object'))
);

create table if not exists master.evidence_assertions (
  id uuid primary key default extensions.gen_random_uuid(),
  assertion_key text not null unique check (length(pg_catalog.btrim(assertion_key)) > 0),
  product_id uuid,
  product_revision integer,
  dispensing_profile_id uuid,
  dispensing_profile_revision integer,
  field_path text not null check (length(pg_catalog.btrim(field_path)) > 0),
  evidence_document_id uuid not null,
  evidence_document_revision integer not null check (evidence_document_revision > 0),
  evidence_mode text not null check (evidence_mode in ('direct', 'inferred', 'not_found')),
  locator text not null check (length(pg_catalog.btrim(locator)) > 0),
  extraction_status text not null
    check (extraction_status in ('technical_validated', 'clinical_review_pending', 'approved', 'rejected')),
  source_release_id uuid not null references master.master_releases(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (product_id, product_revision)
    references master.medication_products(id, revision) on delete restrict,
  foreign key (dispensing_profile_id, dispensing_profile_revision)
    references master.dispensing_order_profiles(id, profile_revision) on delete restrict,
  foreign key (evidence_document_id, evidence_document_revision)
    references master.evidence_documents(id, revision) on delete restrict,
  check ((product_id is null) = (product_revision is null)),
  check ((dispensing_profile_id is null) = (dispensing_profile_revision is null)),
  check (pg_catalog.num_nonnulls(product_id, dispensing_profile_id) = 1),
  unique nulls not distinct (product_id, product_revision, dispensing_profile_id, dispensing_profile_revision, field_path, evidence_document_id, evidence_document_revision)
);

create table if not exists master.clinical_reviews (
  id uuid primary key default extensions.gen_random_uuid(),
  review_key text not null unique check (length(pg_catalog.btrim(review_key)) > 0),
  dispensing_profile_id uuid not null,
  dispensing_profile_revision integer not null check (dispensing_profile_revision > 0),
  decision text not null check (decision in ('pending', 'approved', 'rejected', 'superseded')),
  reviewer_user_id uuid references public.users(id) on delete restrict,
  reviewer_eligibility jsonb not null default '{}'::jsonb check (jsonb_typeof(reviewer_eligibility) = 'object'),
  decision_reason text,
  reviewed_at timestamptz,
  supersedes_review_id uuid references master.clinical_reviews(id) on delete restrict,
  source_release_id uuid not null references master.master_releases(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (dispensing_profile_id, dispensing_profile_revision)
    references master.dispensing_order_profiles(id, profile_revision) on delete restrict,
  check (decision <> 'approved' or (
    reviewer_user_id is not null
    and reviewer_eligibility ->> 'eligible' = 'true'
    and reviewed_at is not null
  )),
  check (decision not in ('rejected', 'superseded') or length(pg_catalog.btrim(coalesce(decision_reason, ''))) > 0),
  check (decision <> 'superseded' or supersedes_review_id is not null)
);

create table if not exists master.medication_regulatory_profiles (
  id uuid primary key default extensions.gen_random_uuid(),
  regulatory_key text not null,
  revision integer not null check (revision > 0),
  product_id uuid not null,
  product_revision integer not null check (product_revision > 0),
  jurisdiction text not null check (length(pg_catalog.btrim(jurisdiction)) > 0),
  authorization_status text not null check (authorization_status in ('not_verified', 'approved', 'rejected')),
  controlled_status text not null check (controlled_status in ('not_screened', 'not_controlled', 'controlled', 'excluded')),
  policy_version text,
  review_status text not null check (review_status in ('pending', 'approved', 'rejected')),
  reviewer_user_id uuid references public.users(id) on delete restrict,
  reviewed_at timestamptz,
  source_release_id uuid not null references master.master_releases(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (regulatory_key, revision),
  unique (id, revision),
  unique (product_id, product_revision, jurisdiction, revision),
  foreign key (product_id, product_revision)
    references master.medication_products(id, revision) on delete restrict,
  check (review_status <> 'approved' or (
    authorization_status = 'approved'
    and controlled_status in ('not_controlled', 'excluded')
    and reviewer_user_id is not null
    and reviewed_at is not null
  ))
);

create table if not exists private.clinical_master_dispensing_release_payloads (
  release_id uuid primary key references master.master_releases(id) on delete restrict,
  schema_version integer not null check (schema_version = 1),
  dataset_revision text not null check (length(pg_catalog.btrim(dataset_revision)) > 0),
  source_dataset_sha256 text not null check (source_dataset_sha256 ~ '^[0-9a-f]{64}$'),
  payload_sha256 text not null unique check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  record_count integer not null check (record_count >= 100),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now()
);

create table if not exists private.clinical_master_dispensing_species_override_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  catalog_item_id text not null,
  actor_user_id uuid,
  before_species text[] not null,
  after_species text[] not null,
  reason_code text not null default 'workspace_admin_species_customization'
    check (reason_code = 'workspace_admin_species_customization'),
  source_dispensing_profile_id uuid not null,
  source_dispensing_profile_revision integer not null check (source_dispensing_profile_revision > 0),
  catalog_revision integer not null check (catalog_revision > 0),
  created_at timestamptz not null default now()
);

create index if not exists medication_products_source_identity_idx
  on master.medication_products (authority, source_jurisdiction, source_product_id, revision desc);
create index if not exists medication_product_ingredients_ingredient_idx
  on master.medication_product_ingredients (ingredient_id, ingredient_revision, product_id);
create index if not exists medication_species_applicability_species_idx
  on master.medication_species_applicability (species_record_id, product_id, product_revision);
create index if not exists dispensing_order_profiles_product_idx
  on master.dispensing_order_profiles (product_id, product_revision, profile_revision desc);
create index if not exists evidence_assertions_product_field_idx
  on master.evidence_assertions (product_id, product_revision, field_path);
create index if not exists evidence_assertions_profile_field_idx
  on master.evidence_assertions (dispensing_profile_id, dispensing_profile_revision, field_path);
create index if not exists clinical_reviews_profile_decision_idx
  on master.clinical_reviews (dispensing_profile_id, dispensing_profile_revision, decision, reviewed_at desc);
create index if not exists medication_regulatory_profiles_product_jurisdiction_idx
  on master.medication_regulatory_profiles (product_id, product_revision, jurisdiction, revision desc);

create or replace function master.clair_dispensing_profile_clinical_use_allowed(
  p_profile_id uuid,
  p_profile_revision integer
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from master.dispensing_order_profiles profile
    join master.medication_products product
      on product.id = profile.product_id
     and product.revision = profile.product_revision
    join master.master_records order_record
      on order_record.id = profile.order_record_id
    where profile.id = p_profile_id
      and profile.profile_revision = p_profile_revision
      and profile.lifecycle_status = 'approved'
      and profile.korean_translation_review_status = 'approved'
      and product.lifecycle_status = 'approved'
      and product.korean_review_status = 'approved'
      and profile.allowed_routes <@ product.routes
      and order_record.lifecycle_status = 'published'
      and order_record.safety_status = 'normal'
      and exists (
        select 1
        from master.clinical_reviews review
        where review.dispensing_profile_id = profile.id
          and review.dispensing_profile_revision = profile.profile_revision
          and review.decision = 'approved'
          and review.reviewer_user_id is not null
          and review.reviewer_eligibility ->> 'eligible' = 'true'
          and review.reviewed_at is not null
          and not exists (
            select 1
            from master.clinical_reviews later_review
            where later_review.supersedes_review_id = review.id
          )
      )
      and exists (
        select 1
        from master.medication_regulatory_profiles regulatory
        where regulatory.product_id = product.id
          and regulatory.product_revision = product.revision
          and regulatory.jurisdiction = 'KR'
          and regulatory.revision = (
            select pg_catalog.max(latest_regulatory.revision)
            from master.medication_regulatory_profiles latest_regulatory
            where latest_regulatory.product_id = product.id
              and latest_regulatory.product_revision = product.revision
              and latest_regulatory.jurisdiction = 'KR'
          )
          and regulatory.authorization_status = 'approved'
          and regulatory.controlled_status = 'not_controlled'
          and regulatory.review_status = 'approved'
          and regulatory.reviewer_user_id is not null
          and regulatory.reviewed_at is not null
      )
      and exists (
        select 1
        from master.medication_product_ingredients ingredient
        where ingredient.product_id = product.id
          and ingredient.product_revision = product.revision
      )
      and not exists (
        select 1
        from master.medication_product_ingredients ingredient
        where ingredient.product_id = product.id
          and ingredient.product_revision = product.revision
          and (
            ingredient.pairing_status <> 'approved'
            or ingredient.evidence_mode <> 'direct'
          )
      )
      and exists (
        select 1
        from master.medication_species_applicability species_link
        where species_link.product_id = product.id
          and species_link.product_revision = product.revision
          and species_link.evidence_mode = 'direct'
          and species_link.review_status = 'approved'
      )
      and not exists (
        select required.field_path
        from (values
          ('product.identity'),
          ('product.strength'),
          ('product.dosageForm'),
          ('product.route'),
          ('product.targetSpecies'),
          ('handling.storage')
        ) required(field_path)
        where not exists (
          select 1
          from master.evidence_assertions assertion
          join master.evidence_documents document
            on document.id = assertion.evidence_document_id
           and document.revision = assertion.evidence_document_revision
          where assertion.product_id = product.id
            and assertion.product_revision = product.revision
            and assertion.field_path = required.field_path
            and assertion.evidence_mode = 'direct'
            and assertion.extraction_status = 'approved'
            and document.lifecycle_status = 'captured'
        )
      )
  );
$$;

create or replace function master.reject_dispensing_master_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'clinical_master_dispensing_revision_immutable' using errcode = '55000';
end;
$$;

create or replace function private.reject_clinical_master_dispensing_payload_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'clinical_master_dispensing_release_payload_immutable' using errcode = '55000';
end;
$$;

create or replace function private.reject_clinical_master_dispensing_audit_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'clinical_master_dispensing_species_override_audit_immutable'
    using errcode = '55000';
end;
$$;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'medication_ingredients',
    'evidence_documents',
    'medication_products',
    'medication_product_ingredients',
    'medication_species_applicability',
    'medication_product_handling',
    'dispensing_order_profiles',
    'evidence_assertions',
    'clinical_reviews',
    'medication_regulatory_profiles'
  ] loop
    execute pg_catalog.format('drop trigger if exists %I on master.%I', v_table || '_immutable', v_table);
    execute pg_catalog.format(
      'create trigger %I before update or delete on master.%I for each row execute function master.reject_dispensing_master_mutation()',
      v_table || '_immutable',
      v_table
    );
  end loop;
end;
$$;

drop trigger if exists clinical_master_dispensing_release_payload_immutable
  on private.clinical_master_dispensing_release_payloads;
create trigger clinical_master_dispensing_release_payload_immutable
before update or delete on private.clinical_master_dispensing_release_payloads
for each row execute function private.reject_clinical_master_dispensing_payload_mutation();

drop trigger if exists clinical_master_dispensing_species_override_audit_immutable
  on private.clinical_master_dispensing_species_override_events;
create trigger clinical_master_dispensing_species_override_audit_immutable
before update or delete on private.clinical_master_dispensing_species_override_events
for each row execute function private.reject_clinical_master_dispensing_audit_mutation();

alter table master.medication_ingredients enable row level security;
alter table master.evidence_documents enable row level security;
alter table master.medication_products enable row level security;
alter table master.medication_product_ingredients enable row level security;
alter table master.medication_species_applicability enable row level security;
alter table master.medication_product_handling enable row level security;
alter table master.dispensing_order_profiles enable row level security;
alter table master.evidence_assertions enable row level security;
alter table master.clinical_reviews enable row level security;
alter table master.medication_regulatory_profiles enable row level security;
alter table private.clinical_master_dispensing_release_payloads enable row level security;
alter table private.clinical_master_dispensing_species_override_events enable row level security;

revoke all on master.medication_ingredients,
  master.evidence_documents,
  master.medication_products,
  master.medication_product_ingredients,
  master.medication_species_applicability,
  master.medication_product_handling,
  master.dispensing_order_profiles,
  master.evidence_assertions,
  master.clinical_reviews,
  master.medication_regulatory_profiles
from public, anon, authenticated, service_role;
revoke all on private.clinical_master_dispensing_release_payloads
from public, anon, authenticated, service_role;
revoke all on private.clinical_master_dispensing_species_override_events
from public, anon, authenticated, service_role;
revoke all on function master.clair_dispensing_profile_clinical_use_allowed(uuid, integer)
from public, anon, authenticated, service_role;
revoke all on function master.reject_dispensing_master_mutation()
from public, anon, authenticated, service_role;
revoke all on function private.reject_clinical_master_dispensing_payload_mutation()
from public, anon, authenticated, service_role;
revoke all on function private.reject_clinical_master_dispensing_audit_mutation()
from public, anon, authenticated, service_role;

alter table public.order_catalog_items
  add column if not exists source_dispensing_profile_id uuid,
  add column if not exists source_dispensing_profile_revision integer,
  add column if not exists source_medication_product_id uuid,
  add column if not exists source_medication_product_revision integer,
  add column if not exists source_clinical_review_id uuid,
  add column if not exists source_evidence_fingerprint text,
  add column if not exists clinical_use_allowed boolean not null default false,
  add column if not exists dispensing_profile_snapshot jsonb,
  add column if not exists dispensing_profile_snapshot_sha256 text;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'order_catalog_items_dispensing_profile_fk'
      and conrelid = 'public.order_catalog_items'::regclass
  ) then
    alter table public.order_catalog_items
      add constraint order_catalog_items_dispensing_profile_fk
      foreign key (source_dispensing_profile_id, source_dispensing_profile_revision)
      references master.dispensing_order_profiles(id, profile_revision) on delete restrict
      not valid;
  end if;
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'order_catalog_items_medication_product_fk'
      and conrelid = 'public.order_catalog_items'::regclass
  ) then
    alter table public.order_catalog_items
      add constraint order_catalog_items_medication_product_fk
      foreign key (source_medication_product_id, source_medication_product_revision)
      references master.medication_products(id, revision) on delete restrict
      not valid;
  end if;
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'order_catalog_items_clinical_review_fk'
      and conrelid = 'public.order_catalog_items'::regclass
  ) then
    alter table public.order_catalog_items
      add constraint order_catalog_items_clinical_review_fk
      foreign key (source_clinical_review_id)
      references master.clinical_reviews(id) on delete restrict
      not valid;
  end if;
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'order_catalog_items_dispensing_lineage_check'
      and conrelid = 'public.order_catalog_items'::regclass
  ) then
    alter table public.order_catalog_items
      add constraint order_catalog_items_dispensing_lineage_check check (
        (
          source_dispensing_profile_id is null
          and source_dispensing_profile_revision is null
          and source_medication_product_id is null
          and source_medication_product_revision is null
          and source_clinical_review_id is null
          and source_evidence_fingerprint is null
          and dispensing_profile_snapshot is null
          and dispensing_profile_snapshot_sha256 is null
          and not clinical_use_allowed
        )
        or (
          source_dispensing_profile_id is not null
          and source_dispensing_profile_revision > 0
          and source_medication_product_id is not null
          and source_medication_product_revision > 0
          and source_evidence_fingerprint ~ '^[0-9a-f]{64}$'
          and jsonb_typeof(dispensing_profile_snapshot) = 'object'
          and dispensing_profile_snapshot_sha256 ~ '^[0-9a-f]{64}$'
          and origin_type = 'clair_master'
          and source_master_record_id is not null
          and source_master_revision > 0
          and clinical_order_type = 'dispensing'
          and destination_module = 'dispensing'
          and default_destination_module = 'dispensing'
          and default_task_required
          and (clinical_use_allowed or availability_status <> 'active')
        )
      ) not valid;
  end if;
end;
$$;

alter table public.order_catalog_items
  validate constraint order_catalog_items_dispensing_profile_fk,
  validate constraint order_catalog_items_medication_product_fk,
  validate constraint order_catalog_items_clinical_review_fk,
  validate constraint order_catalog_items_dispensing_lineage_check;

create unique index if not exists order_catalog_items_workspace_dispensing_profile_key
  on public.order_catalog_items (workspace_id, source_dispensing_profile_id)
  where source_dispensing_profile_id is not null;

create or replace function private.clair_set_dispensing_catalog_gate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile master.dispensing_order_profiles%rowtype;
  v_review_id uuid;
  v_expected_species jsonb;
begin
  if new.source_dispensing_profile_id is null then
    new.source_dispensing_profile_revision := null;
    new.source_medication_product_id := null;
    new.source_medication_product_revision := null;
    new.source_clinical_review_id := null;
    new.source_evidence_fingerprint := null;
    new.clinical_use_allowed := false;
    new.dispensing_profile_snapshot := null;
    new.dispensing_profile_snapshot_sha256 := null;
    return new;
  end if;

  select profile.*
  into v_profile
  from master.dispensing_order_profiles profile
  where profile.id = new.source_dispensing_profile_id
    and profile.profile_revision = new.source_dispensing_profile_revision;

  if not found then
    raise exception 'clinical_master_dispensing_profile_unavailable' using errcode = '23503';
  end if;
  if new.source_master_record_id is distinct from v_profile.order_record_id
    or new.source_master_revision is distinct from v_profile.order_record_revision then
    raise exception 'clinical_master_dispensing_order_lineage_mismatch' using errcode = '23514';
  end if;

  new.source_medication_product_id := v_profile.product_id;
  new.source_medication_product_revision := v_profile.product_revision;
  new.source_evidence_fingerprint := v_profile.evidence_fingerprint;
  new.clinical_use_allowed := master.clair_dispensing_profile_clinical_use_allowed(
    v_profile.id,
    v_profile.profile_revision
  );

  if new.clinical_use_allowed then
    select review.id
    into v_review_id
    from master.clinical_reviews review
    where review.dispensing_profile_id = v_profile.id
      and review.dispensing_profile_revision = v_profile.profile_revision
      and review.decision = 'approved'
      and not exists (
        select 1 from master.clinical_reviews later_review
        where later_review.supersedes_review_id = review.id
      )
    order by review.reviewed_at desc, review.id
    limit 1;
    new.source_clinical_review_id := v_review_id;
  else
    new.source_clinical_review_id := null;
  end if;

  if new.dispensing_profile_snapshot is null
    or jsonb_typeof(new.dispensing_profile_snapshot) <> 'object'
    or new.dispensing_profile_snapshot ->> 'sourceDispensingProfileId' is distinct from v_profile.id::text
    or new.dispensing_profile_snapshot ->> 'sourceDispensingProfileRevision' is distinct from v_profile.profile_revision::text
    or new.dispensing_profile_snapshot ->> 'sourceMedicationProductId' is distinct from v_profile.product_id::text
    or new.dispensing_profile_snapshot ->> 'sourceMedicationProductRevision' is distinct from v_profile.product_revision::text
    or new.dispensing_profile_snapshot -> 'routes' is distinct from pg_catalog.to_jsonb(v_profile.allowed_routes) then
    raise exception 'clinical_master_dispensing_snapshot_lineage_mismatch' using errcode = '23514';
  end if;
  select coalesce(
    pg_catalog.jsonb_agg(species.species_code order by species.species_code),
    '[]'::jsonb
  )
  into v_expected_species
  from master.medication_species_applicability applicability
  join master.species species
    on species.master_record_id = applicability.species_record_id
  where applicability.product_id = v_profile.product_id
    and applicability.product_revision = v_profile.product_revision;
  if new.dispensing_profile_snapshot -> 'targetSpecies'
      is distinct from v_expected_species then
    raise exception 'clinical_master_dispensing_snapshot_species_mismatch' using errcode = '23514';
  end if;
  if new.dispensing_profile_snapshot_sha256 is distinct from
    private.clinical_master_sha256(new.dispensing_profile_snapshot) then
    raise exception 'clinical_master_dispensing_snapshot_fingerprint_mismatch' using errcode = '23514';
  end if;
  if new.availability_status = 'active' and not new.clinical_use_allowed then
    raise exception 'clinical_master_dispensing_clinical_review_required' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists order_catalog_items_dispensing_gate
  on public.order_catalog_items;
create trigger order_catalog_items_dispensing_gate
before insert or update of
  source_master_record_id,
  source_master_revision,
  source_dispensing_profile_id,
  source_dispensing_profile_revision,
  source_medication_product_id,
  source_medication_product_revision,
  source_clinical_review_id,
  source_evidence_fingerprint,
  clinical_use_allowed,
  dispensing_profile_snapshot,
  dispensing_profile_snapshot_sha256,
  target_species,
  availability_status,
  clinical_order_type,
  destination_module,
  default_destination_module,
  default_task_required
on public.order_catalog_items
for each row execute function private.clair_set_dispensing_catalog_gate();

create or replace function private.clair_record_dispensing_species_override()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.source_dispensing_profile_id is not null
    and new.source_dispensing_profile_id is not null
    and new.target_species is distinct from old.target_species then
    insert into private.clinical_master_dispensing_species_override_events (
      workspace_id,
      catalog_item_id,
      actor_user_id,
      before_species,
      after_species,
      source_dispensing_profile_id,
      source_dispensing_profile_revision,
      catalog_revision
    ) values (
      new.workspace_id,
      new.id,
      auth.uid(),
      old.target_species,
      new.target_species,
      new.source_dispensing_profile_id,
      new.source_dispensing_profile_revision,
      new.catalog_revision
    );
  end if;
  return new;
end;
$$;

drop trigger if exists order_catalog_items_dispensing_species_override_audit
  on public.order_catalog_items;
create trigger order_catalog_items_dispensing_species_override_audit
after update of target_species on public.order_catalog_items
for each row execute function private.clair_record_dispensing_species_override();

revoke all on function private.clair_set_dispensing_catalog_gate()
from public, anon, authenticated, service_role;
revoke all on function private.clair_record_dispensing_species_override()
from public, anon, authenticated, service_role;

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
  from public.clair_list_order_catalog_chart_search_v2_phase2_base(
    p_workspace_id
  ) base
  left join public.order_catalog_items catalog
    on base.row_type = 'individual'
   and catalog.workspace_id = p_workspace_id
   and catalog.id = base.applied_snapshot ->> 'workspaceCatalogItemId'
  where base.row_type = 'set'
     or catalog.source_dispensing_profile_id is null
     or (
       catalog.clinical_use_allowed
       and master.clair_dispensing_profile_clinical_use_allowed(
         catalog.source_dispensing_profile_id,
         catalog.source_dispensing_profile_revision
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
    if v_catalog.availability_status <> 'active'
      or not v_catalog.clinical_use_allowed
      or v_catalog.source_clinical_review_id is null
      or not master.clair_dispensing_profile_clinical_use_allowed(
        v_catalog.source_dispensing_profile_id,
        v_catalog.source_dispensing_profile_revision
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

drop trigger if exists orders_dispensing_lineage_gate on public.orders;
drop trigger if exists orders_zz_dispensing_lineage_gate on public.orders;
create trigger orders_zz_dispensing_lineage_gate
before insert or update of
  workspace_catalog_item_id,
  workspace_catalog_revision,
  source_master_record_id,
  source_master_revision,
  clinical_order_type,
  destination_module,
  detail_inputs,
  applied_snapshot,
  applied_snapshot_schema_version,
  applied_snapshot_sha256,
  order_confirmation_status,
  confirmed_snapshot
on public.orders
for each row execute function private.clair_set_dispensing_order_lineage();

revoke all on function private.clair_set_dispensing_order_lineage()
from public, anon, authenticated, service_role;

comment on table master.dispensing_order_profiles is
  'Revision-pinned dispensing master profile. Clinical use is computed by master.clair_dispensing_profile_clinical_use_allowed and is never author supplied.';
comment on column public.order_catalog_items.clinical_use_allowed is
  'Server-computed projection for dispensing lineage. Workspace admin acceptance is not clinical review.';
