import { expect, test } from "@playwright/test";

const chartOrderUrl =
  "/w/clair-demo/treatment?scenario=kong-vomit&patientId=patient-kong&encounterId=encounter-kong-260501&modulePanel=open&aside=closed";

test("chart order table changes density from the selected-value dropdown", async ({
  page,
}) => {
  await page.goto(chartOrderUrl);

  const orderArea = page.locator("section").filter({
    has: page.getByRole("tablist", { name: "처방/오더 분류" }),
  });
  const densityTrigger = orderArea.getByRole("button", {
    name: "테이블 보기 밀도: 좁게",
  });

  await expect(densityTrigger).toBeVisible();
  await densityTrigger.click();
  await page.getByRole("menuitemradio", { name: "넓게" }).click();

  await expect(orderArea.locator("table[data-emr-density]")).toHaveAttribute(
    "data-emr-density",
    "comfortable",
  );
});
