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
  sets: Array<{
    amountBasis: string;
    id: string;
    billing: { child: boolean; parent: boolean };
  }>;
};

test("B3 migration owns tenant-safe set lineage and quantity precision", () => {
  expect(migration).toContain("order_set_revision_items_workspace_id_key");
  expect(migration).toContain(
    "foreign key (workspace_id, source_set_revision_item_id)\n  references public.order_set_revision_items(workspace_id, id)",
  );
  expect(migration).not.toContain(
    "source_set_revision_id, source_set_revision_item_id)",
  );
  expect(migration).toContain("alter column quantity type numeric(12,3)");
  expect(migration).toContain("clinical_master_b3_quantity_precision_conflict");
  expect(migration).toContain(
    "clinical_master_b3_invoice_quantity_precision_conflict",
  );
  expect(migration).toContain(
    "quantity_source in ('fixed_one', 'preset_quantity', 'manual_at_apply')",
  );
  expect(migration).toContain("quantity_source in (\n        'manual',");
  expect(migration).toContain("row_type = 'set' and order_type = 'set'");
  expect(migration).toContain(
    "row_type <> 'set' and order_type in ('dispensing', 'treatment', 'lab', 'imaging')",
  );
});

test("B3 search and expansion preserve NULL/zero/range semantics", () => {
  expect(migration).toContain(
    "public.clair_list_order_catalog_chart_search_v2(\n  p_workspace_id text",
  );
  expect(migration).toContain("s.availability_status = 'active'");
  expect(migration).toContain("s.needs_composition_review = false");
  expect(migration).toContain("r.validation_status = 'valid'");
  expect(migration).toContain("coalesce(ranges.price_ranges, '[]'::jsonb)");
  expect(migration).toContain("v_range_input");
  expect(migration).toContain(
    "upper_bound is null or v_range_input < upper_bound",
  );
  expect(migration).toContain("order_set_range_no_match");
  expect(migration).not.toContain("range_coverage_decision_pending");
  expect(migration).toContain("'priceKrw', v_leaf.price_krw");
  expect(migration).toContain("'setPriceKrw', v_set_price");
});

test("B3 preview/draft/action boundaries freeze the four-object envelope", () => {
  expect(migration).toContain(
    "public.clair_preview_chart_order_set(\n  workspace_id text,\n  encounter_id uuid,\n  set_id text,\n  revision_id uuid,\n  selection_intent jsonb",
  );
  expect(migration).toContain("'selectionIntent', v_canonical_selection");
  expect(migration).toContain(
    "'quantity', pg_catalog.trim_scale(\n            (entry.value ->> 'quantity')::numeric(12,3)",
  );
  expect(migration).toContain("'schemaVersion', 1");
  expect(migration).toContain("'appliedSnapshot', v_parent_snapshot");
  expect(migration).toContain(
    "'appliedPriceSnapshot', v_parent_price_snapshot",
  );
  expect(migration).toContain("'calculationInputs', v_parent_calc_inputs");
  expect(migration).toContain("'calculationOutputs', v_parent_calc_outputs");
  expect(migration).toContain("private.clair_b3_sha256(jsonb_build_object(");
  expect(migration).toContain("applied_snapshot_sha256");
  expect(migration).toContain("'billingCategory', 'other'");
  expect(migration).toContain(
    "'billedAs', case when (v_preview -> 'set' ->> 'amountBasis') = 'included_order_sum'",
  );
  expect(migration).toContain("'billedAs', 'atomic_child'");
});

test("B3 action retry checks stored event before mutable ETag CAS", () => {
  const terminalBlock = migration.slice(
    migration.indexOf("-- A confirmed row is a valid first bill transition."),
    migration.indexOf(
      "v_current_etag := private.clair_b3_order_draft_etag",
      migration.indexOf("-- A confirmed row is a valid first bill transition."),
    ),
  );
  expect(terminalBlock).toContain("event.payload ->> 'action' = p_action");
  expect(terminalBlock).toContain("selectionFingerprint");
  expect(terminalBlock).toContain("snapshotHash");
  expect(terminalBlock).toContain("is not distinct from");
  expect(terminalBlock).not.toContain("auditRequestId");
  expect(migration).toContain(
    "if p_expected_etag is distinct from v_current_etag then",
  );
  expect(migration).toContain("raise exception 'revision_conflict'");
});

test("B3 replay and fixture cover fixed, sum, active range, and retries", () => {
  expect(fixture.releaseKey).toBe("phase1b3-chart-set-runtime-v1");
  expect(fixture.sets.map((item) => item.amountBasis)).toEqual([
    "included_order_sum",
    "set_fixed_price",
    "range_price",
  ]);
  expect(fixture.sets[0]?.billing).toEqual({ parent: false, child: true });
  expect(fixture.sets[1]?.billing).toEqual({ parent: true, child: false });
  expect(fixture.sets[2]?.billing).toEqual({ parent: true, child: false });
  expect(replay).toContain(
    "clinical_master_phase1b3_replay_required_rpc_missing",
  );
  expect(replay).toContain("'rangeInput', 5");
  expect(replay).toContain("b2_replay_range");
  expect(replay).toContain(
    "clinical_master_phase1b3_replay_terminal_retry_invalid",
  );
  expect(replay).toContain(
    "clinical_master_phase1b3_replay_bill_retry_invalid",
  );
});
