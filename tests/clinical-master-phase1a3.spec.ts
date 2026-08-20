import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

import fixtureJson from "./fixtures/clinical-master-phase1a3.fixture.json";
import { mapCatalogCategoryToBillingCategory } from "../src/features/chart/server-order-action-persistence-core";

const migration = readFileSync(
  "supabase/migrations/20260819150622_clinical_master_phase1a3_order_authority.sql",
  "utf8",
);
const replay = readFileSync(
  "supabase/snippets/clinical_master_phase1a3_replay.sql",
  "utf8",
);
const draftSource = readFileSync(
  "src/features/chart/server-order-draft-persistence-core.ts",
  "utf8",
);
const actionSource = readFileSync(
  "src/features/chart/server-order-action-persistence-core.ts",
  "utf8",
);
const fulfillmentSource = readFileSync(
  "src/features/fulfillment/server-fulfillment-work-item-core.ts",
  "utf8",
);

const fixture = fixtureJson as {
  categoryMappings: Array<{
    billingCategory: "consultation" | "laboratory" | "imaging" | "dispensing" | "treatment" | "other";
    categoryGroup: "consultation" | "medication" | "treatment" | "lab" | "imaging" | "hospitalization" | "misc";
    uiLabel: string;
  }>;
  priceCases: Record<string, { billingReflectionEnabled: boolean; priceKrw: number | null }>;
  preflightBuckets: { fatal: string[]; tolerated: string[] };
  expected: Record<string, string | null>;
};

test("A3 SQL and TypeScript mirrors agree for all seven frozen billing categories", () => {
  expect(fixture.categoryMappings).toHaveLength(7);
  for (const row of fixture.categoryMappings) {
    expect(mapCatalogCategoryToBillingCategory(row.categoryGroup)).toBe(row.billingCategory);
  }

  expect(migration).toContain("private.clair_map_catalog_category_to_billing_category");
  for (const [source, target] of [
    ["consultation", "consultation"],
    ["medication", "dispensing"],
    ["treatment", "treatment"],
    ["lab", "laboratory"],
    ["imaging", "imaging"],
    ["hospitalization", "other"],
    ["misc", "other"],
  ]) {
    expect(migration).toContain(`when '${source}' then '${target}'`);
  }
  expect(migration).toContain("revoke all on function private.clair_map_catalog_category_to_billing_category(text)");
  expect(migration).not.toContain("grant execute on function private.clair_map_catalog_category_to_billing_category");
});

test("A3 fixture keeps non-billable NULL distinct from explicit billable zero", () => {
  expect(fixture.priceCases.nonBillableNull).toMatchObject({
    billingReflectionEnabled: false,
    priceKrw: null,
  });
  expect(fixture.priceCases.billableZero).toMatchObject({
    billingReflectionEnabled: true,
    priceKrw: 0,
  });
  expect(draftSource).toContain("unitPriceSnapshot: number | null");
  expect(actionSource).toContain("priceKrw: number | null");
  expect(fulfillmentSource).toContain("priceKrw?: number | null");
  expect(migration).toContain("'unitPriceSnapshot', o.unit_price_snapshot");
  expect(migration).not.toContain("coalesce(o.unit_price_snapshot, 0)");
});

