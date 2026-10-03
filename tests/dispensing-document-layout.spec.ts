import { expect, test, type Page } from "@playwright/test";

const dispensingUrl = "/w/clair-demo/dispensing?modulePanel=open&aside=closed&right=closed";
const evidence = "docs/completed/app-shell/2026-09-30-dispensing-document-width-assets";
test.use({ viewport: { width: 1920, height: 1080 } });

async function openInstruction(page: Page, type: "dispensing" | "treatment" = "dispensing", narrow = true) {
  // The existing synthetic instruction fixtures exercise several groups and their drawer.
  await page.route("**/api/workspaces/clair-demo/fulfillment/work-items?*", (route) => route.fulfill({
    json: { ok: true, status: 200, enforcedBy: "fulfillment-work-item-persistence", workItems: [] },
  }));
  await page.goto(dispensingUrl);
  await page.getByTestId(`order-queue-item-dispensing-queue-${type === "dispensing" ? 0 : 1}`).click();
  await expect(page.getByRole("heading", { name: type === "dispensing" ? "조제 지시서" : "처치 지시서", exact: true })).toBeVisible();
  await expect(page.getByTestId("workspace-document")).toHaveAttribute("data-width-mode", "wide");
  if (narrow) await page.getByRole("button", { name: "좁게 보기", exact: true }).click();
  if (narrow) await expect(page.getByTestId("workspace-document")).toHaveCSS("max-width", "1120px");
}

test("dispensing starts wide and reload resets a manual narrow choice", async ({ page }) => {
  await openInstruction(page, "dispensing", false);
  const doc = page.getByTestId("workspace-document");
  const available = await page.getByTestId("workspace-document-center").evaluate((element) => element.clientWidth - 32);
  await expect.poll(async () => (await doc.boundingBox())!.width).toBe(available);
  await page.getByRole("button", { name: "좁게 보기", exact: true }).click();
  await expect(doc).toHaveAttribute("data-width-mode", "narrow");
  await page.reload();
  await expect(doc).toHaveAttribute("data-width-mode", "wide");
  await expect(page.getByRole("button", { name: "좁게 보기", exact: true })).toBeVisible();
});

test("instruction toolbar follows the document and width preserves table selection and density", async ({ page }) => {
  await openInstruction(page);
  const toolbar = page.getByTestId("workspace-document-toolbar");
  await expect(toolbar.getByRole("heading", { name: "조제 지시서" })).toBeVisible();
  await expect(toolbar.getByRole("button", { name: "문서 추가 작업", exact: true })).toBeVisible();
  const document = page.getByTestId("workspace-document");
  const group = page.locator('[data-slot="instruction-result-scroll-content"] > *').first();
  await expect(toolbar).toHaveCSS("border-bottom-width", "0px");
  await expect.poll(async () => {
    const documentBox = (await document.boundingBox())!;
    const groupBox = (await group.boundingBox())!;
    return [groupBox.x - documentBox.x, groupBox.width - documentBox.width];
  }).toEqual([0, 0]);
  const content = await page.locator('[data-slot="dispensing-content"]').elementHandle();
  const table = page.getByRole("table", { name: "조제/처치 section-0 오더 테이블", exact: true });
  const checkbox = table.getByRole("checkbox").nth(1);
  await checkbox.check();
  const columns = await table.getByRole("columnheader").allTextContents();
  await expect.poll(async () => (await toolbar.boundingBox())!.width - (await document.boundingBox())!.width).toBe(0);
  await page.getByRole("button", { name: "넓게 보기" }).click();
  await expect(document).toHaveAttribute("data-width-mode", "wide");
  await expect.poll(async () => (await document.boundingBox())!.width).toBeGreaterThan(1120);
  await expect.poll(async () => {
    const documentBox = (await document.boundingBox())!;
    const groupBox = (await group.boundingBox())!;
    const toolbarBox = (await toolbar.boundingBox())!;
    return [groupBox.x - documentBox.x, groupBox.width - documentBox.width, documentBox.x - toolbarBox.x, documentBox.width - toolbarBox.width];
  }).toEqual([0, 0, 0, 0]);
  expect(await content!.evaluate((element) => element.isConnected)).toBe(true);
  await expect(checkbox).toBeChecked();
  await expect(table).toHaveAttribute("data-emr-density", "compact");
  expect(await table.getByRole("columnheader").allTextContents()).toEqual(columns);
  await page.mouse.move(0, 0);
  await page.screenshot({ path: `${evidence}/1920-wide.png` });
  await page.getByRole("button", { name: "좁게 보기" }).click();
  await expect(document).toHaveCSS("max-width", "1120px");
  await expect.poll(async () => (await document.boundingBox())!.width).toBe(1120);
  await expect(checkbox).toBeChecked();
  await page.screenshot({ path: `${evidence}/1920-narrow.png` });
});

