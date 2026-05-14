import { expect, test } from "@playwright/test";
import fs from "node:fs";

const treatmentUrl = "/w/clair-demo/treatment?modulePanel=open&aside=closed&right=closed";
const directLocalColorPattern =
  /(clair-color-[a-z-]+-|#[0-9A-Fa-f]{3,8}\b|rgba?\(|\b(?:bg|text|border|ring|fill|stroke|hover:bg|hover:border|hover:text|focus:border|disabled:bg|shadow)-\[(?:[^\]]*(?:clair-color-|rgba?|#[0-9A-Fa-f])[^\]]*)\]|\b(?:bg|text|border|ring|fill|stroke)-(?:white|black|red|green|blue|orange|yellow|sky|gray|slate|zinc|neutral|stone|cyan|purple|pink|rose|emerald|amber)-)/g;

const extractSourceRange = (source: string, startMarker: string, endMarker: string) => {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);

  expect(start, `Missing start marker: ${startMarker}`).toBeGreaterThanOrEqual(0);
  expect(end, `Missing end marker: ${endMarker}`).toBeGreaterThan(start);

  return source.slice(start, end);
};

const extractSourceToEnd = (source: string, startMarker: string) => {
  const start = source.indexOf(startMarker);

  expect(start, `Missing start marker: ${startMarker}`).toBeGreaterThanOrEqual(0);

  return source.slice(start);
};

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

test("reception module uses semantic color tokens instead of direct local colors", async () => {
  const source = await fs.promises.readFile("src/features/reception/module.tsx", "utf8");
  const matches = source.match(directLocalColorPattern) ?? [];

  expect(matches).toEqual([]);
});

test("lab workspace source uses semantic color tokens instead of direct local colors", async () => {
  const source = await fs.promises.readFile("src/features/lab-imaging/module.tsx", "utf8");
  const labSource = [
    extractSourceRange(source, "const getActionableLabRows", "type ImagingQueueView"),
    extractSourceRange(source, "function LabQueueGroup", "function ImagingQueueItem"),
    extractSourceRange(source, "export function LabSidePanel", "export function ImagingSidePanel"),
    extractSourceRange(source, "function LabResultInputSection", "function useCurrentImagingDetail"),
  ].join("\n");

  const matches = labSource.match(directLocalColorPattern) ?? [];

  expect(matches).toEqual([]);
});

test("imaging workspace source uses semantic color tokens instead of direct local colors", async () => {
  const source = await fs.promises.readFile("src/features/lab-imaging/module.tsx", "utf8");
  const imagingSource = [
    extractSourceRange(source, "const imagingStatusOrder", "const fallbackLabHistoryGroups"),
    extractSourceRange(source, "function ImagingQueueItem", "export function LabSidePanel"),
    extractSourceRange(source, "export function ImagingSidePanel", "function LabResultInputSection"),
    extractSourceToEnd(source, "function useCurrentImagingDetail"),
  ].join("\n");

  const matches = imagingSource.match(directLocalColorPattern) ?? [];

  expect(matches).toEqual([]);
});

test("dispensing/treatment workspace source uses semantic color tokens instead of direct local colors", async () => {
  const source = await fs.promises.readFile("src/features/dispensing/module.tsx", "utf8");
  const matches = source.match(directLocalColorPattern) ?? [];

  expect(matches).toEqual([]);
});

test("billing workspace source uses semantic color tokens instead of direct local colors", async () => {
  const source = await fs.promises.readFile("src/features/billing/module.tsx", "utf8");
  const matches = source.match(directLocalColorPattern) ?? [];

  expect(matches).toEqual([]);
});

test("inpatient workspace source uses semantic color tokens instead of direct local colors", async () => {
  const source = await fs.promises.readFile("src/features/inpatient/module.tsx", "utf8");
  const matches = source.match(directLocalColorPattern) ?? [];

  expect(matches).toEqual([]);
});

test("customer workspace source uses semantic color tokens instead of direct local colors", async () => {
  const source = await fs.promises.readFile("src/features/customer/module.tsx", "utf8");
  const matches = source.match(directLocalColorPattern) ?? [];

  expect(matches).toEqual([]);
});

test("hospital admin workspace source uses semantic color tokens instead of direct local colors", async () => {
  const source = await fs.promises.readFile("src/features/hospital-admin/module.tsx", "utf8");
  const matches = source.match(directLocalColorPattern) ?? [];

  expect(matches).toEqual([]);
});

test("profile drawer source uses semantic color tokens instead of direct local colors", async () => {
  const source = await fs.promises.readFile("src/features/reception/profile-drawer.tsx", "utf8");
  const matches = source.match(directLocalColorPattern) ?? [];

  expect(matches).toEqual([]);
});

test("home workspace source uses semantic color tokens instead of direct local colors", async () => {
  const sources = await Promise.all(
    [
      "src/features/home/demo-launcher.tsx",
      "src/features/home/module.tsx",
      "src/features/home/components/home-command-header.tsx",
      "src/features/home/components/compact-flow-summary.tsx",
      "src/features/home/components/home-widget-card.tsx",
      "src/features/home/components/my-work-panel.tsx",
      "src/features/home/components/alerts-panel.tsx",
      "src/features/home/components/hospital-flow-board.tsx",
      "src/features/home/components/task-list-item.tsx",
      "src/features/home/components/home-kanban-workspace.tsx",
    ].map((path) => fs.promises.readFile(path, "utf8")),
  );
  const matches = sources.join("\n").match(directLocalColorPattern) ?? [];

  expect(matches).toEqual([]);
});

test("auth login source uses semantic color tokens instead of direct local colors", async () => {
  const sources = await Promise.all(
    [
      "src/app/login/page.tsx",
      "src/features/auth/login-form.tsx",
      "src/features/auth/auth-gate.tsx",
      "src/shell/top-menu.tsx",
      "src/shell/auth-profile-menu.tsx",
    ].map((path) => fs.promises.readFile(path, "utf8")),
  );
  const matches = sources.join("\n").match(directLocalColorPattern) ?? [];

  expect(matches).toEqual([]);
});

test("shell chrome source uses semantic color tokens instead of direct local colors", async () => {
  const sources = await Promise.all(
    [
      "src/shell/app-shell.tsx",
      "src/shell/nav-rail.tsx",
      "src/shell/global-command-palette.tsx",
    ].map((path) => fs.promises.readFile(path, "utf8")),
  );
  const matches = sources.join("\n").match(directLocalColorPattern) ?? [];

  expect(matches).toEqual([]);
});
