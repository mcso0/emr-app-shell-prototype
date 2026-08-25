import { expect, test } from "@playwright/test";

const chartUrl =
  "/w/clair-demo/treatment?scenario=kong-vomit&patientId=patient-kong&encounterId=encounter-kong-260501&modulePanel=closed&aside=closed";

test("classification dialog explores, reviews, and commits catalog diagnoses", async ({ page }) => {
  await page.route("**/chart/diagnosis-catalog", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        status: 200,
        systems: [{ id: "system-digestive", name: "소화기계", count: 2 }],
        diseaseGroups: [{ id: "group-gastrointestinal", name: "위장관 질환", systemId: "system-digestive", count: 2 }],
        diagnoses: [
          { catalogId: "catalog-gastroenteritis", masterId: "master-gastroenteritis", masterRevision: 1, code: null, name: "위장염", synonyms: ["장염"], system: { id: "system-digestive", name: "소화기계" }, diseaseGroup: { id: "group-gastrointestinal", name: "위장관 질환" } },
          { catalogId: "catalog-constipation", masterId: "master-constipation", masterRevision: 1, code: null, name: "변비", synonyms: [], system: { id: "system-digestive", name: "소화기계" }, diseaseGroup: { id: "group-gastrointestinal", name: "위장관 질환" } },
        ],
        nextCursor: null,
      }),
    });
  });
  await page.goto(chartUrl);

  const panel = page.getByLabel("진단명 관리");
  await panel.getByRole("button", { name: "분류 검색" }).click();
  const dialog = page.getByRole("dialog", { name: "분류 검색" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("ASSESSMENT")).toHaveCount(0);
  await expect(dialog.getByText("분류를 탐색하면서")).toHaveCount(0);
  await expect(dialog.locator('input[aria-label="계통분류 검색"]:visible')).toBeVisible();
  await expect(dialog.locator('input[aria-label="질환 구분 검색"]:visible')).toBeVisible();
  await expect(dialog.locator('input[aria-label="현재 분류 내 진단명 검색"]:visible')).toBeVisible();

  await dialog.getByRole("option", { name: "위장염" }).click();
  await dialog.getByRole("option", { name: "변비" }).click();
  await expect(dialog.getByLabel("위장염 순서 변경")).toBeVisible();
  await expect(dialog.getByLabel("변비 순서 변경")).toBeVisible();
  await expect(dialog.getByRole("radio", { name: "위장염 주진단 지정" })).toBeDisabled();
  await expect(dialog.getByRole("radio", { name: "변비 주진단 지정" })).toBeDisabled();
  const gastroenteritisDelete = dialog.getByRole("button", { name: "위장염 삭제" });
  const constipationDelete = dialog.getByRole("button", { name: "변비 삭제" });
  await expect(gastroenteritisDelete).toHaveCSS("opacity", "0");
  await expect(constipationDelete).toHaveCSS("opacity", "0");
  await dialog.getByLabel("위장염 순서 변경").hover();
  await expect(gastroenteritisDelete).toHaveCSS("opacity", "1");
  await expect(constipationDelete).toHaveCSS("opacity", "0");
  await dialog.getByLabel("변비 순서 변경").hover();
  await expect(gastroenteritisDelete).toHaveCSS("opacity", "0");
  await expect(constipationDelete).toHaveCSS("opacity", "1");
  await dialog.getByLabel("변비 순서 변경").press("Alt+ArrowUp");
  const reviewOrder = await dialog
    .getByRole("button", { name: /순서 변경$/ })
    .evaluateAll((buttons) =>
      buttons.map((button) => button.getAttribute("aria-label")),
    );
  expect(reviewOrder).toEqual(["변비 순서 변경", "위장염 순서 변경"]);
  await dialog.getByLabel("변비 진단 유형").click();
  await page.getByRole("option", { name: "확진" }).click();
  await dialog.getByRole("button", { name: "선택 완료 (2)" }).click();

  await expect(dialog).toHaveCount(0);
  await expect(panel.getByText("위장염")).toHaveCount(1);
  await expect(panel.getByText("변비")).toHaveCount(1);

  for (const expectation of [
    { viewport: { width: 600, height: 800 }, width: 600, height: 800 },
    { viewport: { width: 800, height: 900 }, width: 768, height: 720 },
    { viewport: { width: 1100, height: 900 }, width: 1060, height: 680 },
    { viewport: { width: 1400, height: 900 }, width: 1120, height: 680 },
  ]) {
    await page.setViewportSize(expectation.viewport);
    await panel.getByRole("button", { name: "분류 검색" }).click();
    await expect(dialog).toBeVisible();
    const size = await dialog.evaluate((element) => {
      const style = getComputedStyle(element);
      return { height: parseFloat(style.height), width: parseFloat(style.width) };
    });
    expect(size.width).toBeCloseTo(expectation.width, 0);
    expect(size.height).toBeCloseTo(expectation.height, 0);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  }
});
