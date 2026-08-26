import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const migrationPath =
  "supabase/migrations/20260826150000_clinical_master_dispensing_order_foundation.sql";
const replayPath =
  "supabase/snippets/clinical_master_dispensing_order_foundation_replay.sql";

const migration = readFileSync(migrationPath, "utf8");
const replay = readFileSync(replayPath, "utf8");

test("PR-017 adds the normalized dispensing foundation, lineage, and reconciled queue read model", () => {
  for (const table of [
    "master.medication_ingredients",
    "master.evidence_documents",
    "master.medication_products",
    "master.medication_product_ingredients",
    "master.medication_species_applicability",
    "master.medication_product_handling",
    "master.dispensing_order_profiles",
    "master.evidence_assertions",
    "master.clinical_reviews",
    "master.medication_regulatory_profiles",
    "private.clinical_master_dispensing_release_payloads",
    "private.clinical_master_dispensing_species_override_events",
  ]) {
    expect(migration).toContain(`create table if not exists ${table}`);
    expect(migration).toContain(
      `alter table ${table} enable row level security`,
    );
  }

  for (const column of [
    "source_dispensing_profile_id",
    "source_dispensing_profile_revision",
    "source_medication_product_id",
    "source_medication_product_revision",
    "source_clinical_review_id",
    "source_evidence_fingerprint",
    "clinical_use_allowed",
    "dispensing_profile_snapshot",
    "dispensing_profile_snapshot_sha256",
  ]) {
    expect(migration).toContain(`add column if not exists ${column}`);
  }

  expect(migration).toContain("set lock_timeout = '5s'");
  expect(migration).toContain("set statement_timeout = '120s'");
  expect(migration).toContain(
    "create or replace function public.clair_list_fulfillment_work_items",
  );
  expect(migration).toContain("'patientId', encounter.patient_id");
  expect(migration).toContain("'taskStatus', task.status");
  expect(migration).toContain("left join public.order_tasks task");
  expect(migration).toContain("not valid");
  expect(migration).toContain(
    "validate constraint order_catalog_items_dispensing_lineage_check",
  );
  expect(migration).not.toMatch(/\bcreate\s+policy\b/i);
  const inserts = migration.match(/\binsert\s+into\s+[^\s(]+/gi) ?? [];
  expect(inserts).toEqual([
    "insert into private.clinical_master_dispensing_species_override_events",
  ]);
  expect(migration).not.toMatch(/\bdelete\s+from\b/i);
  expect(migration).not.toMatch(/\btruncate\b/i);
  expect(migration).not.toMatch(/\bdrop\s+table\b/i);
});

test("clinical use is server-computed from exact review, evidence, regulatory, translation, and lineage gates", () => {
  const predicateStart = migration.indexOf(
    "create or replace function master.clair_dispensing_profile_clinical_use_allowed",
  );
  const predicateEnd = migration.indexOf(
    "create or replace function master.reject_dispensing_master_mutation",
    predicateStart,
  );
  expect(predicateStart).toBeGreaterThanOrEqual(0);
  expect(predicateEnd).toBeGreaterThan(predicateStart);
  const predicate = migration.slice(predicateStart, predicateEnd);

  for (const token of [
    "profile.lifecycle_status = 'approved'",
    "profile.korean_translation_review_status = 'approved'",
    "product.lifecycle_status = 'approved'",
    "product.korean_review_status = 'approved'",
    "order_record.lifecycle_status = 'published'",
    "order_record.safety_status = 'normal'",
    "review.decision = 'approved'",
    "review.reviewer_eligibility ->> 'eligible' = 'true'",
    "later_review.supersedes_review_id = review.id",
    "regulatory.jurisdiction = 'KR'",
    "regulatory.authorization_status = 'approved'",
    "regulatory.controlled_status = 'not_controlled'",
    "ingredient.pairing_status <> 'approved'",
    "ingredient.evidence_mode <> 'direct'",
    "species_link.evidence_mode = 'direct'",
    "assertion.evidence_mode = 'direct'",
    "assertion.extraction_status = 'approved'",
    "document.lifecycle_status = 'captured'",
    "('product.identity')",
    "('product.strength')",
    "('product.dosageForm')",
    "('product.route')",
    "('product.targetSpecies')",
    "('handling.storage')",
  ]) {
    expect(predicate).toContain(token);
  }

  expect(migration).toContain(
    "new.clinical_use_allowed := master.clair_dispensing_profile_clinical_use_allowed",
  );
  expect(migration).toContain(
    "raise exception 'clinical_master_dispensing_clinical_review_required'",
  );
  expect(migration).toContain(
    "raise exception 'clinical_master_dispensing_species_incompatible'",
  );
  expect(migration).toContain(
    "v_patient_species = any(v_catalog.target_species)",
  );
  expect(migration).toContain(
    "raise exception 'clinical_master_dispensing_route_incompatible'",
  );
  expect(predicate).toContain("profile.allowed_routes <@ product.routes");
  expect(predicate).toContain("pg_catalog.max(latest_regulatory.revision)");
  expect(migration).toContain(
    "clinical_master_dispensing_species_override_confirmation_required",
  );
  expect(migration).toContain(
    "clinical_master_dispensing_species_override_veterinarian_required",
  );
  expect(migration).toContain(
    "create or replace function private.clair_is_active_veterinarian_member",
  );
  expect(migration).toContain("membership.roles @> array['vet']::text[]");
  expect(migration).toContain("position.position_key = 'veterinarian'");
  expect(migration).toContain("'extraLabelSpeciesAttestation'");
  expect(migration).toContain("'extraLabelSpeciesConfirmed'");
  expect(migration).toContain("'extraLabelSpeciesReason'");
  expect(migration).toContain("workspace_extra_label_override");
  expect(migration).toContain(
    "private.clinical_master_dispensing_species_override_events",
  );
  expect(migration).toContain("when 'PO' then 'oral'");
  expect(migration).toContain(
    "raise exception 'clinical_master_dispensing_snapshot_fingerprint_mismatch'",
  );
  expect(migration).toContain(
    "create or replace function public.clair_list_order_catalog_chart_search_v2",
  );
  expect(migration).toContain("'dispensingLineage', jsonb_build_object(");
  expect(migration).toContain(
    "create or replace function private.clair_set_dispensing_order_lineage()",
  );
  expect(migration).toContain("orders_zz_dispensing_lineage_gate");
  expect(migration).toContain(
    "clinical_master_dispensing_confirmed_lineage_immutable",
  );
  expect(migration).toContain(
    "clinical_use_allowed boolean not null default false",
  );
});

test("master rows and release payloads are immutable and inaccessible to client roles", () => {
  expect(migration).toContain("clinical_master_dispensing_revision_immutable");
  expect(migration).toContain(
    "clinical_master_dispensing_release_payload_immutable",
  );
  expect(migration).toContain("before update or delete on master.%I");
  expect(migration).toContain(
    "before update or delete on private.clinical_master_dispensing_release_payloads",
  );
  expect(migration).toContain("from public, anon, authenticated, service_role");
  expect(migration).toContain(
    "revoke all on function private.clair_set_dispensing_catalog_gate()",
  );

  const gateStart = migration.indexOf(
    "create or replace function private.clair_set_dispensing_catalog_gate()",
  );
  const gateEnd = migration.indexOf(
    "drop trigger if exists order_catalog_items_dispensing_gate",
    gateStart,
  );
  const gate = migration.slice(gateStart, gateEnd);
  expect(gate).toContain("security definer");
  expect(gate).toContain("set search_path = ''");
  expect(gate).not.toContain("auth.uid()");
});

test("rollback replay covers false and true activation gates, tamper rejection, immutability, RLS, and ACL", () => {
  for (const token of [
    "\\ir ../migrations/20260826150000_clinical_master_dispensing_order_foundation.sql",
    "\\ir ../migrations/20260826152000_clinical_master_dispensing_fulfillment_history.sql",
    "begin;",
    "rollback;",
    "clinical_master_dispensing_pending_profile_gate_unexpectedly_open",
    "clinical_master_dispensing_approved_profile_gate_closed",
    "clinical_master_dispensing_pending_catalog_became_clinically_allowed",
    "clinical_master_dispensing_clinical_review_required",
    "clinical_master_dispensing_snapshot_fingerprint_mismatch",
    "clinical_master_dispensing_pending_order_accepted",
    "clinical_master_dispensing_species_override_non_veterinarian_accepted",
    "clinical_master_dispensing_species_override_veterinarian_required",
    "clinical_master_dispensing_extra_label_detail_schema_rejected",
    "clinical_master_dispensing_draft_lineage_missing",
    "clinical_master_dispensing_confirmed_lineage_immutable",
    "clinical_master_dispensing_revision_immutable",
    "clinical_master_dispensing_rls_missing",
    "clinical_master_dispensing_policy_present",
    "clinical_master_dispensing_acl_exposed",
    "clinical_master_dispensing_fulfillment_read_model_missing",
    "clinical_master_dispensing_fulfillment_history_scope_missing",
    "clinical_master_dispensing_order_foundation_replay_ok",
  ]) {
    expect(replay).toContain(token);
  }
});
