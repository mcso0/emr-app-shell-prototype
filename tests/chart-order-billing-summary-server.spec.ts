import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import {
  getBillingProtectedSnapshotOwnerKey,
  resolveBillingProtectedSnapshot,
} from "../src/features/billing/billing-protected-snapshot";
import type { ChartOrderBillingSummary } from "../src/features/chart/chart-order-billing-summary-contract";
import {
  createMockChartOrderBillingSummaryGateway,
  createSupabaseChartOrderBillingSummaryGateway,
  readChartOrderBillingSummary,
  requestChartOrderBilling,
  type SupabaseChartOrderBillingSummaryRpcClient,
} from "../src/features/chart/server-order-billing-summary-core";

const workspaceId = "clair-demo";
const encounterId = "encounter-kong-260501";
const summary: ChartOrderBillingSummary = {
  workspaceId,
  encounterId,
  etag: '"billing-v1"',
  generatedAt: "2026-08-30T00:00:00.000Z",
  currency: "KRW",
  context: null,
  invoiceId: null,
  orderCounts: { total: 7, confirmed: 6, draft: 1, recheck: 1, requested: 0, requestable: 6, cancelled: 0 },
  amounts: { gross: 316000, confirmed: 266000, draft: 50000, discount: 36000, surcharge: 0, tax: 0, paid: 0, outstanding: 0, estimatedTotal: 280000, requestableTotal: 230000 },
  requestableOrderIds: ["order-1", "order-2"],
  unfinishedOrders: [{ orderId: "order-2", name: "Chemistry 17종", status: "in_progress" }],
};

test("billing summary GET returns ordered Server-Timing without exposing request identifiers", async ({
  request,
}) => {
  const response = await request.get(
    `/api/workspaces/${workspaceId}/chart/order-billing-summary?encounterId=${encounterId}`,
    { headers: { "x-clair-demo-session-user-id": "user-vet" } },
  );
  expect(response.status()).toBe(200);
  const serverTiming = response.headers()["server-timing"];
  expect(serverTiming).toMatch(
    /^session;dur=\d+\.\d, permission;dur=\d+\.\d, rpc;dur=\d+\.\d, total;dur=\d+\.\d$/,
  );
  expect(serverTiming).not.toContain(workspaceId);
  expect(serverTiming).not.toContain(encounterId);

  const denied = await request.get(
    `/api/workspaces/${workspaceId}/chart/order-billing-summary?encounterId=${encounterId}`,
  );
  expect(denied.status()).toBe(401);
  expect(denied.headers()["server-timing"]).toMatch(
    /^session;dur=\d+\.\d, permission;dur=0\.0, rpc;dur=0\.0, total;dur=\d+\.\d$/,
  );
});

test("live billing snapshots are bound to the active actor session and workspace", () => {
  const sessionA = {
    id: "session-a",
    issuedAt: "2026-08-30T00:00:00.000Z",
    role: "hospital_admin" as const,
    roleLabel: "관리자",
    storageMode: "session" as const,
  };
  const sessionB = { ...sessionA, id: "session-b", role: "vet" as const };
  const ownerA = getBillingProtectedSnapshotOwnerKey(sessionA, workspaceId);
  const ownerB = getBillingProtectedSnapshotOwnerKey(sessionB, workspaceId);
  const snapshot = { ownerKey: ownerA, value: { patientName: "권한 사용자 A 환자" } };

  expect(resolveBillingProtectedSnapshot(snapshot, ownerA)).toEqual(snapshot.value);
  expect(resolveBillingProtectedSnapshot(snapshot, ownerB)).toBeUndefined();
  expect(
    resolveBillingProtectedSnapshot(
      snapshot,
      getBillingProtectedSnapshotOwnerKey(sessionA, "foreign-workspace"),
    ),
  ).toBeUndefined();
});

test("billing summary keeps chart:view and chart:update as separate server gates", async () => {
  const adapter = createMockWorkspacePermissionAdapter({
    users: [{ id: "user-vet", status: "active" }],
    memberships: [{ id: "m-vet", workspaceId, userId: "user-vet", roles: ["vet"], status: "active" }],
  });
  const readResult = await readChartOrderBillingSummary({
    actorUserId: "user-vet",
    workspaceId,
    encounterId,
    permissionAdapter: adapter,
    gateway: createMockChartOrderBillingSummaryGateway(summary),
  });
  expect(readResult).toMatchObject({ ok: true, summary: { amounts: { estimatedTotal: 280000 } } });

  const foreignResult = await requestChartOrderBilling({
    actorUserId: "user-vet",
    workspaceId: "foreign-workspace",
    encounterId,
    expectedEtag: summary.etag,
    idempotencyKey: "billing-foreign-1",
    permissionAdapter: adapter,
    gateway: createMockChartOrderBillingSummaryGateway(summary),
  });
  expect(foreignResult).toEqual({ ok: false, status: 403, denialReason: "workspace_membership_missing" });
});

