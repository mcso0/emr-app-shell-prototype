import { expect, test } from "@playwright/test";

test("dispensing shell supports panels and drawer", async ({ page }) => {
  await page.goto("/w/clair-demo/dispensing");
  await expect(page.getByRole("heading", { name: "조제 지시서" })).toBeVisible();

  await page.getByRole("button", { name: "조제이력" }).click();
  await expect(page.getByText("26.04.11")).toBeVisible();

  await page.getByRole("button", { name: "조제이력" }).click();
  await page.getByTestId("order-row-section-0-o-10023").click({ position: { x: 100, y: 20 } });
  await expect(page.getByText("상세 정보")).toBeVisible();
  await expect(page.locator('input[value="Atorvastatin 20mg"]')).toBeVisible();

  await page.getByRole("button", { name: "상세 닫기" }).click();
  await expect(page.getByText("상세 정보")).toBeHidden();
});

test("dispensing table supports hover selection and bulk completion", async ({ page }) => {
  await page.goto("/w/clair-demo/dispensing");

  const row = page.getByTestId("order-row-section-0-o-10024");
  const checkbox = row.getByRole("checkbox");

  await expect(row.getByText("요청").first()).toBeVisible();
  const statusBadge = row.getByTestId("order-status-badge-o-10024");
  const statusIcon = statusBadge.getByTestId("order-status-badge-o-10024-icon");
  await expect(statusIcon).toHaveCSS("width", "12px");
  await expect(statusIcon).toHaveCSS("height", "12px");
  await expect(statusIcon).toHaveCSS("color", "rgb(45, 55, 72)");
  await expect(checkbox).toHaveCSS("opacity", "0");
  await row.hover();
  await expect(checkbox).toHaveCSS("opacity", "1");

  await checkbox.click();
  await expect(page.getByText("상세 정보")).toBeHidden();
  await expect(page.getByText("선택한 오더 1개")).toBeVisible();

  await page.getByRole("button", { name: "선택 오더 완료" }).click();
  await expect(page.getByText("선택한 오더 1개")).toBeHidden();
  await expect(row.getByText("완료").first()).toBeVisible();
});

test("dispensing table column grips resize with a minimum width", async ({ page }) => {
  await page.goto("/w/clair-demo/dispensing");

  const grip = page.getByRole("button", { name: "status 컬럼 너비 조절" }).first();
  const header = page.getByRole("columnheader", { name: "상태" }).first();
  const before = await header.boundingBox();
  const gripBox = await grip.boundingBox();

  expect(before).not.toBeNull();
  expect(gripBox).not.toBeNull();

  await page.mouse.move(gripBox!.x + gripBox!.width / 2, gripBox!.y + gripBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(gripBox!.x - 240, gripBox!.y + gripBox!.height / 2);
  await page.mouse.up();

  const after = await header.boundingBox();
  expect(after).not.toBeNull();
  expect(after!.width).toBeGreaterThanOrEqual(76);
  expect(after!.width).toBeLessThanOrEqual(before!.width);
});

test("dispensing order group segmented control filters groups", async ({ page }) => {
  await page.goto("/w/clair-demo/dispensing?modulePanel=closed&aside=closed");

  const allFilter = page.getByRole("button", { name: "전체 12" });
  const oralFilter = page.getByRole("button", { name: "경구제 6" });
  const otherFilter = page.getByRole("button", { name: "기타 6" });

  await expect(allFilter).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("경구제 오더 그룹")).toBeVisible();
  await expect(page.getByText("기타 오더 그룹")).toBeVisible();

  await otherFilter.click();
  await expect(otherFilter).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("경구제 오더 그룹")).toBeHidden();
  await expect(page.getByText("기타 오더 그룹")).toBeVisible();

  await oralFilter.click();
  await expect(oralFilter).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("경구제 오더 그룹")).toBeVisible();
  await expect(page.getByText("기타 오더 그룹")).toBeHidden();
});

