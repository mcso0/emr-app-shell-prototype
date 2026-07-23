import { expect, test } from "@playwright/test";

test("CLAiR Docs renders the canonical product PRD from docs/product", async ({ page }) => {
  await page.goto("/docs");

  await expect(page.getByRole("link", { name: "CLAiR Docs" })).toBeVisible();
  const topNavigation = page.getByRole("navigation", { name: "CLAiR Docs top navigation" });
  await expect(topNavigation).toContainText("기획");
  await expect(topNavigation).toContainText("디자인");
  await expect(topNavigation).toContainText("개발");
  await expect(topNavigation).toContainText("스터디");
  await expect(page.getByTestId("prd-search-trigger")).toBeVisible();
  await expect(page.getByTestId("prd-theme-toggle")).toBeVisible();
  await expect(page.getByRole("heading", { name: "동물병원 전용 EMR SaaS 서비스 PRD" })).toBeVisible();
  await expect(page.getByText("docs/product/prd/clair-emr-saas-prd.md")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "CLAiR Docs documents" })).toContainText("Product PRD");
  await expect(page.getByRole("navigation", { name: "Table of contents" })).toContainText("Overview");
});

test("CLAiR Docs switches registered docs without leaving the read-only viewer", async ({ page }) => {
  await page.goto("/docs");

  await page.getByRole("link", { name: "EMR Domain Entity Map" }).click();

  await expect(page).toHaveURL(/\/docs\?doc=emr-domain-entity-map/);
  await expect(page.getByRole("heading", { name: "EMR Domain Entity Map" })).toBeVisible();
  await expect(page.getByText("docs/product/domain/emr-domain-entity-map.md")).toBeVisible();
  await expect(page.getByText("```")).toHaveCount(0);
});

test("CLAiR Docs search filters the active section navigation", async ({ page }) => {
  await page.goto("/docs");

  await page.getByTestId("prd-search-trigger").click();
  await page.getByTestId("prd-search-dialog-input").fill("role");

  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Role Permission Source Map");
  await expect(dialog).not.toContainText("Product PRD");
});

test("CLAiR Docs opens the Study tab and renders the first lesson archive", async ({ page }) => {
  await page.goto("/docs");

  await page.getByRole("link", { name: "스터디" }).click();

  await expect(page).toHaveURL(/\/docs\?area=study/);
  await expect(page.getByRole("heading", { name: "CLAiR Study Center" })).toBeVisible();
  const docsNavigation = page.getByRole("navigation", { name: "CLAiR Docs documents" });
  await expect(docsNavigation.getByRole("link", { name: "01. EMR Domain Basics" })).toBeVisible();

  await docsNavigation.getByRole("link", { name: "01. EMR Domain Basics" }).click();

  await expect(page).toHaveURL(/\/docs\?doc=study-emr-domain-basics/);
  await expect(page.getByRole("heading", { name: "01. EMR Domain Basics" })).toBeVisible();
  await expect(page.getByText("docs/study/sessions/2026-06-17-01-emr-domain-basics.md")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Diagram" })).toBeVisible();
  await expect(page.getByTestId("prd-mermaid-diagram")).toBeVisible();
});

test("CLAiR Docs handles invalid doc slugs without opening arbitrary paths", async ({ page }) => {
  await page.goto("/docs?doc=../../docs/engineering/auth-security/mvp-auth-transition-roadmap");

  await expect(page.getByRole("heading", { name: "등록되지 않은 CLAiR Docs 문서입니다." })).toBeVisible();
  await expect(page.getByText("임의 파일 경로는 열지 않습니다.")).toBeVisible();
  await expect(page.getByRole("link", { name: "기본 문서로 이동" })).toHaveAttribute("href", "/docs");
});

test("legacy /prd route remains usable for product-doc links", async ({ page }) => {
  await page.goto("/prd");

  await expect(page.getByRole("link", { name: "CLAiR Docs" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "동물병원 전용 EMR SaaS 서비스 PRD" })).toBeVisible();
});
