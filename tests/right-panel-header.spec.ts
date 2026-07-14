import { expect, test } from "@playwright/test";

const rightPanelCases = [
  {
    name: "Reception",
    path: "/w/clair-demo/reception?modulePanel=open&right=open",
  },
  {
    name: "Lab",
    path: "/w/clair-demo/lab?modulePanel=open&aside=closed&right=open",
  },
  {
    name: "Imaging",
    path: "/w/clair-demo/imaging?modulePanel=open&aside=closed&right=open",
  },
  {
    name: "Billing",
    path: "/w/clair-demo/billing?modulePanel=open&aside=closed&right=open",
  },
] as const;

test("workspace right panels share the 56px header frame", async ({ page }) => {
  for (const rightPanelCase of rightPanelCases) {
    await test.step(rightPanelCase.name, async () => {
      await page.goto(rightPanelCase.path);

      const rightPanel = page.locator(".emr-workspace-rightpanel-responsive");
      const header = rightPanel.locator('[data-slot="emr-right-panel-header"]');

      await expect(rightPanel).toBeVisible();
      await expect(header).toHaveCount(1);
      await expect(header).toHaveCSS("height", "56px");
    });
  }
});

test("right-panel header keeps its 56px frame at the supported narrow width", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto(
    "/w/clair-demo/reception?modulePanel=open&right=open&drawer=reception-encounter%3Aencounter-haru-260430",
  );

  const rightPanel = page.locator(".emr-workspace-rightpanel-responsive");
  await expect(rightPanel).toBeVisible();
  await expect(
    rightPanel.locator('[data-slot="emr-right-panel-header"]'),
  ).toHaveCSS("height", "56px");
});

test("workspace right panel keeps the existing mobile-hidden behavior", async ({
  page,
}) => {
  await page.setViewportSize({ width: 767, height: 900 });
  await page.goto("/w/clair-demo/reception?modulePanel=open&right=open");

  await expect(
    page.locator(".emr-workspace-rightpanel-responsive"),
  ).toBeHidden();
});
