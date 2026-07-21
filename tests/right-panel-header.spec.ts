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

test("right panels share one body and support optional fixed footer sizes", async ({
  page,
}) => {
  const cases = [
    {
      footerHeight: undefined,
      footerSize: undefined,
      name: "Lab",
      path: "/w/clair-demo/lab?modulePanel=open&aside=closed&right=open",
    },
    {
      footerHeight: "53px",
      footerSize: "compact",
      name: "Imaging",
      path: "/w/clair-demo/imaging?modulePanel=open&aside=closed&right=open",
    },
    {
      footerHeight: "105px",
      footerSize: "stacked",
      name: "Billing",
      path: "/w/clair-demo/billing?modulePanel=open&aside=closed&right=open",
    },
  ] as const;

  for (const rightPanelCase of cases) {
    await test.step(rightPanelCase.name, async () => {
      await page.goto(rightPanelCase.path);

      const rightPanel = page.locator(".emr-workspace-rightpanel-responsive");
      const panelLayout = rightPanel.locator('[data-slot="emr-right-panel"]');
      const body = panelLayout.locator('[data-slot="emr-right-panel-body"]');
      const footer = panelLayout.locator('[data-slot="emr-right-panel-footer"]');

      await expect(panelLayout).toHaveCount(1);
      await expect(body).toHaveCount(1);

      if (rightPanelCase.footerSize) {
        await expect(footer).toHaveCount(1);
        await expect(footer).toHaveAttribute("data-size", rightPanelCase.footerSize);
        await expect(footer).toHaveCSS("height", rightPanelCase.footerHeight!);
      } else {
        await expect(footer).toHaveCount(0);
      }
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

test("right panels keep the body scrollable and any footer inside the panel frame", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto(
    "/w/clair-demo/reception?modulePanel=open&right=open&drawer=reception-reservation-form%3Anew",
  );

  const rightPanel = page.locator(".emr-workspace-rightpanel-responsive");
  const panelLayout = rightPanel.locator('[data-slot="emr-right-panel"]');
  const header = panelLayout.locator('[data-slot="emr-right-panel-header"]');
  const body = panelLayout.locator('[data-slot="emr-right-panel-body"]');
  const footer = panelLayout.locator('[data-slot="emr-right-panel-footer"]');

  await expect(panelLayout).toHaveCount(1);
  await expect(header).toHaveCount(1);
  await expect(body).toHaveCount(1);
  await expect(footer).toHaveCount(1);

  const [panelBox, headerBox, bodyBox, footerBox] = await Promise.all([
    panelLayout.boundingBox(),
    header.boundingBox(),
    body.boundingBox(),
    footer.boundingBox(),
  ]);

  expect(panelBox).not.toBeNull();
  expect(headerBox).not.toBeNull();
  expect(bodyBox).not.toBeNull();
  expect(footerBox).not.toBeNull();

  expect(bodyBox!.y).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height);
  expect(footerBox!.y + footerBox!.height).toBeLessThanOrEqual(
    panelBox!.y + panelBox!.height + 1,
  );

  const scrollViewport = body.locator('[data-slot="scroll-area-viewport"]');
  await expect(scrollViewport).toHaveCount(1);
  expect(
    await scrollViewport.evaluate(
      (element) => element.scrollHeight > element.clientHeight,
    ),
  ).toBe(true);
  await scrollViewport.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(footer).toBeInViewport();
});
