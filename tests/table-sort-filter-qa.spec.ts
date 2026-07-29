import { expect, test, type Locator, type Page } from "@playwright/test";

const kongScenarioUrl =
  "/w/clair-demo/treatment?scenario=kong-vomit&patientId=patient-kong&encounterId=encounter-kong-260501&modulePanel=open&aside=closed";

async function expectWorkspaceScreen(page: Page, marker: Locator) {
  await expect(page).not.toHaveURL(/\/login/);
  await expect(marker).toBeVisible();
}

async function restoreKongOrderDraftDefaults(page: Page) {
  const billingName = page.getByLabel("Maropitant 16mg T 청구서명 수정");
  const quantity = page.getByLabel("Maropitant 16mg T 수량 수정");
  const updateButton = page.getByRole("button", { name: /Order 업데이트/ });

  await expect(billingName).toBeVisible();
  await billingName.fill("Maropitant 16mg T");
  await quantity.fill("1");

  if (await updateButton.isEnabled()) {
    await updateButton.click();
    await expect(page.getByText(/변경 대기/)).toHaveCount(0);
    await expect(updateButton).toBeDisabled();
  }

  await expect(quantity).toHaveValue("1");
  await expect(billingName).toHaveValue("Maropitant 16mg T");
}

async function expectFilterControls(popover: Locator) {
  await expect(popover.getByRole("button", { name: "초기화" })).toBeVisible();
  await expect(popover.getByRole("button", { name: /Add filter/ })).toBeVisible();

  if ((await popover.locator('[data-emr-table-filter-builder="true"]').count()) > 0) {
    await expect(popover.getByRole("button", { name: "필터 닫기" })).toBeVisible();
    await expect(popover.getByRole("button", { name: "Apply filters" })).toHaveCount(0);
    await expect(popover.getByRole("button", { name: "Close" })).toHaveCount(0);
    return;
  }

  await expect(popover.getByRole("button", { name: "Apply filters" })).toBeVisible();
  await expect(popover.getByRole("button", { name: "Close" })).toBeVisible();
}

async function expectEscapeClosesFilter(page: Page) {
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-slot="popover-content"]')).toHaveCount(0);
}

