import { expect, test, type Page } from "@playwright/test";

const imagingUrl = "/w/clair-demo/imaging?imagingStudyId=imaging-coco-thorax&modulePanel=open&aside=closed&right=closed";
const evidence = "docs/completed/app-shell/2026-09-30-imaging-document-width-assets";
test.use({ viewport: { width: 1920, height: 1080 } });

async function openReport(page: Page, narrow = true) {
  await page.route("**/api/workspaces/clair-demo/fulfillment/work-items?*", (route) => route.fulfill({
    json: { ok: true, status: 200, enforcedBy: "fulfillment-work-item-persistence", workItems: [] },
  }));
  await page.goto(imagingUrl);
  await expect(page.getByRole("heading", { name: "영상검사 Order 상세", exact: true })).toBeVisible();
  await expect(page.getByTestId("workspace-document")).toHaveAttribute("data-width-mode", "wide");
  if (narrow) await page.getByRole("button", { name: "좁게 보기", exact: true }).click();
  if (narrow) await expect(page.getByTestId("workspace-document")).toHaveCSS("max-width", "1280px");
}

const summaryTrigger = (page: Page) => page.locator('button[aria-controls="imaging-summary-panel-surface"]');

test("imaging starts wide and reload resets a manual narrow choice", async ({ page }) => {
  await openReport(page, false);
  const doc = page.getByTestId("workspace-document");
  const available = await page.getByTestId("workspace-document-center").evaluate((element) => element.clientWidth - 32);
  await expect.poll(async () => (await doc.boundingBox())!.width).toBe(available);
  await page.getByRole("button", { name: "좁게 보기", exact: true }).click();
  await expect(doc).toHaveAttribute("data-width-mode", "narrow");
  await page.reload();
  await expect(doc).toHaveAttribute("data-width-mode", "wide");
  await expect(page.getByRole("button", { name: "좁게 보기", exact: true })).toBeVisible();
});

test("report width and document toolbar preserve reading inputs and order table", async ({ page }) => {
  await openReport(page);
  const document = page.getByTestId("workspace-document");
  const toolbar = page.getByTestId("workspace-document-toolbar");
  const section = page.locator('[data-slot="instruction-result-scroll-content"] > section').first();
  await expect(toolbar).toHaveCSS("border-bottom-width", "0px");
  await expect.poll(async () => {
    const documentBox = (await document.boundingBox())!;
    const sectionBox = (await section.boundingBox())!;
    return [sectionBox.x - documentBox.x, sectionBox.width - documentBox.width];
  }).toEqual([0, 0]);
  const content = await page.locator('[data-slot="imaging-content"]').elementHandle();
  await expect.poll(async () => (await toolbar.boundingBox())!.width - (await document.boundingBox())!.width).toBe(0);
  await expect(toolbar.getByRole("button", { name: "PACS", exact: true })).toBeVisible();
  await expect(summaryTrigger(page)).toBeVisible();
  const findings = page.getByRole("textbox", { name: "영상 판독 내용", exact: true });
  const impression = page.getByRole("textbox", { name: "영상 종합소견", exact: true });
  await findings.fill("합성 판독 입력 · 폭 전환 유지 확인");
  await impression.fill("합성 종합소견 · 입력 유지 확인");
  const table = page.getByRole("table", { name: "영상검사 Order 상세정보", exact: true });
  const columns = await table.getByRole("columnheader").allTextContents();
  await expect(table).toHaveAttribute("data-emr-density", "comfortable");
  await page.getByRole("button", { name: "넓게 보기" }).click();
  const available = await page.getByTestId("workspace-document-center").evaluate((element) => element.clientWidth - 32);
  await expect.poll(async () => (await document.boundingBox())!.width).toBe(available);
  await expect.poll(async () => {
    const documentBox = (await document.boundingBox())!;
    const sectionBox = (await section.boundingBox())!;
    const toolbarBox = (await toolbar.boundingBox())!;
    return [sectionBox.x - documentBox.x, sectionBox.width - documentBox.width, documentBox.x - toolbarBox.x, documentBox.width - toolbarBox.width];
  }).toEqual([0, 0, 0, 0]);
  expect(await content!.evaluate((element) => element.isConnected)).toBe(true);
  await expect(findings).toHaveValue("합성 판독 입력 · 폭 전환 유지 확인");
  await expect(impression).toHaveValue("합성 종합소견 · 입력 유지 확인");
  expect(await table.getByRole("columnheader").allTextContents()).toEqual(columns);
  await page.mouse.move(0, 0);
  await page.screenshot({ path: `${evidence}/1920-wide.png` });
  await page.getByRole("button", { name: "좁게 보기" }).click();
  await expect.poll(async () => (await document.boundingBox())!.width).toBe(1280);
  await expect(findings).toHaveValue("합성 판독 입력 · 폭 전환 유지 확인");
  await page.screenshot({ path: `${evidence}/1920-narrow.png` });
});

