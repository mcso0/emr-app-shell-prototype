import { expect, test } from "@playwright/test";

test("hospital admin order management opens with category and subcategory navigation", async ({ page }) => {
  await page.goto("/w/clair-demo/orders?modulePanel=open&aside=history");

  await expect(page.getByTestId("nav-rail-active-item")).toHaveAttribute("aria-label", "병원관리");
  await expect(page.getByRole("heading", { name: "임상병리 검사" })).toBeVisible();
  await expect(page.locator("#hospital-admin-content-aside")).toHaveCount(0);
  await expect(page.getByTestId("hospital-admin-menu-order-management")).toContainText("Order 관리");
  await expect(page.locator('[data-testid^="hospital-admin-category-"]')).toHaveCount(0);
  await expect(page.locator('[data-selected="true"]')).toHaveCount(1);
  await expect(page.getByTestId("hospital-admin-side-panel").getByRole("button", { name: /^전체/ })).toHaveCount(0);
  await expect(page.getByTestId("order-set-placeholder")).toContainText("미구현");
  const expectedTopLevelMenuOrder = [
    "병원기본설정",
    "병원구성원 관리",
    "감사 로그",
    "근무표",
    "역할 및 권한",
    "공간/시간 관리",
    "바이탈 관리",
    "Order 관리",
    "진료과 분리운영",
    "차트 템플릿",
    "장비 관리",
    "마약류 관리",
    "Order 세트",
    "프린터 설정",
    "데이터랩",
  ];
  const actualTopLevelMenuOrder = await page
    .getByTestId("hospital-admin-side-panel")
    .getByRole("button")
    .evaluateAll((buttons, expectedLabels) =>
      buttons.flatMap((button) => {
        const text = button.textContent ?? "";
        const label = expectedLabels.find((candidate) => text.includes(candidate));
        return label ? [label] : [];
      }), expectedTopLevelMenuOrder);
  expect(actualTopLevelMenuOrder).toEqual(expectedTopLevelMenuOrder);
  const sidePanelMetrics = await page.getByTestId("hospital-admin-menu-order-management").evaluate((trigger) => {
    const section = trigger.closest("section");
    const panel = trigger.closest('[data-testid="hospital-admin-side-panel"]');
    const icon = trigger.querySelector('[data-emr-module-list-section-icon="true"]');
    const label = trigger.querySelector(".emr-text-dense");
    const rail = section?.querySelector('[data-emr-module-list-child-rail="true"]');
    const childList = section?.querySelector('[data-emr-module-list-child-list="true"]');
    const selectedLeaf = section?.querySelector('[data-selected="true"]');

    if (!section || !panel || !icon || !label || !rail || !childList || !selectedLeaf) {
      throw new Error("Missing module list side-panel layout target");
    }

    const sectionRect = section.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const iconRect = icon.getBoundingClientRect();
    const labelRect = label.getBoundingClientRect();
    const railRect = rail.getBoundingClientRect();
    const childListRect = childList.getBoundingClientRect();
    const leafRect = selectedLeaf.getBoundingClientRect();

    return {
      childListOffset: childListRect.left - sectionRect.left,
      iconCenterX: iconRect.left + iconRect.width / 2,
      iconLabelGap: labelRect.left - iconRect.right,
      iconWidth: iconRect.width,
      leafHeight: leafRect.height,
      leafRightInset: panelRect.right - leafRect.right,
      railCenterX: railRect.left + railRect.width / 2,
    };
  });
  expect(Math.round(sidePanelMetrics.iconCenterX)).toBe(Math.round(sidePanelMetrics.railCenterX));
  expect(Math.round(sidePanelMetrics.iconWidth)).toBe(14);
  expect(Math.round(sidePanelMetrics.iconLabelGap)).toBe(8);
  expect(Math.round(sidePanelMetrics.childListOffset)).toBe(30);
  expect(Math.round(sidePanelMetrics.leafHeight)).toBe(32);
  expect(Math.round(sidePanelMetrics.leafRightInset)).toBe(16);
  const topItemMetrics = await page
    .getByTestId("hospital-admin-side-panel")
    .getByRole("button", { name: /병원구성원 관리/ })
    .evaluate((trigger) => {
      const icon = trigger.querySelector('[data-emr-module-list-item-icon="true"]');
      const label = trigger.querySelector(".emr-text-dense");

      if (!icon || !label) {
        throw new Error("Missing module list top item icon target");
      }

      const iconRect = icon.getBoundingClientRect();
      const labelRect = label.getBoundingClientRect();

      return {
        iconLabelGap: labelRect.left - iconRect.right,
        iconWidth: iconRect.width,
      };
    });
  expect(Math.round(topItemMetrics.iconWidth)).toBe(14);
  expect(Math.round(topItemMetrics.iconLabelGap)).toBe(8);
  const disabledTopItemColors = await page
    .getByTestId("hospital-admin-side-panel")
    .getByRole("button", { name: /진료과 분리운영/ })
    .evaluate((trigger) => {
      const icon = trigger.querySelector('[data-emr-module-list-item-icon="true"]');
      const label = trigger.querySelector(".emr-text-dense");

      if (!icon || !label) {
        throw new Error("Missing disabled module list color target");
      }

      return {
        iconColor: getComputedStyle(icon).color,
        labelColor: getComputedStyle(label).color,
      };
    });
  expect(disabledTopItemColors.iconColor).toBe(disabledTopItemColors.labelColor);
  await page
    .getByTestId("hospital-admin-menu-order-management")
    .locator("xpath=ancestor::section")
    .locator('[data-selected="true"]')
    .hover();
  await expect
    .poll(async () =>
      page.getByTestId("hospital-admin-menu-order-management").evaluate((trigger) => {
        const panel = trigger.closest('[data-testid="hospital-admin-side-panel"]');
        const selectedLeaf = trigger.closest("section")?.querySelector('[data-selected="true"]');

        if (!panel || !selectedLeaf) {
          throw new Error("Missing selected module list leaf");
        }

        const panelRect = panel.getBoundingClientRect();
        const leafRect = selectedLeaf.getBoundingClientRect();

        return Math.round(panelRect.right - leafRect.right);
      })
    )
    .toBe(16);
  await expect(page.getByRole("heading", { name: "임상병리 검사" })).toBeVisible();
  await expect(page.getByRole("button", { name: /임상병리 검사/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("group", { name: "임상병리 검사 하위 타입" }).getByRole("button", { name: "전체" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("hospital-order-catalog-read-status")).toContainText("Workspace catalog 기준");
  await expect(page.getByTestId("hospital-order-row-ord-lab-cbc-baso")).toBeVisible();

  await page.getByRole("button", { name: /처방/ }).click();
  await expect(page.getByRole("heading", { name: "처방" })).toBeVisible();
  await expect(page.getByTestId("hospital-order-row-ord-med-maropitant")).toBeVisible();
});

test("hospital admin settings hub opens static screens and role management", async ({ page }) => {
  await page.goto("/w/clair-demo/orders?modulePanel=open");

  const sidePanel = page.getByTestId("hospital-admin-side-panel");
  const plannedScreens = [
    { button: "공간/시간 관리", heading: "공간/시간 관리", testId: "hospital-admin-space-time-screen" },
  ];

  for (const screen of plannedScreens) {
    await sidePanel.getByRole("button", { name: new RegExp(screen.button) }).click();
    await expect(page.getByTestId(screen.testId)).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: screen.heading, exact: true })).toBeVisible();
    await page.getByRole("button", { name: "시안 저장" }).click();
    await expect(page.getByTestId(screen.testId)).toContainText("방금 시안 저장");
  }

  await sidePanel.getByRole("button", { name: "역할 및 권한" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "역할 및 권한" })).toBeVisible();
  await expect(page.getByText("권한 역할", { exact: true }).first()).toBeVisible();

  await expect(sidePanel.getByRole("button", { name: /진료과 분리운영/ })).toBeDisabled();
  await expect(sidePanel.getByRole("button", { name: /차트 템플릿/ })).toBeDisabled();
});