test("dispensing order group section can collapse and expand", async ({ page }) => {
  await page.goto("/w/clair-demo/dispensing?modulePanel=open&aside=closed");

  const firstRow = page.getByTestId("order-row-section-0-o-10023");
  const collapseButton = page.getByRole("button", { name: "항생제 세트 A 접기" }).first();

  await expect(firstRow).toBeVisible();
  await expect(collapseButton).toHaveAttribute("aria-expanded", "true");

  await collapseButton.click();
  await expect(firstRow).toBeHidden();
  const expandButton = page.getByRole("button", { name: "항생제 세트 A 펼치기" }).first();
  await expect(expandButton).toHaveAttribute("aria-expanded", "false");

  await expandButton.click();
  await expect(firstRow).toBeVisible();
  await expect(collapseButton).toHaveAttribute("aria-expanded", "true");
});

test("dispensing order groups support assignment status actions without add or delete", async ({ page }) => {
  await page.goto("/w/clair-demo/dispensing");
  await expect(page).toHaveURL(/aside=closed/);

  await expect(page.getByRole("button", { name: /추가|생성|새 오더/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /삭제|제거/ })).toHaveCount(0);

  const row = page.getByTestId("order-row-section-0-o-10024");

  await page.getByRole("button", { name: "담당하기" }).first().click();
  await expect(page.getByRole("button", { name: "조제중" }).first()).toBeVisible();
  await expect(page.getByText("송하윤").first()).toBeVisible();
  await expect(row.getByRole("combobox", { name: /담당 변경/ })).toHaveValue("tech-sh");

  await page.getByRole("button", { name: "항생제 세트 A 상태 액션" }).first().click();
  await page.getByText("담당취소").click();
  await expect(page.getByRole("button", { name: "담당하기" }).first()).toBeVisible();
  await expect(row.getByRole("combobox", { name: /담당 변경/ })).toHaveValue("");

  await page.getByRole("button", { name: "담당하기" }).first().click();
  await page.getByRole("button", { name: "항생제 세트 A 상태 액션" }).first().click();
  await page.getByRole("menuitem", { name: "완료" }).click();
  await expect(page.getByRole("button", { name: "조제완료" }).first()).toBeVisible();
  await expect(row.getByText("완료").first()).toBeVisible();
});

test("dispensing assignee cell changes technician without opening drawer", async ({ page }) => {
  await page.goto("/w/clair-demo/dispensing");
  await expect(page).toHaveURL(/aside=closed/);

  const row = page.getByTestId("order-row-section-0-o-10024");
  const assigneeSelect = row.getByRole("combobox", { name: /담당 변경/ });

  await assigneeSelect.scrollIntoViewIfNeeded();
  await assigneeSelect.selectOption("tech-jh");

  await expect(page.getByRole("button", { name: "상세 닫기" })).toBeHidden();
  await expect(assigneeSelect).toHaveValue("tech-jh");
  await expect(page.getByText("박준호").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "상세 닫기" })).toBeHidden();

  await row.click({ position: { x: 100, y: 20 } });
  await expect(page.getByRole("button", { name: "상세 닫기" })).toBeVisible();
});

test("dispensing history aside can open from shared URL state", async ({ page }) => {
  await page.goto("/w/clair-demo/dispensing?modulePanel=open&aside=history");

  await expect(page.getByRole("heading", { name: "조제 지시서" })).toBeVisible();
  await expect(page.getByRole("button", { name: "이력 패널 접기" })).toBeVisible();
  await expect(page.getByText("5", { exact: true })).toBeVisible();
  await expect(page.getByText("26.04.11")).toBeVisible();

  const firstHistoryGroup = page.getByTestId("history-group-26.04.11");
  const firstHistoryGroupToggle = firstHistoryGroup.getByTestId("history-group-toggle-26.04.11");

  await expect(firstHistoryGroupToggle).toHaveAttribute("aria-expanded", "true");
  await firstHistoryGroupToggle.click();
  await expect(firstHistoryGroupToggle).toHaveAttribute("aria-expanded", "false");
  await expect(firstHistoryGroup.getByText("[CBC] CBC 검사 세트")).toBeHidden();
  await expect(firstHistoryGroup.getByText("Atorvastatin 20(mg) T 9:00 AM")).toBeHidden();
  await expect(page.getByTestId("history-group-26.03.12").getByText("[CBC] CBC 검사 세트")).toBeVisible();

  await firstHistoryGroupToggle.click();
  await expect(firstHistoryGroupToggle).toHaveAttribute("aria-expanded", "true");
  await expect(firstHistoryGroup.getByText("[CBC] CBC 검사 세트")).toBeVisible();
});

