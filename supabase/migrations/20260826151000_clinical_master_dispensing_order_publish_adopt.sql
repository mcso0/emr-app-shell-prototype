-- CLINICAL-MASTER-PR-017 / Phase 7 local publisher and adopter contract.
-- Functions only: no payload is embedded, published, adopted, or activated.

set lock_timeout = '5s';
set statement_timeout = '120s';

do $preflight$
begin
  if pg_catalog.to_regprocedure('private.publish_clinical_master_release(jsonb,uuid)') is null
    or pg_catalog.to_regprocedure('private.clair_adopt_master_release_to_workspace(text,uuid)') is null
    or pg_catalog.to_regprocedure('private.clinical_master_sha256(jsonb)') is null
    or pg_catalog.to_regclass('master.dispensing_order_profiles') is null
    or pg_catalog.to_regclass('private.clinical_master_dispensing_release_payloads') is null then
    raise exception 'clinical_master_dispensing_publish_preflight_missing_dependency';
  end if;
end;
$preflight$;

create table if not exists private.clinical_master_dispensing_adoption_events (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete restrict,
  release_id uuid not null references master.master_releases(id) on delete restrict,
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  actor_user_id uuid not null references public.users(id) on delete restrict,
  approved_workspace_ids text[] not null,
  profile_count integer not null check (profile_count >= 100),
  clinical_use_allowed_count integer not null check (clinical_use_allowed_count = 0),
  availability_status text not null check (availability_status = 'pending_activation'),
  before_count integer not null check (before_count >= 0),
  after_count integer not null check (after_count >= before_count),
  before_fingerprint text not null check (before_fingerprint ~ '^[0-9a-f]{64}$'),
  after_fingerprint text not null check (after_fingerprint ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique (workspace_id, release_id, after_fingerprint),
  check (pg_catalog.cardinality(approved_workspace_ids) > 0),
  check (workspace_id = any(approved_workspace_ids))
);

alter table private.clinical_master_dispensing_adoption_events enable row level security;
revoke all on private.clinical_master_dispensing_adoption_events
from public, anon, authenticated, service_role;

create or replace function private.reject_clinical_master_dispensing_adoption_event_mutation()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  raise exception 'clinical_master_dispensing_adoption_event_immutable'
    using errcode = '55000';
end;
$function$;

drop trigger if exists clinical_master_dispensing_adoption_event_immutable
on private.clinical_master_dispensing_adoption_events;
create trigger clinical_master_dispensing_adoption_event_immutable
before update or delete on private.clinical_master_dispensing_adoption_events
for each row execute function private.reject_clinical_master_dispensing_adoption_event_mutation();

create or replace function private.clair_dispensing_canonical_jsonb_text(
  p_value jsonb
)
returns text
language plpgsql
immutable
strict
set search_path = ''
as $function$
declare
  v_kind text := pg_catalog.jsonb_typeof(p_value);
  v_key text;
  v_item jsonb;
  v_parts text[] := '{}';
begin
  if v_kind = 'object' then
    for v_key, v_item in
      select entry.key, entry.value
      from pg_catalog.jsonb_each(p_value) entry
      order by entry.key collate "C"
    loop
      v_parts := pg_catalog.array_append(
        v_parts,
        pg_catalog.to_jsonb(v_key)::text || ':' ||
          private.clair_dispensing_canonical_jsonb_text(v_item)
      );
    end loop;
    return '{' || pg_catalog.array_to_string(v_parts, ',') || '}';
  elsif v_kind = 'array' then
    for v_item in
      select entry.value
      from pg_catalog.jsonb_array_elements(p_value) with ordinality entry(value, ordinal)
      order by entry.ordinal
    loop
      v_parts := pg_catalog.array_append(
        v_parts,
        private.clair_dispensing_canonical_jsonb_text(v_item)
      );
    end loop;
    return '[' || pg_catalog.array_to_string(v_parts, ',') || ']';
  end if;
  return p_value::text;
end;
$function$;

create or replace function private.clair_dispensing_payload_sha256(
  p_value jsonb
)
returns text
language sql
immutable
strict
set search_path = ''
as $function$
  select pg_catalog.lower(pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(
        private.clair_dispensing_canonical_jsonb_text(p_value),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  ));
$function$;

create or replace function private.clair_dispensing_assert_exact_keys(
  p_context text,
  p_value jsonb,
  p_allowed text[]
)
returns void
language plpgsql
immutable
strict
set search_path = ''
as $function$
begin
  if pg_catalog.jsonb_typeof(p_value) <> 'object'
    or exists (
      select 1
      from pg_catalog.jsonb_object_keys(p_value) key
      where not (key = any(p_allowed))
    )
    or (
      select pg_catalog.count(*)
      from pg_catalog.jsonb_object_keys(p_value)
    ) is distinct from pg_catalog.cardinality(p_allowed)::bigint then
    raise exception 'clinical_master_dispensing_unknown_key:%', p_context
      using errcode = '22023';
  end if;
end;
$function$;

create or replace function private.publish_clinical_master_dispensing_release(
  p_payload jsonb,
  p_actor_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_expected_keys constant text[] := array[
    'schemaVersion', 'datasetRevision', 'sourceDatasetSha256', 'recordCount',
    'clinicalUseAllowed', 'genericReleasePayload', 'ingredients',
    'evidenceDocuments', 'products', 'productIngredients',
    'speciesApplicability', 'productHandling', 'dispensingProfiles',
    'evidenceAssertions', 'clinicalReviews', 'regulatoryProfiles',
    'payloadSha256'
  ];
  v_array_key text;
  v_row jsonb;
  v_release_result jsonb;
  v_release_id uuid;
  v_order_record_id uuid;
  v_order_record_revision integer;
  v_species_record_id uuid;
  v_payload_sha256 text;
  v_existing_release_id uuid;
  v_existing_payload_sha256 text;
begin
  if p_payload is null or pg_catalog.jsonb_typeof(p_payload) <> 'object' then
    raise exception 'clinical_master_dispensing_payload_object_required' using errcode = '22023';
  end if;
  if p_actor_user_id is null
    or not exists (select 1 from public.users where id = p_actor_user_id) then
    raise exception 'clinical_master_dispensing_publish_actor_required'
      using errcode = '42501';
  end if;
  perform private.clair_dispensing_assert_exact_keys('payload', p_payload, v_expected_keys);
  if (p_payload->>'schemaVersion')::integer <> 1
    or pg_catalog.length(pg_catalog.btrim(coalesce(p_payload->>'datasetRevision', ''))) = 0
    or coalesce(p_payload->>'sourceDatasetSha256', '') !~ '^[0-9a-f]{64}$'
    or (p_payload->>'recordCount')::integer < 100
    or coalesce((p_payload->>'clinicalUseAllowed')::boolean, true)
    or pg_catalog.jsonb_typeof(p_payload->'genericReleasePayload') <> 'object' then
    raise exception 'clinical_master_dispensing_payload_header_invalid' using errcode = '22023';
  end if;

  foreach v_array_key in array array[
    'ingredients', 'evidenceDocuments', 'products', 'productIngredients',
    'speciesApplicability', 'productHandling', 'dispensingProfiles',
    'evidenceAssertions', 'clinicalReviews', 'regulatoryProfiles'
  ] loop
    if pg_catalog.jsonb_typeof(p_payload->v_array_key) <> 'array' then
      raise exception 'clinical_master_dispensing_payload_array_required:%', v_array_key
        using errcode = '22023';
    end if;
  end loop;

  if pg_catalog.jsonb_array_length(p_payload->'products')
      is distinct from (p_payload->>'recordCount')::integer
    or pg_catalog.jsonb_array_length(p_payload->'dispensingProfiles')
      is distinct from (p_payload->>'recordCount')::integer
    or pg_catalog.jsonb_array_length(p_payload->'clinicalReviews')
      is distinct from (p_payload->>'recordCount')::integer
    or pg_catalog.jsonb_array_length(p_payload->'regulatoryProfiles')
      is distinct from (p_payload->>'recordCount')::integer
    or (
      select pg_catalog.count(*)
      from pg_catalog.jsonb_array_elements(
        p_payload->'genericReleasePayload'->'records'
      ) record
      where record->>'recordType' = 'order'
        and record->>'masterKey' like 'cm.order.dispensing-v1-%'
    ) is distinct from (p_payload->>'recordCount')::bigint
    or pg_catalog.jsonb_array_length(
      p_payload->'genericReleasePayload'->'classificationPaths'
    ) is distinct from 1
    or p_payload->'genericReleasePayload'->'classificationPaths'->0->>'pathKey'
      is distinct from 'cm.path.dispensing' then
    raise exception 'clinical_master_dispensing_payload_count_mismatch' using errcode = '22023';
  end if;

  v_payload_sha256 := private.clair_dispensing_payload_sha256(p_payload - 'payloadSha256');
  if p_payload->>'payloadSha256' is distinct from v_payload_sha256 then
    raise exception 'clinical_master_dispensing_payload_hash_mismatch:expected:%:computed:%',
      p_payload->>'payloadSha256', v_payload_sha256
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('clinical_master_dispensing_publication', 0)
  );
  select payload.release_id, payload.payload_sha256
  into v_existing_release_id, v_existing_payload_sha256
  from private.clinical_master_dispensing_release_payloads payload
  where payload.payload_sha256 = v_payload_sha256
  for update;
  if found then
    return pg_catalog.jsonb_build_object(
      'releaseId', v_existing_release_id,
      'payloadSha256', v_existing_payload_sha256,
      'recordCount', (p_payload->>'recordCount')::integer,
      'idempotent', true,
      'clinicalUseAllowed', false
    );
  end if;

  for v_row in select value from pg_catalog.jsonb_array_elements(p_payload->'ingredients')
  loop
    perform private.clair_dispensing_assert_exact_keys('ingredient', v_row, array[
      'id','ingredientKey','revision','normalizedEnglishName','koreanName',
      'koreanReviewStatus','lifecycleStatus'
    ]);
    if v_row->>'koreanReviewStatus' <> 'pending'
      or v_row->>'lifecycleStatus' <> 'clinical_review_pending' then
      raise exception 'clinical_master_dispensing_ingredient_review_gate_invalid' using errcode = '22023';
    end if;
  end loop;
  for v_row in select value from pg_catalog.jsonb_array_elements(p_payload->'products')
  loop
    perform private.clair_dispensing_assert_exact_keys('product', v_row, array[
      'id','productKey','revision','authority','sourceJurisdiction','sourceProductId',
      'authorizationNumber','authorizationTerritory','distributionCategory',
      'englishProductName','koreanDraftName','koreanReviewStatus','dosageForm',
      'routes','strengthSnapshot','atcVetCode','coverageCategory','manufactured',
      'compounded','lifecycleStatus'
    ]);
    if v_row->>'koreanReviewStatus' <> 'pending'
      or v_row->>'lifecycleStatus' <> 'clinical_review_pending'
      or not (v_row->>'manufactured')::boolean
      or (v_row->>'compounded')::boolean then
      raise exception 'clinical_master_dispensing_product_review_gate_invalid' using errcode = '22023';
    end if;
  end loop;
  for v_row in select value from pg_catalog.jsonb_array_elements(p_payload->'dispensingProfiles')
  loop
    perform private.clair_dispensing_assert_exact_keys('dispensingProfile', v_row, array[
      'id','profileKey','profileRevision','orderMasterKey','productId',
      'productRevision','allowedRoutes','prescriptionDefaultStatus',
      'prescriptionDefaults','koreanTranslationReviewStatus',
      'evidenceFingerprint','lifecycleStatus'
    ]);
    if v_row->>'prescriptionDefaultStatus' <> 'none'
      or v_row->'prescriptionDefaults' <> 'null'::jsonb
      or v_row->>'koreanTranslationReviewStatus' <> 'pending'
      or v_row->>'lifecycleStatus' <> 'clinical_review_pending' then
      raise exception 'clinical_master_dispensing_profile_review_gate_invalid' using errcode = '22023';
    end if;
  end loop;
  for v_row in select value from pg_catalog.jsonb_array_elements(p_payload->'clinicalReviews')
  loop
    perform private.clair_dispensing_assert_exact_keys('clinicalReview', v_row, array[
      'id','reviewKey','dispensingProfileId','dispensingProfileRevision','decision',
      'reviewerUserId','reviewerEligibility','decisionReason','reviewedAt',
      'supersedesReviewId'
    ]);
    if v_row->>'decision' <> 'pending'
      or v_row->'reviewerUserId' <> 'null'::jsonb
      or v_row->'reviewedAt' <> 'null'::jsonb then
      raise exception 'clinical_master_dispensing_clinical_review_gate_invalid' using errcode = '22023';
    end if;
  end loop;
  for v_row in select value from pg_catalog.jsonb_array_elements(p_payload->'regulatoryProfiles')
  loop
    perform private.clair_dispensing_assert_exact_keys('regulatoryProfile', v_row, array[
      'id','regulatoryKey','revision','productId','productRevision','jurisdiction',
      'authorizationStatus','controlledStatus','policyVersion','reviewStatus',
      'reviewerUserId','reviewedAt'
    ]);
    if v_row->>'jurisdiction' <> 'KR'
      or v_row->>'authorizationStatus' <> 'not_verified'
      or v_row->>'controlledStatus' <> 'not_screened'
      or v_row->>'reviewStatus' <> 'pending' then
      raise exception 'clinical_master_dispensing_regulatory_gate_invalid' using errcode = '22023';
    end if;
  end loop;
  for v_row in select value from pg_catalog.jsonb_array_elements(p_payload->'evidenceDocuments')
  loop
    perform private.clair_dispensing_assert_exact_keys('evidenceDocument', v_row, array[
      'id','documentKey','revision','authority','jurisdiction','documentType',
      'sourceUri','contentSha256','pageCount','sourceRevision','accessedAt',
      'lifecycleStatus'
    ]);
    if v_row->>'lifecycleStatus' <> 'captured' then
      raise exception 'clinical_master_dispensing_evidence_document_gate_invalid'
        using errcode = '22023';
    end if;
  end loop;
  for v_row in select value from pg_catalog.jsonb_array_elements(p_payload->'productIngredients')
  loop
    perform private.clair_dispensing_assert_exact_keys('productIngredient', v_row, array[
      'productId','productRevision','ingredientId','ingredientRevision','ordinal',
      'strengthKind','numeratorValue','numeratorUnit','denominatorValue',
      'denominatorUnit','evidenceMode','pairingStatus'
    ]);
    if v_row->>'pairingStatus' not in (
      'ordinal_direct_pending_review', 'manual_review_required'
    ) then
      raise exception 'clinical_master_dispensing_ingredient_pairing_gate_invalid'
        using errcode = '22023';
    end if;
  end loop;
  for v_row in select value from pg_catalog.jsonb_array_elements(p_payload->'speciesApplicability')
  loop
    perform private.clair_dispensing_assert_exact_keys('speciesApplicability', v_row, array[
      'productId','productRevision','speciesCode','evidenceMode','reviewStatus'
    ]);
    if v_row->>'reviewStatus' <> 'pending' then
      raise exception 'clinical_master_dispensing_species_review_gate_invalid'
        using errcode = '22023';
    end if;
  end loop;
  for v_row in select value from pg_catalog.jsonb_array_elements(p_payload->'productHandling')
  loop
    perform private.clair_dispensing_assert_exact_keys('productHandling', v_row, array[
      'productId','productRevision','packagedShelfLifeValue','packagedShelfLifeUnit',
      'openedShelfLifeValue','openedShelfLifeUnit','storageCodes',
      'beyondUseDateRule','extractionStatus'
    ]);
    if v_row->>'extractionStatus' <> 'direct_spc_text_clinical_review_pending'
      or v_row->'beyondUseDateRule' <> 'null'::jsonb then
      raise exception 'clinical_master_dispensing_handling_review_gate_invalid'
        using errcode = '22023';
    end if;
  end loop;
  for v_row in select value from pg_catalog.jsonb_array_elements(p_payload->'evidenceAssertions')
  loop
    perform private.clair_dispensing_assert_exact_keys('evidenceAssertion', v_row, array[
      'id','assertionKey','productId','productRevision','fieldPath',
      'evidenceDocumentId','evidenceDocumentRevision','evidenceMode','locator',
      'extractionStatus'
    ]);
    if v_row->>'extractionStatus' <> 'clinical_review_pending' then
      raise exception 'clinical_master_dispensing_evidence_assertion_gate_invalid'
        using errcode = '22023';
    end if;
  end loop;

  v_release_result := private.publish_clinical_master_release(
    p_payload->'genericReleasePayload',
    p_actor_user_id
  );
  v_release_id := (v_release_result->>'releaseId')::uuid;

  insert into private.clinical_master_dispensing_release_payloads(
    release_id, schema_version, dataset_revision, source_dataset_sha256,
    payload_sha256, record_count, payload
  ) values (
    v_release_id, 1, p_payload->>'datasetRevision', p_payload->>'sourceDatasetSha256',
    v_payload_sha256, (p_payload->>'recordCount')::integer, p_payload
  );

  for v_row in select value from pg_catalog.jsonb_array_elements(p_payload->'ingredients')
  loop
    insert into master.medication_ingredients(
      id, ingredient_key, revision, normalized_english_name, korean_name,
      korean_review_status, lifecycle_status, source_release_id
    ) values (
      (v_row->>'id')::uuid, v_row->>'ingredientKey', (v_row->>'revision')::integer,
      v_row->>'normalizedEnglishName', nullif(v_row->>'koreanName', ''),
      v_row->>'koreanReviewStatus', v_row->>'lifecycleStatus', v_release_id
    );
  end loop;

  for v_row in select value from pg_catalog.jsonb_array_elements(p_payload->'evidenceDocuments')
  loop
    perform private.clair_dispensing_assert_exact_keys('evidenceDocument', v_row, array[
      'id','documentKey','revision','authority','jurisdiction','documentType',
      'sourceUri','contentSha256','pageCount','sourceRevision','accessedAt',
      'lifecycleStatus'
    ]);
    insert into master.evidence_documents(
      id, document_key, revision, authority, jurisdiction, document_type,
      source_uri, content_sha256, page_count, source_revision, accessed_at,
      lifecycle_status, source_release_id
    ) values (
      (v_row->>'id')::uuid, v_row->>'documentKey', (v_row->>'revision')::integer,
      v_row->>'authority', v_row->>'jurisdiction', v_row->>'documentType',
      v_row->>'sourceUri', v_row->>'contentSha256',
      nullif(v_row->>'pageCount', '')::integer, nullif(v_row->>'sourceRevision', ''),
      (v_row->>'accessedAt')::date, v_row->>'lifecycleStatus', v_release_id
    );
  end loop;

  for v_row in select value from pg_catalog.jsonb_array_elements(p_payload->'products')
  loop
    insert into master.medication_products(
      id, product_key, revision, authority, source_jurisdiction, source_product_id,
      authorization_number, authorization_territory, distribution_category,
      english_product_name, korean_draft_name, korean_review_status, dosage_form,
      routes, strength_snapshot, atcvet_code, coverage_category, manufactured,
      compounded, lifecycle_status, source_release_id
    ) values (
      (v_row->>'id')::uuid, v_row->>'productKey', (v_row->>'revision')::integer,
      v_row->>'authority', v_row->>'sourceJurisdiction', v_row->>'sourceProductId',
      nullif(v_row->>'authorizationNumber', ''), nullif(v_row->>'authorizationTerritory', ''),
      nullif(v_row->>'distributionCategory', ''), v_row->>'englishProductName',
      nullif(v_row->>'koreanDraftName', ''), v_row->>'koreanReviewStatus',
      v_row->>'dosageForm', array(select pg_catalog.jsonb_array_elements_text(v_row->'routes')),
      v_row->'strengthSnapshot', nullif(v_row->>'atcVetCode', ''),
      v_row->>'coverageCategory', (v_row->>'manufactured')::boolean,
      (v_row->>'compounded')::boolean, v_row->>'lifecycleStatus', v_release_id
    );
  end loop;

  for v_row in select value from pg_catalog.jsonb_array_elements(p_payload->'productIngredients')
  loop
    perform private.clair_dispensing_assert_exact_keys('productIngredient', v_row, array[
      'productId','productRevision','ingredientId','ingredientRevision','ordinal',
      'strengthKind','numeratorValue','numeratorUnit','denominatorValue',
      'denominatorUnit','evidenceMode','pairingStatus'
    ]);
    insert into master.medication_product_ingredients(
      product_id, product_revision, ingredient_id, ingredient_revision, ordinal,
      strength_kind, numerator_value, numerator_unit, denominator_value,
      denominator_unit, evidence_mode, pairing_status, source_release_id
    ) values (
      (v_row->>'productId')::uuid, (v_row->>'productRevision')::integer,
      (v_row->>'ingredientId')::uuid, (v_row->>'ingredientRevision')::integer,
      (v_row->>'ordinal')::integer, v_row->>'strengthKind',
      nullif(v_row->>'numeratorValue', '')::numeric, nullif(v_row->>'numeratorUnit', ''),
      nullif(v_row->>'denominatorValue', '')::numeric, nullif(v_row->>'denominatorUnit', ''),
      v_row->>'evidenceMode', v_row->>'pairingStatus', v_release_id
    );
  end loop;

  for v_row in select value from pg_catalog.jsonb_array_elements(p_payload->'speciesApplicability')
  loop
    perform private.clair_dispensing_assert_exact_keys('speciesApplicability', v_row, array[
      'productId','productRevision','speciesCode','evidenceMode','reviewStatus'
    ]);
    select species.master_record_id into v_species_record_id
    from master.species species
    where species.species_code = v_row->>'speciesCode';
    if v_species_record_id is null then
      raise exception 'clinical_master_dispensing_species_missing:%', v_row->>'speciesCode'
        using errcode = '23503';
    end if;
    insert into master.medication_species_applicability(
      product_id, product_revision, species_record_id, evidence_mode,
      review_status, source_release_id
    ) values (
      (v_row->>'productId')::uuid, (v_row->>'productRevision')::integer,
      v_species_record_id, v_row->>'evidenceMode', v_row->>'reviewStatus', v_release_id
    );
  end loop;

  for v_row in select value from pg_catalog.jsonb_array_elements(p_payload->'productHandling')
  loop
    perform private.clair_dispensing_assert_exact_keys('productHandling', v_row, array[
      'productId','productRevision','packagedShelfLifeValue','packagedShelfLifeUnit',
      'openedShelfLifeValue','openedShelfLifeUnit','storageCodes',
      'beyondUseDateRule','extractionStatus'
    ]);
    insert into master.medication_product_handling(
      product_id, product_revision, packaged_shelf_life_value,
      packaged_shelf_life_unit, opened_shelf_life_value, opened_shelf_life_unit,
      storage_codes, beyond_use_date_rule, extraction_status, source_release_id
    ) values (
      (v_row->>'productId')::uuid, (v_row->>'productRevision')::integer,
      nullif(v_row->>'packagedShelfLifeValue', '')::numeric,
      nullif(v_row->>'packagedShelfLifeUnit', ''),
      nullif(v_row->>'openedShelfLifeValue', '')::numeric,
      nullif(v_row->>'openedShelfLifeUnit', ''),
      array(select pg_catalog.jsonb_array_elements_text(v_row->'storageCodes')),
      null, v_row->>'extractionStatus', v_release_id
    );
  end loop;

  for v_row in select value from pg_catalog.jsonb_array_elements(p_payload->'dispensingProfiles')
  loop
    select record.id, record.current_revision
    into v_order_record_id, v_order_record_revision
    from master.master_records record
    where record.master_key = v_row->>'orderMasterKey'
      and record.record_type = 'order';
    if v_order_record_id is null then
      raise exception 'clinical_master_dispensing_order_missing:%', v_row->>'orderMasterKey'
        using errcode = '23503';
    end if;
    insert into master.dispensing_order_profiles(
      id, profile_key, profile_revision, order_record_id, order_record_revision,
      product_id, product_revision, allowed_routes, prescription_default_status,
      prescription_defaults, korean_translation_review_status, evidence_fingerprint,
      lifecycle_status, source_release_id
    ) values (
      (v_row->>'id')::uuid, v_row->>'profileKey', (v_row->>'profileRevision')::integer,
      v_order_record_id, v_order_record_revision, (v_row->>'productId')::uuid,
      (v_row->>'productRevision')::integer,
      array(select pg_catalog.jsonb_array_elements_text(v_row->'allowedRoutes')),
      v_row->>'prescriptionDefaultStatus', null,
      v_row->>'koreanTranslationReviewStatus', v_row->>'evidenceFingerprint',
      v_row->>'lifecycleStatus', v_release_id
    );
  end loop;

  for v_row in select value from pg_catalog.jsonb_array_elements(p_payload->'evidenceAssertions')
  loop
    perform private.clair_dispensing_assert_exact_keys('evidenceAssertion', v_row, array[
      'id','assertionKey','productId','productRevision','fieldPath',
      'evidenceDocumentId','evidenceDocumentRevision','evidenceMode','locator',
      'extractionStatus'
    ]);
    insert into master.evidence_assertions(
      id, assertion_key, product_id, product_revision, field_path,
      evidence_document_id, evidence_document_revision, evidence_mode, locator,
      extraction_status, source_release_id
    ) values (
      (v_row->>'id')::uuid, v_row->>'assertionKey', (v_row->>'productId')::uuid,
      (v_row->>'productRevision')::integer, v_row->>'fieldPath',
      (v_row->>'evidenceDocumentId')::uuid,
      (v_row->>'evidenceDocumentRevision')::integer, v_row->>'evidenceMode',
      v_row->>'locator', v_row->>'extractionStatus', v_release_id
    );
  end loop;

  for v_row in select value from pg_catalog.jsonb_array_elements(p_payload->'clinicalReviews')
  loop
    insert into master.clinical_reviews(
      id, review_key, dispensing_profile_id, dispensing_profile_revision,
      decision, reviewer_user_id, reviewer_eligibility, decision_reason,
      reviewed_at, supersedes_review_id, source_release_id
    ) values (
      (v_row->>'id')::uuid, v_row->>'reviewKey',
      (v_row->>'dispensingProfileId')::uuid,
      (v_row->>'dispensingProfileRevision')::integer, v_row->>'decision', null,
      coalesce(v_row->'reviewerEligibility', '{}'::jsonb),
      nullif(v_row->>'decisionReason', ''), null, null, v_release_id
    );
  end loop;

  for v_row in select value from pg_catalog.jsonb_array_elements(p_payload->'regulatoryProfiles')
  loop
    insert into master.medication_regulatory_profiles(
      id, regulatory_key, revision, product_id, product_revision, jurisdiction,
      authorization_status, controlled_status, policy_version, review_status,
      reviewer_user_id, reviewed_at, source_release_id
    ) values (
      (v_row->>'id')::uuid, v_row->>'regulatoryKey', (v_row->>'revision')::integer,
      (v_row->>'productId')::uuid, (v_row->>'productRevision')::integer,
      v_row->>'jurisdiction', v_row->>'authorizationStatus',
      v_row->>'controlledStatus', nullif(v_row->>'policyVersion', ''),
      v_row->>'reviewStatus', null, null, v_release_id
    );
  end loop;

  if (select pg_catalog.count(*) from master.dispensing_order_profiles profile
      where profile.source_release_id = v_release_id)
      is distinct from (p_payload->>'recordCount')::integer
    or exists (
      select 1
      from master.dispensing_order_profiles profile
      where profile.source_release_id = v_release_id
        and master.clair_dispensing_profile_clinical_use_allowed(
          profile.id, profile.profile_revision
        )
    ) then
    raise exception 'clinical_master_dispensing_publish_postcondition_failed' using errcode = '23514';
  end if;

  return v_release_result || pg_catalog.jsonb_build_object(
    'payloadSha256', v_payload_sha256,
    'recordCount', (p_payload->>'recordCount')::integer,
    'idempotent', false,
    'clinicalUseAllowed', false
  );
end;
$function$;

create or replace function private.adopt_clinical_master_dispensing_release(
  p_workspace_id text,
  p_release_id uuid,
  p_actor_user_id uuid,
  p_approved_workspace_ids text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_base jsonb;
  v_profile master.dispensing_order_profiles%rowtype;
  v_product master.medication_products%rowtype;
  v_catalog public.order_catalog_items%rowtype;
  v_snapshot jsonb;
  v_snapshot_sha256 text;
  v_payload_sha256 text;
  v_before_count integer;
  v_after_count integer;
  v_before_fingerprint text;
  v_after_fingerprint text;
  v_event_id uuid;
  v_count integer := 0;
begin
  if p_workspace_id is null
    or not (p_workspace_id = any(coalesce(p_approved_workspace_ids, '{}')))
    or p_actor_user_id is null
    or not exists (select 1 from public.users where id = p_actor_user_id) then
    raise exception 'clinical_master_dispensing_adoption_approval_scope_invalid'
      using errcode = '42501';
  end if;
  select payload.payload_sha256
  into v_payload_sha256
  from private.clinical_master_dispensing_release_payloads payload
  where payload.release_id = p_release_id;
  if not found then
    raise exception 'clinical_master_dispensing_release_not_published' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'clinical_master_dispensing_workspace_adoption:' || p_workspace_id,
      0
    )
  );
  select
    pg_catalog.count(*)::integer,
    private.clinical_master_sha256(coalesce(pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', catalog.id,
        'sourceMasterRecordId', catalog.source_master_record_id,
        'sourceMasterRevision', catalog.source_master_revision,
        'catalogRevision', catalog.catalog_revision,
        'availabilityStatus', catalog.availability_status,
        'customizationState', catalog.customization_state,
        'presetMergeStatus', catalog.preset_merge_status,
        'sourceProjectionFingerprint', catalog.source_projection_fingerprint,
        'sourceDispensingProfileId', catalog.source_dispensing_profile_id,
        'dispensingProfileSnapshotSha256', catalog.dispensing_profile_snapshot_sha256,
        'clinicalUseAllowed', catalog.clinical_use_allowed
      ) order by catalog.id
    ), '[]'::jsonb))
  into v_before_count, v_before_fingerprint
  from public.order_catalog_items catalog
  where catalog.workspace_id = p_workspace_id;

  v_base := private.clair_adopt_master_release_to_workspace(
    p_workspace_id,
    p_release_id
  );

  for v_profile in
    select profile.*
    from master.dispensing_order_profiles profile
    where profile.source_release_id = p_release_id
    order by profile.profile_key
  loop
    select product.* into strict v_product
    from master.medication_products product
    where product.id = v_profile.product_id
      and product.revision = v_profile.product_revision;
    select catalog.* into v_catalog
    from public.order_catalog_items catalog
    where catalog.workspace_id = p_workspace_id
      and catalog.source_master_record_id = v_profile.order_record_id
    for update;
    if not found then
      raise exception 'clinical_master_dispensing_adoption_catalog_missing:%', v_profile.profile_key
        using errcode = '23503';
    end if;
    v_snapshot := pg_catalog.jsonb_build_object(
      'schemaVersion', 1,
      'sourceDispensingProfileId', v_profile.id,
      'sourceDispensingProfileRevision', v_profile.profile_revision,
      'sourceMedicationProductId', v_product.id,
      'sourceMedicationProductRevision', v_product.revision,
      'productKey', v_product.product_key,
      'englishProductName', v_product.english_product_name,
      'koreanDraftName', v_product.korean_draft_name,
      'koreanReviewStatus', v_product.korean_review_status,
      'dosageForm', v_product.dosage_form,
      'routes', pg_catalog.to_jsonb(v_profile.allowed_routes),
      'strengthSnapshot', v_product.strength_snapshot,
      'targetSpecies', (
        select coalesce(
          pg_catalog.jsonb_agg(species.species_code order by species.species_code),
          '[]'::jsonb
        )
        from master.medication_species_applicability applicability
        join master.species species
          on species.master_record_id = applicability.species_record_id
        where applicability.product_id = v_product.id
          and applicability.product_revision = v_product.revision
      ),
      'clinicalUseAllowed', false
    );
    v_snapshot_sha256 := private.clinical_master_sha256(v_snapshot);
    if v_catalog.source_dispensing_profile_id is distinct from v_profile.id
      or v_catalog.source_dispensing_profile_revision is distinct from v_profile.profile_revision
      or v_catalog.dispensing_profile_snapshot is distinct from v_snapshot
      or v_catalog.dispensing_profile_snapshot_sha256 is distinct from v_snapshot_sha256
      or v_catalog.availability_status is distinct from 'pending_activation'
      or v_catalog.clinical_use_allowed then
      update public.order_catalog_items catalog
      set
        source_dispensing_profile_id = v_profile.id,
        source_dispensing_profile_revision = v_profile.profile_revision,
        dispensing_profile_snapshot = v_snapshot,
        dispensing_profile_snapshot_sha256 = v_snapshot_sha256,
        availability_status = 'pending_activation',
        catalog_revision = catalog.catalog_revision + 1,
        updated_at = now()
      where catalog.workspace_id = p_workspace_id
        and catalog.id = v_catalog.id;
    end if;
    v_count := v_count + 1;
  end loop;

  if v_count < 100
    or exists (
      select 1
      from public.order_catalog_items catalog
      join master.dispensing_order_profiles profile
        on profile.id = catalog.source_dispensing_profile_id
       and profile.profile_revision = catalog.source_dispensing_profile_revision
      where catalog.workspace_id = p_workspace_id
        and profile.source_release_id = p_release_id
        and (
          catalog.availability_status <> 'pending_activation'
          or catalog.clinical_use_allowed
        )
    ) then
    raise exception 'clinical_master_dispensing_adoption_postcondition_failed'
      using errcode = '23514';
  end if;

  select
    pg_catalog.count(*)::integer,
    private.clinical_master_sha256(coalesce(pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', catalog.id,
        'sourceMasterRecordId', catalog.source_master_record_id,
        'sourceMasterRevision', catalog.source_master_revision,
        'catalogRevision', catalog.catalog_revision,
        'availabilityStatus', catalog.availability_status,
        'customizationState', catalog.customization_state,
        'presetMergeStatus', catalog.preset_merge_status,
        'sourceProjectionFingerprint', catalog.source_projection_fingerprint,
        'sourceDispensingProfileId', catalog.source_dispensing_profile_id,
        'dispensingProfileSnapshotSha256', catalog.dispensing_profile_snapshot_sha256,
        'clinicalUseAllowed', catalog.clinical_use_allowed
      ) order by catalog.id
    ), '[]'::jsonb))
  into v_after_count, v_after_fingerprint
  from public.order_catalog_items catalog
  where catalog.workspace_id = p_workspace_id;

  insert into private.clinical_master_dispensing_adoption_events(
    workspace_id, release_id, payload_sha256, actor_user_id,
    approved_workspace_ids, profile_count, clinical_use_allowed_count,
    availability_status, before_count, after_count, before_fingerprint,
    after_fingerprint
  ) values (
    p_workspace_id, p_release_id, v_payload_sha256, p_actor_user_id,
    p_approved_workspace_ids, v_count, 0, 'pending_activation',
    v_before_count, v_after_count, v_before_fingerprint, v_after_fingerprint
  )
  on conflict (workspace_id, release_id, after_fingerprint) do nothing
  returning id into v_event_id;
  if v_event_id is null then
    select event.id into strict v_event_id
    from private.clinical_master_dispensing_adoption_events event
    where event.workspace_id = p_workspace_id
      and event.release_id = p_release_id
      and event.after_fingerprint = v_after_fingerprint;
  end if;

  return v_base || pg_catalog.jsonb_build_object(
    'dispensingProfileCount', v_count,
    'clinicalUseAllowedCount', 0,
    'availabilityStatus', 'pending_activation',
    'actorUserId', p_actor_user_id,
    'adoptionEventId', v_event_id,
    'beforeFingerprint', v_before_fingerprint,
    'afterFingerprint', v_after_fingerprint
  );
end;
$function$;

revoke all on function private.clair_dispensing_canonical_jsonb_text(jsonb)
from public, anon, authenticated, service_role;
revoke all on function private.reject_clinical_master_dispensing_adoption_event_mutation()
from public, anon, authenticated, service_role;
revoke all on function private.clair_dispensing_payload_sha256(jsonb)
from public, anon, authenticated, service_role;
revoke all on function private.clair_dispensing_assert_exact_keys(text, jsonb, text[])
from public, anon, authenticated, service_role;
revoke all on function private.publish_clinical_master_dispensing_release(jsonb, uuid)
from public, anon, authenticated, service_role;
revoke all on function private.adopt_clinical_master_dispensing_release(text, uuid, uuid, text[])
from public, anon, authenticated, service_role;

comment on function private.publish_clinical_master_dispensing_release(jsonb, uuid) is
  'Publishes one exact inactive dispensing payload after explicit external approval; direct execute remains revoked.';
comment on function private.adopt_clinical_master_dispensing_release(text, uuid, uuid, text[]) is
  'Adopts an approved release only into an explicitly supplied workspace allowlist and keeps every row pending activation.';
