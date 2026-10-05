import { expect, test, type Page } from "@playwright/test";
import { chartOrderExpectedEtagHeader } from "../src/features/chart/order-version-contract";
import { etags, installChartSaveSession, patients, workspaceId, type HeldSave } from "./fixtures/chart-order-save-session";

const sessions = new WeakMap<Page, Awaited<ReturnType<typeof installChartSaveSession>>>();
async function openSession(page: Page, options?: Parameters<typeof installChartSaveSession>[1]) {
  const session = await installChartSaveSession(page, options);
  sessions.set(page, session);
  return session;
}
test.afterEach(async ({ page }, testInfo) => {
  const session = sessions.get(page);
  if (!session) return;
  await testInfo.attach("synthetic-request-log", {
    body: JSON.stringify({ requests: session.requests, saves: session.saves.map(save => ({ input: save.input, etagHeader: save.headers[chartOrderExpectedEtagHeader.toLowerCase()] })), maximumActiveSaves: session.maximumActiveSaves, unexpected: session.unexpected, pageErrors: session.pageErrors }, null, 2),
    contentType: "application/json",
  });
  session.assertNoUnexpectedTraffic();
});

const quantity = (page: Page, key: keyof typeof patients = "a") => page.getByLabel(`${patients[key].orderName} 수량 수정`, { exact: true });
const patientButton = (page: Page, key: keyof typeof patients) => page.getByRole("button", { name: new RegExp(patients[key].name) }).first();
const status = (page: Page) => page.getByTestId("chart-order-save-status");

function expectSaveScope(save: HeldSave, key: keyof typeof patients, etag: string, value: number) {
  expect(save.input).toMatchObject({ chartId: patients[key].chartId, encounterId: patients[key].encounterId, expectedEtag: etag, rows: [{ orderId: patients[key].orderId, quantity: value }] });
  expect(save.headers[chartOrderExpectedEtagHeader.toLowerCase()]).toBe(etag);
  expect(save.headers["if-match"]).toBeUndefined();
}

