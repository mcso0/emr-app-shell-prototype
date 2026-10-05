import { expect, test } from "@playwright/test";

for (const colorScheme of ["light", "dark"] as const) {
  for (const viewport of [
    { label: "desktop", width: 1440, height: 900 },
    { label: "mobile", width: 390, height: 844 },
  ]) {
    test(`operation toast placement and close states: ${viewport.label}, system ${colorScheme}`, async ({ page }, testInfo) => {
      test.setTimeout(60_000);
      await page.emulateMedia({ colorScheme });
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto("/w/clair-demo/dispensing?modulePanel=open&aside=closed");

      // Exercise the real root toaster without clinical writes or remote data.
      await page.getByRole("button", { name: "새 업무 탭", exact: true }).click();
      const toast = page.locator("[data-sonner-toast]").filter({ hasText: "새 탭이 생성되었습니다." });
      const toaster = page.locator("[data-sonner-toaster]");
      const close = toast.getByRole("button", { name: "토스트 닫기", exact: true });
      await expect(toast).toBeVisible();
      // The new-tab action is desktop-only; resize its real toast to verify
      // the same root toaster at the mobile breakpoint.
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await toast.hover({ position: { x: 20, y: 20 } });
      await expect(toaster).toHaveAttribute("data-x-position", "left");
      await expect(toaster).toHaveAttribute("data-y-position", "top");
      await expect(toaster).toHaveAttribute("data-sonner-theme", "light");
      await expect(toaster).toHaveCSS("top", "16px");
      await expect(toaster).toHaveCSS("left", "16px");
      await expect.poll(async () => {
        const box = await toast.boundingBox();
        return box ? { x: Math.round(box.x), y: Math.round(box.y), inside: box.x + box.width <= viewport.width } : null;
      }).toEqual({ x: 16, y: 16, inside: true });
      await expect(close).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
      await close.hover();
      await expect(close).toHaveCSS("background-color", "rgba(0, 0, 0, 0.04)");
      await page.screenshot({ path: testInfo.outputPath("toast-hover.png") });

      await page.mouse.down();
      await expect(close).toHaveCSS("background-color", "rgba(0, 0, 0, 0.06)");
      await page.screenshot({ path: testInfo.outputPath("toast-pressed.png") });
      await page.mouse.up();
      await expect(toast).toBeHidden();

      // Releasing the close button dismisses the first toast. Use a fresh
      // operation toast to verify keyboard access without cancelling a press
      // (Sonner captures the pointer for swipe/dismiss interactions).
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.getByRole("button", { name: "새 업무 탭", exact: true }).click();
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await toast.hover({ position: { x: 20, y: 20 } });
      // Sonner exposes the toast region through Alt+T, then the toast and
      // its close button through Tab. Leaving the region restores prior focus.
      await page.keyboard.press("Alt+t");
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
      await expect(close).toBeFocused();
      await expect.poll(() => close.evaluate((button) => button.matches(":focus-visible"))).toBe(true);
      await expect.poll(() => close.evaluate((button) => getComputedStyle(button).boxShadow)).not.toBe("none");
      await close.press("Enter");
      await expect(toast).toBeHidden();
    });
  }
}
