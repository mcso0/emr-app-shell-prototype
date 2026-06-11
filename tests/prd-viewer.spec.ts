import { expect, test } from "@playwright/test";

test("PRD viewer renders the canonical product PRD from docs/product", async ({ page }) => {
  await page.goto("/prd");

  await expect(page.getByRole("heading", { name: "PRD Viewer" })).toBeVisible();
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

test("PRD viewer search filters the registered product-doc navigation", async ({ page }) => {
  await page.goto("/prd");

  await page.getByLabel("문서 검색").fill("role");

  await expect(page.getByRole("link", { name: "Role Permission Source Map" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Product PRD" })).toHaveCount(0);
});

test("PRD viewer handles invalid doc slugs without opening arbitrary paths", async ({ page }) => {
  await page.goto("/prd?doc=../../docs/engineering/auth-security/mvp-auth-transition-roadmap");

  await expect(page.getByRole("heading", { name: "등록되지 않은 PRD 문서야." })).toBeVisible();
  await expect(page.getByText("임의 파일 경로는 열지 않는다.")).toBeVisible();
  await expect(page.getByRole("link", { name: "기본 PRD로 이동" })).toHaveAttribute("href", "/prd");
});
