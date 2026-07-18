import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const storageKey = "clair.mockAuth.session.v1";

type MockRole =
  | "front_desk"
  | "vet"
  | "nurse"
  | "billing_admin"
  | "hospital_admin";

const roleLabels: Record<MockRole, string> = {
  billing_admin: "수납 관리자",
  front_desk: "프론트 데스크",
  hospital_admin: "병원 관리자",
  nurse: "간호사",
  vet: "수의사",
};
const cheongdamWorkspaceId = "workspace-clair-cheongdam";

async function useMockRole(page: Page, role: MockRole) {
  await page.addInitScript(
    ({ key, session }) => {
      window.localStorage.setItem(key, JSON.stringify(session));
    },
    {
      key: storageKey,
      session: {
        id: `home-test-${role}`,
        role,
        roleLabel: roleLabels[role],
        storageMode: "local",
        issuedAt: "2026-05-09T00:00:00.000Z",
      },
    }
  );
}

async function mockCheongdamHomeOperations(
  page: Page,
  body: Record<string, unknown>,
  status = 200,
) {
  await page.route(
    `**/api/workspaces/${cheongdamWorkspaceId}/operations/work-items?**`,
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        json: body,
        status,
      });
    },
  );
}

test("home renders one unified desktop work-status workspace", async ({ page }) => {
  await useMockRole(page, "vet");
  await page.goto("/w/clair-demo/home");

  await expect(page.getByTestId("home-next-action-side-panel")).toBeVisible();
  await expect(page.getByRole("heading", { name: "원내 현황" })).toBeVisible();
  await expect(page.getByTestId("home-kanban-board")).toBeVisible();
  await expect(page.getByRole("heading", { name: "업무 현황" })).toBeVisible();
  await expect(page.getByText("접수부터 수납까지 전체 업무 흐름을 봅니다.")).toHaveCount(0);
  await expect(page.getByText("대기실/지연 대응")).toHaveCount(0);

  const operationModeFilter = page.getByRole("group", { name: "업무 현황 운영 모드" });

  await expect(operationModeFilter.getByRole("button", { name: "전체 흐름 17" })).toHaveAttribute("aria-pressed", "true");
  await expect(operationModeFilter.getByRole("button", { name: "내 업무 보기 4" })).toBeVisible();
  await expect(operationModeFilter.getByRole("button", { name: "배정 누락 0" })).toBeVisible();
  await expect(operationModeFilter.getByRole("button", { name: "긴급/재요청 5" })).toBeVisible();
  await expect(page.getByLabel("담당자 필터")).toBeVisible();
  await expect(page.getByLabel("업무 필터")).toBeVisible();
  await expect(page.getByLabel("업무 상태 필터")).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /완료 포함/ })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /취소 포함/ })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /오래 머문 업무만 보기/ })).toBeVisible();

  await expect(page.getByRole("tablist", { name: "홈 보기" })).toHaveCount(0);
  await expect(page.getByTestId("home-dashboard")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "오늘 업무 아웃라인" })).toHaveCount(0);
});

test("home side panel uses the shared shell module panel behavior", async ({ page }) => {
  await useMockRole(page, "front_desk");
  await page.goto("/w/clair-demo/home?modulePanel=open");

  const modulePanelArea = page.getByTestId("module-panel-area");
  const sidePanel = page.getByTestId("home-next-action-side-panel");
  const workspace = page.getByTestId("workspace-frame");
  const collapseButton = page.getByRole("button", { name: "원내 현황 패널 접기" });

  await expect(sidePanel).toBeVisible();
  await expect(modulePanelArea).toContainText("원내 현황");
  await sidePanel.getByRole("heading", { name: "원내 현황" }).hover();
  await expect(collapseButton).toBeVisible();

  const sidePanelBox = await sidePanel.boundingBox();
  const workspaceBox = await workspace.boundingBox();

  expect(sidePanelBox).not.toBeNull();
  expect(workspaceBox).not.toBeNull();
  expect(workspaceBox!.x - (sidePanelBox!.x + sidePanelBox!.width)).toBeGreaterThanOrEqual(8);

  await collapseButton.click();
  await expect(sidePanel).toHaveCount(0);
});

