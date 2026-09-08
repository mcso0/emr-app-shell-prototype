import { expect, test, type Page } from "@playwright/test";
import { getCurrentOperatingDate } from "../src/lib/emr-domain/demo-date";

const workspaceId = "workspace-clair-cheongdam";
const today = getCurrentOperatingDate();
const previous = new Date(`${today}T12:00:00Z`); previous.setUTCDate(previous.getUTCDate() - 1);
const yesterday = previous.toISOString().slice(0, 10);
const base = { workspaceId, sourceStatus: "requested", progressState: "waiting", attentionSignals: [], permissionMode: "full", requestedAt: `${today}T09:00:00+09:00`, operatingDate: today, patientName: "나나", guardianName: "김보호", assigneeName: "김수의" };
const items = [
  { ...base, id: "lab:one", sourceId: "one", sourceType: "lab", title: "CBC 검사", sourceHref: `/w/${workspaceId}/lab?labResultId=live-lab-one&modulePanel=open`, isMyWork: true, isRequestedWork: false },
  { ...base, id: "lab:previous", sourceId: "previous", sourceType: "lab", title: "이전 혈액검사", requestedAt: `${yesterday}T09:00:00+09:00`, operatingDate: yesterday, sourceHref: `/w/${workspaceId}/lab?labResultId=live-lab-previous`, isMyWork: false, isRequestedWork: true },
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
  await page.getByTestId("home-kanban-column-lab").hover();
  await page.getByRole("button", { name: "임상병리 열 접기", exact: true }).click();
  const column = page.getByTestId("home-kanban-column-lab");
  expect((await column.boundingBox())!.width).toBeLessThanOrEqual(54);
  await page.getByRole("button", { name: "임상병리 열 펼치기" }).click();
  await page.getByRole("button", { name: "임상병리 열 메뉴" }).click();
  await page.getByRole("menuitem", { name: "이 업무 열 숨기기" }).click();
  await expect(column).toHaveCount(0);
  await expect(page.getByRole("region", { name: "숨김 업무" })).toBeVisible();
  if (!(await page.getByLabel("환자 보호자 업무 검색").isVisible())) await page.getByRole("button", { name: "검색", exact: true }).click();
  await page.getByLabel("환자 보호자 업무 검색").fill("김수의");
  await page.getByRole("button", { name: "필터 해제" }).click();
  await expect(column).toBeVisible();
  await expect(page.getByLabel("환자 보호자 업무 검색")).toHaveValue("김수의");
  await page.getByRole("button", { name: "리스트", exact: true }).click();
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
  await expect(page.getByText("이전 미완료", { exact: true }).first()).toBeVisible();
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
  await expect(page.getByRole("button", { name: "보드", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.evaluate(() => {
    const session = JSON.parse(localStorage.getItem("clair.mockAuth.session.v1")!);
    localStorage.setItem("clair.mockAuth.session.v1", JSON.stringify({ ...session, role: "vet", roleLabel: "수의사" }));
  });
  await openHome(page);
  await expect(page.getByRole("button", { name: "보드", exact: true })).toHaveAttribute("aria-pressed", "true");
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