test("in-flight edit survives the old response and repeated detail flushes share one save", async ({ page }) => {
  const session = await openSession(page);
  await session.goto();
  await expect(quantity(page)).toHaveValue("1");
  await session.pauseReadyClock();
  await quantity(page).fill("2");
  await page.clock.runFor(800);
  await expect.poll(() => session.saves.length).toBe(1);
  expectSaveScope(session.saves[0], "a", etags.a0, 2);
  await quantity(page).fill("3");
  // Closing the actual detail sheet calls OrderArea's flush path, twice while S1 is pending.
  for (let count = 0; count < 2; count += 1) {
    await page.getByTestId(`chart-order-row-${patients.a.orderId}`).hover();
    await page.getByRole("button", { name: `${patients.a.orderName} 더보기`, exact: true }).click();
    await page.clock.runFor(200);
    await page.getByRole("menuitem", { name: "마스터·세부값 보기", exact: true }).click();
    await page.clock.runFor(200);
    await expect(page.getByRole("dialog", { name: `${patients.a.orderName} 상세`, exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.clock.runFor(200);
    await expect(page.getByRole("dialog", { name: `${patients.a.orderName} 상세`, exact: true })).toBeHidden();
  }
  await page.clock.runFor(2400);
  expect(session.saves).toHaveLength(1);
  await session.saves[0].succeed(etags.a1);
  await expect.poll(() => session.saves.length).toBe(2);
  await expect(quantity(page)).toHaveValue("3");
  expectSaveScope(session.saves[1], "a", etags.a1, 3);
  expect(session.maximumActiveSaves).toBe(1);
  await session.saves[1].succeed(etags.a2);
  await expect(status(page)).toHaveText("저장됨");
  await page.clock.runFor(2400);
  expect(session.saves).toHaveLength(2);
  session.assertNoUnexpectedTraffic();
});

test("ETag conflict preserves edits and blocks switching and confirmation until explicit reload", async ({ page }) => {
  const session = await openSession(page);
  await session.goto();
  await session.pauseReadyClock();
  await quantity(page).fill("2");
  await page.clock.runFor(800);
  await expect.poll(() => session.saves.length).toBe(1);
  await session.saves[0].fail(409);
  const conflict = page.getByTestId("chart-order-draft-conflict");
  await expect(conflict).toBeVisible();
  await expect(quantity(page)).toHaveValue("2");
  await page.getByRole("checkbox", { name: `${patients.a.orderName} 선택`, exact: true }).check();
  await page.clock.runFor(200);
  await page.getByTestId(`chart-order-row-${patients.a.orderId}`).hover();
  await expect(page.getByRole("button", { name: `${patients.a.orderName} 확정`, exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: `${patients.a.orderName} 확정`, exact: true })).toBeDisabled();
  await patientButton(page, "b").click();
  await page.clock.runFor(2400);
  await expect(patientButton(page, "a")).toHaveAttribute("aria-pressed", "true");
  await expect(quantity(page)).toHaveValue("2");
  await expect(quantity(page, "b")).toHaveCount(0);
  expect(session.saves).toHaveLength(1);
  expect(session.requests.filter(request => request.method === "PATCH" && request.path === "chart/order-actions")).toHaveLength(0);
  session.setServerRow("a", 4, etags.a2);
  await conflict.getByRole("button", { name: "서버 값 다시 불러오기", exact: true }).click();
  await expect(quantity(page)).toHaveValue("4");
  await expect(status(page)).toHaveText("저장됨");
  await page.clock.runFor(2400);
  expect(session.saves).toHaveLength(1);
  await quantity(page).fill("5");
  await page.clock.runFor(800);
  await expect.poll(() => session.saves.length).toBe(2);
  expectSaveScope(session.saves[1], "a", etags.a2, 5);
  await session.saves[1].succeed(etags.a1);
  await expect(status(page)).toHaveText("저장됨");
  session.assertNoUnexpectedTraffic();
});

test("patient switch waits for both the pending save and edits made during that save", async ({ page }) => {
  const session = await openSession(page);
  await session.goto();
  await session.pauseReadyClock();
  await quantity(page).fill("2");
  await page.clock.runFor(800);
  await expect.poll(() => session.saves.length).toBe(1);
  await quantity(page).fill("3");
  await patientButton(page, "b").click();
  await expect(patientButton(page, "a")).toHaveAttribute("aria-pressed", "true");
  await expect(quantity(page)).toHaveValue("3");
  await expect(quantity(page, "b")).toHaveCount(0);
  await session.saves[0].succeed(etags.a1);
  await expect.poll(() => session.saves.length).toBe(2);
  expectSaveScope(session.saves[0], "a", etags.a0, 2);
  expectSaveScope(session.saves[1], "a", etags.a1, 3);
  await expect(patientButton(page, "a")).toHaveAttribute("aria-pressed", "true");
  await expect(quantity(page)).toHaveValue("3");
  await expect(quantity(page, "b")).toHaveCount(0);
  await session.saves[1].succeed(etags.a2);
  await expect(quantity(page, "b")).toHaveValue("1");
  await expect(patientButton(page, "b")).toHaveAttribute("aria-pressed", "true");
  await expect(quantity(page)).toHaveCount(0);
  await expect(page.getByTestId("chart-order-footer")).toContainText("7,700");
  await expect(status(page)).toHaveText("저장됨");
  await quantity(page, "b").fill("2");
  await page.clock.runFor(800);
  await expect.poll(() => session.saves.length).toBe(3);
  expectSaveScope(session.saves[2], "b", etags.b0, 2);
  await session.saves[2].succeed(etags.b1);
  await expect(status(page)).toHaveText("저장됨");
  expect(session.maximumActiveSaves).toBe(1);
  expect(session.requests.filter(request => request.path === "chart/order-drafts").every(request => request.method === "GET" || request.method === "PATCH")).toBe(true);
  session.assertNoUnexpectedTraffic();
});

test("failed patient-switch flush keeps A selected and retries only when explicitly requested", async ({ page }) => {
  const session = await openSession(page);
  await session.goto();
  await session.pauseReadyClock();
  await quantity(page).fill("2");
  await page.clock.runFor(800);
  await expect.poll(() => session.saves.length).toBe(1);
  await patientButton(page, "b").click();
  await session.saves[0].fail(503);
  const error = page.getByTestId("chart-order-state-error");
  await expect(error).toBeVisible();
  await expect(patientButton(page, "a")).toHaveAttribute("aria-pressed", "true");
  await expect(quantity(page)).toHaveValue("2");
  await expect(quantity(page, "b")).toHaveCount(0);
  await page.clock.runFor(2400);
  expect(session.saves).toHaveLength(1);
  await error.getByRole("button", { name: "다시 저장", exact: true }).click();
  await expect.poll(() => session.saves.length).toBe(2);
  expectSaveScope(session.saves[1], "a", etags.a0, 2);
  await session.saves[1].succeed(etags.a1);
  await expect(status(page)).toHaveText("저장됨");
  await patientButton(page, "b").click();
  await expect(quantity(page, "b")).toHaveValue("1");
  expect(session.saves).toHaveLength(2);
  session.assertNoUnexpectedTraffic();
});

test("late A draft and billing reads cannot replace B rows, edits, amount or save ETag", async ({ page }) => {
  const session = await openSession(page, { holdOldReads: true });
  await session.goto();
  await expect.poll(() => session.heldOldReadCount).toBeGreaterThanOrEqual(2);
  await patientButton(page, "b").click();
  await expect(quantity(page, "b")).toHaveValue("1");
  await session.pauseReadyClock();
  await expect(page.getByTestId("chart-order-footer")).toContainText("7,700");
  await quantity(page, "b").fill("2");
  const amountBeforeOldReply = await page.getByTestId("chart-order-footer").innerText();
  const lateResponse = page.waitForResponse(response => response.url().includes(`/api/workspaces/${workspaceId}/chart/order-drafts?encounterId=${patients.a.encounterId}`));
  const lateBillingResponse = page.waitForResponse(response => response.url().includes(`/api/workspaces/${workspaceId}/chart/order-billing-summary?encounterId=${patients.a.encounterId}`));
  session.releaseOldReads();
  await Promise.all([(await lateResponse).finished(), (await lateBillingResponse).finished()]);
  await page.clock.runFor(50);
  await expect(quantity(page, "b")).toHaveValue("2");
  await expect(quantity(page)).toHaveCount(0);
  await expect(page.getByTestId("chart-order-footer")).toHaveText(amountBeforeOldReply, { useInnerText: true });
  await page.clock.runFor(800);
  await expect.poll(() => session.saves.length).toBe(1);
  expectSaveScope(session.saves[0], "b", etags.b0, 2);
  await session.saves[0].succeed(etags.b1);
  await expect(status(page)).toHaveText("저장됨");
  await page.clock.runFor(2400);
  expect(session.saves).toHaveLength(1);
  session.assertNoUnexpectedTraffic();
});
