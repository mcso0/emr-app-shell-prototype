import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const sourceRoot = process.cwd();

async function readSource(relativePath: string) {
  try {
    return await fs.readFile(path.join(sourceRoot, relativePath), "utf8");
  } catch {
    return "";
  }
}

test("required field markers use one shared EMR component and semantic token", async () => {
  const [indicator, foundation, registrationDialog, receptionModule, profileDrawer, popoverShell, hospitalAdmin, hospitalSettings] =
    await Promise.all([
      readSource("src/components/emr/required-indicator.tsx"),
      readSource("src/styles/tokens/emr-foundation.css"),
      readSource("src/components/emr/registration-dialog.tsx"),
      readSource("src/features/reception/module.tsx"),
      readSource("src/features/reception/profile-drawer.tsx"),
      readSource("src/components/emr/popover-shell.tsx"),
      readSource("src/features/hospital-admin/module.tsx"),
      readSource("src/features/hospital-admin/settings/hospital-basic-settings-screen.tsx"),
    ]);

  expect(indicator).toContain('data-slot="emr-required-indicator"');
  expect(indicator).toContain('aria-hidden="true"');
  expect(indicator).toContain("var(--emr-form-required-indicator)");
  expect(foundation).toContain(
    "--emr-form-required-indicator: var(--clair-color-atomic-neutral-900);",
  );

  for (const source of [
    registrationDialog,
    receptionModule,
    profileDrawer,
    popoverShell,
    hospitalAdmin,
    hospitalSettings,
  ]) {
    expect(source).toContain("EmrRequiredIndicator");
  }

  expect(hospitalSettings).not.toContain('label="대표 전화 *"');
});

test("guardian registration required indicator resolves to the Neutral 900 token", async ({ page }) => {
  await page.goto("/w/clair-demo/reception");
  await page.getByRole("button", { name: "환자/보호자 등록", exact: true }).click();
  await page.getByRole("menuitem", { name: "신규 환자/보호자 등록" }).click();

  const guardianNameField = page
    .locator('[data-required="true"]')
    .filter({ hasText: "보호자명" })
    .first();
  const indicator = guardianNameField.locator('[data-slot="emr-required-indicator"]');

  await expect(indicator).toBeVisible();
  await expect(indicator).toHaveAttribute("aria-hidden", "true");

  const colors = await indicator.evaluate((node) => {
    const actual = getComputedStyle(node).color;
    const probe = document.createElement("span");
    probe.style.color = "var(--emr-form-required-indicator)";
    document.body.appendChild(probe);
    const expected = getComputedStyle(probe).color;
    probe.remove();
    return { actual, expected };
  });

  expect(colors.actual).toBe(colors.expected);
});
