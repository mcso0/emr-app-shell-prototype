import { expect, test } from "@playwright/test";

import {
  createMockBillingPaymentStatusGateway,
  saveBillingPaymentStatus,
} from "../src/features/billing/server-payment-status-persistence-core";

const workspaceId = "clair-demo";
const invoiceId = "invoice-kong-260501";
const invoiceLineId = "invoice-line-kong-fluid";

test("approved billing role can mutate invoice lines while unauthorized role is denied", async ({
  request,
}) => {
  const denied = await request.patch(`/api/workspaces/${workspaceId}/billing/invoice-lines`, {
    data: {
      invoiceId,
      lines: [{ invoiceLineId, quantity: 2 }],
    },
    headers: { "x-clair-demo-session-user-id": "user-vet" },
  });
  expect(denied.status()).toBe(403);
  await expectJson(denied, { ok: false, denialReason: "permission_missing" });

  const allowed = await request.patch(`/api/workspaces/${workspaceId}/billing/invoice-lines`, {
    data: {
      invoiceId,
      lines: [{ invoiceLineId, quantity: 2 }],
    },
    headers: { "x-clair-demo-session-user-id": "user-admin" },
  });
  expect(allowed.status()).toBe(200);
  const body = await allowed.json() as {
    ok: true;
    enforcedBy: string;
    lines: Array<{ id: string; lineTotal: number; quantity: number }>;
  };
  expect(body.enforcedBy).toBe("billing-invoice-line-persistence");
  expect(body.lines).toContainEqual(
    expect.objectContaining({
      id: invoiceLineId,
      lineTotal: 36000,
      quantity: 2,
    })
  );
});

test("client-submitted invoice amounts are ignored and server recalculates from stored unit price", async ({
  request,
}) => {
  const tampered = await request.patch(`/api/workspaces/${workspaceId}/billing/invoice-lines`, {
    data: {
      confirmBilling: true,
      invoiceId,
      lines: [
        {
          invoiceLineId,
          lineTotal: 1,
          quantity: 3,
          unitPrice: 1,
        },
      ],
      totalAmount: 1,
    },
    headers: { "x-clair-demo-session-user-id": "user-admin" },
  });
  expect(tampered.status()).toBe(200);
  const body = await tampered.json() as {
    ok: true;
    invoice: { subtotalAmount: number; totalAmount: number };
    lines: Array<{ id: string; lineTotal: number; quantity: number; unitPrice: number }>;
  };

  expect(body.lines).toContainEqual(
    expect.objectContaining({
      id: invoiceLineId,
      lineTotal: 54000,
      quantity: 3,
      unitPrice: 18000,
    })
  );
  expect(body.invoice.subtotalAmount).toBe(192500);
  expect(body.invoice.totalAmount).toBe(192500);
});

test("payment status transition preserves the explicit state model", async () => {
  const gateway = createMockBillingPaymentStatusGateway(
    undefined,
    () => "2026-05-20T12:00:00.000Z",
    "billing-security-regression-explicit-state"
  );
  const selected = await saveBillingPaymentStatus({
    actorUserId: "user-admin",
    workspaceId,
    input: {
      action: "select_payment_method",
      invoiceId,
      paymentMethod: "card",
    },
    gateway,
  });
  expect(selected).toMatchObject({
    ok: true,
    invoice: {
      paymentState: "none",
      selectedPaymentMethod: "card",
      status: "draft",
    },
  });

  const unpaid = await saveBillingPaymentStatus({
    actorUserId: "user-admin",
    workspaceId,
    input: {
      action: "mark_unpaid",
      invoiceId,
      paymentMethod: "card",
      unpaidReason: "owner_will_pay_later",
    },
    gateway,
  });
  expect(unpaid).toMatchObject({
    ok: true,
    invoice: {
      paymentState: "unpaid",
      status: "issued",
    },
  });

  const paid = await saveBillingPaymentStatus({
    actorUserId: "user-admin",
    workspaceId,
    input: {
      action: "complete_payment",
      invoiceId,
      paymentMethod: "card",
    },
    gateway,
  });
  expect(paid).toMatchObject({
    ok: true,
    invoice: {
      paidAt: "2026-05-20T12:00:00.000Z",
      paymentState: "paid",
      status: "paid",
    },
  });
  expect(paid.ok ? paid.payments : []).toContainEqual(
    expect.objectContaining({
      amount: 156500,
      paymentMethod: "card",
      status: "approved",
    })
  );
});

async function expectJson(response: { json(): Promise<unknown> }, expected: Record<string, unknown>) {
  const body = await response.json();
  expect(body).toMatchObject(expected);
}