test("hospital vital settings follows the reviewed V3 interaction", async ({ page }) => {
  let items: Array<{ key: string; enabled: boolean; displayUnit: string; sortOrder: number }> = [
    { key: "weight", enabled: true, displayUnit: "kg", sortOrder: 0 },
    { key: "temperature", enabled: true, displayUnit: "°C", sortOrder: 1 },
    { key: "heart_rate", enabled: true, displayUnit: "bpm", sortOrder: 2 },
    { key: "respiratory_rate", enabled: true, displayUnit: "rpm", sortOrder: 3 },
  ];
  const presets = [
    { key: "weight", label: "체중", description: "환자의 현재 체중", canonicalUnit: "kg", allowedDisplayUnits: ["kg", "g"], requiredInWorkspace: true },
    { key: "temperature", label: "체온", description: "체온계로 측정한 체온", canonicalUnit: "°C", allowedDisplayUnits: ["°C", "°F"], requiredInWorkspace: true },
    { key: "heart_rate", label: "심박수", description: "분당 심장 박동 수", canonicalUnit: "bpm", allowedDisplayUnits: ["bpm"], requiredInWorkspace: false },
    { key: "respiratory_rate", label: "호흡수", description: "분당 호흡 횟수", canonicalUnit: "rpm", allowedDisplayUnits: ["rpm"], requiredInWorkspace: false },
    { key: "blood_pressure", label: "혈압", description: "수축기 단독 또는 수축기/이완기", canonicalUnit: "mmHg", allowedDisplayUnits: ["mmHg"], requiredInWorkspace: false },
  ];
  await page.route("**/api/workspaces/clair-demo/vital-settings", async (route) => {
    if (route.request().method() === "PUT") {
      items = ((await route.request().postDataJSON()) as { items: typeof items }).items;
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, status: 200, canManage: true, presets, items }),
    });
  });
  await page.goto("/w/clair-demo/orders?modulePanel=open");
  await page.getByTestId("hospital-admin-side-panel").getByRole("button", { name: /바이탈 관리/ }).click();

  const screen = page.getByTestId("hospital-admin-vitals-screen");
  await expect(screen.getByRole("heading", { level: 1, name: "바이탈 관리" })).toBeVisible();
  await expect(screen).toContainText("체중과 체온은 항상 사용되며, 실제 측정값 입력은 선택입니다.");
  await expect(screen).not.toContainText("영향 범위");
  await expect(screen).not.toContainText("향후 데이터");
  await expect(screen).not.toContainText("기본 바이탈 정상 범위");
  await expect(screen.getByRole("button", { name: "바이탈 추가" })).toHaveCount(1);

  const resetButton = screen.getByTestId("vital-settings-reset");
  const saveButton = screen.getByTestId("vital-settings-save");
  await expect(resetButton).toBeDisabled();
  await expect(saveButton).toBeDisabled();
  await expect(screen.getByTestId("vital-settings-list").locator('[data-testid^="vital-setting-row-"]')).toHaveCount(4);
  await expect(screen.getByText("필수", { exact: true })).toHaveCount(2);
  await expect(screen.getByRole("switch", { name: "체중 사용" })).toHaveCount(0);
  await expect(screen.getByRole("switch", { name: "체온 사용" })).toHaveCount(0);
  await expect(screen.getByRole("button", { name: "체중 작업" })).toHaveCount(0);
  await expect(screen.getByRole("button", { name: "심박수 작업" })).toBeVisible();

  const weightGrip = screen.getByRole("button", { name: "체중 순서 변경" });
  await expect(weightGrip.locator(".oi-reorder-alt")).toBeVisible();
  await expect(weightGrip).toHaveCSS("cursor", "grab");
  const gripColors = await weightGrip.evaluate((element) => ({
    background: getComputedStyle(element).backgroundColor,
    color: getComputedStyle(element).color,
  }));
  await weightGrip.hover();
  await expect.poll(() => weightGrip.evaluate((element) => ({
    background: getComputedStyle(element).backgroundColor,
    color: getComputedStyle(element).color,
  }))).toEqual(gripColors);
  const weightGripBox = await weightGrip.boundingBox();
  const temperatureRowBox = await screen.getByTestId("vital-setting-row-temperature").boundingBox();
  if (!weightGripBox || !temperatureRowBox) throw new Error("바이탈 드래그 대상을 찾지 못했습니다.");
  await page.mouse.move(weightGripBox.x + weightGripBox.width / 2, weightGripBox.y + weightGripBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    temperatureRowBox.x + temperatureRowBox.width / 2,
    temperatureRowBox.y + temperatureRowBox.height - 2,
    { steps: 8 },
  );
  await page.mouse.up();
  await expect(screen.getByTestId("vital-settings-list").locator('[data-testid^="vital-setting-row-"]').nth(1)).toHaveAttribute(
    "data-testid",
    "vital-setting-row-weight",
  );
  await resetButton.click();

  await screen.getByLabel("체중 표시 단위").click();
  await page.getByRole("option", { name: "g", exact: true }).click();
  await expect(resetButton).toBeEnabled();
  await expect(saveButton).toBeEnabled();
  await resetButton.click();
  await expect(screen.getByLabel("체중 표시 단위")).toContainText("kg");
  await expect(resetButton).toBeDisabled();
  await expect(saveButton).toBeDisabled();

  await screen.getByRole("button", { name: "심박수 작업" }).click();
  await page.getByRole("menuitem", { name: "목록에서 제거" }).click();
  await expect(screen.getByTestId("vital-setting-row-heart_rate")).toHaveCount(0);
  await expect(saveButton).toBeEnabled();
  await page.getByRole("button", { name: "되돌리기" }).click();
  await expect(screen.getByTestId("vital-setting-row-heart_rate")).toBeVisible();

  await screen.getByRole("button", { name: "심박수 작업" }).click();
  await page.getByRole("menuitem", { name: "목록에서 제거" }).click();
  await screen.getByRole("button", { name: "바이탈 추가" }).click();
  let addDialog = page.getByRole("dialog", { name: "바이탈 추가" });
  await expect(addDialog.getByRole("button", { name: /심박수/ })).toBeVisible();
  await addDialog.getByRole("button", { name: /심박수/ }).click();
  await screen.getByRole("button", { name: "심박수 작업" }).click();
  await page.getByRole("menuitem", { name: "목록에서 제거" }).click();

  await screen.getByRole("button", { name: "바이탈 추가" }).click();
  addDialog = page.getByRole("dialog", { name: "바이탈 추가" });
  await addDialog.getByRole("button", { name: /혈압/ }).click();
  await expect(screen.getByTestId("vital-setting-row-blood_pressure")).toBeVisible();
  await saveButton.click();

  const saveDialog = page.getByTestId("vital-settings-save-dialog");
  await expect(saveDialog).toContainText("접수와 진료 화면에 같은 설정이 적용됩니다.");
  await expect(saveDialog).toContainText("목록에서 제거: 심박수");
  await expect(saveDialog).toContainText("기존 기록은 삭제되지 않으며, 바이탈 추가에서 다시 추가할 수 있습니다.");
  await expect(saveDialog).toContainText("체중 · 체온 · 호흡수 · 혈압");
  await saveDialog.getByRole("button", { name: "저장", exact: true }).click();
  await expect(saveButton).toBeDisabled();
  await expect(resetButton).toBeDisabled();
  expect(items.some((item) => item.key === "heart_rate")).toBe(false);
  expect(items.find((item) => item.key === "weight")?.enabled).toBe(true);
  expect(items.find((item) => item.key === "temperature")?.enabled).toBe(true);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth
  )).toBe(true);
  await expect.poll(() => screen.locator('[data-slot="card-content"]').evaluate((element) =>
    element.scrollWidth > element.clientWidth
  )).toBe(true);
});

