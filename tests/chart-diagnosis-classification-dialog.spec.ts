import { expect, test, type Locator } from "@playwright/test";

const chartUrl =
  "/w/clair-demo/treatment?scenario=kong-vomit&patientId=patient-kong&encounterId=encounter-kong-260501&modulePanel=closed&aside=closed";

async function expectEmptyStateCentered(title: Locator) {
  await expect(title).toBeVisible();
  await title.page().waitForTimeout(200);

  const offsets = await title.evaluate((element) => {
    const root = element.closest<HTMLElement>("[data-kind]");
    const viewport = root?.closest<HTMLElement>(
      "[data-slot='scroll-area-viewport']",
    );
    if (!root || !viewport) throw new Error("empty-state viewport is missing");

    const childRects = Array.from(root.children)
      .map((child) => child.getBoundingClientRect())
      .filter((rect) => rect.width || rect.height);
    const viewportRect = viewport.getBoundingClientRect();
    const left = Math.min(...childRects.map((rect) => rect.left));
    const right = Math.max(...childRects.map((rect) => rect.right));
    const top = Math.min(...childRects.map((rect) => rect.top));
    const bottom = Math.max(...childRects.map((rect) => rect.bottom));

    return {
      x:
        (left + right) / 2 -
        (viewportRect.left + viewportRect.right) / 2,
      y:
        (top + bottom) / 2 -
        (viewportRect.top + viewportRect.bottom) / 2,
    };
  });

  expect(Math.abs(offsets.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(offsets.y)).toBeLessThanOrEqual(1);
}

async function expectLoadingStateCentered(loadingState: Locator) {
  await expect(loadingState).toBeVisible();

  const offsets = await loadingState.evaluate((element) => {
    const childRects = Array.from(element.children).map((child) =>
      child.getBoundingClientRect(),
    );
    if (!childRects.length) {
      throw new Error("classification loading body is missing");
    }

    const bodyRect = element.getBoundingClientRect();
    const left = Math.min(...childRects.map((rect) => rect.left));
    const right = Math.max(...childRects.map((rect) => rect.right));
    const top = Math.min(...childRects.map((rect) => rect.top));
    const bottom = Math.max(...childRects.map((rect) => rect.bottom));

    return {
      x: (left + right) / 2 - (bodyRect.left + bodyRect.right) / 2,
      y: (top + bottom) / 2 - (bodyRect.top + bodyRect.bottom) / 2,
    };
  });

  expect(Math.abs(offsets.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(offsets.y)).toBeLessThanOrEqual(1);
}

test("classification dialog centers initial loading feedback", async ({ page }) => {
  let releaseCatalog!: () => void;
  const catalogGate = new Promise<void>((resolve) => {
    releaseCatalog = resolve;
  });
  await page.route("**/chart/diagnosis-catalog**", async (route) => {
    await catalogGate;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        status: 200,
        systems: [],
        diseaseGroups: [],
        diagnoses: [],
        nextCursor: null,
      }),
    });
  });
  await page.goto(chartUrl);

  const panel = page.getByLabel("진단명 관리");
  await panel.getByRole("button", { name: "분류 검색" }).click();
  const dialog = page.getByRole("dialog", { name: "분류검색" });
  const diagnosisColumn = dialog.getByRole("region", { name: "진단명" });
  const loadingState = diagnosisColumn.locator(
    '[data-slot="classification-explorer-loading-state"]',
  );
  await expect(loadingState).toContainText("진단명을 불러오는 중입니다");
  await expectLoadingStateCentered(loadingState);

  releaseCatalog();
  await expect(loadingState).toBeHidden();
});

