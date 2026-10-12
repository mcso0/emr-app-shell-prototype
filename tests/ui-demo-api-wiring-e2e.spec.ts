import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import { chartOrderExpectedEtagHeader } from "../src/features/chart/order-version-contract";
import { prepareLabApiFixture, claimLabFixture } from "./fixtures/modern-lab-api";

const workspaceId = "clair-demo";
const kongEncounterId = "encounter-kong-260501";
const kongChartId = "soap-kong-260501";
const uiFixtureDate = "2026-05-21";
const apiHeaders = { "x-clair-demo-session-user-id": "user-vet" };
const frontDeskHeaders = { "x-clair-demo-session-user-id": "user-front-desk" };
const technicianHeaders = { "x-clair-demo-session-user-id": "user-tech" };
let fulfillmentCommandSequence = 800;
const uiApiPatient = {
  id: "patient-ui-api-kong",
  workspaceId,
  patientNo: "P-UI-API-0001",
  name: "API Kong Synthetic",
  species: "dog",
  breed: "Demo mix",
  sex: "male",
  neutered: true,
  status: "active",
  createdAt: "2026-05-21T09:00:00+09:00",
  updatedAt: "2026-05-21T09:00:00+09:00",
};

const uiApiGuardian = {
  id: "guardian-ui-api-kong",
  workspaceId,
  name: "API Guardian Synthetic",
  mobilePhone: "010-0000-1941",
  createdAt: "2026-05-21T09:00:00+09:00",
  updatedAt: "2026-05-21T09:00:00+09:00",
};

const uiApiEncounter = {
  id: "encounter-ui-api-kong",
  workspaceId,
  patientId: uiApiPatient.id,
  guardianId: uiApiGuardian.id,
  primaryVeterinarianId: "user-vet-suji",
  encounterNo: "E-UI-API-0001",
  receptionType: "walk_in",
  chiefComplaint: "API seeded reception queue proof",
  visitPurpose: "API seeded reception queue proof",
  status: "waiting",
  checkedInAt: "2026-05-21T09:05:00+09:00",
  createdAt: "2026-05-21T09:05:00+09:00",
  updatedAt: "2026-05-21T09:05:00+09:00",
};

const uiApiQueueEntry = {
  id: "queue-ui-api-kong",
  workspaceId,
  encounterId: uiApiEncounter.id,
  queueType: "consultation",
  status: "waiting",
  priority: "normal",
  sortOrder: 1,
  enteredAt: "2026-05-21T09:05:00+09:00",
};

test("reception and chart screens render API-backed queue/profile responses", async ({
  page,
}) => {
  const calls: string[] = [];
  await mockReceptionApi(page, calls);

  await page.goto(`/w/clair-demo/reception?date=${uiFixtureDate}&modulePanel=open`);

  await expect(page.getByTestId(`patient-card-${uiApiPatient.id}`)).toContainText(
    "API Kong Synthetic",
  );
  // Current queue/calendar DTOs embed profiles; the legacy local branch does not fetch a second lookup.
  await expect(page.getByTestId(`patient-card-${uiApiPatient.id}`)).toContainText(uiApiGuardian.name);
  expect(calls).toEqual(
    expect.arrayContaining([
      "reception-calendar",
      "reception-queue",
    ]),
  );

  await mockChartApi(page, calls);
  await page.goto(`/w/clair-demo/treatment?date=${uiFixtureDate}&modulePanel=open&aside=closed`);

  await expect(
    page.getByTestId(`order-queue-item-${uiApiEncounter.id}`),
  ).toContainText("API Kong Synthetic");
  expect(calls).toEqual(expect.arrayContaining(["chart-live-queue"]));
});

