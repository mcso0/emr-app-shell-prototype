import { expect, test, type Page } from "@playwright/test";

const counts = { badge: 1, unread: 1, important: 1, archived: 0 };
const notification = {
  id: "notification-shell-synthetic", eventKey: "clinical_result_completed",
  dedupeKey: "notification-shell-synthetic", domain: "lab", priority: "high",
  requiresAction: true, badgeCount: true, toastPolicy: "drawer_only",
  title: "합성 검사 결과", preview: "합성 알림 상태 검증", detail: "합성 알림 상세",
  workTypeLabel: "합성 검사", sourceLabel: "합성 원본", sourceActionLabel: "합성 원본 열기",
  sourceKind: "lab_result", sourceEntityId: "source-shell-synthetic",
  sourceRoute: "/w/clair-demo/lab?modulePanel=open&labResultId=source-shell-synthetic",
  recipientKind: "user", recipientId: "user-admin", recipientLabel: "합성 관리자",
  issuedAtLabel: "방금", createdAt: "2026-10-11T00:00:00Z", updatedAt: "2026-10-11T00:00:00Z",
  readAt: null, archivedAt: null,
};
const snapshot = (rows: object[] = [notification], totals = counts) => ({
  ok: true, status: 200, workspaceId: "clair-demo", notifications: rows,
  counts: totals, nextCursor: null, enforcedBy: "live-notification-reader",
});
const diagnostics = new WeakMap<Page, { external: string[]; errors: string[] }>();

test.beforeEach(async ({ page, baseURL }) => {
  const state = { external: [] as string[], errors: [] as string[] };
  diagnostics.set(page, state);
  page.on("pageerror", error => state.errors.push(error.message));
  await page.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.origin !== baseURL) {
      state.external.push(url.origin + url.pathname);
      await route.abort("blockedbyclient");
      return;
    }
    await route.fallback();
  });
});

test.afterEach(async ({ page }, info) => {
  const state = diagnostics.get(page)!;
  await info.attach("synthetic-notification-traffic", {
    body: JSON.stringify(state), contentType: "application/json",
  });
  expect(state.external).toEqual([]);
  expect(state.errors).toEqual([]);
});

async function openDrawer(page: Page) {
  await page.goto("/w/clair-demo/reception?modulePanel=open");
  await page.getByRole("button", { name: /^알림 센터 열기/ }).click();
  return page.getByRole("dialog", { name: "알림" });
}

test("global notification pending snapshot keeps loading separate from empty", async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/workspaces/clair-demo/notifications?**", async route => {
    await pending;
    await route.fulfill({ json: snapshot([], { badge: 0, unread: 0, important: 0, archived: 0 }) });
  });
  const drawer = await openDrawer(page);
  await expect(drawer.getByTestId("global-notification-loading-state")).toBeVisible();
  await expect(drawer.getByText("표시할 알림이 없습니다.")).toHaveCount(0);
  release();
  await expect(drawer.getByTestId("global-notification-loading-state")).toBeHidden();
  await expect(drawer.getByText("표시할 알림이 없습니다.")).toBeVisible();
});

test("global notification failed snapshot retries without retaining an error", async ({ page }) => {
  let requests = 0;
  await page.route("**/api/workspaces/clair-demo/notifications?**", async route => {
    requests += 1;
    await route.fulfill(requests === 1
      ? { status: 503, json: { ok: false, status: 503, error: { message: "합성 알림 조회 실패" } } }
      : { json: snapshot() });
  });
  const drawer = await openDrawer(page);
  await expect(drawer.getByTestId("global-notification-error-state")).toBeVisible();
  await drawer.getByRole("button", { name: "다시 시도", exact: true }).click();
  await expect(drawer.getByTestId("global-notification-row-notification-shell-synthetic")).toBeVisible();
  await expect(drawer.getByTestId("global-notification-error-state")).toHaveCount(0);
  expect(requests).toBe(2);
});

test("global notification failed source read keeps the drawer and current route", async ({ page }) => {
  await page.route("**/api/workspaces/clair-demo/notifications?**", route => route.fulfill({ json: snapshot() }));
  const reads: string[] = [];
  await page.route("**/notifications/notification-shell-synthetic/read", async route => {
    reads.push(route.request().method());
    await route.fulfill({ status: 503, json: { ok: false, status: 503 } });
  });
  const drawer = await openDrawer(page);
  const response = page.waitForResponse(value => new URL(value.url()).pathname.endsWith("/notification-shell-synthetic/read"));
  await drawer.getByRole("button", { name: "합성 원본 열기", exact: true }).click();
  expect((await response).status()).toBe(503);
  await expect(page).toHaveURL(/\/w\/clair-demo\/reception\?/);
  await expect(drawer).toBeVisible();
  await expect(page.getByTestId("global-notification-badge")).toHaveText("1");
  expect(reads).toEqual(["POST"]);
});

test("global notification unsupported source route uses detail and acknowledges the event", async ({ page }) => {
  await page.route("**/api/workspaces/clair-demo/notifications?**", route => route.fulfill({
    json: snapshot([{ ...notification, sourceRoute: "/unsupported-source", fallbackReason: "missing_source" }]),
  }));
  let reads = 0;
  await page.route("**/notifications/notification-shell-synthetic/read", async route => {
    reads += 1;
    await route.fulfill({ json: { ok: true, status: 200, counts, enforcedBy: "live-notification-writer" } });
  });
  const drawer = await openDrawer(page);
  await drawer.getByRole("button", { name: "합성 원본 열기", exact: true }).click();
  await expect(drawer.getByTestId("global-notification-fallback-detail")).toBeVisible();
  await expect(page).toHaveURL(/\/w\/clair-demo\/reception\?/);
  await expect.poll(() => reads).toBe(1);
});
