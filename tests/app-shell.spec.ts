import { expect, test } from "@playwright/test";

test("dispensing shell supports panels and drawer", async ({ page }) => {
  await page.goto("/w/clair-demo/dispensing");
  await expect(page.getByRole("heading", { name: "조제 지시서" })).toBeVisible();

  await page.getByRole("button", { name: "검사이력" }).click();
  await expect(page.getByText("26.04.11")).toBeVisible();

  await page.getByRole("button", { name: "검사이력" }).click();
  await page.getByTestId("order-row-section-0-o-10023").click();
  await expect(page.getByText("상세 정보")).toBeVisible();
  await expect(page.locator('input[value="Atorvastatin 20mg"]')).toBeVisible();

  await page.getByRole("button", { name: "상세 닫기" }).click();
  await expect(page.getByText("상세 정보")).toBeHidden();
});

test("dispensing history aside can open from shared URL state", async ({ page }) => {
  await page.goto("/w/clair-demo/dispensing?modulePanel=open&aside=history");

  await expect(page.getByRole("heading", { name: "조제 지시서" })).toBeVisible();
  await expect(page.getByText("검사이력 12")).toBeVisible();
  await expect(page.getByText("26.04.11")).toBeVisible();
});

test("module side panel can collapse and reopen from the rail", async ({ page }) => {
  await page.goto("/w/clair-demo/dispensing?modulePanel=open&aside=closed");

  await expect(page.getByTestId("module-side-panel-title")).toHaveText("조제");
  await expect(page.getByTestId("nav-rail-active-item")).toHaveAttribute("aria-label", "조제");
  await expect(page.getByRole("button", { name: "사용자 프로필" })).toContainText("SH");
  await page.getByRole("button", { name: "사이드 패널 접기" }).click();
  await expect(page).toHaveURL(/modulePanel=closed/);
  await expect(page.getByRole("button", { name: "사이드 패널 펼치기" })).toBeVisible();

  await page.getByRole("button", { name: "사이드 패널 펼치기" }).click();
  await expect(page).toHaveURL(/modulePanel=open/);
  await expect(page.getByTestId("module-side-panel-title")).toHaveText("조제");
});

test("right panel can be collapsed on a module that owns it", async ({ page }) => {
  await page.goto("/w/clair-demo/treatment");
  await expect(page.getByTestId("module-side-panel-title")).toHaveText("처치");
  await expect(page.getByText("Right Subpanel")).toBeVisible();
  await page.getByRole("button", { name: "우측 패널 접기" }).click();
  await expect(page).toHaveURL(/right=closed/);
  await expect(page.getByRole("button", { name: "우측 패널 펼치기" })).toBeVisible();
  await page.getByRole("button", { name: "우측 패널 펼치기" }).click();
  await expect(page).toHaveURL(/right=open/);
  await expect(page.getByText("Right Subpanel")).toBeVisible();
});
