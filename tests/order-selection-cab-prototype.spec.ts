import { expect, test } from "@playwright/test";

const prototypePath = "/docs/design/flows/order-selection-cab-interactive-prototype.html";

test.describe("Order Selection CAB interaction prototype", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(prototypePath);
  });

  test("keeps encounter-wide billing in the footer and selection billing in the CAB", async ({ page }) => {
    await expect(page.getByRole("button", { name: "전체 수납 청구" })).toBeVisible();
    await expect(page.getByRole("toolbar", { name: "선택 행 작업" })).toBeVisible();

    await page.locator("#caseSelect").selectOption("confirmed");

    const cab = page.getByRole("toolbar", { name: "선택 행 작업" });
    await expect(cab).toContainText("2개 Order 수납 청구");
    await expect(cab).toContainText("재요청");
    await expect(cab).toContainText("긴급");
    await expect(page.getByRole("button", { name: "전체 수납 청구" })).toBeVisible();
  });

  test("uses confirmed-only billing count for mixed selection", async ({ page }) => {
    await page.locator("#caseSelect").selectOption("mixed");

    const cab = page.getByRole("toolbar", { name: "선택 행 작업" });
    await expect(cab).toContainText("2개 Order 확정");
    await expect(cab).toContainText("1개 Order 수납 청구");

    await cab.getByRole("button", { name: "1개 Order 수납 청구" }).click();
    await expect(page.getByRole("dialog")).toContainText("수납 청구를 진행할까요?");
    await expect(page.getByRole("dialog")).toContainText("1개 확정 오더");

    await page.getByRole("button", { name: "청구 진행" }).click();
    await expect(page.getByRole("toolbar", { name: "선택 행 작업" })).toHaveCount(0);
    await expect(page.getByRole("status")).toContainText("수납 청구 요청 완료");
  });

  test("confirms Plan removal without deleting the order entity", async ({ page }) => {
    const cab = page.getByRole("toolbar", { name: "선택 행 작업" });
    await cab.getByRole("button", { name: "삭제" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("선택한 3개 오더가 현재 Plan에서 제거됩니다.");
    await dialog.getByRole("button", { name: "취소" }).click();
    await expect(cab).toBeVisible();

    await cab.getByRole("button", { name: "삭제" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "삭제" }).click();
    await expect(page.getByRole("toolbar", { name: "선택 행 작업" })).toHaveCount(0);
    await expect(page.getByRole("status")).toContainText("Plan에서 오더 제거 완료");
  });

  test("opens the encounter-wide billing confirmation independently of selection", async ({ page }) => {
    await page.getByRole("button", { name: "전체 수납 청구" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("전체 수납 청구를 진행할까요?");
    await expect(dialog).toContainText("4개 확정 오더");
    await expect(dialog).toContainText("63,000원");
  });
});
