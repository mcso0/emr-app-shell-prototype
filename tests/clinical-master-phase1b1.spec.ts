import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

import fixtureJson from "./fixtures/clinical-master-phase1b1.fixture.json";

const migrationPath = "supabase/migrations/20260819172501_clinical_master_phase1b1_laboratory_slice.sql";
const migration = readFileSync(migrationPath, "utf8");
const replay = readFileSync("supabase/snippets/clinical_master_phase1b1_replay.sql", "utf8");
const activeFreeze = migration.slice(
  migration.lastIndexOf("create or replace function private.clair_create_lab_result_entry_for_confirmed_order("),
);
const activeDefinitionValidator = migration.slice(
  migration.lastIndexOf("create or replace function private.clair_assert_lab_result_definition_snapshot("),
);
const itemRoute = readFileSync("src/app/api/workspaces/[workspaceId]/lab-imaging/result-entries/route.ts", "utf8");
const sheetRoute = readFileSync("src/app/api/workspaces/[workspaceId]/lab-imaging/result-sheet-catalog/route.ts", "utf8");
const fixture = fixtureJson as {
  records: Array<{ masterKey: string; recordType: string; detail: Record<string, unknown> }>;
  labPanelItems: Array<{ panelMasterKey: string; testMasterKey: string; sortOrder: number; required: boolean }>;
  labOrderProfiles: Array<{ orderMasterKey: string; labPanelMasterKey: string | null; labTestMasterKey: string | null }>;
};

test("Phase 1B-1 fixture has one explicit panel with ordered numeric and text tests", () => {
  expect(fixture.records.filter((record) => record.recordType === "lab_test")).toHaveLength(2);
  expect(fixture.labPanelItems).toEqual([
    expect.objectContaining({ testMasterKey: "phase1b1.test.glucose", sortOrder: 0, required: true }),
    expect.objectContaining({ testMasterKey: "phase1b1.test.protein", sortOrder: 1, required: false }),
  ]);
  expect(fixture.labOrderProfiles).toEqual([
    expect.objectContaining({
      orderMasterKey: "phase1b1.order.metabolic",
      labPanelMasterKey: "phase1b1.panel.metabolic",
      labTestMasterKey: null,
    }),
  ]);
  expect(fixture.records.find((record) => record.masterKey === "phase1b1.input.text")?.detail).toMatchObject({
    valueKind: "text",
    supportsUnit: false,
  });
});

test("B1 migration keeps typed lineage, immutable versions, review targets, and server RPC boundaries", () => {
  for (const token of [
    "lab_test_item_versions",
    "workspace_lab_item_updates",
    "workspace_lab_catalog_updates",
    "clinical_master_lab_membership_source_fingerprint",
    "clair_adopt_lab_master_projection_to_workspace",
    "clair_update_workspace_lab_test_item",
    "clair_resolve_workspace_lab_definition_update",
    "clair_create_lab_result_entry_for_confirmed_order",
    "clair_save_lab_result_entry_v2",
    "clair_get_lab_result_entry",
    "source_projection_sha256",
    "pinned_workspace_result_revision",
    "snapshot_metadata_schema_version",
    "lab_result_entries_canonical_order_unique",
    "clinical_master_workspace_adoption:",
    "clinical_master_lab_vocabulary_publish_stage",
    "clinical_master_lab_test_publish_stage",
    "clinical_master_lab_panel_publish_stage",
    "clinical_master_lab_order_publish_stage",
    "labTestVocabulary",
    "resultInputTypeMasterRecordId",
    "canonicalUnitMasterRecordId",
    "result_definition_snapshot_sha256",
    "result_definition_snapshot_sha256 = case",
    "result_definition_snapshot_sha256 = private.clinical_master_sha256(v_entry.result_definition_snapshot)",
    "lab_test_items_saved_result_usage_sum_check",
    "owner_pinned_source_test_revision=v_item_update.source_master_revision",
    "source_projection_schema_version,source_projection_snapshot,source_projection_sha256",
    "v_catalog_revision_delta",
    "accepted_catalog",
    "v_overlap_item_target",
    "v_catalog_target_is_independent",
    "cascadeOnly",
    "v_applied_snapshot",
    "last_applied_lab_membership_projection_sha256=private.clinical_master_lab_membership_source_fingerprint(v_applied_snapshot)",
  ]) {
    expect(migration).toContain(token);
  }
  expect(migration).toContain("sourceOrdinal");
  expect(migration).toContain("effectiveSortOrder");
  expect(migration).toContain("result_definition_origin = 'canonical'");
  expect(migration).toContain("judgment='not_judged'");
  expect(migration).toContain("reference_range");
});

