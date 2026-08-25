import { expect, test, type Locator, type Page } from "@playwright/test";

const storyPath = (storyId: string) =>
  `/iframe.html?id=${storyId}&viewMode=story`;

async function waitForStory(page: Page, storyId: string) {
  await page.goto(storyPath(storyId));
  await expect(page.locator('[data-emr-data-table="true"]')).toBeVisible();
}

async function expectRightEdgesAligned(left: Locator, right: Locator) {
  const [leftBox, rightBox] = await Promise.all([
    left.boundingBox(),
    right.boundingBox(),
  ]);
  expect(leftBox).not.toBeNull();
  expect(rightBox).not.toBeNull();
  expect(
    Math.abs(leftBox!.x + leftBox!.width - (rightBox!.x + rightBox!.width)),
  ).toBeLessThanOrEqual(2);
}

test("row overlay stays at the visible viewport right edge and reveals on focus", async ({
  page,
}) => {
  await waitForStory(
    page,
    "design-system-emr-emrdatatable--viewport-right-row-overlay",
  );
  const viewport = page.locator('[data-emr-pinned-table-viewport="true"]');
  const scrollOwner = page.locator(
    '[data-emr-pinned-table-scroll-owner="true"]',
  );
  const overlay = page
    .locator('.emr-data-table-row-overlay[data-emr-data-table-row-overlay="true"]')
    .first();
  const detailAction = page.getByRole("button", { name: "요검사 상세" });
  await detailAction.focus();
  await expect(detailAction).toBeFocused();
  await expect
    .poll(() => overlay.evaluate((element) => getComputedStyle(element).opacity))
    .toBe("1");

  const maximumScroll = await scrollOwner.evaluate(
    (element) => element.scrollWidth - element.clientWidth,
  );
  expect(maximumScroll).toBeGreaterThan(0);
  for (const scrollLeft of [0, maximumScroll / 2, maximumScroll]) {
    await scrollOwner.evaluate((element, nextScrollLeft) => {
      element.scrollLeft = nextScrollLeft;
    }, scrollLeft);
    await page.evaluate(() => new Promise(requestAnimationFrame));
    await expectRightEdgesAligned(viewport, overlay);
  }

});

test("selection action bar is centered and bottom-clamped to the visible table", async ({
  page,
}) => {
  await waitForStory(
    page,
    "design-system-emr-emrdatatable--selection-action-bar-viewport-placement",
  );
  const tableRoot = page.locator('[data-emr-data-table="true"]');
  const actionBar = page.locator(
    '[data-emr-data-table-selection-action-bar="true"]',
  );
  await expect(actionBar).toBeVisible();

  const [rootBox, barBox] = await Promise.all([
    tableRoot.boundingBox(),
    actionBar.boundingBox(),
  ]);
  expect(rootBox).not.toBeNull();
  expect(barBox).not.toBeNull();
  const viewportSize = page.viewportSize();
  expect(viewportSize).not.toBeNull();
  const visibleLeft = Math.max(0, rootBox!.x);
  const visibleRight = Math.min(viewportSize!.width, rootBox!.x + rootBox!.width);
  const visibleBottom = Math.min(
    viewportSize!.height,
    rootBox!.y + rootBox!.height,
  );
  expect(
    Math.abs((visibleLeft + visibleRight) / 2 - (barBox!.x + barBox!.width / 2)),
  ).toBeLessThanOrEqual(2);
  expect(
    Math.abs(visibleBottom - (barBox!.y + barBox!.height) - 14),
  ).toBeLessThanOrEqual(2);

  await page.getByRole("button", { name: "선택 해제" }).click();
  await expect(actionBar).toBeHidden();
});

test("row states produce distinct semantic overlay gradients", async ({ page }) => {
  await waitForStory(
    page,
    "design-system-emr-emrdatatable--row-state-gradients",
  );
  const states = ["normal", "draft", "confirmed", "error", "disabled"];
  const backgrounds = await Promise.all(
    states.map(async (state) => {
      const row = page.locator(
        `[data-emr-data-table-row-state="${state}"]`,
      ).first();
      await expect(row).toBeVisible();
      if (state === "disabled") {
        await expect(row).toHaveAttribute("aria-disabled", "true");
      }
      return row
        .locator(".emr-data-table-row-overlay")
        .evaluate((element) => getComputedStyle(element).backgroundImage);
    }),
  );
  expect(new Set(backgrounds).size).toBe(states.length);
});

test.describe("touch fallback", () => {
  test.use({ hasTouch: true, viewport: { height: 800, width: 700 } });

  test("opens row actions without hover and closes them with Escape", async ({
    page,
  }) => {
    await waitForStory(
      page,
      "design-system-emr-emrdatatable--touch-row-overlay-fallback",
    );
    const overlay = page
      .locator('.emr-data-table-row-overlay[data-emr-data-table-row-overlay="true"]')
      .first();
    const trigger = overlay.locator(
      '[data-emr-data-table-row-overlay-touch-trigger="true"]',
    );
    const detailAction = page.getByRole("button", { name: "요검사 상세" });

    await expect(trigger).toBeVisible();
    await expect(detailAction).toBeHidden();
    await trigger.tap();
    await expect(overlay).toHaveAttribute("data-touch-open", "true");
    await expect(detailAction).toBeVisible();

    await trigger.focus();
    await expect(trigger).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(overlay).not.toHaveAttribute("data-touch-open", "true");
    await expect(detailAction).toBeHidden();
  });
});
