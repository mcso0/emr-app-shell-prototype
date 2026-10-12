import { expect, test, type Page } from "@playwright/test";
import { SESSION_WORKSPACES_STORAGE_KEY } from "../src/features/auth/workspace-session";
import { PREPARED_EMPTY_CLINIC_WORKSPACE_ID as workspaceId } from "../src/lib/emr-domain/demo-workspaces";

// Synthetic GET fixtures only. All non-GET requests are intercepted as well.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(([key, id]) => localStorage.setItem(key, JSON.stringify({ currentWorkspaceId: id, workspaces: [{ id, displayName: "합성 병원", subscriptionStatus: "trialing", createdBySessionId: "playwright-default-session" }], memberships: [{ id: "synthetic-controls", workspaceId: id, userSessionId: "playwright-default-session", roles: ["hospital_admin"], status: "active" }], invitations: [] })), [SESSION_WORKSPACES_STORAGE_KEY, workspaceId]);
  await page.route("**/api/**", route => new URL(route.request().url()).pathname === "/api/workspaces"
    ? route.fulfill({ json: { ok: true, workspaces: [{ id: workspaceId, status: "active", displayName: "합성 병원", roles: ["hospital_admin"] }] } })
    : route.fulfill({ status: 403, json: { ok: false, status: 403, denialReason: "permission_missing" } }));
});
const times: Record<string, string> = { b: "2026-05-01T10:00:00+09:00", a: "2026-05-01T00:00:00Z", c: "2026-05-01T00:30:00Z" };
function tasks(queueType: string) {
  return ["b", "a", "c"].map(key => ({ id: key, workspaceId, queueType, orderType: queueType, patientId: `patient-${key}`, patientName: `합성 환자 ${key}`, guardianName: "합성 보호자", encounterId: `encounter-${key}`, orderId: `order-${key}`, status: "requested", priority: "normal", assignedToUserId: key === "c" ? null : `user-${key}`, requestedByUserId: "synthetic-requester", requestCycle: 1, rowRevision: 1, createdAt: times[key], updatedAt: times[key], sourceSnapshot: { orderDisplayName: `합성 업무 ${key}` } }));
}
async function choose(page: Page, panel: ReturnType<Page["getByTestId"]>, trigger: string, option: string) {
  await panel.getByRole("button", { name: trigger, exact: true }).click();
  await page.getByRole("menuitemradio", { name: option, exact: true }).click();
  await expect(page.getByRole("menu")).toBeHidden();
}
for (const [id, name] of [["lab", "임상병리검사"], ["imaging", "영상검사"]]) {
  test(`${id} order-view sorts actual rows, retains source default and clears a filter on an empty date`, async ({ page }) => {
    await page.route("**/fulfillment/work-items?*", route => {
      const params = new URL(route.request().url()).searchParams;
      return route.fulfill({ json: { ok: true, workItems: params.get("date") === "2026-05-01" ? tasks(params.get("queueType")!) : [] } });
    });
    await page.goto(`/w/${workspaceId}/reception?date=2026-05-01&modulePanel=closed&right=closed`);
    const mainUrl = page.url();
    await page.getByRole("navigation", { name: "워크스페이스 주요 메뉴" }).getByRole("link", { name, exact: true }).hover();
    const host = page.getByTestId("module-side-panel-host");
    const panel = host.locator(`[data-side-panel-module="${id}"]:not([hidden])`);
    const cards = panel.locator(`[data-testid^="${id}-queue-item-live-${id}-"]`);
    const order = () => cards.evaluateAll(nodes => nodes.map(node => node.getAttribute("data-testid")!.split("-").at(-1)));
    await expect(panel.getByTestId("patient-queue-view-toggle")).toHaveAttribute("aria-pressed", "true");
    await panel.getByRole("button", { name: "오더별 보기", exact: true }).click();
    await expect(cards).toHaveCount(3);
    expect(await order()).toEqual(id === "imaging" ? ["b", "c", "a"] : ["b", "a", "c"]);
    if (id === "lab") await page.screenshot({ path: "/private/tmp/emr-sidebar-floating-pin.png" });
    await choose(page, panel, "대기열 정렬", "요청순");
    expect(await order()).toEqual(["a", "c", "b"]);
    await choose(page, panel, "대기열 정렬", "담당자순");
    expect(await order()).toEqual(["a", "b", "c"]);
    await choose(page, panel, "대기열 정렬", "대기 긴 순");
    expect(await order()).toEqual(["a", "c", "b"]);
    await choose(page, panel, "대기열 필터", "담당 미정");
    expect(await order()).toEqual(["c"]);
    await panel.getByRole("button", { name: "환자별 보기", exact: true }).click();
    await expect(panel.locator("[data-patient-queue-item]")).toHaveCount(1);
    await panel.getByRole("button", { name: "오더별 보기", exact: true }).click();
    expect(await order()).toEqual(["c"]);
    await panel.getByRole("button", { name: "다음 날짜", exact: true }).click();
    await expect(cards).toHaveCount(0);
    await expect(panel.getByRole("button", { name: "대기열 필터", exact: true })).toBeEnabled();
    await choose(page, panel, "대기열 필터", "전체 조건");
    await expect(panel.getByRole("button", { name: "대기열 필터", exact: true })).toBeDisabled();
    await expect(host).toHaveAttribute("data-panel-mode", "floating");
    expect(page.url()).toBe(mainUrl);
  });
}
test("billing preserves initial row order, applies request sorting and status filters without pinning", async ({ page }) => {
  await page.route("**/billing/queue?*", route => route.fulfill({ json: { ok: true, rows: ["b", "a", "c"].map(key => ({ invoice: { id: key, workspaceId, encounterId: `encounter-${key}`, invoiceNo: `SYN-${key}`, status: "draft", paymentState: key === "c" ? "unpaid" : "none", totalAmount: 10000, createdAt: times[key] }, encounter: { receptionType: "walk_in" }, patient: { name: `합성 환자 ${key}` }, guardian: { name: "합성 보호자" }, lineCount: 1, lineSummary: "합성 청구", requestedByName: "합성 직원" })) } }));
  await page.goto(`/w/${workspaceId}/reception?date=2026-05-01&modulePanel=closed&right=closed`);
  const initialUrl = page.url();
  await page.getByRole("navigation", { name: "워크스페이스 주요 메뉴" }).getByRole("link", { name: "수납", exact: true }).hover();
  const host = page.getByTestId("module-side-panel-host");
  const panel = host.locator('[data-side-panel-module="billing"]:not([hidden])');
  const cards = panel.locator('[data-testid^="billing-queue-item-"]');
  const order = () => cards.evaluateAll(nodes => nodes.map(node => node.getAttribute("data-testid")!.split("-").at(-1)));
  await expect(cards).toHaveCount(3);
  expect(await order()).toEqual(["b", "a", "c"]);
  await choose(page, panel, "정렬", "요청순");
  expect(await order()).toEqual(["a", "b", "c"]); // Existing status groups remain in their original order.
  await choose(page, panel, "필터", "미납");
  expect(await order()).toEqual(["c"]);
  await choose(page, panel, "필터", "전체 조건");
  await expect(cards).toHaveCount(3);
  await expect(host).toHaveAttribute("data-panel-mode", "floating");
  expect(page.url()).toBe(initialUrl);
});
test("reception filters actual assigned IDs and clears zero results", async ({ page }) => {
  await page.route("**/reception/calendar?*", route => route.fulfill({ json: { ok: true, status: 200, records: [] } }));
  await page.route("**/reception/queue?*", route => route.fulfill({ json: { ok: true, status: 200, queue: ["a", "b", "c"].map(key => ({
    kind: "encounter_queue",
    encounter: { id: `synthetic-encounter-${key}`, workspaceId, patientId: `synthetic-patient-${key}`, primaryVeterinarianId: key === "c" ? null : `unresolved-user-${key}`, encounterNo: `SYN-${key}`, receptionType: "walk_in", chiefComplaint: "합성 방문", status: "waiting", checkedInAt: times[key], createdAt: times[key], updatedAt: times[key] },
    queueEntry: { id: `synthetic-queue-${key}`, workspaceId, encounterId: `synthetic-encounter-${key}`, queueType: "consultation", status: "waiting", priority: "normal", sortOrder: 1, enteredAt: times[key] },
    patient: { id: `synthetic-patient-${key}`, workspaceId, patientNo: `SYN-${key}`, name: `합성 환자 ${key}`, species: "dog", sex: "male", handlingCautionLocked: false, status: "active", createdAt: times[key], updatedAt: times[key] },
  })) } }));
  await page.goto(`/w/${workspaceId}/reception?date=2026-05-01&modulePanel=closed&right=closed`);
  await page.getByRole("navigation", { name: "워크스페이스 주요 메뉴" }).getByRole("link", { name: "접수/예약", exact: true }).hover();
  const host = page.getByTestId("module-side-panel-host");
  const panel = host.locator('[data-side-panel-module="reception"]:not([hidden])');
  const cards = panel.locator('[data-testid^="patient-card-"]');
  await expect(cards).toHaveCount(3);
  await choose(page, panel, "필터", "담당 미정");
  await expect(cards).toHaveCount(1);
  await expect(cards).toContainText("합성 환자 c");
  await choose(page, panel, "필터", "예약");
  await expect(cards).toHaveCount(0);
  await expect(panel.getByText("조건에 맞는 접수/예약 항목이 없습니다")).toBeVisible();
  await panel.getByRole("button", { name: "필터 해제", exact: true }).click();
  await expect(cards).toHaveCount(3);
  await expect(panel.getByRole("button", { name: "필터", exact: true })).toHaveAttribute("data-filter", "all");
  await expect(host).toHaveAttribute("data-panel-mode", "floating");
});
