import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const workspaceTabsRoute = "/api/workspaces/clair-demo/app-shell/workspace-tabs";
const homeRoute = "/w/clair-demo/home?modulePanel=open";

async function resetWorkspaceTabs(page: Page) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });

  const responseStatus = await page.evaluate(
    async ({ homeRoute: routeToOpen, route }) => {
      const response = await fetch(route, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-clair-demo-session-user-id": "playwright-default-session",
        },
        body: JSON.stringify({
          activeTabId: "tab-gnb-icons-reset",
          tabs: [
            {
              id: "tab-gnb-icons-reset",
              title: "원내 현황",
              closable: false,
              history: [routeToOpen],
              historyIndex: 0,
              moduleId: "home",
              surfaceType: "module",
              surfaceId: "home",
              dedupeKey: "clair-demo:module:home",
              lastRoute: routeToOpen,
              updatedAt: "2026-07-12T00:00:00.000Z",
            },
          ],
        }),
      });

      return response.status;
    },
    { homeRoute, route: workspaceTabsRoute },
  );

  expect(responseStatus).toBe(200);
  await page.evaluate(() => {
    window.sessionStorage.removeItem("clair-workspace-tabs:v1:clair-demo");
    window.localStorage.removeItem("clair-workspace-tabs-duplicate-warning-hidden:v1:clair-demo");
  });
}

function getNavRail(page: Page) {
  return page.getByRole("navigation", { name: "워크스페이스 주요 메뉴" });
}

function getWorkspaceTablist(page: Page) {
  return page.getByRole("tablist", { name: "열린 업무 탭" });
}

test("navigation rail and workspace tabs use the canonical GNB SVG viewBox", async ({ page }) => {
  await resetWorkspaceTabs(page);
  await page.goto(homeRoute);

  const homeNavIcon = getNavRail(page).getByTestId("nav-rail-active-item").locator("svg");
  const homeTabIcon = getWorkspaceTablist(page)
    .getByRole("tab", { name: "원내 현황" })
    .locator("svg");

  await expect(homeNavIcon).toHaveAttribute("viewBox", "0 0 24 24");
  await expect(homeTabIcon).toHaveAttribute("viewBox", "0 0 24 24");

  await getNavRail(page).getByRole("link", { name: "접수/예약" }).click();
  await expect(
    getWorkspaceTablist(page).getByRole("tab", { name: "접수/예약" }),
  ).toHaveAttribute("aria-selected", "true");

  const receptionNavIcon = getNavRail(page).getByTestId("nav-rail-active-item").locator("svg");
  const receptionTabIcon = getWorkspaceTablist(page)
    .getByRole("tab", { name: "접수/예약" })
    .locator("svg");

  await expect(receptionNavIcon).toHaveAttribute("viewBox", "0 0 24 24");
  await expect(receptionTabIcon).toHaveAttribute("viewBox", "0 0 24 24");
});