test("hospital basic settings uses the reviewed information hierarchy", async ({ page }) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/w/clair-demo/orders?modulePanel=open");
  await page.getByTestId("hospital-admin-menu-settings").click();

  const screen = page.getByTestId("hospital-admin-settings-screen");
  await expect(screen.getByRole("heading", { level: 1, name: "병원 기본 설정" })).toBeVisible();
  await expect(screen).toContainText("병원 정보와 운영시간을 관리합니다.");
  await expect(screen).not.toContainText("workspace-clair-cheongdam");
  await expect(screen).not.toContainText("영향 범위");
  await expect(screen).not.toContainText("향후 데이터");
  await expect(screen).not.toContainText("Phase 1");
  await expect(screen.getByLabel("병원명")).toHaveAttribute("readonly", "");
  await expect(screen.getByLabel("대표자/원장명")).toHaveAttribute("readonly", "");
  await expect(screen.getByLabel("주소")).toHaveAttribute("readonly", "");
  await expect(screen.getByTestId("hospital-settings-change-bar")).toBeHidden();

  await screen.getByRole("button", { name: "주소 복사" }).click();
  await expect(screen.getByRole("button", { name: "복사됨" })).toBeVisible();
  await expect(screen.getByRole("status")).toHaveText("주소가 복사되었습니다.");

  await screen.getByRole("button", { name: "병원 정보 변경 요청" }).click();
  const requestDialog = page.getByRole("dialog", { name: "병원 정보 변경 요청" });
  await requestDialog.getByRole("button", { name: "내용 확인" }).click();
  await expect(requestDialog.getByText("변경 사유를 입력해 주세요.")).toBeVisible();
  await requestDialog.getByLabel("변경 사유").fill("사업자 정보가 변경되었습니다.");
  await requestDialog.getByRole("button", { name: "내용 확인" }).click();
  await expect(screen.getByText("변경 요청 내용을 확인했습니다.")).toBeVisible();

  await screen.getByLabel("홈페이지").fill("clair.example.com");
  await screen.getByTestId("hospital-settings-change-bar").getByRole("button", { name: "변경사항 저장" }).click();
  await expect(screen.getByText("홈페이지 주소를 http:// 또는 https:// 형식으로 입력해 주세요.")).toBeVisible();
  await expect(screen.getByLabel("홈페이지")).toBeFocused();
});

