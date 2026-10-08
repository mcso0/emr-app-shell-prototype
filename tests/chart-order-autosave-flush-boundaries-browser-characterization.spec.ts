import { expect, test, type Page } from "@playwright/test";
import { chartOrderExpectedEtagHeader } from "../src/features/chart/order-version-contract";
import { etags, installChartSaveSession, patients, type HeldSave } from "./fixtures/chart-order-save-session";

// Regression cases for trailing debounce and patient-navigation flush.
const sessions = new WeakMap<Page, Awaited<ReturnType<typeof installChartSaveSession>>>();
async function ready(page: Page) {
  const session = await installChartSaveSession(page); sessions.set(page, session);
  await session.goto(); await session.pauseReadyClock(); return session;
}
const quantity = (page: Page, key: keyof typeof patients = "a") => page.getByLabel(`${patients[key].orderName} 수량 수정`, { exact: true });
const patientButton = (page: Page, key: keyof typeof patients) => page.getByRole("button", { name: new RegExp(patients[key].name) }).first();
function expectSave(save: HeldSave, value: number) {
  expect(save.input).toMatchObject({ chartId: patients.a.chartId, encounterId: patients.a.encounterId,
    expectedEtag: etags.a0, rows: [{ orderId: patients.a.orderId, quantity: value }] });
  expect(save.headers[chartOrderExpectedEtagHeader.toLowerCase()]).toBe(etags.a0);
}
test.afterEach(async ({ page }, testInfo) => {
  const session = sessions.get(page); if (!session) return;
  await testInfo.attach("autosave-flush-boundary-synthetic-log", {
    body: JSON.stringify({ requests: session.requests, saves: session.saves.map(save => save.input),
      maximumActiveSaves: session.maximumActiveSaves, unexpected: session.unexpected, pageErrors: session.pageErrors }, null, 2),
    contentType: "application/json",
  });
  session.assertNoUnexpectedTraffic();
});

test("continuous editing restarts the trailing debounce and saves only the newest value", async ({ page }) => {
  const session = await ready(page);
  await quantity(page).fill("2"); await page.clock.runFor(650); expect(session.saves).toHaveLength(0);
  await quantity(page).fill("3"); await page.clock.runFor(650); expect(session.saves).toHaveLength(0);
  await page.clock.runFor(100); await expect.poll(() => session.saves.length).toBe(1);
  expectSave(session.saves[0], 3); await session.saves[0].succeed(etags.a1);
  await expect(page.getByTestId("chart-order-save-status")).toHaveText("저장됨");
  await page.clock.runFor(2100); expect(session.saves).toHaveLength(1);
});

test("repeated patient navigation before the debounce expires shares one flush and leaves no old timer save", async ({ page }) => {
  const session = await ready(page);
  await quantity(page).fill("2"); await page.clock.runFor(100);
  await patientButton(page, "b").click(); await patientButton(page, "b").click();
  await expect.poll(() => session.saves.length).toBe(1); expectSave(session.saves[0], 2);
  await expect(patientButton(page, "a")).toHaveAttribute("aria-pressed", "true");
  await page.clock.runFor(1400); expect(session.saves).toHaveLength(1);
  await session.saves[0].succeed(etags.a1);
  await expect(quantity(page, "b")).toHaveValue("1");
  await expect(patientButton(page, "b")).toHaveAttribute("aria-pressed", "true");
  await page.clock.runFor(2100); expect(session.saves).toHaveLength(1); expect(session.maximumActiveSaves).toBe(1);
});

test("a 503 with a newer edit blocks the original navigation but autosaves that newer version", async ({ page }) => {
  const session = await ready(page);
  await quantity(page).fill("2"); await page.clock.runFor(800);
  await expect.poll(() => session.saves.length).toBe(1);
  await quantity(page).fill("3"); await patientButton(page, "b").click();
  await session.saves[0].fail(503);
  await expect(patientButton(page, "a")).toHaveAttribute("aria-pressed", "true");
  await expect(quantity(page)).toHaveValue("3"); await expect(quantity(page, "b")).toHaveCount(0);
  await page.clock.runFor(800); await expect.poll(() => session.saves.length).toBe(2);
  expectSave(session.saves[1], 3); expect(session.maximumActiveSaves).toBe(1);
  await session.saves[1].succeed(etags.a1);
  await expect(page.getByTestId("chart-order-save-status")).toHaveText("저장됨");
  await expect(patientButton(page, "a")).toHaveAttribute("aria-pressed", "true");
  await patientButton(page, "b").click(); await expect(quantity(page, "b")).toHaveValue("1");
  expect(session.saves).toHaveLength(2);
});
