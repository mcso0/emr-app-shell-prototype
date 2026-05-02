import { expect, test } from "@playwright/test";

test("billing workspace renders waiting invoice, guardian group, editable lines, and payment actions", async ({ page }) => {
  await page.goto("/w/clair-demo/billing?modulePanel=open&aside=closed");

  const sidePanel = page.locator("aside").first();
  await expect(sidePanel.getByRole("button", { name: "대기 2" })).toHaveAttribute("aria-pressed", "true");
  await expect(sidePanel.getByTestId("billing-queue-item-invoice-coco-260501")).toContainText("코코");
  await expect(page.getByRole("heading", { name: "수납" })).toBeVisible();
  await expect(page.getByText("INV-260501-0001 · 코코 · 이지은")).toBeVisible();
  await expect(page.getByRole("heading", { name: "보호자 청구 묶음" })).toBeVisible();
  await expect(page.getByText("이지은", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "청구 항목 편집" })).toBeVisible();
  await expect(page.getByRole("spinbutton", { name: "CBC 검사 수량" })).toHaveValue("1");
  await expect(page.getByText("121,500원").first()).toBeVisible();

  await page.getByRole("spinbutton", { name: "CBC 검사 수량" }).fill("2");
  await expect(page.getByText("156,500원").first()).toBeVisible();

  await page.getByRole("button", { name: "합산", exact: true }).click();
  await expect(page.getByText("합산 대상 1건 · 적용 1건")).toBeVisible();
  await page.getByRole("button", { name: "합산 해제" }).click();
  await expect(page.getByText("합산 대상 1건 · 적용 0건")).toBeVisible();

  await page.getByRole("button", { name: "계좌이체" }).click();
  await expect(page.getByRole("button", { name: "계좌이체" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "청구 확정" }).click();
  await expect(page.getByText("청구확정").first()).toBeVisible();
  await page.getByRole("button", { name: "수납 완료" }).click();
  await expect(page.getByText("수납완료").first()).toBeVisible();
  await expect(page.getByText("처치 지시서")).toHaveCount(0);
});

test("billing side panel switches between unpaid and closed queues", async ({ page }) => {
  await page.goto("/w/clair-demo/billing?modulePanel=open&aside=closed");

  const sidePanel = page.locator("aside").first();
  await sidePanel.getByRole("button", { name: "미납 1" }).click();
  await sidePanel.getByTestId("billing-queue-item-invoice-dubu-260501").click();
  await expect(page.getByText("INV-260501-0002 · 두부 · 정하린")).toBeVisible();

  await sidePanel.getByRole("button", { name: "종료 1" }).click();
  await sidePanel.getByTestId("billing-queue-item-invoice-nabi-260414").click();
  await expect(page.getByText("INV-260414-0007 · 나비 · 오세아")).toBeVisible();
  await expect(page.getByText("수납완료").first()).toBeVisible();
});
