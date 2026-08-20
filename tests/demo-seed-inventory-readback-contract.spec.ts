import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const seed = readFileSync("supabase/seed.sql", "utf8");
const readbackSql = readFileSync(
  "supabase/snippets/demo_seed_inventory_readback.sql",
  "utf8",
);
const inventoryDoc = readFileSync(
  "docs/engineering/data-model/demo-seed-inventory-readback-contract.md",
  "utf8",
);
const replayHelper = readFileSync("scripts/check-local-supabase-replay.mjs", "utf8");
const packageJson = readFileSync("package.json", "utf8");
const normalizedInventoryDoc = inventoryDoc.toLowerCase();

function withoutSqlComments(sql: string) {
  return sql
    .replace(/--.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .toLowerCase();
}

test("demo seed inventory readback SQL is read-only and scoped to clair-demo", () => {
  const executableSql = withoutSqlComments(readbackSql);

  expect(executableSql).toContain("select jsonb_build_object");
  expect(executableSql).toContain("'demo_seed_inventory_readback:2026-06-08'");
  expect(executableSql).toContain("workspace_id = 'clair-demo'");
  expect(executableSql).toContain("den-194");
  expect(executableSql).toContain("inv-den194-%");

  expect(executableSql).not.toMatch(/\b(insert|update|delete|truncate|drop|alter|create|grant|revoke)\b/);
});

test("demo seed inventory readback covers required seed checklist areas", () => {
  for (const area of [
    "auth users / app users",
    "workspace",
    "memberships",
    "permission policies",
    "guardians",
    "patients",
    "patient_guardians",
    "appointments",
    "encounters",
    "waiting_queue_entries",
    "SOAP notes",
    "diagnoses",
    "service categories",
    "service items",
    "order catalog items",
    "order sets",
    "order_set_items",
    "order groups",
    "orders",
    "order events",
    "order_fulfillment_work_items",
    "lab_test_categories",
    "lab_test_items",
    "order_catalog_lab_test_item_links",
    "billing checkout session family",
    "invoices",
    "invoice lines",
    "payments",
    "audit events",
  ]) {
    expect(readbackSql).toContain(area);
    expect(normalizedInventoryDoc).toContain(area.toLowerCase());
  }
});

test("demo seed inventory requires catalog, set, fulfillment, lab, and checkout seeds", () => {
  for (const requiredSeedInsert of [
    "insert into public.order_catalog_items",
    "insert into public.order_fulfillment_work_items",
    "insert into public.lab_test_categories",
    "insert into public.lab_test_items",
    "insert into public.order_catalog_lab_test_item_links",
    "insert into public.billing_checkout_sessions",
    "insert into public.billing_checkout_session_invoices",
    "insert into public.payment_allocations",
  ]) {
    expect(seed).toContain(requiredSeedInsert);
  }

  expect(seed).toContain("clair_seed_order_set_compatibility_projection");
  expect(seed).not.toContain("insert into public.order_sets");
  expect(seed).not.toContain("insert into public.order_set_items");

  expect(seed).toContain("den194-catalog-cbc");
  expect(seed).toContain("den194-catalog-wellness-vaccine");
  expect(seed).toContain("den194-set-kong-vomit-compact");
  expect(seed).toContain("den194-set-mango-wellness-compact");
  expect(seed).toContain("19431000-0000-4000-8000-000000000001");
  expect(seed).toContain("19431000-0000-4000-8000-000000000011");
  expect(seed).toContain("\"scenarioCode\":\"choco-rehab\"");
  expect(seed).toContain("den194-labcat-hematology");
  expect(seed).toContain("den194-labcat-urinalysis");
  expect(seed).toContain("den194-labitem-cbc-wbc");
  expect(seed).toContain("den194-labitem-ua-protein");
  expect(seed).toContain("den194-lablink-cbc-wbc");
  expect(seed).toContain("den194-lablink-ua-ketones");
  expect(seed).toContain("19433000-0000-4000-8000-000000000002");
  expect(seed).toContain("19433100-0000-4000-8000-000000000004");
  expect(seed).toContain("19433200-0000-4000-8000-000000000002");

  expect(readbackSql).toContain("(150, 'order catalog items', 9, 20, 'baseline_required'");
  expect(readbackSql).toContain("(160, 'order sets', 2, 3, 'baseline_required'");
  expect(readbackSql).toContain("(170, 'order_set_items', 5, 8, 'baseline_required'");
  expect(readbackSql).toContain("(210, 'order_fulfillment_work_items', 11, 11, 'baseline_required'");
  expect(readbackSql).toContain("(215, 'lab_test_categories', 2, 2, 'baseline_required'");
  expect(readbackSql).toContain("(216, 'lab_test_items', 8, 8, 'baseline_required'");
  expect(readbackSql).toContain("(217, 'order_catalog_lab_test_item_links', 8, 8, 'baseline_required'");
  expect(readbackSql).toContain("(218, 'billing checkout session family', 2, 2, 'baseline_required'");
  expect(readbackSql).not.toMatch(/\(\d+,\s*'[^']+',\s*\d+,\s*\d+,\s*'known_gap'/);
  expect(readbackSql).toContain("fulfillmentQueueCoverage");
  expect(readbackSql).toContain("labResultSheetCoverage");
  expect(readbackSql).toContain("billingCheckoutCoverage");
  expect(inventoryDoc).toContain("Catalog/set seed covered");
  expect(inventoryDoc).toContain("Fulfillment seed covered");
  expect(inventoryDoc).toContain("Lab result-sheet seed covered");
  expect(inventoryDoc).toContain("Billing checkout seed covered");
  expect(inventoryDoc).toContain("Fulfillment work items");

  expect(readbackSql).toContain("public.order_catalog_items");
  expect(readbackSql).toContain("public.order_sets");
  expect(readbackSql).toContain("public.order_set_revision_items");
  expect(readbackSql).toContain("public.order_fulfillment_work_items");
  expect(readbackSql).toContain("public.lab_test_categories");
  expect(readbackSql).toContain("public.lab_test_items");
  expect(readbackSql).toContain("public.order_catalog_lab_test_item_links");
  expect(readbackSql).toContain("public.billing_checkout_sessions");
  expect(readbackSql).toContain("public.billing_checkout_session_invoices");
  expect(readbackSql).toContain("public.payment_allocations");
});

test("demo seed inventory links seeded scenarios to order, billing, and audit proof", () => {
  for (const scenarioCode of [
    "kong-vomit",
    "nabi-urinary",
    "bori-allergy",
    "mango-wellness",
    "choco-rehab",
  ]) {
    expect(seed).toContain(`"scenario_code":"${scenarioCode}"`);
    expect(readbackSql).toContain(scenarioCode);
    expect(inventoryDoc).toContain(scenarioCode);
  }

  for (const orderType of ["lab", "imaging", "treatment", "dispensing"]) {
    expect(readbackSql).toContain(`'${orderType}'`);
  }

  expect(readbackSql).toContain("invoiceIntegrity");
  expect(readbackSql).toContain("syntheticGuard");
  expect(inventoryDoc).toContain("baselineFailureCount");
  expect(inventoryDoc).toContain("knownGapCount");
});

test("local Supabase replay helper keeps readback local and classifies environment gaps", () => {
  expect(packageJson).toContain("\"demo:seed:check\": \"node scripts/check-local-supabase-replay.mjs\"");
  expect(replayHelper).toContain("SUPABASE_LOCAL_DB_URL");
  expect(replayHelper).toContain("supabase/snippets/demo_seed_inventory_readback.sql");
  expect(replayHelper).toContain("environment_gap");
  expect(replayHelper).toContain("seed_gap");
  expect(replayHelper).toContain("remote_guard");
  expect(replayHelper).toContain("npx supabase db reset --local");
  expect(replayHelper).not.toMatch(/--linked|db push|production|service_role/i);
});