test("synthetic outpatient route boundary reaches fulfillment and billing checkout", async ({
  request,
}) => {
  const receptionQueue = await request.get(
    `/api/workspaces/${workspaceId}/reception/queue`,
    { headers: frontDeskHeaders },
  );
  expect(receptionQueue.status()).toBe(200);
  await expectJson(receptionQueue, {
    ok: true,
    enforcedBy: "reception-queue-read",
  });

  const orderIds = [
    "order-kong-cbc",
    "order-kong-abdomen",
    "order-kong-fluid",
    "order-kong-maropitant",
  ];
  const currentActions = await request.get(
    `/api/workspaces/${workspaceId}/chart/order-actions?encounterId=${kongEncounterId}`,
    { headers: apiHeaders },
  );
  expect(currentActions.status()).toBe(200);
  const expectedEtag = currentActions.headers().etag;
  expect(expectedEtag).toMatch(/^"[0-9a-f]{64}"$/);
  const confirmed = await request.patch(
    `/api/workspaces/${workspaceId}/chart/order-actions`,
    {
      data: {
        action: "confirm",
        chartId: kongChartId,
        encounterId: kongEncounterId,
        expectedEtag,
        idempotencyKey: "ui-demo-outpatient-confirm-0001",
        orderIds,
      },
      headers: { ...apiHeaders, [chartOrderExpectedEtagHeader]: expectedEtag },
    },
  );
  expect(confirmed.status()).toBe(200);
  await expectJson(confirmed, {
    ok: true,
    enforcedBy: "chart-order-action-persistence",
  });

  const labWorkItem = await claimSyntheticWorkItem(request, await readWorkItem(request, "lab", "order-kong-cbc"));
  const labCatalog = await request.get(
    `/api/workspaces/${workspaceId}/lab-imaging/result-sheet-catalog?serviceItemId=19429000-0000-4000-8000-000000000001&orderDisplayName=DEN-194%20CBC%20kong-vomit`,
    { headers: technicianHeaders },
  );
  expect(labCatalog.status()).toBe(200);
  const labCatalogBody = (await labCatalog.json()) as {
    ok: true;
    items: Array<{ id: string; testItemName: string }>;
  };
  expect(labCatalogBody.items.map((item) => item.testItemName)).toEqual(
    expect.arrayContaining(["WBC", "RBC", "HCT"]),
  );

  const savedLabResult = await request.post(
    `/api/workspaces/${workspaceId}/lab-imaging/result-entries`,
    {
      data: {
        encounterId: kongEncounterId,
        orderId: "order-kong-cbc",
        resultId: `live-lab-${labWorkItem.id}`,
        rows: [
          {
            id: `live-lab-${labWorkItem.id}-den194-labitem-cbc-wbc`,
            analyteName: "WBC",
            unit: "10^3/uL",
            value: "21.4",
            judgment: "high",
          },
        ],
        workItemId: labWorkItem.id,
      },
      headers: { "x-clair-demo-session-user-id": labWorkItem.assignedToUserId },
    },
  );
  expect(savedLabResult.status()).toBe(200);
  await expectJson(savedLabResult, {
    ok: true,
    enforcedBy: "lab-result-entry-server-boundary",
  });
  const savedLabResultReadback = await request.get(
    `/api/workspaces/${workspaceId}/lab-imaging/result-entries?resultId=live-lab-${labWorkItem.id}`,
    { headers: technicianHeaders },
  );
  expect(savedLabResultReadback.status()).toBe(200);
  const savedLabResultReadbackBody = (await savedLabResultReadback.json()) as {
    ok: true;
    savedResult: { rows: Array<{ analyteName: string; value?: string }> };
  };
  expect(savedLabResultReadbackBody.savedResult.rows).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ analyteName: "WBC", value: "21.4" }),
    ]),
  );

  await advanceWorkItemToCompleted(
    request,
    labWorkItem.id,
    labWorkItem.status,
    labWorkItem.rowRevision,
    labWorkItem.assignedToUserId,
  );
  const imagingWorkItem = await readWorkItem(
    request,
    "imaging",
    "order-kong-abdomen",
  );
  await advanceWorkItemToCompleted(
    request,
    imagingWorkItem.id,
    imagingWorkItem.status,
    imagingWorkItem.rowRevision,
    imagingWorkItem.assignedToUserId,
  );
  const treatmentWorkItem = await readWorkItem(
    request,
    "treatment",
    "order-kong-fluid",
  );
  await advanceWorkItemToCompleted(
    request,
    treatmentWorkItem.id,
    treatmentWorkItem.status,
    treatmentWorkItem.rowRevision,
    treatmentWorkItem.assignedToUserId,
  );
  const dispensingWorkItem = await readWorkItem(
    request,
    "dispensing",
    "order-kong-maropitant",
  );
  await advanceWorkItemToCompleted(
    request,
    dispensingWorkItem.id,
    dispensingWorkItem.status,
    dispensingWorkItem.rowRevision,
    dispensingWorkItem.assignedToUserId,
  );

  const reviewed = await request.patch(
    `/api/workspaces/${workspaceId}/chart/result-review-billing`,
    {
      data: {
        encounterId: kongEncounterId,
        orderIds: ["order-kong-cbc", "order-kong-abdomen"],
      },
      headers: apiHeaders,
    },
  );
  expect(reviewed.status()).toBe(200);
  await expectJson(reviewed, {
    ok: true,
    enforcedBy: "fulfillment-vet-review-billing-gate",
  });

  await claimSyntheticInvoice(request, "invoice-kong-260501", "user-front-desk");
  const checkout = await request.post(
    `/api/workspaces/${workspaceId}/billing/guardian-checkout`,
    {
      data: {
        invoiceIds: ["invoice-kong-260501"],
        paymentMethod: "card",
      },
      headers: frontDeskHeaders,
    },
  );
  expect(checkout.status()).toBe(200);
  const checkoutBody = (await checkout.json()) as {
    ok: true;
    checkoutSession: { payableAmount: number };
  };
  expect(checkoutBody.checkoutSession.payableAmount).toBeGreaterThan(0);

  const paid = await request.patch(
    `/api/workspaces/${workspaceId}/billing/payment-status`,
    {
      data: {
        action: "complete_payment",
        invoiceId: "invoice-kong-260501",
        paymentMethod: "card",
      },
      headers: frontDeskHeaders,
    },
  );
  expect(paid.status()).toBe(200);
  const paidBody = (await paid.json()) as {
    ok: true;
    invoice: { paymentState: string; status: string };
  };
  expect(paidBody.invoice).toMatchObject({
    paymentState: "paid",
    status: "paid",
  });
  const paidReadback = await request.get(
    `/api/workspaces/${workspaceId}/billing/payment-status?invoiceId=invoice-kong-260501`,
    { headers: frontDeskHeaders },
  );
  expect(paidReadback.status()).toBe(200);
  const paidReadbackBody = (await paidReadback.json()) as {
    ok: true;
    invoice: { paymentState: string; status: string };
    payments: Array<{ paymentMethod: string; status: string }>;
  };
  expect(paidReadbackBody.invoice).toMatchObject({
    paymentState: "paid",
    status: "paid",
  });
  expect(paidReadbackBody.payments).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ paymentMethod: "card", status: "approved" }),
    ]),
  );

  const audit = await request.get(
    `/api/workspaces/${workspaceId}/audit/events?query=invoice-kong&limit=10`,
    { headers: { "x-clair-demo-session-user-id": "user-admin" } },
  );
  expect(audit.status()).toBe(200);
  await expectJson(audit, {
    ok: true,
    enforcedBy: "live-audit-review-reader",
  });
});

test("fulfillment, lab result sheet, billing, and audit screens consume API boundaries", async ({
  page,
}) => {
  const calls: string[] = [];
  await mockDownstreamDemoApis(page, calls);
  const labFixture = await prepareLabApiFixture(page, calls);

  await page.goto(labFixture.href);
  const liveLabQueueItem = page.getByTestId("lab-queue-item-live-lab-ui-api-lab-cbc");
  await expect(liveLabQueueItem).toContainText("API Lab Kong");
  await liveLabQueueItem.click();
  await claimLabFixture(page);
  await expect(
    page.getByTestId("lab-result-input-live-lab-ui-api-lab-cbc-den194-labitem-cbc-wbc"),
  ).toBeVisible();
  await page
    .getByTestId("lab-result-input-live-lab-ui-api-lab-cbc-den194-labitem-cbc-wbc")
    .fill("21.4");
  await expect(page.getByTestId("lab-result-save-status")).toContainText("저장됨");

  await claimSyntheticInvoice(page.request, "invoice-coco-260501", "user-admin");
  await page.goto("/w/clair-demo/billing?modulePanel=open&aside=open");
  await expect(page.getByTestId("billing-queue-item-invoice-coco-260501")).toBeVisible();
  await expect.poll(() => calls).toContain("billing-checkout-post");

  await page.goto("/w/clair-demo/orders?modulePanel=open");
  await page.getByRole("button", { name: "감사 로그" }).click();
  await expect(page.getByTestId("hospital-admin-audit-review")).toBeVisible();
  await expect(page.getByTestId("audit-review-row-ui-api-audit-payment")).toContainText(
    "invoice-coco-260501",
  );

  expect(calls).toEqual(
    expect.arrayContaining([
      "fulfillment-lab",
      "lab-result-definition-read",
      "lab-result-entry",
      "billing-checkout-post",
      "audit-events",
    ]),
  );
});

