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

test("home renders the v1 work-entry surface on the existing home route", async ({ page }) => {
  await useMockRole(page, "vet");
  await page.goto("/w/clair-demo/home");

  await expect(page.getByText("좋은 아침입니다, 이수지 수의사님")).toBeVisible();
  await expect(page.getByText("4건")).toBeVisible();
  await expect(page.getByRole("button", { name: "미배정 큐" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "내 업무" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "콩이 CBC 결과 확인" })).toBeVisible();
  await expect(page.getByText("추천: 결과를 확인하고 차트 또는 보호자 설명에 반영하세요.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "병원 흐름 요약" })).toBeVisible();
  await expect(page.getByRole("link", { name: "예약 24" })).toBeVisible();
  await expect(page.getByRole("link", { name: "대기 지연 3 5" })).toBeVisible();
  await expect(page.getByText("지연 3")).toBeVisible();

  await expect(page.getByRole("heading", { name: "알림/예외" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "오늘 운영 KPI" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "역할별 주요 위젯" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "병원 전체 흐름" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Sales Demo" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "신규 예약" })).toHaveCount(0);
  await expect(page.getByPlaceholder("환자, 보호자, 예약, 차트 검색")).toHaveCount(0);
});

test("sales demo launcher is preserved behind the home view query", async ({ page }) => {
  await page.goto("/w/clair-demo/home?view=demo&modulePanel=open&aside=closed");

  await expect(page.getByRole("heading", { name: "콩이 구토 내원" })).toBeVisible();
  await expect(page.getByText("김하늘 보호자 · 푸들 · 반복 구토")).toBeVisible();
  await expect(page.getByRole("link", { name: "데모 시작" })).toBeVisible();
});

test("desk role shows the no-work empty state with launchers", async ({ page }) => {
  await useMockRole(page, "front_desk");
  await page.goto("/w/clair-demo/home");

  await expect(page.getByText("좋은 아침입니다, 최유나 매니저님")).toBeVisible();
  await expect(page.getByText("0건")).toBeVisible();
  await expect(page.getByText("바로 시작할 업무를 선택하세요.")).toBeVisible();
  await expect(page.getByText("현재 요청된 내 업무는 없지만")).toBeVisible();
  await expect(page.getByRole("link", { name: "예약/접수 열기" })).toBeVisible();
  await expect(page.getByRole("link", { name: "현장 접수" })).toBeVisible();
  await expect(page.getByRole("link", { name: "수납 대기 보기" })).toBeVisible();
  await expect(page.getByRole("button", { name: "긴급" })).toHaveCount(0);
});

test("desk home panels fill the desktop content height together", async ({ page }) => {
  await page.setViewportSize({ width: 1555, height: 1100 });
  await useMockRole(page, "front_desk");
  await page.goto("/w/clair-demo/home");

  const myWorkPanel = page.getByTestId("home-my-work-panel");
  const flowSummaryPanel = page.getByTestId("home-flow-summary-panel");

  await expect(myWorkPanel).toBeVisible();
  await expect(flowSummaryPanel).toBeVisible();

  const myWorkBox = await myWorkPanel.boundingBox();
  const flowSummaryBox = await flowSummaryPanel.boundingBox();

  expect(myWorkBox).not.toBeNull();
  expect(flowSummaryBox).not.toBeNull();
  expect(myWorkBox!.height).toBeGreaterThan(420);
  expect(Math.abs(myWorkBox!.height - flowSummaryBox!.height)).toBeLessThanOrEqual(2);
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

    await expect(page.getByRole("heading", { name: expectedTask })).toBeVisible();
  });
}

test("role queue work is visible as unassigned without claim actions", async ({ page }) => {
  await useMockRole(page, "nurse");
  await page.goto("/w/clair-demo/home");

  await expect(page.getByRole("heading", { name: "망고 혈액 샘플 채취" })).toBeVisible();
  await expect(page.getByText("미배정 큐").first()).toBeVisible();
  await expect(page.getByText("임상병리검사 담당 큐 · 미배정")).toBeVisible();
  await expect(page.getByRole("button", { name: "담당하기" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "완료 처리" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "수납 완료" })).toHaveCount(0);
});

test("home remains readable on a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await useMockRole(page, "vet");
  await page.goto("/w/clair-demo/home");

  await expect(page.getByText("좋은 아침입니다, 이수지 수의사님")).toBeVisible();
  await expect(page.getByRole("heading", { name: "내 업무" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "콩이 CBC 결과 확인" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "병원 흐름 요약" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "역할별 주요 위젯" })).toHaveCount(0);
});
