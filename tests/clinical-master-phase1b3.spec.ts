import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const migrationPath =
  "supabase/migrations/20260820140000_clinical_master_phase1b3_chart_set_runtime.sql";
const replayPath = "supabase/snippets/clinical_master_phase1b3_replay.sql";
const fixturePath = "tests/fixtures/clinical-master-phase1b3.fixture.json";

const migration = readFileSync(migrationPath, "utf8");
const replay = readFileSync(replayPath, "utf8");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as {
  releaseKey: string;
  workspaceId: string;
  encounterId: string;
  actorUserId: string;
  sets: Array<{
    id: string;
    amountBasis: string;
    rangeBasis?: string;
    rangeInput?: number;
    expectedBracket?: {
      lowerBound: number;
      upperBound: number | null;
      priceKrw: number;
    };
    billing: { parent: boolean; child: boolean };
  }>;
  quantityCases: number[];
  snapshotSchemaVersion: number;
  regressionCases: {
    fourObjectIntegrity: boolean;
    crossFieldTamperRejected: boolean;
    reconciliationHashUpdates: boolean;
    explicitExtraInvoicePrecedence: boolean;
    nonbillableBilledAs: string;
    fixedOneOverrideRejected: boolean;
    maxTransactionalRows: number;
    roundingAuthority: string;
    billSkipsNonbillable: boolean;
    taxSnapshotParity: boolean;
    schemaZeroIndividualRefresh: boolean;
    nestedConfirmationGuards: string[];
    semanticPreflight: boolean;
  };
};

test("B3 fixture is synthetic and covers the approved fixed/sum/range matrix", () => {
  expect(fixture.releaseKey).toBe("phase1b3-chart-set-runtime-v1");
  expect(fixture.workspaceId).toBe("clair-demo");
  expect(fixture.actorUserId).toBe("00000000-0000-4000-8000-000000000001");
  expect(fixture.sets.map((item) => item.id)).toEqual([
    "b2-replay-sum",
    "b2-replay-fixed",
    "b2-replay-range",
  ]);
  expect(fixture.sets.map((item) => item.amountBasis)).toEqual([
    "included_order_sum",
    "set_fixed_price",
    "range_price",
  ]);
  expect(fixture.sets[0]?.billing).toEqual({ parent: false, child: true });
  expect(fixture.sets[1]?.billing).toEqual({ parent: true, child: false });
  expect(fixture.sets[2]?.billing).toEqual({ parent: true, child: false });
  expect(fixture.sets[2]).toMatchObject({
    rangeBasis: "patient_weight_kg",
    rangeInput: 5,
    expectedBracket: { lowerBound: 5, upperBound: null, priceKrw: 1500 },
  });
  expect(fixture.quantityCases).toEqual([0.001, 1, 1.0, 1.0]);
  expect(fixture.snapshotSchemaVersion).toBe(1);
  expect(fixture.regressionCases).toEqual({
    fourObjectIntegrity: true,
    crossFieldTamperRejected: true,
    reconciliationHashUpdates: true,
    explicitExtraInvoicePrecedence: true,
    nonbillableBilledAs: "nonbillable_parent",
    fixedOneOverrideRejected: true,
    maxTransactionalRows: 100,
    roundingAuthority: "a3_catalog",
    billSkipsNonbillable: true,
    taxSnapshotParity: true,
    schemaZeroIndividualRefresh: true,
    nestedConfirmationGuards: ["unavailable", "review", "revision"],
    semanticPreflight: true,
  });
});

