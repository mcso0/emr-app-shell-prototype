import { expect, test } from "@playwright/test";

test("hospital admin order management opens with category and subcategory navigation", async ({ page }) => {
  await page.goto("/w/clair-demo/orders?modulePanel=open");

  await expect(page.getByTestId("nav-rail-active-item")).toHaveAttribute("aria-label", "병원관리");
  await expect(page.getByRole("heading", { name: "Order 관리" })).toBeVisible();
  await expect(page.getByTestId("hospital-admin-menu-order-management")).toContainText("Order 관리");
  await expect(page.getByTestId("order-set-placeholder")).toContainText("후속");
  await expect(page.getByTestId("hospital-admin-category-lab")).toHaveAttribute("data-selected", "true");
  await expect(page.getByTestId("hospital-admin-subcategory-clinical-pathology")).toHaveAttribute("data-selected", "true");
  await expect(page.getByTestId("hospital-order-row-hospital-order-cbc")).toBeVisible();

  await page.getByTestId("hospital-admin-category-dispensing").click();
  await expect(page.getByTestId("hospital-admin-subcategory-oral-medication")).toHaveAttribute("data-selected", "true");
  await expect(page.getByTestId("hospital-order-row-hospital-order-maropitant")).toBeVisible();
});

test("hospital admin order drawer edits and saves a selected order", async ({ page }) => {
  await page.goto("/w/clair-demo/orders?modulePanel=open");

  await page.getByTestId("hospital-admin-category-dispensing").click();
  await page.getByTestId("hospital-order-row-hospital-order-maropitant").click();

  const drawer = page.getByTestId("hospital-order-drawer");
  await expect(drawer).toContainText("Maropitant 16mg T");

  await drawer.locator('input[value="Maropitant 16mg T"]').first().fill("Maropitant 변경");
  await drawer.locator('[data-slot="switch"]').click();
  await drawer.getByRole("button", { name: "저장" }).click();

  await expect(drawer).toContainText("Maropitant 변경");
  await drawer.getByRole("button", { name: "상세 닫기" }).click();
  await expect(page.getByText("Maropitant 변경").first()).toBeVisible();
  await expect(page.getByTestId("hospital-order-row-hospital-order-maropitant")).toContainText("중지");
});

test("hospital admin order drawer deletes an order after confirmation", async ({ page }) => {
  await page.goto("/w/clair-demo/orders?modulePanel=open");

  await page.getByTestId("hospital-admin-category-imaging").click();
  await page.getByTestId("hospital-admin-subcategory-ultrasound").click();
  await page.getByTestId("hospital-order-row-hospital-order-abdomen-us").click();

  await expect(page.getByTestId("hospital-order-drawer")).toContainText("복부 초음파");
  await page.getByRole("button", { name: "삭제" }).click();
  await page.getByRole("button", { name: "삭제" }).last().click();

  await expect(page.getByTestId("hospital-order-drawer")).toBeHidden();
  await expect(page.getByTestId("hospital-order-row-hospital-order-abdomen-us")).toHaveCount(0);
});

test("hospital admin table selection drives bulk action instead of opening drawer", async ({ page }) => {
  await page.goto("/w/clair-demo/orders?modulePanel=open");

  const row = page.getByTestId("hospital-order-row-hospital-order-cbc");
  await row.getByRole("checkbox", { name: "CBC 검사 선택" }).click();
  await expect(page.getByText("선택한 오더 1개")).toBeVisible();

  await row.click({ position: { x: 180, y: 20 } });
  await expect(page.getByTestId("hospital-order-drawer")).toHaveCount(0);

  await page.getByRole("button", { name: "선택 해제" }).click();
  await expect(page.getByText("선택한 오더 1개")).toBeHidden();
});

test("hospital admin order search filters the visible table", async ({ page }) => {
  await page.goto("/w/clair-demo/orders?modulePanel=open");

  await page.getByLabel("오더 검색").fill("심전도");
  await expect(page.getByTestId("hospital-order-row-hospital-order-ecg")).toBeVisible();
  await expect(page.getByTestId("hospital-order-row-hospital-order-cbc")).toHaveCount(0);
});
