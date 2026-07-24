import { readFileSync } from "node:fs";
import { expect, test, type Locator, type Page } from "@playwright/test";

import { SESSION_WORKSPACES_STORAGE_KEY } from "../src/features/auth/workspace-session";
import { PREPARED_EMPTY_CLINIC_WORKSPACE_ID } from "../src/lib/emr-domain/demo-workspaces";

const kongScenarioUrl =
  "/w/clair-demo/treatment?scenario=kong-vomit&patientId=patient-kong&encounterId=encounter-kong-260501&modulePanel=open&aside=closed";
const kongEncounterId = "encounter-kong-260501";
const kongDefaultOrderDraftRows = [
  {
    orderId: "order-kong-maropitant",
    billingDisplayName: "Maropitant 16mg T",
    quantity: 1,
  },
  {
    orderId: "order-kong-cbc",
    billingDisplayName: "CBC 검사",
    quantity: 1,
  },
  {
    orderId: "order-kong-fluid",
    billingDisplayName: "피하 수액 처치",
    quantity: 1,
  },
  {
    orderId: "order-kong-abdomen",
    billingDisplayName: "복부 초음파",
    quantity: 1,
  },
];

test("chart live queue preserves explicit encounter deep links", () => {
  const source = readFileSync("src/features/chart/module.tsx", "utf8");

  expect(source).toContain("const explicitQueryEncounterId =");
  expect(source).toContain("if (explicitQueryEncounterId) return;");
  expect(source).toContain("chooseRecoverableLiveEncounterId");
  expect(source).toContain("explicitEncounterId: explicitQueryEncounterId");
  expect(source).toContain("function useExplicitChartEncounterId()");
  expect(source).toContain(
    "function useDemoScenarioChartEncounterId()",
  );
  expect(source).toContain(
    "selectedEncounterId === demoScenarioEncounterId",
  );
  expect(source).toContain(
    "saveSelectedChartEncounterId(workspaceId, nextSelectedEncounterId)",
  );
});

