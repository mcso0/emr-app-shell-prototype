import { expect, test } from "@playwright/test";

test("lab workspace renders result input, equipment receipts, and attachments", async ({ page }) => {
  await page.goto("/w/clair-demo/lab?modulePanel=open");

  const sidePanel = page.locator("aside").first();
  const queueViewFilter = sidePanel.getByRole("group", { name: "임상병리검사 목록 보기" });
  await expect(sidePanel.getByText("임상병리검사")).toBeVisible();
  await expect(queueViewFilter.getByRole("button", { name: "오더별" })).toHaveAttribute("aria-pressed", "true");
  await expect(queueViewFilter.getByRole("button", { name: "차트별" })).toBeVisible();
  await expect(sidePanel.getByRole("button", { name: "26.05.01 (금) 날짜 선택" })).toBeVisible();
  await expect(sidePanel.getByText("검사 대기열")).toBeVisible();
  await expect(sidePanel.getByRole("button", { name: "결과입력 접기" })).toHaveAttribute("aria-expanded", "true");
  await expect(sidePanel.getByTestId("lab-queue-item-lab-result-coco-cbc")).toContainText("코코");
  await expect(sidePanel.getByTestId("lab-queue-item-lab-result-coco-cbc")).toContainText("예약");
  await expect(sidePanel.getByTestId("lab-queue-item-lab-result-coco-cbc")).toContainText("CBC 검사");
  await expect(sidePanel.getByText("검사 · CBC 검사")).toHaveCount(0);
  await sidePanel.getByRole("button", { name: "결과입력 접기" }).click();
  await expect(sidePanel.getByRole("button", { name: "결과입력 펼치기" })).toHaveAttribute("aria-expanded", "false");
  await expect(sidePanel.getByTestId("lab-queue-item-lab-result-coco-cbc")).toHaveCount(0);
  await sidePanel.getByRole("button", { name: "결과입력 펼치기" }).click();
  await expect(sidePanel.getByTestId("lab-queue-item-lab-result-coco-cbc")).toBeVisible();
  await queueViewFilter.getByRole("button", { name: "차트별" }).click();
  await expect(sidePanel.getByText("차트별 검사")).toBeVisible();
  await expect(sidePanel.getByTestId("lab-chart-group-encounter-coco-260501")).toContainText("코코");
  await expect(sidePanel.getByTestId("lab-chart-group-encounter-coco-260501")).toContainText("CBC 검사");
  await queueViewFilter.getByRole("button", { name: "오더별" }).click();
  await expect(page.getByRole("button", { name: "검사이력", exact: true })).toBeVisible();
  await expect(page.getByTestId("lab-history-group-26.05.01")).toBeVisible();
  await expect(page.getByRole("heading", { name: "임상병리 검사결과지" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "임상병리 검사결과지" })).toHaveCSS("font-size", "16px");
  await expect(page.getByText("요청 일시")).toBeVisible();
  await expect(page.getByTestId("lab-result-status-label")).toHaveText("입력");
  await expect(page.getByText("CBC 검사").first()).toBeVisible();
  await expect(page.getByRole("group", { name: "검사 결과 필터" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "HCT 결과값" })).toHaveValue("27");
  await expect(page.getByRole("columnheader", { name: "정상범위" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "담당자" })).toBeVisible();
  await expect(page.getByText("■ 혈구 검사")).toHaveCount(0);
  await expect(page.getByRole("row", { name: /WBC 18\.2 K\/uL .*정상 송하윤/ })).toBeVisible();
  await page.getByRole("button", { name: "담당하기", exact: true }).click();
  await expect(page.getByRole("button", { name: "검사중", exact: true })).toBeVisible();
  await expect(page.getByRole("row", { name: /HCT 27 % .*30.*45.*낮음/ })).toBeVisible();
  await page.getByRole("textbox", { name: "HCT 결과값" }).fill("42");
  await expect(page.getByRole("row", { name: /HCT 42 % .*30.*45.*정상/ })).toBeVisible();
  await page.getByRole("textbox", { name: "HCT 결과값" }).fill("27122");
  await expect(page.getByRole("row", { name: /HCT 27122 % .*30.*45.*높음/ })).toBeVisible();
  await expect(page.getByText("미달")).toHaveCount(0);
  await expect(page.getByRole("columnheader", { name: "이전결과" })).toHaveCount(0);
  await expect(page.getByRole("columnheader", { name: "장비값" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "검사결과 종합소견" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "검사결과 종합소견" })).toBeVisible();
  await expect(page.getByRole("button", { name: "코멘트 저장" })).toHaveCount(0);
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
  await expect(receiptPanel.getByRole("button", { name: "26.05.01 (금) 날짜 선택" })).toBeVisible();
  await expect(receiptPanel.getByRole("button", { name: "수신내역 검색" })).toBeVisible();
  await expect(page.getByText("장비 수신값과 현재 결과지를 비교합니다.")).toHaveCount(0);
  await expect(receiptPanel.getByRole("group", { name: "검사결과 수신내역 필터" })).toHaveCount(0);
  await expect(receiptPanel.getByText("오더 1")).toHaveCount(0);
  await expect(receiptPanel.getByText("전체 3")).toHaveCount(0);
  await expect(receiptPanel.getByText("검사 결과").first()).toBeVisible();
  await expect(receiptPanel.getByText("오더 연결")).toHaveCount(0);
  await expect(receiptPanel.getByText("ProCyte Dx")).toBeVisible();
  await expect(receiptPanel.getByText("10:49 수신")).toBeVisible();
  await expect(receiptPanel.getByText("코코 · 이지은 CBC 검사")).toBeVisible();
  await expect(receiptPanel.getByRole("button", { name: /ProCyte Dx 수신결과 접기/ })).toBeVisible();
  await expect(receiptPanel.getByText("검사 항목명")).toBeVisible();
  await expect(receiptPanel.getByText("WBC")).toBeVisible();
  await expect(receiptPanel.getByText("18.2")).toBeVisible();
  await expect(receiptPanel.getByRole("button", { name: "결과 붙여넣기" })).toBeVisible();
  await receiptPanel.getByRole("button", { name: /ProCyte Dx 수신결과 접기/ }).click();
  await expect(receiptPanel.getByRole("button", { name: /ProCyte Dx 수신결과 펼치기/ })).toHaveAttribute("aria-expanded", "false");
  await expect(receiptPanel.getByText("검사 항목명")).toHaveCount(0);
  await receiptPanel.getByRole("button", { name: /ProCyte Dx 수신결과 펼치기/ }).click();
  await expect(receiptPanel.getByText("검사 항목명")).toBeVisible();

  await receiptPanel.getByRole("button", { name: "결과 붙여넣기" }).click();
  await expect(page.getByRole("dialog")).toContainText("검사결과를 붙여넣을까요?");
  await expect(page.getByRole("dialog")).toContainText("이전에 입력된 수치가 있으면 장비 수신값으로 덮어씁니다.");
  await page.getByRole("button", { name: "취소" }).click();
  await expect(receiptPanel.getByText("Catalyst One")).toHaveCount(0);
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
  await expect(page.getByRole("row", { name: /WBC 21.4 K\/uL .*6.*17.*높음/ })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "WBC 결과값" })).toHaveValue("21.4");
  await expect(page.getByText("kong-cbc-260501.pdf")).toBeVisible();
});

