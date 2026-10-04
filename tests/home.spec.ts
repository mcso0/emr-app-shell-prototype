import { expect, test, type Page } from "@playwright/test";
import { getCurrentOperatingDate } from "../src/lib/emr-domain/demo-date";

const workspaceId = "workspace-clair-cheongdam";
const today = getCurrentOperatingDate();
const previous = new Date(`${today}T12:00:00Z`); previous.setUTCDate(previous.getUTCDate() - 1);
const yesterday = previous.toISOString().slice(0, 10);
const base = { workspaceId, sourceStatus: "requested", progressState: "waiting", attentionSignals: [], permissionMode: "full", requestedAt: `${today}T09:00:00+09:00`, operatingDate: today, patientName: "나나", guardianName: "김보호", assigneeName: "김수의" };
const items = [
  { ...base, id: "lab:one", sourceId: "one", sourceType: "lab", title: "CBC 검사", sourceHref: `/w/${workspaceId}/lab?labResultId=live-lab-one&modulePanel=open`, isMyWork: true, isRequestedWork: false },
  { ...base, id: "lab:previous", sourceId: "previous", assigneeName: "이전담당", sourceType: "lab", title: "이전 혈액검사", requestedAt: `${yesterday}T09:00:00+09:00`, operatingDate: yesterday, sourceHref: `/w/${workspaceId}/lab?labResultId=live-lab-previous`, isMyWork: false, isRequestedWork: true },
  { ...base, id: "dispensing:one", sourceId: "medicine", sourceType: "dispensing", title: "내가 요청한 약", patientName: "보리", assigneeName: undefined, sourceHref: `/w/${workspaceId}/dispensing?workItemId=medicine`, isMyWork: false, isRequestedWork: true },
  { ...base, id: "lab:done", sourceId: "done", sourceType: "lab", title: "완료한 검사", progressState: "completed", sourceHref: `/w/${workspaceId}/lab`, isMyWork: true },
];
async function openHome(page: Page, status = "live", responseItems = items) {
  await page.route(`**/api/workspaces/${workspaceId}/operations/work-items?**`, async (route) => {
    await route.fulfill({ json: status === "error" || status === "permission_denied" ? { ok: false, workspaceId, operatingDate: today, sourceStatus: status, error: { message: "테스트 조회 오류", retryable: status === "error" } } : { ok: true, workspaceId, operatingDate: today, generatedAt: new Date().toISOString(), sourceStatus: status, items: responseItems, currentPatients: { present: 2, waiting: 1, inProgress: 1 } } });
  });
  await page.goto(`/w/${workspaceId}/home`);
  await expect(page.getByTestId("home-workspace")).toHaveAttribute("aria-busy", "false");
}

test("hospital avatars keep registered user photos, fallback identities and tooltip interaction", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openHome(page, "live", items.map((item) => item.id === "lab:one" ? {
    ...item,
    requesterUserId: "requester",
    requesterName: "송민재",
    requesterAvatarUrl: "/avatars/49110000-0000-4000-8000-000000000001.png",
    assigneeUserId: "vet-one",
    assigneeUserIds: ["vet-one", "vet-two"],
    assigneeNames: ["이수지", "김수의"],
    assigneeAvatarUrls: { "vet-one": "/avatars/49110000-0000-4000-8000-000000000003.png" },
  } : item));
  await page.getByRole("button", { name: "리스트", exact: true }).click();
  const row = page.getByTestId("home-hospital-row-lab:one");
  const cells = row.getByRole("cell");
  await expect(cells.nth(0).locator('[data-slot="badge"]')).toHaveAttribute("data-variant", "outline");
  for (const index of [1, 2]) {
    const avatar = cells.nth(index).locator('[data-slot="avatar"]');
    await expect(avatar).toHaveCSS("width", "20px");
    await expect(avatar).toHaveCSS("height", "20px");
  }
  await expect(cells.nth(4)).toHaveCSS("gap", "8px");
  await expect(cells.nth(5).locator("svg")).toBeVisible();
  const requester = row.getByRole("button", { name: "요청자 송민재", exact: true });
  const assignee = row.getByRole("button", { name: "담당자 이수지", exact: true });
  await expect(requester.locator("img")).toHaveAttribute("src", /000000000001\.png$/);
  await expect(assignee.locator("img")).toHaveAttribute("src", /000000000003\.png$/);
  await expect(row.getByRole("button", { name: "담당자 김수의" }).locator('[data-slot="avatar-fallback"]')).toBeVisible();
  for (const cellIndex of [6, 7]) {
    const cell = cells.nth(cellIndex);
    await expect(cell).toHaveCSS("justify-content", "center");
    for (const avatar of await cell.locator('[data-slot="avatar"]').all()) {
      await expect(avatar).toHaveCSS("width", "24px");
      await expect(avatar).toHaveCSS("height", "24px");
      expect(await avatar.evaluate((element) => parseFloat(getComputedStyle(element).borderRadius))).toBeGreaterThanOrEqual(12);
    }
  }
  await requester.hover();
  await expect(page.getByRole("tooltip", { name: "송민재", exact: true })).toBeVisible();
  await requester.click();
  await expect(page).toHaveURL(/\/home/);
  await requester.press("Tab");
  await expect(assignee).toBeFocused();
  await expect(page.getByRole("tooltip", { name: "이수지", exact: true })).toBeVisible();
  await assignee.press("Enter");
  await expect(page).toHaveURL(/\/home/);
  const unassigned = page.getByTestId("home-hospital-row-dispensing:one").getByRole("button", { name: "담당자 미배정", exact: true });
  await expect(unassigned.locator('[data-slot="avatar-fallback"]')).toBeVisible();
  await unassigned.focus();
  await expect(page.getByRole("tooltip", { name: "미배정", exact: true })).toBeVisible();
  await page.screenshot({ path: "/tmp/home-list-profile-avatars.png", animations: "disabled" });
});

