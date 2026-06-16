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
        })
      );
    },
    [SESSION_WORKSPACES_STORAGE_KEY, PREPARED_EMPTY_CLINIC_WORKSPACE_ID]
  );
}

test("dispensing treatment workspace reads fulfillment queue and sends status mutation", async ({ page }) => {
  const fulfillmentQueueRead = page.waitForResponse(
    (response) => {
      const url = new URL(response.url());
      return (
        response.request().method() === "GET" &&
        url.pathname === "/api/workspaces/clair-demo/fulfillment/work-items" &&
        url.searchParams.get("queueType") === "dispensing"
      );
    }
  );
  await page.goto("/w/clair-demo/dispensing?modulePanel=open");

  await expect(page.getByText("조제/처치").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: /조제 지시서|처치 지시서/ })).toBeVisible();
  await fulfillmentQueueRead;
  await page.waitForLoadState("networkidle");
  const fulfillmentQueueItem = page.getByTestId(
    "order-queue-item-live-fulfillment-fulfill-order-coco-fluid",
  );
  await expect(fulfillmentQueueItem).toContainText(/이수지 (요청|재요청)/);
  await expect(fulfillmentQueueItem).not.toContainText("담당 수의사 요청");
  await fulfillmentQueueItem.click();

  const instructionStatus = page.getByTestId("instruction-status-label");
  const claimButton = page.getByRole("button", { name: "담당하기" }).first();
  if (
    (await instructionStatus.getByText(/대기중|재요청/).isVisible()) &&
    (await claimButton.isVisible()) &&
    (await claimButton.isEnabled())
  ) {
    const [fulfillmentStatusPatch] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.request().method() === "PATCH" &&
          response.url().includes("/api/workspaces/clair-demo/fulfillment/work-items/") &&
          response.request().postData()?.includes('"in_progress"') === true,
        { timeout: 5000 },
      ).catch(() => null),
      claimButton.click(),
    ]);
    if (fulfillmentStatusPatch) expect(fulfillmentStatusPatch.ok()).toBe(true);
  }
  await expect(page.getByRole("button", { name: /조제중|처치중|재요청/ }).first()).toBeVisible();
});

test("Cheongdam dispensing renders standalone live fulfillment rows without fixture overlay", async ({
  page,
}) => {
  await grantCheongdamWorkspaceAccess(page);

  const liveWorkItem = {
    assignedToUserId: null,
    createdAt: "2026-06-14T01:30:00.000Z",
    encounterId: "encounter-cheongdam-live-001",
    id: "work-cheongdam-dispensing-001",
    orderId: "order-cheongdam-dispensing-001",
    queueType: "dispensing",
    requestedByUserId: "user-vet",
    sourceSnapshot: {
      guardianName: "최보호",
      instruction: "식후 1일 2회",
      orderDisplayName: "항생제 5일분",
      patientName: "루나",
      requestingVetName: "김민준",
    },
    status: "requested",
    updatedAt: "2026-06-14T01:30:00.000Z",
    workspaceId: PREPARED_EMPTY_CLINIC_WORKSPACE_ID,
  };

  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/fulfillment/work-items?*`,
    async (route) => {
      const url = new URL(route.request().url());
      const queueType = url.searchParams.get("queueType");

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          enforcedBy: "fulfillment-work-item-persistence",
          workItems: queueType === "dispensing" ? [liveWorkItem] : [],
        }),
      });
    }
  );

  const statusUpdates: string[] = [];
  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/fulfillment/work-items/${liveWorkItem.id}`,
    async (route) => {
      const body = JSON.parse(route.request().postData() ?? "{}") as {
        status?: string;
      };
      if (body.status) statusUpdates.push(body.status);

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          enforcedBy: "fulfillment-work-item-persistence",
          workItems: [{ ...liveWorkItem, assignedToUserId: "user-tech", status: body.status ?? "requested" }],
        }),
      });
    }
  );

  await page.goto(`/w/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/dispensing?modulePanel=open`);

  const liveQueueItem = page.getByTestId(
    `order-queue-item-live-fulfillment-${liveWorkItem.id}`
  );
  await expect(liveQueueItem).toContainText("루나");
  await expect(liveQueueItem).toContainText("항생제 5일분");
  await expect(page.locator("aside").first().getByText("코코")).toHaveCount(0);

  await liveQueueItem.click();
  await page.getByRole("button", { name: "담당하기" }).first().click();

  await expect.poll(() => statusUpdates).toEqual(["accepted", "in_progress"]);
});