test("module side panel can collapse and reopen from the rail", async ({ page }) => {
  await page.goto("/w/clair-demo/dispensing?modulePanel=open&aside=closed");

  await expect(page.getByTestId("module-side-panel-title")).toHaveText("조제/처치");
  await expect(page.getByTestId("nav-rail-active-item")).toHaveAttribute("aria-label", "조제/처치");
  await expect(page.getByRole("button", { name: "사용자 프로필" })).toContainText("SH");
  await page.getByRole("button", { name: "사이드 패널 접기", exact: true }).click();
  await expect(page).toHaveURL(/modulePanel=closed/);
  await expect(page.getByRole("button", { name: "사이드 패널 펼치기" })).toBeVisible();

  await page.getByRole("button", { name: "사이드 패널 펼치기" }).click();
  await expect(page).toHaveURL(/modulePanel=open/);
  await expect(page.getByTestId("module-side-panel-title")).toHaveText("조제/처치");
});

test("module side panel order type segmented control filters side orders", async ({ page }) => {
  await page.goto("/w/clair-demo/dispensing?modulePanel=open&aside=closed");

  const sidePanel = page.locator("aside").first();
  const orderTypeFilter = sidePanel.getByRole("group", { name: "오더 유형 필터" });
  const allFilter = orderTypeFilter.getByRole("button", { name: "전체" });
  const dispensingFilter = orderTypeFilter.getByRole("button", { name: "조제" });
  const treatmentFilter = orderTypeFilter.getByRole("button", { name: "처치" });

  await expect(page.getByTestId("module-side-panel-title")).toHaveText("조제/처치");
  await expect(allFilter).toHaveAttribute("aria-pressed", "true");
  await expect(sidePanel.getByText("항생제 세트 A")).toBeVisible();
  await expect(sidePanel.getByText("수액 처치")).toBeVisible();
  await expect(sidePanel.getByText("네뷸라이징")).toBeVisible();

  const treatmentCard = page.getByTestId("order-queue-item-dispensing-queue-1");
  const treatmentCardAction = page.getByTestId("order-queue-item-action-dispensing-queue-1");
  await expect(treatmentCard).toContainText(/나비\s*·\s*오세아\s*외래/);
  await expect(treatmentCardAction).toHaveCSS("opacity", "0");
  await treatmentCard.hover();
  await expect(treatmentCardAction).toHaveCSS("opacity", "1");
  await treatmentCardAction.click();
  await expect(treatmentCard).not.toHaveAttribute("data-selected", "true");

  await treatmentFilter.click();
  await expect(treatmentFilter).toHaveAttribute("aria-pressed", "true");
  await expect(sidePanel.getByText("수액 처치")).toBeVisible();
  await expect(sidePanel.getByText("네뷸라이징")).toBeVisible();
  await expect(sidePanel.getByText("항생제 세트 A")).toBeHidden();

  await dispensingFilter.click();
  await expect(dispensingFilter).toHaveAttribute("aria-pressed", "true");
  await expect(sidePanel.getByText("항생제 세트 A")).toBeVisible();
  await expect(sidePanel.getByText("위장약 세트")).toBeVisible();
  await expect(sidePanel.getByText("수액 처치")).toBeHidden();
});

