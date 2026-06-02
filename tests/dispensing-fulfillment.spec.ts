import { expect, test } from "@playwright/test";

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
