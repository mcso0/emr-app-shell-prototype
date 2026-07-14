import { expect, test } from "@playwright/test";

test("reception calendar does not render the legacy visit context banner", async ({
  page,
}) => {
  await page.goto(
    "/w/clair-demo/reception?scenario=kong-vomit&patientId=patient-kong&encounterId=encounter-kong-260501",
  );

  await expect(page.getByTestId("reception-day-calendar")).toBeVisible();
  await expect(page.getByTestId("reception-visit-context")).toHaveCount(0);
  await expect(page.getByText("진료 주의사항")).toHaveCount(0);
});