test("classification dialog explores, reviews, and commits catalog diagnoses", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.route("**/chart/diagnosis-catalog**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        status: 200,
        systems: [{ id: "system-digestive", name: "소화기계", count: 2 }],
        diseaseGroups: [
          {
            id: "group-gastrointestinal",
            name: "위장관 질환",
            systemId: "system-digestive",
            count: 2,
          },
        ],
        diagnoses: [
          {
            catalogId: "catalog-gastroenteritis",
            masterId: "master-gastroenteritis",
            masterRevision: 1,
            code: null,
            name: "위장염",
            synonyms: ["장염"],
            system: { id: "system-digestive", name: "소화기계" },
            diseaseGroup: { id: "group-gastrointestinal", name: "위장관 질환" },
          },
          {
            catalogId: "catalog-constipation",
            masterId: "master-constipation",
            masterRevision: 1,
            code: null,
            name: "변비",
            synonyms: [],
            system: { id: "system-digestive", name: "소화기계" },
            diseaseGroup: { id: "group-gastrointestinal", name: "위장관 질환" },
          },
          ...Array.from({ length: 10 }, (_, index) => ({
            catalogId: `catalog-extra-${index + 1}`,
            masterId: `master-extra-${index + 1}`,
            masterRevision: 1,
            code: null,
            name: `추가 진단 ${index + 1}`,
            synonyms: [],
            system: { id: "system-digestive", name: "소화기계" },
            diseaseGroup: {
              id: "group-gastrointestinal",
              name: "위장관 질환",
            },
          })),
        ],
        nextCursor: null,
      }),
    });
  });
  await page.goto(chartUrl);

  const panel = page.getByLabel("진단명 관리");
  await panel.getByRole("button", { name: "분류 검색" }).click();
  const dialog = page.getByRole("dialog", { name: "분류검색" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("ASSESSMENT")).toHaveCount(0);
  await expect(dialog.getByText("분류를 탐색하면서")).toHaveCount(0);
  await expect(
    dialog.getByRole("button", { name: "진단명 검색" }),
  ).toBeVisible();
  await expectEmptyStateCentered(
    dialog.getByText("선택된 진단명이 없습니다", { exact: true }),
  );
  await expect(
    dialog.getByText("탐색 영역에서 진단명을 선택해 주세요.", { exact: true }),
  ).toHaveCount(0);
  await expect(
    dialog
      .getByText("선택된 진단명이 없습니다", { exact: true })
      .locator("xpath=ancestor::section[1]"),
  ).toHaveAttribute("data-size", "md");
  const systemOption = dialog.getByRole("option", { name: "전체 2" }).first();
  const diagnosisOption = dialog.getByRole("option", { name: "위장염" });
  const [systemRowStyle, diagnosisRowStyle] = await Promise.all([
    systemOption.evaluate((element) => {
      const label = element.querySelector("span");
      const style = label ? getComputedStyle(label) : null;
      return {
        height: element.getBoundingClientRect().height,
        fontWeight: style?.fontWeight,
        lineHeight: style?.lineHeight,
      };
    }),
    diagnosisOption.evaluate((element) => {
      const label = element.querySelector("span");
      const style = label ? getComputedStyle(label) : null;
      return {
        height: element.getBoundingClientRect().height,
        fontWeight: style?.fontWeight,
        lineHeight: style?.lineHeight,
      };
    }),
  ]);
  expect(systemRowStyle).toEqual({
    height: 34,
    fontWeight: "500",
    lineHeight: "18px",
  });
  expect(diagnosisRowStyle).toEqual(systemRowStyle);
  const sectionTitleWeights = await dialog.locator("section strong").evaluateAll(
    (elements) => elements.map((element) => getComputedStyle(element).fontWeight),
  );
  expect(sectionTitleWeights).toEqual(["600", "600", "600", "600"]);
  const scrollbarRight = await dialog
    .getByRole("region", { name: "진단명" })
    .locator('[data-slot="scroll-area-scrollbar"]')
    .evaluate((element) => getComputedStyle(element).right);
  expect(scrollbarRight).toBe("-13px");
  const diagnosisHeading = dialog.getByText("진단명", { exact: true });
  const searchButton = dialog.getByRole("button", { name: "진단명 검색" });
  const [headingBox, searchButtonBox] = await Promise.all([
    diagnosisHeading.boundingBox(),
    searchButton.boundingBox(),
  ]);
  expect(searchButtonBox?.x).toBeGreaterThan(headingBox?.x ?? 0);

  await searchButton.click();
  const diagnosisSearch = dialog.getByRole("searchbox", {
    name: "진단명 검색",
  });
  await expect(diagnosisSearch).toBeVisible();
  const searchFieldWidth = await diagnosisSearch.evaluate(
    (element) => element.parentElement?.getBoundingClientRect().width ?? 0,
  );
  expect(searchFieldWidth).toBeGreaterThanOrEqual(148);
  await expect(dialog.getByText(/검색결과 \d+건/)).toHaveCount(0);
  await diagnosisSearch.fill("존재하지 않는 진단명");
  await expectEmptyStateCentered(
    dialog.getByText("검색 결과가 없습니다", { exact: true }),
  );
  await diagnosisSearch.fill("위장");
  await expect(dialog.getByRole("option", { name: "위장염" })).toBeVisible();
  await dialog.getByRole("button", { name: "진단명 검색 닫기" }).click();

  await dialog.getByRole("option", { name: "위장염" }).click();
  await dialog.getByRole("option", { name: "변비" }).click();
  await expect(dialog.getByLabel("위장염 순서 변경")).toBeVisible();
  await expect(dialog.getByLabel("변비 순서 변경")).toBeVisible();
  await expect(dialog.getByRole("button", { name: /주진단$/ })).toHaveCount(0);
  const gastroenteritisDelete = dialog.getByRole("button", {
    name: "위장염 삭제",
  });
  const constipationDelete = dialog.getByRole("button", { name: "변비 삭제" });
  const clearButton = dialog.getByRole("button", { name: "전체 삭제" });
  await page.mouse.move(0, 0);
  await expect(clearButton).toHaveCSS("height", "24px");
  await expect(clearButton).toHaveCSS("font-size", "12px");
  await expect(clearButton).not.toHaveCSS("border-color", "rgba(0, 0, 0, 0)");
  await expect(gastroenteritisDelete).toHaveCSS("opacity", "1");
  await expect(constipationDelete).toHaveCSS("opacity", "1");
  await expect(gastroenteritisDelete).toHaveCSS("width", "24px");
  await expect(gastroenteritisDelete).toHaveCSS("height", "24px");
  const gastroenteritisType = dialog.getByLabel("위장염 진단 유형");
  const [typeAfterRender, deleteAfterRender] = await Promise.all([
    gastroenteritisType.boundingBox(),
    gastroenteritisDelete.boundingBox(),
  ]);
  expect(
    (typeAfterRender?.x ?? 0) + (typeAfterRender?.width ?? 0),
  ).toBeLessThan(
    deleteAfterRender?.x ?? 0,
  );
  await dialog.getByLabel("변비 순서 변경").press("Alt+ArrowUp");
  const reviewOrder = await dialog
    .getByRole("button", { name: /순서 변경$/ })
    .evaluateAll((buttons) =>
      buttons.map((button) => button.getAttribute("aria-label")),
    );
  expect(reviewOrder).toEqual(["변비 순서 변경", "위장염 순서 변경"]);
  await dialog.getByLabel("변비 진단 유형").click();
  await page.getByRole("option", { name: "확진" }).click();
  await dialog.getByRole("button", { name: "선택 완료", exact: true }).click();

  await expect(dialog).toHaveCount(0);
  await expect(panel.getByText("위장염")).toHaveCount(1);
  await expect(panel.getByText("변비")).toHaveCount(1);

  await panel.getByRole("button", { name: "분류 검색" }).click();
  const existingGastroenteritis = dialog.getByRole("option", { name: "위장염" });
  const existingConstipation = dialog.getByRole("option", { name: "변비" });
  await expect(existingGastroenteritis).toHaveAttribute("aria-selected", "true");
  await expect(existingGastroenteritis).toBeEnabled();
  await expect(existingConstipation).toHaveAttribute("aria-selected", "true");
  await expect(existingConstipation).toBeEnabled();
  await existingGastroenteritis.click();
  await expect(existingGastroenteritis).toHaveAttribute("aria-selected", "false");
  await existingGastroenteritis.click();
  await expect(existingGastroenteritis).toHaveAttribute("aria-selected", "true");
  await dialog.getByRole("button", { name: "전체 삭제" }).click();
  await expect(dialog.getByRole("button", { name: "선택 완료" })).toBeEnabled();
  await dialog.getByRole("button", { name: "선택 완료" }).click();
  await expect(panel.getByText("위장염")).toHaveCount(0);
  await expect(panel.getByText("변비")).toHaveCount(0);

  await panel.getByRole("button", { name: "분류 검색" }).click();
  await dialog.getByRole("option", { name: "위장염" }).click();
  await dialog.getByRole("option", { name: "변비" }).click();
  await dialog.getByRole("button", { name: "선택 완료" }).click();
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
      return {
        height: parseFloat(style.height),
        width: parseFloat(style.width),
      };
    });
    expect(size.width).toBeCloseTo(expectation.width, 0);
    expect(size.height).toBeCloseTo(expectation.height, 0);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  }
});