test("hospital basic settings saves a session draft and distinguishes operating-hours feedback", async ({ page }) => {
  await page.goto("/w/clair-demo/orders?modulePanel=open");
  await page.getByTestId("hospital-admin-menu-settings").click();

  const changeBar = page.getByTestId("hospital-settings-change-bar");
  await page.getByLabel("팩스").fill("02-6203-9999");
  await expect(changeBar).toBeVisible();
  await changeBar.getByRole("button", { name: "변경사항 저장" }).click();
  await expect(changeBar).toBeHidden();
  await expect(page.getByText("병원 기본 설정이 저장되었습니다.")).toBeVisible();
  await expect(page.getByText("운영시간이 변경되었습니다.")).toBeHidden();

  await page.getByTestId("hospital-admin-menu-roles").click();
  await page.getByTestId("hospital-admin-menu-settings").click();
  await expect(page.getByLabel("팩스")).toHaveValue("02-6203-9999");

  await page.getByRole("combobox", { name: "월요일 진료 종료" }).click();
  await page.getByRole("option", { name: "18:00", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "다른 운영일에도 적용할까요?" })).toBeVisible();
  await page.getByRole("button", { name: "모든 운영일에 적용" }).click();
  await expect(page.getByRole("combobox", { name: "화요일 진료 종료" })).toContainText("18:00");
  await page.getByRole("combobox", { name: "월요일 진료 종료" }).click();
  await page.getByRole("option", { name: "18:30", exact: true }).click();
  await page.getByRole("button", { name: "이 요일만 적용" }).click();
  await expect(page.getByRole("combobox", { name: "월요일 진료 종료" })).toContainText("18:30");
  await expect(page.getByRole("combobox", { name: "화요일 진료 종료" })).toContainText("18:00");
  await changeBar.getByRole("button", { name: "변경사항 저장" }).click();
  await expect(page.getByText("운영시간이 변경되었습니다.")).toBeVisible();

  await page.getByLabel("대표 전화 *").fill("02-6203-0000");
  await changeBar.getByRole("button", { name: "변경 전으로 되돌리기" }).click();
  await expect(page.getByRole("dialog", { name: "저장하지 않은 변경사항을 되돌릴까요?" })).toBeVisible();
  await page.getByRole("button", { name: "모두 되돌리기" }).click();
  await expect(changeBar).toBeHidden();
  await expect(page.getByLabel("대표 전화 *")).toHaveValue("02-6203-7582");
});

test("hospital basic settings supports exception editing and guarded navigation", async ({ page }) => {
  await page.goto("/w/clair-demo/orders?modulePanel=open");
  await page.getByTestId("hospital-admin-menu-settings").click();

  const exceptionEmptyState = page.getByTestId("hospital-settings-exception-empty-state");
  await expect(exceptionEmptyState).toHaveAttribute("data-size", "sm");
  await expect(exceptionEmptyState).toHaveAttribute("data-surface", "table");
  await expect(exceptionEmptyState).toContainText("등록된 예외 일정이 없습니다");

  await page.getByRole("button", { name: "예외 일정 추가" }).click();
  const createDialog = page.getByRole("dialog", { name: "예외 일정 추가" });
  await createDialog.getByLabel("날짜").fill("2026-07-14");
  await createDialog.getByRole("button", { name: "추가" }).click();
  const exceptionRow = page.getByTestId("hospital-settings-exception-2026-07-14");
  await expect(exceptionRow).toContainText("휴무일");
  await exceptionRow.getByRole("button", { name: "수정" }).click();
  const editDialog = page.getByRole("dialog", { name: "예외 일정 수정" });
  await editDialog.getByRole("combobox", { name: "운영 방식" }).click();
  await page.getByRole("option", { name: "직접 설정", exact: true }).click();
  await editDialog.getByRole("button", { name: "저장" }).click();
  await expect(exceptionRow).toContainText("직접 설정");
  await expect(exceptionRow.getByRole("button", { name: "삭제" })).toHaveClass(
    /bg-\[var\(--emr-status-danger-bg\)\]/
  );

  await page.getByTestId("hospital-admin-menu-roles").click();
  await expect(page.getByRole("dialog", { name: "저장하지 않은 변경사항이 있습니다" })).toBeVisible();
  await page.getByRole("button", { name: "계속 편집" }).click();
  await expect(page.getByTestId("hospital-admin-settings-screen")).toBeVisible();

  await page
    .getByTestId("hospital-admin-menu-order-management")
    .locator("xpath=ancestor::section")
    .getByRole("button", { name: /처방/ })
    .click();
  await expect(page.getByRole("dialog", { name: "저장하지 않은 변경사항이 있습니다" })).toBeVisible();
  await page.getByRole("button", { name: "변경사항 버리고 이동" }).click();
  await expect(page.getByRole("heading", { name: "처방", exact: true })).toBeVisible();
});

test("hospital basic settings stays single-column and keeps the change bar reachable on compact screens", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto("/w/clair-demo/orders?modulePanel=open");
  await page.getByTestId("hospital-admin-menu-settings").click();

  const columnCount = await page.getByTestId("hospital-settings-contact-fields").evaluate((element) =>
    getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean).length
  );
  expect(columnCount).toBe(1);

  await page.getByLabel("팩스").fill("02-6203-9999");
  const changeBar = page.getByTestId("hospital-settings-change-bar");
  await expect(changeBar).toBeVisible();
  const changeBarBox = await changeBar.boundingBox();
  expect(changeBarBox).not.toBeNull();
  expect(changeBarBox!.x).toBeGreaterThanOrEqual(0);
  expect(changeBarBox!.x + changeBarBox!.width).toBeLessThanOrEqual(768);
});

test("hospital schedule supports editing, personal requests, approval, and publish review", async ({ page }) => {
  await page.goto("/w/clair-demo/orders?modulePanel=open");

  const sidePanel = page.getByTestId("hospital-admin-side-panel");
  await sidePanel.getByRole("button", { name: "근무표" }).click();

  await expect(page.getByTestId("hospital-admin-schedule-screen")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "근무표" })).toBeVisible();
  await expect(page.getByRole("group", { name: "근무표 보기" }).getByRole("button", { name: "주간 편성" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("hospital-schedule-weekly-grid")).toBeVisible();
  await expect(page.getByText("박수지").first()).toBeVisible();

  await page.getByRole("button", { name: "+ 근무" }).click();
  await expect(page.getByRole("heading", { name: "근무 추가" })).toBeVisible();
  await page.getByLabel("근무명").fill("야간 검사 보강");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.getByText("야간 검사 보강").first()).toBeVisible();

  await page.getByRole("button", { name: "야간 검사 보강 작업" }).click();
  await page.getByText("삭제", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "근무를 삭제하시겠습니까?" })).toBeVisible();
  await page.getByRole("button", { name: "삭제" }).last().click();
  await expect(page.getByText("야간 검사 보강")).toHaveCount(0);

  await page.getByRole("button", { name: "일간 커버리지" }).click();
  await expect(page.getByTestId("hospital-schedule-daily-coverage")).toBeVisible();

  await page.getByRole("button", { name: "게시하기" }).click();
  const publishDialog = page.getByRole("dialog");
  await expect(publishDialog.getByRole("heading", { name: "게시 전 충돌 검토" })).toBeVisible();
  await expect(publishDialog.getByRole("button", { name: "게시" })).toBeDisabled();
  await page.getByRole("button", { name: "닫기" }).click();

  await page.getByRole("button", { name: "내 근무" }).click();
  await expect(page.getByTestId("hospital-schedule-personal")).toBeVisible();
  await page.getByRole("button", { name: "휴무·변경 요청" }).click();
  await page.getByLabel("사유").fill("개인 일정으로 오후 휴무 요청");
  await page.getByRole("button", { name: "요청 제출" }).click();
  await expect(page.getByTestId("hospital-schedule-personal")).toContainText("개인 일정으로 오후 휴무 요청");
  await expect(page.getByTestId("hospital-schedule-personal")).toContainText("승인 대기");

  await page.getByRole("button", { name: "관리자 근무표" }).click();
  await page.getByRole("button", { name: /승인 대기 요청/ }).click();
  await expect(page.getByRole("heading", { name: "박수지 일정" })).toBeVisible();
  await page.getByRole("button", { name: "승인" }).first().click();
  await expect(page.getByTestId("hospital-admin-schedule-screen")).toContainText("재게시 필요");
});

