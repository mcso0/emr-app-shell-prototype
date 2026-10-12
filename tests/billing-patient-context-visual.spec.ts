import { expect, test } from "@playwright/test";

test("billing shares chart bar geometry while preserving guardian summaries and narrow scroll", async ({ page }) => {
  await page.goto("/w/clair-demo/billing?modulePanel=open&right=closed&aside=closed");
  await page.getByTestId("billing-queue-item-invoice-coco-260501").click();
  const bar = page.locator('[data-slot="patient-context-bar"]');
  const viewport = bar.getByLabel("보호자 수납 컨텍스트 정보");
  const guardian = bar.locator('[data-slot="patient-context-guardian"]');
  const patient = bar.locator('[data-slot="patient-context-patient"]');

  await expect(guardian).toContainText("이지은");
  await expect(guardian).toContainText("주 보호자");
  await expect(guardian).toContainText("010-****-1188");
  await expect(guardian).not.toContainText("010-3245-1188");
  await expect(patient).toContainText("코코");
  await expect(guardian.locator('[data-slot="badge"]')).toHaveCount(0);
  await expect(patient.locator('[data-slot="badge"]')).toHaveCount(0);
  await expect(guardian).toHaveCSS("height", "36px");
  await expect(patient).toHaveCSS("height", "36px");
  await expect(bar).toHaveCSS("height", "56px");
  await expect(bar).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(guardian.locator("img")).toHaveCSS("width", "16px");
  await expect(guardian.locator("img").locator("..")).toHaveCSS("width", "24px");

  const summaries = bar.locator('[data-slot="badge"]');
  await expect(summaries).toHaveText([
    "최근 수납26.04.14 12:10",
    "수납대기2건 · 185,500원",
    "미납2건 · 120,500원",
    "보호자 메모문자보다 알림톡 선호",
  ]);
  const unpaid = summaries.filter({ hasText: "미납" }).first();
  const memo = summaries.filter({ hasText: "보호자 메모" });
  await expect(unpaid).toHaveCSS("background-color", "rgb(255, 250, 240)");
  await expect(memo).toHaveCSS("background-color", "rgb(255, 250, 240)");
  const textBeforeResize = await bar.textContent();

  await page.setViewportSize({ width: 900, height: 800 });
  const start = bar.getByRole("button", { name: "환자 정보 처음으로 이동" });
  const end = bar.getByRole("button", { name: "환자 정보 끝으로 이동" });
  await expect(end).toBeEnabled();
  const endPosition = await end.boundingBox();
  await end.click();
  await expect(end).toBeDisabled();
  await expect(start).toBeEnabled();
  await expect(memo).toBeVisible();
  expect((await end.boundingBox())!.x).toBe(endPosition!.x);
  expect(await bar.textContent()).toBe(textBeforeResize);
  await start.focus();
  await page.keyboard.press("Enter");
  await expect(start).toBeDisabled();
  await expect(end).toBeEnabled();
  await expect.poll(() => viewport.evaluate((element) => element.scrollLeft)).toBeLessThanOrEqual(2);
});
