import { expect, test, type Page } from "@playwright/test";

import { SESSION_WORKSPACES_STORAGE_KEY } from "../src/features/auth/workspace-session";
import { PREPARED_EMPTY_CLINIC_WORKSPACE_ID } from "../src/lib/emr-domain/demo-workspaces";

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
        })
      );
    },
    [SESSION_WORKSPACES_STORAGE_KEY, PREPARED_EMPTY_CLINIC_WORKSPACE_ID]
  );
}

test("lab no-work empty state hides history aside", async ({ page }) => {
  await grantCheongdamWorkspaceAccess(page);

  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/fulfillment/work-items**`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          enforcedBy: "fulfillment-work-item-persistence",
          workItems: [],
        }),
      });
    }
  );

  await page.goto(
    `/w/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/lab?modulePanel=open&aside=history&right=closed`
  );

  await expect(page.locator("#lab-content-aside")).toHaveCount(0);
  await expect(page.locator('section[data-surface="content"]')).toBeVisible();
  await expect(page.getByRole("heading", { name: "오늘 임상병리검사 요청이 없습니다" })).toBeVisible();
});

test("imaging no-work empty state hides history aside", async ({ page }) => {
  await grantCheongdamWorkspaceAccess(page);

  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/fulfillment/work-items**`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          enforcedBy: "fulfillment-work-item-persistence",
          workItems: [],
        }),
      });
    }
  );

  await page.goto(
    `/w/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/imaging?modulePanel=open&aside=history&right=closed`
  );

  await expect(page.locator("#imaging-content-aside")).toHaveCount(0);
  await expect(page.locator('section[data-surface="content"]')).toBeVisible();
  await expect(page.getByRole("heading", { name: "오늘 영상검사 요청이 없습니다" })).toBeVisible();
});

test("lab workspace renders result input, equipment receipts, and attachments", async ({ page }) => {
  await page.goto("/w/clair-demo/lab?modulePanel=open");

  const sidePanel = page.locator("aside").first();
  await expect(sidePanel.getByText("임상병리검사")).toBeVisible();
  await expect(sidePanel.getByRole("group", { name: "임상병리검사 목록 보기" })).toHaveCount(0);
  await expect(sidePanel.getByRole("button", { name: "26.05.01(금) 날짜 선택" })).toBeVisible();
  await expect(sidePanel.getByText("검사 대기열")).toBeVisible();
  await expect(sidePanel.getByRole("button", { name: "결과입력 접기" })).toHaveAttribute("aria-expanded", "true");
  await expect(sidePanel.getByTestId("lab-queue-item-lab-result-coco-cbc")).toContainText("코코");
  await expect(sidePanel.getByTestId("lab-queue-item-lab-result-coco-cbc")).toContainText("예약");
  await expect(sidePanel.getByTestId("lab-queue-item-lab-result-coco-cbc")).toContainText("CBC 검사");
  await sidePanel.getByTestId("lab-queue-item-lab-result-coco-cbc").click();
  await expect(page).toHaveURL(/labResultId=lab-result-coco-cbc/);
  await expect(sidePanel.getByText("검사 · CBC 검사")).toHaveCount(0);
  await sidePanel.getByRole("button", { name: "결과입력 접기" }).click();
  await expect(sidePanel.getByRole("button", { name: "결과입력 펼치기" })).toHaveAttribute("aria-expanded", "false");
  await expect(sidePanel.getByTestId("lab-queue-item-lab-result-coco-cbc")).toHaveCount(0);
  await sidePanel.getByRole("button", { name: "결과입력 펼치기" }).click();
  await expect(sidePanel.getByTestId("lab-queue-item-lab-result-coco-cbc")).toBeVisible();
  await expect(sidePanel.getByText("차트별 검사")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "임상병리검사 이력 패널 접기" })).toBeVisible();
  await page.getByRole("button", { name: "임상병리검사 이력 패널 접기" }).hover();
  await expect(page.locator("[data-slot='tooltip-content']").filter({ hasText: "임상병리검사 이력" })).toBeVisible();
  await expect(page.getByTestId("lab-history-group-26.05.01")).toBeVisible();
  const labTitleBar = page.locator("[data-slot='instruction-header-title-bar']");
  await expect(labTitleBar.getByRole("heading", { name: "임상병리검사 결과지" })).toBeVisible();
  await expect(labTitleBar.getByRole("heading", { name: "임상병리검사 결과지" })).toHaveCSS("font-size", "16px");
  await expect(page.getByText("요청 일시")).toBeVisible();
  await expect(page.getByTestId("lab-result-status-label")).toHaveText("입력");
  await expect(page.getByText("CBC 검사").first()).toBeVisible();
  await expect(page.getByRole("group", { name: "검사 결과 필터" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "HCT 결과값" })).toHaveValue("27");
  await expect(page.getByRole("columnheader", { name: "정상범위" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "담당자" })).toBeVisible();
  await expect(page.getByText("■ 혈구 검사")).toHaveCount(0);
  await expect(page.getByRole("row", { name: /WBC 18\.2 K\/uL .*정상 송하윤/ })).toBeVisible();
  await page.getByRole("button", { name: "담당하기", exact: true }).click();
  await expect(page.getByRole("button", { name: "검사중", exact: true })).toBeVisible();
  await expect(page.getByRole("row", { name: /HCT 27 % .*30.*45.*낮음/ })).toBeVisible();
  await page.getByRole("textbox", { name: "HCT 결과값" }).fill("42");
  await expect(page.getByRole("row", { name: /HCT 42 % .*30.*45.*정상/ })).toBeVisible();
  await page.getByRole("textbox", { name: "HCT 결과값" }).fill("27122");
  await expect(page.getByRole("row", { name: /HCT 27122 % .*30.*45.*높음/ })).toBeVisible();
  await expect(page.getByText("미달")).toHaveCount(0);
  await expect(page.getByRole("columnheader", { name: "이전결과" })).toHaveCount(0);
  await expect(page.getByRole("columnheader", { name: "장비값" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "검사결과 종합소견" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "검사결과 종합소견" })).toBeVisible();
  await expect(page.getByRole("button", { name: "코멘트 저장" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "첨부자료 추가" })).toBeVisible();
  await expect(page.getByText("coco-cbc-260501.pdf")).toBeVisible();
  await expect(page.getByText("cbc-smear-preview.png")).toBeVisible();
  await expect(page.getByText("처치 지시서")).toHaveCount(0);
});