test.describe("hospital schedule on mobile", () => {
  test("uses an employee day list instead of shrinking the weekly matrix", async ({ page }) => {
    await page.goto("/w/clair-demo/orders?modulePanel=open");
    await page.getByTestId("hospital-admin-side-panel").getByRole("button", { name: "근무표" }).click();
    await page.setViewportSize({ width: 390, height: 844 });

    await expect(page.getByTestId("hospital-schedule-mobile-day-list")).toBeVisible();
    await expect(page.getByTestId("hospital-schedule-weekly-grid")).toBeHidden();
    await expect(page.getByTestId("hospital-schedule-mobile-day-list")).toContainText("김도윤");
  });
});

test("hospital schedule restores keyboard focus after closing the shift sheet", async ({ page }) => {
  await page.goto("/w/clair-demo/orders?modulePanel=open");
  await page.getByTestId("hospital-admin-side-panel").getByRole("button", { name: "근무표" }).click();

  const addShift = page.getByRole("button", { name: "+ 근무" });
  await addShift.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "근무 추가" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "근무 추가" })).toHaveCount(0);
  await expect(addShift).toBeFocused();
});

test("hospital admin role and permission screen replaces the static role-work concept", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/orders?modulePanel=open");

  const sidePanel = page.getByTestId("hospital-admin-side-panel");
  await sidePanel.getByRole("button", { name: "역할 및 권한" }).click();

  const screen = page.getByTestId("hospital-admin-role-permission-screen");
  await expect(screen).toBeVisible();
  await expect(screen.getByRole("heading", { name: "역할 및 권한", exact: true })).toBeVisible();
  const roleSection = screen.getByTestId("role-permission-hub-roles");
  const positionSection = screen.getByTestId("role-permission-hub-positions");
  const workDefaultsSection = screen.getByTestId("role-permission-hub-work-defaults");
  await expect(roleSection).toContainText("3개 역할");
  await expect(positionSection).toContainText("직무");
  await expect(workDefaultsSection).toContainText("4개 업무");
  await expect(screen.getByText("향후 데이터")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "시안 저장" })).toHaveCount(0);
  await expect(screen.getByRole("button", { name: "역할 편집" })).toHaveCount(0);
  await roleSection.click();
  await expect(page).toHaveURL(/roleSettings=roles/);
  await expect(screen.getByRole("heading", { name: "권한 역할", exact: true })).toBeVisible();
  await expect(screen.getByTestId("role-summary-grid")).toContainText("소유자");
  await expect(screen.getByTestId("role-summary-grid")).toContainText("관리자");
  await expect(screen.getByTestId("role-summary-grid")).toContainText("일반");
  const ownerRole = screen.getByTestId("role-item-owner");
  const adminRole = screen.getByTestId("role-item-admin");
  const generalRole = screen.getByTestId("role-item-general");
  await expect(adminRole).toHaveAttribute("aria-expanded", "true");
  await expect(ownerRole).toHaveAttribute("aria-expanded", "false");
  await ownerRole.click();
  await expect(ownerRole).toHaveAttribute("aria-expanded", "true");
  await expect(adminRole).toHaveAttribute("aria-expanded", "false");
  await ownerRole.click();
  await expect(ownerRole).toHaveAttribute("aria-expanded", "false");
  await expect(screen.locator('[data-testid^="role-panel-"]')).toHaveCount(0);
  await generalRole.click();
  await expect(generalRole).toHaveAttribute("aria-expanded", "true");
  await expect(screen.locator('[data-testid^="role-panel-"]')).toHaveCount(1);
  await expect(screen.getByRole("switch", { name: /워크스페이스 삭제/ })).toBeDisabled();
  await expect(screen.getByRole("checkbox", { name: /워크스페이스 삭제/ })).toHaveCount(0);
  await expect(screen.getByText("소유자 전용").first()).toBeVisible();
  await expect(
    screen.getByTestId("role-permission-content").evaluate((element) =>
      Math.round(element.getBoundingClientRect().width)
    )
  ).resolves.toBeLessThanOrEqual(920);
});

test("hospital admin saves role work defaults locally without changing permissions", async ({ page }) => {
  await page.goto("/w/clair-demo/orders?modulePanel=open");
  await page.getByTestId("hospital-admin-side-panel").getByRole("button", { name: "역할 및 권한" }).click();

  const screen = page.getByTestId("hospital-admin-role-permission-screen");
  await screen.getByTestId("role-permission-hub-work-defaults").click();
  await expect(screen.getByText("권한과 분리된 설정")).toBeVisible();

  await screen.getByLabel("기본 접수 담당").click();
  await page.getByRole("option", { name: "수의사" }).click();
  await expect(screen.getByRole("button", { name: "저장" })).toBeVisible();
  await screen.getByRole("button", { name: "저장" }).click();
  await expect(screen.getByRole("status")).toContainText("이 브라우저의 업무 기본값을 저장했습니다.");

  await page.reload();
  await expect(page).toHaveURL(/roleSettings=work-defaults/);
  await expect(screen.getByLabel("기본 접수 담당")).toContainText("수의사");
});