async function expectTopEdgeInViewport(page: Page, locator: Locator) {
  const box = await locator.boundingBox();
  const viewportHeight =
    page.viewportSize()?.height ??
    (await page.evaluate(() => window.innerHeight));

  expect(box).not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeLessThan(viewportHeight);
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

async function routePreconsultationContext(
  page: Page,
  resolveContext: (encounterId: string) => Record<string, unknown>,
) {
  await page.route(
    "**/api/workspaces/*/chart/preconsultation-context?*",
    async (route) => {
      const encounterId = new URL(route.request().url()).searchParams.get("encounterId") ?? "";
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

async function restoreKongOrderDraftDefaults(page: Page) {
  const response = await page.request.patch(
    "/api/workspaces/clair-demo/chart/order-drafts",
    {
      data: {
        encounterId: kongEncounterId,
        orders: kongDefaultOrderDraftRows,
      },
      headers: { "x-clair-demo-session-user-id": "user-vet" },
    },
  );
  expect(response.status()).toBe(200);
  await page.reload();
  await page.waitForLoadState("networkidle");

  const billingName = page.getByLabel("Maropitant 16mg T 청구서명 수정");
  const quantity = page.getByLabel("Maropitant 16mg T 수량 수정");
  const updateButton = page.getByRole("button", { name: /Order 업데이트/ });

  await expect(billingName).toBeVisible();
  await billingName.fill("Maropitant 16mg T");
  await quantity.fill("1");

  if (await updateButton.isEnabled()) {
    await updateButton.click();
    await expect(page.getByText(/변경 대기/)).toHaveCount(0);
    await expect(updateButton).toBeDisabled();
  }

  await expect(quantity).toHaveValue("1");
  await expect(billingName).toHaveValue("Maropitant 16mg T");
}

test("waiting chart saves and clears only today's vital values through the dialog", async ({ page }) => {
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

  await page.route("**/api/workspaces/*/chart/preconsultation-context?*", async (route) => {
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
  });
  await page.route("**/api/workspaces/*/chart/preconsultation-vitals", async (route) => {
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
      body: JSON.stringify({ ok: true, status: 200, enforcedBy: "patient-vital-write", vital }),
    });
  });

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

  await expect(lockedState.getByRole("button", { name: "오늘 바이탈 수정" })).toBeVisible();
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

  await expect(lockedState.getByLabel("환자 바이탈 표, 좁은 화면에서는 가로로 스크롤할 수 있습니다")).toContainText("—");
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

test("chart vital history follows workspace omission and re-add without rewriting measurements", async ({ page }) => {
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
    { key: "weight", label: "체중", description: "환자의 현재 체중", canonicalUnit: "kg", allowedDisplayUnits: ["kg", "g"], requiredInWorkspace: true },
    { key: "temperature", label: "체온", description: "체온계로 측정한 체온", canonicalUnit: "°C", allowedDisplayUnits: ["°C", "°F"], requiredInWorkspace: true },
    { key: "heart_rate", label: "심박수", description: "분당 심장 박동 수", canonicalUnit: "bpm", allowedDisplayUnits: ["bpm"], requiredInWorkspace: false },
    { key: "respiratory_rate", label: "호흡수", description: "분당 호흡 횟수", canonicalUnit: "rpm", allowedDisplayUnits: ["rpm"], requiredInWorkspace: false },
    { key: "blood_pressure", label: "혈압", description: "수축기 단독 또는 수축기/이완기", canonicalUnit: "mmHg", allowedDisplayUnits: ["mmHg"], requiredInWorkspace: false },
  ];

  await page.route("**/api/workspaces/*/vital-settings", async (route) => {
    const items = [
      { key: "weight", enabled: true, displayUnit: "kg", sortOrder: 0 },
      { key: "temperature", enabled: true, displayUnit: "°C", sortOrder: 1 },
      ...(includeHeartRate
        ? [{ key: "heart_rate", enabled: true, displayUnit: "bpm", sortOrder: 2 }]
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
      body: JSON.stringify({ ok: true, status: 200, canManage: true, presets, items }),
    });
  });
  await page.route("**/api/workspaces/*/chart/preconsultation-context?*", async (route) => {
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
  });

  await page.goto(`/w/${workspaceId}/treatment?modulePanel=open&aside=closed&encounterId=${encounterId}`);
  const vitalTable = page.getByTestId("chart-start-locked-state").getByLabel(
    "환자 바이탈 표, 좁은 화면에서는 가로로 스크롤할 수 있습니다",
  );
  await expect(vitalTable).not.toContainText("심박수");
  await expect(vitalTable).not.toContainText("88 bpm");
  expect(historicalVital.heartRateBpm).toBe(88);

  includeHeartRate = true;
  await page.reload();
  await expect(vitalTable).toContainText("심박수");
  await expect(vitalTable).toContainText("88 bpm");
  expect(historicalVital.heartRateBpm).toBe(88);
});

test("chart workspace renders queue, history, SOAP, assessment, and orders", async ({
  page,
}) => {
  await page.goto(
    "/w/clair-demo/treatment?modulePanel=open&aside=history",
  );

  const sidePanel = page.locator("aside").first();
  await expect(sidePanel.getByText("진료 대기열")).toBeVisible();
  await expect(
    sidePanel.getByRole("group", { name: "진료 대기 유형 필터" }),
  ).toHaveCount(0);
  await expect(
    sidePanel.getByTestId("order-queue-sort-control"),
  ).toHaveAttribute("aria-label", "대기열 정렬");
  await expect(
    sidePanel.getByTestId("order-queue-sort-control"),
  ).toHaveText("");
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
  await expect(
    page.getByRole("button", { name: "차트 이력 패널 접기" }),
  ).toBeVisible();
  await expect(
    page.locator("#chart-content-aside").getByText("차트이력"),
  ).toBeVisible();
  await expect(
    page.getByRole("separator", {
      name: "진료 기록과 처방/오더 영역 높이 조절",
    }),
  ).toHaveCSS("height", "16px");
  const chartWorkspace = page.locator('[data-slot="chart-workspace"]');
  await expect(chartWorkspace).toHaveCSS("margin-top", "8px");
  await expect(chartWorkspace).toHaveCSS("padding-top", "8px");
  await expect(
    page.getByLabel("환자 컨텍스트 정보").getByText("담당 수의사"),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "진료 기록" })).toHaveCount(0);
  await expect(page.getByText("기본 SOAP")).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "소화기", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "초안 저장" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /진단명/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "진단 이력" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "전체오더" })).toBeVisible();
  const soapDiagnosisGridMetrics = await page
    .getByTestId("chart-soap-diagnosis-grid")
    .evaluate((element) => {
      const [soapPanel, diagnosisPanel] = Array.from(
        element.children,
      ) as HTMLElement[];

      return {
        diagnosisWidth: diagnosisPanel.getBoundingClientRect().width,
        gap: getComputedStyle(element).columnGap,
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
  await expect(
    page.getByText("급성 위장관염 의심", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText("항구토제 세트")).toBeVisible();
  await expect(page.getByText("피하 수액 처치").first()).toBeVisible();
  const diagnosisPanel = page.getByLabel("진단명 관리");
  await expect(
    diagnosisPanel
      .locator('[data-emr-cell-text-mode="two-line-if-long"]', {
        hasText: "급성 위장관염 의심",
      })
      .first(),
  ).toContainText("급성 위장관염 의심");
  const orderTable = page.getByRole("table", { name: "처방/오더 테이블" });
  await expect(orderTable.locator('th:has-text("Order명")')).toHaveAttribute(
    "data-emr-header-interaction",
    "compound",
  );
  await expect(orderTable.locator('th:has-text("수량")')).toHaveAttribute(
    "data-emr-column-resize",
    "data-column",
  );
  await expect(orderTable.locator('th:has-text("작업")')).toHaveAttribute(
    "data-emr-column-resize",
    "none",
  );
  await expect(
    orderTable
      .locator('[data-emr-cell-text-mode="two-line-if-long"]', {
        hasText: "Maropitant 16mg T",
      })
      .first(),
  ).toContainText("Maropitant 16mg T");
  await expect(
    orderTable
      .locator('[data-emr-cell-text-mode="one-line"]', {
        hasText: "항구토제 세트",
      })
      .first(),
  ).toContainText("항구토제 세트");
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
  await page.getByRole("button", { name: "기본 SOAP 작업" }).click();
  await page.getByRole("menuitem", { name: "첨부" }).click();
  await page.getByRole("button", { name: "기본 SOAP 작업" }).click();
  await expect(page.getByRole("menuitem", { name: "첨부 1" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByText("처치 지시서")).toHaveCount(0);
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
  await expect(sidePanel.getByText("진료 업무가 없습니다")).toBeVisible();
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
  await expect(feedback).toContainText("대기 목록의 접수 정보는 변경되지 않았어요.");
  await expect(feedback.getByRole("button", { name: "대기 목록으로" })).toBeVisible();
  await expect(feedback.getByRole("button", { name: "다시 시도" })).toBeVisible();

  await feedback.getByRole("button", { name: "다시 시도" }).click();
  await expect.poll(() => requestCount).toBeGreaterThan(1);
  await expect(feedback).toBeVisible();

  await feedback.getByRole("button", { name: "대기 목록으로" }).click();
  await expect(page).not.toHaveURL(/encounterId=/);
});

test("chart consultation CTA moves from call to start before chart completion", async ({
  page,
}) => {
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

  await page.route("**/api/workspaces/clair-demo/chart/live-queue**", async (route) => {
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
  });
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
  await page.route("**/api/workspaces/clair-demo/chart/completion**", async (route) => {
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
  });
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

      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          flow: {
            encounter,
            queueEntry,
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
  await expect(page.locator("[data-slot='chart-instruction-info-card']")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "차트 공유" })).toHaveCount(0);
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
  await expect(weightDelta.locator('[data-direction="increase"]')).toHaveCount(1);

  const respiratoryDelta = vitalTable.getByLabel("호흡수 변화: 2 감소");
  await expect(respiratoryDelta).toContainText("(2)");
  await expect(respiratoryDelta).not.toContainText(/rpm|회\/분|감소|하강/);
  await expect(respiratoryDelta.locator("svg")).toHaveCount(1);
  await expect(respiratoryDelta.locator('[data-direction="decrease"]')).toHaveCount(1);

  await expect(vitalTable.getByLabel(/^체온 변화:/)).toHaveCount(0);

  await expect(vitalTable).toContainText("심박수");
  await expect(vitalTable).not.toContainText("혈압");
  const currentVitalDateCell = vitalTable.locator("tbody tr").first().locator("th");
  await expect(currentVitalDateCell.getByText("오늘", { exact: true })).toBeVisible();
  await expect(currentVitalDateCell.getByText("(26.06.25)", { exact: true })).toBeVisible();
  await expect(vitalTable.locator("table")).toHaveCSS("min-width", "960px");
  await expect(currentVitalDateCell).toHaveCSS("height", "52px");
  await expect(currentVitalDateCell).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(currentVitalDateCell).toHaveCSS("border-top-color", "rgb(229, 229, 229)");
  const lastVitalCells = vitalTable.locator("tbody tr").last().locator("th, td");
  await expect(lastVitalCells).toHaveCount(5);
  for (let index = 0; index < 5; index += 1) {
    await expect(lastVitalCells.nth(index)).toHaveCSS("border-bottom-width", "0px");
  }
  await expect(currentVitalDateCell.getByText("오늘", { exact: true })).toHaveCSS(
    "color",
    "rgb(38, 38, 38)",
  );
  await expect(currentVitalDateCell.getByText("(26.06.25)", { exact: true })).toHaveCSS(
    "color",
    "rgb(115, 115, 115)",
  );
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
  const historyTimeline = historySection.getByTestId("preconsultation-history-timeline");
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
  await expect(historyTimeline).toHaveClass(/px-6/);
  await expect(historyTimeline).not.toHaveClass(/border-t/);
  await expect(historyTimeline).toHaveCSS("row-gap", "12px");
  await expect(historyTimeline).toHaveCSS("padding-top", "4px");
  await expect(historyTimeline).toHaveCSS("padding-left", "24px");
  const historyGroups = historyTimeline.locator(":scope > li");
  await expect(historyGroups).toHaveCount(2);
  await expect(historyGroups.nth(0)).toHaveCSS("column-gap", "8px");
  const firstHistoryTimeContainer = historyGroups.nth(0).locator(":scope > div").first();
  await expect(firstHistoryTimeContainer).toHaveCSS("width", "19px");
  await expect(firstHistoryTimeContainer).toHaveCSS("row-gap", "8px");
  const firstHistoryContent = historyGroups.nth(0).locator(":scope > div").nth(1);
  await expect(firstHistoryContent).toHaveCSS("row-gap", "8px");
  const firstHistoryDetails = firstHistoryContent.locator(":scope > ol");
  await expect(firstHistoryDetails).toHaveCSS("row-gap", "8px");
  await expect(firstHistoryDetails.locator(":scope > li")).toHaveCount(2);
  const firstHistoryCard = firstHistoryDetails.locator(":scope > li").first();
  await expect(firstHistoryCard).toHaveCSS("height", "56px");
  await expect(firstHistoryCard).toHaveCSS("column-gap", "12px");
  await expect(firstHistoryCard).toHaveCSS("padding-left", "16px");
  await expect(firstHistoryCard.locator("span").last()).toHaveCSS("font-size", "15px");
  await expect(
    historyGroups.nth(1).locator(":scope > div").nth(1).locator(":scope > ol > li"),
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
  await expect(callDialog.getByRole("button", { name: "호출하기" })).toBeDisabled();
  const defaultRoomCheckbox = callDialog.getByRole("checkbox", {
    name: "이 진료실을 내 기본 진료실로 저장",
  });
  await expect(defaultRoomCheckbox).toBeDisabled();
  await callDialog.getByRole("combobox", { name: "호출 진료실" }).click();
  await page.getByRole("option", { name: "2진료실" }).click();
  await expect(callDialog.getByRole("combobox", { name: "호출 진료실" })).toContainText("2진료실");
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
  await expect(page.getByRole("button", { name: "진료 완료" })).toBeVisible();
  await expect(page.getByTestId("chart-start-locked-state")).toHaveCount(0);
  await expect(page.getByLabel("환자 컨텍스트 정보")).toContainText("초코");

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

  await page.route("**/api/workspaces/clair-demo/chart/live-queue**", async (route) => {
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
  });
  await page.route("**/api/workspaces/clair-demo/chart/completion**", async (route) => {
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
  });

  await page.goto(
    "/w/clair-demo/treatment?modulePanel=open&aside=closed&encounterId=" + encounterId,
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
  await expect
    .poll(() => requestedDates.join(","))
    .toContain("2026-05-01");

  await sidePanel.getByRole("button", { name: "다음 날짜" }).click({
    force: true,
  });
  await expect
    .poll(() => requestedDates.join(","))
    .toContain("2026-05-02");
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
  await expect
    .poll(() => requestedDates.join(","))
    .toContain("2026-05-08");
  await expect(
    sidePanel.getByRole("button", { name: "26.05.08(금) 날짜 선택" }),
  ).toBeVisible();
  await expect(sidePanel.getByText("오늘", { exact: true })).toHaveCount(0);

  await sidePanel.getByRole("button", { name: "26.05.08(금) 날짜 선택" }).click();
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

test("chart SOAP editor keeps SOAP fields structured and uses an inline link popover", async ({
  page,
}) => {
  await page.goto(kongScenarioUrl);

  const subjectiveEditor = page.getByLabel("기본 SOAP 기록");

  await expect(page.getByText("주관적", { exact: true }).first()).toBeVisible();
  await expect(subjectiveEditor).toContainText(
    "보호자 진술상 전날 밤부터 구토 3회",
  );

  await subjectiveEditor.click();
  await expect(
    page.getByRole("toolbar", { name: "기본 SOAP 선택 서식 도구" }),
  ).toHaveCount(0);
  await subjectiveEditor.press("ControlOrMeta+A");
  const soapSelectionToolbar = page.getByRole("toolbar", {
    name: "기본 SOAP 선택 서식 도구",
  });
  await expect(soapSelectionToolbar).toBeVisible();
  await expect(page.getByText("주관적", { exact: true }).first()).toBeVisible();
  await expect(
    soapSelectionToolbar.getByRole("button", { name: "기본 SOAP 굵게" }),
  ).toBeEnabled();
  await expect(
    soapSelectionToolbar.getByRole("button", { name: "기본 SOAP 글머리 목록" }),
  ).toBeEnabled();

  let promptOpened = false;
  page.on("dialog", async (dialog) => {
    promptOpened = true;
    await dialog.dismiss();
  });

  await soapSelectionToolbar
    .getByRole("button", { name: "기본 SOAP 링크" })
    .click();
  await expect(page.getByText("링크 추가")).toBeVisible();
  await page.getByLabel("링크 URL").fill("example.com/chart-note");
  await page.getByRole("button", { name: "적용" }).click();
  expect(promptOpened).toBe(false);
});

test("chart SOAP manual save persists through route-backed reload", async ({
  page,
}) => {
  await page.goto(
    "/w/clair-demo/treatment?modulePanel=open&aside=history",
  );

  const soapEditor = page.getByLabel("기본 SOAP 기록");
  const savedText = `DEN-69 SOAP route-backed save ${Date.now()}`;

  await soapEditor.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type(savedText);
  await page.getByRole("button", { name: "SOAP 저장" }).click();
  await expect(page.getByTestId("chart-soap-status")).toContainText(
    /작성중|자동저장됨/,
  );

  await page.reload();
  await expect(page.getByLabel("기본 SOAP 기록")).toContainText(savedText);
});

test("chart SOAP add opens a dropdown menu instead of a modal", async ({
  page,
}) => {
  await page.goto(kongScenarioUrl);
  await expect(page.getByRole("button", { name: "SOAP 추가" })).toBeEnabled();

  await page.getByRole("button", { name: "SOAP 추가" }).click();

  await expect(page.getByRole("menu")).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "SOAP 진단계통 선택" }),
  ).toHaveCount(0);
});

test("chart SOAP tabs add systems, prevent duplicates, and delete", async ({
  page,
}) => {
  await page.goto(kongScenarioUrl);
  await expect(page.getByRole("button", { name: "SOAP 추가" })).toBeEnabled();

  await page.getByRole("button", { name: "SOAP 추가" }).click();
  const addMenu = page.getByRole("menu");
  await expect(addMenu).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await addMenu.getByRole("menuitem", { name: "호흡기" }).click();
  await expect(page.getByLabel("호흡기 SOAP 기록")).toContainText(
    "보호자 진술:",
  );

  await page.getByRole("button", { name: "SOAP 추가" }).click();
  const addedSystemMenu = page.getByRole("menu");
  await expect(
    addedSystemMenu.getByRole("menuitem", { name: /호흡기/ }),
  ).toBeDisabled();
  expect(
    await addedSystemMenu.getByText("이미 추가됨").count(),
  ).toBeGreaterThanOrEqual(2);
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "호흡기 SOAP 작업" }).click();
  await page.getByRole("menuitem", { name: "삭제", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "삭제" }).click();
  await expect(
    page.getByRole("tab", { name: "호흡기", exact: true }),
  ).toHaveCount(0);
  await expect(
    page
      .getByRole("tablist", { name: "SOAP 분류" })
      .getByRole("tab", { selected: true }),
  ).toBeVisible();
});

test("chart diagnosis search recommends, adds, marks, and removes session diagnoses", async ({
  page,
}) => {
  await page.goto(kongScenarioUrl);

  const diagnosisPanel = page.getByLabel("진단명 관리");

  await diagnosisPanel.getByRole("button", { name: "분류검색" }).click();
  await expect(
    page.getByRole("listbox", { name: "진단명 검색 결과" }),
  ).toBeVisible();
  await expect(page.getByText("SOAP/주호소 기반 추천")).toBeVisible();
  await expect(
    page.getByRole("option", { name: /급성 위장관염 의심/ }),
  ).toBeVisible();

  await diagnosisPanel.getByLabel("진단명 검색").fill("췌장");
  await page.getByRole("option", { name: /췌장염 감별/ }).click();

  await expect(diagnosisPanel.getByText("췌장염 감별")).toBeVisible();
  await expect(diagnosisPanel.getByText("사전 연결 · 감별")).toHaveCount(0);
  await expect(
    page.getByRole("tab", { name: "소화기", exact: true }),
  ).toBeVisible();

  await diagnosisPanel.getByLabel("진단명 검색").fill("탈수");
  await page.getByRole("option", { name: /경도 탈수/ }).click();

  await expect(diagnosisPanel.getByText("경도 탈수")).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "전신", exact: true }),
  ).toBeVisible();

  const pancreatitisConfirmedToggle = diagnosisPanel.getByRole("button", {
    name: "췌장염 감별 확진 토글",
  });
  await pancreatitisConfirmedToggle.click();
  await expect(diagnosisPanel.getByText("사전 연결 · 확진")).toHaveCount(0);
  await expect(pancreatitisConfirmedToggle).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await pancreatitisConfirmedToggle.click();
  await expect(pancreatitisConfirmedToggle).toHaveAttribute(
    "aria-pressed",
    "false",
  );

  await diagnosisPanel
    .getByLabel("진단명 검색")
    .fill("보호자 설명용 임시 진단");
  await page.getByRole("option", { name: /보호자 설명용 임시 진단/ }).click();

  await expect(
    diagnosisPanel.getByText("보호자 설명용 임시 진단"),
  ).toBeVisible();
  await expect(diagnosisPanel.getByText("직접 입력 · 의심")).toHaveCount(0);

  await diagnosisPanel
    .getByRole("button", { name: "보호자 설명용 임시 진단 삭제" })
    .click();
  await expect(diagnosisPanel.getByText("보호자 설명용 임시 진단")).toHaveCount(
    0,
  );
});