test("default mock billing summary permissions include the normal admin and vet sessions", async () => {
  for (const actorUserId of ["user-admin", "user-vet"]) {
    const result = await readChartOrderBillingSummary({
      actorUserId,
      workspaceId,
      encounterId,
    });
    expect(result).toMatchObject({
      enforcedBy: "chart-order-billing-summary",
      ok: true,
      status: 200,
    });
  }
});

test("billing request is revision-aware and returns an invoice handoff", async () => {
  const gateway = createMockChartOrderBillingSummaryGateway(summary);
  const conflict = await requestChartOrderBilling({
    actorUserId: "playwright-default-session",
    workspaceId,
    encounterId,
    expectedEtag: '"stale"',
    idempotencyKey: "billing-stale-1",
    gateway,
  });
  expect(conflict).toEqual({ ok: false, status: 409, error: "revision_conflict" });

  const result = await requestChartOrderBilling({
    acknowledgeUnfinished: true,
    actorUserId: "playwright-default-session",
    workspaceId,
    encounterId,
    expectedEtag: summary.etag,
    idempotencyKey: "billing-request-1",
    gateway,
  });
  expect(result).toMatchObject({
    ok: true,
    summary: {
      invoiceId: "invoice-chart-order-demo",
      orderCounts: { requestable: 0, requested: 6 },
      amounts: { requestableTotal: 0 },
    },
  });

  const replay = await requestChartOrderBilling({
    acknowledgeUnfinished: true,
    actorUserId: "playwright-default-session",
    workspaceId,
    encounterId,
    expectedEtag: summary.etag,
    idempotencyKey: "billing-request-1",
    gateway,
  });
  expect(replay).toEqual(result);
});

test("Supabase gateway calls only the scoped summary and atomic writer RPCs", async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const client = {
    async rpc(name: string, args: Record<string, unknown>) {
      calls.push({ name, args });
      return { data: summary, error: null };
    },
  } as SupabaseChartOrderBillingSummaryRpcClient;
  const gateway = createSupabaseChartOrderBillingSummaryGateway(client);
  await gateway.read({ workspaceId, encounterId });
  await gateway.requestBilling({
    workspaceId,
    encounterId,
    actorUserId: "user-vet",
    expectedEtag: summary.etag,
    idempotencyKey: "billing-gateway-1",
    acknowledgeUnfinished: true,
  });
  expect(calls.map((call) => call.name)).toEqual([
    "clair_get_chart_order_billing_summary",
    "clair_request_chart_order_billing",
  ]);
  expect(calls[1]?.args).toMatchObject({
    p_workspace_id: workspaceId,
    p_encounter_id: encounterId,
    p_expected_etag: summary.etag,
    p_idempotency_key: "billing-gateway-1",
    p_acknowledge_unfinished: true,
  });
});

test("migration makes billing explicit, atomic, and encounter-status neutral", async () => {
  const migration = await readFile(
    path.join(process.cwd(), "supabase/migrations/20260830230000_chart_order_billing_summary_handoff.sql"),
    "utf8",
  );
  for (const contract of [
    "clair_get_chart_order_billing_summary",
    "clair_request_chart_order_billing",
    "private.clair_link_chart_order_billing_candidates_internal",
    "order_billing_request_commands",
    "billingAuthority', 'order_billing_candidates",
    "order by latest.attempt_no desc",
    "idempotency_conflict",
    "p_actor_user_id is distinct from auth.uid()",
    "private.clair_current_user_has_workspace_permission(p_workspace_id, 'chart:update')",
    "pg_advisory_xact_lock",
    "revision_conflict",
    "unfinished_ack_required",
    "billing_requested_at",
    "billing.invoice_candidate_generated",
    "status = 'invoice_linked'",
    "invoiceLineDiscountAmount",
    "jsonb_build_object('invoiceId', v_existing.invoice_id)",
  ]) expect(migration).toContain(contract);
  expect(migration).not.toContain("candidate.amount = candidate.quantity * candidate.unit_price");
  expect(migration).not.toMatch(/update\s+public\.encounters/i);
  expect(migration).not.toContain("clair_save_billing_payment_status");
  expect(migration).not.toContain("p_encounter_id, v_command.id::text, v_before, v_after");

  const writer = migration.slice(
    migration.indexOf("create or replace function public.clair_request_chart_order_billing"),
  );
  expect(writer.indexOf("from public.orders orders")).toBeLessThan(
    writer.indexOf("v_before := private.clair_get_chart_order_billing_summary_internal"),
  );
  expect(writer.indexOf("from public.order_billing_candidates candidate")).toBeLessThan(
    writer.indexOf("v_before := private.clair_get_chart_order_billing_summary_internal"),
  );

  const linker = migration.slice(
    migration.indexOf("create or replace function private.clair_link_chart_order_billing_candidates_internal"),
    migration.indexOf("create or replace function public.clair_request_chart_order_billing"),
  );
  expect(linker.indexOf("from public.orders orders")).toBeLessThan(
    linker.indexOf("from public.order_billing_candidates candidate"),
  );
});