test("order queue side panel renders status groups with design token colors", async ({ page }) => {
  await page.goto("/w/clair-demo/dispensing?modulePanel=open&aside=closed");

  const sidePanel = page.locator("aside").first();
  await expect(sidePanel.getByTestId("order-queue-status-reRequested")).toContainText("재요청");
  await expect(sidePanel.getByTestId("order-queue-status-inProgress")).toContainText("진행중");
  await expect(sidePanel.getByTestId("order-queue-status-waiting")).toContainText("대기중");
  await expect(sidePanel.getByTestId("order-queue-status-completed")).toContainText("완료");
  await expect(sidePanel.getByTestId("order-queue-status-canceled")).toContainText("취소");

  await expect(sidePanel.getByTestId("order-queue-status-reRequested").locator("[aria-hidden='true']").first()).toHaveCSS("background-color", "rgb(237, 137, 54)");
  await expect(sidePanel.getByTestId("order-queue-status-inProgress").locator("[aria-hidden='true']").first()).toHaveCSS("background-color", "rgb(66, 153, 225)");
  await expect(sidePanel.getByTestId("order-queue-status-waiting").locator("[aria-hidden='true']").first()).toHaveCSS("background-color", "rgb(160, 174, 192)");
  await expect(sidePanel.getByTestId("order-queue-status-completed").locator("[aria-hidden='true']").first()).toHaveCSS("background-color", "rgb(72, 187, 120)");
  await expect(sidePanel.getByTestId("order-queue-status-canceled").locator("[aria-hidden='true']").first()).toHaveCSS("background-color", "rgb(245, 101, 101)");
});

test("order queue status groups can collapse and expand", async ({ page }) => {
  await page.goto("/w/clair-demo/dispensing?modulePanel=open&aside=history&right=closed");

  const sidePanel = page.locator("aside").first();
  const reRequestedGroup = sidePanel.getByTestId("order-queue-status-reRequested");
  const toggle = reRequestedGroup.getByRole("button", { name: "재요청 접기" });

  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(reRequestedGroup.getByTestId("order-queue-item-dispensing-queue-0")).toBeVisible();

  await toggle.click();
  const expandToggle = reRequestedGroup.getByRole("button", { name: "재요청 펼치기" });
  await expect(expandToggle).toHaveAttribute("aria-expanded", "false");
  await expect(reRequestedGroup.getByTestId("order-queue-item-dispensing-queue-0")).toBeHidden();

  await expandToggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(reRequestedGroup.getByTestId("order-queue-item-dispensing-queue-0")).toBeVisible();
});

test("shared order queue applies to placeholder modules and syncs selection summary", async ({ page }) => {
  await page.goto("/w/clair-demo/home?modulePanel=open&aside=closed");

  await expect(page.getByTestId("module-side-panel-title")).toHaveText("홈");
  await expect(page.getByTestId("order-queue-status-reRequested")).toContainText("재요청");
  await page.getByText("홈 진행 오더").click();

  const summary = page.getByTestId("order-queue-selection-summary");
  await expect(summary).toContainText("홈 진행 오더");
  await expect(summary).toContainText("진행중");
});