test("home unified board renders workstream columns and status groups", async ({ page }) => {
  await useMockRole(page, "vet");
  await page.goto("/w/clair-demo/home");

  await expect(page.getByTestId("home-kanban-column-waiting").getByRole("heading", { name: "대기" })).toBeVisible();
  await expect(page.getByTestId("home-kanban-column-reservation").getByRole("heading", { name: "예약" })).toBeVisible();
  await expect(page.getByTestId("home-kanban-column-chart").getByRole("heading", { name: "진료" })).toBeVisible();
  await expect(page.getByTestId("home-kanban-column-lab").getByRole("heading", { name: "임상병리검사" })).toBeVisible();
  await expect(page.getByText("콩이 CBC 결과 확인").first()).toBeVisible();
  await expect(page.getByTestId("home-kanban-status-waiting-waiting")).toContainText("대기");
});

test("home opens selected work in a non-modal right detail panel", async ({ page }) => {
  await useMockRole(page, "vet");
  await page.goto("/w/clair-demo/home");

  await expect(page.getByTestId("home-work-status-detail")).toHaveCount(0);
  await page.getByTestId("home-kanban-task-vet-kong-lab-review").click();

  const detail = page.getByTestId("home-work-status-detail");

  await expect(detail).toBeVisible();
  await expect(detail.getByRole("heading", { name: "선택한 업무" })).toBeVisible();
  await expect(detail.getByRole("heading", { name: "콩이 CBC 결과 확인" })).toBeVisible();
  await expect(detail.getByText("업무 원본 화면으로 이동하기 전 확인할 실행 맥락입니다.")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("home-kanban-board")).toBeVisible();

  await page.getByTestId("home-kanban-task-vet-tori-consult").click();
  await expect(detail.getByRole("heading", { name: "토리 진료 대기" })).toBeVisible();

  await detail.getByRole("button", { name: "선택한 업무 닫기" }).click();
  await expect(detail).toHaveCount(0);
});

test("home filters kanban work by assignee, workstream, and work status", async ({ page }) => {
  await useMockRole(page, "vet");
  await page.goto("/w/clair-demo/home");

  await page.getByLabel("담당자 필터").click();
  await page.getByRole("option", { name: "미지정" }).click();

  await expect(page.getByTestId("home-kanban-task-vet-kong-lab-review")).toHaveCount(0);
  await expect(page.getByTestId("home-kanban-task-hospital-reservation-nana")).toBeVisible();

  await page.getByLabel("업무 필터").click();
  await page.getByTestId("home-workstream-filter-menu").getByRole("checkbox", { name: "수납 업무 선택" }).click();

  await expect(page.getByTestId("home-kanban-column-billing")).toBeVisible();
  await expect(page.getByTestId("home-kanban-column-waiting")).toHaveCount(0);
  await expect(page.getByTestId("home-kanban-task-billing-coco-payment")).toBeVisible();
  await expect(page.getByTestId("home-kanban-task-hospital-billing-unpaid")).toBeVisible();

  await page.keyboard.press("Escape");
  await page.getByLabel("업무 상태 필터").click();
  await page.getByRole("option", { name: "오래 머묾" }).click();

  await expect(page.getByTestId("home-kanban-task-hospital-billing-unpaid")).toBeVisible();
  await expect(page.getByTestId("home-kanban-task-billing-coco-payment")).toHaveCount(0);
});

