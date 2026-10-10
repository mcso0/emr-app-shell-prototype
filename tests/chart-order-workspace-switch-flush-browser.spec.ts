import { expect, test, type Page } from "@playwright/test";
import { SESSION_WORKSPACES_STORAGE_KEY } from "../src/features/auth/workspace-session";
import { chartOrderExpectedEtagHeader } from "../src/features/chart/order-version-contract";
import {
  etags, installChartSaveSession, patients, workspaceId, workspaceBId,
  workspaceBEtags, workspaceBPatients, workspaceCId, workspaceCEtags, workspaceCPatients,
  type HeldSave,
} from "./fixtures/chart-order-save-session";

type Session = Awaited<ReturnType<typeof installChartSaveSession>>;
const sessions = new WeakMap<Page, Session>();
const quantity = (page: Page, name: string = patients.a.orderName) => page.getByLabel(`${name} 수량 수정`, { exact: true });
const status = (page: Page) => page.getByTestId("chart-order-save-status");
const marker = "__syntheticWorkspaceFlushContext";

async function ready(page: Page, third = false) {
  const session = await installChartSaveSession(page, { includeSecondWorkspace: true, includeThirdWorkspace: third });
  sessions.set(page, session);
  await session.goto(); await session.pauseReadyClock();
  await expect(quantity(page)).toHaveValue("1");
  await page.evaluate(key => Object.defineProperty(window, key, { value: "same-context" }), marker);
  return session;
}

async function selectWorkspace(page: Page, id: string) {
  await page.getByTestId("workspace-switcher").click();
  await page.getByTestId(`workspace-switcher-option-${id}`).click();
}

async function atWorkspace(page: Page, id: string, orderName: string) {
  await expect(page).toHaveURL(new RegExp(`/w/${id}/treatment`));
  await expect(quantity(page, orderName)).toBeVisible();
  await expect.poll(() => page.evaluate(key => Reflect.get(window, key), marker)).toBe("same-context");
}

async function persistedWorkspace(page: Page) {
  return page.evaluate(key => JSON.parse(sessionStorage.getItem(key) ?? localStorage.getItem(key) ?? "{}").currentWorkspaceId, SESSION_WORKSPACES_STORAGE_KEY);
}

function expectSave(save: HeldSave, id: string, patient: { encounterId: string; chartId: string; orderId: string }, etag: string, value: number) {
  expect(save.workspaceId).toBe(id);
  expect(save.input).toMatchObject({ encounterId: patient.encounterId, chartId: patient.chartId, expectedEtag: etag, rows: [{ orderId: patient.orderId, quantity: value }] });
  expect(save.headers[chartOrderExpectedEtagHeader.toLowerCase()]).toBe(etag);
  expect(save.headers["x-clair-demo-session-user-id"]).toBe("user-admin");
}

test.afterEach(async ({ page }, info) => {
  const s = sessions.get(page); if (!s) return;
  await info.attach("workspace-flush-request-evidence", {
    body: JSON.stringify({ requests: s.requests, saves: s.saves.map(save => ({ workspaceId: save.workspaceId, input: save.input, headers: save.headers })), events: s.saveEvents, ownerConcurrency: Object.fromEntries(s.maximumActiveSavesByOwner), unexpected: s.unexpected, pageErrors: s.pageErrors }, null, 2),
    contentType: "application/json",
  });
  s.assertNoUnexpectedTraffic();
  expect([...s.maximumActiveSavesByOwner.values()].every(value => value <= 1)).toBe(true);
});