test("dispensing queue selection updates existing patient and instruction context", async ({ page }) => {
  await page.goto("/w/clair-demo/dispensing?modulePanel=open&aside=closed&right=closed");

  await expect(page.getByTestId("order-queue-selection-summary")).toHaveCount(0);
  await expect(page.getByTestId("instruction-status-label")).toHaveText("재요청");
  await expect(page.getByTestId("instruction-status-label")).toHaveCSS("background-color", "rgb(255, 250, 240)");
  await expect(page.getByTestId("instruction-status-label").locator("span")).toHaveCount(0);
  await expect(page.locator("[data-slot='instruction-header-order-info']")).toContainText(/조제 시작\s*10:34/);

  await page.getByTestId("order-queue-item-dispensing-queue-1").click();

  const titleBar = page.locator("[data-slot='instruction-header-title-bar']");
  await expect(titleBar).toContainText("RX-260414-0007");

  const patientContext = page.getByLabel("환자 컨텍스트 정보");
  await expect(patientContext).toContainText(/환자\s*나비/);
  await expect(patientContext).toContainText(/보호자\s*오세아/);
  await expect(patientContext).toContainText(/품종\s*러시안블루/);

  const orderInfo = page.locator("[data-slot='instruction-header-order-info']");
  await expect(orderInfo).toContainText("2026.04.14 10:42");
  await expect(orderInfo).toContainText("나비(5세) · 러시안블루");
  await expect(orderInfo).toContainText(/요청 일시\s*2026.04.14 10:42\s*진행중/);
  await expect(orderInfo).toContainText(/요청 수의사\s*김도윤/);
  await expect(orderInfo).toContainText(/조제 담당\s*송하윤/);
  await expect(orderInfo).toContainText(/조제 시작\s*10:45/);
  await expect(page.getByTestId("instruction-status-label")).toHaveCSS("background-color", "rgb(240, 248, 255)");

  const resultContent = page.locator("[data-slot='instruction-result-scroll-content']");
  await expect(resultContent).toContainText("수액 처치");
  await expect(resultContent).toContainText("Lactated Ringer's 120ml SC");
  await expect(resultContent).not.toContainText("항생제 세트 A");

  await page.getByTestId("order-queue-item-dispensing-queue-4").click();
  await expect(page.getByTestId("instruction-status-label")).toHaveText("완료");
  await expect(page.getByTestId("instruction-status-label")).toHaveCSS("background-color", "rgb(240, 255, 244)");
  await expect(page.getByTestId("order-status-badge-neb-o-50010")).toHaveCSS("background-color", "rgb(240, 255, 244)");
  await expect(page.getByTestId("order-status-badge-neb-o-50010")).toHaveCSS("color", "rgb(39, 103, 73)");

  await page.getByTestId("order-queue-item-dispensing-queue-5").click();
  await expect(page.getByTestId("instruction-status-label")).toHaveText("취소");
  await expect(page.getByTestId("instruction-status-label")).toHaveCSS("background-color", "rgb(255, 245, 245)");
  await expect(page.getByTestId("order-status-badge-cardio-o-60010")).toHaveCSS("background-color", "rgb(255, 245, 245)");
  await expect(page.getByTestId("order-status-badge-cardio-o-60010")).toHaveCSS("color", "rgb(197, 48, 48)");
});

test("module-specific order queue status extensions render after defaults", async ({ page }) => {
  await page.goto("/w/clair-demo/treatment?modulePanel=open&aside=closed");

  const sidePanel = page.locator("aside").first();
  await expect(sidePanel.getByTestId("order-queue-status-partiallyCompleted")).toContainText("부분완료");
  await expect(sidePanel.getByText("처치 부분완료 오더")).toBeVisible();
});

test("right panel can be collapsed on a module that owns it", async ({ page }) => {
  await page.goto("/w/clair-demo/treatment");
  await expect(page.getByTestId("module-side-panel-title")).toHaveText("처치");
  await expect(page.getByRole("heading", { name: "처치 지시서" })).toBeVisible();
  await expect(page.getByText("Right Subpanel")).toBeVisible();
  await expect(page).toHaveURL(/right=open/);
  await page.getByTestId("order-row-section-0-o-10023").click({ position: { x: 100, y: 20 } });
  await expect(page.getByRole("button", { name: "상세 닫기" })).toBeVisible();
  await page.getByRole("button", { name: "상세 닫기" }).click();
  await page.getByRole("button", { name: "우측 패널 접기" }).click();
  await expect(page).toHaveURL(/right=closed/);
  await expect(page.getByRole("button", { name: "우측 패널 펼치기" })).toBeVisible();
  await page.getByRole("button", { name: "우측 패널 펼치기" }).click();
  await expect(page).toHaveURL(/right=open/);
  await expect(page.getByText("Right Subpanel")).toBeVisible();
});

test("patient side panel trigger toggles the open panel", async ({ page }) => {
  await page.goto("/w/clair-demo/dispensing?modulePanel=open&aside=closed&right=open");

  await expect(page.getByText("환자 사이드 패널")).toBeVisible();
  await page.getByRole("button", { name: "환자 사이드 패널 접기" }).click();
  await expect(page).toHaveURL(/right=closed/);
  await expect(page.getByText("환자 사이드 패널")).toBeHidden();

  await page.getByRole("button", { name: "환자 사이드 패널 열기" }).click();
  await expect(page).toHaveURL(/right=open/);
  await expect(page.getByText("환자 사이드 패널")).toBeVisible();
});
