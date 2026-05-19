import { expect, test } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";

import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import {
  createMockBillingPaymentStatusGateway,
  createSupabaseBillingPaymentStatusGateway,
  saveBillingPaymentStatus,
} from "../src/features/billing/server-payment-status-persistence-core";

const workspaceId = "clair-demo";
const invoiceId = "invoice-kong-260501";
const migrationPath = "supabase/migrations/20260520110000_billing_payment_status_persistence_rpc.sql";
const migration = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";

test("payment status route requires an actor and persists completed payment state", async ({
  request,
}) => {
  const unauthenticated = await request.patch(
    `/api/workspaces/${workspaceId}/billing/payment-status`,
    {
      data: {
        action: "complete_payment",
        invoiceId,
        paymentMethod: "transfer",
      },
    }
  );
  expect(unauthenticated.status()).toBe(401);
  await expectJson(unauthenticated, { ok: false, denialReason: "unauthenticated" });

  const saved = await request.patch(`/api/workspaces/${workspaceId}/billing/payment-status`, {
    data: {
      action: "complete_payment",
      invoiceId,
      paymentMethod: "transfer",
    },
    headers: { "x-clair-demo-session-user-id": "user-tech" },
  });
  expect(saved.status()).toBe(200);
  const savedBody = await saved.json() as {
    ok: true;
    invoice: {
      id: string;
      paidAt?: string;
      paymentState?: string;
      selectedPaymentMethod?: string;
      status: string;
      totalAmount: number;
    };
    payments: Array<{
      amount: number;
      invoiceId: string;
      paymentMethod: string;
      status: string;
    }>;
    enforcedBy: string;
  };

  expect(savedBody.enforcedBy).toBe("billing-payment-status-persistence");
  expect(savedBody.invoice).toMatchObject({
    id: invoiceId,
    paymentState: "paid",
    selectedPaymentMethod: "transfer",
    status: "paid",
    totalAmount: 156500,
  });
  expect(savedBody.invoice.paidAt).toBeTruthy();
  expect(savedBody.payments).toContainEqual(
    expect.objectContaining({
      amount: 156500,
      invoiceId,
      paymentMethod: "transfer",
      status: "approved",
    })
  );

  const readBack = await request.get(
    `/api/workspaces/${workspaceId}/billing/payment-status?invoiceId=${invoiceId}`,
    { headers: { "x-clair-demo-session-user-id": "user-tech" } }
  );
  expect(readBack.status()).toBe(200);
  const readBody = await readBack.json() as typeof savedBody;
  expect(readBody.invoice.status).toBe("paid");
  expect(readBody.payments).toContainEqual(expect.objectContaining({ paymentMethod: "transfer" }));
});

test("payment status core blocks unauthorized billing mutations and cross-workspace invoice access", async () => {
  const vetDenied = await saveBillingPaymentStatus({
    actorUserId: "user-vet",
    workspaceId,
    input: {
      action: "complete_payment",
      invoiceId,
      paymentMethod: "card",
    },
  });
  expect(vetDenied).toMatchObject({
    ok: false,
    status: 403,
    denialReason: "permission_missing",
  });

  const crossWorkspaceDenied = await saveBillingPaymentStatus({
    actorUserId: "user-tech",
    workspaceId: "other-workspace",
    input: {
      action: "complete_payment",
      invoiceId,
      paymentMethod: "card",
    },
    permissionAdapter: createMockWorkspacePermissionAdapter({
      users: [{ id: "user-tech", status: "active" }],
      memberships: [
        {
          id: "membership-tech-other",
          workspaceId: "other-workspace",
          userId: "user-tech",
          roles: ["technician"],
          status: "active",
        },
      ],
    }),
  });
  expect(crossWorkspaceDenied).toMatchObject({
    ok: false,
    status: 409,
    denialReason: "invoice_unavailable",
  });
});

