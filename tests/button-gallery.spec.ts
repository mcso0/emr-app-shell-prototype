import { expect, test } from "@playwright/test";

test("button gallery exposes Figma-aligned text button sizing and states", async ({ page }) => {
  await page.goto("/button-gallery");

  const defaultButton = page.getByTestId("text-default-default-default-enable");
  await expect(defaultButton).toBeVisible();
  await expect(defaultButton).toHaveCSS("height", "32px");
  await expect(defaultButton).toHaveCSS("border-radius", "8px");

  await defaultButton.hover();
  await page.waitForTimeout(250);
  const hoverBackground = await defaultButton.evaluate((button) => {
    const normalizeColor = (color: string) => {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) {
        throw new Error("Canvas 2D context is unavailable.");
      }
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      return Array.from(context.getImageData(0, 0, 1, 1).data).join(",");
    };

    const probe = document.createElement("span");
    probe.style.backgroundColor = "oklch(0.28 0.006 285.885)";
    document.body.appendChild(probe);
    const result = {
      actual: normalizeColor(getComputedStyle(button).backgroundColor),
      expected: normalizeColor(getComputedStyle(probe).backgroundColor),
    };
    probe.remove();
    return result;
  });
  expect(hoverBackground.actual).toBe(hoverBackground.expected);

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
