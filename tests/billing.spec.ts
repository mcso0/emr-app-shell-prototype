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

  await expect(page.getByText("LIVE-E-LIVE-BILL · 보리 · 김미나")).toBeVisible();
  const billingTable = page.getByRole("table", { name: "청구 항목 테이블" });
  await expect(billingTable.locator("tbody tr", { hasText: "Live CBC 검사" })).toContainText("35,000원");
});

test("billing workspace renders waiting invoice, guardian group, editable lines, and payment actions", async ({
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
    sidePanel.getByRole("button", { name: "26.05.01 (금) 날짜 선택" }),
  ).toBeVisible();
  await expect(sidePanel.getByText("전체")).toBeVisible();
  await expect(
    sidePanel.getByTestId("billing-queue-group-대기-count"),
  ).toHaveText("2");
  await expect(
    sidePanel.getByTestId("billing-queue-group-미납-count"),
  ).toHaveText("1");
  await expect(
    sidePanel.getByTestId("billing-queue-group-종료-count"),
  ).toHaveText("1");
  const cocoQueueItem = sidePanel.getByTestId(
    "billing-queue-item-invoice-coco-260501",
  );
  await expect(cocoQueueItem).toContainText("코코");
  await expect(cocoQueueItem).toHaveClass(/group\/emr-side-panel-card/);
  await expect(cocoQueueItem).toHaveAttribute("data-selected", "true");
  await expect(cocoQueueItem).not.toContainText("수납대기");
  const cocoQueueAction = cocoQueueItem.getByRole("button", {
    name: "코코 INV-260501-0001 수납 작업",
  });
  await expect
    .poll(() =>
      cocoQueueAction.evaluate((button) => getComputedStyle(button).opacity),
    )
    .toBe("0");
  await cocoQueueItem.hover();
  await expect
    .poll(() =>
      cocoQueueAction.evaluate((button) => getComputedStyle(button).opacity),
    )
    .toBe("1");
  await expect(
    page.getByRole("heading", { name: "수납", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("INV-260501-0001 · 코코 · 이지은")).toBeVisible();
  const guardianGroupSection = page.locator("section.rounded-lg").filter({
    has: page.getByRole("heading", { name: "보호자 청구 묶음" }),
  });
  await expect(guardianGroupSection).toBeVisible();
  await expect(
    guardianGroupSection.getByText("이지은", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "청구 항목 편집" }),
  ).toBeVisible();
  const billingTable = page.getByRole("table", { name: "청구 항목 테이블" });
  await expect(
    billingTable.locator(
      'th[data-emr-header-interaction="compound"][data-emr-column-resize="data-column"]',
      {
        hasText: "항목",
      },
    ),
  ).toBeVisible();
  await expect(billingTable.locator("th", { hasText: "수량" })).toHaveAttribute(
    "data-emr-column-resize",
    "none",
  );
  const cbcRow = billingTable
    .locator("tbody tr", { hasText: "CBC 검사" })
    .first();
  await expect(
    cbcRow.locator('[data-emr-cell-text-mode="two-line-if-long"]'),
  ).toContainText("CBC 검사");
  await expect(
    cbcRow
      .locator('[data-emr-cell-text-mode="one-line"]', { hasText: "35,000원" })
      .first(),
  ).toBeVisible();
  await expect(
    page.getByRole("spinbutton", { name: "CBC 검사 수량" }),
  ).toHaveValue("1");
  await expect(page.getByText("121,500원").first()).toBeVisible();

  await page.getByRole("spinbutton", { name: "CBC 검사 수량" }).fill("2");
  await expect(page.getByText("156,500원").first()).toBeVisible();

  await page.getByRole("button", { name: "합산", exact: true }).click();
  await expect(page.getByText("합산 대상 1건 · 적용 1건")).toBeVisible();
  await page.getByRole("button", { name: "합산 해제" }).click();
  await expect(page.getByText("합산 대상 1건 · 적용 0건")).toBeVisible();

  await page.getByRole("button", { name: "계좌이체" }).click();
  await expect(page.getByRole("button", { name: "계좌이체" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "청구 확정" }).click();
  const issueDialog = page.getByRole("dialog", { name: "청구 확정 전 확인" });
  await expect(issueDialog).toBeVisible();
  await expect(issueDialog).toContainText("156,500원");
  await expect(issueDialog).toContainText("실제 PG, VAT, 영수증");
  await issueDialog.getByRole("button", { name: "청구 확정 저장" }).click();
  await expect(page.getByText("청구확정").first()).toBeVisible();
  await page.getByRole("button", { name: "수납 완료", exact: true }).click();
  const paidDialog = page.getByRole("dialog", { name: "수납 완료 전 확인" });
  await expect(paidDialog).toBeVisible();
  await expect(paidDialog).toContainText("계좌이체");
  await paidDialog.getByRole("button", { name: "수납 완료 저장" }).click();
  await expect(page.getByText("수납완료").first()).toBeVisible();
  await expect(page.getByText("처치 지시서")).toHaveCount(0);
});

test("billing side panel switches between unpaid and closed queues", async ({
  page,
}) => {
  await page.goto(
    "/w/clair-demo/billing?modulePanel=open&right=open&aside=closed",
  );

  const sidePanel = page.locator("aside").first();
  await sidePanel.getByTestId("billing-queue-item-invoice-dubu-260501").click();
  await expect(page.getByText("INV-260501-0002 · 두부 · 정하린")).toBeVisible();

  await sidePanel.getByTestId("billing-queue-item-invoice-nabi-260414").click();
  await expect(page.getByText("INV-260414-0007 · 나비 · 오세아")).toBeVisible();
  await expect(page.getByText("수납완료").first()).toBeVisible();
});

test("billing invoice line table supports single sort and section filter builder", async ({
  page,
}) => {
  await page.goto(
    "/w/clair-demo/billing?modulePanel=open&right=open&aside=closed",
  );

  const tableSection = page.locator("section.rounded-lg").filter({
    has: page.getByRole("heading", { name: "청구 항목 편집" }),
  });
  const tableRows = tableSection.locator("tbody tr");

  await tableSection
    .getByRole("button", { name: /청구금액 오름차순 정렬/ })
    .click();
  await expect(tableRows.first()).toContainText("Maropitant 16mg T");

  await tableSection
    .getByRole("button", { name: /현재 정렬: 청구금액 오름차순/ })
    .click();
  await expect(tableRows.first()).toContainText("흉부 방사선");

  await tableSection
    .getByRole("button", { name: "청구 항목 필터 설정" })
    .click();
  const filterBuilder = page.locator('[data-emr-table-filter-builder="true"]');
  await expect(filterBuilder.getByRole("combobox", { name: "필터 필드" })).toHaveCount(1);
  await filterBuilder.getByRole("combobox", { name: "필터 필드" }).click();
  await page.getByRole("option", { name: "업무" }).click();
  await filterBuilder.getByRole("combobox", { name: "필터 값" }).click();
  await page.getByRole("option", { name: "검사" }).click();

  await expect(
    tableSection.getByRole("button", { name: "청구 항목 필터 1개 설정" }),
  ).toBeVisible();
  await expect(tableRows).toHaveCount(1);
  await expect(tableRows.first()).toContainText("CBC 검사");

  await filterBuilder.getByRole("button", { name: "초기화" }).click();
  await filterBuilder.getByRole("button", { name: "필터 닫기" }).click();

  await expect(
    tableSection.getByRole("button", { name: "청구 항목 필터 설정" }),
  ).toBeVisible();
  await expect(tableRows).toHaveCount(5);
});

test("billing opens the kong-vomit invoice from query and explains completion state", async ({
  page,
}) => {
  await page.goto(
    "/w/clair-demo/billing?scenario=kong-vomit&patientId=patient-kong&encounterId=encounter-kong-260501&invoiceId=invoice-kong-260501&right=open",
  );

  await expect(page.getByText("INV-260501-0003 · 콩이 · 김하늘")).toBeVisible();
  await expect(page.getByRole("heading", { name: "수납 요약" })).toBeVisible();
  await expect(
    page.getByText(
      "진료 / 검사 / 영상 / 조제 / 처치 항목을 보호자 김하늘에게 안내합니다",
    ),
  ).toBeVisible();
  await expect(page.getByText(/\d{1,3}(,\d{3})*원/).first()).toBeVisible();
  await expect(page.getByText("복부 초음파")).toBeVisible();
  await expect(page.getByText("Maropitant 16mg T")).toBeVisible();

  await page.getByRole("button", { name: "수납 완료", exact: true }).click();
  const paidDialog = page.getByRole("dialog", { name: "수납 완료 전 확인" });
  await expect(paidDialog).toBeVisible();
  await expect(paidDialog).toContainText(/확인 금액\d{1,3}(,\d{3})*원/);
  await paidDialog.getByRole("button", { name: "수납 완료 저장" }).click();

  await expect(page.getByText("수납완료").first()).toBeVisible();
  await expect(page.getByText("세션 내 수납 완료")).toBeVisible();
  await expect(page.getByText("정산 완료").first()).toBeVisible();
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

  await page.getByRole("button", { name: "청구 확정" }).click();
  const issueDialog = page.getByRole("dialog", { name: "청구 확정 전 확인" });
  await expect(issueDialog).toBeVisible();
  await issueDialog.getByRole("button", { name: "청구 확정 저장" }).click();

  await expect(page.getByTestId("billing-financial-error-alert")).toContainText(
    "청구 확정이 저장되지 않았어",
  );
  await expect(
    page.getByRole("button", { name: "청구 확정 다시 시도" }),
  ).toBeVisible();
});