test("hospital admin preserves unsaved work defaults and confirms destructive navigation", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/orders?modulePanel=open");
  const sidePanel = page.getByTestId("hospital-admin-side-panel");
  await sidePanel.getByRole("button", { name: "역할 및 권한" }).click();

  const screen = page.getByTestId("hospital-admin-role-permission-screen");
  const workDefaultsSection = screen.getByTestId("role-permission-hub-work-defaults");
  await workDefaultsSection.click();
  await screen.getByLabel("기본 접수 담당").click();
  await page.getByRole("option", { name: "수의사" }).click();

  await page.goBack();
  await expect(workDefaultsSection).toContainText("저장하지 않은 변경");
  await workDefaultsSection.click();
  await expect(screen.getByLabel("기본 접수 담당")).toContainText("수의사");

  await sidePanel.getByRole("button", { name: "병원기본설정" }).click();
  const sideNavigationDialog = page.getByRole("dialog", {
    name: "저장하지 않은 변경사항이 있습니다",
  });
  await expect(sideNavigationDialog).toBeVisible();
  await sideNavigationDialog.getByRole("button", { name: "계속 편집" }).click();
  await expect(screen.getByRole("heading", { name: "업무 기본값" })).toBeVisible();

  await screen.getByRole("button", { name: "역할 및 권한", exact: true }).click();
  const detailNavigationDialog = page.getByRole("dialog", {
    name: "저장하지 않은 변경사항이 있습니다",
  });
  await expect(detailNavigationDialog).toBeVisible();
  await detailNavigationDialog.getByRole("button", { name: "계속 편집" }).click();
  await expect(screen.getByLabel("기본 접수 담당")).toContainText("수의사");

  await screen.getByRole("button", { name: "역할 및 권한", exact: true }).click();
  await detailNavigationDialog.getByRole("button", { name: "변경사항 버리기" }).click();
  await expect(workDefaultsSection).toContainText("4개 업무");
  await expect(page).not.toHaveURL(/roleSettings=/);
});

test("hospital admin detail back always returns a direct deep link to the settings hub", async ({
  page,
}) => {
  await page.goto(
    "/w/clair-demo/orders?modulePanel=open&section=roles&roleSettings=roles"
  );

  const screen = page.getByTestId("hospital-admin-role-permission-screen");
  await expect(screen.getByRole("heading", { name: "권한 역할", exact: true })).toBeVisible();
  await screen.getByRole("button", { name: "역할 및 권한", exact: true }).click();

  await expect(page).not.toHaveURL(/roleSettings=/);
  await expect(screen.getByTestId("role-permission-hub-roles")).toBeVisible();
});

test("hospital admin syncs saved work defaults to another browser tab", async ({ page, context }) => {
  await page.goto("/w/clair-demo/orders?modulePanel=open");
  await page.getByTestId("hospital-admin-side-panel").getByRole("button", { name: "역할 및 권한" }).click();
  const firstScreen = page.getByTestId("hospital-admin-role-permission-screen");
  await firstScreen.getByTestId("role-permission-hub-work-defaults").click();

  const secondPage = await context.newPage();
  await secondPage.goto("/w/clair-demo/orders?modulePanel=open");
  await secondPage
    .getByTestId("hospital-admin-side-panel")
    .getByRole("button", { name: "역할 및 권한" })
    .click();
  const secondScreen = secondPage.getByTestId("hospital-admin-role-permission-screen");
  await secondScreen.getByTestId("role-permission-hub-work-defaults").click();

  await firstScreen.getByLabel("기본 접수 담당").click();
  await page.getByRole("option", { name: "수의사" }).click();
  await firstScreen.getByRole("button", { name: "저장" }).click();

  await expect(secondScreen.getByLabel("기본 접수 담당")).toContainText("수의사");
  await secondPage.close();
});

test("hospital admin role screen stays compact and keyboard-safe", async ({ page }) => {
  await page.goto("/w/clair-demo/orders?modulePanel=open");
  await page
    .getByTestId("hospital-admin-side-panel")
    .getByRole("button", { name: "역할 및 권한" })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });

  const screen = page.getByTestId("hospital-admin-role-permission-screen");
  await expect(
    screen.evaluate((element) => element.scrollWidth <= document.documentElement.clientWidth)
  ).resolves.toBe(true);

  const roleSection = screen.getByTestId("role-permission-hub-roles");
  await roleSection.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/roleSettings=roles/);
  await screen.getByRole("button", { name: "새 커스텀 역할" }).click();
  const roleDialog = page.getByRole("dialog", { name: "새 커스텀 역할" });
  await expect(roleDialog).toBeVisible();
  await roleDialog.getByRole("button", { name: "역할 저장" }).click();
  await expect(roleDialog.getByRole("alert")).toContainText("커스텀 역할 이름을 입력하세요.");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "새 커스텀 역할" })).toHaveCount(0);

  await screen.getByRole("button", { name: "역할 및 권한", exact: true }).click();
  const positionSection = screen.getByTestId("role-permission-hub-positions");
  await positionSection.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/roleSettings=positions/);
  await expect(screen.getByRole("heading", { name: "직무", exact: true })).toBeVisible();
  await expect(
    screen.getByRole("button", { name: /병원장 시스템 직무/ })
  ).toHaveCount(0);
  await expect(screen.getByText("병원장", { exact: true })).toBeVisible();
  await page.goBack();
  await expect(screen.getByTestId("role-permission-hub-roles")).toBeVisible();
});

test("hospital admin order table uses shared header and cell text primitives", async ({ page }) => {
  await page.goto("/w/clair-demo/orders?modulePanel=open");

  const table = page.getByTestId("hospital-order-table");
  const headers = table.locator("thead th");

  await expect(headers.nth(0)).toHaveAttribute("data-emr-header-interaction", "static");
  await expect(headers.nth(0)).toHaveAttribute("data-emr-column-resize", "none");
  await expect(headers.filter({ hasText: "표준 Order명" })).toHaveAttribute("data-emr-header-interaction", "sortable");
  await expect(headers.filter({ hasText: "표준 Order명" })).toHaveAttribute("data-emr-column-resize", "data-column");
  await expect(headers.filter({ hasText: "사용여부" })).toHaveAttribute("data-emr-header-interaction", "filterable");
  await expect(headers.filter({ hasText: "작업" })).toHaveAttribute("data-emr-column-resize", "none");

  await expect(page.getByTestId("hospital-order-catalog-read-status")).toContainText("Workspace catalog 기준");
  const row = page.getByTestId("hospital-order-row-ord-lab-cbc-baso");
  const selectAllOrderBox = await table
    .getByRole("checkbox", { name: "보이는 오더 전체 선택" })
    .boundingBox();
  const firstOrderCheckboxBox = await row
    .getByRole("checkbox", { name: "[CBC 검사] #BASO 선택" })
    .boundingBox();

  expect(selectAllOrderBox).not.toBeNull();
  expect(firstOrderCheckboxBox).not.toBeNull();
  expect(
    Math.abs(
      selectAllOrderBox!.x +
        selectAllOrderBox!.width / 2 -
        (firstOrderCheckboxBox!.x + firstOrderCheckboxBox!.width / 2),
    ),
  ).toBeLessThanOrEqual(1);
  await expect(row.locator('[data-emr-cell-text-mode="two-line-if-long"]').filter({ hasText: "[CBC 검사] #BASO" }).first()).toBeVisible();
  await expect(row.locator('[data-emr-cell-text-mode="one-line"]').filter({ hasText: "사용" })).toBeVisible();
  await expect(row.locator('[data-emr-cell-text-mode="one-line"]').filter({ hasText: "12,000원" })).toBeVisible();
});

