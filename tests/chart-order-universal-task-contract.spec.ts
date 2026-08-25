import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { deriveAggregateTaskStatus } from "@/features/chart/order-execution-domain";
import type { UniversalOrderTaskStatus } from "@/types/emr-domain";

const migrationPath =
  "supabase/migrations/20260825235000_chart_order_universal_task_contract.sql";
const migration = readFileSync(migrationPath, "utf8");

test("aggregate status follows the approved child precedence", () => {
  const cases: Array<{
    children: UniversalOrderTaskStatus[];
    expected: UniversalOrderTaskStatus;
  }> = [
    { children: [], expected: "pending" },
    { children: ["cancelled", "cancelled"], expected: "cancelled" },
    { children: ["complete", "cancelled"], expected: "complete" },
    { children: ["in_progress", "complete"], expected: "in_progress" },
    { children: ["pending", "complete"], expected: "partial_complete" },
    { children: ["paused", "pending"], expected: "paused" },
    { children: ["pending", "pending"], expected: "pending" },
  ];

  for (const fixture of cases) {
    expect(deriveAggregateTaskStatus(fixture.children)).toBe(fixture.expected);
  }
});

test("universal tasks model execution, aggregate, and linked attempts", () => {
  expect(migration).toContain("create table if not exists public.order_tasks");
  expect(migration).toContain("task_role in ('execution', 'aggregate')");
  expect(migration).toContain("unique (workspace_id, order_id, attempt_no)");
  expect(migration).toContain("re_requested_from_task_id uuid");
  expect(migration).toContain("v_previous.attempt_no + 1 <> new.attempt_no");
  expect(migration).toContain("new.status <> 'pending'");
  expect(migration).toContain("re_request_link_required");
  expect(migration).toContain("task_order_contract_mismatch");
  expect(migration).toContain("v_order.row_type <> 'set'");
  expect(migration).toContain("aggregate_parent_required");
});

test("destinationless execution completes immediately and aggregates never route", () => {
  expect(migration).toContain(
    "task_role = 'aggregate' and parent_task_id is null and destination_module is null",
  );
  expect(migration).toContain("or destination_module is not null");
  expect(migration).toContain("or status = 'complete'");
  expect(migration).toContain("v_role is distinct from 'aggregate'");
  expect(migration).toContain("v_cancelled = v_total");
  expect(migration).toContain("v_terminal = v_total and v_complete > 0");
  expect(migration).toContain("v_terminal > 0 and v_terminal < v_total");
});

test("task events and completed results are immutable actor-bound history", () => {
  expect(migration).toContain("create table if not exists public.order_task_events");
  expect(migration).toContain("task_event_immutable");
  expect(migration).toContain("completed_result_immutable");
  expect(migration).toContain("terminal_task_immutable");
  expect(migration).toContain("actor_user_id uuid not null");
  expect(migration).toContain("before_values jsonb not null");
  expect(migration).toContain("after_values jsonb not null");
});

test("queue rows are task projections while the deployed legacy key is retained", () => {
  expect(migration).toContain("add column if not exists task_id uuid");
  expect(migration).toContain("add column if not exists task_attempt_no integer");
  expect(migration).toContain("order_fulfillment_work_items_task_fkey");
  expect(migration).toContain("queue_projection_task_mismatch");
  expect(migration).toContain("destination_module = queue_type");
  expect(migration).not.toContain(
    "drop constraint if exists order_fulfillment_work_items_workspace_id_order_id_key",
  );
  expect(migration).not.toContain("drop column order_type");
});

test("RLS is capability-bound and authenticated clients have no direct writes", () => {
  expect(migration).toContain("order_tasks_workspace_chart_select");
  expect(migration).toContain("'chart:view'");
  expect(migration).toContain("order_fulfillment_work_items_workspace_capability_select");
  expect(migration).toContain("private.clair_queue_permission_for_destination");
  expect(migration).toContain(
    "drop policy if exists order_fulfillment_work_items_workspace_member_write",
  );
  expect(migration).toContain(
    "revoke insert, update, delete on table public.order_fulfillment_work_items",
  );
  expect(migration).toContain(
    "auth.uid() is null or p_actor_user_id is distinct from auth.uid()",
  );
  expect(migration).not.toMatch(/grant\s+(insert|update|delete|all)\s+on table public\.order_tasks/i);
});

test("the expand migration avoids destructive data operations", () => {
  expect(migration).toContain("set lock_timeout = '5s'");
  expect(migration).toContain("set statement_timeout = '120s'");
  expect(migration).toContain("not valid");
  expect(migration).toContain("validate constraint");
  expect(migration).not.toMatch(/\bdrop table\b/i);
  expect(migration).not.toMatch(/\btruncate\b/i);
  expect(migration).not.toMatch(/\bdelete from\b/i);
});
