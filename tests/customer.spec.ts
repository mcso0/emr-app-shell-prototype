import { expect, test } from "@playwright/test";

test("Cheongdam customer workspace renders seeded DB patients instead of legacy fixtures", async ({
  page,
}) => {
  const workspaceId = "workspace-clair-cheongdam";

  await page.route(`**/api/workspaces/${workspaceId}/reception/patient-guardian-lookup?**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        enforcedBy: "reception-patient-guardian-lookup",
        patients: [
          {
            patient: {
              id: "49121000-0000-4000-8000-000000000001",
              workspaceId,
              patientNo: "CD-P-001",
              name: "루미",
              species: "dog",
              breed: "Maltese",
              birthDate: "2025-11-20",
              sex: "female",
              neutered: false,
              handlingCautionLocked: true,
              status: "active",
              createdAt: "2026-06-12T00:00:00.000Z",
              updatedAt: "2026-06-12T00:00:00.000Z",
            },
            primaryGuardian: {
              id: "49120000-0000-4000-8000-000000000001",
              workspaceId,
              name: "김서윤",
              mobilePhone: "010-4911-0001",
              createdAt: "2026-06-12T00:00:00.000Z",
              updatedAt: "2026-06-12T00:00:00.000Z",
            },
            searchText: "루미 CD-P-001 Maltese 김서윤 010-4911-0001",
          },
          {
            patient: {
              id: "49121000-0000-4000-8000-000000000005",
              workspaceId,
              patientNo: "CD-P-005",
              name: "모카",
              species: "cat",
              breed: "Russian blue",
              birthDate: "2023-06-05",
              sex: "male",
              neutered: false,
              handlingCautionLocked: true,
              status: "active",
              createdAt: "2026-06-12T00:00:00.000Z",
              updatedAt: "2026-06-12T00:00:00.000Z",
            },
            primaryGuardian: {
              id: "49120000-0000-4000-8000-000000000005",
              workspaceId,
              name: "정유나",
              mobilePhone: "010-4911-0005",
              createdAt: "2026-06-12T00:00:00.000Z",
              updatedAt: "2026-06-12T00:00:00.000Z",
            },
            searchText: "모카 CD-P-005 Russian blue 정유나 010-4911-0005",
          },
        ],
      }),
    });
  });

  await page.goto(`/w/${workspaceId}/customer?modulePanel=open`);

  await expect(page.getByTestId("customer-patient-table")).toBeVisible();
  await expect(page.getByText("CD-P-001")).toBeVisible();
  await expect(page.getByText("루미")).toBeVisible();
  await expect(page.getByText("김서윤")).toBeVisible();
  await expect(page.getByText("CD-P-005")).toBeVisible();
  await expect(page.getByText("모카")).toBeVisible();
  await expect(page.getByText("정유나")).toBeVisible();
  await expect(page.getByText("P-260414-0008")).toHaveCount(0);
  await expect(page.getByText("코코")).toHaveCount(0);
  await expect(page.getByText("나비")).toHaveCount(0);
  await expect(page.getByTestId("customer-side-panel-patient")).toContainText("2");
  await expect(page.getByTestId("customer-side-panel-guardian")).toContainText("2");
});

test("Cheongdam customer table shows skeleton while seeded profiles are loading", async ({
  page,
}) => {
  const workspaceId = "workspace-clair-cheongdam";
  let resolveLookup: () => void = () => {};
  const lookupPending = new Promise<void>((resolve) => {
    resolveLookup = resolve;
  });

  await page.route(`**/api/workspaces/${workspaceId}/reception/patient-guardian-lookup?**`, async (route) => {
    await lookupPending;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        enforcedBy: "reception-patient-guardian-lookup",
        patients: [
          {
            patient: {
              id: "49121000-0000-4000-8000-000000000101",
              workspaceId,
              patientNo: "CD-P-101",
              name: "라온",
              species: "dog",
              breed: "Poodle",
              birthDate: "2024-01-10",
              sex: "male",
              neutered: true,
              handlingCautionLocked: true,
              status: "active",
              createdAt: "2026-06-12T00:00:00.000Z",
              updatedAt: "2026-06-12T00:00:00.000Z",
            },
            primaryGuardian: {
              id: "49120000-0000-4000-8000-000000000101",
              workspaceId,
              name: "박민준",
              mobilePhone: "010-4911-0101",
              createdAt: "2026-06-12T00:00:00.000Z",
              updatedAt: "2026-06-12T00:00:00.000Z",
            },
            searchText: "라온 CD-P-101 Poodle 박민준 010-4911-0101",
          },
        ],
      }),
    });
  });

  await page.goto(`/w/${workspaceId}/customer?modulePanel=open`);

  const patientTable = page.getByTestId("customer-patient-table");
  await expect(patientTable.getByTestId("customer-patient-table-skeleton-row").first()).toBeVisible();
  await expect(page.getByTestId("customer-page-header-count-skeleton")).toBeVisible();
  await expect(patientTable).not.toContainText("동물 정보가 없습니다");
  await expect(patientTable).not.toContainText("0건");
  await expect(page.getByTestId("customer-side-panel-patient")).not.toContainText("0");

  resolveLookup();

  await expect(page.getByText("CD-P-101")).toBeVisible();
  await expect(page.getByText("라온")).toBeVisible();
  await expect(page.getByText("박민준")).toBeVisible();
  await expect(patientTable.getByTestId("customer-patient-table-skeleton-row")).toHaveCount(0);
  await expect(page.getByTestId("customer-side-panel-patient")).toContainText("1");
  await expect(page.getByTestId("customer-side-panel-guardian")).toContainText("1");
});

test("Cheongdam customer table does not flash empty copy on SPA re-entry with stale ready state", async ({
  page,
}) => {
  const workspaceId = "workspace-clair-cheongdam";
  let lookupCallCount = 0;
  let resolveLookup: () => void = () => {};
  const lookupPending = new Promise<void>((resolve) => {
    resolveLookup = resolve;
  });

  await page.route(`**/api/workspaces/${workspaceId}/reception/patient-guardian-lookup?**`, async (route) => {
    lookupCallCount += 1;

    if (lookupCallCount <= 2) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          enforcedBy: "reception-patient-guardian-lookup",
          patients: [],
        }),
      });
      return;
    }

    await lookupPending;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        enforcedBy: "reception-patient-guardian-lookup",
        patients: [
          {
            patient: {
              id: "49121000-0000-4000-8000-000000000202",
              workspaceId,
              patientNo: "CD-P-202",
              name: "보름",
              species: "cat",
              breed: "Korean shorthair",
              birthDate: "2023-03-14",
              sex: "female",
              neutered: true,
              handlingCautionLocked: true,
              status: "active",
              createdAt: "2026-06-12T00:00:00.000Z",
              updatedAt: "2026-06-12T00:00:00.000Z",
            },
            primaryGuardian: {
              id: "49120000-0000-4000-8000-000000000202",
              workspaceId,
              name: "최서진",
              mobilePhone: "010-4911-0202",
              createdAt: "2026-06-12T00:00:00.000Z",
              updatedAt: "2026-06-12T00:00:00.000Z",
            },
            searchText: "보름 CD-P-202 Korean shorthair 최서진 010-4911-0202",
          },
        ],
      }),
    });
  });

  await page.goto(`/w/${workspaceId}/customer?modulePanel=open`);

  const patientTable = page.getByTestId("customer-patient-table");
  await expect(patientTable).toContainText("동물 정보가 없습니다");

  await page.getByRole("link", { name: "접수/예약" }).click();
  await expect(page).toHaveURL(new RegExp(`/w/${workspaceId}/reception`));

  await page.getByRole("link", { name: "고객관리" }).click();
  await expect(patientTable.getByTestId("customer-patient-table-skeleton-row").first()).toBeVisible();
  await expect(patientTable).not.toContainText("동물 정보가 없습니다");
  await expect(patientTable).not.toContainText("0건");
  await expect(page.getByTestId("customer-page-header-count-skeleton")).toBeVisible();
  await expect(page.getByTestId("customer-side-panel-patient")).not.toContainText("0");

  resolveLookup();

  await expect(page.getByText("CD-P-202")).toBeVisible();
  await expect(page.getByText("보름")).toBeVisible();
  await expect(page.getByText("최서진")).toBeVisible();
});

test("customer workspace renders animal master list and opens the common patient drawer", async ({ page }) => {
  await page.goto("/w/clair-demo/customer?modulePanel=open");

  await expect(page.getByTestId("customer-workspace")).toBeVisible();
  await expect(page.getByTestId("module-side-panel-title")).toHaveText("고객관리");
  const customerSidePanel = page.getByTestId("customer-side-panel");
  await expect(customerSidePanel).not.toContainText("Customer");
  await customerSidePanel.getByRole("button", { name: "보호자/동물 관리" }).click();
  await expect(page.getByTestId("customer-side-panel-patient")).toHaveCount(0);
  await customerSidePanel.getByRole("button", { name: "보호자/동물 관리" }).click();
  await expect(page.getByTestId("customer-side-panel-patient")).toBeVisible();
  await expect(page.getByTestId("customer-side-panel-patient")).toContainText("5");
  await expect(page.getByTestId("customer-side-panel-guardian")).toContainText("5");
  const scheduleFollowUp = customerSidePanel.getByRole("button", { name: /스케줄 관리/ });
  await expect(scheduleFollowUp).toBeDisabled();
  await expect(scheduleFollowUp).toContainText("미구현");
  await expect(customerSidePanel.getByRole("button", { name: "예약 일정" })).toHaveCount(0);
  await expect(page.getByTestId("customer-page-header").getByRole("heading", { name: "동물" })).toBeVisible();
  await expect(page.getByTestId("customer-page-header")).not.toContainText("스케줄 관리");
  const inpatientNavBox = await page.getByRole("link", { name: "입원" }).boundingBox();
  const customerNavBox = await page.getByRole("link", { name: "고객관리" }).boundingBox();
  const hospitalAdminNavBox = await page.getByRole("link", { name: "병원관리" }).boundingBox();

  expect(inpatientNavBox).not.toBeNull();
  expect(customerNavBox).not.toBeNull();
  expect(hospitalAdminNavBox).not.toBeNull();
  expect(customerNavBox!.y - inpatientNavBox!.y).toBeGreaterThanOrEqual(48);
  expect(hospitalAdminNavBox!.y - customerNavBox!.y).toBeLessThan(52);
  await expect(page.getByTestId("customer-patient-table")).toBeVisible();
  const patientTable = page.getByRole("table", { name: "동물 고객관리 테이블" });
  await expect(
    patientTable.locator('th[data-emr-header-interaction="sortable"][data-emr-column-resize="data-column"]', {
      hasText: "동물명",
    })
  ).toBeVisible();
  await expect(patientTable.locator("th", { hasText: "행 작업" })).toHaveAttribute(
    "data-emr-column-resize",
    "none"
  );
  await expect(page.getByTestId("customer-patient-row-patient-dubu")).toContainText("두부");
  await expect(page.getByTestId("customer-patient-row-patient-dubu")).toContainText("정하린");
  const dubuRow = page.getByTestId("customer-patient-row-patient-dubu");
  await expect(dubuRow.locator('[data-emr-cell-text-mode="two-line-if-long"]', { hasText: "두부" })).toBeVisible();
  await expect(dubuRow.locator('[data-emr-cell-text-mode="one-line"]', { hasText: /010-/ })).toBeVisible();
  await page.getByTestId("customer-patient-table").getByRole("button", { name: "컬럼" }).click();
  await expect(page.getByText("표시 컬럼")).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByTestId("customer-patient-row-patient-dubu").click();

  await expect(page.getByText("환자 정보").first()).toBeVisible();
  await expect(page.getByRole("tab", { name: "환자 정보" })).toBeVisible();
  await expect(page.getByRole("button", { name: "카카오톡 발송" })).toBeVisible();
  await expect(page).toHaveURL(/drawer=patient%3Apatient-dubu|drawer=patient:patient-dubu/);
});

test("customer table aligns selection header and row checkboxes", async ({ page }) => {
  await page.goto("/w/clair-demo/customer?modulePanel=open&aside=closed");

  const table = page.getByRole("table", { name: "동물 고객관리 테이블" });
  const row = page.getByTestId("customer-patient-row-patient-coco");

  await expect(table).toBeVisible();
  await expect(row).toBeVisible();

  const selectAllPatientBox = await table
    .getByRole("checkbox", { name: "동물 전체 선택" })
    .boundingBox();
  const rowCheckboxBox = await row
    .getByRole("checkbox", { name: "코코 선택" })
    .boundingBox();

  expect(selectAllPatientBox).not.toBeNull();
  expect(rowCheckboxBox).not.toBeNull();
  expect(
    Math.abs(
      selectAllPatientBox!.x +
        selectAllPatientBox!.width / 2 -
        (rowCheckboxBox!.x + rowCheckboxBox!.width / 2),
    ),
  ).toBeLessThanOrEqual(1);
});

test("customer side panel matches CDS.V2 module-list geometry, type, and color", async ({ page }) => {
  await page.goto("/w/clair-demo/customer?modulePanel=open");

  const panelMetrics = await page.getByTestId("customer-side-panel").evaluate((panel) => {
    const group = panel.querySelector('[data-emr-module-list-group="true"]');
    const section = group?.querySelector("section");
    const trigger = section?.querySelector('button[aria-expanded="true"]');
    const icon = trigger?.querySelector('[data-emr-module-list-section-icon="true"]');
    const label = trigger?.querySelector('[data-emr-module-list-item-label="true"]');
    const action = trigger?.querySelector('[data-emr-module-list-action="true"]');
    const rail = section?.querySelector('[data-emr-module-list-child-rail="true"]');
    const childList = section?.querySelector('[data-emr-module-list-child-list="true"]');
    const selectedLeaf = section?.querySelector('[data-testid="customer-side-panel-patient"]');
    const selectedLeafLabel = selectedLeaf?.querySelector('[data-emr-module-list-item-label="true"]');
    const selectedLeafBadge = selectedLeaf?.querySelector('[data-emr-module-list-badge="true"]');
    const disabledItem = [...panel.querySelectorAll("button")].find((item) =>
      item.textContent?.includes("스케줄 관리"),
    );
    const disabledIcon = disabledItem?.querySelector('[data-emr-module-list-item-icon="true"]');
    const disabledLabel = disabledItem?.querySelector('[data-emr-module-list-item-label="true"]');

    if (
      !group ||
      !section ||
      !trigger ||
      !icon ||
      !label ||
      !action ||
      !rail ||
      !childList ||
      !selectedLeaf ||
      !selectedLeafLabel ||
      !selectedLeafBadge ||
      !disabledItem ||
      !disabledIcon ||
      !disabledLabel
    ) {
      throw new Error("Missing customer module list layout target");
    }

    const panelRect = panel.getBoundingClientRect();
    const sectionRect = section.getBoundingClientRect();
    const triggerRect = trigger.getBoundingClientRect();
    const iconRect = icon.getBoundingClientRect();
    const labelRect = label.getBoundingClientRect();
    const railRect = rail.getBoundingClientRect();
    const childListRect = childList.getBoundingClientRect();
    const leafRect = selectedLeaf.getBoundingClientRect();
    const badgeRect = selectedLeafBadge.getBoundingClientRect();
    const disabledRect = disabledItem.getBoundingClientRect();
    const triggerStyle = getComputedStyle(trigger);
    const iconStyle = getComputedStyle(icon);
    const labelStyle = getComputedStyle(label);
    const actionStyle = getComputedStyle(action);
    const railStyle = getComputedStyle(rail);
    const childListStyle = getComputedStyle(childList);
    const leafStyle = getComputedStyle(selectedLeaf);
    const leafLabelStyle = getComputedStyle(selectedLeafLabel);
    const badgeStyle = getComputedStyle(selectedLeafBadge);
    const disabledIconStyle = getComputedStyle(disabledIcon);
    const disabledLabelStyle = getComputedStyle(disabledLabel);

    return {
      actionMarginLeft: actionStyle.marginLeft,
      actionSize: action.getBoundingClientRect().width,
      badgeBackground: badgeStyle.backgroundColor,
      badgeColor: badgeStyle.color,
      badgeFontSize: badgeStyle.fontSize,
      badgeHeight: badgeRect.height,
      badgeLetterSpacing: badgeStyle.letterSpacing,
      badgeLineHeight: badgeStyle.lineHeight,
      badgePaddingBottom: badgeStyle.paddingBottom,
      badgePaddingLeft: badgeStyle.paddingLeft,
      badgePaddingRight: badgeStyle.paddingRight,
      badgePaddingTop: badgeStyle.paddingTop,
      badgeWeight: badgeStyle.fontWeight,
      childListHeight: childListRect.height,
      childListOffset: childListRect.left - sectionRect.left,
      childListRowGap: childListStyle.rowGap,
      disabledHeight: disabledRect.height,
      disabledIconColor: disabledIconStyle.color,
      disabledLabelColor: disabledLabelStyle.color,
      disabledWidth: disabledRect.width,
      groupRowGap: getComputedStyle(group).rowGap,
      groupWidth: group.getBoundingClientRect().width,
      iconColor: iconStyle.color,
      iconLabelGap: labelRect.left - iconRect.right,
      iconWidth: iconRect.width,
      itemHeight: triggerRect.height,
      itemLabelColor: labelStyle.color,
      itemLabelFontSize: labelStyle.fontSize,
      itemLabelLetterSpacing: labelStyle.letterSpacing,
      itemLabelLineHeight: labelStyle.lineHeight,
      itemLabelWeight: labelStyle.fontWeight,
      itemPaddingBottom: triggerStyle.paddingBottom,
      itemPaddingLeft: triggerStyle.paddingLeft,
      itemPaddingRight: triggerStyle.paddingRight,
      itemPaddingTop: triggerStyle.paddingTop,
      itemWidth: triggerRect.width,
      leafBackground: leafStyle.backgroundColor,
      leafHeight: leafRect.height,
      leafLabelColor: leafLabelStyle.color,
      leafLabelFontSize: leafLabelStyle.fontSize,
      leafLabelLetterSpacing: leafLabelStyle.letterSpacing,
      leafLabelLineHeight: leafLabelStyle.lineHeight,
      leafLabelWeight: leafLabelStyle.fontWeight,
      leafPaddingBottom: leafStyle.paddingBottom,
      leafPaddingLeft: leafStyle.paddingLeft,
      leafPaddingRight: leafStyle.paddingRight,
      leafPaddingTop: leafStyle.paddingTop,
      leafRightInset: panelRect.right - leafRect.right,
      leafWidth: leafRect.width,
      panelWidth: panel.getBoundingClientRect().width,
      railColor: railStyle.backgroundColor,
      railHeight: railRect.height,
      railOffset: railRect.left + railRect.width / 2 - sectionRect.left,
    };
  });

  expect(Math.round(panelMetrics.panelWidth)).toBe(296);
  expect(Math.round(panelMetrics.groupWidth)).toBe(296);
  expect(panelMetrics.groupRowGap).toBe("2px");
  expect(Math.round(panelMetrics.itemWidth)).toBe(280);
  expect(Math.round(panelMetrics.itemHeight)).toBe(36);
  expect(panelMetrics.itemPaddingTop).toBe("6px");
  expect(panelMetrics.itemPaddingRight).toBe("8px");
  expect(panelMetrics.itemPaddingBottom).toBe("6px");
  expect(panelMetrics.itemPaddingLeft).toBe("8px");
  expect(Math.round(panelMetrics.iconWidth)).toBe(14);
  expect(panelMetrics.iconColor).toBe("rgb(115, 115, 115)");
  expect(Math.round(panelMetrics.iconLabelGap)).toBe(8);
  expect(panelMetrics.itemLabelFontSize).toBe("13px");
  expect(panelMetrics.itemLabelLineHeight).toBe("18px");
  expect(panelMetrics.itemLabelLetterSpacing).toBe("0.247px");
  expect(panelMetrics.itemLabelWeight).toBe("500");
  expect(panelMetrics.itemLabelColor).toBe("rgb(64, 64, 64)");
  expect(Math.round(panelMetrics.actionSize)).toBe(24);
  expect(panelMetrics.actionMarginLeft).toBe("16px");
  expect(Math.round(panelMetrics.childListOffset)).toBe(26);
  expect(panelMetrics.childListRowGap).toBe("2px");
  expect(Math.round(panelMetrics.railOffset)).toBe(14);
  expect(Math.round(panelMetrics.railHeight)).toBe(
    Math.round(panelMetrics.childListHeight),
  );
  expect(panelMetrics.railColor).toBe("rgb(229, 229, 229)");
  expect(Math.round(panelMetrics.leafWidth)).toBe(254);
  expect(Math.round(panelMetrics.leafHeight)).toBe(32);
  expect(Math.round(panelMetrics.leafRightInset)).toBe(8);
  expect(panelMetrics.leafPaddingTop).toBe("6px");
  expect(panelMetrics.leafPaddingRight).toBe("8px");
  expect(panelMetrics.leafPaddingBottom).toBe("6px");
  expect(panelMetrics.leafPaddingLeft).toBe("8px");
  expect(panelMetrics.leafLabelFontSize).toBe("13px");
  expect(panelMetrics.leafLabelLineHeight).toBe("18px");
  expect(panelMetrics.leafLabelLetterSpacing).toBe("0.247px");
  expect(panelMetrics.leafLabelWeight).toBe("500");
  expect(panelMetrics.leafLabelColor).toBe("rgb(23, 23, 23)");
  expect(panelMetrics.leafBackground).toBe("rgba(0, 0, 0, 0.08)");
  expect(Math.round(panelMetrics.badgeHeight)).toBe(20);
  expect(panelMetrics.badgePaddingTop).toBe("2px");
  expect(panelMetrics.badgePaddingRight).toBe("6px");
  expect(panelMetrics.badgePaddingBottom).toBe("2px");
  expect(panelMetrics.badgePaddingLeft).toBe("6px");
  expect(panelMetrics.badgeFontSize).toBe("12px");
  expect(panelMetrics.badgeLineHeight).toBe("16px");
  expect(panelMetrics.badgeLetterSpacing).toBe("0.3px");
  expect(panelMetrics.badgeWeight).toBe("500");
  expect(panelMetrics.badgeColor).toBe("rgb(23, 23, 23)");
  expect(panelMetrics.badgeBackground).toBe("rgba(0, 0, 0, 0.04)");
  expect(Math.round(panelMetrics.disabledWidth)).toBe(280);
  expect(Math.round(panelMetrics.disabledHeight)).toBe(36);
  expect(panelMetrics.disabledIconColor).toBe("rgb(163, 163, 163)");
  expect(panelMetrics.disabledLabelColor).toBe("rgb(163, 163, 163)");
});

test("customer side panel switches to guardians and search filters rows", async ({ page }) => {
  await page.goto("/w/clair-demo/customer?modulePanel=open");

  await page.getByTestId("customer-side-panel-guardian").click();
  await expect(page.getByTestId("customer-page-header").getByRole("heading", { name: "보호자" })).toBeVisible();
  await expect(page.getByTestId("customer-guardian-table")).toBeVisible();
  await expect(page.getByTestId("customer-guardian-row-guardian-kang-seoyun")).toContainText("강서윤");
  await expect(page.getByTestId("customer-guardian-row-guardian-kang-seoyun")).toContainText("하루, 두부");

  await page.getByRole("textbox", { name: "고객관리 검색" }).fill("김하늘");

  await expect(page.getByTestId("customer-guardian-row-guardian-kim-haneul")).toBeVisible();
  await expect(page.getByTestId("customer-guardian-row-guardian-kang-seoyun")).toHaveCount(0);

  await page.getByTestId("customer-guardian-row-guardian-kim-haneul").click();

  await expect(page.getByText("보호자 정보").first()).toBeVisible();
  await expect(page.getByRole("tab", { name: "보호자 정보" })).toBeVisible();
  await expect(page).toHaveURL(/drawer=guardian%3Aguardian-kim-haneul|drawer=guardian:guardian-kim-haneul/);
});

test("customer patient table supports single sort and section filter builder", async ({ page }) => {
  await page.goto("/w/clair-demo/customer?modulePanel=open");

  const patientTableSection = page.getByTestId("customer-patient-table");
  const patientRows = patientTableSection.locator('[data-testid^="customer-patient-row-"]');

  await patientTableSection.getByRole("button", { name: /등록일시 오름차순 정렬/ }).click();
  await expect(patientRows.first()).toContainText("코코");

  await patientTableSection.getByRole("button", { name: /현재 정렬: 등록일시 오름차순/ }).click();
  await expect(patientRows.first()).toContainText("콩이");

  await patientTableSection.getByRole("button", { name: "동물 필터 설정" }).click();
  const filterBuilder = page.locator('[data-emr-table-filter-builder="true"]');
  await expect(
    filterBuilder.getByRole("combobox", { name: "필터 필드" }),
  ).toHaveCount(1);
  await filterBuilder.getByRole("combobox", { name: "필터 필드" }).click();
  await page.getByRole("option", { name: "품종" }).click();
  await expect(
    patientTableSection.getByRole("button", { name: "동물 필터 설정" }),
  ).toBeVisible();
  await expect(patientRows).toHaveCount(5);

  await filterBuilder.getByRole("combobox", { name: "필터 값" }).click();
  await page.getByRole("option", { name: "푸들" }).click();
  await filterBuilder.getByRole("button", { name: "Add filter" }).click();
  await filterBuilder.getByRole("combobox", { name: "필터 필드" }).nth(1).click();
  await page.getByRole("option", { name: "상태" }).click();
  await filterBuilder.getByRole("combobox", { name: "필터 값" }).nth(1).click();
  await page.getByRole("option", { name: "오더진행" }).click();

  await expect(patientTableSection.getByRole("button", { name: "동물 필터 2개 설정" })).toBeVisible();
  await expect(patientRows).toHaveCount(1);
  await expect(patientRows.first()).toContainText("콩이");

  await filterBuilder.getByRole("button", { name: "초기화" }).click();
  await page.keyboard.press("Escape");

  await expect(patientTableSection.getByRole("button", { name: "동물 필터 설정" })).toBeVisible();
  await expect(patientRows).toHaveCount(5);
});

test("customer row action menu closes with Escape and explains unavailable actions", async ({ page }) => {
  await page.goto("/w/clair-demo/customer?modulePanel=open");

  const row = page.getByTestId("customer-patient-row-patient-dubu");
  await row.getByRole("button", { name: "두부 행 작업" }).click();
  await expect(page.getByRole("menu")).toContainText("차트 보러가기");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);

  await row.getByRole("button", { name: "두부 행 작업" }).click();
  await page.getByText("카카오톡 발송", { exact: true }).click();
  await expect(page.getByTestId("customer-row-action-feedback")).toContainText(
    "카카오톡 발송은 아직 연결되지 않았습니다"
  );
  await expect(page.getByRole("menu")).toHaveCount(0);
});

test("customer side panel uses the shared title and collapse header", async ({ page }) => {
  await page.goto("/w/clair-demo/customer?modulePanel=open");

  await expect(page.getByTestId("module-side-panel-title")).toHaveText("고객관리");
  await page.getByRole("button", { name: "사이드 패널 접기", exact: true }).click();

  await expect(page.getByTestId("customer-side-panel")).toHaveCount(0);
  await expect(page).toHaveURL(/modulePanel=closed/);
});

test("customer deleted history uses the mg table empty state and distinguishes search results", async ({ page }) => {
  await page.goto("/w/clair-demo/customer?modulePanel=open");
  await page.getByTestId("customer-side-panel-deleted").click();

  const emptyState = page.getByTestId("customer-deleted-empty-state");
  await expect(emptyState).toHaveAttribute("data-size", "md");
  await expect(emptyState).toHaveAttribute("data-surface", "table");
  await expect(emptyState).toHaveAttribute("data-kind", "no-data");
  await expect(emptyState).toContainText("삭제된 보호자/동물이 없습니다");
  await expect(emptyState).toContainText("삭제 이력이 없습니다");

  await page.getByPlaceholder("삭제 항목 검색").fill("없는 삭제 기록");
  await expect(emptyState).toHaveAttribute("data-kind", "no-filter-results");
  await expect(emptyState).toContainText("조건에 맞는 삭제 항목이 없습니다");
  await expect(emptyState).toContainText("검색어를 바꾸면 삭제 이력이 다시 보입니다");
});

test("common patient and guardian drawers are available outside reception", async ({ page }) => {
  await page.goto("/w/clair-demo/billing?modulePanel=open&right=open&drawer=patient:patient-coco");

  await expect(page.getByText("환자 정보").first()).toBeVisible();
  await expect(page.getByRole("tab", { name: "환자 정보" })).toBeVisible();
  await page.getByRole("button", { name: "보호자 이지은 보기" }).click();

  await expect(page.getByText("보호자 정보").first()).toBeVisible();
  await expect(page).toHaveURL(/drawer=guardian%3Aguardian-lee-jieun|drawer=guardian:guardian-lee-jieun/);
});

test("patient and guardian profiles share the right-panel slot and push customer content", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto(
    "/w/clair-demo/customer?modulePanel=open&drawer=patient:patient-coco",
  );

  const frame = page.locator("main.emr-workspace-frame-responsive");
  const mainContent = page.getByTestId("workspace-main-content");
  const rightPanel = page.getByTestId("workspace-right-panel");
  const profilePanel = page.getByTestId("profile-side-panel");

  await expect(profilePanel).toHaveAttribute("data-profile-kind", "patient");
  await expect(page.getByTestId("workspace-drawer")).toHaveCount(0);
  await expect
    .poll(async () => (await rightPanel.boundingBox())?.width)
    .toBe(380);

  const [frameBox, mainContentBox, rightPanelBox] = await Promise.all([
    frame.boundingBox(),
    mainContent.boundingBox(),
    rightPanel.boundingBox(),
  ]);
  expect(frameBox).not.toBeNull();
  expect(mainContentBox).not.toBeNull();
  expect(rightPanelBox).not.toBeNull();
  expect(rightPanelBox?.width).toBe(380);
  expect(rightPanelBox!.x - (mainContentBox!.x + mainContentBox!.width)).toBe(10);
  expect(frameBox!.x + frameBox!.width).toBe(
    rightPanelBox!.x + rightPanelBox!.width,
  );

  await page.getByRole("button", { name: "보호자 이지은 보기" }).click();
  await expect(profilePanel).toHaveAttribute("data-profile-kind", "guardian");

  const guardianRightPanelBox = await rightPanel.boundingBox();
  expect(guardianRightPanelBox).not.toBeNull();
  expect(guardianRightPanelBox?.x).toBe(rightPanelBox?.x);
  expect(guardianRightPanelBox?.width).toBe(rightPanelBox?.width);
  await expect(page.getByTestId("workspace-drawer")).toHaveCount(0);
});