test("repeated and different workspace clicks share the first flush and drain edits made while saving", async ({ page }) => {
  const s = await ready(page, true);
  await quantity(page).fill("2"); await page.clock.runFor(100);
  await selectWorkspace(page, workspaceBId);
  await expect.poll(() => s.saves.length).toBe(1);
  await quantity(page).fill("3");
  await selectWorkspace(page, workspaceBId);
  await selectWorkspace(page, workspaceCId);
  await page.clock.runFor(1400);
  await atWorkspace(page, workspaceId, patients.a.orderName);
  expect(await persistedWorkspace(page)).toBe(workspaceId);
  await expect(quantity(page)).toHaveValue("3"); expect(s.saves).toHaveLength(1);
  expectSave(s.saves[0], workspaceId, patients.a, etags.a0, 2);
  await s.saves[0].succeed(etags.a1);
  await expect.poll(() => s.saves.length).toBe(2);
  expectSave(s.saves[1], workspaceId, patients.a, etags.a1, 3);
  await atWorkspace(page, workspaceId, patients.a.orderName);
  await s.saves[1].succeed(etags.a2);
  await atWorkspace(page, workspaceBId, workspaceBPatients.a.orderName);
  expect(await persistedWorkspace(page)).toBe(workspaceBId);
  // The new chart selects its own first encounter after navigation. Old A
  // identifiers must be removed; B's own identifiers may be added normally.
  for (const [key, value] of [["patientId", "patient-a"], ["encounterId", patients.a.encounterId], ["chartId", patients.a.chartId]]) {
    expect(new URL(page.url()).searchParams.get(key)).not.toBe(value);
  }
  await selectWorkspace(page, workspaceId); await atWorkspace(page, workspaceId, patients.a.orderName);
  await expect(quantity(page)).toHaveValue("3");
  await expect(page.getByTestId("chart-order-footer")).toContainText("3,300");
  await page.clock.runFor(2100); expect(s.saves).toHaveLength(2);
});

test("503 preserves the current workspace and edit, and a new click retries before switching", async ({ page }) => {
  const s = await ready(page);
  await quantity(page).fill("2"); await selectWorkspace(page, workspaceBId);
  await expect.poll(() => s.saves.length).toBe(1);
  await s.saves[0].fail(503);
  await expect(status(page)).toHaveText(/실패/);
  await atWorkspace(page, workspaceId, patients.a.orderName);
  await expect(quantity(page)).toHaveValue("2");
  expect(await persistedWorkspace(page)).toBe(workspaceId);
  await selectWorkspace(page, workspaceBId);
  await expect.poll(() => s.saves.length).toBe(2);
  expectSave(s.saves[1], workspaceId, patients.a, etags.a0, 2);
  await atWorkspace(page, workspaceId, patients.a.orderName);
  await s.saves[1].succeed(etags.a1);
  await atWorkspace(page, workspaceBId, workspaceBPatients.a.orderName);
  await selectWorkspace(page, workspaceId); await atWorkspace(page, workspaceId, patients.a.orderName);
  await expect(quantity(page)).toHaveValue("2");
});

test("503 with a newer edit autosaves the new version without reviving the failed workspace request", async ({ page }) => {
  const s = await ready(page);
  await quantity(page).fill("2"); await page.clock.runFor(800);
  await expect.poll(() => s.saves.length).toBe(1);
  await quantity(page).fill("3"); await selectWorkspace(page, workspaceBId);
  await s.saves[0].fail(503);
  await atWorkspace(page, workspaceId, patients.a.orderName);
  await expect(quantity(page)).toHaveValue("3");
  await page.clock.runFor(800); await expect.poll(() => s.saves.length).toBe(2);
  expectSave(s.saves[1], workspaceId, patients.a, etags.a0, 3);
  await s.saves[1].succeed(etags.a1); await expect(status(page)).toHaveText("저장됨");
  await page.clock.runFor(1400); await atWorkspace(page, workspaceId, patients.a.orderName);
  expect(await persistedWorkspace(page)).toBe(workspaceId);
  await selectWorkspace(page, workspaceBId); await atWorkspace(page, workspaceBId, workspaceBPatients.a.orderName);
  expect(s.saves).toHaveLength(2);
});

