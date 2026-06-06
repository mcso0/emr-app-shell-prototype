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
  await expect(operationModeFilter.getByRole("button", { name: "내 담당 4" })).toBeVisible();
  await expect(operationModeFilter.getByRole("button", { name: "배정 필요 10" })).toBeVisible();
  await expect(operationModeFilter.getByRole("button", { name: "지연 해소 5" })).toBeVisible();
  await expect(page.getByLabel("담당자 필터")).toBeVisible();
  await expect(page.getByLabel("업무 필터")).toBeVisible();
  await expect(page.getByLabel("업무 상태 필터")).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /지연만 보기/ })).toBeVisible();

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
  await expect(page.getByTestId("home-kanban-status-waiting-overdue")).toContainText("지연");
  await expect(page.getByTestId("home-kanban-status-waiting-requested")).toContainText("요청");
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
  await page.getByRole("option", { name: "지연" }).click();

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

  await page.getByRole("group", { name: "업무 현황 운영 모드" }).getByRole("button", { name: "지연 해소 5" }).click();

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

test("sales demo launcher is preserved behind the home view query", async ({ page }) => {
  await page.goto("/w/clair-demo/home?view=demo&modulePanel=open&aside=closed");

  await expect(page.getByRole("heading", { name: "콩이 구토 내원" })).toBeVisible();
  await expect(page.getByText("김하늘 보호자 · 푸들 · 반복 구토")).toBeVisible();
  await expect(page.getByRole("link", { name: "데모 시작" })).toBeVisible();
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

  await expect(page.getByTestId("home-kanban-status-chart-assigned")).toContainText("배정");
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

  await column.getByRole("button", { name: "배정 접기" }).click();

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
