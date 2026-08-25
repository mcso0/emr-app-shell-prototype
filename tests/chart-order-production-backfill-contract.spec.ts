import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260825244000_chart_order_production_backfill.sql",
  "utf8",
);
const fixture = readFileSync(
  "tests/sql/chart_order_production_backfill.sql",
  "utf8",
);
const fkIndexes = readFileSync(
  "supabase/migrations/20260825245000_chart_order_execution_fk_indexes.sql",
  "utf8",
);

test("Phase 9 backfill is deterministic, idempotent, and additive", () => {
  expect(migration).toContain(
    "create or replace function private.clair_backfill_chart_order_execution()",
  );
  expect(migration).toContain("clair_chart_order_backfill_uuid");
  expect(migration).toContain("on conflict (workspace_id, order_id, attempt_no) do nothing");
  expect(migration).toContain("on conflict (workspace_id, idempotency_key) do nothing");
  expect(migration).toContain("legacy-production-backfill");
  expect(migration).toContain("set lock_timeout = '5s'");
  expect(migration).toContain("set statement_timeout = '120s'");
  expect(migration).not.toMatch(/\b(?:truncate|drop table|delete from)\b/i);
  expect(migration).not.toMatch(/display_name\s+(?:ilike|like|~)/i);
});

test("Phase 9 backfill preserves the Task, Queue, Billing, and set contracts", () => {
  expect(migration).toContain("orders.row_type = 'set'");
  expect(migration).toContain("'aggregate'");
  expect(migration).toContain("private.clair_calculate_aggregate_task_status");
  expect(migration).toContain("orders.row_type in ('individual','set_child')");
  expect(migration).toContain("when orders.destination_module is null then 'complete'");
  expect(migration).toContain("task.destination_module is not null");
  expect(migration).toContain("insert into public.order_billing_candidates");
  expect(migration).toContain("orders.line_total_snapshot > 0");
  expect(migration).toContain("legacy_confirmed_set_child_without_confirmed_parent");
  expect(migration).toContain("draft_created_execution_artifact");
  expect(migration).toContain("confirmed_atomic_task_cardinality_invalid");
  expect(migration).toContain("execution_queue_reconciliation_invalid");
  expect(migration).toContain("task_order_or_workspace_orphan");
});

test("Phase 9 fixture proves durable sets, destinationless work, invoice links, and retry", () => {
  expect(fixture).toContain("phase9_production_backfill_ok");
  expect(fixture).toContain("phase9_durable_set_aggregate_mismatch");
  expect(fixture).toContain("phase9_destinationless_contract_mismatch");
  expect(fixture).toContain("phase9_invoice_link_reconciliation_mismatch");
  expect(fixture).toContain("phase9_backfill_not_idempotent");
  expect(fixture).toContain("rollback;");
});

test("Phase 9 covers every new advisor-reported foreign-key path", () => {
  for (const contract of [
    "order_tasks_created_by_user_idx",
    "order_task_events_actor_user_idx",
    "order_confirmation_commands_actor_user_idx",
    "order_billing_candidates_created_by_user_idx",
    "order_billing_candidates_invoice_line_idx",
    "order_billing_candidates_command_idx",
    "order_billing_candidates_task_attempt_idx",
    "order_execution_outbox_confirmation_command_idx",
    "order_execution_outbox_revision_idx",
    "order_execution_outbox_aggregate_idx",
    "order_fulfillment_work_items_task_attempt_idx",
  ]) {
    expect(fkIndexes).toContain(contract);
  }
  expect(fkIndexes).not.toMatch(/\b(?:truncate|drop table|delete from)\b/i);
});
