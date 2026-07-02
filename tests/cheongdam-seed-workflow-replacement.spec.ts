import { expect, test, type Page } from "@playwright/test";

import { SESSION_WORKSPACES_STORAGE_KEY } from "../src/features/auth/workspace-session";
import { PREPARED_EMPTY_CLINIC_WORKSPACE_ID } from "../src/lib/emr-domain/demo-workspaces";

const workspaceId = PREPARED_EMPTY_CLINIC_WORKSPACE_ID;

const seedPatient = {
  id: "patient-cheongdam-api-happy",
  workspaceId,
  patientNo: "CD-P-API-0001",
  name: "해피",
  species: "dog",
  breed: "푸들",
  sex: "female",
  neutered: true,
  status: "active",
  createdAt: "2026-06-17T09:00:00+09:00",
  updatedAt: "2026-06-17T09:00:00+09:00",
};

const seedGuardian = {
  id: "guardian-cheongdam-api-park",
  workspaceId,
  name: "박보호",
  mobilePhone: "010-0000-6170",
  createdAt: "2026-06-17T09:00:00+09:00",
  updatedAt: "2026-06-17T09:00:00+09:00",
};

const seedEncounter = {
  id: "encounter-cheongdam-api-golden",
  workspaceId,
  patientId: seedPatient.id,
  guardianId: seedGuardian.id,
  primaryVeterinarianId: "user-vet-suji",
  encounterNo: "E-CD-API-0001",
  receptionType: "walk_in",
  chiefComplaint: "청담 seed API workflow proof",
  visitPurpose: "청담 seed API workflow proof",
  status: "waiting",
  checkedInAt: "2026-06-17T09:05:00+09:00",
  createdAt: "2026-06-17T09:05:00+09:00",
  updatedAt: "2026-06-17T09:05:00+09:00",
};

const seedQueueEntry = {
  id: "queue-cheongdam-api-golden",
  workspaceId,
  encounterId: seedEncounter.id,
  queueType: "consultation",
  status: "waiting",
  priority: "normal",
  sortOrder: 1,
  enteredAt: "2026-06-17T09:05:00+09:00",
};

const seedInvoice = {
  id: "invoice-cheongdam-api-live",
  workspaceId,
  encounterId: seedEncounter.id,
  guardianId: seedGuardian.id,
  invoiceNo: "LIVE-E-CD-API-0001",
  status: "draft",
  subtotalAmount: 35000,
  discountAmount: 0,
  taxAmount: 0,
  totalAmount: 35000,
  createdAt: "2026-06-17T09:25:00+09:00",
  paymentState: "none",
};

const seedPaidInvoice = {
  ...seedInvoice,
  status: "paid",
  paidAt: "2026-06-17T09:45:00+09:00",
  paymentState: "paid",
  selectedPaymentMethod: "card",
};

const seedPayment = {
  id: "payment-cheongdam-api-card",
  invoiceId: seedInvoice.id,
  paymentMethod: "card",
  amount: 35000,
  status: "approved",
  paidAt: "2026-06-17T09:45:00+09:00",
  metadata: { source: "cheongdam-seed-workflow-replacement" },
};

