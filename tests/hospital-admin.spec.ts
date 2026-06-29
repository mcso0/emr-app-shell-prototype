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
    .getByRole("button", { name: /근무표/ })
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

  await page.getByLabel("오더 검색").click();
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
