import { expect, test } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";

import {
  buildBillingContractInvoiceSnapshot,
  resolveBillingActivityAt,
  resolveBillingAmountInclusion,
  resolveBillingLifecycleStatus,
} from "../src/features/billing/billing-data-contract";
import {
  createMockGuardianCheckoutGateway,
  listGuardianBillingLedger,
  prepareGuardianCheckoutSession,
  transitionBillingInvoiceStatus,
} from "../src/features/billing/server-guardian-checkout-core";
import { mockInvoices, mockPayments } from "../src/mocks/emr-domain";

const workspaceId = "clair-demo";
const guardianId = "guardian-lee-jieun";
const migrationPath = "supabase/migrations/20260601093000_billing_guardian_checkout_hardening.sql";
const migration = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";

test("billing data contract derives lifecycle activity date and checkout inclusion", () => {
  const waiting = mockInvoices.find((invoice) => invoice.id === "invoice-coco-260501");
  const unpaid = mockInvoices.find((invoice) => invoice.id === "invoice-coco-history-unpaid-260429");
  const paid = mockInvoices.find((invoice) => invoice.id === "invoice-coco-history-paid-260414");
  const voided = mockInvoices.find((invoice) => invoice.id === "invoice-coco-history-voided-260328");

  expect(waiting && resolveBillingLifecycleStatus(waiting)).toBe("waiting");
  expect(unpaid && resolveBillingLifecycleStatus(unpaid)).toBe("unpaid");
  expect(paid && resolveBillingLifecycleStatus(paid)).toBe("paid");
  expect(voided && resolveBillingLifecycleStatus(voided)).toBe("voided");

  expect(waiting && resolveBillingAmountInclusion(waiting)).toBe("payable");
  expect(unpaid && resolveBillingAmountInclusion(unpaid)).toBe("payable");
  expect(paid && resolveBillingAmountInclusion(paid)).toBe("excluded");
  expect(voided && resolveBillingAmountInclusion(voided)).toBe("excluded");

  expect(waiting && resolveBillingActivityAt({
    ...waiting,
    billingRequestedAt: "2026-05-01T10:45:00+09:00",
  })).toMatchObject({
    activityAt: "2026-05-01T10:45:00+09:00",
    activityBasis: "billing_requested_at",
  });
});

test("guardian ledger core returns payable and excluded history rows for one guardian", async () => {
  const result = await listGuardianBillingLedger({
    actorUserId: "user-front-desk",
    workspaceId,
    input: { guardianId, includeCoGuardianInvoices: false, statusFilter: "all" },
  });

  expect(result).toMatchObject({
    ok: true,
    enforcedBy: "guardian-billing-ledger",
    status: 200,
  });
  if (!result.ok) return;

  expect(result.rows).toContainEqual(
    expect.objectContaining({
      invoiceId: "invoice-coco-260501",
      amountInclusion: "payable",
      status: "waiting",
      payableAmount: 121500,
    }),
  );
  expect(result.rows).toContainEqual(
    expect.objectContaining({
      invoiceId: "invoice-coco-history-paid-260414",
      amountInclusion: "excluded",
      status: "paid",
      payableAmount: 0,
    }),
  );
});

test("checkout prepare excludes completed and cancelled invoices from payable total", async () => {
  const result = await prepareGuardianCheckoutSession({
    actorUserId: "user-front-desk",
    workspaceId,
    input: {
      invoiceIds: [
        "invoice-coco-260501",
        "invoice-coco-history-unpaid-260429",
        "invoice-coco-history-paid-260414",
        "invoice-coco-history-voided-260328",
      ],
      paymentMethod: "card",
      paymentMemo: "DEN-379 synthetic checkout",
    },
    gateway: createMockGuardianCheckoutGateway(undefined, () => "2026-06-01T10:00:00+09:00"),
  });

  expect(result).toMatchObject({
    ok: true,
    enforcedBy: "guardian-checkout-session",
    checkoutSession: {
      payableAmount: 179500,
      excludedAmount: 33000,
      excludedCount: 2,
    },
  });
  expect(result.ok ? result.invoiceSnapshots : []).toContainEqual(
    expect.objectContaining({
      invoiceId: "invoice-coco-history-paid-260414",
      amountInclusion: "excluded",
      payableAmount: 0,
    }),
  );
});

test("invoice status transition core requires reason and emits audited side effect", async () => {
  const rejected = await transitionBillingInvoiceStatus({
    actorUserId: "user-front-desk",
    workspaceId,
    input: {
      invoiceId: "invoice-coco-history-paid-260414",
      target: "unpaid",
      paymentMethod: "card",
    },
  });
  expect(rejected).toMatchObject({
    ok: false,
    status: 400,
    error: "invalid_input",
    fieldErrors: { reason: "상태 변경 사유를 입력해 주세요." },
  });

  const transitioned = await transitionBillingInvoiceStatus({
    actorUserId: "user-front-desk",
    workspaceId,
    input: {
      invoiceId: "invoice-coco-history-paid-260414",
      target: "unpaid",
      paymentMethod: "card",
      reason: "보호자 결제 취소 요청",
    },
    gateway: createMockGuardianCheckoutGateway(undefined, () => "2026-06-01T10:10:00+09:00"),
  });

  expect(transitioned).toMatchObject({
    ok: true,
    enforcedBy: "billing-invoice-status-transition",
    auditEvent: {
      eventType: "billing.invoice_status_transitioned",
      previousStatus: "paid",
      targetStatus: "unpaid",
      reason: "보호자 결제 취소 요청",
    },
    invoice: {
      paymentState: "unpaid",
      status: "issued",
      unpaidReason: "보호자 결제 취소 요청",
    },
  });
});