test("hospital admin order drawer edits and saves a selected order", async ({ page }) => {
  await page.goto("/w/clair-demo/orders?modulePanel=open");

  await page.getByRole("button", { name: /처방/ }).click();
  await page.getByTestId("hospital-order-row-ord-med-maropitant").click();

  const drawer = page.getByTestId("hospital-order-drawer");
  await expect(drawer).toContainText("Maropitant 16mg T");

  await drawer.locator('input[value="Maropitant 16mg T"]').first().fill("Maropitant 변경");
  await drawer.locator('[data-slot="switch"]').click();
  await drawer.getByRole("button", { name: "저장" }).click();
  await page.getByRole("button", { name: "저장" }).last().click();

  await expect(page.getByTestId("hospital-order-mutation-status")).toContainText("저장했습니다");
  await expect(drawer).toContainText("Maropitant 변경");
  await drawer.getByRole("button", { name: "상세 닫기" }).click();
  await expect(page.getByText("Maropitant 변경").first()).toBeVisible();
  await expect(page.getByTestId("hospital-order-row-ord-med-maropitant")).toContainText("중지");
});

test("hospital admin order drawer use-stop keeps the order row after confirmation", async ({ page }) => {
  await page.goto("/w/clair-demo/orders?modulePanel=open");

  await page.getByTestId("hospital-order-row-ord-lab-cbc-baso").click();

  await expect(page.getByTestId("hospital-order-drawer")).toContainText("[CBC 검사] #BASO");
  await page.getByRole("button", { name: "사용 중지" }).click();
  await page.getByRole("button", { name: "사용 중지" }).last().click();

  await expect(page.getByTestId("hospital-order-drawer")).toHaveCount(0);
  await expect(page.getByTestId("hospital-order-row-ord-lab-cbc-baso")).toContainText("중지");
});

test("hospital admin order drawer creates a new workspace catalog order", async ({ page }) => {
  await page.goto("/w/clair-demo/orders?modulePanel=open");
  await expect(page.getByTestId("hospital-order-catalog-read-status")).toContainText("Workspace catalog 기준");
  await expect(page.getByTestId("hospital-order-row-ord-lab-cbc-baso")).toBeVisible();

  await page.getByRole("button", { name: "+ Order", exact: true }).click();

  const drawer = page.getByTestId("hospital-order-drawer");
  await expect(drawer.getByRole("heading", { name: "임상병리 오더 추가" })).toBeVisible();
  await expect(drawer.getByRole("button", { name: "저장" })).toBeDisabled();
  await drawer.getByPlaceholder("표준 Order명을 입력해 주세요").fill("원내 신규 CBC");
  await drawer.getByPlaceholder("원내에서 사용할 Order명을 입력해 주세요").fill("원내 신규 CBC");
  await drawer.getByPlaceholder("청구서에 표시할 이름을 입력해 주세요").fill("원내 신규 CBC 청구");
  await drawer.getByLabel("판매 금액").fill("22000");
  await expect(drawer.getByRole("button", { name: "저장" })).toBeEnabled();
  await drawer.getByRole("button", { name: "저장" }).click();
  await expect(page.getByRole("dialog")).toContainText("차트의 Order 추가 검색 후보로 표시됩니다");
  await page.getByRole("button", { name: "등록" }).click();

  await expect(page.getByTestId("hospital-order-mutation-status")).toContainText("등록했습니다");
  await expect(page.getByTestId("hospital-order-drawer").getByRole("heading", { name: "원내 신규 CBC" })).toBeVisible();
  await expect(page.getByText("원내 신규 CBC").first()).toBeVisible();
  const createdRow = page.locator('[data-testid^="hospital-order-row-"]').filter({ hasText: "원내 신규 CBC" }).first();
  await expect(createdRow).toHaveAttribute("data-focused", "true");
  await expect(createdRow.getByRole("checkbox", { name: "원내 신규 CBC 선택" })).not.toBeChecked();
  await expect(page.getByText(/선택한 오더 \d+개/)).toHaveCount(0);
});

test("hospital admin table selection drives bulk action instead of opening drawer", async ({ page }) => {
  await page.goto("/w/clair-demo/orders?modulePanel=open");

  const row = page.getByTestId("hospital-order-row-ord-lab-cbc-baso");
  await row.getByRole("checkbox", { name: "[CBC 검사] #BASO 선택" }).click();
  await expect(page.getByText("선택한 오더 1개")).toBeVisible();

  await row.click({ position: { x: 180, y: 20 } });
  await expect(page.getByTestId("hospital-order-drawer")).toHaveCount(0);

  await page.getByRole("button", { name: "선택 해제" }).click();
  await expect(page.getByText("선택한 오더 1개")).toBeHidden();
});

test("hospital admin order drawer switches rows and closes from outside click", async ({ page }) => {
  await page.goto("/w/clair-demo/orders?modulePanel=open");

  await page.getByTestId("hospital-order-row-ord-lab-cbc-baso").click();
  await expect(page.getByTestId("hospital-order-drawer")).toContainText("[CBC 검사] #BASO");

  await page.getByTestId("hospital-order-row-ord-paused-example").click({ position: { x: 180, y: 20 } });
  await expect(page.getByTestId("hospital-order-drawer").last()).toContainText("일시중지 예시");
  await expect(page.getByTestId("hospital-order-row-ord-paused-example")).toHaveAttribute("data-focused", "true");

  await page.getByRole("heading", { level: 1, name: "임상병리 검사" }).click({ position: { x: 4, y: 4 } });
  await expect(page.getByTestId("hospital-order-drawer")).toHaveCount(0);
});

