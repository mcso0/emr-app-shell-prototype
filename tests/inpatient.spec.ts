import { expect, test } from "@playwright/test";

test("inpatient workspace renders admission list, ward table, and detail panel", async ({ page }) => {
  await page.goto("/w/clair-demo/inpatient?modulePanel=open&right=open");

  await expect(page.getByText("inpatient workspace")).toHaveCount(0);
  await expect(page.getByTestId("nav-rail-active-item")).toHaveAttribute("aria-label", "입원");
  await expect(page.getByRole("button", { name: "26.05.06 (수) 날짜 선택" })).toBeVisible();
  await expect(page.getByRole("button", { name: "입실 추가" })).toBeVisible();
  await expect(page.getByRole("button", { name: "입원실 관리" })).toBeVisible();
  await expect(page.getByRole("group", { name: "입원 상태 필터" })).toBeVisible();
  await expect(page.getByTestId("inpatient-workspace")).toBeVisible();
  await expect(page.getByText("집중 치료실")).toBeVisible();
  await expect(page.getByTestId("inpatient-row-adm-kong-icu")).toContainText("콩이");
  await expect(page.getByText("급성 위장관염 의심")).toBeVisible();
  await expect(page.getByText("입원 상세")).toBeVisible();
  await expect(page.getByText("ICU-01 · 콩이 · 김하늘")).toBeVisible();
  await expect(page.getByText("오늘 케어 포인트")).toBeVisible();
  await expect(page.getByText("퇴실 체크리스트")).toBeVisible();
});

test("inpatient search and status filter narrow visible admissions", async ({ page }) => {
  await page.goto("/w/clair-demo/inpatient?modulePanel=open&right=open");

  await page.getByRole("textbox", { name: "입원 검색" }).fill("두부");

  await expect(page.getByTestId("inpatient-row-adm-dubu-203")).toBeVisible();
  await expect(page.getByTestId("inpatient-row-adm-kong-icu")).toHaveCount(0);

  await page.getByRole("textbox", { name: "입원 검색" }).fill("");
  await page.getByRole("group", { name: "입원 상태 필터" }).getByRole("button", { name: "퇴실준비 2" }).click();

  await expect(page.getByTestId("inpatient-row-adm-dubu-203")).toBeVisible();
  await expect(page.getByTestId("inpatient-row-adm-haru-204")).toBeVisible();
  await expect(page.getByTestId("inpatient-row-adm-kong-icu")).toHaveCount(0);
});