test("B3 migration owns tenant-safe lineage, snapshots, precision, and one-level expansion", () => {
  for (const token of [
    "source_set_revision_id uuid",
    "source_set_revision_no integer",
    "source_set_revision_item_id uuid",
    "applied_snapshot_schema_version integer not null default 0",
    "applied_snapshot_sha256 text",
    "order_set_revision_items_workspace_id_key",
    "orders_source_set_revision_workspace_fk",
    "orders_source_set_revision_item_workspace_fk",
    "references public.order_set_revision_items(workspace_id, id)",
    "orders_set_child_parent_lineage_trg",
    "clinical_master_b3_preflight_confirmed_set_unresolved",
    "clinical_master_b3_preflight_legacy_set_draft_unresolved",
    "clinical_master_b3_revision_item_workspace_key_collision",
    "clinical_master_b3_quantity_precision_conflict",
    "alter column quantity type numeric(12,3)",
    "orders_b3_snapshot_schema_check",
    "private.clair_b3_sha256(jsonb)",
    "pg_get_constraintdef(c.oid)",
    "v_constraint_def = any (array[",
  ]) {
    expect(migration).toContain(token);
  }

  expect(migration).toContain("root_item.child_kind = 'order_set'");
  expect(migration).toContain("raise exception 'order_set_depth_exceeded'");
  expect(migration).toContain("raise exception 'order_set_duplicate_atomic'");
  expect(migration).toContain(
    "raise exception 'order_set_parent_lineage_invalid'",
  );
  expect(migration).toContain("raise exception 'order_set_leaf_path_invalid'");
  expect(migration).toContain(
    "set_item_id = source_set_revision_item_id::text",
  );
  expect(migration).toContain(
    "on delete restrict deferrable initially deferred",
  );

  const preflightStart = migration.indexOf("-- The preflight");
  const preflightEnd = migration.indexOf(
    "alter table public.orders",
    preflightStart,
  );
  expect(preflightStart).toBeGreaterThanOrEqual(0);
  expect(preflightEnd).toBeGreaterThan(preflightStart);
  const preflight = migration.slice(preflightStart, preflightEnd);
  expect(preflight).toContain("row_type in ('set', 'set_child')");
  expect(preflight).toContain(
    "order_confirmation_status in ('draft', 'pending')",
  );
  expect(preflight).toContain("applied_snapshot->>'sourceSetRevisionId'");
  expect(preflight).toContain("applied_snapshot_schema_version");
  expect(preflight).toContain("applied_snapshot_sha256");
  expect(preflight).toContain("pg_get_constraintdef(c.oid)");
  expect(preflight).toContain("v_constraint_def = any (array[");
  expect(preflight).toContain("v_constraint_deferrable");
  expect(preflight).not.toMatch(/v_constraint_def\s+(?:not\s+)?like\b/i);
  expect(preflight).not.toMatch(/v_constraint_def\s+ilike\b/i);
});

test("B3 runtime derives selection, quantity, price, and frozen four-object hashes server-side", () => {
  for (const token of [
    "private.clair_b3_expand_chart_order_set(",
    "public.clair_preview_chart_order_set(",
    "'selectionFingerprint', v_fingerprint",
    "'quantitySource', v_quantity_source",
    "private.clair_round_catalog_order_amount(",
    "'roundingRule', v_rounding_rule",
    "'appliedSnapshot', v_parent_snapshot",
    "'appliedPriceSnapshot', v_parent_price_snapshot",
    "'calculationInputs', v_parent_calc_inputs",
    "'calculationOutputs', v_parent_calc_outputs",
    "applied_snapshot_sha256",
    "private.clair_b3_sha256(jsonb_build_object(",
    "'billingCategory', 'other'",
    "'billedAs', case when (v_preview -> 'set' ->> 'amountBasis') = 'included_order_sum'",
  ]) {
    expect(migration).toContain(token);
  }

  expect(migration).toContain(
    "v_quantity := pg_catalog.trim_scale(v_quantity::numeric(12,3))",
  );
  expect(migration).toContain("lower_bound <= v_range_input");
  expect(migration).toContain("v_range_input < upper_bound");
  expect(migration).toContain("raise exception 'order_set_range_no_match'");
  expect(migration).toContain("p_selection_intent -> 'items'");
  expect(migration).not.toContain("mergeCatalogSnapshotRows");
  expect(replay).toContain(
    "clinical_master_phase1b3_regression_four_object_envelope_invalid",
  );
  expect(replay).toContain(
    "clinical_master_phase1b3_regression_cross_field_tamper_accepted",
  );
  expect(replay).toContain(
    "clinical_master_phase1b3_regression_reconciliation_hash_invalid",
  );
  expect(replay).toContain(
    "clinical_master_phase1b3_regression_invoice_parent_line_total_invalid",
  );
  expect(replay).toContain(
    "clinical_master_phase1b3_regression_nonblank_set_draft_failed",
  );
});

