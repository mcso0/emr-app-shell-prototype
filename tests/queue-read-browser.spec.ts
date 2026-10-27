import { expect, test } from "@playwright/test";
import { SESSION_WORKSPACES_STORAGE_KEY } from "../src/features/auth/workspace-session";
import { PREPARED_EMPTY_CLINIC_WORKSPACE_ID as workspaceId } from "../src/lib/emr-domain/demo-workspaces";

const date = "2026-10-27";
test.beforeEach(async ({ page }) => {
  await page.route("**/*", route => {
    const hostname = new URL(route.request().url()).hostname;
    return hostname === "127.0.0.1" ? route.fallback() : route.abort();
  });
  await page.addInitScript(({ key, workspaceId }) => {
    localStorage.setItem(key, JSON.stringify({ currentWorkspaceId: workspaceId, workspaces: [{ id: workspaceId, displayName: "합성 병원", representativeName: "합성 관리자", contactEmail: "owner@synthetic.test", contactPhone: null, subscriptionStatus: "trialing", createdBySessionId: "playwright-default-session", createdAt: "2026-10-27T00:00:00Z" }], memberships: [{ id: "synthetic-membership", workspaceId, userSessionId: "playwright-default-session", displayName: "합성 관리자", email: "admin@synthetic.test", roles: ["hospital_admin"], status: "active", createdAt: "2026-10-27T00:00:00Z", activatedAt: "2026-10-27T00:00:00Z" }], invitations: [], updatedAt: "2026-10-27T00:00:00Z" }));
  }, { key: SESSION_WORKSPACES_STORAGE_KEY, workspaceId });
});

test("actual panel and content share initial queue GETs and preserve empty refresh and denial", async ({ page }) => {
  const requests: string[] = [];
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let status = 200;
  await page.route(`**/api/workspaces/${workspaceId}/fulfillment/work-items?*`, async route => {
    requests.push(route.request().url()); await gate;
    await route.fulfill({ status, json: { ok: status === 200, workItems: [], denialReason: status === 403 ? "permission_missing" : undefined } });
  });
  await page.goto(`/w/${workspaceId}/dispensing?date=${date}&modulePanel=open&aside=closed`);
  await expect.poll(() => requests.length).toBe(2);
  expect(requests.map(url => new URL(url).searchParams.get("queueType")).sort()).toEqual(["dispensing", "treatment"]);
  release();
  await expect(page.getByTestId("dispensing-content-empty-state").getByRole("heading", { name: "조제/처치 업무가 없습니다", exact: true })).toBeVisible();
  expect(requests).toHaveLength(2);
  status = 403;
  await page.getByTestId("dispensing-content-empty-state").getByRole("button", { name: "새로고침", exact: true }).click();
  await expect(page.getByText("조제/처치 업무 큐 권한이 없습니다.", { exact: true })).toBeVisible();
  expect(requests).toHaveLength(4);
  await test.info().attach("queue-request-counts", { body: JSON.stringify({ initialGETs: 2, afterExplicitRefresh: requests.length }), contentType: "application/json" });
});

test("actual reception effect coalesces return events after a fast reply and preserves manual refresh", async ({ page }) => {
  const counts = { calendar: 0, queue: 0 };
  await page.route(`**/api/workspaces/${workspaceId}/staff?*`, route => route.fulfill({ json: { ok: true, staff: [] } }));
  await page.route(`**/api/workspaces/${workspaceId}/reception/calendar/day?*`, route => {
    counts.calendar++;
    return route.fulfill({ json: { ok: true, status: 200, workspaceId, date, records: [], operatingSchedule: { date, timezone: "Asia/Seoul", isOpen: true, source: "weekly", treatmentStart: "09:00", treatmentEnd: "19:00", breakStart: "13:00", breakEnd: "14:00" } } });
  });
  await page.route(`**/api/workspaces/${workspaceId}/reception/queue?*`, route => {
    counts.queue++;
    return route.fulfill({ json: { ok: true, status: 200, queue: [], summary: { workspaceId, date, totalCount: 0, appointmentCount: 0, receptionCount: 0 } } });
  });
  await page.goto(`/w/${workspaceId}/reception?date=${date}&modulePanel=open&aside=closed`);
  await expect(page.getByRole("button", { name: "접수/예약 새로고침", exact: true })).toBeVisible();
  await expect.poll(() => counts.queue).toBeGreaterThan(0);
  // Wait for real initial requests, not a synthetic simultaneous-event shortcut.
  await page.waitForLoadState("networkidle");
  const before = { ...counts };
  await page.evaluate(() => { document.dispatchEvent(new Event("visibilitychange")); });
  await expect.poll(() => counts.queue).toBe(before.queue + 1);
  await page.evaluate(() => { window.dispatchEvent(new Event("focus")); });
  await page.waitForLoadState("networkidle");
  expect(counts).toEqual({ calendar: before.calendar + 1, queue: before.queue + 1 });
  await page.getByRole("button", { name: "접수/예약 새로고침", exact: true }).click();
  await expect.poll(() => counts.queue).toBe(before.queue + 2);
  await test.info().attach("reception-return-counts", { body: JSON.stringify({ before, afterManualRefresh: counts, mode: "mock calendar+queue fallback; one refresh per paired return" }), contentType: "application/json" });
});
