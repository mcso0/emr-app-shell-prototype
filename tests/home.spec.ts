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
async function openHome(page: Page, status = "live") {
  await page.route(`**/api/workspaces/${workspaceId}/operations/work-items?**`, async (route) => {
    await route.fulfill({ json: status === "error" || status === "permission_denied" ? { ok: false, workspaceId, operatingDate: today, sourceStatus: status, error: { message: "테스트 조회 오류", retryable: status === "error" } } : { ok: true, workspaceId, operatingDate: today, generatedAt: new Date().toISOString(), sourceStatus: status, items, currentPatients: { present: 2, waiting: 1, inProgress: 1 } } });
  });
  await page.goto(`/w/${workspaceId}/home`);
  await expect(page.getByTestId("home-workspace")).toHaveAttribute("aria-busy", "false");
}

test("hospital limits board and list to the selected day while personal work retains carry-over", async ({ page }) => {
  await openHome(page);
  await expect(page.getByTestId("home-kanban-task-lab:previous")).toHaveCount(0);
  await expect(page.getByLabel("표시 업무 수")).toHaveText("2");
  await page.getByRole("button", { name: "리스트", exact: true }).click();
  await expect(page.getByText("이전 혈액검사", { exact: true })).toHaveCount(0);
  await page.getByLabel("담당자 다중 선택").click();
  await expect(page.getByRole("checkbox", { name: "이전담당 선택", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "선택 해제", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("표시 업무 수")).toHaveText("0");
  await page.getByRole("button", { name: "이전 날짜", exact: true }).click();
  await expect(page.getByLabel("담당자 다중 선택")).toHaveText("담당자 전체");
  await expect(page.getByText("이전 혈액검사", { exact: true })).toBeVisible();
  await expect(page.getByText("CBC 검사", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("표시 업무 수")).toHaveText("1");
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
  await expect(page.getByLabel("표시 업무 수")).toHaveText("1");
});

test("home uses shared board cards with menu-only navigation and preserves return state", async ({ page }) => {
  await openHome(page);
  await expect(page.getByRole("heading", { name: "원내 현황", exact: true })).toBeVisible();
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
  await expect(page.getByRole("region", { name: "숨김 업무" })).toHaveCount(0);
  await page.getByTestId("home-kanban-column-lab").hover();
  await page.getByRole("button", { name: "임상병리 열 접기", exact: true }).click();
  const column = page.getByTestId("home-kanban-column-lab");
  expect((await column.boundingBox())!.width).toBeLessThanOrEqual(54);
  await page.getByRole("button", { name: "임상병리 열 펼치기" }).click();
  await page.getByRole("button", { name: "임상병리 열 숨기기" }).click();
  await expect(column).toHaveCount(0);
  await expect(page.getByRole("region", { name: "숨김 업무" })).toBeVisible();
  expect((await page.getByRole("region", { name: "숨김 업무" }).boundingBox())!.width).toBe(220);
  if (!(await page.getByLabel("환자 보호자 업무 검색").isVisible())) await page.getByRole("button", { name: "검색", exact: true }).click();
  await page.getByLabel("환자 보호자 업무 검색").fill("김수의");
  await page.getByRole("button", { name: "전체 표시" }).click();
  await expect(column).toBeVisible();
  await expect(page.getByRole("region", { name: "숨김 업무" })).toHaveCount(0);
  await expect(page.getByLabel("환자 보호자 업무 검색")).toHaveValue("김수의");
  await page.getByRole("button", { name: "리스트", exact: true }).click();
  await expect(page.getByRole("region", { name: "숨김 업무" })).toHaveCount(0);
  await page.getByRole("button", { name: "임상병리 업무 목록 숨기기", exact: true }).click();
  await expect(page.getByRole("region", { name: "숨김 업무" })).toBeVisible();
  await page.getByRole("button", { name: "임상병리 열 표시", exact: true }).click();
  await expect(page.getByRole("region", { name: "숨김 업무" })).toHaveCount(0);
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
  await page.getByRole("button", { name: "완료 포함", exact: true }).click();
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
    await expect(page.getByLabel("표시 업무 수")).toHaveText("—");
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

test("approved Home layout keeps fixed geometry in board and both personal tabs", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1084 });
  await openHome(page);
  const first = page.getByTestId("home-kanban-column-waiting");
  const next = page.getByTestId("home-kanban-column-reservation");
  const firstBox = (await first.boundingBox())!;
  expect(firstBox.width).toBe(280);
  expect((await next.boundingBox())!.x - firstBox.x - firstBox.width).toBe(16);
  await expect(first).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(first).toHaveCSS("border-radius", "12px");
  expect((await first.locator("header").boundingBox())!.height).toBe(44);
  await expect(page.getByRole("region", { name: "숨김 업무" })).toHaveCount(0);
  expect((await page.getByRole("button", { name: "완료 포함", exact: true }).boundingBox())!.height).toBe(32);
  expect((await page.getByRole("group", { name: "업무 보기 방식" }).boundingBox())!.height).toBe(34);
  const date = page.getByRole("button", { name: /날짜 선택$/ });
  expect((await date.locator("..").boundingBox())!.width).toBe(230);
  await date.click();
  await expect(page.getByRole("button", { name: "오늘로 이동" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "오늘로 이동" })).toHaveCount(0);
  await page.getByRole("heading", { name: "원내 현황", exact: true }).click();
  await page.screenshot({ path: "/tmp/home-approved-board-1920.png", animations: "disabled" });
  await page.getByRole("button", { name: "접수 열 접기", exact: true }).click();
  expect((await first.boundingBox())!.width).toBe(52);
  await page.getByRole("button", { name: "접수 열 펼치기", exact: true }).click();
  await page.getByRole("button", { name: "리스트", exact: true }).click();
  const group = page.getByTestId("home-list-group-lab");
  const row = group.getByRole("row", { name: "나나 CBC 검사", exact: true });
  await expect(row).toBeVisible();
  expect((await row.boundingBox())!.height).toBe(36);
  expect(await row.getByRole("cell").count()).toBe(7);
  const header = group.locator("header");
  expect(await header.evaluate((element) => getComputedStyle(element, "::after").height)).toBe("1px");
  await group.getByRole("button", { name: "임상병리 업무 목록", exact: true }).click();
  await expect(row).toHaveCount(0);
  expect(await header.evaluate((element) => getComputedStyle(element, "::after").content)).toBe("none");
  await group.getByRole("button", { name: "임상병리 업무 목록", exact: true }).click();
  await page.screenshot({ path: "/tmp/home-approved-list-1920.png" });
  await page.getByRole("button", { name: "내 업무", exact: true }).click();
  await expect(page.getByRole("region", { name: "숨김 업무" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "오늘 할 업무" }).getByText("CBC 검사", { exact: true })).toBeVisible();
  await page.screenshot({ path: "/tmp/home-approved-assigned-1920.png" });
  await page.getByRole("button", { name: "임상병리 업무 목록 숨기기", exact: true }).click();
  await expect(page.getByText("CBC 검사", { exact: true })).toHaveCount(0);
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
  await page.setViewportSize({ width: 1920, height: 1080 });
  await expect(fade).toHaveAttribute("data-visible", "true");
  await viewport.evaluate((el) => { el.scrollLeft = 0; });
  await page.getByTestId("home-kanban-column-waiting").hover();
  await page.getByRole("button", { name: "접수 열 숨기기", exact: true }).click();
  const panel = page.getByRole("region", { name: "숨김 업무", exact: true });
  await expect(panel.getByRole("heading")).toHaveText("숨김 업무");
  const showAll = panel.getByRole("button", { name: "전체 표시", exact: true });
  await expect(showAll).toHaveCSS("height", "28px");
  await expect(showAll.locator("svg")).toHaveCount(1);
  const restore = panel.getByRole("button", { name: "접수 열 표시", exact: true });
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

test("list token styling and hover preserve geometry across hospital and personal views", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1084 });
  await openHome(page);
  const body = page.getByTestId("home-workspace-body");
  await expect(body).toHaveCSS("padding-right", "16px");
  await page.getByRole("button", { name: "리스트", exact: true }).click();
  for (const view of ["hospital", "assigned", "requested"]) {
    if (view === "assigned") await page.getByRole("button", { name: "내 업무", exact: true }).click();
    if (view === "requested") await page.getByRole("button", { name: "내가 요청한 업무", exact: true }).click();
    await expect(body).toHaveCSS("padding-left", "48px");
    await expect(body).toHaveCSS("padding-right", "48px");
    const row = page.getByRole("row", { name: view === "requested" ? "보리 내가 요청한 약" : "나나 CBC 검사", exact: true });
    await page.getByRole("heading", { name: view === "hospital" ? "원내 현황" : "내 업무", exact: true }).hover();
    const action = row.getByRole("button", { name: "업무보러가기", exact: true });
    await expect(action.locator("..")).toHaveCSS("opacity", "0");
    const before = await row.getByRole("cell").evaluateAll((cells) => cells.map((cell) => { const r = cell.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; }));
    await row.hover();
    await expect(action.locator("..")).toHaveCSS("opacity", "1");
    await expect(action.locator("..")).toHaveCSS("background-image", "none");
    await expect(action).toHaveCSS("height", "24px");
    await expect(action.locator("svg")).toHaveCount(1);
    await expect(row).toHaveCSS("background-color", "rgba(0, 0, 0, 0.06)");
    await expect(row).toHaveCSS("padding", "8px");
    await expect(row).toHaveCSS("font-weight", "500");
    await expect(row.getByRole("cell").nth(5).locator("svg")).toHaveCount(1);
    await expect(row.getByRole("cell").nth(6).locator("svg")).toHaveCount(1);
    expect(await row.getByRole("cell").evaluateAll((cells) => cells.map((cell) => { const r = cell.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; }))).toEqual(before);
    await page.screenshot({ path: `/tmp/home-list-token-${view}-hover.png` });
  }
  const action = page.getByRole("row", { name: "보리 내가 요청한 약", exact: true }).getByRole("button", { name: "업무보러가기", exact: true });
  await action.click();
  await expect(page).toHaveURL(/dispensing\?workItemId=medicine/);
});


test("board leading inset scrolls away without clipping at the title alignment", async ({ page }) => {
  await openHome(page);
  const viewport = page.getByTestId("home-workspace-scroll");
  const first = page.getByTestId("home-kanban-column-waiting");
  const heading = page.getByRole("heading", { name: "원내 현황", exact: true });
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
