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

  const fulfillmentStatusPatch = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      response.url().includes("/api/workspaces/clair-demo/fulfillment/work-items/")
  );
  await page.getByRole("button", { name: "담당하기" }).first().click();
  expect((await fulfillmentStatusPatch).ok()).toBe(true);
  await expect(page.getByRole("button", { name: /조제중|처치중/ }).first()).toBeVisible();
});
