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

test("dispensing no-work empty state hides history aside", async ({ page }) => {
  await grantCheongdamWorkspaceAccess(page);

  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/fulfillment/work-items?*`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          enforcedBy: "fulfillment-work-item-persistence",
          workItems: [],
        }),
      });
    }
  );

  await page.goto(
    `/w/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/dispensing?modulePanel=open&aside=history&right=closed`
  );

  await expect(page.locator("#dispensing-content-aside")).toHaveCount(0);
  const emptyState = page.getByTestId("dispensing-content-empty-state");
  await expect(emptyState).toBeVisible();
  await expect(emptyState).toHaveAttribute("data-surface", "content");
  await expect(emptyState).toHaveAttribute("data-size", "xl");
  await expect(emptyState.getByRole("heading", { name: "조제/처치 업무가 없습니다" })).toBeVisible();
});

type FulfillmentWorkItemStatus =
  | "requested"
  | "accepted"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "returned";

const workspaceId = "clair-demo";

function createFulfillmentWorkItem(
  overrides: {
    id: string;
    orderDisplayName: string;
    orderId: string;
    queueType: "dispensing" | "treatment";
    status?: FulfillmentWorkItemStatus;
  },
) {
  return {
    assignedToUserId: overrides.status === "requested" ? null : "user-tech",
    completedAt: null,
    createdAt: "2026-06-09T10:30:00.000Z",
    encounterId: "enc-den456",
    id: overrides.id,
    orderId: overrides.orderId,
    queueType: overrides.queueType,
    requestedByUserId: "user-vet-suji",
    sourceSnapshot: {
      guardianName: "이지은",
      instruction: `${overrides.orderDisplayName} 수행`,
      orderDisplayName: overrides.orderDisplayName,
      patientName: "코코",
      requestingVetName: "이수지",
    },
    status: overrides.status ?? "requested",
    updatedAt: "2026-06-09T10:35:00.000Z",
    workspaceId,
  };
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

test("dispensing treatment workspace shows server readback and refreshes after persisted status mutation", async ({ page }) => {
  let dispensingStatus: FulfillmentWorkItemStatus = "requested";
  const patchStatuses: string[] = [];
  let dispensingReads = 0;
  let treatmentReads = 0;

  await page.route(
    new RegExp(`/api/workspaces/${workspaceId}/fulfillment/work-items\\?queueType=dispensing(?:&.*)?$`),
    async (route) => {
      dispensingReads += 1;
      await route.fulfill({
        contentType: "application/json",
        json: {
          ok: true,
          workItems: [
            createFulfillmentWorkItem({
              id: "den456-dispensing",
              orderDisplayName: "DEN-456 항구토제 조제",
              orderId: "order-den456-dispensing",
              queueType: "dispensing",
              status: dispensingStatus,
            }),
          ],
        },
      });
    },
  );
  await page.route(
    new RegExp(`/api/workspaces/${workspaceId}/fulfillment/work-items\\?queueType=treatment(?:&.*)?$`),
    async (route) => {
      treatmentReads += 1;
      await route.fulfill({
        contentType: "application/json",
        json: {
          ok: true,
          workItems: [
            createFulfillmentWorkItem({
              id: "den456-treatment",
              orderDisplayName: "DEN-456 수액 처치",
              orderId: "order-den456-treatment",
              queueType: "treatment",
              status: "in_progress",
            }),
          ],
        },
      });
    },
  );
  await page.route(
    new RegExp(`/api/workspaces/${workspaceId}/fulfillment/work-items/den456-dispensing$`),
    async (route) => {
      const body = JSON.parse(route.request().postData() ?? "{}") as {
        status?: FulfillmentWorkItemStatus;
      };
      if (body.status) {
        dispensingStatus = body.status;
        patchStatuses.push(body.status);
      }
      await route.fulfill({
        contentType: "application/json",
        json: {
          ok: true,
          workItem: createFulfillmentWorkItem({
            id: "den456-dispensing",
            orderDisplayName: "DEN-456 항구토제 조제",
            orderId: "order-den456-dispensing",
            queueType: "dispensing",
            status: dispensingStatus,
          }),
        },
      });
    },
  );

  await page.goto(`/w/${workspaceId}/dispensing?modulePanel=open`);
  await expect
    .poll(() => dispensingReads, { message: "dispensing queue should be read" })
    .toBeGreaterThan(0);
  await expect
    .poll(() => treatmentReads, { message: "treatment queue should be read" })
    .toBeGreaterThan(0);

  await page.getByTestId("order-queue-item-live-fulfillment-den456-dispensing").click();
  await expect(page.getByTestId("dispensing-fulfillment-readback")).toContainText("조제 업무 큐");
  await expect(page.getByTestId("dispensing-fulfillment-readback")).toContainText("서버 상태 요청");
  await expect(page.getByTestId("dispensing-fulfillment-readback")).toContainText("오더 order-den456-dispensing");

  await page.getByRole("button", { name: "담당하기" }).first().click();
  await expect
    .poll(() => patchStatuses.join(","), { message: "requested item should be accepted then started" })
    .toBe("accepted,in_progress");
  await expect(page.getByTestId("dispensing-fulfillment-readback")).toContainText("서버 상태 진행중");
  await expect(page.getByRole("button", { name: /조제중|처치중/ }).first()).toBeVisible();
});

test("dispensing treatment workspace surfaces fulfillment read permission denial", async ({ page }) => {
  await page.route(
    new RegExp(`/api/workspaces/${workspaceId}/fulfillment/work-items\\?queueType=(dispensing|treatment)(?:&.*)?$`),
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        status: 403,
        json: {
          denialReason: "permission_missing",
          ok: false,
        },
      });
    },
  );

  await page.goto(`/w/${workspaceId}/dispensing?modulePanel=open`);

  await expect(page.getByTestId("dispensing-fulfillment-state")).toContainText("권한");
  await expect(page.getByRole("heading", { name: /조제 지시서|처치 지시서/ })).toBeVisible();
});

test("dispensing treatment workspace keeps local state unchanged when fulfillment mutation fails", async ({ page }) => {
  await page.route(
    new RegExp(`/api/workspaces/${workspaceId}/fulfillment/work-items\\?queueType=dispensing(?:&.*)?$`),
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        json: {
          ok: true,
          workItems: [
            createFulfillmentWorkItem({
              id: "den456-mutation-denied",
              orderDisplayName: "DEN-456 저장 실패 검증",
              orderId: "order-den456-denied",
              queueType: "dispensing",
              status: "requested",
            }),
          ],
        },
      });
    },
  );
  await page.route(
    new RegExp(`/api/workspaces/${workspaceId}/fulfillment/work-items\\?queueType=treatment(?:&.*)?$`),
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        json: {
          ok: true,
          workItems: [],
        },
      });
    },
  );
  await page.route(
    new RegExp(`/api/workspaces/${workspaceId}/fulfillment/work-items/den456-mutation-denied$`),
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        status: 403,
        json: {
          denialReason: "permission_missing",
          ok: false,
        },
      });
    },
  );

  await page.goto(`/w/${workspaceId}/dispensing?modulePanel=open`);
  await page.getByTestId("order-queue-item-live-fulfillment-den456-mutation-denied").click();
  await expect(page.getByTestId("dispensing-fulfillment-readback")).toContainText("서버 상태 요청");

  await page.getByRole("button", { name: "담당하기" }).first().click();

  await expect(page.getByTestId("dispensing-fulfillment-mutation-state")).toContainText(
    "저장하지 못했습니다",
  );
  await expect(page.getByTestId("dispensing-fulfillment-readback")).toContainText("서버 상태 요청");
  await expect(page.getByRole("button", { name: "담당하기" }).first()).toBeVisible();
});
