import { expect, test, type Page } from "@playwright/test";

const billingUrl = "/w/clair-demo/billing?modulePanel=open&aside=closed&right=closed";
const evidence = "docs/completed/app-shell/2026-09-30-billing-document-width-assets";
test.use({ viewport: { width: 1920, height: 1080 } });
const summaryTrigger = (page: Page) => page.locator('button[aria-controls="billing-summary-panel-surface"]');
async function openInvoice(page: Page, narrow = true) {
  const checkoutReady = page.waitForResponse((response) => response.url().includes("/billing/guardian-checkout") && response.request().method() === "POST" && response.status() === 200);
  await page.goto(billingUrl);
  await checkoutReady;
  await expect(page.getByRole("heading", { name: "수납", exact: true })).toBeVisible();
  await expect(page.getByTestId("workspace-document")).toHaveAttribute("data-width-mode", "wide");
  if (narrow) await page.getByRole("button", { name: "좁게 보기", exact: true }).click();
  if (narrow) await expect(page.getByTestId("workspace-document")).toHaveCSS("max-width", "1120px");
  await expect(page.getByText("수납 데이터를 불러오는 중입니다.", { exact: true })).toBeHidden();
  await expect(page.getByText("Checkout session을 준비하는 중입니다.", { exact: true })).toBeHidden();
}

test("billing starts wide and reload resets a manual narrow choice", async ({ page }) => {
  await openInvoice(page, false);
  const doc = page.getByTestId("workspace-document");
  const available = await page.getByTestId("workspace-document-center").evaluate((element) => element.clientWidth - 32);
  await expect.poll(async () => (await doc.boundingBox())!.width).toBe(available);
  await page.getByRole("button", { name: "좁게 보기", exact: true }).click();
  await expect(doc).toHaveAttribute("data-width-mode", "narrow");
  await page.reload();
  await expect(doc).toHaveAttribute("data-width-mode", "wide");
  await expect(page.getByRole("button", { name: "좁게 보기", exact: true })).toBeVisible();
});

test("invoice width preserves quantity, calculated total, table and assignment", async ({ page }) => {
  let checkoutCalls = 0;
  page.on("request", (request) => {
    if (request.url().includes("/billing/guardian-checkout") && request.method() === "POST") checkoutCalls += 1;
  });
  await openInvoice(page);
  const document = page.getByTestId("workspace-document");
  const toolbar = page.getByTestId("workspace-document-toolbar");
  const info = page.getByTestId("billing-instruction-info");
  await expect(toolbar).toHaveCSS("border-bottom-width", "0px");
  await expect.poll(async () => {
    const documentBox = (await document.boundingBox())!;
    const infoBox = (await info.boundingBox())!;
    return [infoBox.x - documentBox.x, infoBox.width - documentBox.width];
  }).toEqual([0, 0]);
  await expect.poll(async () => (await toolbar.boundingBox())!.width - (await document.boundingBox())!.width).toBe(0);
  const content = await page.locator('[data-slot="billing-content"]').elementHandle();
  const quantity = page.getByRole("spinbutton", { name: "CBC 검사 수량" });
  await quantity.fill("2");
  const table = page.getByRole("table", { name: "청구 항목 테이블" });
  await expect(table.locator("tfoot")).toContainText("156,500원");
  // The existing synthetic checkout API supplies its own independent amount snapshot.
  await expect(page.getByTestId("billing-checkout-total")).toContainText("121,500원");
  await toolbar.getByRole("button", { name: "담당하기", exact: true }).click();
  const columns = await table.getByRole("columnheader").allTextContents();
  await expect(page.getByText("Checkout session을 준비하는 중입니다.", { exact: true })).toBeHidden();
  const checkoutCallsBeforeWidth = checkoutCalls;
  await page.getByRole("button", { name: "넓게 보기" }).click();
  const available = await page.getByTestId("workspace-document-center").evaluate((element) => element.clientWidth - 32);
  await expect.poll(async () => (await document.boundingBox())!.width).toBe(available);
  await expect.poll(async () => {
    const documentBox = (await document.boundingBox())!;
    const infoBox = (await info.boundingBox())!;
    const toolbarBox = (await toolbar.boundingBox())!;
    return [infoBox.x - documentBox.x, infoBox.width - documentBox.width, documentBox.x - toolbarBox.x, documentBox.width - toolbarBox.width];
  }).toEqual([0, 0, 0, 0]);
  expect(await content!.evaluate((element) => element.isConnected)).toBe(true);
  await expect(quantity).toHaveValue("2");
  expect(await table.getByRole("columnheader").allTextContents()).toEqual(columns);
  await expect(toolbar.getByRole("button", { name: "담당 취소" })).toBeVisible();
  await page.mouse.move(0, 0);
  await page.screenshot({ path: `${evidence}/1920-wide.png` });
  await page.getByRole("button", { name: "좁게 보기" }).click();
  await expect.poll(async () => (await document.boundingBox())!.width).toBe(1120);
  await expect(quantity).toHaveValue("2");
  await expect(table.locator("tfoot")).toContainText("156,500원");
  await expect(page.getByTestId("billing-checkout-total")).toContainText("121,500원");
  expect(checkoutCalls).toBe(checkoutCallsBeforeWidth);
  await page.screenshot({ path: `${evidence}/1920-narrow.png` });
});

