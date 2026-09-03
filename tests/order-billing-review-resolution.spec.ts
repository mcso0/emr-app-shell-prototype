import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import {
  createMockOrderBillingReviewResolutionGateway,
  createSupabaseOrderBillingReviewResolutionGateway,
  reverseOrderBillingReviewInvoice,
  type SupabaseOrderBillingReviewResolutionRpcClient,
} from "../src/features/billing/server-order-billing-review-resolution-core";

const workspaceId = "clair-demo";
const validInput = {
  expectedInvoiceUpdatedAt: "2026-09-02T10:00:00.000Z",
  idempotencyKey: "billing-review-resolution-0001",
  invoiceId: "invoice-001",
  reason: "오더 정정 후 재청구",
};

test("billing review reversal requires billing:issue and a bounded reason", async () => {
  let called = false;
  const denied = await reverseOrderBillingReviewInvoice({
    actorUserId: "user-vet",
    ...validInput,
    gateway: {
      async reverse() {
        called = true;
        throw new Error("gateway must remain permission-gated");
      },
    },
    permissionAdapter: createMockWorkspacePermissionAdapter({
      memberships: [
        {
          id: "membership-vet",
          permissionRole: {
            key: "chart-only",
            label: "Chart only",
            permissionIds: ["chart:update"],
            roleType: "custom",
          },
          roles: ["vet"],
          status: "active",
          userId: "user-vet",
          workspaceId,
        },
      ],
      users: [{ id: "user-vet", status: "active" }],
    }),
    workspaceId,
  });
  expect(denied).toEqual({
    denialReason: "permission_missing",
    ok: false,
    status: 403,
  });
  expect(called).toBe(false);

  const invalid = await reverseOrderBillingReviewInvoice({
    actorUserId: "user-front-desk",
    ...validInput,
    reason: "x",
    workspaceId,
  });
  expect(invalid).toEqual({ error: "invalid_input", ok: false, status: 400 });
});

test("billing review mock is replay-safe and changed content conflicts", async () => {
  const gateway = createMockOrderBillingReviewResolutionGateway();
  const input = {
    actorUserId: "user-front-desk",
    ...validInput,
    gateway,
    workspaceId,
  };
  const first = await reverseOrderBillingReviewInvoice(input);
  const replay = await reverseOrderBillingReviewInvoice(input);
  const conflict = await reverseOrderBillingReviewInvoice({
    ...input,
    reason: "다른 정정 사유",
  });
  expect(first).toEqual(replay);
  expect(first).toMatchObject({
    enforcedBy: "order-billing-review-resolution",
    ok: true,
    resolution: {
      invoiceId: validInput.invoiceId,
      resolutionType: "invoice_void_and_rebill",
    },
  });
  expect(conflict).toEqual({
    error: "idempotency_conflict",
    ok: false,
    status: 409,
  });
});

test("Supabase billing review gateway binds actor, CAS, reason, and idempotency to one RPC", async () => {
  const calls: Array<{ functionName: string; args: Record<string, unknown> }> = [];
  const client = {
    async rpc(functionName: string, args: Record<string, unknown>) {
      calls.push({ functionName, args });
      return {
        data: {
          after: { invoice: { status: "voided" } },
          before: { invoice: { billingReviewRequired: true } },
          candidateCount: 2,
          invoiceId: validInput.invoiceId,
          resolutionId: "resolution-001",
          resolutionType: "invoice_void_and_rebill",
        },
        error: null,
      };
    },
  } as SupabaseOrderBillingReviewResolutionRpcClient;
  const gateway = createSupabaseOrderBillingReviewResolutionGateway(client);
  const result = await gateway.reverse({
    actorUserId: "user-front-desk",
    expectedInvoiceUpdatedAt: validInput.expectedInvoiceUpdatedAt,
    idempotencyKey: validInput.idempotencyKey,
    invoiceId: validInput.invoiceId,
    reason: validInput.reason,
    workspaceId,
  });
  expect(result).toMatchObject({ ok: true, resolution: { candidateCount: 2 } });
  expect(calls).toEqual([
    {
      functionName: "clair_reverse_billing_review_invoice",
      args: {
        p_actor_user_id: "user-front-desk",
        p_expected_invoice_updated_at: validInput.expectedInvoiceUpdatedAt,
        p_idempotency_key: validInput.idempotencyKey,
        p_invoice_id: validInput.invoiceId,
        p_reason: validInput.reason,
        p_workspace_id: workspaceId,
      },
    },
  ]);
});

test("billing review route keeps reversal identity server-owned", async ({ request }) => {
  const route = `/api/workspaces/${workspaceId}/billing/order-review-resolutions`;
  expect((await request.post(route, { data: validInput })).status()).toBe(401);
  const response = await request.post(route, {
    data: validInput,
    headers: { "x-clair-demo-session-user-id": "user-front-desk" },
  });
  expect(response.status()).toBe(200);
  await expect(response.json()).resolves.toMatchObject({
    enforcedBy: "order-billing-review-resolution",
    ok: true,
    resolution: {
      invoiceId: validInput.invoiceId,
      resolutionType: "invoice_void_and_rebill",
    },
  });
});

test("migration makes unpaid reversal atomic and routes paid invoices to refund flow", async () => {
  const migration = await readFile(
    path.join(
      process.cwd(),
      "supabase/migrations/20260903003949_plan_order_work_lifecycle_and_rpc_boundary.sql",
    ),
    "utf8",
  );
  expect(migration).toContain("public.clair_reverse_billing_review_invoice");
  expect(migration).toContain("raise exception 'refund_flow_required'");
  expect(migration).toContain("status = 'voided'");
  expect(migration).toContain("billing_cycle = candidate.billing_cycle + 1");
  expect(migration).toContain("invoice_line_id = null");
  expect(migration).toContain("billing_snapshot = null");
  expect(migration).toContain("order_billing_review_resolutions_immutable_trg");
  expect(migration).toContain("'invoice_void_and_rebill'");
  expect(migration).not.toMatch(
    /SUPABASE_SERVICE_ROLE_KEY|SUPABASE_DB_PASSWORD|postgres(?:ql)?:\/\/[^\"]+:[^@\"]+@/,
  );
});