test("Cheongdam seed/API workflow replaces legacy Kong scenario coverage across modules", async ({
  page,
}) => {
  test.setTimeout(60_000);

  const calls: string[] = [];
  await grantCheongdamWorkspaceAccess(page);
  await seedChartEncounterHandoff(page);
  await mockCheongdamReceptionApi(page, calls);
  await mockCheongdamChartApi(page, calls);
  await mockCheongdamFulfillmentApi(page, calls);
  await mockCheongdamBillingApi(page, calls);

  await page.goto(
    `/w/${workspaceId}/reception?encounterId=${seedEncounter.id}&modulePanel=open&aside=closed`
  );

  await expect(page.getByTestId(`patient-card-${seedPatient.id}`)).toContainText("해피");
  await expect(page.getByRole("link", { name: "진료/차트" })).toHaveAttribute(
    "href",
    new RegExp(`/w/${workspaceId}/treatment\\?encounterId=${seedEncounter.id}`)
  );
  await expectNoLegacyFixture(page);

  await page.getByRole("link", { name: "진료/차트" }).click();
  await expect(page).toHaveURL(new RegExp(`/w/${workspaceId}/treatment`));
  await expect(page).not.toHaveURL(/scenario=kong-vomit/);
  await expect(page.getByLabel("환자 컨텍스트 정보").getByText("해피")).toBeVisible();
  await expect(page.getByTestId(`order-queue-item-${seedEncounter.id}`)).toContainText("해피");
  await expectNoLegacyFixture(page);

  await page.getByRole("link", { name: "임상병리검사" }).click();
  await expect(page).toHaveURL(new RegExp(`/w/${workspaceId}/lab`));
  await expect(page.getByTestId("lab-queue-item-live-lab-work-cheongdam-api-lab")).toContainText(
    "해피"
  );
  await expect(page.getByTestId("lab-queue-item-live-lab-work-cheongdam-api-lab")).toContainText(
    "CBC 검사"
  );
  await expectNoLegacyFixture(page);

  await page.getByRole("link", { name: "영상검사" }).click();
  await expect(page).toHaveURL(new RegExp(`/w/${workspaceId}/imaging`));
  await expect(
    page.getByTestId("imaging-queue-item-live-imaging-work-cheongdam-api-imaging")
  ).toContainText("해피");
  await expect(
    page.getByTestId("imaging-queue-item-live-imaging-work-cheongdam-api-imaging")
  ).toContainText("복부 초음파");
  await expectNoLegacyFixture(page);

  await page.getByRole("link", { name: "조제/처치" }).click();
  await expect(page).toHaveURL(new RegExp(`/w/${workspaceId}/dispensing`));
  await expect(
    page.getByTestId("order-queue-item-live-fulfillment-work-cheongdam-api-dispensing")
  ).toContainText("항구토제 3일분");
  await expectNoLegacyFixture(page);

  await page.getByRole("link", { name: "수납" }).click();
  await expect(page).toHaveURL(new RegExp(`/w/${workspaceId}/billing`));
  await expect(page).not.toHaveURL(/scenario=kong-vomit/);
  await expect(page.getByText("박보호 · 해피")).toBeVisible();
  await expect(
    page.getByRole("table", { name: "청구 항목 테이블" }).locator("tbody tr", {
      hasText: "청담 API CBC 검사",
    })
  ).toContainText("35,000원");
  await expectNoLegacyFixture(page);

  await page.getByRole("button", { name: "담당하기", exact: true }).click();
  await page.getByRole("button", { name: "수납 완료", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "수납 완료 전 확인" })).toBeVisible();
  await page.getByRole("button", { name: "수납 완료 저장", exact: true }).click();
  await expect(page.getByText("수납완료").first()).toBeVisible();
  await expect(page.getByRole("cell", { name: "합산 제외", exact: true })).toBeVisible();
  await expectNoLegacyFixture(page);

  expect(calls).toEqual(
      expect.arrayContaining([
        "reception-profile-lookup",
        "reception-calendar",
        "chart-live-queue",
        "fulfillment-lab",
        "fulfillment-imaging",
      "fulfillment-dispensing",
      "billing-invoice-candidates",
      "billing-checkout-post",
      "billing-checkout-patch",
    ])
  );
});

async function grantCheongdamWorkspaceAccess(page: Page) {
  await page.addInitScript(
    ([storageKey, workspaceId]) => {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          currentWorkspaceId: workspaceId,
          workspaces: [
            {
              id: workspaceId,
              displayName: "VIP동물의료센터 청담점",
              representativeName: "김승욱",
              contactEmail: "owner@cheongdam.test",
              contactPhone: null,
              subscriptionStatus: "trialing",
              createdBySessionId: "playwright-default-session",
              createdAt: "2026-06-17T00:00:00.000Z",
            },
          ],
          memberships: [
            {
              id: "membership-cheongdam-playwright-admin",
              workspaceId,
              userSessionId: "playwright-default-session",
              displayName: "Playwright Admin",
              email: "admin@cheongdam.test",
              roles: ["hospital_admin"],
              status: "active",
              createdAt: "2026-06-17T00:00:00.000Z",
              activatedAt: "2026-06-17T00:00:00.000Z",
            },
          ],
          invitations: [],
          updatedAt: "2026-06-17T00:00:00.000Z",
        })
      );
    },
    [SESSION_WORKSPACES_STORAGE_KEY, workspaceId]
  );
}

async function seedChartEncounterHandoff(page: Page) {
  await page.addInitScript(
    ([encounter, guardian, patient]) => {
      window.sessionStorage.setItem(
        "clair-emr:chart-live-encounter-handoffs:v1",
        JSON.stringify({
          [encounter.id]: {
            encounter,
            patient,
            primaryGuardian: guardian,
            updatedAt: encounter.updatedAt,
            veterinarianName: "이수지",
          },
        })
      );
    },
    [seedEncounter, seedGuardian, seedPatient]
  );
}

