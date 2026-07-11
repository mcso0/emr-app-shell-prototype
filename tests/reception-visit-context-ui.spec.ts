import { expect, test } from "@playwright/test";

test("reception visit context renders as an item and opens encounter detail", async ({
  page,
}) => {
  await page.goto(
    "/w/clair-demo/reception?scenario=kong-vomit&patientId=patient-kong&encounterId=encounter-kong-260501",
  );

  const visitContext = page.getByTestId("reception-visit-context");

  await expect(visitContext).toHaveAttribute("data-variant", "outline");
  await expect(visitContext.getByText("진료 주의사항")).toBeVisible();
  await expect(visitContext.getByText("반복 구토와 식욕 저하")).toBeVisible();
  await expect(visitContext.getByText("김하늘 보호자 · 콩이")).toBeVisible();
  await expect(page.getByText("session-only demo context")).toHaveCount(0);

  await visitContext.getByRole("button", { name: "접수 상세" }).click();
  await expect(page.getByTestId("reception-right-panel")).toContainText("접수 상세");
});
