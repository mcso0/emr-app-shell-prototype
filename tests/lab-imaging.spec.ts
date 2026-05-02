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
  await expect(page.getByRole("row", { name: /HCT 27 % 30-45 낮음 경도 저하/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "장비 수신 내역" })).toBeVisible();
  await expect(page.getByText("ProCyte Dx")).toBeVisible();
  await expect(page.getByText("Catalyst One")).toBeVisible();
  await expect(page.getByText("coco-cbc-260501.pdf")).toBeVisible();
  await expect(page.getByText("처치 지시서")).toHaveCount(0);
});

test("lab workspace prioritizes Kong CBC result from demo query", async ({ page }) => {
  await page.goto(
    "/w/clair-demo/lab?scenario=kong-vomit&patientId=patient-kong&encounterId=encounter-kong-260501&labResultId=lab-result-kong-cbc&modulePanel=open&aside=closed"
  );

  const sidePanel = page.locator("aside").first();
  await expect(sidePanel.getByTestId("lab-queue-item-lab-result-kong-cbc")).toContainText("콩이");
  await expect(page.getByRole("heading", { name: "임상병리 검사" })).toBeVisible();
  await expect(page.getByText(/콩이 · P-260501-0003 · 강아지/)).toBeVisible();
  await expect(page.getByText("내원 사유: 반복 구토와 식욕 저하")).toBeVisible();
  await expect(page.getByRole("heading", { name: "데모 결과 흐름" })).toBeVisible();
  await expect(page.getByText("WBC · 21.4 K/uL · 높음 · 염증 반응 의심")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "WBC 결과값" })).toHaveValue("21.4");
  await expect(page.getByText("kong-cbc-260501.pdf")).toBeVisible();
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

test("imaging workspace prioritizes Kong abdomen study from demo query", async ({ page }) => {
  await page.goto(
    "/w/clair-demo/imaging?scenario=kong-vomit&patientId=patient-kong&encounterId=encounter-kong-260501&imagingStudyId=imaging-kong-abdomen&modulePanel=open&aside=closed"
  );

  const sidePanel = page.locator("aside").first();
  await expect(sidePanel.getByTestId("imaging-queue-item-imaging-kong-abdomen")).toContainText("콩이");
  await expect(page.getByRole("heading", { name: "영상검사" })).toBeVisible();
  await expect(page.getByText(/콩이 · P-260501-0003 · 강아지/)).toBeVisible();
  await expect(page.getByText("내원 사유: 반복 구토와 식욕 저하")).toBeVisible();
  await expect(page.getByRole("heading", { name: "데모 결과 흐름" })).toBeVisible();
  await expect(page.getByText("판독 요약")).toBeVisible();
  await expect(
    page.locator("p").filter({ hasText: "위 내 소량 액체 저류. 장관 확장이나 명확한 이물 음영은 보이지 않음." })
  ).toBeVisible();
  await expect(
    page.locator("p").filter({ hasText: "급성 위장관염 가능성이 높으며, CBC 결과와 임상 증상 추적 권장." })
  ).toBeVisible();
  await expect(page.getByText("kong-abdomen-ultrasound.png")).toBeVisible();
});