async function mockCheongdamReceptionApi(page: Page, calls: string[]) {
  await page.route(`**/api/workspaces/${workspaceId}/reception/patient-guardian-lookup?*`, async (route) => {
    calls.push("reception-profile-lookup");
    await route.fulfill({
      contentType: "application/json",
      json: {
        ok: true,
        enforcedBy: "reception-patient-guardian-lookup",
        patients: [
          {
            patient: seedPatient,
            primaryGuardian: seedGuardian,
            searchText: "해피 박보호 청담 seed api",
          },
        ],
      },
      status: 200,
    });
  });

  await page.route(`**/api/workspaces/${workspaceId}/reception/calendar/day?*`, async (route) => {
    calls.push("reception-calendar");
    await route.fulfill({
      contentType: "application/json",
      json: {
        ok: true,
        status: 200,
        workspaceId,
        date: "2026-06-17",
        records: [{ encounter: seedEncounter, queueEntry: seedQueueEntry }],
        enforcedBy: "reception-calendar-read",
      },
      status: 200,
    });
  });

  await page.route(`**/api/workspaces/${workspaceId}/reception/queue`, async (route) => {
    calls.push("reception-queue");
    await route.fulfill({
      contentType: "application/json",
      json: {
        ok: true,
        status: 200,
        queue: [{ encounter: seedEncounter, queueEntry: seedQueueEntry }],
        enforcedBy: "reception-queue-read",
      },
      status: 200,
    });
  });
}

async function mockCheongdamChartApi(page: Page, calls: string[]) {
  await page.route(`**/api/workspaces/${workspaceId}/chart/live-queue**`, async (route) => {
    calls.push("chart-live-queue");
    await route.fulfill({
      contentType: "application/json",
      json: {
        ok: true,
        status: 200,
        queue: [
          {
            encounter: seedEncounter,
            patient: seedPatient,
            primaryGuardian: seedGuardian,
            queueEntry: seedQueueEntry,
          },
        ],
        enforcedBy: "chart-live-queue-read",
      },
      status: 200,
    });
  });

  await page.route(`**/api/workspaces/${workspaceId}/chart/soap-notes?*`, async (route) => {
    await route.fulfill({ contentType: "application/json", json: { ok: true, status: 200, soapNote: null }, status: 200 });
  });
  await page.route(`**/api/workspaces/${workspaceId}/chart/diagnoses?*`, async (route) => {
    await route.fulfill({ contentType: "application/json", json: { ok: true, status: 200, diagnoses: [] }, status: 200 });
  });
  await page.route(`**/api/workspaces/${workspaceId}/chart/completion?*`, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: {
        ok: true,
        status: 200,
        completion: {
          encounterId: seedEncounter.id,
          workspaceId,
          status: "waiting",
          updatedAt: seedEncounter.updatedAt,
        },
      },
      status: 200,
    });
  });
  await page.route(`**/api/workspaces/${workspaceId}/chart/order-drafts?*`, async (route) => {
    await route.fulfill({ contentType: "application/json", json: { ok: true, status: 200, orderDrafts: [] }, status: 200 });
  });
  await page.route(`**/api/workspaces/${workspaceId}/chart/order-actions?*`, async (route) => {
    await route.fulfill({ contentType: "application/json", json: { ok: true, status: 200, orderActions: [] }, status: 200 });
  });
  await page.route(`**/api/workspaces/${workspaceId}/chart/order-lifecycle?*`, async (route) => {
    await route.fulfill({ contentType: "application/json", json: { ok: true, status: 200, lifecycles: [] }, status: 200 });
  });
}

async function mockCheongdamFulfillmentApi(page: Page, calls: string[]) {
  await page.route(`**/api/workspaces/${workspaceId}/fulfillment/work-items?*`, async (route) => {
    const url = new URL(route.request().url());
    const queueType = url.searchParams.get("queueType");
    calls.push(`fulfillment-${queueType}`);
    await route.fulfill({
      contentType: "application/json",
      json: {
        ok: true,
        status: 200,
        workItems: getCheongdamFulfillmentWorkItems(queueType),
        enforcedBy: "fulfillment-work-item-read",
      },
      status: 200,
    });
  });

  await page.route(`**/api/workspaces/${workspaceId}/lab-imaging/result-sheet-catalog?*`, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: {
        ok: true,
        status: 200,
        catalogItemId: "cheongdam-api-cbc-catalog",
        enforcedBy: "lab-result-sheet-catalog-read",
        items: [
          {
            categoryId: "cheongdam-api-hematology",
            categoryName: "Hematology",
            id: "cheongdam-api-wbc",
            resultInputType: "number",
            resultUnit: "10^3/uL",
            sortOrder: 10,
            testItemName: "WBC",
          },
        ],
      },
      status: 200,
    });
  });
}