test("409 blocks repeated workspace selection until explicit reload and saves a later edit with the fresh ETag", async ({ page }) => {
  const s = await ready(page);
  await quantity(page).fill("2"); await selectWorkspace(page, workspaceBId);
  await expect.poll(() => s.saves.length).toBe(1); await s.saves[0].fail(409);
  const conflict = page.getByTestId("chart-order-draft-conflict"); await expect(conflict).toBeVisible();
  await expect(quantity(page)).toHaveValue("2");
  await selectWorkspace(page, workspaceBId); await selectWorkspace(page, workspaceBId);
  await page.clock.runFor(2100); expect(s.saves).toHaveLength(1);
  await atWorkspace(page, workspaceId, patients.a.orderName); expect(await persistedWorkspace(page)).toBe(workspaceId);
  s.setServerRow("a", 4, etags.a2);
  await conflict.getByRole("button", { name: "서버 값 다시 불러오기", exact: true }).click();
  await expect(quantity(page)).toHaveValue("4"); await expect(status(page)).toHaveText("저장됨");
  await quantity(page).fill("5"); await selectWorkspace(page, workspaceBId);
  await expect.poll(() => s.saves.length).toBe(2); expectSave(s.saves[1], workspaceId, patients.a, etags.a2, 5);
  await s.saves[1].succeed(etags.a1); await atWorkspace(page, workspaceBId, workspaceBPatients.a.orderName);
  await selectWorkspace(page, workspaceId); await atWorkspace(page, workspaceId, patients.a.orderName);
  await expect(quantity(page)).toHaveValue("5");
});

test("rapid back-and-forth picks save each workspace's own edit and keep its ETag", async ({ page }) => {
  const s = await ready(page);
  await selectWorkspace(page, workspaceBId); await atWorkspace(page, workspaceBId, workspaceBPatients.a.orderName);
  await quantity(page, workspaceBPatients.a.orderName).fill("2"); await selectWorkspace(page, workspaceId);
  await expect.poll(() => s.saves.length).toBe(1); expectSave(s.saves[0], workspaceBId, workspaceBPatients.a, workspaceBEtags.a0, 2);
  await s.saves[0].succeed(workspaceBEtags.a1); await atWorkspace(page, workspaceId, patients.a.orderName);
  await quantity(page).fill("2"); await selectWorkspace(page, workspaceBId);
  await expect.poll(() => s.saves.length).toBe(2); expectSave(s.saves[1], workspaceId, patients.a, etags.a0, 2);
  await s.saves[1].succeed(etags.a1); await atWorkspace(page, workspaceBId, workspaceBPatients.a.orderName);
  await expect(quantity(page, workspaceBPatients.a.orderName)).toHaveValue("2");
  await selectWorkspace(page, workspaceId); await atWorkspace(page, workspaceId, patients.a.orderName);
  await expect(quantity(page)).toHaveValue("2"); expect(s.saves).toHaveLength(2);
});

test("a late old flush cannot navigate after a history scope change or unlock a new scope's pending selection", async ({ page }) => {
  const s = await ready(page, true);
  await selectWorkspace(page, workspaceCId); await atWorkspace(page, workspaceCId, workspaceCPatients.a.orderName);
  await selectWorkspace(page, workspaceId); await atWorkspace(page, workspaceId, patients.a.orderName);
  await quantity(page).fill("2"); await selectWorkspace(page, workspaceBId);
  await expect.poll(() => s.saves.length).toBe(1);
  await page.goBack(); await atWorkspace(page, workspaceCId, workspaceCPatients.a.orderName);
  await quantity(page, workspaceCPatients.a.orderName).fill("2"); await selectWorkspace(page, workspaceId);
  await expect.poll(() => s.saves.length).toBe(2); expectSave(s.saves[1], workspaceCId, workspaceCPatients.a, workspaceCEtags.a0, 2);
  await s.saves[0].succeed(etags.a1);
  await atWorkspace(page, workspaceCId, workspaceCPatients.a.orderName);
  await expect(status(page)).toHaveText("저장 중");
  await selectWorkspace(page, workspaceBId); await page.clock.runFor(1000);
  await atWorkspace(page, workspaceCId, workspaceCPatients.a.orderName); expect(s.saves).toHaveLength(2);
  await s.saves[1].succeed(workspaceCEtags.a1); await atWorkspace(page, workspaceId, patients.a.orderName);
  await expect(quantity(page)).toHaveValue("2");
  await page.clock.runFor(2100); expect(s.saves).toHaveLength(2);
});