test("existing detail drawer input survives panel presentation and viewport changes", async ({ page }) => {
  await openInstruction(page);
  await page.getByRole("button", { name: "넓게 보기" }).click();
  await page.locator('[data-testid^="order-row-section-0-"]').first().locator("td").nth(3).click();
  const drawer = page.getByTestId("workspace-drawer");
  const dose = drawer.getByRole("textbox", { name: "용량", exact: true });
  await expect(dose).toBeVisible();
  await dose.fill("0.75 ml");
  await page.getByRole("button", { name: "조제 이력 패널 열기" }).click();
  await expect(page.locator('[data-workspace-panel="left"]')).toHaveAttribute("data-presentation", "inline");
  await expect(dose).toHaveValue("0.75 ml");
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByRole("dialog", { name: "조제/처치 이력", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dose).toHaveValue("0.75 ml");
  await expect(page.getByTestId("workspace-document")).toHaveAttribute("data-width-mode", "wide");
  await page.screenshot({ path: `${evidence}/1440-existing-drawer.png` });
  await drawer.getByRole("button", { name: "상세 닫기" }).click();
  await expect(drawer).toBeHidden();
});

test("history preserves group state across inline and modal presentation and returns focus", async ({ page }) => {
  await openInstruction(page);
  const trigger = page.getByRole("button", { name: "조제 이력 패널 열기" });
  await trigger.click();
  const panel = page.locator('[data-workspace-panel="left"]');
  await expect(panel).toHaveAttribute("data-presentation", "inline");
  const toolbar = (await page.getByTestId("workspace-document-toolbar").boundingBox())!;
  expect((await panel.boundingBox())!.y).toBe(toolbar.y);
  const group = panel.locator('[data-slot="content-history-group-title"]').first();
  await group.click();
  const expanded = await group.getAttribute("aria-expanded");
  await page.keyboard.press("Escape");
  await expect(panel).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  const dialog = page.getByRole("dialog", { name: "조제/처치 이력", exact: true });
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  await expect(group).toHaveAttribute("aria-expanded", expanded!);
  for (let step = 0; step < 8; step += 1) {
    await page.keyboard.press("Tab");
    await expect.poll(() => dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  }
  await page.screenshot({ path: `${evidence}/1440-history-modal.png` });
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(page).toHaveURL(/aside=closed/);
});

test("width changes retain instruction vertical scroll and contained table scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 600 });
  await openInstruction(page);
  const scroll = page.locator('[data-slot="instruction-result-scroll-area"] [data-slot="scroll-area-viewport"]');
  await scroll.evaluate((element) => { element.scrollTop = 100; });
  const scrollTop = await scroll.evaluate((element) => element.scrollTop);
  expect(scrollTop).toBeGreaterThan(0);
  const table = page.getByRole("table", { name: "조제/처치 section-0 오더 테이블", exact: true });
  const tableScroll = table.locator('xpath=ancestor::*[@data-slot="table-container"]');
  await tableScroll.evaluate((element) => { element.scrollLeft = 100; });
  expect(await tableScroll.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "넓게 보기" }).click();
  await expect(page.getByTestId("workspace-document")).toHaveAttribute("data-width-mode", "wide");
  await expect.poll(() => scroll.evaluate((element) => element.scrollTop)).toBe(scrollTop);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
});

