import {
  expect,
  test,
  type Locator,
  type Page,
  type Route,
} from "@playwright/test";

import { createMockOrderCatalogGateway } from "../src/features/hospital-admin/server-order-catalog-core";
import { SESSION_WORKSPACES_STORAGE_KEY } from "../src/features/auth/workspace-session";
import type { ChartLiveQueueRecord } from "../src/features/chart/chart-live-queue";
import { chartOrderExpectedEtagHeader } from "../src/features/chart/order-version-contract";
import {
  addDaysToIsoDate,
  formatCompactKoreanOperatingDateLabel,
  getCurrentOperatingDate,
} from "../src/lib/emr-domain/demo-date";
import { PREPARED_EMPTY_CLINIC_WORKSPACE_ID } from "../src/lib/emr-domain/demo-workspaces";

const kongScenarioUrl =
  "/w/clair-demo/treatment?scenario=kong-vomit&patientId=patient-kong&encounterId=encounter-kong-260501&modulePanel=open&aside=closed";
const chartFigmaVisualFixture = {
  expectedContentSize: { height: 968, width: 1540 },
  expectedPanelWidths: [567, 567, 375],
  expectedRows: [452, 8, 452],
  route:
    "/w/clair-demo/treatment?scenario=kong-vomit&patientId=patient-kong&encounterId=encounter-kong-260501&modulePanel=closed&aside=closed",
  viewport: { height: 1088, width: 1624 },
} as const;
const kongEncounterId = "encounter-kong-260501";
const kongSoapFields = {
  subjective:
    "보호자 진술상 전날 밤부터 구토 3회, 아침 식욕 없음. 물 섭취 후 재구토.",
  objective: "체온 39.1C, 복부 촉진 시 경미한 불편감. 탈수 경도 의심.",
  assessment:
    "급성 위장관염 의심. 이물 가능성 배제를 위해 검사/영상 확인 필요.",
  plan: "CBC, 혈청화학, 복부 영상 확인. 피하 수액과 항구토제 처방 후 수납 안내.",
} as const;
const kongDefaultOrderDraftRows = [
  {
    rowType: "individual" as const,
    orderId: "order-kong-maropitant",
    workspaceCatalogItemId: "svc-med-maropitant",
    quantity: 1,
    detailSchemaVersion: 1,
    detailInputs: {
      doseBasis: "patient",
      dose: 16,
      doseUnit: "mg",
      route: "PO",
      frequency: "once",
      durationDays: 1,
      totalQuantity: 1,
    },
  },
  {
    rowType: "individual" as const,
    orderId: "order-kong-cbc",
    workspaceCatalogItemId: "svc-lab-cbc",
    quantity: 1,
    detailSchemaVersion: 1,
    detailInputs: {
      specimenType: "blood",
      testPanel: "CBC",
      collectionCondition: "EDTA 전혈",
    },
  },
  {
    rowType: "individual" as const,
    orderId: "order-kong-fluid",
    workspaceCatalogItemId: "svc-treatment-fluid",
    quantity: 1,
    detailSchemaVersion: 1,
    detailInputs: {
      method: "피하 수액",
      site: "등쪽 피하",
      administeredAmount: 100,
      frequency: "once",
      schedule: "즉시",
    },
  },
  {
    rowType: "individual" as const,
    orderId: "order-kong-abdomen",
    workspaceCatalogItemId: "svc-imaging-abdomen",
    quantity: 1,
    detailSchemaVersion: 1,
    detailInputs: {
      bodyRegion: "복부",
      position: "VD/LAT",
      viewCount: 2,
      contrastRequired: false,
      sedationRequired: false,
    },
  },
];

async function expectTopEdgeInViewport(page: Page, locator: Locator) {
  const box = await locator.boundingBox();
  const viewportHeight =
    page.viewportSize()?.height ??
    (await page.evaluate(() => window.innerHeight));

  expect(box).not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeLessThan(viewportHeight);
}

async function tabBackwardTo(page: Page, target: Locator, maxSteps: number) {
  for (let step = 0; step < maxSteps; step += 1) {
    await page.keyboard.press("Shift+Tab");
    if (
      await target.evaluate((element) => element === document.activeElement)
    ) {
      return;
    }
  }

  throw new Error("키보드 역방향 탭 순서에서 목표 요소를 찾지 못했습니다.");
}

async function getChartOrderAction(page: Page, name: string | RegExp) {
  await page.getByRole("button", { name: "Plan/Order 작업" }).click();
  const action = page.getByRole("menuitem", { name });
  await expect(action).toBeVisible();
  return action;
}

function getChartSelectedOrderConfirmAction(page: Page) {
  return page
    .getByRole("toolbar", { name: "선택 행 작업" })
    .getByRole("button", { name: "선택 확정" });
}

async function dismissChartOrderActionMenu(page: Page) {
  const menu = page.getByRole("menu", { name: "Plan/Order 작업" });
  await expect(menu).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
}

async function openChartOrderDetail(page: Page, orderName: string) {
  const row = page
    .getByRole("row")
    .filter({ has: page.getByText(orderName, { exact: true }) })
    .first();
  await row.hover();
  await row.getByRole("button", { name: `${orderName} 상세` }).click();
  const detail = page.getByRole("dialog", { name: `${orderName} 상세` });
  await expect(detail).toBeVisible();
  return detail;
}

async function routePristineKongSoap(page: Page) {
  await page.route(
    "**/api/workspaces/clair-demo/chart/soap-notes?*",
    async (route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }
      const encounterId = new URL(route.request().url()).searchParams.get(
        "encounterId",
      );
      if (encounterId !== kongEncounterId) {
        await route.continue();
        return;
      }
      await route.fulfill({
        contentType: "application/json",
        status: 200,
        json: {
          ok: true,
          status: 200,
          enforcedBy: "chart-soap-note-persistence",
          soapNote: {
            id: "soap-kong-260501",
            encounterId: kongEncounterId,
            authorUserId: "user-vet-suji",
            ...kongSoapFields,
            status: "autosaved",
            createdAt: "2026-05-01T09:40:00+09:00",
            updatedAt: "2026-05-01T10:16:00+09:00",
          },
        },
      });
    },
  );
}

async function routePopulatedKongCurrentChartAssessment(page: Page) {
  await page.route(
    "**/api/workspaces/clair-demo/chart/diagnoses?*",
    async (route) => {
      const url = new URL(route.request().url());
      if (
        route.request().method() !== "GET" ||
        url.searchParams.get("encounterId") !== kongEncounterId ||
        url.searchParams.get("chartId") !== "soap-kong-260501"
      ) {
        await route.fallback();
        return;
      }

      const response = await route.fetch();
      const body = (await response.json()) as {
        diagnoses?: Array<{ id?: string }>;
      };
      const assessment = body.diagnoses?.find(
        (diagnosis) => diagnosis.id === "diagnosis-kong-gastroenteritis",
      );
      if (!assessment) {
        throw new Error("Kong diagnosis fixture is missing");
      }
      await route.fulfill({
        response,
        json: { ...body, assessments: [assessment] },
      });
    },
  );
}

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
              createdAt: "2026-06-14T00:00:00.000Z",
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
              createdAt: "2026-06-14T00:00:00.000Z",
              activatedAt: "2026-06-14T00:00:00.000Z",
            },
          ],
          invitations: [],
          updatedAt: "2026-06-14T00:00:00.000Z",
        }),
      );
    },
    [SESSION_WORKSPACES_STORAGE_KEY, PREPARED_EMPTY_CLINIC_WORKSPACE_ID],
  );
}

function createLiveChartQueueRecord({
  encounterId,
  patientName,
  sortOrder,
}: {
  encounterId: string;
  patientName: string;
  sortOrder: number;
}): ChartLiveQueueRecord {
  const workspaceId = PREPARED_EMPTY_CLINIC_WORKSPACE_ID;
  const patientId = `patient-${encounterId}`;
  const guardianId = `guardian-${encounterId}`;
  const updatedAt = "2026-08-14T11:00:00+09:00";

  return {
    encounter: {
      id: encounterId,
      workspaceId,
      patientId,
      guardianId,
      primaryVeterinarianId: "user-vet",
      encounterNo: `E-${encounterId}`,
      visitPurpose: "일반 진료",
      chiefComplaint: `${patientName} 진료`,
      status: "in_consultation",
      checkedInAt: updatedAt,
      startedAt: updatedAt,
      createdAt: updatedAt,
      updatedAt,
    },
    patient: {
      id: patientId,
      workspaceId,
      patientNo: `P-${encounterId}`,
      name: patientName,
      species: "dog",
      breed: "Pomeranian",
      estimatedAgeText: "9세",
      sex: "male",
      handlingCautionLocked: false,
      status: "active",
      createdAt: updatedAt,
      updatedAt,
    },
    primaryGuardian: {
      id: guardianId,
      workspaceId,
      name: `${patientName} 보호자`,
      mobilePhone: "010-0000-0000",
      createdAt: updatedAt,
      updatedAt,
    },
    queueEntry: {
      id: `queue-${encounterId}`,
      workspaceId,
      encounterId,
      queueType: "consultation",
      status: "in_progress",
      priority: "normal",
      sortOrder,
      enteredAt: updatedAt,
    },
    veterinarianName: "이수지",
  };
}

async function fulfillLiveChartQueue(
  route: Route,
  queue: ChartLiveQueueRecord[],
) {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      ok: true,
      status: 200,
      enforcedBy: "chart-live-queue-read",
      queue,
    }),
  });
}
async function routePreconsultationContext(
  page: Page,
  resolveContext: (encounterId: string) => Record<string, unknown>,
) {
  await page.route(
    "**/api/workspaces/*/chart/preconsultation-context?*",
    async (route) => {
      const encounterId =
        new URL(route.request().url()).searchParams.get("encounterId") ?? "";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          canWriteVitals: true,
          enforcedBy: "chart-preconsultation-context-read",
          context: resolveContext(encounterId),
        }),
      });
    },
  );
}

async function saveKongOrderDraftRows(
  page: Page,
  rows: ReadonlyArray<Record<string, unknown>>,
  {
    chartId,
    removeOmittedTopLevelRows = false,
  }: { chartId?: string; removeOmittedTopLevelRows?: boolean } = {},
) {
  const current = await page.request.get(
    `/api/workspaces/clair-demo/chart/order-drafts?encounterId=${kongEncounterId}`,
    { headers: { "x-clair-demo-session-user-id": "user-vet" } },
  );
  expect(current.status()).toBe(200);
  const currentBody = (await current.json()) as {
    etag: string;
    rows?: Array<Record<string, unknown>>;
  };
  const retainedOrderIds = new Set(
    rows.flatMap((row) =>
      typeof row.orderId === "string" ? [row.orderId] : [],
    ),
  );
  const removedOrderIds = removeOmittedTopLevelRows
    ? (currentBody.rows ?? []).flatMap((row) => {
        const orderId = typeof row.orderId === "string" ? row.orderId : null;
        const rowType = typeof row.rowType === "string" ? row.rowType : null;
        return orderId &&
          rowType !== "set_child" &&
          !retainedOrderIds.has(orderId)
          ? [orderId]
          : [];
      })
    : [];
  const response = await page.request.patch(
    "/api/workspaces/clair-demo/chart/order-drafts",
    {
      data: {
        ...(chartId ? { chartId } : {}),
        encounterId: kongEncounterId,
        expectedEtag: currentBody.etag,
        removedOrderIds,
        rows,
      },
      headers: {
        [chartOrderExpectedEtagHeader]: currentBody.etag,
        "x-clair-demo-session-user-id": "user-vet",
      },
    },
  );
  expect(response.status(), await response.text()).toBe(200);
}

async function restoreKongOrderDraftDefaults(page: Page) {
  await saveKongOrderDraftRows(page, kongDefaultOrderDraftRows, {
    chartId: "soap-kong-260501",
    removeOmittedTopLevelRows: true,
  });
  await page.reload();
  await page.waitForLoadState("networkidle");

  const billingName = page.getByLabel("Maropitant 16mg T 청구서명 수정");
  const quantity = page.getByLabel("Maropitant 16mg T 수량 수정");
  const updateButton = await getChartOrderAction(page, /Order 업데이트/);

  await expect(billingName).toBeVisible();
  await billingName.fill("Maropitant 16mg T");
  await quantity.fill("1");

  if (await updateButton.isEnabled()) {
    await updateButton.click();
    await expect(page.getByText(/변경 대기/)).toHaveCount(0);
    await expect(
      await getChartOrderAction(page, /Order 업데이트/),
    ).toBeDisabled();
    await dismissChartOrderActionMenu(page);
  } else {
    await dismissChartOrderActionMenu(page);
  }

  await expect(quantity).toHaveValue("1");
  await expect(billingName).toHaveValue(/.+/);
}

async function searchChartOrderCatalog(
  dialog: Locator,
  query: string,
  categoryLabel = "전체",
) {
  await dialog
    .getByRole("button", { name: `${categoryLabel} 오더 검색 열기` })
    .click();
  await dialog
    .getByRole("combobox", {
      name: `${categoryLabel} 오더 검색`,
      exact: true,
    })
    .fill(query);
}

async function confirmChartOrderCatalogSelection(
  dialog: Locator,
  count: number,
) {
  await expect(
    dialog.getByText(`선택한 오더 ${count}개`, { exact: true }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "선택 완료", exact: true }).click();
}

test("waiting chart saves and clears only today's vital values through the dialog", async ({
  page,
}) => {
  const workspaceId = "clair-demo";
  const encounterId = "encounter-haru-260430";
  let vital: Record<string, unknown> | null = null;
  const writes: Record<string, unknown>[] = [];
  const context = () => ({
    encounter: {
      id: encounterId,
      encounterNo: "E-260430-0005",
      receptionType: "walk_in",
      visitPurpose: "예방접종",
      chiefComplaint: "예방접종 전 건강 확인",
      checkedInAt: "2026-04-30T16:05:00+09:00",
      status: "waiting",
    },
    queue: { id: "queue-haru-consultation", status: "waiting" },
    patient: {
      id: "patient-haru",
      patientNo: "P-HARU",
      name: "하루",
      species: "cat",
      breed: "Korean Shorthair",
      estimatedAgeText: "2세",
      sex: "female",
    },
    guardian: { id: "guardian-kang-seoyun", name: "강서윤" },
    veterinarian: { id: "user-vet", displayName: "이수지" },
    priorEncounterCount: 1,
    vitals: vital ? [vital] : [],
    history: [],
  });

  await page.route(
    "**/api/workspaces/*/chart/preconsultation-context?*",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          canWriteVitals: true,
          enforcedBy: "chart-preconsultation-context-read",
          context: context(),
        }),
      });
    },
  );
  await page.route(
    "**/api/workspaces/*/chart/encounter-vitals",
    async (route) => {
      expect(route.request().method()).toBe("PATCH");
      const body = (await route.request().postDataJSON()) as {
        encounterId: string;
        vitals: Record<string, unknown>;
      };
      expect(body.encounterId).toBe(encounterId);
      writes.push(body.vitals);
      vital = {
        id: "vital-haru-today",
        encounterId,
        measuredAt: "2026-07-20T09:30:00.000Z",
        ...Object.fromEntries(
          Object.entries(body.vitals).filter(([, value]) => value !== null),
        ),
      };
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          enforcedBy: "patient-vital-write",
          vital,
        }),
      });
    },
  );

  await page.goto(
    `/w/${workspaceId}/treatment?modulePanel=open&aside=closed&encounterId=${encounterId}`,
  );
  const lockedState = page.getByTestId("chart-start-locked-state");
  await lockedState.getByRole("button", { name: "오늘 바이탈 입력" }).click();

  const dialog = page.getByRole("dialog", { name: "오늘 바이탈 입력" });
  await dialog.getByLabel("체중").fill("5.12");
  await dialog.getByLabel("체온").fill("38.9");
  await dialog.getByLabel("심박수").fill("88");
  await dialog.getByLabel("호흡수").fill("24");
  await dialog.getByRole("button", { name: "저장" }).click();

  await expect(
    lockedState.getByRole("button", { name: "오늘 바이탈 수정" }),
  ).toBeVisible();
  await expect(lockedState).toContainText("5.12 kg");
  expect(writes[0]).toEqual({
    weightKg: 5.12,
    temperatureC: 38.9,
    heartRateBpm: 88,
    respiratoryRateRpm: 24,
    bloodPressureSystolicMmhg: null,
    bloodPressureDiastolicMmhg: null,
  });

  await lockedState.getByRole("button", { name: "오늘 바이탈 수정" }).click();
  const editDialog = page.getByRole("dialog", { name: "오늘 바이탈 수정" });
  for (const label of ["체중", "체온", "심박수", "호흡수"]) {
    await editDialog.getByLabel(label).fill("");
  }
  await editDialog.getByRole("button", { name: "저장" }).click();

  await expect(
    lockedState.getByLabel(
      "환자 바이탈 표, 좁은 화면에서는 가로로 스크롤할 수 있습니다",
    ),
  ).toContainText("—");
  expect(writes).toHaveLength(2);
  expect(writes[1]).toEqual({
    weightKg: null,
    temperatureC: null,
    heartRateBpm: null,
    respiratoryRateRpm: null,
    bloodPressureSystolicMmhg: null,
    bloodPressureDiastolicMmhg: null,
  });
});

test("chart vital history follows workspace omission and re-add without rewriting measurements", async ({
  page,
}) => {
  const workspaceId = "clair-demo";
  const encounterId = "encounter-haru-260430";
  let includeHeartRate = false;
  const historicalVital = {
    id: "vital-haru-history",
    encounterId,
    measuredAt: "2026-07-20T09:30:00.000Z",
    weightKg: 5.12,
    temperatureC: 38.9,
    heartRateBpm: 88,
    respiratoryRateRpm: 24,
  };
  const presets = [
    {
      key: "weight",
      label: "체중",
      description: "환자의 현재 체중",
      canonicalUnit: "kg",
      allowedDisplayUnits: ["kg", "g"],
      requiredInWorkspace: true,
    },
    {
      key: "temperature",
      label: "체온",
      description: "체온계로 측정한 체온",
      canonicalUnit: "°C",
      allowedDisplayUnits: ["°C", "°F"],
      requiredInWorkspace: true,
    },
    {
      key: "heart_rate",
      label: "심박수",
      description: "분당 심장 박동 수",
      canonicalUnit: "bpm",
      allowedDisplayUnits: ["bpm"],
      requiredInWorkspace: false,
    },
    {
      key: "respiratory_rate",
      label: "호흡수",
      description: "분당 호흡 횟수",
      canonicalUnit: "rpm",
      allowedDisplayUnits: ["rpm"],
      requiredInWorkspace: false,
    },
    {
      key: "blood_pressure",
      label: "혈압",
      description: "수축기 단독 또는 수축기/이완기",
      canonicalUnit: "mmHg",
      allowedDisplayUnits: ["mmHg"],
      requiredInWorkspace: false,
    },
  ];

  await page.route("**/api/workspaces/*/vital-settings", async (route) => {
    const items = [
      { key: "weight", enabled: true, displayUnit: "kg", sortOrder: 0 },
      { key: "temperature", enabled: true, displayUnit: "°C", sortOrder: 1 },
      ...(includeHeartRate
        ? [
            {
              key: "heart_rate",
              enabled: true,
              displayUnit: "bpm",
              sortOrder: 2,
            },
          ]
        : []),
      {
        key: "respiratory_rate",
        enabled: true,
        displayUnit: "rpm",
        sortOrder: includeHeartRate ? 3 : 2,
      },
    ];
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        status: 200,
        canManage: true,
        presets,
        items,
      }),
    });
  });
  await page.route(
    "**/api/workspaces/*/chart/preconsultation-context?*",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          canWriteVitals: true,
          enforcedBy: "chart-preconsultation-context-read",
          context: {
            encounter: {
              id: encounterId,
              encounterNo: "E-260430-0005",
              receptionType: "walk_in",
              visitPurpose: "예방접종",
              chiefComplaint: "예방접종 전 건강 확인",
              checkedInAt: "2026-04-30T16:05:00+09:00",
              status: "waiting",
            },
            queue: { id: "queue-haru-consultation", status: "waiting" },
            patient: {
              id: "patient-haru",
              patientNo: "P-HARU",
              name: "하루",
              species: "cat",
              breed: "Korean Shorthair",
              estimatedAgeText: "2세",
              sex: "female",
            },
            guardian: { id: "guardian-kang-seoyun", name: "강서윤" },
            veterinarian: { id: "user-vet", displayName: "이수지" },
            priorEncounterCount: 1,
            vitals: [historicalVital],
            history: [],
          },
        }),
      });
    },
  );

  await page.goto(
    `/w/${workspaceId}/treatment?modulePanel=open&aside=closed&encounterId=${encounterId}`,
  );
  const vitalTable = page
    .getByTestId("chart-start-locked-state")
    .getByLabel("환자 바이탈 표, 좁은 화면에서는 가로로 스크롤할 수 있습니다");
  await expect(vitalTable).not.toContainText("심박수");
  await expect(vitalTable).not.toContainText("88 bpm");
  expect(historicalVital.heartRateBpm).toBe(88);

  includeHeartRate = true;
  await page.reload();
  await expect(vitalTable).toContainText("심박수");
  await expect(vitalTable).toContainText("88 bpm");
  expect(historicalVital.heartRateBpm).toBe(88);
});

test("chart history aside anchors scroll chrome and keeps the single chart action right-aligned", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 350 });
  await page.goto("/w/clair-demo/treatment?modulePanel=open&aside=history");

  const chartHistoryAside = page.locator("#chart-content-aside");
  await expect(chartHistoryAside).toBeVisible();
  await expect(chartHistoryAside.getByText("차트 이력")).toBeVisible();
  const historyLayout = await chartHistoryAside.evaluate((aside) => {
    const scrollArea = aside.querySelector<HTMLElement>(
      '[data-slot="scroll-area"]',
    );
    const scrollBar = aside.querySelector<HTMLElement>(
      '[data-slot="scroll-area-scrollbar"]',
    );
    const historyCard = aside.querySelector<HTMLElement>(
      '[data-slot="content-history-item"]',
    );
    if (!scrollArea || !scrollBar || !historyCard) {
      throw new Error("chart history scroll geometry is missing");
    }

    const asideRect = aside.getBoundingClientRect();
    const scrollAreaRect = scrollArea.getBoundingClientRect();
    const scrollBarRect = scrollBar.getBoundingClientRect();
    const historyCardRect = historyCard.getBoundingClientRect();

    return {
      asideRight: asideRect.right,
      cardRight: historyCardRect.right,
      scrollAreaRight: scrollAreaRect.right,
      scrollBarLeft: scrollBarRect.left,
      scrollBarRight: scrollBarRect.right,
      scrollBarWidth: scrollBarRect.width,
    };
  });
  expect(
    Math.abs(historyLayout.asideRight - historyLayout.scrollAreaRight),
  ).toBeLessThanOrEqual(1);
  expect(historyLayout.cardRight).toBeLessThan(historyLayout.scrollAreaRight);
  expect(historyLayout.scrollBarWidth).toBeGreaterThan(0);
  expect(
    Math.abs(historyLayout.asideRight - historyLayout.scrollBarRight),
  ).toBeLessThanOrEqual(1);
  expect(historyLayout.cardRight).toBeLessThanOrEqual(
    historyLayout.scrollBarLeft,
  );

  const historyFooter = chartHistoryAside.getByTestId(
    "chart-history-footer-actions",
  );
  await expect(historyFooter).toHaveCSS("justify-content", "flex-end");
  await expect(
    chartHistoryAside.getByRole("button", { name: "+ 새 차트" }),
  ).toBeEnabled();
});

test("chart workspace renders queue, history, SOAP, assessment, and orders", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/treatment?modulePanel=open&aside=history");

  const sidePanel = page.locator("aside").first();
  await expect(sidePanel.getByText("진료 대기열")).toBeVisible();
  await expect(
    sidePanel.getByRole("group", { name: "진료 대기 유형 필터" }),
  ).toHaveCount(0);
  await expect(
    sidePanel.getByTestId("order-queue-sort-control"),
  ).toHaveAttribute("aria-label", "대기열 정렬");
  await expect(sidePanel.getByTestId("order-queue-sort-control")).toHaveText(
    "",
  );
  await expect(
    sidePanel.getByTestId("order-queue-filter-control"),
  ).toHaveAttribute("aria-label", "대기열 필터");
  await expect(
    sidePanel.getByTestId("order-queue-density-control"),
  ).toHaveCount(0);
  await expect(
    sidePanel.getByTestId("order-queue-search-control"),
  ).toHaveAttribute("aria-label", "대기열 검색 열기");
  await sidePanel.getByTestId("order-queue-search-control").click();
  await expect(sidePanel.getByLabel("진료 대기열 검색")).toBeVisible();
  await page.keyboard.press("Escape");
  const selectedQueueCard = page.getByTestId(
    "order-queue-item-encounter-coco-260501",
  );
  await expect(selectedQueueCard).toHaveAttribute("data-selected", "true");
  await expect(selectedQueueCard).toContainText("09:50 예약");
  await expect(selectedQueueCard).not.toContainText("이수지 요청");
  const selectedQueueCardColors = await selectedQueueCard.evaluate(
    (element) => {
      const selectedBorderProbe = document.createElement("span");
      selectedBorderProbe.style.borderTop =
        "1px solid var(--emr-state-selected-border)";
      document.body.appendChild(selectedBorderProbe);

      return {
        borderColor: getComputedStyle(element).borderTopColor,
        selectedBorderColor:
          getComputedStyle(selectedBorderProbe).borderTopColor,
        stripeColor: getComputedStyle(element.firstElementChild ?? element)
          .backgroundColor,
      };
    },
  );
  expect(selectedQueueCardColors.selectedBorderColor).toBeTruthy();
  expect(selectedQueueCardColors.borderColor).not.toBe("rgba(0, 0, 0, 0)");
  await expect(page.locator("#chart-content-aside")).toBeVisible();
  await expect(page.getByRole("heading", { name: "History" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "차트 이력 패널 접기" }),
  ).toBeVisible();
  await expect(
    page.getByRole("separator", {
      name: "진료 기록과 처방/오더 영역 높이 조절",
    }),
  ).toHaveCSS("height", "8px");
  const chartWorkspace = page.locator('[data-slot="chart-workspace"]');
  await expect(chartWorkspace).toHaveCSS("margin-top", "0px");
  await expect(chartWorkspace).toHaveCSS("padding-top", "0px");
  await expect(
    page.getByLabel("환자 컨텍스트 정보").getByText("주치의"),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "진료 기록" })).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Subject/Object" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Assessment" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "기본 S/O" })).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "소화기", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText(
      "블록 왼쪽의 + 또는 / 명령으로 SOAP 템플릿과 내용을 추가할 수 있습니다.",
      { exact: true },
    ),
  ).toHaveCount(0);
  await expect(page.getByLabel("SOAP 블록 문서")).toBeVisible();
  await expect(
    page.getByText("주관적 · 보호자 진술", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "SOAP 추가" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "초안 저장" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /진단명/ })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "전체오더" })).toBeVisible();
  await expect(page.getByLabel("처방 조회 범위")).toHaveCount(0);
  const soapDiagnosisGridMetrics = await page
    .getByTestId("chart-soap-diagnosis-grid")
    .evaluate((element) => {
      const [soapPanel, diagnosisPanel, historyPanel] = Array.from(
        element.children,
      ) as HTMLElement[];

      return {
        diagnosisWidth: diagnosisPanel.getBoundingClientRect().width,
        gap: getComputedStyle(element).columnGap,
        historyWidth: historyPanel.getBoundingClientRect().width,
        soapWidth: soapPanel.getBoundingClientRect().width,
      };
    });
  expect(soapDiagnosisGridMetrics.gap).toBe("8px");
  expect(
    Math.abs(
      soapDiagnosisGridMetrics.soapWidth -
        soapDiagnosisGridMetrics.diagnosisWidth,
    ),
  ).toBeLessThanOrEqual(1);
  expect(soapDiagnosisGridMetrics.soapWidth).toBeGreaterThanOrEqual(240);
  expect(soapDiagnosisGridMetrics.historyWidth).toBeGreaterThanOrEqual(305);
  await expect(page.getByText("피하 수액 처치").first()).toBeVisible();
  const diagnosisPanel = page.getByLabel("진단명 관리");
  await expect(
    diagnosisPanel.getByRole("row", { name: /급성 위장관염 의심/ }),
  ).toHaveCount(0);
  await expect(
    diagnosisPanel.getByTestId("chart-assessment-empty-state"),
  ).toBeVisible();
  const orderTable = page.getByRole("table", { name: "처방/오더 테이블" });
  await expect(orderTable.locator('th:has-text("Order 명")')).toHaveAttribute(
    "data-emr-header-interaction",
    "sortable",
  );
  await expect(orderTable.locator('th:has-text("수량")')).toHaveAttribute(
    "data-emr-column-resize",
    "data-column",
  );
  await expect(orderTable.locator('th:has-text("작업")')).toHaveCount(0);
  await expect(orderTable.locator('th:has-text("목적지")')).toHaveCount(0);
  await expect(
    orderTable
      .locator('[data-emr-cell-text-mode="one-line"]', {
        hasText: "Maropitant 16mg T",
      })
      .first(),
  ).toContainText("Maropitant 16mg T");
  await expect(
    orderTable.getByText("0.5T x 3일, 보호자 복약 안내 포함"),
  ).toHaveCount(0);
  const maropitantDetail = await openChartOrderDetail(
    page,
    "Maropitant 16mg T",
  );
  await expect(maropitantDetail).toContainText("항구토제 세트");
  await expect(maropitantDetail).toContainText(
    "0.5T x 3일, 보호자 복약 안내 포함",
  );
  await maropitantDetail.getByRole("button", { name: "Close" }).click();
  await expect(
    page.getByRole("checkbox", { name: "오더 전체 선택" }),
  ).not.toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: "Maropitant 16mg T 선택" }),
  ).not.toBeChecked();
  const selectAllOrderBox = await page
    .getByRole("checkbox", { name: "오더 전체 선택" })
    .boundingBox();
  const firstOrderCheckboxBox = await page
    .getByRole("checkbox", { name: "Maropitant 16mg T 선택" })
    .boundingBox();

  expect(selectAllOrderBox).not.toBeNull();
  expect(firstOrderCheckboxBox).not.toBeNull();
  expect(
    Math.abs(
      selectAllOrderBox!.x +
        selectAllOrderBox!.width / 2 -
        (firstOrderCheckboxBox!.x + firstOrderCheckboxBox!.width / 2),
    ),
  ).toBeLessThanOrEqual(1);
  await page.getByRole("button", { name: "SOAP 작업" }).click();
  await expect(
    page.getByRole("menuitem", { name: "이미지 · 동영상 연동 준비 중" }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(page.getByText("처치 지시서")).toHaveCount(0);
});

test("chart Figma follow-up restores history and panel chrome contracts", async ({
  page,
}) => {
  await routePopulatedKongCurrentChartAssessment(page);
  await page.setViewportSize(chartFigmaVisualFixture.viewport);
  await page.goto(`${chartFigmaVisualFixture.route}&chartId=soap-kong-260501`);

  const actionBar = page.locator("[data-slot='chart-action-bar']");
  const workspace = page.locator("[data-slot='chart-workspace']");
  const panels = page.locator("[data-slot='chart-workspace-panel']");
  const historyToggle = page.getByRole("button", {
    name: "차트 이력 패널 열기",
  });

  await expect(actionBar).toHaveCSS("height", "48px");
  await expect(actionBar).toHaveCSS("border-bottom-width", "0px");
  await expect(actionBar).toHaveCSS("background-color", "rgb(252, 252, 252)");
  await expect(workspace).toBeVisible({ timeout: 15_000 });
  await expect(workspace).toHaveCSS("background-color", "rgb(252, 252, 252)");
  await expect(page.locator("main.emr-workspace-frame-responsive")).toHaveCSS(
    "border-color",
    "rgb(212, 212, 212)",
  );
  await expect(historyToggle).toHaveCSS("width", "24px");
  await expect(historyToggle).toHaveCSS("height", "24px");
  await expect(historyToggle).toHaveCSS("border-radius", "6px");
  await expect(historyToggle).toHaveCSS("border-color", "rgb(229, 229, 229)");
  await expect(historyToggle).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(historyToggle).not.toHaveCSS("box-shadow", "none");
  await expect(historyToggle.locator("svg")).toHaveCSS("width", "14px");
  await expect(historyToggle.locator("svg")).toHaveCSS("height", "14px");

  const visitBadge = page.getByTestId("chart-visit-badge");
  const encounterNumberBadge = page.getByTestId(
    "chart-encounter-number-badge",
  );
  await expect(visitBadge).toHaveText(/^(초진|재진)$/);
  await expect(visitBadge).toHaveCSS("border-width", "1px");
  await expect(visitBadge).toHaveCSS("border-style", "solid");
  expect(
    await visitBadge.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).borderRadius),
    ),
  ).toBeGreaterThanOrEqual(11);
  await expect(encounterNumberBadge).toHaveText(/^E-/);
  await expect(encounterNumberBadge).toHaveCSS(
    "border-color",
    "rgba(0, 0, 0, 0)",
  );
  await expect(actionBar).toContainText("진료 시작 일시");
  await expect(page.getByRole("button", { name: "입원 수속" })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "케어가이드 발송" }),
  ).toHaveCount(0);

  await expect(panels).toHaveCount(4);
  for (const panel of await panels.all()) {
    await expect(panel).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect(panel).toHaveCSS("border-color", "rgb(229, 229, 229)");
  }

  const subjectPanel = panels.filter({
    has: page.getByRole("heading", { name: "Subject/Object" }),
  });
  const subjectActions = subjectPanel.locator(
    "[data-slot='chart-panel-actions']",
  );
  await page.mouse.move(1, 1);
  await expect(subjectActions).toHaveCSS("opacity", "0");
  await subjectPanel.hover();
  await expect(subjectActions).toHaveCSS("opacity", "1");
  await expect(subjectPanel).toHaveCSS("border-radius", "8px");
  await expect(subjectPanel).not.toHaveCSS("box-shadow", "none");
  const subjectActionButtons = subjectActions.locator("button");
  await expect(subjectActionButtons).toHaveCount(4);
  await expect(subjectActionButtons.nth(0)).toHaveAttribute(
    "aria-label",
    "S/O 패널 접기",
  );
  await expect(subjectActionButtons.nth(2)).toHaveAttribute(
    "aria-label",
    "SOAP 저장",
  );
  await expect(subjectActionButtons.nth(3)).toHaveAttribute(
    "aria-label",
    "SOAP 작업",
  );
  const subjectCollapseButton = subjectActionButtons.nth(0);
  await subjectCollapseButton.focus();
  await page.mouse.move(1, 1);
  await expect(subjectCollapseButton).toHaveCSS(
    "background-color",
    "rgba(0, 0, 0, 0)",
  );
  await subjectCollapseButton.hover();
  await expect(subjectCollapseButton).not.toHaveCSS(
    "background-color",
    "rgba(0, 0, 0, 0)",
  );
  for (const button of await subjectActionButtons.all()) {
    await expect(button).toHaveCSS("width", "28px");
    await expect(button).toHaveCSS("height", "28px");
  }

  const assessmentPanel = panels.filter({
    has: page.getByRole("heading", { name: "Assessment" }),
  });
  const assessmentActions = assessmentPanel.locator(
    "[data-slot='chart-panel-actions']",
  );
  await expect(assessmentActions.locator("button").nth(0)).toHaveAttribute(
    "aria-label",
    "Assessment 패널 접기",
  );

  await assessmentPanel.getByRole("textbox", { name: "진단명 검색" }).click();
  await page.mouse.move(1, 1);
  await expect(assessmentActions).toHaveCSS("opacity", "0");
  await subjectPanel.hover();
  await expect(subjectActions).toHaveCSS("opacity", "1");
  await expect(assessmentActions).toHaveCSS("opacity", "0");

  const historyPanel = panels.filter({
    has: page.getByRole("heading", { name: "History" }),
  });
  await expect(
    historyPanel.locator("[data-slot='chart-panel-actions'] button").nth(0),
  ).toHaveAttribute("aria-label", "History 패널 접기");

  const orderPanel = panels.filter({
    has: page.getByRole("heading", { name: "Plan/Order" }),
  });

  for (const { name, panel } of [
    { name: "Subject/Object", panel: subjectPanel },
    { name: "Assessment", panel: assessmentPanel },
    { name: "History", panel: historyPanel },
    { name: "Plan/Order", panel: orderPanel },
  ]) {
    const heading = panel.getByRole("heading", { name });
    const header = heading.locator("xpath=..");
    await expect(header).toHaveCSS("padding-left", "12px");
    await expect(header).toHaveCSS("padding-right", "12px");
    await expect(header).toHaveCSS("padding-top", "8px");
    await expect(header).toHaveCSS("padding-bottom", "2px");

    const titleInsets = await heading.evaluate((element) => {
      const header = element.parentElement;
      if (!header) throw new Error("Chart panel header is missing");
      const headerRect = header.getBoundingClientRect();
      const headingRect = element.getBoundingClientRect();
      return {
        bottom: Math.round(headerRect.bottom - headingRect.bottom),
        left: Math.round(headingRect.left - headerRect.left),
        top: Math.round(headingRect.top - headerRect.top),
      };
    });

    expect(titleInsets).toEqual({ bottom: 6, left: 12, top: 12 });
  }

  const orderActionButtons = orderPanel.locator(
    "[data-slot='chart-panel-actions'] button",
  );
  await expect(orderActionButtons).toHaveCount(4);
  await expect(orderActionButtons.nth(0)).toHaveAttribute(
    "aria-label",
    "Plan/Order 패널 접기",
  );
  await expect(orderActionButtons.nth(2)).toHaveAttribute(
    "aria-label",
    "Order 추가",
  );
  await expect(orderActionButtons.nth(3)).toHaveAttribute(
    "aria-label",
    "Plan/Order 작업",
  );

  await expect(page.locator("[data-slot='chart-soap-toolbar']")).toBeVisible();
  await expect(page.getByRole("tab", { name: "기본 S/O" })).toBeVisible();
  await expect(subjectPanel.getByLabel("SOAP 블록 문서")).toBeVisible();
  await expect(
    page.locator("[data-slot='chart-assessment-toolbar']"),
  ).toHaveCSS("height", "44px");
  await expect(
    page.locator("[data-slot='chart-assessment-toolbar']"),
  ).toHaveCSS("border-bottom-color", "rgb(229, 229, 229)");
  await expect(
    page.locator("[data-slot='chart-assessment-table-header']"),
  ).toHaveCSS("height", "36px");
  await expect(
    page.locator("[data-slot='chart-assessment-table-row']").first(),
  ).toHaveCSS("height", "40px");

  for (const control of [
    page.getByRole("combobox", { name: "진단계통 필터" }),
    page.getByRole("textbox", { name: "진단명 검색" }),
    page.getByRole("combobox", { name: "차트 이력 종류" }),
    page.getByRole("textbox", { name: "진단 이력 검색" }),
  ]) {
    await expect(control).toHaveCSS("font-size", "12px");
    await expect(control).toHaveCSS("height", "28px");
    const lineHeight = await control.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).lineHeight),
    );
    expect(lineHeight).toBeCloseTo(16, 2);
  }

  const orderTableSurface = page.locator(
    "[data-slot='chart-order-table-surface']",
  );
  const orderToolbarSurface = page
    .locator("[data-slot='chart-order-toolbar-actions']")
    .locator("xpath=..");
  await expect(orderToolbarSurface).toHaveCSS("border-bottom-width", "1px");
  await expect(orderTableSurface).toHaveCSS("border-top-width", "0px");
  await expect(orderTableSurface).toHaveCSS("border-bottom-width", "0px");
  await expect(page.getByTestId("chart-order-footer")).toHaveCSS(
    "border-top-width",
    "1px",
  );

  const soapSaveTrigger = subjectPanel.getByRole("button", {
    name: "SOAP 저장",
  });
  await page.mouse.move(1, 1);
  await subjectCollapseButton.focus();
  await page.keyboard.press("Tab");
  await expect(subjectActions).toHaveCSS("opacity", "1");
  await page.keyboard.press("Tab");
  await expect(soapSaveTrigger).toBeFocused();
  await expect(subjectActions).toHaveCSS("opacity", "1");
  await page.keyboard.press("Tab");
  await expect(
    subjectPanel.getByRole("button", { name: "SOAP 작업" }),
  ).toBeFocused();
  await expect(subjectActions).toHaveCSS("opacity", "1");

  const orderToolbar = page.locator(
    "[data-slot='chart-order-toolbar-actions']",
  );
  const orderToolbarButtons = orderToolbar.getByRole("button");
  await expect(orderToolbarButtons).toHaveCount(7);
  for (const button of await orderToolbarButtons.all()) {
    await expect(button).toHaveCSS("height", "28px");
  }

  await historyToggle.click();
  await expect(page).toHaveURL(/aside=history/);
  await expect(page.locator("#chart-content-aside")).toBeVisible();
  const expandedToggle = page.getByRole("button", {
    name: "차트 이력 패널 접기",
  });
  await expect(expandedToggle).toHaveAttribute("aria-expanded", "true");
  await expandedToggle.click();
  await expect(page).toHaveURL(/aside=closed/);
  await expect(page.locator("#chart-content-aside")).toHaveCount(0);
});

test("chart panel actions remain visible on touch input", async ({
  browser,
}) => {
  const context = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { height: 800, width: 1024 },
  });
  const page = await context.newPage();

  try {
    await page.goto(chartFigmaVisualFixture.route);
    const subjectPanel = page
      .locator("[data-slot='chart-workspace-panel']")
      .filter({
        has: page.getByRole("heading", { name: "Subject/Object" }),
      });
    await expect(
      subjectPanel.locator("[data-slot='chart-panel-actions']"),
    ).toHaveCSS("opacity", "1");
  } finally {
    await context.close();
  }
});

test("chart contents preserve the Figma 1540 by 968 reference geometry", async ({
  page,
}) => {
  await page.setViewportSize(chartFigmaVisualFixture.viewport);
  await page.goto(chartFigmaVisualFixture.route);

  const content = page.locator("[data-slot='chart-content']");
  await expect(content).toBeVisible();
  await expect
    .poll(async () => Math.round((await content.boundingBox())?.width ?? 0))
    .toBe(chartFigmaVisualFixture.expectedContentSize.width);
  const contentBox = await content.boundingBox();
  expect(contentBox).not.toBeNull();
  expect(Math.round(contentBox!.width)).toBe(
    chartFigmaVisualFixture.expectedContentSize.width,
  );
  expect(Math.round(contentBox!.height)).toBe(
    chartFigmaVisualFixture.expectedContentSize.height,
  );

  await expect(
    page.locator("[data-slot='chart-patient-context-bar']"),
  ).toHaveCSS("height", "56px");
  await expect(page.locator("[data-slot='chart-action-bar']")).toHaveCSS(
    "height",
    "48px",
  );

  const layout = await page
    .locator("[data-slot='chart-workspace']")
    .evaluate((workspace) => {
      const topGrid = workspace.querySelector(
        "[data-testid='chart-soap-diagnosis-grid']",
      );
      return {
        documentOverflow:
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
        panelWidths: topGrid
          ? Array.from(topGrid.children).map((panel) =>
              Math.round(panel.getBoundingClientRect().width),
            )
          : [],
        rows: getComputedStyle(workspace)
          .gridTemplateRows.split(" ")
          .map((value) => Math.round(Number.parseFloat(value))),
      };
    });

  expect(layout.documentOverflow).toBe(0);
  expect(layout.panelWidths).toEqual([
    ...chartFigmaVisualFixture.expectedPanelWidths,
  ]);
  expect(layout.rows).toEqual([...chartFigmaVisualFixture.expectedRows]);
  await expect(
    page.getByRole("heading", { name: "Subject/Object" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Assessment" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "History" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Plan/Order" })).toBeVisible();
  await expect(page).toHaveURL(/chartId=soap-kong-260501/, {
    timeout: 10_000,
  });
  await expect(
    page.getByTestId("chart-order-row-order-kong-fluid"),
  ).toContainText("피하 수액 처치", { timeout: 10_000 });
  const orderFooter = page.getByTestId("chart-order-footer");
  await expect(orderFooter).toContainText("저장됨");
  await expect(orderFooter).toContainText("이 차트 오더 합계");
  await expect(content).toHaveScreenshot(
    "chart-contents-v2-reference-1540x968.png",
    {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.002,
    },
  );
});

test("chart Plan/Order keeps a 410px pinned region and scrolls detail columns", async ({
  page,
}) => {
  await page.setViewportSize(chartFigmaVisualFixture.viewport);
  await page.goto(chartFigmaVisualFixture.route);

  const chartContent = page.locator("[data-slot='chart-content']");
  const orderTable = page.getByRole("table", { name: "처방/오더 테이블" });
  const pinnedViewport = orderTable.locator(
    "xpath=ancestor::*[@data-emr-pinned-table-viewport='true']",
  );
  const scrollContainer = pinnedViewport.locator(
    "> [data-emr-pinned-table-scroll-owner='true']",
  );
  const horizontalScrollbar = pinnedViewport.locator(
    '> [data-emr-pinned-table-scrollbar="horizontal"]',
  );

  await expect(pinnedViewport).toBeVisible();
  await expect
    .poll(async () =>
      Math.round((await chartContent.boundingBox())?.width ?? 0),
    )
    .toBe(chartFigmaVisualFixture.expectedContentSize.width);
  await expect(orderTable).toHaveAttribute("data-emr-pinning", "columns");
  await expect(page.getByTestId("chart-order-footer")).toHaveCSS(
    "height",
    "52px",
  );

  const referenceMetrics = await pinnedViewport.evaluate((viewport) => {
    const leftPinnedWidth = Number.parseFloat(
      getComputedStyle(viewport).getPropertyValue(
        "--emr-table-left-pinned-column-width",
      ),
    );

    return {
      leftPinnedWidth,
      scrollRegionWidth:
        viewport.getBoundingClientRect().width - leftPinnedWidth,
    };
  });

  expect(referenceMetrics.leftPinnedWidth).toBe(410);
  expect(referenceMetrics.scrollRegionWidth).toBe(1112);
  await expect(
    orderTable
      .locator("[data-slot='table-body'] [data-slot='table-row']")
      .first(),
  ).toHaveCSS("height", "40px");

  const pinnedColumnIds = await orderTable
    .locator("[data-slot='table-head'][data-emr-column-pinned='left']")
    .evaluateAll((headers) =>
      headers.map((header) => header.getAttribute("data-column-id")),
    );
  expect(pinnedColumnIds).toEqual([
    "select",
    "orderType",
    "confirmation",
    "displayName",
  ]);

  const selectionHeader = orderTable.locator('th[data-column-id="select"]');
  const statusHeader = orderTable.locator('th[data-column-id="status"]');
  const selectionCheckbox = page.getByRole("checkbox", {
    name: "오더 전체 선택",
  });
  const statusSortButton = orderTable.getByRole("button", {
    name: "업무 상태 오름차순 정렬",
  });

  await expect(selectionHeader).toHaveCSS("width", "32px");
  await expect(statusHeader).toHaveCSS("width", "84px");

  const selectionCheckboxBox = await selectionCheckbox.boundingBox();
  const statusSortButtonBox = await statusSortButton.boundingBox();

  expect(selectionCheckboxBox).not.toBeNull();
  expect(statusSortButtonBox).not.toBeNull();
  expect(
    statusSortButtonBox!.x -
      (selectionCheckboxBox!.x + selectionCheckboxBox!.width),
  ).toBeGreaterThanOrEqual(4);

  await page.getByRole("checkbox", { name: "CBC 검사 선택" }).check();
  const selectionActions = page.getByRole("toolbar", { name: "선택 행 작업" });
  await expect(selectionActions).toBeVisible();
  await expect(selectionActions).toContainText("확정 전 후보");
  await expect(
    selectionActions.getByRole("button", { name: "선택 확정" }),
  ).toBeVisible();
  await selectionActions.getByRole("button", { name: "선택 해제" }).click();
  await expect(selectionActions).toBeHidden();

  await page.setViewportSize({ height: 650, width: 900 });
  await expect(scrollContainer).toBeVisible();
  await expect(horizontalScrollbar).toBeVisible();
  const [viewportBox, scrollbarBox] = await Promise.all([
    pinnedViewport.boundingBox(),
    horizontalScrollbar.boundingBox(),
  ]);
  expect(viewportBox).not.toBeNull();
  expect(scrollbarBox).not.toBeNull();
  expect(Math.abs(scrollbarBox!.x - viewportBox!.x - 410)).toBeLessThanOrEqual(
    1,
  );
  expect(
    Math.abs(
      scrollbarBox!.x +
        scrollbarBox!.width -
        (viewportBox!.x + viewportBox!.width),
    ),
  ).toBeLessThanOrEqual(1);
  await scrollContainer.evaluate((container) => {
    container.scrollLeft = 0;
  });
  await horizontalScrollbar.click({
    position: {
      x: scrollbarBox!.width - 16,
      y: scrollbarBox!.height / 2,
    },
  });
  await expect
    .poll(() => scrollContainer.evaluate((container) => container.scrollLeft))
    .toBeGreaterThan(0);
  await scrollContainer.evaluate((container) => {
    container.scrollLeft = 0;
  });
  const pinnedIdentityHeader = orderTable.locator(
    "[data-slot='table-head'][data-column-id='displayName']",
  );
  const scrollHeader = orderTable.locator(
    "[data-slot='table-head'][data-column-id='billingName']",
  );
  const pinnedXBefore = (await pinnedIdentityHeader.boundingBox())?.x ?? 0;
  const scrollXBefore = (await scrollHeader.boundingBox())?.x ?? 0;

  const scrollLeft = await scrollContainer.evaluate((container) => {
    container.scrollLeft = container.scrollWidth - container.clientWidth;
    return container.scrollLeft;
  });
  const pinnedXAfter = (await pinnedIdentityHeader.boundingBox())?.x ?? 0;
  const scrollXAfter = (await scrollHeader.boundingBox())?.x ?? 0;

  expect(scrollLeft).toBeGreaterThan(0);
  expect(Math.abs(pinnedXAfter - pinnedXBefore)).toBeLessThanOrEqual(1);
  expect(scrollXAfter).toBeLessThan(scrollXBefore);

  await page.getByRole("tab", { name: "영상 1", exact: true }).click();
  await expect(
    orderTable.locator('tbody tr[data-emr-data-table-row="true"]'),
  ).toHaveCount(1);
  const orderTableRoot = orderTable.locator(
    "xpath=ancestor::*[@data-emr-data-table='true']",
  );
  const orderTableSurface = page.locator(
    '[data-slot="chart-order-table-surface"]',
  );
  const orderFooter = page.getByTestId("chart-order-footer");
  await expect(orderTableRoot).toHaveAttribute(
    "data-emr-data-table-viewport-mode",
    "fill",
  );
  for (const viewportSize of [
    { height: 1264, width: 2124 },
    { height: 900, width: 1440 },
    { height: 650, width: 1024 },
  ]) {
    await page.setViewportSize(viewportSize);
    const [
      surfaceAfterFilterBox,
      rootAfterFilterBox,
      viewportAfterFilterBox,
      scrollbarAfterFilterBox,
      footerAfterFilterBox,
      composerBox,
    ] = await Promise.all([
      orderTableSurface.boundingBox(),
      orderTableRoot.boundingBox(),
      pinnedViewport.boundingBox(),
      horizontalScrollbar.boundingBox(),
      orderFooter.boundingBox(),
      page.getByTestId("chart-order-quick-add").boundingBox(),
    ]);
    expect(surfaceAfterFilterBox).not.toBeNull();
    expect(rootAfterFilterBox).not.toBeNull();
    expect(viewportAfterFilterBox).not.toBeNull();
    expect(scrollbarAfterFilterBox).not.toBeNull();
    expect(footerAfterFilterBox).not.toBeNull();
    const surfaceBottom = surfaceAfterFilterBox!.y + surfaceAfterFilterBox!.height;
    expect(composerBox).not.toBeNull();
    // Quick entry overlays the viewport; no permanent band shrinks the table.
    const tableBottom = surfaceBottom;
    expect(
      Math.abs(
        rootAfterFilterBox!.y + rootAfterFilterBox!.height - tableBottom,
      ),
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs(
        viewportAfterFilterBox!.y +
          viewportAfterFilterBox!.height -
          tableBottom,
      ),
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs(
        scrollbarAfterFilterBox!.y +
          scrollbarAfterFilterBox!.height -
          tableBottom,
      ),
    ).toBeLessThanOrEqual(1);
    expect(Math.abs(footerAfterFilterBox!.y - surfaceBottom)).toBeLessThanOrEqual(
      1,
    );
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      ),
    ).toBe(0);
  }
});

test("chart Order all tab renders the approved order confirmation and work-state columns", async ({
  page,
}) => {
  await page.goto(chartFigmaVisualFixture.route);

  const table = page.getByRole("table", { name: "처방/오더 테이블" });
  for (const label of [
    "진료",
    "임상",
    "영상",
    "원외(검사)",
    "조제",
    "처치",
    "입원",
    "기타",
  ]) {
    await expect(
      page.getByRole("tab", {
        name: new RegExp(`^${label.replace(/[()]/g, "\\$&")} \\d+$`),
      }),
    ).toBeVisible();
  }

  const namedHeaders = await table.locator("thead th").evaluateAll((headers) =>
    headers
      .map((header) => header.textContent?.trim() ?? "")
      .filter(Boolean),
  );
  expect(namedHeaders).toEqual([
    "분류",
    "확정 여부",
    "Order 명",
    "업무 상태",
    "청구서명",
    "청구반영",
    "일수",
    "횟수",
    "총횟수",
    "head/kg당",
    "1회당",
    "성분량",
    "조제량",
    "준비 예정량",
    "보관",
    "투여/복약",
    "담당자",
    "단가",
    "수량",
    "합계",
    "할인할증(금액)",
    "(%)",
    "청구금액",
    "사유",
    "과세",
    "수의사",
  ]);
  await expect(
    table.getByRole("columnheader", { name: "작업", exact: true }),
  ).toHaveCount(0);
  await expect(
    table.getByRole("columnheader", { name: "목적지", exact: true }),
  ).toHaveCount(0);

  const maropitantRow = page.getByTestId(
    "chart-order-row-order-kong-maropitant",
  );
  await expect(
    maropitantRow.locator('[data-column-id="detail-bodyRegion"]'),
  ).toHaveCount(0);
  const scrollOwner = table.locator(
    "xpath=ancestor::*[@data-emr-pinned-table-viewport='true']/*[@data-emr-pinned-table-scroll-owner='true']",
  );
  await scrollOwner.evaluate((element) => {
    element.scrollLeft = element.scrollWidth - element.clientWidth;
  });
  await maropitantRow.hover();
  const overlay = page.getByRole("group", {
    name: "Maropitant 16mg T 행 작업",
  });
  await expect(
    overlay.getByRole("button", { name: "Maropitant 16mg T 상세" }),
  ).toBeVisible();
  const [ownerBox, overlayBox] = await Promise.all([
    scrollOwner.boundingBox(),
    overlay.boundingBox(),
  ]);
  expect(ownerBox).not.toBeNull();
  expect(overlayBox).not.toBeNull();
  expect(
    Math.abs(
      overlayBox!.x + overlayBox!.width - (ownerBox!.x + ownerBox!.width),
    ),
  ).toBeLessThanOrEqual(2);
});

const actualDispenseUiCases = [
  {
    title: "chart saves a constrained actual dispense override with an anchored reason",
    authoritySource: "applied",
    rowType: "individual",
  },
  {
    title: "chart saves a set-child constrained actual dispense override from dedicated authority",
    authoritySource: "dedicated",
    rowType: "set_child",
  },
] as const;

async function verifyActualDispenseUiCase(
  page: Page,
  actualDispenseUiCase: (typeof actualDispenseUiCases)[number],
) {
  const orderId = "order-kong-maropitant";
  const firstUpdatedAt = "2026-09-02T09:00:00.000Z";
  const savedUpdatedAt = "2026-09-02T09:01:00.000Z";
  const detailInputs = {
    doseBasis: "patient",
    dose: 16,
    doseUnit: "mg",
    route: "PO",
    frequency: "once",
    durationDays: 1,
    totalQuantity: 1,
  };
  const authority = {
    schemaVersion: 1,
    calculationMode: "ingredient_based",
    dispenseUnit: "mL",
    referenceIngredientId: "ingredient-maropitant",
    productStrength: {
      numeratorValue: 16,
      numeratorUnit: "mg",
      denominatorValue: 1,
      denominatorUnit: "mL",
    },
    preparationPolicy: {
      increment: 0.1,
      roundingMode: "nearest",
      displayPrecision: 1,
      noReasonTolerance: 0.1,
    },
    priceBasis: "per_product_unit",
    billingUnit: "mL",
    taxClass: "taxable",
  };
  let currentRow = {
    orderId,
    workspaceId: "clair-demo",
    encounterId: kongEncounterId,
    originChartId: "soap-kong-260501",
    rowType: actualDispenseUiCase.rowType,
    orderType: "dispensing",
    clinicalOrderType: "dispensing",
    destinationModule: "dispensing",
    executionMode: "routed",
    detailInputs,
    detailSchemaVersion: 1,
    priority: "normal",
    billingEligible: true,
    revisionNo: 0,
    parentOrderId: actualDispenseUiCase.rowType === "set_child"
      ? "02491000-0000-4000-8000-000000000001"
      : null,
    sourceSetId: actualDispenseUiCase.rowType === "set_child"
      ? "pr024-dispensing-set"
      : null,
    sourceSetRevisionId: actualDispenseUiCase.rowType === "set_child"
      ? "02470000-0000-4000-8000-000000000001"
      : null,
    sourceSetRevisionNo: actualDispenseUiCase.rowType === "set_child" ? 1 : null,
    sourceSetVersion: actualDispenseUiCase.rowType === "set_child"
      ? "order-set-revision-1"
      : null,
    sourceSetRevisionItemId: actualDispenseUiCase.rowType === "set_child"
      ? "02480000-0000-4000-8000-000000000001"
      : null,
    workspaceCatalogItemId: "svc-med-maropitant",
    workspaceCatalogRevision: 1,
    ...(actualDispenseUiCase.authoritySource === "dedicated"
      ? { dispensingAuthoritySnapshot: authority }
      : {}),
    dispensingLineage: null,
    quantity: 1,
    quantitySource: "manual",
    unitPriceSnapshot: 4500,
    lineTotalSnapshot: 4500,
    snapshotSchemaVersion: 0,
    snapshotHash: null,
    appliedSnapshot: {
      billingName: "Maropitant 16mg T",
      billingReflectionEnabled: true,
      categoryGroup: "medication",
      clinicalOrderType: "dispensing",
      destinationModule: "dispensing",
      detailInputs,
      detailSchemaVersion: 1,
      executionMode: "routed",
      inHospitalOrderName: "Maropitant 16mg T",
      lineTotalSnapshot: 4500,
      orderType: "dispensing",
      ...(actualDispenseUiCase.authoritySource === "applied"
        ? { planOrderAuthority: authority }
        : {}),
      priceKrw: 4500,
      quantity: 1,
      rowType: actualDispenseUiCase.rowType,
      standardOrderName: "Maropitant 16mg T",
      workspaceCatalogItemId: "svc-med-maropitant",
      workspaceCatalogRevision: 1,
    },
    appliedPriceSnapshot: {},
    calculationInputs: {},
    calculationOutputs: {
      actualDispenseOverride: null as Record<string, unknown> | null,
      actualDispenseQuantity: 1,
      actualDispenseSource: "preparation_policy",
      actualDispenseUnit: "mL",
      calculatedDispenseQuantity: 1,
      calculationStatus: "ready",
      dispenseApplicability: true,
      inputFingerprint: "a".repeat(64),
      preparationPolicy: authority.preparationPolicy,
      proposedActualDispenseQuantity: 1,
      requiresReconfirmation: false,
      theoreticalDispenseQuantity: 1,
      totalOccurrences: 1,
      totalRequiredDispenseQuantity: 1,
    },
    billingReflectionEnabled: true,
    orderConfirmationStatus: "draft",
    status: "requested",
    updatedAt: firstUpdatedAt,
  };
  const patchBodies: Array<Record<string, unknown>> = [];
  await page.route(
    "**/api/workspaces/clair-demo/chart/encounter-charts?*",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        status: 200,
        json: {
          charts: [
            {
              id: "soap-kong-260501",
              encounterId: kongEncounterId,
              authorUserId: "user-vet-suji",
              ...kongSoapFields,
              status: "autosaved",
              createdAt: "2026-05-01T09:40:00+09:00",
              updatedAt: "2026-05-01T10:16:00+09:00",
            },
          ],
          ok: true,
          status: 200,
        },
      });
    },
  );
  await page.route(
    "**/api/workspaces/clair-demo/chart/order-drafts*",
    async (route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }
      await route.fulfill({
        contentType: "application/json",
        headers: { ETag: `"${"a".repeat(64)}"` },
        status: 200,
        json: {
          etag: `"${"a".repeat(64)}"`,
          ok: true,
          rows: [currentRow],
          status: 200,
        },
      });
    },
  );
  await page.route(
    `**/api/workspaces/clair-demo/chart/orders/${orderId}/actual-dispense`,
    async (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      patchBodies.push(body);
      const actualQuantity = Number(body.actualQuantity);
      currentRow = {
        ...currentRow,
        calculationOutputs: {
          ...currentRow.calculationOutputs,
          actualDispenseOverride: {
            reason: body.reason,
            reasonRequired: true,
            versionNo: 1,
          },
          actualDispenseQuantity: actualQuantity,
          actualDispenseSource: "manual_override",
          totalRequiredDispenseQuantity: actualQuantity,
        },
        updatedAt: savedUpdatedAt,
      };
      await route.fulfill({
        contentType: "application/json",
        status: 200,
        json: {
          enforcedBy: "order-actual-dispense",
          ok: true,
          state: {
            actualDispenseOverride:
              currentRow.calculationOutputs.actualDispenseOverride,
            actualDispenseQuantity: actualQuantity,
            actualDispenseSource: "manual_override",
            actualDispenseUnit: "mL",
            orderId,
            overrideId: "override-smoke-1",
            requiresReconfirmation: false,
            updatedAt: savedUpdatedAt,
            versionNo: 1,
          },
          status: 200,
        },
      });
    },
  );

  await page.goto(kongScenarioUrl);
  const kongQueueItem = page
    .getByRole("button", { name: /^예약 콩이 · 김하늘/ })
    .first();
  await kongQueueItem.click();
  await expect(kongQueueItem).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/chartId=soap-kong-260501/);
  const input = page.getByRole("spinbutton", {
    name: "Maropitant 16mg T 준비 예정량",
  });
  await expect(input).toHaveValue("1", { timeout: 20_000 });
  await input.fill("1.2");
  await page
    .getByRole("button", { name: "Maropitant 16mg T 준비 예정량 저장" })
    .click();
  const reasonPopover = page.getByText("준비 예정량 변경 사유가 필요해요");
  await expect(reasonPopover).toBeVisible();
  await page.getByRole("button", { name: "계량 단위 보정" }).click();

  await expect.poll(() => patchBodies.length).toBe(1);
  expect(patchBodies[0]).toMatchObject({
    actualQuantity: 1.2,
    expectedOrderUpdatedAt: firstUpdatedAt,
    reason: "계량 단위 보정",
  });
  await expect(input).toHaveValue("1.2");
  await expect(
    page.getByRole("button", {
      name: "Maropitant 16mg T 준비 예정량 변경 사유",
    }),
  ).toBeVisible();
}

for (const actualDispenseUiCase of actualDispenseUiCases) {
  test(actualDispenseUiCase.title, async ({ page }) => {
    await verifyActualDispenseUiCase(page, actualDispenseUiCase);
  });
}

test("chart Order draft autosaves Field Matrix values and enables explicit confirmation", async ({
  page,
}) => {
  await page.goto(kongScenarioUrl);
  await page.getByRole("button", { name: "+ Order", exact: true }).click();
  const catalogDialog = page.getByRole("dialog", {
    name: "오더 추가",
  });
  await searchChartOrderCatalog(catalogDialog, "BASO");
  const candidate = page.getByTestId(
    "chart-order-catalog-candidate-std-ord-lab-cbc-baso",
  );
  await candidate.click();
  await confirmChartOrderCatalogSelection(catalogDialog, 1);
  await expect(page.getByTestId("chart-order-footer")).toContainText("저장됨", {
    timeout: 10_000,
  });

  const draftPatchBodies: Array<Record<string, unknown>> = [];
  page.on("request", (request) => {
    if (
      request.method() === "PATCH" &&
      request.url().includes("/chart/order-drafts")
    ) {
      draftPatchBodies.push(
        (request.postDataJSON() ?? {}) as Record<string, unknown>,
      );
    }
  });
  const persistedFieldMatrixSave = page.waitForResponse((response) => {
    const request = response.request();
    if (
      request.method() !== "PATCH" ||
      !request.url().includes("/chart/order-drafts") ||
      !response.ok()
    ) {
      return false;
    }
    const body = (request.postDataJSON() ?? {}) as Record<string, unknown>;
    if (!Array.isArray(body.rows)) return false;
    return body.rows.some((value) => {
      if (!value || typeof value !== "object") return false;
      const row = value as Record<string, unknown>;
      const details = row.detailInputs as Record<string, unknown> | undefined;
      return (
        row.workspaceCatalogItemId === "ord-lab-cbc-baso" &&
        row.priority === "urgent" &&
        details?.specimenType === "blood" &&
        details.testPanel === "CBC differential BASO" &&
        details.collectionCondition === "EDTA 전혈, 채취 즉시 혼합"
      );
    });
  });

  const detail = await openChartOrderDetail(page, "[CBC 검사] #BASO");
  await detail.getByLabel("[CBC 검사] #BASO 검체", { exact: true }).click();
  await page.getByRole("option", { name: "혈액", exact: true }).click();
  await detail
    .getByLabel("[CBC 검사] #BASO 패널/항목", { exact: true })
    .fill("CBC differential BASO");
  await detail
    .getByLabel("[CBC 검사] #BASO 채취 조건", { exact: true })
    .fill("EDTA 전혈, 채취 즉시 혼합");
  await detail
    .getByRole("switch", { name: "[CBC 검사] #BASO 긴급" })
    .check();
  await detail.getByRole("button", { name: "저장하고 닫기" }).click();

  await expect
    .poll(
      () =>
        draftPatchBodies.some((body) => {
          if (!Array.isArray(body.rows)) return false;
          return body.rows.some((value) => {
            if (!value || typeof value !== "object") return false;
            const row = value as Record<string, unknown>;
            const details = row.detailInputs as
              Record<string, unknown> | undefined;
            return (
              row.workspaceCatalogItemId === "ord-lab-cbc-baso" &&
              row.priority === "urgent" &&
              details?.specimenType === "blood" &&
              details.testPanel === "CBC differential BASO" &&
              details.collectionCondition === "EDTA 전혈, 채취 즉시 혼합"
            );
          });
        }),
      { timeout: 5_000 },
    )
    .toBe(true);
  await persistedFieldMatrixSave;
  await expect(page.getByTestId("chart-order-footer")).toContainText("저장됨", {
    timeout: 10_000,
  });

  await page.getByRole("checkbox", { name: "[CBC 검사] #BASO 선택" }).check();
  const actionBar = page.getByRole("toolbar", { name: "선택 행 작업" });
  const confirmButton = actionBar.getByRole("button", { name: "선택 확정" });
  await expect(confirmButton).toBeEnabled();
  await confirmButton.click();
  const confirmDialog = page.getByRole("dialog", { name: "Order 확정 확인" });
  await expect(confirmDialog).toContainText(
    "선택하지 않은 후보는 공유 Draft에 남고",
  );
  await confirmDialog.getByRole("button", { name: "다시 확인" }).click();

  await page.reload();
  const reloadedDetail = await openChartOrderDetail(
    page,
    "[CBC 검사] #BASO",
  );
  await expect(
    reloadedDetail.getByLabel("[CBC 검사] #BASO 패널/항목", { exact: true }),
  ).toHaveValue("CBC differential BASO");
  await expect(
    reloadedDetail.getByRole("switch", { name: "[CBC 검사] #BASO 긴급" }),
  ).toBeChecked();
});

test("chart clinical panels collapse independently without unmounting their content", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(kongScenarioUrl);

  const panelGroup = page.getByTestId("chart-soap-diagnosis-grid");
  const soapPanel = panelGroup.locator('[data-panel-id="soap"]');
  const assessmentPanel = panelGroup.locator('[data-panel-id="assessment"]');
  const historyPanel = panelGroup.locator('[data-panel-id="history"]');
  const soapContent = page.locator("#chart-soap-panel-content");
  const soapEditor = page.getByLabel("SOAP 블록 문서");

  await expect(panelGroup).toHaveAttribute("data-collapsed-count", "0");
  await expect(historyPanel).toHaveAttribute("data-collapsed", "false");
  await expect(
    page.getByRole("button", { name: "History 패널 접기" }),
  ).toHaveAttribute("aria-controls", "chart-history-panel-content");
  await expect(
    page.getByRole("button", { name: "History 패널 접기" }),
  ).toHaveAttribute("aria-expanded", "true");
  await expect(panelGroup).toHaveCSS("column-gap", "8px");
  await expect(panelGroup).toHaveCSS("transition-property", "none");

  await soapContent.evaluate((element) => {
    element.setAttribute("data-collapse-mount-probe", "preserved");
  });

  const soapCollapseButton = page.getByRole("button", {
    name: "S/O 패널 접기",
  });
  await expect(soapCollapseButton).toHaveCSS("opacity", "0");
  await soapPanel.hover();
  await expect(soapCollapseButton).toHaveCSS("opacity", "1");
  await page.mouse.move(0, 0);
  await page.getByRole("button", { name: "SOAP 저장" }).focus();
  await tabBackwardTo(page, soapCollapseButton, 2);
  await expect(soapCollapseButton).toBeFocused();
  await expect(soapCollapseButton).toHaveCSS("opacity", "1");
  await page.keyboard.press("Enter");

  await expect(soapPanel).toHaveAttribute("data-collapsed", "true");
  await expect(soapPanel).toHaveCSS("width", "46px");
  await expect(soapEditor).toBeAttached();
  await expect(soapContent).toHaveAttribute(
    "data-collapse-mount-probe",
    "preserved",
  );
  const soapExpandButton = page.getByRole("button", {
    name: "S/O 패널 펼치기",
  });
  await expect(soapExpandButton).toBeFocused();
  await page.keyboard.press("Space");
  await expect(soapPanel).toHaveAttribute("data-collapsed", "false");
  await expect(soapCollapseButton).toBeFocused();
  await expect(
    page.getByRole("heading", { name: "Subject/Object" }),
  ).toBeVisible();

  const diagnosisSearch = page.getByRole("textbox", { name: "진단명 검색" });
  const assessmentCollapseButton = page.getByRole("button", {
    name: "Assessment 패널 접기",
  });
  await diagnosisSearch.fill("위장염");
  await page.keyboard.press("Escape");
  await page.getByRole("combobox", { name: "진단계통 필터" }).focus();
  await tabBackwardTo(page, assessmentCollapseButton, 4);
  await expect(assessmentCollapseButton).toBeFocused();
  await page.keyboard.press("Enter");
  const assessmentExpandButton = page.getByRole("button", {
    name: "Assessment 패널 펼치기",
  });
  await expect(assessmentExpandButton).toBeFocused();
  await page.keyboard.press("Space");
  await expect(assessmentPanel).toHaveAttribute("data-collapsed", "false");
  await expect(diagnosisSearch).toHaveValue("위장염");
  await expect(assessmentCollapseButton).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(assessmentExpandButton).toBeFocused();
  await soapPanel.hover();
  await soapCollapseButton.click();
  await expect(panelGroup).toHaveAttribute("data-collapsed-count", "2");
  await expect(assessmentPanel).toHaveCSS("width", "46px");

  await page.getByRole("button", { name: "History 패널 접기" }).focus();
  await page.keyboard.press("Enter");
  await expect(panelGroup).toHaveAttribute("data-collapsed-count", "3");
  await expect(page).toHaveURL(/aside=closed/);
  await expect(historyPanel).toHaveAttribute("data-collapsed", "true");
  const historyExpandButton = page.getByRole("button", {
    name: "History 패널 펼치기",
  });
  await expect(historyExpandButton).toBeFocused();
  await page.keyboard.press("Space");
  await expect(page).toHaveURL(/aside=closed/);
  await expect(historyPanel).toHaveAttribute("data-collapsed", "false");
  await expect(
    page.getByRole("button", { name: "History 패널 접기" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(historyPanel).toHaveAttribute("data-collapsed", "true");

  await page.setViewportSize({ width: 1280, height: 800 });
  await soapExpandButton.click();
  await assessmentExpandButton.click();
  await historyExpandButton.click();
  await expect
    .poll(() =>
      panelGroup.evaluate(
        (element) => element.scrollWidth <= element.clientWidth + 1,
      ),
    )
    .toBe(true);

  await page.setViewportSize({ width: 1100, height: 800 });
  await expect
    .poll(() =>
      panelGroup.evaluate((element) => ({
        hasInternalOverflow: element.scrollWidth > element.clientWidth,
        panelWidths: Array.from(element.children).map((child) =>
          Math.round(child.getBoundingClientRect().width),
        ),
      })),
    )
    .toEqual({
      hasInternalOverflow: true,
      panelWidths: [360, 360, 360],
    });
});

test("chart Plan/Order header adds Order and collapse actions without changing button chrome", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(kongScenarioUrl);

  const orderPanel = page.locator(
    "[data-slot='chart-workspace-panel'][data-collapsed]",
  );
  const orderActions = orderPanel.locator("[data-slot='chart-panel-actions']");
  const orderActionButtons = orderActions.locator("button");
  const orderContent = page.locator("#chart-order-panel-content");
  const clinicalPanelGroup = page.getByTestId("chart-soap-diagnosis-grid");
  const divider = page.locator(
    '[role="separator"][aria-label="진료 기록과 처방/오더 영역 높이 조절"]',
  );

  await orderPanel.hover();
  await expect(orderActions).toHaveCSS("opacity", "1");
  await expect(orderActionButtons).toHaveCount(4);
  for (const button of await orderActionButtons.all()) {
    await expect(button).toHaveCSS("width", "28px");
    await expect(button).toHaveCSS("height", "28px");
  }

  await page.getByRole("button", { name: "Order 추가" }).click();
  await expect(page.getByRole("dialog", { name: "오더 추가" })).toBeVisible();
  await page.getByRole("button", { name: "오더 추가 닫기" }).click();

  for (const panelId of ["soap", "assessment", "history"] as const) {
    const clinicalPanel = clinicalPanelGroup.locator(
      `[data-panel-id='${panelId}']`,
    );
    await clinicalPanel.hover();
    await clinicalPanel
      .locator(`[data-chart-panel-collapse='${panelId}']`)
      .click();
  }
  await expect(clinicalPanelGroup).toHaveAttribute("data-collapsed-count", "3");

  const collapseButton = page.getByRole("button", {
    name: "Plan/Order 패널 접기",
  });
  await expect(collapseButton.locator("svg")).toHaveAttribute(
    "data-icon",
    "chevron-down",
  );
  await orderPanel.hover();
  await collapseButton.click();
  await expect(orderPanel).toHaveAttribute("data-collapsed", "true");
  await expect(orderPanel).toHaveCSS("height", "38px");
  await expect(orderContent).toHaveAttribute("aria-hidden", "true");
  await expect(divider).toHaveAttribute("aria-hidden", "true");
  await expect
    .poll(async () => {
      const [clinicalBox, orderBox] = await Promise.all([
        clinicalPanelGroup.evaluate((element) =>
          element.getBoundingClientRect().toJSON(),
        ),
        orderPanel.evaluate((element) =>
          element.getBoundingClientRect().toJSON(),
        ),
      ]);

      return Math.round(orderBox.top - clinicalBox.bottom);
    })
    .toBe(8);

  await page.getByRole("button", { name: "Order 추가" }).click();
  await expect(orderPanel).toHaveAttribute("data-collapsed", "false");
  await expect(page.getByRole("dialog", { name: "오더 추가" })).toBeVisible();
  await page.getByRole("button", { name: "오더 추가 닫기" }).click();

  await orderPanel.hover();
  await collapseButton.click();
  await page.getByRole("button", { name: "Plan/Order 작업" }).click();
  await expect(orderPanel).toHaveAttribute("data-collapsed", "false");
  await expect(
    page.getByRole("menu", { name: "Plan/Order 작업" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");

  await orderPanel.hover();
  await collapseButton.click();
  const expandButton = page.getByRole("button", {
    name: "Plan/Order 패널 펼치기",
  });
  await expect(expandButton.locator("svg")).toHaveAttribute(
    "data-icon",
    "chevron-up",
  );
  await expect(expandButton).toBeFocused();
  await expandButton.click();
  await expect(orderPanel).toHaveAttribute("data-collapsed", "false");
  await expect(orderContent).not.toHaveAttribute("aria-hidden");
  await expect(divider).not.toHaveAttribute("aria-hidden");
  await expect(collapseButton).toBeFocused();
});

test("Cheongdam chart side panel shows the centered empty queue state", async ({
  page,
}) => {
  await grantCheongdamWorkspaceAccess(page);
  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/chart/live-queue?*`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          enforcedBy: "chart-live-queue-read",
          queue: [],
        }),
      });
    },
  );

  await page.goto(
    `/w/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/treatment?modulePanel=open&aside=closed`,
  );

  const sidePanel = page.locator("aside").first();
  await expect(sidePanel.getByText("진료 대기열")).toBeVisible();
  await expect(
    sidePanel.getByRole("heading", { name: "진료 업무가 없습니다" }),
  ).toBeVisible();
});

test("chart selects the first live task on entry without flashing an empty state", async ({
  page,
}) => {
  const first = createLiveChartQueueRecord({
    encounterId: "encounter-date-a",
    patientName: "날짜에이",
    sortOrder: 1,
  });
  const second = createLiveChartQueueRecord({
    encounterId: "encounter-date-b",
    patientName: "날짜비",
    sortOrder: 2,
  });

  await grantCheongdamWorkspaceAccess(page);
  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/chart/live-queue?*`,
    (route) => fulfillLiveChartQueue(route, [first, second]),
  );
  await page.goto(
    `/w/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/treatment?modulePanel=closed&aside=closed`,
  );

  await expect(page).toHaveURL(/encounterId=encounter-date-a/);
  await expect(
    page.getByText("날짜에이", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Subject/Object" }),
  ).toBeVisible();
  await expect(page.getByTestId("chart-content-empty-state")).toHaveCount(0);
});

test("chart prepares the new encounter while an earlier first-chart request is delayed", async ({
  page,
}) => {
  const first = createLiveChartQueueRecord({
    encounterId: "encounter-first-chart-delayed-a",
    patientName: "지연에이",
    sortOrder: 1,
  });
  const second = createLiveChartQueueRecord({
    encounterId: "encounter-first-chart-delayed-b",
    patientName: "지연비",
    sortOrder: 2,
  });
  const charts = new Map<string, Array<Record<string, unknown>>>();
  let firstPutCount = 0;
  let secondPutCount = 0;
  let releaseFirstPut!: () => void;
  const firstPutGate = new Promise<void>((resolve) => {
    releaseFirstPut = resolve;
  });
  const chartFor = (encounterId: string) => ({
    id: `chart-${encounterId}`,
    encounterId,
    authorUserId: "user-vet",
    authorDisplayName: "이수지",
    status: "draft",
    clinicalAt: "2026-09-13T08:00:00.000Z",
    createdAt: "2026-09-13T08:00:00.000Z",
    updatedAt: "2026-09-13T08:00:00.000Z",
  });

  await grantCheongdamWorkspaceAccess(page);
  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/chart/live-queue?*`,
    (route) => fulfillLiveChartQueue(route, [first, second]),
  );
  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/chart/encounter-charts**`,
    async (route) => {
      const request = route.request();
      const encounterId = request.method() === "GET"
        ? new URL(request.url()).searchParams.get("encounterId") ?? ""
        : ((await request.postDataJSON()) as { encounterId: string }).encounterId;
      if (request.method() === "GET") {
        await route.fulfill({ json: { ok: true, status: 200, charts: charts.get(encounterId) ?? [] } });
        return;
      }
      if (request.method() !== "PUT") {
        await route.fallback();
        return;
      }
      if (encounterId === first.encounter.id) {
        firstPutCount += 1;
        await firstPutGate;
      } else if (encounterId === second.encounter.id) {
        secondPutCount += 1;
        if (secondPutCount === 1) {
          await route.fulfill({ status: 503, json: { ok: false, error: "db_write_failed" } });
          return;
        }
      }
      const chart = chartFor(encounterId);
      charts.set(encounterId, [chart]);
      await route.fulfill({ json: { ok: true, status: 200, chart } });
    },
  );
  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/chart/soap-notes?*`,
    async (route) => {
      const encounterId = new URL(route.request().url()).searchParams.get("encounterId") ?? "";
      await route.fulfill({ json: { ok: true, status: 200, soapNote: charts.get(encounterId)?.[0] ?? null } });
    },
  );
  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/chart/diagnoses?*`,
    (route) => route.fulfill({ json: { ok: true, status: 200, diagnoses: [], assessments: [], version: "scope-switch-v1" } }),
  );
  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/chart/completion?*`,
    async (route) => {
      const encounterId = new URL(route.request().url()).searchParams.get("encounterId") ?? "";
      await route.fulfill({
        json: {
          ok: true,
          status: 200,
          completion: { encounterId, workspaceId: PREPARED_EMPTY_CLINIC_WORKSPACE_ID, status: "in_consultation", updatedAt: "2026-09-13T08:00:00.000Z" },
        },
      });
    },
  );

  try {
    await page.goto(
      `/w/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/treatment?encounterId=${first.encounter.id}&modulePanel=open&aside=closed`,
    );
    await expect.poll(() => firstPutCount).toBe(1);

    await page.getByTestId(`order-queue-item-${second.encounter.id}`).click();
    await expect(page).toHaveURL(new RegExp(`encounterId=${second.encounter.id}`));
    await expect.poll(() => secondPutCount).toBe(1);
    const preparationError = page.getByRole("alert").filter({ hasText: "진료 차트를 준비하지 못했어요" });
    await expect(preparationError).toBeVisible();
    await preparationError.getByRole("button", { name: "안내 닫기" }).click();
    await expect(preparationError).toHaveCount(0);
    await expect(page.getByText("이 접수에 작성된 차트가 없어요")).toHaveCount(0);
    await page.getByRole("button", { name: "다시 시도", exact: true }).click();
    await expect.poll(() => secondPutCount).toBe(2);
    await expect(page.getByLabel("SOAP 블록 문서").getByRole("textbox")).toBeEditable();

    releaseFirstPut();
    await expect(page.getByTestId(`order-queue-item-${second.encounter.id}`)).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByLabel("환자 컨텍스트 정보")).toContainText("지연비");
  } finally {
    releaseFirstPut();
  }
});

test("live patient chart history shows every chart by created_at and keeps past charts read-only", async ({
  page,
}) => {
  const current = createLiveChartQueueRecord({
    encounterId: "encounter-history-current",
    patientName: "초코",
    sortOrder: 1,
  });
  const oldEncounterId = "encounter-history-old";
  const oldEncounterNo = "E-260701-OLD001";
  const emptyEncounterId = "encounter-history-empty";
  const currentChartId = "21215000-0000-4000-8000-000000000011";
  const oldChartId = "21215000-0000-4000-8000-000000000012";
  const currentChart = {
    id: currentChartId,
    encounterId: current.encounter.id,
    authorUserId: "user-vet",
    authorDisplayName: "이수지",
    assessment: "현재 진료",
    status: "autosaved",
    clinicalAt: "2026-09-13T00:00:00.000Z",
    createdAt: "2026-08-14T11:00:00+09:00",
    updatedAt: "2026-09-13T01:00:00.000Z",
  } as const;
  const oldChart = {
    id: oldChartId,
    encounterId: oldEncounterId,
    authorUserId: "user-vet",
    authorDisplayName: "이수지",
    assessment: "보행 상태 추적",
    status: "signed",
    clinicalAt: "2026-07-01T06:00:00.000Z",
    createdAt: "2026-09-12T00:15:00.000Z",
    updatedAt: "2026-09-13T02:00:00.000Z",
  } as const;
  const oldChartSameMinute = {
    ...oldChart,
    id: "21215000-0000-4000-8000-000000000013",
    clinicalAt: "2026-09-08T08:00:00.000Z",
    createdAt: "2026-09-12T00:15:30.000Z",
    updatedAt: "2026-09-14T02:00:00.000Z",
  } as const;
  const oldDiagnoses = [
    { diagnosisText: "슬개골 탈구 의심" },
    { diagnosisText: "골관절염" },
    { diagnosisText: "십자인대 손상 감별" },
    {
      diagnosisText:
        "이첨판 점액종성 변성에 의한 만성 판막 질환과 관련된 추적 관찰",
    },
    { diagnosisText: "치주염" },
    { diagnosisText: "외이염" },
  ];

  await grantCheongdamWorkspaceAccess(page);
  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/chart/live-queue?*`,
    (route) => fulfillLiveChartQueue(route, [current]),
  );
  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/chart/history?*`,
    async (route) => {
      const common = {
        workspaceId: PREPARED_EMPTY_CLINIC_WORKSPACE_ID,
        patientId: current.patient.id,
        guardianId: current.primaryGuardian!.id,
        primaryVeterinarianId: "user-vet",
        receptionType: "walk_in",
        createdAt: "2026-07-01T06:00:00.000Z",
        updatedAt: "2026-07-01T06:30:00.000Z",
      } as const;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          enforcedBy: "chart-patient-history-read",
          items: [
            {
              chart: currentChart,
              encounter: {
                ...common,
                ...current.encounter,
                receptionType: "walk_in",
              },
              primaryGuardian: current.primaryGuardian,
              veterinarianName: "이수지",
              diagnoses: [{ diagnosisText: "근골격계" }],
            },
            {
              chart: oldChart,
              encounter: {
                ...common,
                id: oldEncounterId,
                encounterNo: oldEncounterNo,
                visitPurpose: "외래 재진",
                chiefComplaint: "이전 보행 이상",
                status: "completed",
                checkedInAt: "2026-09-08T06:00:00.000Z",
                completedAt: "2026-09-08T06:30:00.000Z",
              },
              primaryGuardian: current.primaryGuardian,
              veterinarianName: "이수지",
              diagnoses: oldDiagnoses,
            },
            {
              chart: oldChartSameMinute,
              encounter: {
                ...common,
                id: oldEncounterId,
                encounterNo: oldEncounterNo,
                visitPurpose: "외래 재진",
                chiefComplaint: "이전 보행 이상",
                status: "completed",
                checkedInAt: "2026-09-08T06:00:00.000Z",
                completedAt: "2026-09-08T06:30:00.000Z",
              },
              primaryGuardian: current.primaryGuardian,
              veterinarianName: "이수지",
              diagnoses: oldDiagnoses,
            },
          ],
          nextCursor: null,
          totalCount: 3,
        }),
      });
    },
  );
  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/chart/encounter-charts?*`,
    async (route) => {
      const encounterId = new URL(route.request().url()).searchParams.get(
        "encounterId",
      );
      await route.fulfill({
        status: 200,
        json: {
          ok: true,
          status: 200,
          charts:
            encounterId === oldEncounterId
              ? [oldChartSameMinute, oldChart]
              : [currentChart],
        },
      });
    },
  );
  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/chart/diagnoses?*`,
    async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          ok: true,
          status: 200,
          diagnoses: [],
          assessments: [],
          version: "history-test-version",
        },
      });
    },
  );
  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/chart/completion?*`,
    async (route) => {
      const encounterId = new URL(route.request().url()).searchParams.get(
        "encounterId",
      );
      await route.fulfill({
        status: 200,
        json: {
          ok: true,
          status: 200,
          completion: {
            encounterId,
            workspaceId: PREPARED_EMPTY_CLINIC_WORKSPACE_ID,
            status:
              encounterId === oldEncounterId ? "completed" : "in_consultation",
            updatedAt: "2026-09-13T02:00:00.000Z",
          },
        },
      });
    },
  );

  const savedSoapByEncounter = new Map<string, Record<string, unknown>>();
  const soapWriteEncounterIds: string[] = [];
  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/chart/soap-notes**`,
    async (route) => {
      const request = route.request();
      const encounterId = request.method() === "GET"
        ? new URL(request.url()).searchParams.get("encounterId")!
        : request.postDataJSON().encounterId;
      if (request.method() === "PATCH") {
        soapWriteEncounterIds.push(encounterId);
        savedSoapByEncounter.set(encounterId, {
          id: `soap-${encounterId}`,
          encounterId,
          authorUserId: "user-vet",
          subjective: "",
          objective: "",
          assessment: "",
          plan: "",
          blockDocument: request.postDataJSON().blockDocument,
          status: "autosaved",
          createdAt: "2026-07-01T06:00:00.000Z",
          updatedAt: "2026-07-01T07:00:00.000Z",
        });
      }
      await route.fulfill({
        status: 200,
        json: { ok: true, status: 200, auditRecorded: true, soapNote: savedSoapByEncounter.get(encounterId) ?? null },
      });
    },
  );

  await page.goto(
    `/w/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/treatment?encounterId=${current.encounter.id}&modulePanel=open&aside=history`,
  );

  const aside = page.locator("#chart-content-aside");
  const currentHistoryItem = aside.getByTestId(
    `chart-history-item-${currentChartId}`,
  );
  const oldHistoryItem = aside.getByTestId(
    `chart-history-item-${oldChartId}`,
  );
  const inlineHistoryItem = page.getByTestId(
    `chart-diagnosis-history-item-${oldEncounterId}`,
  );
  await expect(aside).toContainText("차트 이력");
  await expect(currentHistoryItem).toContainText("11:00");
  await expect(currentHistoryItem).toContainText("일반 진료");
  await expect(currentHistoryItem).toContainText("작성 중");
  await expect(oldHistoryItem).toContainText("09:15");
  await expect(oldHistoryItem).toContainText("외래 재진");
  await expect(oldHistoryItem).toContainText("완료");
  await expect(oldHistoryItem).toContainText("담당 이수지");
  await expect(oldHistoryItem).not.toContainText("슬개골 탈구 의심");
  await expect(oldHistoryItem).not.toContainText(oldEncounterNo);
  await expect(oldHistoryItem).not.toContainText("26.07.01 15:00");
  const historyDateMode = aside.getByRole("group", {
    name: "차트 이력 표시 기준",
  });
  await expect(historyDateMode.getByRole("button", { name: "진료일 기준" })).toBeVisible();
  await expect(historyDateMode.getByRole("button", { name: "작성일 기준" })).toBeVisible();
  await expect(historyDateMode).not.toContainText(/진료일 기준\s*\d|작성일 기준\s*\d/);
  const historyDateModeToolbar = aside.getByTestId("chart-history-date-mode-toolbar");
  expect(
    await historyDateModeToolbar.evaluate(
      (element) => element.nextElementSibling?.getAttribute("data-slot"),
    ),
  ).toBe("scroll-area");
  const historyGroupCalendar = aside.getByTestId("chart-history-group-calendar").first();
  await expect(historyGroupCalendar).toHaveCSS("width", "14px");
  await expect(historyGroupCalendar).toHaveCSS("height", "14px");
  await expect(
    aside.getByTestId("chart-history-group-26.09.08"),
  ).toContainText("외래 재진");
  await expect(
    aside
      .getByTestId("chart-history-group-26.09.08")
      .locator('[data-slot="content-history-item"]'),
  ).toHaveCount(2);
  await expect(
    aside.getByTestId(`chart-history-item-${oldChartSameMinute.id}`),
  ).toContainText("09:15");
  expect(
    await aside
      .getByTestId("chart-history-group-26.09.08")
      .locator('[data-slot="content-history-item"]')
      .evaluateAll((items) => items.map((item) => item.getAttribute("data-chart-id"))),
  ).toEqual([oldChartSameMinute.id, oldChart.id]);
  await expect(
    aside.getByTestId("chart-history-group-26.09.12"),
  ).toHaveCount(0);
  await expect(
    aside.getByText("선택한 접수의 차트", { exact: false }),
  ).toHaveCount(0);
  await expect(aside.getByText("접수 이력", { exact: false })).toHaveCount(0);

  await oldHistoryItem.click();
  await expect
    .poll(() => new URL(page.url()).searchParams.get("historyEncounterId"))
    .toBe(oldEncounterId);
  await expect
    .poll(() => new URL(page.url()).searchParams.get("chartId"))
    .toBe(oldChartId);
  await expect(page.getByText(oldEncounterNo).first()).toBeVisible();
  await expect(page.getByTestId("chart-historical-readonly-badge")).toBeVisible();
  await expect(page.getByTestId("chart-historical-readonly-badge")).toHaveCSS(
    "border-width",
    "0px",
  );
  await historyDateMode.getByRole("button", { name: "작성일 기준" }).click();
  await expect(oldHistoryItem).toHaveAttribute("data-selected", "true");
  await expect(
    aside.getByTestId("chart-history-group-26.09.12"),
  ).toContainText("외래 재진");
  await expect(
    aside
      .getByTestId("chart-history-group-26.09.12")
      .locator('[data-slot="content-history-item"]'),
  ).toHaveCount(2);
  await expect(
    aside.getByTestId(`chart-history-item-${oldChartSameMinute.id}`),
  ).toContainText("추가 · 26.09.08 진료");
  await expect(aside.getByRole("button", { name: "+ 새 차트" })).toBeEnabled();
  await aside.getByRole("button", { name: "+ 새 차트" }).click();
  const newChartDialog = page.getByRole("dialog", {
    name: "새 차트를 어느 진료에 추가할까요?",
  });
  await expect(newChartDialog).toBeVisible();
  const currentCandidate = newChartDialog.getByTestId(
    `new-chart-encounter-${current.encounter.id}`,
  );
  const completedCandidate = newChartDialog.getByTestId(
    `new-chart-encounter-${oldEncounterId}`,
  );
  await expect(currentCandidate).toHaveAttribute("aria-pressed", "true");
  await expect(currentCandidate).toContainText("기존 차트 1개");
  await expect(completedCandidate).toHaveAttribute("aria-disabled", "true");
  await expect(completedCandidate).toContainText("현재 보고 있는 진료");
  await expect(completedCandidate).toContainText("차트 추가 불가");
  await completedCandidate.hover();
  await expect(page.getByRole("tooltip")).toContainText(
    "완료된 진료에는 새 차트를 추가할 수 없어요.",
  );
  await currentCandidate.hover();
  await expect(page.getByRole("tooltip")).toBeHidden();
  await newChartDialog.getByRole("button", { name: "취소" }).click();
  await page.reload();
  await expect(page.getByText(oldEncounterNo).first()).toBeVisible();
  await expect(oldHistoryItem).toHaveAttribute("data-selected", "true");
  await currentHistoryItem.click();
  await expect(page).not.toHaveURL(/historyEncounterId=/);
  await expect(page).toHaveURL(new RegExp(`chartId=${currentChartId}`));
  await expect(page.getByText(current.encounter.encounterNo).first()).toBeVisible();

  await expect(inlineHistoryItem).toContainText("26.09.08");
  await expect(inlineHistoryItem).not.toContainText("15:00");
  await expect(inlineHistoryItem).not.toContainText("담당");
  await expect(inlineHistoryItem).not.toHaveAttribute("data-selected");
  await expect(inlineHistoryItem).toHaveCSS("height", "40px");
  await expect(inlineHistoryItem).toHaveCSS("border-radius", "8px");
  await expect(inlineHistoryItem).toHaveCSS("margin-bottom", "9px");
  expect(
    await inlineHistoryItem.evaluate((element) =>
      getComputedStyle(element, "::after").bottom,
    ),
  ).toBe("-5px");
  const historyDateBadge = inlineHistoryItem.getByTestId(
    `chart-history-date-badge-${oldEncounterId}`,
  );
  await expect(historyDateBadge).toHaveCSS("height", "24px");
  await expect(historyDateBadge).toHaveCSS("border-radius", "8px");
  await expect(historyDateBadge.locator("svg")).toHaveCSS("width", "12px");
  const inlineHistoryViewport = page
    .getByTestId("chart-inline-history-scroll-area")
    .locator("[data-slot='scroll-area-viewport']");
  await expect(inlineHistoryViewport).toHaveClass(/scroll-fade-y/);
  await expect(inlineHistoryViewport).toHaveClass(/scroll-fade-8/);
  const diagnosisChips = inlineHistoryItem.locator('[data-history-diagnosis]');
  const more = inlineHistoryItem.getByRole("button", { name: /숨겨진 진단/ });
  const view = inlineHistoryItem.getByRole("button", { name: "차트 보기", exact: true });
  const search = page.getByLabel("진단 이력 검색");
  await search.hover();
  await expect(diagnosisChips.first()).toHaveText("슬개골 탈구 의심");
  const restCount = await diagnosisChips.count();
  expect(restCount).toBeGreaterThanOrEqual(1);
  expect(restCount).toBeLessThan(6);
  await expect(more).toHaveText(`+${6 - restCount}`);
  await expect(diagnosisChips.first()).toHaveCSS("background-color", "rgba(0, 0, 0, 0.04)");
  await expect(diagnosisChips.first()).toHaveCSS("font-size", "12px");

  // Action reservation changes the count before the user approaches +N.
  await inlineHistoryItem.getByText("26.09.08", { exact: true }).hover();
  await expect(inlineHistoryItem).toHaveAttribute("data-actions-visible", "true");
  await expect.poll(async () => diagnosisChips.count()).toBeLessThanOrEqual(restCount);
  const hoverCount = await diagnosisChips.count();
  await expect(more).toHaveText(`+${6 - hoverCount}`);
  const counterBox = (await more.boundingBox())!;
  const viewBox = (await view.boundingBox())!;
  expect(counterBox.x + counterBox.width).toBeLessThanOrEqual(viewBox.x);
  await more.hover();
  const tooltip = page.getByRole("tooltip");
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText("외이염");
  await tooltip.hover();
  await page.waitForTimeout(350);
  await expect(tooltip).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(tooltip).toHaveCount(0);
  await expect(page.getByTestId("chart-historical-readonly-badge")).toHaveCount(0);

  // Keyboard access exposes the action but never paints a selected row.
  await search.hover();
  await view.focus();
  await expect(view).toBeFocused();
  await expect(inlineHistoryItem).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(view.locator("..")).toHaveCSS("opacity", "1");
  await search.focus();
  await expect(view.locator("..")).toHaveCSS("opacity", "0");

  await expect(
    aside.locator(`[data-encounter-id="${emptyEncounterId}"]`),
  ).toHaveCount(0);
  await expect(
    page.getByTestId(`chart-diagnosis-history-item-${emptyEncounterId}`),
  ).toHaveCount(0);
  await expect(page.getByTestId("chart-diagnosis-history-list").locator(":scope > article")).toHaveCount(1);
  await expect(page.getByLabel("차트 이력 종류")).toBeVisible();
  await expect(search).toHaveAttribute("placeholder", "키워드 입력");
  await expect(inlineHistoryItem).not.toContainText("완료");
  await expect(inlineHistoryItem).not.toContainText(oldEncounterNo);
  await expect(page.getByTestId(`chart-diagnosis-history-item-${current.encounter.id}`)).toHaveCount(0);

  // Hidden matches are promoted on screen and highlighted, without mutating data.
  await search.fill("치주염");
  await expect(diagnosisChips.first()).toHaveText("치주염");
  await expect(diagnosisChips.first().locator("strong")).toHaveText("치주염");
  await search.fill("만성");
  await inlineHistoryItem.getByText("26.09.08", { exact: true }).hover();
  await expect(diagnosisChips).toHaveCount(1);
  await expect(more).toHaveText("+5");
  await expect(diagnosisChips.first().locator("strong")).toHaveText("만성");
  const firstChipText = diagnosisChips.first().locator("span").first();
  await expect(firstChipText).toHaveCSS("text-overflow", "ellipsis");
  expect(await diagnosisChips.first().evaluate((el) => el.getBoundingClientRect().width)).toBeGreaterThan(20);
  await diagnosisChips.first().hover();
  await expect(tooltip).toContainText("이첨판 점액종성 변성");
  await page.keyboard.press("Escape");

  await expect(tooltip).toHaveCount(0);
  await page.mouse.move(0, 0);

  // Coarse-pointer mode reserves the action even without hover.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
  await search.hover();
  await search.focus();
  expect(await page.evaluate(() => matchMedia("(pointer: coarse)").matches)).toBe(true);
  await expect(view.locator("..")).toHaveCSS("opacity", "1");
  const touchMoreBox = (await more.boundingBox())!;
  const touchViewBox = (await view.boundingBox())!;
  expect(touchMoreBox.x + touchMoreBox.width).toBeLessThanOrEqual(touchViewBox.x);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: touchMoreBox.x + touchMoreBox.width / 2, y: touchMoreBox.y + touchMoreBox.height / 2 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(tooltip).toContainText("치주염");
  await page.keyboard.press("Escape");
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: false });
  await cdp.detach();

  await search.fill("이수지");
  await expect(inlineHistoryItem).toBeVisible();
  await search.fill(oldEncounterNo);
  await expect(inlineHistoryItem).toHaveCount(0);
  await expect(page.getByTestId("chart-history-empty-state")).toContainText("검색 결과가 없습니다");
  await search.clear();
  await expect(inlineHistoryItem).toBeVisible();
  await expect(diagnosisChips.first()).toHaveText("슬개골 탈구 의심");
  await expect(diagnosisChips.locator("strong")).toHaveCount(0);

  const soapParagraph = page.getByLabel("SOAP 블록 문서")
    .locator('.bn-block-content[data-content-type="paragraph"]').first();
  await expect(page.getByLabel("SOAP 블록 문서").locator('[contenteditable="true"]').first()).toBeEditable();
  await soapParagraph.click();
  await page.keyboard.press("End");
  await page.keyboard.insertText(" 이력 전환 직전 작성한 기록");
  await inlineHistoryItem.getByText("26.09.08", { exact: true }).hover();
  await inlineHistoryItem.getByRole("button", { name: "차트 보기", exact: true }).click();

  await expect(page).toHaveURL(
    new RegExp(`encounterId=${current.encounter.id}`),
  );
  await expect(
    page.getByTestId(`order-queue-item-${current.encounter.id}`),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByTestId("chart-historical-readonly-badge"),
  ).toBeVisible();
  await expect(page.getByText(oldEncounterNo).first()).toBeVisible();

  await expect.poll(() => soapWriteEncounterIds.length).toBeGreaterThan(0);
  expect(soapWriteEncounterIds.every((id) => id === current.encounter.id)).toBe(true);
  expect(JSON.stringify(savedSoapByEncounter.get(current.encounter.id))).toContain("이력 전환 직전 작성한 기록");
  await currentHistoryItem.click();
  await expect(page.getByTestId("chart-historical-readonly-badge")).toHaveCount(
    0,
  );
  await expect(
    page.getByText(current.encounter.encounterNo).first(),
  ).toBeVisible();
  await expect(page.getByLabel("SOAP 블록 문서")).toContainText("이력 전환 직전 작성한 기록");
});

test("live patient chart history keeps loading, error, and empty states distinct", async ({
  page,
}) => {
  const current = createLiveChartQueueRecord({
    encounterId: "encounter-history-states",
    patientName: "상태확인",
    sortOrder: 1,
  });
  const chart = {
    id: "21215000-0000-4000-8000-000000000021",
    encounterId: current.encounter.id,
    authorUserId: "user-vet",
    authorDisplayName: "이수지",
    status: "autosaved",
    clinicalAt: "2026-09-12T01:00:00.000Z",
    createdAt: "2026-09-12T01:00:00.000Z",
    updatedAt: "2026-09-12T01:00:00.000Z",
  } as const;
  let releaseFirstHistory!: () => void;
  const firstHistoryGate = new Promise<void>((resolve) => {
    releaseFirstHistory = resolve;
  });
  let markHistoryStarted!: () => void;
  const historyStarted = new Promise<void>((resolve) => {
    markHistoryStarted = resolve;
  });
  let historyMode: "error" | "empty" = "error";

  await grantCheongdamWorkspaceAccess(page);
  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/chart/live-queue?*`,
    (route) => fulfillLiveChartQueue(route, [current]),
  );
  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/chart/encounter-charts?*`,
    (route) =>
      route.fulfill({
        status: 200,
        json: { ok: true, status: 200, charts: [chart] },
      }),
  );
  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/chart/history?*`,
    async (route) => {
      if (historyMode === "error") {
        markHistoryStarted();
        await firstHistoryGate;
        await route.fulfill({
          status: 500,
          json: { ok: false, status: 500, error: "db_read_failed" },
        });
        return;
      }
      await route.fulfill({
        status: 200,
        json: {
          ok: true,
          status: 200,
          enforcedBy: "chart-patient-history-read",
          items: [],
          nextCursor: null,
          totalCount: 0,
        },
      });
    },
  );

  await page.goto(
    `/w/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/treatment?encounterId=${current.encounter.id}&modulePanel=open&aside=history`,
  );
  await historyStarted;
  await expect(page.getByTestId("chart-history-loading-state")).toBeVisible();
  await expect(page.getByTestId("chart-history-empty-state")).toHaveCount(0);
  releaseFirstHistory();

  const error = page.getByTestId("chart-history-error-alert");
  await expect(error).toBeVisible();
  await expect(page.getByTestId("chart-history-loading-state")).toHaveCount(0);
  await expect(page.getByTestId("chart-history-empty-state")).toHaveCount(0);
  historyMode = "empty";
  await error.getByRole("button", { name: "다시 시도" }).click();

  await expect(page.getByTestId("chart-history-empty-state")).toBeVisible();
  await expect(error).toHaveCount(0);
  await expect(page.getByTestId("chart-history-loading-state")).toHaveCount(0);
});

test("active chart context bar previews actual profiles and saves current encounter vitals", async ({
  page,
}) => {
  const baseRecord = createLiveChartQueueRecord({
    encounterId: "encounter-context-actions",
    patientName: "초코",
    sortOrder: 1,
  });
  const record: ChartLiveQueueRecord = {
    ...baseRecord,
    patient: {
      ...baseRecord.patient,
      allergyNote: "닭고기 알레르기",
      handlingCautionNote: "뒷다리 촉진 주의",
      neutered: true,
    },
    primaryGuardian: {
      ...baseRecord.primaryGuardian!,
      name: "최도현",
      mobilePhone: "010-4911-0004",
      email: "guardian@example.test",
    },
  };
  let vital = {
    id: "vital-context-actions",
    patientId: record.patient.id,
    encounterId: record.encounter.id,
    measuredAt: "2026-08-15T10:00:00+09:00",
    weightKg: 12,
    temperatureC: 38.2,
  };
  const writes: Record<string, unknown>[] = [];

  await grantCheongdamWorkspaceAccess(page);
  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/chart/live-queue?*`,
    (route) => fulfillLiveChartQueue(route, [record]),
  );
  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/patient-vitals/latest?*`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          canWriteVitals: true,
          enforcedBy: "patient-latest-vital-read",
          vital,
        }),
      });
    },
  );
  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/chart/encounter-vitals`,
    async (route) => {
      const body = (await route.request().postDataJSON()) as {
        encounterId: string;
        vitals: Record<string, unknown>;
      };
      expect(body.encounterId).toBe(record.encounter.id);
      writes.push(body.vitals);
      vital = {
        ...vital,
        ...Object.fromEntries(
          Object.entries(body.vitals).filter(([, value]) => value !== null),
        ),
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          enforcedBy: "patient-vital-write",
          vital,
        }),
      });
    },
  );
  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/customer/patient/${record.patient.id}/profile-overview`,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          overview: {
            subjectType: "patient",
            subjectId: record.patient.id,
            profile: record.patient,
            relationships: {
              guardians: [
                {
                  ...record.primaryGuardian,
                  relationship: "주보호자",
                  isPrimary: true,
                },
              ],
            },
            access: {
              information: {
                allowed: true,
                requiredPermission: "patient:view",
              },
              history: { allowed: true, requiredPermission: "chart:view" },
              reservations: {
                allowed: true,
                requiredPermission: "reception:view",
              },
              billing: { allowed: true, requiredPermission: "billing:view" },
            },
          },
        }),
      }),
  );
  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/customer/guardian/${record.primaryGuardian!.id}/profile-overview`,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          overview: {
            subjectType: "guardian",
            subjectId: record.primaryGuardian!.id,
            profile: record.primaryGuardian,
            relationships: {
              patients: [
                {
                  ...record.patient,
                  relationship: "주보호자",
                  isPrimary: true,
                },
              ],
            },
            access: {
              information: {
                allowed: true,
                requiredPermission: "patient:view",
              },
              history: { allowed: true, requiredPermission: "chart:view" },
              reservations: {
                allowed: true,
                requiredPermission: "reception:view",
              },
              billing: { allowed: true, requiredPermission: "billing:view" },
            },
          },
        }),
      }),
  );

  await page.goto(
    `/w/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/treatment?encounterId=${record.encounter.id}&modulePanel=closed&aside=closed`,
  );

  const patientSection = page.getByRole("button", {
    name: "초코 환자 프로필 열기",
  });
  await patientSection.hover();
  const patientPreview = page.locator(
    "[data-slot='chart-patient-profile-preview']",
  );
  await expect(patientPreview).toBeVisible();
  await expect(patientPreview).toContainText(record.patient.patientNo);
  await expect(patientPreview).toContainText("Pomeranian");
  await expect(patientPreview).toContainText("중성화·수컷");
  await expect(patientPreview).toContainText("닭고기 알레르기");

  await patientSection.focus();
  await expect(patientPreview).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(patientPreview).toHaveCount(0);
  await patientSection.click();
  const profilePanel = page.getByTestId("profile-side-panel");
  await expect(profilePanel).toHaveAttribute("data-profile-kind", "patient");
  await expect(profilePanel).toContainText("초코");
  await expect(page).toHaveURL(/drawer=patient/);
  await page.keyboard.press("Escape");

  const guardianSection = page.getByRole("button", {
    name: "최도현 보호자 프로필 열기",
  });
  await guardianSection.hover();
  const guardianPreview = page.locator(
    "[data-slot='chart-guardian-profile-preview']",
  );
  await expect(guardianPreview).toContainText("010-4911-0004");
  await expect(guardianPreview).toContainText("guardian@example.test");
  await guardianSection.click();
  await expect(profilePanel).toHaveAttribute("data-profile-kind", "guardian");
  await expect(page).toHaveURL(/drawer=guardian/);
  await page.keyboard.press("Escape");

  const vitalSection = page.locator("[data-slot='patient-context-vitals']");
  await vitalSection.hover();
  const vitalAction = page.getByRole("button", { name: "오늘 바이탈 수정" });
  await expect(vitalAction).toHaveCSS("opacity", "1");
  await vitalAction.click();

  const dialog = page.getByRole("dialog", { name: "오늘 바이탈 수정" });
  await expect(dialog.getByLabel("체중")).toHaveValue("12");
  await dialog.getByLabel("체중").fill("12.34");
  await dialog.getByRole("button", { name: "저장" }).click();

  await expect(dialog).toHaveCount(0);
  await expect(vitalSection).toContainText("12.34 kg");
  expect(writes).toHaveLength(1);
  expect(writes[0]?.weightKg).toBe(12.34);
});

test("chart context bar keeps missing guardians non-interactive and explains unavailable vital writes", async ({
  page,
}) => {
  const baseRecord = createLiveChartQueueRecord({
    encounterId: "encounter-context-disabled",
    patientName: "보리",
    sortOrder: 1,
  });
  const record: ChartLiveQueueRecord = {
    ...baseRecord,
    encounter: { ...baseRecord.encounter, guardianId: undefined },
    primaryGuardian: undefined,
  };

  await grantCheongdamWorkspaceAccess(page);
  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/chart/live-queue?*`,
    (route) => fulfillLiveChartQueue(route, [record]),
  );
  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/patient-vitals/latest?*`,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          canWriteVitals: false,
          enforcedBy: "patient-latest-vital-read",
          vital: null,
        }),
      }),
  );

  await page.goto(
    `/w/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/treatment?encounterId=${record.encounter.id}&modulePanel=closed&aside=closed`,
  );

  const guardianSection = page.locator(
    "[data-slot='patient-context-guardian']",
  );
  await expect(guardianSection).toContainText("보호자 미지정");
  await expect(
    page.getByRole("button", { name: /보호자 프로필 열기/ }),
  ).toHaveCount(0);
  await expect(
    guardianSection.locator("[data-slot='patient-context-hover-action']"),
  ).toHaveCount(0);

  const vitalSection = page.locator("[data-slot='patient-context-vitals']");
  await vitalSection.hover();
  const vitalAction = page.getByRole("button", { name: "오늘 바이탈 입력" });
  await expect(vitalAction).toHaveAttribute("aria-disabled", "true");
  await expect(vitalAction).toHaveAccessibleDescription(
    "바이탈을 입력할 권한이 없어요.",
  );
  await expect(vitalAction).toHaveAttribute(
    "title",
    "바이탈을 입력할 권한이 없어요.",
  );
  await expect(
    page.getByRole("dialog", { name: "오늘 바이탈 입력" }),
  ).toHaveCount(0);
});

test("chart keeps a valid direct link and normalizes a stale encounter to the first task", async ({
  page,
}) => {
  const first = createLiveChartQueueRecord({
    encounterId: "encounter-direct-a",
    patientName: "직접에이",
    sortOrder: 1,
  });
  const second = createLiveChartQueueRecord({
    encounterId: "encounter-direct-b",
    patientName: "직접비",
    sortOrder: 2,
  });

  await grantCheongdamWorkspaceAccess(page);
  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/chart/live-queue?*`,
    (route) => fulfillLiveChartQueue(route, [first, second]),
  );
  await page.goto(
    `/w/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/treatment?encounterId=encounter-direct-b&modulePanel=open&aside=closed`,
  );

  await expect(page).toHaveURL(/encounterId=encounter-direct-b/);
  await expect(page.getByText("직접비", { exact: true }).first()).toBeVisible();

  await page.goto(
    `/w/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/treatment?encounterId=stale-encounter&patientId=stale-patient&scenario=kong-vomit&modulePanel=open&aside=closed`,
  );

  await expect(page).toHaveURL(/encounterId=encounter-direct-a/);
  await expect(page).not.toHaveURL(/patientId=|scenario=/);
  await expect(
    page.getByText("직접에이", { exact: true }).first(),
  ).toBeVisible();
});

test("chart date changes show loading, clear old content, and select the next date first task", async ({
  page,
}) => {
  const initialDate = getCurrentOperatingDate();
  const emptyDate = addDaysToIsoDate(initialDate, 1);
  const thirdDate = addDaysToIsoDate(initialDate, 2);
  const firstDateQueue = [
    createLiveChartQueueRecord({
      encounterId: "encounter-transition-a",
      patientName: "전환에이",
      sortOrder: 1,
    }),
    createLiveChartQueueRecord({
      encounterId: "encounter-transition-b",
      patientName: "전환비",
      sortOrder: 2,
    }),
  ];
  const thirdDateQueue = [
    createLiveChartQueueRecord({
      encounterId: "encounter-transition-c",
      patientName: "전환씨",
      sortOrder: 1,
    }),
    createLiveChartQueueRecord({
      encounterId: "encounter-transition-d",
      patientName: "전환디",
      sortOrder: 2,
    }),
  ];
  let releaseEmptyDate: (() => void) | undefined;

  await grantCheongdamWorkspaceAccess(page);
  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/chart/live-queue?*`,
    async (route) => {
      const date = new URL(route.request().url()).searchParams.get("date");
      if (date === emptyDate) {
        await new Promise<void>((resolve) => {
          releaseEmptyDate = resolve;
        });
        await fulfillLiveChartQueue(route, []);
        return;
      }

      await fulfillLiveChartQueue(
        route,
        date === thirdDate ? thirdDateQueue : firstDateQueue,
      );
    },
  );
  await page.goto(
    `/w/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/treatment?modulePanel=open&aside=closed`,
  );
  await expect(page).toHaveURL(/encounterId=encounter-transition-a/);

  const sidePanel = page.locator("aside").first();
  await sidePanel.getByRole("button", { name: "다음 날짜" }).click();
  await expect.poll(() => Boolean(releaseEmptyDate)).toBe(true);
  await expect(page.getByTestId("chart-content-loading-state")).toBeVisible();
  await expect(page.getByText("전환에이", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Subject/Object" }),
  ).toHaveCount(0);
  await expect(page).not.toHaveURL(/encounterId=/);

  releaseEmptyDate?.();
  const emptyState = page.getByTestId("chart-content-empty-state");
  await expect(emptyState).toHaveAttribute("data-kind", "upstream-pending");
  await expect(emptyState).toContainText(
    `${formatCompactKoreanOperatingDateLabel(emptyDate)}에 표시할 진료 업무가 없습니다.`,
  );

  await sidePanel.getByRole("button", { name: "다음 날짜" }).click();
  await expect(page).toHaveURL(/encounterId=encounter-transition-c/);
  await expect(page.getByText("전환씨", { exact: true }).first()).toBeVisible();
  await expect(emptyState).toHaveCount(0);
});

test("chart ignores a late queue response after a rapid date change", async ({
  page,
}) => {
  const initialDate = getCurrentOperatingDate();
  const lateDate = addDaysToIsoDate(initialDate, 1);
  const latestDate = addDaysToIsoDate(initialDate, 2);
  const initialQueue = [
    createLiveChartQueueRecord({
      encounterId: "encounter-race-a",
      patientName: "레이스에이",
      sortOrder: 1,
    }),
  ];
  const latestQueue = [
    createLiveChartQueueRecord({
      encounterId: "encounter-race-c",
      patientName: "레이스씨",
      sortOrder: 1,
    }),
  ];
  let releaseLateResponse: (() => void) | undefined;

  await grantCheongdamWorkspaceAccess(page);
  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/chart/live-queue?*`,
    async (route) => {
      const date = new URL(route.request().url()).searchParams.get("date");
      if (date === lateDate) {
        await new Promise<void>((resolve) => {
          releaseLateResponse = resolve;
        });
        await fulfillLiveChartQueue(route, []);
        return;
      }
      await fulfillLiveChartQueue(
        route,
        date === latestDate ? latestQueue : initialQueue,
      );
    },
  );
  await page.goto(
    `/w/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/treatment?modulePanel=open&aside=closed`,
  );
  await expect(page).toHaveURL(/encounterId=encounter-race-a/);

  const sidePanel = page.locator("aside").first();
  await sidePanel.getByRole("button", { name: "다음 날짜" }).click();
  await expect.poll(() => Boolean(releaseLateResponse)).toBe(true);
  await sidePanel.getByRole("button", { name: "다음 날짜" }).click();
  await expect(page).toHaveURL(/encounterId=encounter-race-c/);

  releaseLateResponse?.();
  await expect(page).toHaveURL(/encounterId=encounter-race-c/);
  await expect(
    page.getByText("레이스씨", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByTestId("chart-content-empty-state")).toHaveCount(0);
});

test("chart coordinator selects the first queue task after entering from home with the panel closed", async ({
  page,
}) => {
  const first = createLiveChartQueueRecord({
    encounterId: "encounter-closed-panel-entry",
    patientName: "닫힌패널",
    sortOrder: 1,
  });
  let liveQueueRequestCount = 0;

  await page.setViewportSize({ width: 1440, height: 900 });
  await grantCheongdamWorkspaceAccess(page);
  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/chart/live-queue?*`,
    async (route) => {
      liveQueueRequestCount += 1;
      await fulfillLiveChartQueue(route, [first]);
    },
  );

  await page.goto(
    `/w/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/home?modulePanel=closed&aside=closed`,
  );
  await page.getByRole("link", { name: "진료\/차트" }).click();

  await expect(page).toHaveURL(/encounterId=encounter-closed-panel-entry/);
  await expect(page).toHaveURL(/modulePanel=closed/);
  await expect(
    page.getByText("닫힌패널", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByTestId("chart-content-empty-state")).toHaveCount(0);
  await expect.poll(() => liveQueueRequestCount).toBe(1);
});

test("chart no-work empty state keeps refresh and opens the closed queue panel", async ({
  page,
}) => {
  let releaseLiveQueue!: () => void;
  const liveQueuePending = new Promise<void>((resolve) => {
    releaseLiveQueue = resolve;
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await grantCheongdamWorkspaceAccess(page);
  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/chart/live-queue?*`,
    async (route) => {
      await liveQueuePending;
      await fulfillLiveChartQueue(route, []);
    },
  );

  await page.goto(
    `/w/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/treatment?modulePanel=closed&aside=closed`,
  );

  await expect(page.getByTestId("chart-content-loading-state")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "진료 대기열 열기" }),
  ).toHaveCount(0);

  releaseLiveQueue();
  const emptyState = page.getByTestId("chart-content-empty-state");
  await expect(
    emptyState.getByRole("heading", { name: "진료 업무가 없습니다" }),
  ).toBeVisible();
  await expect(emptyState).toHaveAttribute("data-action-count", "2");
  await expect(
    emptyState.getByRole("button", { name: "새로고침" }),
  ).toBeVisible();
  const openQueueButton = emptyState.getByRole("button", {
    name: "진료 대기열 열기",
  });
  await expect(openQueueButton).toBeVisible();
  await openQueueButton.focus();
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/modulePanel=open/);
  await expect(
    page
      .getByTestId("module-panel-area")
      .getByRole("heading", { name: "진료 업무가 없습니다" }),
  ).toBeVisible();
  await expect(emptyState).toHaveAttribute("data-action-count", "1");
  await expect(
    emptyState.getByRole("button", { name: "진료 대기열 열기" }),
  ).toHaveCount(0);
  await expect(
    emptyState.getByRole("button", { name: "새로고침" }),
  ).toBeVisible();
});

test("chart empty-state queue entry stays hidden below the module-panel breakpoint", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await grantCheongdamWorkspaceAccess(page);
  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/chart/live-queue?*`,
    (route) => fulfillLiveChartQueue(route, []),
  );

  await page.goto(
    `/w/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/treatment?modulePanel=closed&aside=closed`,
  );

  const emptyState = page.getByTestId("chart-content-empty-state");
  await expect(
    emptyState.getByRole("heading", { name: "진료 업무가 없습니다" }),
  ).toBeVisible();
  await expect(
    emptyState.getByText("진료 대기열 열기", { exact: true }),
  ).toBeHidden();
  await expect(
    emptyState.getByRole("button", { name: "진료 대기열 열기" }),
  ).toHaveCount(0);
});

test("chart content shows a permission empty state when the live queue is denied", async ({
  page,
}) => {
  await grantCheongdamWorkspaceAccess(page);
  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/chart/live-queue?*`,
    async (route) => {
      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          status: 403,
          denialReason: "permission_missing",
        }),
      });
    },
  );

  await page.goto(
    `/w/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/treatment?modulePanel=closed&aside=closed`,
  );

  const emptyState = page.getByTestId("chart-content-empty-state");
  await expect(emptyState).toHaveAttribute("data-kind", "no-permission");
  await expect(
    emptyState.getByRole("heading", {
      name: "진료 차트 조회 권한이 없습니다",
    }),
  ).toBeVisible();
  await expect(
    emptyState.getByRole("button", { name: "다시 시도" }),
  ).toBeVisible();
  await expect(emptyState).toHaveAttribute("data-action-count", "1");
  await expect(
    emptyState.getByRole("button", { name: "진료 대기열 열기" }),
  ).toHaveCount(0);
});

test("chart content keeps the queue entry hidden when the live queue fails", async ({
  page,
}) => {
  await grantCheongdamWorkspaceAccess(page);
  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/chart/live-queue?*`,
    async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          status: 503,
          error: "queue_unavailable",
        }),
      });
    },
  );

  await page.goto(
    `/w/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/treatment?modulePanel=closed&aside=closed`,
  );

  const emptyState = page.getByTestId("chart-content-empty-state");
  await expect(
    emptyState.getByRole("heading", {
      name: "진료 업무를 불러오지 못했습니다",
    }),
  ).toBeVisible();
  await expect(emptyState).toHaveAttribute("data-action-count", "1");
  await expect(
    emptyState.getByRole("button", { name: "다시 시도" }),
  ).toBeVisible();
  await expect(
    emptyState.getByRole("button", { name: "진료 대기열 열기" }),
  ).toHaveCount(0);
});

test("chart queue read failures are not presented as an empty operating date", async ({
  page,
}) => {
  await grantCheongdamWorkspaceAccess(page);
  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/chart/live-queue?*`,
    async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          status: 500,
          error: "db_read_failed",
        }),
      });
    },
  );

  await page.goto(
    `/w/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/treatment?modulePanel=closed&aside=closed`,
  );

  const emptyState = page.getByTestId("chart-content-empty-state");
  await expect(emptyState).toHaveAttribute("data-kind", "read-error");
  await expect(emptyState).toContainText("진료 업무를 불러오지 못했습니다");
  await expect(emptyState).not.toContainText("표시할 진료 업무가 없습니다");
});

test("chart detail loading uses shared shadcn Skeleton and resolves to real empty states", async ({
  page,
}) => {
  await page.setViewportSize(chartFigmaVisualFixture.viewport);
  await page.emulateMedia({ reducedMotion: "reduce" });

  const workspaceId = PREPARED_EMPTY_CLINIC_WORKSPACE_ID;
  const encounterId = "encounter-chart-skeleton";
  const chartId = "21215000-0000-4000-8000-000000000021";
  const updatedAt = "2026-08-13T09:00:00+09:00";
  const delayedFulfill = async (
    route: Route,
    body: Record<string, unknown>,
  ) => {
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  };

  await page.setViewportSize({ height: 800, width: 1024 });
  await grantCheongdamWorkspaceAccess(page);
  await page.route(
    `**/api/workspaces/${workspaceId}/chart/live-queue?*`,
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          enforcedBy: "chart-live-queue-read",
          queue: [
            {
              encounter: {
                id: encounterId,
                workspaceId,
                patientId: "patient-chart-skeleton",
                guardianId: "guardian-chart-skeleton",
                primaryVeterinarianId: "user-vet",
                encounterNo: "E-260813-0001",
                visitPurpose: "건강검진",
                chiefComplaint: "정기 건강검진",
                status: "in_consultation",
                checkedInAt: updatedAt,
                startedAt: updatedAt,
                createdAt: updatedAt,
                updatedAt,
              },
              patient: {
                id: "patient-chart-skeleton",
                workspaceId,
                patientNo: "P-SKELETON",
                name: "초롱이",
                species: "dog",
                breed: "Maltese",
                estimatedAgeText: "5세",
                sex: "female",
                status: "active",
                createdAt: updatedAt,
                updatedAt,
              },
              primaryGuardian: {
                id: "guardian-chart-skeleton",
                workspaceId,
                name: "박보호",
                createdAt: updatedAt,
                updatedAt,
              },
              queueEntry: {
                id: "queue-chart-skeleton",
                workspaceId,
                encounterId,
                queueType: "consultation",
                status: "in_progress",
                priority: "normal",
                sortOrder: 1,
                enteredAt: updatedAt,
              },
              veterinarianName: "이수지",
            },
          ],
        }),
      });
    },
  );
  await page.route(
    `**/api/workspaces/${workspaceId}/chart/encounter-charts?*`,
    (route) =>
      delayedFulfill(route, {
        ok: true,
        status: 200,
        charts: [
          {
            id: chartId,
            encounterId,
            authorUserId: "user-vet",
            authorDisplayName: "이수지",
            assessment: null,
            status: "autosaved",
            clinicalAt: updatedAt,
            createdAt: updatedAt,
            updatedAt,
          },
        ],
      }),
  );
  await page.route(
    `**/api/workspaces/${workspaceId}/chart/soap-notes?*`,
    (route) => delayedFulfill(route, { ok: true, status: 200, soapNote: null }),
  );
  await page.route(
    `**/api/workspaces/${workspaceId}/chart/diagnoses?*`,
    (route) => delayedFulfill(route, { ok: true, status: 200, diagnoses: [] }),
  );
  await page.route(
    `**/api/workspaces/${workspaceId}/chart/completion?*`,
    (route) =>
      delayedFulfill(route, {
        ok: true,
        status: 200,
        completion: {
          encounterId,
          workspaceId,
          status: "in_consultation",
          updatedAt,
        },
      }),
  );
  await page.route(
    `**/api/workspaces/${workspaceId}/chart/order-drafts?*`,
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          etag: `"${"0".repeat(64)}"`,
          rows: [],
        }),
      });
    },
  );
  await page.route(
    `**/api/workspaces/${workspaceId}/chart/order-actions?*`,
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ ok: true, status: 200, orderActions: [] }),
      });
    },
  );
  await page.route(
    `**/api/workspaces/${workspaceId}/chart/order-lifecycle?*`,
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ ok: true, status: 200, lifecycles: [] }),
      });
    },
  );
  await page.route(
    `**/api/workspaces/${workspaceId}/billing/invoice-candidates?*`,
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ ok: true, status: 200, candidates: [] }),
      });
    },
  );

  await page.goto(
    `/w/${workspaceId}/treatment?encounterId=${encounterId}&modulePanel=closed&aside=closed`,
  );

  const chartContent = page.locator("[data-slot='chart-content']");
  await expect(
    page.getByRole("heading", { name: "Subject/Object" }),
  ).toBeVisible();
  await expect
    .poll(() => chartContent.locator("[data-slot='skeleton']").count())
    .toBeGreaterThan(2);
  await expect(
    chartContent.locator("[data-slot='chart-panel-skeleton']"),
  ).toHaveCount(2);
  await expect(chartContent.locator(".animate-spin")).toHaveCount(0);

  const assessmentPanel = page.getByLabel("진단명 관리");
  const assessmentTableViewport = assessmentPanel.locator(
    "[data-slot='table-container']",
  );
  const assessmentEmptyState = page.getByTestId("chart-assessment-empty-state");

  await expect(assessmentEmptyState).toBeVisible();
  const orderTable = page.getByRole("table", { name: "처방/오더 테이블" });
  const pinnedViewport = orderTable.locator(
    "xpath=ancestor::*[@data-emr-pinned-table-viewport='true']",
  );
  const pinnedHeader = orderTable
    .locator('thead th[data-emr-column-pinned="left"]')
    .first();
  const scrollHeader = orderTable
    .locator("thead th:not([data-emr-column-pinned])")
    .first();
  const emptyBody = page.getByTestId("chart-order-empty-body");
  const emptyState = page.getByTestId("chart-order-empty-state");
  await expect(emptyState).toBeVisible();
  await expect(emptyState.locator("[data-slot='icon-wrapper']")).toHaveCount(0);
  await expect(emptyState).toContainText("등록된 오더가 없습니다");
  await expect(emptyState).toContainText(
    "+ Order에서 현재 차트에 필요한 오더를 추가해 주세요.",
  );
  await expect(
    emptyState.getByRole("button", { name: "+ Order" }),
  ).toBeVisible();
  await expect(pinnedHeader).toHaveCSS(
    "background-color",
    "rgb(250, 250, 250)",
  );
  await expect(scrollHeader).toHaveCSS(
    "background-color",
    "rgb(250, 250, 250)",
  );
  await expect(emptyBody).toHaveCSS("background-color", "rgb(255, 255, 255)");

  const emptyBodyOwnsVisibleSurface = await emptyBody.evaluate((surface) => {
    const rect = surface.getBoundingClientRect();
    const testPoints = [
      { x: rect.left + 8, y: rect.top + 8 },
      { x: rect.right - 8, y: rect.bottom - 2 },
    ];

    return testPoints.every(({ x, y }) => {
      const topElement = document.elementFromPoint(x, y);
      return topElement === surface || surface.contains(topElement);
    });
  });

  expect(emptyBodyOwnsVisibleSurface).toBe(true);

  const [emptyBodyBox, emptyStateBox, headerBox, orderTableBox, viewportBox] =
    await Promise.all([
      emptyBody.boundingBox(),
      emptyState.boundingBox(),
      orderTable.locator("[data-emr-data-table-header='true']").boundingBox(),
      orderTable.boundingBox(),
      pinnedViewport.boundingBox(),
    ]);

  expect(emptyBodyBox).not.toBeNull();
  expect(emptyStateBox).not.toBeNull();
  expect(headerBox).not.toBeNull();
  expect(orderTableBox).not.toBeNull();
  expect(viewportBox).not.toBeNull();
  expect(orderTableBox!.width).toBeGreaterThan(viewportBox!.width);
  expect(Math.abs(emptyBodyBox!.x - viewportBox!.x)).toBeLessThanOrEqual(1);
  expect(
    Math.abs(
      emptyBodyBox!.x +
        emptyBodyBox!.width -
        (viewportBox!.x + viewportBox!.width),
    ),
  ).toBeLessThanOrEqual(1);
  expect(
    Math.abs(emptyBodyBox!.y - (headerBox!.y + headerBox!.height)),
  ).toBeLessThanOrEqual(1);
  expect(
    Math.abs(
      emptyBodyBox!.y +
        emptyBodyBox!.height -
        (viewportBox!.y + viewportBox!.height),
    ),
  ).toBeLessThanOrEqual(1);
  expect(
    Math.abs(
      emptyStateBox!.x +
        emptyStateBox!.width / 2 -
        (emptyBodyBox!.x + emptyBodyBox!.width / 2),
    ),
  ).toBeLessThanOrEqual(1);
  expect(
    Math.abs(
      emptyStateBox!.y +
        emptyStateBox!.height / 2 -
        (emptyBodyBox!.y + emptyBodyBox!.height / 2),
    ),
  ).toBeLessThanOrEqual(1);

  await emptyState.getByRole("button", { name: "+ Order" }).click();
  await expect(page.getByRole("dialog", { name: "오더 추가" })).toBeVisible();
  await expect(
    chartContent.locator("[data-slot='chart-panel-skeleton']"),
  ).toHaveCount(0);

  for (const width of [1624, 1440, 1327, 1280, 1024]) {
    await page.setViewportSize({ height: 1088, width });
    await expect(assessmentEmptyState).toBeVisible();

    const geometry = await assessmentPanel.evaluate((panel) => {
      const viewport = panel.querySelector<HTMLElement>(
        "[data-slot='table-container']",
      );
      const emptyState = panel.querySelector<HTMLElement>(
        "[data-testid='chart-assessment-empty-state']",
      );
      const emptyViewport = panel.querySelector<HTMLElement>(
        "[data-slot='chart-assessment-empty-viewport']",
      );

      if (!viewport || !emptyState || !emptyViewport) {
        throw new Error("Assessment empty-state geometry target is missing");
      }

      const panelRect = panel.getBoundingClientRect();
      const viewportRect = viewport.getBoundingClientRect();
      const emptyStateRect = emptyState.getBoundingClientRect();
      const emptyViewportRect = emptyViewport.getBoundingClientRect();

      return {
        documentOverflow:
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
        emptyState: {
          left: emptyStateRect.left,
          right: emptyStateRect.right,
          top: emptyStateRect.top,
          bottom: emptyStateRect.bottom,
          centerX: emptyStateRect.left + emptyStateRect.width / 2,
          centerY: emptyStateRect.top + emptyStateRect.height / 2,
        },
        emptyViewport: {
          left: emptyViewportRect.left,
          right: emptyViewportRect.right,
          top: emptyViewportRect.top,
          bottom: emptyViewportRect.bottom,
          centerY: emptyViewportRect.top + emptyViewportRect.height / 2,
        },
        panel: {
          bottom: panelRect.bottom,
          left: panelRect.left,
          right: panelRect.right,
        },
        viewport: {
          left: viewportRect.left,
          right: viewportRect.right,
          top: viewportRect.top,
          bottom: viewportRect.bottom,
          center: viewportRect.left + viewportRect.width / 2,
          clientWidth: viewport.clientWidth,
          scrollWidth: viewport.scrollWidth,
          overflowY: getComputedStyle(viewport).overflowY,
        },
      };
    });

    expect(geometry.documentOverflow).toBe(0);
    expect(geometry.viewport.overflowY).toBe("auto");
    expect(geometry.viewport.left).toBeGreaterThanOrEqual(
      geometry.panel.left - 1,
    );
    expect(geometry.viewport.right).toBeLessThanOrEqual(
      geometry.panel.right + 1,
    );
    expect(
      Math.abs(geometry.viewport.bottom - geometry.panel.bottom),
    ).toBeLessThanOrEqual(1);
    expect(geometry.emptyViewport.top).toBeGreaterThanOrEqual(
      geometry.viewport.top - 1,
    );
    expect(geometry.emptyViewport.bottom).toBeLessThanOrEqual(
      geometry.viewport.bottom + 1,
    );
    expect(geometry.emptyState.left).toBeGreaterThanOrEqual(
      geometry.viewport.left - 1,
    );
    expect(geometry.emptyState.right).toBeLessThanOrEqual(
      geometry.viewport.right + 1,
    );
    expect(geometry.emptyState.top).toBeGreaterThanOrEqual(
      geometry.emptyViewport.top - 1,
    );
    expect(geometry.emptyState.bottom).toBeLessThanOrEqual(
      geometry.emptyViewport.bottom + 1,
    );
    expect(
      Math.abs(geometry.emptyState.centerX - geometry.viewport.center),
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs(geometry.emptyState.centerY - geometry.emptyViewport.centerY),
    ).toBeLessThanOrEqual(1);

    expect(geometry.viewport.scrollWidth).toBeLessThanOrEqual(
      geometry.viewport.clientWidth + 1,
    );
  }

  await page.setViewportSize({ height: 1088, width: 1024 });
  const getEmptyStateViewportOffset = () =>
    assessmentPanel.evaluate((panel) => {
      const viewport = panel.querySelector<HTMLElement>(
        "[data-slot='table-container']",
      );
      const emptyState = panel.querySelector<HTMLElement>(
        "[data-testid='chart-assessment-empty-state']",
      );

      if (!viewport || !emptyState) {
        throw new Error("Assessment empty-state scroll target is missing");
      }

      return (
        emptyState.getBoundingClientRect().left -
        viewport.getBoundingClientRect().left
      );
    });
  const emptyStateOffsetBeforeScroll = await getEmptyStateViewportOffset();
  const assessmentScrollLeft = await assessmentTableViewport.evaluate(
    (viewport) => {
      viewport.scrollLeft = viewport.scrollWidth;
      return viewport.scrollLeft;
    },
  );
  const emptyStateOffsetAfterScroll = await getEmptyStateViewportOffset();

  expect(assessmentScrollLeft).toBe(0);
  expect(
    Math.abs(emptyStateOffsetAfterScroll - emptyStateOffsetBeforeScroll),
  ).toBeLessThanOrEqual(1);
});

test("chart preconsultation read error uses the shared recovery empty state", async ({
  page,
}) => {
  let requestCount = 0;

  await page.route(
    "**/api/workspaces/*/chart/preconsultation-context?*",
    async (route) => {
      requestCount += 1;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          status: 503,
          error: "db_read_failed",
        }),
      });
    },
  );

  await page.goto(
    "/w/clair-demo/treatment?modulePanel=open&aside=closed&encounterId=encounter-haru-260430",
  );

  const feedback = page.getByTestId("preconsultation-feedback-state");
  await expect(feedback).toHaveAttribute("data-kind", "read-error");
  await expect(feedback).toContainText("접수 정보를 불러오지 못했어요");
  await expect(feedback).toContainText(
    "대기 목록의 접수 정보는 변경되지 않았어요.",
  );
  await expect(
    feedback.getByRole("button", { name: "대기 목록으로" }),
  ).toBeVisible();
  await expect(
    feedback.getByRole("button", { name: "다시 시도" }),
  ).toBeVisible();

  await feedback.getByRole("button", { name: "다시 시도" }).click();
  await expect.poll(() => requestCount).toBeGreaterThan(1);
  await expect(feedback).toBeVisible();

  await feedback.getByRole("button", { name: "대기 목록으로" }).click();
  await expect(page).not.toHaveURL(/encounterId=/);
});

test("chart consultation CTA moves from call to start before chart completion", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const workspaceId = "clair-demo";
  const encounterId = "encounter-choco-call-flow";
  const baseEncounter = {
    id: encounterId,
    workspaceId,
    patientId: "patient-choco-call-flow",
    guardianId: "guardian-choi-dohyun",
    appointmentId: "appointment-choco-call-flow",
    primaryVeterinarianId: "user-vet",
    encounterNo: "E-260625-0001",
    chiefComplaint: "보호자 요청 - 피부 가려움 재상담",
    visitPurpose: "피부 재진",
    receptionMemo: "최근 식욕 저하, 산책 후 발 핥음 증가",
    status: "waiting",
    checkedInAt: "2026-06-25T14:15:00+09:00",
    createdAt: "2026-06-25T14:15:00+09:00",
    updatedAt: "2026-06-25T14:15:00+09:00",
  };
  const baseQueueEntry = {
    id: "queue-choco-consultation",
    workspaceId,
    encounterId,
    queueType: "consultation",
    status: "waiting",
    priority: "normal",
    sortOrder: 1,
    enteredAt: "2026-06-25T14:15:00+09:00",
  };
  const patient = {
    id: "patient-choco-call-flow",
    patientNo: "CD-P-CTA",
    workspaceId,
    name: "초코",
    species: "dog",
    breed: "Pomeranian",
    estimatedAgeText: "9세",
    sex: "male",
    neutered: true,
    handlingCautionLocked: true,
    status: "active",
    createdAt: "2026-06-25T14:00:00+09:00",
    updatedAt: "2026-06-25T14:00:00+09:00",
  };
  const primaryGuardian = {
    id: "guardian-choi-dohyun",
    workspaceId,
    name: "최도현",
    mobilePhone: "010-0000-0000",
    createdAt: "2026-06-25T14:00:00+09:00",
    updatedAt: "2026-06-25T14:00:00+09:00",
  };
  let encounter = {
    ...baseEncounter,
    startedAt: undefined as string | undefined,
  };
  let queueEntry = {
    ...baseQueueEntry,
    calledAt: undefined as string | undefined,
  };
  let firstChart = {
    id: "chart-choco-call-flow-first",
    encounterId,
    authorUserId: "user-vet",
    authorDisplayName: "청담 원장",
    status: "draft",
    clinicalAt: "2026-06-25T05:20:00.000Z",
    createdAt: "2026-06-25T05:20:00.000Z",
    updatedAt: "2026-06-25T05:20:00.000Z",
  };
  let chartPrepared = false;

  await page.route(
    "**/api/workspaces/clair-demo/chart/soap-notes**",
    async (route) => {
      const request = route.request();
      if (request.method() === "GET") {
        await route.fulfill({
          contentType: "application/json",
          json: { ok: true, status: 200, soapNote: firstChart },
        });
        return;
      }
      const input = request.postDataJSON() as {
        blockDocument: unknown;
        mode: "autosave" | "manual_save";
      };
      firstChart = {
        ...firstChart,
        blockDocument: input.blockDocument,
        status: input.mode === "autosave" ? "autosaved" : "draft",
        updatedAt: "2026-06-25T05:21:00.000Z",
      } as typeof firstChart;
      await route.fulfill({
        contentType: "application/json",
        json: { ok: true, status: 200, soapNote: firstChart },
      });
    },
  );
  await page.route(
    "**/api/workspaces/clair-demo/chart/encounter-charts**",
    async (route) => {
      const request = route.request();
      if (request.method() === "GET") {
        await route.fulfill({
          contentType: "application/json",
          json: {
            ok: true,
            status: 200,
            charts: chartPrepared ? [firstChart] : [],
          },
        });
        return;
      }
      if (request.method() === "PUT") {
        chartPrepared = true;
        await route.fulfill({
          contentType: "application/json",
          json: { ok: true, status: 200, chart: firstChart },
        });
        return;
      }
      await route.fallback();
    },
  );
  await page.route(
    "**/api/workspaces/clair-demo/chart/diagnoses?*",
    (route) => route.fulfill({
      contentType: "application/json",
      json: { ok: true, status: 200, diagnoses: [], assessments: [], version: "first-chart-v1" },
    }),
  );
  await page.route(
    "**/api/workspaces/clair-demo/chart/completion?*",
    (route) => route.fulfill({
      contentType: "application/json",
      json: {
        ok: true,
        status: 200,
        completion: {
          encounterId,
          workspaceId,
          status: encounter.status,
          updatedAt: encounter.updatedAt,
        },
      },
    }),
  );
  await page.route(
    "**/api/workspaces/clair-demo/chart/live-queue**",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          queue: [
            {
              encounter,
              patient,
              primaryGuardian,
              queueEntry,
              veterinarianName: "청담 원장",
            },
          ],
          enforcedBy: "chart-live-queue-read",
        }),
      });
    },
  );
  await routePreconsultationContext(page, () => ({
    encounter: {
      id: encounter.id,
      encounterNo: encounter.encounterNo,
      appointmentId: encounter.appointmentId,
      receptionType: "appointment",
      visitPurpose: encounter.visitPurpose,
      chiefComplaint: encounter.chiefComplaint,
      receptionMemo: encounter.receptionMemo,
      checkedInAt: encounter.checkedInAt,
      status: encounter.status,
    },
    queue: { id: queueEntry.id, status: queueEntry.status },
    patient: {
      id: patient.id,
      patientNo: patient.patientNo,
      name: patient.name,
      species: patient.species,
      breed: patient.breed,
      estimatedAgeText: patient.estimatedAgeText,
      sex: patient.sex,
      neutered: patient.neutered,
      handlingCautionNote: "보정 시 보호자 동행 선호",
    },
    guardian: {
      id: primaryGuardian.id,
      name: primaryGuardian.name,
      memo: "최근 약 복용은 잘했으나 식욕이 돌아오지 않아 걱정",
    },
    appointment: {
      id: encounter.appointmentId,
      visitPurpose: encounter.visitPurpose,
      symptomNote: encounter.chiefComplaint,
    },
    veterinarian: { id: "user-vet", displayName: "청담 원장" },
    priorEncounterCount: 3,
    vitals: [
      {
        id: "vital-choco-current",
        encounterId,
        measuredAt: "2026-06-25T14:20:00+09:00",
        weightKg: 4.82,
        temperatureC: 38.64,
        respiratoryRateRpm: 20,
        bloodPressureSystolicMmhg: 132,
        bloodPressureDiastolicMmhg: 78,
      },
      {
        id: "vital-choco-previous",
        encounterId,
        measuredAt: "2026-06-25T14:16:00+09:00",
        weightKg: 4.78,
        temperatureC: 38.65,
        respiratoryRateRpm: 23,
        bloodPressureSystolicMmhg: 130,
        bloodPressureDiastolicMmhg: 79,
      },
      {
        id: "vital-choco-prior-encounter",
        encounterId: "encounter-choco-previous",
        measuredAt: "2026-05-09T10:00:00+09:00",
        weightKg: 4.76,
        temperatureC: 38.6,
        respiratoryRateRpm: 22,
        bloodPressureSystolicMmhg: 128,
        bloodPressureDiastolicMmhg: 80,
      },
    ],
    history: [
      {
        encounterId,
        encounterNo: encounter.encounterNo,
        checkedInAt: encounter.checkedInAt,
        status: encounter.status,
        chiefComplaint: encounter.chiefComplaint,
        receptionMemo: encounter.receptionMemo,
      },
      {
        encounterId: "encounter-choco-previous",
        encounterNo: "E-260509-0004",
        checkedInAt: "2026-05-09T10:00:00+09:00",
        status: "completed",
        visitPurpose: "약 복용 후 재진",
        assessment: "가려움 빈도 감소",
      },
      {
        encounterId: "encounter-choco-previous-imaging",
        encounterNo: "E-260509-0005",
        checkedInAt: "2026-05-09T15:18:00+09:00",
        status: "completed",
        visitPurpose: "슬관절 방사선 검사",
      },
      {
        encounterId: "encounter-choco-older",
        encounterNo: "E-260503-0001",
        checkedInAt: "2026-05-03T10:20:00+09:00",
        status: "completed",
        visitPurpose: "예방접종 및 건강검진",
      },
    ],
  }));
  await page.route(
    "**/api/workspaces/clair-demo/chart/completion**",
    async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            status: 200,
            completion: {
              encounterId,
              workspaceId,
              status: encounter.status,
              updatedAt: encounter.updatedAt,
            },
          }),
        });
        return;
      }
      await route.continue();
    },
  );
  await page.route(
    "**/api/workspaces/clair-demo/chart/consultation-flow",
    async (route) => {
      const body = (await route.request().postDataJSON()) as {
        action: "call" | "return_to_waiting" | "start";
        roomId?: string;
      };
      if (body.action === "call") {
        expect(body.roomId).toBe("room-consult-2");
        encounter = {
          ...encounter,
          status: "in_consultation",
          startedAt: "2026-06-25T05:20:00.000Z",
          updatedAt: "2026-06-25T05:20:00.000Z",
        };
        queueEntry = {
          ...queueEntry,
          status: "in_progress",
          calledAt: "2026-06-25T05:20:00.000Z",
        };
      } else if (body.action === "return_to_waiting") {
        encounter = {
          ...encounter,
          status: "waiting",
          startedAt: undefined,
          updatedAt: "2026-06-25T05:24:00.000Z",
        };
        queueEntry = {
          ...queueEntry,
          status: "waiting",
        };
      } else {
        encounter = {
          ...encounter,
          status: "in_consultation",
          startedAt: "2026-06-25T05:22:00.000Z",
          updatedAt: "2026-06-25T05:22:00.000Z",
        };
        queueEntry = {
          ...queueEntry,
          status: "in_progress",
        };
      }
      if (body.action !== "return_to_waiting") chartPrepared = true;

      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          flow: {
            encounter,
            queueEntry,
            ...(body.action === "return_to_waiting"
              ? {}
              : {
                  chart: firstChart,
                }),
            ...(body.action === "call"
              ? {
                  callEvent: {
                    id: "call-event-choco",
                    displayText: "2진료실로 환자를 호출합니다.",
                    deliveryStatus: "queued",
                    roomId: "room-consult-2",
                    roomName: "2진료실",
                  },
                }
              : {}),
          },
          enforcedBy: "chart-consultation-flow",
        }),
      });
    },
  );

  await page.setViewportSize({ width: 1324, height: 877 });
  await page.goto(
    `/w/clair-demo/treatment?modulePanel=open&aside=closed&encounterId=${encounterId}`,
  );

  await expect(page.getByTestId("chart-completion-status")).toHaveCount(0);
  await expect(page.getByLabel("환자 컨텍스트 정보")).toHaveCount(0);
  await expect(
    page.locator("[data-slot='chart-instruction-info-card']"),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "차트 공유" })).toHaveCount(0);
  await expect(
    page
      .getByTestId("workspace-main-content")
      .locator("[data-slot='emr-main-content-header']"),
  ).toHaveCount(0);
  const lockedState = page.getByTestId("chart-start-locked-state");
  const preconsultationCallButtons = lockedState.getByRole("button", {
    name: "호출하기",
    exact: true,
  });
  await expect(preconsultationCallButtons).toHaveCount(2);
  await expect(preconsultationCallButtons.first()).toBeVisible();
  await expect(
    lockedState.getByRole("button", {
      name: "환자 정보",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    lockedState.getByRole("button", {
      name: "보호자 정보",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "진료 완료" })).toHaveCount(0);
  await expect(lockedState.locator(":scope > div").first()).toHaveCSS(
    "max-width",
    "1024px",
  );
  await expect(lockedState).toHaveClass(/scroll-fade-y/);
  await expect(lockedState).toHaveClass(/scroll-fade-8/);
  await expect(lockedState).toHaveCSS("overflow-y", "auto");
  await expect(lockedState).toHaveCSS("padding-right", "16px");
  const lockedStateFrameMetrics = await lockedState.evaluate((element) => {
    const parent = element.parentElement;
    if (!parent) throw new Error("chart locked-state frame is missing");

    const frameRect = parent.getBoundingClientRect();
    const scrollRect = element.getBoundingClientRect();

    return {
      framePaddingRight: getComputedStyle(parent).paddingRight,
      rightInset: frameRect.right - scrollRect.right,
    };
  });
  expect(lockedStateFrameMetrics.framePaddingRight).toBe("0px");
  expect(Math.abs(lockedStateFrameMetrics.rightInset)).toBeLessThanOrEqual(1);
  await expect(lockedState).toContainText("진료 대기");
  await expect(lockedState).toContainText("차트번호 E-260625-0001");
  await expect(lockedState).toContainText("초코");
  await expect(lockedState).toContainText("최도현 보호자");
  await expect(lockedState).toContainText("Pomeranian");
  await expect(lockedState).toContainText("접수 정보");
  await expect(lockedState).toContainText("재진 여부");
  await expect(lockedState).toContainText("접수 유형");
  await expect(lockedState).toContainText("예약");
  await expect(lockedState).toContainText("접수 시각");
  await expect(lockedState).toContainText("14:15 접수");
  await expect(lockedState).toContainText("예상 소요시간");
  await expect(lockedState).toContainText("담당 수의사");
  await expect(lockedState).toContainText("청담 원장");
  const receptionSummaryGrid = lockedState.getByTestId(
    "preconsultation-reception-summary-grid",
  );
  const receptionSummaryItems = receptionSummaryGrid.locator(":scope > div");
  await expect(receptionSummaryItems).toHaveCount(5);
  for (let index = 0; index < 5; index += 1) {
    await expect(receptionSummaryItems.nth(index)).toHaveCSS(
      "border-left-width",
      "0px",
    );
    await expect(receptionSummaryItems.nth(index)).toHaveCSS(
      "border-right-width",
      "0px",
    );
    await expect(receptionSummaryItems.nth(index)).toHaveCSS(
      "border-top-width",
      "0px",
    );
    await expect(receptionSummaryItems.nth(index)).toHaveCSS(
      "border-bottom-width",
      "0px",
    );
  }
  const receptionDividers = receptionSummaryGrid.getByTestId(
    "preconsultation-reception-divider",
  );
  await expect(receptionDividers).toHaveCount(4);
  for (let index = 0; index < 4; index += 1) {
    await expect(receptionDividers.nth(index)).toHaveCSS("height", "40px");
    await expect(receptionDividers.nth(index)).toHaveCSS("width", "1px");
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(receptionDividers.nth(0)).toBeVisible();
  await expect(receptionDividers.nth(1)).toBeHidden();
  await expect(receptionDividers.nth(2)).toBeVisible();
  await expect(receptionDividers.nth(3)).toBeHidden();
  await page.setViewportSize({ width: 1324, height: 877 });
  await expect(lockedState).toContainText("방문 목적");
  await expect(lockedState).toContainText("피부 재진");
  await expect(lockedState).toContainText("환자/보호자 메모");
  await expect(lockedState).toContainText("보정 시 보호자 동행 선호");
  await expect(lockedState).toContainText("최근 약 복용은 잘했으나");
  const memoSection = lockedState.locator(
    'section[aria-labelledby="preconsultation-memo"]',
  );
  const memoCardContainer = memoSection.locator(":scope > div");
  await expect(memoCardContainer).toHaveCSS("flex-direction", "column");
  await expect(memoCardContainer).toHaveCSS("row-gap", "12px");
  await expect(memoCardContainer.locator(":scope > div")).toHaveCount(2);
  await expect(lockedState).toContainText("바이탈 정보");
  await expect(lockedState).toContainText("호흡수");
  await expect(lockedState).toContainText("4.82 kg");
  await expect(lockedState).toContainText("4.76 kg");
  await expect(lockedState).not.toContainText("4.78 kg");
  await expect(lockedState).not.toContainText("오늘 · 14:20");
  await expect(lockedState).toContainText("과거 진료이력");
  await expect(lockedState.getByLabel("환자 요약")).toHaveCount(0);
  await expect(
    lockedState.locator(
      'section[aria-labelledby="preconsultation-visit-purpose"] > div',
    ),
  ).toHaveCSS("background-color", "rgb(250, 250, 250)");
  await expect(
    lockedState.locator(
      'section[aria-labelledby="preconsultation-visit-purpose"] > div > p',
    ),
  ).toHaveCSS("font-size", "14px");
  await expect(
    lockedState.locator(
      'section[aria-labelledby="preconsultation-visit-purpose"] > div > p',
    ),
  ).toHaveCSS("line-height", "20px");
  const memoBodyTexts = memoSection.locator("p.min-w-0");
  await expect(memoBodyTexts).toHaveCount(2);
  for (let index = 0; index < 2; index += 1) {
    await expect(memoBodyTexts.nth(index)).toHaveCSS("font-size", "14px");
    await expect(memoBodyTexts.nth(index)).toHaveCSS("line-height", "20px");
  }
  const vitalHeaders = lockedState.getByRole("columnheader");
  await expect(vitalHeaders).toHaveCount(5);
  for (let index = 0; index < 5; index += 1) {
    await expect(vitalHeaders.nth(index)).toHaveCSS(
      "background-color",
      "rgb(250, 250, 250)",
    );
  }
  const vitalTable = lockedState.getByLabel(
    "환자 바이탈 표, 좁은 화면에서는 가로로 스크롤할 수 있습니다",
  );
  await expect(vitalTable).not.toContainText("현재");
  const weightDelta = vitalTable.getByLabel("체중 변화: 0.06 증가");
  await expect(weightDelta).toContainText("(0.06)");
  await expect(weightDelta).not.toContainText(/kg|증가|상승/);
  await expect(weightDelta.locator("svg")).toHaveCount(1);
  await expect(weightDelta.locator('[data-direction="increase"]')).toHaveCount(
    1,
  );

  const respiratoryDelta = vitalTable.getByLabel("호흡수 변화: 2 감소");
  await expect(respiratoryDelta).toContainText("(2)");
  await expect(respiratoryDelta).not.toContainText(/rpm|회\/분|감소|하강/);
  await expect(respiratoryDelta.locator("svg")).toHaveCount(1);
  await expect(
    respiratoryDelta.locator('[data-direction="decrease"]'),
  ).toHaveCount(1);

  await expect(vitalTable.getByLabel(/^체온 변화:/)).toHaveCount(0);

  await expect(vitalTable).toContainText("심박수");
  await expect(vitalTable).not.toContainText("혈압");
  const currentVitalDateCell = vitalTable
    .locator("tbody tr")
    .first()
    .locator("th");
  await expect(
    currentVitalDateCell.getByText("오늘", { exact: true }),
  ).toBeVisible();
  await expect(
    currentVitalDateCell.getByText("(26.06.25)", { exact: true }),
  ).toBeVisible();
  await expect(vitalTable.locator("table")).toHaveCSS("min-width", "960px");
  await expect(currentVitalDateCell).toHaveCSS("height", "52px");
  await expect(currentVitalDateCell).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
  await expect(currentVitalDateCell).toHaveCSS(
    "border-top-color",
    "rgb(229, 229, 229)",
  );
  const lastVitalCells = vitalTable
    .locator("tbody tr")
    .last()
    .locator("th, td");
  await expect(lastVitalCells).toHaveCount(5);
  for (let index = 0; index < 5; index += 1) {
    await expect(lastVitalCells.nth(index)).toHaveCSS(
      "border-bottom-width",
      "0px",
    );
  }
  await expect(
    currentVitalDateCell.getByText("오늘", { exact: true }),
  ).toHaveCSS("color", "rgb(38, 38, 38)");
  await expect(
    currentVitalDateCell.getByText("(26.06.25)", { exact: true }),
  ).toHaveCSS("color", "rgb(115, 115, 115)");
  const animalPatientAvatar = lockedState.getByTestId("animal-patient-avatar");
  await expect(animalPatientAvatar).toHaveAttribute(
    "data-avatar-state",
    "fallback",
  );
  await expect(animalPatientAvatar).toHaveCSS("border-top-left-radius", "12px");
  await expect(animalPatientAvatar).toHaveCSS(
    "border-top-color",
    "rgb(212, 212, 212)",
  );
  await expect(animalPatientAvatar).toHaveCSS("width", "72px");
  await expect(animalPatientAvatar).toHaveCSS("height", "72px");
  await expect(
    animalPatientAvatar.locator("[data-slot=avatar-fallback]"),
  ).toHaveCSS("border-top-left-radius", "12px");
  await expect(
    animalPatientAvatar.locator("[data-slot=avatar-fallback]"),
  ).toHaveCSS("background-color", "rgb(250, 250, 250)");
  const patientHeading = lockedState.getByRole("heading", {
    level: 1,
    name: "초코",
  });
  await expect(patientHeading.locator("xpath=../..")).toHaveCSS("opacity", "1");
  await expect(patientHeading).toHaveCSS("font-size", "28px");
  await expect(patientHeading).toHaveCSS("font-weight", "700");
  await expect(patientHeading).toHaveCSS("line-height", "38px");
  await expect(patientHeading).toHaveCSS("color", "rgb(23, 23, 23)");
  const patientHeaderRow = patientHeading.locator("xpath=..");
  await expect(
    patientHeaderRow.getByText("최도현 보호자", { exact: true }),
  ).toBeVisible();
  const patientMetadata = patientHeading.locator("xpath=../../p");
  await expect(patientMetadata).toHaveCSS("column-gap", "4px");
  await expect(patientMetadata).toHaveCSS("font-size", "16px");
  await expect(patientMetadata).toHaveCSS("line-height", "24px");
  await expect(patientMetadata).toHaveCSS("margin-top", "6px");
  await expect(
    patientMetadata.getByText("Pomeranian", { exact: true }),
  ).toHaveCSS("color", "rgb(115, 115, 115)");
  await expect(
    patientMetadata.getByText("·", { exact: true }).first(),
  ).toHaveCSS("color", "rgb(163, 163, 163)");
  await expect(lockedState.getByRole("heading", { level: 2 })).toHaveText([
    "접수 정보",
    "방문 목적",
    "환자/보호자 메모",
    "바이탈 정보",
    "과거 진료이력",
  ]);
  for (const sectionTitleId of [
    "preconsultation-reception-summary",
    "preconsultation-visit-purpose",
    "preconsultation-memo",
    "preconsultation-vitals",
    "preconsultation-history",
  ]) {
    await expect(lockedState.locator(`#${sectionTitleId}`)).toHaveCSS(
      "column-gap",
      "6px",
    );
    await expect(lockedState.locator(`#${sectionTitleId}`)).toHaveCSS(
      "font-size",
      "16px",
    );
  }
  const historySection = lockedState.getByTestId("preconsultation-history");
  const historyTimeline = historySection.getByTestId(
    "preconsultation-history-timeline",
  );
  await expect(historySection).toHaveCSS("row-gap", "16px");
  await expect(
    historySection.getByRole("button", { name: "전체 진료이력 보기" }),
  ).toHaveCount(0);
  await expect(historySection).toContainText("2026년 05월 09일");
  await expect(historySection).toContainText("10:00:00");
  await expect(historySection).toContainText("약 복용 후 재진");
  await expect(historySection).toContainText("15:18:00");
  await expect(historySection).toContainText("슬관절 방사선 검사");
  await expect(historySection).toContainText("2026년 05월 03일");
  await expect(historySection).toContainText("10:20:00");
  await expect(historySection).toContainText("예방접종 및 건강검진");
  await expect(historySection).not.toContainText("2026년 06월 25일");
  await expect(historySection).not.toContainText("완료");
  const preconsultationScrollMetrics = await lockedState.evaluate(
    (element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }),
  );
  expect(preconsultationScrollMetrics.scrollHeight).toBeGreaterThan(
    preconsultationScrollMetrics.clientHeight,
  );
  await lockedState.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect
    .poll(() => lockedState.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);
  await expect(historySection).toBeInViewport();
  await expect(historyTimeline).toHaveClass(/px-6/);
  await expect(historyTimeline).not.toHaveClass(/border-t/);
  await expect(historyTimeline).toHaveCSS("row-gap", "12px");
  await expect(historyTimeline).toHaveCSS("padding-top", "4px");
  await expect(historyTimeline).toHaveCSS("padding-left", "24px");
  const historyGroups = historyTimeline.locator(":scope > li");
  await expect(historyGroups).toHaveCount(2);
  await expect(historyGroups.nth(0)).toHaveCSS("column-gap", "8px");
  const firstHistoryTimeContainer = historyGroups
    .nth(0)
    .locator(":scope > div")
    .first();
  await expect(firstHistoryTimeContainer).toHaveCSS("width", "19px");
  await expect(firstHistoryTimeContainer).toHaveCSS("row-gap", "8px");
  const firstHistoryContent = historyGroups
    .nth(0)
    .locator(":scope > div")
    .nth(1);
  await expect(firstHistoryContent).toHaveCSS("row-gap", "8px");
  const firstHistoryDetails = firstHistoryContent.locator(":scope > ol");
  await expect(firstHistoryDetails).toHaveCSS("row-gap", "8px");
  await expect(firstHistoryDetails.locator(":scope > li")).toHaveCount(2);
  const firstHistoryCard = firstHistoryDetails.locator(":scope > li").first();
  await expect(firstHistoryCard).toHaveCSS("height", "56px");
  await expect(firstHistoryCard).toHaveCSS("column-gap", "12px");
  await expect(firstHistoryCard).toHaveCSS("padding-left", "16px");
  await expect(firstHistoryCard.locator("span").last()).toHaveCSS(
    "font-size",
    "15px",
  );
  await expect(
    historyGroups
      .nth(1)
      .locator(":scope > div")
      .nth(1)
      .locator(":scope > ol > li"),
  ).toHaveCount(1);
  await expect(page.getByTestId("chart-soap-diagnosis-grid")).toHaveCount(0);
  await page
    .getByTestId("chart-start-locked-state")
    .getByRole("button", { name: "환자 정보", exact: true })
    .click();
  const profilePanel = page.getByTestId("profile-side-panel");
  await expect(profilePanel).toHaveAttribute("data-profile-kind", "patient");
  await expect(profilePanel).toContainText("초코");
  await expect(page.getByTestId("workspace-drawer")).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(
    /drawer=patient%3Apatient-choco-call-flow|drawer=patient:patient-choco-call-flow/,
  );
  await page
    .getByTestId("chart-start-locked-state")
    .getByRole("button", { name: "보호자 정보", exact: true })
    .click();
  await expect(profilePanel).toHaveAttribute("data-profile-kind", "guardian");
  await expect(profilePanel).toContainText("최도현");
  await expect(page.getByTestId("workspace-drawer")).toHaveCount(0);
  await expect(page).toHaveURL(
    /drawer=guardian%3Aguardian-choi-dohyun|drawer=guardian:guardian-choi-dohyun/,
  );
  await page.keyboard.press("Escape");
  await expect(profilePanel).toHaveCount(0);
  await expect(page).toHaveURL(/\/w\/clair-demo\/treatment\?/);

  await page.getByTestId(`order-queue-item-action-${encounterId}`).click();
  const queueActionMenu = page.getByRole("menu");
  await expect(
    queueActionMenu.getByRole("menuitem", { name: "호출하기" }),
  ).toBeVisible();
  await expect(
    queueActionMenu.getByRole("menuitem", { name: "차트 열기" }),
  ).toBeVisible();
  await expect(queueActionMenu).not.toContainText("정보 drawer 연결 예정");
  await expect(queueActionMenu).not.toContainText("선택");
  await queueActionMenu.getByRole("menuitem", { name: "호출하기" }).click();
  await expect(
    page.getByRole("heading", { name: "초코/최도현을 호출하시겠습니까?" }),
  ).toBeVisible();
  const callDialog = page.getByRole("dialog", {
    name: "초코/최도현을 호출하시겠습니까?",
  });
  await expect(callDialog).toContainText(
    "진료실을 선택해 환자를 호출하면 즉시 진료가 시작됩니다.",
  );
  await expect(callDialog).toContainText("환자 / 보호자");
  await expect(callDialog).toContainText("초코 / 최도현");
  await expect(callDialog.getByText("초코 / 최도현")).toHaveCSS(
    "text-align",
    "left",
  );
  const patientPreflightRow = callDialog
    .locator("label")
    .filter({ hasText: "환자 / 보호자" })
    .locator("..");
  await expect(patientPreflightRow).toHaveCSS("column-gap", "12px");
  await expect(patientPreflightRow).toHaveClass(
    /grid-cols-\[minmax\(0,1fr\)_minmax\(0,2fr\)\]/,
  );
  await expect(callDialog).toContainText("접수 시각");
  await expect(callDialog).toContainText("담당 수의사");
  await expect(callDialog).toContainText("진료실");
  await expect(callDialog).not.toContainText("DID 표시 preview");
  await expect(callDialog).not.toContainText("현재 상태");
  await expect(callDialog).not.toContainText("local outbox");
  await expect(
    callDialog.getByRole("button", { name: "호출하기" }),
  ).toBeDisabled();
  const defaultRoomCheckbox = callDialog.getByRole("checkbox", {
    name: "이 진료실을 내 기본 진료실로 저장",
  });
  await expect(defaultRoomCheckbox).toBeDisabled();
  await callDialog.getByRole("combobox", { name: "호출 진료실" }).click();
  await page.getByRole("option", { name: "2진료실" }).click();
  await expect(
    callDialog.getByRole("combobox", { name: "호출 진료실" }),
  ).toContainText("2진료실");
  await expect(defaultRoomCheckbox).toBeEnabled();
  await defaultRoomCheckbox.click();
  await expect(defaultRoomCheckbox).toBeChecked();
  await expect(callDialog).not.toContainText("room-consult-2");
  await page.getByRole("button", { name: "호출하기" }).last().click();

  await expect(page.getByTestId("chart-completion-status")).toContainText(
    "진료중",
  );
  await expect(page.getByText("호출됨")).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.localStorage.getItem(
          "clair.chart.callRoomPreference.v1:clair-demo:playwright-default-session",
        ),
      ),
    )
    .toBe("room-consult-2");
  await expect(page.getByRole("button", { name: "진료 시작" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "차트 완료" })).toBeVisible();
  await expect(page.getByTestId("chart-start-locked-state")).toHaveCount(0);
  await expect(page.getByLabel("환자 컨텍스트 정보")).toContainText("초코");
  await expect(page.getByText("이 접수에 작성된 차트가 없어요")).toHaveCount(0);
  await expect(
    page.getByLabel("SOAP 블록 문서").getByRole("textbox"),
  ).toBeEditable();
  const firstChartText = "첫 진료 차트 저장 확인";
  const autosaveResponse = page.waitForResponse((response) =>
    response.request().method() === "PATCH" &&
    response.url().includes("/chart/soap-notes") &&
    response.request().postDataJSON()?.mode === "autosave",
  );
  await page.getByLabel("SOAP 블록 문서").getByRole("textbox").fill(firstChartText);
  expect((await autosaveResponse).ok()).toBe(true);
  await page.reload();
  await expect(page.getByLabel("SOAP 블록 문서")).toContainText(firstChartText);

  await page.getByRole("button", { name: "진료 보조 액션 열기" }).click();
  const chartActionMenu = page.getByRole("menu");
  await expect(
    chartActionMenu.getByRole("menuitem", { name: "대기로 변경" }),
  ).toBeVisible();
  await expect(
    chartActionMenu.getByRole("menuitem", { name: "진료 취소" }),
  ).toBeVisible();
  await chartActionMenu.getByRole("menuitem", { name: "진료 취소" }).click();
  const cancelDialog = page.getByRole("dialog", { name: "진료 취소" });
  await expect(cancelDialog).toBeVisible();
  await expect(
    cancelDialog.getByRole("button", { name: "진료 취소" }),
  ).toBeDisabled();
  await cancelDialog
    .getByLabel("진료 취소 사유")
    .fill("보호자 요청으로 진료를 취소합니다.");
  await expect(
    cancelDialog.getByRole("button", { name: "진료 취소" }),
  ).toBeEnabled();
});

test("chart renders legacy called consultation queue rows as in consultation", async ({
  page,
}) => {
  const workspaceId = "clair-demo";
  const encounterId = "encounter-legacy-called-flow";
  const encounter = {
    id: encounterId,
    workspaceId,
    patientId: "patient-legacy-called-flow",
    guardianId: "guardian-legacy-called-flow",
    primaryVeterinarianId: "user-vet",
    encounterNo: "E-260625-LEGACY",
    chiefComplaint: "호출 상태 호환 확인",
    visitPurpose: "현장 접수",
    receptionMemo: "called 상태가 진료중으로 보이는지 확인",
    status: "waiting",
    checkedInAt: "2026-06-25T14:15:00+09:00",
    createdAt: "2026-06-25T14:15:00+09:00",
    updatedAt: "2026-06-25T14:15:00+09:00",
  };
  const queueEntry = {
    id: "queue-legacy-called-consultation",
    workspaceId,
    encounterId,
    queueType: "consultation",
    status: "called",
    priority: "normal",
    sortOrder: 1,
    enteredAt: "2026-06-25T14:15:00+09:00",
    calledAt: "2026-06-25T05:20:00.000Z",
  };

  await page.route(
    "**/api/workspaces/clair-demo/chart/live-queue**",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          queue: [
            {
              encounter,
              patient: {
                id: "patient-legacy-called-flow",
                patientNo: "CD-P-CALLED",
                workspaceId,
                name: "초코",
                species: "dog",
                breed: "Pomeranian",
                estimatedAgeText: "9세",
                sex: "male",
                neutered: true,
                handlingCautionLocked: false,
                status: "active",
                createdAt: "2026-06-25T14:00:00+09:00",
                updatedAt: "2026-06-25T14:00:00+09:00",
              },
              primaryGuardian: {
                id: "guardian-legacy-called-flow",
                workspaceId,
                name: "최도현",
                mobilePhone: "010-0000-0000",
                createdAt: "2026-06-25T14:00:00+09:00",
                updatedAt: "2026-06-25T14:00:00+09:00",
              },
              queueEntry,
              veterinarianName: "청담 원장",
            },
          ],
          enforcedBy: "chart-live-queue-read",
        }),
      });
    },
  );
  await page.route(
    "**/api/workspaces/clair-demo/chart/completion**",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          completion: {
            encounterId,
            workspaceId,
            status: encounter.status,
            updatedAt: encounter.updatedAt,
          },
        }),
      });
    },
  );

  await page.goto(
    "/w/clair-demo/treatment?modulePanel=open&aside=closed&encounterId=" +
      encounterId,
  );

  await expect(page.getByTestId("chart-completion-status")).toContainText(
    "진료중",
  );
  await expect(page.getByText("호출됨")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "진료 시작" })).toHaveCount(0);
  await expect(page.getByTestId("chart-start-locked-state")).toHaveCount(0);
});

test("chart side panel date navigator refetches the selected operating date", async ({
  page,
}) => {
  const requestedDates: string[] = [];
  await page.route(
    "**/api/workspaces/clair-demo/chart/live-queue?*",
    async (route) => {
      const url = new URL(route.request().url());
      requestedDates.push(url.searchParams.get("date") ?? "");

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          enforcedBy: "chart-live-queue-read",
          queue: [],
        }),
      });
    },
  );

  await page.goto("/w/clair-demo/treatment?modulePanel=open&aside=closed");

  const sidePanel = page.locator("aside").first();
  const initialDateButton = sidePanel.getByRole("button", {
    name: "26.05.01(금) 날짜 선택",
  });
  await expect(initialDateButton).toBeVisible();
  await expect(initialDateButton).toContainText("26.05.01(금)");
  await expect(initialDateButton).toContainText("오늘");
  await expect.poll(() => requestedDates.join(",")).toContain("2026-05-01");

  await sidePanel.getByRole("button", { name: "다음 날짜" }).click({
    force: true,
  });
  await expect.poll(() => requestedDates.join(",")).toContain("2026-05-02");
  await expect(
    sidePanel.getByRole("button", { name: "26.05.02(토) 날짜 선택" }),
  ).toBeVisible();
  await expect(sidePanel.getByText("오늘", { exact: true })).toHaveCount(0);

  await sidePanel.getByRole("button", { name: "이전 날짜" }).click({
    force: true,
  });
  await expect
    .poll(() => requestedDates.filter((date) => date === "2026-05-01").length)
    .toBeGreaterThanOrEqual(2);
  const todayDateButton = sidePanel.getByRole("button", {
    name: "26.05.01(금) 날짜 선택",
  });
  await expect(todayDateButton).toBeVisible();
  await expect(todayDateButton).toContainText("오늘");

  await todayDateButton.click();
  await page.getByRole("button", { name: "26.05.08 (금) 선택" }).click();
  await expect.poll(() => requestedDates.join(",")).toContain("2026-05-08");
  await expect(
    sidePanel.getByRole("button", { name: "26.05.08(금) 날짜 선택" }),
  ).toBeVisible();
  await expect(sidePanel.getByText("오늘", { exact: true })).toHaveCount(0);

  await sidePanel
    .getByRole("button", { name: "26.05.08(금) 날짜 선택" })
    .click();
  await expect(
    page.getByRole("button", { name: "오늘 26.05.01 (금) 선택" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "오늘로 이동" }).click();
  await expect
    .poll(() => requestedDates.filter((date) => date === "2026-05-01").length)
    .toBeGreaterThanOrEqual(3);
  await expect(
    sidePanel.getByRole("button", { name: "26.05.01(금) 날짜 선택" }),
  ).toContainText("오늘");
});

test("chart diagnosis panel omits comment and plan text areas", async ({
  page,
}) => {
  await page.goto(kongScenarioUrl);

  const diagnosisPanel = page.getByLabel("진단명 관리");

  await expect(
    diagnosisPanel.getByText("진단 목록 · 코멘트 · 계획"),
  ).toHaveCount(0);
  await expect(diagnosisPanel.getByLabel("진단 코멘트")).toHaveCount(0);
  await expect(diagnosisPanel.getByLabel("Plan")).toHaveCount(0);
  await expect(diagnosisPanel.getByText("사전 연결 · 의심")).toHaveCount(0);
});

test("chart SOAP editor keeps one BlockNote document and reveals its provided selection toolbar", async ({
  page,
}) => {
  await page.goto(kongScenarioUrl);

  const soapDocument = page.getByLabel("SOAP 블록 문서");
  const soapEditor = soapDocument.locator('[contenteditable="true"]').first();

  await expect(
    soapDocument.getByText("주관적 · 보호자 진술", { exact: true }),
  ).toBeVisible();
  await expect(soapDocument).toContainText(
    "보호자 진술상 전날 밤부터 구토 3회",
  );
  await expect(page.locator(".bn-formatting-toolbar")).toHaveCount(0);
  await expect(soapDocument.locator(".ProseMirror-selectednode")).toHaveCount(0);
  await expect(soapEditor).not.toBeFocused();

  await soapDocument.locator('.bn-block-content[data-content-type="paragraph"]').first().click({ clickCount: 3 });
  const soapSelectionToolbar = page.locator(".bn-formatting-toolbar");
  await expect(soapSelectionToolbar).toBeVisible();
});
test("chart SOAP manual save persists through route-backed reload", async ({
  page,
}) => {
  const initialSoapResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      response
        .url()
        .includes("/api/workspaces/clair-demo/chart/soap-notes?encounterId="),
  );
  await page.goto("/w/clair-demo/treatment?modulePanel=open&aside=history");
  const loadedSoapResponse = await initialSoapResponse;
  expect(loadedSoapResponse.ok()).toBe(true);
  expect(loadedSoapResponse.url()).toContain(
    "encounterId=encounter-coco-260501",
  );

  const soapDocument = page.getByLabel("SOAP 블록 문서");
  const soapEditor = soapDocument
    .locator('.bn-block-content[data-content-type="paragraph"]')
    .first();
  const savedText = `DEN-69 SOAP route-backed save ${Date.now()}`;
  await expect(soapEditor).toBeEditable();
  const autosaveResponse = page.waitForResponse((response) => {
    const request = response.request();
    return (
      request.method() === "PATCH" &&
      response.url().includes("/api/workspaces/clair-demo/chart/soap-notes") &&
      request.postDataJSON()?.mode === "autosave"
    );
  });

  await soapEditor.click();
  await page.keyboard.press("End");
  await page.keyboard.type(` ${savedText}`);
  expect((await autosaveResponse).ok()).toBe(true);
  await expect(soapDocument).toContainText(savedText);

  const manualSaveResponse = page.waitForResponse((response) => {
    const request = response.request();
    return (
      request.method() === "PATCH" &&
      response.url().includes("/api/workspaces/clair-demo/chart/soap-notes") &&
      request.postDataJSON()?.mode === "manual_save"
    );
  });
  await page.getByRole("button", { name: "SOAP 저장" }).click();
  expect((await manualSaveResponse).ok()).toBe(true);
  await expect(page.getByTestId("chart-soap-status")).toContainText(
    /작성중|자동저장됨/,
  );

  await page.reload();
  await expect(page.getByLabel("SOAP 블록 문서")).toContainText(savedText);
});

test("chart SOAP reconciles a committed response-loss retry without a false conflict", async ({
  page,
}) => {
  let patchCount = 0;
  let readCount = 0;
  let committedNote: Record<string, unknown> | null = null;

  await page.route(
    "**/api/workspaces/clair-demo/chart/soap-notes**",
    async (route) => {
      const request = route.request();
      if (request.method() === "GET") {
        readCount += 1;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            status: 200,
            soapNote: committedNote,
          }),
        });
        return;
      }

      const input = request.postDataJSON() as {
        blockDocument: unknown;
        encounterId: string;
      };
      patchCount += 1;
      expect(request.headers()["x-request-id"]).toMatch(/^chart-soap-/);

      if (patchCount === 1) {
        committedNote = {
          id: "soap-response-loss",
          encounterId: input.encounterId,
          authorUserId: "user-vet",
          subjective: "response loss",
          objective: "",
          assessment: "",
          plan: "",
          blockDocument: input.blockDocument,
          status: "autosaved",
          autosavedAt: "2026-08-31T10:00:00.000Z",
          createdAt: "2026-08-31T10:00:00.000Z",
          updatedAt: "2026-08-31T10:00:00.000Z",
        };
        await route.abort("connectionreset");
        return;
      }

      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          status: 409,
          denialReason: "soap_note_conflict",
        }),
      });
    },
  );

  await page.goto("/w/clair-demo/treatment?modulePanel=open&aside=history");
  const soapDocument = page.getByLabel("SOAP 블록 문서");
  const soapEditor = soapDocument
    .locator('.bn-block-content[data-content-type="paragraph"]')
    .first();
  const localText = ` response-loss-${Date.now()}`;
  await soapEditor.click();
  await page.keyboard.press("End");
  await page.keyboard.type(localText);

  const saveError = page.getByTestId("chart-soap-save-error");
  await expect(saveError).toBeVisible();
  await expect(soapDocument).toContainText(localText.trim());
  await saveError.getByRole("button", { name: "다시 저장" }).click();

  await expect(
    page.getByText(
      "임상 기록은 서버에 반영되었습니다. 중복 저장하지 말고 관리자에게 변경 이력 상태를 확인해 주세요.",
    ),
  ).toBeVisible();
  await expect(saveError).toHaveCount(0);
  expect(patchCount).toBe(2);
  expect(readCount).toBeGreaterThanOrEqual(2);
});

test("chart SOAP slash command keeps content commands but omits nested SOAP templates", async ({
  page,
}) => {
  await routePristineKongSoap(page);
  await page.goto(kongScenarioUrl);
  const soapDocument = page.getByLabel("SOAP 블록 문서");
  const lastParagraph = soapDocument
    .locator('.bn-block-content[data-content-type="paragraph"]')
    .last();

  await lastParagraph.click();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("/");

  const suggestionMenu = page.getByRole("listbox");
  await expect(suggestionMenu).toBeVisible();
  await expect(
    suggestionMenu.getByRole("option", { name: /텍스트/ }),
  ).toBeVisible();
  await expect(
    suggestionMenu.getByRole("option", { name: /SOAP 템플릿/ }),
  ).toHaveCount(0);
});

test("chart SOAP keeps default and diagnosis-system input isolated across save and reload", async ({
  page,
}) => {
  test.setTimeout(60_000);
  let storedBlockDocument: unknown;
  let revision = 0;
  const buildSoapNote = () => ({
    id: "soap-kong-260501",
    encounterId: kongEncounterId,
    authorUserId: "user-vet-suji",
    ...kongSoapFields,
    blockDocument: storedBlockDocument,
    status: "autosaved",
    autosavedAt: `2026-09-03T10:00:0${revision}.000Z`,
    createdAt: "2026-05-01T09:40:00+09:00",
    updatedAt: `2026-09-03T10:00:0${revision}.000Z`,
  });

  await page.route(
    "**/api/workspaces/clair-demo/chart/soap-notes**",
    async (route) => {
      const request = route.request();
      if (request.method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          json: {
            ok: true,
            status: 200,
            enforcedBy: "chart-soap-note-persistence",
            soapNote: buildSoapNote(),
          },
        });
        return;
      }

      const input = request.postDataJSON() as { blockDocument: unknown };
      storedBlockDocument = input.blockDocument;
      revision += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        json: {
          ok: true,
          status: 200,
          auditRecorded: true,
          enforcedBy: "chart-soap-note-persistence",
          soapNote: buildSoapNote(),
        },
      });
    },
  );

  await page.goto(kongScenarioUrl);
  const defaultText = `default-scope-${Date.now()}`;
  const systemText = `digestive-scope-${Date.now()}`;
  const getFirstParagraph = () =>
    page
      .getByLabel("SOAP 블록 문서")
      .locator('.bn-block-content[data-content-type="paragraph"]')
      .first();
  const typeAndWaitForAutosave = async (text: string) => {
    const autosave = page.waitForResponse(
      (response) =>
        response.request().method() === "PATCH" &&
        response.url().includes("/chart/soap-notes") &&
        response.request().postDataJSON()?.mode === "autosave",
    );
    await getFirstParagraph().click();
    await page.keyboard.press("End");
    await page.keyboard.insertText(` ${text}`);
    expect((await autosave).ok()).toBe(true);
  };

  await typeAndWaitForAutosave(defaultText);
  await page.getByRole("tab", { name: "소화기", exact: true }).click();
  await expect(page.getByLabel("SOAP 블록 문서")).not.toContainText(defaultText);
  await expect(
    page.getByText("주관적 · 보호자 진술", { exact: true }),
  ).toBeVisible();

  await expect(page.getByLabel("SOAP 블록 문서").locator(".ProseMirror-selectednode")).toHaveCount(0);
  await expect(page.getByLabel("SOAP 블록 문서").locator('[contenteditable="true"]').first()).not.toBeFocused();
  await typeAndWaitForAutosave(systemText);
  await page.getByRole("tab", { name: "기본 S/O", exact: true }).click();
  await expect(page.getByLabel("SOAP 블록 문서")).toContainText(defaultText);
  await expect(page.getByLabel("SOAP 블록 문서")).not.toContainText(systemText);

  await page.reload();
  await expect(page.getByLabel("SOAP 블록 문서")).toContainText(defaultText);
  await page.getByRole("tab", { name: "소화기", exact: true }).click();
  await expect(page.getByLabel("SOAP 블록 문서")).toContainText(systemText);
  await expect(page.getByLabel("SOAP 블록 문서")).not.toContainText(defaultText);
});
test("chart diagnosis search recommends, adds, marks, and removes session diagnoses", async ({
  page,
}) => {
  await page.route("**/chart/diagnosis-catalog**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        status: 200,
        diagnoses: [
          {
            catalogId: "dx-acute-gastroenteritis",
            masterId: "master-acute-gastroenteritis",
            masterRevision: 1,
            name: "급성 위장관염 의심",
            synonyms: [],
            system: { id: "system-digestive", name: "소화기" },
            diseaseGroup: { id: "group-gastrointestinal", name: "위장관 질환" },
          },
          {
            catalogId: "dx-pancreatitis",
            masterId: "master-pancreatitis",
            masterRevision: 1,
            name: "췌장염 감별",
            synonyms: [],
            system: { id: "system-digestive", name: "소화기" },
            diseaseGroup: { id: "group-pancreas", name: "췌장 질환" },
          },
          {
            catalogId: "dx-mild-dehydration",
            masterId: "master-mild-dehydration",
            masterRevision: 1,
            name: "경도 탈수",
            synonyms: [],
            system: { id: "system-general", name: "전신" },
            diseaseGroup: { id: "group-fluid", name: "체액 질환" },
          },
        ],
        nextCursor: null,
      }),
    });
  });
  await page.goto(kongScenarioUrl);

  const diagnosisPanel = page.getByLabel("진단명 관리");

  await diagnosisPanel.getByLabel("진단명 검색").focus();
  await expect(
    page.getByRole("listbox", { name: "진단명 검색 결과" }),
  ).toBeVisible();
  await expect(page.getByText("SOAP/주호소 기반 추천")).toBeVisible();
  await expect(
    page.getByRole("option", { name: /급성 위장관염 의심/ }),
  ).toBeVisible();

  await diagnosisPanel.getByLabel("진단명 검색").fill("췌장");
  await page.getByRole("option", { name: /췌장염 감별/ }).click();

  await expect(diagnosisPanel.getByText("췌장염 감별")).toHaveCount(1);
  await expect(diagnosisPanel.getByText("사전 연결 · 감별")).toHaveCount(0);
  await expect(
    page.getByRole("tab", { name: "소화기", exact: true }),
  ).toBeVisible();

  await diagnosisPanel.getByLabel("진단명 검색").fill("탈수");
  await page.getByRole("option", { name: /경도 탈수/ }).click();

  await expect(diagnosisPanel.getByText("경도 탈수")).toHaveCount(1);
  await expect(
    page.getByRole("tab", { name: "전신", exact: true }),
  ).toBeVisible();

  const pancreatitisConfirmedToggle = diagnosisPanel.getByRole("checkbox", {
    name: "췌장염 감별 확진",
  });
  await pancreatitisConfirmedToggle.click();
  await expect(diagnosisPanel.getByText("사전 연결 · 확진")).toHaveCount(0);
  await expect(pancreatitisConfirmedToggle).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await pancreatitisConfirmedToggle.click();
  await expect(pancreatitisConfirmedToggle).toHaveAttribute(
    "aria-checked",
    "false",
  );

  const pancreatitisPrimary = diagnosisPanel.getByRole("checkbox", {
    name: "췌장염 감별 주진단",
  });
  await pancreatitisPrimary.click();
  await expect(pancreatitisPrimary).toHaveAttribute("aria-checked", "true");
  await expect(
    diagnosisPanel.locator(
      '[data-emr-table-checkbox-tone="brand"][aria-checked="true"]',
    ),
  ).toHaveCount(2);
  await expect(
    diagnosisPanel.getByRole("checkbox", {
      name: "급성 위장관염 의심 주진단",
    }),
  ).toHaveAttribute("aria-checked", "true");

  const pancreatitisClosed = diagnosisPanel.getByRole("checkbox", {
    name: "췌장염 감별 종결",
  });
  await pancreatitisClosed.click();
  await expect(pancreatitisClosed).toHaveAttribute("aria-checked", "true");
  await expect(pancreatitisConfirmedToggle).toHaveAttribute(
    "aria-checked",
    "false",
  );

  await diagnosisPanel
    .getByLabel("진단명 검색")
    .fill("보호자 설명용 임시 진단");
  await page.getByRole("option", { name: /보호자 설명용 임시 진단/ }).click();

  await expect(diagnosisPanel.getByText("보호자 설명용 임시 진단")).toHaveCount(
    1,
  );
  await expect(diagnosisPanel.getByText("직접 입력 · 의심")).toHaveCount(0);

  await diagnosisPanel
    .getByRole("button", { name: "보호자 설명용 임시 진단 삭제" })
    .click({ force: true });
  await expect(diagnosisPanel.getByText("보호자 설명용 임시 진단")).toHaveCount(
    0,
  );

  const baselinePrimary = diagnosisPanel.getByRole("checkbox", {
    name: "급성 위장관염 의심 주진단",
  });
  await expect(baselinePrimary).toHaveAttribute("aria-checked", "true");

  for (const diagnosisName of ["췌장염 감별", "경도 탈수"]) {
    const deleteButton = diagnosisPanel.getByRole("button", {
      name: `${diagnosisName} 삭제`,
    });
    await deleteButton.focus();
    await deleteButton.click();
    await expect(diagnosisPanel.getByText(diagnosisName)).toHaveCount(0);
  }

  const restored = await page.request.patch(
    "/api/workspaces/clair-demo/chart/diagnoses",
    {
      data: {
        encounterId: kongEncounterId,
        diagnoses: [
          {
            id: "diagnosis-kong-gastroenteritis",
            diagnosisText: "급성 위장관염 의심",
            diagnosisType: "suspected",
            isClosed: false,
            isPrimary: true,
            sortOrder: 0,
          },
        ],
      },
      headers: { "x-clair-demo-session-user-id": "user-vet" },
    },
  );
  expect(restored.ok()).toBe(true);
});

test("Assessment diagnosis table matches the approved Figma geometry and semantics", async ({
  page,
}) => {
  await page.setViewportSize(chartFigmaVisualFixture.viewport);
  await page.goto(chartFigmaVisualFixture.route);

  const diagnosisPanel = page.getByLabel("진단명 관리");
  const table = diagnosisPanel.getByRole("table", { name: "진단명 목록" });
  const headers = table.getByRole("columnheader");
  await expect(headers).toHaveCount(6);
  expect(await headers.allTextContents()).toEqual([
    "진단계통",
    "진단명",
    "주진단",
    "확진",
    "종결",
    "수의사",
  ]);

  const toolbar = diagnosisPanel.locator(
    "[data-slot='chart-assessment-toolbar']",
  );
  const toolbarGeometry = await toolbar.evaluate((element) => {
    const controls = [
      element.querySelector('[data-slot="select-trigger"]'),
      element.querySelector('[data-slot="popover-trigger"]'),
      element.querySelector('[data-slot="separator"]'),
      element.querySelector('[data-slot="button"]'),
    ].filter((control): control is Element => control instanceof Element);
    const style = getComputedStyle(element);
    const toolbarRect = element.getBoundingClientRect();
    const dividerRect = controls[2]?.getBoundingClientRect();
    return {
      dividerCenterOffset: dividerRect
        ? Math.abs(
            dividerRect.top +
              dividerRect.height / 2 -
              (toolbarRect.top + toolbarRect.height / 2),
          )
        : null,
      gap: style.columnGap,
      height: element.getBoundingClientRect().height,
      searchFillsAvailableWidth:
        controls[1] && controls[2]
          ? Math.abs(
              controls[1].getBoundingClientRect().right +
                Number.parseFloat(style.columnGap) -
                controls[2].getBoundingClientRect().left,
            )
          : null,
      selectValueFits: (() => {
        const value = controls[0]?.querySelector('[data-slot="select-value"]');
        return value ? value.scrollWidth <= value.clientWidth + 1 : false;
      })(),
      widths: controls.map((control) =>
        Math.round(control.getBoundingClientRect().width),
      ),
    };
  });
  expect(toolbarGeometry.gap).toBe("10px");
  expect(toolbarGeometry.height).toBe(44);
  expect(toolbarGeometry.widths[0]).toBeGreaterThanOrEqual(96);
  expect(toolbarGeometry.widths[1]).toBeGreaterThan(0);
  expect(toolbarGeometry.widths[2]).toBe(1);
  expect(toolbarGeometry.widths[3]).toBe(66);
  expect(toolbarGeometry.selectValueFits).toBe(true);
  expect(toolbarGeometry.searchFillsAvailableWidth).not.toBeNull();
  expect(toolbarGeometry.searchFillsAvailableWidth!).toBeLessThanOrEqual(1);
  expect(toolbarGeometry.dividerCenterOffset).not.toBeNull();
  expect(toolbarGeometry.dividerCenterOffset!).toBeLessThanOrEqual(0.5);

  const firstRow = table.locator("tbody tr").first();
  const tableViewport = diagnosisPanel.locator("[data-slot='table-container']");
  const rowGeometry = await firstRow.evaluate((row) => {
    const table = row.closest("table");
    const viewport = table?.parentElement;
    const panel = row.closest("section");

    if (!table || !viewport || !panel) {
      throw new Error("Assessment table geometry target is missing");
    }

    const panelRect = panel.getBoundingClientRect();
    const tableRect = table.getBoundingClientRect();
    const viewportRect = viewport.getBoundingClientRect();

    return {
      height: row.getBoundingClientRect().height,
      panelBottom: panelRect.bottom,
      tableHeight: tableRect.height,
      tableWidth: Math.round(tableRect.width),
      viewportBottom: viewportRect.bottom,
      viewportHeight: viewportRect.height,
      widths: Array.from(row.children).map((cell) =>
        Math.round(cell.getBoundingClientRect().width),
      ),
    };
  });
  expect(rowGeometry.height).toBe(40);
  expect(rowGeometry.widths).toHaveLength(6);
  expect(rowGeometry.widths[0]).toBe(100);
  expect(rowGeometry.widths[1]).toBeGreaterThan(0);
  expect(rowGeometry.widths.slice(2)).toEqual([52, 52, 52, 84]);
  expect(rowGeometry.widths[1]).toBe(rowGeometry.tableWidth - 340);
  const diagnosisRowDividerStyles = await table
    .locator("[data-slot='chart-assessment-table-row']")
    .evaluateAll((rows) =>
      rows.flatMap((row) =>
        Array.from(row.querySelectorAll("td")).map((cell) => {
          const style = getComputedStyle(cell);
          return {
            color: style.borderBottomColor,
            style: style.borderBottomStyle,
            width: style.borderBottomWidth,
          };
        }),
      ),
    );
  expect(diagnosisRowDividerStyles.length).toBeGreaterThan(0);
  expect(diagnosisRowDividerStyles).toEqual(
    diagnosisRowDividerStyles.map(() => ({
      color: "rgb(229, 229, 229)",
      style: "solid",
      width: "1px",
    })),
  );
  expect(
    Math.abs(rowGeometry.viewportBottom - rowGeometry.panelBottom),
  ).toBeLessThanOrEqual(1);
  expect(rowGeometry.tableHeight).toBeLessThan(rowGeometry.viewportHeight);
  await expect
    .poll(() =>
      tableViewport.evaluate(
        (element) => element.scrollWidth <= element.clientWidth + 1,
      ),
    )
    .toBe(true);

  const alignmentGeometry = await diagnosisPanel.evaluate((panel) => {
    const title = panel.querySelector("h2");
    const toolbar = panel.querySelector(
      "[data-slot='chart-assessment-toolbar']",
    );
    const filter = toolbar?.querySelector("[data-slot='select-trigger']");
    const searchButton = toolbar?.querySelector(
      ":scope > [data-slot='button']",
    );
    const table = panel.querySelector('table[aria-label="진단명 목록"]');
    const headerCells = Array.from(table?.querySelectorAll("thead th") ?? []);
    const rowCells = Array.from(
      table?.querySelectorAll("tbody tr:first-child td") ?? [],
    );

    if (
      !title ||
      !filter ||
      !searchButton ||
      headerCells.length !== 6 ||
      rowCells.length !== 6
    ) {
      throw new Error("Assessment alignment target is missing");
    }

    const rect = (element: Element | null) => {
      if (!element) throw new Error("Assessment alignment element is missing");
      const bounds = element.getBoundingClientRect();
      return {
        center: bounds.left + bounds.width / 2,
        left: bounds.left,
        right: bounds.right,
      };
    };

    return {
      columnBoundaries: headerCells.map((header, index) => ({
        body: rect(rowCells[index]),
        header: rect(header),
      })),
      contentEnd: {
        deleteButton: rect(rowCells[5].querySelector("button")).right,
        searchButton: rect(searchButton).right,
      },
      contentStart: {
        filter: rect(filter).left,
        systemBadge: rect(rowCells[0].querySelector("[data-slot='badge']"))
          .left,
        systemHeaderButton: rect(headerCells[0].querySelector("button")).left,
        title: rect(title).left,
      },
      headerInsets: {
        firstCell: getComputedStyle(headerCells[0]).paddingLeft,
        firstText: Math.round(
          rect(headerCells[0].querySelector("button > span:first-child")).left -
            rect(headerCells[0].querySelector("button")).left,
        ),
        lastCell: getComputedStyle(headerCells[5]).paddingRight,
        sortableButton: getComputedStyle(
          headerCells[0].querySelector("button")!,
        ).paddingLeft,
      },
      diagnosisTextStart: {
        body: rect(rowCells[1].querySelector("[data-emr-cell-text-mode]")).left,
        header: rect(headerCells[1].querySelector("button > span:first-child"))
          .left,
      },
      statusCenters: headerCells.slice(2, 5).map((header, index) => ({
        body: rect(rowCells[index + 2].querySelector("[data-slot='checkbox']"))
          .center,
        header: rect(header).center,
      })),
      veterinarianTextStart: {
        body: rect(rowCells[5].querySelector("[data-emr-cell-text-mode]")).left,
        header: (() => {
          const label = headerCells[5].querySelector(
            "[data-emr-table-content='true'] > span",
          );
          return (
            rect(label).left +
            Number.parseFloat(getComputedStyle(label!).paddingLeft)
          );
        })(),
      },
    };
  });

  for (const boundary of alignmentGeometry.columnBoundaries) {
    expect(boundary.body.left).toBeCloseTo(boundary.header.left, 2);
    expect(boundary.body.right).toBeCloseTo(boundary.header.right, 2);
  }
  for (const center of alignmentGeometry.statusCenters) {
    expect(center.body).toBeCloseTo(center.header, 2);
  }
  expect(
    alignmentGeometry.veterinarianTextStart.body -
      alignmentGeometry.veterinarianTextStart.header,
  ).toBeCloseTo(2, 2);
  expect(
    alignmentGeometry.diagnosisTextStart.header -
      alignmentGeometry.diagnosisTextStart.body,
  ).toBeCloseTo(6, 2);
  expect(alignmentGeometry.headerInsets).toEqual({
    firstCell: "12px",
    firstText: 10,
    lastCell: "12px",
    sortableButton: "10px",
  });
  for (const start of Object.values(alignmentGeometry.contentStart)) {
    expect(start).toBeCloseTo(alignmentGeometry.contentStart.title, 2);
  }
  expect(alignmentGeometry.contentEnd.deleteButton).toBeCloseTo(
    alignmentGeometry.contentEnd.searchButton,
    2,
  );

  const diagnosisText = firstRow
    .getByRole("cell")
    .nth(1)
    .locator("[data-emr-cell-text-mode]");
  const veterinarianText = firstRow
    .getByRole("cell")
    .nth(5)
    .locator("[data-emr-cell-text-mode]");
  for (const cellText of [diagnosisText, veterinarianText]) {
    await expect(cellText).toHaveAttribute(
      "data-emr-cell-text-mode",
      "one-line",
    );
    await expect(cellText).toHaveCSS("overflow", "hidden");
    await expect(cellText).toHaveCSS("text-overflow", "ellipsis");
    await expect(cellText).toHaveCSS("white-space", "nowrap");
    await expect(cellText).toHaveAttribute(
      "title",
      (await cellText.textContent()) ?? "",
    );
  }

  await expect(headers.first()).toHaveCSS("font-size", "12px");
  await expect(headers.first()).toHaveCSS("font-weight", "500");
  await expect(firstRow.getByRole("cell").nth(1)).toHaveCSS(
    "font-size",
    "14px",
  );
  const typographyGeometry = await Promise.all([
    headers
      .first()
      .evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).lineHeight),
      ),
    firstRow
      .getByRole("cell")
      .nth(1)
      .evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).lineHeight),
      ),
  ]);
  expect(typographyGeometry[0]).toBeCloseTo(16, 2);
  expect(typographyGeometry[1]).toBeCloseTo(20, 2);

  const primaryCheckbox = table
    .locator('[data-emr-table-checkbox-tone="brand"][aria-checked="true"]')
    .first();
  await expect(primaryCheckbox).toBeVisible();
  const primaryColor = await primaryCheckbox.evaluate((element) => {
    const tokenProbe = document.createElement("span");
    tokenProbe.style.background = "var(--clair-color-atomic-sky-500)";
    document.body.appendChild(tokenProbe);
    const result = {
      actual: getComputedStyle(element, "::before").backgroundColor,
      token: getComputedStyle(tokenProbe).backgroundColor,
    };
    tokenProbe.remove();
    return result;
  });
  expect(primaryColor.actual).toBe(primaryColor.token);

  await expect(diagnosisPanel).toHaveScreenshot(
    "chart-assessment-diagnosis-table-567x452.png",
    {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.002,
    },
  );

  for (const width of [1624, 1440, 1327, 1280, 1024]) {
    await page.setViewportSize({ height: 1088, width });
    await expect
      .poll(() =>
        tableViewport.evaluate((viewport) => {
          const firstCell = viewport.querySelector("tbody tr > td:first-child");
          if (!firstCell) return false;
          const expectedWidth = viewport.clientWidth >= 340 ? 100 : 92;
          return (
            Math.round(firstCell.getBoundingClientRect().width) ===
            expectedWidth
          );
        }),
      )
      .toBe(true);
    const horizontalGeometry = await tableViewport.evaluate((viewport) => {
      const table = viewport.querySelector("table");
      const lastHeader = table?.querySelector("th:last-child");
      const firstRow = table?.querySelector("tbody tr");

      if (!table || !lastHeader || !firstRow) {
        throw new Error("Assessment horizontal geometry target is missing");
      }

      const viewportRect = viewport.getBoundingClientRect();
      const tableRect = table.getBoundingClientRect();
      const lastHeaderRect = lastHeader.getBoundingClientRect();

      return {
        clientWidth: viewport.clientWidth,
        lastHeaderRight: lastHeaderRect.right,
        scrollWidth: viewport.scrollWidth,
        tableRight: tableRect.right,
        viewportRight: viewportRect.right,
        widths: Array.from(firstRow.children).map((cell) =>
          Math.round(cell.getBoundingClientRect().width),
        ),
      };
    });

    expect(horizontalGeometry.scrollWidth).toBeLessThanOrEqual(
      horizontalGeometry.clientWidth + 1,
    );
    expect(horizontalGeometry.tableRight).toBeLessThanOrEqual(
      horizontalGeometry.viewportRight + 1,
    );
    expect(horizontalGeometry.lastHeaderRight).toBeLessThanOrEqual(
      horizontalGeometry.viewportRight + 1,
    );
    expect(new Set(horizontalGeometry.widths.slice(2, 5)).size).toBe(1);
    if (horizontalGeometry.clientWidth >= 340) {
      expect(horizontalGeometry.widths[0]).toBe(100);
      expect(horizontalGeometry.widths.slice(2)).toEqual([52, 52, 52, 84]);
    } else {
      expect(horizontalGeometry.widths[0]).toBe(92);
      expect(horizontalGeometry.widths.slice(2)).toEqual([44, 44, 44, 72]);
    }
  }

  const systemHeader = table.getByRole("columnheader", { name: /진단계통/ });
  await systemHeader.getByRole("button", { name: "진단계통 정렬" }).click();
  await expect(systemHeader).toHaveAttribute("aria-sort", "ascending");
  await systemHeader.getByRole("button", { name: "진단계통 정렬" }).click();
  await expect(systemHeader).toHaveAttribute("aria-sort", "descending");
  await expect(
    table.getByRole("columnheader", { name: /진단명/ }),
  ).not.toHaveAttribute("aria-sort");

  await page.mouse.move(1, 1);
  const deleteButton = firstRow.getByRole("button", { name: /삭제/ });
  const deleteOverlay = firstRow.locator(
    "[data-slot='chart-assessment-delete-overlay']",
  );
  await expect(deleteOverlay).toHaveCSS("opacity", "0");
  await firstRow.hover();
  await expect(deleteOverlay).toHaveCSS("opacity", "1");
  await expect(deleteOverlay).toHaveCSS("width", "64px");
  await expect(deleteButton).toHaveCSS("border-radius", "6px");
  await expect(deleteButton.locator("svg")).toHaveCSS("width", "14px");
  await expect(deleteButton.locator("svg")).toHaveCSS("height", "14px");
  const hoverSurface = await firstRow.evaluate((row) => {
    const overlay = row.querySelector(
      "[data-slot='chart-assessment-delete-overlay']",
    );
    if (!overlay) throw new Error("Assessment delete overlay is missing");
    const surfaceProbe = document.createElement("span");
    surfaceProbe.style.backgroundColor =
      "var(--clair-color-atomic-neutral-100)";
    document.body.appendChild(surfaceProbe);
    const opaqueHoverSurface = getComputedStyle(surfaceProbe).backgroundColor;
    surfaceProbe.remove();
    return {
      opaqueHoverSurface,
      overlayBackground: getComputedStyle(overlay).backgroundImage,
      rowBackground: getComputedStyle(row).backgroundColor,
    };
  });
  expect(hoverSurface.overlayBackground).toContain(
    hoverSurface.opaqueHoverSurface,
  );
  expect(hoverSurface.overlayBackground).not.toContain(
    hoverSurface.rowBackground,
  );
  await page.mouse.move(1, 1);
  await deleteButton.focus();
  await expect(deleteOverlay).toHaveCSS("opacity", "1");
});

test("Assessment delete actions remain visible in touch environments", async ({
  browser,
}) => {
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { height: 880, width: 1327 },
  });
  const page = await context.newPage();

  try {
    await page.goto(kongScenarioUrl);
    const deleteButton = page
      .getByLabel("진단명 관리")
      .locator("[data-slot='chart-assessment-table-row']")
      .first()
      .getByRole("button", { name: /삭제/ });
    const deleteOverlay = page
      .getByLabel("진단명 관리")
      .locator("[data-slot='chart-assessment-table-row']")
      .first()
      .locator("[data-slot='chart-assessment-delete-overlay']");
    await expect(deleteOverlay).toHaveCSS("opacity", "1");
    await expect(deleteButton).toBeVisible();
  } finally {
    await context.close();
  }
});

test("chart safety context and confirmation dialogs identify the active patient", async ({
  page,
}) => {
  await page.goto(kongScenarioUrl);
  await restoreKongOrderDraftDefaults(page);

  const patientContext = page.getByLabel("환자 컨텍스트 정보");
  await expect(patientContext.getByText("콩이", { exact: true })).toBeVisible();
  await expect(patientContext.getByText("김하늘(주보호자)")).toBeVisible();
  await expect(
    page.getByText("E-260501-0003", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByTestId("chart-soap-status")).toContainText(
    /자동저장됨|작성중/,
  );

  await page.getByRole("button", { name: "Plan/Order 작업" }).click();
  await expect(page.getByRole("menuitem", { name: "Order 확정" })).toHaveCount(
    0,
  );
  await dismissChartOrderActionMenu(page);

  await page.getByRole("button", { name: "진료 종료", exact: true }).click();
  const chartCompleteDialog = page.getByRole("dialog", {
    name: "접수 진료 종료",
  });
  await expect(chartCompleteDialog.getByText("접수 진료 종료")).toBeVisible();
  await expect(chartCompleteDialog.getByText("콩이 / 김하늘")).toBeVisible();
  await expect(chartCompleteDialog.getByText("E-260501-0003")).toBeVisible();
  await expect(chartCompleteDialog.getByText(/\d+건 \/ 4건/)).toBeVisible();
  await chartCompleteDialog.getByRole("button", { name: "계속 작성" }).click();

  await page.getByRole("checkbox", { name: "CBC 검사 선택" }).check();
  const selectionActions = page.getByRole("toolbar", { name: "선택 행 작업" });
  await expect(
    selectionActions.getByRole("button", { name: "선택 확정" }),
  ).toBeEnabled();
  await selectionActions.getByRole("button", { name: "선택 확정" }).click();
  const orderConfirmDialog = page.getByRole("dialog");
  await expect(orderConfirmDialog.getByText("Order 확정 확인")).toBeVisible();
  await expect(
    orderConfirmDialog.getByText("환자: 콩이 · 보호자 김하늘"),
  ).toBeVisible();
  await expect(
    orderConfirmDialog.getByText("차트번호: E-260501-0003"),
  ).toBeVisible();
  await expect(
    orderConfirmDialog.getByText("선택 오더: 1건 · 선택 금액 35,000"),
  ).toBeVisible();
  await expect(orderConfirmDialog.getByText("재요청 포함: 없음")).toBeVisible();
});

test("chart keeps confirmation selection-scoped and routes current-chart billing to checkout", async ({
  page,
}) => {
  await page.goto(kongScenarioUrl);
  await restoreKongOrderDraftDefaults(page);

  await page.getByRole("button", { name: "Plan/Order 작업" }).click();
  await expect(page.getByRole("menuitem", { name: "Order 청구" })).toHaveCount(
    0,
  );
  await dismissChartOrderActionMenu(page);
  await expect(
    page.getByTestId("chart-order-footer").getByRole("button", {
      name: "수납에서 청구",
    }),
  ).toBeVisible();
  await page
    .getByTestId("chart-order-footer")
    .getByRole("button", {
      name: "금액 상세",
    })
    .click();
  const detailAside = page.getByLabel("Plan/Order 금액 상세");
  await expect(detailAside).toBeVisible();
  await expect(page.locator('[data-slot="dialog-overlay"]')).toHaveCount(0);
  await page.getByRole("checkbox", { name: "Maropitant 16mg T 선택" }).check();
  await expect(detailAside).toBeVisible();
  const selectionActions = page.getByRole("toolbar", { name: "선택 행 작업" });
  await expect(selectionActions).toContainText("확정 전 후보");
  await expect(
    selectionActions.getByRole("button", { name: "선택 확정" }),
  ).toBeVisible();
  await expect(
    selectionActions.getByRole("button", { name: "Order 청구" }),
  ).toHaveCount(0);
});

test("chart keeps orders visible when SOAP sections grow", async ({ page }) => {
  await page.goto(kongScenarioUrl);
  const soapDocument = page.getByLabel("SOAP 블록 문서");
  const lastParagraph = soapDocument
    .locator('.bn-block-content[data-content-type="paragraph"]')
    .last();
  await lastParagraph.click();
  await page.keyboard.press("End");
  for (let index = 0; index < 24; index += 1) {
    await page.keyboard.press("Enter");
    await page.keyboard.type(`SOAP 확장 행 ${index + 1}`);
  }

  await expect(soapDocument).toContainText("SOAP 확장 행 24");
  await expectTopEdgeInViewport(
    page,
    page.getByRole("tab", { name: "전체오더" }),
  );
  await expectTopEdgeInViewport(
    page,
    page.getByRole("button", { name: "Plan/Order 작업" }),
  );
});

test("chart grab divider resizes the SOAP and order areas", async ({
  page,
}) => {
  await page.goto(kongScenarioUrl);

  const divider = page.getByRole("separator", {
    name: "진료 기록과 처방/오더 영역 높이 조절",
  });
  const orderHeading = page.getByRole("tab", { name: "전체오더" });

  await expect(divider).toBeVisible();
  await expect(orderHeading).toBeVisible();

  const beforeBox = await orderHeading.boundingBox();

  await divider.press("ArrowDown");
  await divider.press("ArrowDown");

  const afterBox = await orderHeading.boundingBox();

  expect(beforeBox).not.toBeNull();
  expect(afterBox).not.toBeNull();
  expect(afterBox!.y).toBeGreaterThan(beforeBox!.y);
});

test("chart grab divider stops resizing when pointer focus is lost", async ({
  page,
}) => {
  await page.goto(kongScenarioUrl);

  const divider = page.getByRole("separator", {
    name: "진료 기록과 처방/오더 영역 높이 조절",
  });

  await expect(divider).toBeVisible();

  const dividerBox = await divider.boundingBox();

  expect(dividerBox).not.toBeNull();

  const pointerX = dividerBox!.x + dividerBox!.width / 2;
  const pointerY = dividerBox!.y + dividerBox!.height / 2;

  await page.mouse.move(pointerX, pointerY);
  await page.mouse.down();
  await page.mouse.move(pointerX, pointerY + 80);

  const valueAfterDrag = await divider.getAttribute("aria-valuenow");

  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.mouse.move(pointerX, pointerY - 120);
  await page.mouse.up();

  await expect(divider).toHaveAttribute("aria-valuenow", valueAfterDrag ?? "");
});

test("chart order checkboxes update the selected order total", async ({
  page,
}) => {
  await page.goto(kongScenarioUrl);
  await restoreKongOrderDraftDefaults(page);

  const orderFooter = page.getByTestId("chart-order-footer");
  await expect(orderFooter).toContainText("선택 오더 0건");
  await expect(orderFooter).toContainText("선택 오더 합계 0원");

  await page.getByRole("checkbox", { name: "Maropitant 16mg T 선택" }).check();

  await expect(orderFooter).toContainText("선택 오더 1건");
  await expect(orderFooter).toContainText("선택 오더 합계 4,500원");

  const selectAllOrders = page.getByRole("checkbox", {
    name: "오더 전체 선택",
  });

  await selectAllOrders.check();
  await expect(orderFooter).toContainText(/선택 오더 \d+건/);

  await selectAllOrders.uncheck();

  await expect(orderFooter).toContainText("선택 오더 0건");
  await expect(orderFooter).toContainText("선택 오더 합계 0원");
});

test("chart order table supports single sort without a filter control", async ({
  page,
}) => {
  await page.goto(kongScenarioUrl);
  await restoreKongOrderDraftDefaults(page);

  const orderArea = page.locator("section").filter({
    has: page.getByRole("tablist", { name: "처방/오더 분류" }),
  });
  const orderRows = orderArea.locator('[data-testid^="chart-order-row-"]');
  await orderArea
    .getByRole("button", { name: /청구금액 오름차순 정렬/ })
    .click();
  await expect(orderRows.first()).toContainText("Maropitant 16mg T");

  await orderArea
    .getByRole("button", { name: /청구금액 내림차순 정렬/ })
    .click();
  await expect(orderRows.first()).toContainText("복부 초음파");

  await expect(
    orderArea.getByRole("button", { name: "오더 필터 설정" }),
  ).toHaveCount(0);
  await expect(orderRows.first()).toBeVisible();
});

test("chart order table edits quantity, commits draft changes, and deletes rows", async ({
  page,
}) => {
  let removalPatchBody: Record<string, unknown> | undefined;
  await page.route(
    "**/api/workspaces/clair-demo/chart/order-drafts*",
    async (route) => {
      if (route.request().method() !== "PATCH") {
        await route.fallback();
        return;
      }
      const body = route.request().postDataJSON() as Record<string, unknown>;
      if (
        !Array.isArray(body.removedOrderIds) ||
        !body.removedOrderIds.length
      ) {
        await route.fallback();
        return;
      }
      removalPatchBody = body;
      const response = await route.fetch();
      await new Promise((resolve) => setTimeout(resolve, 250));
      await route.fulfill({ response });
    },
  );
  await page.goto(kongScenarioUrl);
  await restoreKongOrderDraftDefaults(page);

  const maropitantQuantity = page.getByLabel("Maropitant 16mg T 수량 수정");

  await expect(maropitantQuantity).toHaveValue("1");
  await maropitantQuantity.fill("0");

  await expect(page.getByTestId("chart-order-save-status")).toContainText(
    "변경 대기 1건 · 입력 확인 필요 1건",
  );

  await maropitantQuantity.fill("2");
  await page
    .getByLabel("Maropitant 16mg T 청구서명 수정")
    .fill("Maropitant 16mg T 변경");

  await expect(page.getByTestId("chart-order-save-status")).toContainText(
    "변경 대기 1건",
  );
  await expect(page.getByTestId("chart-order-footer")).toContainText(
    /이 차트 오더 예상/,
  );

  await page.getByRole("checkbox", { name: "Maropitant 16mg T 선택" }).check();
  await expect(page.getByTestId("chart-order-footer")).toContainText(
    "선택 오더 합계 9,000원",
  );

  await expect(page.getByText(/변경 대기/)).toHaveCount(0, {
    timeout: 10_000,
  });
  await expect(page.getByTestId("chart-order-footer")).toContainText(
    /이 차트 오더 합계/,
  );

  await page
    .getByRole("button", { name: "CBC 검사 후보 삭제" })
    .click({ force: true });
  const deleteDialog = page.getByRole("dialog");

  await expect(deleteDialog.getByText("오더를 삭제할까요?")).toBeVisible();
  await expect(
    deleteDialog.getByText(/삭제하면 즉시 저장합니다/),
  ).toBeVisible();
  await deleteDialog.getByRole("button", { name: "삭제", exact: true }).click();

  const pendingRemovalRow = page.getByTestId("chart-order-row-order-kong-cbc");
  await expect(pendingRemovalRow).toContainText("삭제 중");
  await expect(page.getByTestId("chart-order-save-status")).toContainText(
    "저장 중",
  );
  await expect(page.getByLabel("CBC 검사 수량 수정")).toHaveCount(0);
  expect(removalPatchBody?.removedOrderIds).toEqual(["order-kong-cbc"]);
  await expect(page.getByTestId("chart-order-save-status")).toContainText(
    "저장됨",
  );
  await expect(page.getByTestId("chart-order-footer")).toContainText(
    /이 차트 오더 합계/,
  );

  await page.reload();
  await expect(page.getByLabel("CBC 검사 수량 수정")).toHaveCount(0);

  await restoreKongOrderDraftDefaults(page);
  await page.getByRole("checkbox", { name: "CBC 검사 선택" }).check();
  await page.getByRole("checkbox", { name: "피하 수액 처치 선택" }).check();
  await page
    .getByRole("toolbar", { name: "선택 행 작업" })
    .getByRole("button", { name: "후보 삭제" })
    .click();
  const bulkDeleteDialog = page.getByRole("dialog");
  await expect(bulkDeleteDialog).toContainText("2개 오더를");
  await bulkDeleteDialog.getByRole("button", { name: "취소" }).click();
  await expect(page.getByTestId("chart-order-footer")).toContainText(
    /이 차트 오더 합계/,
  );
});

test("chart candidate removal keeps the row and offers retry when persistence fails", async ({
  page,
}) => {
  let failRemoval = true;
  await page.route(
    "**/api/workspaces/clair-demo/chart/order-drafts*",
    async (route) => {
      if (route.request().method() !== "PATCH") {
        await route.fallback();
        return;
      }
      const body = route.request().postDataJSON() as Record<string, unknown>;
      if (
        !Array.isArray(body.removedOrderIds) ||
        !body.removedOrderIds.length
      ) {
        await route.fallback();
        return;
      }
      if (failRemoval) {
        await route.fulfill({
          contentType: "application/json",
          json: { ok: false, status: 500, error: "db_write_failed" },
          status: 500,
        });
        return;
      }
      await route.fallback();
    },
  );

  await page.goto(kongScenarioUrl);
  await restoreKongOrderDraftDefaults(page);
  await page
    .getByRole("button", { name: "CBC 검사 후보 삭제" })
    .click({ force: true });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "삭제", exact: true })
    .click();

  await expect(page.getByLabel("CBC 검사 수량 수정")).toBeVisible();
  const errorAlert = page.getByTestId("chart-order-state-error");
  await expect(errorAlert).toBeVisible();
  await expect(page.getByTestId("chart-order-save-status")).toContainText(
    "저장 실패",
  );

  failRemoval = false;
  await errorAlert.getByRole("button", { name: "다시 저장" }).click();
  await expect(page.getByLabel("CBC 검사 수량 수정")).toHaveCount(0);
  await restoreKongOrderDraftDefaults(page);
});

test("chart order add announces success only after the candidate is persisted", async ({
  page,
}) => {
  let releaseSave!: () => void;
  const saveGate = new Promise<void>((resolve) => {
    releaseSave = resolve;
  });
  let gated = false;
  await page.route(
    "**/api/workspaces/clair-demo/chart/order-drafts*",
    async (route) => {
      if (route.request().method() !== "PATCH") {
        await route.fallback();
        return;
      }
      const body = route.request().postDataJSON() as Record<string, unknown>;
      const rows = Array.isArray(body.rows) ? body.rows : [];
      const addsBaso = rows.some(
        (value) =>
          value &&
          typeof value === "object" &&
          (value as Record<string, unknown>).workspaceCatalogItemId ===
            "ord-lab-cbc-baso",
      );
      if (!addsBaso || gated) {
        await route.fallback();
        return;
      }
      gated = true;
      const response = await route.fetch();
      await saveGate;
      await route.fulfill({ response });
    },
  );

  await page.goto(kongScenarioUrl);
  await restoreKongOrderDraftDefaults(page);
  await page.getByRole("button", { name: "+ Order", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "오더 추가" });
  await searchChartOrderCatalog(dialog, "BASO");
  const candidate = page.getByTestId(
    "chart-order-catalog-candidate-std-ord-lab-cbc-baso",
  );
  await candidate.click();
  await confirmChartOrderCatalogSelection(dialog, 1);

  await expect(page.getByText(/추가했어요 · 저장 중/)).toBeVisible();
  await expect(page.getByText(/Order 후보를 추가하고 저장했어요/)).toHaveCount(
    0,
  );
  await expect(page.getByTestId("chart-order-save-status")).toContainText(
    "저장 중",
  );

  releaseSave();
  await expect(
    page.getByText("1개 Order 후보를 추가하고 저장했어요."),
  ).toBeVisible();

  await page
    .getByRole("button", { name: "[CBC 검사] #BASO 후보 삭제" })
    .click({ force: true });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "삭제", exact: true })
    .click();
  await expect(page.getByText("1개 후보를 삭제하고 저장했어요.")).toBeVisible();
});

test("chart order added during an in-flight save can be removed without resurrection", async ({
  page,
}) => {
  let releaseAddSave!: () => void;
  const addSaveGate = new Promise<void>((resolve) => {
    releaseAddSave = resolve;
  });
  let gatedAdd = false;
  let addedOrderId = "";
  let removalPatchBody: Record<string, unknown> | null = null;
  await page.route(
    "**/api/workspaces/clair-demo/chart/order-drafts*",
    async (route) => {
      if (route.request().method() !== "PATCH") {
        await route.fallback();
        return;
      }
      const body = route.request().postDataJSON() as Record<string, unknown>;
      if (
        Array.isArray(body.removedOrderIds) &&
        body.removedOrderIds.length > 0
      ) {
        removalPatchBody = body;
        await route.fallback();
        return;
      }
      const rows = Array.isArray(body.rows) ? body.rows : [];
      const addedBasoRow = rows.find(
        (value) =>
          value &&
          typeof value === "object" &&
          (value as Record<string, unknown>).workspaceCatalogItemId ===
            "ord-lab-cbc-baso",
      );
      if (!addedBasoRow || gatedAdd) {
        await route.fallback();
        return;
      }
      addedOrderId = String(
        (addedBasoRow as Record<string, unknown>).orderId ?? "",
      );
      gatedAdd = true;
      const response = await route.fetch();
      await addSaveGate;
      await route.fulfill({ response });
    },
  );

  await page.goto(kongScenarioUrl);
  await restoreKongOrderDraftDefaults(page);
  await page.getByRole("button", { name: "+ Order", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "오더 추가" });
  await searchChartOrderCatalog(dialog, "BASO");
  await page
    .getByTestId("chart-order-catalog-candidate-std-ord-lab-cbc-baso")
    .click();
  await confirmChartOrderCatalogSelection(dialog, 1);

  await expect(page.getByTestId("chart-order-save-status")).toContainText(
    "저장 중",
  );
  await page
    .getByRole("button", { name: "[CBC 검사] #BASO 후보 삭제" })
    .click({ force: true });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "삭제", exact: true })
    .click();
  await expect(
    page.getByTestId(`chart-order-row-${addedOrderId}`),
  ).toContainText("삭제 중");

  releaseAddSave();
  await expect
    .poll(() => removalPatchBody?.removedOrderIds)
    .toEqual([addedOrderId]);
  await expect(page.getByLabel("[CBC 검사] #BASO 수량 수정")).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel("[CBC 검사] #BASO 수량 수정")).toHaveCount(0);
});

test("chart continuously edits a 20-row mixed draft with keyboard focus preserved", async ({
  page,
}) => {
  let scaledRows: Array<Record<string, unknown>> = [];
  let revision = 1;
  const getScaleEtag = () => `"${revision.toString(16).padStart(64, "0")}"`;
  const draftPatchBodies: Array<Record<string, unknown>> = [];
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => {
    if (
      request.method() === "PATCH" &&
      request.url().includes("/chart/order-drafts")
    ) {
      draftPatchBodies.push(
        (request.postDataJSON() ?? {}) as Record<string, unknown>,
      );
    }
  });

  await page.route(
    "**/api/workspaces/clair-demo/chart/order-drafts*",
    async (route) => {
      if (route.request().method() === "PATCH") {
        const body = route.request().postDataJSON() as Record<string, unknown>;
        const inputs = Array.isArray(body.rows) ? body.rows : [];
        const quantities = new Map(
          inputs.flatMap((row) => {
            if (!row || typeof row !== "object") return [];
            const value = row as Record<string, unknown>;
            return typeof value.orderId === "string" &&
              typeof value.quantity === "number"
              ? [[value.orderId, value.quantity] as const]
              : [];
          }),
        );
        scaledRows = scaledRows.map((row) => ({
          ...row,
          quantity: quantities.get(String(row.orderId)) ?? row.quantity,
        }));
        revision += 1;
        await route.fulfill({
          contentType: "application/json",
          json: {
            etag: getScaleEtag(),
            ok: true,
            rows: scaledRows,
            status: 200,
          },
          status: 200,
        });
        return;
      }
      if (route.request().method() !== "GET") {
        await route.fallback();
        return;
      }
      if (!scaledRows.length) {
        const upstream = await route.fetch();
        const body = (await upstream.json()) as {
          rows?: Array<Record<string, unknown>>;
        };
        const templates = body.rows ?? [];
        expect(templates.length).toBeGreaterThanOrEqual(4);
        scaledRows = Array.from({ length: 20 }, (_, index) => {
          const template = templates[index % templates.length];
          return {
            ...structuredClone(template),
            orderId: `${String(template.orderId)}-scale-${String(index + 1).padStart(2, "0")}`,
            quantity: 1,
          };
        });
      }
      await route.fulfill({
        contentType: "application/json",
        json: {
          etag: getScaleEtag(),
          ok: true,
          rows: scaledRows,
          status: 200,
        },
        status: 200,
      });
    },
  );

  await page.goto(kongScenarioUrl);
  await page.waitForLoadState("networkidle");

  const quantityInputs = page.locator('input[aria-label$="수량 수정"]');
  await expect(quantityInputs).toHaveCount(20);
  const firstQuantityInput = quantityInputs.first();
  const firstOrderRow = firstQuantityInput.locator(
    "xpath=ancestor::*[starts-with(@data-testid, 'chart-order-row-')]",
  );
  await firstQuantityInput.evaluate((element) => {
    element.setAttribute("data-render-stability-probe", "input");
  });
  await firstOrderRow.evaluate((element) => {
    element.setAttribute("data-render-stability-probe", "row");
  });
  const interactionStartedAt = Date.now();

  await firstQuantityInput.focus();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type("2");
  await firstQuantityInput.press("Tab");
  await expect(firstQuantityInput).not.toBeFocused();
  const focusedElement = page.locator(":focus");
  await expect(focusedElement).toHaveCount(1);
  expect(await focusedElement.evaluate((element) => element.tagName)).toMatch(
    /^(BUTTON|INPUT)$/,
  );

  for (let index = 1; index < 20; index += 1) {
    await quantityInputs.nth(index).fill(String(index + 2));
  }
  const interactionDurationMs = Date.now() - interactionStartedAt;
  expect(interactionDurationMs).toBeLessThan(10_000);
  await expect(firstQuantityInput).toHaveAttribute(
    "data-render-stability-probe",
    "input",
  );
  await expect(firstOrderRow).toHaveAttribute(
    "data-render-stability-probe",
    "row",
  );
  const expectedQuantities = Array.from(
    { length: 20 },
    (_, index) => index + 2,
  );
  const getFullySavedRows = () =>
    draftPatchBodies
      .map((body) => body.rows)
      .find(
        (rows): rows is Array<Record<string, unknown>> =>
          Array.isArray(rows) &&
          rows.length === 20 &&
          rows
            .map((row) => row.quantity)
            .sort((left, right) => Number(left) - Number(right))
            .every((quantity, index) => quantity === expectedQuantities[index]),
      );
  await expect
    .poll(() => Boolean(getFullySavedRows()), { timeout: 10_000 })
    .toBe(true);
  expect(pageErrors).toEqual([]);
  expect(
    getFullySavedRows()!
      .map((row) => row.quantity)
      .sort((left, right) => Number(left) - Number(right)),
  ).toEqual(expectedQuantities);

  const orderTable = page.getByRole("table", { name: "처방/오더 테이블" });
  const pinnedViewport = orderTable.locator(
    "xpath=ancestor::*[@data-emr-pinned-table-viewport='true']",
  );
  await expect(
    pinnedViewport.locator('[data-emr-pinned-table-scrollbar="horizontal"]'),
  ).toBeVisible();
  await expect(
    orderTable.locator(
      "[data-slot='table-head'][data-column-id='displayName'][data-emr-column-pinned='left']",
    ),
  ).toBeVisible();
});

test("chart opens the Kong scenario as one SOAP, assessment, and order flow", async ({
  page,
}) => {
  await routePristineKongSoap(page);
  await page.goto(kongScenarioUrl);

  const patientContext = page.getByLabel("환자 컨텍스트 정보");
  await expect(
    page.locator("[data-slot='chart-patient-context-bar']"),
  ).toHaveCSS("min-height", "56px");
  await expect(page.locator("[data-slot='patient-context-bar']")).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
  await expect(page.locator("[data-slot='patient-context-bar']")).toHaveCSS(
    "border-bottom-width",
    "1px",
  );
  await expect(patientContext.getByText("콩이")).toBeVisible();
  await expect(patientContext.getByText("김하늘")).toBeVisible();
  await expect(patientContext.getByText("주치의")).toBeVisible();
  const patientSection = page.locator("[data-slot='patient-context-patient']");
  const patientHoverAction = patientSection.locator(
    "[data-slot='patient-context-hover-action']",
  );
  await expect(patientHoverAction).toHaveCSS("opacity", "0");
  await patientSection.hover();
  const patientHoverBackground = await page.evaluate(() => {
    const probe = document.createElement("span");
    probe.style.backgroundColor = "var(--emr-context-bar-hover-bg)";
    document.body.appendChild(probe);
    const backgroundColor = getComputedStyle(probe).backgroundColor;
    probe.remove();

    return backgroundColor;
  });
  await expect(patientSection).toHaveCSS(
    "background-color",
    patientHoverBackground,
  );
  await expect(patientHoverAction).toHaveCSS("opacity", "1");
  await expect(
    page.getByText(
      "보호자 진술상 전날 밤부터 구토 3회, 아침 식욕 없음. 물 섭취 후 재구토.",
    ),
  ).toBeVisible();
  await expect(
    page.getByText("체온 39.1C, 복부 촉진 시 경미한 불편감. 탈수 경도 의심."),
  ).toBeVisible();
  await expect(
    page
      .getByText(
        "급성 위장관염 의심. 이물 가능성 배제를 위해 검사/영상 확인 필요.",
      )
      .first(),
  ).toBeVisible();
  await expect(
    page.getByText("피하 수액과 항구토제 처방 후 수납 안내").first(),
  ).toBeVisible();
  await expect(page.getByText("CBC 검사").first()).toBeVisible();
  await expect(page.getByText("복부 초음파").first()).toBeVisible();
  const orderDetail = await openChartOrderDetail(page, "Maropitant 16mg T");
  await expect(orderDetail).toContainText("구토 완화 처방");
  await orderDetail.getByRole("button", { name: "저장하고 닫기" }).click();
  await expect(
    page.getByRole("tab", { name: "전체오더 4", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("tab", { name: "임상 1", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "영상 1", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "조제 1", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "처치 1", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "원외(검사) 0", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "입원 0", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "기타 0", exact: true }),
  ).toBeVisible();
});

test("chart queue selection changes the selected encounter", async ({
  page,
}) => {
  test.setTimeout(60_000);

  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  await routePreconsultationContext(page, (encounterId) => {
    const isHaru = encounterId === "encounter-haru-260430";
    return {
      encounter: {
        id: encounterId,
        encounterNo: isHaru ? "E-260430-0005" : "E-260501-0002",
        receptionType: "walk_in",
        visitPurpose: isHaru ? "예방접종" : "정기 검진",
        chiefComplaint: isHaru ? "예방접종 전 건강 확인" : "정기 검진",
        checkedInAt: isHaru
          ? "2026-04-30T16:05:00+09:00"
          : "2026-05-01T09:50:00+09:00",
        status: "waiting",
      },
      queue: { id: `queue-${encounterId}`, status: "waiting" },
      patient: {
        id: isHaru ? "patient-haru" : "patient-coco",
        patientNo: isHaru ? "P-HARU" : "P-COCO",
        name: isHaru ? "하루" : "코코",
        species: isHaru ? "cat" : "dog",
        breed: isHaru ? "Korean Shorthair" : "Poodle",
        estimatedAgeText: isHaru ? "2세" : "4세",
        sex: isHaru ? "female" : "male",
      },
      guardian: {
        id: isHaru ? "guardian-kang-seoyun" : "guardian-coco",
        name: isHaru ? "강서윤" : "보호자",
      },
      veterinarian: { id: "user-vet", displayName: "이수지" },
      priorEncounterCount: isHaru ? 1 : 3,
      vitals: [],
      history: [],
    };
  });
  await page.route(
    "**/api/workspaces/clair-demo/chart/consultation-flow",
    async (route) => {
      const body = (await route.request().postDataJSON()) as {
        action: "call" | "return_to_waiting" | "start";
        encounterId: string;
        roomId?: string;
      };
      expect(body.action).toBe("call");
      expect(body.encounterId).toBe("encounter-haru-260430");
      expect(body.roomId).toBeTruthy();
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          enforcedBy: "chart-consultation-flow",
          flow: {
            encounter: {
              id: "encounter-haru-260430",
              workspaceId: "clair-demo",
              patientId: "patient-haru",
              guardianId: "guardian-kang-seoyun",
              primaryVeterinarianId: "user-vet",
              encounterNo: "E-260430-0005",
              visitPurpose: "예방접종",
              chiefComplaint: "예방접종 전 건강 확인",
              status: "in_consultation",
              checkedInAt: "2026-04-30T16:05:00+09:00",
              startedAt: "2026-04-30T16:10:00+09:00",
              createdAt: "2026-04-30T16:05:00+09:00",
              updatedAt: "2026-04-30T16:10:00+09:00",
            },
            queueEntry: {
              id: "queue-haru-consultation",
              workspaceId: "clair-demo",
              encounterId: "encounter-haru-260430",
              queueType: "consultation",
              status: "in_progress",
              priority: "normal",
              sortOrder: 3,
              enteredAt: "2026-04-30T16:05:00+09:00",
              calledAt: "2026-04-30T16:10:00+09:00",
            },
            callEvent: {
              id: "call-event-haru",
              displayText: "진료실로 환자를 호출합니다.",
              deliveryStatus: "queued",
              roomId: body.roomId,
              roomName: "1진료실",
            },
          },
        }),
      });
    },
  );
  await page.goto("/w/clair-demo/treatment");

  const haruQueueCard = page.getByTestId(
    "order-queue-item-encounter-haru-260430",
  );
  await expect(haruQueueCard).toBeVisible();
  await haruQueueCard.click();
  await expect(haruQueueCard).toHaveAttribute("aria-pressed", "true");

  await expect(page.getByLabel("환자 컨텍스트 정보")).toHaveCount(0);
  await expect(page.getByText("E-260430-0005").first()).toBeVisible();
  const lockedState = page.getByTestId("chart-start-locked-state");
  await expect(lockedState).toContainText("진료 대기");
  await expect(lockedState).toContainText("하루");
  await expect(lockedState).toContainText("강서윤 보호자");
  await expect(lockedState).toContainText("접수 정보");
  await expect(lockedState).toContainText("방문 목적");
  await expect(lockedState).toContainText("예방접종");
  await expect(lockedState).toContainText("접수 유형");
  await expect(lockedState).toContainText("외래");
  await expect(lockedState).toContainText("접수 시각");
  await expect(lockedState).toContainText("16:05 접수");
  await expect(lockedState).toContainText("담당 수의사");
  await expect(lockedState).toContainText("이수지");
  await expect(lockedState).toContainText("기록된 바이탈이 없어요");
  await expect(lockedState).toContainText("이전 진료이력이 없어요");
  await expect(page.getByText("진단 입력 전입니다.")).toHaveCount(0);
  await expect(page.getByLabel("SOAP 블록 문서")).toHaveCount(0);

  await lockedState
    .getByRole("button", { name: "호출하기", exact: true })
    .first()
    .click();
  const callDialog = page.getByRole("dialog", {
    name: "하루/강서윤을 호출하시겠습니까?",
  });
  await callDialog.getByRole("combobox", { name: "호출 진료실" }).click();
  await page.getByRole("option", { name: "1진료실" }).click();
  await callDialog.getByRole("button", { name: "호출하기" }).click();
  await expect(page.getByTestId("chart-start-locked-state")).toHaveCount(0);
  await expect(
    page.getByLabel("환자 컨텍스트 정보").getByText("하루", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("환자 컨텍스트 정보").getByText("강서윤(주보호자)"),
  ).toBeVisible();
  await expect(page.getByTestId("chart-completion-status")).toContainText(
    "진료중",
  );
  expect(
    consoleErrors.filter((message) =>
      message.includes("Encountered two children with the same key"),
    ),
  ).toEqual([]);
});

test("chart stale explicit encounter normalizes to the first refreshed queue task", async ({
  page,
}) => {
  await page.route(
    "**/api/workspaces/clair-demo/chart/live-queue**",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          enforcedBy: "chart-live-queue-read",
          queue: [
            {
              encounter: {
                id: "encounter-coco-260501",
                workspaceId: "clair-demo",
                patientId: "patient-coco",
                guardianId: "guardian-coco",
                encounterNo: "E-260501-0002",
                visitPurpose: "정기 검진",
                status: "waiting",
                checkedInAt: "2026-05-01T09:50:00+09:00",
                createdAt: "2026-05-01T09:50:00+09:00",
                updatedAt: "2026-05-01T09:50:00+09:00",
              },
              patient: {
                id: "patient-coco",
                workspaceId: "clair-demo",
                patientNo: "P-COCO",
                name: "코코",
                species: "dog",
                breed: "Poodle",
                estimatedAgeText: "4세",
                sex: "male",
                status: "active",
                createdAt: "2026-05-01T09:30:00+09:00",
                updatedAt: "2026-05-01T09:30:00+09:00",
              },
              primaryGuardian: {
                id: "guardian-coco",
                workspaceId: "clair-demo",
                name: "보호자",
                createdAt: "2026-05-01T09:30:00+09:00",
                updatedAt: "2026-05-01T09:30:00+09:00",
              },
              queueEntry: {
                id: "queue-coco-consultation",
                workspaceId: "clair-demo",
                encounterId: "encounter-coco-260501",
                queueType: "consultation",
                status: "waiting",
                priority: "normal",
                sortOrder: 1,
                enteredAt: "2026-05-01T09:50:00+09:00",
              },
              veterinarianName: "이수지",
            },
          ],
        }),
      });
    },
  );

  await routePreconsultationContext(page, (encounterId) => ({
    encounter: {
      id: encounterId,
      encounterNo: "E-260430-0005",
      receptionType: "walk_in",
      visitPurpose: "예방접종",
      chiefComplaint: "예방접종 전 건강 확인",
      checkedInAt: "2026-04-30T16:05:00+09:00",
      status: "waiting",
    },
    queue: { id: `queue-${encounterId}`, status: "waiting" },
    patient: {
      id: "patient-haru",
      patientNo: "P-HARU",
      name: "하루",
      species: "dog",
      breed: "Maltese",
      estimatedAgeText: "3세",
      sex: "female",
    },
    guardian: { id: "guardian-kang-seoyun", name: "강서윤" },
    veterinarian: { id: "user-vet", displayName: "이수지" },
    priorEncounterCount: 1,
    vitals: [],
    history: [],
  }));

  await page.goto(
    "/w/clair-demo/treatment?encounterId=encounter-haru-260430&modulePanel=open&aside=closed",
  );

  await expect(page).toHaveURL(/encounterId=encounter-coco-260501/);
  await expect(page.getByText("코코", { exact: true }).first()).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "This page couldn’t load" }),
  ).toHaveCount(0);
});

test("chart scenario query primes the encounter without locking queue selection", async ({
  page,
}) => {
  await page.goto(kongScenarioUrl);

  await expect(
    page.getByLabel("환자 컨텍스트 정보").getByText("콩이"),
  ).toBeVisible();

  const haruQueueItem = page.getByTestId(
    "order-queue-item-encounter-haru-260430",
  );
  await haruQueueItem.click();

  await expect(haruQueueItem).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByTestId("order-queue-item-encounter-kong-260501"),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(page).toHaveURL(/encounterId=encounter-haru-260430/);
});

test("chart history selection returns to a previous encounter for the patient", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/treatment?modulePanel=open&aside=history");

  await page.getByTestId("order-queue-item-encounter-coco-260501").click();
  const selectedHistoryItem = page
    .locator("#chart-content-aside")
    .locator('[data-encounter-id="encounter-coco-260501"]')
    .first();
  await expect(selectedHistoryItem).toContainText("내과 진료");
  await expect(selectedHistoryItem).not.toContainText("급성 위장관염 의심");
  await selectedHistoryItem.click();

  await expect(
    page.getByLabel("환자 컨텍스트 정보").getByText("코코"),
  ).toBeVisible();
  await expect(selectedHistoryItem).toHaveAttribute("data-selected", "true");
  await expect(page.getByLabel("처방 조회 범위")).toHaveCount(0);
  await expect(page.getByText("CBC 검사").first()).toBeVisible();
});

test("chart removes the retired patient information panel and keeps the history aside", async ({
  page,
}) => {
  await page.goto(
    "/w/clair-demo/treatment?modulePanel=open&aside=history&right=open",
  );

  const workspaceMain = page.getByTestId("workspace-frame").locator("main");
  await expect(page.locator("#chart-content-aside")).toBeVisible();
  await expect(page.getByRole("heading", { name: "History" })).toBeVisible();
  await expect(workspaceMain).toHaveAttribute("data-right-panel-open", "false");
  await expect(page).not.toHaveURL(/right=/);
  await expect(
    page.getByRole("heading", { name: "환자 정보", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "환자 정보 패널 접기" }),
  ).toHaveCount(0);
  await expect(page.getByText("개인/민감 정보", { exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByText("부가 정보", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /차트 이력 패널/ }),
  ).toBeVisible();
});

test("chart completion persists through route-backed reload", async ({
  page,
}) => {
  await page.goto(kongScenarioUrl);

  await expect(page.getByTestId("chart-completion-status")).toContainText(
    /오더 진행중|작성완료/,
  );

  await page.getByRole("button", { name: "진료 완료" }).click();
  const chartCompleteDialog = page.getByRole("dialog", {
    name: "진료 완료 확인",
  });
  await expect(chartCompleteDialog.getByText("진료 완료 확인")).toBeVisible();
  await expect(
    chartCompleteDialog
      .getByText("오더 진행중", { exact: true })
      .or(chartCompleteDialog.getByText(/작성완료 ·/))
      .first(),
  ).toBeVisible();
  await chartCompleteDialog
    .getByRole("button", { name: "진료 완료 저장" })
    .click();

  await expect(page.getByTestId("chart-completion-status")).toContainText(
    "작성완료",
  );

  await page.reload();
  await expect(page.getByTestId("chart-completion-status")).toContainText(
    "작성완료",
  );
});

test("chart result readback has no separate veterinarian or billing gate", async ({
  page,
}) => {
  await page.route(
    "**/api/workspaces/clair-demo/chart/order-lifecycle?**",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        json: {
          ok: true,
          status: 200,
          lifecycles: [
            {
              encounterId: "encounter-kong-260501",
              orderId: "order-kong-cbc",
              status: "completed",
              updatedAt: "2026-05-30T08:00:00.000Z",
            },
          ],
        },
      });
    },
  );
  await page.route(
    "**/api/workspaces/clair-demo/billing/invoice-candidates?**",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        json: { ok: true, status: 200, candidates: [] },
      });
    },
  );
  await page.goto(kongScenarioUrl);

  const cbcRow = page.getByTestId("chart-order-row-order-kong-cbc");
  await expect(cbcRow).not.toContainText("수의사 확인 필요");
  await expect(cbcRow.getByRole("button", { name: "수의사 확인" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Plan/Order 작업" }).click();
  await expect(page.getByRole("menuitem", { name: "Order 청구" })).toHaveCount(
    0,
  );
});

test("chart unavailable order actions show persistent inline guidance", async ({
  page,
}) => {
  await page.goto(kongScenarioUrl);

  await (await getChartOrderAction(page, /Order 출력/)).click();
  const unavailableAlert = page.getByTestId("chart-unavailable-action-alert");
  await expect(unavailableAlert).toContainText(
    "Order 출력은 아직 연결되지 않았습니다",
  );
  await expect(unavailableAlert).toContainText("문서 생성, 프린트, PDF 출력");
  const dismissButton = unavailableAlert.getByRole("button", {
    name: "안내 닫기",
  });
  await expect(dismissButton).toBeVisible();
  await expect(
    unavailableAlert.getByRole("button", { name: "확인" }),
  ).toHaveCount(0);
  const alertOverflowsOrderWorkspace = await unavailableAlert.evaluate(
    (element) => {
      const orderWorkspace = element.closest(
        '[data-slot="chart-workspace-panel"]',
      );

      return orderWorkspace
        ? element.getBoundingClientRect().right >
            orderWorkspace.getBoundingClientRect().right
        : true;
    },
  );
  expect(alertOverflowsOrderWorkspace).toBe(false);
  await dismissButton.click();
  await expect(unavailableAlert).toBeHidden();
});

test("chart order autosave preserves local edits and blocks confirmation on ETag conflict", async ({
  page,
}) => {
  await page.goto(kongScenarioUrl);
  await restoreKongOrderDraftDefaults(page);

  let patchCount = 0;
  await page.route(
    "**/api/workspaces/clair-demo/chart/order-drafts",
    async (route) => {
      if (route.request().method() !== "PATCH") {
        await route.continue();
        return;
      }
      patchCount += 1;
      await route.fulfill({
        contentType: "application/json",
        status: 409,
        json: {
          ok: false,
          status: 409,
          denialReason: "revision_conflict",
        },
      });
    },
  );

  await page.getByRole("checkbox", { name: "Maropitant 16mg T 선택" }).check();
  const billingName = page.getByLabel("Maropitant 16mg T 청구서명 수정");
  await billingName.fill("다른 기기와 충돌하는 로컬 편집값");
  await expect.poll(() => patchCount, { timeout: 2_500 }).toBe(1);

  const conflict = page.getByTestId("chart-order-draft-conflict");
  await expect(conflict).toContainText("현재 편집값은 덮어쓰지 않았습니다");
  await expect(billingName).toHaveValue("다른 기기와 충돌하는 로컬 편집값");
  await expect(
    page.getByRole("button", { name: "Maropitant 16mg T 확정" }),
  ).toBeDisabled();
  await expect(
    conflict.getByRole("button", { name: "서버 값 다시 불러오기" }),
  ).toBeVisible();
  await conflict.getByRole("button", { name: "안내 닫기" }).click();
  await expect(conflict).toHaveCount(0);
  const collapsedConflict = page.getByTestId("chart-order-draft-conflict-collapsed");
  await expect(collapsedConflict.getByRole("button", { name: "서버 값 다시 불러오기" })).toBeVisible();
  await expect(billingName).toHaveValue("다른 기기와 충돌하는 로컬 편집값");
  await expect(page.getByRole("button", { name: "Maropitant 16mg T 확정" })).toBeDisabled();

});

test("chart order autosave waits for a new edit after a failed attempt", async ({
  page,
}) => {
  await page.goto(kongScenarioUrl);
  await restoreKongOrderDraftDefaults(page);

  let patchCount = 0;
  await page.route(
    "**/api/workspaces/clair-demo/chart/order-drafts",
    async (route) => {
      if (route.request().method() !== "PATCH") {
        await route.continue();
        return;
      }
      patchCount += 1;
      const headers = route.request().headers();
      expect(headers[chartOrderExpectedEtagHeader.toLowerCase()]).toMatch(
        /^"[0-9a-f]{64}"$/,
      );
      expect(headers["if-match"]).toBeUndefined();
      await route.fulfill({
        contentType: "application/json",
        status: 503,
        json: { ok: false, status: 503, error: "db_write_failed" },
      });
    },
  );

  const billingName = page.getByLabel("Maropitant 16mg T 청구서명 수정");
  await billingName.fill("첫 번째 저장 실패 후 유지할 편집값");
  await expect.poll(() => patchCount, { timeout: 2_500 }).toBe(1);
  await page.waitForTimeout(1_200);
  expect(patchCount).toBe(1);
  await expect(page.getByTestId("chart-order-state-error")).toBeVisible();
  await expect(billingName).toHaveValue("첫 번째 저장 실패 후 유지할 편집값");

  await page.getByTestId("chart-order-state-error").getByRole("button", { name: "안내 닫기" }).click();
  await expect(page.getByTestId("chart-order-state-error")).toHaveCount(0);
  await expect(page.getByTestId("chart-order-state-error-collapsed").getByRole("button", { name: "다시 저장" })).toBeVisible();
  await billingName.fill("새로 수정한 편집값");
  await expect.poll(() => patchCount, { timeout: 2_500 }).toBe(2);
  await page.waitForTimeout(1_200);
  expect(patchCount).toBe(2);
  await expect(page.getByTestId("chart-order-state-error")).toBeVisible();
});

async function verifyChartConfirmationRetry(page: Page) {
  await page.goto(kongScenarioUrl);
  await restoreKongOrderDraftDefaults(page);

  let draftPatchCount = 0;
  const draftResponses: Array<Record<string, unknown>> = [];
  const actionBodies: Array<Record<string, unknown>> = [];
  await page.route(
    "**/api/workspaces/clair-demo/chart/order-drafts",
    async (route) => {
      if (route.request().method() !== "PATCH") {
        await route.continue();
        return;
      }
      draftPatchCount += 1;
      const response = await route.fetch();
      draftResponses.push((await response.json()) as Record<string, unknown>);
      await route.fulfill({ response });
    },
  );
  await page.route(
    "**/api/workspaces/clair-demo/chart/order-actions",
    async (route) => {
      if (route.request().method() !== "PATCH") {
        await route.continue();
        return;
      }
      const headers = route.request().headers();
      expect(headers[chartOrderExpectedEtagHeader.toLowerCase()]).toMatch(
        /^"[0-9a-f]{64}"$/,
      );
      expect(headers["if-match"]).toBeUndefined();
      actionBodies.push(
        (route.request().postDataJSON() ?? {}) as Record<string, unknown>,
      );
      if (actionBodies.length === 1) {
        await route.fulfill({
          contentType: "application/json",
          status: 500,
          json: { ok: false, status: 500, error: "db_write_failed" },
        });
        return;
      }
      await route.continue();
    },
  );

  const detail = await openChartOrderDetail(page, "CBC 검사");
  await detail.getByRole("switch", { name: "CBC 검사 긴급" }).check();
  await detail.getByRole("button", { name: "저장하고 닫기" }).click();
  await page.getByRole("checkbox", { name: "CBC 검사 선택" }).check();
  await getChartSelectedOrderConfirmAction(page).click();
  const confirmDialog = page.getByRole("dialog", { name: "Order 확정 확인" });
  const confirmButton = confirmDialog.getByRole("button", {
    name: "Order 확정",
  });
  await confirmButton.click();
  await expect.poll(() => draftResponses.length).toBe(1);
  expect(draftResponses[0]).toMatchObject({ ok: true });
  await expect.poll(() => actionBodies.length).toBe(1);
  await expect(confirmButton).toBeEnabled();

  await confirmButton.click();
  await expect.poll(() => actionBodies.length).toBe(2);
  await expect(confirmDialog).toBeHidden();

  expect(draftPatchCount).toBe(1);
  expect(actionBodies[0]).toMatchObject({
    action: "confirm",
    encounterId: "encounter-kong-260501",
  });
  expect(actionBodies[0]?.orderIds).toEqual(actionBodies[1]?.orderIds);
  expect(actionBodies[0]?.orderIds).toHaveLength(1);
  expect(actionBodies[0]?.idempotencyKey).toEqual(
    actionBodies[1]?.idempotencyKey,
  );
  expect(actionBodies[0]?.expectedEtag).toEqual(actionBodies[1]?.expectedEtag);
  expect(String(actionBodies[0]?.idempotencyKey)).toMatch(
    /^chart-confirm-[0-9a-f-]{36}$/,
  );
}

test("chart order catalog shows a visible loading state and count skeletons before rows arrive", async ({
  page,
}) => {
  await page.setViewportSize({ width: 2207, height: 1264 });

  let releaseCatalog!: () => void;
  const catalogGate = new Promise<void>((resolve) => {
    releaseCatalog = resolve;
  });
  await page.route(
    "**/api/workspaces/clair-demo/hospital-admin/order-catalog?mode=chart-search",
    async (route) => {
      await catalogGate;
      await route.fulfill({
        contentType: "application/json",
        json: { ok: true, rows: [], status: 200 },
        status: 200,
      });
    },
  );

  await page.goto(kongScenarioUrl);
  await page.getByRole("button", { name: "+ Order", exact: true }).click();

  const dialog = page.getByRole("dialog", { name: "오더 추가" });
  await expect(
    dialog.getByText("오더를 불러오는 중입니다", { exact: true }),
  ).toBeVisible();
  const loadingState = dialog.locator(
    '[data-slot="classification-explorer-loading-state"]',
  );
  await expect(loadingState).toBeVisible();
  await expect(
    loadingState.locator(
      '[data-slot="classification-explorer-loading-icon"]',
    ),
  ).toBeVisible();
  const loadingOffsets = await loadingState.evaluate((element) => {
    const body = element.parentElement;
    const childRects = Array.from(element.children).map((child) =>
      child.getBoundingClientRect(),
    );
    if (!body || !childRects.length) {
      throw new Error("order catalog loading body is missing");
    }

    const bodyRect = body.getBoundingClientRect();
    const left = Math.min(...childRects.map((rect) => rect.left));
    const right = Math.max(...childRects.map((rect) => rect.right));
    const top = Math.min(...childRects.map((rect) => rect.top));
    const bottom = Math.max(...childRects.map((rect) => rect.bottom));

    return {
      x: (left + right) / 2 - (bodyRect.left + bodyRect.right) / 2,
      y: (top + bottom) / 2 - (bodyRect.top + bodyRect.bottom) / 2,
    };
  });
  expect(Math.abs(loadingOffsets.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(loadingOffsets.y)).toBeLessThanOrEqual(1);
  await expect(
    dialog.getByTestId("classification-explorer-option-count-skeleton"),
  ).toHaveCount(9);
  await expect(
    dialog.getByTestId("classification-explorer-count-skeleton"),
  ).toHaveCount(1);

  releaseCatalog();
  await expect(
    dialog.getByText("오더를 불러오는 중입니다", { exact: true }),
  ).toBeHidden();
  await expect(dialog.getByText("전체 오더", { exact: true })).toBeVisible();
});

test("chart catalog dialog searches 108 service-review dispensing candidates at target scale", async ({
  page,
}) => {
  const rows = Array.from({ length: 108 }, (_, index) => {
    const sequence = String(index + 1).padStart(4, "0");
    const sourcePresetId = `pr017-dispensing-${sequence}`;
    return {
      appliedSnapshot: {
        appliedAmountBasis: "fixed_order_price",
        appliedBillingName: `PR-017 조제 ${sequence}`,
        appliedDestinationModule: "dispensing",
        appliedDisplayName: `PR-017 조제 ${sequence}`,
        appliedPriceKrw: 0,
        appliedSalesUnit: "per_each",
        appliedStandardOrderName: `Official PR-017 Product ${sequence}`,
        appliedTargetSpecies: ["dog", "cat"],
        appliedTaskRequired: true,
        appliedTaxIncluded: true,
        billingEligible: true,
        billingReflectionEnabled: false,
        clinicalOrderType: "dispensing",
        destinationModule: "dispensing",
        detailSchemaVersion: 1,
        executionMode: "routed",
        sourcePresetId,
        sourcePresetVersion: "2026-08-26.1",
        workspaceCatalogItemId: `pr017-catalog-${sequence}`,
      },
      billingEligible: true,
      billingName: `PR-017 조제 ${sequence}`,
      categoryGroup: "dispensing",
      clinicalOrderType: "dispensing",
      destinationModule: "dispensing",
      detailSchemaVersion: 1,
      displayName: `PR-017 조제 ${sequence}`,
      executionMode: "routed",
      rowType: "individual",
      sourcePresetId,
      sourcePresetVersion: "2026-08-26.1",
      targetSpecies: ["dog", "cat"],
      workspaceCatalogItemId: `pr017-catalog-${sequence}`,
      workspaceCatalogRevision: 1,
    };
  });

  await page.route(
    "**/api/workspaces/clair-demo/hospital-admin/order-catalog?mode=chart-search",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        json: { ok: true, rows, status: 200 },
        status: 200,
      });
    },
  );

  await page.goto(kongScenarioUrl);
  await page.getByRole("button", { name: "+ Order", exact: true }).click();

  const dialog = page.getByRole("dialog", {
    name: "오더 추가",
  });
  await expect(dialog.getByText("전체 오더", { exact: true })).toBeVisible();
  await expect(dialog.getByText("108개", { exact: true })).toBeVisible();
  const candidateColumn = dialog.locator('section[aria-label="전체 오더"]');
  const candidateHeading = candidateColumn.getByText("전체 오더", {
    exact: true,
  });
  const firstCandidateCopy = page
    .getByTestId("chart-order-catalog-candidate-pr017-dispensing-0001")
    .locator("span")
    .first();
  const [candidateHeadingBox, firstCandidateCopyBox] = await Promise.all([
    candidateHeading.boundingBox(),
    firstCandidateCopy.boundingBox(),
  ]);
  expect(candidateHeadingBox).not.toBeNull();
  expect(firstCandidateCopyBox).not.toBeNull();
  expect(
    Math.abs(candidateHeadingBox!.x - firstCandidateCopyBox!.x),
  ).toBeLessThanOrEqual(1);
  const candidateScroll = candidateColumn.locator(
    '[data-testid="chart-order-catalog-scroll"]',
  );
  const candidateScrollbar = candidateScroll.locator(
    '[data-slot="scroll-area-scrollbar"]',
  );
  const candidateThumb = candidateScrollbar.locator(
    '[data-slot="scroll-area-thumb"]',
  );
  const candidateScrollbarStyle = await candidateScroll.evaluate((element) => {
    const columnRect = element.parentElement?.getBoundingClientRect();
    const scrollbar = element.querySelector<HTMLElement>(
      '[data-slot="scroll-area-scrollbar"]',
    );
    const thumb = element.querySelector<HTMLElement>(
      '[data-slot="scroll-area-thumb"]',
    );
    const scrollbarRect = scrollbar?.getBoundingClientRect();
    return {
      rightGap:
        columnRect && scrollbarRect
          ? columnRect.right - scrollbarRect.right
          : null,
      thumbBackground: thumb ? getComputedStyle(thumb).backgroundColor : null,
      thumbRadius: thumb
        ? Number.parseFloat(getComputedStyle(thumb).borderRadius)
        : null,
    };
  });
  const [candidateScrollbarBox, candidateThumbBox] = await Promise.all([
    candidateScrollbar.boundingBox(),
    candidateThumb.boundingBox(),
  ]);
  expect(candidateScrollbarStyle.rightGap).toBeCloseTo(4, 0);
  expect(candidateScrollbarBox?.width).toBeCloseTo(10, 0);
  expect(candidateThumbBox?.width).toBeCloseTo(7, 0);
  expect(candidateScrollbarStyle.thumbBackground).toBe("rgb(229, 229, 229)");
  expect(candidateScrollbarStyle.thumbRadius).toBeGreaterThan(1_000);
  const selectedColumn = dialog.locator('section[aria-label="선택한 오더"]');
  const selectedViewport = selectedColumn.locator(
    '[data-slot="scroll-area-viewport"]',
  );
  const selectedEmptyState = selectedColumn
    .getByText("선택한 오더가 없습니다", { exact: true })
    .locator("xpath=ancestor::section[1]");
  const [selectedViewportBox, selectedEmptyStateBox] = await Promise.all([
    selectedViewport.boundingBox(),
    selectedEmptyState.boundingBox(),
  ]);
  expect(selectedViewportBox).not.toBeNull();
  expect(selectedEmptyStateBox).not.toBeNull();
  expect(
    Math.abs(
      selectedViewportBox!.x +
        selectedViewportBox!.width / 2 -
        (selectedEmptyStateBox!.x + selectedEmptyStateBox!.width / 2),
    ),
  ).toBeLessThanOrEqual(1);
  expect(
    Math.abs(
      selectedViewportBox!.y +
        selectedViewportBox!.height / 2 -
        (selectedEmptyStateBox!.y + selectedEmptyStateBox!.height / 2),
    ),
  ).toBeLessThanOrEqual(1);
  await searchChartOrderCatalog(dialog, "PR-017 조제 0108");
  const targetCandidate = page.getByTestId(
    "chart-order-catalog-candidate-pr017-dispensing-0108",
  );
  await expect(targetCandidate).toBeVisible();
  await expect(targetCandidate).toHaveCSS("height", "34px");
  await expect(targetCandidate.locator("span").first()).toHaveCSS(
    "font-size",
    "13px",
  );
  await expect(targetCandidate.locator("small")).toHaveCount(0);
  await expect(
    page.getByTestId("chart-order-catalog-candidate-pr017-dispensing-0001"),
  ).toBeHidden();
  await dialog
    .getByRole("combobox", { name: "전체 오더 검색", exact: true })
    .fill("Official PR-017 Product 0108");
  await expect(
    page.getByTestId("chart-order-catalog-candidate-pr017-dispensing-0108"),
  ).toBeVisible();
});

test("chart order add reorders selected orders with a grab handle before adding", async ({
  page,
}) => {
  const createCatalogRow = (
    sourcePresetId: string,
    displayName: string,
    appliedPriceKrw: number,
  ) => ({
    appliedSnapshot: {
      appliedAmountBasis: "unit_price",
      appliedBillingName: displayName,
      appliedDestinationModule: "lab",
      appliedDisplayName: displayName,
      appliedPriceKrw,
      appliedSalesUnit: "per_each",
      appliedStandardOrderName: displayName,
      appliedTargetSpecies: ["dog", "cat"],
      appliedTaskRequired: true,
      appliedTaxIncluded: true,
      billingEligible: true,
      billingReflectionEnabled: true,
      clinicalOrderType: "clinical_lab",
      defaultDetailInputs: {},
      destinationModule: "lab",
      detailSchemaVersion: 1,
      executionMode: "routed",
      sourcePresetId,
      sourcePresetVersion: "2026-08-30.1",
      workspaceCatalogItemId: sourcePresetId,
    },
    billingEligible: true,
    billingName: displayName,
    categoryGroup: "lab",
    clinicalOrderType: "clinical_lab",
    destinationModule: "lab",
    detailSchemaVersion: 1,
    displayName,
    executionMode: "routed",
    rowType: "individual",
    sourcePresetId,
    sourcePresetVersion: "2026-08-30.1",
    targetSpecies: ["dog", "cat"],
    workspaceCatalogItemId: sourcePresetId,
    workspaceCatalogRevision: 1,
  });

  await page.route(
    "**/api/workspaces/clair-demo/hospital-admin/order-catalog?mode=chart-search",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        json: {
          ok: true,
          rows: [
            createCatalogRow("reorder-lab-a", "재정렬 검사 A", 10_000),
            createCatalogRow("reorder-lab-b", "재정렬 검사 B", 20_000),
          ],
          status: 200,
        },
        status: 200,
      });
    },
  );

  await page.goto(kongScenarioUrl);
  await restoreKongOrderDraftDefaults(page);
  await page.getByRole("button", { name: "+ Order", exact: true }).click();

  const dialog = page.getByRole("dialog", { name: "오더 추가" });
  const firstCandidate = page.getByTestId(
    "chart-order-catalog-candidate-reorder-lab-a",
  );
  await firstCandidate.click();
  await expect(firstCandidate).toHaveAttribute("aria-selected", "true");
  await expect(firstCandidate.locator("svg")).toHaveCount(1);
  await expect(firstCandidate.locator("small")).toHaveCount(0);
  await expect(firstCandidate).not.toContainText("✓");
  await page.getByTestId("chart-order-catalog-candidate-reorder-lab-b").click();

  const dragHandle = dialog.getByRole("button", {
    name: "재정렬 검사 B 순서 변경",
  });
  await expect(dragHandle).toHaveCSS("cursor", "grab");
  const [dragBox, targetBox] = await Promise.all([
    dragHandle.boundingBox(),
    dialog
      .getByRole("button", { name: "재정렬 검사 A 순서 변경" })
      .boundingBox(),
  ]);
  expect(dragBox).not.toBeNull();
  expect(targetBox).not.toBeNull();
  await page.mouse.move(
    dragBox!.x + dragBox!.width / 2,
    dragBox!.y + dragBox!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    targetBox!.x + targetBox!.width / 2,
    targetBox!.y + targetBox!.height / 2,
    { steps: 8 },
  );
  await page.mouse.up();
  await page.waitForTimeout(60);

  const selectedNames = await dialog
    .getByRole("listitem")
    .locator("strong")
    .allTextContents();
  expect(selectedNames).toEqual(["재정렬 검사 B", "재정렬 검사 A"]);
  await confirmChartOrderCatalogSelection(dialog, 2);

  const reorderedA = page
    .getByRole("row")
    .filter({ hasText: "재정렬 검사 A" })
    .first();
  const reorderedB = page
    .getByRole("row")
    .filter({ hasText: "재정렬 검사 B" })
    .first();
  await expect(reorderedA).toBeVisible();
  await expect(reorderedB).toBeVisible();
  const [rowABox, rowBBox] = await Promise.all([
    reorderedA.boundingBox(),
    reorderedB.boundingBox(),
  ]);
  expect(rowABox).not.toBeNull();
  expect(rowBBox).not.toBeNull();
  expect(rowBBox!.y).toBeLessThan(rowABox!.y);
});

test("chart order catalog lets veterinarians deselect unconfirmed draft orders and cancel safely", async ({
  page,
}) => {
  const displayName = "Maropitant 16mg T";
  await page.route(
    "**/api/workspaces/clair-demo/hospital-admin/order-catalog?mode=chart-search",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        json: {
          ok: true,
          rows: [
            {
              appliedSnapshot: {
                appliedAmountBasis: "unit_price",
                appliedBillingName: displayName,
                appliedDestinationModule: "dispensing",
                appliedDisplayName: displayName,
                appliedPriceKrw: 4_500,
                appliedSalesUnit: "per_each",
                appliedStandardOrderName: displayName,
                appliedTargetSpecies: ["dog", "cat"],
                appliedTaskRequired: true,
                appliedTaxIncluded: true,
                billingEligible: true,
                billingReflectionEnabled: true,
                clinicalOrderType: "dispensing",
                defaultDetailInputs: {},
                destinationModule: "dispensing",
                detailSchemaVersion: 1,
                executionMode: "routed",
                sourcePresetId: "svc-med-maropitant",
                sourcePresetVersion: "2026-08-30.1",
                workspaceCatalogItemId: "svc-med-maropitant",
              },
              billingEligible: true,
              billingName: displayName,
              categoryGroup: "medication",
              clinicalOrderType: "dispensing",
              destinationModule: "dispensing",
              detailSchemaVersion: 1,
              displayName,
              executionMode: "routed",
              rowType: "individual",
              sourcePresetId: "svc-med-maropitant",
              sourcePresetVersion: "2026-08-30.1",
              targetSpecies: ["dog", "cat"],
              workspaceCatalogItemId: "svc-med-maropitant",
              workspaceCatalogRevision: 1,
            },
          ],
          status: 200,
        },
        status: 200,
      });
    },
  );

  await page.goto(kongScenarioUrl);
  await restoreKongOrderDraftDefaults(page);
  await page.getByRole("button", { name: "+ Order", exact: true }).click();

  let dialog = page.getByRole("dialog", { name: "오더 추가" });
  let candidate = page.getByTestId(
    "chart-order-catalog-candidate-svc-med-maropitant",
  );
  await expect(candidate).toHaveAttribute("aria-selected", "true");
  await expect(candidate).toBeEnabled();
  await expect(
    page.getByTestId("chart-order-catalog-selection-svc-med-maropitant"),
  ).toBeVisible();

  await candidate.click();
  await expect(candidate).toHaveAttribute("aria-selected", "false");
  await expect(
    page.getByTestId("chart-order-catalog-selection-svc-med-maropitant"),
  ).toHaveCount(0);
  await dialog.getByRole("button", { name: "취소", exact: true }).click();
  await expect(dialog).toBeHidden();
  await page.waitForTimeout(200);

  const reopenButton = page.getByRole("button", {
    name: "+ Order",
    exact: true,
  });
  await expect(reopenButton).toBeEnabled();
  await reopenButton.click();
  dialog = page.getByRole("dialog", { name: "오더 추가" });
  await expect(dialog).toBeVisible();
  candidate = page.getByTestId(
    "chart-order-catalog-candidate-svc-med-maropitant",
  );
  await expect(candidate).toHaveAttribute("aria-selected", "true");

  await candidate.click();
  await dialog.getByRole("button", { name: "선택 완료", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(
    page.getByLabel("Maropitant 16mg T 청구서명 수정", { exact: true }),
  ).toHaveCount(0);
});

test("chart dispensing catalog prefills master prescription values and preserves veterinarian edits", async ({
  page,
}) => {
  const displayName = "테스트 Amoxicillin 조제";
  const defaultDetailInputs = {
    doseBasis: "patient",
    dose: 0.5,
    doseUnit: "ml",
    route: "PO",
    frequency: "bid",
    durationDays: 7,
    totalQuantity: 7,
    totalQuantityUnit: "ml",
    medicationInstruction: "any_time",
    storageMethod: "room_temp",
    compoundNote: "사용 전 충분히 흔든 뒤 총 조제량과 라벨을 대조한다.",
    guardianNote: "정해진 시간에 1회 0.5mL씩 하루 2회, 7일간 투여하세요.",
    extraLabelSpeciesConfirmed: false,
  };
  const draftPatchBodies: Array<Record<string, unknown>> = [];

  await page.route(
    "**/api/workspaces/clair-demo/hospital-admin/order-catalog?mode=chart-search",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        json: {
          ok: true,
          status: 200,
          rows: [
            {
              appliedSnapshot: {
                appliedAmountBasis: "unit_price",
                appliedBillingName: displayName,
                appliedDestinationModule: "dispensing",
                appliedDisplayName: displayName,
                appliedPriceKrw: 11_500,
                appliedSalesUnit: "per_each",
                appliedStandardOrderName: displayName,
                appliedTargetSpecies: ["dog", "cat"],
                appliedTaskRequired: true,
                appliedTaxIncluded: true,
                billingEligible: true,
                billingReflectionEnabled: true,
                clinicalOrderType: "dispensing",
                defaultDetailInputs,
                destinationModule: "dispensing",
                detailSchemaVersion: 1,
                executionMode: "routed",
                medicationMetadata: {
                  schemaVersion: 2,
                  presetOrigin: "clair_master",
                  presetStatus: "synthetic_unreviewed",
                  defaultDetailInputs,
                },
                sourcePresetId: "std-ord-med-maropitant",
                sourcePresetVersion: "2026-08-26.1",
                workspaceCatalogItemId: "ord-med-maropitant",
              },
              billingEligible: true,
              billingName: displayName,
              categoryGroup: "medication",
              clinicalOrderType: "dispensing",
              destinationModule: "dispensing",
              detailSchemaVersion: 1,
              displayName,
              executionMode: "routed",
              rowType: "individual",
              sourcePresetId: "std-ord-med-maropitant",
              sourcePresetVersion: "2026-08-26.1",
              targetSpecies: ["dog", "cat"],
              workspaceCatalogItemId: "ord-med-maropitant",
              workspaceCatalogRevision: 1,
            },
          ],
        },
        status: 200,
      });
    },
  );
  page.on("request", (request) => {
    if (
      request.method() !== "PATCH" ||
      !request.url().includes("/chart/order-drafts")
    ) {
      return;
    }
    const body = request.postDataJSON() as Record<string, unknown> | null;
    if (body) draftPatchBodies.push(body);
  });

  await page.goto(kongScenarioUrl);
  await restoreKongOrderDraftDefaults(page);
  await page.getByRole("button", { name: "+ Order", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "오더 추가",
  });
  const candidate = page.getByTestId(
    "chart-order-catalog-candidate-std-ord-med-maropitant",
  );
  await expect(candidate).toContainText(displayName);
  await candidate.click();
  await confirmChartOrderCatalogSelection(dialog, 1);

  await expect
    .poll(() =>
      draftPatchBodies.some((body) => {
        if (!Array.isArray(body.rows)) return false;
        return body.rows.some((value) => {
          if (!value || typeof value !== "object") return false;
          const row = value as Record<string, unknown>;
          return (
            row.workspaceCatalogItemId === "ord-med-maropitant" &&
            JSON.stringify(row.detailInputs) ===
              JSON.stringify(defaultDetailInputs)
          );
        });
      }),
    )
    .toBe(true);

  const addedBillingName = page
    .getByLabel("Maropitant 16mg T 청구서명 수정")
    .nth(1);
  const addedRow = addedBillingName.locator("xpath=ancestor::tr");
  await addedRow.hover();
  await addedRow
    .getByRole("button", { name: "Maropitant 16mg T 상세" })
    .click();
  const detail = page.getByRole("dialog", {
    name: "Maropitant 16mg T 상세",
  });
  const addedDose = detail.getByLabel("Maropitant 16mg T 용량", {
    exact: true,
  });
  const addedDays = detail.getByLabel("Maropitant 16mg T 일수", {
    exact: true,
  });
  const addedFrequency = detail.getByLabel("Maropitant 16mg T 빈도", {
    exact: true,
  });
  const addedQuantity = addedRow.getByLabel(/수량 수정/);
  await expect(addedDose).toHaveValue("0.5");
  await expect(addedDays).toHaveValue("7");
  await expect(addedQuantity).toHaveValue("7");
  // The draft writer resolves the live catalog again; the mock authority for
  // this known catalog id owns the current 4,500원 unit price.
  await expect(addedRow).toContainText("4,500");
  await expect(addedRow).toContainText("31,500");
  await addedDose.fill("0.75");
  await addedFrequency.click();
  await page.getByRole("option", { name: "TID", exact: true }).click();
  await detail.getByRole("button", { name: "저장하고 닫기" }).click();

  await expect
    .poll(() =>
      draftPatchBodies.some((body) => {
        if (!Array.isArray(body.rows)) return false;
        return body.rows.some((value) => {
          if (!value || typeof value !== "object") return false;
          const row = value as Record<string, unknown>;
          const details = row.detailInputs as
            Record<string, unknown> | undefined;
          return (
            row.workspaceCatalogItemId === "ord-med-maropitant" &&
            details?.dose === 0.75 &&
            details.frequency === "tid" &&
            details.durationDays === 7 &&
            details.guardianNote === defaultDetailInputs.guardianNote
          );
        });
      }),
    )
    .toBe(true);
});

test("chart order add searches active workspace catalog and adds a draft row", async ({
  page,
}) => {
  const draftPatchBodies: Array<Record<string, unknown>> = [];
  const actionPatchBodies: Array<Record<string, unknown>> = [];
  let executionOrderId: string | null = null;
  let executionTaskStatus: "pending" | "complete" = "pending";
  await page.route("**/chart/order-execution?**", async (route) => {
    const taskId = executionOrderId ? `task-${executionOrderId}` : null;
    await route.fulfill({
      contentType: "application/json",
      status: 200,
      body: JSON.stringify({
        ok: true,
        status: 200,
        enforcedBy: "chart-order-execution-read-model",
        execution: {
          workspaceId: "clair-demo",
          encounterId: kongEncounterId,
          tasks: taskId
            ? [
                {
                  taskId,
                  orderId: executionOrderId,
                  parentTaskId: null,
                  taskRole: "execution",
                  clinicalOrderType: "clinical_lab",
                  destinationModule: "lab",
                  status: executionTaskStatus,
                  priority: "normal",
                  attemptNo: 1,
                  reRequestedFromTaskId: null,
                  effectiveSnapshot: { orderName: "[CBC 검사] #BASO" },
                  resultSnapshot:
                    executionTaskStatus === "complete"
                      ? { result: "정상" }
                      : null,
                  startedAt: "2026-08-26T01:00:00.000Z",
                  completedAt:
                    executionTaskStatus === "complete"
                      ? "2026-08-26T01:05:00.000Z"
                      : null,
                  cancelledAt: null,
                  createdAt: "2026-08-26T00:59:00.000Z",
                  updatedAt: "2026-08-26T01:05:00.000Z",
                },
              ]
            : [],
          events: taskId
            ? [
                {
                  eventId: `event-${executionOrderId}`,
                  taskId,
                  taskAttemptNo: 1,
                  orderId: executionOrderId,
                  eventType:
                    executionTaskStatus === "complete"
                      ? "completed"
                      : "created",
                  actorUserId: "user-vet",
                  reason: null,
                  beforeValues: {},
                  afterValues: { status: executionTaskStatus },
                  commandId: null,
                  createdAt: "2026-08-26T01:05:00.000Z",
                },
              ]
            : [],
          revisions: taskId
            ? [
                {
                  revisionId: `revision-${executionOrderId}`,
                  orderId: executionOrderId,
                  revisionNo: 1,
                  changeType: "legacy",
                  reason: null,
                  actorUserId: "user-vet",
                  beforeValues: {},
                  afterValues: {},
                  affectedTasks: [taskId],
                  billingImpact: {},
                  createdAt: "2026-08-26T00:59:00.000Z",
                  completedAt: "2026-08-26T00:59:00.000Z",
                },
              ]
            : [],
          queues: taskId
            ? [
                {
                  workItemId: `queue-${executionOrderId}`,
                  orderId: executionOrderId,
                  taskId,
                  taskAttemptNo: 1,
                  destinationModule: "lab",
                  queueType: "lab",
                  queueStatus:
                    executionTaskStatus === "complete"
                      ? "completed"
                      : "requested",
                  updatedAt: "2026-08-26T01:05:00.000Z",
                },
              ]
            : [],
          billingCandidates: [],
          reconciliation: {
            aggregateQueueCount: 0,
            confirmedAtomicCount: taskId ? 1 : 0,
            destinationlessQueueCount: 0,
            draftArtifactCount: 0,
            duplicateBillingCandidateCount: 0,
            duplicateQueueCount: 0,
            duplicateTaskCount: 0,
            executionTaskCount: taskId ? 1 : 0,
            missingTaskCount: 0,
            orphanBillingCandidateCount: 0,
            orphanQueueCount: 0,
            orphanTaskCount: 0,
          },
        },
      }),
    });
  });
  page.on("request", (request) => {
    if (request.method() !== "PATCH") return;
    try {
      const body = request.postDataJSON() as Record<string, unknown> | null;
      if (!body) return;
      if (request.url().includes("/chart/order-drafts")) {
        draftPatchBodies.push(body);
      }
      if (request.url().includes("/chart/order-actions")) {
        actionPatchBodies.push(body);
      }
    } catch {
      // Ignore non-JSON PATCH requests from unrelated chart surfaces.
    }
  });
  await page.goto(kongScenarioUrl);
  await restoreKongOrderDraftDefaults(page);

  await page.getByRole("button", { name: "+ Order", exact: true }).click();

  const dialog = page.getByRole("dialog", {
    name: "오더 추가",
  });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("오더 분류", { exact: true })).toBeVisible();
  await expect(dialog.getByText("선택한 오더", { exact: true })).toBeVisible();
  await expect(dialog.getByText("일시중지 예시")).toHaveCount(0);

  await searchChartOrderCatalog(dialog, "BASO");
  const candidate = page.getByTestId(
    "chart-order-catalog-candidate-std-ord-lab-cbc-baso",
  );
  await expect(candidate).toContainText("[CBC 검사] #BASO");
  if (await candidate.isEnabled()) {
    await candidate.click();
  }
  await confirmChartOrderCatalogSelection(dialog, 1);

  const addedRow = page
    .getByRole("row")
    .filter({
      hasText: "[CBC 검사] #BASO",
    })
    .first();
  await expect(addedRow).toContainText("[CBC 검사] #BASO");
  await expect(addedRow).toContainText("12,000");
  await expect(
    page.getByRole("tab", { name: /전체오더 \d+/, exact: true }),
  ).toBeVisible();

  await addedRow.hover();
  await addedRow
    .getByRole("button", { name: "[CBC 검사] #BASO 상세" })
    .click();
  const detail = page.getByRole("dialog", {
    name: "[CBC 검사] #BASO 상세",
  });
  await detail.getByLabel("[CBC 검사] #BASO 검체", { exact: true }).click();
  await page.getByRole("option", { name: "혈액", exact: true }).click();
  await detail
    .getByLabel("[CBC 검사] #BASO 패널/항목", { exact: true })
    .fill("CBC differential BASO");
  await detail
    .getByLabel("[CBC 검사] #BASO 채취 조건", { exact: true })
    .fill("EDTA 전혈, 채취 즉시 혼합");
  await detail.getByRole("button", { name: "저장하고 닫기" }).click();

  await addedRow
    .getByRole("checkbox", { name: "[CBC 검사] #BASO 선택" })
    .click();
  await getChartSelectedOrderConfirmAction(page).click();
  const confirmDialog = page.getByRole("dialog", { name: "Order 확정 확인" });
  await expect(confirmDialog).toBeVisible();
  const orderActionResponse = page.waitForResponse(
    (response) =>
      response
        .url()
        .includes("/api/workspaces/clair-demo/chart/order-actions") &&
      response.request().method() === "PATCH",
  );
  await confirmDialog.getByRole("button", { name: "Order 확정" }).click();
  const actionResponse = await orderActionResponse;
  expect(actionResponse.ok()).toBe(true);
  const actionBody = (await actionResponse.json()) as {
    orderActions?: Array<{ orderId?: string }>;
  };
  executionOrderId = actionBody.orderActions?.[0]?.orderId ?? null;
  expect(executionOrderId).toBeTruthy();
  expect(
    draftPatchBodies.some(
      (body) =>
        typeof body.expectedEtag === "string" &&
        Array.isArray(body.rows) &&
        body.rows.some((row) => {
          if (!row || typeof row !== "object") return false;
          const draftRow = row as Record<string, unknown>;
          return (
            draftRow.workspaceCatalogItemId === "ord-lab-cbc-baso" &&
            draftRow.quantity === 1 &&
            !Object.prototype.hasOwnProperty.call(
              draftRow,
              "unitPriceSnapshot",
            ) &&
            !Object.prototype.hasOwnProperty.call(draftRow, "serviceItemId")
          );
        }),
    ),
  ).toBe(true);
  expect(
    actionPatchBodies.some(
      (body) =>
        typeof body.expectedEtag === "string" &&
        typeof body.idempotencyKey === "string" &&
        Array.isArray(body.orderIds) &&
        body.orderIds.length > 0 &&
        !Object.prototype.hasOwnProperty.call(body, "catalogSelections") &&
        body.orderIds.some((orderId) => {
          if (typeof orderId !== "string") return false;
          return orderId.length > 0;
        }),
    ),
  ).toBe(true);
  await expect(page).toHaveURL(/\/w\/clair-demo\/treatment/);
  await expect(addedRow).toHaveAttribute(
    "data-order-confirmation",
    "confirmed",
  );

  await page.reload();
  const restoredRow = page
    .getByRole("row")
    .filter({
      hasText: "[CBC 검사] #BASO",
    })
    .first();
  await expect(restoredRow).toContainText("[CBC 검사] #BASO");
  await expect(restoredRow).toHaveAttribute(
    "data-order-confirmation",
    "confirmed",
  );
  await expect(
    page.getByLabel("[CBC 검사] #BASO 패널/항목", { exact: true }),
  ).toHaveCount(0);
  await restoredRow.hover();
  const confirmedActions = page.getByRole("group", {
    name: "[CBC 검사] #BASO 행 작업",
  });
  await expect(
    confirmedActions.getByRole("button", { name: "[CBC 검사] #BASO 이력" }),
  ).toBeVisible();
  await confirmedActions
    .getByRole("button", { name: "[CBC 검사] #BASO 정정" })
    .click();
  const amendmentDialog = page.getByRole("dialog", {
    name: "[CBC 검사] #BASO · 오더 정정",
  });
  await expect(amendmentDialog).toContainText(
    "확정 snapshot과 완료 결과는 유지",
  );
  await amendmentDialog.getByRole("button", { name: "취소" }).click();
  await restoredRow.hover();
  await confirmedActions
    .getByRole("button", { name: "[CBC 검사] #BASO 더보기" })
    .click();
  await expect(
    page.getByRole("menuitem", { name: "수정·재확정" }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");

  executionTaskStatus = "complete";
  await page.reload();
  await expect(restoredRow).toContainText("완료");
  await restoredRow.hover();
  await confirmedActions
    .getByRole("button", { name: "[CBC 검사] #BASO 이력" })
    .click();
  const historySheet = page.getByRole("dialog", {
    name: "[CBC 검사] #BASO 이력",
  });
  await expect(historySheet).toContainText("실행 Task · attempt 1");
  await expect(historySheet).toContainText("Queue 1건 · 수납 후보 0건");
  await expect(historySheet).toContainText("실행 완료");
  await historySheet.getByRole("button", { name: "Close" }).click();

  await restoredRow.hover();
  await confirmedActions
    .getByRole("button", { name: "[CBC 검사] #BASO 더보기" })
    .click();
  await page.getByRole("menuitem", { name: "수정·재확정" }).click();
  const reRequestDialog = page.getByRole("dialog", {
    name: "[CBC 검사] #BASO · 오더 수정·재확정",
  });
  await expect(reRequestDialog).toContainText("새 attempt 긴급");
  await reRequestDialog.getByRole("button", { name: "취소" }).click();

  await page.getByRole("checkbox", { name: "[CBC 검사] #BASO 선택" }).check();
  const cohortActions = page.getByRole("toolbar", { name: "선택 행 작업" });
  await expect(cohortActions).toContainText("확정 후 이력");
  await page.getByRole("checkbox", { name: "Maropitant 16mg T 선택" }).check();
  await expect(
    page.getByRole("checkbox", { name: "[CBC 검사] #BASO 선택" }),
  ).not.toBeChecked();
  await expect(cohortActions).toContainText("확정 전 후보");
});

test("chart order set requires explicit leaf intent and preserves set rows on reload save", async ({
  page,
}) => {
  const draftPatchBodies: Array<Record<string, unknown>> = [];
  page.on("request", (request) => {
    if (
      request.method() !== "PATCH" ||
      !request.url().includes("/chart/order-drafts")
    ) {
      return;
    }
    try {
      const body = request.postDataJSON() as Record<string, unknown> | null;
      if (body) draftPatchBodies.push(body);
    } catch {
      // Ignore unrelated non-JSON requests.
    }
  });
  await page.goto(kongScenarioUrl);
  await restoreKongOrderDraftDefaults(page);

  await page.getByRole("button", { name: "+ Order", exact: true }).click();
  const catalogDialog = page.getByRole("dialog", {
    name: "오더 추가",
  });
  await searchChartOrderCatalog(catalogDialog, "구토 기본 세트");
  const setCandidate = page.getByTestId(
    "chart-order-catalog-candidate-set-vomit-basic",
  );
  await expect(setCandidate).toContainText("구토 기본 세트");
  await setCandidate.click();
  await confirmChartOrderCatalogSelection(catalogDialog, 1);

  const setDialog = page.getByRole("dialog", {
    name: "구토 기본 세트 구성 선택",
  });
  await expect(setDialog).toBeVisible();
  const fixedLeaf = setDialog.getByLabel(/BASO.*구성 선택/);
  await expect(fixedLeaf).toBeChecked();
  await fixedLeaf.uncheck();
  const editableLeaf = setDialog.getByLabel(/Maropitant.*구성 수량/);
  await editableLeaf.fill("5");
  const setDraftSaveResponse = page.waitForResponse((response) => {
    if (
      response.request().method() !== "PATCH" ||
      !response.url().includes("/chart/order-drafts")
    ) {
      return false;
    }
    try {
      const body = response.request().postDataJSON() as Record<
        string,
        unknown
      >;
      return (
        Array.isArray(body.rows) &&
        body.rows.some(
          (row) =>
            Boolean(row) &&
            typeof row === "object" &&
            (row as Record<string, unknown>).rowType === "set",
        )
      );
    } catch {
      return false;
    }
  });
  await setDialog.getByRole("button", { name: "구성 적용" }).click();
  const setDraftResponse = await setDraftSaveResponse;
  expect(setDraftResponse.status(), await setDraftResponse.text()).toBe(200);

  const setParentRow = page
    .getByRole("row")
    .filter({ hasText: "구토 기본 세트" })
    .first();
  await expect(setParentRow).toContainText("Order 세트");
  await expect(
    setParentRow.getByLabel("구토 기본 세트 청구서명 수정"),
  ).toHaveCount(0);
  await expect(setParentRow.getByLabel("구토 기본 세트 수량 수정")).toHaveCount(
    0,
  );
  await setParentRow
    .getByRole("checkbox", { name: "구토 기본 세트 선택" })
    .click();

  await expect
    .poll(() =>
      draftPatchBodies.some(
        (body) =>
          Array.isArray(body.rows) &&
          body.rows.some(
            (row) =>
              Boolean(row) &&
              typeof row === "object" &&
              (row as Record<string, unknown>).rowType === "set",
          ),
      ),
    )
    .toBe(true);
  const firstDraftBody =
    draftPatchBodies.findLast(
      (body) =>
        Array.isArray(body.rows) &&
        body.rows.some(
          (row) =>
            Boolean(row) &&
            typeof row === "object" &&
            (row as Record<string, unknown>).rowType === "set",
        ),
    ) ?? {};
  const firstSetRow = (
    firstDraftBody.rows as Array<Record<string, unknown>>
  ).find((row) => row.rowType === "set");
  expect(firstSetRow).toMatchObject({
    rowType: "set",
    sourceSetId: "set-vomit-basic",
    selectionIntent: {
      items: expect.arrayContaining([
        expect.objectContaining({
          revisionItemId: "setitem-vomit-baso",
          selected: false,
          quantity: 1,
        }),
        expect.objectContaining({
          revisionItemId: "setitem-vomit-maropitant",
          selected: true,
          quantity: 5,
        }),
      ]),
    },
  });

  await expect(page.getByTestId("chart-order-footer")).toContainText(
    "저장됨",
    { timeout: 10_000 },
  );

  await page.reload();
  const reloadedParent = page
    .getByRole("row")
    .filter({ hasText: "구토 기본 세트" })
    .first();
  await expect(reloadedParent).toContainText("Order 세트");
  const reloadedSetToggle = page.getByRole("button", {
    name: /Maropitant.*세트 제외/,
  });
  const reloadedLeafId = await reloadedSetToggle
    .locator("xpath=ancestor::tr")
    .getAttribute("data-testid");
  expect(reloadedLeafId).toBeTruthy();
  const reloadedLeaf = page.getByTestId(reloadedLeafId!);
  await expect(
    reloadedLeaf.getByRole("checkbox", { name: /Maropitant.*선택/ }),
  ).toBeDisabled();
  await reloadedLeaf
    .getByRole("button", { name: /Maropitant.*세트 제외/ })
    .click();
  await expect(
    reloadedLeaf.getByRole("button", { name: /Maropitant.*세트 포함/ }),
  ).toBeVisible();
  await reloadedLeaf
    .getByRole("button", { name: /Maropitant.*세트 포함/ })
    .click();
  await expect(reloadedLeaf.getByLabel(/Maropitant.*수량 수정/)).toHaveValue(
    "5",
  );
  await reloadedLeaf.getByLabel(/Maropitant.*수량 수정/).fill("6");
  const updateAction = await getChartOrderAction(page, /Order 업데이트/);
  if (await updateAction.isEnabled()) {
    await updateAction.click();
  } else {
    await dismissChartOrderActionMenu(page);
  }
  await expect
    .poll(() =>
      draftPatchBodies.some(
        (body) =>
          Array.isArray(body.rows) &&
          body.rows.some((row) => {
            if (!row || typeof row !== "object") return false;
            const record = row as Record<string, unknown>;
            const selectionIntent = record.selectionIntent as
              { items?: Array<Record<string, unknown>> } | undefined;
            return selectionIntent?.items?.some(
              (item) =>
                item.revisionItemId === "setitem-vomit-maropitant" &&
                item.quantity === 6,
            );
          }),
      ),
    )
    .toBe(true);
  const retryDraftBody =
    draftPatchBodies.findLast(
      (body) =>
        Array.isArray(body.rows) &&
        body.rows.some((row) => {
          if (!row || typeof row !== "object") return false;
          const record = row as Record<string, unknown>;
          const selectionIntent = record.selectionIntent as
            { items?: Array<Record<string, unknown>> } | undefined;
          return selectionIntent?.items?.some(
            (item) =>
              item.revisionItemId === "setitem-vomit-maropitant" &&
              item.quantity === 6,
          );
        }),
    ) ?? {};
  const retrySetRow = (
    retryDraftBody.rows as Array<Record<string, unknown>>
  ).find((row) => row.rowType === "set");
  expect(retrySetRow?.rowType).toBe("set");
  expect(retrySetRow?.orderId).toBe(firstSetRow?.orderId);
});

test("chart confirmation retries the same atomic command without rewriting the draft", async ({
  page,
}) => {
  await verifyChartConfirmationRetry(page);
});

test("chart confirmation continues after an ambiguous draft response only when readback matches", async ({
  page,
}) => {
  const orderId = "order-ambiguous-draft-readback";
  const displayName = "Ambiguous draft readback medicine";
  const firstEtag = `"${"7".repeat(64)}"`;
  const savedEtag = `"${"8".repeat(64)}"`;
  const detailInputs = {
    doseBasis: "patient",
    dose: 16,
    doseUnit: "mg",
    route: "PO",
    frequency: "once",
    durationDays: 1,
    totalQuantity: 1,
  };
  let currentEtag = firstEtag;
  let currentRow = {
    orderId,
    workspaceId: "clair-demo",
    encounterId: kongEncounterId,
    rowType: "individual",
    orderType: "dispensing",
    clinicalOrderType: "dispensing",
    destinationModule: "dispensing",
    executionMode: "routed",
    detailInputs,
    detailSchemaVersion: 1,
    priority: "normal",
    billingEligible: true,
    revisionNo: 0,
    parentOrderId: null,
    sourceSetId: null,
    sourceSetRevisionId: null,
    sourceSetRevisionNo: null,
    sourceSetVersion: null,
    sourceSetRevisionItemId: null,
    workspaceCatalogItemId: "svc-med-maropitant",
    workspaceCatalogRevision: null,
    dispensingLineage: null,
    quantity: 1,
    quantitySource: "manual",
    unitPriceSnapshot: 4500,
    lineTotalSnapshot: 4500,
    snapshotSchemaVersion: 0,
    snapshotHash: null,
    appliedSnapshot: {
      amountBasis: "per_order",
      billingName: displayName,
      billingReflectionEnabled: true,
      categoryGroup: "medication",
      clinicalOrderType: "dispensing",
      destinationModule: "dispensing",
      detailInputs,
      detailSchemaVersion: 1,
      executionMode: "routed",
      inHospitalOrderName: displayName,
      lineTotalSnapshot: 4500,
      orderType: "dispensing",
      priceKrw: 4500,
      quantity: 1,
      rowType: "individual",
      sourcePresetId: "svc-med-maropitant",
      standardOrderName: displayName,
      targetSpecies: ["dog"],
      taskRequired: true,
      taxIncluded: true,
      workspaceCatalogItemId: "svc-med-maropitant",
      planOrderAuthority: {
        schemaVersion: 1,
        calculationMode: "fixed_product",
        dispenseUnit: "tablet",
        fixedProductQuantity: 1,
        fixedProductQuantityBasis: "head",
        preparationPolicy: {
          increment: 1,
          roundingMode: "nearest",
          displayPrecision: 0,
        },
        priceBasis: "per_product_unit",
        billingUnit: "tablet",
        taxClass: "taxable",
      },
    },
    appliedPriceSnapshot: {},
    calculationInputs: {},
    calculationOutputs: {
      dispenseApplicability: true,
      calculationStatus: "ready",
      theoreticalDispenseQuantity: 1,
      calculatedDispenseQuantity: 1,
      actualDispenseQuantity: 1,
      actualDispenseUnit: "tablet",
      actualDispenseSource: "system",
      requiresReconfirmation: false,
    },
    billingReflectionEnabled: true,
    orderConfirmationStatus: "draft",
    status: "requested",
    updatedAt: "2026-08-26T12:00:00.000Z",
  };
  let draftPatchCount = 0;
  let draftReadbackCount = 0;
  let confirmationPersisted = false;
  const actionBodies: Array<Record<string, unknown>> = [];
  await page.route(
    "**/api/workspaces/clair-demo/chart/order-drafts*",
    async (route) => {
      if (route.request().method() === "GET") {
        draftReadbackCount += 1;
        await route.fulfill({
          contentType: "application/json",
          status: 200,
          headers: { ETag: currentEtag },
          json: {
            ok: true,
            status: 200,
            etag: currentEtag,
            rows: [currentRow],
          },
        });
        return;
      }
      if (route.request().method() !== "PATCH") {
        await route.continue();
        return;
      }

      draftPatchCount += 1;
      const body = route.request().postDataJSON() as {
        rows: Array<Record<string, unknown>>;
      };
      const savedRow = body.rows.find((row) => row.orderId === orderId);
      expect(savedRow).toBeTruthy();
      currentEtag = savedEtag;
      currentRow = {
        ...currentRow,
        detailInputs:
          (savedRow?.detailInputs as typeof detailInputs | undefined) ??
          currentRow.detailInputs,
        detailSchemaVersion:
          (savedRow?.detailSchemaVersion as number | undefined) ??
          currentRow.detailSchemaVersion,
        priority:
          (savedRow?.priority as string | undefined) ?? currentRow.priority,
        quantity:
          (savedRow?.quantity as number | undefined) ?? currentRow.quantity,
        updatedAt: "2026-08-26T12:01:00.000Z",
      };
      await route.fulfill({
        contentType: "application/json",
        status: 200,
        body: "",
      });
    },
  );
  await page.route(
    "**/api/workspaces/clair-demo/chart/order-actions*",
    async (route) => {
      if (route.request().method() === "GET") {
        const confirmedRow = {
          ...currentRow,
          orderConfirmationStatus: "confirmed",
          status: "confirmed",
          updatedAt: "2026-08-26T12:02:00.000Z",
        };
        await route.fulfill({
          contentType: "application/json",
          status: 200,
          json: {
            ok: true,
            status: 200,
            etag: currentEtag,
            rows: confirmationPersisted ? [confirmedRow] : [],
            orderActions: [],
          },
        });
        return;
      }
      if (route.request().method() !== "PATCH") {
        await route.continue();
        return;
      }
      actionBodies.push(
        (route.request().postDataJSON() ?? {}) as Record<string, unknown>,
      );
      confirmationPersisted = true;
      await route.fulfill({
        contentType: "application/json",
        status: 500,
        json: { ok: false, status: 500, error: "db_write_failed" },
      });
    },
  );
  const fulfillmentWorkItemId = "work-ambiguous-draft-readback";
  await page.route(
    "**/api/workspaces/clair-demo/fulfillment/work-items?*",
    async (route) => {
      const queueType = new URL(route.request().url()).searchParams.get(
        "queueType",
      );
      await route.fulfill({
        contentType: "application/json",
        status: 200,
        json: {
          ok: true,
          status: 200,
          enforcedBy: "fulfillment-work-item-persistence",
          workItems:
            queueType === "dispensing"
              ? [
                  {
                    assignedToUserId: null,
                    createdAt: "2026-08-26T12:02:00.000Z",
                    encounterId: kongEncounterId,
                    id: fulfillmentWorkItemId,
                    orderId,
                    queueType: "dispensing",
                    requestedByUserId: "user-vet",
                    sourceSnapshot: {
                      instruction: "1회 16mg, 1회",
                      orderDisplayName: displayName,
                      patientName: "콩",
                      requestingVetName: "송민재",
                    },
                    status: "requested",
                    updatedAt: "2026-08-26T12:02:00.000Z",
                    workspaceId: "clair-demo",
                  },
                ]
              : [],
        },
      });
    },
  );

  await page.goto(kongScenarioUrl);
  await page
    .getByLabel(`${displayName} 청구서명 수정`)
    .fill(`${displayName} updated`);
  await page.getByRole("checkbox", { name: `${displayName} 선택` }).check();
  await getChartSelectedOrderConfirmAction(page).click();
  const confirmDialog = page.getByRole("dialog", { name: "Order 확정 확인" });
  await confirmDialog.getByRole("button", { name: "Order 확정" }).click();

  await expect.poll(() => draftPatchCount).toBe(1);
  await expect.poll(() => draftReadbackCount).toBeGreaterThanOrEqual(1);
  await expect.poll(() => actionBodies.length).toBe(1);
  expect(actionBodies[0]).toMatchObject({
    action: "confirm",
    encounterId: kongEncounterId,
  });
  expect(actionBodies[0]?.orderIds).toHaveLength(1);
  await expect(confirmDialog).not.toBeVisible();
  await expect(page).toHaveURL(/\/w\/clair-demo\/treatment/);
  expect(new URL(page.url()).searchParams.get("encounterId")).toBe(kongEncounterId);
  const confirmedOrder = page.getByTestId(`chart-order-row-${orderId}`);
  await expect(confirmedOrder).toHaveAttribute("data-order-confirmation", "confirmed");
  await expect(confirmedOrder.getByRole("checkbox")).not.toBeChecked();

  // Downstream work stays available when the user explicitly opens dispensing.
  await page.goto(`/w/clair-demo/dispensing?encounterId=${kongEncounterId}`);
  await expect(page).toHaveURL(/\/w\/clair-demo\/dispensing/);
  expect(new URL(page.url()).searchParams.get("encounterId")).toBe(
    kongEncounterId,
  );
  await expect(
    page.getByTestId(
      `order-queue-item-live-fulfillment-${fulfillmentWorkItemId}`,
    ),
  ).toContainText(displayName);
});


async function routeQuickAddCatalog(page: Page) {
  const result = await createMockOrderCatalogGateway().listChartSearch({ workspaceId: "clair-demo" });
  if (!result.ok) throw new Error("Synthetic chart catalog failed");
  // Synthetic persisted defaults exercise valid autosave without inventing app defaults.
  const baso = result.rows.find((row) => row.workspaceCatalogItemId === "ord-lab-cbc-baso");
  if (baso) baso.appliedSnapshot.defaultDetailInputs = { specimenType: "blood", testPanel: "CBC", collectionCondition: "EDTA 전혈" };
  await page.route("**/api/workspaces/clair-demo/hospital-admin/order-catalog?mode=chart-search", (route) =>
    route.fulfill({ json: { ok: true, status: 200, rows: result.rows } }),
  );
  await page.route("**/hospital-admin/order-sets/*/expand?*", async (route) => {
    const params = new URL(route.request().url()).searchParams;
    const preview = await createMockOrderCatalogGateway().previewOrderSet!({
      workspaceId: "clair-demo", encounterId: params.get("encounterId")!,
      orderSetId: "set-vomit-basic", revisionId: params.get("revisionId")!,
      selectionIntent: JSON.parse(params.get("selectionIntent")!),
    });
    await route.fulfill({ status: preview.ok ? 200 : preview.status, json: preview });
  });
  return result.rows;
}

test("chart quick-add continuously appends without resending unchanged orders", async ({ page }) => {
  const catalog = await routeQuickAddCatalog(page);
  await page.goto(kongScenarioUrl);
  await restoreKongOrderDraftDefaults(page);
  const quantity = page.getByLabel("Maropitant 16mg T 수량 수정");
  await quantity.fill("2");
  await quantity.press("Tab");
  await expect(page.getByTestId("chart-order-save-status")).toContainText("저장됨");
  const sentRows: Array<Array<Record<string, unknown>>> = [];
  await page.route("**/api/workspaces/clair-demo/chart/order-drafts*", async (route) => {
    if (route.request().method() === "PATCH") sentRows.push(route.request().postDataJSON().rows);
    await route.fallback();
  });
  const existingIds = new Set(kongDefaultOrderDraftRows.map((row) => row.workspaceCatalogItemId));
  const candidates = catalog.filter((row) => row.rowType === "individual" && row.targetSpecies.includes("dog") &&
    !existingIds.has(row.workspaceCatalogItemId ?? row.sourcePresetId)).slice(0, 2);
  expect(candidates).toHaveLength(2);
  const composer = page.getByTestId("chart-order-quick-add");
  await composer.getByRole("button", { name: "Order 추가", exact: true }).click();
  const input = page.getByRole("combobox", { name: "오더 빠른 검색", exact: true });
  await expect(input).toBeFocused();
  await expect(page.getByText("오더명 또는 청구명을 입력해 주세요.")).toBeVisible();
  for (const candidate of candidates) {
    await input.fill(candidate.displayName);
    await expect(page.getByRole("listbox", { name: "오더 빠른 검색 결과" }).getByRole("option").first()).toContainText(candidate.displayName);
    await input.press("Enter");
    await expect(input).toHaveValue("");
    await expect(input).toBeFocused();
    await expect(page.getByLabel(`${candidate.displayName} 수량 수정`, { exact: true }).last()).toBeVisible();
    await expect.poll(() => page.locator('[data-slot="chart-order-table-surface"] [data-emr-pinned-table-scroll-owner="true"]')
      .evaluate(element => element.scrollHeight - element.clientHeight - element.scrollTop)).toBeLessThan(2);
  }
  const basoQuantity = page.getByLabel("[CBC 검사] #BASO 수량 수정", { exact: true });
  await expect(basoQuantity).toHaveValue("");
  await expect(page.getByTestId("chart-order-save-status")).toContainText("입력 확인 필요");
  await basoQuantity.fill("1");
  await basoQuantity.press("Tab");
  await expect(page.getByTestId("chart-order-save-status")).toContainText("저장됨");
  expect(sentRows.length).toBeGreaterThan(0);
  for (const rows of sentRows) {
    expect(rows.every((row) => !existingIds.has(String(row.workspaceCatalogItemId)))).toBe(true);
  }
  await expect(quantity.first()).toHaveValue("2");
  for (const row of kongDefaultOrderDraftRows) await expect(page.getByTestId(`chart-order-row-${row.orderId}`)).toBeVisible();
  await page.screenshot({ path: "test-results/quick-add-continuous.png" });
  await restoreKongOrderDraftDefaults(page);
});

async function openQuickAddForTest(page: Page, query = "") {
  await page.getByTestId("chart-order-quick-add").getByRole("button", { name: "Order 추가", exact: true }).click();
  const input = page.getByRole("combobox", { name: "오더 빠른 검색", exact: true });
  await expect(input).toBeFocused();
  if (query) await input.fill(query);
  return input;
}

test("chart quick-add preserves query and focus through detailed search and set cancellation", async ({ page }) => {
  await routeQuickAddCatalog(page);
  await page.goto(kongScenarioUrl);
  await restoreKongOrderDraftDefaults(page);
  const input = await openQuickAddForTest(page, "BASO");
  await expect(page.getByRole("option").filter({ hasText: "#BASO" })).toBeVisible();
  await page.getByRole("button", { name: "상세 검색", exact: true }).click();
  const catalog = page.getByRole("dialog", { name: "오더 추가", exact: true });
  await expect(catalog).toBeVisible();
  await expect(catalog.getByRole("combobox", { name: "전체 오더 검색", exact: true })).toHaveValue("BASO");
  await page.keyboard.press("Escape");
  await expect(catalog).toBeHidden();
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("BASO");
  await input.fill("구토 기본 세트");
  await expect(page.getByRole("option").filter({ hasText: "구토 기본 세트" })).toBeVisible();
  await input.press("Enter");
  const setDialog = page.getByRole("dialog", { name: "구토 기본 세트 구성 선택", exact: true });
  await expect(setDialog).toBeVisible();
  await setDialog.getByRole("button", { name: "취소", exact: true }).click();
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("구토 기본 세트");
  await expect(page.getByTestId("chart-order-row-order-kong-maropitant")).toBeVisible();
  await input.press("Escape");
  await expect(page.getByTestId("chart-order-quick-add").getByRole("button", { name: "Order 추가", exact: true })).toBeFocused();
});

test("chart quick-add hides only for total-empty and restores after existing first-add flow", async ({ page }) => {
  await routeQuickAddCatalog(page);
  await page.goto(kongScenarioUrl);
  await saveKongOrderDraftRows(page, [], {
    chartId: "soap-kong-260501",
    removeOmittedTopLevelRows: true,
  });
  await page.reload();
  const composer = page.getByTestId("chart-order-quick-add");
  await expect(composer).toHaveCount(0);
  await page.getByTestId("chart-order-empty-body").getByRole("button", { name: "+ Order", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "오더 추가", exact: true });
  await searchChartOrderCatalog(dialog, "BASO");
  await page.getByTestId("chart-order-catalog-candidate-std-ord-lab-cbc-baso").click();
  await confirmChartOrderCatalogSelection(dialog, 1);
  await expect(composer).toBeVisible();
  await page.getByRole("tab", { name: "영상 0", exact: true }).click();
  await expect(page.getByTestId("chart-order-empty-body")).toBeVisible();
  await expect(composer).toBeVisible();
  await page.getByRole("tab", { name: /전체오더 1/, exact: true }).click();
  await page.getByRole("button", { name: "[CBC 검사] #BASO 후보 삭제", exact: true }).click({ force: true });
  await page.getByRole("dialog").getByRole("button", { name: "삭제", exact: true }).click();
  await expect(composer).toHaveCount(0);
  await expect(page.getByTestId("chart-order-empty-body").getByRole("button", { name: "+ Order", exact: true })).toBeVisible();
  await restoreKongOrderDraftDefaults(page);
});

test("chart quick-add blocks IME and duplicates while awaiting save acknowledgment", async ({ page }) => {
  await routeQuickAddCatalog(page);
  await page.goto(kongScenarioUrl);
  await restoreKongOrderDraftDefaults(page);
  let releaseSave!: () => void;
  const gate = new Promise<void>((resolve) => { releaseSave = resolve; });
  let gated = false;
  const addedIds: string[] = [];
  await page.route("**/api/workspaces/clair-demo/chart/order-drafts*", async (route) => {
    if (route.request().method() !== "PATCH") return route.fallback();
    const rows = route.request().postDataJSON().rows as Array<{ orderId: string; workspaceCatalogItemId: string }>;
    const added = rows.filter((row) => row.workspaceCatalogItemId === "ord-med-maropitant");
    if (!added.length || gated) return route.fallback();
    addedIds.push(...added.map((row) => row.orderId));
    gated = true;
    const response = await route.fetch();
    await gate;
    await route.fulfill({ response });
  });
  try {
    const input = await openQuickAddForTest(page, "Maropitant");
    const option = page.getByRole("option").filter({ hasText: "Maropitant" });
    await expect(option).toBeVisible();
    await input.dispatchEvent("keydown", { key: "Enter", code: "Enter", isComposing: true });
    await expect(input).toHaveValue("Maropitant");
    await expect(page.getByLabel("Maropitant 16mg T 수량 수정", { exact: true })).toHaveCount(1);
    await input.press("Enter");
    await expect.poll(() => gated).toBe(true);
    await expect(page.getByTestId("chart-order-save-status")).toContainText("저장 중");
    await input.fill("Maropitant");
    await expect(option).toBeDisabled();
    await expect(option).toContainText("이미 추가됨");
    await input.press("Enter");
    await expect(page.getByLabel("Maropitant 16mg T 수량 수정", { exact: true })).toHaveCount(2);
    expect(addedIds).toHaveLength(1);
    releaseSave();
    await expect(page.getByTestId("chart-order-save-status")).toContainText("저장됨");
  } finally {
    releaseSave();
  }
  await restoreKongOrderDraftDefaults(page);
});

test("chart quick-add distinguishes lookup errors and measures the pinned column span", async ({ page }) => {
  await routeQuickAddCatalog(page);
  let fail = true;
  await page.route("**/api/workspaces/clair-demo/hospital-admin/order-catalog?mode=chart-search", (route) =>
    fail ? route.fulfill({ status: 503, json: { ok: false, error: "unavailable" } }) : route.fallback(),
  );
  await page.goto(kongScenarioUrl);
  await restoreKongOrderDraftDefaults(page);
  const input = await openQuickAddForTest(page);
  await expect(page.getByText("오더를 불러오지 못했습니다.", { exact: true })).toBeVisible();
  await expect(page.getByText("검색 결과가 없습니다", { exact: true })).toHaveCount(0);
  fail = false;
  await page.getByRole("button", { name: "다시 시도", exact: true }).click();
  await expect(page.getByText("오더명 또는 청구명을 입력해 주세요.")).toBeVisible();
  await input.fill("존재하지않는항목");
  await expect(page.getByText("검색 결과가 없습니다", { exact: true })).toBeVisible();
  await input.fill("BASO");
  await expect(page.getByRole("option").filter({ hasText: "#BASO" })).toBeVisible();
  for (const width of [1440, 1100]) {
    await page.setViewportSize({ width, height: 1000 });
    const surface = page.locator('[data-slot="chart-order-table-surface"]');
    const category = surface.locator('thead [data-column-id="orderType"]');
    const name = surface.locator('thead [data-column-id="displayName"]');
    await expect.poll(async () => {
      const [anchor, left, right] = await Promise.all([input.boundingBox(), category.boundingBox(), name.boundingBox()]);
      return Math.abs(anchor!.x - left!.x - 12) + Math.abs(anchor!.width - (right!.x + right!.width - left!.x - 24));
    }).toBeLessThan(2);
    const popover = page.getByRole("dialog", { name: "오더 빠른 추가", exact: true });
    await expect(popover).toBeVisible();
    const box = (await popover.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(1000);
  }
  await page.screenshot({ path: "test-results/quick-add-search.png" });
});

test("chart quick-add applies the existing set preview and returns to continuous entry", async ({ page }) => {
  await routeQuickAddCatalog(page);
  await page.goto(kongScenarioUrl);
  await restoreKongOrderDraftDefaults(page);
  const input = await openQuickAddForTest(page, "구토 기본 세트");
  await expect(page.getByRole("option").filter({ hasText: "구토 기본 세트" })).toBeVisible();
  await input.press("Enter");
  const dialog = page.getByRole("dialog", { name: "구토 기본 세트 구성 선택", exact: true });
  await expect(dialog.getByRole("button", { name: "구성 적용", exact: true })).toBeEnabled();
  await dialog.getByRole("button", { name: "구성 적용", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("");
  await expect(page.getByTestId("chart-order-save-status")).toContainText("저장됨");
  await expect(page.locator('tr[data-testid^="chart-order-row-"]').filter({ has: page.getByText("구토 기본 세트", { exact: true }) })).toHaveCount(1);
  await restoreKongOrderDraftDefaults(page);
});

test("chart quick-add retains failed additions and prevents re-append on retry", async ({ page }) => {
  await routeQuickAddCatalog(page);
  await page.goto(kongScenarioUrl);
  await restoreKongOrderDraftDefaults(page);
  let fail = true;
  const addedIds: string[] = [];
  await page.route("**/api/workspaces/clair-demo/chart/order-drafts*", async (route) => {
    if (route.request().method() !== "PATCH") return route.fallback();
    const rows = route.request().postDataJSON().rows as Array<{ orderId: string; workspaceCatalogItemId: string }>;
    const added = rows.find((row) => row.workspaceCatalogItemId === "ord-med-maropitant");
    if (!added) return route.fallback();
    addedIds.push(added.orderId);
    if (fail) return route.fulfill({ status: 503, json: { ok: false, error: "save_failed" } });
    await route.fallback();
  });
  const input = await openQuickAddForTest(page, "Maropitant");
  await expect(page.getByRole("option").filter({ hasText: "Maropitant" })).toBeVisible();
  await input.press("Enter");
  await expect(page.getByTestId("chart-order-save-status")).toContainText("저장 실패");
  await input.fill("Maropitant");
  await expect(page.getByRole("option").filter({ hasText: "Maropitant" })).toBeDisabled();
  await input.press("Enter");
  await expect(page.getByLabel("Maropitant 16mg T 수량 수정", { exact: true })).toHaveCount(2);
  await input.press("Escape");
  fail = false;
  await page.getByRole("button", { name: "다시 저장", exact: true }).click();
  await expect(page.getByTestId("chart-order-save-status")).toContainText("저장됨");
  expect(addedIds.length).toBeGreaterThan(1);
  expect(new Set(addedIds).size).toBe(1);
  await restoreKongOrderDraftDefaults(page);
});

test("chart quick-add ignores cancelled set preview and apply responses", async ({ page }) => {
  await routeQuickAddCatalog(page);
  await page.goto(kongScenarioUrl);
  await restoreKongOrderDraftDefaults(page);
  for (const phase of ["preview", "apply"]) {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let calls = 0;
    let gated = false;
    let delivered = false;
    const pattern = "**/hospital-admin/order-sets/*/expand?*";
    const handler = async (route: Route) => {
      calls += 1;
      if (calls !== (phase === "preview" ? 1 : 2)) return route.fallback();
      const params = new URL(route.request().url()).searchParams;
      const preview = await createMockOrderCatalogGateway().previewOrderSet!({
        workspaceId: "clair-demo", encounterId: params.get("encounterId")!,
        orderSetId: "set-vomit-basic", revisionId: params.get("revisionId")!,
        selectionIntent: JSON.parse(params.get("selectionIntent")!),
      });
      gated = true;
      await gate;
      await route.fulfill({ status: preview.ok ? 200 : preview.status, json: preview });
      delivered = true;
    };
    await page.route(pattern, handler);
    const input = await openQuickAddForTest(page, "구토 기본 세트");
    await expect(page.getByRole("option").filter({ hasText: "구토 기본 세트" })).toBeVisible();
    await input.press("Enter");
    const dialog = page.getByRole("dialog", { name: "구토 기본 세트 구성 선택", exact: true });
    if (phase === "apply") await dialog.getByRole("button", { name: "구성 적용", exact: true }).click();
    await expect.poll(() => gated).toBe(true);
    await dialog.getByRole("button", { name: "취소", exact: true }).click();
    release();
    await expect.poll(() => delivered).toBe(true);
    await expect(input).toBeFocused();
    await expect(input).toHaveValue("구토 기본 세트");
    await expect(page.locator('tr[data-testid^="chart-order-row-"]').filter({ has: page.getByText("구토 기본 세트", { exact: true }) })).toHaveCount(0);
    await expect(page.locator('tr[data-testid^="chart-order-row-"]')).toHaveCount(4);
    await input.press("Escape");
    await page.unroute(pattern, handler);
  }
});

test("chart quick-add scrolls only long results and keeps its anchor during horizontal table scroll", async ({ page }) => {
  const catalog = await routeQuickAddCatalog(page);
  const template = catalog.find((row) => row.workspaceCatalogItemId === "ord-lab-cbc-baso")!;
  const rows = Array.from({ length: 18 }, (_, index) => ({
    ...template, workspaceCatalogItemId: `quick-search-fixture-${index}`,
    displayName: `Quick ${String(index + 1).padStart(2, "0")}`, billingName: "Quick fixture",
  }));
  await page.route("**/hospital-admin/order-catalog?mode=chart-search", (route) => route.fulfill({ json: { ok: true, rows } }));
  await page.goto(kongScenarioUrl);
  await restoreKongOrderDraftDefaults(page);
  const input = await openQuickAddForTest(page, "Quick");
  const list = page.getByRole("listbox", { name: "오더 빠른 검색 결과" });
  await expect(list.getByRole("option")).toHaveCount(18);
  const initialWindowScroll = await page.evaluate(() => window.scrollY);
  await input.press("ArrowUp");
  await expect(input).toHaveAttribute("aria-activedescendant", await list.getByRole("option").last().getAttribute("id") as string);
  await expect.poll(() => list.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await expect.poll(async () => {
    const [listBox, lastBox] = await Promise.all([list.boundingBox(), list.getByRole("option").last().boundingBox()]);
    return Math.max(listBox!.y - lastBox!.y, lastBox!.y + lastBox!.height - listBox!.y - listBox!.height);
  }).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => window.scrollY)).toBe(initialWindowScroll);
  await input.press("ArrowDown");
  await expect(input).toHaveAttribute("aria-activedescendant", await list.getByRole("option").first().getAttribute("id") as string);
  const before = (await input.boundingBox())!;
  const scrollOwner = page.locator('[data-slot="chart-order-table-surface"] [data-emr-pinned-table-scroll-owner="true"]');
  await scrollOwner.evaluate((element) => { element.scrollLeft = element.scrollWidth; });
  await expect.poll(async () => Math.abs((await input.boundingBox())!.x - before.x)).toBeLessThan(1);
  await expect(input).toBeFocused();
});

test("chart quick-add uses no sparse dock and restores dense scroll after cancellation", async ({ page }) => {
  await routeQuickAddCatalog(page);
  await page.goto(kongScenarioUrl);
  await restoreKongOrderDraftDefaults(page);
  let dense = false;
  // Synthetic read responses exercise both layouts without persisting fixture rows.
  await page.route("**/api/workspaces/clair-demo/chart/order-drafts*", async route => {
    if (route.request().method() !== "GET") return route.fallback();
    const response = await route.fetch();
    const body = await response.json();
    body.rows = dense
      ? Array.from({ length: 30 }, (_, index) => ({ ...body.rows[0], orderId: `quick-dense-${index}` }))
      : body.rows.slice(0, 1);
    await route.fulfill({ response, json: body });
  });
  await page.reload();
  await expect(page.locator('tr[data-testid^="chart-order-row-"]')).toHaveCount(1);
  const dock = page.getByTestId("chart-order-quick-add-dock");
  const composer = page.getByTestId("chart-order-quick-add");
  const owner = page.locator('[data-slot="chart-order-table-surface"] [data-emr-pinned-table-scroll-owner="true"]');
  await expect(dock).toBeHidden();
  const idleWidth = (await composer.boundingBox())!.width;
  let input = await openQuickAddForTest(page);
  expect((await input.boundingBox())!.width).toBeGreaterThan(idleWidth * 2);
  await expect(dock).toBeHidden();
  await expect(page.getByTestId("chart-order-quick-add-clearance")).toHaveCount(0);
  await input.press("Escape");
  dense = true;
  await page.reload();
  await expect(page.locator('tr[data-testid^="chart-order-row-quick-dense-"]')).toHaveCount(30);
  await owner.evaluate(element => { element.scrollTop = 80; });
  const priorScroll = await owner.evaluate(element => element.scrollTop);
  const windowScroll = await page.evaluate(() => window.scrollY);
  input = await openQuickAddForTest(page, "BASO");
  await expect.poll(() => owner.evaluate(element => element.scrollHeight - element.clientHeight - element.scrollTop)).toBeLessThan(2);
  await expect(dock).toBeVisible();
  const top = (await input.boundingBox())!.y;
  await owner.evaluate(element => { element.scrollTop = 0; });
  await expect.poll(async () => Math.abs((await input.boundingBox())!.y - top)).toBeLessThan(1);
  expect(await page.evaluate(() => window.scrollY)).toBe(windowScroll);
  const dockBox = (await dock.boundingBox())!;
  const viewportBottom = await owner.evaluate(element => element.getBoundingClientRect().top + element.clientHeight);
  expect(dockBox.y + dockBox.height).toBeLessThanOrEqual(viewportBottom + 1);
  await page.screenshot({ path: "test-results/quick-add-dense-dock.png" });
  await input.press("Escape");
  await expect(dock).toBeHidden();
  await expect.poll(() => owner.evaluate(element => element.scrollTop)).toBe(priorScroll);
});

test("chart quick-add reuses warm results but requires fresh authority before adding", async ({ page }) => {
  await routeQuickAddCatalog(page);
  await page.goto(kongScenarioUrl);
  await restoreKongOrderDraftDefaults(page);
  let input = await openQuickAddForTest(page, "BASO");
  const option = page.getByRole("option").filter({ hasText: "#BASO" });
  await expect(option).toBeEnabled();
  await input.press("Escape");
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let responseStatus = 503;
  await page.route("**/hospital-admin/order-catalog?mode=chart-search", async route => {
    if (responseStatus === 200) return route.fallback();
    await gate;
    await route.fulfill({ status: responseStatus, json: { ok: false, error: "fixture" } });
  });
  try {
    input = await openQuickAddForTest(page, "BASO");
    await expect(page.getByText("최신 목록 확인 중")).toBeVisible();
    await expect(option).toBeVisible();
    await expect(option).toBeDisabled();
    const before = await page.locator('tr[data-testid^="chart-order-row-"]').count();
    await input.press("Enter");
    await expect(page.locator('tr[data-testid^="chart-order-row-"]')).toHaveCount(before);
    release();
    await expect(page.getByText("최신 목록을 확인하지 못했어요.")).toBeVisible();
    await expect(option).toBeDisabled();
    responseStatus = 200;
    await page.getByRole("button", { name: "다시 시도", exact: true }).click();
    await expect(option).toBeEnabled();
    await input.press("Escape");
    responseStatus = 403;
    await openQuickAddForTest(page, "BASO");
    await expect(page.getByText("오더 검색 권한이 없습니다.")).toBeVisible();
    await expect(option).toHaveCount(0);
  } finally {
    release();
  }
});

test("chart status presentation keeps edits in place until blur and hides unconfirmed work", async ({ page }) => {
  await page.goto(kongScenarioUrl);
  await restoreKongOrderDraftDefaults(page);
  // Earlier confirmation scenarios share the mock server; isolate this draft UI case.
  await page.route("**/api/workspaces/clair-demo/chart/order-drafts*", async route => {
    if (route.request().method() !== "GET") return route.fallback();
    const response = await route.fetch();
    const body = await response.json();
    body.rows = body.rows.map((row: Record<string, unknown>) => row.orderId === "order-kong-cbc"
      ? { ...row, orderId: "status-draft-cbc", orderConfirmationStatus: "draft", status: "requested" } : row);
    await route.fulfill({ response, json: body });
  });
  await page.reload();
  await page.waitForLoadState("networkidle");
  const table = page.getByRole("table", { name: "처방/오더 테이블" });
  const rows = table.locator('tbody tr[data-testid^="chart-order-row-"]');
  const ids = () => rows.evaluateAll(elements => elements.map(element => element.getAttribute("data-testid")));
  const initialIds = await ids();
  const target = page.getByTestId("chart-order-row-status-draft-cbc");
  await expect(target).toHaveAttribute("data-order-confirmation", "ready");
  await expect(target.locator('td[data-column-id="status"]')).toHaveText("—");
  await target.getByLabel("확정 후 업무 상태가 표시됩니다").focus();
  await expect(page.getByRole("tooltip")).toHaveText("확정 후 업무 상태가 표시됩니다");
  const quantity = target.getByLabel("status-draft-cbc 수량 수정");
  await quantity.fill("0");
  await expect(target).toHaveAttribute("data-order-confirmation", "invalid");
  expect(await ids()).toEqual(initialIds);
  await quantity.press("Enter");
  await expect.poll(ids).not.toEqual(initialIds);
  const ranks = await rows.evaluateAll(elements => elements.map(element =>
    ({ ready: 0, invalid: 1, confirmed: 2 })[element.getAttribute("data-order-confirmation") as "ready" | "invalid" | "confirmed"]));
  expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  await expect(target).toHaveAttribute("data-emr-data-table-row-state", "normal");
  await target.getByRole("button", { name: "미입력", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("status-draft-cbc");
});

test("chart empty notice waits for a successful list and dismissal stays encounter-scoped", async ({ page }) => {
  const first = createLiveChartQueueRecord({ encounterId: "empty-notice-a", patientName: "빈차트에이", sortOrder: 1 });
  const second = createLiveChartQueueRecord({ encounterId: "empty-notice-b", patientName: "빈차트비", sortOrder: 2 });
  first.encounter.status = "ready_for_billing";
  second.encounter.status = "ready_for_billing";
  let releaseList!: () => void;
  const listGate = new Promise<void>((resolve) => { releaseList = resolve; });
  await grantCheongdamWorkspaceAccess(page);
  await page.route(`**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/chart/live-queue?*`,
    (route) => fulfillLiveChartQueue(route, [first, second]));
  await page.route("**/chart/encounter-charts?*", async (route) => {
    await listGate;
    await route.fulfill({ json: { ok: true, status: 200, charts: [] } });
  });
  try {
    await page.goto(`/w/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/treatment?encounterId=${first.encounter.id}&modulePanel=open&aside=closed`);
    await expect(page.getByText("진료 차트를 준비하는 중", { exact: true })).toBeVisible();
    await expect(page.getByText("이 접수에 작성된 차트가 없어요")).toHaveCount(0);
    releaseList();
    const empty = page.getByRole("status").filter({ hasText: "이 접수에 작성된 차트가 없어요" });
    await expect(empty).toBeVisible();
    await empty.getByRole("button", { name: "안내 닫기" }).focus();
    await page.keyboard.press("Enter");
    await expect(empty).toHaveCount(0);
    await page.setViewportSize({ width: 1840, height: 1080 });
    await expect(empty).toHaveCount(0);
    await page.getByTestId(`order-queue-item-${second.encounter.id}`).click();
    await expect(empty).toBeVisible();
  } finally {
    releaseList();
  }
});
