import { expect, test } from "@playwright/test";

test("CLAiR Docs renders the canonical product PRD from docs/product", async ({ page }) => {
  await page.goto("/docs");

  await expect(page.getByRole("link", { name: /CLAiR Docs/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "기획" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("link", { name: "디자인" })).toBeVisible();
  await expect(page.getByRole("link", { name: "개발" })).toBeVisible();
  await expect(page.getByRole("button", { name: "문서 검색 열기" })).toBeVisible();
  await expect(page.getByRole("link", { name: /CLAiR App/ })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "동물병원 전용 EMR SaaS 서비스 PRD" })).toBeVisible();
  await expect(page.getByText("docs/product/prd/clair-emr-saas-prd.md")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "CLAiR Docs documents" })).toContainText("Product PRD");
  await expect(page.getByRole("navigation", { name: "Table of contents" })).toContainText("Overview");
});

test("CLAiR Docs switches top-level planning, design, and development areas", async ({ page }) => {
  await page.goto("/docs");

  await page.getByRole("link", { name: "디자인" }).click();

  await expect(page).toHaveURL(/\/docs\?area=design/);
  await expect(page.getByRole("link", { name: "디자인" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "Design Docs", exact: true })).toBeVisible();
  await expect(page.getByText("docs/design/README.md")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "CLAiR Docs documents" })).toContainText("Design System");

  await page.getByRole("link", { name: "개발" }).click();

  await expect(page).toHaveURL(/\/docs\?area=development/);
  await expect(page.getByRole("link", { name: "개발" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "Engineering Docs", exact: true })).toBeVisible();
  await expect(page.getByText("docs/engineering/README.md")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "CLAiR Docs documents" })).toContainText("App Shell Layout Contract");
});

test("CLAiR Docs switches registered docs without leaving the read-only viewer", async ({ page }) => {
  await page.goto("/docs");

  await page.getByRole("link", { name: "EMR Domain Entity Map" }).click();

  await expect(page).toHaveURL(/\/docs\?doc=emr-domain-entity-map/);
  await expect(page.getByRole("heading", { name: "EMR Domain Entity Map" })).toBeVisible();
  await expect(page.getByText("docs/product/domain/emr-domain-entity-map.md")).toBeVisible();
  await expect(page.getByText("```")).toHaveCount(0);
});

test("CLAiR Docs renders Mermaid diagrams as diagrams", async ({ page }) => {
  await page.goto("/docs?doc=emr-domain-entity-map");

  await expect(page.getByRole("heading", { name: "Core Relationship" })).toBeVisible();
  await expect(page.getByTestId("prd-mermaid-diagram")).toBeVisible();
  await expect(page.getByTestId("prd-mermaid-diagram").locator("svg")).toBeVisible();
  await expect(page.locator("pre").filter({ hasText: "erDiagram" })).toHaveCount(0);
});

test("CLAiR Docs search opens a command-style document picker", async ({ page }) => {
  await page.addInitScript(() =>
    window.localStorage.setItem(
      "prd-viewer-recent-docs",
      JSON.stringify(["outpatient-workflow-state-model", "product-prd"])
    )
  );
  await page.goto("/docs");

  await page.getByTestId("prd-search-trigger").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText("PRD, 에픽, 기능 기준 문서를 빠르게 열 수 있어.")).toHaveCount(0);
  await expect(page.getByText("Pages")).toBeVisible();
  await expect(page.getByText("Recently viewed")).toBeVisible();
  await expect(page.getByRole("option", { name: /Outpatient Workflow State Model/ })).toBeVisible();
  await expect(page.getByRole("option", { name: /Product PRD/ }).first()).toContainText("PRD");
  await expect(page.getByRole("option", { name: /Design Docs/ })).toContainText("design");
  await expect(page.getByRole("option", { name: /Engineering Docs/ })).toContainText("development");
  await page.getByTestId("prd-search-dialog-input").fill("role");

  await expect(page.getByRole("option", { name: /Role Permission Source Map/ })).toBeVisible();
  await expect(page.getByRole("option", { name: /Role Permission Source Map/ })).toContainText("Product-facing role");
  await expect(page.getByRole("option", { name: /Product PRD/ })).toHaveCount(0);
  await page.getByRole("option", { name: /Role Permission Source Map/ }).click();
  await expect(page).toHaveURL(/\/docs\?doc=role-permission-source-map/);
});

