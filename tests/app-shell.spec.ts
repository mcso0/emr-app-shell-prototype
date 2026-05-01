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
  await expect(page.getByTestId("nav-rail-active-item")).toHaveAttribute("aria-label", "조제");
  await expect(page.getByRole("button", { name: "사용자 프로필" })).toContainText("SH");
  await page.getByRole("button", { name: "사이드 패널 접기" }).click();
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
