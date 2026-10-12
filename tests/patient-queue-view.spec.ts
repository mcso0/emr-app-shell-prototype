import { expect, test, type Page } from "@playwright/test";
import { SESSION_WORKSPACES_STORAGE_KEY } from "../src/features/auth/workspace-session";
import { PREPARED_EMPTY_CLINIC_WORKSPACE_ID } from "../src/lib/emr-domain/demo-workspaces";
async function grantCheongdamWorkspaceAccess(page: Page) {
  await page.addInitScript(
    ([storageKey, workspaceId]) => {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          currentWorkspaceId: workspaceId,
          workspaces: [
            {
              id: workspaceId,
              displayName: "VIP동물의료센터 청담점",
              representativeName: "김승욱",
              contactEmail: "owner@cheongdam.test",
              contactPhone: null,
              subscriptionStatus: "trialing",
              createdBySessionId: "playwright-default-session",
              createdAt: "2026-06-14T00:00:00.000Z",
            },
          ],
          memberships: [
            {
              id: "membership-cheongdam-playwright-admin",
              workspaceId,
              userSessionId: "playwright-default-session",
              displayName: "Playwright Admin",
              email: "admin@cheongdam.test",
              roles: ["hospital_admin"],
              status: "active",
              createdAt: "2026-06-14T00:00:00.000Z",
              activatedAt: "2026-06-14T00:00:00.000Z",
            },
          ],
          invitations: [],
          updatedAt: "2026-06-14T00:00:00.000Z",
        }),
      );
    },
    [SESSION_WORKSPACES_STORAGE_KEY, PREPARED_EMPTY_CLINIC_WORKSPACE_ID],
  );
}


