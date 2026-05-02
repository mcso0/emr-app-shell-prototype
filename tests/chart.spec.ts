import { expect, test } from "@playwright/test";

test("chart workspace renders queue, history, SOAP, assessment, and orders", async ({ page }) => {
  await page.goto("/w/clair-demo/treatment");

  await expect(page.getByText("진료 대기열")).toBeVisible();
  await expect(page.getByText("과거 진료 이력")).toBeVisible();
  await expect(page.getByRole("heading", { name: "SOAP" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Assessment", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Assessment History" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Order", exact: true })).toBeVisible();
  await expect(page.getByText("급성 위장관염 의심", { exact: true })).toBeVisible();
  await expect(page.getByText("항구토제 세트")).toBeVisible();
  await expect(page.getByText("피하 수액 처치")).toBeVisible();
  await expect(page.getByText("처치 지시서")).toHaveCount(0);
});

test("chart queue selection changes the selected encounter", async ({ page }) => {
  await page.goto("/w/clair-demo/treatment");

  await page.getByTestId("chart-queue-item-encounter-haru-260430").click();

  await expect(page.getByRole("heading", { name: "하루" })).toBeVisible();
  await expect(page.getByText("E-260430-0005").first()).toBeVisible();
  await expect(page.getByText("예방접종 전 건강 확인").first()).toBeVisible();
  await expect(page.getByText("진단 입력 전입니다.")).toBeVisible();
});

test("chart history selection returns to a previous encounter for the patient", async ({ page }) => {
  await page.goto("/w/clair-demo/treatment");

  await page.getByTestId("chart-queue-item-encounter-coco-260501").click();
  await page.getByRole("button", { name: /E-260501-0001/ }).click();

  await expect(page.getByRole("heading", { name: "코코" })).toBeVisible();
  await expect(page.getByText("급성 위장관염 의심", { exact: true })).toBeVisible();
  await expect(page.getByText("CBC 검사").first()).toBeVisible();
});
