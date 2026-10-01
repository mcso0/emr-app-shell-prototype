import { expect, test, type Page } from "@playwright/test";
import { mockSoapNotes } from "../src/mocks/emr-domain";

const chartUrl = "/w/clair-demo/treatment?scenario=kong-vomit&patientId=patient-kong&encounterId=encounter-kong-260501&modulePanel=open&aside=closed&right=closed";
const evidence = "docs/completed/app-shell/2026-09-30-chart-document-width-assets";
test.use({ viewport: { width: 1920, height: 1080 } });

async function openChart(page: Page, narrow = true) {
  await page.goto(chartUrl);
  await expect(page.getByLabel("SOAP 블록 문서")).toBeVisible();
  await expect(page.getByTestId("workspace-document")).toHaveAttribute("data-width-mode", "wide");
  await expect(page.getByRole("button", { name: "좁게 보기" })).toBeVisible();
  if (narrow) {
    await page.getByRole("button", { name: "좁게 보기" }).click();
    await expect(page.getByTestId("workspace-document")).toHaveCSS("max-width", "1040px");
  }
}

test("chart starts wide after entry and reload while manual narrow choice survives module navigation", async ({ page }) => {
  await openChart(page, false);
  const doc = page.getByTestId("workspace-document");
  const available = await page.getByTestId("workspace-document-center").evaluate((element) => element.clientWidth - 32);
  await expect.poll(async () => (await doc.boundingBox())!.width).toBe(available);
  await page.getByRole("button", { name: "좁게 보기" }).click();
  await expect(doc).toHaveAttribute("data-width-mode", "narrow");
  await page.reload();
  await expect(page.getByLabel("SOAP 블록 문서")).toBeVisible();
  await expect(doc).toHaveAttribute("data-width-mode", "wide");
  await expect(page.getByRole("button", { name: "좁게 보기" })).toBeVisible();
  await page.getByRole("button", { name: "좁게 보기" }).click();
  await page.getByRole("link", { name: "임상병리검사", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "HCT 결과값" })).toBeVisible();
  await expect(doc).toHaveAttribute("data-width-mode", "narrow");
  await page.getByRole("link", { name: "진료/차트", exact: true }).click();
  await expect(doc).toHaveAttribute("data-width-mode", "narrow");
});

test("chart toolbar spans the surface and width changes preserve editor, selection and panel state", async ({ page }) => {
  // Keep this layout probe isolated from the local server's mutable SOAP fixture.
  await page.route("**/api/workspaces/clair-demo/chart/soap-notes", async (route) => {
    if (route.request().method() !== "PATCH") return route.continue();
    const input = route.request().postDataJSON();
    const note = mockSoapNotes.find((item) => item.encounterId === input.encounterId)!;
    await route.fulfill({ json: {
      ok: true, status: 200, auditRecorded: true,
      enforcedBy: "chart-soap-note-persistence",
      soapNote: { ...note, blockDocument: input.blockDocument, status: "autosaved", updatedAt: "2026-09-30T09:00:00.000Z" },
    } });
  });
  await openChart(page);
  const editor = page.getByLabel("SOAP 블록 문서").locator('[contenteditable="true"]').first();
  const contentHandle = await page.locator('[data-slot="chart-content"]').elementHandle();
  await editor.click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type(" width-preserved");
  await page.getByRole("checkbox", { name: "CBC 검사 선택" }).check();
  const search = page.getByRole("textbox", { name: "진단명 검색" });
  await search.fill("위장염");
  await page.keyboard.press("Escape");
  const toolbar = page.getByTestId("workspace-document-toolbar");
  await expect(toolbar.locator('[data-slot="chart-action-bar"]')).toBeVisible();
  const doc = page.getByTestId("workspace-document");
  expect((await toolbar.boundingBox())!.width).toBeGreaterThan((await doc.boundingBox())!.width);
  await page.getByRole("button", { name: "넓게 보기" }).click();
  await expect(doc).toHaveAttribute("data-width-mode", "wide");
  await expect.poll(async () => (await doc.boundingBox())!.width).toBeGreaterThan(1040);
  await expect(doc).toHaveCSS("transition-duration", "0.18s");
  expect(await contentHandle!.evaluate((element) => element.isConnected)).toBe(true);
  await expect(editor).toContainText("width-preserved");
  await expect(search).toHaveValue("위장염");
  await expect(page.getByRole("checkbox", { name: "CBC 검사 선택" })).toBeChecked();
  await page.screenshot({ path: `${evidence}/1920-wide.png` });
  await page.getByRole("button", { name: "좁게 보기" }).click();
  await expect(doc).toHaveCSS("max-width", "1040px");
  await expect(editor).toContainText("width-preserved");
  await page.screenshot({ path: `${evidence}/1920-narrow.png` });
});

