import { expect, test } from "@playwright/test";

test("lab workspace renders result input, equipment receipts, and attachments", async ({ page }) => {
  await page.goto("/w/clair-demo/lab?modulePanel=open&aside=closed");

  const sidePanel = page.locator("aside").first();
  await expect(sidePanel.getByText("검사 대기열")).toBeVisible();
  await expect(sidePanel.getByTestId("lab-queue-item-lab-result-coco-cbc")).toContainText("코코");
  await expect(page.getByRole("heading", { name: "임상병리 검사" })).toBeVisible();
  await expect(page.getByText("CBC 검사").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "결과 입력" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "HCT 결과값" })).toHaveValue("27");
  await expect(page.getByText("낮음")).toBeVisible();
  await expect(page.getByRole("heading", { name: "장비 수신 내역" })).toBeVisible();
  await expect(page.getByText("ProCyte Dx")).toBeVisible();
  await expect(page.getByText("Catalyst One")).toBeVisible();
  await expect(page.getByText("coco-cbc-260501.pdf")).toBeVisible();
  await expect(page.getByText("처치 지시서")).toHaveCount(0);
});

test("imaging workspace renders reading, impression, and attachment flow", async ({ page }) => {
  await page.goto("/w/clair-demo/imaging?modulePanel=open&aside=closed");

  const sidePanel = page.locator("aside").first();
  await expect(sidePanel.getByText("영상 대기열")).toBeVisible();
  await expect(sidePanel.getByTestId("imaging-queue-item-imaging-coco-thorax")).toContainText("흉부 방사선");
  await expect(page.getByRole("heading", { name: "영상검사" })).toBeVisible();
  await expect(page.getByText("흉부 방사선").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "영상 판독" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "영상 판독 내용" })).toContainText("복부 가스 음영 증가");
  await expect(page.getByRole("textbox", { name: "영상 종합소견" })).toContainText("위장관염 가능성");
  await expect(page.getByText("coco-thorax-lateral.png")).toBeVisible();
  await expect(page.getByText("처치 지시서")).toHaveCount(0);
});
