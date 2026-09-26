import { expect, test, type Page } from "@playwright/test";
import { getCurrentOperatingDate } from "../src/lib/emr-domain/demo-date";

const workspaceId = "workspace-clair-cheongdam";
const today = getCurrentOperatingDate();
const time = (hour: number) => `${today}T${String(hour).padStart(2, "0")}:00:00+09:00`;
const base = { workspaceId, sourceType: "lab", sourceStatus: "requested", permissionMode: "full", operatingDate: today, patientName: "나나", guardianName: "김보호", assigneeName: "김수의", requesterName: "박요청", attentionSignals: [] as string[], sourceHref: `/w/${workspaceId}/lab` };
const items = [
  { ...base, id: "lab:wait", sourceId: "wait", title: "대기 검사", progressState: "waiting", requestedAt: time(9) },
  { ...base, id: "lab:urgent", sourceId: "urgent", title: "긴급 검사", progressState: "waiting", attentionSignals: ["urgent"], requestedAt: time(11) },
  { ...base, id: "lab:re", sourceId: "re", title: "재요청 검사", progressState: "in_progress", attentionSignals: ["re_requested"], requestedAt: time(10) },
  { ...base, id: "lab:done", sourceId: "done", title: "완료 검사", progressState: "completed", requestedAt: time(12) },
  { ...base, id: "lab:cancel", sourceId: "cancel", title: "취소 검사", progressState: "cancelled", requestedAt: time(13) },
  { ...base, id: "chart:one", sourceId: "chart", sourceType: "consultation", title: "진료 기록", progressState: "in_progress", requestedAt: time(8), requesterName: undefined },
];

async function openHome(page: Page) {
  await page.route(`**/api/workspaces/${workspaceId}/operations/work-items?**`, async (route) => {
    const url = new URL(route.request().url());
    const includeCompleted = url.searchParams.get("includeCompleted") === "true";
    const includeCancelled = url.searchParams.get("includeCancelled") === "true";
    await route.fulfill({ json: { ok: true, workspaceId, operatingDate: today, sourceStatus: "live", items: items.filter((item) => item.progressState !== "completed" || includeCompleted).filter((item) => item.progressState !== "cancelled" || includeCancelled), currentPatients: { present: 2, waiting: 1, inProgress: 1 } } });
  });
  await page.goto(`/w/${workspaceId}/home`);
  await expect(page.getByTestId("home-workspace")).toHaveAttribute("aria-busy", "false");
}

test("hospital board uses one status column per task and list keeps the same permitted records", async ({ page }) => {
  await openHome(page);
  await expect(page.getByTestId("home-kanban-column-waiting")).toBeVisible();
  await expect(page.getByTestId("home-kanban-column-re_requested")).toBeVisible();
  await expect(page.getByTestId("home-kanban-column-completed")).toContainText("완료 포함을 켜면 표시됩니다.");
  await expect(page.getByTestId("home-status-task-lab:re")).toHaveCount(1);
  await expect(page.getByTestId("home-kanban-column-re_requested").getByTestId("home-status-task-lab:re")).toBeVisible();
  await expect(page.getByRole("button", { name: "전체 업무 4" })).toBeVisible();
  await page.getByRole("button", { name: "임상병리 3" }).click();
  await expect(page.getByTestId("home-kanban-task-chart:one")).toHaveCount(0);
  await expect(page.getByTestId("home-kanban-task-lab:wait")).toBeVisible();
  await page.getByRole("button", { name: "리스트", exact: true }).click();
  await expect(page.getByTestId("home-hospital-table").getByRole("row")).toHaveCount(4);
  await expect(page.getByRole("columnheader", { name: "요청자" })).toBeVisible();
  await page.getByRole("button", { name: "전체 업무 4" }).click();
  await expect(page.getByTestId("home-hospital-row-chart:one")).toContainText("—");
  await page.getByRole("button", { name: "칸반", exact: true }).click();
  await expect(page.getByTestId("home-kanban-task-chart:one")).toBeVisible();
});