test("A3 migration owns direct lineage, snapshot authority, set boundary, and wrapper call graph", () => {
  for (const token of [
    "workspace_catalog_item_id",
    "source_master_record_id",
    "source_master_revision",
    "workspace_catalog_revision",
    "orders_catalog_service_dual_check",
    "orders_catalog_snapshot_check",
    "orders_workspace_invoice_line_unique",
    "invoice_lines_workspace_order_unique",
    "unsupported_order_type",
    "clair_sync_billing_invoice_candidates_from_chart",
    "clair_sync_billing_invoice_candidates_from_fulfillment",
    "clair_update_fulfillment_work_item",
    "clair_sync_fulfillment_work_items_from_orders",
    "clair_assert_billing_surface_permission",
    "clair_sync_billing_invoice_candidates_internal",
    "invoice_anchor_conflict",
    "billable_price_required",
    "orders_workspace_catalog_item_fk",
    "invalid_order_rows",
    "taskRequired",
    "destinationModule",
  ]) {
    expect(migration).toContain(token);
  }
  expect(migration).toContain("drop function if exists public.clair_enrich_fulfillment_work_item_snapshots");
  expect(migration).toContain("pg_advisory_xact_lock");
  expect(migration).toContain("for update");
  expect(migration).toContain("status in ('issued','paid')");
  expect(migration).toContain("order_confirmation_status in ('confirmed','billed')");
  expect(migration).toContain("p_actor_user_id is distinct from auth.uid()");
  expect(migration).toContain("chart:update");
  expect(migration).toContain("lab:complete");
  expect(migration).toContain("set search_path = public, private, extensions, pg_temp");
  expect(migration).toContain("item.status = 'completed'");
  expect(migration).toContain("item.queue_type = item.order_type");
  expect(migration).toContain("jsonb_typeof(o.applied_snapshot->'taskRequired') = 'boolean'");
  expect(migration).toContain("o.workspace_catalog_item_id is null");
  expect(migration).toContain("price_text::numeric end < 0");
  expect(migration).toContain("v_numeric_pattern");
  expect(migration).toContain("v_quantity_max numeric := 9999");
  expect(migration).toContain("v_price_max numeric := 9999999999.99");
  expect(migration).toContain("order_catalog_items_rounding_rule_check");
  expect(migration).toContain("private.clair_round_catalog_order_amount");
  expect(migration).toContain("when 'ceil' then ceil(p_amount)::numeric(12,2)");
  expect(migration).toContain("when 'floor' then floor(p_amount)::numeric(12,2)");
  expect(migration).toContain("when 'round' then round(p_amount)::numeric(12,2)");
  expect(migration).toContain("'roundingResultKrw', v_rounding_result");
  expect(migration).toContain("'taxType', v_invoice_tax_type");
  expect(migration).toContain("v_invoice_line_total");
  expect(migration).toContain("v_invoice_line_discount_amount");
  expect(migration).toContain("frozen_amount_unrepresentable");
  expect(migration).toContain("il.line_total = v_invoice_line_total");
  expect(migration).toContain("'invoiceLineDiscountAmount', v_invoice_line_discount_amount");
  expect(migration).toContain("nullif(v_order.calculation_outputs->>'lineTotalKrw', '')::numeric");
  expect(migration).toContain("nullif(v_order.calculation_outputs->>'lineTotalSnapshot', '')::numeric");
  expect(migration).toContain("roundingResultKrw may include explicit-extra child subtotal");
  expect(migration.indexOf("nullif(v_order.calculation_outputs->>'lineTotalKrw', '')::numeric")).toBeLessThan(
    migration.indexOf("nullif(v_order.calculation_outputs->>'roundingResultKrw', '')::numeric"),
  );
  expect(migration).toContain("Invoice candidates are selected from the persisted billable order set");
  expect(migration).toContain("to_jsonb(v_order)->'applied_snapshot_sha256'");
  expect(migration).toContain("v_order.applied_price_snapshot ? 'priceKrw'");
  expect(migration).not.toContain("coalesce(v_order.applied_snapshot->>'taxIncluded', 'true')");
  expect(migration).toContain("canonical sequence as sync and the");
  expect(migration).toContain("for update of item");
  expect(migration).toContain("jsonb_build_object(\n      'patientName'");
  expect(migration).not.toContain("jsonb_strip_nulls(jsonb_build_object(\n      'patientName'");
  expect(fulfillmentSource).not.toContain("persistSupabaseSnapshotEnrichment");
  expect(fulfillmentSource).not.toContain("clair_enrich_fulfillment_work_item_snapshots");
  const supabaseGatewaySource = actionSource.slice(
    actionSource.indexOf("export function createSupabaseChartOrderActionGateway"),
    actionSource.indexOf("function mergeCatalogSnapshotRows"),
  );
  expect(supabaseGatewaySource).not.toContain("mergeCatalogSnapshotRows");
});

