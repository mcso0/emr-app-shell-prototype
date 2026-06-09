import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const workspaceId = "clair-demo";
const kongEncounterId = "encounter-kong-260501";
const apiHeaders = { "x-clair-demo-session-user-id": "user-vet" };
const frontDeskHeaders = { "x-clair-demo-session-user-id": "user-front-desk" };
const technicianHeaders = { "x-clair-demo-session-user-id": "user-tech" };
const uiApiWbcCatalogItem = {
  categoryId: "den194-labcat-hematology",
  categoryName: "Hematology",
  id: "den194-labitem-cbc-wbc",
  resultInputType: "number",
  resultUnit: "10^3/uL",
  sortOrder: 10,
  testItemName: "WBC",
};

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

  await page.goto("/w/clair-demo/reception?modulePanel=open");

  await expect(page.getByTestId(`patient-card-${uiApiPatient.id}`)).toContainText(
    "API Kong Synthetic",
  );
  expect(calls).toEqual(
    expect.arrayContaining([
      "reception-profile-lookup",
      "reception-calendar",
      "reception-queue",
    ]),
  );

  await mockChartApi(page, calls);
  await page.goto("/w/clair-demo/treatment?modulePanel=open&aside=closed");

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
  const confirmed = await request.patch(
    `/api/workspaces/${workspaceId}/chart/order-actions`,
    {
      data: { action: "confirm", encounterId: kongEncounterId, orderIds },
      headers: apiHeaders,
    },
  );
  expect(confirmed.status()).toBe(200);
  await expectJson(confirmed, {
    ok: true,
    enforcedBy: "chart-order-action-persistence",
  });

  const labWorkItem = await readWorkItem(request, "lab", "order-kong-cbc");
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
      headers: technicianHeaders,
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

  await advanceWorkItemToCompleted(request, labWorkItem.id, labWorkItem.status);
  const imagingWorkItem = await readWorkItem(
    request,
    "imaging",
    "order-kong-abdomen",
  );
  await advanceWorkItemToCompleted(
    request,
    imagingWorkItem.id,
    imagingWorkItem.status,
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

  await page.goto("/w/clair-demo/lab?modulePanel=open&aside=closed");
  const liveLabQueueItem = page.getByTestId("lab-queue-item-live-lab-ui-api-lab-cbc");
  await expect(liveLabQueueItem).toContainText("API Lab Kong");
  await liveLabQueueItem.click();
  await expect(
    page.getByTestId("lab-result-input-live-lab-ui-api-lab-cbc-den194-labitem-cbc-wbc"),
  ).toBeVisible();
  await page
    .getByTestId("lab-result-input-live-lab-ui-api-lab-cbc-den194-labitem-cbc-wbc")
    .fill("21.4");
  await page.getByTestId("lab-result-save-button").click();
  await expect(page.getByTestId("lab-result-save-status")).toContainText("서버 저장됨");

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
      "lab-result-sheet-catalog",
      "lab-result-entry",
      "billing-checkout-post",
      "audit-events",
    ]),
  );
});