test("imaging workspace renders reading, impression, and attachment flow", async ({ page }) => {
  await page.goto("/w/clair-demo/imaging?modulePanel=open");

  const sidePanel = page.locator("aside").first();
  const queueViewFilter = sidePanel.getByRole("group", { name: "영상검사 목록 보기" });
  await expect(sidePanel.getByText("영상검사")).toBeVisible();
  await expect(queueViewFilter.getByRole("button", { name: "오더별" })).toHaveAttribute("aria-pressed", "true");
  await expect(queueViewFilter.getByRole("button", { name: "차트별" })).toBeVisible();
  await expect(sidePanel.getByRole("button", { name: "26.05.01 (금) 날짜 선택" })).toBeVisible();
  await expect(sidePanel.getByText("영상 대기열")).toBeVisible();
  await expect(sidePanel.getByRole("button", { name: "판독중 접기" })).toHaveAttribute("aria-expanded", "true");
  await expect(sidePanel.getByTestId("imaging-queue-item-imaging-coco-thorax")).toContainText("흉부 방사선");
  await sidePanel.getByRole("button", { name: "판독중 접기" }).click();
  await expect(sidePanel.getByRole("button", { name: "판독중 펼치기" })).toHaveAttribute("aria-expanded", "false");
  await expect(sidePanel.getByTestId("imaging-queue-item-imaging-coco-thorax")).toHaveCount(0);
  await sidePanel.getByRole("button", { name: "판독중 펼치기" }).click();
  await expect(sidePanel.getByTestId("imaging-queue-item-imaging-coco-thorax")).toBeVisible();
  await queueViewFilter.getByRole("button", { name: "차트별" }).click();
  await expect(sidePanel.getByText("차트별 영상")).toBeVisible();
  await expect(sidePanel.getByTestId("imaging-chart-group-encounter-coco-260501")).toContainText("코코");
  await queueViewFilter.getByRole("button", { name: "오더별" }).click();
  await expect(page.getByRole("button", { name: "영상이력", exact: true })).toBeVisible();
  await expect(page.getByTestId("imaging-history-item-imaging-coco-thorax")).toBeVisible();
  await expect(page.getByRole("heading", { name: "영상 검사 Order 상세" })).toBeVisible();
  await expect(page.getByText("흉부 방사선").first()).toBeVisible();
  await expect(page.getByTestId("imaging-study-status-label")).toHaveText("판독중");
  await expect(page.getByText("Order 상세정보")).toBeVisible();
  await expect(page.getByRole("heading", { name: "스터디 판독의견" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "영상 판독 내용" })).toContainText("복부 가스 음영 증가");
  await expect(page.getByRole("textbox", { name: "영상 종합소견" })).toContainText("위장관염 가능성");
  await expect(page.getByRole("textbox", { name: "Imaging Dx" })).toBeVisible();
  await page.getByRole("button", { name: "담당하기", exact: true }).click();
  await expect(page.getByRole("button", { name: "판독중", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "판독 상태 액션" }).click();
  await page.getByRole("menuitem", { name: "판독완료" }).click();
  await expect(page.getByRole("button", { name: "판독완료", exact: true })).toBeVisible();
  const summaryPanel = page.getByTestId("imaging-summary-panel");
  await expect(summaryPanel.getByText("coco-thorax-lateral.png")).toBeVisible();
  await expect(summaryPanel.getByRole("heading", { name: "종합소견" })).toBeVisible();
  await expect(summaryPanel.getByRole("heading", { name: "같은 차트 내 Order" })).toBeVisible();
  await expect(summaryPanel.getByRole("textbox", { name: "영상 종합 코멘트" })).toBeVisible();
  await expect(summaryPanel.getByText("coco-thorax-lateral.png")).toBeVisible();
  await expect(page.getByText("처치 지시서")).toHaveCount(0);
});

test("imaging workspace prioritizes Kong abdomen study from demo query", async ({ page }) => {
  await page.goto(
    "/w/clair-demo/imaging?scenario=kong-vomit&patientId=patient-kong&encounterId=encounter-kong-260501&imagingStudyId=imaging-kong-abdomen&modulePanel=open&aside=closed&right=open"
  );

  const sidePanel = page.locator("aside").first();
  await expect(sidePanel.getByTestId("imaging-queue-item-imaging-kong-abdomen")).toContainText("콩이");
  await expect(page.getByRole("heading", { name: "영상 검사 Order 상세" })).toBeVisible();
  await expect(page.getByText("환자").first()).toBeVisible();
  await expect(page.getByText("콩이").first()).toBeVisible();
  await expect(page.getByRole("textbox", { name: "영상 판독 내용" })).toContainText(
    "위 내 소량 액체 저류. 장관 확장이나 명확한 이물 음영은 보이지 않음."
  );
  await expect(page.getByRole("textbox", { name: "영상 종합소견" })).toContainText(
    "급성 위장관염 가능성이 높으며, CBC 결과와 임상 증상 추적 권장."
  );
  await expect(page.getByTestId("imaging-summary-panel")).toContainText("CBC 검사");
  await expect(page.getByTestId("imaging-summary-panel")).toContainText("복부 초음파");
  await expect(page.getByTestId("imaging-summary-panel").getByText("kong-abdomen-ultrasound.png")).toBeVisible();
});
