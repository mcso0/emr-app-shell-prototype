import { expect, test, type Page, type Route } from "@playwright/test";

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

test("reception queue loading uses the side-panel body motion state instead of top loading copy", async ({
  page,
}) => {
  const queueRoute = await delayRouteUntilAsserted(
    page,
    "**/api/workspaces/clair-demo/reception/queue?*",
  );

  await page.goto("/w/clair-demo/reception?modulePanel=open");

  await expect(
    page.getByText("접수/예약 정보를 불러오는 중입니다."),
  ).toBeVisible();
  await expect(page.getByText("대기열 확인 중")).toHaveCount(0);

  await queueRoute.release();
});

test("chart queue loading uses the shared side-panel body motion state", async ({
  page,
}) => {
  const liveQueueRoute = await delayRouteUntilAsserted(
    page,
    "**/api/workspaces/clair-demo/chart/live-queue?*",
  );

  await page.goto("/w/clair-demo/treatment?modulePanel=open&aside=closed");

  await expect(
    page.getByText("진료차트 정보를 불러오는 중입니다."),
  ).toBeVisible();

  await liveQueueRoute.release();
});
