import { expect, test } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";

const migrationPath = "supabase/migrations/20260519170000_chart_order_snapshot_bridge.sql";
const migration = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";

test("chart order snapshot bridge adds DEN-99 applied-row fields", () => {
  for (const column of [
    "row_type text not null default 'individual'",
    "source_order_id text",
    "source_order_version text",
    "source_set_id text",
    "source_set_version text",
    "set_item_id text",
    "parent_chart_order_line_id uuid",
    "row_depth integer not null default 0",
    "applied_snapshot jsonb not null default '{}'::jsonb",
    "applied_price_snapshot jsonb not null default '{}'::jsonb",
    "calculation_inputs jsonb not null default '{}'::jsonb",
    "calculation_outputs jsonb not null default '{}'::jsonb",
    "quantity_source text not null default 'manual'",
    "price_rule_source text not null default 'manual'",
    "billing_reflection_enabled boolean not null default true",
    "order_confirmation_status text not null default 'draft'",
    "billing_candidate_status text not null default 'not_requested'",
    "billing_candidate_id text",
    "invoice_line_id uuid",
    "task_status text",
  ]) {
    expect(migration).toContain(column);
  }
});

test("chart order snapshot bridge separates set hierarchy, confirmation, billing, and task state", () => {
  for (const constraint of [
    "orders_row_type_check",
    "orders_snapshot_json_check",
    "orders_chart_row_hierarchy_check",
    "orders_quantity_source_check",
    "orders_price_rule_source_check",
    "orders_confirmation_status_check",
    "orders_billing_candidate_status_check",
    "orders_task_status_check",
  ]) {
    expect(migration).toContain(constraint);
  }

  for (const value of [
    "'individual'",
    "'set'",
    "'set_child'",
    "'temporary'",
    "'candidate_created'",
    "'invoice_linked'",
    "'billing_cancelled'",
    "'partial_complete'",
    "'re_requested'",
  ]) {
    expect(migration).toContain(value);
  }
});

test("chart order snapshot bridge keeps workspace-scoped relations and billing indexes", () => {
  for (const reference of [
    "foreign key (workspace_id, parent_chart_order_line_id) references public.orders(workspace_id, id)",
    "foreign key (workspace_id, invoice_line_id) references public.invoice_lines(workspace_id, id)",
    "orders_workspace_parent_sort_idx",
    "orders_workspace_row_type_idx",
    "orders_workspace_source_order_idx",
    "orders_workspace_source_set_idx",
    "orders_workspace_billing_candidate_status_idx",
    "orders_workspace_invoice_line_idx",
  ]) {
    expect(migration).toContain(reference);
  }
});

test("chart order snapshot bridge carries invoice handoff snapshot fields without policies", () => {
  for (const column of [
    "billing_candidate_id text",
    "billing_name_snapshot text",
    "source_order_snapshot jsonb not null default '{}'::jsonb",
    "tax_type text not null default 'non_taxable'",
    "non_tax_reason text",
    "discount_adjustment_reason text",
  ]) {
    expect(migration).toContain(column);
  }

  expect(migration).toContain("invoice_lines_source_order_snapshot_json_check");
  expect(migration).toContain("invoice_lines_tax_type_check");
  expect(migration).not.toMatch(/create policy/i);
  expect(migration).not.toMatch(/service[_-]?role|db_password|real patient/i);
});