test("operation mode filters move populated workstreams before empty columns", async ({ page }) => {
  await useMockRole(page, "vet");
  await page.goto("/w/clair-demo/home");

  const columnOrder = async () =>
    page.getByTestId(/^home-kanban-column-/).evaluateAll((columns) =>
      columns.map((column) => column.getAttribute("data-testid"))
    );

  await expect.poll(columnOrder).toEqual([
    "home-kanban-column-waiting",
    "home-kanban-column-reservation",
    "home-kanban-column-chart",
    "home-kanban-column-lab",
    "home-kanban-column-imaging",
    "home-kanban-column-dispensing",
    "home-kanban-column-treatment",
    "home-kanban-column-billing",
  ]);

  await page.getByRole("group", { name: "업무 현황 운영 모드" }).getByRole("button", { name: "긴급/재요청 5" }).click();

  await expect.poll(columnOrder).toEqual([
    "home-kanban-column-waiting",
    "home-kanban-column-chart",
    "home-kanban-column-treatment",
    "home-kanban-column-billing",
    "home-kanban-column-reservation",
    "home-kanban-column-lab",
    "home-kanban-column-imaging",
    "home-kanban-column-dispensing",
  ]);
});

test("home lets users reorder workstream columns without changing source work", async ({ page }) => {
  await useMockRole(page, "vet");
  await page.goto("/w/clair-demo/home");

  const columnOrder = async () =>
    page.getByTestId(/^home-kanban-column-/).evaluateAll((columns) =>
      columns.map((column) => column.getAttribute("data-testid"))
  );

  await expect(page.locator("number-flow-react")).toHaveCount(3);
  const reorderHandle = page.getByLabel("예약 열 순서 변경");

  await reorderHandle.focus();
  await page.keyboard.press("ArrowRight");

  await expect.poll(columnOrder).toEqual([
    "home-kanban-column-waiting",
    "home-kanban-column-chart",
    "home-kanban-column-reservation",
    "home-kanban-column-lab",
    "home-kanban-column-imaging",
    "home-kanban-column-dispensing",
    "home-kanban-column-treatment",
    "home-kanban-column-billing",
  ]);
  const movedHandle = page.getByLabel("예약 열 순서 변경");
  const waitingHandle = page.getByLabel("대기 열 순서 변경");
  const movedBox = await movedHandle.boundingBox();
  const waitingBox = await waitingHandle.boundingBox();

  expect(movedBox).not.toBeNull();
  expect(waitingBox).not.toBeNull();
  await page.mouse.move(movedBox!.x + movedBox!.width / 2, movedBox!.y + movedBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(movedBox!.x + movedBox!.width / 2 + 12, movedBox!.y + movedBox!.height / 2);
  await page.mouse.move(waitingBox!.x + waitingBox!.width / 2, waitingBox!.y + waitingBox!.height / 2, { steps: 12 });
  await page.mouse.up();

  await expect.poll(columnOrder).toEqual([
    "home-kanban-column-reservation",
    "home-kanban-column-waiting",
    "home-kanban-column-chart",
    "home-kanban-column-lab",
    "home-kanban-column-imaging",
    "home-kanban-column-dispensing",
    "home-kanban-column-treatment",
    "home-kanban-column-billing",
  ]);
  await expect(page.getByTestId("home-kanban-task-hospital-reservation-nana")).toBeVisible();
});

test("top workstream filter supports checkbox multi-select", async ({ page }) => {
  await useMockRole(page, "vet");
  await page.goto("/w/clair-demo/home");

  await page.getByLabel("업무 필터").click();
  await page.getByTestId("home-workstream-filter-menu").getByRole("checkbox", { name: "수납 업무 선택" }).click();

  await expect(page.getByLabel("업무 필터")).toHaveText("수납");
  await expect(page.getByTestId("home-kanban-column-billing")).toBeVisible();
  await expect(page.getByTestId("home-kanban-column-waiting")).toHaveCount(0);

  await page.getByTestId("home-workstream-filter-menu").getByRole("checkbox", { name: "대기 업무 선택" }).click();

  await expect(page.getByLabel("업무 필터")).toHaveText("2개 선택");
  await expect(page.getByTestId("home-kanban-column-waiting")).toBeVisible();
  await expect(page.getByTestId("home-kanban-column-billing")).toBeVisible();
  await expect(page.getByTestId("home-kanban-column-reservation")).toHaveCount(0);

  await page.getByTestId("home-workstream-filter-menu").getByRole("checkbox", { name: "전체 업무 선택" }).click();

  await expect(page.getByLabel("업무 필터")).toHaveText("전체");
  await expect(page.getByTestId("home-kanban-column-waiting")).toBeVisible();
});

test("legacy sales demo launcher view query no longer opens the old launcher", async ({ page }) => {
  await page.goto("/w/clair-demo/home?view=demo&modulePanel=open&aside=closed");

  await expect(page.getByTestId("home-kanban-board")).toBeVisible();
  await expect(page.getByRole("heading", { name: "콩이 구토 내원" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "데모 시작" })).toHaveCount(0);
});

test("desk role lands on the same unified work-status workspace", async ({ page }) => {
  await useMockRole(page, "front_desk");
  await page.goto("/w/clair-demo/home");

  await expect(page.getByTestId("home-next-action-side-panel")).toBeVisible();
  await expect(page.getByTestId("home-kanban-board")).toBeVisible();
  await expect(page.getByText("콩이 CBC 결과 확인").first()).toBeVisible();
  await expect(page.getByLabel("담당자 필터")).toBeVisible();
  await expect(page.getByLabel("업무 필터")).toBeVisible();
});

test("home panels fill the desktop content height together", async ({ page }) => {
  await page.setViewportSize({ width: 1555, height: 1100 });
  await useMockRole(page, "front_desk");
  await page.goto("/w/clair-demo/home");

  const workspace = page.getByTestId("home-kanban-workspace");
  const sidePanel = page.getByTestId("home-next-action-side-panel");
  const board = page.getByTestId("home-kanban-board");

  await expect(workspace).toBeVisible();
  await expect(sidePanel).toBeVisible();
  await expect(board).toBeVisible();

  const sidePanelBox = await sidePanel.boundingBox();
  const boardBox = await board.boundingBox();

  expect(sidePanelBox).not.toBeNull();
  expect(boardBox).not.toBeNull();
  expect(Math.abs(sidePanelBox!.y - boardBox!.y)).toBeLessThanOrEqual(1);
  expect(boardBox!.x - (sidePanelBox!.x + sidePanelBox!.width)).toBeGreaterThanOrEqual(8);
  expect(boardBox!.height).toBeGreaterThan(980);
});

test("home empty work-status state is centered in the content surface", async ({ page }) => {
  await page.setViewportSize({ width: 1555, height: 1000 });
  await useMockRole(page, "front_desk");
  await mockCheongdamHomeOperations(page, {
    ok: true,
    workspaceId: cheongdamWorkspaceId,
    operatingDate: "2026-07-05",
    sourceStatus: "empty",
    items: [],
    summary: {
      totalVisible: 0,
      mineCount: 0,
      bySourceType: {},
      byProgressState: {},
      byAttentionSignal: {},
      byAssignmentState: {
        personal: 0,
        teamQueue: 0,
        assignmentMissing: 0,
      },
      completedCount: 0,
      cancelledCount: 0,
    },
    generatedAt: "2026-07-05T09:00:00+09:00",
  });
  await page.goto(
    `/w/${cheongdamWorkspaceId}/home?encounterId=78703ebf-8f10-415d-9520-8deafcb55657&modulePanel=open`
  );

  const emptySurface = page.getByTestId("home-kanban-empty-state-surface");
  const emptyState = page.getByTestId("home-kanban-empty-state");

  await expect(emptySurface).toBeVisible();
  await expect(emptyState.getByRole("heading", { name: "원내 업무가 없습니다" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "업무 현황" })).toHaveCount(0);
  await expect(page.getByRole("group", { name: "업무 현황 운영 모드" })).toHaveCount(0);
  await expect(page.getByLabel("담당자 필터")).toHaveCount(0);
  await expect(page.getByLabel("업무 필터")).toHaveCount(0);
  await expect(page.getByLabel("업무 상태 필터")).toHaveCount(0);
  await expect(page.getByRole("checkbox", { name: /오래 머문 업무만 보기/ })).toHaveCount(0);

  const surfaceBox = await emptySurface.boundingBox();
  const emptyBox = await emptyState.boundingBox();

  expect(surfaceBox).not.toBeNull();
  expect(emptyBox).not.toBeNull();
  expect(emptyBox!.width).toBeLessThan(surfaceBox!.width / 2);

  const surfaceCenterX = surfaceBox!.x + surfaceBox!.width / 2;
  const surfaceCenterY = surfaceBox!.y + surfaceBox!.height / 2;
  const emptyCenterX = emptyBox!.x + emptyBox!.width / 2;
  const emptyCenterY = emptyBox!.y + emptyBox!.height / 2;

  expect(Math.abs(emptyCenterX - surfaceCenterX)).toBeLessThanOrEqual(4);
  expect(Math.abs(emptyCenterY - surfaceCenterY)).toBeLessThanOrEqual(6);

  const sidePanelEmptySurface = page.getByTestId("home-side-panel-empty-state-surface");
  const sidePanelEmptyState = page.getByTestId("home-side-panel-empty-state");

  await expect(sidePanelEmptySurface).toBeVisible();
  await expect(sidePanelEmptyState).toContainText("원내 업무가 없습니다");

  const sidePanelSurfaceBox = await sidePanelEmptySurface.boundingBox();
  const sidePanelEmptyBox = await sidePanelEmptyState.boundingBox();

  expect(sidePanelSurfaceBox).not.toBeNull();
  expect(sidePanelEmptyBox).not.toBeNull();

  const sidePanelSurfaceCenterX = sidePanelSurfaceBox!.x + sidePanelSurfaceBox!.width / 2;
  const sidePanelSurfaceCenterY = sidePanelSurfaceBox!.y + sidePanelSurfaceBox!.height / 2;
  const sidePanelEmptyCenterX = sidePanelEmptyBox!.x + sidePanelEmptyBox!.width / 2;
  const sidePanelEmptyCenterY = sidePanelEmptyBox!.y + sidePanelEmptyBox!.height / 2;

  expect(Math.abs(sidePanelEmptyCenterX - sidePanelSurfaceCenterX)).toBeLessThanOrEqual(4);
  expect(Math.abs(sidePanelEmptyCenterY - sidePanelSurfaceCenterY)).toBeLessThanOrEqual(6);
});

test("home live operations cards match source queue card fields", async ({ page }) => {
  await useMockRole(page, "front_desk");
  await mockCheongdamHomeOperations(page, {
    ok: true,
    workspaceId: cheongdamWorkspaceId,
    operatingDate: "2026-07-05",
    sourceStatus: "live",
    items: [
      {
        id: "appointment:appointment-live-001",
        workspaceId: cheongdamWorkspaceId,
        sourceType: "appointment",
        sourceId: "appointment-live-001",
        sourceStatus: "confirmed",
        patientName: "나나",
        guardianName: "이하린",
        title: "나나 예약 확인",
        progressState: "waiting",
        receptionType: "예약",
        queueCardEventText: "10:00 예약",
        queueCardSecondLineBadgeLabel: "대기",
        queueCardSecondLineText: "예방접종",
        attentionSignals: ["team_queue"],
        requestedAt: "2026-07-05T10:00:00+09:00",
        operatingDate: "2026-07-05",
        sourceHref: `/w/${cheongdamWorkspaceId}/reception?appointmentId=appointment-live-001&modulePanel=open`,
        drawerSummary: "예약 접수 상태를 확인합니다.",
        permissionMode: "full",
        teamQueueId: "reception",
        teamQueueLabel: "접수팀 큐",
      },
      {
        id: "consultation:encounter-live-001",
        workspaceId: cheongdamWorkspaceId,
        sourceType: "consultation",
        sourceId: "encounter-live-001",
        sourceStatus: "waiting",
        encounterId: "encounter-live-001",
        patientName: "구름",
        guardianName: "문지아",
        title: "구름 진료 대기",
        progressState: "waiting",
        receptionType: "외래",
        queueCardEventText: "11:11 접수",
        queueCardSecondLineBadgeLabel: "방문목적",
        queueCardSecondLineText: "피부 상담",
        attentionSignals: ["team_queue"],
        requestedAt: "2026-07-05T11:11:00+09:00",
        operatingDate: "2026-07-05",
        sourceHref: `/w/${cheongdamWorkspaceId}/treatment?encounterId=encounter-live-001&modulePanel=open`,
        drawerSummary: "카드에는 이 문구가 직접 보이면 안 됨",
        permissionMode: "full",
        teamQueueId: "consultation",
        teamQueueLabel: "진료 큐",
      },
      {
        id: "lab:fulfill-live-lab-001",
        workspaceId: cheongdamWorkspaceId,
        sourceType: "lab",
        sourceId: "fulfill-live-lab-001",
        sourceStatus: "requested",
        encounterId: "encounter-live-001",
        patientName: "구름",
        guardianName: "문지아",
        title: "CBC 검사",
        progressState: "waiting",
        receptionType: "외래",
        queueCardSecondLineBadgeLabel: "CBC 검사",
        queueCardSecondLineText: "CBC 검사",
        attentionSignals: ["team_queue"],
        requestedAt: "2026-07-05T11:13:00+09:00",
        operatingDate: "2026-07-05",
        sourceHref: `/w/${cheongdamWorkspaceId}/lab?encounterId=encounter-live-001&modulePanel=open`,
        drawerSummary: "오더 기반 업무 상태를 확인합니다.",
        permissionMode: "full",
        teamQueueId: "lab",
        teamQueueLabel: "임상병리팀 큐",
      },
      {
        id: "imaging:fulfill-live-imaging-001",
        workspaceId: cheongdamWorkspaceId,
        sourceType: "imaging",
        sourceId: "fulfill-live-imaging-001",
        sourceStatus: "requested",
        encounterId: "encounter-live-001",
        patientName: "구름",
        guardianName: "문지아",
        title: "복부 초음파",
        progressState: "waiting",
        receptionType: "외래",
        queueCardSecondLineBadgeLabel: "초음파",
        queueCardSecondLineText: "복부 초음파",
        attentionSignals: ["team_queue"],
        requestedAt: "2026-07-05T11:14:00+09:00",
        operatingDate: "2026-07-05",
        sourceHref: `/w/${cheongdamWorkspaceId}/imaging?encounterId=encounter-live-001&modulePanel=open`,
        drawerSummary: "오더 기반 업무 상태를 확인합니다.",
        permissionMode: "full",
        teamQueueId: "imaging",
        teamQueueLabel: "영상팀 큐",
      },
      {
        id: "dispensing:fulfill-live-dispensing-001",
        workspaceId: cheongdamWorkspaceId,
        sourceType: "dispensing",
        sourceId: "fulfill-live-dispensing-001",
        sourceStatus: "requested",
        encounterId: "encounter-live-001",
        patientName: "구름",
        guardianName: "문지아",
        title: "Maropitant 16mg T",
        progressState: "waiting",
        receptionType: "외래",
        queueCardSecondLineBadgeLabel: "조제",
        queueCardSecondLineText: "Maropitant 16mg T",
        attentionSignals: ["team_queue"],
        requestedAt: "2026-07-05T11:15:00+09:00",
        operatingDate: "2026-07-05",
        sourceHref: `/w/${cheongdamWorkspaceId}/dispensing?encounterId=encounter-live-001&modulePanel=open`,
        drawerSummary: "오더 기반 업무 상태를 확인합니다.",
        permissionMode: "full",
        teamQueueId: "dispensing",
        teamQueueLabel: "조제팀 큐",
      },
      {
        id: "treatment:fulfill-live-treatment-001",
        workspaceId: cheongdamWorkspaceId,
        sourceType: "treatment",
        sourceId: "fulfill-live-treatment-001",
        sourceStatus: "requested",
        encounterId: "encounter-live-001",
        patientName: "구름",
        guardianName: "문지아",
        title: "피하 수액 처치",
        progressState: "waiting",
        receptionType: "외래",
        queueCardSecondLineBadgeLabel: "처치",
        queueCardSecondLineText: "피하 수액 처치",
        attentionSignals: ["team_queue"],
        requestedAt: "2026-07-05T11:16:00+09:00",
        operatingDate: "2026-07-05",
        sourceHref: `/w/${cheongdamWorkspaceId}/dispensing?encounterId=encounter-live-001&modulePanel=open`,
        drawerSummary: "오더 기반 업무 상태를 확인합니다.",
        permissionMode: "full",
        teamQueueId: "treatment",
        teamQueueLabel: "처치팀 큐",
      },
      {
        id: "billing:invoice-live-001",
        workspaceId: cheongdamWorkspaceId,
        sourceType: "billing",
        sourceId: "invoice-live-001",
        sourceStatus: "draft:unpaid",
        encounterId: "encounter-live-001",
        patientName: "구름",
        guardianName: "문지아",
        title: "INV-001 수납 요청",
        progressState: "waiting",
        receptionType: "외래",
        queueCardSecondLineText: "오더 2건 · 24,000원",
        attentionSignals: ["team_queue"],
        requestedAt: "2026-07-05T11:12:00+09:00",
        operatingDate: "2026-07-05",
        sourceHref: `/w/${cheongdamWorkspaceId}/billing?encounterId=encounter-live-001&modulePanel=open`,
        drawerSummary: "청구 후보 또는 수납 진행 상태를 확인합니다.",
        permissionMode: "full",
        requesterName: "수납",
        teamQueueId: "billing",
        teamQueueLabel: "수납팀 큐",
      },
    ],
    summary: {
      totalVisible: 7,
      mineCount: 0,
      bySourceType: {},
      byProgressState: {},
      byAttentionSignal: {},
      byAssignmentState: {
        personal: 0,
        teamQueue: 1,
        assignmentMissing: 0,
      },
      completedCount: 0,
      cancelledCount: 0,
    },
    generatedAt: "2026-07-05T11:20:00+09:00",
  });

  await page.goto(`/w/${cheongdamWorkspaceId}/home?modulePanel=open`);

  const appointmentCard = page.getByTestId("home-kanban-task-appointment:appointment-live-001");
  await expect(appointmentCard).toContainText("예약");
  await expect(appointmentCard).toContainText("나나");
  await expect(appointmentCard).toContainText("예방접종");
  await expect(appointmentCard).toContainText("10:00 예약");

  const card = page.getByTestId("home-kanban-task-consultation:encounter-live-001");

  await expect(card).toContainText("외래");
  await expect(card).toContainText("구름");
  await expect(card).toContainText("문지아");
  await expect(card).toContainText("방문목적");
  await expect(card).toContainText("피부 상담");
  await expect(card).toContainText("11:11 접수");
  await expect(card).toContainText("미지정");
  await expect(card).not.toContainText("나");
  await expect(card).not.toContainText("카드에는 이 문구");

  const labCard = page.getByTestId("home-kanban-task-lab:fulfill-live-lab-001");
  await expect(labCard).toContainText("CBC 검사");
  await expect(labCard).toContainText("구름");

  const imagingCard = page.getByTestId("home-kanban-task-imaging:fulfill-live-imaging-001");
  await expect(imagingCard).toContainText("초음파");
  await expect(imagingCard).toContainText("복부 초음파");

  const dispensingCard = page.getByTestId("home-kanban-task-dispensing:fulfill-live-dispensing-001");
  await expect(dispensingCard).toContainText("조제");
  await expect(dispensingCard).toContainText("Maropitant 16mg T");

  const treatmentCard = page.getByTestId("home-kanban-task-treatment:fulfill-live-treatment-001");
  await expect(treatmentCard).toContainText("처치");
  await expect(treatmentCard).toContainText("피하 수액 처치");

  const billingCard = page.getByTestId("home-kanban-task-billing:invoice-live-001");

  await expect(billingCard).toContainText("외래");
  await expect(billingCard).toContainText("구름");
  await expect(billingCard).toContainText("문지아");
  await expect(billingCard).toContainText("오더 2건 · 24,000원");
  await expect(billingCard).toContainText("11:12 수납 요청");
  await expect(billingCard).not.toContainText("나");
});

test("home operations read failure does not render as no work", async ({ page }) => {
  await useMockRole(page, "front_desk");
  await mockCheongdamHomeOperations(
    page,
    {
      ok: false,
      workspaceId: cheongdamWorkspaceId,
      operatingDate: "2026-07-05",
      sourceStatus: "error",
      error: {
        code: "db_read_failed",
        message: "원내 현황 데이터를 불러오지 못했습니다.",
        retryable: true,
      },
    },
    500,
  );

  await page.goto(`/w/${cheongdamWorkspaceId}/home?modulePanel=open`);

  await expect(page.getByTestId("home-kanban-error-state")).toContainText("원내 현황을 불러오지 못했습니다");
  await expect(page.getByTestId("home-side-panel-error-state")).toContainText("데이터 연결 실패");
  await expect(page.getByTestId("home-kanban-empty-state")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "업무 현황" })).toHaveCount(0);
});