test("visible day-in-clinic demo links reception, chart, fulfillment, lab, billing, and audit surfaces", async ({
  page,
}) => {
  const calls: string[] = [];
  await mockReceptionApi(page, calls);
  await mockChartApi(page, calls);
  await mockDownstreamDemoApis(page, calls);
  const labFixture = await prepareLabApiFixture(page, calls);

  await test.step("front desk sees an API-backed reception queue patient", async () => {
    await page.goto(`/w/clair-demo/reception?date=${uiFixtureDate}&modulePanel=open`);
    await expect(page.getByTestId(`patient-card-${uiApiPatient.id}`)).toContainText(
      "API Kong Synthetic",
    );
    await expect(page.getByTestId(`patient-card-${uiApiPatient.id}`)).toContainText(uiApiGuardian.name);
  });

  await test.step("vet sees the same API-backed encounter in the chart queue", async () => {
    await page.goto(`/w/clair-demo/treatment?date=${uiFixtureDate}&modulePanel=open&aside=closed`);
    await expect(
      page.getByTestId(`order-queue-item-${uiApiEncounter.id}`),
    ).toContainText("API Kong Synthetic");
  });

  await test.step("technician enters and saves a lab result through the result API", async () => {
    await page.goto(labFixture.href);
    const liveLabQueueItem = page.getByTestId("lab-queue-item-live-lab-ui-api-lab-cbc");
    await expect(liveLabQueueItem).toContainText("API Lab Kong");
    await liveLabQueueItem.click();
    await claimLabFixture(page);
    await page
      .getByTestId("lab-result-input-live-lab-ui-api-lab-cbc-den194-labitem-cbc-wbc")
      .fill("21.4");
    await expect(page.getByTestId("lab-result-save-status")).toContainText("저장됨");
  });

  await test.step("technician sees the selected dispensing order in the instruction table", async () => {
    await page.goto("/w/clair-demo/dispensing?modulePanel=open&aside=closed");
    await page.getByRole("button", { name: "오더별 보기", exact: true }).click();
    await expect(page.getByTestId("patient-queue-view-toggle")).toHaveAttribute("aria-pressed", "false");
    const liveDispensingQueueItem = page.getByTestId(
      "order-queue-item-live-fulfillment-ui-api-dispensing-maropitant",
    );
    await expect(liveDispensingQueueItem).toContainText("API Lab Kong");
    await liveDispensingQueueItem.click();
    await expect(
      page.getByTestId(
        "order-row-section-0-live-order-row-ui-api-dispensing-maropitant",
      ),
    ).toContainText("DEN-194 maropitant dispensing API");
  });

  await test.step("front desk sees API billing and checkout state", async () => {
    await claimSyntheticInvoice(page.request, "invoice-coco-260501", "user-admin");
  await page.goto("/w/clair-demo/billing?modulePanel=open&aside=open");
    await expect(page.getByTestId("billing-instruction-info")).toContainText(
      "API-INV-VISIBLE-260501",
    );
    await expect(page.getByTestId("billing-checkout-workspace")).toContainText(
      "Visible API billing line",
    );
    await expect(page.getByTestId("billing-checkout-total")).toContainText(
      "156,500원",
    );
  });

  await test.step("admin can review the audit event for the billing handoff", async () => {
    await page.goto("/w/clair-demo/orders?modulePanel=open");
    await page.getByRole("button", { name: "감사 로그" }).click();
    await expect(page.getByTestId("hospital-admin-audit-review")).toBeVisible();
    await expect(page.getByTestId("audit-review-row-ui-api-audit-payment")).toContainText(
      "invoice-coco-260501",
    );
  });

  expect(calls).toEqual(
    expect.arrayContaining([
      "reception-calendar",
      "reception-queue",
      "chart-live-queue",
      "fulfillment-lab",
      "fulfillment-dispensing",
      "fulfillment-treatment",
      "lab-result-definition-read",
      "lab-result-entry",
      "billing-invoice-lines-get",
      "billing-payment-status-get",
      "billing-checkout-post",
      "audit-events",
    ]),
  );
});

test("billing screen prefers API invoice, payment, and checkout snapshots over mock state", async ({
  page,
  request,
}) => {
  const calls: string[] = [];
  const apiInvoice = {
    id: "invoice-coco-260501",
    workspaceId,
    encounterId: "encounter-coco-260501",
    guardianId: "guardian-lee-jieun",
    invoiceNo: "API-INV-260501-9999",
    status: "paid",
    subtotalAmount: 43210,
    discountAmount: 0,
    taxAmount: 0,
    totalAmount: 43210,
    issuedAt: "2026-05-01T10:50:00+09:00",
    paidAt: "2026-05-01T10:55:00+09:00",
    paymentState: "paid",
    selectedPaymentMethod: "card",
    createdAt: "2026-05-01T10:40:00+09:00",
  };
  const apiInvoiceLines = [
    {
      id: "invoice-line-api-coco-cbc-readback",
      invoiceId: apiInvoice.id,
      serviceItemId: "svc-lab-cbc",
      orderId: "order-coco-cbc",
      description: "API CBC readback line",
      quantity: 1,
      unitPrice: 43210,
      lineTotal: 43210,
    },
  ];
  const apiPayments = [
    {
      id: "payment-api-coco-card-readback",
      invoiceId: apiInvoice.id,
      paymentMethod: "card",
      amount: 43210,
      status: "approved",
      paidAt: "2026-05-01T10:55:00+09:00",
      metadata: { source: "ui-api-test" },
    },
  ];

  await page.route("**/api/workspaces/clair-demo/billing/invoice-candidates?*", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: { ok: true, status: 200, candidates: [] },
      status: 200,
    });
  });
  await page.route("**/api/workspaces/clair-demo/billing/invoice-lines?*", async (route) => {
    calls.push("billing-invoice-lines-get");
    await route.fulfill({
      contentType: "application/json",
      json: {
        ok: true,
        status: 200,
        enforcedBy: "billing-invoice-line-persistence",
        invoice: apiInvoice,
        lines: apiInvoiceLines,
      },
      status: 200,
    });
  });
  await page.route("**/api/workspaces/clair-demo/billing/payment-status?*", async (route) => {
    calls.push("billing-payment-status-get");
    await route.fulfill({
      contentType: "application/json",
      json: {
        ok: true,
        status: 200,
        enforcedBy: "billing-payment-status-persistence",
        invoice: apiInvoice,
        payments: apiPayments,
      },
      status: 200,
    });
  });
  await page.route("**/api/workspaces/clair-demo/billing/guardian-checkout?*", async (route) => {
    calls.push("billing-checkout-get");
    await route.fulfill({
      contentType: "application/json",
      json: {
        ok: true,
        status: 200,
        enforcedBy: "guardian-billing-ledger",
        rows: [
          {
            activityAt: "2026-05-01T10:55:00+09:00",
            amountInclusion: "payable",
            balanceAmount: 0,
            invoiceId: apiInvoice.id,
            payableAmount: 43210,
            status: "paid",
            totalAmount: 43210,
          },
        ],
      },
      status: 200,
    });
  });
  await page.route("**/api/workspaces/clair-demo/billing/guardian-checkout", async (route) => {
    calls.push("billing-checkout-post");
    await route.fulfill({
      contentType: "application/json",
      json: {
        ok: true,
        status: 200,
        enforcedBy: "guardian-checkout-session",
        checkoutSession: {
          excludedAmount: 0,
          excludedCount: 0,
          id: "checkout-api-coco-readback",
          payableAmount: 43210,
          selectedInvoiceIds: [apiInvoice.id],
          status: "prepared",
        },
        invoiceSnapshots: [
          {
            amountInclusion: "payable",
            balanceAmount: 0,
            invoiceId: apiInvoice.id,
            payableAmount: 43210,
          },
        ],
      },
      status: 200,
    });
  });

  await claimSyntheticInvoice(request, apiInvoice.id, "user-admin");
  await page.goto("/w/clair-demo/billing?modulePanel=open&aside=open");

  await expect(page.getByTestId("billing-instruction-info")).toContainText(
    "API-INV-260501-9999",
  );
  await expect(page.getByTestId("billing-instruction-info")).toContainText(
    "수납완료",
  );
  await expect(page.getByTestId("billing-checkout-workspace")).toContainText(
    "API CBC readback line",
  );
  await expect(page.getByTestId("billing-checkout-total")).toContainText(
    "43,210원",
  );
  await expect.poll(() => calls).toEqual(
    expect.arrayContaining([
      "billing-invoice-lines-get",
      "billing-payment-status-get",
      "billing-checkout-post",
    ]),
  );
});

