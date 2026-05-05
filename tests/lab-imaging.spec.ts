import { expect, test } from "@playwright/test";

test("lab workspace renders result input, equipment receipts, and attachments", async ({ page }) => {
  await page.goto("/w/clair-demo/lab?modulePanel=open");

  const sidePanel = page.locator("aside").first();
  await expect(sidePanel.getByText("검사 대기열")).toBeVisible();
  await expect(sidePanel.getByTestId("lab-queue-item-lab-result-coco-cbc")).toContainText("코코");
  await expect(page.getByRole("button", { name: "검사이력", exact: true })).toBeVisible();
  await expect(page.getByTestId("lab-history-group-26-05-01")).toBeVisible();
  await expect(page.getByRole("heading", { name: "임상병리 검사결과지" })).toBeVisible();
  await expect(page.getByText("요청 일시")).toBeVisible();
  await expect(page.getByTestId("lab-result-status-label")).toHaveText("입력");
  await expect(page.getByText("CBC 검사").first()).toBeVisible();
  await expect(page.getByRole("group", { name: "검사 결과 필터" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "HCT 결과값" })).toHaveValue("27");
  await expect(page.getByRole("columnheader", { name: "정상범위" })).toBeVisible();
  await expect(page.getByRole("row", { name: /HCT 27 % .*30-45.*미달.*낮음/ })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "이전결과" })).toHaveCount(0);
  await expect(page.getByRole("columnheader", { name: "장비값" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "검사결과 종합소견" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "검사결과 종합소견" })).toBeVisible();
  await expect(page.getByRole("button", { name: "첨부자료 추가" })).toBeVisible();
  await expect(page.getByText("coco-cbc-260501.pdf")).toBeVisible();
  await expect(page.getByText("cbc-smear-preview.png")).toBeVisible();
  await expect(page.getByText("처치 지시서")).toHaveCount(0);
});

test("lab workspace shows equipment receipts in the right panel", async ({ page }) => {
  await page.goto("/w/clair-demo/lab?modulePanel=open&aside=closed&right=open");

  const receiptPanel = page.getByTestId("lab-receipt-panel");
  await expect(page.getByRole("button", { name: /장비결과내역/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /장비결과내역/ })).toContainText("1");
  await expect(page.getByRole("heading", { name: "검사결과 수신내역" })).toBeVisible();
  await expect(page.getByText("장비 수신값과 현재 결과지를 비교합니다.")).toHaveCount(0);
  await expect(receiptPanel.getByRole("tab", { name: /오더 연결 1/ })).toBeVisible();
  await expect(receiptPanel.getByRole("tab", { name: /전체 장비결과 3/ })).toBeVisible();
  await expect(receiptPanel.getByText("ProCyte Dx")).toBeVisible();
  await expect(receiptPanel.getByRole("button", { name: "검사결과 붙여넣기" })).toBeVisible();

  await receiptPanel.getByRole("button", { name: "검사결과 붙여넣기" }).click();
  await expect(page.getByRole("dialog")).toContainText("검사결과를 붙여넣을까요?");
  await expect(page.getByRole("dialog")).toContainText("이전에 입력된 수치가 있으면 장비 수신값으로 덮어씁니다.");
  await page.getByRole("button", { name: "취소" }).click();

  await receiptPanel.getByRole("tab", { name: /전체 장비결과 3/ }).click();
  await expect(receiptPanel.getByText("Catalyst One")).toBeVisible();
  await expect(receiptPanel.getByRole("button", { name: "수동 매칭 필요" })).toBeDisabled();
  await expect(receiptPanel.getByRole("button", { name: "다른 오더 연결" })).toBeDisabled();
});

test("lab workspace prioritizes Kong CBC result from demo query", async ({ page }) => {
  await page.goto(
    "/w/clair-demo/lab?scenario=kong-vomit&patientId=patient-kong&encounterId=encounter-kong-260501&labResultId=lab-result-kong-cbc&modulePanel=open&aside=closed"
  );

  const sidePanel = page.locator("aside").first();
  await expect(sidePanel.getByTestId("lab-queue-item-lab-result-kong-cbc")).toContainText("콩이");
  await expect(page.getByRole("heading", { name: "임상병리 검사결과지" })).toBeVisible();
  await expect(page.getByText("환자").first()).toBeVisible();
  await expect(page.getByText("콩이").first()).toBeVisible();
  await expect(page.getByRole("row", { name: /WBC 21.4 K\/uL .*6.0-17.0.*초과.*높음/ })).toBeVisible();
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