test("Cheongdam lab workspace renders live fulfillment rows without legacy result fixtures", async ({
  page,
}) => {
  await grantCheongdamWorkspaceAccess(page);

  const liveWorkItem = {
    assignedToUserId: null,
    createdAt: "2026-06-14T01:20:00.000Z",
    encounterId: "encounter-cheongdam-live-lab-001",
    id: "work-cheongdam-lab-001",
    orderId: "order-cheongdam-lab-001",
    queueType: "lab",
    requestedByUserId: "user-vet",
    sourceSnapshot: {
      detail: { breed: "푸들", age: "3세" },
      guardianName: "정보호",
      instruction: "CBC 우선 확인",
      orderDisplayName: "CBC 검사",
      patientName: "모카",
      requestingVetName: "김민준",
      serviceItemId: "svc-live-cbc",
    },
    status: "requested",
    updatedAt: "2026-06-14T01:20:00.000Z",
    workspaceId: PREPARED_EMPTY_CLINIC_WORKSPACE_ID,
  };

  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/fulfillment/work-items**`,
    async (route) => {
      const url = new URL(route.request().url());

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          enforcedBy: "fulfillment-work-item-persistence",
          workItems: url.searchParams.get("queueType") === "lab" ? [liveWorkItem] : [],
        }),
      });
    }
  );

  await page.goto(`/w/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/lab?modulePanel=open&aside=closed`);

  const sidePanel = page.locator("aside").first();
  await expect(sidePanel.getByTestId(`lab-queue-item-live-lab-${liveWorkItem.id}`)).toContainText("모카");
  await expect(sidePanel.getByTestId(`lab-queue-item-live-lab-${liveWorkItem.id}`)).toContainText("CBC 검사");
  await expect(sidePanel.getByTestId("lab-queue-item-lab-result-coco-cbc")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "임상병리검사 결과지" })).toBeVisible();
  await expect(page.getByText("모카").first()).toBeVisible();
});

test("lab workspace renders shared empty state for true-empty live result rows", async ({
  page,
}) => {
  await grantCheongdamWorkspaceAccess(page);

  const liveWorkItem = {
    assignedToUserId: null,
    createdAt: "2026-06-14T01:20:00.000Z",
    encounterId: "encounter-cheongdam-lab-empty",
    id: "work-cheongdam-lab-empty",
    orderId: "order-cheongdam-lab-empty",
    queueType: "lab",
    requestedByUserId: "user-vet",
    sourceSnapshot: {
      detail: { breed: "푸들", age: "3세" },
      guardianName: "정보호",
      instruction: "결과지 연결 대기",
      orderDisplayName: "CBC 검사",
      patientName: "모카",
      requestingVetName: "김민준",
      serviceItemId: "svc-live-empty-cbc",
    },
    status: "requested",
    updatedAt: "2026-06-14T01:20:00.000Z",
    workspaceId: PREPARED_EMPTY_CLINIC_WORKSPACE_ID,
  };
  let catalogRequestCount = 0;

  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/fulfillment/work-items**`,
    async (route) => {
      const url = new URL(route.request().url());

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          enforcedBy: "fulfillment-work-item-persistence",
          workItems: url.searchParams.get("queueType") === "lab" ? [liveWorkItem] : [],
        }),
      });
    }
  );
  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/lab-imaging/result-sheet-catalog?*`,
    async (route) => {
      catalogRequestCount += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          catalogItemId: "catalog-cheongdam-empty-cbc",
          enforcedBy: "lab-result-sheet-catalog-read",
          items: [],
        }),
      });
    }
  );

  await page.goto(
    `/w/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/lab?modulePanel=open&aside=closed&labResultId=live-lab-${liveWorkItem.id}`
  );

  await expect(page.getByRole("heading", { name: "임상병리검사 결과지" })).toBeVisible();
  await expect(page.getByText("모카").first()).toBeVisible();
  await expect(page.getByTestId("lab-result-catalog-status")).toContainText(
    "연결된 결과지 항목이 없습니다.",
  );
  await expect(page.getByTestId("lab-result-catalog-status")).not.toContainText(
    /권한|불러오지 못했습니다/,
  );
  await expect(page.getByTestId("lab-result-catalog-retry-button")).toHaveCount(0);
  expect(catalogRequestCount).toBeGreaterThan(0);

  const resultInputTable = page
    .locator('[data-slot="lab-result-scroll-area"] table')
    .filter({ has: page.getByRole("columnheader", { name: "결과값" }) });
  await expect(resultInputTable).toHaveCount(1);
  const emptyState = resultInputTable.locator('tbody section[data-surface="table"]');
  await expect(emptyState).toHaveAttribute("data-kind", "upstream-pending");
  await expect(emptyState).toContainText("검사 결과 항목이 없습니다");
  await expect(emptyState).toContainText("결과지 항목이 연결되면 입력할 수 있습니다.");
  await expect(page.getByText("표시할 검사 결과가 없습니다.")).toHaveCount(0);
  await emptyState.screenshot({
    path: ".omo/evidence/empty-state-screen-adoption/browser/t4-lab-true-empty.png",
  });
});

test("lab workspace shows equipment receipts in the right panel", async ({ page }) => {
  await page.goto("/w/clair-demo/lab?modulePanel=open&aside=closed&right=open");

  const receiptPanel = page.getByTestId("lab-receipt-panel");
  const receiptPanelToggle = page.getByRole("button", {
    name: /장비 검사 수신함 새 장비결과 1건/,
  });
  await expect(receiptPanelToggle).toBeVisible();
  await expect(receiptPanelToggle).toContainText("1");
  await expect(page.getByRole("heading", { name: "장비 검사 수신함" })).toBeVisible();
  const receiptPanelCollapse = receiptPanel.getByRole("button", { name: "장비 검사 수신함 접기" });
  await expect(receiptPanelCollapse).toHaveCSS("opacity", "0");
  await receiptPanel.hover();
  await expect(receiptPanelCollapse).toHaveCSS("opacity", "1");
  await receiptPanelCollapse.click();
  await expect(receiptPanelToggle).toHaveAttribute("aria-expanded", "false");
  await receiptPanelToggle.click();
  await expect(receiptPanelToggle).toHaveAttribute("aria-expanded", "true");
  await expect(receiptPanel.getByRole("button", { name: "26.05.01(금) 날짜 선택" })).toBeVisible();
  await expect(receiptPanel.getByRole("button", { name: "장비 검사 수신함 검색" })).toBeVisible();
  await expect(page.getByText("장비 수신값과 현재 결과지를 비교합니다.")).toHaveCount(0);
  await expect(receiptPanel.getByRole("group", { name: "장비 검사 수신함 필터" })).toHaveCount(0);
  await expect(receiptPanel.getByText("오더 1")).toHaveCount(0);
  await expect(receiptPanel.getByText("전체 3")).toHaveCount(0);
  await expect(receiptPanel.getByText("검사 결과").first()).toBeVisible();
  await expect(receiptPanel.getByText("오더 연결")).toHaveCount(0);
  await expect(receiptPanel.getByText("ProCyte Dx")).toBeVisible();
  await expect(receiptPanel.getByText("10:49 수신")).toBeVisible();
  await expect(receiptPanel.getByText("코코 · 이지은 CBC 검사")).toBeVisible();
  await expect(receiptPanel.getByRole("button", { name: /ProCyte Dx 수신결과 접기/ })).toBeVisible();
  await expect(receiptPanel.getByText("검사 항목명")).toBeVisible();
  await expect(receiptPanel.getByText("WBC")).toBeVisible();
  await expect(receiptPanel.getByText("K/uL").first()).toBeVisible();
  await expect(receiptPanel.getByRole("button", { name: "결과 붙여넣기" })).toBeVisible();
  await receiptPanel.getByRole("button", { name: /ProCyte Dx 수신결과 접기/ }).click();
  await expect(receiptPanel.getByRole("button", { name: /ProCyte Dx 수신결과 펼치기/ })).toHaveAttribute("aria-expanded", "false");
  await expect(receiptPanel.getByText("검사 항목명")).toHaveCount(0);
  await receiptPanel.getByRole("button", { name: /ProCyte Dx 수신결과 펼치기/ }).click();
  await expect(receiptPanel.getByText("검사 항목명")).toBeVisible();

  await receiptPanel.getByRole("button", { name: "결과 붙여넣기" }).click();
  await expect(page.getByRole("dialog")).toContainText("검사결과를 붙여넣을까요?");
  await expect(page.getByRole("dialog")).toContainText("이전에 입력된 수치가 있으면 장비 수신값으로 덮어씁니다.");
  await page.getByRole("button", { name: "취소" }).click();
  await expect(receiptPanel.getByText("Catalyst One")).toHaveCount(0);
});

test("lab workspace prioritizes Kong CBC result from demo query", async ({ page }) => {
  await page.goto(
    "/w/clair-demo/lab?scenario=kong-vomit&patientId=patient-kong&encounterId=encounter-kong-260501&labResultId=lab-result-kong-cbc&modulePanel=open&aside=closed"
  );

  const sidePanel = page.locator("aside").first();
  await expect(sidePanel.getByTestId("lab-queue-item-lab-result-kong-cbc")).toContainText("콩이");
  await expect(page.getByRole("heading", { name: "임상병리검사 결과지" })).toBeVisible();
  await expect(page.getByText("환자").first()).toBeVisible();
  await expect(page.getByText("콩이").first()).toBeVisible();
  await expect(page.getByRole("row", { name: /WBC 21.4 K\/uL .*6.*17.*높음/ })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "WBC 결과값" })).toHaveValue("21.4");
  await expect(page.getByText("kong-cbc-260501.pdf")).toBeVisible();
});

test("imaging workspace renders reading, impression, and attachment flow", async ({ page }) => {
  await page.goto("/w/clair-demo/imaging?modulePanel=open");

  const sidePanel = page.locator("aside").first();
  await expect(sidePanel.getByText("영상검사")).toBeVisible();
  await expect(sidePanel.getByRole("group", { name: "영상검사 목록 보기" })).toHaveCount(0);
  await expect(sidePanel.getByRole("button", { name: "26.05.01(금) 날짜 선택" })).toBeVisible();
  await expect(sidePanel.getByText("영상 대기열")).toBeVisible();
  await expect(sidePanel.getByTestId("imaging-queue-item-imaging-coco-thorax")).toContainText("흉부 방사선");
  await sidePanel.getByTestId("imaging-queue-item-imaging-coco-thorax").click();
  await expect(page).toHaveURL(/imagingStudyId=imaging-coco-thorax/);
  const cocoQueueGroupTestId = await sidePanel
    .getByTestId("imaging-queue-item-imaging-coco-thorax")
    .evaluate((element) => element.closest("[data-testid^='imaging-queue-status-']")?.getAttribute("data-testid"));

  expect(cocoQueueGroupTestId).toBeTruthy();
  if (!cocoQueueGroupTestId) {
    throw new Error("Imaging queue group test id was not found.");
  }
  const cocoQueueGroup = sidePanel.getByTestId(cocoQueueGroupTestId);
  const cocoQueueGroupToggle = cocoQueueGroup.getByRole("button", { name: /접기/ }).first();
  await expect(cocoQueueGroupToggle).toHaveAttribute("aria-expanded", "true");
  await cocoQueueGroupToggle.click();
  const collapsedCocoQueueGroupToggle = cocoQueueGroup.getByRole("button", { name: /펼치기/ }).first();
  await expect(collapsedCocoQueueGroupToggle).toHaveAttribute("aria-expanded", "false");
  await expect(cocoQueueGroup.getByTestId("imaging-queue-item-imaging-coco-thorax")).toHaveCount(0);
  await collapsedCocoQueueGroupToggle.click();
  await expect(cocoQueueGroup.getByTestId("imaging-queue-item-imaging-coco-thorax")).toBeVisible();
  await expect(sidePanel.getByText("차트별 영상")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "영상검사 이력 패널 접기" })).toBeVisible();
  await page.getByRole("button", { name: "영상검사 이력 패널 접기" }).hover();
  await expect(page.locator("[data-slot='tooltip-content']").filter({ hasText: "영상검사 이력" })).toBeVisible();
  await expect(page.getByTestId("imaging-history-item-imaging-coco-thorax")).toBeVisible();
  await expect(page.getByRole("heading", { name: "영상검사 Order 상세" })).toBeVisible();
  await expect(page.getByText("흉부 방사선").first()).toBeVisible();
  await expect(page.getByTestId("imaging-study-status-label")).toHaveText("판독중");
  await expect(page.getByRole("button", { name: "Order 상세정보 접기" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "스터디 판독의견" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "영상 판독 내용" })).toContainText("복부 가스 음영 증가");
  await expect(page.getByRole("textbox", { name: "영상 종합소견" })).toContainText("위장관염 가능성");
  await expect(page.getByRole("textbox", { name: "Imaging Dx" })).toBeVisible();
  const completedStatusButton = page.getByRole("button", { name: "판독완료", exact: true });
  if ((await completedStatusButton.count()) === 0) {
    const startReadingButton = page.getByRole("button", { name: "담당하기", exact: true });
    if ((await startReadingButton.count()) > 0) {
      await startReadingButton.click();
    }
    await expect(page.getByRole("button", { name: "판독중", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "판독 상태 액션" }).click();
    await page.getByRole("menuitem", { name: "판독완료" }).click();
  }
  await expect(completedStatusButton).toBeVisible();
  const summaryPanel = page.getByTestId("imaging-summary-panel");
  await expect(summaryPanel.getByText("coco-thorax-lateral.png")).toBeVisible();
  await expect(summaryPanel.getByRole("heading", { name: "종합소견" })).toBeVisible();
  await expect(summaryPanel.getByRole("heading", { name: "같은 차트 내 Order" })).toBeVisible();
  await expect(summaryPanel.getByRole("textbox", { name: "영상 종합 코멘트" })).toBeVisible();
  await expect(summaryPanel.getByText("coco-thorax-lateral.png")).toBeVisible();
  await expect(page.getByText("처치 지시서")).toHaveCount(0);
});

test("imaging history aside keeps title count separate from evenly spaced actions", async ({
  page,
}) => {
  await page.goto(
    "/w/clair-demo/imaging?modulePanel=open&aside=history&right=closed",
  );

  const contentAside = page.locator("#imaging-content-aside");
  const title = contentAside.getByText("영상검사 이력", { exact: true }).first();
  const collapseButton = contentAside.getByRole("button", {
    name: "영상검사 이력 목록 접기",
  });
  const actionLabels = ["영상검사 이력 목록 접기", "정렬", "필터", "검색"];
  const actionMetrics = await contentAside.evaluate((root, labels) => {
    return labels.map((label) => {
      const button = root.querySelector(
        `button[aria-label="${label}"]`,
      ) as HTMLButtonElement | null;

      if (!button) return null;

      const rect = button.getBoundingClientRect();

      return {
        label,
        left: Math.round(rect.left),
        right: Math.round(rect.right),
      };
    });
  }, actionLabels);
  const titleBox = await title.boundingBox();
  const collapseBox = await collapseButton.boundingBox();

  expect(actionMetrics.every(Boolean)).toBe(true);
  expect(actionMetrics.map((metric) => metric?.label)).toEqual(actionLabels);
  expect(titleBox).not.toBeNull();
  expect(collapseBox).not.toBeNull();
  if (!titleBox || !collapseBox) {
    throw new Error("Imaging aside title or collapse button bounds were not available.");
  }
  expect(titleBox.x + titleBox.width).toBeLessThan(collapseBox.x);

  const resolvedActionMetrics = actionMetrics.filter((metric) => metric !== null);

  const actionGaps: number[] = [];
  for (let index = 1; index < resolvedActionMetrics.length; index += 1) {
    const currentMetric = resolvedActionMetrics[index];
    const previousMetric = resolvedActionMetrics[index - 1];

    if (!currentMetric || !previousMetric) {
      throw new Error("Imaging aside action bounds were not available.");
    }

    actionGaps.push(currentMetric.left - previousMetric.right);
  }

  expect(actionGaps[0]).toBeGreaterThan(0);
  for (const gap of actionGaps) {
    expect(Math.abs(gap - actionGaps[0])).toBeLessThanOrEqual(1);
  }
});

test("Cheongdam imaging workspace renders live fulfillment rows without legacy study fixtures", async ({
  page,
}) => {
  await grantCheongdamWorkspaceAccess(page);

  const liveWorkItem = {
    assignedToUserId: null,
    createdAt: "2026-06-14T01:25:00.000Z",
    encounterId: "encounter-cheongdam-live-imaging-001",
    id: "work-cheongdam-imaging-001",
    orderId: "order-cheongdam-imaging-001",
    queueType: "imaging",
    requestedByUserId: "user-vet",
    sourceSnapshot: {
      detail: { bodyPart: "복부", modality: "초음파" },
      guardianName: "한보호",
      instruction: "복부 통증 평가",
      orderDisplayName: "복부 초음파",
      patientName: "하늘",
      requestingVetName: "김민준",
      serviceItemId: "svc-live-us",
    },
    status: "requested",
    updatedAt: "2026-06-14T01:25:00.000Z",
    workspaceId: PREPARED_EMPTY_CLINIC_WORKSPACE_ID,
  };

  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/fulfillment/work-items**`,
    async (route) => {
      const url = new URL(route.request().url());

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          enforcedBy: "fulfillment-work-item-persistence",
          workItems: url.searchParams.get("queueType") === "imaging" ? [liveWorkItem] : [],
        }),
      });
    }
  );

  await page.goto(`/w/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/imaging?modulePanel=open&aside=closed`);

  const sidePanel = page.locator("aside").first();
  await expect(sidePanel.getByTestId(`imaging-queue-item-live-imaging-${liveWorkItem.id}`)).toContainText("하늘");
  await expect(sidePanel.getByTestId(`imaging-queue-item-live-imaging-${liveWorkItem.id}`)).toContainText("복부 초음파");
  await expect(sidePanel.getByTestId("imaging-queue-item-imaging-coco-thorax")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "영상검사 Order 상세" })).toBeVisible();
  await expect(page.getByText("하늘").first()).toBeVisible();
});

