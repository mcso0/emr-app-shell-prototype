import { expect, test } from "@playwright/test";

test("billing renders live candidate rows from an encounter handoff", async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem(
      "clair-emr:chart-live-encounter-handoffs:v1",
      JSON.stringify({
        "encounter-live-billing": {
          encounter: {
            id: "encounter-live-billing",
            workspaceId: "clair-demo",
            patientId: "patient-live-bori",
            guardianId: "guardian-live-mina",
            primaryVeterinarianId: "user-vet-suji",
            encounterNo: "E-LIVE-BILL",
            receptionType: "walk_in",
            visitPurpose: "live billing candidate 검수",
            status: "ordered",
            checkedInAt: "2026-05-30T10:00:00.000Z",
            createdAt: "2026-05-30T10:00:00.000Z",
            updatedAt: "2026-05-30T10:10:00.000Z",
          },
          patient: {
            id: "patient-live-bori",
            patientNo: "P-LIVE-0001",
            workspaceId: "clair-demo",
            name: "보리",
            species: "dog",
            breed: "푸들",
            estimatedAgeText: "5세",
            sex: "female",
            neutered: true,
            handlingCautionLocked: true,
            status: "active",
            createdAt: "2026-05-30T09:00:00.000Z",
            updatedAt: "2026-05-30T09:00:00.000Z",
          },
          primaryGuardian: {
            id: "guardian-live-mina",
            workspaceId: "clair-demo",
            name: "김미나",
            mobilePhone: "010-0000-0000",
            createdAt: "2026-05-30T09:00:00.000Z",
            updatedAt: "2026-05-30T09:00:00.000Z",
          },
          updatedAt: "2026-05-30T10:10:00.000Z",
        },
      }),
    );
  });
  await page.route("**/api/workspaces/clair-demo/billing/invoice-candidates?encounterId=encounter-live-billing", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        status: 200,
        candidates: [
          {
            billingCandidateId: "billcand-live-cbc",
            description: "Live CBC 검사",
            invoiceId: "invoice-live-billing",
            lineTotal: 35000,
            orderId: "order-live-cbc",
            quantity: 1,
            unitPrice: 35000,
          },
        ],
        enforcedBy: "billing-invoice-candidate-sync",
      }),
    });
  });

  await page.goto("/w/clair-demo/billing?encounterId=encounter-live-billing&modulePanel=open&right=closed&aside=closed");

  await expect(page.getByText("김미나 · 보리")).toBeVisible();
  await expect(page.getByText("LIVE-E-LIVE-BILL · 김미나")).toBeVisible();
  const billingTable = page.getByRole("table", { name: "청구 항목 테이블" });
  await expect(billingTable.locator("tbody tr", { hasText: "Live CBC 검사" })).toContainText("35,000원");
});

test("billing maps encounter candidates into the current invoice table context", async ({
  page,
}) => {
  await page.route(
    "**/api/workspaces/clair-demo/billing/invoice-candidates?encounterId=encounter-kong-260501",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          candidates: [
            {
              billingCandidateId: "billcand-den-348-imaging",
              description: "DEN-348 영상 후보",
              invoiceId: "19429600-0000-4000-8000-000000000001",
              lineTotal: 34100,
              orderId: "4dbd7089-0528-487d-9239-115ba121d8e0",
              quantity: 1,
              unitPrice: 34100,
            },
            {
              billingCandidateId: "billcand-den-348-dispensing",
              description: "DEN-348 조제 후보",
              invoiceId: "19429600-0000-4000-8000-000000000001",
              lineTotal: 34200,
              orderId: "e37d4568-4ccf-45af-9861-7de986b27ed9",
              quantity: 1,
              unitPrice: 34200,
            },
          ],
          enforcedBy: "billing-invoice-candidate-sync",
        }),
      });
    },
  );

  await page.goto(
    "/w/clair-demo/billing?scenario=kong-vomit&patientId=patient-kong&encounterId=encounter-kong-260501&invoiceId=invoice-kong-260501&modulePanel=open&aside=closed&right=closed",
  );

  const billingTable = page.getByRole("table", { name: "청구 항목 테이블" });
  await expect(
    billingTable.locator("tbody tr", { hasText: "DEN-348 영상 후보" }),
  ).toContainText("수납 후보");
  await expect(
    billingTable.locator("tbody tr", { hasText: "DEN-348 조제 후보" }),
  ).toContainText("34,200원");
});