test("history starts beside the title while summary stays below and inputs remain mounted", async ({ page }) => {
  await openReport(page);
  const findings = page.getByRole("textbox", { name: "영상 판독 내용", exact: true });
  await findings.fill("합성 중앙 입력 · 양쪽 패널 확인");
  await page.getByRole("button", { name: "영상검사 이력 패널 열기" }).click();
  await summaryTrigger(page).click();
  const left = page.locator('[data-workspace-panel="left"]');
  const right = page.locator('[data-workspace-panel="right"]');
  await expect(left).toHaveAttribute("data-presentation", "inline");
  await expect(right).toHaveAttribute("data-presentation", "inline");
  const comment = right.getByRole("textbox", { name: "영상 종합 코멘트" });
  await comment.fill("합성 보호자 코멘트 · 표시 전환 확인");
  const toolbar = (await page.getByTestId("workspace-document-toolbar").boundingBox())!;
  expect((await left.boundingBox())!.y).toBe(toolbar.y);
  expect((await right.boundingBox())!.y).toBeGreaterThanOrEqual(toolbar.y + toolbar.height - 1);
  await expect(page.locator("[data-workspace-width-toggle]")).toBeHidden();
  await expect(findings).toHaveValue("합성 중앙 입력 · 양쪽 패널 확인");
  await expect(right.getByRole("button", { name: "저장", exact: true })).toBeVisible();
  await expect(right.getByText("coco-thorax-lateral.png")).toBeVisible();
  await page.mouse.move(0, 0);
  await expect(page.locator('[data-slot="tooltip-content"]:visible')).toHaveCount(0);
  await page.screenshot({ path: `${evidence}/1920-bilateral.png` });
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(right).toHaveAttribute("data-presentation", "modal");
  await expect(left).toBeHidden();
  await expect(comment).toHaveValue("합성 보호자 코멘트 · 표시 전환 확인");
  await page.keyboard.press("Escape");
  await expect(findings).toHaveValue("합성 중앙 입력 · 양쪽 패널 확인");
});

test("summary presentation preserves comment and traps then returns focus", async ({ page }) => {
  await openReport(page);
  const trigger = summaryTrigger(page);
  await trigger.click();
  const right = page.locator('[data-workspace-panel="right"]');
  const comment = right.getByRole("textbox", { name: "영상 종합 코멘트" });
  await comment.fill("합성 코멘트 유지");
  const input = await comment.elementHandle();
  await page.setViewportSize({ width: 1440, height: 900 });
  const dialog = page.getByRole("dialog", { name: "종합소견", exact: true });
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  expect(await input!.evaluate((element) => element.isConnected)).toBe(true);
  await expect(comment).toHaveValue("합성 코멘트 유지");
  for (let step = 0; step < 10; step += 1) {
    await page.keyboard.press("Tab");
    await expect.poll(() => dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  }
  await page.screenshot({ path: `${evidence}/1440-summary-modal.png` });
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(page).toHaveURL(/right=closed/);
});

test("history state and central reading survive inline to modal and latest panel switching", async ({ page }) => {
  await openReport(page);
  const findings = page.getByRole("textbox", { name: "영상 판독 내용", exact: true });
  await findings.fill("합성 판독 입력 유지");
  const trigger = page.getByRole("button", { name: "영상검사 이력 패널 열기" });
  await trigger.click();
  const left = page.locator('[data-workspace-panel="left"]');
  const group = left.locator('[data-slot="content-history-group-title"]').first();
  await group.click();
  const expanded = await group.getAttribute("aria-expanded");
  await page.keyboard.press("Escape");
  await expect(left).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByRole("dialog", { name: "영상검사 이력", exact: true })).toBeVisible();
  await expect(group).toHaveAttribute("aria-expanded", expanded!);
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await summaryTrigger(page).click();
  await expect(page.getByRole("dialog", { name: "종합소견", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(findings).toHaveValue("합성 판독 입력 유지");
});

test("existing imaging density action stays responsive and survives width changes", async ({ page }) => {
  await openReport(page);
  const table = page.getByRole("table", { name: "영상검사 Order 상세정보", exact: true });
  await page.getByRole("button", { name: "테이블 보기 밀도: 넓은 간격", exact: true }).click();
  await page.getByRole("menuitemradio", { name: "좁은 간격", exact: true }).click();
  await expect(table).toHaveAttribute("data-emr-density", "compact");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toBeHidden();
  const toggle = page.locator("[data-workspace-width-toggle]");
  await toggle.click();
  await expect(page.getByTestId("workspace-document")).toHaveAttribute("data-width-mode", "wide");
  await expect(table).toHaveAttribute("data-emr-density", "compact");
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("workspace-document")).toHaveAttribute("data-width-mode", "narrow");
  await expect(table).toHaveAttribute("data-emr-density", "compact");
  await expect(table.locator("tbody tr")).toHaveCount(1);
});

test("report width retains vertical scroll and small-screen table scrolling is contained", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 600 });
  await openReport(page);
  const scroll = page.locator('[data-slot="imaging-result-scroll-area"] [data-slot="scroll-area-viewport"]');
  await scroll.evaluate((element) => { element.scrollTop = 100; });
  const scrollTop = await scroll.evaluate((element) => element.scrollTop);
  expect(scrollTop).toBeGreaterThan(0);
  await page.getByRole("button", { name: "넓게 보기" }).click();
  await expect(page.getByTestId("workspace-document")).toHaveAttribute("data-width-mode", "wide");
  await expect.poll(() => scroll.evaluate((element) => element.scrollTop)).toBe(scrollTop);
  await page.setViewportSize({ width: 960, height: 900 });
  const table = page.getByRole("table", { name: "영상검사 Order 상세정보", exact: true });
  const tableScroll = table.locator('xpath=ancestor::*[@data-slot="table-container"]');
  await tableScroll.evaluate((element) => { element.scrollLeft = 100; });
  expect(await tableScroll.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
});

