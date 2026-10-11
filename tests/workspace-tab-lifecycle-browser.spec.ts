import { expect, test, type Page } from "@playwright/test";
import { etags, installChartSaveSession, patients, workspaceId } from "./fixtures/chart-order-save-session";

const quantity = (page: Page) => page.getByLabel(`${patients.a.orderName} 수량 수정`, { exact: true });
const tablist = (page: Page) => page.getByRole("tablist", { name: "열린 업무 탭" });
const sessions = new WeakMap<Page, Awaited<ReturnType<typeof installChartSaveSession>>>();
async function ready(page: Page) {
  const session = await installChartSaveSession(page);
  await page.route(url => url.pathname.endsWith("/operations/work-items"), route => route.fulfill({ json: { ok: true, items: [] } }));
  sessions.set(page, session);
  await session.goto(); await session.pauseReadyClock();
  return session;
}
test.afterEach(async ({ page }) => { sessions.get(page)?.assertNoUnexpectedTraffic(); });

test("new workspace tab waits for the pending order save and repeated clicks do not duplicate tabs", async ({ page }) => {
  const session = await ready(page);
  await quantity(page).fill("2");
  await page.getByRole("button", { name: "새 업무 탭", exact: true }).click();
  await page.getByRole("button", { name: "새 업무 탭", exact: true }).click();
  await expect.poll(() => session.saves.length).toBe(1);
  expect(session.saves[0].input.rows?.[0]).toMatchObject({ rowType: "individual", quantity: 2 });
  await expect(page).toHaveURL(/\/treatment\?/);
  await expect(tablist(page).getByRole("tab")).toHaveCount(1);
  await session.saves[0].succeed(etags.a1);
  await expect(page).toHaveURL(/\/home\?/);
  await expect(tablist(page).getByRole("tab")).toHaveCount(2);
});

test("failed order save keeps the current tab and input, and retry can navigate", async ({ page }) => {
  const session = await ready(page);
  await quantity(page).fill("2");
  await page.getByRole("button", { name: "새 업무 탭", exact: true }).click();
  await expect.poll(() => session.saves.length).toBe(1);
  await session.saves[0].fail(503);
  await expect(page.getByTestId("chart-order-save-status")).not.toHaveText("저장 중");
  await expect(quantity(page)).toHaveValue("2");
  await expect(tablist(page).getByRole("tab")).toHaveCount(1);
  await page.getByRole("button", { name: "새 업무 탭", exact: true }).click();
  await expect.poll(() => session.saves.length).toBe(2);
  await session.saves[1].succeed(etags.a1);
  await expect(page).toHaveURL(/\/home\?/);
});

for (const action of ["activate", "close"] as const) {
  test(`${action} workspace tab flushes a not-yet-started autosave before unmount`, async ({ page }) => {
    const session = await ready(page);
    await page.getByRole("button", { name: "새 업무 탭", exact: true }).click();
    await expect(page).toHaveURL(/\/home\?/);
    await tablist(page).getByRole("tab", { name: /진료\/차트/ }).click();
    await expect(quantity(page)).toHaveValue("1");
    await quantity(page).fill("3");
    if (action === "activate") await tablist(page).getByRole("tab", { name: /원내 현황/ }).click();
    else await tablist(page).getByRole("button", { name: "진료/차트 탭 닫기", exact: true }).click();
    await expect.poll(() => session.saves.length).toBe(1);
    await expect(quantity(page)).toHaveValue("3");
    await expect(tablist(page).getByRole("tab")).toHaveCount(2);
    await session.saves[0].succeed(etags.a1);
    await expect(page).toHaveURL(/\/home\?/);
    await expect(tablist(page).getByRole("tab")).toHaveCount(action === "close" ? 1 : 2);
  });
}

test("closing an inactive tab preserves the current unsaved editor without navigating", async ({ page }) => {
  const session = await ready(page);
  await page.getByRole("button", { name: "새 업무 탭", exact: true }).click();
  await expect(page).toHaveURL(/\/home\?/);
  await tablist(page).getByRole("tab", { name: /진료\/차트/ }).click();
  await expect(quantity(page)).toHaveValue("1");
  await quantity(page).fill("2");
  // The autosave clock is paused; keyboard activation does not wait for hover motion.
  await tablist(page).getByRole("button", { name: "원내 현황 탭 닫기", exact: true }).press("Enter");
  await expect(tablist(page).getByRole("tab")).toHaveCount(1);
  await expect(quantity(page)).toHaveValue("2");
  expect(session.saves).toHaveLength(0);
});

