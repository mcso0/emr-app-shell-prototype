import { expect, test } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";

import { createMockOrderCatalogGateway } from "../src/features/hospital-admin/server-order-catalog-core";

const migrationPath = "supabase/migrations/20260820100000_clinical_master_phase1b2_order_set_revisions.sql";
const replayPath = "supabase/snippets/clinical_master_phase1b2_replay.sql";
const seedPath = "supabase/seed.sql";
const migration = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";
const replay = existsSync(replayPath) ? readFileSync(replayPath, "utf8") : "";
const seed = existsSync(seedPath) ? readFileSync(seedPath, "utf8") : "";

test("B2 migration has immutable tenant-scoped revision and child-pin invariants", () => {
  expect(migration).toContain("order_set_revisions_workspace_order_set_revision_no_key");
  expect(migration).toContain("order_sets_current_revision_same_set_fk");
  expect(migration).toContain("order_set_revision_items_child_revision_fk");
  expect(migration).toContain("order_set_revision_items_child_set_fk");
  expect(migration).toContain("order_set_revision_integrity_deferred");
  expect(migration).toContain("order_set_revision_nested_depth_exceeded");
  expect(migration).toContain("legacy_fixed_tax_unset");
  expect(migration).toContain("legacy_duplicate_atomic");
  expect(migration).toContain("clinical_master_workspace_adoption:");
  expect(migration).toContain("clair_update_order_catalog_item_a2_unlocked");
  expect(migration).toContain("clair_mark_order_set_composition_review_for_catalog_member");
  expect(migration).toContain("clair_mark_order_set_composition_review_for_child_set");
});

test("B2 range and price contract is explicit and atomic-only chart search remains", () => {
  expect(migration).toContain("patient_weight_kg");
  expect(migration).toContain("manual_value");
  expect(migration).toContain("v_lower <> 0");
  expect(migration).toContain("v_seen_open");
  expect(migration).toContain("appliedPriceKrw', item.price_krw");
  expect(migration).not.toContain("union all\n  select 'set'");
  expect(migration).toContain("drop function if exists public.clair_list_order_catalog_chart_search(text)");
  expect(migration).toContain("from public.order_catalog_items item");
  expect(migration).not.toContain("from public.order_sets set_row");
  expect(migration).toContain("order_set_notification_writer_required");
});

test("B2 replay and native seed use transaction-safe adapter ownership", () => {
  expect(replay).toContain("B2_REPLAY_LEGACY_PREPARE");
  expect(replay).toContain("B2_REPLAY_LEGACY_VERIFY");
  expect(replay).toContain("b2-replay-legacy-empty-active");
  expect(replay).toContain("b2-replay-legacy-empty-inactive");
  expect(replay).toContain("b2-replay-legacy-fixed-one-qty");
  expect(replay).toContain("b2-replay-legacy-valid-sum-multi");
  expect(replay).toContain("b2_replay_legacy_reapply_ok");
  expect(replay).toContain("b2_replay_legacy_cleanup_ok");
  expect(replay).toContain("begin;");
  expect(replay).toContain("rollback;");
  expect(replay).toContain("private.clair_seed_order_set_compatibility_projection(");
  expect(replay).toContain("b2_replay_idempotency_failed");
  expect(replay).toContain("b2_replay_duplicate_revision");
  expect(seed).toContain("clair_seed_order_set_compatibility_projection");
  expect(seed).not.toContain("insert into public.order_set_items");
});

test("B2 replay contains executable review, legacy, CAS, and ACL oracles", () => {
  for (const assertion of [
    "b2_replay_review_v2_supersession_failed",
    "b2_replay_review_accept_pin_or_resolution_failed",
    "b2_replay_review_dismiss_failed",
    "b2_replay_review_parent_edit_superseded_failed",
    "b2_replay_review_paused_obsolete_terminal_retry_failed",
    "b2_replay_review_inactive_obsolete_terminal_retry_failed",
    "b2_replay_false_root_selected_contract_missing",
    "b2_replay_empty_nested_selected_contract_missing",
    "b2_replay_inactive_invalid_history_pointer_changed",
    "b2_replay_inactive_invalid_order_set_definition_failed",
    "b2_replay_legacy_original_evidence_failed",
    "b2_replay_legacy_quarantine_artifact_failed",
    "b2_replay_legacy_fixed_one_original_item_evidence_failed",
    "b2_replay_legacy_valid_sum_multi_item_evidence_failed",
    "legacy_replay_payload_mismatch",
    "b2_replay_save_exact_retry_changed",
    "b2_replay_save_cas_guard_failed",
    "b2_replay_authenticated_direct_dml_acl_leak",
    "b2_replay_cleanup_ok",
  ]) {
    expect(replay).toContain(assertion);
  }
  expect(replay).toContain("public.clair_list_order_sets(");
  expect(replay).toContain("public.clair_get_order_set(");
  expect(replay).toContain("has_table_privilege('authenticated'");
});

test("mock gateway exposes read-only Order Set management projection", async () => {
  const gateway = createMockOrderCatalogGateway({ workspaceId: "clair-demo" });
  const result = await gateway.listOrderSets({ workspaceId: "clair-demo" });
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.summaries.every((summary) => summary.currentRevisionId === null)).toBe(true);
  expect(result.summaries.every((summary) => summary.pendingReviewCount === 0)).toBe(true);
});
