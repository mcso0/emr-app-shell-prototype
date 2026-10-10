import { expect, test, type Page } from "@playwright/test";
import { demoSessionUserIdHeader } from "../src/features/auth/demo-actor";
import { chartOrderExpectedEtagHeader } from "../src/features/chart/order-version-contract";
import {
  etags, installChartSaveSession, patients, workspaceId,
  workspaceBEtags, workspaceBId, workspaceBPatients, type HeldSave,
} from "./fixtures/chart-order-save-session";

type Session = Awaited<ReturnType<typeof installChartSaveSession>>;
const sessions = new WeakMap<Page, { session: Session; observations: unknown[] }>();
const quantity = (page: Page, name: string) => page.getByLabel(`${name} 수량 수정`, { exact: true });
const patientButton = (page: Page, name: string) => page.getByRole("button", { name: new RegExp(name) }).first();
const status = (page: Page) => page.getByTestId("chart-order-save-status");
const footer = (page: Page) => page.getByTestId("chart-order-footer");
const markerKey = "__syntheticWorkspaceSaveContext";

async function ready(page: Page) {
  const session = await installChartSaveSession(page, { includeSecondWorkspace: true });
  sessions.set(page, { session, observations: [] });
  await session.goto();
  await session.pauseReadyClock();
  await expect(quantity(page, patients.a.orderName)).toHaveValue("1");
  await page.evaluate(key => Object.defineProperty(window, key, { value: "same-js-context" }), markerKey);
  return session;
}

async function switchWorkspace(page: Page, id: string, orderName: string) {
  await page.getByTestId("workspace-switcher").click();
  await page.getByTestId(`workspace-switcher-option-${id}`).click();
  await expect(page).toHaveURL(new RegExp(`/w/${id}/treatment`));
  await expect(quantity(page, orderName)).toBeVisible();
  await expect.poll(() => page.evaluate(key => Reflect.get(window, key), markerKey)).toBe("same-js-context");
}

async function observe(page: Page, stage: string, orderName: string) {
  const entry = sessions.get(page);
  if (!entry) throw new Error("Synthetic session was not installed");
  const input = quantity(page, orderName);
  entry.observations.push({
    stage, url: new URL(page.url()).pathname,
    quantity: await input.count() ? await input.inputValue() : null,
    saveStatus: await status(page).count() ? await status(page).innerText() : null,
    footer: await footer(page).count() ? await footer(page).innerText() : null,
    errorCount: await page.getByTestId("chart-order-state-error").count(),
    conflictCount: await page.getByTestId("chart-order-draft-conflict").count(),
    sameContext: await page.evaluate(key => Reflect.get(window, key), markerKey),
  });
}

function expectSave(save: HeldSave, id: string, patient: typeof patients.a | typeof workspaceBPatients.a | typeof workspaceBPatients.b, etag: string, value: number) {
  expect(save.workspaceId).toBe(id);
  expect(save.input).toMatchObject({
    encounterId: patient.encounterId, chartId: patient.chartId, expectedEtag: etag,
    rows: [{ orderId: patient.orderId, quantity: value }],
  });
  expect(save.headers[chartOrderExpectedEtagHeader.toLowerCase()]).toBe(etag);
  expect(save.headers[demoSessionUserIdHeader]).toBe("user-admin");
  expect(save.headers["if-match"]).toBeUndefined();
}

test.afterEach(async ({ page }, testInfo) => {
  const entry = sessions.get(page);
  if (!entry) return;
  const { session, observations } = entry;
  await testInfo.attach("workspace-save-synthetic-evidence", {
    body: JSON.stringify({
      observations, requests: session.requests,
      saves: session.saves.map(save => ({ workspaceId: save.workspaceId, ownerKey: save.ownerKey, input: save.input, headers: save.headers })),
      saveEvents: session.saveEvents, scopedReadDenials: session.scopedReadDenials, maximumActiveSaves: session.maximumActiveSaves,
      maximumActiveSavesByOwner: Object.fromEntries(session.maximumActiveSavesByOwner),
      unexpected: session.unexpected, pageErrors: session.pageErrors,
    }, null, 2),
    contentType: "application/json",
  });
  session.assertNoUnexpectedTraffic();
});

test("workspace switch before debounce must not silently lose A's pending edit", async ({ page }) => {
  const session = await ready(page);
  await quantity(page, patients.a.orderName).fill("2");
  await page.clock.runFor(100);
  await observe(page, "A-edited-before-debounce", patients.a.orderName);
  await page.getByTestId("workspace-switcher").click();
  await page.getByTestId(`workspace-switcher-option-${workspaceBId}`).click();
  await expect.poll(() => session.saves.length).toBe(1);
  expectSave(session.saves[0], workspaceId, patients.a, etags.a0, 2);
  await expect(page).toHaveURL(new RegExp(`/w/${workspaceId}/treatment`));
  await expect(quantity(page, patients.a.orderName)).toHaveValue("2");
  await session.saves[0].succeed(etags.a1);
  await expect(page).toHaveURL(new RegExp(`/w/${workspaceBId}/treatment`));
  await expect(quantity(page, workspaceBPatients.a.orderName)).toHaveValue("1");
  await expect(status(page)).toHaveText("저장됨");
  await page.clock.runFor(1400);
  await observe(page, "B-after-A-timer-deadline", workspaceBPatients.a.orderName);
  expect(session.saves).toHaveLength(1);
  await expect(quantity(page, workspaceBPatients.a.orderName)).toHaveValue("1");
  await switchWorkspace(page, workspaceId, patients.a.orderName);
  await expect(status(page)).toHaveText("저장됨");
  await observe(page, "A-returned-after-unmount", patients.a.orderName);
  await expect(quantity(page, patients.a.orderName)).toHaveValue("2");
});

