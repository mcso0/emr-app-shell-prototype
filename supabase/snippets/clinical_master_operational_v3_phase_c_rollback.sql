\set ON_ERROR_STOP on
-- PR-014 Phase C rollback rehearsal. This file is a tracked candidate only:
-- it never writes the remote project and always ends with ROLLBACK.
--
-- Full candidate rehearsal (exact remote read-only fingerprints captured by
-- the tracked preflight query must be supplied by the operator):
--   psql -v payload_json="$(jq -c .payload tests/fixtures/clinical-master-operational-v3-adapter-output.json)" \
--     -v pricing_json="$(jq -c . tests/fixtures/clinical-master-operational-v3-pricing-adoption.json)" \
--     -v expected_release_fingerprint="<exact-read-only-sha256>" \
--     -v expected_pilot_catalog_fingerprint="<exact-read-only-sha256>" \
--     -v expected_cheongdam_catalog_fingerprint="<exact-read-only-sha256>" \
--     -v expected_demo_catalog_fingerprint="<exact-read-only-sha256>" \
--     -v expected_foreign_catalog_fingerprint="<exact-read-only-sha256>" \
--     -v expected_stage_fingerprint="<exact-read-only-sha256>" \
--     -f supabase/snippets/clinical_master_operational_v3_phase_c_rollback.sql
--
-- Local Docker publisher-only rehearsal when the local seed does not contain
-- all three approved target workspaces:
--   psql -v rehearsal_scope=publisher_only -v baseline_mode=local \
--     -v payload_file=tests/fixtures/clinical-master-operational-v3-adapter-output.json \
--     -v pricing_file=tests/fixtures/clinical-master-operational-v3-pricing-adoption.json \
--     -f supabase/snippets/clinical_master_operational_v3_phase_c_rollback.sql
--
-- Full mode is fail-closed on every remote baseline mismatch. Local mode is
-- explicitly not a commit-candidate proof; it only exercises the central
-- private publisher and exact idempotent retry inside the same transaction.
\if :{?payload_file}
\set payload_json `jq -c .payload :payload_file`
\endif
\if :{?pricing_file}
\set pricing_json `jq -c . :pricing_file`
\endif
\if :{?payload_json}
\else
\echo 'payload_json is required'
\quit 3
\endif
\if :{?pricing_json}
\else
\echo 'pricing_json is required'
\quit 3
\endif
\if :{?rehearsal_scope}
\else
\set rehearsal_scope full
\endif
\if :{?baseline_mode}
\else
\set baseline_mode remote
\endif
\if :{?expected_release_fingerprint}
\else
\set expected_release_fingerprint __MISSING__
\endif
\if :{?expected_pilot_catalog_fingerprint}
\else
\set expected_pilot_catalog_fingerprint __MISSING__
\endif
\if :{?expected_cheongdam_catalog_fingerprint}
\else
\set expected_cheongdam_catalog_fingerprint __MISSING__
\endif
\if :{?expected_demo_catalog_fingerprint}
\else
\set expected_demo_catalog_fingerprint __MISSING__
\endif
\if :{?expected_foreign_catalog_fingerprint}
\else
\set expected_foreign_catalog_fingerprint __MISSING__
\endif
\if :{?expected_stage_fingerprint}
\else
\set expected_stage_fingerprint __MISSING__
\endif

begin;

create temporary table clinical_master_operational_v3_phase_c_input (
  payload jsonb not null,
  pricing jsonb not null,
  rehearsal_scope text not null,
  baseline_mode text not null,
  expected_release_fingerprint text not null,
  expected_pilot_fingerprint text not null,
  expected_cheongdam_fingerprint text not null,
  expected_demo_fingerprint text not null,
  expected_foreign_fingerprint text not null,
  expected_stage_fingerprint text not null
) on commit drop;
insert into clinical_master_operational_v3_phase_c_input(payload,pricing,rehearsal_scope,baseline_mode,expected_release_fingerprint,expected_pilot_fingerprint,expected_cheongdam_fingerprint,expected_demo_fingerprint,expected_foreign_fingerprint,expected_stage_fingerprint)
values (:'payload_json'::jsonb, :'pricing_json'::jsonb, :'rehearsal_scope', :'baseline_mode', :'expected_release_fingerprint', :'expected_pilot_catalog_fingerprint', :'expected_cheongdam_catalog_fingerprint', :'expected_demo_catalog_fingerprint', :'expected_foreign_catalog_fingerprint', :'expected_stage_fingerprint');

create temporary table clinical_master_operational_v3_phase_c_state (
  state_key text primary key,
  state_value jsonb not null
) on commit drop;

create temporary table clinical_master_operational_v3_phase_c_custom_before (
  workspace_id text not null,
  item_id text not null,
  snapshot jsonb not null,
  primary key (workspace_id,item_id)
) on commit drop;

-- The old consultation key is a central/legacy workspace identity, not a v3
-- payload row.  Capture its complete item + immutable version/name/source/type
-- + linked-review surface so the operational adoption rehearsal cannot mutate
-- or resolve it accidentally.
create temporary table cm_phase_c_legacy_initial_before (
  workspace_id text not null,
  item_id text not null,
  snapshot jsonb not null,
  fingerprint text not null,
  primary key (workspace_id,item_id)
) on commit drop;

create temporary table clinical_master_operational_v3_phase_c_catalog_before (
  workspace_id text primary key,
  row_count integer not null,
  fingerprint text not null
) on commit drop;

create temporary table clinical_master_operational_v3_phase_c_collision_rules (
  workspace_id text not null,
  custom_row_id text not null,
  master_key text not null,
  expected_custom_name text not null,
  match_kind text not null,
  primary key (workspace_id,custom_row_id,master_key)
) on commit drop;
insert into clinical_master_operational_v3_phase_c_collision_rules values
  ('workspace-clair-cheongdam','cd-consult-first','cm.order.consult.first-visit','초진 진찰','reviewed_semantic_equivalence'),
  ('workspace-clair-cheongdam','cd-consult-revisit','cm.order.consult.followup','재진 진찰','reviewed_semantic_equivalence'),
  ('workspace-clair-cheongdam','cd-dispensing-oral-basic','cm.order.dispensing.oral','경구약 조제','reviewed_semantic_equivalence'),
  ('workspace-clair-cheongdam','cd-imaging-us-abdomen','cm.order.imaging.abdominal-ultrasound','복부 초음파','reviewed_semantic_equivalence'),
  ('workspace-clair-cheongdam','cd-lab-cbc','cm.order.lab.panel.cbc-basic','CBC 혈구검사','reviewed_semantic_equivalence'),
  ('workspace-clair-cheongdam','cd-lab-chem10','cm.order.lab.panel.chemistry-basic','혈액화학 10종','reviewed_semantic_equivalence'),
  ('workspace-clair-cheongdam','cd-lab-ua','cm.order.lab.panel.urinalysis','요검사','reviewed_semantic_equivalence'),
  ('workspace-clair-cheongdam','cd-treatment-ear-clean','cm.order.treatment.ear-cleaning','귀 세정','exact_normalized_name'),
  ('workspace-clair-cheongdam','cd-treatment-fluid-sc','cm.order.synthetic.treatment-02','피하수액','reviewed_semantic_equivalence'),
  ('workspace-clair-cheongdam','cd-vaccine-core','cm.order.synthetic.preventive-01','종합백신','reviewed_semantic_equivalence'),
  ('workspace-clair-cheongdam','cd-hospitalization-day','cm.order.synthetic.inpatient-01','입원 1일','reviewed_semantic_equivalence');

-- The reviewed Cheongdam collision set is a precondition, not a discovery
-- result.  The full rehearsal must fail before adoption if any expected
-- custom row is absent or has drifted.
create temporary table cm_phase_c_cheongdam_expected (
  item_id text primary key,
  expected_name text not null,
  expected_status text not null
) on commit drop;
insert into cm_phase_c_cheongdam_expected values
  ('cd-consult-first','초진 진찰','active'),
  ('cd-consult-revisit','재진 진찰','active'),
  ('cd-dispensing-oral-basic','경구약 조제','active'),
  ('cd-hospitalization-day','입원 1일','active'),
  ('cd-imaging-us-abdomen','복부 초음파','active'),
  ('cd-lab-cbc','CBC 혈구검사','active'),
  ('cd-lab-chem10','혈액화학 10종','active'),
  ('cd-lab-ua','요검사','active'),
  ('cd-treatment-ear-clean','귀 세정','active'),
  ('cd-treatment-fluid-sc','피하수액','active'),
  ('cd-vaccine-core','종합백신','active');

create temporary table clinical_master_operational_v3_phase_c_foreign_before (
  table_name text primary key,
  row_count integer not null,
  fingerprint text not null
) on commit drop;

create temporary table cm_phase_c_supported_ids (
  master_record_id uuid primary key
) on commit drop;

-- Publisher versions are additive: unchanged owners can legitimately have no
-- version row tagged with the new release.  Payload ownership, therefore,
-- comes from these inline master-key sets, not from release_id joins.
create temporary table cm_phase_c_payload_records (
  master_key text primary key,
  record_type text not null
) on commit drop;

create temporary table cm_phase_c_referenced_test_keys (
  master_key text primary key
) on commit drop;

-- Freeze the complete lab-test target set traversed by the lab adopter for
-- each workspace.  This includes eligible legacy catalog profiles, v3
-- profiles/panel members, and eligible current central-order profiles for
-- missing pre-adoption workspace catalog rows that the base adopter creates.
create temporary table cm_phase_c_lab_adoption_test_targets (
  workspace_id text not null,
  master_key text not null,
  master_record_id uuid not null,
  primary key (workspace_id,master_key),
  unique (workspace_id,master_record_id)
) on commit drop;

-- Preserve one row for every profile the final lab helper can actually read
-- before the adopter changes any catalog pin, plus each eligible current
-- central-order profile that the base adopter will create before traversal.  A
-- v3 release profile is added alongside each existing pinned profile so an
-- overlapping legacy target stays in the frozen set until the order review
-- resolves its pin.
create temporary table cm_phase_c_lab_adoption_profile_targets (
  workspace_id text not null,
  source_kind text not null,
  source_catalog_id text,
  source_order_record_id uuid not null,
  profile_ordinal bigint not null,
  profile jsonb not null,
  panel_master_record_id_text text,
  panel_master_revision_text text,
  test_master_record_id_text text,
  test_master_revision_text text
) on commit drop;

-- This is intentionally a multiset during validation.  Duplicate rows from
-- one pinned profile are rejected; the final target table deduplicates only
-- validated overlaps across different profiles/catalogs.
create temporary table cm_phase_c_lab_adoption_target_candidates (
  workspace_id text not null,
  source_kind text not null,
  source_catalog_id text,
  source_order_record_id uuid not null,
  profile_ordinal bigint not null,
  target_ordinal bigint not null,
  profile_kind text not null,
  target_master_key text,
  target_master_record_id uuid,
  target_revision integer
) on commit drop;

-- Freeze review authority before any public catalog/review RPC can mutate it.
-- The target table is populated per workspace after the price-only pass and is
-- then re-locked/revalidated by ID before each resolver call.
create temporary table cm_phase_c_order_review_targets (
  workspace_id text not null,
  update_id uuid not null,
  item_id text not null,
  source_master_record_id uuid not null,
  master_key text not null,
  update_release_id uuid not null,
  update_release_key text not null,
  update_release_no bigint not null,
  held_version_id uuid not null,
  held_version_release_id uuid not null,
  held_version_release_key text not null,
  held_version_release_no bigint not null,
  held_revision integer not null,
  master_current_revision integer not null,
  item_catalog_revision integer not null,
  price_krw integer not null,
  update_type text not null,
  update_status text not null,
  update_previous_source_revision integer,
  update_workspace_snapshot jsonb,
  update_source_revision integer not null,
  update_source_snapshot jsonb not null,
  update_source_fingerprint text not null,
  item_source_revision integer not null,
  item_source_snapshot jsonb not null,
  item_source_fingerprint text not null,
  canonical_source_projection jsonb not null,
  canonical_source_fingerprint text not null,
  held_version_snapshot jsonb not null,
  primary key (workspace_id, update_id)
) on commit drop;

do $phase_c$
declare
  v_input record;
  v_payload jsonb;
  v_pricing jsonb;
  v_scope text;
  v_baseline_mode text;
  v_result jsonb;
  v_publish_result jsonb;
  v_adoption_result jsonb;
  v_adoption_retry_result jsonb;
  v_retry jsonb;
  v_release_id uuid;
  v_release_no bigint;
  v_release_fingerprint text;
  v_before_release_count integer;
  v_before_max_release_no bigint;
  v_before_release_sequence_name text;
  v_before_release_sequence_last_value bigint;
  v_before_release_sequence_is_called boolean;
  v_before_release_sequence_next_no bigint;
  v_release_sequence regclass;
  v_sequence_restore_last_value bigint;
  v_sequence_restore_is_called boolean;
  v_before_release_fingerprint text;
  v_before_supported_count integer;
  v_expected_supported_count integer;
  v_before_stage_count integer;
  v_before_stage_fingerprint text;
  v_after_stage_count integer;
  v_after_stage_fingerprint text;
  v_before_history_fingerprint text;
  v_after_history_fingerprint text;
  v_before_supported_identity_history text;
  v_after_supported_identity_history text;
  v_pricing_key_price_sha text;
  v_before_type_counts jsonb;
  v_after_type_counts jsonb;
  v_baseline_release_fingerprint text;
  v_expected_release_fingerprint text;
  v_expected_pilot_fingerprint text;
  v_expected_cheongdam_fingerprint text;
  v_expected_demo_fingerprint text;
  v_expected_foreign_fingerprint text;
  v_expected_stage_fingerprint text;
  v_workspace text;
  v_actor uuid;
  v_previous_claims text;
  v_original_claims text;
  v_original_sub text;
  v_update record;
  v_update_release record;
  v_target record;
  v_master record;
  v_held_version record;
  v_held_release record;
  v_item record;
  v_price jsonb;
  v_collision record;
  v_admin_count integer;
  v_catalog_count integer;
  v_catalog_fingerprint text;
  v_before_custom_fingerprint text;
  v_after_custom_fingerprint text;
  v_lab_test_count integer;
  v_lab_catalog_count integer;
  v_lab_link_count integer;
  v_before_lab_test_version_item_count integer;
  v_before_lab_test_version_count integer;
  v_before_lab_test_version_fingerprint text;
  v_after_first_lab_test_version_count integer;
  v_after_first_lab_test_item_count integer;
  v_after_retry_lab_test_version_count integer;
  v_after_first_lab_test_version_fingerprint text;
  v_after_retry_lab_test_version_fingerprint text;
  v_frozen_lab_test_target_count integer;
  v_frozen_lab_test_target_key_count integer;
  v_frozen_lab_test_target_record_count integer;
  v_adoption_catalog_count integer;
  v_adoption_created_item_count integer;
  v_adoption_created_link_count integer;
  v_expected_workspace_lab_catalog_count integer;
  v_expected_workspace_lab_link_attempt_count integer;
  v_expected_initial_workspace_lab_link_attempt_count integer;
  v_retry_catalog_count integer;
  v_retry_created_item_count integer;
  v_retry_created_link_count integer;
  v_order_review_target_count integer;
  v_payload_catalog_count integer;
  v_payload_pending_review_count integer;
  v_positive_price_payload_count integer;
  v_canonical_projection_match_count integer;
  v_version_release_match_count integer;
  v_pre_activation_missing jsonb;
  v_pre_activation_pending jsonb;
  v_pre_activation_coverage jsonb;
  v_before_lab_link_count integer;
  v_expected_lab_test_count integer;
  v_expected_profile_count integer;
  v_expected_direct_profile_count integer;
  v_expected_panel_profile_count integer;
  v_expected_panel_item_count integer;
  v_lab_link_attempt_diagnostic jsonb;
  v_before_audit_count integer;
  v_after_audit_count integer;
  v_before_audit_fingerprint text;
  v_after_audit_fingerprint text;
  v_table_name text;
  v_proc regprocedure;
  v_function record;
  v_function_oid oid;
  v_column_default text;
  v_column_not_null boolean;
  v_constraint text;