test("A3 replay is ON_ERROR_STOP-safe, synthetic, and transaction-clean", () => {
  expect(replay).toContain("begin;");
  expect(replay).toContain("rollback;");
  expect(replay).toContain("clinical_master_phase1a3_replay_ok");
  expect(replay).toContain("clinical_master_phase1a3_replay_cleanup_ok");
  expect(replay).toContain("directCatalogDmlDenied");
  expect(replay).toContain("adoptionRetryIdempotent");
  expect(replay).toContain("chartGetterRows");
  expect(replay).toContain("billingReaderRows");
  expect(replay).toContain("masterLineageOrders");
  expect(replay).toContain("cross_workspace_encounter_accepted");
  expect(replay).toContain("cross_workspace_catalog_accepted");
  expect(replay).toContain("sourceMasterRecordId");
  expect(replay).toContain("sourceMasterRevision");
  expect(replay).toContain("a3-other-workspace");
  expect(replay).toContain("unsupported_order_type");
  expect(replay).toContain("sync_actor_spoof_accepted");
  expect(replay).toContain("sync_ordinary_accepted");
  expect(replay).toContain("sync_draft_accepted");
  expect(replay).toContain("sync_billing_only_accepted");
  expect(replay).toContain("transition_actor_spoof_accepted");
  expect(replay).toContain("transition_wrong_workspace_accepted");
  expect(replay).toContain("transition_queue_permission_accepted");
  expect(replay).toContain("transition_inactive_accepted");
  expect(replay).toContain("billing_incomplete_accepted");
  expect(replay).toContain("billing_wrong_scope_accepted");
  expect(replay).toContain("billing_wrong_queue_accepted");
  expect(replay).toContain("invalid_quantity_accepted");
  expect(replay).toContain("invalid_client_price_accepted");
  expect(replay).toContain("explicitZeroDraftConfirmInvoiceReadback");
  expect(replay).toContain("roundingModes");
  expect(replay).toContain("rounding_matrix_mismatch");
  expect(replay).toContain("fractionalRoundingInvoice");
  expect(replay).toContain("fractional_invoice_rounding_mismatch");
  expect(replay).toContain("a3010000-0000-4000-8000-000000000009");
  expect(replay).toContain("v_fractional_quantity");
  expect(replay).toContain("fractionalRawProduct");
  expect(replay).toContain("b3FixedRangeExplicitExtraInvoice");
  expect(replay).toContain("lineTotalKrw");
  expect(replay).toContain("explicitExtraSubtotalKrw");
  expect(replay).toContain("nonTaxableFrozenProvenance");
  expect(replay).toContain("frozen_invoice_provenance_missing");
  expect(replay).toContain("billableIdsOnly");
  expect(replay).toContain("legacyConfirmSyncCompatibility");
  expect(replay).toContain("legacyDraftSyncDenied");
  expect(replay).toContain("legacy_sync_draft_accepted");
  expect(replay).toContain("legacy_draft_created_work_item");
  expect(replay).toContain("legacy_routing_inferred");
  expect(replay).toContain("fulfillmentSnapshotRetryImmutable");
  expect(replay).not.toMatch(/service[_-]?role|SUPABASE_SECRET|real patient/i);
});

test("A3 preflight reports every approved fatal and tolerated legacy bucket", () => {
  for (const bucket of [...fixture.preflightBuckets.fatal, ...fixture.preflightBuckets.tolerated]) {
    expect(migration).toContain(`'${bucket}'`);
  }
  expect(migration).toContain("A3 preflight tolerated bucket=");
  expect(migration).toContain("catalog_snapshot_mismatch_draft_or_pending");
  expect(migration).toContain("legacy_anchor_adoption_candidate");
  expect(migration).toContain("legacy_unanchored_no_order_line");
});