test("lab result UI exposes catalog retry and save retry states", async ({ page }) => {
  let catalogAttempts = 0;
  let saveAttempts = 0;
  await mockLabFulfillmentApi(page);

  await page.route("**/api/workspaces/clair-demo/lab-imaging/result-sheet-catalog?*", async (route) => {
    catalogAttempts += 1;
    if (catalogAttempts === 1) {
      await route.fulfill({
        contentType: "application/json",
        json: { ok: false, status: 500, error: "forced_catalog_failure" },
        status: 500,
      });
      return;
    }

    await route.fulfill({
      contentType: "application/json",
      json: {
        ok: true,
        status: 200,
        catalogItemId: "den194-catalog-cbc",
        enforcedBy: "lab-result-sheet-catalog-read",
        items: [uiApiWbcCatalogItem],
      },
      status: 200,
    });
  });

  await page.route("**/api/workspaces/clair-demo/lab-imaging/result-entries", async (route) => {
    saveAttempts += 1;
    if (saveAttempts === 1) {
      await route.fulfill({
        contentType: "application/json",
        json: { ok: false, status: 500, error: "forced_save_failure" },
        status: 500,
      });
      return;
    }

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

  await page.goto("/w/clair-demo/lab?modulePanel=open&aside=closed");
  await page.getByTestId("lab-queue-item-live-lab-ui-api-lab-cbc").click();

  await expect(page.getByTestId("lab-result-catalog-status")).toContainText(
    "결과지 항목을 불러오지 못했습니다.",
  );
  await page.getByTestId("lab-result-catalog-retry-button").click();
  await expect(
    page.getByTestId("lab-result-input-live-lab-ui-api-lab-cbc-den194-labitem-cbc-wbc"),
  ).toBeVisible();

  await page
    .getByTestId("lab-result-input-live-lab-ui-api-lab-cbc-den194-labitem-cbc-wbc")
    .fill("21.4");
  await page.getByTestId("lab-result-save-button").click();
  await expect(page.getByTestId("lab-result-save-status")).toContainText("저장 실패");
  await page.getByTestId("lab-result-save-retry-button").click();
  await expect(page.getByTestId("lab-result-save-status")).toContainText("서버 저장됨");
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
        date: "2026-05-01",
        records: [{ encounter: uiApiEncounter, queueEntry: uiApiQueueEntry }],
        enforcedBy: "reception-calendar-read",
      },
      status: 200,
    });
  });

  await page.route("**/api/workspaces/clair-demo/reception/queue", async (route) => {
    calls.push("reception-queue");
    await route.fulfill({
      contentType: "application/json",
      json: {
        ok: true,
        status: 200,
        queue: [{ encounter: uiApiEncounter, queueEntry: uiApiQueueEntry }],
        enforcedBy: "reception-queue-read",
      },
      status: 200,
    });
  });
}

async function mockChartApi(page: Page, calls: string[]) {
  await page.route("**/api/workspaces/clair-demo/chart/live-queue", async (route) => {
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
    workItems: Array<{ id: string; orderId: string; status: string }>;
  };
  const item = body.workItems.find((workItem) => workItem.orderId === orderId);
  expect(item).toBeTruthy();
  return item!;
}

async function advanceWorkItemToCompleted(
  request: APIRequestContext,
  workItemId: string,
  initialStatus: string,
) {
  const statuses =
    initialStatus === "requested"
      ? ["accepted", "in_progress", "completed"]
      : initialStatus === "accepted"
        ? ["in_progress", "completed"]
        : ["completed"];

  for (const status of statuses) {
    const response = await request.patch(
      `/api/workspaces/${workspaceId}/fulfillment/work-items/${workItemId}`,
      {
        data: { assignedToUserId: "user-tech", status },
        headers: technicianHeaders,
      },
    );
    expect(response.status()).toBe(200);
  }
}

async function expectJson(
  response: { json(): Promise<unknown> },
  expected: Record<string, unknown>,
) {
  const body = await response.json();
  expect(body).toMatchObject(expected);
}

async function mockDownstreamDemoApis(page: Page, calls: string[]) {
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
      json: { ok: false, status: 404, error: "test_keeps_fixture_invoice_lines" },
      status: 404,
    });
  });

  await page.route("**/api/workspaces/clair-demo/billing/payment-status?*", async (route) => {
    calls.push("billing-payment-status-get");
    await route.fulfill({
      contentType: "application/json",
      json: { ok: false, status: 404, error: "test_keeps_fixture_payment_status" },
      status: 404,
    });
  });

  await page.route("**/api/workspaces/clair-demo/billing/guardian-checkout?*", async (route) => {
    calls.push("billing-checkout-get");
    await route.fulfill({
      contentType: "application/json",
      json: {
        ok: true,
        status: 200,
        rows: [],
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
