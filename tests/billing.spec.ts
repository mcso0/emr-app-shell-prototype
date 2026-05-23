import { expect, test } from "@playwright/test";

test("billing workspace renders waiting invoice, guardian group, editable lines, and payment actions", async ({ page }) => {
  await page.goto("/w/clair-demo/billing?modulePanel=open&right=open&aside=closed");

  const sidePanel = page.locator("aside").first();
  await expect(sidePanel.getByRole("button", { name: "대기 2", exact: true })).toHaveCount(0);
  await expect(sidePanel.getByRole("button", { name: "26.05.01 (금) 날짜 선택" })).toBeVisible();
  await expect(sidePanel.getByText("전체")).toBeVisible();
  await expect(sidePanel.getByTestId("billing-queue-group-대기-count")).toHaveText("2");
  await expect(sidePanel.getByTestId("billing-queue-group-미납-count")).toHaveText("1");
  await expect(sidePanel.getByTestId("billing-queue-group-종료-count")).toHaveText("1");
  const cocoQueueItem = sidePanel.getByTestId("billing-queue-item-invoice-coco-260501");
  await expect(cocoQueueItem).toContainText("코코");
  await expect(cocoQueueItem).toHaveClass(/group\/emr-side-panel-card/);
  await expect(cocoQueueItem).toHaveAttribute("data-selected", "true");
  await expect(cocoQueueItem).not.toContainText("수납대기");
  const cocoQueueAction = cocoQueueItem.getByRole("button", {
    name: "코코 INV-260501-0001 수납 작업",
  });
  await expect
    .poll(() => cocoQueueAction.evaluate((button) => getComputedStyle(button).opacity))
    .toBe("0");
  await cocoQueueItem.hover();
  await expect
    .poll(() => cocoQueueAction.evaluate((button) => getComputedStyle(button).opacity))
    .toBe("1");
  await expect(page.getByRole("heading", { name: "수납", exact: true })).toBeVisible();
  await expect(page.getByText("INV-260501-0001 · 코코 · 이지은")).toBeVisible();
  const guardianGroupSection = page.locator("section.rounded-lg").filter({
    has: page.getByRole("heading", { name: "보호자 청구 묶음" }),
  });
  await expect(guardianGroupSection).toBeVisible();
  await expect(guardianGroupSection.getByText("이지은", { exact: true })).toBeVisible();
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

test("billing side panel switches between unpaid and closed queues", async ({ page }) => {
  await page.goto("/w/clair-demo/billing?modulePanel=open&right=open&aside=closed");

  const sidePanel = page.locator("aside").first();
  await sidePanel.getByTestId("billing-queue-item-invoice-dubu-260501").click();
  await expect(page.getByText("INV-260501-0002 · 두부 · 정하린")).toBeVisible();

  await sidePanel.getByTestId("billing-queue-item-invoice-nabi-260414").click();
  await expect(page.getByText("INV-260414-0007 · 나비 · 오세아")).toBeVisible();
  await expect(page.getByText("수납완료").first()).toBeVisible();
});

test("billing opens the kong-vomit invoice from query and explains completion state", async ({ page }) => {
  await page.goto(
    "/w/clair-demo/billing?scenario=kong-vomit&patientId=patient-kong&encounterId=encounter-kong-260501&invoiceId=invoice-kong-260501&right=open"
  );

  await expect(page.getByText("INV-260501-0003 · 콩이 · 김하늘")).toBeVisible();
  await expect(page.getByRole("heading", { name: "수납 요약" })).toBeVisible();
  await expect(page.getByText("진료 / 검사 / 영상 / 조제 / 처치 항목을 보호자 김하늘에게 안내합니다")).toBeVisible();
  await expect(page.getByText("156,500원").first()).toBeVisible();
  await expect(page.getByText("복부 초음파")).toBeVisible();
  await expect(page.getByText("Maropitant 16mg T")).toBeVisible();

  await page.getByRole("button", { name: "수납 완료", exact: true }).click();
  const paidDialog = page.getByRole("dialog", { name: "수납 완료 전 확인" });
  await expect(paidDialog).toBeVisible();
  await expect(paidDialog).toContainText("156,500원");
  await paidDialog.getByRole("button", { name: "수납 완료 저장" }).click();

  await expect(page.getByText("수납완료").first()).toBeVisible();
  await expect(page.getByText("세션 내 수납 완료")).toBeVisible();
  await expect(page.getByText("정산 완료").first()).toBeVisible();
});

test("billing financial confirmation failure shows persistent recovery action", async ({ page }) => {
  await page.route("**/api/workspaces/clair-demo/billing/invoice-lines", async (route) => {
    if (route.request().method() === "PATCH") {
      await route.fulfill({
        contentType: "application/json",
        status: 500,
        body: JSON.stringify({ ok: false, error: "db_write_failed", status: 500 }),
      });
      return;
    }

    await route.continue();
  });

  await page.goto("/w/clair-demo/billing?modulePanel=open&right=open&aside=closed");

  await page.getByRole("button", { name: "청구 확정" }).click();
  const issueDialog = page.getByRole("dialog", { name: "청구 확정 전 확인" });
  await expect(issueDialog).toBeVisible();
  await issueDialog.getByRole("button", { name: "청구 확정 저장" }).click();

  await expect(page.getByTestId("billing-financial-error-alert")).toContainText(
    "청구 확정이 저장되지 않았어"
  );
  await expect(page.getByRole("button", { name: "청구 확정 다시 시도" })).toBeVisible();
});