test("B1 replay is transaction-clean and proves the single order/result/work-item/billing unit", () => {
  expect(replay).toContain("\\set ON_ERROR_STOP on");
  expect(replay).toContain("begin;");
  expect(replay).toContain("rollback;");
  expect(replay).toContain("clinical_master_phase1b1_replay_cleanup_ok");
  expect(replay).toContain("lab-order:");
  expect(replay).toContain("clair_save_lab_result_entry_v2");
  expect(replay).toContain("clair_sync_fulfillment_work_items_from_orders");
  expect(replay).toContain("clair_sync_billing_invoice_candidates_from_fulfillment");
  expect(replay).toContain("direct_result_privilege_leaked");
  expect(replay).toContain("clinical_master_phase1b1_replay_retry_outcome_not_stored");
  expect(replay).toContain("clinical_master_phase1b1_replay_retry_after_review_not_idempotent");
  expect(replay).toContain("clinical_master_phase1b1_replay_empty_target_repin_failed");
  expect(replay).toContain("clinical_master_phase1b1_replay_targeted_metadata_refresh_failed");
  expect(replay).toContain("clinical_master_phase1b1_replay_omitted_owner_pin_missing");
  expect(replay).toContain("clinical_master_phase1b1_replay_four_stage_missing");
  expect(replay).toContain("clinical_master_phase1b1_replay_vocabulary_pin_missing");
  expect(replay).toContain("clinical_master_phase1b1_replay_vocabulary_revision_cascade_failed");
  expect(replay).toContain("clinical_master_phase1b1_replay_item_review_target_missing");
  expect(replay).toContain("clinical_master_phase1b1_replay_item_review_resolution_failed");
  expect(replay).toContain("clinical_master_phase1b1_replay_overlapping_catalog_review_target_missing");
  expect(replay).toContain("clinical_master_phase1b1_replay_item_first_branch_rollback");
  expect(replay).toContain("clinical_master_phase1b1_replay_overlapping_target_resolution_failed");
  expect(replay).toContain("clinical_master_phase1b1_replay_confirmation_after_overlap_failed");
  expect(replay).toContain("clinical_master_phase1b1_replay_historical_result_snapshot_changed");
  expect(replay).toContain("result_status='reviewed'");
  expect(replay).toContain("v_row_count <> 2");
  expect(replay).not.toMatch(/service[_-]?role|SUPABASE_SECRET|real patient/i);
});

test("B1 callable definition and replay assert ordinal-bound IDs, strict JSON types, and targeted shared-owner accept", () => {
  expect(activeFreeze).toContain(
    "format('lab-result-row:v1:%s:%s:%s',p_order_id::text,v_link.id::text,v_ordinal::text)",
  );
  expect(activeDefinitionValidator).toContain("jsonb_typeof(v_row->'ordinal')");
  expect(activeDefinitionValidator).toContain("jsonb_typeof(v_entry.result_definition_snapshot->'schemaVersion')");
  expect(activeDefinitionValidator).toContain("jsonb_typeof(v_row->'required')");
  expect(activeDefinitionValidator).toContain("jsonb_typeof(v_row->'referenceRange')");
  expect(replay).toContain("clinical_master_phase1b1_replay_callable_row_id_formula_failed");
  expect(replay).toContain("clinical_master_phase1b1_replay_json_type_string_accepted");
  expect(replay).toContain("clinical_master_phase1b1_replay_json_schema_version_string_accepted");
  expect(replay).toContain("clinical_master_phase1b1_replay_stale_item_target_accepted");
  expect(replay).toContain("clinical_master_phase1b1_replay_shared_owner_repin_leaked");
  expect(replay).toContain("v_catalog_update_id");
  expect(replay).toContain("v_branch_snapshot");
  expect(replay).toContain("v_branch_link_snapshot");
  expect(replay).toContain("item-first and catalog-first");
  expect(replay).toContain("phase1b1-lab-fixture-v5-member-removal");
  expect(replay).toContain("member_removal_item_first_catalog_revision_changed");
  expect(replay).toContain("member_removal_order_convergence_failed");
  expect(replay).toContain("member_removal_confirmation_failed");
});

test("B1 migration carries the real DB security, lineage, usage, and retry branches", () => {
  for (const token of [
    "lab_result_usage_classification_invalid",
    "classified_refs",
    "historical_unattributed_usage_residual",
    "service_catalog:manage",
    "master_record_versions",
    "labPanelMasterRevision",
    "labTestMasterRevision",
    "specimenMasterRevision",
    "clinical_master_lab_publish_stage",
    "clinical_master_lab_order_profile_reference_version_missing",
    "clinical_master_lab_panel_test_version_missing",
    "master_lab_tests_identity_guard",
    "master_lab_panels_identity_guard",
    "clinical_master_lab_test_identity_immutable",
    "clinical_master_lab_panel_identity_immutable",
    "(latest.snapshot-'revision') is distinct from",
    "snapshot_metadata_sha256",
    "p_target_link_ids is not null and cardinality(p_target_link_ids) > 0",
    "entry_request_id_conflict",
    "return v_existing.outcome",
    "result_status not in ('received','entered')",
    "revoke all on public.lab_result_entries, public.lab_result_entry_rows",
  ]) {
    expect(migration).toContain(token);
  }
});

test("B1 result routes use permission-first reads and canonical save RPCs", () => {
  expect(itemRoute).toContain("clair_save_lab_result_entry_v2");
  expect(itemRoute).toContain("expectedEntryWriteRevision");
  expect(itemRoute).toContain("requestId");
  expect(sheetRoute).toContain("lab:view");
  expect(sheetRoute).toContain("clair_get_lab_result_entry");
  expect(sheetRoute).toContain("lab-result-definition-snapshot-read");
  expect(sheetRoute).not.toContain("referenceRange:");
});
