import { expect, test } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";

const migrationPath =
  "supabase/migrations/20260519160000_clinical_order_billing_schema_foundation.sql";
const migration = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";
const seed = readFileSync("supabase/seed.sql", "utf8");

test("clinical billing schema migration defines Project 04 foundation tables", () => {
  for (const table of [
    "service_categories",
    "service_items",
    "service_item_prices",
    "soap_notes",
    "soap_note_revisions",
    "diagnosis_catalog",
    "diagnoses",
    "order_groups",
    "orders",
    "order_events",
    "order_revisions",
    "order_revision_fields",
    "invoices",
    "invoice_lines",
    "payments",
  ]) {
    expect(migration).toContain(`create table if not exists public.${table}`);
    expect(migration).toContain(`alter table public.${table} enable row level security`);
  }

  expect(migration).not.toMatch(/create policy/i);
});

test("clinical billing schema pins encounter and workspace scope with composite foreign keys", () => {
  for (const reference of [
    "foreign key (workspace_id, encounter_id) references public.encounters(workspace_id, id)",
    "foreign key (workspace_id, order_group_id) references public.order_groups(workspace_id, id)",
    "foreign key (workspace_id, order_id) references public.orders(workspace_id, id)",
    "foreign key (workspace_id, invoice_id) references public.invoices(workspace_id, id)",
    "foreign key (workspace_id, service_item_id) references public.service_items(workspace_id, id)",
    "foreign key (workspace_id, guardian_id) references public.guardians(workspace_id, id)",
  ]) {
    expect(migration).toContain(reference);
  }

  for (const indexName of [
    "soap_notes_workspace_id_key",
    "orders_workspace_id_key",
    "invoices_workspace_id_key",
    "service_items_workspace_id_key",
  ]) {
    expect(migration).toContain(indexName);
  }
});

test("clinical billing schema constrains status values and amount precision", () => {
  for (const value of [
    "draft",
    "autosaved",
    "signed",
    "confirmed",
    "requested",
    "re_requested",
    "ready_for_billing",
    "issued",
    "paid",
    "unpaid",
    "refund_requested",
    "voided",
  ]) {
    expect(migration).toContain(`'${value}'`);
  }

  for (const amountColumn of [
    "unit_price_snapshot numeric(12,2)",
    "line_total_snapshot numeric(12,2) generated always as",
    "subtotal_amount numeric(12,2)",
    "line_total numeric(12,2) generated always as",
    "amount numeric(12,2)",
  ]) {
    expect(migration).toContain(amountColumn);
  }

  expect(migration).toContain("check (discount_amount <= quantity * unit_price)");
  expect(migration).toContain("check (payment_state <> 'paid' or paid_at is not null)");
});

test("clinical billing schema includes query indexes for chart, order, and billing reads", () => {
  for (const indexName of [
    "soap_notes_workspace_encounter_updated_idx",
    "diagnoses_workspace_encounter_sort_idx",
    "orders_workspace_encounter_status_idx",
    "orders_workspace_status_priority_due_idx",
    "invoices_workspace_status_issued_idx",
    "invoice_lines_workspace_order_idx",
    "payments_workspace_invoice_paid_idx",
  ]) {
    expect(migration).toContain(indexName);
  }
});

test("clinical billing seed contract uses synthetic Project 04 fixture rows", () => {
  expect(seed).toContain("clinical_billing_seed_contract_version:2026-05-19-den-68");

  for (const table of [
    "service_categories",
    "service_items",
    "service_item_prices",
    "soap_notes",
    "diagnoses",
    "order_groups",
    "orders",
    "invoices",
    "invoice_lines",
  ]) {
    expect(seed).toContain(`insert into public.${table}`);
  }

  expect(seed).toContain("28000000-0000-4000-8000-000000000001");
  expect(seed).toContain("29000000-0000-4000-8000-000000000001");
  expect(seed).toContain("29300000-0000-4000-8000-000000000001");
  expect(seed).toContain("29400000-0000-4000-8000-000000000001");
  expect(seed).not.toMatch(/service[_-]?role|db_password|real patient/i);
});