test("stale list activation renews user pictures once and keeps additional assignees accessible", async ({ page }) => {
  const start = new Date();
  await page.clock.setFixedTime(start);
  let reads = 0;
  await page.route(`**/api/workspaces/${workspaceId}/operations/work-items?**`, async (route) => {
    reads += 1;
    await route.fulfill({ json: {
      ok: true, workspaceId, operatingDate: today, generatedAt: new Date().toISOString(), sourceStatus: "live",
      items: [{ ...items[0], requesterUserId: "requester", requesterName: "송민재", requesterAvatarUrl: `/avatars/49110000-0000-4000-8000-000000000001.png?v=${reads}`,
        assigneeUserIds: ["one", "two", "three", "four"], assigneeNames: ["김수의", "이수의", "박수의", "최수의"] }],
    } });
  });
  await page.goto(`/w/${workspaceId}/home`);
  await expect(page.getByTestId("home-workspace")).toHaveAttribute("aria-busy", "false");
  const initialReads = reads;
  await page.getByRole("button", { name: "리스트", exact: true }).click();
  const row = page.getByTestId("home-hospital-row-lab:one");
  await expect(row.getByRole("button", { name: "요청자 송민재" }).locator("img")).toHaveAttribute("src", new RegExp(`v=${initialReads}$`));
  expect(reads).toBe(initialReads);
  const remaining = row.getByRole("button", { name: "담당자 박수의, 최수의", exact: true });
  await expect(remaining).toHaveText("+2");
  await remaining.hover();
  await expect(page.getByRole("tooltip", { name: "박수의, 최수의", exact: true })).toBeVisible();
  expect(await row.getByRole("cell").nth(7).getByRole("button").count()).toBe(3);
  await page.getByRole("button", { name: "칸반", exact: true }).click();
  await page.clock.setFixedTime(new Date(start.getTime() + 6 * 60 * 1000));
  await page.getByRole("button", { name: "리스트", exact: true }).click();
  await expect(row.getByRole("button", { name: "요청자 송민재" }).locator("img")).toHaveAttribute("src", new RegExp(`v=${initialReads + 1}$`));
  expect(reads).toBe(initialReads + 1);
  await page.clock.setFixedTime(new Date(start.getTime() + 12 * 60 * 1000));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(row.getByRole("button", { name: "요청자 송민재" }).locator("img")).toHaveAttribute("src", new RegExp(`v=${initialReads + 2}$`));
  expect(reads).toBe(initialReads + 2);
  await page.clock.setFixedTime(new Date(start.getTime() + 18 * 60 * 1000));
  await page.getByRole("button", { name: "검색", exact: true }).click();
  await page.getByLabel("환자 보호자 업무 검색").fill("CBC");
  await expect(row.getByRole("button", { name: "요청자 송민재" }).locator("img")).toHaveAttribute("src", new RegExp(`v=${initialReads + 3}$`));
  expect(reads).toBe(initialReads + 3);
});

test("home data loading uses the centered shared empty state", async ({ page }) => {
  let release: (() => void) | undefined;
  const responsePending = new Promise<void>((resolve) => {
    release = resolve;
  });

  await page.route(`**/api/workspaces/${workspaceId}/operations/work-items?**`, async (route) => {
    await responsePending;
    await route.fulfill({
      json: {
        ok: true,
        workspaceId,
        operatingDate: today,
        generatedAt: new Date().toISOString(),
        sourceStatus: "live",
        items,
        currentPatients: { present: 2, waiting: 1, inProgress: 1 },
      },
    });
  });

  await page.goto(`/w/${workspaceId}/home`);

  const loadingState = page.getByTestId("home-loading-state");
  await expect(loadingState).toBeVisible();
  await expect(loadingState).toContainText("업무를 불러오는 중입니다");
  const alignment = await loadingState.evaluate((element) => {
    const viewport = document.querySelector<HTMLElement>(
      '[data-testid="home-workspace-scroll"]',
    );
    if (!viewport) throw new Error("Home workspace viewport is missing");

    const stateBox = element.getBoundingClientRect();
    const viewportBox = viewport.getBoundingClientRect();
    return {
      x: Math.abs(stateBox.left + stateBox.width / 2 - (viewportBox.left + viewportBox.width / 2)),
      y: Math.abs(stateBox.top + stateBox.height / 2 - (viewportBox.top + viewportBox.height / 2)),
    };
  });
  expect(alignment.x).toBeLessThanOrEqual(1);
  expect(alignment.y).toBeLessThanOrEqual(1);

  release?.();
  await expect(page.getByTestId("home-loading-state")).toHaveCount(0);
});