test("hospital completion, cancellation, and sort remain shared across board and list", async ({ page }) => {
  await openHome(page);
  const assertSortControlNextToFilter = async () => {
    const filter = page.getByRole("button", { name: "업무 필터 설정" });
    const sort = page.getByRole("button", { name: "정렬" });
    await expect(sort).toHaveCSS("width", "32px");
    await expect(sort).toHaveCSS("height", "32px");
    await expect(sort.locator("svg")).toHaveCSS("width", "16px");
    await expect(sort).toHaveText("");
    await expect(sort).toHaveAttribute("title", "정렬");
    const filterBox = (await filter.boundingBox())!;
    const sortBox = (await sort.boundingBox())!;
    const gap = sortBox.x - filterBox.x - filterBox.width;
    expect(gap).toBeGreaterThan(0);
    expect(gap).toBeLessThanOrEqual(12);
  };
  await assertSortControlNextToFilter();
  await page.getByRole("button", { name: "완료 포함" }).click();
  await expect(page.getByTestId("home-kanban-task-lab:done")).toBeVisible();
  await page.getByRole("button", { name: "업무 필터 설정" }).click();
  await page.getByRole("checkbox", { name: "취소 포함" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("home-kanban-task-lab:cancel")).toBeVisible();
  await page.getByRole("button", { name: "정렬" }).click();
  await expect(page.getByRole("menuitemradio", { name: "업무 우선순" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("menuitemradio", { name: "최근 요청순" }).click();
  await page.keyboard.press("Escape");
  const waitingIds = await page.getByTestId("home-kanban-column-waiting").locator('[data-testid^="home-status-task-"]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-testid")));
  expect(waitingIds).toEqual(["home-status-task-lab:urgent", "home-status-task-lab:wait"]);
  await page.getByRole("button", { name: "리스트", exact: true }).click();
  const firstRow = page.getByTestId("home-hospital-table").getByRole("row").nth(1);
  await expect(firstRow).toContainText("취소 검사");
  await assertSortControlNextToFilter();
  await page.getByRole("button", { name: "칸반", exact: true }).click();
  await assertSortControlNextToFilter();
});

test("included terminal columns distinguish an empty result from a disabled inclusion", async ({ page }) => {
  await openHome(page);
  await page.getByRole("button", { name: "진료 1" }).click();
  await page.getByRole("button", { name: "완료 포함" }).click();
  await expect(page.getByTestId("home-kanban-column-completed")).toContainText("표시할 업무가 없습니다.");
  await expect(page.getByTestId("home-kanban-column-completed")).not.toContainText("완료 포함을 켜면");
  await page.getByRole("button", { name: "업무 필터 설정" }).click();
  await page.getByRole("checkbox", { name: "취소 포함" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("home-kanban-column-cancelled")).toContainText("표시할 업무가 없습니다.");
});

test("hospital status hiding never removes list rows and list row opens its source", async ({ page }) => {
  await openHome(page);
  await page.getByTestId("home-kanban-column-waiting").hover();
  await page.getByRole("button", { name: "대기 열 숨기기" }).click();
  await expect(page.getByRole("region", { name: "숨김 상태" })).toBeVisible();
  await page.getByRole("button", { name: "리스트", exact: true }).click();
  await expect(page.getByTestId("home-hospital-row-lab:wait")).toBeVisible();
  await page.getByTestId("home-hospital-row-lab:wait").focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/lab/);
});

test("work-type tab and builder filters intersect, with an explicit empty reset", async ({ page }) => {
  await openHome(page);
  await page.getByRole("button", { name: "업무 필터 설정" }).click();
  const builder = page.locator('[data-emr-table-filter-builder="true"]');
  await page.getByRole("option", { name: "업무", exact: true }).click();
  await builder.getByRole("combobox", { name: "필터 값" }).click();
  await page.getByRole("option", { name: "임상병리", exact: true }).click();
  await builder.getByRole("button", { name: "필터 닫기" }).click();
  await expect(page.getByTestId("home-all-work-tab")).toContainText("3");
  await expect(page.getByRole("button", { name: "진료 0" })).toBeVisible();
  await page.getByRole("button", { name: "진료 0" }).click();
  await expect(page.getByRole("status")).toContainText("선택한 조건에 맞는 업무가 없습니다");
  await page.getByRole("button", { name: "검색·업무 탭·필터 초기화" }).click();
  await expect(page.getByTestId("home-all-work-tab")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("home-all-work-tab")).toContainText("4");
});

test("hospital visual states at desktop and narrow widths", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openHome(page);
  await page.screenshot({ path: "/tmp/home-status-board-1920.png", animations: "disabled" });
  await page.getByRole("button", { name: /날짜 선택$/ }).click();
  await page.screenshot({ path: "/tmp/home-status-calendar-1920.png", animations: "disabled" });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "리스트", exact: true }).click();
  await page.screenshot({ path: "/tmp/home-status-list-1920.png", animations: "disabled" });
  for (const width of [1024, 900]) {
    await page.setViewportSize({ width, height: 900 });
    const date = (await page.getByRole("button", { name: /날짜 선택$/ }).boundingBox())!;
    const summary = (await page.getByLabel("현재 병원 환자 현황").boundingBox())!;
    expect(summary.y >= date.y + date.height || summary.x >= date.x + date.width).toBe(true);
    await page.screenshot({ path: `/tmp/home-status-list-${width}.png`, animations: "disabled" });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "/tmp/home-status-list-390.png", animations: "disabled" });
  await page.getByRole("button", { name: "칸반", exact: true }).click();
  await page.screenshot({ path: "/tmp/home-status-board-390.png", animations: "disabled" });
});
