import { expect, test, type Locator, type Page } from "@playwright/test";

test.use({ viewport: { width: 1920, height: 1080 } });
test.afterEach(async ({ page }) => page.unrouteAll({ behavior: "ignoreErrors" }));

const cases = [
  { name: "chart", path: "/treatment?scenario=kong-vomit&patientId=patient-kong&encounterId=encounter-kong-260501", title: "차트", status: /차트 작성 완료|호출하기/, output: false },
  { name: "lab", path: "/lab", title: "임상병리검사 결과지", status: /검사 시작|검사중|검사완료|담당하기/, output: true },
  { name: "imaging", path: "/imaging?imagingStudyId=imaging-coco-thorax", title: "영상검사 Order 상세", status: /판독 시작|판독중|판독완료|담당하기/, output: true },
  { name: "dispensing", path: "/dispensing?date=2026-05-01&workItemId=fulfill-order-coco-maropitant", title: "조제 지시서", status: /조제 시작|조제중|조제완료|담당하기/, output: true },
  { name: "procedure", path: "/dispensing?date=2026-05-01&workItemId=fulfill-order-kong-fluid", title: "처치 지시서", status: /처치 시작|처치중|처치완료|담당하기/, output: true },
  { name: "billing", path: "/billing", title: "수납", status: /담당하기|담당 취소/, output: false },
] as const;

function rightActions(page: Page, chart: boolean) {
  const toolbar = page.getByTestId("workspace-document-toolbar");
  return toolbar.locator(chart
    ? '[data-slot="chart-action-bar"] > div:last-child'
    : '[data-slot="emr-page-header"] > div:last-child');
}

async function measureActions(actions: Locator) {
  return actions.getByRole("button").evaluateAll((buttons) => buttons.map((button) => {
    const box = button.getBoundingClientRect();
    const style = getComputedStyle(button);
    return {
      label: (button.textContent?.trim() || button.getAttribute("aria-label") || "").replace(/\s+/g, " "),
      height: box.height,
      width: box.width,
      x: box.x,
      y: box.y,
      fontSize: style.fontSize,
      hasText: Boolean(button.textContent?.trim()),
      outlined: parseFloat(style.borderTopWidth) > 0 && !["transparent", "rgba(0, 0, 0, 0)"].includes(style.borderTopColor),
      icons: Array.from(button.querySelectorAll("svg")).map((icon) => {
        const rect = icon.getBoundingClientRect();
        return [rect.width, rect.height];
      }),
    };
  }));
}

for (const item of cases) {
  test(item.name + " title actions keep SM geometry and secondary-first order", async ({ page }) => {
    // Use the local synthetic API, then pin a requested/assigned state to exercise
    // the lifecycle split trigger without performing a persisted transition.
    await page.route("**/api/workspaces/clair-demo/fulfillment/work-items?*", async (route) => {
      const response = await route.fetch();
      const payload = await response.json();
      await route.fulfill({ json: {
        ...payload,
        workItems: payload.workItems?.map((workItem: Record<string, unknown>) => ({
          ...workItem, status: "requested", assignedToUserId: "user-tech",
        })) ?? [],
      } });
    });
    const separator = item.path.includes("?") ? "&" : "?";
    await page.goto("/w/clair-demo" + item.path + separator + "modulePanel=open&aside=closed&right=closed");
    const toolbar = page.getByTestId("workspace-document-toolbar");
    await expect(toolbar.getByRole("heading", { name: item.title })).toBeVisible();
    const actions = rightActions(page, item.name === "chart");
    const status = actions.getByRole("button", { name: item.status }).first();
    await expect(status).toBeVisible();
    const startLabels = { lab: "검사 시작", imaging: "판독 시작", dispensing: "조제 시작", procedure: "처치 시작" };
    if (item.name in startLabels) {
      await expect(actions.getByRole("button", { name: startLabels[item.name as keyof typeof startLabels], exact: true })).toBeVisible();
    }

    for (const mode of ["wide", "narrow"] as const) {
      await expect(page.getByTestId("workspace-document")).toHaveAttribute("data-width-mode", mode);
      const geometry = await measureActions(actions);
      expect(geometry[0].label).toBe(mode === "wide" ? "좁게 보기" : "넓게 보기");
      const statusIndex = geometry.findIndex((button) => item.status.test(button.label));
      expect(statusIndex).toBeGreaterThan(0);
      for (const button of geometry) {
        expect(button.height, button.label).toBe(28);
        if (button.hasText) expect(button.fontSize, button.label).toBe("12px");
        for (const icon of button.icons) expect(icon, button.label).toEqual([12, 12]);
        if (button.label.includes("액션 열기") || button.label === "문서 추가 작업") {
          expect(button.width, button.label).toBe(28);
        }
      }
      for (const button of geometry.slice(0, statusIndex)) expect(button.outlined, button.label).toBe(true);
      // Verify actual visual order matches DOM/tab order, including joined segments.
      for (let i = 1; i < geometry.length; i += 1) {
        const previous = geometry[i - 1];
        const current = geometry[i];
        expect(current.y > previous.y || current.x >= previous.x + previous.width - 1).toBe(true);
      }
      if (item.name === "lab") expect(geometry[1].label).toMatch(/장비 검사 수신함/);
      if (item.name === "imaging") {
        expect(geometry[1].label).toBe("PACS");
        const recordIndex = geometry.findIndex((button) => button.label === "수행기록·이력");
        const summaryIndex = geometry.findIndex((button) => button.label.startsWith("종합소견"));
        expect(recordIndex).toBe(2);
        expect(summaryIndex).toBe(3);
        expect(summaryIndex).toBeLessThan(statusIndex);
      }
      if (item.name === "dispensing" || item.name === "procedure") {
        expect(geometry.some((button) => button.label === "수행기록·이력")).toBe(true);
      }
      if (item.name === "billing") expect(geometry[1].label).toBe("수납 요약");
      if (item.output) expect(geometry.at(-1)?.label).toBe("문서 추가 작업");
      await toolbar.screenshot({ path: test.info().outputPath(item.name + "-" + mode + ".png") });
      if (mode === "wide") await actions.getByRole("button", { name: "좁게 보기", exact: true }).click();
    }

    const statusMenu = actions.getByRole("button", { name: /상태 액션 열기|진료 보조 액션 열기/ });
    if (await statusMenu.count()) {
      await statusMenu.focus();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("menu")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(statusMenu).toBeFocused();
    }
    if (item.output) {
      const output = actions.getByRole("button", { name: "문서 추가 작업", exact: true });
      await output.focus();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("menuitem", { name: "PDF 다운로드" })).toBeDisabled();
      await expect(page.getByRole("menuitem", { name: "출력하기" })).toBeDisabled();
      await page.keyboard.press("Escape");
      await expect(output).toBeFocused();
    }

    await page.setViewportSize({ width: 1303, height: 870 });
    await expect(status).toBeVisible();
    expect(await actions.evaluate((group) => group.scrollWidth <= group.clientWidth)).toBe(true);
    for (const button of await measureActions(actions)) expect(button.height, button.label).toBe(28);
    await toolbar.screenshot({ path: test.info().outputPath(item.name + "-compact.png") });
  });
}
