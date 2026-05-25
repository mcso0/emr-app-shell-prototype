import { expect, test } from "@playwright/test";

test("hospital admin order management opens with category and subcategory navigation", async ({ page }) => {
  await page.goto("/w/clair-demo/orders?modulePanel=open&aside=history");

  await expect(page.getByTestId("nav-rail-active-item")).toHaveAttribute("aria-label", "병원관리");
  await expect(page.getByRole("heading", { name: "임상병리 검사" })).toBeVisible();
  await expect(page.locator("#hospital-admin-content-aside")).toHaveCount(0);
  await expect(page.getByTestId("hospital-admin-menu-order-management")).toContainText("Order 관리");
  await expect(page.locator('[data-testid^="hospital-admin-category-"]')).toHaveCount(0);
  await expect(page.locator('[data-selected="true"]')).toHaveCount(1);
  await expect(page.getByTestId("order-set-placeholder")).toContainText("후속");
  await expect(page.getByRole("heading", { name: "임상병리 검사" })).toBeVisible();
  await expect(page.getByRole("button", { name: /임상병리 검사/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("group", { name: "임상병리 검사 하위 타입" }).getByRole("button", { name: "전체" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("hospital-order-row-hospital-order-cbc")).toBeVisible();

  await page.getByRole("button", { name: /처방/ }).click();
  await expect(page.getByRole("heading", { name: "처방" })).toBeVisible();
  await expect(page.getByTestId("hospital-order-row-hospital-order-maropitant")).toBeVisible();
});

test("hospital admin order table uses shared header and cell text primitives", async ({ page }) => {
  await page.goto("/w/clair-demo/orders?modulePanel=open");

  const table = page.getByTestId("hospital-order-table");
  const headers = table.locator("thead th");

  await expect(headers.nth(0)).toHaveAttribute("data-emr-header-interaction", "static");
  await expect(headers.nth(0)).toHaveAttribute("data-emr-column-resize", "none");
  await expect(headers.filter({ hasText: "표준 Order명" })).toHaveAttribute("data-emr-header-interaction", "sortable");
  await expect(headers.filter({ hasText: "표준 Order명" })).toHaveAttribute("data-emr-column-resize", "data-column");
  await expect(headers.filter({ hasText: "사용여부" })).toHaveAttribute("data-emr-header-interaction", "filterable");
  await expect(headers.filter({ hasText: "작업" })).toHaveAttribute("data-emr-column-resize", "none");

  const row = page.getByTestId("hospital-order-row-hospital-order-cbc");
  await expect(row.locator('[data-emr-cell-text-mode="two-line-if-long"]').filter({ hasText: "CBC 검사" }).first()).toBeVisible();
  await expect(row.locator('[data-emr-cell-text-mode="one-line"]').filter({ hasText: "사용" })).toBeVisible();
  await expect(row.locator('[data-emr-cell-text-mode="one-line"]').filter({ hasText: "35,000원" })).toBeVisible();
});

test("hospital admin order drawer edits and saves a selected order", async ({ page }) => {
  await page.goto("/w/clair-demo/orders?modulePanel=open");

  await page.getByRole("button", { name: /처방/ }).click();
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

  await page.getByRole("button", { name: /영상검사/ }).click();
  await page.getByTestId("hospital-order-row-hospital-order-radiography").click();

  await expect(page.getByTestId("hospital-order-drawer")).toContainText("흉부 방사선");
  await page.getByRole("button", { name: "삭제" }).click();
  await page.getByRole("button", { name: "삭제" }).last().click();

  await expect(page.getByTestId("hospital-order-drawer")).toBeHidden();
  await expect(page.getByTestId("hospital-order-row-hospital-order-radiography")).toHaveCount(0);
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

test("hospital admin row action menu opens details and closes on Escape", async ({ page }) => {
  await page.goto("/w/clair-demo/orders?modulePanel=open");

  const row = page.getByTestId("hospital-order-row-hospital-order-cbc");
  await row.getByRole("button", { name: "CBC 검사 Order 행 작업" }).click();
  await expect(page.getByRole("menu")).toContainText("상세 보기");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);

  await row.getByRole("button", { name: "CBC 검사 Order 행 작업" }).click();
  await page.getByText("상세 보기", { exact: true }).click();
  await expect(page.getByTestId("hospital-order-drawer")).toContainText("CBC 검사");
  await expect(page.getByRole("menu")).toHaveCount(0);
});
