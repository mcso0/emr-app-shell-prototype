import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260825241000_chart_order_atomic_confirmation_contract.sql",
  "utf8",
);
const lifecycleMigration = readFileSync(
  "supabase/migrations/20260903003949_plan_order_work_lifecycle_and_rpc_boundary.sql",
  "utf8",
);
const sqlFixture = readFileSync(
  "tests/sql/chart_order_atomic_confirmation_contract.sql",
  "utf8",
);
const core = readFileSync(
  "src/features/chart/server-order-action-persistence-core.ts",
  "utf8",
);
const chartModule = readFileSync("src/features/chart/module.tsx", "utf8");

test("Phase 4 migration owns one atomic and idempotent confirmation boundary", () => {
  expect(migration).toContain(
    "create or replace function public.clair_confirm_chart_order_candidates",
  );
  expect(migration).toContain("v_idempotency_key text := btrim");
  expect(migration).toContain("pg_advisory_xact_lock");
  expect(migration).toContain("command.idempotency_key = v_idempotency_key");
  expect(migration).toContain("return v_existing.result");
  expect(migration).toContain("raise exception 'idempotency_conflict'");
  expect(migration).toContain("public.clair_save_chart_order_action(");
  expect(migration).toContain("insert into public.order_tasks");
  expect(migration).toContain("insert into public.order_fulfillment_work_items");
  expect(migration).toContain("insert into public.order_billing_candidates");
  expect(migration).toContain("insert into public.order_task_events");
  expect(migration).toContain("insert into public.audit_events");
  expect(migration).toContain("insert into public.order_execution_outbox");
  expect(migration).toContain("v_remaining_draft := public.clair_get_chart_order_draft");
  expect(migration).toContain("status = 'completed'");
  expect(migration).not.toMatch(/\b(?:truncate|drop table|delete from)\b/i);
  expect(migration).not.toMatch(
    /db_password|SUPABASE_SECRET|real patient/i,
  );
});

test("Phase 4 tables keep command, billing, and outbox writes behind the RPC", () => {
  expect(migration).toContain("create table if not exists public.order_confirmation_commands");
  expect(migration).toContain("create table if not exists public.order_billing_candidates");
  expect(migration).toContain("create table if not exists public.order_execution_outbox");
  expect(migration).toContain("alter table public.order_confirmation_commands enable row level security");
  expect(migration).toContain("alter table public.order_billing_candidates enable row level security");
  expect(migration).toContain("alter table public.order_execution_outbox enable row level security");
  expect(migration).toContain(
    "grant execute on function public.clair_confirm_chart_order_candidates",
  );
  expect(migration).toContain("to authenticated;");
  expect(migration).toContain("'billing:view'");
  expect(migration).not.toContain(
    "grant insert on public.order_confirmation_commands to authenticated",
  );
  expect(migration).not.toContain(
    "grant insert on public.order_execution_outbox to authenticated",
  );
});

test("Phase 4 fixture proves partial set expansion, projections, retry, and rollback", () => {
  expect(sqlFixture).toContain("phase4_atomic_confirmation_ok");
  expect(sqlFixture).toContain("phase4_atomic_db_invariants_ok");
  expect(sqlFixture).toContain("phase4_set_parent_billing_candidate_mismatch");
  expect(sqlFixture).toContain("phase4_set_parent_billing_summary_mismatch");
  expect(sqlFixture).toContain("phase4_voided_invoice_money_excluded_ok");
  expect(sqlFixture).toContain("phase4_historical_set_parent_backfill_ok");
  expect(sqlFixture).toContain("phase4_set_parent_conflict_fail_closed_ok");
  expect(sqlFixture).toContain("phase4_invoice_authority_conflict_fail_closed_ok");
  expect(sqlFixture).toContain("PR019_MIGRATION_REAPPLY");
  expect(sqlFixture).toContain("phase4_mid_commit_rollback_ok");
  expect(sqlFixture).toContain("phase4_mid_commit_db_rollback_ok");
  expect(sqlFixture).toContain("idempotency_conflict");
  expect(sqlFixture).toContain("raise exception 'synthetic_mid_commit_failure'");
  expect(sqlFixture).toContain("rollback;");
});

test("chart confirmation sends a stable idempotency key to the atomic RPC", () => {
  expect(core).toContain('"clair_confirm_chart_order_candidates_with_actual"');
  expect(core).toContain('"clair_confirm_chart_order_candidates_with_actual_for_chart"');
  expect(core).not.toContain('"clair_confirm_chart_order_candidates"');
  expect(core).toContain("p_idempotency_key: idempotencyKey ?? \"\"");
  expect(core).toContain("p_actual_records: actualRecords ?? {}");
  expect(core).toContain("if (!result.serverAtomic || !result.billingSummary)");
  expect(chartModule).toContain("pendingConfirmationRef");
  expect(chartModule).toContain("createChartOrderConfirmationIdempotencyKey");
  expect(chartModule).toContain(
    "idempotencyKey: pendingConfirmation.idempotencyKey",
  );
  expect(chartModule).not.toContain("const actionReadback = await loadChartOrderActions");
});

test("Plan/Order confirmation authorizes before reads and returns completed retries without projection writes", () => {
  const wrapperStart = lifecycleMigration.indexOf(
    "create function public.clair_confirm_chart_order_candidates(",
  );
  const wrapperEnd = lifecycleMigration.indexOf(
    "revoke all on function public.clair_confirm_chart_order_candidates(",
    wrapperStart,
  );
  const wrapper = lifecycleMigration.slice(wrapperStart, wrapperEnd);

  expect(wrapperStart).toBeGreaterThanOrEqual(0);
  expect(wrapper).toContain("p_actor_user_id is distinct from auth.uid()");
  expect(wrapper).toContain("private.clair_is_active_workspace_member(p_workspace_id)");
  expect(wrapper).toContain("'chart:update'");
  expect(wrapper).toContain("pg_advisory_xact_lock");
  expect(wrapper).toContain("command.idempotency_key = v_idempotency_key");
  expect(wrapper.indexOf("p_actor_user_id is distinct from auth.uid()"))
    .toBeLessThan(wrapper.indexOf("if exists ("));
  expect(wrapper.indexOf("return public.clair_confirm_chart_order_candidates_plan_order_base("))
    .toBeLessThan(wrapper.indexOf("orders.calculation_outputs"));
});