test("billing screen exposes API read failure and recovers through retry", async ({
  page,
}) => {
  let allowInvoiceLineSuccess = false;
  const recoveredInvoice = {
    id: "invoice-coco-260501",
    workspaceId,
    encounterId: "encounter-coco-260501",
    guardianId: "guardian-lee-jieun",
    invoiceNo: "API-INV-RETRY-260501",
    status: "issued",
    subtotalAmount: 54321,
    discountAmount: 0,
    taxAmount: 0,
    totalAmount: 54321,
    issuedAt: "2026-05-01T10:52:00+09:00",
    paymentState: "none",
    selectedPaymentMethod: "card",
    createdAt: "2026-05-01T10:40:00+09:00",
  };

  await page.route("**/api/workspaces/clair-demo/billing/invoice-candidates?*", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: { ok: true, status: 200, candidates: [] },
      status: 200,
    });
  });
  await page.route("**/api/workspaces/clair-demo/billing/invoice-lines?*", async (route) => {
    if (!allowInvoiceLineSuccess) {
      await route.fulfill({
        contentType: "application/json",
        json: { ok: false, status: 500, error: "forced_invoice_line_failure" },
        status: 500,
      });
      return;
    }

    await route.fulfill({
      contentType: "application/json",
      json: {
        ok: true,
        status: 200,
        enforcedBy: "billing-invoice-line-persistence",
        invoice: recoveredInvoice,
        lines: [
          {
            id: "invoice-line-api-coco-recovered",
            invoiceId: recoveredInvoice.id,
            serviceItemId: "svc-lab-cbc",
            orderId: "order-coco-cbc",
            description: "Recovered API billing line",
            quantity: 1,
            unitPrice: 54321,
            lineTotal: 54321,
          },
        ],
      },
      status: 200,
    });
  });
  await page.route("**/api/workspaces/clair-demo/billing/payment-status?*", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: {
        ok: true,
        status: 200,
        enforcedBy: "billing-payment-status-persistence",
        invoice: recoveredInvoice,
        payments: [],
      },
      status: 200,
    });
  });
  await page.route("**/api/workspaces/clair-demo/billing/guardian-checkout?*", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: { ok: true, status: 200, enforcedBy: "guardian-billing-ledger", rows: [] },
      status: 200,
    });
  });
  await page.route("**/api/workspaces/clair-demo/billing/guardian-checkout", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: {
        ok: true,
        status: 200,
        enforcedBy: "guardian-checkout-session",
        checkoutSession: {
          excludedAmount: 0,
          excludedCount: 0,
          id: "checkout-api-coco-retry",
          payableAmount: 54321,
          selectedInvoiceIds: [recoveredInvoice.id],
          status: "prepared",
        },
        invoiceSnapshots: [],
      },
      status: 200,
    });
  });

  await page.goto("/w/clair-demo/billing?modulePanel=open&aside=open");

  await expect(page.getByTestId("billing-api-state")).toContainText(
    "수납 API 응답을 불러오지 못했습니다.",
  );
  allowInvoiceLineSuccess = true;
  await page.getByTestId("billing-api-state-retry-button").click();
  await expect(page.getByTestId("billing-checkout-workspace")).toContainText(
    "Recovered API billing line",
  );
  await expect(page.getByTestId("billing-checkout-total")).toContainText(
    "54,321원",
  );
  await expect(page.getByTestId("billing-api-state")).toHaveCount(0);
});

