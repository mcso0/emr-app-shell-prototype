import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const migrationPath =
  "supabase/migrations/20260825234000_chart_order_execution_master_contract.sql";
const migration = readFileSync(migrationPath, "utf8");
const legacyRouteFix = readFileSync(
  "supabase/migrations/20260825234500_chart_order_execution_master_legacy_route_fix.sql",
  "utf8",
);

test("master migration adds the canonical eight-type contract without replacing legacy order_type", () => {
  for (const type of [
    "consultation",
    "clinical_lab",
    "imaging",
    "external_lab",
    "dispensing",
    "treatment",
    "hospitalization",
    "other",
  ]) {
    expect(migration).toContain(`'${type}'`);
  }
  expect(migration).toContain(
    "add column if not exists clinical_order_type text",
  );
  expect(migration).toContain(
    "add column if not exists destination_module text",
  );
  expect(migration).toContain("add column if not exists execution_mode text");
  expect(migration).toContain("add column if not exists detail_field_schema jsonb");
  expect(migration).toContain("add column if not exists confirmed_snapshot jsonb");
  expect(migration).not.toContain("drop column order_type");
  expect(migration).not.toContain("alter column order_type type");
});

test("field schema stores every approved metadata dimension", () => {
  for (const key of [
    "key",
    "valueType",
    "label",
    "control",
    "unit",
    "options",
    "displayOrder",
    "required",
    "defaultValue",
    "validation",
    "placement",
    "bulkEditable",
    "semantics",
    "preConfirmEditable",
    "postConfirmBehavior",
    "snapshotPath",
  ]) {
    expect(migration).toContain(`'${key}'`);
  }
  expect(migration).toContain("private.clair_order_field_schema_is_valid");
  expect(migration).toContain("detail_schema_version");
});

test("legacy mapping uses canonical fields and never display-name inference", () => {
  const mappingStart = migration.indexOf(
    "update public.order_catalog_items\nset",
  );
  const mappingEnd = migration.indexOf(
    "alter table public.order_catalog_items\n  alter column",
    mappingStart,
  );
  const mapping = migration.slice(mappingStart, mappingEnd);

  expect(mapping).toContain("when 'lab' then 'clinical_lab'");
  expect(mapping).toContain("is_external_lab = coalesce(is_external_lab, false)");
  expect(mapping).toContain("'billing_only','chart_only'");
  expect(mapping).not.toContain("standard_order_name");
  expect(mapping).not.toContain("in_hospital_order_name");
  expect(mapping).not.toContain("billing_name");
});

test("master writer binds actor and capability in SQL and keeps old writers compatible", () => {
  expect(migration).toContain("v_actor_user_id uuid := auth.uid()");
  expect(migration).toContain("'service_catalog:manage'");
  expect(migration).toContain("for update;");
  expect(migration).toContain("raise exception 'catalog_revision_conflict'");
  expect(migration).toContain("'order_catalog.updated'");
  expect(migration).toContain(
    "order_catalog_items_execution_contract_sync_trg",
  );
  expect(migration).toContain("orders_execution_contract_sync_trg");
  expect(migration).toContain("grant execute on function public.clair_update_order_execution_master_contract");
});

test("expand migration validates additive checks and avoids destructive SQL", () => {
  expect(migration).toContain("not valid");
  expect(migration).toContain("validate constraint");
  expect(migration).toContain("set lock_timeout = '5s'");
  expect(migration).toContain("set statement_timeout = '120s'");
  expect(migration).not.toMatch(/\bdrop table\b/i);
  expect(migration).not.toMatch(/\btruncate\b/i);
  expect(migration).not.toMatch(/\bdelete from\b/i);
});

test("legacy routing uses durable Queue or catalog evidence without name inference", () => {
  expect(legacyRouteFix).toContain("from public.order_fulfillment_work_items queue");
  expect(legacyRouteFix).toContain("from public.order_catalog_items catalog");
  expect(legacyRouteFix).toContain("'durable_queue_projection'");
  expect(legacyRouteFix).toContain("'workspace_catalog_contract'");
  expect(legacyRouteFix).toContain("legacy_queue_route_reconciliation_invalid");
  expect(legacyRouteFix).not.toMatch(/display_name\s+(?:ilike|like|~)/i);
  expect(legacyRouteFix).not.toMatch(/\b(?:truncate|drop table|delete from)\b/i);
});
