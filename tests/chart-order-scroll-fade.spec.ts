import { expect, test } from "@playwright/test";

test("Plan/Order fades only remaining vertical content and preserves fixed chrome", async ({ page }) => {
  await page.goto("/w/clair-demo/treatment?scenario=kong-vomit&patientId=patient-kong&encounterId=encounter-kong-260501&modulePanel=closed&aside=closed");
  const table = page.getByRole("table", { name: "처방/오더 테이블" });
  const root = table.locator("xpath=ancestor::*[@data-emr-pinned-table-viewport='true']");
  const owner = root.locator('[data-emr-pinned-table-scroll-owner="true"]');
  await expect(table).toBeVisible();
  // Constrain the real viewport so the fixture exercises both scroll boundaries.
  await root.evaluate((element) => { element.style.flex = "none"; element.style.height = "150px"; });
  const fades = () => root.evaluate((element) => [getComputedStyle(element, "::before").opacity, getComputedStyle(element, "::after").opacity]);
  await expect.poll(fades).toEqual(["0", "1"]);
  const header = table.locator("thead");
  const headerTop = (await header.boundingBox())!.y;
  const footer = page.getByTestId("chart-order-footer");
  const footerBox = await footer.boundingBox();
  await owner.evaluate((element) => { element.scrollTop = (element.scrollHeight - element.clientHeight) / 2; });
  await expect.poll(fades).toEqual(["1", "1"]);
  expect((await header.boundingBox())!.y).toBeCloseTo(headerTop, 0);
  const geometry = await root.evaluate((element) => ({
    fadeTop: parseFloat(getComputedStyle(element, "::before").top),
    headerHeight: element.querySelector("thead")!.getBoundingClientRect().height,
    pointerEvents: getComputedStyle(element, "::after").pointerEvents,
  }));
  expect(geometry.fadeTop).toBeCloseTo(geometry.headerHeight, 0);
  expect(geometry.pointerEvents).toBe("none");
  expect(await footer.boundingBox()).toEqual(footerBox);
  await owner.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await expect.poll(fades).toEqual(["1", "0"]);
  await owner.evaluate((element) => { element.scrollTop = 0; });
  await expect.poll(fades).toEqual(["0", "1"]);
  await root.evaluate((element) => { element.style.height = "2000px"; });
  await expect.poll(fades).toEqual(["0", "0"]);
});
