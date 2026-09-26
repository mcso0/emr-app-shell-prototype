import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1303, height: 870 } });

const cases = [
  {
    name: "조제/처치",
    path: "/w/clair-demo/dispensing?modulePanel=open&aside=closed&date=2026-05-01&encounterId=encounter-kong-260501&workItemId=fulfill-order-kong-fluid",
    title: "처치 지시서",
    historyLabel: "처치 이력 패널 열기",
  },
  {
    name: "임상병리검사",
    path: "/w/clair-demo/lab?modulePanel=open&aside=closed",
    title: "임상병리검사 결과지",
    historyLabel: "임상병리검사 이력 패널 열기",
  },
  {
    name: "영상검사",
    path: "/w/clair-demo/imaging?modulePanel=open&aside=history&right=open",
    title: "영상검사 Order 상세",
    historyLabel: "영상검사 이력 패널 접기",
  },
] as const;

for (const item of cases) {
  test(`${item.name} title keeps chart density and exposes disabled output actions`, async ({ page }) => {
    await page.goto(item.path);

    const titleBar = page.locator('[data-slot="instruction-header-title-bar"] [data-slot="emr-page-header"]');
    await expect(titleBar.getByRole("heading", { name: item.title })).toBeVisible();
    await expect(titleBar.getByRole("heading", { name: item.title })).toHaveCSS("font-size", "16px");
    await expect(titleBar.getByRole("button", { name: item.historyLabel })).toBeVisible();
    await expect(titleBar.getByRole("button", { name: "문서 추가 작업" })).toBeVisible();
    await expect(titleBar.getByText("PDF 다운로드")).toHaveCount(0);
    await expect(titleBar.getByText("출력하기")).toHaveCount(0);

    const geometry = await titleBar.evaluate((bar) => {
      const history = bar.querySelector(`button[aria-label*="이력 패널"]`);
      const actions = bar.children[1];
      const more = bar.querySelector('[data-testid="instruction-output-menu-trigger"]');
      return {
        barHeight: bar.getBoundingClientRect().height,
        historySize: history?.getBoundingClientRect().width,
        actionGap: getComputedStyle(actions).columnGap,
        moreSize: more?.getBoundingClientRect().width,
        overflows: bar.scrollWidth > bar.clientWidth || actions.scrollWidth > actions.clientWidth,
      };
    });
    expect(geometry.barHeight).toBeGreaterThanOrEqual(48);
    expect(geometry.historySize).toBe(24);
    expect(geometry.actionGap).toBe("8px");
    expect(geometry.moreSize).toBe(28);
    expect(geometry.overflows).toBe(false);

    const layout = await page.locator('[data-slot="instruction-header-stack"]').evaluate((stack) => {
      const root = stack.parentElement!;
      const title = stack.querySelector('[data-slot="emr-page-header"]')!;
      const history = title.querySelector('button[aria-label*="이력 패널"]')!;
      const info = stack.querySelector('[data-slot="instruction-info-card"]')!;
      const filters = stack.querySelector('[data-slot="instruction-header-filters"]');
      const result = root.querySelector('[data-slot="instruction-result-scroll-content"]')!;
      const rootRect = root.getBoundingClientRect();
      const titleRect = title.getBoundingClientRect();
      const infoRect = info.getBoundingClientRect();
      const resultStyle = getComputedStyle(result);
      return {
        titleInset: [titleRect.x - rootRect.x, titleRect.y - rootRect.y],
        historyInset: history.getBoundingClientRect().x - rootRect.x,
        infoInset: [infoRect.x - rootRect.x, infoRect.y - titleRect.bottom],
        infoHeight: infoRect.height,
        firstCellInset: getComputedStyle(info.firstElementChild!).paddingLeft,
        lastCellInset: getComputedStyle(info.lastElementChild!).paddingRight,
        filterInset: filters ? filters.getBoundingClientRect().x - rootRect.x + parseFloat(getComputedStyle(filters).paddingLeft) : null,
        filterTopGap: filters ? getComputedStyle(filters).marginTop : null,
        resultInset: result.getBoundingClientRect().x - rootRect.x + parseFloat(resultStyle.paddingLeft),
        resultTopPadding: resultStyle.paddingTop,
        resultSectionGap: resultStyle.rowGap,
        bottomPadding: getComputedStyle(root).paddingBottom,
      };
    });
    expect(layout.titleInset).toEqual([0, 0]);
    expect(layout.historyInset).toBe(16);
    expect(layout.infoInset).toEqual([16, 0]);
    expect(layout.infoHeight).toBeGreaterThanOrEqual(72);
    expect(layout.firstCellInset).toBe("0px");
    expect(layout.lastCellInset).toBe("0px");
    expect(layout.filterInset).toBe(item.name === "영상검사" ? null : 16);
    expect(layout.filterTopGap).toBe(item.name === "영상검사" ? null : "12px");
    expect(layout.resultInset).toBe(16);
    expect(layout.resultTopPadding).toBe("16px");
    expect(layout.resultSectionGap).toBe("16px");
    expect(layout.bottomPadding).toBe("8px");

    if (item.name === "영상검사") {
      await expect(titleBar.getByRole("button", { name: "PACS" })).toBeVisible();
    }

    await titleBar.getByRole("button", { name: "문서 추가 작업" }).click();
    await expect(page.getByRole("menuitem", { name: "PDF 다운로드" })).toBeDisabled();
    await expect(page.getByRole("menuitem", { name: "출력하기" })).toBeDisabled();
    await page.keyboard.press("Escape");
    await titleBar.getByRole("button", { name: "문서 추가 작업" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menuitem", { name: "PDF 다운로드" })).toBeDisabled();
  });
}
