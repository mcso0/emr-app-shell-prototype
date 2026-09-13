import { expect, test } from "@playwright/test";

const chartOrderUrl =
  "/w/clair-demo/treatment?scenario=kong-vomit&patientId=patient-kong&encounterId=encounter-kong-260501&modulePanel=open&aside=closed";

test("chart order header matches the compact count tabs and current actions", async ({
  page,
}) => {
  await page.goto(chartOrderUrl);

  const orderTabs = page.getByRole("tablist", { name: "처방/오더 분류" });
  const orderArea = page.locator("section").filter({ has: orderTabs });
  const allOrdersTab = orderTabs.getByRole("tab", {
    name: /전체오더 \d+/,
    exact: true,
  });
  const allOrdersCount = allOrdersTab.locator('[data-slot="badge"]');

  await expect(orderTabs).toHaveCSS("gap", "4px");
  await expect(orderTabs).toHaveCSS("padding", "3px");
  await expect(allOrdersTab).toHaveCSS("min-height", "24px");
  await expect(allOrdersTab).toHaveCSS("min-width", "48px");
  await expect(allOrdersTab).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
  await expect(allOrdersTab).not.toHaveCSS("box-shadow", "none");
  await expect(allOrdersCount).toHaveCSS("width", "16px");
  await expect(allOrdersCount).toHaveCSS("height", "16px");
  await expect(allOrdersCount).toHaveCSS("border-radius", "9999px");

  const orderToolbar = orderArea.locator(
    '[data-slot="chart-order-toolbar-actions"]',
  );
  await expect(orderToolbar.getByRole("button", { name: "PACS" })).toHaveCount(0);
  const detailedOrderButton = orderToolbar.getByRole("button", {
    name: "상세 오더",
  });
  await expect(detailedOrderButton).toBeVisible();
  await expect(
    detailedOrderButton.locator('[data-icon="inline-start"]'),
  ).toBeVisible();
});

test("chart order table changes density from the selected-value dropdown", async ({
  page,
}) => {
  await page.goto(chartOrderUrl);

  const orderArea = page.locator("section").filter({
    has: page.getByRole("tablist", { name: "처방/오더 분류" }),
  });
  const densityTrigger = orderArea.getByRole("button", {
    name: "테이블 보기 밀도: 좁은 간격",
  });

  await expect(densityTrigger).toBeVisible();
  await densityTrigger.click();
  await page.getByRole("menuitemradio", { name: "넓은 간격" }).click();

  await expect(
    orderArea.getByRole("table", { name: "처방/오더 테이블" }),
  ).toHaveAttribute("data-emr-density", "comfortable");
});