test.describe("DEN-275 adopted table sort/filter QA", () => {
  test("adopted tables expose accessible sort and filter active states", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1366, height: 768 });

    await page.goto(kongScenarioUrl);
    await restoreKongOrderDraftDefaults(page);
    const orderArea = page.locator("section").filter({
      has: page.getByRole("tablist", { name: "처방/오더 분류" }),
    }).last();
    await expectWorkspaceScreen(page, orderArea);
    await orderArea.getByRole("button", { name: /청구금액 오름차순 정렬/ }).click();
    await expect(
      orderArea.getByRole("button", { name: /현재 정렬: 청구금액 오름차순/ }),
    ).toBeVisible();
    await expect(
      orderArea.getByRole("button", { name: "오더 필터 설정" }),
    ).toHaveCount(0);

    await page.goto("/w/clair-demo/customer?modulePanel=open");
    const patientTable = page.getByTestId("customer-patient-table");
    await expectWorkspaceScreen(page, patientTable);
    await patientTable.getByRole("button", { name: /등록일시 오름차순 정렬/ }).click();
    await expect(
      patientTable.getByRole("button", { name: /현재 정렬: 등록일시 오름차순/ }),
    ).toBeVisible();
    await patientTable.getByRole("button", { name: "동물 필터 설정" }).click();
    await expectFilterControls(page.locator('[data-slot="popover-content"]'));
    await expectEscapeClosesFilter(page);

    await page.goto("/w/clair-demo/orders?modulePanel=open");
    const orderTable = page.getByTestId("hospital-order-table");
    await expectWorkspaceScreen(page, orderTable);
    await orderTable.getByRole("button", { name: /판매금액 오름차순 정렬/ }).click();
    await expect(
      orderTable.getByRole("button", { name: /현재 정렬: 판매금액 오름차순/ }),
    ).toBeVisible();
    await page.getByRole("button", { name: "오더 필터 설정" }).click();
    await expectFilterControls(page.locator('[data-slot="popover-content"]'));
    await expectEscapeClosesFilter(page);
  });

  test("adopted filters show empty states and reset back to visible rows", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    await page.goto("/w/clair-demo/customer?modulePanel=open");
    const patientTable = page.getByTestId("customer-patient-table");
    await patientTable.getByRole("button", { name: "동물 필터 설정" }).click();
    let popover = page.locator('[data-slot="popover-content"]').last();
    await popover.getByRole("button", { name: "Add filter" }).click();
    await popover.getByLabel("필터 필드").first().click();
    await page.getByRole("option", { name: "품종" }).click();
    await popover.getByRole("combobox", { name: "필터 값" }).first().click();
    await page.getByRole("option", { name: "푸들" }).click();
    await popover.getByRole("button", { name: "Add filter" }).click();
    await popover.getByLabel("필터 필드").nth(1).click();
    await page.getByRole("option", { name: "성별" }).click();
    await popover.getByRole("combobox", { name: "필터 값" }).nth(1).click();
    await page.getByRole("option", { name: "암컷", exact: true }).click();
    const patientEmptyState = patientTable.locator(
      'section[data-kind="no-filter-results"][data-surface="table"]'
    );
    await expect(patientEmptyState).toBeVisible();
    await expect(patientEmptyState).toContainText("조건에 맞는 동물 정보가 없습니다");
    await expect(patientEmptyState).toContainText("조건을 바꾸면 숨겨진 정보가 다시 보입니다.");
    popover = page.locator('[data-slot="popover-content"]').last();
    if ((await popover.getByRole("button", { name: "초기화" }).count()) === 0) {
      await patientTable.getByRole("button", { name: "동물 필터 2개 설정" }).click();
      popover = page.locator('[data-slot="popover-content"]').last();
    }
    await popover.getByRole("button", { name: "초기화" }).evaluate((button) => {
      (button as HTMLButtonElement).click();
    });
    await popover.getByRole("button", { name: "필터 닫기" }).evaluate((button) => {
      (button as HTMLButtonElement).click();
    });
    await expect(patientTable.locator('[data-testid^="customer-patient-row-"]')).toHaveCount(5);

    await page.goto("/w/clair-demo/orders?modulePanel=open");
    const orderTable = page.getByTestId("hospital-order-table");
    await page.getByRole("button", { name: "오더 필터 설정" }).click();
    popover = page.locator('[data-slot="popover-content"]').last();
    await popover.getByRole("button", { name: "Add filter" }).click();
    await popover.getByLabel("필터 필드").last().click();
    await page.getByRole("option", { name: "판매금액" }).click();
    await popover.getByRole("textbox", { name: "필터 값" }).fill("999999");
    const orderEmptyState = page.getByTestId("hospital-order-empty-state");
    await expect(orderEmptyState).toBeVisible();
    await expect(orderTable).toHaveCount(0);
    await expect(orderEmptyState).toContainText("조건에 맞는 Order가 없습니다");
    await expect(orderEmptyState).toContainText("조건을 초기화하면 숨겨진 Order가 다시 보입니다.");
    popover = page.locator('[data-slot="popover-content"]').last();
    if ((await popover.getByRole("button", { name: "초기화" }).count()) === 0) {
      await page.getByRole("button", { name: "오더 필터 1개 설정" }).click();
      popover = page.locator('[data-slot="popover-content"]').last();
    }
    await popover.getByRole("button", { name: "초기화" }).evaluate((button) => {
      (button as HTMLButtonElement).click();
    });
    await popover.getByRole("button", { name: "필터 닫기" }).evaluate((button) => {
      (button as HTMLButtonElement).click();
    });
    await expect(orderTable.locator('[data-testid^="hospital-order-row-"]')).toHaveCount(2);
  });

  test("section filter controls remain reachable in a narrow viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto("/w/clair-demo/customer?modulePanel=open");
    await expectWorkspaceScreen(page, page.getByTestId("customer-patient-table"));
    await expect(page.getByRole("button", { name: "동물 필터 설정" })).toBeVisible();
    await page.getByRole("button", { name: "동물 필터 설정" }).click();
    await expect(page.locator('[data-slot="popover-content"]')).toBeVisible();
    await expectEscapeClosesFilter(page);

    await page.goto("/w/clair-demo/orders?modulePanel=open");
    await expectWorkspaceScreen(page, page.getByTestId("hospital-order-table"));
    await expect(page.getByRole("button", { name: "오더 필터 설정" })).toBeVisible();
    await page.getByRole("button", { name: "오더 필터 설정" }).click();
    await expect(page.locator('[data-slot="popover-content"]')).toBeVisible();
    await expectEscapeClosesFilter(page);
  });
});