test("chart history switches inline to modal with focus return and preserved input", async ({ page }) => {
  await openChart(page);
  const search = page.getByRole("textbox", { name: "진단명 검색" });
  await search.fill("위장염");
  await page.keyboard.press("Escape");
  const trigger = page.getByRole("button", { name: "차트 이력 패널 열기" });
  await trigger.click();
  const panel = page.locator('[data-workspace-panel="left"]');
  await expect(panel).toHaveAttribute("data-presentation", "inline");
  await search.fill("위장염");
  await page.keyboard.press("Escape");
  await expect(panel).toBeVisible();
  const toolbar = (await page.getByTestId("workspace-document-toolbar").boundingBox())!;
  expect((await panel.boundingBox())!.y).toBeGreaterThanOrEqual(toolbar.y + toolbar.height - 1);
  await page.setViewportSize({ width: 1440, height: 900 });
  const dialog = page.getByRole("dialog", { name: "차트 이력", exact: true });
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  for (let step = 0; step < 8; step += 1) {
    await page.keyboard.press("Tab");
    await expect.poll(() => dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  }
  await page.screenshot({ path: `${evidence}/1440-history-modal.png` });
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(search).toHaveValue("위장염");
  await expect(page).toHaveURL(/aside=closed/);
});

test("chart uses available container space and preserves the Order pinned columns and scroll", async ({ page }) => {
  await openChart(page);
  const grid = page.getByTestId("chart-soap-diagnosis-grid");
  const metrics = await grid.evaluate((element) => ({
    scrollWidth: element.scrollWidth, width: element.clientWidth,
    panels: Array.from(element.children).map((panel) => panel.getBoundingClientRect().width),
  }));
  expect(metrics.panels).toEqual([360, 360, 360]);
  expect(metrics.scrollWidth).toBeGreaterThan(metrics.width);
  const table = page.getByRole("table", { name: "처방/오더 테이블" });
  const density = await table.getAttribute("data-emr-density");
  const columns = await table.locator('th[data-column-id]').evaluateAll((headers) => headers.map((header) => header.getAttribute("data-column-id")));
  const pinned = table.locator('th[data-column-id="displayName"]');
  const scroll = table.locator('xpath=ancestor::*[@data-emr-pinned-table-viewport="true"]').locator('> [data-emr-pinned-table-scroll-owner="true"]');
  const pinnedX = (await pinned.boundingBox())!.x;
  await scroll.evaluate((element) => { element.scrollLeft = 200; });
  await expect.poll(() => scroll.evaluate((element) => element.scrollLeft)).toBe(200);
  expect(Math.abs((await pinned.boundingBox())!.x - pinnedX)).toBeLessThanOrEqual(1);
  await page.getByRole("button", { name: "넓게 보기" }).click();
  await expect(page.getByTestId("workspace-document")).toHaveAttribute("data-width-mode", "wide");
  await expect.poll(() => scroll.evaluate((element) => element.scrollLeft)).toBe(200);
  expect(await table.locator('th[data-column-id]').evaluateAll((headers) => headers.map((header) => header.getAttribute("data-column-id")))).toEqual(columns);
  await expect(table).toHaveAttribute("data-emr-density", density!);
  await expect(page.getByTestId("chart-order-footer")).toContainText("총 금액");
});

test("chart width changes preserve the SOAP document scroll position", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 600 });
  await openChart(page);
  const scroll = page.getByLabel("SOAP 블록 문서");
  await scroll.evaluate((element) => { element.scrollTop = 60; });
  const scrollTop = await scroll.evaluate((element) => element.scrollTop);
  expect(scrollTop).toBeGreaterThan(0);
  await page.getByRole("button", { name: "넓게 보기" }).click();
  await expect(page.getByTestId("workspace-document")).toHaveAttribute("data-width-mode", "wide");
  await expect.poll(() => scroll.evaluate((element) => element.scrollTop)).toBe(scrollTop);
});

test("chart hidden width toggle returns focus to history and restores mode across modules", async ({ page }) => {
  await openChart(page);
  const toggle = page.locator("[data-workspace-width-toggle]");
  await toggle.click();
  await toggle.focus();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(toggle).toBeHidden();
  await expect(page.getByRole("button", { name: "차트 이력 패널 열기" })).toBeFocused();
  await expect(page.getByTestId("workspace-document")).toHaveAttribute("data-width-mode", "wide");
  await page.setViewportSize({ width: 1920, height: 1080 });
  await expect(toggle).toHaveText("좁게 보기");
  await page.getByRole("link", { name: "임상병리검사", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "HCT 결과값" })).toBeVisible();
  await expect(page.getByTestId("workspace-document")).toHaveAttribute("data-width-mode", "narrow");
  await page.getByRole("link", { name: "진료/차트", exact: true }).click();
  await expect(page.getByTestId("workspace-document")).toHaveAttribute("data-width-mode", "wide");
});

test("chart width matrix, reduced motion and independent profile keep content contained", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openChart(page);
  for (const width of [1366, 1440, 1600, 1920, 2560, 960]) {
    await page.setViewportSize({ width, height: 1080 });
    const available = await page.getByTestId("workspace-document-center").evaluate((element) => element.clientWidth - 32);
    const toggle = page.locator("[data-workspace-width-toggle]");
    if (available > 1040) await expect(toggle).toBeVisible();
    else await expect(toggle).toBeHidden();
    await expect(page.getByLabel("SOAP 블록 문서")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  }
  await page.setViewportSize({ width: 2560, height: 1080 });
  await page.getByRole("button", { name: "넓게 보기" }).click();
  await expect(page.getByTestId("workspace-document")).toHaveCSS("transition-duration", "0s");
  await page.goto(chartUrl.replace("aside=closed", "aside=history") + "&drawer=patient%3Apatient-kong");
  const profile = page.getByTestId("workspace-right-panel");
  const history = page.locator('[data-workspace-panel="left"]');
  await expect(profile.getByRole("heading", { name: "환자 정보" })).toBeVisible();
  await expect(history).toHaveAttribute("data-presentation", "inline");
  await expect(page.locator('[data-workspace-panel="right"]')).toHaveCount(0);
  await expect.poll(async () => {
    const document = await page.getByTestId("workspace-document").boundingBox();
    const panel = await profile.boundingBox();
    return Boolean(document && panel && document.x + document.width <= panel.x + 1);
  }).toBe(true);
  await page.screenshot({ path: `${evidence}/2560-profile-history.png` });
});
