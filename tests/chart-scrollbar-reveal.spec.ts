import { expect, test, type Locator } from "@playwright/test";

const chartRoute =
  "/w/clair-demo/treatment?scenario=kong-vomit&patientId=patient-kong&encounterId=encounter-kong-260501&modulePanel=closed&aside=closed";

async function readLayout(locator: Locator) {
  return locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      clientHeight: element.clientHeight,
      clientWidth: element.clientWidth,
      height: rect.height,
      left: rect.left,
      top: rect.top,
      width: rect.width,
    };
  });
}

async function expectNativeScrollbarReveal(
  scrollOwner: Locator,
  hoverTarget: Locator,
) {
  await scrollOwner.scrollIntoViewIfNeeded();
  await hoverTarget.page().mouse.move(1, 1);
  const beforeLayout = await readLayout(scrollOwner);
  const hiddenColor = await scrollOwner.evaluate(
    (element) => getComputedStyle(element).scrollbarColor,
  );

  await hoverTarget.hover();

  await expect
    .poll(() =>
      scrollOwner.evaluate(
        (element) => getComputedStyle(element).scrollbarColor,
      ),
    )
    .not.toBe(hiddenColor);
  expect(await readLayout(scrollOwner)).toEqual(beforeLayout);
}

async function expectOverlayScrollbarReveal(
  scrollArea: Locator,
  scrollbar: Locator,
  hoverTarget: Locator,
) {
  await scrollbar.scrollIntoViewIfNeeded();
  await hoverTarget.page().mouse.move(1, 1);
  const beforeArea = await readLayout(scrollArea);
  const beforeScrollbar = await readLayout(scrollbar);
  await expect(scrollbar).toHaveCSS("opacity", "0");

  await hoverTarget.hover();

  await expect(scrollbar).toHaveCSS("opacity", "1");
  expect(await readLayout(scrollArea)).toEqual(beforeArea);
  expect(await readLayout(scrollbar)).toEqual(beforeScrollbar);
}

test("the four chart scrollbars reveal on hover without resizing their viewports", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1386, height: 870 });
  await page.goto(chartRoute);

  const assessmentTable = page.getByRole("table", { name: "진단명 목록" });
  const assessmentScrollOwner = assessmentTable.locator(
    "xpath=ancestor::div[@data-slot='table-container'][1]",
  );
  const assessmentPanel = assessmentTable.locator(
    "xpath=ancestor::div[@data-emr-data-table='true'][1]",
  );
  const soapBoundary = page.locator("[data-soap-editor-boundary]");
  const soapScrollOwner = soapBoundary.locator(".bn-container");
  const historyScrollArea = page.getByTestId("chart-inline-history-scroll-area");
  const historyScrollbar = historyScrollArea.locator(
    "> [data-slot='scroll-area-scrollbar']",
  );
  const historyViewport = historyScrollArea.locator(
    "> [data-slot='scroll-area-viewport']",
  );
  const orderSurface = page.locator("[data-slot='chart-order-table-surface']");
  const orderPinnedViewport = orderSurface.locator(
    "[data-emr-pinned-table-viewport='true']",
  );
  const orderHorizontalScrollbar = orderPinnedViewport.locator(
    "> [data-emr-pinned-table-scrollbar='horizontal']",
  );

  await expect(assessmentScrollOwner).toBeVisible();
  await expect(soapScrollOwner).toBeVisible();
  await expect(historyScrollArea).toBeVisible();
  await expect(orderPinnedViewport).toBeVisible();
  await expect(historyViewport).toHaveCount(1);

  // The default demo encounter has no prior-history rows. Make the existing
  // empty-state content exceed this test viewport so Base UI mounts its track.
  await historyViewport.evaluate((element) => {
    (element as HTMLElement).style.height = "100px";
  });
  await expect(historyScrollbar).toHaveCount(1);
  await expect(orderHorizontalScrollbar).toHaveCount(1);

  await expectNativeScrollbarReveal(
    assessmentScrollOwner,
    assessmentPanel,
  );
  await expectNativeScrollbarReveal(soapScrollOwner, soapBoundary);
  await expectOverlayScrollbarReveal(
    historyScrollArea,
    historyScrollbar,
    historyScrollArea,
  );
  await expectOverlayScrollbarReveal(
    orderPinnedViewport,
    orderHorizontalScrollbar,
    orderSurface,
  );
});