test("billing screen separates permission denial from retryable API failure", async ({
  page,
  request,
}) => {
  let allowInvoiceRead = false;
  let checkoutAttempts = 0;
  const invoice = {
    id: "invoice-coco-260501", workspaceId, encounterId: "encounter-coco-260501",
    guardianId: "guardian-lee-jieun", invoiceNo: "API-INV-PERMISSION-260501",
    status: "issued", subtotalAmount: 43210, discountAmount: 0, taxAmount: 0,
    totalAmount: 43210, paymentState: "none", selectedPaymentMethod: "card",
    issuedAt: "2026-05-01T10:50:00+09:00", createdAt: "2026-05-01T10:40:00+09:00",
  };
  await page.route("**/api/workspaces/clair-demo/billing/invoice-candidates?*", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: { ok: true, status: 200, candidates: [] },
      status: 200,
    });
  });
  await page.route("**/api/workspaces/clair-demo/billing/invoice-lines?*", async (route) => {
    if (allowInvoiceRead) return route.fulfill({ json: {
      ok: true, status: 200, invoice, enforcedBy: "billing-invoice-line-persistence",
      lines: [{ id: "invoice-line-permission-boundary", invoiceId: invoice.id,
        orderId: "order-coco-cbc", serviceItemId: "svc-lab-cbc", description: "Permission boundary line",
        quantity: 1, unitPrice: 43210, lineTotal: 43210 }],
    } });
    await route.fulfill({
      contentType: "application/json",
      json: { ok: false, status: 403, denialReason: "permission_missing" },
      status: 403,
    });
  });
  await page.route("**/api/workspaces/clair-demo/billing/payment-status?*", async (route) => {
    if (allowInvoiceRead) return route.fulfill({ json: {
      ok: true, status: 200, invoice, payments: [], enforcedBy: "billing-payment-status-persistence",
    } });
    await route.fulfill({
      contentType: "application/json",
      json: { ok: false, status: 403, denialReason: "permission_missing" },
      status: 403,
    });
  });
  await page.route("**/api/workspaces/clair-demo/billing/guardian-checkout?*", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: { ok: true, status: 200, enforcedBy: "guardian-billing-ledger", rows: [] },
      status: 200,
    });
  });
  await page.route("**/api/workspaces/clair-demo/billing/guardian-checkout", async (route) => {
    checkoutAttempts += 1;
    await route.fulfill({
      contentType: "application/json",
      json: { ok: false, status: 403, denialReason: "permission_missing" },
      status: 403,
    });
  });

  await clearSyntheticInvoiceAssignment(request, invoice.id, "user-admin");
  await page.goto("/w/clair-demo/billing?modulePanel=open&aside=open");

  await expect(page.getByTestId("billing-api-state")).toContainText(
    "수납 API 권한이 없습니다.",
  );
  await expect(page.getByTestId("billing-api-state-retry-button")).toHaveCount(0);
  expect(checkoutAttempts).toBe(0);
  allowInvoiceRead = true;
  await claimSyntheticInvoice(request, invoice.id, "user-admin");
  await page.reload();
  await expect(page.getByTestId("billing-api-state")).toHaveCount(0);
  await expect(page.getByTestId("billing-checkout-state")).toContainText(
    "Checkout 권한이 없습니다.",
  );
  await expect.poll(() => checkoutAttempts).toBeGreaterThan(0);
});

test("billing checkout session failure exposes a retry path", async ({ page, request }) => {
  let allowCheckoutSuccess = false;
  const invoice = {
    id: "invoice-coco-260501",
    workspaceId,
    encounterId: "encounter-coco-260501",
    guardianId: "guardian-lee-jieun",
    invoiceNo: "API-INV-CHECKOUT-260501",
    status: "issued",
    subtotalAmount: 65432,
    discountAmount: 0,
    taxAmount: 0,
    totalAmount: 65432,
    issuedAt: "2026-05-01T10:58:00+09:00",
    paymentState: "none",
    selectedPaymentMethod: "card",
    createdAt: "2026-05-01T10:40:00+09:00",
  };

  await page.route("**/api/workspaces/clair-demo/billing/invoice-candidates?*", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: { ok: true, status: 200, candidates: [] },
      status: 200,
    });
  });
  await page.route("**/api/workspaces/clair-demo/billing/invoice-lines?*", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: {
        ok: true,
        status: 200,
        enforcedBy: "billing-invoice-line-persistence",
        invoice,
        lines: [
          {
            id: "invoice-line-api-coco-checkout-retry",
            invoiceId: invoice.id,
            serviceItemId: "svc-treatment-fluid",
            orderId: "order-coco-fluid",
            description: "Checkout retry billing line",
            quantity: 1,
            unitPrice: 65432,
            lineTotal: 65432,
          },
        ],
      },
      status: 200,
    });
  });
  await page.route("**/api/workspaces/clair-demo/billing/payment-status?*", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: {
        ok: true,
        status: 200,
        enforcedBy: "billing-payment-status-persistence",
        invoice,
        payments: [],
      },
      status: 200,
    });
  });
  await page.route("**/api/workspaces/clair-demo/billing/guardian-checkout?*", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: { ok: true, status: 200, enforcedBy: "guardian-billing-ledger", rows: [] },
      status: 200,
    });
  });
  await page.route("**/api/workspaces/clair-demo/billing/guardian-checkout", async (route) => {
    if (!allowCheckoutSuccess) {
      await route.fulfill({
        contentType: "application/json",
        json: { ok: false, status: 500, error: "forced_checkout_failure" },
        status: 500,
      });
      return;
    }

    await route.fulfill({
      contentType: "application/json",
      json: {
        ok: true,
        status: 200,
        enforcedBy: "guardian-checkout-session",
        checkoutSession: {
          excludedAmount: 0,
          excludedCount: 0,
          id: "checkout-api-coco-recovered",
          payableAmount: 65432,
          selectedInvoiceIds: [invoice.id],
          status: "prepared",
        },
        invoiceSnapshots: [],
      },
      status: 200,
    });
  });

  await claimSyntheticInvoice(request, invoice.id, "user-admin");
  await page.goto("/w/clair-demo/billing?modulePanel=open&aside=open");

  await expect(page.getByTestId("billing-checkout-state")).toContainText(
    "Checkout session을 준비하지 못했습니다.",
  );
  allowCheckoutSuccess = true;
  await page.getByTestId("billing-checkout-retry-button").click();
  await expect(page.getByTestId("billing-checkout-total")).toContainText(
    "65,432원",
  );
  await expect(page.getByTestId("billing-checkout-state")).toHaveCount(0);
});

test("lab result UI exposes catalog retry and save retry states", async ({ page }) => {
  // Current frozen result-definition reads supply catalog rows in supported workspaces.
  const fixture = await prepareLabApiFixture(page, [], { failReadOnce: true, failSaveOnce: true });
  await page.goto(fixture.href);
  await page.getByTestId("lab-queue-item-live-lab-ui-api-lab-cbc").click();

  await expect(page.getByTestId("lab-result-catalog-status")).toContainText(
    "결과지 항목을 불러오지 못했습니다.",
  );
  await page.getByTestId("lab-result-catalog-retry-button").click();
  await expect(
    page.getByTestId("lab-result-input-live-lab-ui-api-lab-cbc-den194-labitem-cbc-wbc"),
  ).toBeVisible();

  await claimLabFixture(page);
  await page
    .getByTestId("lab-result-input-live-lab-ui-api-lab-cbc-den194-labitem-cbc-wbc")
    .fill("21.4");
  await expect(page.getByTestId("lab-result-save-status")).toContainText("저장 실패");
  await page.getByTestId("lab-result-save-retry-button").click();
  await expect(page.getByTestId("lab-result-save-status")).toContainText("저장됨");
  expect(fixture.writes).toHaveLength(2);
  expect(fixture.writes[1]).toEqual(fixture.writes[0]);
  await expect(page.getByTestId("lab-result-input-live-lab-ui-api-lab-cbc-den194-labitem-cbc-wbc")).toHaveValue("21.4");
});