test("CLAiR Docs theme switch toggles dark mode", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("prd-viewer-theme", "light"));
  await page.goto("/docs");

  await page.getByTestId("prd-theme-toggle").click();

  await expect(page.locator("html")).toHaveClass(/dark/);
});

test("CLAiR Docs handles invalid doc slugs without opening arbitrary paths", async ({ page }) => {
  await page.goto("/docs?doc=../../docs/engineering/auth-security/mvp-auth-transition-roadmap");

  await expect(page.getByRole("heading", { name: "등록되지 않은 CLAiR Docs 문서야." })).toBeVisible();
  await expect(page.getByText("임의 파일 경로는 열지 않는다.")).toBeVisible();
  await expect(page.getByRole("link", { name: "기본 문서로 이동" })).toHaveAttribute("href", "/docs");
});

test("legacy PRD route redirects to canonical CLAiR Docs route", async ({ page }) => {
  await page.goto("/prd?doc=features-readme");

  await expect(page).toHaveURL(/\/docs\?doc=features-readme/);
  await expect(page.getByRole("heading", { name: "Feature Specs" })).toBeVisible();
});

test("CLAiR Docs keeps the primary reading flow usable on mobile width", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => window.localStorage.setItem("prd-viewer-theme", "dark"));
  await page.goto("/docs?doc=features-readme");

  await expect(page.getByRole("link", { name: /CLAiR Docs/ })).toBeVisible();
  await expect(page.getByTestId("prd-mobile-nav-trigger")).toBeVisible();
  await expect(page.getByTestId("prd-search-trigger-mobile")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "CLAiR Docs documents" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Feature Specs" })).toBeVisible();
  await page.getByTestId("prd-mobile-nav-trigger").click();
  const mobileDocsDialog = page.getByRole("dialog", { name: "기획 Docs" });
  await expect(mobileDocsDialog).toBeVisible();
  await expect(page.getByRole("navigation", { name: "CLAiR Docs documents" })).toContainText("Product PRD");
  const mobileDocScrollArea = mobileDocsDialog.getByTestId("prd-doc-navigation-scroll");
  await expect(mobileDocScrollArea).toBeVisible();
  await expect(
    mobileDocScrollArea.evaluate((element) => element.scrollHeight > element.clientHeight)
  ).resolves.toBe(true);
  const activeMobileDoc = page.getByRole("link", { name: "Feature Specs" });
  await expect(activeMobileDoc).toHaveAttribute("aria-current", "page");
  await expect(
    activeMobileDoc.evaluate((element) => {
      const [red = 0, green = 0, blue = 0] =
        getComputedStyle(element)
          .backgroundColor.match(/\d+/g)
          ?.slice(0, 3)
          .map(Number) ?? [];

      return blue <= Math.max(red, green) + 24;
    })
  ).resolves.toBe(true);
  await mobileDocScrollArea.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect.poll(() => mobileDocScrollArea.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await mobileDocScrollArea.evaluate((element) => {
    element.scrollTop = 0;
  });
  await mobileDocsDialog.getByRole("button", { name: "Close" }).click();
  await expect(mobileDocsDialog).toHaveCount(0);
  const scrollYBeforeBodyWheel = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, 600);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(scrollYBeforeBodyWheel);
  await page.getByTestId("prd-mobile-nav-trigger").click();
  await page.getByRole("link", { name: "Product PRD" }).click();
  await expect(page).toHaveURL(/\/docs\?doc=product-prd/);
  await expect(page.getByRole("heading", { name: "동물병원 전용 EMR SaaS 서비스 PRD" })).toBeVisible();
});
