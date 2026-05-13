import { expect, test } from "@playwright/test";

const treatmentUrl = "/w/clair-demo/treatment?modulePanel=open&aside=closed&right=closed";

test("neutral command token contract is exposed on the app shell", async ({ page }) => {
  await page.goto(treatmentUrl);

  const tokens = await page.evaluate(() => {
    const styles = getComputedStyle(document.documentElement);
    const read = (name: string) => styles.getPropertyValue(name).trim();

    return {
      primary: read("--primary"),
      brand: read("--brand"),
      ring: read("--ring"),
      emrSurfaceApp: read("--emr-surface-app"),
      emrSurfaceSelected: read("--emr-surface-selected"),
      emrStateSelectedBorder: read("--emr-state-selected-border"),
      emrStatusInfoText: read("--emr-status-info-text"),
    };
  });

  expect(tokens.primary).toBe("oklch(0.21 0.006 285.885)");
  expect(tokens.brand).toBe("var(--clair-color-atomic-sky-500)");
  expect(tokens.ring).toBe("oklch(0.705 0.015 286.067)");
  expect(tokens.emrSurfaceApp).toBe("#FBFCFD");
  expect(tokens.emrSurfaceSelected).toBe("oklch(0.97 0.006 286)");
  expect(tokens.emrStateSelectedBorder).toBe("var(--emr-line-selected)");
  expect(tokens.emrStatusInfoText).toBe("var(--clair-color-atomic-blue-700)");
});

test("primary command button uses primary token instead of brand blue", async ({ page }) => {
  await page.goto(treatmentUrl);

  const chartCompleteButton = page.getByRole("button", { name: "차트 작성완료" });
  await expect(chartCompleteButton).toBeVisible();

  const colors = await chartCompleteButton.evaluate((button) => {
    const primaryProbe = document.createElement("span");
    primaryProbe.style.color = "var(--primary)";
    document.body.appendChild(primaryProbe);

    const brandProbe = document.createElement("span");
    brandProbe.style.color = "var(--brand)";
    document.body.appendChild(brandProbe);

    const result = {
      buttonBackground: getComputedStyle(button).backgroundColor,
      primaryColor: getComputedStyle(primaryProbe).color,
      brandColor: getComputedStyle(brandProbe).color,
    };

    primaryProbe.remove();
    brandProbe.remove();

    return result;
  });

  expect(colors.buttonBackground).toBe(colors.primaryColor);
  expect(colors.buttonBackground).not.toBe(colors.brandColor);
});