test("billing integrity patch includes fixed and range set parents and excludes voided invoice money", async () => {
  const migration = await readFile(
    path.join(
      process.cwd(),
      "supabase/migrations/20260831010000_chart_order_billing_summary_integrity.sql",
    ),
    "utf8",
  );

  for (const contract of [
    "clair_assert_set_parent_billing_candidate_integrity",
    "clair_create_set_parent_billing_candidate",
    "chart_order_set_parent_billing_candidate",
    "task_role = 'aggregate'",
    "applied_price_snapshot ->> 'billedAs' = 'set_parent'",
    "o.row_type in ('individual','set_child','set')",
    "t.task_role in ('execution','aggregate')",
    "i.status <> 'voided'",
    "nullif(orders.confirmed_snapshot ->> 'confirmationCommandId', '')",
    "chart-order-backfill-command-v1|",
    "orders.id = any(command.selected_root_order_ids)",
    "line.billing_candidate_id = v_candidate.id",
    "invoice.encounter_id = v_order.encounter_id",
    "v_candidate.created_by_user_id is distinct from v_command.actor_user_id",
    "v_candidate.billing_name_snapshot is distinct from v_expected_billing_name",
    "v_candidate.unit_price is distinct from coalesce(v_order.unit_price_snapshot, 0)",
    "set result = jsonb_set(",
    "set_parent_billing_candidate_backfill_incomplete",
    "sum_set_parent_billing_candidate_detected",
  ]) {
    expect(migration).toContain(contract);
  }

  const paidTotals = migration.slice(
    migration.indexOf("), paid_totals as ("),
    migration.indexOf("), surcharge_totals as ("),
  );
  const surchargeTotals = migration.slice(
    migration.indexOf("), surcharge_totals as ("),
    migration.indexOf("), requestable as ("),
  );
  expect(paidTotals).toContain("i.status <> 'voided'");
  expect(surchargeTotals).toContain("i.status <> 'voided'");
  expect(migration).toContain(
    "revoke all on function private.clair_create_set_parent_billing_candidate()",
  );
  expect(migration).toContain(
    "revoke all on function private.clair_assert_set_parent_billing_candidate_integrity(text,uuid,boolean)",
  );
  expect(migration).not.toMatch(/update\s+public\.encounters/i);
});

test("live billing UI keeps protected snapshots out of the actor-agnostic global store", async () => {
  const billingModule = await readFile(
    path.join(process.cwd(), "src/features/billing/module.tsx"),
    "utf8",
  );
  const rightPanel = billingModule.slice(
    billingModule.indexOf("export function BillingRightPanel()"),
  );
  expect(rightPanel).toContain("applyInvoiceSnapshot,");
  expect(rightPanel).toContain("applyPaymentStatusSnapshot,");
  expect(rightPanel).toContain("invoiceLines,");
  expect(rightPanel).toContain("invoices,");
  expect(rightPanel).toContain("payments,");
  expect(rightPanel).not.toContain("state) => state.applyInvoiceSnapshot");
  expect(rightPanel).not.toContain("state) => state.applyPaymentStatusSnapshot");

  const chartModule = await readFile(
    path.join(process.cwd(), "src/features/chart/module.tsx"),
    "utf8",
  );
  expect(chartModule).toContain(
    'key={`${authSession?.role ?? "signed-out"}:${authSession?.id ?? "signed-out"}:${bundle.encounter.workspaceId}:${bundle.encounter.id}:${activeChartId}`}',
  );
});