for (const outcome of [200, 503, 409] as const) {
  test(`workspace late A ${outcome} preserves B edits, pending flush, billing and ETags`, async ({ page }) => {
    const session = await ready(page);
    // Browser history is a separate navigation boundary. The picker now waits
    // for A, so use real SPA history to preserve the late-owner regression.
    await switchWorkspace(page, workspaceBId, workspaceBPatients.a.orderName);
    await switchWorkspace(page, workspaceId, patients.a.orderName);
    await quantity(page, patients.a.orderName).fill("2");
    await page.clock.runFor(800);
    await expect.poll(() => session.saves.length).toBe(1);
    expectSave(session.saves[0], workspaceId, patients.a, etags.a0, 2);

    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`/w/${workspaceBId}/treatment`));
    await expect(quantity(page, workspaceBPatients.a.orderName)).toBeVisible();
    await expect.poll(() => page.evaluate(key => Reflect.get(window, key), markerKey)).toBe("same-js-context");
    await expect(status(page)).toHaveText("저장됨");
    await expect(footer(page)).toContainText("2,300");
    await quantity(page, workspaceBPatients.a.orderName).fill("2");
    await page.clock.runFor(800);
    await expect.poll(() => session.saves.length).toBe(2);
    expectSave(session.saves[1], workspaceBId, workspaceBPatients.a, workspaceBEtags.a0, 2);
    await quantity(page, workspaceBPatients.a.orderName).fill("3");
    await patientButton(page, workspaceBPatients.b.name).click();
    await expect(patientButton(page, workspaceBPatients.a.name)).toHaveAttribute("aria-pressed", "true");
    await expect(status(page)).toHaveText("저장 중");
    const billingBeforeA = await footer(page).innerText();
    await observe(page, "B-pending-before-late-A", workspaceBPatients.a.orderName);

    const lateResponse = page.waitForResponse(response => response.request().method() === "PATCH" &&
      new URL(response.url()).pathname === `/api/workspaces/${workspaceId}/chart/order-drafts`);
    if (outcome === 200) await session.saves[0].succeed(etags.a1);
    else await session.saves[0].fail(outcome);
    await (await lateResponse).finished();
    await page.clock.runFor(50);
    await observe(page, `B-after-late-A-${outcome}`, workspaceBPatients.a.orderName);
    await expect(quantity(page, workspaceBPatients.a.orderName)).toHaveValue("3");
    await expect(status(page)).toHaveText("저장 중");
    await expect(footer(page)).toHaveText(billingBeforeA, { useInnerText: true });
    await expect(page.getByTestId("chart-order-state-error")).toHaveCount(0);
    await expect(page.getByTestId("chart-order-draft-conflict")).toHaveCount(0);
    await expect(patientButton(page, workspaceBPatients.a.name)).toHaveAttribute("aria-pressed", "true");
    await expect(quantity(page, workspaceBPatients.b.orderName)).toHaveCount(0);
    expect(session.saves).toHaveLength(2);
    expect(session.maximumActiveSaves).toBe(2);

    await session.saves[1].succeed(workspaceBEtags.a1);
    await expect.poll(() => session.saves.length).toBe(3);
    expectSave(session.saves[2], workspaceBId, workspaceBPatients.a, workspaceBEtags.a1, 3);
    await expect(patientButton(page, workspaceBPatients.a.name)).toHaveAttribute("aria-pressed", "true");
    await session.saves[2].succeed(workspaceBEtags.a2);
    await expect(quantity(page, workspaceBPatients.b.orderName)).toHaveValue("1");
    await expect(patientButton(page, workspaceBPatients.b.name)).toHaveAttribute("aria-pressed", "true");
    await expect(status(page)).toHaveText("저장됨");
    await expect(footer(page)).toContainText("9,900");
    await observe(page, "B-flush-drained-and-patient-switched", workspaceBPatients.b.orderName);

    await quantity(page, workspaceBPatients.b.orderName).fill("2");
    await page.clock.runFor(800);
    await expect.poll(() => session.saves.length).toBe(4);
    expectSave(session.saves[3], workspaceBId, workspaceBPatients.b, workspaceBEtags.b0, 2);
    await session.saves[3].succeed(workspaceBEtags.b1);
    await expect(status(page)).toHaveText("저장됨");
    await page.clock.runFor(2100);
    expect(session.saves).toHaveLength(4);
    expect([...session.maximumActiveSavesByOwner.values()]).toEqual([1, 1, 1]);
    await expect.poll(() => page.evaluate(key => Reflect.get(window, key), markerKey)).toBe("same-js-context");
    await observe(page, "B-follow-up-save-completed", workspaceBPatients.b.orderName);
  });
}
