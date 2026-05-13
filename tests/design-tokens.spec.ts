import { expect, test } from "@playwright/test";

const treatmentUrl = "/w/clair-demo/treatment?modulePanel=open&aside=closed&right=closed";

test("neutral command token contract is exposed on the app shell", async ({ page }) => {
  await page.goto(treatmentUrl);

  const colors = await page.evaluate(() => {
    const resolveColor = (value: string) => {
      const probe = document.createElement("span");
      probe.style.color = value;
      document.body.appendChild(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();

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

    return {
      primary: resolveColor("var(--primary)"),
      expectedPrimary: resolveColor("oklch(0.21 0.006 285.885)"),
      brand: resolveColor("var(--brand)"),
      expectedBrand: resolveColor("var(--clair-color-atomic-sky-500)"),
      ring: resolveColor("var(--ring)"),
      expectedRing: resolveColor("oklch(0.705 0.015 286.067)"),
      emrSurfaceApp: resolveColor("var(--emr-surface-app)"),
      expectedEmrSurfaceApp: resolveColor("#FBFCFD"),
      emrSurfaceSelected: resolveColor("var(--emr-surface-selected)"),
      expectedEmrSurfaceSelected: resolveColor("oklch(0.97 0.006 286)"),
      emrStateSelectedBorder: resolveColor("var(--emr-state-selected-border)"),
      expectedEmrStateSelectedBorder: resolveColor("var(--emr-line-selected)"),
      emrStatusInfoText: resolveColor("var(--emr-status-info-text)"),
      expectedEmrStatusInfoText: resolveColor("var(--clair-color-atomic-blue-700)"),
    };
  });

  expect(colors.primary).toBe(colors.expectedPrimary);
  expect(colors.brand).toBe(colors.expectedBrand);
  expect(colors.ring).toBe(colors.expectedRing);
  expect(colors.emrSurfaceApp).toBe(colors.expectedEmrSurfaceApp);
  expect(colors.emrSurfaceSelected).toBe(colors.expectedEmrSurfaceSelected);
  expect(colors.emrStateSelectedBorder).toBe(colors.expectedEmrStateSelectedBorder);
  expect(colors.emrStatusInfoText).toBe(colors.expectedEmrStatusInfoText);
});

test("primary command button uses primary token instead of brand blue", async ({ page }) => {
  await page.goto(treatmentUrl);

  const chartCompleteButton = page.getByRole("button", { name: "차트 작성완료" });
  await expect(chartCompleteButton).toBeVisible();

  const colors = await chartCompleteButton.evaluate((button) => {
    const normalizeColor = (value: string) => {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) {
        throw new Error("Canvas 2D context is unavailable.");
      }

      context.fillStyle = value;
      context.fillRect(0, 0, 1, 1);
      return Array.from(context.getImageData(0, 0, 1, 1).data).join(",");
    };

    const primaryProbe = document.createElement("span");
    primaryProbe.style.color = "var(--primary)";
    document.body.appendChild(primaryProbe);

    const brandProbe = document.createElement("span");
    brandProbe.style.color = "var(--brand)";
    document.body.appendChild(brandProbe);

    const result = {
      buttonBackground: normalizeColor(getComputedStyle(button).backgroundColor),
      primaryColor: normalizeColor(getComputedStyle(primaryProbe).color),
      brandColor: normalizeColor(getComputedStyle(brandProbe).color),
    };

    primaryProbe.remove();
    brandProbe.remove();

    return result;
  });

  expect(colors.buttonBackground).toBe(colors.primaryColor);
  expect(colors.buttonBackground).not.toBe(colors.brandColor);
});