test("lab result UI separates catalog permission denial from empty data", async ({ page }) => {
  await mockLabFulfillmentApi(page);

  await page.route("**/api/workspaces/clair-demo/lab-imaging/result-sheet-catalog?*", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: { ok: false, status: 403, denialReason: "permission_missing" },
      status: 403,
    });
  });

  await page.goto("/w/clair-demo/lab?modulePanel=open&aside=closed");
  await page.getByTestId("lab-queue-item-live-lab-ui-api-lab-cbc").click();

  await expect(page.getByTestId("lab-result-catalog-status")).toContainText(
    "결과지 항목을 볼 권한이 없습니다.",
  );
  await expect(page.getByTestId("lab-result-catalog-retry-button")).toHaveCount(0);
});

async function mockReceptionApi(page: Page, calls: string[]) {
  await page.route("**/api/workspaces/clair-demo/reception/patient-guardian-lookup?*", async (route) => {
    calls.push("reception-profile-lookup");
    await route.fulfill({
      contentType: "application/json",
      json: {
        ok: true,
        enforcedBy: "reception-patient-guardian-lookup",
        patients: [
          {
            patient: uiApiPatient,
            primaryGuardian: uiApiGuardian,
            searchText: "api kong synthetic api guardian synthetic",
          },
        ],
      },
      status: 200,
    });
  });

  await page.route("**/api/workspaces/clair-demo/reception/calendar/day?*", async (route) => {
    calls.push("reception-calendar");
    await route.fulfill({
      contentType: "application/json",
      json: {
        ok: true,
        status: 200,
        workspaceId,
        date: uiFixtureDate,
        records: [{ encounter: uiApiEncounter, queueEntry: uiApiQueueEntry,
          patient: uiApiPatient, primaryGuardian: uiApiGuardian }],
        enforcedBy: "reception-calendar-read",
      },
      status: 200,
    });
  });

  await page.route((url) => url.pathname === "/api/workspaces/clair-demo/reception/queue", async (route) => {
    expect(route.request().method()).toBe("GET");
    calls.push("reception-queue");
    await route.fulfill({
      contentType: "application/json",
      json: {
        ok: true,
        status: 200,
        queue: [{ kind: "encounter_queue", encounter: uiApiEncounter, queueEntry: uiApiQueueEntry,
          patient: uiApiPatient, primaryGuardian: uiApiGuardian }],
        summary: { workspaceId, date: uiFixtureDate, appointmentCount: 0, receptionCount: 1, totalCount: 1 },
        enforcedBy: "reception-queue-read",
      },
      status: 200,
    });
  });
}

async function mockChartApi(page: Page, calls: string[]) {
  await page.route((url) => url.pathname === "/api/workspaces/clair-demo/chart/live-queue", async (route) => {
    expect(route.request().method()).toBe("GET");
    calls.push("chart-live-queue");
    await route.fulfill({
      contentType: "application/json",
      json: {
        ok: true,
        status: 200,
        queue: [
          {
            encounter: uiApiEncounter,
            patient: uiApiPatient,
            primaryGuardian: uiApiGuardian,
            queueEntry: uiApiQueueEntry,
          },
        ],
        enforcedBy: "chart-live-queue-read",
      },
      status: 200,
    });
  });

  await page.route("**/api/workspaces/clair-demo/chart/soap-notes?*", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: { ok: true, status: 200, soapNote: null },
      status: 200,
    });
  });
  await page.route("**/api/workspaces/clair-demo/chart/diagnoses?*", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: { ok: true, status: 200, diagnoses: [] },
      status: 200,
    });
  });
  await page.route("**/api/workspaces/clair-demo/chart/completion?*", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: {
        ok: true,
        status: 200,
        completion: {
          encounterId: uiApiEncounter.id,
          workspaceId,
          status: "waiting",
          updatedAt: uiApiEncounter.updatedAt,
        },
      },
      status: 200,
    });
  });
  await page.route("**/api/workspaces/clair-demo/chart/order-drafts?*", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: { ok: true, status: 200, orderDrafts: [] },
      status: 200,
    });
  });
  await page.route("**/api/workspaces/clair-demo/chart/order-actions?*", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: { ok: true, status: 200, orderActions: [] },
      status: 200,
    });
  });
  await page.route("**/api/workspaces/clair-demo/chart/order-lifecycle?*", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: { ok: true, status: 200, lifecycles: [] },
      status: 200,
    });
  });
  await page.route("**/api/workspaces/clair-demo/billing/invoice-candidates?*", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: { ok: true, status: 200, candidates: [] },
      status: 200,
    });
  });
}

async function readWorkItem(
  request: APIRequestContext,
  queueType: "dispensing" | "imaging" | "lab" | "treatment",
  orderId: string,
) {
  const response = await request.get(
    `/api/workspaces/${workspaceId}/fulfillment/work-items?queueType=${queueType}&encounterId=${kongEncounterId}`,
    { headers: technicianHeaders },
  );
  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    ok: true;
    workItems: Array<{
      id: string;
      orderId: string;
      rowRevision: number;
      status: string;
      assignedToUserId: string | null;
    }>;
  };
  const item = body.workItems.find((workItem) => workItem.orderId === orderId);
  expect(item).toBeTruthy();
  return item!;
}