test("cancelling a duplicate-tab dialog during save does not navigate after the save completes", async ({ page }) => {
  const session = await ready(page);
  await page.getByRole("button", { name: "새 업무 탭", exact: true }).click();
  await expect(page).toHaveURL(/\/home\?/);
  await page.getByRole("navigation", { name: "워크스페이스 주요 메뉴" }).getByRole("link", { name: "진료/차트", exact: true }).click();
  await page.getByTestId(`order-queue-item-${patients.b.encounterId}`).click();
  const otherQuantity = page.getByLabel(`${patients.b.orderName} 수량 수정`, { exact: true });
  await expect(otherQuantity).toHaveValue("1");
  await otherQuantity.fill("2");
  await page.getByTestId(`order-queue-item-${patients.a.encounterId}`).click();
  const dialog = page.getByRole("dialog", { name: "같은 업무가 이미 열려 있습니다" });
  await dialog.getByRole("checkbox", { name: "다시 보지 않기" }).check();
  await dialog.getByRole("button", { name: "이동하기", exact: true }).click();
  await expect.poll(() => session.saves.length).toBe(1);
  expect(session.saves[0].input).toMatchObject({ encounterId: patients.b.encounterId, rows: [{ quantity: 2 }] });
  await dialog.getByRole("button", { name: "닫기", exact: true }).click();
  await session.saves[0].succeed(etags.b1);
  await expect(page.getByTestId("chart-order-save-status")).toHaveText("저장됨");
  await expect(page).toHaveURL(new RegExp(patients.b.encounterId));
  await expect(tablist(page).getByRole("tab").nth(1)).toHaveAttribute("aria-selected", "true");
  expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith("clair-workspace-tabs-duplicate-warning-hidden:")).length)).toBe(0);
});

test("duplicate warning opt-out persists after saving and is restored on the next source selection", async ({ page }) => {
  const session = await ready(page);
  await page.getByRole("button", { name: "새 업무 탭", exact: true }).click();
  await expect(page).toHaveURL(/\/home\?/);
  await page.getByRole("navigation", { name: "워크스페이스 주요 메뉴" }).getByRole("link", { name: "진료/차트", exact: true }).click();
  await page.getByTestId(`order-queue-item-${patients.b.encounterId}`).click();
  const otherQuantity = page.getByLabel(`${patients.b.orderName} 수량 수정`, { exact: true });
  await expect(otherQuantity).toHaveValue("1");
  await otherQuantity.fill("2");
  await page.getByTestId(`order-queue-item-${patients.a.encounterId}`).click();
  const dialog = page.getByRole("dialog", { name: "같은 업무가 이미 열려 있습니다" });
  await dialog.getByRole("checkbox", { name: "다시 보지 않기" }).check();
  await dialog.getByRole("button", { name: "이동하기", exact: true }).click();
  await expect.poll(() => session.saves.length).toBe(1);
  expect(session.saves[0].input).toMatchObject({ encounterId: patients.b.encounterId, rows: [{ quantity: 2 }] });
  const preference = () => page.evaluate(id => localStorage.getItem(`clair-workspace-tabs-duplicate-warning-hidden:v1:${id}`), workspaceId);
  expect(await preference()).toBeNull();
  await expect(dialog).toBeVisible();
  await session.saves[0].succeed(etags.b1);
  await expect.poll(preference).toBe("true");
  await expect(dialog).toHaveCount(0);
  await expect(tablist(page).getByRole("tab").nth(0)).toHaveAttribute("aria-selected", "true");

  await tablist(page).getByRole("tab").nth(1).click();
  await expect(page).toHaveURL(new RegExp(patients.b.encounterId));
  await page.getByTestId(`order-queue-item-${patients.a.encounterId}`).click();
  await expect(page).toHaveURL(new RegExp(patients.a.encounterId));
  await expect(dialog).toHaveCount(0);
  await expect(tablist(page).getByRole("tab").nth(1)).toHaveAttribute("aria-selected", "true");
  expect(session.saves).toHaveLength(1);
});
