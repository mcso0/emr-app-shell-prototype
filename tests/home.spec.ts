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

async function openHospitalView(page: Page) {
  await page.getByRole("tab", { name: "업무 현황" }).click();
}

test("home renders the dashboard tab before hospital status", async ({ page }) => {
  await useMockRole(page, "vet");
  await page.goto("/w/clair-demo/home");

  await expect(page.getByRole("tab", { name: "홈" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: "업무 현황" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "내 업무" })).toHaveCount(0);
  await expect
    .poll(async () => page.getByRole("tablist", { name: "홈 보기" }).getByRole("tab").allTextContents())
    .toEqual(["홈", "업무 현황"]);
  await expect(page.getByTestId("home-dashboard")).toBeVisible();
  await expect(page.getByRole("heading", { name: "다음 행동" })).toBeVisible();
  await expect(page.getByTestId("home-dashboard-flow")).toBeVisible();
  await expect(page.getByText("병원 운영 현황")).toHaveCount(0);
  await expect(page.getByText("오늘 업무 아웃라인")).toBeVisible();
  await expect(page.getByTestId("home-dashboard-task-vet-kong-lab-review")).toBeVisible();
  await expect(page.getByRole("heading", { name: "지금 볼 업무" })).toHaveCount(0);
  await expect(page.getByRole("group", { name: "홈 업무 상태 필터" })).toHaveCount(0);
});

test("hospital status tab renders the kanban work-entry surface", async ({ page }) => {
  await useMockRole(page, "vet");
  await page.goto("/w/clair-demo/home");
  await openHospitalView(page);

  await expect(page.getByRole("tab", { name: "업무 현황" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("업무 분배와 병목 조정을 위한 운영 보드")).toBeVisible();
  const operationModeFilter = page.getByRole("group", { name: "업무 현황 운영 모드" });
  await expect(operationModeFilter.getByRole("button", { name: "전체 흐름 17" })).toHaveAttribute("aria-pressed", "true");
  await expect(operationModeFilter.getByRole("button", { name: "지연 해소 5" })).toBeVisible();
  await expect(operationModeFilter.getByRole("button", { name: "배정 필요 10" })).toBeVisible();
  await expect(operationModeFilter.getByRole("button", { name: /오늘 마감/ })).toHaveCount(0);
  await expect(page.getByLabel("담당자 필터")).toBeVisible();
  await expect(page.getByLabel("업무 필터")).toBeVisible();
  await expect(page.getByTestId("home-kanban-column-waiting").getByRole("heading", { name: "대기" })).toBeVisible();
  await expect(page.getByTestId("home-kanban-column-reservation").getByRole("heading", { name: "예약" })).toBeVisible();
  await expect(page.getByTestId("home-kanban-column-chart").getByRole("heading", { name: "진료" })).toBeVisible();
  await expect(page.getByTestId("home-kanban-column-lab").getByRole("heading", { name: "임상병리검사" })).toBeVisible();
  await expect(page.getByText("콩이 CBC 결과 확인").first()).toBeVisible();
  await expect(page.getByTestId("home-kanban-status-waiting-overdue")).toContainText("지연");
  await expect(page.getByTestId("home-kanban-status-waiting-requested")).toContainText("요청");
  await expect(page.getByRole("heading", { name: "지금 볼 업무" })).toHaveCount(0);
  await expect(page.getByText("현재 보기에서 먼저 확인할 업무를 추렸습니다.")).toHaveCount(0);
  await expect(page.getByText("업무별 분포 보기")).toHaveCount(0);

  await expect(page.getByRole("heading", { name: "알림" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "알림/예외" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "업무 현황 요약" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "오늘 운영 KPI" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "역할별 주요 위젯" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "병원 흐름 요약" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Sales Demo" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "신규 예약" })).toHaveCount(0);
  await expect(page.getByPlaceholder("환자, 보호자, 예약, 차트 검색")).toHaveCount(0);
});

test("hospital view filters kanban work by assignee and workstream", async ({ page }) => {
  await useMockRole(page, "vet");
  await page.goto("/w/clair-demo/home");
  await openHospitalView(page);

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

  await page.getByTestId("home-workstream-filter-menu").getByRole("checkbox", { name: "대기 업무 선택" }).click();

  await expect(page.getByLabel("업무 필터")).toHaveText("2개 선택");
  await expect(page.getByTestId("home-kanban-column-waiting")).toBeVisible();
  await expect(page.getByTestId("home-kanban-column-billing")).toBeVisible();
  await expect(page.getByTestId("home-kanban-column-reservation")).toHaveCount(0);
});

test("operation mode filters move populated workstreams before empty columns", async ({ page }) => {
  await useMockRole(page, "vet");
  await page.goto("/w/clair-demo/home");
  await openHospitalView(page);

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

test("hospital view hides the work summary panel", async ({ page }) => {
  await useMockRole(page, "vet");
  await page.goto("/w/clair-demo/home");
  await openHospitalView(page);

  const operationModeFilter = page.getByRole("group", { name: "업무 현황 운영 모드" });

  await expect(page.getByTestId("home-work-summary-panel")).toHaveCount(0);
  await expect(page.getByTestId("home-focus-task-billing-coco-payment")).toHaveCount(0);
  await expect(operationModeFilter.getByRole("button", { name: "전체 흐름 17" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("업무 필터")).toHaveText("전체");
});

test("top workstream filter supports checkbox multi-select", async ({ page }) => {
  await useMockRole(page, "vet");
  await page.goto("/w/clair-demo/home");
  await openHospitalView(page);

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

test("desk role still lands on the shared home dashboard", async ({ page }) => {
  await useMockRole(page, "front_desk");
  await page.goto("/w/clair-demo/home");

  await expect(page.getByRole("tab", { name: "홈" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("home-dashboard")).toBeVisible();
  await expect(page.getByText("오늘 업무 아웃라인")).toBeVisible();
  await expect(page.getByText("콩이 CBC 결과 확인").first()).toBeVisible();
  await expect(page.getByLabel("담당자 필터")).toHaveCount(0);
  await expect(page.getByLabel("업무 필터")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "예약/접수 열기" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "현장 접수" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "수납 대기 보기" })).toHaveCount(0);
});

test("desk home panels fill the desktop content height together", async ({ page }) => {
  await page.setViewportSize({ width: 1555, height: 1100 });
  await useMockRole(page, "front_desk");
  await page.goto("/w/clair-demo/home");
  await openHospitalView(page);

  const board = page.getByTestId("home-kanban-board");

  await expect(board).toBeVisible();

  const boardBox = await board.boundingBox();

  expect(boardBox).not.toBeNull();
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
  test(`home maps ${role} to the matching work-entry preset`, async ({ page }) => {
    await useMockRole(page, role);
    await page.goto("/w/clair-demo/home");

    await expect(page.getByText(expectedTask).first()).toBeVisible();
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
  await openHospitalView(page);

  const task = page.getByTestId("home-kanban-task-vet-kong-lab-review");
  const action = page.getByTestId("home-kanban-task-action-vet-kong-lab-review");
  const column = page.getByTestId("home-kanban-column-chart");

  await expect(page.getByTestId("home-kanban-status-chart-assigned")).toContainText("배정");
  await expect(task).toBeVisible();
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

  await expect(page.getByRole("tab", { name: "홈" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "업무 현황" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "내 업무" })).toHaveCount(0);
  await expect(page.getByText("콩이 CBC 결과 확인").first()).toBeVisible();
  await expect(page.getByText("병원 운영 현황")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "역할별 주요 위젯" })).toHaveCount(0);
});