const workspaceId = PREPARED_EMPTY_CLINIC_WORKSPACE_ID;
function fixture(queueType: string) {
  return [0,1,2,3,4].map(n => ({
    id: `synthetic-${queueType}-${n}`, workspaceId, queueType, orderType: queueType,
    patientId: n < 3 ? "synthetic-patient-a" : n === 3 ? "synthetic-patient-b" : null,
    patientName: n === 4 ? "합성 출처 미상" : "합성 동명이인", guardianName: "합성 보호자",
    encounterId: `synthetic-encounter-${n}`, orderId: `synthetic-order-${queueType}-${n}`,
    status: n === 1 ? "returned" : n === 2 ? "paused" : "requested", priority: n === 3 ? "urgent" : "normal",
    assignedToUserId: n === 2 ? "unknown-assigned-user" : null, requestedByUserId: "user-vet", requesterName: "합성 요청자",
    requestCycle: 1, rowRevision: 1, originChartId: n < 3 ? `synthetic-chart-${n}` : null,
    originChartCreatedAt: n < 3 ? "2026-10-02T01:00:00Z" : null,
    createdAt: `2026-10-03T01:0${n}:00Z`, updatedAt: `2026-10-03T01:0${n}:00Z`,
    sourceSnapshot: { orderDisplayName: `합성 업무 ${n}`, inHospitalOrderName: `합성 업무 ${n}`, patientName: n === 4 ? "합성 출처 미상" : "합성 동명이인", guardianName: "합성 보호자" },
  }));
}
for (const queueModule of ["lab", "imaging", "dispensing"]) {
  test(`${queueModule} patient view separates identities and preserves exact selection and hidden detail`, async ({ page }) => {
    await grantCheongdamWorkspaceAccess(page);
    const writes: string[] = [];
    let denied = false;
    await page.route(`**/api/workspaces/${workspaceId}/**`, async route => {
      const url = new URL(route.request().url());
      if (route.request().method() !== "GET" && url.pathname.includes("/fulfillment/")) writes.push(route.request().method());
      if (!url.pathname.endsWith("/fulfillment/work-items")) { await route.fulfill({ json: { ok: true, items: [], workItems: [], rows: [], receipts: [], attachments: [] } }); return; }
      if (denied) { await route.fulfill({ status: 401, contentType: "text/html", body: "Unauthenticated" }); return; }
      const q = url.searchParams.get("queueType")!;
      const data = queueModule === "dispensing" ? fixture(q).filter((_, index) => q === "treatment" ? index >= 3 : index < 3) : q === "treatment" ? [] : fixture(q);
      await route.fulfill({ json: { ok: true, workItems: data } });
    });
    await page.setViewportSize({ width: 1336, height: 870 });
    await page.goto(`/w/${workspaceId}/${queueModule}?date=2026-10-03&modulePanel=open&aside=closed&right=closed`);
    const toggle = page.getByTestId("patient-queue-view-toggle");
    await expect(toggle).toBeEnabled();
    await toggle.hover();
    await expect(page.getByRole("tooltip")).toContainText("오더별 보기로 전환");
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    const groups = page.locator('section[data-testid^="patient-queue-group-"]');
    await expect(groups).toHaveCount(3);
    await expect(groups.first()).toContainText("긴급 1");
    await expect(groups.filter({ hasText: "재요청 1" })).not.toContainText("기록 1");
    await expect(groups.filter({ hasText: "출처 차트 미확인" })).toHaveCount(0);
    const id = queueModule === "dispensing" ? "live-fulfillment-synthetic-dispensing-1" : `live-${queueModule}-synthetic-${queueModule}-1`;
    const target = page.locator(`[data-patient-queue-item="${id}"]`);
    await target.click();
    await expect(page).toHaveURL(new RegExp(id));
    const url = page.url();
    await toggle.click();
    await expect(page).toHaveURL(url);
    await toggle.click();
    await expect(page).toHaveURL(url);
    await page.getByRole("button", { name: "대기열 필터", exact: true }).click();
    await page.getByRole("menuitemradio", { name: queueModule === "dispensing" ? "대기중" : "대기", exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toBeHidden();
    await expect(page.getByText("선택한 업무는 현재 검색·필터에 포함되지 않습니다.", { exact: false })).toBeVisible();
    await expect(page).toHaveURL(url);
    await page.getByRole("button", { name: "조건 해제하고 보기" }).click();
    await expect(target).toBeVisible();
    expect(writes).toEqual([]);
    await page.screenshot({ path: `/private/tmp/clair-queue-implementation-${queueModule}.png` });
    denied = true;
    await page.getByRole("button", { name: "다음 날짜", exact: true }).click();
    await expect(page.getByTestId("patient-queue-view-toggle")).toBeDisabled();
    await page.getByRole("button", { name: "이전 날짜", exact: true }).click();
    await expect(page.getByTestId("patient-queue-view-toggle")).toBeDisabled();
    await expect(groups).toHaveCount(0);
    await expect(page.locator('[data-patient-queue-item]')).toHaveCount(0);
  });
}

for (const [dispensingStatus, treatmentStatus] of [[500,401],[500,403],[403,500],[200,403],[0,401]]) {
  test(`combined queue denial overrides other response ${dispensingStatus}/${treatmentStatus}`, async ({ page }) => {
    await grantCheongdamWorkspaceAccess(page);
    let failure = false;
    await page.route(`**/api/workspaces/${workspaceId}/fulfillment/work-items?*`, async route => {
      const q = new URL(route.request().url()).searchParams.get("queueType")!;
      const status = failure ? q === "treatment" ? treatmentStatus : dispensingStatus : 200;
      if (status === 0) { await route.abort("failed"); return; }
      if (status === 500) { await route.fulfill({ status, contentType: "text/html", body: "Synthetic upstream failure" }); return; }
      await route.fulfill({ status, json: status === 200 ? { ok: true, workItems: q === "treatment" ? [] : fixture(q) } : { ok: false, denialReason: status === 401 ? "unauthenticated" : status === 403 ? "permission_missing" : "read_failed" } });
    });
    await page.goto(`/w/${workspaceId}/dispensing?date=2026-10-03&modulePanel=open&aside=closed`);
    await expect(page.getByTestId("patient-queue-view-toggle")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('section[data-testid^="patient-queue-group-"]')).toHaveCount(3);
    failure = true;
    await page.getByRole("button", { name: "다음 날짜", exact: true }).click();
    await expect(page.getByTestId("patient-queue-view-toggle")).toBeDisabled();
    await page.getByRole("button", { name: "이전 날짜", exact: true }).click();
    await expect(page.getByTestId("patient-queue-view-toggle")).toBeDisabled();
    await expect(page.locator('[data-patient-queue-item]')).toHaveCount(0);
    await expect(page.locator('section[data-testid^="patient-queue-group-"]')).toHaveCount(0);
    const types = page.getByRole("group", { name: "오더 유형 필터" });
    await expect(types).toContainText("전체0조제0처치0");
  });
}


test("queue choices persist independently through reload and a new browser session", async ({ page, browser }) => {
  await grantCheongdamWorkspaceAccess(page);
  const mockQueues = async (target: Page) => {
    await target.route("**/api/**", route => {
      const url = new URL(route.request().url());
      const q = url.searchParams.get("queueType");
      return route.fulfill({ json: url.pathname.endsWith("/fulfillment/work-items")
        ? { ok: true, workItems: fixture(q!) }
        : { ok: true, items: [], workItems: [], rows: [], receipts: [], attachments: [] } });
    });
  };
  await mockQueues(page);
  const visit = async (target: Page, queueModule: string) => {
    await target.goto(`/w/${workspaceId}/${queueModule}?date=2026-10-03&modulePanel=open&aside=closed&right=closed`);
    const toggle = target.getByTestId("patient-queue-view-toggle");
    await expect(toggle).toBeEnabled();
    return toggle;
  };
  for (const queueModule of ["lab", "imaging", "dispensing"]) {
    const toggle = await visit(page, queueModule);
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await page.reload();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    if (queueModule === "imaging") {
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-pressed", "true");
    }
  }
  // A new browser context restores persisted storage without retaining React state.
  const context = await browser.newContext({ baseURL: new URL(page.url()).origin, storageState: await page.context().storageState() });
  const reopened = await context.newPage();
  await mockQueues(reopened);
  try {
    for (const queueModule of ["lab", "imaging", "dispensing"]) {
      const toggle = await visit(reopened, queueModule);
      await expect(toggle).toHaveAttribute("aria-pressed", queueModule === "imaging" ? "true" : "false");
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-pressed", queueModule === "imaging" ? "false" : "true");
    }
  } finally { await context.close(); }
});