test("imaging workspace prioritizes Kong abdomen study from demo query", async ({ page }) => {
  await page.goto(
    "/w/clair-demo/imaging?scenario=kong-vomit&patientId=patient-kong&encounterId=encounter-kong-260501&imagingStudyId=imaging-kong-abdomen&modulePanel=open&aside=closed&right=open"
  );

  const sidePanel = page.locator("aside").first();
  await expect(sidePanel.getByTestId("imaging-queue-item-imaging-kong-abdomen")).toContainText("콩이");
  await expect(page.getByRole("heading", { name: "영상검사 Order 상세" })).toBeVisible();
  await expect(page.getByText("환자").first()).toBeVisible();
  await expect(page.getByText("콩이").first()).toBeVisible();
  await expect(page.getByRole("textbox", { name: "영상 판독 내용" })).toContainText(
    "위 내 소량 액체 저류. 장관 확장이나 명확한 이물 음영은 보이지 않음."
  );
  await expect(page.getByRole("textbox", { name: "영상 종합소견" })).toContainText(
    "급성 위장관염 가능성이 높으며, CBC 결과와 임상 증상 추적 권장."
  );
  await expect(page.getByTestId("imaging-summary-panel")).toContainText("CBC 검사");
  await expect(page.getByTestId("imaging-summary-panel")).toContainText("복부 초음파");
  await expect(page.getByTestId("imaging-summary-panel").getByText("kong-abdomen-ultrasound.png")).toBeVisible();
});
