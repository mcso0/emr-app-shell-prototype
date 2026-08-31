import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260831070850_clinical_master_execution_preset_publisher_contract.sql",
  "utf8",
);

test("detail validation is wrapped additively and remains idempotent", () => {
  expect(migration).toContain(
    "clinical_master_assert_detail_keys_base(text,jsonb)",
  );
  expect(migration).toContain(
    "alter function private.clinical_master_assert_detail_keys(text, jsonb)",
  );
  expect(migration).toContain("rename to clinical_master_assert_detail_keys_base");
  expect(migration).toContain(
    "clinical_master_canonicalize_detail_base(text,jsonb)",
  );
  expect(migration).toContain(
    "rename to clinical_master_canonicalize_detail_base",
  );
  expect(migration).toContain("p_detail - 'executionPreset'");
  expect(migration).toContain(
    "create or replace function private.clinical_master_assert_detail_keys(",
  );
  expect(migration).toContain(
    "create or replace function private.clinical_master_canonicalize_detail(",
  );
});

test("executionPreset has an exact fail-closed envelope and canonical content hash", () => {
  for (const key of [
    "'presetId'",
    "'presetKey'",
    "'presetRevision'",
    "'clinicalOrderType'",
    "'detailSchemaVersion'",
    "'defaultDetailInputs'",
    "'fieldPolicies'",
    "'provenance'",
    "'presetStatus'",
    "'clinicalUseAllowed'",
    "'contentSha256'",
    "'sourceArtifactSha256'",
  ]) {
    expect(migration).toContain(key);
  }
  expect(migration).toContain(
    "from pg_catalog.jsonb_object_keys(v_execution_preset)",
  );
  expect(migration).toContain(
    ") <> pg_catalog.cardinality(v_required_keys)",
  );
  expect(migration).toContain("not (v_execution_preset ?& v_required_keys)");
  expect(migration).toContain(
    "clinical_master_execution_preset_unknown_field",
  );
  expect(migration).toContain(
    "clinical_master_execution_preset_scalar_types_invalid",
  );
  expect(migration).toContain(
    "jsonb_typeof(v_execution_preset -> 'clinicalUseAllowed') <> 'boolean'",
  );
  expect(migration).toContain(
    "v_clinical_use_allowed is distinct from false",
  );
  expect(migration).toContain("<> 'synthetic_unreviewed'");
  expect(migration).not.toContain("'synthetic_unreviewed', 'clinically_reviewed'");
  expect(migration).toContain(
    "'treatment', 'hospitalization', 'system_exam', 'other'",
  );
  expect(migration).toContain(
    "create or replace function private.clair_order_execution_preset_hash_content(",
  );
  expect(migration).toContain(
    "private.clinical_master_sha256(\n      private.clair_order_execution_preset_hash_content(v_execution_preset)",
  );
  expect(migration).toContain(
    "contentSha256 and DB-derived master lineage are excluded",
  );
});

test("master version projection derives revision and release and advances current", () => {
  expect(migration).toContain(
    "create or replace function private.clair_project_order_execution_preset_after_master_version()",
  );
  expect(migration).toContain(
    "after insert on master.master_record_versions",
  );
  expect(migration).toContain("new.master_record_id");
  expect(migration).toContain("new.revision");
  expect(migration).toContain("new.release_id");
  expect(migration).toContain(
    "insert into master.order_execution_presets (",
  );
  expect(migration).toContain(
    "insert into master.order_execution_preset_current (",
  );
  expect(migration).toContain("activated_in_release_id");
  expect(migration).toContain(
    "on conflict (order_record_id) do update",
  );
});

test("omitted lab dependencies keep their immutable latest revision pin", () => {
  expect(migration).toContain(
    "private.publish_clinical_master_release_cumulative(jsonb,uuid)",
  );
  expect(migration).toContain(
    "select coalesce(stage.effective_revision, latest.revision)",
  );
  expect(migration).toContain(
    "clinical_master_omitted_lab_dependency_revision_missing",
  );
  expect(migration).toContain(
    "clinical_master_cumulative_publisher_patch_anchor_missing",
  );
});

test("preset removal, same-or-older revision, and identity conflicts fail closed", () => {
  expect(migration).toContain("execution_preset_removal_forbidden");
  expect(migration).toContain(
    "clinical_master_execution_preset_revision_not_monotonic",
  );
  expect(migration).toContain(
    "clinical_master_execution_preset_identity_conflict",
  );
  expect(migration).toContain("clinical_master_execution_preset_id_conflict");
  expect(migration).toContain("clinical_master_execution_preset_key_conflict");
  expect(migration).toContain(
    "clinical_master_execution_preset_replacement_required",
  );
  expect(migration).toContain("v_current_id is distinct from v_preset_id");
  expect(migration).toContain("v_current_key is distinct from v_preset_key");
  expect(migration).toContain("v_preset_revision <= v_current_revision");
  expect(migration).toContain("v_preset_revision <= v_latest_identity_revision");
});

test("projection is private and does not mutate public order or billing rows", () => {
  expect(migration).toContain(
    "revoke all on function private.clair_project_order_execution_preset_after_master_version()",
  );
  expect(migration).toContain(
    "revoke all on function private.publish_clinical_master_release(jsonb, uuid)",
  );
  expect(migration).toContain(
    "revoke all on function private.clinical_master_assert_detail_keys(text, jsonb)",
  );
  expect(migration).toContain(
    "revoke all on function private.clinical_master_canonicalize_detail(text, jsonb)",
  );
  expect(migration).not.toMatch(/update\s+public\.orders\b/i);
  expect(migration).not.toMatch(/update\s+public\.order_fulfillment_work_items\b/i);
  expect(migration).not.toMatch(/update\s+public\.invoice_/i);
});