test("payment status core persists method, unpaid, and completed states without external provider confirmation", async () => {
  const gateway = createMockBillingPaymentStatusGateway(undefined, () => "2026-05-20T11:00:00.000Z");

  const selected = await saveBillingPaymentStatus({
    actorUserId: "user-tech",
    workspaceId,
    input: {
      action: "select_payment_method",
      invoiceId,
      paymentMethod: "cash",
    },
    gateway,
  });
  expect(selected).toMatchObject({
    ok: true,
    invoice: {
      paymentState: "none",
      selectedPaymentMethod: "cash",
      status: "draft",
    },
  });

  const unpaid = await saveBillingPaymentStatus({
    actorUserId: "user-tech",
    workspaceId,
    input: {
      action: "mark_unpaid",
      invoiceId,
      paymentMethod: "cash",
      unpaidReason: "owner_will_pay_later",
    },
    gateway,
  });
  expect(unpaid).toMatchObject({
    ok: true,
    invoice: {
      paymentState: "unpaid",
      selectedPaymentMethod: "cash",
      status: "issued",
      unpaidReason: "owner_will_pay_later",
    },
  });

  const paid = await saveBillingPaymentStatus({
    actorUserId: "user-tech",
    workspaceId,
    input: {
      action: "complete_payment",
      invoiceId,
      paymentMethod: "cash",
    },
    gateway,
  });
  expect(paid).toMatchObject({
    ok: true,
    invoice: {
      paidAt: "2026-05-20T11:00:00.000Z",
      paymentState: "paid",
      selectedPaymentMethod: "cash",
      status: "paid",
    },
  });
  expect(paid.ok ? paid.payments : []).toContainEqual(
    expect.objectContaining({
      amount: 156500,
      paymentMethod: "cash",
      status: "approved",
    })
  );
});

test("payment status Supabase gateway keeps actor, workspace, invoice, action, and method in RPC calls", async () => {
  const calls: Array<{ functionName: string; args: Record<string, unknown> }> = [];
  const gateway = createSupabaseBillingPaymentStatusGateway({
    async rpc(functionName: string, args: Record<string, unknown>) {
      calls.push({ functionName, args });
      return {
        data: {
          invoice: {
            createdAt: "2026-05-01T10:22:00.000Z",
            discountAmount: 0,
            encounterId: "00000000-0000-4000-8000-000000000201",
            guardianId: "00000000-0000-4000-8000-000000000101",
            id: "00000000-0000-4000-8000-000000000401",
            invoiceNo: "INV-260501-0003",
            paidAt: "2026-05-20T11:00:00.000Z",
            paymentState: "paid",
            selectedPaymentMethod: "card",
            status: "paid",
            subtotalAmount: 156500,
            taxAmount: 0,
            totalAmount: 156500,
            workspaceId,
          },
          payments: [
            {
              amount: 156500,
              id: "00000000-0000-4000-8000-000000000601",
              invoiceId: "00000000-0000-4000-8000-000000000401",
              paidAt: "2026-05-20T11:00:00.000Z",
              paymentMethod: "card",
              status: "approved",
            },
          ],
        },
        error: null,
      };
    },
  });

  const result = await gateway.savePaymentStatus({
    actorUserId: "00000000-0000-4000-8000-000000000002",
    workspaceId,
    input: {
      action: "complete_payment",
      invoiceId: "00000000-0000-4000-8000-000000000401",
      paymentMethod: "card",
      unpaidReason: null,
    },
  });

  expect(calls).toEqual([
    {
      functionName: "clair_save_billing_payment_status",
      args: {
        p_workspace_id: workspaceId,
        p_actor_user_id: "00000000-0000-4000-8000-000000000002",
        p_invoice_id: "00000000-0000-4000-8000-000000000401",
        p_action: "complete_payment",
        p_payment_method: "card",
        p_unpaid_reason: null,
      },
    },
  ]);
  expect(result).toMatchObject({
    ok: true,
    invoice: { paymentState: "paid", status: "paid" },
    payments: [{ amount: 156500 }],
  });
});

test("payment status persistence migration defines local-first RPC boundary without secrets", () => {
  expect(migration).toContain("create or replace function public.clair_get_billing_payment_status");
  expect(migration).toContain("create or replace function public.clair_save_billing_payment_status");
  expect(migration).toContain("private.clair_is_active_workspace_member(p_workspace_id)");
  expect(migration).toContain("selected_payment_method");
  expect(migration).toContain("payment_state");
  expect(migration).toContain("paid_at");
  expect(migration).toContain("payments");
  expect(migration).toContain("encounters");
  expect(migration).toContain("grant execute on function public.clair_save_billing_payment_status");
  expect(migration).not.toMatch(/service[_-]?role|db_password|SUPABASE_SECRET|real patient/i);
});

async function expectJson(response: { json(): Promise<unknown> }, expected: Record<string, unknown>) {
  const body = await response.json();
  expect(body).toMatchObject(expected);
}