for (const fails of [false, true]) {
  test(`existing dirty confirmation ${fails ? "keeps flags and edits on 503, then retries" : "waits for chart flush before clearing flags"}`, async ({ page }) => {
    const s = await ready(page);
    await quantity(page).fill("2");
    await page.evaluate(() => window.__clairSetNotificationNavigationDirty?.(true));
    await selectWorkspace(page, workspaceBId);
    const dialog = page.getByRole("dialog", { name: "워크스페이스를 전환할까요?" });
    await expect(dialog).toBeVisible(); expect(s.saves).toHaveLength(0);
    await dialog.getByRole("button", { name: "저장하지 않고 전환", exact: true }).click();
    await expect.poll(() => s.saves.length).toBe(1);
    expect(await persistedWorkspace(page)).toBe(workspaceId);
    if (fails) {
      await s.saves[0].fail(503); await expect(status(page)).toHaveText(/실패/);
      await expect(dialog).toBeVisible(); await expect(page).toHaveURL(new RegExp(`/w/${workspaceId}/treatment`));
      await dialog.getByRole("button", { name: "계속 작성", exact: true }).click();
      await expect(quantity(page)).toHaveValue("2");
      await selectWorkspace(page, workspaceBId); await expect(dialog).toBeVisible(); expect(s.saves).toHaveLength(1);
      await dialog.getByRole("button", { name: "저장하지 않고 전환", exact: true }).click();
      await expect.poll(() => s.saves.length).toBe(2); expectSave(s.saves[1], workspaceId, patients.a, etags.a0, 2);
    }
    await s.saves.at(-1)!.succeed(etags.a1);
    await atWorkspace(page, workspaceBId, workspaceBPatients.a.orderName);
    await selectWorkspace(page, workspaceId); await atWorkspace(page, workspaceId, patients.a.orderName);
    await expect(quantity(page)).toHaveValue("2");
  });
}

for (const selectsAgain of [false, true]) {
  test(`canceling a confirmed workspace switch while saving ${selectsAgain ? "allows only the newly confirmed target to navigate" : "keeps the current workspace after the save finishes"}`, async ({ page }) => {
    const s = await ready(page, true);
    await quantity(page).fill("2");
    await page.evaluate(() => window.__clairSetNotificationNavigationDirty?.(true));
    await selectWorkspace(page, workspaceBId);
    const dialog = page.getByRole("dialog", { name: "워크스페이스를 전환할까요?" });
    await dialog.getByRole("button", { name: "저장하지 않고 전환", exact: true }).click();
    await expect.poll(() => s.saves.length).toBe(1);
    await dialog.getByRole("button", { name: "계속 작성", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    if (selectsAgain) {
      await selectWorkspace(page, workspaceCId);
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: "저장하지 않고 전환", exact: true }).click();
    }
    await page.clock.runFor(1000); expect(s.saves).toHaveLength(1);
    await s.saves[0].succeed(etags.a1);
    await expect(status(page)).toHaveText("저장됨");
    await page.clock.runFor(1400);
    if (selectsAgain) {
      await atWorkspace(page, workspaceCId, workspaceCPatients.a.orderName);
      expect(await persistedWorkspace(page)).toBe(workspaceCId);
      await selectWorkspace(page, workspaceId); await atWorkspace(page, workspaceId, patients.a.orderName);
    } else {
      await atWorkspace(page, workspaceId, patients.a.orderName);
      expect(await persistedWorkspace(page)).toBe(workspaceId);
      await expect(dialog).toHaveCount(0);
      await selectWorkspace(page, workspaceBId); await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: "계속 작성", exact: true }).click();
    }
    await expect(quantity(page)).toHaveValue("2"); expect(s.saves).toHaveLength(1);
  });
}
