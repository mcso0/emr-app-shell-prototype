import { expect, test } from "@playwright/test";

test("day calendar compresses non-business rows and keeps business quarters at 36px", async ({ page }) => {
  await page.goto("/w/clair-demo/reception?date=2026-05-01");
  const offHour = page.getByTestId("day-hour-row-0");
  const businessHour = page.getByTestId("day-hour-row-9");
  await expect(offHour).toBeVisible();
  await expect(businessHour).toBeVisible();
  expect(await offHour.evaluate((element) => element.getBoundingClientRect().height)).toBe(72);
  expect(await businessHour.evaluate((element) => element.getBoundingClientRect().height)).toBe(144);
  expect(await page.getByTestId("day-empty-slot-9-user-vet-suji-slot-0900")
    .evaluate((element) => element.getBoundingClientRect().height)).toBe(36);
});
test("calendar compact task contract is 36px high with 8px inset", async ({ page }) => {
  await page.goto("/w/clair-demo/reception?date=2026-05-01");
  const tokens = await page.evaluate(() => {
    const styles = getComputedStyle(document.documentElement);
    return {
      height: styles.getPropertyValue("--emr-calendar-task-compact-height").trim(),
      paddingX: styles.getPropertyValue("--emr-calendar-task-padding-x").trim(),
      paddingY: styles.getPropertyValue("--emr-calendar-task-padding-y").trim(),
    };
  });
  expect(tokens).toEqual({ height: "36px", paddingX: "8px", paddingY: "8px" });
});
