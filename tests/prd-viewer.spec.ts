import { expect, test } from "@playwright/test";

test("PRD viewer renders the canonical product PRD from docs/product", async ({ page }) => {
  await page.goto("/prd");

  await expect(page.getByRole("link", { name: /CLAiR Docs/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "문서 검색 열기" })).toBeVisible();
  await expect(page.getByRole("link", { name: /CLAiR App/ })).toHaveAttribute("href", "/login");
  await expect(page.getByRole("heading", { name: "동물병원 전용 EMR SaaS 서비스 PRD" })).toBeVisible();
  await expect(page.getByText("docs/product/prd/clair-emr-saas-prd.md")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "PRD documents" })).toContainText("Product PRD");
  await expect(page.getByRole("navigation", { name: "Table of contents" })).toContainText("Overview");
});

test("PRD viewer switches registered docs without leaving the read-only viewer", async ({ page }) => {
  await page.goto("/prd");

  await page.getByRole("link", { name: "EMR Domain Entity Map" }).click();

  await expect(page).toHaveURL(/\/prd\?doc=emr-domain-entity-map/);
  await expect(page.getByRole("heading", { name: "EMR Domain Entity Map" })).toBeVisible();
  await expect(page.getByText("docs/product/domain/emr-domain-entity-map.md")).toBeVisible();
  await expect(page.getByText("```")).toHaveCount(0);
});

test("PRD viewer search opens a command-style document picker", async ({ page }) => {
  await page.addInitScript(() =>
    window.localStorage.setItem(
      "prd-viewer-recent-docs",
      JSON.stringify(["outpatient-workflow-state-model", "product-prd"])
    )
  );
  await page.goto("/prd");

  await page.getByTestId("prd-search-trigger").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText("PRD, 에픽, 기능 기준 문서를 빠르게 열 수 있어.")).toHaveCount(0);
  await expect(page.getByText("Pages")).toBeVisible();
  await expect(page.getByText("Recently viewed")).toBeVisible();
  await expect(page.getByRole("option", { name: /Outpatient Workflow State Model/ })).toBeVisible();
  await page.getByTestId("prd-search-dialog-input").fill("role");

  await expect(page.getByRole("option", { name: /Role Permission Source Map/ })).toBeVisible();
  await expect(page.getByRole("option", { name: /Product PRD/ })).toHaveCount(0);
  await page.getByRole("option", { name: /Role Permission Source Map/ }).click();
  await expect(page).toHaveURL(/\/prd\?doc=role-permission-source-map/);
});

test("PRD viewer theme switch toggles dark mode", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("prd-viewer-theme", "light"));
  await page.goto("/prd");

  await page.getByTestId("prd-theme-toggle").click();

  await expect(page.locator("html")).toHaveClass(/dark/);
});

test("PRD viewer handles invalid doc slugs without opening arbitrary paths", async ({ page }) => {
  await page.goto("/prd?doc=../../docs/engineering/auth-security/mvp-auth-transition-roadmap");

  await expect(page.getByRole("heading", { name: "등록되지 않은 PRD 문서야." })).toBeVisible();
  await expect(page.getByText("임의 파일 경로는 열지 않는다.")).toBeVisible();
  await expect(page.getByRole("link", { name: "기본 PRD로 이동" })).toHaveAttribute("href", "/prd");
});
