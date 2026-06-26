import { readFileSync } from "node:fs";

import { expect, test, type Page, type Route } from "@playwright/test";

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

function createDeferredRoute() {
  let fulfillRoute: ((route: Route) => Promise<void>) | undefined;
  const pending = new Promise<void>((resolve) => {
    fulfillRoute = async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, queue: [], records: [] }),
      });
      resolve();
    };
  });

  return {
    pending,
    async release(route: Route) {
      if (!fulfillRoute) throw new Error("Deferred route was not initialized");
      await fulfillRoute(route);
    },
  };
}

async function delayRouteUntilAsserted(page: Page, url: string) {
  const deferred = createDeferredRoute();
  let capturedRoute: Route | undefined;

  await page.route(url, async (route) => {
    capturedRoute = route;
    await deferred.pending;
  });

  return {
    async release() {
      if (!capturedRoute) throw new Error(`No route captured for ${url}`);
      await deferred.release(capturedRoute);
    },
  };
}

async function getQueueStateIconBoxSize(page: Page, stateText: string) {
  return page.getByText(stateText, { exact: true }).evaluate((textElement) => {
    const iconElement = textElement.previousElementSibling;
    if (!iconElement) return null;

    const box = iconElement.getBoundingClientRect();
    return {
      height: Math.round(box.height),
      width: Math.round(box.width),
    };
  });
}

async function getQueueStateIconRootTagName(page: Page, stateText: string) {
  return page.getByText(stateText, { exact: true }).evaluate((textElement) => {
    const iconElement = textElement.previousElementSibling;
    return iconElement?.firstElementChild?.tagName ?? null;
  });
}

test("reception queue loading uses the side-panel body motion state instead of top loading copy", async ({
  page,
}) => {
  await grantCheongdamWorkspaceAccess(page);

  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/reception/calendar/day?*`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, status: 200, records: [] }),
      });
    },
  );
  const queueRoute = await delayRouteUntilAsserted(
    page,
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/reception/queue?*`,
  );

  await page.goto(
    `/w/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/reception?modulePanel=open`,
  );

  await expect(
    page.getByText("접수/예약 정보를 불러오는 중입니다."),
  ).toBeVisible();
  await expect(page.getByText("대기열 확인 중")).toHaveCount(0);

  await queueRoute.release();
});

test("reception queue loading and empty states keep the same icon box size", async ({
  page,
}) => {
  await grantCheongdamWorkspaceAccess(page);

  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/reception/calendar/day?*`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, status: 200, records: [] }),
      });
    },
  );
  const queueRoute = await delayRouteUntilAsserted(
    page,
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/reception/queue?*`,
  );

  await page.goto(
    `/w/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/reception?modulePanel=open`,
  );
  await expect(
    page.getByText("접수/예약 정보를 불러오는 중입니다."),
  ).toBeVisible();

  await expect
    .poll(async () => getQueueStateIconBoxSize(
      page,
      "접수/예약 정보를 불러오는 중입니다.",
    ))
    .toEqual({ height: 56, width: 56 });

  await queueRoute.release();
  await expect(page.getByText("접수/예약이 없습니다")).toBeVisible();

  await expect
    .poll(async () => getQueueStateIconBoxSize(
      page,
      "접수/예약이 없습니다",
    ))
    .toEqual({ height: 56, width: 56 });
  await expect
    .poll(async () => getQueueStateIconRootTagName(
      page,
      "접수/예약이 없습니다",
    ))
    .toBe("DIV");
});

test("chart queue loading uses the shared side-panel body motion state", async ({
  page,
}) => {
  await grantCheongdamWorkspaceAccess(page);

  const liveQueueRoute = await delayRouteUntilAsserted(
    page,
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/chart/live-queue?*`,
  );

  await page.goto(
    `/w/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/treatment?modulePanel=open&aside=closed`,
  );

  await expect(
    page.getByText("진료차트 정보를 불러오는 중입니다."),
  ).toBeVisible();

  await liveQueueRoute.release();
});

test("queue panels keep visible queue rows ahead of background loading states", () => {
  const receptionModule = readFileSync("src/features/reception/module.tsx", "utf8");
  const orderQueuePanel = readFileSync("src/components/emr/order-queue-side-panel.tsx", "utf8");
  const labImagingModule = readFileSync("src/features/lab-imaging/module.tsx", "utf8");

  expect(receptionModule).toContain(
    'const showQueueLoadingState = queueReadStatus === "loading" && visibleQueueGroups.length === 0;',
  );
  expect(orderQueuePanel).toContain(
    "const showLoadingState = loading && groupedItems.length === 0;",
  );
  expect(labImagingModule).toContain(
    'const showLabQueueLoadingState = fulfillmentQueue.status === "loading" && resultCount === 0;',
  );
  expect(labImagingModule).toContain(
    'const showImagingQueueLoadingState = fulfillmentQueue.status === "loading" && resultCount === 0;',
  );
});

test("reception live read effect does not restart only because profile rows hydrate", () => {
  const receptionModule = readFileSync("src/features/reception/module.tsx", "utf8");

  expect(receptionModule).toContain(
    "const currentPatients = usePatientProfileStore.getState().patients;",
  );
  expect(receptionModule).not.toMatch(
    /const refreshReceptionReads = useCallback\([\s\S]*?\n\s+patients,\n\s+setReceptionCalendarReadStatus,/,
  );
});