test("billing history starts beside the title and summary keeps its amount and payment footer", async ({ page }) => {
  await openInvoice(page);
  await page.getByRole("button", { name: "수납이력 패널 열기" }).click();
  await summaryTrigger(page).click();
  const left = page.locator('[data-workspace-panel="left"]');
  const right = page.locator('[data-workspace-panel="right"]');
  for (const panel of [left, right]) {
    await expect(panel).toHaveAttribute("data-presentation", "inline");
    const toolbar = (await page.getByTestId("workspace-document-toolbar").boundingBox())!;
    if (panel === left) expect((await panel.boundingBox())!.y).toBe(toolbar.y);
    else expect((await panel.boundingBox())!.y).toBeGreaterThanOrEqual(toolbar.y + toolbar.height - 1);
  }
  await expect(page.locator("[data-workspace-width-toggle]")).toBeHidden();
  await expect(right.getByText("최종 결제금액")).toBeVisible();
  await expect(right.getByRole("button", { name: "수납 진행", exact: true })).toBeInViewport();
  await expect(right.locator('[data-slot="emr-right-panel-footer"]')).toHaveCSS("height", "105px");
  await page.mouse.move(0, 0);
  await expect(page.locator('[data-slot="tooltip-content"]:visible')).toHaveCount(0);
  await page.screenshot({ path: `${evidence}/1920-bilateral.png` });
});