test("classification dialog switches to debounced server search and appends cursor pages", async ({
  page,
}) => {
  const searchRequests: string[] = [];
  await page.route("**/chart/diagnosis-catalog**", async (route) => {
    const url = new URL(route.request().url());
    const query = url.searchParams.get("q");
    const cursor = url.searchParams.get("cursor");
    if (query) searchRequests.push(`${query}:${cursor ?? "first"}`);

    const diagnoses = cursor
      ? [
          {
            catalogId: "catalog-patella-b",
            masterId: "master-patella-b",
            masterRevision: 1,
            code: null,
            name: "슬개골 탈구 B",
            synonyms: [],
            system: { id: "system-musculoskeletal", name: "근골격계" },
            diseaseGroup: { id: "group-joint", name: "관절 질환" },
          },
        ]
      : query
        ? [
            {
              catalogId: "catalog-patella",
              masterId: "master-patella",
              masterRevision: 1,
              code: null,
              name: "슬개골 탈구",
              synonyms: [],
              system: { id: "system-musculoskeletal", name: "근골격계" },
              diseaseGroup: { id: "group-joint", name: "관절 질환" },
            },
          ]
        : [
            {
              catalogId: "catalog-gastroenteritis",
              masterId: "master-gastroenteritis",
              masterRevision: 1,
              code: null,
              name: "위장염",
              synonyms: [],
              system: { id: "system-digestive", name: "소화기계" },
              diseaseGroup: {
                id: "group-gastrointestinal",
                name: "위장관 질환",
              },
            },
          ];

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        systems: [{ id: "system-digestive", name: "소화기계", count: 51 }],
        diseaseGroups: [
          {
            id: "group-gastrointestinal",
            name: "위장관 질환",
            systemId: "system-digestive",
            count: 51,
          },
        ],
        diagnoses,
        nextCursor:
          query && !cursor
            ? "슬개골 탈구|33333333-3333-4333-8333-333333333333"
            : query
              ? null
              : "위장염|33333333-3333-4333-8333-333333333333",
      }),
    });
  });

  await page.goto(chartUrl);
  const panel = page.getByLabel("진단명 관리");
  await panel.getByRole("button", { name: "분류 검색" }).click();
  const dialog = page.getByRole("dialog", { name: "분류검색" });
  await dialog.getByRole("button", { name: "진단명 검색" }).click();
  const searchbox = dialog.getByRole("searchbox", { name: "진단명 검색" });
  await searchbox.fill("슬개");

  await expect(
    dialog.getByRole("option", { name: "슬개골 탈구" }),
  ).toBeVisible();
  expect(searchRequests).toEqual(["슬개:first"]);
  await dialog.getByRole("button", { name: "진단명 더 보기" }).click();
  await expect(
    dialog.getByRole("option", { name: "슬개골 탈구 B" }),
  ).toBeVisible();
  expect(searchRequests).toEqual([
    "슬개:first",
    "슬개:슬개골 탈구|33333333-3333-4333-8333-333333333333",
  ]);
});
