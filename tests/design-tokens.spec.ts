import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const treatmentUrl = "/w/clair-demo/treatment?modulePanel=open&aside=closed";
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

const collectSourceFiles = async (directory: string): Promise<string[]> => {
  const entries = await fs.promises.readdir(directory, { withFileTypes: true });
  const nestedPaths = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      return entry.isDirectory() ? collectSourceFiles(entryPath) : [entryPath];
    }),
  );

  return nestedPaths.flat();
};

test("Sky atomic tokens use the approved 500 anchor and coordinated scale", async ({ page }) => {
  await page.goto(treatmentUrl);

  const skyTokens = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    const brandCheckboxProbe = document.createElement("span");
    brandCheckboxProbe.style.backgroundColor =
      "var(--emr-table-checkbox-brand-checked)";
    document.body.appendChild(brandCheckboxProbe);
    const tableCheckboxBrandChecked = getComputedStyle(
      brandCheckboxProbe,
    ).backgroundColor;
    brandCheckboxProbe.remove();
    const atomicScale = Object.fromEntries(
      [50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((step) => [
        step,
        style.getPropertyValue(`--clair-color-atomic-sky-${step}`).trim().toUpperCase(),
      ])
    );
    return {
      ...atomicScale,
      tableCheckboxBrandChecked,
    };
  });

  expect(skyTokens).toEqual({
    50: "#F0F7FF",
    100: "#DBEDFF",
    200: "#ADD5FF",
    300: "#70B6FF",
    400: "#3D9CFF",
    500: "#1085FF",
    600: "#006BDB",
    700: "#0055AD",
    800: "#004185",
    900: "#002F61",
    tableCheckboxBrandChecked: "rgb(16, 133, 255)",
  });
});

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
      expectedEmrSurfaceApp: resolveColor("var(--clair-color-atomic-common-100)"),
      emrSurfaceWorkspace: resolveColor("var(--emr-surface-workspace)"),
      expectedEmrSurfaceWorkspace: resolveColor("#fcfcfc"),
      emrSurfaceMuted: resolveColor("var(--emr-surface-muted)"),
      expectedEmrSurfaceMuted: resolveColor("var(--clair-color-atomic-neutral-50)"),
      emrStateHover: resolveColor("var(--emr-state-hover)"),
      expectedEmrStateHover: resolveColor("var(--clair-color-atomic-black-alpha-4)"),
      emrStateSelected: resolveColor("var(--emr-state-selected)"),
      expectedEmrStateSelected: resolveColor("var(--clair-color-atomic-black-alpha-6)"),
      emrStateActive: resolveColor("var(--emr-state-active)"),
      expectedEmrStateActive: resolveColor("var(--clair-color-atomic-black-alpha-8)"),
      emrSurfaceSelected: resolveColor("var(--emr-surface-selected)"),
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
  expect(colors.emrSurfaceWorkspace).toBe(colors.expectedEmrSurfaceWorkspace);
  expect(colors.emrSurfaceMuted).toBe(colors.expectedEmrSurfaceMuted);
  expect(colors.emrStateHover).toBe(colors.expectedEmrStateHover);
  expect(colors.emrStateSelected).toBe(colors.expectedEmrStateSelected);
  expect(colors.emrStateActive).toBe(colors.expectedEmrStateActive);
  expect(colors.emrSurfaceSelected).toBe(colors.emrStateSelected);
  expect(colors.emrStateSelectedBorder).toBe(colors.expectedEmrStateSelectedBorder);
  expect(colors.emrStatusInfoText).toBe(colors.expectedEmrStatusInfoText);
});

test("runtime surfaces use semantic aliases instead of legacy state names or local neutrals", async () => {
  const sourceFiles = (await collectSourceFiles("src")).filter(
    (filePath) =>
      /\.(?:css|ts|tsx)$/.test(filePath) &&
      !filePath.endsWith("src/styles/tokens/clair.css") &&
      !filePath.endsWith("src/styles/tokens/emr-foundation.css"),
  );
  const offenders = (
    await Promise.all(
      sourceFiles.map(async (filePath) => {
        const source = await fs.promises.readFile(filePath, "utf8");
        return /--emr-surface-(?:hover|selected)|#(?:fcfcfc|fafafa|f9f9f9)/i.test(
          source,
        )
          ? filePath
          : null;
      }),
    )
  ).filter(Boolean);

  expect(offenders).toEqual([]);
});

