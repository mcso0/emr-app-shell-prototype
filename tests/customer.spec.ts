import { expect, test } from "@playwright/test";

test("customer workspace renders animal master list and opens the common patient drawer", async ({ page }) => {
  await page.goto("/w/clair-demo/customer?modulePanel=open");

  await expect(page.getByTestId("customer-workspace")).toBeVisible();
  await expect(page.getByTestId("module-side-panel-title")).toHaveText("고객관리");
  const customerSidePanel = page.getByTestId("customer-side-panel");
  await expect(customerSidePanel).not.toContainText("Customer");
  await customerSidePanel.getByRole("button", { name: "보호자/동물 관리" }).click();
  await expect(customerSidePanel.getByRole("button", { name: "동물", exact: true })).toHaveCount(0);
  await customerSidePanel.getByRole("button", { name: "보호자/동물 관리" }).click();
  await expect(customerSidePanel.getByRole("button", { name: "동물", exact: true })).toBeVisible();
  await customerSidePanel.getByRole("button", { name: "스케줄 관리" }).click();
  await expect(customerSidePanel.getByRole("button", { name: "예약 일정" })).toBeVisible();
  await customerSidePanel.getByRole("button", { name: "스케줄 관리" }).click();
  await expect(customerSidePanel.getByRole("button", { name: "예약 일정" })).toHaveCount(0);
  await expect(page.getByTestId("customer-page-header").getByRole("heading", { name: "동물" })).toBeVisible();
  await expect(page.getByTestId("customer-page-header")).not.toContainText("스케줄 관리");
  const inpatientNavBox = await page.getByRole("link", { name: "입원" }).boundingBox();
  const customerNavBox = await page.getByRole("link", { name: "고객관리" }).boundingBox();
  const hospitalAdminNavBox = await page.getByRole("link", { name: "병원관리" }).boundingBox();

  expect(inpatientNavBox).not.toBeNull();
  expect(customerNavBox).not.toBeNull();
  expect(hospitalAdminNavBox).not.toBeNull();
  expect(customerNavBox!.y - inpatientNavBox!.y).toBeGreaterThanOrEqual(56);
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
  await expect(page.getByRole("button", { name: "동물 정보" })).toBeVisible();
  await expect(page.getByRole("button", { name: "카카오톡 발송" })).toBeVisible();
  await expect(page).toHaveURL(/drawer=patient%3Apatient-dubu|drawer=patient:patient-dubu/);
});

test("customer side panel switches to guardians and search filters rows", async ({ page }) => {
  await page.goto("/w/clair-demo/customer?modulePanel=open");

  await page.getByRole("button", { name: "보호자", exact: true }).click();
  await expect(page.getByTestId("customer-page-header").getByRole("heading", { name: "보호자" })).toBeVisible();
  await expect(page.getByTestId("customer-guardian-table")).toBeVisible();
  await expect(page.getByTestId("customer-guardian-row-guardian-kang-seoyun")).toContainText("강서윤");
  await expect(page.getByTestId("customer-guardian-row-guardian-kang-seoyun")).toContainText("하루, 두부");

  await page.getByRole("textbox", { name: "고객관리 검색" }).fill("김하늘");

  await expect(page.getByTestId("customer-guardian-row-guardian-kim-haneul")).toBeVisible();
  await expect(page.getByTestId("customer-guardian-row-guardian-kang-seoyun")).toHaveCount(0);

  await page.getByTestId("customer-guardian-row-guardian-kim-haneul").click();

  await expect(page.getByText("보호자 정보").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "보호자 정보" })).toBeVisible();
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
    "카카오톡 발송은 아직 연결되지 않았어"
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

test("common patient and guardian drawers are available outside reception", async ({ page }) => {
  await page.goto("/w/clair-demo/billing?modulePanel=open&right=open&drawer=patient:patient-coco");

  await expect(page.getByText("환자 정보").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "동물 정보" })).toBeVisible();
  await page.getByRole("button", { name: "보호자 이지은 보기" }).click();

  await expect(page.getByText("보호자 정보").first()).toBeVisible();
  await expect(page).toHaveURL(/drawer=guardian%3Aguardian-lee-jieun|drawer=guardian:guardian-lee-jieun/);
});
