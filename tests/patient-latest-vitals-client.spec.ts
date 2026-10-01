import { expect, test, type Page } from "@playwright/test";
import { build } from "esbuild";
import path from "node:path";
import { createDefaultWorkspaceVitalSettingsSnapshot } from "../src/features/patient-vitals/workspace-vital-settings";

let bundle: string;
test.beforeAll(async () => {
  const result = await build({ entryPoints: [path.resolve("tests/fixtures/patient-latest-vitals/harness.tsx")], bundle: true, write: false, format: "iife", platform: "browser", jsx: "automatic", alias: { "@/features/auth/session-store": path.resolve("tests/fixtures/patient-latest-vitals/auth.ts"), "@/lib/supabase/config": path.resolve("tests/fixtures/patient-latest-vitals/auth.ts"), "@/lib/supabase/client": path.resolve("tests/fixtures/patient-latest-vitals/auth.ts"), "@": path.resolve("src") } });
  bundle = result.outputFiles[0].text;
});
const vital = (weightKg = 4) => ({ id: "latest-row", patientId: "synthetic-patient-a", encounterId: "encounter-a", measuredAt: "2026-10-01T00:00:00Z", weightKg });
const body = (weightKg = 4) => ({ ok: true, status: 200, canWriteVitals: true, vital: vital(weightKg), summary: { values: { weightKg, temperatureC: 38.5 }, measuredAtByField: { weightKg: "2026-10-01T00:00:00Z", temperatureC: "2026-09-30T00:00:00Z" } } });
async function state(page: Page, name = "soap") { return JSON.parse(await page.getByTestId(name).getByTestId("state").innerText()); }
async function mount(page: Page, read: (url: URL, index: number) => Promise<unknown> | unknown = () => body(), options: { ignoreAbort?: boolean; settingsStatus?: number; saveVital?: unknown; settings?: ReturnType<typeof createDefaultWorkspaceVitalSettingsSnapshot>; live?: boolean; delayAuth?: boolean } = {}) {
  let reads = 0;
  let settingsReads = 0;
  if (options.live) await page.addInitScript(delayAuth => Object.assign(window, { syntheticLive: true, syntheticDelayAuth: delayAuth }), options.delayAuth ?? false);
  if (options.ignoreAbort) await page.addInitScript(() => { const original = window.fetch; window.fetch = (input, init) => original(input, { ...init, signal: undefined }); });
  await page.route("http://vitals.test/**", async route => {
    const url = route.request().url();
    if (url.includes("/patient-vitals/latest")) { reads++; await route.fulfill({ json: await read(new URL(url), reads) }); }
    else if (url.endsWith("/vital-settings")) { settingsReads++; await route.fulfill({ status: options.settingsStatus ?? 200, json: options.settings ?? createDefaultWorkspaceVitalSettingsSnapshot(false) }); }
    else if (url.endsWith("/synthetic-save")) await route.fulfill({ json: await (options.saveVital ?? vital(7)) });
    else await route.fulfill({ contentType: "text/html", body: '<div id="root"></div>' });
  });
  await page.goto("http://vitals.test/");
  await page.addScriptTag({ content: bundle });
  return { reads: () => reads, settingsReads: () => settingsReads };
}
test("header save updates SOAP insert without navigation", async ({ page }) => {
  let saved = false;
  await mount(page, () => body(saved ? 7 : 4));
  await expect.poll(async () => (await state(page)).status).toBe("ready");
  saved = true;
  await page.getByTestId("header").getByText("Save", { exact: true }).click();
  await expect(page.getByTestId("header").getByTestId("feedback")).toHaveText("saved");
  await page.getByTestId("soap").getByText("Insert", { exact: true }).click();
  await expect(page.getByTestId("soap").getByTestId("inserted")).toContainText("7.00 kg");
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
async function changeScope(page: Page, scope: { workspaceId: string; encounterId?: string; actor: string; headers?: Record<string, string> }) {
  await page.evaluate(scope => (window as unknown as { changeScope: (scope: unknown) => void }).changeScope(scope), scope);
}
const scopeA = { workspaceId: "workspace-a", encounterId: "encounter-a", actor: "account-a" };

test("two consumers and StrictMode share one latest and settings read", async ({ page }) => {
  const counts = await mount(page);
  await expect.poll(async () => (await state(page)).settingsStatus).toBe("ready");
  await expect.poll(async () => (await state(page)).status).toBe("ready");
  expect(counts.reads()).toBe(1);
  expect(counts.settingsReads()).toBe(1);
});

test("old-row correction rereads latest-per-field summary and retains newer row", async ({ page }) => {
  const oldRow = { ...vital(1), id: "old-row", measuredAt: "2026-09-01T00:00:00Z" };
  await mount(page, () => body(9), { saveVital: oldRow });
  await expect.poll(async () => (await state(page)).status).toBe("ready");
  await page.getByTestId("header").getByText("Save", { exact: true }).click();
  await expect(page.getByTestId("header").getByTestId("feedback")).toHaveText("saved");
  await page.getByTestId("soap").getByText("Insert", { exact: true }).click();
  await expect(page.getByTestId("soap").getByTestId("inserted")).toHaveText("체중: 9.00 kg\n체온: 38.5°C");
  expect((await state(page)).vital.id).toBe("latest-row");
});

test("post-save loading blocks insertion; late pre-save response cannot win even ignoring abort", async ({ page }) => {
  const slow = deferred<unknown>();
  const counts = await mount(page, (_, index) => index === 1 ? slow.promise : body(7), { ignoreAbort: true });
  await expect.poll(counts.reads).toBe(1);
  await page.getByTestId("header").getByText("Save", { exact: true }).click();
  await expect(page.getByTestId("header").getByTestId("feedback")).toHaveText("saved");
  const oldResponse = page.waitForResponse(response => response.url().includes("/patient-vitals/latest"));
  slow.resolve(body(4));
  await expect.poll(async () => (await state(page)).text).toContain("7.00 kg");
  // Wait for the stale response to be consumed, then recheck its generation guard.
  await oldResponse;
  expect((await state(page)).text).toContain("7.00 kg");
});

test("slow refresh disables SOAP and write permission until authoritative read completes", async ({ page }) => {
  const slow = deferred<unknown>();
  const counts = await mount(page, (_, index) => index === 1 ? body() : slow.promise);
  await expect.poll(async () => (await state(page)).status).toBe("ready");
  await page.getByTestId("header").getByText("Save", { exact: true }).click();
  await expect.poll(counts.reads).toBe(2);
  await expect(page.getByTestId("soap").getByText("Insert", { exact: true })).toBeDisabled();
  expect((await state(page)).canWrite).toBe(false);
  slow.resolve(body(7));
  await expect(page.getByTestId("header").getByTestId("feedback")).toHaveText("saved");
  await expect(page.getByTestId("soap").getByText("Insert", { exact: true })).toBeEnabled();
});

test("refresh failure hides stale SOAP insertion and propagates saved-but-refresh-failed feedback", async ({ page }) => {
  await mount(page, (_, index) => index === 1 ? body() : { ok: false, status: 403 });
  await expect.poll(async () => (await state(page)).status).toBe("ready");
  await page.getByTestId("header").getByText("Save", { exact: true }).click();
  await expect(page.getByTestId("header").getByTestId("feedback")).toHaveText("refresh-failed");
  await expect.poll(async () => (await state(page)).status).toBe("error");
  expect((await state(page)).canWrite).toBe(false);
  await expect(page.getByTestId("soap").getByText("Insert", { exact: true })).toBeDisabled();
});

test("rapid patient/encounter/workspace switches discard delayed old scope", async ({ page }) => {
  const slow = deferred<unknown>();
  const counts = await mount(page, (url, index) => index === 1 ? slow.promise : { ...body(12), vital: { ...vital(12), encounterId: url.searchParams.get("encounterId"), patientId: "synthetic-patient-b" } }, { ignoreAbort: true });
  await expect.poll(counts.reads).toBe(1);
  await changeScope(page, { ...scopeA, encounterId: "encounter-b" });
  await expect.poll(counts.reads).toBe(2);
  await changeScope(page, { ...scopeA, workspaceId: "workspace-b", encounterId: "encounter-c" });
  await expect.poll(async () => (await state(page)).vital?.encounterId).toBe("encounter-c");
  const oldResponse = page.waitForResponse(response => response.url().includes("encounterId=encounter-a"));
  slow.resolve(body());
  await oldResponse;
  expect((await state(page)).vital.patientId).toBe("synthetic-patient-b");
  expect((await state(page)).vital.encounterId).toBe("encounter-c");
});

test("cookie-account switch rejects delayed old actor", async ({ page }) => {
  const slow = deferred<unknown>();
  const counts = await mount(page, (_, index) => index === 1 ? slow.promise : { ...body(2), canWriteVitals: false }, { ignoreAbort: true, live: true });
  await expect.poll(counts.reads).toBe(1);
  await changeScope(page, { ...scopeA, actor: "account-b" });
  await expect.poll(counts.reads).toBe(2);
  await expect.poll(async () => (await state(page)).status).toBe("ready");
  const oldResponse = page.waitForResponse(response => response.url().includes("/patient-vitals/latest"));
  slow.resolve(body(99));
  await oldResponse;
  expect((await state(page)).text).toContain("2.00 kg");
  expect((await state(page)).canWrite).toBe(false);
});

test("same encounter different actor headers triggers a fresh scoped read; equivalent headers deduplicate", async ({ page }) => {
  const counts = await mount(page);
  await expect.poll(async () => (await state(page)).status).toBe("ready");
  await changeScope(page, { ...scopeA, headers: { "x-clair-demo-session-user-id": "synthetic-vet", "x-clair-demo-client-session-id": "synthetic-client" } });
  await expect.poll(counts.reads).toBe(2);
  await expect.poll(async () => (await state(page)).status).toBe("ready");
  await changeScope(page, { ...scopeA, headers: { "X-CLAIR-DEMO-CLIENT-SESSION-ID": "synthetic-client", "X-CLAIR-DEMO-SESSION-USER-ID": "synthetic-vet" } });
  await expect.poll(async () => (await state(page)).status).toBe("ready");
  expect(counts.reads()).toBe(2);
});

test("unmount releases cache; returning to same account rechecks permission", async ({ page }) => {
  const counts = await mount(page, (_, index) => ({ ...body(), canWriteVitals: index === 1 }));
  await expect.poll(async () => (await state(page)).canWrite).toBe(true);
  await page.evaluate(() => (window as unknown as { setMounted: (value: boolean) => void }).setMounted(false));
  await expect(page.getByTestId("soap")).toHaveCount(0);
  await page.evaluate(() => (window as unknown as { setMounted: (value: boolean) => void }).setMounted(true));
  await expect.poll(counts.reads).toBe(2);
  await expect.poll(async () => (await state(page)).status).toBe("ready");
  expect((await state(page)).canWrite).toBe(false);
});

test("empty measurements and denied settings retain distinct states", async ({ page }) => {
  await mount(page, () => ({ ok: true, status: 200, canWriteVitals: false, vital: null }), { settingsStatus: 403 });
  await expect.poll(async () => (await state(page)).status).toBe("ready");
  await expect.poll(async () => (await state(page)).settingsStatus).toBe("denied");
  expect((await state(page)).text).toBe("");
  await expect(page.getByTestId("soap").getByText("Insert", { exact: true })).toBeDisabled();
});

async function emitAuth(page: Page, event: string, actor: string | null) {
  await page.evaluate(({ event, actor }) => (window as unknown as { emitAuth: (event: string, actor: string | null) => void }).emitAuth(event, actor), { event, actor });
}

test("live auth waits for INITIAL_SESSION, shares reads, and token refresh does not refetch", async ({ page }) => {
  const counts = await mount(page, () => body(), { live: true, delayAuth: true });
  await expect(page.getByTestId("soap").getByTestId("state")).toBeVisible();
  expect(counts.reads()).toBe(0);
  expect(counts.settingsReads()).toBe(0);
  await emitAuth(page, "INITIAL_SESSION", "account-a");
  await expect.poll(async () => (await state(page)).status).toBe("ready");
  expect(counts.reads()).toBe(1);
  expect(counts.settingsReads()).toBe(1);
  await emitAuth(page, "TOKEN_REFRESHED", "account-a");
  await emitAuth(page, "SIGNED_IN", "account-a");
  expect(counts.reads()).toBe(1);
});

test("account change hides previous ready data and permissions while next read is pending", async ({ page }) => {
  const slow = deferred<unknown>();
  const counts = await mount(page, (_, index) => index === 1 ? body(99) : slow.promise, { live: true });
  await expect.poll(async () => (await state(page)).status).toBe("ready");
  await emitAuth(page, "SIGNED_IN", "account-b");
  await expect.poll(counts.reads).toBe(2);
  expect(await state(page)).toMatchObject({ status: "loading", text: "", canWrite: false, vital: null });
  slow.resolve({ ...body(2), canWriteVitals: false });
  await expect.poll(async () => (await state(page)).status).toBe("ready");
  expect((await state(page)).canWrite).toBe(false);
});

test("sign-out and same-account sign-in invalidates cached permission, even when batched", async ({ page }) => {
  const counts = await mount(page, (_, index) => ({ ...body(), canWriteVitals: index === 1 }), { live: true });
  await expect.poll(async () => (await state(page)).canWrite).toBe(true);
  await page.evaluate(() => {
    const emit = (window as unknown as { emitAuth: (event: string, actor: string | null) => void }).emitAuth;
    emit("SIGNED_OUT", null); emit("SIGNED_IN", "account-a");
  });
  await expect.poll(counts.reads).toBe(2);
  await expect.poll(async () => (await state(page)).status).toBe("ready");
  expect((await state(page)).canWrite).toBe(false);
});

test("overlapping post-save reads accept only the newest completed response", async ({ page }) => {
  const older = deferred<unknown>();
  const counts = await mount(page, (_, index) => index === 1 ? body() : index === 2 ? older.promise : body(8), { ignoreAbort: true });
  await expect.poll(async () => (await state(page)).status).toBe("ready");
  await page.getByTestId("header").getByText("Save", { exact: true }).click();
  await expect.poll(counts.reads).toBe(2);
  await page.getByTestId("soap").getByText("Save", { exact: true }).click();
  await expect(page.getByTestId("soap").getByTestId("feedback")).toHaveText("saved");
  const olderResponse = page.waitForResponse(response => response.url().includes("/patient-vitals/latest"));
  older.resolve(body(6)); await olderResponse;
  expect((await state(page)).text).toContain("8.00 kg");
});

test("workspace settings preserve custom order, units and disabled fields after save", async ({ page }) => {
  const settings = createDefaultWorkspaceVitalSettingsSnapshot(false);
  settings.items = settings.items.map(item => ({ ...item, enabled: item.key === "weight" || item.key === "temperature", displayUnit: item.key === "weight" ? "g" : item.key === "temperature" ? "°F" : item.displayUnit, sortOrder: item.key === "temperature" ? 0 : item.key === "weight" ? 1 : item.sortOrder }));
  await mount(page, () => body(9), { settings });
  await expect.poll(async () => (await state(page)).settingsStatus).toBe("ready");
  await page.getByTestId("header").getByText("Save", { exact: true }).click();
  await expect(page.getByTestId("header").getByTestId("feedback")).toHaveText("saved");
  expect((await state(page)).text).toBe("체온: 101.3°F\n체중: 9000 g");
});


test("a save completing after selection change does not refetch or revive the old scope", async ({ page }) => {
  const slowSave = deferred<unknown>();
  const counts = await mount(page, url => ({ ...body(5), vital: { ...vital(5), encounterId: url.searchParams.get("encounterId") } }), { saveVital: slowSave.promise });
  await expect.poll(async () => (await state(page)).status).toBe("ready");
  await page.getByTestId("header").getByText("Save", { exact: true }).click();
  await changeScope(page, { ...scopeA, encounterId: "encounter-b" });
  await expect.poll(async () => (await state(page)).vital?.encounterId).toBe("encounter-b");
  expect(counts.reads()).toBe(2);
  slowSave.resolve(vital(7));
  await expect(page.getByTestId("header").getByTestId("feedback")).toHaveText("saved");
  expect(counts.reads()).toBe(2);
  expect((await state(page)).vital.encounterId).toBe("encounter-b");
});