test("hospital admin order table shows skeleton rows while loading catalog", async ({ page }) => {
  await page.route("**/api/workspaces/clair-demo/hospital-admin/order-catalog", async (route) => {
    if (route.request().method() === "GET") {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    await route.continue();
  });

  await page.goto("/w/clair-demo/orders?modulePanel=open");

  await expect(page.getByTestId("hospital-order-table-skeleton-row").first()).toBeVisible();
  await expect(page.getByTestId("hospital-order-catalog-read-status")).toContainText("Workspace catalog 기준");
});

test("hospital admin order drawer shows blocking progress dialog while saving", async ({ page }) => {
  await page.goto("/w/clair-demo/orders?modulePanel=open");

  await page.getByTestId("hospital-order-row-ord-lab-cbc-baso").click();
  const drawer = page.getByTestId("hospital-order-drawer");
  await drawer.getByPlaceholder("원내에서 사용할 Order명을 입력해 주세요").fill("[CBC 검사] #BASO 저장 모달");
  await page.route("**/api/workspaces/clair-demo/hospital-admin/order-catalog", async (route) => {
    if (route.request().method() === "PATCH") {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    await route.continue();
  });

  await drawer.getByRole("button", { name: "저장" }).click();
  await page.getByRole("button", { name: "저장" }).last().click();

  await expect(page.getByTestId("hospital-order-saving-dialog")).toContainText("Order 저장 중");
  await expect(page.getByTestId("hospital-order-mutation-status")).toContainText("저장했습니다");
});

test("hospital admin order search filters the visible table", async ({ page }) => {
  await page.goto("/w/clair-demo/orders?modulePanel=open");

  await page.getByLabel("오더 검색").fill("BASO");
  await expect(page.getByTestId("hospital-order-row-ord-lab-cbc-baso")).toBeVisible();
  await expect(page.getByTestId("hospital-order-row-ord-paused-example")).toHaveCount(0);
});

test("hospital admin order table keeps the mg empty state contract for no matches", async ({ page }) => {
  await page.goto("/w/clair-demo/orders?modulePanel=open");

  await page.getByLabel("오더 검색").fill("없는 Order");

  const emptyState = page.getByTestId("hospital-order-empty-state");
  await expect(emptyState).toHaveAttribute("data-size", "md");
  await expect(emptyState).toHaveAttribute("data-surface", "table");
  await expect(emptyState).toHaveAttribute("data-kind", "no-filter-results");
  await expect(emptyState).toContainText("조건에 맞는 Order가 없습니다");
});

test("hospital member directory uses the mg table empty state for filtered results", async ({ page }) => {
  await page.goto("/w/clair-demo/orders?modulePanel=open");
  await page.getByTestId("hospital-admin-menu-members").click();
  await page.getByPlaceholder("이름 또는 이메일 검색").fill("없는 구성원");

  const emptyState = page.getByTestId("hospital-members-empty-state-desktop");
  await expect(emptyState).toHaveAttribute("data-size", "md");
  await expect(emptyState).toHaveAttribute("data-surface", "table");
  await expect(emptyState).toHaveAttribute("data-kind", "no-filter-results");
  await expect(emptyState).toContainText("조건에 맞는 구성원이 없습니다");
});

test("hospital admin order catalog supports single sort and section filter builder", async ({ page }) => {
  await page.goto("/w/clair-demo/orders?modulePanel=open");

  const table = page.getByTestId("hospital-order-table");
  const orderRows = table.locator('[data-testid^="hospital-order-row-"]');

  await table.getByRole("button", { name: /판매금액 오름차순 정렬/ }).click();
  await expect(orderRows.first()).toContainText("일시중지 예시");

  await table.getByRole("button", { name: /현재 정렬: 판매금액 오름차순/ }).click();
  await expect(orderRows.first()).toContainText("[CBC 검사] #BASO");

  await page.getByRole("button", { name: "오더 필터 설정" }).click();
  const filterBuilder = page.locator('[data-emr-table-filter-builder="true"]');
  await expect(
    filterBuilder.getByRole("combobox", { name: "필터 필드" }),
  ).toHaveCount(1);
  await filterBuilder.getByRole("combobox", { name: "필터 필드" }).click();
  await page.getByRole("option", { name: "대상" }).click();
  await expect(page.getByRole("button", { name: "오더 필터 설정" })).toBeVisible();
  await expect(orderRows).toHaveCount(2);

  await filterBuilder.getByRole("combobox", { name: "필터 값" }).click();
  await page.getByRole("option", { name: "전체" }).click();
  await filterBuilder.getByRole("button", { name: "Add filter" }).click();
  await filterBuilder.getByRole("combobox", { name: "필터 필드" }).nth(1).click();
  await page.getByRole("option", { name: "판매금액" }).click();
  await filterBuilder.getByRole("combobox", { name: "필터 조건" }).nth(1).click();
  await page.getByRole("option", { name: "이하" }).click();
  await filterBuilder.getByRole("textbox", { name: "필터 값" }).fill("1000");

  await expect(page.getByRole("button", { name: "오더 필터 2개 설정" })).toBeVisible();
  await expect(orderRows).toHaveCount(1);
  await expect(orderRows.first()).toContainText("일시중지 예시");

  await filterBuilder.getByRole("button", { name: "초기화" }).click();
  await page.keyboard.press("Escape");

  await expect(page.getByRole("button", { name: "오더 필터 설정" })).toBeVisible();
  await expect(orderRows).toHaveCount(2);
});

test("hospital admin row action menu opens details and closes on Escape", async ({ page }) => {
  await page.goto("/w/clair-demo/orders?modulePanel=open");

  const row = page.getByTestId("hospital-order-row-ord-lab-cbc-baso");
  await row.getByRole("button", { name: "[CBC 검사] #BASO Order 행 작업" }).click();
  await expect(page.getByRole("menu")).toContainText("상세 보기");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);

  await row.getByRole("button", { name: "[CBC 검사] #BASO Order 행 작업" }).click();
  await page.getByText("상세 보기", { exact: true }).click();
  await expect(page.getByTestId("hospital-order-drawer")).toContainText("[CBC 검사] #BASO");
  await expect(page.getByRole("menu")).toHaveCount(0);
});
