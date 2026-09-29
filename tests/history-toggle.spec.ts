import { expect, test } from "@playwright/test";

const cases = [
  {
    name: "chart",
    route: "/w/clair-demo/treatment?scenario=kong-vomit&patientId=patient-kong&encounterId=encounter-kong-260501&modulePanel=open&aside=closed",
    label: "차트 이력",
    panelId: "chart-content-aside",
  },
  {
    name: "lab",
    route: "/w/clair-demo/lab?modulePanel=open&aside=closed",
    label: "임상병리검사 이력",
    panelId: "lab-content-aside",
  },
];

for (const { name, route, label, panelId } of cases) {
  test(`${name} history toggle keeps active colors until its panel closes`, async ({ page }) => {
    await page.goto(route);

    const toggle = page.locator(`button[aria-controls="${panelId}"]`);
    await expect(toggle).toHaveAccessibleName(`${label} 패널 열기`);
    await expect(toggle).toHaveCSS("background-color", "rgb(255, 255, 255)");

    await toggle.click();
    await expect(page.locator(`#${panelId}`)).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await page.mouse.move(0, 0);
    await expect(toggle).toHaveCSS("background-color", "rgba(0, 0, 0, 0.06)");
    await expect(toggle).toHaveCSS("border-color", "rgba(0, 0, 0, 0.16)");

    await toggle.hover();
    await expect(toggle).toHaveCSS("background-color", "rgba(0, 0, 0, 0.06)");
    await expect(toggle).toHaveCSS("border-color", "rgba(0, 0, 0, 0.16)");

    await toggle.click();
    await page.mouse.move(0, 0);
    await expect(page.locator(`#${panelId}`)).toHaveCount(0);
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await expect(toggle).toHaveCSS("background-color", "rgb(255, 255, 255)");

    await toggle.click();
    await page.mouse.move(0, 0);
    await expect(page.locator(`#${panelId}`)).toBeVisible();
    await expect(toggle).toHaveCSS("background-color", "rgba(0, 0, 0, 0.06)");
  });
}