begin
  select * into v_input from clinical_master_operational_v3_phase_c_input limit 1;
  v_payload := v_input.payload;
  v_pricing := v_input.pricing;
  v_scope := v_input.rehearsal_scope;
  v_baseline_mode := v_input.baseline_mode;
  v_expected_release_fingerprint := v_input.expected_release_fingerprint;
  v_expected_pilot_fingerprint := v_input.expected_pilot_fingerprint;
  v_expected_cheongdam_fingerprint := v_input.expected_cheongdam_fingerprint;
  v_expected_demo_fingerprint := v_input.expected_demo_fingerprint;
  v_expected_foreign_fingerprint := v_input.expected_foreign_fingerprint;
  v_expected_stage_fingerprint := v_input.expected_stage_fingerprint;
  v_original_claims := current_setting('request.jwt.claims',true);
  v_original_sub := current_setting('request.jwt.claim.sub',true);

  if v_scope not in ('full','publisher_only') then
    raise exception 'clinical_master_phase_c_scope_invalid';
  end if;
  if v_baseline_mode not in ('remote','local') then
    raise exception 'clinical_master_phase_c_baseline_mode_invalid';
  end if;
  if v_scope = 'full' and v_baseline_mode <> 'remote' then
    raise exception 'clinical_master_phase_c_full_requires_remote_baseline';
  end if;
  if v_payload->>'adoptionScope' <> 'payload' then
    raise exception 'clinical_master_phase_c_payload_adoption_scope_invalid';
  end if;
  if not exists (
    select 1
    from information_schema.columns
    where table_schema='master' and table_name='master_releases' and column_name='adoption_scope'
  ) then
    raise exception 'clinical_master_phase_c_release_adoption_scope_column_missing';
  end if;
  if jsonb_array_length(coalesce(v_payload->'records','[]'::jsonb)) <> 230
     or jsonb_array_length(coalesce(v_payload->'classificationPaths','[]'::jsonb)) <> 13
     or jsonb_array_length(coalesce(v_payload->'labPanelItems','[]'::jsonb)) <> 60
     or jsonb_array_length(coalesce(v_payload->'labOrderProfiles','[]'::jsonb)) <> 30 then
    raise exception 'clinical_master_phase_c_payload_counts_invalid';
  end if;
  if jsonb_array_length(coalesce(v_pricing->'orders','[]'::jsonb)) <> 120
     or (v_pricing->>'totalSyntheticWorkspacePriceKrw')::integer <> 5529073 then
    raise exception 'clinical_master_phase_c_pricing_counts_invalid';
  end if;
  if v_payload::text ~ '"(priceKrw|price_krw|weightTier|weight_tier|orderSet|order_set|orderSetId|order_set_id)"' then
    raise exception 'clinical_master_phase_c_forbidden_publisher_field';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_pricing->'orders') price
    where coalesce((price->>'syntheticWorkspacePriceKrw')::integer,0) <= 0
       or (price->>'syntheticWorkspacePriceKrw')::integer <> (price->>'syntheticWorkspacePriceKrw')::numeric
  ) then
    raise exception 'clinical_master_phase_c_price_positive_integer_required';
  end if;
  if (select count(distinct price->>'masterKey') from jsonb_array_elements(v_pricing->'orders') price) <> 120
     or (select count(distinct (price->>'syntheticWorkspacePriceKrw')::integer) from jsonb_array_elements(v_pricing->'orders') price) <> 120 then
    raise exception 'clinical_master_phase_c_price_key_or_amount_collision';
  end if;
  select encode(extensions.digest(convert_to(coalesce(string_agg((price->>'masterKey')||'='||(price->>'syntheticWorkspacePriceKrw'),E'\n' order by price->>'masterKey'),'') ,'UTF8'),'sha256'),'hex')
    into v_pricing_key_price_sha
  from jsonb_array_elements(v_pricing->'orders') price;
  if v_pricing_key_price_sha <> '35fa6f6ec16f23c43a774b0f8abe03fa43fa8bfd6962278e0a76469580e05abf' then
    raise exception 'clinical_master_phase_c_pricing_key_price_fingerprint_mismatch:%',v_pricing_key_price_sha;
  end if;
  if (select count(*) from jsonb_array_elements(v_payload->'records') record_row where record_row->>'recordType'='order') <> 120
     or (select count(*) from jsonb_array_elements(v_payload->'records') record_row where record_row->>'recordType'='lab_test') <> 36
     or (select count(*) from jsonb_array_elements(v_payload->'records') record_row where record_row->>'recordType'='lab_panel') <> 10 then
    raise exception 'clinical_master_phase_c_order_lab_shape_invalid';
  end if;
  insert into cm_phase_c_payload_records(master_key,record_type)
  select record_row.value->>'masterKey',record_row.value->>'recordType'
  from jsonb_array_elements(v_payload->'records') record_row(value);
  insert into cm_phase_c_referenced_test_keys(master_key)
  select referenced.master_key
  from (
    select nullif(pg_catalog.btrim(item_row.value->>'testMasterKey'),'') as master_key
    from jsonb_array_elements(coalesce(v_payload->'labPanelItems','[]'::jsonb)) item_row(value)
    union
    select nullif(pg_catalog.btrim(profile_row.value->>'labTestMasterKey'),'') as master_key
    from jsonb_array_elements(coalesce(v_payload->'labOrderProfiles','[]'::jsonb)) profile_row(value)
  ) referenced
  where referenced.master_key is not null;
  if (select count(*) from cm_phase_c_payload_records)<>230
     or (select count(*) from cm_phase_c_payload_records where record_type='order')<>120
     or (select count(*) from cm_phase_c_payload_records where record_type='lab_test')<>36
     or (select count(*) from cm_phase_c_payload_records where record_type='lab_panel')<>10 then
    raise exception 'clinical_master_phase_c_payload_record_set_invalid';
  end if;
  if (select count(*) from cm_phase_c_referenced_test_keys)<>30 then
    raise exception 'clinical_master_phase_c_referenced_lab_test_set_invalid';
  end if;
  if exists (select 1 from cm_phase_c_payload_records where master_key='cm.order.consult.initial')
     or not exists (select 1 from cm_phase_c_payload_records where master_key='cm.order.consult.first-visit' and record_type='order')
     or exists (select 1 from jsonb_array_elements(v_pricing->'orders') price where price->>'masterKey'='cm.order.consult.initial')
     or not exists (select 1 from jsonb_array_elements(v_pricing->'orders') price where price->>'masterKey'='cm.order.consult.first-visit') then
    raise exception 'clinical_master_phase_c_legacy_consultation_key_boundary_invalid';
  end if;
  if exists (
    select 1 from cm_phase_c_referenced_test_keys referenced
    where not exists (
      select 1 from cm_phase_c_payload_records payload_record
      where payload_record.master_key=referenced.master_key and payload_record.record_type='lab_test'
    )
  ) then
    raise exception 'clinical_master_phase_c_referenced_lab_test_not_in_payload';
  end if;

  -- The release-scoped migration is a prerequisite, not an assumption.  Pin
  -- every new or renamed internal function plus the manifest/scope schema
  -- before the publisher or any workspace writer can run.
  for v_function in
    select * from (values
      ('private.clinical_master_assert_contract_keys(text,jsonb)', '', false),
      ('private.clinical_master_canonicalize_payload(jsonb)', '', false),
      ('private.clinical_master_payload_manifest_content_sha256(uuid,text,text,boolean,integer,jsonb,jsonb)', '', false),
      ('private.clinical_master_release_payload_owner_manifest_immutable()', 'pg_catalog', true),
      ('private.clinical_master_set_release_adoption_scope()', 'pg_catalog', true),
      ('private.publish_clinical_master_release_cumulative(jsonb,uuid)', 'public, private, master, extensions, pg_catalog', true),
      ('private.publish_clinical_master_release(jsonb,uuid)', 'public, private, master, extensions, pg_catalog', true),
      ('private.clair_adopt_master_release_to_workspace_a2_cumulative(text,uuid)', 'public, private, master, extensions, pg_temp', true),
      ('private.clair_adopt_master_release_to_workspace_payload(text,uuid)', 'public, private, master, extensions, pg_temp', true),
      ('private.clair_adopt_master_release_to_workspace_a2_base(text,uuid)', 'public, private, master, extensions, pg_temp', true),
      ('private.clair_adopt_lab_master_projection_to_workspace_payload(text,uuid)', 'public, private, master, extensions, pg_temp, pg_catalog', true),
      ('private.clair_adopt_master_release_to_workspace(text,uuid)', 'public, private, master, extensions, pg_catalog', true),
      ('private.clair_adopt_lab_master_projection_to_workspace(text,uuid)', 'public, private, master, extensions, pg_temp, pg_catalog', true)
    ) as expected(signature,search_path,security_definer)
  loop
    v_function_oid := pg_catalog.to_regprocedure(v_function.signature);
    if v_function_oid is null then
      raise exception 'clinical_master_phase_c_release_scope_function_missing:%',v_function.signature;
    end if;
    if not exists (
      select 1 from pg_catalog.pg_proc proc
      where proc.oid=v_function_oid
        and pg_catalog.pg_get_userbyid(proc.proowner)='postgres'
        and proc.prosecdef is not distinct from v_function.security_definer
        and proc.proconfig is not distinct from array[
          case when v_function.search_path='' then 'search_path=""'
            else 'search_path='||v_function.search_path end
        ]::text[]
    )
       or pg_catalog.has_function_privilege('anon',v_function_oid,'execute')
       or pg_catalog.has_function_privilege('authenticated',v_function_oid,'execute')
       or pg_catalog.has_function_privilege('service_role',v_function_oid,'execute') then
      raise exception 'clinical_master_phase_c_release_scope_function_security_failed:%',v_function.signature;
    end if;
  end loop;
  if pg_catalog.to_regclass('private.clinical_master_release_payload_owner_manifest') is null then
    raise exception 'clinical_master_phase_c_payload_manifest_table_missing';
  end if;
  if pg_catalog.pg_get_userbyid((
       select relowner from pg_catalog.pg_class
       where oid='private.clinical_master_release_payload_owner_manifest'::pg_catalog.regclass
     )) <> 'postgres'
     or pg_catalog.has_table_privilege('anon','private.clinical_master_release_payload_owner_manifest','select,insert,update,delete')
     or pg_catalog.has_table_privilege('authenticated','private.clinical_master_release_payload_owner_manifest','select,insert,update,delete')
     or pg_catalog.has_table_privilege('service_role','private.clinical_master_release_payload_owner_manifest','select,insert,update,delete') then
    raise exception 'clinical_master_phase_c_payload_manifest_table_security_failed';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_trigger trigger_row
    where trigger_row.tgrelid='private.clinical_master_release_payload_owner_manifest'::pg_catalog.regclass
      and trigger_row.tgname='clinical_master_release_payload_owner_manifest_immutable'
      and trigger_row.tgfoid='private.clinical_master_release_payload_owner_manifest_immutable()'::pg_catalog.regprocedure
      and trigger_row.tgenabled='O'
      and not trigger_row.tgisinternal
      and pg_catalog.pg_get_triggerdef(trigger_row.oid) like 'CREATE TRIGGER clinical_master_release_payload_owner_manifest_immutable BEFORE INSERT OR DELETE OR UPDATE ON private.clinical_master_release_payload_owner_manifest%'
  ) then
    raise exception 'clinical_master_phase_c_payload_manifest_trigger_invalid';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_trigger trigger_row
    where trigger_row.tgrelid='master.master_releases'::pg_catalog.regclass
      and trigger_row.tgname='master_releases_set_adoption_scope'
      and trigger_row.tgfoid='private.clinical_master_set_release_adoption_scope()'::pg_catalog.regprocedure
      and trigger_row.tgenabled='O'
      and not trigger_row.tgisinternal
      and pg_catalog.pg_get_triggerdef(trigger_row.oid) like 'CREATE TRIGGER master_releases_set_adoption_scope BEFORE INSERT ON master.master_releases%'
  ) then
    raise exception 'clinical_master_phase_c_adoption_scope_trigger_invalid';
  end if;
  select attribute.attnotnull,pg_catalog.pg_get_expr(definition.adbin,definition.adrelid)
    into v_column_not_null,v_column_default
  from pg_catalog.pg_attribute attribute
  left join pg_catalog.pg_attrdef definition
    on definition.adrelid=attribute.attrelid and definition.adnum=attribute.attnum
  where attribute.attrelid='master.master_releases'::pg_catalog.regclass
    and attribute.attname='adoption_scope'
    and not attribute.attisdropped;
  if v_column_not_null is distinct from true
     or v_column_default is distinct from '''cumulative''::text'
     or (select count(*) from pg_catalog.pg_constraint constraint_row
         where constraint_row.conrelid='master.master_releases'::pg_catalog.regclass
           and constraint_row.conname='master_releases_adoption_scope_check'
           and constraint_row.contype='c'
           and constraint_row.convalidated
           and pg_catalog.pg_get_constraintdef(constraint_row.oid) =
             'CHECK ((adoption_scope = ANY (ARRAY[''cumulative''::text, ''payload''::text])))') <> 1 then
    raise exception 'clinical_master_phase_c_adoption_scope_schema_invalid';
  end if;

  -- Fail closed on the private/public RPC contract and its security boundary.
  for v_proc in
    select unnest(array[
      'private.publish_clinical_master_release(jsonb,uuid)'::regprocedure,
      'private.clair_adopt_master_release_to_workspace(text,uuid)'::regprocedure,
      'public.clair_update_order_catalog_item(text,text,integer,jsonb)'::regprocedure,
      'public.clair_resolve_workspace_master_update(text,uuid,integer,text)'::regprocedure,
      'public.clair_resolve_workspace_lab_definition_update(text,uuid,uuid,integer,text)'::regprocedure
    ])
  loop
    if not exists (select 1 from pg_proc proc where proc.oid=v_proc and proc.prosecdef and pg_get_userbyid(proc.proowner)='postgres') then
      raise exception 'clinical_master_phase_c_function_owner_security_failed:%',v_proc;
    end if;
  end loop;
  if not exists (select 1 from pg_proc proc where proc.oid='private.publish_clinical_master_release(jsonb,uuid)'::regprocedure and proc.proconfig @> array['search_path=public, private, master, extensions, pg_catalog']) then raise exception 'clinical_master_phase_c_publisher_search_path_failed'; end if;
  if not exists (select 1 from pg_proc proc where proc.oid='private.clair_adopt_master_release_to_workspace(text,uuid)'::regprocedure and proc.proconfig @> array['search_path=public, private, master, extensions, pg_catalog']) then raise exception 'clinical_master_phase_c_adopter_search_path_failed'; end if;
  if not exists (select 1 from pg_proc proc where proc.oid='public.clair_update_order_catalog_item(text,text,integer,jsonb)'::regprocedure and proc.proconfig @> array['search_path=public, private, master, extensions, pg_catalog']) then raise exception 'clinical_master_phase_c_catalog_search_path_failed'; end if;
  if not exists (select 1 from pg_proc proc where proc.oid='public.clair_resolve_workspace_master_update(text,uuid,integer,text)'::regprocedure and proc.proconfig @> array['search_path=public, private, master, pg_temp']) then raise exception 'clinical_master_phase_c_review_search_path_failed'; end if;
  if not exists (select 1 from pg_proc proc where proc.oid='public.clair_resolve_workspace_lab_definition_update(text,uuid,uuid,integer,text)'::regprocedure and proc.proconfig @> array['search_path=public, private, master, extensions, pg_catalog']) then raise exception 'clinical_master_phase_c_lab_review_search_path_failed'; end if;
  if has_function_privilege('anon','private.publish_clinical_master_release(jsonb,uuid)'::regprocedure,'execute')
     or has_function_privilege('authenticated','private.publish_clinical_master_release(jsonb,uuid)'::regprocedure,'execute')
     or has_function_privilege('service_role','private.publish_clinical_master_release(jsonb,uuid)'::regprocedure,'execute')
     or has_function_privilege('anon','private.clair_adopt_master_release_to_workspace(text,uuid)'::regprocedure,'execute')
     or has_function_privilege('authenticated','private.clair_adopt_master_release_to_workspace(text,uuid)'::regprocedure,'execute')
     or has_function_privilege('service_role','private.clair_adopt_master_release_to_workspace(text,uuid)'::regprocedure,'execute') then
    raise exception 'clinical_master_phase_c_private_execute_leaked';
  end if;
  if not has_function_privilege('authenticated','public.clair_update_order_catalog_item(text,text,integer,jsonb)'::regprocedure,'execute') or not has_function_privilege('authenticated','public.clair_resolve_workspace_master_update(text,uuid,integer,text)'::regprocedure,'execute') or not has_function_privilege('authenticated','public.clair_resolve_workspace_lab_definition_update(text,uuid,uuid,integer,text)'::regprocedure,'execute') then raise exception 'clinical_master_phase_c_authenticated_execute_missing'; end if;
  if has_function_privilege('anon','public.clair_update_order_catalog_item(text,text,integer,jsonb)'::regprocedure,'execute')
     or has_function_privilege('anon','public.clair_resolve_workspace_master_update(text,uuid,integer,text)'::regprocedure,'execute')
     or has_function_privilege('anon','public.clair_resolve_workspace_lab_definition_update(text,uuid,uuid,integer,text)'::regprocedure,'execute')
     or has_function_privilege('service_role','public.clair_update_order_catalog_item(text,text,integer,jsonb)'::regprocedure,'execute')
     or has_function_privilege('service_role','public.clair_resolve_workspace_master_update(text,uuid,integer,text)'::regprocedure,'execute')
     or has_function_privilege('service_role','public.clair_resolve_workspace_lab_definition_update(text,uuid,uuid,integer,text)'::regprocedure,'execute') then
    raise exception 'clinical_master_phase_c_public_execute_leaked';
  end if;

  foreach v_constraint in array array[
    'clinical_master_lab_publish_stage_record_type_check',
    'order_catalog_items_origin_type_check',
    'order_catalog_items_source_lineage_check',
    'order_catalog_items_price_krw_check',
    'order_catalog_items_availability_status_check',
    'order_catalog_items_active_price_check'
  ] loop
    if not exists (select 1 from pg_constraint where conname=v_constraint) then raise exception 'clinical_master_phase_c_constraint_missing:%',v_constraint; end if;
  end loop;
  if to_regclass('public.order_catalog_items_workspace_source_key') is null or to_regclass('public.order_catalog_items_source_master_record_idx') is null then raise exception 'clinical_master_phase_c_lineage_index_missing'; end if;

  select count(*),coalesce(max(release_no),0) into v_before_release_count,v_before_max_release_no from master.master_releases;
  if exists (select 1 from master.master_records where master_key='cm.order.consult.first-visit') then
    raise exception 'clinical_master_phase_c_fresh_consultation_key_preflight_present:central';
  end if;
  if v_scope='full' and (
    exists (select 1 from public.order_catalog_items item join master.master_records master_row on master_row.id=item.source_master_record_id where item.workspace_id=any(array['workspace-clinical-master-pilot-v1','workspace-clair-cheongdam','clair-demo']::text[]) and master_row.master_key='cm.order.consult.first-visit')
    or exists (select 1 from public.workspace_master_updates update_row join master.master_records master_row on master_row.id=update_row.source_master_record_id where update_row.workspace_id=any(array['workspace-clinical-master-pilot-v1','workspace-clair-cheongdam','clair-demo']::text[]) and master_row.master_key='cm.order.consult.first-visit')
  ) then
    raise exception 'clinical_master_phase_c_fresh_consultation_key_preflight_present:workspace';
  end if;
  select pg_get_serial_sequence('master.master_releases','release_no') into v_before_release_sequence_name;
  if v_before_release_sequence_name is null then raise exception 'clinical_master_phase_c_release_sequence_missing'; end if;
  v_release_sequence := v_before_release_sequence_name::regclass;
  if v_release_sequence::text<>'master.master_releases_release_no_seq' then raise exception 'clinical_master_phase_c_release_sequence_binding_invalid:%',v_release_sequence::text; end if;
  execute format('select last_value,is_called from %s',v_release_sequence) into v_before_release_sequence_last_value,v_before_release_sequence_is_called;
  v_sequence_restore_last_value := v_before_release_sequence_last_value;
  v_sequence_restore_is_called := v_before_release_sequence_is_called;
  v_before_release_sequence_next_no := case when v_before_release_sequence_is_called then v_before_release_sequence_last_value+1 else v_before_release_sequence_last_value end;
  select source_fingerprint into v_before_release_fingerprint from master.master_releases order by release_no desc limit 1;
  select count(*) into v_before_supported_count from master.master_records where record_type in ('order_category','clinical_action','chart_group','task_route','order','species','unit','specimen_type','result_input_type','lab_test','lab_panel');
  insert into cm_phase_c_supported_ids(master_record_id)
  select id from master.master_records where record_type in ('order_category','clinical_action','chart_group','task_route','order','species','unit','specimen_type','result_input_type','lab_test','lab_panel');
  select coalesce(jsonb_object_agg(record_type,row_count order by record_type),'{}'::jsonb) into v_before_type_counts from (select record_type,count(*)::integer row_count from master.master_records where record_type in ('order_category','clinical_action','chart_group','task_route','order','species','unit','specimen_type','result_input_type','lab_test','lab_panel') group by record_type) counts;
  select count(*) into v_before_stage_count from private.clinical_master_lab_publish_stage;
  select encode(extensions.digest(convert_to(coalesce(jsonb_agg(to_jsonb(stage) order by stage.release_id,stage.master_record_id),'[]'::jsonb)::text,'UTF8'),'sha256'),'hex') into v_before_stage_fingerprint from private.clinical_master_lab_publish_stage stage;
  select count(*) into v_before_audit_count from public.audit_events;
  select encode(extensions.digest(convert_to(jsonb_build_array(
    jsonb_build_object('table','master_releases','rows',coalesce((select jsonb_agg(to_jsonb(row_data) order by row_data.release_no,row_data.id) from (select row_data.* from master.master_releases row_data where row_data.release_key<>'cm.release.airtable.operational-master.v3') row_data),'[]'::jsonb)),
    jsonb_build_object('table','master_record_versions','rows',coalesce((select jsonb_agg(to_jsonb(row_data) order by row_data.master_record_id,row_data.revision,row_data.id) from (select version.* from master.master_record_versions version join master.master_releases release_row on release_row.id=version.release_id where release_row.release_key<>'cm.release.airtable.operational-master.v3') row_data),'[]'::jsonb)),
    jsonb_build_object('table','master_review_events','rows',coalesce((select jsonb_agg(to_jsonb(row_data) order by row_data.master_record_id,row_data.revision,row_data.id) from (select event_row.* from master.master_review_events event_row where not exists (select 1 from master.master_record_versions version join master.master_releases release_row on release_row.id=version.release_id where version.master_record_id=event_row.master_record_id and version.revision=event_row.revision and release_row.release_key='cm.release.airtable.operational-master.v3')) row_data),'[]'::jsonb)),
    jsonb_build_object('table','clinical_master_lab_publish_stage','rows',coalesce((select jsonb_agg(to_jsonb(row_data) order by row_data.release_id,row_data.master_record_id) from (select stage.* from private.clinical_master_lab_publish_stage stage where not exists (select 1 from master.master_releases release_row where release_row.id=stage.release_id and release_row.release_key='cm.release.airtable.operational-master.v3')) row_data),'[]'::jsonb)),
    jsonb_build_object('table','clinical_master_lab_test_publish_stage','rows',coalesce((select jsonb_agg(to_jsonb(row_data) order by row_data.release_id,row_data.owner_record_id) from (select stage.* from private.clinical_master_lab_test_publish_stage stage where not exists (select 1 from master.master_releases release_row where release_row.id=stage.release_id and release_row.release_key='cm.release.airtable.operational-master.v3')) row_data),'[]'::jsonb)),
    jsonb_build_object('table','clinical_master_lab_panel_publish_stage','rows',coalesce((select jsonb_agg(to_jsonb(row_data) order by row_data.release_id,row_data.owner_record_id) from (select stage.* from private.clinical_master_lab_panel_publish_stage stage where not exists (select 1 from master.master_releases release_row where release_row.id=stage.release_id and release_row.release_key='cm.release.airtable.operational-master.v3')) row_data),'[]'::jsonb)),
    jsonb_build_object('table','clinical_master_lab_order_publish_stage','rows',coalesce((select jsonb_agg(to_jsonb(row_data) order by row_data.release_id,row_data.owner_record_id) from (select stage.* from private.clinical_master_lab_order_publish_stage stage where not exists (select 1 from master.master_releases release_row where release_row.id=stage.release_id and release_row.release_key='cm.release.airtable.operational-master.v3')) row_data),'[]'::jsonb)),
    jsonb_build_object('table','workspace_master_updates','rows',coalesce((select jsonb_agg(to_jsonb(row_data) order by row_data.workspace_id,row_data.id) from (select update_row.* from public.workspace_master_updates update_row where not exists (select 1 from master.master_releases release_row where release_row.id=update_row.release_id and release_row.release_key='cm.release.airtable.operational-master.v3')) row_data),'[]'::jsonb)),
    jsonb_build_object('table','workspace_lab_item_updates','rows',coalesce((select jsonb_agg(to_jsonb(row_data) order by row_data.workspace_id,row_data.id) from (select update_row.* from public.workspace_lab_item_updates update_row where not exists (select 1 from master.master_releases release_row where release_row.id=update_row.source_release_id and release_row.release_key='cm.release.airtable.operational-master.v3')) row_data),'[]'::jsonb)),
    jsonb_build_object('table','workspace_lab_catalog_updates','rows',coalesce((select jsonb_agg(to_jsonb(row_data) order by row_data.workspace_id,row_data.id) from (select update_row.* from public.workspace_lab_catalog_updates update_row where not exists (select 1 from master.master_releases release_row where release_row.id=update_row.source_release_id and release_row.release_key='cm.release.airtable.operational-master.v3')) row_data),'[]'::jsonb))
  )::text,'UTF8'),'sha256'),'hex') into v_before_history_fingerprint;
  select encode(extensions.digest(convert_to(coalesce((select jsonb_agg(jsonb_build_object(
    'master',jsonb_build_object('id',master_row.id::text,'masterKey',master_row.master_key,'recordType',master_row.record_type,'lifecycleStatus',master_row.lifecycle_status,'safetyStatus',master_row.safety_status,'safetyReason',master_row.safety_reason,'replacementRecordId',master_row.replacement_record_id::text),
    'versions',coalesce((select jsonb_agg(to_jsonb(version_row) order by version_row.revision,version_row.id) from master.master_record_versions version_row join master.master_releases release_row on release_row.id=version_row.release_id where version_row.master_record_id=master_row.id and release_row.release_key<>'cm.release.airtable.operational-master.v3'),'[]'::jsonb),
    'reviews',coalesce((select jsonb_agg(to_jsonb(review_row) order by review_row.revision,review_row.id) from master.master_review_events review_row where review_row.master_record_id=master_row.id and not exists (select 1 from master.master_record_versions version_row join master.master_releases release_row on release_row.id=version_row.release_id where version_row.master_record_id=review_row.master_record_id and version_row.revision=review_row.revision and release_row.release_key='cm.release.airtable.operational-master.v3')),'[]'::jsonb)
  ) order by master_row.master_key,master_row.id) from master.master_records master_row where master_row.record_type in ('order_category','clinical_action','chart_group','task_route','order','species','unit','specimen_type','result_input_type','lab_test','lab_panel') and exists (select 1 from cm_phase_c_supported_ids identity_row where identity_row.master_record_id=master_row.id)),'[]'::jsonb)::text,'UTF8'),'sha256'),'hex') into v_before_supported_identity_history;
  select encode(extensions.digest(convert_to(coalesce(jsonb_agg(to_jsonb(audit_row) order by audit_row.id),'[]'::jsonb)::text,'UTF8'),'sha256'),'hex') into v_before_audit_fingerprint from public.audit_events audit_row;

  if v_baseline_mode='remote' then
    if v_expected_release_fingerprint='__MISSING__' or v_expected_pilot_fingerprint='__MISSING__' or v_expected_cheongdam_fingerprint='__MISSING__' or v_expected_demo_fingerprint='__MISSING__' or v_expected_foreign_fingerprint='__MISSING__' or v_expected_stage_fingerprint='__MISSING__' then raise exception 'clinical_master_phase_c_exact_remote_fingerprints_required'; end if;
    if v_before_release_count<>4 or v_before_max_release_no<>6 or v_before_release_fingerprint<>v_expected_release_fingerprint then raise exception 'clinical_master_phase_c_release_baseline_mismatch'; end if;
    if v_before_release_sequence_name<>'master.master_releases_release_no_seq' or v_before_release_sequence_last_value<>8 or v_before_release_sequence_is_called is distinct from true or v_before_release_sequence_next_no<>9 then raise exception 'clinical_master_phase_c_release_sequence_baseline_mismatch'; end if;
    if v_expected_release_fingerprint<>'85cb291602f3d177ae11a075b4203bdf9e7cb9a3ac68c5a8245a5a90f739b7c7' then raise exception 'clinical_master_phase_c_release_constant_mismatch'; end if;
    if v_before_type_counts <> '{"chart_group":6,"clinical_action":12,"lab_panel":5,"lab_test":14,"order":31,"order_category":8,"result_input_type":4,"species":2,"specimen_type":5,"task_route":6,"unit":8}'::jsonb then raise exception 'clinical_master_phase_c_master_type_baseline_mismatch:%',v_before_type_counts; end if;
    if v_before_stage_count<>172 or v_before_stage_fingerprint<>v_expected_stage_fingerprint then raise exception 'clinical_master_phase_c_stage_baseline_mismatch:%',v_before_stage_count; end if;
    if v_expected_stage_fingerprint<>'eac749d40ab0f0e88f9dabed2a5123b85933367d3fae4a3828ad37893e1a45c4' then raise exception 'clinical_master_phase_c_stage_constant_mismatch'; end if;
    if v_before_supported_identity_history<>'8bbbcdbcfab3bf15aa69bcee87be4caab7aefaf9c3a73998640a8332dbb0b6b1' then raise exception 'clinical_master_phase_c_supported_identity_history_mismatch:%',v_before_supported_identity_history; end if;
  end if;

  -- Existing identity rows are protected by ID/type snapshots. New rows may
  -- be added by the private publisher, but no existing key may be re-typed.
  insert into clinical_master_operational_v3_phase_c_state(state_key,state_value)
  select 'master_identity_before',coalesce(jsonb_agg(jsonb_build_object('id',id::text,'masterKey',master_key,'recordType',record_type) order by master_key),'[]'::jsonb)
  from master.master_records;
  insert into clinical_master_operational_v3_phase_c_state(state_key,state_value)
  select 'release_before',coalesce(jsonb_agg(jsonb_build_object('id',id::text,'releaseNo',release_no,'releaseKey',release_key,'sourceFingerprint',source_fingerprint,'status',status,'recordCount',record_count) order by release_no),'[]'::jsonb)
  from master.master_releases;

  -- nextval() is intentionally outside ordinary transaction rollback. Keep
  -- every operation after the publisher inside this guarded block so every
  -- error path restores the preflight sequence state before re-raising.
  begin
  if v_scope='full' then
    foreach v_workspace in array array['workspace-clinical-master-pilot-v1','workspace-clair-cheongdam','clair-demo','clair-foreign-demo'] loop
      if not exists (select 1 from public.workspaces where id=v_workspace) then raise exception 'clinical_master_phase_c_workspace_missing:%',v_workspace; end if;
      select count(*) into v_admin_count from public.user_memberships membership where membership.workspace_id=v_workspace and membership.status='active' and membership.archived_at is null and membership.roles @> array['hospital_admin']::text[];
      if v_workspace<>'clair-foreign-demo' and v_admin_count=0 then raise exception 'clinical_master_phase_c_active_admin_missing'; end if;
      select count(*),encode(extensions.digest(convert_to(coalesce(jsonb_agg(to_jsonb(item) order by item.id),'[]'::jsonb)::text,'UTF8'),'sha256'),'hex') into v_catalog_count,v_catalog_fingerprint from public.order_catalog_items item where item.workspace_id=v_workspace;
      if v_workspace='workspace-clinical-master-pilot-v1' and (v_catalog_count<>31 or v_catalog_fingerprint<>v_expected_pilot_fingerprint) then raise exception 'clinical_master_phase_c_pilot_catalog_baseline_mismatch'; end if;
      if v_workspace='workspace-clinical-master-pilot-v1' and v_expected_pilot_fingerprint<>'5fe7ba9e93a045076157a77e5c852a5712660f99a0d2afbb3064a143c7586de0' then raise exception 'clinical_master_phase_c_pilot_constant_mismatch'; end if;
      if v_workspace='workspace-clair-cheongdam' and (v_catalog_count<>13 or v_catalog_fingerprint<>v_expected_cheongdam_fingerprint) then raise exception 'clinical_master_phase_c_cheongdam_catalog_baseline_mismatch'; end if;
      if v_workspace='workspace-clair-cheongdam' and v_expected_cheongdam_fingerprint<>'82b9b2a3e9722093a65709a5a9dbdff19f709a8c00616a8203ec0b55f7d1d3c4' then raise exception 'clinical_master_phase_c_cheongdam_constant_mismatch'; end if;
      if v_workspace='clair-demo' and (v_catalog_count<>19 or v_catalog_fingerprint<>v_expected_demo_fingerprint) then raise exception 'clinical_master_phase_c_demo_catalog_baseline_mismatch'; end if;
      if v_workspace='clair-demo' and v_expected_demo_fingerprint<>'c195d802a07ef3f820aed21809bc7d7bf84fa5013ed4e98e4951e64f5242bcf1' then raise exception 'clinical_master_phase_c_demo_constant_mismatch'; end if;
      if v_workspace='clair-foreign-demo' and (v_catalog_count<>0 or v_catalog_fingerprint<>v_expected_foreign_fingerprint) then raise exception 'clinical_master_phase_c_foreign_catalog_baseline_mismatch'; end if;
      if v_workspace='clair-foreign-demo' and v_expected_foreign_fingerprint<>'4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945' then raise exception 'clinical_master_phase_c_foreign_constant_mismatch'; end if;
      insert into clinical_master_operational_v3_phase_c_catalog_before(workspace_id,row_count,fingerprint) values(v_workspace,v_catalog_count,v_catalog_fingerprint);
      insert into clinical_master_operational_v3_phase_c_custom_before(workspace_id,item_id,snapshot)
      select item.workspace_id,item.id,jsonb_build_object('id',item.id,'standardOrderId',item.standard_order_id,'standardOrderName',item.standard_order_name,'inHospitalOrderName',item.in_hospital_order_name,'billingName',item.billing_name,'aliases',item.aliases,'availabilityStatus',item.availability_status,'priceKrw',item.price_krw,'salesUnit',item.sales_unit,'pricingRule',item.pricing_rule,'customizationState',item.customization_state,'customizedFields',item.customized_fields,'originType',item.origin_type,'sourceMasterRecordId',item.source_master_record_id,'sourceProjectionSnapshot',item.source_projection_snapshot,'sourceProjectionFingerprint',item.source_projection_fingerprint)
      from public.order_catalog_items item where item.workspace_id=v_workspace and item.origin_type='workspace_custom';
    end loop;
    if exists (
      select 1 from cm_phase_c_cheongdam_expected expected_row
      where not exists (
        select 1 from public.order_catalog_items actual_row
        where actual_row.workspace_id='workspace-clair-cheongdam'
          and actual_row.id=expected_row.item_id
          and actual_row.origin_type='workspace_custom'
          and actual_row.standard_order_name=expected_row.expected_name
          and actual_row.availability_status=expected_row.expected_status
      )
    ) then
      raise exception 'clinical_master_phase_c_cheongdam_expected_custom_missing_or_changed';
    end if;
    insert into clinical_master_operational_v3_phase_c_foreign_before values
      ('order_catalog_items',(select count(*) from public.order_catalog_items where workspace_id='clair-foreign-demo'),(select encode(extensions.digest(convert_to(coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.id),'[]'::jsonb)::text,'UTF8'),'sha256'),'hex') from public.order_catalog_items row_data where row_data.workspace_id='clair-foreign-demo')),
      ('lab_test_items',(select count(*) from public.lab_test_items where workspace_id='clair-foreign-demo'),(select encode(extensions.digest(convert_to(coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.id),'[]'::jsonb)::text,'UTF8'),'sha256'),'hex') from public.lab_test_items row_data where row_data.workspace_id='clair-foreign-demo')),
      ('lab_test_item_versions',(select count(*) from public.lab_test_item_versions where workspace_id='clair-foreign-demo'),(select encode(extensions.digest(convert_to(coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.lab_test_item_id,row_data.workspace_result_revision),'[]'::jsonb)::text,'UTF8'),'sha256'),'hex') from public.lab_test_item_versions row_data where row_data.workspace_id='clair-foreign-demo')),
      ('order_catalog_lab_test_item_links',(select count(*) from public.order_catalog_lab_test_item_links where workspace_id='clair-foreign-demo'),(select encode(extensions.digest(convert_to(coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.id),'[]'::jsonb)::text,'UTF8'),'sha256'),'hex') from public.order_catalog_lab_test_item_links row_data where row_data.workspace_id='clair-foreign-demo')),
      ('workspace_master_updates',(select count(*) from public.workspace_master_updates where workspace_id='clair-foreign-demo'),(select encode(extensions.digest(convert_to(coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.id),'[]'::jsonb)::text,'UTF8'),'sha256') ,'hex') from public.workspace_master_updates row_data where row_data.workspace_id='clair-foreign-demo')),
      ('workspace_lab_item_updates',(select count(*) from public.workspace_lab_item_updates where workspace_id='clair-foreign-demo'),(select encode(extensions.digest(convert_to(coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.id),'[]'::jsonb)::text,'UTF8'),'sha256'),'hex') from public.workspace_lab_item_updates row_data where row_data.workspace_id='clair-foreign-demo')),
      ('workspace_lab_catalog_updates',(select count(*) from public.workspace_lab_catalog_updates where workspace_id='clair-foreign-demo'),(select encode(extensions.digest(convert_to(coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.id),'[]'::jsonb)::text,'UTF8'),'sha256'),'hex') from public.workspace_lab_catalog_updates row_data where row_data.workspace_id='clair-foreign-demo')),
      ('notification_events',(select count(*) from public.notification_events where workspace_id='clair-foreign-demo'),(select encode(extensions.digest(convert_to(coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.id),'[]'::jsonb)::text,'UTF8'),'sha256'),'hex') from public.notification_events row_data where row_data.workspace_id='clair-foreign-demo')),
      ('notification_user_states',(select count(*) from public.notification_user_states where workspace_id='clair-foreign-demo'),(select encode(extensions.digest(convert_to(coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.notification_id,row_data.state_scope_id),'[]'::jsonb)::text,'UTF8'),'sha256'),'hex') from public.notification_user_states row_data where row_data.workspace_id='clair-foreign-demo')),
      ('audit_events',(select count(*) from public.audit_events where workspace_id='clair-foreign-demo'),(select encode(extensions.digest(convert_to(coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.id),'[]'::jsonb)::text,'UTF8'),'sha256'),'hex') from public.audit_events row_data where row_data.workspace_id='clair-foreign-demo'));
  end if;

  if v_scope='full' then
    -- Freeze the complete legacy initial surface before the publisher or any
    -- target workspace RPC can run.  This includes normalized central owners,
    -- names/sources/species links, and the linked workspace review surface.
    insert into cm_phase_c_legacy_initial_before(workspace_id,item_id,snapshot,fingerprint)
    select item.workspace_id,item.id,legacy_snapshot.value,
      encode(extensions.digest(convert_to(legacy_snapshot.value::text,'UTF8'),'sha256'),'hex')
    from public.order_catalog_items item
    join master.master_records master_row
      on master_row.id=item.source_master_record_id
     and master_row.master_key='cm.order.consult.initial'
     and master_row.record_type='order'
    cross join lateral (
      select jsonb_build_object(
        'item',to_jsonb(item),
        'master',to_jsonb(master_row),
        'names',coalesce((select jsonb_agg(to_jsonb(name_row) order by name_row.language_code,name_row.name_kind,name_row.sort_order,name_row.id) from master.master_record_names name_row where name_row.master_record_id=master_row.id),'[]'::jsonb),
        'recordSources',coalesce((select jsonb_agg(jsonb_build_object('recordSource',to_jsonb(record_source_row),'source',to_jsonb(source_row)) order by record_source_row.source_id,record_source_row.assertion_scope) from master.master_record_sources record_source_row join master.master_sources source_row on source_row.id=record_source_row.source_id where record_source_row.master_record_id=master_row.id),'[]'::jsonb),
        'owners',jsonb_build_object(
          'order',coalesce((select to_jsonb(order_row) from master.orders order_row where order_row.master_record_id=master_row.id),'{}'::jsonb),
          'classificationPath',coalesce((select to_jsonb(path_row) from master.orders order_row join master.classification_paths path_row on path_row.id=order_row.classification_path_id where order_row.master_record_id=master_row.id),'{}'::jsonb),
          'clinicalAction',coalesce((select to_jsonb(action_row) from master.orders order_row join master.classification_paths path_row on path_row.id=order_row.classification_path_id join master.clinical_actions action_row on action_row.master_record_id=path_row.clinical_action_id where order_row.master_record_id=master_row.id),'{}'::jsonb),
          'chartGroup',coalesce((select to_jsonb(chart_row) from master.orders order_row join master.classification_paths path_row on path_row.id=order_row.classification_path_id join master.chart_groups chart_row on chart_row.master_record_id=path_row.chart_group_id where order_row.master_record_id=master_row.id),'{}'::jsonb),
          'taskRoute',coalesce((select to_jsonb(route_row) from master.orders order_row join master.classification_paths path_row on path_row.id=order_row.classification_path_id join master.task_routes route_row on route_row.master_record_id=path_row.task_route_id where order_row.master_record_id=master_row.id),'{}'::jsonb),
          'defaultSalesUnit',coalesce((select to_jsonb(unit_row) from master.orders order_row left join master.units unit_row on unit_row.master_record_id=order_row.default_sales_unit_id where order_row.master_record_id=master_row.id),'{}'::jsonb)
        ),
        'speciesLinks',coalesce((select jsonb_agg(jsonb_build_object('link',to_jsonb(link_row),'species',to_jsonb(species_row)) order by species_row.species_code,link_row.species_record_id) from master.order_species_links link_row join master.species species_row on species_row.master_record_id=link_row.species_record_id where link_row.order_record_id=master_row.id),'[]'::jsonb),
        'versions',coalesce((select jsonb_agg(to_jsonb(version_row) order by version_row.revision,version_row.id) from master.master_record_versions version_row where version_row.master_record_id=master_row.id),'[]'::jsonb),
        'updates',coalesce((select jsonb_agg(to_jsonb(update_row) order by update_row.created_at,update_row.id) from public.workspace_master_updates update_row where update_row.workspace_id=item.workspace_id and update_row.order_catalog_item_id=item.id),'[]'::jsonb),
        'notifications',coalesce((select jsonb_agg(to_jsonb(notification_row) order by notification_row.created_at,notification_row.id) from public.notification_events notification_row where notification_row.workspace_id=item.workspace_id and notification_row.source_entity_id in (select update_row.id::text from public.workspace_master_updates update_row where update_row.workspace_id=item.workspace_id and update_row.order_catalog_item_id=item.id)),'[]'::jsonb)
      ) as value
    ) legacy_snapshot
    where item.workspace_id=any(array['workspace-clinical-master-pilot-v1','workspace-clair-cheongdam','clair-demo']::text[]);
  end if;

  if v_scope='full' then
    v_result := private.publish_clinical_master_release(v_payload,null);
    if coalesce(v_result->>'idempotent','true')<>'false' or v_result->>'recordCount'<>'230' or v_result->>'adoptionScope'<>'payload' or v_result->>'releaseKey' is not null and v_result->>'releaseKey'<>v_payload->>'releaseKey' then raise exception 'clinical_master_phase_c_publish_result_invalid'; end if;
  else
    v_result := private.publish_clinical_master_release(v_payload,null);
  end if;
  v_publish_result := v_result;
  v_release_id := (v_result->>'releaseId')::uuid;
  v_release_no := (v_result->>'releaseNo')::bigint;
  v_release_fingerprint := v_result->>'sourceFingerprint';
  if v_result->>'adoptionScope' <> 'payload' then raise exception 'clinical_master_phase_c_publish_scope_invalid'; end if;
  -- Exact migrated database-canonicalizer PostgreSQL jsonb hash, not JS serialization.
  if v_release_fingerprint <> '0225bc6714210cfe663bded97fe6b3cbf76fedf99dce1540a302c0fd46235893' then
    raise exception 'clinical_master_phase_c_publisher_source_fingerprint_mismatch:%',v_release_fingerprint;
  end if;
  if (v_baseline_mode='remote' and (v_release_no<>v_before_release_sequence_next_no or v_release_no<=v_before_max_release_no or exists (select 1 from master.master_releases existing_release where existing_release.release_no=v_release_no and existing_release.id<>v_release_id)))
     or (v_baseline_mode='local' and v_release_no<=v_before_max_release_no)
     or v_release_fingerprint !~ '^[0-9a-f]{64}$'
     or (select record_count from master.master_releases where id=v_release_id)<>230 then
    raise exception 'clinical_master_phase_c_release_shape_invalid';
  end if;
  if (select adoption_scope from master.master_releases where id=v_release_id) <> 'payload' then raise exception 'clinical_master_phase_c_persisted_scope_invalid'; end if;
  v_retry := private.publish_clinical_master_release(v_payload,null);
  if (v_retry->>'releaseId')::uuid<>v_release_id or (v_retry->>'releaseNo')::bigint<>v_release_no or v_retry->>'sourceFingerprint'<>v_release_fingerprint or v_retry->>'recordCount'<>'230' or v_retry->>'adoptionScope'<>'payload' or v_retry->>'idempotent'<>'true' then raise exception 'clinical_master_phase_c_idempotent_retry_invalid'; end if;
  if v_retry->>'sourceFingerprint' <> '0225bc6714210cfe663bded97fe6b3cbf76fedf99dce1540a302c0fd46235893' then raise exception 'clinical_master_phase_c_retry_source_fingerprint_mismatch'; end if;
  insert into clinical_master_operational_v3_phase_c_state values('publish_result',v_publish_result),('publish_retry',v_retry),('release_id',jsonb_build_object('id',v_release_id::text,'releaseNo',v_release_no,'sourceFingerprint',v_release_fingerprint));

  if not exists (select 1 from master.master_releases where id=v_release_id and release_key='cm.release.airtable.operational-master.v3' and status='published' and record_count=230 and adoption_scope='payload') then raise exception 'clinical_master_phase_c_v3_release_missing'; end if;
  if exists (
    select 1 from cm_phase_c_payload_records payload_record
    where payload_record.record_type='lab_test'
      and not exists (
        select 1 from master.master_records master_row
        where master_row.master_key=payload_record.master_key
          and master_row.record_type='lab_test'
          and master_row.current_revision is not null
      )
  ) then
    raise exception 'clinical_master_phase_c_payload_lab_test_definition_missing';
  end if;
  -- The publisher may preserve an existing master row while adding no new
  -- version for it. The payload key set, not release_id, is therefore the
  -- authoritative post-publish ownership boundary. Every payload key must
  -- resolve exactly once with its declared type and a current revision.
  if exists (
    select 1
    from cm_phase_c_payload_records payload_record
    left join master.master_records master_row
      on master_row.master_key=payload_record.master_key
    group by payload_record.master_key,payload_record.record_type
    having count(master_row.id)<>1
       or bool_and(master_row.record_type=payload_record.record_type and master_row.current_revision is not null) is not true
  ) then
    raise exception 'clinical_master_phase_c_payload_master_resolution_invalid';
  end if;
  if (
    select count(*)
    from cm_phase_c_payload_records payload_record
    join master.master_records master_row
      on master_row.master_key=payload_record.master_key
     and master_row.record_type=payload_record.record_type
     and master_row.current_revision is not null
  )<>230 then
    raise exception 'clinical_master_phase_c_payload_master_count_invalid';
  end if;
  if not exists (
    select 1
    from master.master_records master_row
    join master.master_record_versions version_row on version_row.master_record_id=master_row.id and version_row.revision=1
    join master.master_releases release_row on release_row.id=version_row.release_id and release_row.release_key=v_payload->>'releaseKey' and release_row.status='published'
    cross join lateral (
      select payload_record.value
      from jsonb_array_elements(v_payload->'records') payload_record(value)
      where payload_record.value->>'masterKey'='cm.order.consult.first-visit'
        and payload_record.value->>'recordType'='order'
      limit 1
    ) payload_first
    where master_row.master_key='cm.order.consult.first-visit'
      and master_row.record_type='order'
      and master_row.current_revision=1
      and version_row.release_id=release_row.id
      and version_row.snapshot->>'recordType'='order'
      and version_row.snapshot->>'revision'='1'
      and version_row.snapshot->>'masterKey'='cm.order.consult.first-visit'
      and version_row.snapshot=payload_first.value || jsonb_build_object(
        'revision',1,
        'labOrderProfiles','[]'::jsonb
      )
  ) then
    raise exception 'clinical_master_phase_c_fresh_consultation_key_publish_revision_invalid';
  end if;
  if (select count(*) from master.master_records) < v_before_supported_count then raise exception 'clinical_master_phase_c_master_rows_decreased'; end if;
  if exists (select 1 from jsonb_array_elements((select state_value from clinical_master_operational_v3_phase_c_state where state_key='master_identity_before')) before_row where not exists (select 1 from master.master_records after_row where after_row.id=(before_row->>'id')::uuid and after_row.master_key=before_row->>'masterKey' and after_row.record_type=before_row->>'recordType')) then raise exception 'clinical_master_phase_c_existing_master_identity_changed'; end if;
  select count(*) into v_after_stage_count from private.clinical_master_lab_publish_stage where release_id<>v_release_id;
  select encode(extensions.digest(convert_to(coalesce(jsonb_agg(to_jsonb(stage) order by stage.release_id,stage.master_record_id),'[]'::jsonb)::text,'UTF8'),'sha256'),'hex') into v_after_stage_fingerprint from private.clinical_master_lab_publish_stage stage where stage.release_id<>v_release_id;
  if v_after_stage_count<>v_before_stage_count or v_after_stage_fingerprint<>v_before_stage_fingerprint then raise exception 'clinical_master_phase_c_existing_stage_changed'; end if;
  select encode(extensions.digest(convert_to(jsonb_build_array(
    jsonb_build_object('table','master_releases','rows',coalesce((select jsonb_agg(to_jsonb(row_data) order by row_data.release_no,row_data.id) from (select row_data.* from master.master_releases row_data where row_data.release_key<>'cm.release.airtable.operational-master.v3') row_data),'[]'::jsonb)),
    jsonb_build_object('table','master_record_versions','rows',coalesce((select jsonb_agg(to_jsonb(row_data) order by row_data.master_record_id,row_data.revision,row_data.id) from (select version.* from master.master_record_versions version join master.master_releases release_row on release_row.id=version.release_id where release_row.release_key<>'cm.release.airtable.operational-master.v3') row_data),'[]'::jsonb)),
    jsonb_build_object('table','master_review_events','rows',coalesce((select jsonb_agg(to_jsonb(row_data) order by row_data.master_record_id,row_data.revision,row_data.id) from (select event_row.* from master.master_review_events event_row where not exists (select 1 from master.master_record_versions version join master.master_releases release_row on release_row.id=version.release_id where version.master_record_id=event_row.master_record_id and version.revision=event_row.revision and release_row.release_key='cm.release.airtable.operational-master.v3')) row_data),'[]'::jsonb)),
    jsonb_build_object('table','clinical_master_lab_publish_stage','rows',coalesce((select jsonb_agg(to_jsonb(row_data) order by row_data.release_id,row_data.master_record_id) from (select stage.* from private.clinical_master_lab_publish_stage stage where not exists (select 1 from master.master_releases release_row where release_row.id=stage.release_id and release_row.release_key='cm.release.airtable.operational-master.v3')) row_data),'[]'::jsonb)),
    jsonb_build_object('table','clinical_master_lab_test_publish_stage','rows',coalesce((select jsonb_agg(to_jsonb(row_data) order by row_data.release_id,row_data.owner_record_id) from (select stage.* from private.clinical_master_lab_test_publish_stage stage where not exists (select 1 from master.master_releases release_row where release_row.id=stage.release_id and release_row.release_key='cm.release.airtable.operational-master.v3')) row_data),'[]'::jsonb)),
    jsonb_build_object('table','clinical_master_lab_panel_publish_stage','rows',coalesce((select jsonb_agg(to_jsonb(row_data) order by row_data.release_id,row_data.owner_record_id) from (select stage.* from private.clinical_master_lab_panel_publish_stage stage where not exists (select 1 from master.master_releases release_row where release_row.id=stage.release_id and release_row.release_key='cm.release.airtable.operational-master.v3')) row_data),'[]'::jsonb)),
    jsonb_build_object('table','clinical_master_lab_order_publish_stage','rows',coalesce((select jsonb_agg(to_jsonb(row_data) order by row_data.release_id,row_data.owner_record_id) from (select stage.* from private.clinical_master_lab_order_publish_stage stage where not exists (select 1 from master.master_releases release_row where release_row.id=stage.release_id and release_row.release_key='cm.release.airtable.operational-master.v3')) row_data),'[]'::jsonb)),
    jsonb_build_object('table','workspace_master_updates','rows',coalesce((select jsonb_agg(to_jsonb(row_data) order by row_data.workspace_id,row_data.id) from (select update_row.* from public.workspace_master_updates update_row where not exists (select 1 from master.master_releases release_row where release_row.id=update_row.release_id and release_row.release_key='cm.release.airtable.operational-master.v3')) row_data),'[]'::jsonb)),
    jsonb_build_object('table','workspace_lab_item_updates','rows',coalesce((select jsonb_agg(to_jsonb(row_data) order by row_data.workspace_id,row_data.id) from (select update_row.* from public.workspace_lab_item_updates update_row where not exists (select 1 from master.master_releases release_row where release_row.id=update_row.source_release_id and release_row.release_key='cm.release.airtable.operational-master.v3')) row_data),'[]'::jsonb)),
    jsonb_build_object('table','workspace_lab_catalog_updates','rows',coalesce((select jsonb_agg(to_jsonb(row_data) order by row_data.workspace_id,row_data.id) from (select update_row.* from public.workspace_lab_catalog_updates update_row where not exists (select 1 from master.master_releases release_row where release_row.id=update_row.source_release_id and release_row.release_key='cm.release.airtable.operational-master.v3')) row_data),'[]'::jsonb))
  )::text,'UTF8'),'sha256'),'hex') into v_after_history_fingerprint;
  if v_after_history_fingerprint<>v_before_history_fingerprint then raise exception 'clinical_master_phase_c_pre_v3_history_changed'; end if;
  select encode(extensions.digest(convert_to(coalesce((select jsonb_agg(jsonb_build_object(
    'master',jsonb_build_object('id',master_row.id::text,'masterKey',master_row.master_key,'recordType',master_row.record_type,'lifecycleStatus',master_row.lifecycle_status,'safetyStatus',master_row.safety_status,'safetyReason',master_row.safety_reason,'replacementRecordId',master_row.replacement_record_id::text),
    'versions',coalesce((select jsonb_agg(to_jsonb(version_row) order by version_row.revision,version_row.id) from master.master_record_versions version_row join master.master_releases release_row on release_row.id=version_row.release_id where version_row.master_record_id=master_row.id and release_row.release_key<>'cm.release.airtable.operational-master.v3'),'[]'::jsonb),
    'reviews',coalesce((select jsonb_agg(to_jsonb(review_row) order by review_row.revision,review_row.id) from master.master_review_events review_row where review_row.master_record_id=master_row.id and not exists (select 1 from master.master_record_versions version_row join master.master_releases release_row on release_row.id=version_row.release_id where version_row.master_record_id=review_row.master_record_id and version_row.revision=review_row.revision and release_row.release_key='cm.release.airtable.operational-master.v3')),'[]'::jsonb)
  ) order by master_row.master_key,master_row.id) from master.master_records master_row where master_row.record_type in ('order_category','clinical_action','chart_group','task_route','order','species','unit','specimen_type','result_input_type','lab_test','lab_panel') and exists (select 1 from cm_phase_c_supported_ids identity_row where identity_row.master_record_id=master_row.id)),'[]'::jsonb)::text,'UTF8'),'sha256'),'hex') into v_after_supported_identity_history;
  if v_after_supported_identity_history<>v_before_supported_identity_history then raise exception 'clinical_master_phase_c_supported_identity_history_changed'; end if;
  if (select count(*) from private.clinical_master_lab_publish_stage where release_id=v_release_id) <> jsonb_array_length(v_payload->'records') then raise exception 'clinical_master_phase_c_lab_stage_count_invalid'; end if;
  if (select count(*) from private.clinical_master_lab_test_publish_stage where release_id=v_release_id)<>36 or (select count(*) from private.clinical_master_lab_panel_publish_stage where release_id=v_release_id)<>10 or (select count(*) from private.clinical_master_lab_order_publish_stage where release_id=v_release_id)<>120 then raise exception 'clinical_master_phase_c_specialized_lab_stage_count_invalid'; end if;
  v_expected_profile_count := (select count(*) from jsonb_array_elements(v_payload->'labOrderProfiles'));
  v_expected_direct_profile_count := (
    select count(*)
    from jsonb_array_elements(v_payload->'labOrderProfiles') profile_row(value)
    where nullif(pg_catalog.btrim(profile_row.value->>'labTestMasterKey'),'') is not null
      and nullif(pg_catalog.btrim(profile_row.value->>'labPanelMasterKey'),'') is null
  );
  v_expected_panel_profile_count := (
    select count(*)
    from jsonb_array_elements(v_payload->'labOrderProfiles') profile_row(value)
    where nullif(pg_catalog.btrim(profile_row.value->>'labTestMasterKey'),'') is null
      and nullif(pg_catalog.btrim(profile_row.value->>'labPanelMasterKey'),'') is not null
  );
  v_expected_panel_item_count := (select count(*) from jsonb_array_elements(v_payload->'labPanelItems'));
  if v_expected_profile_count<>30
     or v_expected_direct_profile_count<>20
     or v_expected_panel_profile_count<>10
     or v_expected_direct_profile_count+v_expected_panel_profile_count<>v_expected_profile_count
     or v_expected_panel_item_count<>60 then
    raise exception 'clinical_master_phase_c_lab_profile_shape_invalid:profiles=% directProfiles=% panelProfiles=% panelItems=%',v_expected_profile_count,v_expected_direct_profile_count,v_expected_panel_profile_count,v_expected_panel_item_count;
  end if;

  -- Validate the immutable v3 lab relation graph before any workspace adopter
  -- or resolver RPC.  The panel rows compare payload/stage/pinned-version
  -- counts and sorted semantic hashes; the order rows require exactly one
  -- stage and pinned profile and compare every target identity/revision.
  with payload_panel_items as (
    select value->>'panelMasterKey' panel_master_key,
      (value->>'sortOrder')::integer sort_order,
      value->>'testMasterKey' test_master_key,
      jsonb_build_object('panelMasterKey',btrim(value->>'panelMasterKey'),'testMasterKey',btrim(value->>'testMasterKey'),'sortOrder',(value->>'sortOrder')::integer,'required',coalesce((value->>'required')::boolean,true),'displayGroup',nullif(btrim(value->>'displayGroup'),'')) semantic
    from jsonb_array_elements(coalesce(v_payload->'labPanelItems','[]'::jsonb)) items(value)
  ), payload_panel_summary as (
    select panel_master_key,count(*)::integer item_count,
      private.clinical_master_sha256(coalesce(jsonb_agg(semantic order by sort_order,test_master_key),'[]'::jsonb)) item_sha256
    from payload_panel_items group by panel_master_key
  ), stage_panel_items as (
    select stage.master_key panel_master_key,
      (value->>'sortOrder')::integer sort_order,
      value->>'testMasterKey' test_master_key,
      jsonb_build_object('panelMasterKey',btrim(value->>'panelMasterKey'),'testMasterKey',btrim(value->>'testMasterKey'),'sortOrder',(value->>'sortOrder')::integer,'required',coalesce((value->>'required')::boolean,true),'displayGroup',nullif(btrim(value->>'displayGroup'),'')) semantic
    from private.clinical_master_lab_panel_publish_stage stage
    cross join lateral jsonb_array_elements(coalesce(stage.relation_content->'labPanelItems','[]'::jsonb)) items(value)
    where stage.release_id=v_release_id
  ), stage_panel_summary as (
    select stage_panel_items.panel_master_key,
      count(*)::integer item_count,
      private.clinical_master_sha256(coalesce(jsonb_agg(stage_panel_items.semantic order by stage_panel_items.sort_order,stage_panel_items.test_master_key),'[]'::jsonb)) item_sha256,
      (select count(*)::integer from private.clinical_master_lab_panel_publish_stage stage_row where stage_row.release_id=v_release_id and stage_row.master_key=stage_panel_items.panel_master_key) stage_row_count,
      (select min(stage_row.effective_revision) from private.clinical_master_lab_panel_publish_stage stage_row where stage_row.release_id=v_release_id and stage_row.master_key=stage_panel_items.panel_master_key) stage_effective_revision
    from stage_panel_items group by stage_panel_items.panel_master_key
  ), pinned_panel_items as (
    select panel_record.master_key panel_master_key,
      (value->>'sortOrder')::integer sort_order,
      value->>'testMasterKey' test_master_key,
      jsonb_build_object('panelMasterKey',btrim(value->>'panelMasterKey'),'testMasterKey',btrim(value->>'testMasterKey'),'sortOrder',(value->>'sortOrder')::integer,'required',coalesce((value->>'required')::boolean,true),'displayGroup',nullif(btrim(value->>'displayGroup'),'')) semantic
    from master.master_record_versions version_row
    join master.master_records panel_record on panel_record.id=version_row.master_record_id and panel_record.record_type='lab_panel'
    cross join lateral jsonb_array_elements(coalesce(version_row.snapshot->'labPanelItems','[]'::jsonb)) items(value)
    where exists (select 1 from private.clinical_master_lab_panel_publish_stage stage where stage.release_id=v_release_id and stage.owner_record_id=version_row.master_record_id and stage.effective_revision=version_row.revision)
  ), pinned_panel_summary as (
    select pinned_panel_items.panel_master_key,
      count(*)::integer item_count,
      private.clinical_master_sha256(coalesce(jsonb_agg(pinned_panel_items.semantic order by pinned_panel_items.sort_order,pinned_panel_items.test_master_key),'[]'::jsonb)) item_sha256,
      (select count(*)::integer
       from private.clinical_master_lab_panel_publish_stage stage_row
       join master.master_record_versions version_row
         on version_row.master_record_id=stage_row.owner_record_id
        and version_row.revision=stage_row.effective_revision
       join master.master_records panel_row on panel_row.id=stage_row.owner_record_id and panel_row.master_key=pinned_panel_items.panel_master_key and panel_row.record_type='lab_panel'
       where stage_row.release_id=v_release_id) pinned_version_count,
      (select min(version_row.revision)
       from private.clinical_master_lab_panel_publish_stage stage_row
       join master.master_record_versions version_row
         on version_row.master_record_id=stage_row.owner_record_id
        and version_row.revision=stage_row.effective_revision
       join master.master_records panel_row on panel_row.id=stage_row.owner_record_id and panel_row.master_key=pinned_panel_items.panel_master_key and panel_row.record_type='lab_panel'
       where stage_row.release_id=v_release_id) pinned_version_revision,
      (select min(version_row.snapshot->>'masterKey')
       from private.clinical_master_lab_panel_publish_stage stage_row
       join master.master_record_versions version_row
         on version_row.master_record_id=stage_row.owner_record_id
        and version_row.revision=stage_row.effective_revision
       join master.master_records panel_row on panel_row.id=stage_row.owner_record_id and panel_row.master_key=pinned_panel_items.panel_master_key and panel_row.record_type='lab_panel'
       where stage_row.release_id=v_release_id) pinned_snapshot_key
    from pinned_panel_items group by pinned_panel_items.panel_master_key
  ), panel_rows as (
    select record_row.value->>'masterKey' panel_master_key,
      panel_record.id::text panel_record_id,
      stage_summary.stage_row_count,
      stage_summary.stage_effective_revision,
      pinned_summary.pinned_version_count,
      pinned_summary.pinned_version_revision,
      pinned_summary.pinned_snapshot_key,
      coalesce(payload_summary.item_count,0) payload_item_count,
      payload_summary.item_sha256 payload_item_sha256,
      coalesce(stage_summary.item_count,0) stage_item_count,
      stage_summary.item_sha256 stage_item_sha256,
      coalesce(pinned_summary.item_count,0) pinned_item_count,
      pinned_summary.item_sha256 pinned_item_sha256
    from jsonb_array_elements(v_payload->'records') record_row(value)
    left join master.master_records panel_record on panel_record.master_key=record_row.value->>'masterKey' and panel_record.record_type='lab_panel'
    left join payload_panel_summary payload_summary on payload_summary.panel_master_key=record_row.value->>'masterKey'
    left join stage_panel_summary stage_summary on stage_summary.panel_master_key=record_row.value->>'masterKey'
    left join pinned_panel_summary pinned_summary on pinned_summary.panel_master_key=record_row.value->>'masterKey'
    where record_row.value->>'recordType'='lab_panel'
  ), panel_details as (
    select panel_rows.*,
      panel_rows.payload_item_count is distinct from panel_rows.stage_item_count
        or panel_rows.payload_item_count is distinct from panel_rows.pinned_item_count
        or panel_rows.payload_item_sha256 is distinct from panel_rows.stage_item_sha256
        or panel_rows.payload_item_sha256 is distinct from panel_rows.pinned_item_sha256
        or panel_rows.stage_row_count is distinct from 1
        or panel_rows.pinned_version_count is distinct from 1
        or panel_rows.stage_effective_revision is distinct from panel_rows.pinned_version_revision
        or panel_rows.pinned_snapshot_key is distinct from panel_rows.panel_master_key as mismatch,
      jsonb_build_object('panelMasterKey',panel_rows.panel_master_key,'panelRecordId',panel_rows.panel_record_id,'stageRowCount',panel_rows.stage_row_count,'stageEffectiveRevision',panel_rows.stage_effective_revision,'pinnedVersionCount',panel_rows.pinned_version_count,'pinnedVersionRevision',panel_rows.pinned_version_revision,'pinnedSnapshotKey',panel_rows.pinned_snapshot_key,'payloadItemCount',panel_rows.payload_item_count,'payloadItemSha256',panel_rows.payload_item_sha256,'stageItemCount',panel_rows.stage_item_count,'stageItemSha256',panel_rows.stage_item_sha256,'pinnedItemCount',panel_rows.pinned_item_count,'pinnedItemSha256',panel_rows.pinned_item_sha256) detail
    from panel_rows
  ), panel_diagnostic as (
    select jsonb_build_object('count',count(*),'payloadItemTotal',coalesce(sum(payload_item_count),0),'stageItemTotal',coalesce(sum(stage_item_count),0),'pinnedItemTotal',coalesce(sum(pinned_item_count),0),'rows',coalesce(jsonb_agg(detail order by panel_master_key),'[]'::jsonb),'mismatches',coalesce(jsonb_agg(detail order by panel_master_key) filter (where mismatch),'[]'::jsonb)) value
    from panel_details
  ), payload_profiles as (
    select value->>'orderMasterKey' order_master_key,value payload_profile
    from jsonb_array_elements(v_payload->'labOrderProfiles') profiles(value)
  ), stage_profiles as (
    select stage.master_key order_master_key,stage.effective_revision order_stage_effective_revision,
      count(profile.value)::integer stage_profile_count,coalesce(jsonb_agg(profile.value order by profile.value::text),'[]'::jsonb) stage_profile_values
    from private.clinical_master_lab_order_publish_stage stage
    left join lateral jsonb_array_elements(coalesce(stage.relation_content->'labOrderProfiles','[]'::jsonb)) profile(value) on true
    where stage.release_id=v_release_id group by stage.master_key,stage.effective_revision
  ), profile_rows as (
    select payload_profiles.order_master_key,payload_profiles.payload_profile,
      stage_profiles.order_stage_effective_revision,stage_profiles.stage_profile_count,stage_profiles.stage_profile_values,
      order_version.revision pinned_order_revision,order_version.snapshot->>'masterKey' pinned_order_snapshot_key,
      count(pinned_profile.value)::integer pinned_profile_count,coalesce(jsonb_agg(pinned_profile.value order by pinned_profile.value::text),'[]'::jsonb) pinned_profile_values
    from payload_profiles
    left join stage_profiles on stage_profiles.order_master_key=payload_profiles.order_master_key
    left join master.master_records order_record on order_record.master_key=payload_profiles.order_master_key and order_record.record_type='order'
    left join master.master_record_versions order_version on order_version.master_record_id=order_record.id and order_version.revision=stage_profiles.order_stage_effective_revision
    left join lateral jsonb_array_elements(coalesce(order_version.snapshot->'labOrderProfiles','[]'::jsonb)) pinned_profile(value) on pinned_profile.value->>'orderMasterKey'=payload_profiles.order_master_key
    group by payload_profiles.order_master_key,payload_profiles.payload_profile,stage_profiles.order_stage_effective_revision,stage_profiles.stage_profile_count,stage_profiles.stage_profile_values,order_version.revision,order_version.snapshot->>'masterKey'
  ), profile_refs as (
    select profile_rows.*,
      profile_rows.stage_profile_values->0 stage_profile,
      profile_rows.pinned_profile_values->0 pinned_profile
    from profile_rows
  ), profile_resolved as (
    select profile_refs.*,
      case when nullif(stage_profile->>'labPanelMasterRecordId','') is not null then 'panel' when nullif(stage_profile->>'labTestMasterRecordId','') is not null then 'test' end stage_target_kind,
      case when nullif(stage_profile->>'labPanelMasterRecordId','') is not null then stage_profile->>'labPanelMasterKey' when nullif(stage_profile->>'labTestMasterRecordId','') is not null then stage_profile->>'labTestMasterKey' end stage_target_key,
      case when nullif(stage_profile->>'labPanelMasterRecordId','') is not null then nullif(stage_profile->>'labPanelMasterRecordId','')::uuid when nullif(stage_profile->>'labTestMasterRecordId','') is not null then nullif(stage_profile->>'labTestMasterRecordId','')::uuid end stage_target_id,
      case when nullif(stage_profile->>'labPanelMasterRecordId','') is not null then nullif(stage_profile->>'labPanelMasterRevision','')::integer when nullif(stage_profile->>'labTestMasterRecordId','') is not null then nullif(stage_profile->>'labTestMasterRevision','')::integer end stage_target_revision,
      case when nullif(pinned_profile->>'labPanelMasterRecordId','') is not null then 'panel' when nullif(pinned_profile->>'labTestMasterRecordId','') is not null then 'test' end pinned_target_kind,
      case when nullif(pinned_profile->>'labPanelMasterRecordId','') is not null then pinned_profile->>'labPanelMasterKey' when nullif(pinned_profile->>'labTestMasterRecordId','') is not null then pinned_profile->>'labTestMasterKey' end pinned_target_key,
      case when nullif(pinned_profile->>'labPanelMasterRecordId','') is not null then nullif(pinned_profile->>'labPanelMasterRecordId','')::uuid when nullif(pinned_profile->>'labTestMasterRecordId','') is not null then nullif(pinned_profile->>'labTestMasterRecordId','')::uuid end pinned_target_id,
      case when nullif(pinned_profile->>'labPanelMasterRecordId','') is not null then nullif(pinned_profile->>'labPanelMasterRevision','')::integer when nullif(pinned_profile->>'labTestMasterRecordId','') is not null then nullif(pinned_profile->>'labTestMasterRevision','')::integer end pinned_target_revision,
      case when nullif(payload_profile->>'labPanelMasterKey','') is not null then 'panel' when nullif(payload_profile->>'labTestMasterKey','') is not null then 'test' end payload_target_kind,
      case when nullif(payload_profile->>'labPanelMasterKey','') is not null then payload_profile->>'labPanelMasterKey' when nullif(payload_profile->>'labTestMasterKey','') is not null then payload_profile->>'labTestMasterKey' end payload_target_key,
      case when nullif(payload_profile->>'labPanelMasterKey','') is not null then (select target_record.id from master.master_records target_record where target_record.master_key=payload_profile->>'labPanelMasterKey' and target_record.record_type='lab_panel') when nullif(payload_profile->>'labTestMasterKey','') is not null then (select target_record.id from master.master_records target_record where target_record.master_key=payload_profile->>'labTestMasterKey' and target_record.record_type='lab_test') end payload_target_id,
      case when nullif(payload_profile->>'labPanelMasterKey','') is not null then coalesce((select item_count from payload_panel_summary where panel_master_key=payload_profile->>'labPanelMasterKey'),0) else 1 end payload_expanded_count
    from profile_refs
  ), profile_with_targets as (
    select profile_resolved.*,
      stage_target.effective_revision target_stage_effective_revision,
      stage_target.effective_revision payload_target_revision,
      pinned_target_version.revision pinned_target_version_revision,
      pinned_target_version.snapshot->>'masterKey' pinned_target_snapshot_key,
      case when profile_resolved.stage_target_kind='panel' then coalesce(jsonb_array_length(stage_target.relation_content->'labPanelItems'),0) else 1 end stage_expanded_count,
      case when profile_resolved.pinned_target_kind='panel' then coalesce(jsonb_array_length(pinned_target_version.snapshot->'labPanelItems'),0) else 1 end pinned_expanded_count
    from profile_resolved
    left join private.clinical_master_lab_publish_stage stage_target on stage_target.release_id=v_release_id and stage_target.master_record_id=profile_resolved.stage_target_id
    left join master.master_record_versions pinned_target_version on pinned_target_version.master_record_id=profile_resolved.pinned_target_id and pinned_target_version.revision=profile_resolved.pinned_target_revision
  ), profile_details as (
    select profile_with_targets.*,
      profile_with_targets.stage_profile_count<>1
        or profile_with_targets.pinned_profile_count<>1
        or profile_with_targets.payload_target_kind is distinct from profile_with_targets.stage_target_kind
        or profile_with_targets.payload_target_kind is distinct from profile_with_targets.pinned_target_kind
        or profile_with_targets.payload_target_key is distinct from profile_with_targets.stage_target_key
        or profile_with_targets.payload_target_key is distinct from profile_with_targets.pinned_target_key
        or profile_with_targets.payload_target_id is distinct from profile_with_targets.stage_target_id
        or profile_with_targets.payload_target_id is distinct from profile_with_targets.pinned_target_id
        or profile_with_targets.payload_target_revision is distinct from profile_with_targets.stage_target_revision
        or profile_with_targets.payload_target_revision is distinct from profile_with_targets.pinned_target_revision
        or profile_with_targets.stage_target_id is distinct from profile_with_targets.pinned_target_id
        or profile_with_targets.stage_target_revision is distinct from profile_with_targets.pinned_target_revision
        or profile_with_targets.target_stage_effective_revision is distinct from profile_with_targets.pinned_target_revision
        or profile_with_targets.pinned_target_version_revision is distinct from profile_with_targets.pinned_target_revision
        or profile_with_targets.pinned_target_snapshot_key is distinct from profile_with_targets.pinned_target_key
        or profile_with_targets.pinned_order_revision is distinct from profile_with_targets.order_stage_effective_revision
        or profile_with_targets.pinned_order_snapshot_key is distinct from profile_with_targets.order_master_key
        or profile_with_targets.payload_expanded_count is distinct from profile_with_targets.stage_expanded_count
        or profile_with_targets.payload_expanded_count is distinct from profile_with_targets.pinned_expanded_count as mismatch,
      jsonb_build_object('orderMasterKey',order_master_key,'payloadTargetKind',payload_target_kind,'payloadTargetKey',payload_target_key,'payloadTargetMasterId',payload_target_id,'payloadTargetRevision',payload_target_revision,'stageProfileCount',stage_profile_count,'stageTargetKind',stage_target_kind,'stageTargetKey',stage_target_key,'stageTargetMasterId',stage_target_id,'stageTargetRevision',stage_target_revision,'orderStageEffectiveRevision',order_stage_effective_revision,'targetStageEffectiveRevision',target_stage_effective_revision,'pinnedProfileCount',pinned_profile_count,'pinnedTargetKind',pinned_target_kind,'pinnedTargetKey',pinned_target_key,'pinnedTargetMasterId',pinned_target_id,'pinnedTargetRevision',pinned_target_revision,'pinnedOrderRevision',pinned_order_revision,'pinnedOrderSnapshotKey',pinned_order_snapshot_key,'pinnedTargetVersionRevision',pinned_target_version_revision,'pinnedTargetSnapshotKey',pinned_target_snapshot_key,'payloadExpandedCount',payload_expanded_count,'stageExpandedCount',stage_expanded_count,'pinnedExpandedCount',pinned_expanded_count) detail
    from profile_with_targets
  ), profile_diagnostic as (
    select jsonb_build_object('count',count(*),'payloadExpandedTotal',coalesce(sum(payload_expanded_count),0),'stageExpandedTotal',coalesce(sum(stage_expanded_count),0),'pinnedExpandedTotal',coalesce(sum(pinned_expanded_count),0),'rows',coalesce(jsonb_agg(detail order by order_master_key),'[]'::jsonb),'mismatches',coalesce(jsonb_agg(detail order by order_master_key) filter (where mismatch),'[]'::jsonb)) value
    from profile_details
  )
  select jsonb_build_object('panels',(select value from panel_diagnostic),'profiles',(select value from profile_diagnostic)) into v_lab_link_attempt_diagnostic;
  v_expected_workspace_lab_link_attempt_count := v_expected_direct_profile_count+v_expected_panel_item_count;
  if (v_lab_link_attempt_diagnostic->'panels'->>'count')::integer<>10
     or (v_lab_link_attempt_diagnostic->'panels'->>'payloadItemTotal')::integer<>60
     or (v_lab_link_attempt_diagnostic->'panels'->>'stageItemTotal')::integer<>60
     or (v_lab_link_attempt_diagnostic->'panels'->>'pinnedItemTotal')::integer<>60
     or jsonb_array_length(v_lab_link_attempt_diagnostic->'panels'->'mismatches')<>0
     or (v_lab_link_attempt_diagnostic->'profiles'->>'count')::integer<>30
     or (v_lab_link_attempt_diagnostic->'profiles'->>'payloadExpandedTotal')::integer<>80
     or (v_lab_link_attempt_diagnostic->'profiles'->>'stageExpandedTotal')::integer<>80
     or (v_lab_link_attempt_diagnostic->'profiles'->>'pinnedExpandedTotal')::integer<>80
     or jsonb_array_length(v_lab_link_attempt_diagnostic->'profiles'->'mismatches')<>0 then
    raise exception 'clinical_master_phase_c_lab_link_attempt_contract_invalid:release=% directProfiles=% panelProfiles=% panelItems=% expandedLinkAttempts=% formulaDirectPlusPanelItems=% profileDiagnostic=%',v_release_id,v_expected_direct_profile_count,v_expected_panel_profile_count,v_expected_panel_item_count,v_expected_workspace_lab_link_attempt_count,v_expected_direct_profile_count+v_expected_panel_item_count,v_lab_link_attempt_diagnostic;
  end if;

  if v_scope='full' then
    -- Foreign is read-only and is never passed to the private adopter.
    select count(*),encode(extensions.digest(convert_to(coalesce(jsonb_agg(to_jsonb(item) order by item.id),'[]'::jsonb)::text,'UTF8'),'sha256'),'hex') into v_catalog_count,v_catalog_fingerprint from public.order_catalog_items item where item.workspace_id='clair-foreign-demo';
    if v_catalog_count<>0 or v_catalog_fingerprint<>v_expected_foreign_fingerprint then raise exception 'clinical_master_phase_c_foreign_pre_adoption_drift'; end if;

    foreach v_workspace in array array['workspace-clinical-master-pilot-v1','workspace-clair-cheongdam','clair-demo'] loop
      select membership.user_id into v_actor from public.user_memberships membership where membership.workspace_id=v_workspace and membership.status='active' and membership.archived_at is null and membership.roles @> array['hospital_admin']::text[] order by (membership.roles @> array['owner']::text[]) desc,(membership.roles @> array['admin']::text[]) desc,membership.created_at,membership.user_id limit 1;
      if v_actor is null then raise exception 'clinical_master_phase_c_admin_selection_failed'; end if;
      if not exists (
        select 1 from public.user_memberships membership
        where membership.workspace_id=v_workspace and membership.user_id=v_actor and membership.status='active' and membership.archived_at is null
          and (
            membership.roles @> array['hospital_admin']::text[]
            or exists (
              select 1 from public.permission_policies policy
              where policy.workspace_id=v_workspace
                and ((policy.scope='user' and policy.target_user_id=v_actor) or (policy.scope='role' and policy.target_role=any(membership.roles)))
                and (coalesce(policy.permissions->'allowed','[]'::jsonb) ? '*' or coalesce(policy.permissions->'allowed','[]'::jsonb) ? 'service_catalog:manage')
            )
          )
      ) then raise exception 'clinical_master_phase_c_actor_service_catalog_manage_missing:%',v_workspace; end if;
      delete from cm_phase_c_lab_adoption_test_targets where workspace_id=v_workspace;
      delete from cm_phase_c_lab_adoption_profile_targets where workspace_id=v_workspace;
      delete from cm_phase_c_lab_adoption_target_candidates where workspace_id=v_workspace;

      -- Payload-scoped adoption creates only exact release order owners.  The
      -- frozen set therefore excludes every nonpayload initial/metabolic
      -- catalog, including an already pinned row, and preserves only exact
      -- payload owners at the manifest effective revision.
      -- Mirror the final immutable helper's traversal exactly: it reads the
      -- catalog's pinned order version, chooses the first matching profile,
      -- then expands the pinned panel version (or one pinned direct test).
      -- Add the v3 release profiles to the same frozen input because the base
      -- adopter may create or auto-advance a catalog to that release before
      -- the lab helper runs.
      insert into cm_phase_c_lab_adoption_profile_targets(
        workspace_id,source_kind,source_catalog_id,source_order_record_id,
        profile_ordinal,profile,panel_master_record_id_text,
        panel_master_revision_text,test_master_record_id_text,
        test_master_revision_text
      )
      with existing_pinned_profiles as (
        select v_workspace as workspace_id,
          'legacy_pinned'::text as source_kind,
          catalog_item.id as source_catalog_id,
          catalog_item.source_master_record_id as source_order_record_id,
          profile_row.ordinality as profile_ordinal,
          profile_row.value as profile,
          profile_row.value->>'labPanelMasterRecordId' as panel_master_record_id_text,
          profile_row.value->>'labPanelMasterRevision' as panel_master_revision_text,
          profile_row.value->>'labTestMasterRecordId' as test_master_record_id_text,
          profile_row.value->>'labTestMasterRevision' as test_master_revision_text
        from public.order_catalog_items catalog_item
        join master.master_records order_record
          on order_record.id=catalog_item.source_master_record_id
         and order_record.record_type='order'
        join master.master_record_versions order_version
          on order_version.master_record_id=catalog_item.source_master_record_id
         and order_version.revision=catalog_item.source_master_revision
        join private.clinical_master_release_payload_owner_manifest owner_manifest
          on owner_manifest.release_id=v_release_id
         and owner_manifest.master_record_id=catalog_item.source_master_record_id
         and owner_manifest.effective_revision=catalog_item.source_master_revision
         and owner_manifest.record_type='order'
         and owner_manifest.included
        cross join lateral (
          select profile_row.value,profile_row.ordinality
          from jsonb_array_elements(coalesce(order_version.snapshot->'labOrderProfiles','[]'::jsonb)) with ordinality profile_row(value,ordinality)
          where profile_row.value->>'orderMasterKey'=order_record.master_key
          order by profile_row.ordinality
          limit 1
        ) profile_row
        where catalog_item.workspace_id=v_workspace
          and catalog_item.category_group='lab'
          and catalog_item.source_master_record_id is not null
      ), v3_release_profiles as (
        select v_workspace as workspace_id,
          'v3_release'::text as source_kind,
          null::text as source_catalog_id,
          order_version.master_record_id as source_order_record_id,
          profile_row.ordinality as profile_ordinal,
          profile_row.value as profile,
          profile_row.value->>'labPanelMasterRecordId' as panel_master_record_id_text,
          profile_row.value->>'labPanelMasterRevision' as panel_master_revision_text,
          profile_row.value->>'labTestMasterRecordId' as test_master_record_id_text,
          profile_row.value->>'labTestMasterRevision' as test_master_revision_text
        from master.master_record_versions order_version
        join master.master_records order_record
          on order_record.id=order_version.master_record_id
         and order_record.record_type='order'
        cross join lateral (
          select profile_row.value,profile_row.ordinality
          from jsonb_array_elements(coalesce(order_version.snapshot->'labOrderProfiles','[]'::jsonb)) with ordinality profile_row(value,ordinality)
          where profile_row.value->>'orderMasterKey'=order_record.master_key
          order by profile_row.ordinality
          limit 1
        ) profile_row
        where order_version.release_id=v_release_id
      ), v3_payload_profiles as (
        -- Unchanged owners may have no version row tagged with v3.  Resolve
        -- those inline v3 profiles against their current immutable owners so
        -- a newly created catalog is covered by the same frozen set.
        select v_workspace as workspace_id,
          'v3_payload'::text as source_kind,
          null::text as source_catalog_id,
          order_record.id as source_order_record_id,
          profile_row.ordinality as profile_ordinal,
          case
            when nullif(pg_catalog.btrim(profile_row.value->>'labPanelMasterKey'),'') is not null
              then profile_row.value || jsonb_build_object('labPanelMasterRecordId',panel_record.id::text,'labPanelMasterRevision',panel_record.current_revision)
            else profile_row.value || jsonb_build_object('labTestMasterRecordId',test_record.id::text,'labTestMasterRevision',test_record.current_revision)
          end as profile,
          case when nullif(pg_catalog.btrim(profile_row.value->>'labPanelMasterKey'),'') is not null then panel_record.id::text end as panel_master_record_id_text,
          case when nullif(pg_catalog.btrim(profile_row.value->>'labPanelMasterKey'),'') is not null then panel_record.current_revision::text end as panel_master_revision_text,
          case when nullif(pg_catalog.btrim(profile_row.value->>'labPanelMasterKey'),'') is null then test_record.id::text end as test_master_record_id_text,
          case when nullif(pg_catalog.btrim(profile_row.value->>'labPanelMasterKey'),'') is null then test_record.current_revision::text end as test_master_revision_text
        from jsonb_array_elements(coalesce(v_payload->'labOrderProfiles','[]'::jsonb)) with ordinality profile_row(value,ordinality)
        left join master.master_records order_record
          on order_record.master_key=profile_row.value->>'orderMasterKey'
         and order_record.record_type='order'
        left join master.master_records panel_record
          on panel_record.master_key=profile_row.value->>'labPanelMasterKey'
         and panel_record.record_type='lab_panel'
        left join master.master_records test_record
          on test_record.master_key=profile_row.value->>'labTestMasterKey'
         and test_record.record_type='lab_test'
        where not exists (
          select 1
          from master.master_record_versions release_version
          cross join lateral jsonb_array_elements(coalesce(release_version.snapshot->'labOrderProfiles','[]'::jsonb)) release_profile(value)
          where release_version.release_id=v_release_id
            and release_version.master_record_id=order_record.id
            and release_profile.value->>'orderMasterKey'=profile_row.value->>'orderMasterKey'
        )
      )
      select workspace_id,source_kind,source_catalog_id,source_order_record_id,
        profile_ordinal,profile,panel_master_record_id_text,
        panel_master_revision_text,test_master_record_id_text,
        test_master_revision_text
      from existing_pinned_profiles
      union all
      select workspace_id,source_kind,source_catalog_id,source_order_record_id,
        profile_ordinal,profile,panel_master_record_id_text,
        panel_master_revision_text,test_master_record_id_text,
        test_master_revision_text
      from v3_release_profiles
      union all
      select workspace_id,source_kind,source_catalog_id,source_order_record_id,
        profile_ordinal,profile,panel_master_record_id_text,
        panel_master_revision_text,test_master_record_id_text,
        test_master_revision_text
      from v3_payload_profiles
      ;

      if exists (
        select 1
        from cm_phase_c_lab_adoption_profile_targets profile_target
        where profile_target.workspace_id=v_workspace
          and (
            (nullif(pg_catalog.btrim(profile_target.panel_master_record_id_text),'') is null
             and nullif(pg_catalog.btrim(profile_target.test_master_record_id_text),'') is null)
            or (nullif(pg_catalog.btrim(profile_target.panel_master_record_id_text),'') is not null
             and nullif(pg_catalog.btrim(profile_target.test_master_record_id_text),'') is not null)
          )
      ) then
        raise exception 'clinical_master_phase_c_lab_adoption_profile_target_ambiguous:workspace=%',v_workspace;
      end if;
      if exists (
        select 1
        from cm_phase_c_lab_adoption_profile_targets profile_target
        where profile_target.workspace_id=v_workspace
          and (
            (nullif(pg_catalog.btrim(profile_target.panel_master_record_id_text),'') is not null
             and (profile_target.panel_master_record_id_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
               or nullif(pg_catalog.btrim(profile_target.panel_master_revision_text),'') is null
               or profile_target.panel_master_revision_text !~ '^[1-9][0-9]*$'))
            or (nullif(pg_catalog.btrim(profile_target.test_master_record_id_text),'') is not null
             and (profile_target.test_master_record_id_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
               or nullif(pg_catalog.btrim(profile_target.test_master_revision_text),'') is null
               or profile_target.test_master_revision_text !~ '^[1-9][0-9]*$'))
          )
      ) then
        raise exception 'clinical_master_phase_c_lab_adoption_profile_identity_invalid:workspace=%',v_workspace;
      end if;
      if exists (
        select source_kind,coalesce(source_catalog_id,''),source_order_record_id,profile_ordinal
        from cm_phase_c_lab_adoption_profile_targets
        where workspace_id=v_workspace
        group by source_kind,coalesce(source_catalog_id,''),source_order_record_id,profile_ordinal
        having count(*)<>1
      ) then
        raise exception 'clinical_master_phase_c_lab_adoption_profile_duplicate:workspace=%',v_workspace;
      end if;
      if exists (
        select profile_target.source_kind,coalesce(profile_target.source_catalog_id,''),profile_target.source_order_record_id,profile_target.profile_ordinal
        from cm_phase_c_lab_adoption_profile_targets profile_target
        left join master.master_record_versions panel_version
          on panel_version.master_record_id=nullif(pg_catalog.btrim(profile_target.panel_master_record_id_text),'')::uuid
         and panel_version.revision=nullif(pg_catalog.btrim(profile_target.panel_master_revision_text),'')::integer
        where profile_target.workspace_id=v_workspace
          and nullif(pg_catalog.btrim(profile_target.panel_master_record_id_text),'') is not null
          and (panel_version.id is null
            or jsonb_typeof(panel_version.snapshot->'labPanelItems')<>'array'
            or jsonb_array_length(coalesce(panel_version.snapshot->'labPanelItems','[]'::jsonb))=0)
      ) then
        raise exception 'clinical_master_phase_c_lab_adoption_panel_expansion_invalid:workspace=%',v_workspace;
      end if;

      insert into cm_phase_c_lab_adoption_target_candidates(
        workspace_id,source_kind,source_catalog_id,source_order_record_id,
        profile_ordinal,target_ordinal,profile_kind,target_master_key,
        target_master_record_id,target_revision
      )
      select profile_target.workspace_id,profile_target.source_kind,
        profile_target.source_catalog_id,profile_target.source_order_record_id,
        profile_target.profile_ordinal,1,'standalone_test',
        nullif(pg_catalog.btrim(profile_target.profile->>'labTestMasterKey'),''),
        nullif(pg_catalog.btrim(profile_target.test_master_record_id_text),'')::uuid,
        nullif(pg_catalog.btrim(profile_target.test_master_revision_text),'')::integer
      from cm_phase_c_lab_adoption_profile_targets profile_target
      where profile_target.workspace_id=v_workspace
        and nullif(pg_catalog.btrim(profile_target.test_master_record_id_text),'') is not null
      union all
      select profile_target.workspace_id,profile_target.source_kind,
        profile_target.source_catalog_id,profile_target.source_order_record_id,
        profile_target.profile_ordinal,panel_member.ordinality,'panel',
        nullif(pg_catalog.btrim(panel_member.value->>'testMasterKey'),''),
        nullif(pg_catalog.btrim(panel_member.value->>'testMasterRecordId'), '')::uuid,
        nullif(pg_catalog.btrim(panel_member.value->>'testMasterRevision'), '')::integer
      from cm_phase_c_lab_adoption_profile_targets profile_target
      join master.master_record_versions panel_version
        on panel_version.master_record_id=nullif(pg_catalog.btrim(profile_target.panel_master_record_id_text),'')::uuid
       and panel_version.revision=nullif(pg_catalog.btrim(profile_target.panel_master_revision_text),'')::integer
      cross join lateral jsonb_array_elements(coalesce(panel_version.snapshot->'labPanelItems','[]'::jsonb)) with ordinality panel_member(value,ordinality)
      where profile_target.workspace_id=v_workspace
        and nullif(pg_catalog.btrim(profile_target.panel_master_record_id_text),'') is not null;

      if exists (
        select 1
        from cm_phase_c_lab_adoption_target_candidates candidate
        where candidate.workspace_id=v_workspace
          and (candidate.target_master_record_id is null or candidate.target_revision is null)
      ) then
        raise exception 'clinical_master_phase_c_lab_adoption_target_identity_null:workspace=%',v_workspace;
      end if;
      if exists (
        select source_kind,coalesce(source_catalog_id,''),source_order_record_id,profile_ordinal,target_master_record_id
        from cm_phase_c_lab_adoption_target_candidates
        where workspace_id=v_workspace
        group by source_kind,coalesce(source_catalog_id,''),source_order_record_id,profile_ordinal,target_master_record_id
        having count(*)>1
      ) then
        raise exception 'clinical_master_phase_c_lab_adoption_target_duplicate:workspace=%',v_workspace;
      end if;
      if exists (
        select candidate.target_master_record_id
        from (
          select distinct target_master_record_id
          from cm_phase_c_lab_adoption_target_candidates
          where workspace_id=v_workspace
        ) candidate
        left join master.master_records target_record
          on target_record.id=candidate.target_master_record_id
         and target_record.record_type='lab_test'
        group by candidate.target_master_record_id
        having count(target_record.id)<>1
          or count(distinct target_record.master_key)<>1
          or bool_and(target_record.record_type='lab_test' and target_record.master_key is not null) is not true
      ) then
        raise exception 'clinical_master_phase_c_lab_adoption_target_identity_ambiguous:workspace=%',v_workspace;
      end if;
      if exists (
        select candidate.target_master_key
        from cm_phase_c_lab_adoption_target_candidates candidate
        join master.master_records target_record
          on target_record.id=candidate.target_master_record_id
         and target_record.record_type='lab_test'
        where candidate.workspace_id=v_workspace
          and candidate.target_master_key is not null
        group by candidate.target_master_key
        having count(distinct target_record.id)>1
      ) then
        raise exception 'clinical_master_phase_c_lab_adoption_target_key_ambiguous:workspace=%',v_workspace;
      end if;
      if exists (
        select candidate.target_master_record_id
        from cm_phase_c_lab_adoption_target_candidates candidate
        join master.master_records target_record
          on target_record.id=candidate.target_master_record_id
         and target_record.record_type='lab_test'
        where candidate.workspace_id=v_workspace
          and candidate.target_master_key is not null
          and pg_catalog.btrim(candidate.target_master_key)<>target_record.master_key
      ) then
        raise exception 'clinical_master_phase_c_lab_adoption_target_key_mismatch:workspace=%',v_workspace;
      end if;
      insert into cm_phase_c_lab_adoption_test_targets(workspace_id,master_key,master_record_id)
      select distinct candidate.workspace_id,target_record.master_key,target_record.id
      from cm_phase_c_lab_adoption_target_candidates candidate
      join master.master_records target_record
        on target_record.id=candidate.target_master_record_id
       and target_record.record_type='lab_test'
      where candidate.workspace_id=v_workspace;
      select count(*),count(distinct master_key),count(distinct master_record_id)
        into v_frozen_lab_test_target_count,v_frozen_lab_test_target_key_count,v_frozen_lab_test_target_record_count
      from cm_phase_c_lab_adoption_test_targets
      where workspace_id=v_workspace;
      if v_frozen_lab_test_target_count<>30
         or v_frozen_lab_test_target_key_count<>v_frozen_lab_test_target_count
         or v_frozen_lab_test_target_record_count<>v_frozen_lab_test_target_count
         or exists (
           select 1
           from cm_phase_c_referenced_test_keys referenced
           where not exists (
             select 1
             from cm_phase_c_lab_adoption_test_targets target_test
             where target_test.workspace_id=v_workspace and target_test.master_key=referenced.master_key
           )
         ) then
        raise exception 'clinical_master_phase_c_lab_adoption_target_set_invalid:workspace=% targetCount=% targetKeyCount=% targetRecordCount=% expectedReferencedTestCount=%',v_workspace,v_frozen_lab_test_target_count,v_frozen_lab_test_target_key_count,v_frozen_lab_test_target_record_count,(select count(*) from cm_phase_c_referenced_test_keys);
      end if;
      -- The lab adopter reports createdItemCount as a version-row creation
      -- delta, while createdLinkCount is a projection-attempt count (the
      -- helper increments it even when a deterministic link already exists).
      -- Capture the version-row baseline separately from the distinct current
      -- item baseline; final counts below are always measured from live rows.
      select count(*),count(distinct item_version.lab_test_item_id) into v_before_lab_test_version_count,v_before_lab_test_version_item_count
      from public.lab_test_item_versions item_version
      join public.lab_test_items item on item.workspace_id=item_version.workspace_id and item.id=item_version.lab_test_item_id
      join cm_phase_c_lab_adoption_test_targets frozen_target
        on frozen_target.workspace_id=v_workspace
       and frozen_target.master_record_id=item.source_master_record_id
      where item.workspace_id=v_workspace and item.definition_origin='clair_master';
      select encode(extensions.digest(convert_to(coalesce(jsonb_agg(jsonb_build_object(
        'labTestItemId',item_version.lab_test_item_id,
        'workspaceResultRevision',item_version.workspace_result_revision,
        'testItemName',item_version.test_item_name,
        'resultInputType',item_version.result_input_type,
        'resultValueKind',item_version.result_value_kind,
        'resultUnit',item_version.result_unit,
        'decimalScale',item_version.decimal_scale,
        'definitionOrigin',item_version.definition_origin,
        'customizationState',item_version.customization_state,
        'sourceMasterRecordId',item_version.source_master_record_id,
        'sourceMasterRevision',item_version.source_master_revision,
        'sourceProjectionSchemaVersion',item_version.source_projection_schema_version,
        'sourceProjectionSnapshot',item_version.source_projection_snapshot,
        'sourceProjectionSha256',item_version.source_projection_sha256,
        'localDefinitionSnapshot',item_version.local_definition_snapshot,
        'localDefinitionSha256',item_version.local_definition_sha256
      ) order by item_version.lab_test_item_id,item_version.workspace_result_revision),'[]'::jsonb)::text,'UTF8'),'sha256'),'hex') into v_before_lab_test_version_fingerprint
      from public.lab_test_item_versions item_version
      join public.lab_test_items item on item.workspace_id=item_version.workspace_id and item.id=item_version.lab_test_item_id
      join cm_phase_c_lab_adoption_test_targets frozen_target
        on frozen_target.workspace_id=v_workspace
       and frozen_target.master_record_id=item.source_master_record_id
      where item.workspace_id=v_workspace and item.definition_origin='clair_master';
      select count(distinct item.id) into v_lab_catalog_count
      from public.order_catalog_items item
      join master.master_records master_row on master_row.id=item.source_master_record_id and master_row.record_type='order'
      join cm_phase_c_payload_records payload_order on payload_order.master_key=master_row.master_key and payload_order.record_type='order'
      where item.workspace_id=v_workspace and item.category_group='lab' and item.source_master_record_id is not null;
      select count(distinct link.id) into v_before_lab_link_count
      from public.order_catalog_lab_test_item_links link
      join public.order_catalog_items item on item.workspace_id=link.workspace_id and item.id=link.order_catalog_item_id
      join master.master_records master_row on master_row.id=link.source_master_order_record_id and master_row.record_type='order'
      join cm_phase_c_payload_records payload_order on payload_order.master_key=master_row.master_key and payload_order.record_type='order'
      where link.workspace_id=v_workspace and link.link_origin='clair_master';
      v_previous_claims := current_setting('request.jwt.claims',true);
      v_result := private.clair_adopt_master_release_to_workspace(v_workspace,v_release_id);
      v_adoption_result := v_result;
      if coalesce(v_result->>'ok','false')<>'true' then raise exception 'clinical_master_phase_c_adoption_failed:%',v_workspace; end if;
      -- The wrapper first creates/updates the base catalog rows and their
      -- pinned revisions, then runs the lab helper. Recompute the helper's
      -- live-derived catalog/link attempt totals immediately after that base
      -- work, using the same pinned order/panel snapshots as the helper.
      -- The payload helper traverses exact manifest owners only.  An older
      -- nonpayload metabolic catalog remains outside both totals.
      with eligible as (
        select item.id,profile.value as profile
        from public.order_catalog_items item
        join master.master_record_versions order_version
          on order_version.master_record_id=item.source_master_record_id
         and order_version.revision=item.source_master_revision
        join master.master_records order_record
          on order_record.id=order_version.master_record_id
         and order_record.record_type='order'
        join private.clinical_master_release_payload_owner_manifest owner_manifest
          on owner_manifest.release_id=v_release_id
         and owner_manifest.master_record_id=item.source_master_record_id
         and owner_manifest.effective_revision=item.source_master_revision
         and owner_manifest.record_type='order'
         and owner_manifest.included
        cross join lateral (
          select profile_row.value
          from jsonb_array_elements(coalesce(order_version.snapshot->'labOrderProfiles','[]'::jsonb)) profile_row(value)
          where profile_row.value->>'orderMasterKey'=order_record.master_key
        ) profile
        where item.workspace_id=v_workspace
          and item.category_group='lab'
          and item.source_master_record_id is not null
      )
      select count(*) into v_expected_workspace_lab_catalog_count
      from eligible;
      with eligible as (
        select profile.value as profile
        from public.order_catalog_items item
        join master.master_record_versions order_version
          on order_version.master_record_id=item.source_master_record_id
         and order_version.revision=item.source_master_revision
        join master.master_records order_record
          on order_record.id=order_version.master_record_id
         and order_record.record_type='order'
        join private.clinical_master_release_payload_owner_manifest owner_manifest
          on owner_manifest.release_id=v_release_id
         and owner_manifest.master_record_id=item.source_master_record_id
         and owner_manifest.effective_revision=item.source_master_revision
         and owner_manifest.record_type='order'
         and owner_manifest.included
        cross join lateral (
          select profile_row.value
          from jsonb_array_elements(coalesce(order_version.snapshot->'labOrderProfiles','[]'::jsonb)) profile_row(value)
          where profile_row.value->>'orderMasterKey'=order_record.master_key
        ) profile
        where item.workspace_id=v_workspace
          and item.category_group='lab'
          and item.source_master_record_id is not null
      )
      select coalesce(sum(
        case
          when nullif(profile->>'labPanelMasterRecordId','') is not null then coalesce((
            select jsonb_array_length(coalesce(panel_version.snapshot->'labPanelItems','[]'::jsonb))
            from master.master_record_versions panel_version
            where panel_version.master_record_id=(profile->>'labPanelMasterRecordId')::uuid
              and panel_version.revision=(profile->>'labPanelMasterRevision')::integer
          ),0)
          else 1
        end
      ),0)::integer into v_expected_initial_workspace_lab_link_attempt_count
      from eligible;
      v_adoption_catalog_count := coalesce((v_result->'labProjection'->>'catalogCount')::integer,-1);
      v_adoption_created_item_count := coalesce((v_result->'labProjection'->>'createdItemCount')::integer,-1);
      v_adoption_created_link_count := coalesce((v_result->'labProjection'->>'createdLinkCount')::integer,-1);
      if v_adoption_catalog_count<0 or v_adoption_catalog_count>v_expected_workspace_lab_catalog_count
         or v_adoption_created_item_count<0
         or v_adoption_created_link_count<0 or v_adoption_created_link_count>v_expected_initial_workspace_lab_link_attempt_count
         or v_adoption_catalog_count<>v_expected_workspace_lab_catalog_count
         or v_adoption_created_link_count<>v_expected_initial_workspace_lab_link_attempt_count then
        raise exception 'clinical_master_phase_c_lab_adoption_shape_invalid:workspace=% returnedCatalogCount=% returnedCreatedItemCount=% returnedCreatedLinkCount=% expectedLiveCatalogCount=% expectedInitialLiveLinkAttempts=%',v_workspace,v_adoption_catalog_count,v_adoption_created_item_count,v_adoption_created_link_count,v_expected_workspace_lab_catalog_count,v_expected_initial_workspace_lab_link_attempt_count;
      end if;
      -- Capture the exact payload-referenced projected version rows immediately
      -- after the first adopter.  This proves the retry cannot create a
      -- missing or altered lab_test_item_versions row, independent of RPC
      -- counters or publisher release-version omissions.
      select count(*) into v_after_first_lab_test_version_count
      from public.lab_test_item_versions item_version
      join public.lab_test_items item on item.workspace_id=item_version.workspace_id and item.id=item_version.lab_test_item_id
      join cm_phase_c_lab_adoption_test_targets frozen_target
        on frozen_target.workspace_id=v_workspace
       and frozen_target.master_record_id=item.source_master_record_id
      where item.workspace_id=v_workspace and item.definition_origin='clair_master';
      if v_after_first_lab_test_version_count-v_before_lab_test_version_count<>v_adoption_created_item_count then
        raise exception 'clinical_master_phase_c_lab_test_version_delta_invalid:workspace=% beforeVersionCount=% afterVersionCount=% returnedCreatedItemCount=%',v_workspace,v_before_lab_test_version_count,v_after_first_lab_test_version_count,v_adoption_created_item_count;
      end if;
      select count(distinct item.id) into v_after_first_lab_test_item_count
      from public.lab_test_items item
      join master.master_records master_row on master_row.id=item.source_master_record_id and master_row.record_type='lab_test'
      join cm_phase_c_referenced_test_keys referenced on referenced.master_key=master_row.master_key
      where item.workspace_id=v_workspace and item.definition_origin='clair_master';
      if v_after_first_lab_test_item_count<>30 then
        raise exception 'clinical_master_phase_c_first_lab_test_item_cardinality_invalid:workspace=% actual=% expected=%',v_workspace,v_after_first_lab_test_item_count,30;
      end if;
      if exists (
        select 1
        from public.lab_test_items item
        join master.master_records master_row on master_row.id=item.source_master_record_id and master_row.record_type='lab_test'
        join cm_phase_c_referenced_test_keys referenced on referenced.master_key=master_row.master_key
        where item.workspace_id=v_workspace and item.definition_origin='clair_master'
        group by item.source_master_record_id
        having count(*)<>1
      ) then raise exception 'clinical_master_phase_c_first_lab_test_source_invalid:%',v_workspace; end if;
      select encode(extensions.digest(convert_to(coalesce(jsonb_agg(jsonb_build_object(
        'labTestItemId',item_version.lab_test_item_id,
        'workspaceResultRevision',item_version.workspace_result_revision,
        'testItemName',item_version.test_item_name,
        'resultInputType',item_version.result_input_type,
        'resultValueKind',item_version.result_value_kind,
        'resultUnit',item_version.result_unit,
        'decimalScale',item_version.decimal_scale,
        'definitionOrigin',item_version.definition_origin,
        'customizationState',item_version.customization_state,
        'sourceMasterRecordId',item_version.source_master_record_id,
        'sourceMasterRevision',item_version.source_master_revision,
        'sourceProjectionSchemaVersion',item_version.source_projection_schema_version,
        'sourceProjectionSnapshot',item_version.source_projection_snapshot,
        'sourceProjectionSha256',item_version.source_projection_sha256,
        'localDefinitionSnapshot',item_version.local_definition_snapshot,
        'localDefinitionSha256',item_version.local_definition_sha256
      ) order by item_version.lab_test_item_id,item_version.workspace_result_revision),'[]'::jsonb)::text,'UTF8'),'sha256'),'hex') into v_after_first_lab_test_version_fingerprint
      from public.lab_test_item_versions item_version
      join public.lab_test_items item on item.workspace_id=item_version.workspace_id and item.id=item_version.lab_test_item_id
      join cm_phase_c_lab_adoption_test_targets frozen_target
        on frozen_target.workspace_id=v_workspace
       and frozen_target.master_record_id=item.source_master_record_id
      where item.workspace_id=v_workspace and item.definition_origin='clair_master';
      -- A second identical adopter call is part of the idempotency contract:
      -- no new lab-test versions, no extra source rows, and the same final
      -- catalog projection.  The helper reports live-derived projection
      -- attempts rather than inserted-row deltas; the same derived total is
      -- required on retry, while release-scoped rows are fingerprinted below.
      v_adoption_retry_result := private.clair_adopt_master_release_to_workspace(v_workspace,v_release_id);
      v_retry_catalog_count := coalesce((v_adoption_retry_result->'labProjection'->>'catalogCount')::integer,-1);
      v_retry_created_item_count := coalesce((v_adoption_retry_result->'labProjection'->>'createdItemCount')::integer,-1);
      v_retry_created_link_count := coalesce((v_adoption_retry_result->'labProjection'->>'createdLinkCount')::integer,-1);
      if coalesce(v_adoption_retry_result->>'ok','false')<>'true'
         or v_retry_catalog_count<>v_expected_workspace_lab_catalog_count
         or v_retry_created_item_count<>0
         or v_retry_created_link_count<>v_expected_initial_workspace_lab_link_attempt_count then
        raise exception 'clinical_master_phase_c_lab_adoption_retry_not_idempotent:%',v_workspace;
      end if;
      select count(*) into v_after_retry_lab_test_version_count
      from public.lab_test_item_versions item_version
      join public.lab_test_items item on item.workspace_id=item_version.workspace_id and item.id=item_version.lab_test_item_id
      join cm_phase_c_lab_adoption_test_targets frozen_target
        on frozen_target.workspace_id=v_workspace
       and frozen_target.master_record_id=item.source_master_record_id
      where item.workspace_id=v_workspace and item.definition_origin='clair_master';
      select encode(extensions.digest(convert_to(coalesce(jsonb_agg(jsonb_build_object(
        'labTestItemId',item_version.lab_test_item_id,
        'workspaceResultRevision',item_version.workspace_result_revision,
        'testItemName',item_version.test_item_name,
        'resultInputType',item_version.result_input_type,
        'resultValueKind',item_version.result_value_kind,
        'resultUnit',item_version.result_unit,
        'decimalScale',item_version.decimal_scale,
        'definitionOrigin',item_version.definition_origin,
        'customizationState',item_version.customization_state,
        'sourceMasterRecordId',item_version.source_master_record_id,
        'sourceMasterRevision',item_version.source_master_revision,
        'sourceProjectionSchemaVersion',item_version.source_projection_schema_version,
        'sourceProjectionSnapshot',item_version.source_projection_snapshot,
        'sourceProjectionSha256',item_version.source_projection_sha256,
        'localDefinitionSnapshot',item_version.local_definition_snapshot,
        'localDefinitionSha256',item_version.local_definition_sha256
      ) order by item_version.lab_test_item_id,item_version.workspace_result_revision),'[]'::jsonb)::text,'UTF8'),'sha256'),'hex') into v_after_retry_lab_test_version_fingerprint
      from public.lab_test_item_versions item_version
      join public.lab_test_items item on item.workspace_id=item_version.workspace_id and item.id=item_version.lab_test_item_id
      join cm_phase_c_lab_adoption_test_targets frozen_target
        on frozen_target.workspace_id=v_workspace
       and frozen_target.master_record_id=item.source_master_record_id
      where item.workspace_id=v_workspace and item.definition_origin='clair_master';
      if v_after_retry_lab_test_version_count-v_after_first_lab_test_version_count<>v_retry_created_item_count
         or v_after_retry_lab_test_version_count<>v_after_first_lab_test_version_count
         or v_after_retry_lab_test_version_fingerprint<>v_after_first_lab_test_version_fingerprint then
        raise exception 'clinical_master_phase_c_lab_test_item_versions_retry_drift:%',v_workspace;
      end if;
      insert into clinical_master_operational_v3_phase_c_state values('adoption:'||v_workspace,v_result);
      insert into clinical_master_operational_v3_phase_c_state values('adoption_retry:'||v_workspace,jsonb_build_object('result',v_adoption_retry_result,'frozenLabTestTargetCount',v_frozen_lab_test_target_count,'frozenLabTestTargetIds',coalesce((select jsonb_agg(jsonb_build_object('masterKey',target.master_key,'masterRecordId',target.master_record_id) order by target.master_key,target.master_record_id) from cm_phase_c_lab_adoption_test_targets target where target.workspace_id=v_workspace),'[]'::jsonb),'baselineLabTestVersionItemCount',v_before_lab_test_version_item_count,'baselineLabTestVersionCount',v_before_lab_test_version_count,'baselineLabTestVersionFingerprint',v_before_lab_test_version_fingerprint,'baselineLabCatalogs',v_lab_catalog_count,'baselineLabLinks',v_before_lab_link_count,'expectedWorkspaceLabCatalogCount',v_expected_workspace_lab_catalog_count,'expectedInitialWorkspaceLabLinkAttemptCount',v_expected_initial_workspace_lab_link_attempt_count,'expectedWorkspaceLabLinkAttemptCount',v_expected_workspace_lab_link_attempt_count,'firstLabTestItemCount',v_after_first_lab_test_item_count,'firstLabTestVersionCount',v_after_first_lab_test_version_count,'retryLabTestVersionCount',v_after_retry_lab_test_version_count,'firstLabTestVersionFingerprint',v_after_first_lab_test_version_fingerprint,'retryLabTestVersionFingerprint',v_after_retry_lab_test_version_fingerprint));

      -- Pricing and final activation are allowed to touch only a complete,
      -- one-to-one v3 order projection. This catches missing source rows and
      -- duplicate clair_master rows before any public catalog RPC.
      if (
        select count(*)
        from public.order_catalog_items item
        join master.master_records master_row on master_row.id=item.source_master_record_id and master_row.record_type='order'
        join cm_phase_c_payload_records payload_order on payload_order.master_key=master_row.master_key and payload_order.record_type='order'
        where item.workspace_id=v_workspace and item.origin_type='clair_master'
      )<>120
         or exists (
           select 1
           from cm_phase_c_payload_records payload_order
           left join (
             select master_row.master_key,count(*) as catalog_row_count
             from public.order_catalog_items item
             join master.master_records master_row on master_row.id=item.source_master_record_id and master_row.record_type='order'
             where item.workspace_id=v_workspace and item.origin_type='clair_master'
             group by master_row.master_key
           ) catalog_rows on catalog_rows.master_key=payload_order.master_key
           where payload_order.record_type='order' and coalesce(catalog_rows.catalog_row_count,0)<>1
         )
         or exists (
           select 1
           from public.order_catalog_items item
           join master.master_records master_row on master_row.id=item.source_master_record_id and master_row.record_type='order'
           join cm_phase_c_payload_records payload_order on payload_order.master_key=master_row.master_key and payload_order.record_type='order'
           where item.workspace_id=v_workspace
             and item.origin_type='clair_master'
             and item.standard_order_id is distinct from master_row.master_key
         ) then
        raise exception 'clinical_master_phase_c_order_catalog_projection_shape_invalid:%',v_workspace;
      end if;

      -- First patch every v3 order price only. Pending rows must be resolved
      -- before an availability activation patch is accepted by the public RPC.
      for v_item in
        select item.* from public.order_catalog_items item
        join master.master_records master_row on master_row.id=item.source_master_record_id
        join cm_phase_c_payload_records payload_order on payload_order.master_key=master_row.master_key and payload_order.record_type='order'
        where item.workspace_id=v_workspace and item.origin_type='clair_master' and master_row.record_type='order'
        order by item.id
        for update
      loop
        select price into v_price from jsonb_array_elements(v_pricing->'orders') price where price->>'masterKey'=v_item.standard_order_id limit 1;
        if v_price is null then raise exception 'clinical_master_phase_c_price_row_missing:%',v_item.standard_order_id; end if;
        perform set_config('request.jwt.claim.sub',v_actor::text,true);
        perform set_config('request.jwt.claims',jsonb_build_object('sub',v_actor::text,'role','authenticated')::text,true);
        execute 'set local role authenticated';
        select public.clair_update_order_catalog_item(v_workspace,v_item.id,v_item.catalog_revision,jsonb_build_object('priceKrw',(v_price->>'syntheticWorkspacePriceKrw')::integer)) into v_result;
        execute 'set local role postgres';
        perform set_config('request.jwt.claim.sub',coalesce(nullif(v_original_sub,''),''),true);
        perform set_config('request.jwt.claims',coalesce(nullif(v_previous_claims,''),'{}'),true);
        select * into v_item from public.order_catalog_items item where item.workspace_id=v_workspace and item.id=v_item.id for update;
      end loop;

      -- Resolve one strict pending/new review target per payload catalog.  The
      -- source revision may originate in an earlier published release (for
      -- example a v2-held catalog), but it must still be the exact immutable
      -- version currently held by the item and the current master projection.
      -- Freeze every authority field before the resolver can mutate it.
      delete from cm_phase_c_order_review_targets where workspace_id=v_workspace;
      insert into cm_phase_c_order_review_targets(
        workspace_id,update_id,item_id,source_master_record_id,master_key,
        update_release_id,update_release_key,update_release_no,
        held_version_id,held_version_release_id,held_version_release_key,held_version_release_no,held_revision,
        master_current_revision,item_catalog_revision,price_krw,update_type,
        update_status,update_previous_source_revision,update_workspace_snapshot,
        update_source_revision,update_source_snapshot,update_source_fingerprint,
        item_source_revision,item_source_snapshot,item_source_fingerprint,
        canonical_source_projection,canonical_source_fingerprint,held_version_snapshot
      )
      select update_row.workspace_id,update_row.id,review_item.id,review_master.id,review_master.master_key,
        update_release.id,update_release.release_key,update_release.release_no,
        held_version.id,held_version.release_id,held_release.release_key,held_release.release_no,held_version.revision,
        review_master.current_revision,review_item.catalog_revision,review_item.price_krw,update_row.update_type,
        update_row.status,update_row.previous_source_revision,update_row.workspace_snapshot,
        update_row.source_revision,update_row.source_snapshot,private.clinical_master_projection_fingerprint(update_row.source_snapshot),
        review_item.source_master_revision,review_item.source_projection_snapshot,review_item.source_projection_fingerprint,
        canonical_projection.value,private.clinical_master_projection_fingerprint(canonical_projection.value),held_version.snapshot
      from public.workspace_master_updates update_row
      join master.master_releases update_release
        on update_release.id=update_row.release_id
       and update_release.status='published'
      join public.order_catalog_items review_item
        on review_item.workspace_id=update_row.workspace_id
       and review_item.id=update_row.order_catalog_item_id
       and review_item.origin_type='clair_master'
       and review_item.source_master_record_id=update_row.source_master_record_id
       and review_item.price_krw>0
      join master.master_records review_master
        on review_master.id=review_item.source_master_record_id
       and review_master.record_type='order'
       and review_item.standard_order_id=review_master.master_key
      join master.master_record_versions held_version
        on held_version.master_record_id=review_master.id
       and held_version.revision=review_item.source_master_revision
       and held_version.snapshot->>'masterKey'=review_master.master_key
       and held_version.snapshot->>'recordType'='order'
       and held_version.snapshot->>'revision'=held_version.revision::text
      join master.master_releases held_release
        on held_release.id=held_version.release_id
       and held_release.status='published'
      join cm_phase_c_payload_records payload_order
        on payload_order.master_key=review_master.master_key
       and payload_order.record_type='order'
      cross join lateral (
        select private.clinical_master_order_source_projection(review_master.id) as value
      ) canonical_projection
      where update_row.workspace_id=v_workspace
        and update_row.update_type='new'
        and update_row.status='pending'
        and update_row.previous_source_revision is null
        and update_row.workspace_snapshot is null
        and update_row.source_revision=review_item.source_master_revision
        and update_row.source_revision=review_master.current_revision
        and held_release.release_no<=update_release.release_no
        and update_release.release_no<=v_release_no
        and update_row.source_snapshot is not null
        and review_item.source_projection_snapshot is not null
        and update_row.source_snapshot=review_item.source_projection_snapshot
        and update_row.source_snapshot=canonical_projection.value
        and review_item.source_projection_snapshot=canonical_projection.value
        and private.clinical_master_projection_fingerprint(update_row.source_snapshot) is not null
        and review_item.source_projection_fingerprint is not null
        and private.clinical_master_projection_fingerprint(update_row.source_snapshot)=review_item.source_projection_fingerprint
        and private.clinical_master_projection_fingerprint(update_row.source_snapshot)=private.clinical_master_projection_fingerprint(canonical_projection.value);
      if exists (
        select 1 from cm_phase_c_order_review_targets target_row
        where target_row.workspace_id=v_workspace
        group by target_row.item_id
        having count(*)<>1
      ) then
        raise exception 'clinical_master_phase_c_order_review_target_duplicate:%:%',v_workspace,(select coalesce(jsonb_agg(jsonb_build_object('itemId',target_row.item_id,'masterKey',target_row.master_key,'targetCount',target_row.target_count) order by target_row.item_id),'[]'::jsonb) from (select item_id,master_key,count(*) target_count from cm_phase_c_order_review_targets where workspace_id=v_workspace group by item_id,master_key having count(*)<>1) target_row)::text;
      end if;
      select count(*) into v_order_review_target_count from cm_phase_c_order_review_targets where workspace_id=v_workspace;
      select count(*) into v_payload_catalog_count
      from public.order_catalog_items item
      join master.master_records master_row
        on master_row.id=item.source_master_record_id
       and master_row.record_type='order'
      join cm_phase_c_payload_records payload_order
        on payload_order.master_key=master_row.master_key
       and payload_order.record_type='order'
      where item.workspace_id=v_workspace
        and item.origin_type='clair_master';
      select count(*) into v_payload_pending_review_count
      from public.workspace_master_updates pending_row
      join public.order_catalog_items review_item
        on review_item.workspace_id=pending_row.workspace_id
       and review_item.id=pending_row.order_catalog_item_id
       and review_item.origin_type='clair_master'
      join master.master_records review_master
        on review_master.id=review_item.source_master_record_id
       and review_master.record_type='order'
       and review_item.standard_order_id=review_master.master_key
      join cm_phase_c_payload_records payload_order
        on payload_order.master_key=review_master.master_key
       and payload_order.record_type='order'
      where pending_row.workspace_id=v_workspace
        and pending_row.status='pending'
        and pending_row.update_type='new';
      select count(*) into v_positive_price_payload_count
      from public.order_catalog_items item
      join master.master_records master_row
        on master_row.id=item.source_master_record_id
       and master_row.record_type='order'
      join cm_phase_c_payload_records payload_order
        on payload_order.master_key=master_row.master_key
       and payload_order.record_type='order'
      where item.workspace_id=v_workspace
        and item.origin_type='clair_master'
        and item.price_krw>0;
      select count(*) into v_canonical_projection_match_count
      from public.order_catalog_items item
      join master.master_records master_row
        on master_row.id=item.source_master_record_id
       and master_row.record_type='order'
      join cm_phase_c_payload_records payload_order
        on payload_order.master_key=master_row.master_key
       and payload_order.record_type='order'
      where item.workspace_id=v_workspace
        and item.origin_type='clair_master'
        and item.source_projection_snapshot is not null
        and item.source_projection_fingerprint is not null
        and item.source_projection_snapshot=private.clinical_master_order_source_projection(master_row.id)
        and item.source_projection_fingerprint=private.clinical_master_projection_fingerprint(item.source_projection_snapshot);
      select count(*) into v_version_release_match_count
      from public.workspace_master_updates pending_row
      join public.order_catalog_items review_item
        on review_item.workspace_id=pending_row.workspace_id
       and review_item.id=pending_row.order_catalog_item_id
       and review_item.origin_type='clair_master'
       and review_item.source_master_record_id=pending_row.source_master_record_id
      join master.master_records review_master
        on review_master.id=review_item.source_master_record_id
       and review_master.record_type='order'
       and review_item.standard_order_id=review_master.master_key
      join master.master_record_versions held_version
        on held_version.master_record_id=review_master.id
       and held_version.revision=review_item.source_master_revision
       and held_version.snapshot->>'masterKey'=review_master.master_key
       and held_version.snapshot->>'recordType'='order'
       and held_version.snapshot->>'revision'=held_version.revision::text
      join master.master_releases held_release
        on held_release.id=held_version.release_id
       and held_release.status='published'
      join master.master_releases update_release
        on update_release.id=pending_row.release_id
       and update_release.status='published'
       and held_release.release_no<=update_release.release_no
       and update_release.release_no<=v_release_no
      join cm_phase_c_payload_records payload_order
        on payload_order.master_key=review_master.master_key
       and payload_order.record_type='order'
      where pending_row.workspace_id=v_workspace
        and pending_row.status='pending'
        and pending_row.update_type='new'
        and pending_row.previous_source_revision is null
        and pending_row.workspace_snapshot is null
        and pending_row.source_revision=review_item.source_master_revision
        and pending_row.source_revision=review_master.current_revision;
      if v_order_review_target_count<>120
         or v_payload_pending_review_count<>120
         or v_payload_catalog_count<>120
         or v_positive_price_payload_count<>120
         or v_canonical_projection_match_count<>120
         or v_version_release_match_count<>120 then
        raise exception 'clinical_master_phase_c_order_review_target_shape_invalid:%:selectedTargetCount=%:pendingPayloadCount=%:payloadCatalogCount=%:positivePricePayloadCount=%:canonicalProjectionMatchCount=%:versionReleaseMatchCount=%',v_workspace,v_order_review_target_count,v_payload_pending_review_count,v_payload_catalog_count,v_positive_price_payload_count,v_canonical_projection_match_count,v_version_release_match_count;
      end if;
      if exists (
        select 1
        from public.workspace_master_updates pending_row
        join public.order_catalog_items review_item
          on review_item.workspace_id=pending_row.workspace_id
         and review_item.id=pending_row.order_catalog_item_id
         and review_item.origin_type='clair_master'
        join master.master_records review_master
          on review_master.id=review_item.source_master_record_id
         and review_master.record_type='order'
         and review_item.standard_order_id=review_master.master_key
        join cm_phase_c_payload_records payload_order
          on payload_order.master_key=review_master.master_key
         and payload_order.record_type='order'
        where pending_row.workspace_id=v_workspace
          and pending_row.status='pending'
          and not (pending_row.update_type='new' and pending_row.previous_source_revision is null and pending_row.workspace_snapshot is null and pending_row.source_master_record_id=review_item.source_master_record_id and pending_row.source_revision=review_item.source_master_revision and pending_row.source_revision=review_master.current_revision and exists (select 1 from master.master_record_versions held_version join master.master_releases held_release on held_release.id=held_version.release_id and held_release.status='published' join master.master_releases update_release on update_release.id=pending_row.release_id and update_release.status='published' where held_version.master_record_id=review_master.id and held_version.revision=review_item.source_master_revision and held_version.snapshot->>'masterKey'=review_master.master_key and held_version.snapshot->>'recordType'='order' and held_version.snapshot->>'revision'=held_version.revision::text and held_release.release_no<=update_release.release_no and update_release.release_no<=v_release_no) and pending_row.source_snapshot is not null and review_item.source_projection_snapshot is not null and review_item.source_projection_fingerprint is not null and pending_row.source_snapshot=review_item.source_projection_snapshot and pending_row.source_snapshot=private.clinical_master_order_source_projection(review_master.id) and private.clinical_master_projection_fingerprint(pending_row.source_snapshot) is not null and private.clinical_master_projection_fingerprint(pending_row.source_snapshot)=review_item.source_projection_fingerprint and private.clinical_master_projection_fingerprint(pending_row.source_snapshot)=private.clinical_master_projection_fingerprint(private.clinical_master_order_source_projection(review_master.id)) and exists (select 1 from master.master_record_versions held_version join master.master_releases held_release on held_release.id=held_version.release_id and held_release.status='published' where held_version.master_record_id=review_master.id and held_version.revision=review_item.source_master_revision and held_version.snapshot->>'masterKey'=review_master.master_key and held_version.snapshot->>'recordType'='order' and held_version.snapshot->>'revision'=held_version.revision::text))
      ) then
        raise exception 'clinical_master_phase_c_order_review_target_invalid:%:%',v_workspace,(select coalesce(jsonb_agg(jsonb_build_object('id',pending_row.id,'itemId',pending_row.order_catalog_item_id,'masterKey',review_master.master_key,'type',pending_row.update_type,'sourceRevision',pending_row.source_revision,'pendingSourceMasterRecordId',pending_row.source_master_record_id,'itemSourceMasterRecordId',review_item.source_master_record_id,'sourceMasterRecordMatch',coalesce(pending_row.source_master_record_id=review_item.source_master_record_id,false),'sourceRevisionMatch',coalesce(pending_row.source_revision=review_item.source_master_revision and pending_row.source_revision=review_master.current_revision,false),'snapshotMatch',coalesce(pending_row.source_snapshot=review_item.source_projection_snapshot,false),'currentProjectionMatch',coalesce(pending_row.source_snapshot=private.clinical_master_order_source_projection(review_master.id),false),'releaseMatch',diagnostic.release_match,'sourceFingerprintMatch',diagnostic.source_fingerprint_match,'heldPublishedVersionExists',diagnostic.held_published_version_exists) order by pending_row.id),'[]'::jsonb) from public.workspace_master_updates pending_row join public.order_catalog_items review_item on review_item.workspace_id=pending_row.workspace_id and review_item.id=pending_row.order_catalog_item_id and review_item.origin_type='clair_master' join master.master_records review_master on review_master.id=review_item.source_master_record_id and review_master.record_type='order' and review_item.standard_order_id=review_master.master_key join cm_phase_c_payload_records payload_order on payload_order.master_key=review_master.master_key and payload_order.record_type='order' cross join lateral (select coalesce(exists (select 1 from master.master_record_versions held_version join master.master_releases held_release on held_release.id=held_version.release_id and held_release.status='published' join master.master_releases update_release on update_release.id=pending_row.release_id and update_release.status='published' where held_version.master_record_id=review_master.id and held_version.revision=review_item.source_master_revision and held_version.snapshot->>'masterKey'=review_master.master_key and held_version.snapshot->>'recordType'='order' and held_version.snapshot->>'revision'=held_version.revision::text and held_release.release_no<=update_release.release_no and update_release.release_no<=v_release_no),false) as release_match,coalesce(private.clinical_master_projection_fingerprint(pending_row.source_snapshot)=review_item.source_projection_fingerprint,false) as source_fingerprint_match,exists (select 1 from master.master_record_versions held_version join master.master_releases held_release on held_release.id=held_version.release_id and held_release.status='published' where held_version.master_record_id=review_master.id and held_version.revision=review_item.source_master_revision and held_version.snapshot->>'masterKey'=review_master.master_key and held_version.snapshot->>'recordType'='order' and held_version.snapshot->>'revision'=held_version.revision::text) as held_published_version_exists) diagnostic where pending_row.workspace_id=v_workspace and pending_row.status='pending' and not (pending_row.update_type='new' and pending_row.previous_source_revision is null and pending_row.workspace_snapshot is null and pending_row.source_master_record_id=review_item.source_master_record_id and pending_row.source_revision=review_item.source_master_revision and pending_row.source_revision=review_master.current_revision and diagnostic.release_match and pending_row.source_snapshot=review_item.source_projection_snapshot and pending_row.source_snapshot=private.clinical_master_order_source_projection(review_master.id) and diagnostic.source_fingerprint_match and diagnostic.held_published_version_exists))::text;
      end if;

      -- Re-lock each frozen target, invoke only the authenticated resolver, and
      -- verify the returned action/identity plus the stored actor/time evidence.
      -- The target IDs, not actor-wide history, are the only accepted evidence.
      for v_target in
        select target_row.*
        from cm_phase_c_order_review_targets target_row
        where target_row.workspace_id=v_workspace
        order by target_row.master_key,target_row.update_id
      loop
        select update_row.* into v_update from public.workspace_master_updates update_row where update_row.id=v_target.update_id for update;
        if not found then raise exception 'clinical_master_phase_c_order_review_target_missing:%:%',v_workspace,v_target.update_id; end if;
        select item.* into v_item from public.order_catalog_items item where item.workspace_id=v_workspace and item.id=v_target.item_id for update;
        if not found then raise exception 'clinical_master_phase_c_order_review_target_item_missing:%:%',v_workspace,v_target.item_id; end if;
        if v_update.workspace_id is distinct from v_target.workspace_id
           or v_update.order_catalog_item_id is distinct from v_target.item_id
           or v_update.source_master_record_id is distinct from v_target.source_master_record_id
           or v_update.release_id is distinct from v_target.update_release_id
           or v_update.update_type is distinct from v_target.update_type
           or v_update.status is distinct from v_target.update_status
           or v_update.previous_source_revision is distinct from v_target.update_previous_source_revision
           or v_update.workspace_snapshot is distinct from v_target.update_workspace_snapshot
           or v_update.source_revision is distinct from v_target.update_source_revision
           or v_update.source_snapshot is distinct from v_target.update_source_snapshot
           or private.clinical_master_projection_fingerprint(v_update.source_snapshot) is distinct from v_target.update_source_fingerprint
           or v_item.source_master_record_id is distinct from v_target.source_master_record_id
           or v_item.source_master_revision is distinct from v_target.item_source_revision
           or v_item.source_projection_snapshot is distinct from v_target.item_source_snapshot
           or v_item.source_projection_fingerprint is distinct from v_target.item_source_fingerprint
           or v_item.catalog_revision is distinct from v_target.item_catalog_revision
           or v_item.price_krw is distinct from v_target.price_krw
           or v_item.standard_order_id is distinct from v_target.master_key
           or v_update.update_type is distinct from 'new'
           or v_update.status is distinct from 'pending' then
          raise exception 'clinical_master_phase_c_order_review_target_drift:%:%',v_workspace,v_target.update_id;
        end if;
        select master_row.* into v_master from master.master_records master_row where master_row.id=v_target.source_master_record_id for update;
        if not found then raise exception 'clinical_master_phase_c_order_review_target_master_missing:%:%',v_workspace,v_target.update_id; end if;
        if v_master.master_key is distinct from v_target.master_key or v_master.record_type is distinct from 'order' or v_master.current_revision is distinct from v_target.master_current_revision then
          raise exception 'clinical_master_phase_c_order_review_target_master_drift:%:%',v_workspace,v_target.update_id;
        end if;
        select version_row.* into v_held_version from master.master_record_versions version_row where version_row.id=v_target.held_version_id for update;
        if not found or v_held_version.release_id is distinct from v_target.held_version_release_id or v_held_version.revision is distinct from v_target.held_revision or v_held_version.snapshot is distinct from v_target.held_version_snapshot or v_held_version.snapshot->>'recordType' is distinct from 'order' or v_held_version.snapshot->>'revision' is distinct from v_target.held_revision::text then
          raise exception 'clinical_master_phase_c_order_review_target_version_drift:%:%',v_workspace,v_target.update_id;
        end if;
        if v_target.canonical_source_projection is distinct from private.clinical_master_order_source_projection(v_target.source_master_record_id)
           or private.clinical_master_projection_fingerprint(v_target.canonical_source_projection) is distinct from v_target.canonical_source_fingerprint
           or v_target.update_source_snapshot is distinct from v_target.canonical_source_projection
           or v_target.item_source_snapshot is distinct from v_target.canonical_source_projection
           or v_target.update_source_fingerprint is null
           or v_target.item_source_fingerprint is null
           or v_target.update_source_fingerprint is distinct from v_target.canonical_source_fingerprint
           or v_target.item_source_fingerprint is distinct from v_target.canonical_source_fingerprint then
          raise exception 'clinical_master_phase_c_order_review_target_canonical_projection_drift:%:%',v_workspace,v_target.update_id;
        end if;
        select release_row.* into v_held_release from master.master_releases release_row where release_row.id=v_target.held_version_release_id for update;
        if not found or v_held_release.release_key is distinct from v_target.held_version_release_key or v_held_release.release_no is distinct from v_target.held_version_release_no or v_held_release.status is distinct from 'published' then
          raise exception 'clinical_master_phase_c_order_review_target_release_drift:%:%',v_workspace,v_target.update_id;
        end if;
        select release_row.* into v_update_release from master.master_releases release_row where release_row.id=v_target.update_release_id for update;
        if not found or v_update_release.release_key is distinct from v_target.update_release_key or v_update_release.release_no is distinct from v_target.update_release_no or v_update_release.status is distinct from 'published' or v_target.held_version_release_no>v_target.update_release_no or v_target.update_release_no>v_release_no then
          raise exception 'clinical_master_phase_c_order_review_target_update_release_drift:%:%',v_workspace,v_target.update_id;
        end if;
        v_catalog_count := v_item.catalog_revision;
        perform set_config('request.jwt.claim.sub',v_actor::text,true);
        perform set_config('request.jwt.claims',jsonb_build_object('sub',v_actor::text,'role','authenticated')::text,true);
        execute 'set local role authenticated';
        select public.clair_resolve_workspace_master_update(v_workspace,v_target.update_id,v_catalog_count,'accept_source') into v_result;
        execute 'set local role postgres';
        perform set_config('request.jwt.claim.sub',coalesce(nullif(v_original_sub,''),''),true);
        perform set_config('request.jwt.claims',coalesce(nullif(v_previous_claims,''),'{}'),true);
        if coalesce(v_result->>'ok','false')<>'true'
           or coalesce(v_result->>'action','')<>'accept_source'
           or coalesce(v_result->>'enforcedBy','')<>'clair_resolve_workspace_master_update'
           or coalesce(v_result->'update'->>'id','')<>v_target.update_id::text
           or coalesce(v_result->'item'->>'id','')<>v_target.item_id
           or coalesce(v_result->'item'->>'source_master_record_id','')<>v_target.source_master_record_id::text
           or coalesce(v_result->'item'->>'source_master_revision','')<>v_target.item_source_revision::text then
          raise exception 'clinical_master_phase_c_order_review_rpc_invalid:%:%',v_workspace,v_target.update_id;
        end if;
        select item.* into v_item from public.order_catalog_items item where item.workspace_id=v_workspace and item.id=v_target.item_id;
        if not found or v_item.source_master_record_id is distinct from v_target.source_master_record_id or v_item.source_master_revision is distinct from v_target.item_source_revision or v_item.source_projection_snapshot is distinct from v_target.item_source_snapshot or v_item.source_projection_fingerprint is distinct from v_target.item_source_fingerprint then
          raise exception 'clinical_master_phase_c_order_review_readback_invalid:%:%',v_workspace,v_target.update_id;
        end if;
        if not exists (select 1 from public.workspace_master_updates accepted_row where accepted_row.id=v_target.update_id and accepted_row.workspace_id=v_workspace and accepted_row.status='accepted' and accepted_row.update_type='new' and accepted_row.resolved_by_user_id=v_actor and accepted_row.resolved_at is not null and accepted_row.source_master_record_id=v_target.source_master_record_id and accepted_row.source_revision=v_target.update_source_revision and accepted_row.release_id=v_target.update_release_id) then
          raise exception 'clinical_master_phase_c_order_review_evidence_invalid:%:%',v_workspace,v_target.update_id;
        end if;
      end loop;



      -- Every payload catalog must have current source identity plus a
      -- version-backed accepted/new lifecycle. A held-revision gap additionally
      -- requires the accepted current v3 changed lifecycle. Pending reviews
      -- linked to the same workspace/catalog item are an independent blocker
      -- even when their source identity is wrong; keep both diagnostics
      -- separate and compact.
      select coalesce(jsonb_agg(jsonb_build_object(
        'masterKey',master_row.master_key,
        'itemId',item.id,
        'sourceMasterRecordId',item.source_master_record_id,
        'itemSourceRevision',item.source_master_revision,
        'masterCurrentRevision',master_row.current_revision,
        'linkedUpdates',coalesce((select jsonb_agg(jsonb_build_object(
          'id',update_row.id,
          'releaseKey',release_row.release_key,
          'sourceMasterRecordId',update_row.source_master_record_id,
          'type',update_row.update_type,
          'status',update_row.status,
          'sourceRevision',update_row.source_revision,
          'snapshotKey',update_row.source_snapshot->>'masterKey',
          'resolvedActor',update_row.resolved_by_user_id,
          'resolvedAt',update_row.resolved_at
        ) order by update_row.created_at,update_row.id)
        from public.workspace_master_updates update_row
        left join master.master_releases release_row on release_row.id=update_row.release_id
        where update_row.workspace_id=v_workspace
          and update_row.order_catalog_item_id=item.id),'[]'::jsonb)
      ) order by master_row.master_key,item.id),'[]'::jsonb) into v_pre_activation_missing
      from public.order_catalog_items item
      join master.master_records master_row on master_row.id=item.source_master_record_id and master_row.record_type='order'
      join cm_phase_c_payload_records payload_order on payload_order.master_key=master_row.master_key and payload_order.record_type='order'
      where item.workspace_id=v_workspace
        and item.origin_type='clair_master'
        and not (
          item.source_master_revision=master_row.current_revision
          and item.source_projection_snapshot=private.clinical_master_order_source_projection(master_row.id)
          and item.source_projection_fingerprint=private.clinical_master_projection_fingerprint(item.source_projection_snapshot)
          and exists (
            select 1
            from public.workspace_master_updates accepted_row
            join master.master_record_versions version_row
              on version_row.master_record_id=master_row.id
             and version_row.revision=accepted_row.source_revision
             and version_row.snapshot->>'masterKey'=master_row.master_key
            join master.master_releases version_release
              on version_release.id=version_row.release_id
             and version_release.status='published'
            join master.master_releases update_release
              on update_release.id=accepted_row.release_id
             and update_release.status='published'
             and version_release.release_no<=update_release.release_no
             and update_release.release_no<=v_release_no
            where accepted_row.workspace_id=v_workspace
              and accepted_row.order_catalog_item_id=item.id
              and accepted_row.source_master_record_id=item.source_master_record_id
              and accepted_row.update_type='new'
              and accepted_row.status='accepted'
              and accepted_row.previous_source_revision is null
              and accepted_row.workspace_snapshot is null
              and accepted_row.source_snapshot=private.clinical_master_order_source_projection(master_row.id)
              and accepted_row.source_revision=item.source_master_revision
              and accepted_row.source_revision=master_row.current_revision
              and accepted_row.release_id=update_release.id
              and accepted_row.resolved_by_user_id is not null
              and accepted_row.resolved_at is not null
          )
          and not exists (
            select 1
            from public.workspace_master_updates pending_row
            where pending_row.workspace_id=v_workspace
              and pending_row.order_catalog_item_id=item.id
              and pending_row.status='pending'
          )
        );
      select coalesce(jsonb_agg(jsonb_build_object(
        'masterKey',master_row.master_key,
        'itemId',item.id,
        'sourceMasterRecordId',item.source_master_record_id,
        'itemSourceRevision',item.source_master_revision,
        'masterCurrentRevision',master_row.current_revision,
        'linkedUpdates',coalesce((select jsonb_agg(jsonb_build_object(
          'id',update_row.id,
          'releaseKey',release_row.release_key,
          'sourceMasterRecordId',update_row.source_master_record_id,
          'type',update_row.update_type,
          'status',update_row.status,
          'sourceRevision',update_row.source_revision,
          'snapshotKey',update_row.source_snapshot->>'masterKey',
          'resolvedActor',update_row.resolved_by_user_id,
          'resolvedAt',update_row.resolved_at
        ) order by update_row.created_at,update_row.id)
        from public.workspace_master_updates update_row
        left join master.master_releases release_row on release_row.id=update_row.release_id
        where update_row.workspace_id=v_workspace
          and update_row.order_catalog_item_id=item.id),'[]'::jsonb)
      ) order by master_row.master_key,item.id),'[]'::jsonb) into v_pre_activation_pending
      from public.order_catalog_items item
      join master.master_records master_row on master_row.id=item.source_master_record_id and master_row.record_type='order'
      join cm_phase_c_payload_records payload_order on payload_order.master_key=master_row.master_key and payload_order.record_type='order'
      where item.workspace_id=v_workspace
        and item.origin_type='clair_master'
        and exists (
          select 1
          from public.workspace_master_updates pending_update
          where pending_update.workspace_id=v_workspace
            and pending_update.order_catalog_item_id=item.id
            and pending_update.status='pending'
        );
      v_pre_activation_coverage := jsonb_build_object('missingAccepted',v_pre_activation_missing,'pendingLinked',v_pre_activation_pending);
      if v_pre_activation_missing<>'[]'::jsonb or v_pre_activation_pending<>'[]'::jsonb then
        raise exception 'clinical_master_phase_c_pre_activation_review_coverage_invalid:%:missingAccepted=%:pendingLinked=%',v_workspace,v_pre_activation_missing::text,v_pre_activation_pending::text;
      end if;

      -- All target payload order reviews are now accepted and each row has a
      -- fresh catalog_revision. Activate every v3 payload row through the
      -- public CAS/RPC, then pause only the reviewed Cheongdam collisions.
      for v_item in
        select item.* from public.order_catalog_items item
        join master.master_records master_row on master_row.id=item.source_master_record_id
        join cm_phase_c_payload_records payload_order on payload_order.master_key=master_row.master_key and payload_order.record_type='order'
        where item.workspace_id=v_workspace and item.origin_type='clair_master' and master_row.record_type='order'
        order by item.id
        for update
      loop
        perform set_config('request.jwt.claim.sub',v_actor::text,true);
        perform set_config('request.jwt.claims',jsonb_build_object('sub',v_actor::text,'role','authenticated')::text,true);
        execute 'set local role authenticated';
        select public.clair_update_order_catalog_item(v_workspace,v_item.id,v_item.catalog_revision,jsonb_build_object('availabilityStatus','active')) into v_result;
        execute 'set local role postgres';
        perform set_config('request.jwt.claim.sub',coalesce(nullif(v_original_sub,''),''),true);
        perform set_config('request.jwt.claims',coalesce(nullif(v_previous_claims,''),'{}'),true);
        select * into v_item from public.order_catalog_items item where item.workspace_id=v_workspace and item.id=v_item.id for update;
        if exists (select 1 from clinical_master_operational_v3_phase_c_collision_rules rule where rule.workspace_id=v_workspace and rule.master_key=v_item.standard_order_id) then
          perform set_config('request.jwt.claim.sub',v_actor::text,true);
          perform set_config('request.jwt.claims',jsonb_build_object('sub',v_actor::text,'role','authenticated')::text,true);
          execute 'set local role authenticated';
          select public.clair_update_order_catalog_item(v_workspace,v_item.id,v_item.catalog_revision,jsonb_build_object('availabilityStatus','paused')) into v_result;
          execute 'set local role postgres';
          perform set_config('request.jwt.claim.sub',coalesce(nullif(v_original_sub,''),''),true);
          perform set_config('request.jwt.claims',coalesce(nullif(v_previous_claims,''),'{}'),true);
        end if;
      end loop;

      -- B1 review targets use their own authenticated public resolver and CAS.
      for v_update in select update_row.* from public.workspace_lab_item_updates update_row where update_row.workspace_id=v_workspace and update_row.source_release_id=v_release_id and update_row.status='pending' order by update_row.created_at,update_row.id for update loop
        perform set_config('request.jwt.claim.sub',v_actor::text,true);
        perform set_config('request.jwt.claims',jsonb_build_object('sub',v_actor::text,'role','authenticated')::text,true);
        execute 'set local role authenticated';
        select public.clair_resolve_workspace_lab_definition_update(v_workspace,v_update.id,v_actor,v_update.expected_workspace_result_revision,'accept') into v_result;
        execute 'set local role postgres';
        perform set_config('request.jwt.claim.sub',coalesce(nullif(v_original_sub,''),''),true);
        perform set_config('request.jwt.claims',coalesce(nullif(v_previous_claims,''),'{}'),true);
      end loop;
      for v_update in select update_row.* from public.workspace_lab_catalog_updates update_row where update_row.workspace_id=v_workspace and update_row.source_release_id=v_release_id and update_row.status='pending' order by update_row.created_at,update_row.id for update loop
        select catalog_revision into v_catalog_count from public.order_catalog_items where workspace_id=v_workspace and id=v_update.order_catalog_item_id;
        perform set_config('request.jwt.claim.sub',v_actor::text,true);
        perform set_config('request.jwt.claims',jsonb_build_object('sub',v_actor::text,'role','authenticated')::text,true);
        execute 'set local role authenticated';
        select public.clair_resolve_workspace_lab_definition_update(v_workspace,v_update.id,v_actor,v_catalog_count,'accept') into v_result;
        execute 'set local role postgres';
        perform set_config('request.jwt.claim.sub',coalesce(nullif(v_original_sub,''),''),true);
        perform set_config('request.jwt.claims',coalesce(nullif(v_previous_claims,''),'{}'),true);
      end loop;

      if exists (
        select 1
        from public.workspace_master_updates update_row
        join public.order_catalog_items review_item on review_item.workspace_id=update_row.workspace_id and review_item.id=update_row.order_catalog_item_id and review_item.origin_type='clair_master'
        join master.master_records review_master on review_master.id=review_item.source_master_record_id and review_master.record_type='order' and review_item.standard_order_id=review_master.master_key
        join cm_phase_c_payload_records payload_order on payload_order.master_key=review_master.master_key and payload_order.record_type='order'
        where update_row.workspace_id=v_workspace and update_row.status='pending'
      ) or exists (select 1 from public.workspace_lab_item_updates where workspace_id=v_workspace and source_release_id=v_release_id and status='pending') or exists (select 1 from public.workspace_lab_catalog_updates where workspace_id=v_workspace and source_release_id=v_release_id and status='pending') then
        raise exception 'clinical_master_phase_c_pending_review_remains:%',v_workspace;
      end if;
      if (select count(*) from cm_phase_c_order_review_targets target_row where target_row.workspace_id=v_workspace)<>(
        select count(*)
        from cm_phase_c_order_review_targets target_row
        join public.workspace_master_updates accepted_row on accepted_row.id=target_row.update_id
        where target_row.workspace_id=v_workspace
          and accepted_row.workspace_id=v_workspace
          and accepted_row.status='accepted'
          and accepted_row.update_type='new'
          and accepted_row.resolved_by_user_id=v_actor
          and accepted_row.resolved_at is not null
          and accepted_row.source_master_record_id=target_row.source_master_record_id
          and accepted_row.release_id=target_row.update_release_id
          and accepted_row.source_revision=target_row.update_source_revision
      ) then
        raise exception 'clinical_master_phase_c_order_review_count_invalid:%:%:%',v_workspace,v_order_review_target_count,(select count(*) from cm_phase_c_order_review_targets target_row join public.workspace_master_updates accepted_row on accepted_row.id=target_row.update_id where target_row.workspace_id=v_workspace and accepted_row.status='accepted' and accepted_row.resolved_by_user_id=v_actor and accepted_row.resolved_at is not null);
      end if;
      if exists (select 1 from public.workspace_lab_item_updates update_row where update_row.workspace_id=v_workspace and update_row.source_release_id=v_release_id and (update_row.source_master_record_id is null or update_row.lab_test_item_id is null or update_row.status not in ('accepted','rejected','dismissed','auto_applied'))) then raise exception 'clinical_master_phase_c_lab_item_review_evidence_invalid:%',v_workspace; end if;
      if exists (select 1 from public.workspace_lab_item_updates update_row where update_row.workspace_id=v_workspace and update_row.source_release_id=v_release_id and update_row.status in ('accepted','rejected','dismissed') and update_row.resolved_by is null) then raise exception 'clinical_master_phase_c_lab_item_review_actor_missing:%',v_workspace; end if;
      if exists (select 1 from public.workspace_lab_catalog_updates update_row where update_row.workspace_id=v_workspace and update_row.source_release_id=v_release_id and (update_row.source_master_order_record_id is null or update_row.order_catalog_item_id is null or update_row.status not in ('accepted','rejected','dismissed','auto_applied'))) then raise exception 'clinical_master_phase_c_lab_catalog_review_evidence_invalid:%',v_workspace; end if;
      if exists (select 1 from public.workspace_lab_catalog_updates update_row where update_row.workspace_id=v_workspace and update_row.source_release_id=v_release_id and update_row.status in ('accepted','rejected','dismissed') and update_row.resolved_by is null) then raise exception 'clinical_master_phase_c_lab_catalog_review_actor_missing:%',v_workspace; end if;
      insert into clinical_master_operational_v3_phase_c_state values('review_evidence:'||v_workspace,jsonb_build_object('masterUpdates',v_order_review_target_count,'orderReviewScope','strict payload-linked pending/new current-source review; legacy nonpayload rows excluded and fingerprint-guarded','labItemUpdates',(select count(*) from public.workspace_lab_item_updates where workspace_id=v_workspace and source_release_id=v_release_id),'labCatalogUpdates',(select count(*) from public.workspace_lab_catalog_updates where workspace_id=v_workspace and source_release_id=v_release_id),'auditSource','optional workspace review ledgers; fresh lab definitions may be auto-created without lab ledgers; any existing rows are lineage/status/actor-validated; catalog/review RPCs do not emit public.audit_events'));
      if exists (select 1 from public.order_catalog_items item join master.master_records master_row on master_row.id=item.source_master_record_id join cm_phase_c_payload_records payload_order on payload_order.master_key=master_row.master_key and payload_order.record_type='order' where item.workspace_id=v_workspace and item.origin_type='clair_master' and master_row.record_type='order' and (item.price_krw is null or item.price_krw<=0)) then raise exception 'clinical_master_phase_c_price_missing_after_apply:%',v_workspace; end if;
      if exists (select 1 from public.order_catalog_items item join master.master_records master_row on master_row.id=item.source_master_record_id join cm_phase_c_payload_records payload_order on payload_order.master_key=master_row.master_key and payload_order.record_type='order' join clinical_master_operational_v3_phase_c_collision_rules rule on rule.workspace_id=item.workspace_id and rule.master_key=master_row.master_key where item.workspace_id=v_workspace and item.origin_type='clair_master' and item.availability_status<>'paused') then raise exception 'clinical_master_phase_c_collision_master_not_paused:%',v_workspace; end if;
      if exists (select 1 from public.order_catalog_items item join master.master_records master_row on master_row.id=item.source_master_record_id join cm_phase_c_payload_records payload_order on payload_order.master_key=master_row.master_key and payload_order.record_type='order' where item.workspace_id=v_workspace and item.origin_type='clair_master' and master_row.record_type='order' and not exists (select 1 from clinical_master_operational_v3_phase_c_collision_rules rule where rule.workspace_id=v_workspace and rule.master_key=item.standard_order_id) and item.availability_status<>'active') then raise exception 'clinical_master_phase_c_non_collision_master_not_active:%',v_workspace; end if;

      -- Re-check the catalog projection after every public catalog/review RPC.
      -- This independent post-RPC guard verifies the source ID -> masterKey
      -- lineage, exact 120-key cardinality, and one row per payload key before
      -- lab/custom/foreign closeout checks run.
      if (
        select count(*)
        from public.order_catalog_items item
        join master.master_records master_row on master_row.id=item.source_master_record_id and master_row.record_type='order'
        join cm_phase_c_payload_records payload_order on payload_order.master_key=master_row.master_key and payload_order.record_type='order'
        where item.workspace_id=v_workspace and item.origin_type='clair_master'
      )<>120
         or exists (
           select 1
           from cm_phase_c_payload_records payload_order
           left join (
             select master_row.master_key,count(*) as catalog_row_count
             from public.order_catalog_items item
             join master.master_records master_row on master_row.id=item.source_master_record_id and master_row.record_type='order'
             where item.workspace_id=v_workspace and item.origin_type='clair_master'
             group by master_row.master_key
           ) catalog_rows on catalog_rows.master_key=payload_order.master_key
           where payload_order.record_type='order' and coalesce(catalog_rows.catalog_row_count,0)<>1
         )
         or exists (
           select 1
           from public.order_catalog_items item
           join master.master_records master_row on master_row.id=item.source_master_record_id and master_row.record_type='order'
           join cm_phase_c_payload_records payload_order on payload_order.master_key=master_row.master_key and payload_order.record_type='order'
           where item.workspace_id=v_workspace
             and item.origin_type='clair_master'
             and item.standard_order_id is distinct from master_row.master_key
         ) then
        raise exception 'clinical_master_phase_c_order_catalog_projection_final_shape_invalid:%',v_workspace;
      end if;

      select count(distinct item.id) into v_lab_test_count
      from public.lab_test_items item
      join master.master_records master_row on master_row.id=item.source_master_record_id and master_row.record_type='lab_test'
      join cm_phase_c_referenced_test_keys referenced on referenced.master_key=master_row.master_key
      where item.workspace_id=v_workspace and item.definition_origin='clair_master';
      select count(distinct item.id) into v_lab_catalog_count
      from public.order_catalog_items item
      join master.master_records master_row on master_row.id=item.source_master_record_id and master_row.record_type='order'
      join cm_phase_c_payload_records payload_order on payload_order.master_key=master_row.master_key and payload_order.record_type='order'
      where item.workspace_id=v_workspace and item.category_group='lab' and item.source_master_record_id is not null;
      select count(distinct link.lab_test_item_id) into v_expected_lab_test_count
      from public.lab_test_items item
      join master.master_records master_row on master_row.id=item.source_master_record_id and master_row.record_type='lab_test'
      join cm_phase_c_referenced_test_keys referenced on referenced.master_key=master_row.master_key
      join public.order_catalog_lab_test_item_links link on link.workspace_id=item.workspace_id and link.lab_test_item_id=item.id
      where item.workspace_id=v_workspace and item.definition_origin='clair_master';
      if v_lab_catalog_count<>v_expected_profile_count or v_lab_test_count<>30 or v_expected_lab_test_count<>30 then raise exception 'clinical_master_phase_c_lab_test_projection_count_invalid:%:%:%',v_workspace,v_lab_catalog_count,v_lab_test_count; end if;
      if exists (
        select 1
        from public.lab_test_items item
        join master.master_records master_row on master_row.id=item.source_master_record_id and master_row.record_type='lab_test'
        join cm_phase_c_referenced_test_keys referenced on referenced.master_key=master_row.master_key
        where item.workspace_id=v_workspace and item.definition_origin='clair_master'
        group by item.source_master_record_id
        having count(*)<>1
      ) then raise exception 'clinical_master_phase_c_duplicate_lab_test_source:%',v_workspace; end if;
      select count(distinct link.id) into v_lab_link_count
      from public.order_catalog_lab_test_item_links link
      join public.order_catalog_items item on item.workspace_id=link.workspace_id and item.id=link.order_catalog_item_id
      join master.master_records master_row on master_row.id=link.source_master_order_record_id and master_row.record_type='order'
      join cm_phase_c_payload_records payload_order on payload_order.master_key=master_row.master_key and payload_order.record_type='order'
      where link.workspace_id=v_workspace and link.link_origin='clair_master';
      if v_lab_link_count <> v_expected_workspace_lab_link_attempt_count
         or v_expected_direct_profile_count<>20
         or v_expected_panel_profile_count<>10
         or v_expected_panel_item_count<>60
         or v_expected_workspace_lab_link_attempt_count<>80
         or v_expected_direct_profile_count+v_expected_panel_item_count<>v_expected_workspace_lab_link_attempt_count then
        raise exception 'clinical_master_phase_c_lab_link_projection_count_invalid:workspace=% actual=% expected=% directProfiles=% panelProfiles=% panelItems=% expandedLinkAttempts=% formulaDirectPlusPanelItems=%',v_workspace,v_lab_link_count,v_expected_workspace_lab_link_attempt_count,v_expected_direct_profile_count,v_expected_panel_profile_count,v_expected_panel_item_count,v_expected_workspace_lab_link_attempt_count,v_expected_direct_profile_count+v_expected_panel_item_count;
      end if;
      if exists (
        select 1
        from public.order_catalog_lab_test_item_links link
        join master.master_records link_order on link_order.id=link.source_master_order_record_id and link_order.record_type='order'
        join cm_phase_c_payload_records link_payload on link_payload.master_key=link_order.master_key and link_payload.record_type='order'
        where link.workspace_id=v_workspace and link.link_origin='clair_master'
          and exists (
            select 1
            from public.order_catalog_lab_test_item_links other
            join master.master_records other_order on other_order.id=other.source_master_order_record_id and other_order.record_type='order'
            join cm_phase_c_payload_records other_payload on other_payload.master_key=other_order.master_key and other_payload.record_type='order'
            where other.workspace_id=link.workspace_id
              and other.id<>link.id
              and other.order_catalog_item_id=link.order_catalog_item_id
              and other.lab_test_item_id=link.lab_test_item_id
              and other.link_origin=link.link_origin
          )
      ) then raise exception 'clinical_master_phase_c_duplicate_lab_link:%',v_workspace; end if;

      select count(*) into v_catalog_count from public.order_catalog_items item where item.workspace_id=v_workspace and item.origin_type='workspace_custom';
      if v_catalog_count <> (select count(*) from clinical_master_operational_v3_phase_c_custom_before before_row where before_row.workspace_id=v_workspace) then raise exception 'clinical_master_phase_c_custom_row_count_changed:%',v_workspace; end if;
      if v_workspace='workspace-clair-cheongdam' and exists (
        select 1 from cm_phase_c_cheongdam_expected expected_row
        left join public.order_catalog_items actual_row on actual_row.workspace_id=v_workspace and actual_row.id=expected_row.item_id
        where actual_row.id is null or actual_row.origin_type<>'workspace_custom' or actual_row.standard_order_name<>expected_row.expected_name or actual_row.availability_status<>expected_row.expected_status
      ) then raise exception 'clinical_master_phase_c_cheongdam_expected_custom_postcheck_failed'; end if;
      if exists (
        select 1 from clinical_master_operational_v3_phase_c_custom_before before_row
        left join public.order_catalog_items after_row on after_row.workspace_id=before_row.workspace_id and after_row.id=before_row.item_id
        where before_row.workspace_id=v_workspace and after_row.id is null
      ) or exists (
        select 1 from public.order_catalog_items after_row
        left join clinical_master_operational_v3_phase_c_custom_before before_row on before_row.workspace_id=after_row.workspace_id and before_row.item_id=after_row.id
        where after_row.workspace_id=v_workspace and after_row.origin_type='workspace_custom' and before_row.item_id is null
      ) then raise exception 'clinical_master_phase_c_custom_id_set_changed:%',v_workspace; end if;
      if exists (select 1 from clinical_master_operational_v3_phase_c_custom_before before_row join public.order_catalog_items after_row on after_row.workspace_id=before_row.workspace_id and after_row.id=before_row.item_id where before_row.workspace_id=v_workspace and after_row.origin_type='workspace_custom' and jsonb_build_object('id',after_row.id,'standardOrderId',after_row.standard_order_id,'standardOrderName',after_row.standard_order_name,'inHospitalOrderName',after_row.in_hospital_order_name,'billingName',after_row.billing_name,'aliases',after_row.aliases,'availabilityStatus',after_row.availability_status,'priceKrw',after_row.price_krw,'salesUnit',after_row.sales_unit,'pricingRule',after_row.pricing_rule,'customizationState',after_row.customization_state,'customizedFields',after_row.customized_fields,'originType',after_row.origin_type,'sourceMasterRecordId',after_row.source_master_record_id,'sourceProjectionSnapshot',after_row.source_projection_snapshot,'sourceProjectionFingerprint',after_row.source_projection_fingerprint) is distinct from before_row.snapshot) then raise exception 'clinical_master_phase_c_custom_row_mutated:%',v_workspace; end if;
      if exists (select 1 from public.order_catalog_items custom_row join public.order_catalog_items master_item on master_item.workspace_id=custom_row.workspace_id and master_item.standard_order_name=custom_row.standard_order_name and master_item.origin_type='clair_master' join master.master_records master_row on master_row.id=master_item.source_master_record_id join cm_phase_c_payload_records payload_order on payload_order.master_key=master_row.master_key and payload_order.record_type='order' where custom_row.workspace_id=v_workspace and custom_row.origin_type='workspace_custom' and custom_row.availability_status='active' and master_item.availability_status='active') then raise exception 'clinical_master_phase_c_duplicate_active_choice:%',v_workspace; end if;
      execute 'set local role postgres';
      perform set_config('request.jwt.claim.sub',coalesce(nullif(v_original_sub,''),''),true);
      perform set_config('request.jwt.claims',coalesce(nullif(v_original_claims,''),'{}'),true);
    end loop;

    -- The legacy identity postcheck intentionally runs after every target
    -- workspace adopter/catalog/review RPC.  It is ID-anchored and includes
    -- normalized central owners, so an accidental source/name/species fork or
    -- an actor-wide review side effect cannot hide behind a stable item row.
    if exists (
      select 1
      from cm_phase_c_legacy_initial_before before_row
      left join public.order_catalog_items item on item.workspace_id=before_row.workspace_id and item.id=before_row.item_id
      left join master.master_records master_row on master_row.id=item.source_master_record_id and master_row.master_key='cm.order.consult.initial' and master_row.record_type='order'
      cross join lateral (
        select jsonb_build_object(
          'item',to_jsonb(item),
          'master',to_jsonb(master_row),
          'names',coalesce((select jsonb_agg(to_jsonb(name_row) order by name_row.language_code,name_row.name_kind,name_row.sort_order,name_row.id) from master.master_record_names name_row where name_row.master_record_id=master_row.id),'[]'::jsonb),
          'recordSources',coalesce((select jsonb_agg(jsonb_build_object('recordSource',to_jsonb(record_source_row),'source',to_jsonb(source_row)) order by record_source_row.source_id,record_source_row.assertion_scope) from master.master_record_sources record_source_row join master.master_sources source_row on source_row.id=record_source_row.source_id where record_source_row.master_record_id=master_row.id),'[]'::jsonb),
          'owners',jsonb_build_object(
            'order',coalesce((select to_jsonb(order_row) from master.orders order_row where order_row.master_record_id=master_row.id),'{}'::jsonb),
            'classificationPath',coalesce((select to_jsonb(path_row) from master.orders order_row join master.classification_paths path_row on path_row.id=order_row.classification_path_id where order_row.master_record_id=master_row.id),'{}'::jsonb),
            'clinicalAction',coalesce((select to_jsonb(action_row) from master.orders order_row join master.classification_paths path_row on path_row.id=order_row.classification_path_id join master.clinical_actions action_row on action_row.master_record_id=path_row.clinical_action_id where order_row.master_record_id=master_row.id),'{}'::jsonb),
            'chartGroup',coalesce((select to_jsonb(chart_row) from master.orders order_row join master.classification_paths path_row on path_row.id=order_row.classification_path_id join master.chart_groups chart_row on chart_row.master_record_id=path_row.chart_group_id where order_row.master_record_id=master_row.id),'{}'::jsonb),
            'taskRoute',coalesce((select to_jsonb(route_row) from master.orders order_row join master.classification_paths path_row on path_row.id=order_row.classification_path_id join master.task_routes route_row on route_row.master_record_id=path_row.task_route_id where order_row.master_record_id=master_row.id),'{}'::jsonb),
            'defaultSalesUnit',coalesce((select to_jsonb(unit_row) from master.orders order_row left join master.units unit_row on unit_row.master_record_id=order_row.default_sales_unit_id where order_row.master_record_id=master_row.id),'{}'::jsonb)
          ),
          'speciesLinks',coalesce((select jsonb_agg(jsonb_build_object('link',to_jsonb(link_row),'species',to_jsonb(species_row)) order by species_row.species_code,link_row.species_record_id) from master.order_species_links link_row join master.species species_row on species_row.master_record_id=link_row.species_record_id where link_row.order_record_id=master_row.id),'[]'::jsonb),
          'versions',coalesce((select jsonb_agg(to_jsonb(version_row) order by version_row.revision,version_row.id) from master.master_record_versions version_row where version_row.master_record_id=master_row.id),'[]'::jsonb),
          'updates',coalesce((select jsonb_agg(to_jsonb(update_row) order by update_row.created_at,update_row.id) from public.workspace_master_updates update_row where update_row.workspace_id=item.workspace_id and update_row.order_catalog_item_id=item.id),'[]'::jsonb),
          'notifications',coalesce((select jsonb_agg(to_jsonb(notification_row) order by notification_row.created_at,notification_row.id) from public.notification_events notification_row where notification_row.workspace_id=item.workspace_id and notification_row.source_entity_id in (select update_row.id::text from public.workspace_master_updates update_row where update_row.workspace_id=item.workspace_id and update_row.order_catalog_item_id=item.id)),'[]'::jsonb)
        ) as value
      ) legacy_snapshot
      where item.id is null or master_row.id is null or before_row.fingerprint<>encode(extensions.digest(convert_to(legacy_snapshot.value::text,'UTF8'),'sha256'),'hex')
    ) then raise exception 'clinical_master_phase_c_legacy_initial_surface_changed'; end if;
    if (select count(*) from cm_phase_c_legacy_initial_before)<>(select count(*) from public.order_catalog_items item join master.master_records master_row on master_row.id=item.source_master_record_id and master_row.master_key='cm.order.consult.initial' and master_row.record_type='order' where item.workspace_id=any(array['workspace-clinical-master-pilot-v1','workspace-clair-cheongdam','clair-demo']::text[])) then
      raise exception 'clinical_master_phase_c_legacy_initial_row_set_changed';
    end if;

    select count(*),encode(extensions.digest(convert_to(coalesce(jsonb_agg(to_jsonb(item) order by item.id),'[]'::jsonb)::text,'UTF8'),'sha256'),'hex') into v_catalog_count,v_catalog_fingerprint from public.order_catalog_items item where item.workspace_id='clair-foreign-demo';
    if v_catalog_count<>0 or v_catalog_fingerprint<>v_expected_foreign_fingerprint then raise exception 'clinical_master_phase_c_foreign_post_adoption_drift'; end if;
    if exists (select 1 from clinical_master_operational_v3_phase_c_foreign_before expected_row where expected_row.table_name='order_catalog_items' and (expected_row.row_count<>(select count(*) from public.order_catalog_items where workspace_id='clair-foreign-demo') or expected_row.fingerprint<>(select encode(extensions.digest(convert_to(coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.id),'[]'::jsonb)::text,'UTF8'),'sha256'),'hex') from public.order_catalog_items row_data where row_data.workspace_id='clair-foreign-demo'))) then raise exception 'clinical_master_phase_c_foreign_surface_drift:order_catalog_items'; end if;
    if exists (select 1 from clinical_master_operational_v3_phase_c_foreign_before expected_row where expected_row.table_name='lab_test_items' and (expected_row.row_count<>(select count(*) from public.lab_test_items where workspace_id='clair-foreign-demo') or expected_row.fingerprint<>(select encode(extensions.digest(convert_to(coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.id),'[]'::jsonb)::text,'UTF8'),'sha256'),'hex') from public.lab_test_items row_data where row_data.workspace_id='clair-foreign-demo'))) then raise exception 'clinical_master_phase_c_foreign_surface_drift:lab_test_items'; end if;
    if exists (select 1 from clinical_master_operational_v3_phase_c_foreign_before expected_row where expected_row.table_name='lab_test_item_versions' and (expected_row.row_count<>(select count(*) from public.lab_test_item_versions where workspace_id='clair-foreign-demo') or expected_row.fingerprint<>(select encode(extensions.digest(convert_to(coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.lab_test_item_id,row_data.workspace_result_revision),'[]'::jsonb)::text,'UTF8'),'sha256'),'hex') from public.lab_test_item_versions row_data where row_data.workspace_id='clair-foreign-demo'))) then raise exception 'clinical_master_phase_c_foreign_surface_drift:lab_test_item_versions'; end if;
    if exists (select 1 from clinical_master_operational_v3_phase_c_foreign_before expected_row where expected_row.table_name='order_catalog_lab_test_item_links' and (expected_row.row_count<>(select count(*) from public.order_catalog_lab_test_item_links where workspace_id='clair-foreign-demo') or expected_row.fingerprint<>(select encode(extensions.digest(convert_to(coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.id),'[]'::jsonb)::text,'UTF8'),'sha256'),'hex') from public.order_catalog_lab_test_item_links row_data where row_data.workspace_id='clair-foreign-demo'))) then raise exception 'clinical_master_phase_c_foreign_surface_drift:order_catalog_lab_test_item_links'; end if;
    if exists (select 1 from clinical_master_operational_v3_phase_c_foreign_before expected_row where expected_row.table_name='workspace_master_updates' and (expected_row.row_count<>(select count(*) from public.workspace_master_updates where workspace_id='clair-foreign-demo') or expected_row.fingerprint<>(select encode(extensions.digest(convert_to(coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.id),'[]'::jsonb)::text,'UTF8'),'sha256'),'hex') from public.workspace_master_updates row_data where row_data.workspace_id='clair-foreign-demo'))) then raise exception 'clinical_master_phase_c_foreign_surface_drift:workspace_master_updates'; end if;
    if exists (select 1 from clinical_master_operational_v3_phase_c_foreign_before expected_row where expected_row.table_name='workspace_lab_item_updates' and (expected_row.row_count<>(select count(*) from public.workspace_lab_item_updates where workspace_id='clair-foreign-demo') or expected_row.fingerprint<>(select encode(extensions.digest(convert_to(coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.id),'[]'::jsonb)::text,'UTF8'),'sha256'),'hex') from public.workspace_lab_item_updates row_data where row_data.workspace_id='clair-foreign-demo'))) then raise exception 'clinical_master_phase_c_foreign_surface_drift:workspace_lab_item_updates'; end if;
    if exists (select 1 from clinical_master_operational_v3_phase_c_foreign_before expected_row where expected_row.table_name='workspace_lab_catalog_updates' and (expected_row.row_count<>(select count(*) from public.workspace_lab_catalog_updates where workspace_id='clair-foreign-demo') or expected_row.fingerprint<>(select encode(extensions.digest(convert_to(coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.id),'[]'::jsonb)::text,'UTF8'),'sha256'),'hex') from public.workspace_lab_catalog_updates row_data where row_data.workspace_id='clair-foreign-demo'))) then raise exception 'clinical_master_phase_c_foreign_surface_drift:workspace_lab_catalog_updates'; end if;
    if exists (select 1 from clinical_master_operational_v3_phase_c_foreign_before expected_row where expected_row.table_name='notification_events' and (expected_row.row_count<>(select count(*) from public.notification_events where workspace_id='clair-foreign-demo') or expected_row.fingerprint<>(select encode(extensions.digest(convert_to(coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.id),'[]'::jsonb)::text,'UTF8'),'sha256'),'hex') from public.notification_events row_data where row_data.workspace_id='clair-foreign-demo'))) then raise exception 'clinical_master_phase_c_foreign_surface_drift:notification_events'; end if;
    if exists (select 1 from clinical_master_operational_v3_phase_c_foreign_before expected_row where expected_row.table_name='notification_user_states' and (expected_row.row_count<>(select count(*) from public.notification_user_states where workspace_id='clair-foreign-demo') or expected_row.fingerprint<>(select encode(extensions.digest(convert_to(coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.notification_id,row_data.state_scope_id),'[]'::jsonb)::text,'UTF8'),'sha256'),'hex') from public.notification_user_states row_data where row_data.workspace_id='clair-foreign-demo'))) then raise exception 'clinical_master_phase_c_foreign_surface_drift:notification_user_states'; end if;
    if exists (select 1 from clinical_master_operational_v3_phase_c_foreign_before expected_row where expected_row.table_name='audit_events' and (expected_row.row_count<>(select count(*) from public.audit_events where workspace_id='clair-foreign-demo') or expected_row.fingerprint<>(select encode(extensions.digest(convert_to(coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.id),'[]'::jsonb)::text,'UTF8'),'sha256'),'hex') from public.audit_events row_data where row_data.workspace_id='clair-foreign-demo'))) then raise exception 'clinical_master_phase_c_foreign_surface_drift:audit_events'; end if;
  end if;

  -- Public RPC rehearsal runs as the selected authenticated admin only for
  -- the call itself. Restore the caller role/claims before the outer rollback.
  execute 'set local role postgres';
  perform set_config('request.jwt.claim.sub',coalesce(nullif(v_original_sub,''),''),true);
  perform set_config('request.jwt.claims',coalesce(nullif(v_original_claims,''),'{}'),true);

  select count(*) into v_after_audit_count from public.audit_events;
  select encode(extensions.digest(convert_to(coalesce(jsonb_agg(to_jsonb(audit_row) order by audit_row.id),'[]'::jsonb)::text,'UTF8'),'sha256'),'hex') into v_after_audit_fingerprint from public.audit_events audit_row;
  insert into clinical_master_operational_v3_phase_c_state values('audit_after',jsonb_build_object('beforeCount',v_before_audit_count,'afterCount',v_after_audit_count,'beforeFingerprint',v_before_audit_fingerprint,'afterFingerprint',v_after_audit_fingerprint,'evidenceMode','optional workspace review ledgers plus exact foreign audit fingerprint; fresh lab definitions may be auto-created without lab ledgers; adoption/catalog/review RPCs do not emit public.audit_events','foreignFingerprintVerified',v_scope<>'full' or not exists (select 1 from clinical_master_operational_v3_phase_c_foreign_before where table_name='audit_events')));
  perform setval(v_release_sequence,v_sequence_restore_last_value,v_sequence_restore_is_called);
  execute format('select last_value,is_called from %s',v_release_sequence) into v_before_release_sequence_last_value,v_before_release_sequence_is_called;
  if v_before_release_sequence_last_value<>v_sequence_restore_last_value or v_before_release_sequence_is_called is distinct from v_sequence_restore_is_called then raise exception 'clinical_master_phase_c_release_sequence_restore_failed'; end if;
  raise notice 'clinical_master_operational_v3_phase_c_rehearsal_ok scope=% release_no=% record_count=% source_fingerprint=%',v_scope,v_release_no,(v_publish_result->>'recordCount'),v_release_fingerprint;
  exception
    when query_canceled then
      perform setval(v_release_sequence,v_sequence_restore_last_value,v_sequence_restore_is_called);
      raise;
    when others then
      perform setval(v_release_sequence,v_sequence_restore_last_value,v_sequence_restore_is_called);
      raise;
  end;
end
$phase_c$;

rollback;
select 'clinical_master_operational_v3_phase_c_rollback_ok' as replay_result;