test("summary modal retains memo and adjustment, traps focus and returns to toolbar", async ({ page }) => {
  await openInvoice(page);
  await summaryTrigger(page).click();
  const right = page.locator('[data-workspace-panel="right"]');
  const memo = right.getByRole("textbox", { name: "수납 메모" });
  const adjustment = right.getByRole("textbox", { name: "할인 또는 할증 사유" });
  await memo.fill("합성 메모 · 화면 상태 유지 확인");
  await adjustment.fill("합성 사유 · 표시 전환 확인");
  const input = await memo.elementHandle();
  await page.setViewportSize({ width: 1440, height: 900 });
  const dialog = page.getByRole("dialog", { name: "수납 요약", exact: true });
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  expect(await input!.evaluate((element) => element.isConnected)).toBe(true);
  await expect(memo).toHaveValue("합성 메모 · 화면 상태 유지 확인");
  await expect(adjustment).toHaveValue("합성 사유 · 표시 전환 확인");
  for (let step = 0; step < 12; step += 1) {
    await page.keyboard.press("Tab");
    await expect.poll(() => dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  }
  await page.mouse.move(0, 0);
  await page.screenshot({ path: `${evidence}/1440-summary-modal.png` });
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(summaryTrigger(page)).toBeFocused();
});

test("modal payment preflight dismisses only nested dialog and preserves unpaid reason", async ({ page }) => {
  await openInvoice(page);
  await page.getByRole("button", { name: "담당하기", exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await summaryTrigger(page).click();
  const summary = page.getByRole("dialog", { name: "수납 요약", exact: true });
  await summary.getByRole("button", { name: "미납 처리", exact: true }).click();
  const preflight = page.getByRole("dialog", { name: "미납 처리 전 확인" });
  await expect(preflight).toBeVisible();
  await expect(preflight.getByRole("button", { name: "미납 처리 저장" })).toBeDisabled();
  const reason = preflight.getByRole("textbox", { name: "미납 처리 사유" });
  await reason.fill("합성 사유 · 취소 동작 검증");
  await page.keyboard.press("Tab");
  await expect.poll(() => preflight.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(preflight).toBeHidden();
  await expect(summary).toBeVisible();
  await expect(summary.getByRole("button", { name: "미납 처리", exact: true })).toBeFocused();
  await summary.getByRole("button", { name: "미납 처리", exact: true }).click();
  await expect(reason).toHaveValue("합성 사유 · 취소 동작 검증");
  await preflight.getByRole("button", { name: "취소", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(summary).toBeHidden();
  await expect(summaryTrigger(page)).toBeFocused();
});

test("history filters and selection survive modal presentation without changing totals", async ({ page }) => {
  await openInvoice(page);
  await page.getByRole("button", { name: "수납이력 패널 열기" }).click();
  const left = page.locator('[data-workspace-panel="left"]');
  await left.getByRole("button", { name: "1달", exact: true }).click();
  await left.getByTestId("billing-ledger-row-invoice-coco-history-paid-260414").getByRole("checkbox").click();
  await expect(page.getByText("수납 합산 121,500원", { exact: false }).first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(left).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByRole("dialog", { name: "수납이력", exact: true })).toBeVisible();
  await expect(left.getByRole("button", { name: "1달", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(left.getByTestId("billing-ledger-row-invoice-coco-history-paid-260414").getByRole("checkbox")).toBeChecked();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "수납이력 패널 열기" })).toBeFocused();
  await expect(page.getByText("수납 합산 121,500원", { exact: false }).first()).toBeVisible();
});

test("billing scroll remains stable and table scroll stays contained at small width", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 600 });
  await openInvoice(page);
  const scroll = page.locator('[data-slot="billing-content-scroll-area"] [data-slot="scroll-area-viewport"]');
  await scroll.evaluate((element) => { element.scrollTop = 100; });
  const scrollTop = await scroll.evaluate((element) => element.scrollTop);
  expect(scrollTop).toBeGreaterThan(0);
  await page.getByRole("button", { name: "넓게 보기" }).click();
  await expect(page.getByTestId("workspace-document")).toHaveAttribute("data-width-mode", "wide");
  await expect.poll(() => scroll.evaluate((element) => element.scrollTop)).toBe(scrollTop);
  await page.setViewportSize({ width: 960, height: 900 });
  const tableScroll = page.getByRole("table", { name: "청구 항목 테이블" }).locator('xpath=ancestor::*[@data-slot="table-container"]');
  await tableScroll.evaluate((element) => { element.scrollLeft = 100; });
  expect(await tableScroll.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
});

test("billing actual-space matrix reduced motion and profile coexistence", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openInvoice(page);
  for (const width of [1366, 1440, 1600, 1920, 2560, 960]) {
    await page.setViewportSize({ width, height: 1080 });
    const available = await page.getByTestId("workspace-document-center").evaluate((element) => element.clientWidth - 32);
    const toggle = page.locator("[data-workspace-width-toggle]");
    if (available > 1120) await expect(toggle).toBeVisible(); else await expect(toggle).toBeHidden();
    await expect(page.getByRole("heading", { name: "수납", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  }
  await page.setViewportSize({ width: 2560, height: 1080 });
  await page.getByRole("button", { name: "넓게 보기" }).click();
  await expect(page.getByTestId("workspace-document")).toHaveCSS("transition-duration", "0s");
  await page.goto(billingUrl + "&drawer=patient%3Apatient-coco");
  const profile = page.getByTestId("workspace-right-panel");
  await expect(profile.getByRole("heading", { name: "환자 정보" })).toBeVisible();
  await page.getByRole("button", { name: "수납이력 패널 열기" }).click();
  await summaryTrigger(page).click();
  const right = page.locator('[data-workspace-panel="right"]');
  await expect(right).toHaveAttribute("data-presentation", "inline");
  await expect(page.locator('[data-workspace-panel="left"]')).toHaveAttribute("data-presentation", "inline");
  await expect.poll(async () => {
    const box = await right.boundingBox(); const profileBox = await profile.boundingBox();
    return Boolean(box && profileBox && box.x + box.width <= profileBox.x + 1);
  }).toBe(true);
  await page.mouse.move(0, 0);
  await expect(page.locator('[data-slot="tooltip-content"]:visible')).toHaveCount(0);
  await expect(profile.getByRole("heading", { name: "환자 정보" })).toBeVisible();
  await expect(profile.locator('[data-slot="emr-profile-loading"]')).toHaveCount(0);
  await page.screenshot({ path: `${evidence}/2560-profile-bilateral.png` });
});

test("billing hidden width trigger restores focus and module preference", async ({ page }) => {
  await openInvoice(page);
  const toggle = page.locator("[data-workspace-width-toggle]");
  await toggle.click(); await toggle.focus();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(toggle).toBeHidden();
  await expect(summaryTrigger(page)).toBeFocused();
  await page.setViewportSize({ width: 1920, height: 1080 });
  await expect(toggle).toHaveText("좁게 보기");
  await page.getByRole("link", { name: "임상병리검사", exact: true }).click();
  await expect(page.getByTestId("workspace-document")).toHaveAttribute("data-width-mode", "wide");
  await page.getByRole("link", { name: "수납", exact: true }).click();
  await expect(page.getByTestId("workspace-document")).toHaveAttribute("data-width-mode", "wide");
});
