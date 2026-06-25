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

test("chart workspace renders queue, history, SOAP, assessment, and orders", async ({
  page,
}) => {
  await page.goto(
    "/w/clair-demo/treatment?modulePanel=open&aside=history&right=open",
  );

  const sidePanel = page.locator("aside").first();
  await expect(sidePanel.getByText("진료 대기열")).toBeVisible();
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
    `/w/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/treatment?modulePanel=open&aside=closed&right=closed`,
  );

  const sidePanel = page.locator("aside").first();
  await expect(sidePanel.getByText("진료 대기열")).toBeVisible();
  await expect(
    sidePanel.getByText("오늘 진료 대기 업무가 없습니다."),
  ).toBeVisible();
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
    primaryVeterinarianId: "user-vet",
    encounterNo: "E-260625-0001",
    chiefComplaint: "현장 접수",
    visitPurpose: "내과 진료",
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
        action: "call" | "start";
        roomId?: string;
      };
      if (body.action === "call") {
        expect(body.roomId).toBe("room-consult-2");
        queueEntry = {
          ...queueEntry,
          status: "called",
          calledAt: "2026-06-25T05:20:00.000Z",
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

  await page.goto(
    `/w/clair-demo/treatment?modulePanel=open&aside=closed&encounterId=${encounterId}`,
  );

  await expect(page.getByTestId("chart-completion-status")).toContainText(
    "호출 대기",
  );
  await expect(page.getByRole("button", { name: "호출하기" })).toBeVisible();
  await expect(page.getByRole("button", { name: "차트 작성완료" })).toHaveCount(0);
  await expect(page.getByTestId("chart-start-locked-state")).toContainText(
    "진료 시작 전입니다",
  );

  await page.getByRole("button", { name: "호출하기" }).click();
  await expect(
    page.getByRole("heading", { name: "초코/최도현을 호출하시겠습니까?" }),
  ).toBeVisible();
  const callDialog = page.getByRole("dialog", {
    name: "초코/최도현을 호출하시겠습니까?",
  });
  await expect(callDialog).toContainText(
    "진료실을 선택한 뒤 환자를 호출해 주세요.",
  );
  await expect(callDialog).toContainText("환자 / 보호자");
  await expect(callDialog).toContainText("초코 / 최도현");
  await expect(callDialog).toContainText("접수 시각");
  await expect(callDialog).toContainText("담당 수의사");
  await expect(callDialog).toContainText("진료실");
  await expect(callDialog).not.toContainText("DID 표시 preview");
  await expect(callDialog).not.toContainText("현재 상태");
  await expect(callDialog).not.toContainText("local outbox");
  await expect(callDialog.getByRole("button", { name: "호출하기" })).toBeDisabled();
  await callDialog.getByRole("combobox", { name: "호출 진료실" }).click();
  await page.getByRole("option", { name: "2진료실" }).click();
  await expect(callDialog.getByRole("combobox", { name: "호출 진료실" })).toContainText("2진료실");
  await expect(callDialog).not.toContainText("room-consult-2");
  await page.getByRole("button", { name: "호출하기" }).last().click();

  await expect(page.getByTestId("chart-completion-status")).toContainText(
    "호출됨",
  );
  await expect(page.getByRole("button", { name: "진료 시작" })).toBeVisible();
  await expect(page.getByRole("button", { name: "차트 작성완료" })).toHaveCount(0);
  await expect(page.getByTestId("chart-start-locked-state")).toContainText(
    "환자가 입실하면 진료 시작",
  );

  await page.getByRole("button", { name: "진료 시작" }).click();
  await expect(page.getByTestId("chart-completion-status")).toContainText("진료중");
  await expect(page.getByRole("button", { name: "차트 작성완료" })).toBeVisible();
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
    "/w/clair-demo/treatment?modulePanel=open&aside=history&right=open",
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

test("chart SOAP tabs add systems, prevent duplicates, reset, undo, and delete", async ({
  page,
}) => {
  await page.goto(kongScenarioUrl);

  const soapEditor = page.getByLabel("기본 SOAP 기록");
  await expect(soapEditor).toContainText("보호자 진술상 전날 밤부터 구토 3회");

  await page.getByRole("button", { name: "기본 SOAP 작업" }).click();
  await page.getByRole("menuitem", { name: "초기화" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "초기화" })
    .click();
  await expect(soapEditor).toContainText("보호자 진술:");
  await page.getByRole("button", { name: "되돌리기" }).click();
  await expect(soapEditor).toContainText("보호자 진술상 전날 밤부터 구토 3회");

  await page.getByRole("button", { name: "SOAP 추가" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "호흡기" })
    .click();
  await expect(page.getByLabel("호흡기 SOAP 기록")).toContainText(
    "보호자 진술:",
  );

  await page.getByRole("button", { name: "SOAP 추가" }).click();
  const addDialog = page.getByRole("dialog");
  await expect(
    addDialog.getByRole("button", { name: /호흡기/ }),
  ).toBeDisabled();
  expect(
    await addDialog.getByText("이미 추가됨").count(),
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

  await page.getByRole("button", { name: "차트 작성완료" }).click();
  const chartCompleteDialog = page.getByRole("dialog", {
    name: "차트 작성완료 확인",
  });
  await expect(
    chartCompleteDialog.getByText("차트 작성완료 확인"),
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

  for (const systemLabel of ["호흡기", "피부", "전신", "예방"]) {
    await page.getByRole("button", { name: "SOAP 추가" }).click();
    const dialog = page.getByRole("dialog");
    const systemButton = dialog.getByRole("button", { name: systemLabel });
    if (await systemButton.isEnabled()) {
      await systemButton.click();
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

test("chart order table supports single sort and section filter builder", async ({
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

  await orderArea.getByRole("button", { name: "오더 필터 설정" }).click();
  const filterBuilder = page.locator('[data-emr-table-filter-builder="true"]');
  await expect(
    filterBuilder.getByRole("combobox", { name: "필터 필드" }),
  ).toHaveCount(1);
  await filterBuilder.getByRole("combobox", { name: "필터 필드" }).click();
  await page.getByRole("option", { name: "수의사" }).click();
  await filterBuilder.getByRole("combobox", { name: "필터 값" }).click();
  await page.getByRole("option", { name: "이수지", exact: true }).click();

  await expect(
    orderArea.getByRole("button", { name: "오더 필터 1개 설정" }),
  ).toBeVisible();
  await expect(orderRows.first()).toBeVisible();
  await expect(orderRows.first()).toContainText("복부 초음파");

  await filterBuilder.getByRole("button", { name: "초기화" }).click();

  await expect(
    orderArea.getByRole("button", { name: "오더 필터 설정" }),
  ).toBeVisible();
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
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  await page.goto("/w/clair-demo/treatment");

  await page.getByTestId("order-queue-item-encounter-haru-260430").click();

  await expect(
    page.getByLabel("환자 컨텍스트 정보").getByText("하루"),
  ).toBeVisible();
  await expect(page.getByText("E-260430-0005").first()).toBeVisible();
  await expect(page.getByText("예방접종 전 건강 확인").first()).toBeVisible();
  await expect(page.getByText("진단 입력 전입니다.")).toBeVisible();
  await expect(page.getByText("기본 SOAP")).toBeVisible();
  expect(
    consoleErrors.filter((message) =>
      message.includes("Encountered two children with the same key"),
    ),
  ).toEqual([]);
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

test("chart hides the patient info context-bar toggle while keeping panel collapse available", async ({
  page,
}) => {
  await page.goto(
    "/w/clair-demo/treatment?modulePanel=open&aside=history&right=closed",
  );

  await expect(
    page.locator("#chart-content-aside").getByText("차트이력"),
  ).toBeVisible();
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

  await expect(
    page.getByText("진료 참고 · 개인/민감 정보 · 부가 정보"),
  ).toBeHidden();
  await expect(page.getByRole("button", { name: /환자 정보 (열기|접기)/ })).toHaveCount(0);
  await expect(page.getByText("환자 정보 보기")).toHaveCount(0);

  await page.goto(
    "/w/clair-demo/treatment?modulePanel=open&aside=history&right=open",
  );
  await expect(page).toHaveURL(/right=open/);
  await expect(page.getByRole("button", { name: /환자 정보 (열기|접기)/ })).toHaveCount(0);
  await expect(
    page.getByText("진료 참고 · 개인/민감 정보 · 부가 정보"),
  ).toHaveCount(0);
  const patientInfoPanelTitle = page.getByRole("heading", {
    name: "환자 정보",
  });
  const patientInfoPanelCollapse = page.getByRole("button", {
    name: "환자 정보 패널 접기",
  });
  await expect(patientInfoPanelCollapse).toBeVisible();
  const titleBox = await patientInfoPanelTitle.boundingBox();
  const collapseBox = await patientInfoPanelCollapse.boundingBox();
  if (!titleBox || !collapseBox) {
    throw new Error(
      "Patient info panel title or collapse button was not measurable.",
    );
  }
  expect(collapseBox.x - (titleBox.x + titleBox.width)).toBeLessThanOrEqual(8);
  await expect(page.getByText("개인/민감 정보", { exact: true })).toBeVisible();
  await expect(page.getByText("부가 정보", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "환자 정보 패널 접기" }).click();
  await expect(page).toHaveURL(/right=closed/);
  await expect(page.getByText("개인/민감 정보", { exact: true })).toBeHidden();
});

test("chart completion persists through route-backed reload", async ({
  page,
}) => {
  await page.goto(kongScenarioUrl);

  await expect(page.getByTestId("chart-completion-status")).toContainText(
    /오더 진행중|작성완료/,
  );

  await page.getByRole("button", { name: "차트 작성완료" }).click();
  const chartCompleteDialog = page.getByRole("dialog", {
    name: "차트 작성완료 확인",
  });
  await expect(
    chartCompleteDialog.getByText("차트 작성완료 확인"),
  ).toBeVisible();
  await expect(
    chartCompleteDialog
      .getByText("오더 진행중", { exact: true })
      .or(chartCompleteDialog.getByText(/작성완료 ·/))
      .first(),
  ).toBeVisible();
  await chartCompleteDialog
    .getByRole("button", { name: "작성완료 저장" })
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
    "Order 출력은 아직 연결되지 않았어",
  );
  await expect(unavailableAlert).toContainText("문서 생성, 프린트, PDF 출력");
  await unavailableAlert.getByRole("button", { name: "확인" }).click();
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