test("EMR border semantic scale maps to neutral 100, 200, and 300", async ({ page }) => {
  await page.goto(treatmentUrl);

  const colors = await page.evaluate(() => {
    const probe = document.createElement("div");
    document.body.appendChild(probe);

    const resolveBorderColor = (token: string) => {
      probe.style.border = `1px solid var(${token})`;
      return getComputedStyle(probe).borderTopColor;
    };

    const result = {
      subtle: resolveBorderColor("--emr-border-subtle"),
      default: resolveBorderColor("--emr-border-default"),
      strong: resolveBorderColor("--emr-border-strong"),
      globalBorder: resolveBorderColor("--border"),
      globalInput: resolveBorderColor("--input"),
    };

    probe.remove();
    return result;
  });

  expect(colors).toEqual({
    subtle: "rgb(245, 245, 245)",
    default: "rgb(229, 229, 229)",
    strong: "rgb(212, 212, 212)",
    globalBorder: "rgb(229, 229, 229)",
    globalInput: "rgb(229, 229, 229)",
  });

  const [foundationSource, globalSource, shellSource, workspaceFrameSource] =
    await Promise.all([
      fs.promises.readFile("src/styles/tokens/emr-foundation.css", "utf8"),
      fs.promises.readFile("src/app/globals.css", "utf8"),
      fs.promises.readFile("src/shell/shell-main.tsx", "utf8"),
      fs.promises.readFile("src/shell/workspace-frame.tsx", "utf8"),
    ]);

  expect(foundationSource).toContain("--border: var(--emr-border-default)");
  expect(foundationSource).toContain("--input: var(--emr-border-default)");
  expect(globalSource).toContain("--border: var(--emr-border-default)");
  expect(globalSource).toContain("--input: var(--emr-border-default)");
  expect(shellSource).toContain("var(--emr-border-strong)");
  expect(workspaceFrameSource).toContain("var(--emr-border-strong)");
});

test("runtime source uses only the EMR semantic structural border hierarchy", async () => {
  const runtimeSourcePaths = (await collectSourceFiles("src")).filter(
    (sourcePath) => /\.(?:css|ts|tsx)$/.test(sourcePath),
  );
  const runtimeSources = await Promise.all(
    runtimeSourcePaths.map(async (sourcePath) => ({
      path: sourcePath,
      source: await fs.promises.readFile(sourcePath, "utf8"),
    })),
  );
  const allLegacyUsages = runtimeSources.flatMap(({ path: sourcePath, source }) =>
    [...source.matchAll(/--emr-line-(?:subtle|hairline|default|strong)/g)].map(
      (match) => `${sourcePath}:${match[0]}`,
    ),
  );

  expect(allLegacyUsages).toEqual([]);

  const workspaceFrameSource = runtimeSources.find(
    ({ path: sourcePath }) => sourcePath === "src/shell/workspace-frame.tsx",
  )?.source;
  const registrationDialogSource = runtimeSources.find(
    ({ path: sourcePath }) => sourcePath === "src/components/emr/registration-dialog.tsx",
  )?.source;
  const homeWorkspaceSource = await fs.promises.readFile(
    "src/features/home/components/home-kanban-workspace.tsx",
    "utf8"
  );

  expect(workspaceFrameSource).toContain("border-r border-[var(--emr-content-aside-border)]");
  expect(registrationDialogSource).toContain("border border-[var(--emr-border-subtle)]");
  expect(homeWorkspaceSource).toContain("border-l border-[var(--emr-border-strong)]");
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

test("shared EMR component source uses semantic color tokens instead of direct local colors", async () => {
  const sources = await Promise.all(
    [
      "src/components/emr/content-history-list.tsx",
      "src/components/emr/dialog-shell.tsx",
      "src/components/emr/emr-data-table.tsx",
      "src/components/emr/inline-alert.tsx",
      "src/components/emr/order-queue-side-panel.tsx",
      "src/components/emr/order-queue-summary.tsx",
      "src/components/emr/patient-context-bar.tsx",
      "src/components/emr/row-action-menu.tsx",
      "src/components/emr/subpanel.tsx",
    ].map((path) => fs.promises.readFile(path, "utf8")),
  );
  const matches = sources.join("\n").match(directLocalColorPattern) ?? [];

  expect(matches).toEqual([]);
});

test("residual eligible source uses semantic color tokens instead of direct local colors", async () => {
  const sources = await Promise.all(
    [
      "src/app/button-gallery/page.tsx",
      "src/components/icons.ts",
      "src/features/chart/data.ts",
      "src/features/order-queue/data.ts",
    ].map((path) => fs.promises.readFile(path, "utf8")),
  );
  const matches = sources.join("\n").match(directLocalColorPattern) ?? [];

  expect(matches).toEqual([]);
});