test("imaging actual-space matrix, reduced motion and profile coexistence", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openReport(page);
  for (const width of [1366, 1440, 1600, 1920, 2560, 960]) {
    await page.setViewportSize({ width, height: 1080 });
    const available = await page.getByTestId("workspace-document-center").evaluate((element) => element.clientWidth - 32);
    const toggle = page.locator("[data-workspace-width-toggle]");
    if (available > 1280) await expect(toggle).toBeVisible();
    else await expect(toggle).toBeHidden();
    await expect(page.getByRole("heading", { name: "영상검사 Order 상세", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  }
  await page.setViewportSize({ width: 2560, height: 1080 });
  await page.getByRole("button", { name: "넓게 보기" }).click();
  await expect(page.getByTestId("workspace-document")).toHaveCSS("transition-duration", "0s");
  await page.goto(imagingUrl + "&drawer=patient%3Apatient-coco");
  const profile = page.getByTestId("workspace-right-panel");
  await expect(profile.getByRole("heading", { name: "환자 정보" })).toBeVisible();
  await page.getByRole("button", { name: "영상검사 이력 패널 열기" }).click();
  await summaryTrigger(page).click();
  const right = page.locator('[data-workspace-panel="right"]');
  await expect(right).toHaveAttribute("data-presentation", "inline");
  await expect(page.locator('[data-workspace-panel="left"]')).toHaveAttribute("data-presentation", "inline");
  await expect.poll(async () => {
    const box = await right.boundingBox();
    const profileBox = await profile.boundingBox();
    return Boolean(box && profileBox && box.x + box.width <= profileBox.x + 1);
  }).toBe(true);
  await page.mouse.move(0, 0);
  await page.screenshot({ path: `${evidence}/2560-profile-bilateral.png` });
});

test("hidden imaging width trigger returns focus to summary and restores module preference", async ({ page }) => {
  await openReport(page);
  const toggle = page.locator("[data-workspace-width-toggle]");
  await toggle.click();
  await toggle.focus();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(toggle).toBeHidden();
  await expect(summaryTrigger(page)).toBeFocused();
  await page.setViewportSize({ width: 1920, height: 1080 });
  await expect(toggle).toHaveText("좁게 보기");
  await page.getByRole("link", { name: "임상병리검사", exact: true }).click();
  await expect(page.getByTestId("workspace-document")).toHaveAttribute("data-width-mode", "wide");
  await page.getByRole("link", { name: "영상검사", exact: true }).click();
  await expect(page.getByTestId("workspace-document")).toHaveAttribute("data-width-mode", "wide");
});
