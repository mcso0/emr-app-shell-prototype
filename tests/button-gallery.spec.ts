import { expect, test } from "@playwright/test";

test("button gallery exposes Figma-aligned text button sizing and states", async ({ page }) => {
  await page.goto("/button-gallery");

  const defaultButton = page.getByTestId("text-default-default-default-enable");
  await expect(defaultButton).toBeVisible();
  await expect(defaultButton).toHaveCSS("height", "32px");
  await expect(defaultButton).toHaveCSS("border-radius", "8px");

  await defaultButton.hover();
  await expect(defaultButton).toHaveCSS("background-color", "rgb(45, 55, 72)");

  const disabledButton = page.getByTestId("text-default-xs-default-disable");
  await expect(disabledButton).toBeDisabled();
  await expect(disabledButton).toHaveCSS("height", "24px");
  await expect(disabledButton).toHaveCSS("opacity", "0.5");
});

test("button gallery exposes Figma-aligned icon button sizing and roundness", async ({ page }) => {
  await page.goto("/button-gallery");

  const defaultIconButton = page.getByTestId("icon-default-icon-default-enable");
  await expect(defaultIconButton).toBeVisible();
  await expect(defaultIconButton).toHaveCSS("width", "32px");
  await expect(defaultIconButton).toHaveCSS("height", "32px");
  await expect(defaultIconButton).toHaveCSS("border-radius", "8px");

  const roundIconButton = page.getByTestId("icon-round-icon-default-enable");
  await expect(roundIconButton).toHaveCSS("width", "32px");
  await expect(roundIconButton).toHaveCSS("height", "32px");
  await expect(roundIconButton).toHaveCSS("border-radius", "9999px");
});
