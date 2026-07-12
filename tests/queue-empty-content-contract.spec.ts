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

async function mockEmptyQueues(page: Page) {
  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/chart/live-queue?*`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, queue: [], records: [] }),
      });
    },
  );
  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/fulfillment/work-items?*`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, workItems: [] }),
      });
    },
  );
  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/operations/work-items?*`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          items: [],
          operatingDate: "2026-06-14",
          sourceStatus: "live",
        }),
      });
    },
  );
}

async function expectWorkspaceDetailSlotsClosed(page: Page) {
  const workspaceMain = page.getByTestId("workspace-frame").locator("main");

  await expect(workspaceMain).toHaveAttribute("data-content-aside-open", "false");
  await expect(workspaceMain).toHaveAttribute("data-right-panel-open", "false");
}

async function expectEmptyStateCentered(page: Page, heading: string) {
  const emptyState = page
    .locator('section[data-surface="content"]')
    .filter({ has: page.getByRole("heading", { name: heading, exact: true }) })
    .first();

  await expect(emptyState).toBeVisible();

  await expect
    .poll(async () => {
      const workspaceBox = await page.getByTestId("workspace-frame").locator("main").boundingBox();
      const emptyBox = await emptyState.boundingBox();

      if (!workspaceBox || !emptyBox) return null;

      return Math.round(
        Math.abs(
          workspaceBox.x +
            workspaceBox.width / 2 -
            (emptyBox.x + emptyBox.width / 2),
        ),
      );
    })
    .toBeLessThanOrEqual(24);
}

test("no-selection empty states own the content area without detail slots", async ({
  page,
}) => {
  test.setTimeout(60_000);

  await grantCheongdamWorkspaceAccess(page);
  await mockEmptyQueues(page);

  const emptyStateCases = [
    {
      moduleId: "home",
      query: "?modulePanel=open&right=open&aside=history",
      heading: "원내 업무가 없습니다",
      absentSelectors: ["#home-work-status-detail"],
    },
    {
      moduleId: "treatment",
      query: "?modulePanel=open&aside=history",
      heading: "진료 업무가 없습니다",
      absentSelectors: ["#chart-content-aside"],
    },
    {
      moduleId: "lab",
      query: "?modulePanel=open&right=open&aside=history",
      heading: "검사 업무가 없습니다",
      absentSelectors: ["#lab-content-aside", "#lab-receipt-panel"],
    },
    {
      moduleId: "imaging",
      query: "?modulePanel=open&right=open&aside=history",
      heading: "영상 업무가 없습니다",
      absentSelectors: ["#imaging-content-aside", "[data-testid='imaging-summary-panel']"],
    },
    {
      moduleId: "dispensing",
      query: "?modulePanel=open&right=open&aside=history",
      heading: "조제/처치 업무가 없습니다",
      absentSelectors: ["#dispensing-content-aside"],
    },
    {
      moduleId: "billing",
      query: "?modulePanel=open&right=open&aside=history",
      heading: "수납 업무가 없습니다",
      absentSelectors: ["#billing-content-aside", "[data-testid='billing-payment-summary-panel']"],
    },
  ];

  for (const emptyStateCase of emptyStateCases) {
    await page.goto(
      `/w/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/${emptyStateCase.moduleId}${emptyStateCase.query}`,
    );

    await expectEmptyStateCentered(page, emptyStateCase.heading);
    await expectWorkspaceDetailSlotsClosed(page);

    for (const selector of emptyStateCase.absentSelectors) {
      await expect(page.locator(selector)).toHaveCount(0);
    }
  }
});

test("selected detail keeps the workspace detail slots available", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/lab?modulePanel=open&right=open&aside=history");

  const workspaceMain = page.getByTestId("workspace-frame").locator("main");

  await expect(workspaceMain).toHaveAttribute("data-content-aside-open", "true");
  await expect(workspaceMain).toHaveAttribute("data-right-panel-open", "true");
  await expect(page.locator("#lab-content-aside")).toBeVisible();
  await expect(page.locator("#lab-receipt-panel")).toBeVisible();
});