test("chart safety context and confirmation dialogs identify the active patient", async ({
  page,
}) => {
  await page.goto(kongScenarioUrl);
  await restoreKongOrderDraftDefaults(page);

  const patientContext = page.getByLabel("환자 컨텍스트 정보");
  await expect(patientContext.getByText("콩이 · 보호자 김하늘")).toBeVisible();
  await expect(patientContext.getByText("차트번호")).toBeVisible();
  await expect(patientContext.getByText("E-260501-0003")).toBeVisible();
  await expect(
    page.getByText("콩이(4세) · 보호자 김하늘 · 푸들"),
  ).toBeVisible();
  await expect(page.getByTestId("chart-soap-status")).toHaveText(
    "자동저장됨 · 10:16",
  );
  await expect(page.getByText("자동저장됨 · 10:16").first()).toBeVisible();

  await expect(page.getByRole("button", { name: "Order 청구" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Order 확정" })).toBeDisabled();

  await page.getByRole("button", { name: "진료 완료" }).click();
  const chartCompleteDialog = page.getByRole("dialog", {
    name: "진료 완료 확인",
  });
  await expect(
    chartCompleteDialog.getByText("진료 완료 확인"),
  ).toBeVisible();
  await expect(chartCompleteDialog.getByText("콩이 / 김하늘")).toBeVisible();
  await expect(chartCompleteDialog.getByText("E-260501-0003")).toBeVisible();
  await expect(chartCompleteDialog.getByText(/\d+건 \/ 4건/)).toBeVisible();
  await chartCompleteDialog.getByRole("button", { name: "계속 작성" }).click();

  await page.getByRole("checkbox", { name: "Maropitant 16mg T 선택" }).check();
  await expect(page.getByRole("button", { name: "Order 청구" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Order 확정" })).toBeEnabled();

  await page.getByRole("button", { name: "Order 확정" }).click();
  const orderConfirmDialog = page.getByRole("dialog");
  await expect(orderConfirmDialog.getByText("Order 확정 확인")).toBeVisible();
  await expect(
    orderConfirmDialog.getByText("환자: 콩이 · 보호자 김하늘"),
  ).toBeVisible();
  await expect(
    orderConfirmDialog.getByText("차트번호: E-260501-0003"),
  ).toBeVisible();
  await expect(
    orderConfirmDialog.getByText("선택 오더: 1건 · 선택 금액 4,500"),
  ).toBeVisible();
  await expect(orderConfirmDialog.getByText("재요청 포함: 없음")).toBeVisible();
});

test("chart Order 청구 sends persisted orders without draft save", async ({
  page,
}) => {
  await page.goto(kongScenarioUrl);
  await restoreKongOrderDraftDefaults(page);

  let draftPatchCount = 0;
  await page.route(
    "**/api/workspaces/clair-demo/chart/order-drafts",
    async (route) => {
      if (route.request().method() === "PATCH") {
        draftPatchCount += 1;
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

  await page.getByRole("checkbox", { name: "Maropitant 16mg T 선택" }).check();
  await page.getByRole("button", { name: "Order 청구" }).click();

  const orderBillDialog = page.getByRole("dialog", {
    name: "Order 청구 확인",
  });
  await expect(orderBillDialog).toBeVisible();
  await expect(
    orderBillDialog
      .getByText("아직 완료되지 않은 오더가 있습니다. 수납을 진행할까요?")
      .or(
        orderBillDialog.getByText(
          "현재 환자와 선택 오더를 확인한 뒤 수납 후보로 넘깁니다.",
        ),
      )
      .first(),
  ).toBeVisible();

  const orderActionRequest = page.waitForRequest(
    (request) =>
      request.url().includes("/api/workspaces/clair-demo/chart/order-actions") &&
      request.method() === "PATCH",
  );
  await orderBillDialog.getByRole("button", { name: "Order 청구" }).click();

  const requestBody = JSON.parse(
    (await orderActionRequest).postData() ?? "{}",
  ) as {
    action?: string;
    orderIds?: string[];
  };

  expect(requestBody).toMatchObject({
    action: "bill",
    orderIds: ["order-kong-maropitant"],
  });
  expect(draftPatchCount).toBe(0);
});

test("chart keeps orders visible when SOAP sections grow", async ({ page }) => {
  await page.goto(kongScenarioUrl);
  await expect(page.getByRole("button", { name: "SOAP 추가" })).toBeEnabled();

  for (const systemLabel of ["호흡기", "피부", "전신", "예방"]) {
    await page.getByRole("button", { name: "SOAP 추가" }).click();
    const menu = page.getByRole("menu");
    const systemButton = menu.getByRole("menuitem", { name: systemLabel });
    if (await systemButton.isEnabled()) {
      await systemButton.click();
      await expect(
        page.getByLabel(`${systemLabel} SOAP 기록`),
      ).toBeVisible();
    } else {
      await page.keyboard.press("Escape");
    }
  }

  await expect(page.getByRole("button", { name: "SOAP 더보기" })).toBeVisible();
  await expectTopEdgeInViewport(
    page,
    page.getByRole("tab", { name: "전체오더" }),
  );
  await expectTopEdgeInViewport(
    page,
    page.getByRole("button", { name: "Order 확정" }),
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

  await expect(page.getByText("선택 오더 0건")).toBeVisible();
  await expect(page.getByText("선택 오더 합계: 0")).toBeVisible();

  await page.getByRole("checkbox", { name: "Maropitant 16mg T 선택" }).check();

  await expect(page.getByText("선택 오더 1건")).toBeVisible();
  await expect(page.getByText("선택 오더 합계: 4,500")).toBeVisible();

  const selectAllOrders = page.getByRole("checkbox", {
    name: "오더 전체 선택",
  });

  await selectAllOrders.check();
  await expect(page.getByText(/선택 오더 \d+건/)).toBeVisible();

  await selectAllOrders.uncheck();

  await expect(page.getByText("선택 오더 0건")).toBeVisible();
  await expect(page.getByText("선택 오더 합계: 0")).toBeVisible();
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
    .getByRole("button", { name: /현재 정렬: 청구금액 오름차순/ })
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
  await page.goto(kongScenarioUrl);
  await restoreKongOrderDraftDefaults(page);

  const maropitantQuantity = page.getByLabel("Maropitant 16mg T 수량 수정");

  await expect(maropitantQuantity).toHaveValue("1");
  await maropitantQuantity.fill("0");

  await expect(
    page.getByText("변경 대기 1건 · 수량 확인 필요 1건"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Order 업데이트/ }),
  ).toBeDisabled();

  await maropitantQuantity.fill("2");
  await page
    .getByLabel("Maropitant 16mg T 청구서명 수정")
    .fill("Maropitant 16mg T 변경");

  await expect(page.getByText("변경 대기 1건")).toBeVisible();
  await expect(page.getByText(/청구 예상 총액: /)).toBeVisible();

  await page.getByRole("checkbox", { name: "Maropitant 16mg T 선택" }).check();
  await expect(page.getByText("선택 오더 합계: 9,000")).toBeVisible();

  await page.getByRole("button", { name: /Order 업데이트/ }).click();
  await expect(page.getByText(/변경 대기/)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Order 업데이트/ }),
  ).toBeDisabled();
  await expect(page.getByText(/청구 예상 총액: /)).toBeVisible();

  await page.getByRole("button", { name: "CBC 검사 오더 삭제" }).click();
  const deleteDialog = page.getByRole("dialog");

  await expect(deleteDialog.getByText("오더를 삭제할까요?")).toBeVisible();
  await deleteDialog.getByRole("button", { name: "삭제", exact: true }).click();

  await expect(page.getByLabel("CBC 검사 수량 수정")).toHaveCount(0);
  await expect(page.getByText("변경 대기 1건")).toBeVisible();
  await expect(page.getByText(/청구 예상 총액: /)).toBeVisible();

  await page.getByRole("button", { name: /변경 취소/ }).click();

  await expect(page.getByLabel("CBC 검사 수량 수정")).toBeVisible();
  await expect(page.getByText(/변경 대기/)).toHaveCount(0);
  await expect(page.getByText(/청구 예상 총액: /)).toBeVisible();

  await restoreKongOrderDraftDefaults(page);
  await expect(page.getByText(/청구 예상 총액: /)).toBeVisible();
});

test("chart opens the Kong scenario as one SOAP, assessment, and order flow", async ({
  page,
}) => {
  await page.goto(kongScenarioUrl);

  const patientContext = page.getByLabel("환자 컨텍스트 정보");
  await expect(
    page.locator("[data-slot='patient-context-bar'] > div").first(),
  ).toHaveCSS("min-height", "56px");
  await expect(patientContext.getByText("콩이")).toBeVisible();
  await expect(patientContext.getByText("김하늘")).toBeVisible();
  await expect(patientContext.getByText("담당 수의사")).toBeVisible();
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
  await expect(page.getByText("구토 완화 처방")).toBeVisible();
  await expect(page.getByText("CBC 검사").first()).toBeVisible();
  await expect(page.getByText("복부 초음파").first()).toBeVisible();
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
    page.getByRole("tab", { name: "수납 0", exact: true }),
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
        checkedInAt: isHaru ? "2026-04-30T16:05:00+09:00" : "2026-05-01T09:50:00+09:00",
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

  const haruQueueCard = page.getByTestId("order-queue-item-encounter-haru-260430");
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
  await expect(page.getByText("기본 SOAP")).toHaveCount(0);

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
    page.getByLabel("환자 컨텍스트 정보").getByText(/하루\s*·\s*보호자 강서윤/),
  ).toBeVisible();
  await expect(page.getByTestId("chart-completion-status")).toContainText("진료중");
  expect(
    consoleErrors.filter((message) =>
      message.includes("Encountered two children with the same key"),
    ),
  ).toEqual([]);
});

test("chart explicit encounter does not crash when the refreshed queue temporarily omits it", async ({
  page,
}) => {
  await page.route("**/api/workspaces/clair-demo/chart/live-queue**", async (route) => {
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
  });

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

  await expect(
    page.getByRole("heading", { name: "환자를 선택해 주세요" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "This page couldn’t load" })).toHaveCount(0);
});

test("chart scenario query primes the encounter without locking queue selection", async ({
  page,
}) => {
  await page.goto(kongScenarioUrl);

  await expect(
    page.getByLabel("환자 컨텍스트 정보").getByText("콩이"),
  ).toBeVisible();

  await page.getByTestId("order-queue-item-encounter-haru-260430").click();

  await expect(
    page.getByLabel("환자 컨텍스트 정보").getByText("하루"),
  ).toBeVisible();
  await expect(page.getByText("E-260430-0005").first()).toBeVisible();
  await expect(page.getByText("예방접종 전 건강 확인").first()).toBeVisible();
});

test("chart history selection returns to a previous encounter for the patient", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/treatment?modulePanel=open&aside=history");

  await page.getByTestId("order-queue-item-encounter-coco-260501").click();
  await page.getByTestId("chart-history-item-encounter-coco-260501").click();

  await expect(
    page.getByLabel("환자 컨텍스트 정보").getByText("코코"),
  ).toBeVisible();
  await expect(
    page.getByText("급성 위장관염 의심", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText("CBC 검사").first()).toBeVisible();
});

test("chart removes the retired patient information panel and legacy right query", async ({
  page,
}) => {
  await page.goto(
    "/w/clair-demo/treatment?modulePanel=open&aside=history&right=open",
  );

  const workspaceMain = page.getByTestId("workspace-frame").locator("main");
  await expect(
    page.locator("#chart-content-aside").getByText("차트이력"),
  ).toBeVisible();
  await expect(workspaceMain).toHaveAttribute("data-right-panel-open", "false");
  await expect(page).not.toHaveURL(/right=/);
  await expect(
    page.getByRole("heading", { name: "환자 정보", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "환자 정보 패널 접기" }),
  ).toHaveCount(0);
  await expect(page.getByText("개인/민감 정보", { exact: true })).toHaveCount(0);
  await expect(page.getByText("부가 정보", { exact: true })).toHaveCount(0);

  const historyToggleOpen = page.getByRole("button", {
    name: "차트 이력 패널 접기",
  });
  await expect(historyToggleOpen).toHaveAttribute("aria-pressed", "true");
  await expect(historyToggleOpen).toHaveAttribute("data-state", "on");
  await page.getByRole("button", { name: "차트 이력 패널 접기" }).hover();
  await expect(page.getByText("과거 이력 보기")).toBeVisible();
  await page.getByRole("button", { name: "차트 이력 패널 접기" }).click();
  await expect(page).toHaveURL(/aside=closed/);

  const historyToggleClosed = page.getByRole("button", {
    name: "차트 이력 패널 열기",
  });
  await expect(historyToggleClosed).toHaveAttribute("aria-pressed", "false");
  await expect(historyToggleClosed).toHaveAttribute("data-state", "off");
  await page.getByRole("button", { name: "차트 이력 패널 열기" }).hover();
  await expect(page.getByText("과거 이력 보기")).toBeVisible();
  await page.getByRole("button", { name: "차트 이력 패널 열기" }).click();
  await expect(page).toHaveURL(/aside=history/);
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
  await expect(
    chartCompleteDialog.getByText("진료 완료 확인"),
  ).toBeVisible();
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

test("chart result readback lets completed lab order bill without separate veterinarian gate", async ({
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

  await cbcRow.getByRole("checkbox", { name: "CBC 검사 선택" }).check();
  await page.getByRole("button", { name: "Order 청구" }).click();
  const orderBillDialog = page.getByRole("dialog", {
    name: "Order 청구 확인",
  });
  await expect(orderBillDialog).toBeVisible();
  await expect(
    orderBillDialog.getByText(
      "현재 환자와 선택 오더를 확인한 뒤 수납 후보로 넘깁니다.",
    ),
  ).toBeVisible();

  const billRequest = page.waitForRequest(
    (request) =>
      request.url().includes("/chart/order-actions") &&
      request.method() === "PATCH",
  );
  await orderBillDialog.getByRole("button", { name: "Order 청구" }).click();
  const requestBody = JSON.parse((await billRequest).postData() ?? "{}") as {
    action?: string;
    encounterId?: string;
    orderIds?: string[];
  };
  expect(requestBody).toMatchObject({
    action: "bill",
    encounterId: "encounter-kong-260501",
    orderIds: ["order-kong-cbc"],
  });
  await expect(cbcRow).toContainText("수납 후보");
});

test("chart unavailable order actions show persistent inline guidance", async ({
  page,
}) => {
  await page.goto(kongScenarioUrl);

  await page.getByRole("button", { name: "Order 출력" }).click();
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
      const parent = element.parentElement;

      return parent
        ? element.getBoundingClientRect().right > parent.getBoundingClientRect().right
        : true;
    },
  );
  expect(alertOverflowsOrderWorkspace).toBe(false);
  await dismissButton.click();
  await expect(unavailableAlert).toBeHidden();
});

test("chart order add searches active workspace catalog and adds a draft row", async ({
  page,
}) => {
  await page.goto(kongScenarioUrl);
  await restoreKongOrderDraftDefaults(page);

  await page.getByRole("button", { name: "+ Order", exact: true }).click();

  const dialog = page.getByRole("dialog", {
    name: "Workspace catalog에서 Order 추가",
  });
  await expect(dialog).toBeVisible();
  await expect(
    page.getByTestId("chart-order-catalog-search-status"),
  ).toContainText("Workspace catalog active 후보");
  await expect(dialog.getByText("일시중지 예시")).toHaveCount(0);

  await dialog.getByLabel("카탈로그 Order 검색").fill("BASO");
  const candidate = page.getByTestId(
    "chart-order-catalog-candidate-std-ord-lab-cbc-baso",
  );
  await expect(candidate).toContainText("[CBC 검사] #BASO");
  const addButton = candidate.getByRole("button", { name: /추가|추가됨/ });
  if (await addButton.isEnabled()) {
    await addButton.click();
  }
  await dialog.getByRole("button", { name: "닫기" }).click();

  const addedRow = page.getByRole("row").filter({
    hasText: "[CBC 검사] #BASO",
  }).first();
  await expect(addedRow).toContainText("[CBC 검사] #BASO");
  await expect(addedRow).toContainText("12,000");
  await expect(
    page.getByRole("tab", { name: /전체오더 \d+/, exact: true }),
  ).toBeVisible();

  await addedRow
    .getByRole("checkbox", { name: "[CBC 검사] #BASO 선택" })
    .click();
  await page.getByRole("button", { name: "Order 확정" }).click();
  const confirmDialog = page.getByRole("dialog", { name: "Order 확정 확인" });
  await expect(confirmDialog).toBeVisible();
  const draftSaveResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/workspaces/clair-demo/chart/order-drafts") &&
      response.request().method() === "PATCH",
  );
  const orderActionResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/workspaces/clair-demo/chart/order-actions") &&
      response.request().method() === "PATCH",
  );
  await confirmDialog.getByRole("button", { name: "Order 확정" }).click();
  const draftResponse = await draftSaveResponse;
  expect(draftResponse.ok()).toBe(true);
  expect((await orderActionResponse).ok()).toBe(true);
  await expect(addedRow).toContainText("확정");

  await page.reload();
  const restoredRow = page.getByRole("row").filter({
    hasText: "[CBC 검사] #BASO",
  }).first();
  await expect(restoredRow).toContainText("[CBC 검사] #BASO");
  await expect(restoredRow).toContainText("확정");
});
