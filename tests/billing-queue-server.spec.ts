import { expect, test } from "@playwright/test";
import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import { readBillingQueue, createSupabaseBillingQueueGateway } from "../src/features/billing/server-billing-queue-core";

const workspaceId = "clair-demo";
const actorUserId = "user-tech";
const date = "2026-09-07";
const row: import("../src/features/billing/billing-queue").BillingQueueItem = {
  invoice: { id: "invoice-queue", workspaceId, encounterId: "encounter-queue", invoiceNo: "Q-001", status: "draft", paymentState: "none", createdAt: `${date}T01:00:00Z`, totalAmount: 30000 },
  encounter: { receptionType: "walk_in" }, patient: { name: "합성 환자" }, guardian: { name: "합성 보호자" }, lineCount: 1, lineSummary: "검사", requestedByName: "미지정",
};
const noBilling = createMockWorkspacePermissionAdapter({ users: [{ id: actorUserId, status: "active" }], memberships: [{ id: "no-billing", workspaceId, userId: actorUserId, roles: ["technician"], status: "active" }], permissionPolicies: [{ workspaceId, role: "technician", permissionIds: [] }] });
const billingOnly = createMockWorkspacePermissionAdapter({ users: [{ id: actorUserId, status: "active" }], memberships: [{ id: "billing-only", workspaceId, userId: actorUserId, roles: ["technician"], status: "active" }] });
billingOnly.permissionPolicies = [{ workspaceId, role: "technician", permissionIds: ["billing:view"] }];

for (const [name, actor, scope, adapter, expected] of [
  ["unauthenticated", null, workspaceId, billingOnly, 401],
  ["billing only", actorUserId, workspaceId, billingOnly, 200],
  ["foreign workspace", actorUserId, "other-workspace", billingOnly, 403],
  ["no billing permission", actorUserId, workspaceId, noBilling, 403],
] as const) {
  test(`billing queue ${name} boundary`, async () => {
    let called = false;
    const result = await readBillingQueue({ actorUserId: actor, workspaceId: scope, date, permissionAdapter: adapter, gateway: { async list() { called = true; return { ok: true, rows: [row] }; } } });
    expect(result.status).toBe(expected);
    expect(called).toBe(expected === 200);
  });
}

test("billing queue rejects invalid dates and failed or foreign reader data", async () => {
  for (const invalid of ["wrong", "2026-02-30", "2026-13-01"]) {
    expect((await readBillingQueue({ actorUserId, workspaceId, date: invalid, permissionAdapter: billingOnly })).status).toBe(400);
  }
  for (const rows of [null, [{ ...row, invoice: { ...row.invoice, workspaceId: "foreign" } }]]) {
    const result = await readBillingQueue({ actorUserId, workspaceId, date, permissionAdapter: billingOnly, gateway: { async list() { return rows ? { ok: true, rows } : { ok: false }; } } });
    expect(result.status).toBe(500);
  }
});

test("billing queue RPC gateway preserves scope, paginates, and rejects malformed responses", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const gateway = createSupabaseBillingQueueGateway({ async rpc(name, args) {
    expect(name).toBe("clair_list_billing_queue"); calls.push(args);
    return { data: args.p_offset === 0 ? Array.from({ length: 200 }, () => row) : [], error: null };
  } });
  expect((await gateway.list({ workspaceId, date })).ok).toBe(true);
  expect(calls).toEqual([
    { p_workspace_id: workspaceId, p_operating_date: date, p_offset: 0, p_limit: 200 },
    { p_workspace_id: workspaceId, p_operating_date: date, p_offset: 200, p_limit: 200 },
  ]);
  expect((await createSupabaseBillingQueueGateway({ async rpc() { return { data: [{ privateField: "unexpected" }], error: null }; } }).list({ workspaceId, date })).ok).toBe(false);
});

test("billing queue route rejects missing actor and forged demo access to a prepared workspace", async ({ request }) => {
  const url = "/api/workspaces/workspace-clair-cheongdam/billing/queue?date=2026-09-07";
  expect((await request.get(url)).status()).toBe(401);
  expect((await request.get(url, { headers: { "x-clair-demo-session-user-id": "user-tech" } })).status()).toBe(403);
});


test("billing queue preserves a database permission denial after API authorization", async () => {
  const gateway = createSupabaseBillingQueueGateway({ async rpc() {
    return { data: null, error: { code: "42501", message: "permission denied" } };
  } });
  const result = await readBillingQueue({ actorUserId, workspaceId, date, permissionAdapter: billingOnly, gateway });
  expect(result.status).toBe(403);
});
