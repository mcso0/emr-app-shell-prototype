import { expect, test, type Locator, type Page } from "@playwright/test";

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
              id: "membership-cheongdam-side-panel-empty-state",
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
  const emptyResponse = {
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, queue: [], records: [], workItems: [] }),
  };

  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/chart/live-queue?*`,
    async (route) => route.fulfill(emptyResponse),
  );
  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/fulfillment/work-items?*`,
    async (route) => route.fulfill(emptyResponse),
  );
  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/operations/work-items?*`,
    async (route) =>
      route.fulfill({
        ...emptyResponse,
        body: JSON.stringify({
          ok: true,
          items: [],
          operatingDate: "2026-06-14",
          sourceStatus: "live",
        }),
      }),
  );
  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/reception/calendar/day?*`,
    async (route) =>
      route.fulfill({
        ...emptyResponse,
        body: JSON.stringify({ ok: true, records: [] }),
      }),
  );
  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/reception/queue?*`,
    async (route) =>
      route.fulfill({
        ...emptyResponse,
        body: JSON.stringify({ ok: true, queue: [], records: [] }),
      }),
  );
}

async function getMdContract(state: Locator) {
  return state.evaluate((section) => {
    const iconArea = section.querySelector<HTMLElement>('[data-slot="icon-area"]');
    const title = section.querySelector<HTMLElement>('[data-slot="copy"] h3');
    const description = section.querySelector<HTMLElement>('[data-slot="copy"] p');
    if (!iconArea || !title) return null;

    const resolveToken = (token: string) => {
      const probe = document.createElement("span");
      probe.style.color = `var(${token})`;
      document.body.appendChild(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    };

    return {
      description: description?.textContent?.trim() ?? "",
      iconAreaBackground: getComputedStyle(iconArea).backgroundColor,
      iconAreaHeight: getComputedStyle(iconArea).height,
      iconAreaWidth: getComputedStyle(iconArea).width,
      rootGap: getComputedStyle(section).gap,
      size: section.getAttribute("data-size"),
      titleColor: getComputedStyle(title).color,
      titleFontSize: getComputedStyle(title).fontSize,
      expectedIconAreaBackground: resolveToken("--clair-color-atomic-black-alpha-4"),
      expectedTitleColor: resolveToken("--clair-color-atomic-black-alpha-48"),
    };
  });
}

test("all module side-panel empty states use the CDS.V2 md contract", async ({ page }) => {
  test.setTimeout(120_000);

  await grantCheongdamWorkspaceAccess(page);
  await mockEmptyQueues(page);

  const cases = [
    { moduleId: "home", title: "원내 업무가 없습니다", scope: "home" },
    { moduleId: "reception", title: "접수/예약이 없습니다", scope: "aside" },
    { moduleId: "treatment", title: "진료 업무가 없습니다", scope: "aside" },
    { moduleId: "lab", title: "검사 업무가 없습니다", scope: "aside" },
    { moduleId: "imaging", title: "영상 업무가 없습니다", scope: "aside" },
    { moduleId: "dispensing", title: "조제/처치 업무가 없습니다", scope: "aside" },
    { moduleId: "billing", title: "수납 업무가 없습니다", scope: "aside" },
  ] as const;

  for (const emptyStateCase of cases) {
    await page.goto(
      `/w/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/${emptyStateCase.moduleId}?modulePanel=open&aside=closed&right=closed`,
    );

    const scope =
      emptyStateCase.scope === "home"
        ? page.getByTestId("home-side-panel-empty-state")
        : page.locator("aside").first();
    const state = scope
      .locator('section[data-surface="queue"][data-size="md"]')
      .filter({ hasText: emptyStateCase.title })
      .first();

    await expect(state).toBeVisible();
    await expect.poll(() => getMdContract(state)).toEqual({
      description: expect.any(String),
      iconAreaBackground: expect.any(String),
      iconAreaHeight: "32px",
      iconAreaWidth: "32px",
      rootGap: "8px",
      size: "md",
      titleColor: expect.any(String),
      titleFontSize: "14px",
      expectedIconAreaBackground: expect.any(String),
      expectedTitleColor: expect.any(String),
    });

    const contract = await getMdContract(state);
    expect(contract?.description).not.toBe("");
    expect(contract?.iconAreaBackground).toBe(contract?.expectedIconAreaBackground);
    expect(contract?.titleColor).toBe(contract?.expectedTitleColor);
  }
});