test("dispensing width matrix preserves mode, reduced motion and independent profile", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openInstruction(page);
  for (const width of [1366, 1440, 1600, 1920, 2560, 960]) {
    await page.setViewportSize({ width, height: 1080 });
    const available = await page.getByTestId("workspace-document-center").evaluate((element) => element.clientWidth - 32);
    const toggle = page.locator("[data-workspace-width-toggle]");
    if (available > 1120) await expect(toggle).toBeVisible();
    else await expect(toggle).toBeHidden();
    await expect(page.getByRole("heading", { name: "조제 지시서", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  }
  await page.setViewportSize({ width: 2560, height: 1080 });
  await page.getByRole("button", { name: "넓게 보기" }).click();
  await expect(page.getByTestId("workspace-document")).toHaveCSS("transition-duration", "0s");
  await page.goto(dispensingUrl + "&drawer=patient%3Apatient-coco");
  await page.getByTestId("order-queue-item-dispensing-queue-0").click();
  const profile = page.getByTestId("workspace-right-panel");
  await expect(profile.getByRole("heading", { name: "환자 정보" })).toBeVisible();
  await page.getByRole("button", { name: "조제 이력 패널 열기" }).click();
  await expect(page.locator('[data-workspace-panel="left"]')).toHaveAttribute("data-presentation", "inline");
  await expect(page.locator('[data-workspace-panel="right"]')).toHaveCount(0);
  await expect.poll(async () => {
    const document = await page.getByTestId("workspace-document").boundingBox();
    const box = await profile.boundingBox();
    return Boolean(document && box && document.x + document.width <= box.x + 1);
  }).toBe(true);
  await page.mouse.move(0, 0);
  await expect(profile.getByRole("heading", { name: "환자 정보" })).toBeVisible();
  await expect(profile.locator('[data-slot="emr-profile-loading"]')).toHaveCount(0);
  await page.waitForLoadState("networkidle");
  await expect(profile.locator('[data-slot="emr-profile-identity"]')).toBeInViewport();
  await expect(profile.getByText("마이크로칩", { exact: true })).toBeInViewport();
  await page.screenshot({ path: `${evidence}/2560-profile-history.png` });
});

test("dispensing hidden width trigger restores focus and module-specific preference", async ({ page }) => {
  await openInstruction(page);
  const toggle = page.locator("[data-workspace-width-toggle]");
  await toggle.click();
  await toggle.focus();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(toggle).toBeHidden();
  await expect(page.getByRole("button", { name: "조제 이력 패널 열기" })).toBeFocused();
  await page.setViewportSize({ width: 1920, height: 1080 });
  await expect(toggle).toHaveText("좁게 보기");
  await page.getByRole("link", { name: "임상병리검사", exact: true }).click();
  await expect(page.getByTestId("workspace-document")).toHaveAttribute("data-width-mode", "wide");
  await page.getByRole("link", { name: "조제/처치", exact: true }).click();
  await expect(page.getByTestId("workspace-document")).toHaveAttribute("data-width-mode", "wide");
});

test("treatment instructions share the width and history contract", async ({ page }) => {
  await openInstruction(page, "treatment");
  await expect(page.getByTestId("workspace-document-toolbar").getByRole("heading", { name: "처치 지시서" })).toBeVisible();
  await page.getByRole("button", { name: "넓게 보기" }).click();
  await expect(page.getByTestId("workspace-document")).toHaveAttribute("data-width-mode", "wide");
  await page.getByRole("button", { name: "처치 이력 패널 열기" }).click();
  await expect(page.locator("#dispensing-content-aside")).toContainText("처치 이력");
  await expect(page.getByRole("button", { name: "우측 패널 펼치기" })).toHaveCount(0);
});
