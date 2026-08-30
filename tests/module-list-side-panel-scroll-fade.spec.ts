import { expect, test } from "@playwright/test";

const moduleSidePanels = [
  {
    route: "/w/clair-demo/orders?modulePanel=open",
    testId: "hospital-admin-side-panel",
    title: "병원관리",
  },
  {
    route: "/w/clair-demo/customer?modulePanel=open",
    testId: "customer-side-panel",
    title: "고객관리",
  },
] as const;

test("hospital and customer module side panels use the shared scroll fade viewport", async ({
  page,
}) => {
  for (const target of moduleSidePanels) {
    await page.goto(target.route);

    const sidePanel = page.getByTestId(target.testId);
    const viewport = sidePanel.locator('[data-slot="scroll-area-viewport"]');
    const title = sidePanel.getByTestId("module-side-panel-title");

    await expect(title).toHaveText(target.title);
    await expect(viewport).toHaveClass(/scroll-fade-y/);
    await expect(viewport).toHaveClass(/scroll-fade-8/);
    await expect
      .poll(() =>
        viewport.evaluate((element) => {
          const styles = getComputedStyle(element);
          return [styles.maskImage, styles.webkitMaskImage].some(
            (mask) => mask && mask !== "none",
          );
        }),
      )
      .toBe(true);
    expect(
      await title.evaluate((element) =>
        Boolean(element.closest('[data-slot="scroll-area-viewport"]')),
      ),
    ).toBe(false);
  }
});