async function mockCheongdamBillingApi(page: Page, calls: string[]) {
  await page.route(`**/api/workspaces/${workspaceId}/billing/invoice-candidates?*`, async (route) => {
    calls.push("billing-invoice-candidates");
    await route.fulfill({
      contentType: "application/json",
      json: {
        ok: true,
        status: 200,
        candidates: [
          {
            billingCandidateId: "billcand-cheongdam-api-cbc",
            description: "청담 API CBC 검사",
            invoiceId: "invoice-cheongdam-api-live",
            lineTotal: 35000,
            orderId: "order-cheongdam-api-cbc",
            quantity: 1,
            unitPrice: 35000,
          },
        ],
        enforcedBy: "billing-invoice-candidate-sync",
      },
      status: 200,
    });
  });

  await page.route(`**/api/workspaces/${workspaceId}/billing/guardian-checkout`, async (route) => {
    const method = route.request().method();
    if (method === "PATCH") {
      calls.push("billing-checkout-patch");
      await route.fulfill({
        contentType: "application/json",
        json: {
          ok: true,
          status: 200,
          enforcedBy: "billing-invoice-status-transition",
          invoice: seedPaidInvoice,
          payments: [seedPayment],
        },
        status: 200,
      });
      return;
    }

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
          id: "checkout-cheongdam-api-live",
          payableAmount: seedInvoice.totalAmount,
          selectedInvoiceIds: [seedInvoice.id],
          status: "prepared",
        },
        invoiceSnapshots: [
          {
            amountInclusion: "payable",
            balanceAmount: seedInvoice.totalAmount,
            invoiceId: seedInvoice.id,
            payableAmount: seedInvoice.totalAmount,
          },
        ],
      },
      status: 200,
    });
  });
}

function getCheongdamFulfillmentWorkItems(queueType: string | null) {
  const base = {
    assignedToUserId: null,
    createdAt: "2026-06-17T09:15:00+09:00",
    encounterId: seedEncounter.id,
    requestedByUserId: "user-vet-suji",
    status: "requested",
    updatedAt: "2026-06-17T09:15:00+09:00",
    workspaceId,
  };

  if (queueType === "lab") {
    return [
      {
        ...base,
        id: "work-cheongdam-api-lab",
        orderId: "order-cheongdam-api-cbc",
        queueType: "lab",
        sourceSnapshot: {
          guardianName: seedGuardian.name,
          instruction: "CBC 우선 확인",
          orderDisplayName: "CBC 검사",
          patientName: seedPatient.name,
          requestingVetName: "이수지",
          serviceItemId: "svc-live-cbc",
        },
      },
    ];
  }

  if (queueType === "imaging") {
    return [
      {
        ...base,
        id: "work-cheongdam-api-imaging",
        orderId: "order-cheongdam-api-imaging",
        queueType: "imaging",
        sourceSnapshot: {
          guardianName: seedGuardian.name,
          instruction: "복부 초음파 촬영",
          orderDisplayName: "복부 초음파",
          patientName: seedPatient.name,
          requestingVetName: "이수지",
        },
      },
    ];
  }

  if (queueType === "dispensing") {
    return [
      {
        ...base,
        id: "work-cheongdam-api-dispensing",
        orderId: "order-cheongdam-api-maropitant",
        queueType: "dispensing",
        sourceSnapshot: {
          guardianName: seedGuardian.name,
          instruction: "식후 1일 2회",
          orderDisplayName: "항구토제 3일분",
          patientName: seedPatient.name,
          requestingVetName: "이수지",
        },
      },
    ];
  }

  return [];
}

async function expectNoLegacyFixture(page: Page) {
  await expect(page.getByText("콩이")).toHaveCount(0);
  await expect(page.getByText("코코")).toHaveCount(0);
  await expect(page.getByText("나비")).toHaveCount(0);
  await expect(page.getByText("26.05.01")).toHaveCount(0);
  await expect(page).not.toHaveURL(/scenario=kong-vomit/);
}