async function advanceWorkItemToCompleted(
  request: APIRequestContext,
  workItemId: string,
  initialStatus: string,
  initialRevision = 1,
  assignedToUserId: string | null = null,
) {
  if (initialStatus === "requested" && !assignedToUserId) {
    const claimed = await claimSyntheticWorkItem(request, {
      id: workItemId, rowRevision: initialRevision, status: initialStatus, assignedToUserId,
    });
    initialStatus = claimed.status;
    initialRevision = claimed.rowRevision;
    assignedToUserId = claimed.assignedToUserId;
  }
  const actions =
    initialStatus === "requested"
      ? ["start", "complete"]
      : initialStatus === "paused"
        ? ["resume", "complete"]
        : initialStatus === "in_progress"
          ? ["complete"]
          : [];
  let expectedRevision = initialRevision;

  for (const action of actions) {
    fulfillmentCommandSequence += 1;
    const response = await request.patch(
      `/api/workspaces/${workspaceId}/fulfillment/work-items/${workItemId}`,
      {
        data: {
          action,
          commandId: `00000000-0000-4000-8000-${String(fulfillmentCommandSequence).padStart(12, "0")}`,
          expectedRevision,
        },
        headers: { "x-clair-demo-session-user-id": assignedToUserId ?? "user-tech" },
      },
    );
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      ok: true;
      workItems: Array<{ id: string; rowRevision: number }>;
    };
    const updated = body.workItems.find((item) => item.id === workItemId);
    expect(updated).toBeTruthy();
    expectedRevision = updated!.rowRevision;
  }
}

async function claimSyntheticWorkItem(request: APIRequestContext, item: { id: string; rowRevision: number; status: string; assignedToUserId: string | null }) {
  if (item.assignedToUserId) return { ...item, assignedToUserId: item.assignedToUserId };
  fulfillmentCommandSequence += 1;
  const response = await request.patch(`/api/workspaces/${workspaceId}/fulfillment/work-items/${item.id}`, {
    headers: technicianHeaders, data: { action: "claim", expectedRevision: item.rowRevision,
      commandId: `00000000-0000-4000-8000-${String(fulfillmentCommandSequence).padStart(12, "0")}` },
  });
  expect(response.status()).toBe(200);
  const body = await response.json() as { workItems: Array<{ id: string; status: string; rowRevision: number; assignedToUserId: string }> };
  const claimed = body.workItems.find((row) => row.id === item.id);
  expect(claimed).toMatchObject({ id: item.id, assignedToUserId: "user-tech", status: item.status, rowRevision: item.rowRevision + 1 });
  return claimed!;
}

async function expectJson(
  response: { json(): Promise<unknown> },
  expected: Record<string, unknown>,
) {
  const body = await response.json();
  expect(body).toMatchObject(expected);
}

async function claimSyntheticInvoice(request: APIRequestContext, invoiceId: string, actorUserId: string) {
  const url = `/api/workspaces/${workspaceId}/billing/assignment`;
  const headers = { "x-clair-demo-session-user-id": actorUserId };
  const before = await request.get(`${url}?invoiceId=${encodeURIComponent(invoiceId)}`, { headers });
  expect(before.status()).toBe(200);
  const body = await before.json() as { assignment: { assignedToUserId: string | null; revision: number } };
  if (body.assignment.assignedToUserId !== actorUserId) {
    expect(body.assignment.assignedToUserId).toBeNull();
    const claimed = await request.patch(url, { headers, data: {
      invoiceId, action: "claim", expectedRevision: body.assignment.revision,
    } });
    expect(claimed.status()).toBe(200);
  }
  const readback = await request.get(`${url}?invoiceId=${encodeURIComponent(invoiceId)}`, { headers });
  expect(readback.status()).toBe(200);
  await expectJson(readback, { ok: true, assignment: {
    assignedToUserId: actorUserId, canManage: true,
  } });
}

async function clearSyntheticInvoiceAssignment(request: APIRequestContext, invoiceId: string, actorUserId: string) {
  const url = `/api/workspaces/${workspaceId}/billing/assignment`;
  const headers = { "x-clair-demo-session-user-id": actorUserId };
  const before = await request.get(`${url}?invoiceId=${encodeURIComponent(invoiceId)}`, { headers });
  expect(before.status()).toBe(200);
  const body = await before.json() as { assignment: { assignedToUserId: string | null; revision: number } };
  if (body.assignment.assignedToUserId !== null) {
    expect(body.assignment.assignedToUserId).toBe(actorUserId);
    const cleared = await request.patch(url, { headers, data: {
      invoiceId, action: "unassign", expectedRevision: body.assignment.revision,
    } });
    expect(cleared.status()).toBe(200);
  }
  const readback = await request.get(`${url}?invoiceId=${encodeURIComponent(invoiceId)}`, { headers });
  expect(readback.status()).toBe(200);
  await expectJson(readback, { ok: true, assignment: { assignedToUserId: null } });
}

