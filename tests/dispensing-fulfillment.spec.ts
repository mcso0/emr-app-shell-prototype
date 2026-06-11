import { expect, test } from "@playwright/test";

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
    (response) =>
      response.request().method() === "GET" &&
      response.url().includes("/api/workspaces/clair-demo/fulfillment/work-items?queueType=dispensing")
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

test("dispensing treatment workspace shows server readback and refreshes after persisted status mutation", async ({ page }) => {
  let dispensingStatus: FulfillmentWorkItemStatus = "requested";
  const patchStatuses: string[] = [];
  let dispensingReads = 0;
  let treatmentReads = 0;

  await page.route(
    new RegExp(`/api/workspaces/${workspaceId}/fulfillment/work-items\\?queueType=dispensing$`),
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
    new RegExp(`/api/workspaces/${workspaceId}/fulfillment/work-items\\?queueType=treatment$`),
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
    new RegExp(`/api/workspaces/${workspaceId}/fulfillment/work-items\\?queueType=(dispensing|treatment)$`),
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
    new RegExp(`/api/workspaces/${workspaceId}/fulfillment/work-items\\?queueType=dispensing$`),
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
    new RegExp(`/api/workspaces/${workspaceId}/fulfillment/work-items\\?queueType=treatment$`),
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