test("B3 draft/action boundaries enforce ETag CAS, terminal retry, and parent-only action selection", () => {
  for (const token of [
    "public.clair_get_chart_order_draft(",
    "public.clair_save_chart_order_draft(",
    "public.clair_get_chart_order_actions(",
    "public.clair_save_chart_order_action(",
    "raise exception 'if_match_required'",
    "raise exception 'revision_conflict'",
    "raise exception 'idempotency_conflict'",
    "raise exception 'invalid_order_selection'",
    "event.payload ->> 'selectionFingerprint'",
    "event.payload ->> 'snapshotHash'",
    "return jsonb_build_object(",
    "'stored', true",
    "'stored', false",
  ]) {
    expect(migration).toContain(token);
  }

  expect(migration).toContain(
    "grant execute on function public.clair_save_chart_order_action(text,uuid,uuid,text,uuid[],text)\n  to authenticated",
  );
  expect(migration).not.toContain("create table public.idempotency");
  expect(migration).not.toContain(
    "create table public.order_set_runtime_ledger",
  );
  expect(replay).toContain(
    "clinical_master_phase1b3_regression_fixed_one_override_accepted",
  );
  expect(replay).toContain(
    "clinical_master_phase1b3_regression_over_100_partial_write",
  );
  expect(replay).toContain(
    "clinical_master_phase1b3_regression_nonbillable_bill_candidate_invalid",
  );
  expect(replay).toContain(
    "clinical_master_phase1b3_regression_non_taxable_invoice_parity_failed",
  );
  expect(replay).toContain(
    "clinical_master_phase1b3_regression_individual_catalog_refresh_invalid",
  );
  expect(replay).toContain(
    "clinical_master_phase1b3_regression_rounding_snapshot_invalid",
  );
  expect(replay).toContain(
    "clinical_master_phase1b3_regression_mixed_rounding_aggregate_invalid",
  );
  expect(replay).toContain(
    "clinical_master_phase1b3_regression_parent_child_frozen_tamper_accepted",
  );
  expect(replay).toContain(
    "clinical_master_phase1b3_regression_child_frozen_tamper_accepted",
  );
  expect(replay).toContain(
    "clinical_master_phase1b3_regression_child_frozen_tamper_transaction_invalid",
  );
  expect(replay).toContain(
    "clinical_master_phase1b3_regression_child_selection_removed_invalid",
  );
  expect(replay).toContain(
    "clinical_master_phase1b3_regression_child_selection_removed_lineage_invalid",
  );
  expect(replay).toContain(
    "clinical_master_phase1b3_regression_child_selection_restore_invalid",
  );
  expect(replay).toContain(
    "clinical_master_phase1b3_regression_multi_set_over_100_partial_write",
  );
  expect(replay).toContain(
    "clinical_master_phase1b3_regression_frozen_set_mutation_failed",
  );
  expect(replay).toContain(
    "clinical_master_phase1b3_regression_frozen_catalog_mutation_failed",
  );
  expect(replay).toContain(
    "clinical_master_phase1b3_regression_nested_valid_reapply_failed",
  );
  expect(replay).toContain("public.clair_save_order_set_revision(");
  expect(replay).toContain("public.clair_resolve_order_set_update_review(");
  expect(replay).toContain("b3-regression-nested-child-reapply");
});

test("B3 replay is an executable transaction using B2 native revisions only", () => {
  expect(replay).toContain("\\set ON_ERROR_STOP on");
  expect(replay).toContain("begin;");
  expect(replay).toContain("rollback;");
  expect(replay).toContain("b3_replay_cleanup_ok");
  expect(replay).not.toContain("commit;");
  expect(replay).toContain("public.clair_preview_chart_order_set(");
  expect(replay).toContain("public.clair_save_chart_order_draft(");
  expect(replay).toContain("public.clair_save_chart_order_action(");
  expect(replay).toContain("b2-replay-sum");
  expect(replay).toContain("b2-replay-fixed");
  expect(replay).toContain("b2-replay-range");
  expect(replay).toContain("'rangeInput', 5");
  expect(replay).toContain(
    "clinical_master_phase1b3_replay_terminal_retry_invalid",
  );
  expect(replay).toContain(
    "clinical_master_phase1b3_replay_bill_retry_invalid",
  );
  expect(replay).toContain(
    "clinical_master_phase1b3_replay_tampered_preview_accepted",
  );
  expect(replay).toContain(
    "clinical_master_phase1b3_replay_stale_etag_accepted",
  );
  expect(replay).toContain(
    "clinical_master_phase1b3_replay_cross_workspace_preview_accepted",
  );
  expect(replay).toContain(
    "clinical_master_phase1b3_regression_multi_set_over_100_accepted",
  );
  expect(replay).toContain(
    "clinical_master_phase1b3_regression_parent_child_frozen_tamper_transaction_invalid",
  );
  expect(replay).toContain("private.clair_b3_sha256(jsonb_build_object(");
  expect(replay).not.toMatch(/insert\s+into\s+public\.order_set_items/i);
  expect(replay).not.toMatch(
    /SUPABASE_(SERVICE_ROLE|ANON)_KEY|BEGIN\s+PRIVATE\s+KEY/i,
  );
});