test("billing workspace renders waiting invoice, checkout selection, editable lines, and payment actions", async ({
  page,
}) => {
  await page.goto(
    "/w/clair-demo/billing?modulePanel=open&right=open&aside=closed",
  );

  const sidePanel = page.locator("aside").first();
  await expect(
    sidePanel.getByRole("button", { name: "대기 2", exact: true }),
  ).toHaveCount(0);
  await expect(
    sidePanel.getByRole("button", { name: "26.05.01(금) 날짜 선택" }),
  ).toBeVisible();
  await expect(sidePanel.getByText("전체")).toBeVisible();
  await expect(
    sidePanel.getByTestId("billing-queue-group-수납대기-count"),
  ).toHaveText("3");
  await expect(
    sidePanel.getByTestId("billing-queue-group-미납-count"),
  ).toHaveText("0");
  await expect(
    sidePanel.getByTestId("billing-queue-group-완료-count"),
  ).toHaveText("1");
  const cocoQueueItem = sidePanel.getByTestId(
    "billing-queue-item-invoice-coco-260501",
  );
  await expect(cocoQueueItem).toContainText("코코");
  await expect(cocoQueueItem).toContainText("이지은");
  await expect(cocoQueueItem).toContainText("오더 5건 · 121,500원");
  await cocoQueueItem.click();
  await expect(page).toHaveURL(/invoiceId=invoice-coco-260501/);
  await expect(cocoQueueItem).toHaveClass(/group\/emr-side-panel-card/);
  await expect(cocoQueueItem).toHaveAttribute("data-selected", "true");
  const cocoQueueAction = cocoQueueItem.getByRole("button", {
    name: "이지은 INV-260501-0001 수납 작업",
  });
  await expect
    .poll(() =>
      cocoQueueAction.evaluate((button) => getComputedStyle(button).opacity),
    )
    .toBe("1");
  await cocoQueueItem.hover();
  await expect
    .poll(() =>
      cocoQueueAction.evaluate((button) => getComputedStyle(button).opacity),
    )
    .toBe("1");
  await expect(
    page.getByRole("heading", { name: "수납", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("이지은").first()).toBeVisible();
  await expect(page.getByText("010-****-1188")).toBeVisible();
  const guardianContextBar = page.locator(
    '[aria-label="보호자 수납 컨텍스트 정보"]',
  );
  await expect(guardianContextBar).toContainText("보호자");
  await expect(guardianContextBar).toContainText("환자");
  await expect(guardianContextBar).toContainText("코코");
  await expect(guardianContextBar).toContainText("2건 · 185,500원");
  await expect(guardianContextBar).toContainText("2건 · 120,500원");
  await expect(guardianContextBar).toContainText("보호자 메모");
  await expect(guardianContextBar.locator("img")).toHaveCount(2);
  await expect(guardianContextBar).not.toContainText("INV-260501-0001");
  await expect(
    guardianContextBar.getByRole("button", { name: "수납 요약" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "수납 요약" }),
  ).toBeVisible();
  await expect(guardianContextBar).toContainText("문자보다 알림톡 선호");
  await expect(page.getByText("품종")).toHaveCount(0);
  await expect(page.getByText("성별")).toHaveCount(0);
  await expect(page.getByText("청구 확정")).toHaveCount(0);
  await expect(page.getByText("청구확정")).toHaveCount(0);
  await expect(page.getByText("INV-260501-0001").first()).toBeVisible();
  await expect(page.getByText("이지은 · 코코")).toBeVisible();
  const selectedCheckoutSection = page.locator("section.rounded-lg").filter({
    has: page.getByRole("heading", { name: "선택된 checkout 작업대" }),
  });
  await expect(selectedCheckoutSection).toBeVisible();
  await expect(selectedCheckoutSection.getByText("1건 · 5항목 · 수납 합산 121,500원")).toBeVisible();
  await expect(selectedCheckoutSection.getByText("차트 청구").first()).toBeVisible();
  await expect(selectedCheckoutSection.getByText("업무진행").first()).toBeVisible();
  await expect(selectedCheckoutSection.getByRole("button", { name: "수납 추가 항목" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "선택된 checkout 항목" }),
  ).toHaveCount(0);
  const billingTable = selectedCheckoutSection.getByRole("table", {
    name: "청구 항목 테이블",
  });
  await expect(billingTable.locator("th", { hasText: "항목" })).toBeVisible();
  await expect(billingTable.locator("th", { hasText: "수량" })).toBeVisible();
  const cbcRow = billingTable
    .locator("tbody tr", { hasText: "CBC 검사" })
    .first();
  await expect(cbcRow).toContainText("CBC 검사");
  await expect(cbcRow).toContainText("35,000원");
  await expect(
    page.getByRole("spinbutton", { name: "CBC 검사 수량" }),
  ).toHaveValue("1");
  await expect(page.getByText("121,500원").first()).toBeVisible();
  await expect(page.getByText("최종 결제금액")).toBeVisible();
  await expect(page.getByRole("button", { name: "카드" })).toBeVisible();
  await expect(page.getByRole("button", { name: "현금" })).toBeVisible();
  await expect(page.getByRole("button", { name: "계좌이체" })).toBeVisible();
  await expect(page.getByRole("button", { name: "간편결제" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "할인 또는 할증 사유" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "수납 메모" })).toBeVisible();

  await page.getByRole("spinbutton", { name: "CBC 검사 수량" }).fill("2");
  await expect(page.getByRole("spinbutton", { name: "CBC 검사 수량" })).toHaveValue("2");

  await page.getByRole("button", { name: "계좌이체" }).click();
  await expect(page.getByRole("button", { name: "계좌이체" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByText("담당하기 후 수납 액션 가능")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "수납 진행", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "담당하기" }).click();
  await expect(cocoQueueItem).not.toContainText("미지정");
  await expect(page.getByRole("button", { name: "담당 취소" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "수납 진행", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "담당 취소" }).click();
  await expect(cocoQueueItem).toContainText("미지정");
  await expect(
    page.getByRole("button", { name: "수납 진행", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "담당하기" }).click();
  await expect(cocoQueueItem).not.toContainText("미지정");
  await page.getByRole("button", { name: "수납 진행" }).click();
  const issueDialog = page.getByRole("dialog", { name: "수납 진행 전 확인" });
  await expect(issueDialog).toBeVisible();
  await expect(issueDialog).toContainText("121,500원");
  await expect(issueDialog).toContainText("실제 PG, VAT, 영수증");
  await issueDialog.getByRole("button", { name: "수납 진행 저장" }).click();
  await expect(page.getByText("수납진행").first()).toBeVisible();
  await page.getByRole("button", { name: "수납 완료", exact: true }).click();
  const paidDialog = page.getByRole("dialog", { name: "수납 완료 전 확인" });
  await expect(paidDialog).toBeVisible();
  await expect(paidDialog).toContainText("계좌이체");
  await paidDialog.getByRole("button", { name: "수납 완료 저장" }).click();
  await expect(page.getByText("수납완료").first()).toBeVisible();
  await expect(page.getByText("처치 지시서")).toHaveCount(0);
});

test("billing side panel switches between waiting and closed queues", async ({
  page,
}) => {
  await page.goto(
    "/w/clair-demo/billing?modulePanel=open&right=open&aside=closed",
  );

  const sidePanel = page.locator("aside").first();
  const dubuQueueItem = sidePanel.getByTestId("billing-queue-item-invoice-dubu-260501");
  await expect(dubuQueueItem).toContainText("오더 2건 · 28,000원");
  await expect(dubuQueueItem).not.toContainText("미납");
  await sidePanel.getByTestId("billing-queue-item-invoice-dubu-260501").click();
  await expect(page.getByText("E-260501-0002").first()).toBeVisible();

  const nabiQueueItem = sidePanel.getByTestId("billing-queue-item-invoice-nabi-260414");
  await expect(nabiQueueItem).toContainText("김도윤 요청");
  await expect(nabiQueueItem).not.toContainText("요청자 미지정");
  await nabiQueueItem.click();
  await expect(page.getByText("E-260414-0007").first()).toBeVisible();
  await expect(page.getByText("수납완료").first()).toBeVisible();
});

test("billing guardian ledger aside shows guardian history controls", async ({
  page,
}) => {
  await page.goto(
    "/w/clair-demo/billing?modulePanel=open&right=closed&aside=history",
  );

  const contentAside = page.locator("#billing-content-aside");
  await expect(contentAside.getByText("수납이력")).toBeVisible();
  await expect(
    contentAside.getByText("수납대기와 미납을 기본으로 보고"),
  ).toHaveCount(0);
  for (const label of ["1주", "2주", "1달", "3달", "6개월", "직접"]) {
    await expect(contentAside.getByRole("button", { name: label })).toBeVisible();
  }
  for (const label of ["전체", "대기", "미납", "완료", "취소"]) {
    await expect(contentAside.getByRole("button", { name: label })).toBeVisible();
  }
  await expect(
    contentAside.getByRole("button", { name: "전체" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    contentAside.getByRole("button", { name: "대기" }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(
    contentAside.getByRole("button", { name: "미납" }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(
    contentAside.getByRole("button", { name: "완료" }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(
    contentAside.getByRole("button", { name: "취소" }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(
    contentAside.getByTestId("billing-ledger-row-invoice-coco-260501"),
  ).toContainText("코코");
  await expect(
    contentAside.getByTestId("billing-ledger-row-invoice-coco-260501"),
  ).not.toContainText("INV-260501-0001");
  await expect(
    contentAside.getByTestId("billing-ledger-row-invoice-coco-260501"),
  ).not.toContainText("26.05.01 10:40");
  await expect(
    contentAside.getByTestId("billing-ledger-row-invoice-coco-260501"),
  ).toContainText("CBC 검사 외 4건");
  await expect(
    contentAside.getByTestId("billing-ledger-row-invoice-coco-260501"),
  ).toContainText("이수지");
  await expect(
    contentAside.getByTestId("billing-ledger-row-invoice-coco-260501"),
  ).toContainText("대기");
  await expect(
    contentAside.getByTestId("billing-ledger-row-invoice-coco-history-unpaid-260429"),
  ).toContainText("미납");
  await expect(
    contentAside.getByTestId("billing-ledger-row-invoice-coco-history-paid-260414"),
  ).toContainText("완료");
  await expect(
    contentAside.getByTestId("billing-ledger-row-invoice-coco-history-voided-260328"),
  ).toContainText("취소");
  await expect(
    contentAside.getByText("26.05.01").first(),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "선택된 checkout 작업대" })).toBeVisible();
  await expect(page.getByText("선택 1건 · 중앙 checkout에 반영")).toBeVisible();
  await expect(page.getByText("타 보호자 청구서 포함")).toHaveCount(0);

  await page
    .locator("aside")
    .first()
    .getByTestId("billing-queue-item-invoice-dubu-260501")
    .click();
  await expect(contentAside.getByText("두부").first()).toBeVisible();
  await expect(contentAside.getByText("김도윤").first()).toBeVisible();
  await expect(contentAside.getByText("타 보호자 청구서 포함")).toBeVisible();
});

test("billing selected checkout renders one grouped invoice table", async ({
  page,
}) => {
  await page.goto(
    "/w/clair-demo/billing?modulePanel=open&right=open&aside=closed",
  );

  await expect(
    page.getByRole("heading", { name: "선택된 checkout 항목" }),
  ).toHaveCount(0);
  const checkoutSection = page.locator("section.rounded-lg").filter({
    has: page.getByRole("heading", { name: "선택된 checkout 작업대" }),
  });
  const tableRows = checkoutSection.locator("tbody tr");

  await expect(tableRows).toHaveCount(5);
  await expect(checkoutSection.getByText("코코").first()).toBeVisible();
  await expect(checkoutSection.getByText("그룹 합계").first()).toBeVisible();
  await expect(checkoutSection.getByRole("spinbutton", { name: "CBC 검사 수량" })).toHaveValue("1");
});

test("billing completed and cancelled ledger selections stay out of checkout totals and expose status changes", async ({
  page,
}) => {
  await page.goto(
    "/w/clair-demo/billing?modulePanel=open&right=open&aside=history",
  );

  const contentAside = page.locator("#billing-content-aside");
  const checkoutSection = page.locator("section.rounded-lg").filter({
    has: page.getByRole("heading", { name: "선택된 checkout 작업대" }),
  });

  await contentAside
    .getByTestId("billing-ledger-row-invoice-coco-history-paid-260414")
    .getByRole("checkbox")
    .click();

  await expect(checkoutSection.getByText("합산 제외 1건")).toBeVisible();
  await expect(checkoutSection.getByText("수납 합산 제외").first()).toBeVisible();
  await expect(
    checkoutSection.getByText("현재 수납 요약 금액에는 합산되지 않습니다."),
  ).toBeVisible();
  await expect(
    checkoutSection.getByText("수납 합산 121,500원").first(),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "수납 요약" })).toBeVisible();
  await expect(page.getByText("최종 결제금액121,500원")).toBeVisible();

  await expect(checkoutSection.getByRole("button", { name: "취소" })).toBeDisabled();
  await expect(checkoutSection.getByText("수납 합산 제외")).toBeVisible();
});

test("billing opens the kong-vomit invoice from query and explains completion state", async ({
  page,
}) => {
  await page.goto(
    "/w/clair-demo/billing?scenario=kong-vomit&patientId=patient-kong&encounterId=encounter-kong-260501&invoiceId=invoice-kong-260501&right=open",
  );

  await expect(page.getByText("INV-260501-0003").first()).toBeVisible();
  await expect(page.getByText("김하늘 · 콩이")).toBeVisible();
  await expect(page.getByRole("heading", { name: "수납 요약" })).toBeVisible();
  await expect(
    page.getByText("진료 / 검사 / 영상 / 조제 / 처치 항목", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/\d{1,3}(,\d{3})*원/).first()).toBeVisible();
  await expect(page.getByText("복부 초음파").first()).toBeVisible();
  await expect(page.getByText("Maropitant 16mg T").first()).toBeVisible();

  await page.getByRole("button", { name: "담당하기" }).click();
  await page.getByRole("button", { name: "수납 완료", exact: true }).click();
  const paidDialog = page.getByRole("dialog", { name: "수납 완료 전 확인" });
  await expect(paidDialog).toBeVisible();
  await expect(paidDialog).toContainText(/확인 금액\d{1,3}(,\d{3})*원/);
  await paidDialog.getByRole("button", { name: "수납 완료 저장" }).click();

  await expect(page.getByText("수납완료").first()).toBeVisible();
  await expect(
    page.locator("aside").first().getByTestId("billing-queue-item-invoice-kong-260501"),
  ).toContainText(/오더 \d+건 · \d{1,3}(,\d{3})*원/);
});

test("billing unpaid processing requires a reason", async ({ page }) => {
  await page.goto(
    "/w/clair-demo/billing?modulePanel=open&right=open&aside=closed",
  );

  await expect(page.getByRole("button", { name: "미납 처리" })).toBeDisabled();
  await page.getByRole("button", { name: "담당하기" }).click();
  await page.getByRole("button", { name: "미납 처리" }).click();
  const unpaidDialog = page.getByRole("dialog", { name: "미납 처리 전 확인" });
  await expect(unpaidDialog).toBeVisible();
  await expect(unpaidDialog.getByText("미납 처리는 사유를 입력해야 저장할 수 있습니다.")).toBeVisible();
  await expect(
    unpaidDialog.getByRole("button", { name: "미납 처리 저장" }),
  ).toBeDisabled();

  await unpaidDialog
    .getByRole("textbox", { name: "미납 처리 사유" })
    .fill("보호자 요청으로 다음 방문 시 결제");
  await expect(
    unpaidDialog.getByRole("button", { name: "미납 처리 저장" }),
  ).toBeEnabled();
  await unpaidDialog.getByRole("button", { name: "미납 처리 저장" }).click();
  await expect(page.getByText("미납").first()).toBeVisible();
});

test("billing financial confirmation failure shows persistent recovery action", async ({
  page,
}) => {
  await page.route(
    "**/api/workspaces/clair-demo/billing/invoice-lines",
    async (route) => {
      if (route.request().method() === "PATCH") {
        await route.fulfill({
          contentType: "application/json",
          status: 500,
          body: JSON.stringify({
            ok: false,
            error: "db_write_failed",
            status: 500,
          }),
        });
        return;
      }

      await route.continue();
    },
  );

  await page.goto(
    "/w/clair-demo/billing?modulePanel=open&right=open&aside=closed",
  );

  await page.getByRole("button", { name: "담당하기" }).click();
  await page.getByRole("button", { name: "수납 진행" }).click();
  const issueDialog = page.getByRole("dialog", { name: "수납 진행 전 확인" });
  await expect(issueDialog).toBeVisible();
  await issueDialog.getByRole("button", { name: "수납 진행 저장" }).click();

  await expect(page.getByTestId("billing-financial-error-alert")).toContainText(
    "수납 진행이 저장되지 않았어",
  );
  await expect(
    page.getByRole("button", { name: "수납 진행 다시 시도" }),
  ).toBeVisible();
});