test("hospital limits board and list to the selected day while personal work retains carry-over", async ({ page }) => {
  await openHome(page);
  await expect(page.getByTestId("home-kanban-task-lab:previous")).toHaveCount(0);
  await expect(page.getByTestId("home-all-work-tab")).toContainText("2");
  await page.getByRole("button", { name: "리스트", exact: true }).click();
  await expect(page.getByText("이전 혈액검사", { exact: true })).toHaveCount(0);
  await page.getByLabel("담당자 다중 선택").click();
  await expect(page.getByRole("menuitemcheckbox", { name: "이전담당", exact: true })).toHaveCount(0);
  await page.getByRole("menuitem", { name: "선택 해제", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("home-all-work-tab")).toContainText("0");
  await page.getByRole("button", { name: "이전 날짜", exact: true }).click();
  await expect(page.getByLabel("담당자 다중 선택")).toHaveText("담당자 전체");
  await expect(page.getByText("이전 혈액검사", { exact: true })).toBeVisible();
  await expect(page.getByText("CBC 검사", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("home-all-work-tab")).toContainText("1");
  await page.getByRole("button", { name: "내 업무", exact: true }).click();
  await expect(page.getByText("CBC 검사", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "내가 요청한 업무", exact: true }).click();
  await expect(page.getByText("이전 혈액검사", { exact: true })).toBeVisible();
});


test("hospital fallback dates respect Seoul midnight and source operating date", async ({ page }) => {
  await page.route(`**/api/workspaces/${workspaceId}/operations/work-items?**`, async (route) => {
    const boundaryItems = [
      { ...items[0], id: "lab:before", title: "자정 전", operatingDate: undefined, requestedAt: `${yesterday}T14:59:59Z` },
      { ...items[0], id: "lab:midnight", title: "자정 이후", operatingDate: undefined, requestedAt: `${yesterday}T15:00:00Z` },
      { ...items[0], id: "lab:source-date", title: "원본 날짜 우선", operatingDate: yesterday, requestedAt: `${today}T09:00:00+09:00` },
    ];
    await route.fulfill({ json: { ok: true, workspaceId, operatingDate: today, sourceStatus: "live", items: boundaryItems } });
  });
  await page.goto(`/w/${workspaceId}/home`);
  await expect(page.getByTestId("home-kanban-task-lab:midnight")).toBeVisible();
  await expect(page.getByTestId("home-kanban-task-lab:before")).toHaveCount(0);
  await expect(page.getByTestId("home-kanban-task-lab:source-date")).toHaveCount(0);
  await expect(page.getByTestId("home-all-work-tab")).toContainText("1");
});

test("home toolbar uses full-size controls and shared filter builder across board and list", async ({ page }) => {
  await openHome(page);
  const search = page.getByRole("button", { name: "검색", exact: true });
  await expect(search).toHaveCSS("height", "32px");
  await expect(search.locator("svg")).toHaveCSS("width", "16px");
  const filter = page.getByRole("button", { name: "업무 필터 설정" });
  await expect(filter).toHaveCSS("height", "32px");
  await expect(filter.locator("svg")).toHaveCSS("width", "16px");
  await expect(page.getByRole("button", { name: "이전 날짜", exact: true })).toHaveCSS("width", "32px");
  for (const name of ["이전 날짜", "다음 날짜"]) {
    const arrow = page.getByRole("button", { name, exact: true });
    await expect(arrow).toHaveCSS("height", "40px");
    await expect(arrow.locator("svg")).toHaveCSS("width", "28px");
    await expect(arrow.locator("svg")).toHaveCSS("height", "28px");
    await expect(arrow.locator("svg")).toHaveCSS("color", "rgb(82, 82, 82)");
  }
  const dateTrigger = page.getByRole("button", { name: /날짜 선택$/ });
  expect((await dateTrigger.boundingBox())!.width).toBeGreaterThanOrEqual(196);
  await page.evaluate(() => document.fonts.ready);
  const dateText = dateTrigger.locator("span.truncate");
  expect(await dateText.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  const viewControl = page.getByRole("group", { name: "업무 보기 방식" });
  const viewport = page.viewportSize()!;
  const viewBounds = (await viewControl.boundingBox())!;
  expect(viewBounds.x + viewBounds.width).toBeLessThanOrEqual(viewport.width);
  await expect(dateTrigger.getByText("오늘", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "이전 날짜", exact: true }).click();
  await expect(dateTrigger.getByText("오늘", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "다음 날짜", exact: true }).click();
  await expect(dateTrigger.getByText("오늘", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "칸반", exact: true }).locator("svg")).toHaveCSS("width", "16px");
  await page.getByRole("button", { name: "업무 필터 설정" }).click();
  const builder = page.locator('[data-emr-table-filter-builder="true"]');
  await expect(builder).toBeVisible();
  await expect(page.getByRole("option", { name: "업무", exact: true })).toBeVisible();
  await page.screenshot({ path: "/tmp/home-toolbar-filter.png", animations: "disabled" });
  await page.getByRole("option", { name: "업무", exact: true }).click();
  await builder.getByRole("combobox", { name: "필터 값" }).click();
  await page.getByRole("option", { name: "임상병리", exact: true }).click();
  await expect(builder).toHaveAttribute("data-active-filter-count", "1");
  await builder.getByRole("button", { name: "필터 닫기" }).click();
  await expect(page.getByTestId("home-kanban-task-lab:one")).toBeVisible();
  await expect(page.getByTestId("home-kanban-task-dispensing:one")).toHaveCount(0);
  await page.getByRole("button", { name: "리스트", exact: true }).click();
  await expect(page.getByText("내가 요청한 약", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "내 업무", exact: true }).click();
  await expect(filter).toHaveCSS("height", "32px");
  await page.getByRole("button", { name: "내가 요청한 업무", exact: true }).click();
  await expect(page.getByText("내가 요청한 약", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "원내 현황", exact: true }).click();
  await page.getByRole("button", { name: "업무 필터 설정" }).click();
  await builder.getByRole("button", { name: "초기화", exact: true }).click();
  await expect(builder).toHaveAttribute("data-active-filter-count", "0");
  await builder.getByRole("button", { name: "필터 닫기" }).click();
  await expect(page.getByText("내가 요청한 약", { exact: true })).toBeVisible();
});

test("home uses shared board cards with menu-only navigation and preserves return state", async ({ page }) => {
  await openHome(page);
  await expect(page.locator('[data-slot="emr-page-header"] h1')).toBeVisible();
  await expect(page.getByLabel("현재 병원 환자 현황")).toHaveText("원내 2마리·진료 대기 1마리·진료 중 1마리");
  await page.screenshot({ path: "/tmp/home-workspace-board.png" });
  const card = page.getByTestId("home-kanban-task-lab:one");
  await expect(card).not.toHaveAttribute("role", "button");
  await card.click(); await expect(page).toHaveURL(/\/home(?:\?|$)/);
  if (!(await page.getByLabel("환자 보호자 업무 검색").isVisible())) await page.getByRole("button", { name: "검색", exact: true }).click();
  await page.getByLabel("환자 보호자 업무 검색").fill("CBC");
  await card.hover();
  await card.getByRole("button", { name: "나나 임상병리 업무 메뉴" }).click();
  await page.getByRole("menuitem", { name: "임상병리 화면으로 이동" }).click();
  await expect(page).toHaveURL(/labResultId=live-lab-one/);
  await page.goBack();
  await expect(page.getByLabel("환자 보호자 업무 검색")).toHaveValue("CBC");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("home hides and restores columns in order, resets filters independently of search and remembers display", async ({ page }) => {
  await openHome(page);
  await expect(page.getByRole("region", { name: "숨김 상태" })).toHaveCount(0);
  await page.getByTestId("home-kanban-column-waiting").hover();
  await page.getByRole("button", { name: "대기 열 접기", exact: true }).click();
  const column = page.getByTestId("home-kanban-column-waiting");
  expect((await column.boundingBox())!.width).toBeLessThanOrEqual(54);
  await page.getByRole("button", { name: "대기 열 펼치기" }).click();
  await page.getByRole("button", { name: "대기 열 숨기기" }).click();
  await expect(column).toHaveCount(0);
  await expect(page.getByRole("region", { name: "숨김 상태" })).toBeVisible();
  expect((await page.getByRole("region", { name: "숨김 상태" }).boundingBox())!.width).toBe(220);
  if (!(await page.getByLabel("환자 보호자 업무 검색").isVisible())) await page.getByRole("button", { name: "검색", exact: true }).click();
  await page.getByLabel("환자 보호자 업무 검색").fill("김수의");
  await page.getByRole("button", { name: "전체 표시" }).click();
  await expect(column).toBeVisible();
  await expect(page.getByRole("region", { name: "숨김 상태" })).toHaveCount(0);
  await expect(page.getByLabel("환자 보호자 업무 검색")).toHaveValue("김수의");
  await page.getByRole("button", { name: "리스트", exact: true }).click();
  await expect(page.getByRole("region", { name: "숨김 상태" })).toHaveCount(0);
  await expect(page.getByTestId("home-hospital-row-lab:one")).toBeVisible();
  await page.getByRole("button", { name: "칸반", exact: true }).click();
  await page.getByTestId("home-kanban-column-waiting").hover();
  await page.getByRole("button", { name: "대기 열 숨기기", exact: true }).click();
  await page.getByRole("button", { name: "리스트", exact: true }).click();
  await expect(page.getByTestId("home-hospital-row-lab:one")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "리스트", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("환자 보호자 업무 검색")).toHaveValue("김수의");
  await page.evaluate(() => { window.dispatchEvent(new Event("clair:session-ended")); });
  await page.reload();
  await expect(page.getByRole("button", { name: "리스트", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "검색", exact: true })).toBeVisible();
});

test("personal assigned and requested lists are independent of hospital filtering and keep previous work", async ({ page }) => {
  await openHome(page);
  if (!(await page.getByLabel("환자 보호자 업무 검색").isVisible())) await page.getByRole("button", { name: "검색", exact: true }).click();
  await page.getByLabel("환자 보호자 업무 검색").fill("없는 업무");
  await page.getByRole("button", { name: "내 업무", exact: true }).click();
  await expect(page.getByRole("heading", { name: "내 업무", exact: true })).toBeVisible();
  await expect(page.getByText("CBC 검사", { exact: true })).toBeVisible();
  await expect(page.getByText("내가 요청한 약", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "내가 요청한 업무" }).click();
  await expect(page.getByText("내가 요청한 약", { exact: true })).toBeVisible();
  await expect(page.getByText("이전 혈액검사", { exact: true })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "업무 종류" }).first()).toBeVisible();
  await expect(page.getByLabel("담당자 다중 선택")).toHaveCount(0);
  await page.getByRole("button", { name: "원내 현황", exact: true }).click();
  await expect(page.getByLabel("환자 보호자 업무 검색")).toHaveValue("없는 업무");
});

test("completion is opt-in and board/list show the same filtered tasks", async ({ page }) => {
  await openHome(page);
  await expect(page.getByTestId("home-kanban-task-lab:done")).toHaveCount(0);
  const completedToggle = page.getByRole("button", { name: "완료 포함", exact: true });
  await expect(completedToggle).toHaveAttribute("aria-pressed", "false");
  await expect(completedToggle).toHaveCSS("height", "32px");
  await completedToggle.click();
  await expect(completedToggle).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("home-kanban-task-lab:done")).toBeVisible();
  await page.getByRole("button", { name: "리스트", exact: true }).click();
  await expect(page.getByText("완료한 검사", { exact: true })).toBeVisible();
  await expect(page.getByText("이전 미완료", { exact: true })).toHaveCount(0);
});
for (const status of ["error", "permission_denied"]) {
  test(`home ${status} does not masquerade as empty work`, async ({ page }) => {
    await openHome(page, status);
    await expect(page.getByText(status === "error" ? "업무를 불러오지 못했습니다" : "업무를 볼 권한이 없습니다", { exact: true })).toBeVisible();
    await expect(page.getByTestId("home-kanban-task-lab:one")).toHaveCount(0);
    await expect(page.getByTestId("home-all-work-tab")).toContainText("—");
  });
}

test("new tabs reset transient queries while display preferences stay scoped to user and workspace", async ({ page, context }) => {
  await openHome(page);
  await page.getByRole("button", { name: "리스트", exact: true }).click();
  if (!(await page.getByLabel("환자 보호자 업무 검색").isVisible())) await page.getByRole("button", { name: "검색", exact: true }).click();
  await page.getByLabel("환자 보호자 업무 검색").fill("CBC");
  const newTab = await context.newPage();
  await openHome(newTab);
  await expect(newTab.getByRole("button", { name: "검색", exact: true })).toBeVisible();
  await expect(newTab.getByRole("button", { name: "리스트", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.goto("/w/clair-demo/home");
  await expect(page.getByRole("button", { name: "칸반", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.evaluate(() => {
    const session = JSON.parse(localStorage.getItem("clair.mockAuth.session.v1")!);
    localStorage.setItem("clair.mockAuth.session.v1", JSON.stringify({ ...session, role: "vet", roleLabel: "수의사" }));
  });
  await openHome(page);
  await expect(page.getByRole("button", { name: "칸반", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "검색", exact: true })).toBeVisible();
});


test("Home search reveals and restores focus without changing source navigation", async ({ page }) => {
  await openHome(page);
  const trigger = page.getByRole("button", { name: "검색", exact: true });
  await trigger.click();
  const input = page.getByLabel("환자 보호자 업무 검색");
  await expect(input).toBeFocused();
  await input.fill("CBC");
  await expect(page.getByTestId("home-kanban-task-dispensing:one")).toHaveCount(0);
  await input.press("Escape");
  await expect(input).toHaveValue("");
  await expect(page.getByTestId("home-kanban-task-dispensing:one")).toBeVisible();
  await input.press("Escape");
  await expect(trigger).toBeFocused();
  await page.getByRole("button", { name: "내 업무", exact: true }).click();
  await expect(page.getByRole("button", { name: "내가 해야 할 업무", exact: true })).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await page.getByRole("button", { name: "내가 요청한 업무", exact: true }).click();
  await expect(page.getByRole("button", { name: "내가 요청한 업무", exact: true })).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await page.screenshot({ path: "/tmp/home-final-personal-ui.png" });
});

test("Home search stays expanded while switching between hospital and personal work", async ({ page }) => {
  await openHome(page);
  await page.getByRole("button", { name: "검색", exact: true }).click();
  await expect(page.getByLabel("환자 보호자 업무 검색")).toBeFocused();

  await page.getByRole("button", { name: "업무 필터 설정" }).click();
  await expect(page.locator('[data-emr-table-filter-builder="true"]')).toBeVisible();
  await expect(page.getByLabel("환자 보호자 업무 검색")).toBeVisible();
  await page.getByRole("button", { name: "필터 닫기", exact: true }).click();
  await expect(page.getByLabel("환자 보호자 업무 검색")).toBeVisible();

  await page.getByRole("button", { name: "완료 포함", exact: true }).click();
  await expect(page.getByLabel("환자 보호자 업무 검색")).toBeVisible();

  await page.getByRole("button", { name: "내 업무", exact: true }).click();
  await expect(page.getByLabel("내 업무 검색")).toBeVisible();
  await expect(page.getByRole("button", { name: "검색", exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "원내 현황", exact: true }).click();
  await expect(page.getByLabel("환자 보호자 업무 검색")).toBeVisible();
  await expect(page.getByRole("button", { name: "검색", exact: true })).toHaveCount(0);
});

test("approved Home layout keeps fixed status geometry and personal work navigation", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1084 });
  await openHome(page);
  const first = page.getByTestId("home-kanban-column-waiting");
  const next = page.getByTestId("home-kanban-column-in_progress");
  const firstBox = (await first.boundingBox())!;
  expect(firstBox.width).toBe(280);
  expect((await next.boundingBox())!.x - firstBox.x - firstBox.width).toBe(16);
  await expect(first).toHaveCSS("border-radius", "12px");
  expect((await first.locator("header").boundingBox())!.height).toBe(44);
  await expect(page.getByRole("region", { name: "숨김 상태" })).toHaveCount(0);
  expect((await page.getByRole("button", { name: "완료 포함", exact: true }).boundingBox())!.height).toBe(32);
  expect((await page.getByRole("group", { name: "업무 보기 방식" }).boundingBox())!.height).toBe(34);
  await page.getByRole("button", { name: /날짜 선택$/ }).click();
  await expect(page.getByRole("button", { name: "오늘로 이동" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.screenshot({ path: "/tmp/home-approved-board-1920.png", animations: "disabled" });
  await first.hover();
  await page.getByRole("button", { name: "대기 열 접기", exact: true }).click();
  expect((await first.boundingBox())!.width).toBe(52);
  await page.getByRole("button", { name: "대기 열 펼치기", exact: true }).click();
  await page.getByRole("button", { name: "리스트", exact: true }).click();
  const row = page.getByTestId("home-hospital-row-lab:one");
  await expect(row).toBeVisible();
  expect((await row.boundingBox())!.height).toBe(36);
  expect(await row.getByRole("cell").count()).toBe(9);
  await page.screenshot({ path: "/tmp/home-approved-list-1920.png", animations: "disabled" });
  await page.getByRole("button", { name: "내 업무", exact: true }).click();
  await expect(page.getByRole("region", { name: "오늘 할 업무" }).getByText("CBC 검사", { exact: true })).toBeVisible();
  await page.screenshot({ path: "/tmp/home-approved-assigned-1920.png" });
  await page.getByRole("button", { name: "임상병리 업무 목록 숨기기", exact: true }).click();
  await expect(page.getByRole("region", { name: "숨김 업무" })).toBeVisible();
  await expect(page.getByRole("region", { name: "오늘 할 업무" }).getByText("CBC 검사", { exact: true })).toHaveCount(0);
  await page.getByRole("region", { name: "숨김 업무" }).getByRole("button", { name: "전체 표시" }).click();
  await expect(page.getByRole("region", { name: "오늘 할 업무" }).getByText("CBC 검사", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "내가 요청한 업무", exact: true }).click();
  await expect(page.getByRole("region", { name: "이전 미완료", exact: true }).getByText("이전 혈액검사", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "내가 요청한 업무", exact: true })).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await page.screenshot({ path: "/tmp/home-approved-requested-1920.png", animations: "disabled" });
  const requested = page.getByRole("row", { name: "보리 내가 요청한 약", exact: true });
  await requested.focus();
  await requested.press("Enter");
  await expect(page).toHaveURL(/dispensing\?workItemId=medicine/);
});

test("personal work ignores saved dates while hospital date selection remains independent", async ({ page }) => {
  await openHome(page);
  await page.getByRole("button", { name: "리스트", exact: true }).click();
  await page.evaluate(({ yesterday }) => {
    const key = Object.keys(sessionStorage).find((key) => key.startsWith("clair.home.v2:"))!;
    const saved = JSON.parse(sessionStorage.getItem(key)!);
    saved.view = "mine";
    saved.queries.mine.date = yesterday;
    saved.queries.hospital.date = yesterday;
    sessionStorage.setItem(key, JSON.stringify(saved));
  }, { yesterday });
  const request = page.waitForRequest((request) => request.url().includes("/operations/work-items?"));
  await page.reload();
  expect(new URL((await request).url()).searchParams.get("date")).toBe(today);
  await expect(page.getByRole("button", { name: /날짜 선택$/ })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "오늘 할 업무", exact: true }).getByText("CBC 검사", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "완료 포함", exact: true }).click();
  await expect(page.getByText("완료한 검사", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "내가 요청한 업무", exact: true }).click();
  await expect(page.getByRole("region", { name: "이전 미완료", exact: true }).getByText("이전 혈액검사", { exact: true })).toBeVisible();
  const hospitalRequest = page.waitForRequest((request) => request.url().includes("/operations/work-items?"));
  await page.getByRole("button", { name: "원내 현황", exact: true }).click();
  expect(new URL((await hospitalRequest).url()).searchParams.get("date")).toBe(yesterday);
  await expect(page.getByRole("button", { name: /날짜 선택$/ })).toBeVisible();
  const personalRequest = page.waitForRequest((request) => request.url().includes("/operations/work-items?"));
  await page.getByRole("button", { name: "내 업무", exact: true }).click();
  expect(new URL((await personalRequest).url()).searchParams.get("date")).toBe(today);
  await expect(page.getByRole("button", { name: /날짜 선택$/ })).toHaveCount(0);
});

test("Home hidden panel matches design and board fade follows overflow", async ({ page }) => {
  await openHome(page);
  const viewport = page.getByTestId("home-workspace-scroll");
  const fade = page.getByTestId("home-board-scroll-fade");
  await expect(fade).toHaveAttribute("data-visible", "true");
  await expect(fade).toHaveCSS("pointer-events", "none");
  await viewport.evaluate((el) => { el.scrollLeft = el.scrollWidth; });
  await expect(fade).toHaveAttribute("data-visible", "false");
  await viewport.evaluate((el) => { el.scrollLeft = 100; });
  await expect(fade).toHaveAttribute("data-visible", "true");
  await page.setViewportSize({ width: 3000, height: 1080 });
  await expect(fade).toHaveAttribute("data-visible", "false");
  await page.setViewportSize({ width: 1327, height: 1080 });
  await expect(fade).toHaveAttribute("data-visible", "true");
  await viewport.evaluate((el) => { el.scrollLeft = 0; });
  await page.getByTestId("home-kanban-column-waiting").hover();
  await page.getByRole("button", { name: "대기 열 숨기기", exact: true }).click();
  const panel = page.getByRole("region", { name: "숨김 상태", exact: true });
  await expect(panel.getByRole("heading")).toHaveText("숨김 상태");
  const showAll = panel.getByRole("button", { name: "전체 표시", exact: true });
  await expect(showAll).toHaveCSS("height", "28px");
  await expect(showAll.locator("svg")).toHaveCount(1);
  const restore = panel.getByRole("button", { name: "대기 열 표시", exact: true });
  const row = restore.locator("..");
  await expect(row).toHaveCSS("height", "32px");
  await expect(row.locator("svg")).toHaveCount(1);
  await row.hover();
  await expect(row).toHaveCSS("background-color", "rgba(0, 0, 0, 0.06)");
  await expect(restore).toHaveCSS("opacity", "1");
  await expect(restore.locator("svg")).toHaveCSS("width", "14px");
  await page.screenshot({ path: "/tmp/home-hidden-panel-fade.png" });
  await restore.focus();
  await page.mouse.move(0, 0);
  await expect(restore).toHaveCSS("opacity", "1");
  await restore.press("Enter");
  await expect(panel).toHaveCount(0);
  await page.getByRole("button", { name: "리스트", exact: true }).click();
  await expect(fade).toHaveCount(0);
});

test("Home board and borderless scrollbar reach the workspace bottom edge", async ({ page }) => {
  await page.setViewportSize({ width: 1327, height: 880 });
  await openHome(page);

  const assertBottomEdge = async () => {
    const body = page.getByTestId("home-workspace-body");
    const scrollArea = page.getByTestId("home-workspace-scroll-area");
    const viewport = page.getByTestId("home-workspace-scroll");
    const scrollbar = page.getByTestId("home-workspace-horizontal-scrollbar");

    await expect(scrollbar).toBeVisible();
    const geometry = await body.evaluate((element) => {
      const scrollAreaElement = element.querySelector<HTMLElement>(
        '[data-testid="home-workspace-scroll-area"]',
      );
      const viewportElement = element.querySelector<HTMLElement>(
        '[data-testid="home-workspace-scroll"]',
      );
      const scrollbarElement = element.querySelector<HTMLElement>(
        '[data-testid="home-workspace-horizontal-scrollbar"]',
      );
      const columnElement = element.querySelector<HTMLElement>(
        '[data-testid="home-kanban-column-waiting"]',
      );
      if (
        !scrollAreaElement ||
        !viewportElement ||
        !scrollbarElement ||
        !columnElement
      ) {
        throw new Error("Home board scroll geometry is incomplete");
      }

      const bodyRect = element.getBoundingClientRect();
      const scrollAreaRect = scrollAreaElement.getBoundingClientRect();
      const viewportRect = viewportElement.getBoundingClientRect();
      const scrollbarRect = scrollbarElement.getBoundingClientRect();
      const columnRect = columnElement.getBoundingClientRect();
      const scrollbarStyle = getComputedStyle(scrollbarElement);

      return {
        bodyBottom: bodyRect.bottom,
        scrollAreaBottom: scrollAreaRect.bottom,
        viewportBottom: viewportRect.bottom,
        scrollbarBottom: scrollbarRect.bottom,
        columnBottom: columnRect.bottom,
        nativeScrollbarGutter:
          viewportElement.offsetHeight - viewportElement.clientHeight,
        scrollbarBorderTop: scrollbarStyle.borderTopWidth,
        scrollbarPaddingTop: scrollbarStyle.paddingTop,
        scrollbarPaddingBottom: scrollbarStyle.paddingBottom,
      };
    });

    expect(Math.abs(geometry.bodyBottom - geometry.scrollAreaBottom)).toBeLessThanOrEqual(1);
    expect(Math.abs(geometry.scrollAreaBottom - geometry.viewportBottom)).toBeLessThanOrEqual(1);
    expect(Math.abs(geometry.scrollAreaBottom - geometry.scrollbarBottom)).toBeLessThanOrEqual(1);
    expect(Math.abs(geometry.viewportBottom - geometry.columnBottom)).toBeLessThanOrEqual(1);
    expect(geometry.nativeScrollbarGutter).toBe(0);
    expect(geometry.scrollbarBorderTop).toBe("0px");
    expect(geometry.scrollbarPaddingTop).toBe("2px");
    expect(geometry.scrollbarPaddingBottom).toBe("1px");

    await expect(scrollArea).toBeVisible();
    await expect(viewport).toBeVisible();
  };

  await assertBottomEdge();
  await page.getByRole("button", { name: "홈 패널 접기", exact: true }).click();
  await assertBottomEdge();
});

test("list hover actions preserve row geometry across hospital and personal views", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1084 });
  await openHome(page);
  await page.getByRole("button", { name: "리스트", exact: true }).click();
  for (const view of ["hospital", "assigned", "requested"]) {
    if (view === "assigned") await page.getByRole("button", { name: "내 업무", exact: true }).click();
    if (view === "requested") await page.getByRole("button", { name: "내가 요청한 업무", exact: true }).click();
    const row = page.getByRole("row", { name: view === "requested" ? "보리 내가 요청한 약" : "나나 CBC 검사", exact: true });
    await expect(row).toBeVisible();
    const action = view === "hospital" ? row.getByRole("button", { name: "나나 임상병리 화면으로 이동" }) : row.getByRole("button", { name: "업무보러가기", exact: true });
    const before = await row.getByRole("cell").evaluateAll((cells) => cells.map((cell) => { const r = cell.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; }));
    await row.hover();
    await expect(action).toBeVisible();
    await expect(row).toHaveCSS("background-color", "rgba(0, 0, 0, 0.06)");
    expect(await row.getByRole("cell").evaluateAll((cells) => cells.map((cell) => { const r = cell.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; }))).toEqual(before);
    await page.screenshot({ path: `/tmp/home-list-token-${view}-hover.png`, animations: "disabled" });
  }
  await page.getByRole("row", { name: "보리 내가 요청한 약", exact: true }).getByRole("button", { name: "업무보러가기", exact: true }).click();
  await expect(page).toHaveURL(/dispensing\?workItemId=medicine/);
});

test("board leading inset scrolls away without clipping at the title alignment", async ({ page }) => {
  await openHome(page);
  const viewport = page.getByTestId("home-workspace-scroll");
  const first = page.getByTestId("home-kanban-column-waiting");
  const heading = page.locator('[data-slot="emr-page-header"] h1');
  const start = (await first.boundingBox())!;
  const edge = (await viewport.boundingBox())!;
  expect(start.x - edge.x).toBe(48);
  expect(start.x).toBe((await heading.boundingBox())!.x);
  await viewport.evaluate((el) => { el.scrollLeft = 32; });
  await expect.poll(async () => (await first.boundingBox())!.x).toBe(start.x - 32);
  // The column remains hit-testable inside the area formerly clipped by fixed padding.
  expect(await first.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return el.contains(document.elementFromPoint(r.x + 4, r.y + 20));
  })).toBe(true);
  await page.screenshot({ path: "/tmp/home-leading-inset-scrolled.png" });
  await viewport.evaluate((el) => { el.scrollLeft = 0; });
  await expect.poll(async () => (await first.boundingBox())!.x).toBe(start.x);
  await page.getByRole("button", { name: "리스트", exact: true }).click();
  expect((await viewport.boundingBox())!.x).toBe((await heading.boundingBox())!.x);
});