const roleCases: Array<{
  role: MockRole;
  expectedTask: string;
}> = [
  { role: "vet", expectedTask: "콩이 CBC 결과 확인" },
  { role: "nurse", expectedTask: "코코 수액 처치 확인" },
  { role: "billing_admin", expectedTask: "코코 수납 요청 확인" },
  { role: "hospital_admin", expectedTask: "토리 진료 순서 확인" },
];

for (const { role, expectedTask } of roleCases) {
  test(`home maps ${role} to the matching next-action preset`, async ({ page }) => {
    await useMockRole(page, role);
    await page.goto("/w/clair-demo/home");

    await expect(page.getByTestId("home-next-action-side-panel").getByText(expectedTask).first()).toBeVisible();
  });
}

test("role queue work is visible as unassigned without claim actions", async ({ page }) => {
  await useMockRole(page, "nurse");
  await page.goto("/w/clair-demo/home");

  await expect(page.getByText("망고 혈액 샘플 채취").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "담당하기" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "완료 처리" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "수납 완료" })).toHaveCount(0);
});

test("home kanban task actions reuse the side-panel hover action pattern", async ({ page }) => {
  await useMockRole(page, "vet");
  await page.goto("/w/clair-demo/home");

  const task = page.getByTestId("home-kanban-task-vet-kong-lab-review");
  const action = page.getByTestId("home-kanban-task-action-vet-kong-lab-review");
  const column = page.getByTestId("home-kanban-column-chart");

  await expect(page.getByTestId("home-kanban-status-chart-waiting")).toContainText("대기");
  await expect(task).toBeVisible();
  await expect(task.getByRole("button", { name: "검사 큐 열기" })).toHaveCount(0);
  await expect(action).toHaveCSS("opacity", "0");
  await task.hover();
  await expect(action).toHaveCSS("opacity", "1");

  await column.locator("header").hover();
  await column.getByRole("button", { name: "진료 접기" }).click();
  await expect(task).toHaveCount(0);
  await expect.poll(async () => (await column.boundingBox())?.height ?? 0).toBeLessThan(90);
  await column.getByRole("button", { name: "진료 펼치기" }).click();
  await expect(task).toBeVisible();
  await expect.poll(async () => (await column.boundingBox())?.height ?? 0).toBeGreaterThan(500);

  await column.getByRole("button", { name: "대기 접기" }).click();

  await expect(task).toHaveCount(0);
});

test("home remains readable on a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await useMockRole(page, "vet");
  await page.goto("/w/clair-demo/home");

  await expect(page.getByTestId("home-next-action-side-panel")).not.toBeVisible();
  await expect(page.getByRole("heading", { name: "업무 현황" })).toBeVisible();
  await expect(page.getByTestId("home-kanban-board").getByText("콩이 CBC 결과 확인")).toBeVisible();
  await expect(page.getByRole("heading", { name: "역할별 주요 위젯" })).toHaveCount(0);
});