test("guardian checkout route exposes ledger, prepared checkout, and status transition", async ({ request }) => {
  const unauthenticated = await request.get(
    `/api/workspaces/${workspaceId}/billing/guardian-checkout?guardianId=${guardianId}`,
  );
  expect(unauthenticated.status()).toBe(401);

  const ledger = await request.get(
    `/api/workspaces/${workspaceId}/billing/guardian-checkout?guardianId=${guardianId}`,
    { headers: { "x-clair-demo-session-user-id": "user-front-desk" } },
  );
  expect(ledger.status()).toBe(200);
  const ledgerBody = await ledger.json() as { ok: true; rows: Array<{ invoiceId: string; amountInclusion: string }> };
  expect(ledgerBody.rows).toContainEqual(
    expect.objectContaining({ invoiceId: "invoice-coco-history-paid-260414", amountInclusion: "excluded" }),
  );

  const prepared = await request.post(`/api/workspaces/${workspaceId}/billing/guardian-checkout`, {
    data: {
      invoiceIds: ["invoice-coco-260501", "invoice-coco-history-paid-260414"],
      paymentMethod: "cash",
    },
    headers: { "x-clair-demo-session-user-id": "user-front-desk" },
  });
  expect(prepared.status()).toBe(200);
  const preparedBody = await prepared.json() as { ok: true; checkoutSession: { payableAmount: number; excludedCount: number } };
  expect(preparedBody.checkoutSession).toMatchObject({ payableAmount: 121500, excludedCount: 1 });

  const transitioned = await request.patch(`/api/workspaces/${workspaceId}/billing/guardian-checkout`, {
    data: {
      invoiceId: "invoice-coco-history-voided-260328",
      target: "waiting",
      reason: "청구 취소 오입력 정정",
      paymentMethod: "cash",
    },
    headers: { "x-clair-demo-session-user-id": "user-front-desk" },
  });
  expect(transitioned.status()).toBe(200);
  const transitionedBody = await transitioned.json() as { ok: true; invoice: { status: string; paymentState?: string } };
  expect(transitionedBody.invoice).toMatchObject({ status: "draft", paymentState: "none" });
});

test("billing screen uses guardian checkout route for ledger and checkout totals", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const guardianCheckoutCalls: Array<{ method: string; status: number; url: string }> = [];
  page.on("response", (response) => {
    const url = response.url();
    if (!url.includes(`/api/workspaces/${workspaceId}/billing/guardian-checkout`)) return;

    guardianCheckoutCalls.push({
      method: response.request().method(),
      status: response.status(),
      url,
    });
  });

  await page.goto(`/w/${workspaceId}/billing?modulePanel=open&aside=open&right=open`);
  await expect(page.getByTestId("billing-ledger-row-invoice-coco-260501")).toBeVisible();
  await expect
    .poll(() => guardianCheckoutCalls.some((call) => call.method === "GET" && call.status === 200))
    .toBe(true);
  await expect
    .poll(() => guardianCheckoutCalls.some((call) => call.method === "POST" && call.status === 200))
    .toBe(true);

  for (const invoiceId of [
    "invoice-coco-history-unpaid-260429",
    "invoice-coco-history-paid-260414",
    "invoice-coco-history-voided-260328",
  ]) {
    await page.getByTestId(`billing-ledger-row-${invoiceId}`).scrollIntoViewIfNeeded();
    await page.getByTestId(`billing-ledger-row-${invoiceId}`).click({ position: { x: 14, y: 14 } });
  }

  await expect(page.locator('[data-workspace-panel="right"]')).toContainText("최종 결제금액");
  await expect(page.locator('[data-workspace-panel="right"]')).toContainText("179,500원");
  await expect(page.locator('[data-workspace-panel="right"]')).toContainText("완료/취소 2건은 현재 수납 합산에서 제외됩니다.");
});

test("billing checkout hardening migration contains local schema and RPC contract", () => {
  expect(migration).toContain("add column if not exists billing_requested_at");
  expect(migration).toContain("create table if not exists public.billing_checkout_sessions");
  expect(migration).toContain("create table if not exists public.billing_checkout_session_invoices");
  expect(migration).toContain("create table if not exists public.invoice_adjustments");
  expect(migration).toContain("create table if not exists public.payment_allocations");
  expect(migration).toContain("create table if not exists public.billing_invoice_status_transition_events");
  expect(migration).toContain("create or replace function public.clair_list_guardian_billing_ledger");
  expect(migration).toContain("create or replace function public.clair_prepare_billing_checkout_session");
  expect(migration).toContain("create or replace function public.clair_transition_billing_invoice_status");
  expect(migration).toContain("min(i.guardian_id::text)::uuid");
  expect(migration).toContain("grant execute on function public.clair_prepare_billing_checkout_session");
  expect(migration).toContain("Remote Supabase push");
});

test("contract invoice snapshot keeps paid amount out of payable total", () => {
  const paid = mockInvoices.find((invoice) => invoice.id === "invoice-coco-history-paid-260414");
  expect(paid).toBeTruthy();
  if (!paid) return;

  expect(buildBillingContractInvoiceSnapshot({ invoice: paid, payments: mockPayments })).toMatchObject({
    amountInclusion: "excluded",
    balanceAmount: 0,
    paidAmount: 79000,
    payableAmount: 0,
    status: "paid",
  });
});
