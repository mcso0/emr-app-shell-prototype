import { expect, test } from "@playwright/test";

test("inpatient workspace renders ward table and opens admission detail drawer", async ({ page }) => {
  await page.goto("/w/clair-demo/inpatient?modulePanel=open&right=open");

  await expect(page.getByText("inpatient workspace")).toHaveCount(0);
  await expect(page.getByTestId("nav-rail-active-item")).toHaveAttribute("aria-label", "입원");
  await expect(page.getByText("입원 환자")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "26.05.06 (수) 입원 기준일 선택" })).toBeVisible();
  await expect(page.getByRole("button", { name: "입실 추가" })).toBeVisible();
  await expect(page.getByRole("button", { name: "입원실 관리" })).toBeVisible();
  await expect(page.getByRole("group", { name: "입원실 그룹 필터" })).toBeVisible();
  await expect(page.getByRole("group", { name: "입원실 그룹 필터" }).getByRole("button", { name: "강아지 2" })).toBeVisible();
  await expect(page.getByRole("group", { name: "입원실 그룹 필터" }).getByRole("button", { name: "고양이 2" })).toBeVisible();
  await expect(page.getByRole("group", { name: "입원실 그룹 필터" }).getByRole("button", { name: "집중 치료실 1" })).toBeVisible();
  await expect(page.getByTestId("inpatient-workspace")).toBeVisible();
  await expect(page.getByText("강아지 입원실")).toBeVisible();
  await expect(page.getByText("고양이 입원실")).toBeVisible();
  await expect(page.getByRole("heading", { name: "집중 치료실" })).toBeVisible();
  await expect(page.getByTestId("inpatient-section-집중 치료실").locator("table")).toHaveClass(/table-fixed/);
  const tableMetrics = await page
    .getByTestId("inpatient-section-집중 치료실")
    .locator("[data-slot='table-container']")
    .evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
  expect(tableMetrics.scrollWidth).toBeGreaterThanOrEqual(tableMetrics.clientWidth);
  await expect(page.getByTestId("inpatient-row-adm-kong-icu")).toContainText("콩이");
  await expect(page.getByTestId("inpatient-row-adm-kong-icu")).toContainText("구토관찰");
  await expect(page.getByText("급성 위장관염 의심")).toBeVisible();
  await expect(page.getByText("입원 상세")).toHaveCount(0);

  await page.getByTestId("inpatient-row-adm-kong-icu").click();

  await expect(page.getByText("입원 상세")).toBeVisible();
  await expect(page.getByText("ICU-01 · 콩이 · 김하늘")).toBeVisible();
  await expect(page.getByText("집중관리")).toBeVisible();
  await expect(page.getByText("오늘 케어 포인트")).toBeVisible();
  await expect(page.getByText("퇴실 체크리스트")).toBeVisible();

  await page.getByRole("button", { name: "상세 닫기" }).click();
  await expect(page.getByText("입원 상세")).toHaveCount(0);
});

test("inpatient date picker changes the displayed basis date", async ({ page }) => {
  await page.goto("/w/clair-demo/inpatient?modulePanel=open&right=open");

  await page.getByRole("button", { name: "26.05.06 (수) 입원 기준일 선택" }).click();
  await page.getByLabel("입원 기준일", { exact: true }).fill("2026-05-05");

  await expect(page.getByRole("button", { name: "26.05.05 (화) 입원 기준일 선택" })).toBeVisible();
});

test("inpatient search and ward filter narrow visible admissions", async ({ page }) => {
  await page.goto("/w/clair-demo/inpatient?modulePanel=open&right=open");

  await page.getByRole("textbox", { name: "입원 검색" }).fill("두부");

  await expect(page.getByTestId("inpatient-row-adm-dubu-203")).toBeVisible();
  await expect(page.getByTestId("inpatient-row-adm-kong-icu")).toHaveCount(0);

  await page.getByRole("textbox", { name: "입원 검색" }).fill("");
  await page.getByRole("group", { name: "입원실 그룹 필터" }).getByRole("button", { name: "고양이 2" }).click();

  await expect(page.getByTestId("inpatient-row-adm-coco-201")).toBeVisible();
  await expect(page.getByTestId("inpatient-row-adm-nabi-202")).toBeVisible();
  await expect(page.getByTestId("inpatient-row-adm-dubu-203")).toHaveCount(0);
  await expect(page.getByTestId("inpatient-row-adm-kong-icu")).toHaveCount(0);
});
