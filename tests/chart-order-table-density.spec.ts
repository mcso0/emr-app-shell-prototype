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

test("chart order table defaults to standard 40px rows", async ({ page }) => {
  await page.goto(chartOrderUrl);

  const table = page.getByRole("table", { name: "처방/오더 테이블" });
  const firstRow = table.locator("tbody > tr").first();
  const densityTrigger = page.getByRole("button", {
    name: "테이블 보기 밀도: 기본 간격",
    exact: true,
  });

  await expect(firstRow).toBeVisible();
  await expect(densityTrigger).toBeVisible();
  await expect(table).toHaveAttribute("data-emr-density", "standard");
  await expect(firstRow).toHaveCSS("height", "40px");
  await expect(firstRow.locator("td").first()).toHaveCSS("height", "40px");
  await densityTrigger.click();
  await expect(
    page.getByRole("menuitemradio", { name: "기본 간격", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
});

test("chart order table changes density and resets to standard on reload", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.goto(chartOrderUrl);

  const orderArea = page.locator("section").filter({
    has: page.getByRole("tablist", { name: "처방/오더 분류" }),
  });
  const densityTrigger = orderArea.getByRole("button", {
    name: /^테이블 보기 밀도:/,
  });
  const table = orderArea.getByRole("table", { name: "처방/오더 테이블" });
  const firstRow = table.locator("tbody > tr").first();

  await expect(firstRow).toBeVisible();
  for (const { label, density, height } of [
    { label: "좁은 간격", density: "compact", height: 36 },
    { label: "넓은 간격", density: "comfortable", height: 52 },
    { label: "기본 간격", density: "standard", height: 40 },
  ]) {
    await densityTrigger.click();
    await page.getByRole("menuitemradio", { name: label, exact: true }).click();
    await expect(densityTrigger).toHaveAccessibleName(`테이블 보기 밀도: ${label}`);
    await expect(table).toHaveAttribute("data-emr-density", density);
    await expect(firstRow).toHaveCSS("height", `${height}px`);
    const cellHeights = await firstRow.locator("td").evaluateAll((cells) =>
      cells.map((cell) => cell.getBoundingClientRect().height),
    );
    expect(cellHeights.length).toBeGreaterThan(0);
    expect(cellHeights.every((cellHeight) => cellHeight === height)).toBe(true);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toBeHidden();
  }

  await densityTrigger.click();
  await page.getByRole("menuitemradio", { name: "좁은 간격", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toBeHidden();
  await expect(table).toHaveAttribute("data-emr-density", "compact");
  await page.reload();
  await expect(table).toHaveAttribute("data-emr-density", "standard");
  await expect(densityTrigger).toHaveAccessibleName("테이블 보기 밀도: 기본 간격");
  await expect(firstRow).toHaveCSS("height", "40px");
});