async function mockDownstreamDemoApis(page: Page, calls: string[]) {
  const visibleDemoInvoice = {
    id: "invoice-coco-260501",
    workspaceId,
    encounterId: "encounter-coco-260501",
    guardianId: "guardian-lee-jieun",
    invoiceNo: "API-INV-VISIBLE-260501",
    status: "paid",
    subtotalAmount: 156500,
    discountAmount: 0,
    taxAmount: 0,
    totalAmount: 156500,
    issuedAt: "2026-05-21T10:18:00+09:00",
    paidAt: "2026-05-21T10:25:00+09:00",
    paymentState: "paid",
    selectedPaymentMethod: "card",
    createdAt: "2026-05-21T10:15:00+09:00",
  };

  await page.route("**/api/workspaces/clair-demo/fulfillment/work-items?*", async (route) => {
    const url = new URL(route.request().url());
    const queueType = url.searchParams.get("queueType");
    calls.push(`fulfillment-${queueType}`);
    await route.fulfill({
      contentType: "application/json",
      json: {
        ok: true,
        status: 200,
        workItems: getUiApiFulfillmentWorkItems(queueType),
        enforcedBy: "fulfillment-work-item-read",
      },
      status: 200,
    });
  });

  await page.route("**/api/workspaces/clair-demo/fulfillment/work-items/*", async (route) => {
    calls.push("fulfillment-status-patch");
    await route.fulfill({
      contentType: "application/json",
      json: { ok: true, status: 200, workItems: [] },
      status: 200,
    });
  });

  await page.route("**/api/workspaces/clair-demo/lab-imaging/result-sheet-catalog?*", async (route) => {
    calls.push("lab-result-sheet-catalog");
    await route.fulfill({
      contentType: "application/json",
      json: {
        ok: true,
        status: 200,
        catalogItemId: "den194-catalog-cbc",
        enforcedBy: "lab-result-sheet-catalog-read",
        items: [
          {
            categoryId: "den194-labcat-hematology",
            categoryName: "Hematology",
            id: "den194-labitem-cbc-wbc",
            resultInputType: "number",
            resultUnit: "10^3/uL",
            sortOrder: 10,
            testItemName: "WBC",
          },
          {
            categoryId: "den194-labcat-hematology",
            categoryName: "Hematology",
            id: "den194-labitem-cbc-rbc",
            resultInputType: "number",
            resultUnit: "10^6/uL",
            sortOrder: 20,
            testItemName: "RBC",
          },
          {
            categoryId: "den194-labcat-hematology",
            categoryName: "Hematology",
            id: "den194-labitem-cbc-hct",
            resultInputType: "number",
            resultUnit: "%",
            sortOrder: 30,
            testItemName: "HCT",
          },
        ],
      },
      status: 200,
    });
  });

  await page.route("**/api/workspaces/clair-demo/lab-imaging/result-entries", async (route) => {
    calls.push("lab-result-entry");
    await route.fulfill({
      contentType: "application/json",
      json: {
        ok: true,
        status: 200,
        savedResult: await route.request().postDataJSON(),
        enforcedBy: "lab-result-entry-server-boundary",
      },
      status: 200,
    });
  });

  await page.route("**/api/workspaces/clair-demo/billing/invoice-lines?*", async (route) => {
    calls.push("billing-invoice-lines-get");
    await route.fulfill({
      contentType: "application/json",
      json: {
        ok: true,
        status: 200,
        enforcedBy: "billing-invoice-line-persistence",
        invoice: visibleDemoInvoice,
        lines: [
          {
            id: "invoice-line-visible-demo-cbc",
            invoiceId: visibleDemoInvoice.id,
            serviceItemId: "svc-lab-cbc",
            orderId: "order-ui-api-cbc",
            description: "Visible API billing line",
            quantity: 1,
            unitPrice: 156500,
            lineTotal: 156500,
          },
        ],
      },
      status: 200,
    });
  });

  await page.route("**/api/workspaces/clair-demo/billing/payment-status?*", async (route) => {
    calls.push("billing-payment-status-get");
    await route.fulfill({
      contentType: "application/json",
      json: {
        ok: true,
        status: 200,
        enforcedBy: "billing-payment-status-persistence",
        invoice: visibleDemoInvoice,
        payments: [
          {
            id: "payment-visible-demo-card",
            invoiceId: visibleDemoInvoice.id,
            paymentMethod: "card",
            amount: 156500,
            status: "approved",
            paidAt: "2026-05-21T10:25:00+09:00",
          },
        ],
      },
      status: 200,
    });
  });

  await page.route("**/api/workspaces/clair-demo/billing/guardian-checkout?*", async (route) => {
    calls.push("billing-checkout-get");
    await route.fulfill({
      contentType: "application/json",
      json: {
        ok: true,
        status: 200,
        rows: [
          {
            activityAt: "2026-05-21T10:25:00+09:00",
            amountInclusion: "payable",
            balanceAmount: 0,
            invoiceId: visibleDemoInvoice.id,
            payableAmount: 156500,
            status: "paid",
            totalAmount: 156500,
          },
        ],
        enforcedBy: "guardian-billing-ledger",
      },
      status: 200,
    });
  });

  await page.route("**/api/workspaces/clair-demo/billing/guardian-checkout", async (route) => {
    calls.push("billing-checkout-post");
    await route.fulfill({
      contentType: "application/json",
      json: {
        ok: true,
        status: 200,
        checkoutSession: {
          id: "ui-api-checkout-session",
          workspaceId,
          guardianId: "guardian-lee-jieun",
          status: "prepared",
          invoiceCount: 1,
          payableAmount: 156500,
          excludedCount: 0,
          paymentMethod: "card",
          createdAt: "2026-05-21T10:20:00+09:00",
          updatedAt: "2026-05-21T10:20:00+09:00",
        },
        enforcedBy: "guardian-checkout-session",
      },
      status: 200,
    });
  });

  await page.route("**/api/workspaces/clair-demo/audit/events?*", async (route) => {
    calls.push("audit-events");
    await route.fulfill({
      contentType: "application/json",
      json: {
        ok: true,
        status: 200,
        enforcedBy: "live-audit-review-reader",
        events: [
          {
            actorUserId: "user-front-desk",
            after: { paymentState: "paid", status: "paid" },
            before: { paymentState: "unpaid", status: "issued" },
            eventType: "billing.payment_state_changed",
            id: "ui-api-audit-payment",
            occurredAt: "2026-05-21T10:25:00+09:00",
            targetId: "invoice-coco-260501",
            targetType: "invoice",
            workspaceId,
          },
        ],
      },
      status: 200,
    });
  });
}

async function mockLabFulfillmentApi(page: Page) {
  await page.route("**/api/workspaces/clair-demo/fulfillment/work-items?*", async (route) => {
    const url = new URL(route.request().url());
    const queueType = url.searchParams.get("queueType");

    await route.fulfill({
      contentType: "application/json",
      json: {
        ok: true,
        status: 200,
        workItems: getUiApiFulfillmentWorkItems(queueType),
        enforcedBy: "fulfillment-work-item-read",
      },
      status: 200,
    });
  });
}

function getUiApiFulfillmentWorkItems(queueType: string | null) {
  const base = {
    assignedToUserId: "user-tech",
    createdAt: "2026-05-21T09:47:00+09:00",
    encounterId: "encounter-ui-api-kong",
    requestedByUserId: "user-vet",
    status: "requested",
    updatedAt: "2026-05-21T09:47:00+09:00",
    workspaceId,
  };

  if (queueType === "lab") {
    return [
      {
        ...base,
        id: "ui-api-lab-cbc",
        orderId: "order-ui-api-cbc",
        queueType: "lab",
        sourceSnapshot: {
          guardianName: "API Guardian Synthetic",
          orderDisplayName: "DEN-194 CBC API Lab Kong",
          patientName: "API Lab Kong",
          requestingVetName: "이수지",
          serviceItemId: "19429000-0000-4000-8000-000000000001",
        },
      },
    ];
  }

  if (queueType === "dispensing") {
    return [
      {
        ...base,
        id: "ui-api-dispensing-maropitant",
        orderId: "order-ui-api-maropitant",
        queueType: "dispensing",
        sourceSnapshot: {
          guardianName: "API Guardian Synthetic",
          orderDisplayName: "DEN-194 maropitant dispensing API",
          patientName: "API Lab Kong",
          requestingVetName: "이수지",
        },
      },
    ];
  }

  if (queueType === "treatment") {
    return [
      {
        ...base,
        id: "ui-api-treatment-fluid",
        orderId: "order-ui-api-fluid",
        queueType: "treatment",
        sourceSnapshot: {
          guardianName: "API Guardian Synthetic",
          orderDisplayName: "DEN-194 수액 처치 API",
          patientName: "API Lab Kong",
          requestingVetName: "이수지",
        },
      },
    ];
  }

  return [];
}