test("Home lists keep readable cells at wide and narrow widths", async ({ page }) => {
  await openHome(page);
  await page.getByRole("button", { name: "리스트", exact: true }).click();
  for (const view of ["hospital", "assigned", "requested"]) {
    if (view === "assigned") await page.getByRole("button", { name: "내 업무", exact: true }).click();
    if (view === "requested") await page.getByRole("button", { name: "내가 요청한 업무", exact: true }).click();
    for (const width of [1280, 1636, 1920]) {
      await page.setViewportSize({ width, height: 1084 });
      const viewport = page.getByTestId("home-workspace-scroll");
      const row = page.getByRole("row", { name: view === "requested" ? "보리 내가 요청한 약" : "나나 CBC 검사", exact: true });
      await expect(row).toBeVisible();
      expect(await row.getByRole("cell").count()).toBe(view === "hospital" ? 9 : 7);
      if (view === "hospital" && width === 1280) expect(await viewport.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
      if (view !== "hospital") expect(await viewport.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
    }
  }
});

test("Home toolbar stays in one row and collapses actions at its own 900px boundary", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await openHome(page);
  await page.evaluate(() => document.fonts.ready);
  const toolbar = page.getByTestId("home-toolbar");
  const setToolbarWidth = async (width: number) => {
    const current = (await toolbar.boundingBox())!.width;
    await page.setViewportSize({ width: Math.round(page.viewportSize()!.width + width - current), height: 1000 });
    await expect.poll(async () => Math.round((await toolbar.boundingBox())!.width)).toBe(width);
  };
  await setToolbarWidth(900);
  const completed = page.getByRole("button", { name: "완료 포함", exact: true });
  await expect(completed.locator("span")).toBeVisible();
  await setToolbarWidth(899);
  await expect(completed.locator("span")).toBeHidden();
  expect((await completed.boundingBox())!.width).toBe(32);
  const owner = page.getByLabel("담당자 다중 선택");
  expect((await owner.boundingBox())!.width).toBe(32);
  for (const label of ["칸반", "리스트"]) {
    const button = page.getByRole("button", { name: label, exact: true });
    await expect(button.locator("span")).toBeHidden();
    expect((await button.boundingBox())!.width).toBe(32);
  }
  const tabs = page.getByTestId("home-toolbar-tab-frame");
  const actions = page.getByTestId("home-toolbar-actions");
  const tabBox = (await tabs.boundingBox())!, actionBox = (await actions.boundingBox())!;
  expect(actionBox.x - tabBox.x - tabBox.width).toBe(20);
  expect(Math.abs(tabBox.y + tabBox.height / 2 - actionBox.y - actionBox.height / 2)).toBeLessThanOrEqual(1);
  await page.getByRole("button", { name: "검색", exact: true }).click();
  const input = page.getByLabel("환자 보호자 업무 검색");
  await expect(input).toBeFocused();
  expect((await input.boundingBox())!.width).toBeLessThanOrEqual(280);
  expect((await input.boundingBox())!.width).toBeGreaterThanOrEqual(200);
  expect(Math.abs((await input.boundingBox())!.y - (await completed.boundingBox())!.y)).toBeLessThanOrEqual(1);
  await input.press("Escape");
  await owner.click();
  await page.getByRole("menuitem", { name: "선택 해제", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(owner).toHaveAttribute("title", "담당자 선택 없음");
  await setToolbarWidth(536);
  await page.getByRole("button", { name: "검색", exact: true }).click();
  expect((await tabs.boundingBox())!.width).toBeGreaterThanOrEqual(96);
  expect(await actions.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  await completed.focus();
  await page.getByLabel("환자 보호자 업무 검색").hover();
  await expect(page.getByRole("tooltip", { name: /완료 포함/ })).toBeVisible();
  expect(await page.getByRole("tooltip").evaluate((element) => element.parentElement === document.body)).toBe(true);
  await page.getByLabel("환자 보호자 업무 검색").press("Escape");
  await setToolbarWidth(899);
  await page.getByRole("button", { name: "내 업무", exact: true }).click();
  for (const name of ["검색", "업무 필터 설정", "완료 포함", "정렬"]) {
    const button = page.getByRole("button", { name, exact: true });
    expect((await button.boundingBox())!.width).toBe(32);
  }
  await page.getByRole("button", { name: "검색", exact: true }).click();
  await expect(page.getByLabel("내 업무 검색")).toBeFocused();
  await page.getByLabel("내 업무 검색").fill("CBC");
  await page.getByRole("button", { name: "검색어 지우기", exact: true }).click();
  await expect(page.getByLabel("내 업무 검색")).toHaveValue("");
  await page.getByRole("button", { name: "검색 닫기", exact: true }).click();
  await expect(page.getByRole("button", { name: "검색", exact: true })).toBeFocused();
});

test("Home tabs support grab scrolling without selecting and reveal keyboard focus with edge fades", async ({ page }) => {
  await page.setViewportSize({ width: 1303, height: 1000 });
  await openHome(page);
  const tabs = page.getByTestId("home-toolbar-tabs");
  await expect(tabs).toHaveAttribute("data-overflow", "true");
  await expect(page.getByTestId("home-tabs-fade-left")).toHaveAttribute("data-visible", "false");
  await expect(page.getByTestId("home-tabs-fade-right")).toHaveAttribute("data-visible", "true");
  const box = (await tabs.boundingBox())!;
  await page.mouse.move(box.x + Math.min(box.width - 10, 180), box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 10, box.y + box.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect.poll(() => tabs.evaluate((element) => element.scrollLeft)).toBeGreaterThan(20);
  await expect(page.getByTestId("home-all-work-tab")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("home-tabs-fade-left")).toHaveAttribute("data-visible", "true");
  await page.getByTestId("home-all-work-tab").focus();
  await page.getByTestId("home-all-work-tab").press("End");
  const last = page.getByRole("button", { name: /^수납 / });
  await expect(last).toBeFocused();
  await page.setViewportSize({ width: 1200, height: 1000 });
  await expect(last).toBeFocused();
  await expect.poll(async () => {
    const tabBounds = (await tabs.boundingBox())!, focusedBounds = (await last.boundingBox())!;
    return focusedBounds.x >= tabBounds.x - 1 && focusedBounds.x + focusedBounds.width <= tabBounds.x + tabBounds.width + 1;
  }).toBe(true);
  await expect(page.getByTestId("home-tabs-fade-right")).toHaveAttribute("data-visible", "false");
  await last.press("Enter");
  await expect(last).toHaveAttribute("aria-pressed", "true");
  await last.press("Home");
  await expect(page.getByTestId("home-all-work-tab")).toBeFocused();
  await expect(page.getByTestId("home-tabs-fade-left")).toHaveAttribute("data-visible", "false");
  await page.getByTestId("home-all-work-tab").press("Enter");
  await page.getByRole("button", { name: "내 업무", exact: true }).click();
  await page.setViewportSize({ width: 1000, height: 1000 });
  await page.getByRole("button", { name: "검색", exact: true }).click();
  await expect(tabs).toHaveAttribute("data-overflow", "true");
  const assigned = page.getByRole("button", { name: "내가 해야 할 업무", exact: true });
  await assigned.focus();
  await assigned.press("End");
  const requested = page.getByRole("button", { name: "내가 요청한 업무", exact: true });
  await expect(requested).toBeFocused();
  await requested.press("Enter");
  await expect(requested).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("row", { name: "보리 내가 요청한 약", exact: true })).toBeVisible();
});
