import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { defaultNotificationPreferences } from "../src/features/notifications/notification-preferences";

let server: ChildProcess;
let origin: string;
test.beforeAll(async () => {
  server = spawn(process.execPath, ["tests/fixtures/notification-sharing-server.mjs"], { stdio: ["ignore", "pipe", "pipe"] });
  origin = await new Promise<string>((resolve, reject) => {
    let output = "";
    const timer = setTimeout(() => reject(new Error(`Harness startup failed: ${output}`)), 30_000);
    server.stdout!.on("data", chunk => { output += chunk; const match = output.match(/NOTIFICATION_HARNESS_URL=(http:\/\/127\.0\.0\.1:\d+)/); if (match) { clearTimeout(timer); resolve(match[1]); } });
    server.stderr!.on("data", chunk => { output += chunk; });
    server.once("exit", () => { clearTimeout(timer); reject(new Error(`Harness exited: ${output}`)); });
  });
});
test.afterAll(() => { server?.kill("SIGTERM"); });
const row = (id = "synthetic-one", priority = "normal", updatedAt = "2026-10-20T00:00:00Z") => ({
  id, eventKey: "order_recheck_requested", dedupeKey: id, domain: "lab", priority,
  requiresAction: true, badgeCount: true, toastPolicy: "immediate", title: id, preview: "합성 알림", detail: "합성 상세",
  workTypeLabel: "합성 검사", sourceLabel: "합성 원본", sourceActionLabel: "원본 열기", sourceKind: "lab_result", sourceEntityId: "synthetic-source",
  sourceRoute: "/w/synthetic-alpha/reception", recipientKind: "user", recipientId: "synthetic-user", recipientLabel: "합성 계정",
  issuedAtLabel: "방금", createdAt: updatedAt, updatedAt, readAt: null as string | null, archivedAt: null as string | null,
});
async function install(context: BrowserContext) {
  const requests: { login: string; workspace: string; method: string; window: string; at: number; settled: boolean }[] = [];
  const errors: string[] = [];
  const control = { status: 200, rows: [row()], pauseGet: undefined as Promise<void> | undefined, pausePost: undefined as Promise<void> | undefined, failPost: false, scope: true };
  context.on("page", page => page.on("pageerror", error => errors.push(error.message)));
  await context.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) { errors.push(`Blocked external request: ${url.origin}${url.pathname}`); await route.abort(); return; }
    if (url.pathname.endsWith("/notification-preferences")) { await route.fulfill({ json: { ok: true, preferences: defaultNotificationPreferences() } }); return; }
    if (!/^\/api\/workspaces\/[^/]+\/notifications(?:\/|$)/.test(url.pathname)) { await route.continue(); return; }
    const login = route.request().headers()["x-synthetic-login"] ?? "login-a";
    const workspace = url.pathname.split("/")[3];
    const method = route.request().method();
    const record = { login, workspace, method, window: route.request().headers()["x-synthetic-window"] ?? "", at: Date.now(), settled: false };
    requests.push(record);
    // Capture the response before delaying it, so stale-response tests are real.
    const rows = structuredClone(control.rows);
    if (method === "POST") {
      if (control.pausePost) await control.pausePost;
      if (control.failPost) { await route.fulfill({ status: 503, json: { ok: false, error: { message: "합성 저장 실패" } } }); return; }
      const action = url.pathname.split("/").at(-1);
      for (const item of control.rows) {
        item.readAt = "2026-10-20T00:01:00Z";
        if (action === "archive") item.archivedAt = item.readAt;
        if (action === "restore") item.archivedAt = null;
      }
    } else if (control.pauseGet) await control.pauseGet;
    const source = method === "GET" ? rows : control.rows;
    const unread = source.filter(item => !item.readAt && !item.archivedAt).length;
    const counts = { badge: unread, unread, important: unread, archived: source.filter(item => item.archivedAt).length };
    if (control.status !== 200) { await route.fulfill({ status: control.status, json: { ok: false, error: { message: "합성 접근 거부" } } }); return; }
    await route.fulfill({ json: { ok: true, status: 200, workspaceId: workspace, notifications: source, counts,
      ...(control.scope ? { sharingScope: createHash("sha256").update(`${workspace}:${login}`).digest("hex") } : {}), nextCursor: null } });
    record.settled = true;
  });
  return { control, requests, errors };
}
async function open(context: BrowserContext, query = "") {
  const page = await context.newPage();
  await page.goto(`${origin}/tests/fixtures/notification-sharing-harness.html${query}`);
  await expect(page.getByTestId("state")).toContainText('"requestState":"ready"');
  return page;
}
const state = (page: Page) => page.getByTestId("state");

test("two actual hook callers share one 30-second poll while each preserves backlog/toast ownership", async ({ context }) => {
  test.setTimeout(100_000);
  const { control, requests, errors } = await install(context);
  control.rows.push(row("synthetic-urgent", "urgent"));
  const first = await open(context); const second = await open(context);
  for (const page of [first, second]) {
    await expect(page.getByTestId("global-notification-toast-synthetic-one")).toHaveCount(0);
    await expect(page.getByTestId("global-notification-toast-synthetic-urgent")).toBeVisible();
  }
  const bootstrap = requests.length;
  await first.waitForTimeout(62_000);
  await test.info().attach("poll-traffic", { body: JSON.stringify({ bootstrap, requests }), contentType: "application/json" });
  expect(requests.length - bootstrap).toBe(2);
  control.rows.push(row("synthetic-arriving", "normal", "2026-10-20T00:02:00Z"));
  await first.getByRole("button", { name: "Focus", exact: true }).click();
  for (const page of [first, second]) await expect(page.getByTestId("global-notification-toast-synthetic-arriving")).toBeVisible();
  await second.getByTestId("global-notification-toast-synthetic-arriving").getByRole("button", { name: "닫기" }).click();
  await expect(first.getByTestId("global-notification-toast-synthetic-arriving")).toBeVisible();
  expect(errors).toEqual([]);
});

test("read/archive/restore/read-all synchronize global counts across two callers and failures remain errors", async ({ context }) => {
  const { control, errors } = await install(context);
  const first = await open(context); const second = await open(context);
  await second.getByRole("button", { name: "Read", exact: true }).click();
  for (const page of [first, second]) await expect(state(page)).toContainText('"unread":0');
  await second.getByRole("button", { name: "Archive", exact: true }).click();
  for (const page of [first, second]) await expect(state(page)).toContainText('"archived":1');
  await first.getByRole("button", { name: "Restore", exact: true }).click();
  for (const page of [first, second]) await expect(state(page)).toContainText('"archived":0');
  control.failPost = true;
  await first.getByRole("button", { name: "Read all", exact: true }).click();
  await expect(state(first)).toContainText('"requestState":"error"');
  await expect(state(first)).toContainText("synthetic-one");
  await expect(state(first)).toContainText('"archived":0');
  control.failPost = false;
  await first.getByRole("button", { name: "Retry", exact: true }).click();
  await first.getByRole("button", { name: "Read all", exact: true }).click();
  await expect(state(first)).toContainText('"requestState":"ready"');
  expect(errors).toEqual([]);
});

test("logout clears both windows and a late GET cannot restore protected state", async ({ context }) => {
  const { control, requests, errors } = await install(context);
  const first = await open(context); const second = await open(context);
  let release!: () => void;
  control.pauseGet = new Promise<void>(resolve => { release = resolve; });
  await first.getByRole("button", { name: "Focus", exact: true }).click();
  await expect.poll(() => requests.length).toBeGreaterThan(2);
  await second.getByRole("button", { name: "Logout", exact: true }).click();
  for (const page of [first, second]) await expect(state(page)).toContainText('"ids":[]');
  release(); control.pauseGet = undefined;
  for (const page of [first, second]) await page.getByRole("button", { name: "Focus", exact: true }).click();
  for (const page of [first, second]) await expect(state(page)).toContainText('"requestState":"idle"');
  expect(errors).toEqual([]);
});

test("a 403 clears both callers and only an own successful retry can reopen denied state", async ({ context }) => {
  const { control, requests, errors } = await install(context);
  const first = await open(context); const second = await open(context);
  control.status = 403;
  await first.getByRole("button", { name: "Focus", exact: true }).click();
  for (const page of [first, second]) await expect(state(page)).toContainText('"requestState":"permission_denied"');
  control.status = 200;
  const before = requests.length;
  await second.getByRole("button", { name: "Focus", exact: true }).click();
  expect(requests.length).toBe(before);
  await second.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(state(second)).toContainText('"requestState":"ready"');
  await expect(state(first)).toContainText('"requestState":"permission_denied"');
  expect(errors).toEqual([]);
});

test("different login generations/workspaces do not receive payloads and unsupported APIs retain direct refresh", async ({ context }) => {
  const { control, errors } = await install(context);
  const first = await open(context); const login = await open(context, "?login=login-b"); const workspace = await open(context, "?workspace=synthetic-beta");
  control.rows.push(row("synthetic-new"));
  await first.getByRole("button", { name: "Focus", exact: true }).click();
  await expect(state(first)).toContainText("synthetic-new");
  await expect(state(login)).not.toContainText("synthetic-new"); await expect(state(workspace)).not.toContainText("synthetic-new");
  const fallback = await context.newPage();
  await fallback.addInitScript(() => { Object.defineProperty(window, "BroadcastChannel", { value: undefined }); });
  await fallback.goto(`${origin}/tests/fixtures/notification-sharing-harness.html`);
  await expect(state(fallback)).toContainText('"requestState":"ready"');
  control.rows.push(row("synthetic-fallback"));
  await fallback.getByRole("button", { name: "Focus", exact: true }).click();
  await expect(state(fallback)).toContainText("synthetic-fallback");
  expect(errors).toEqual([]);
});

test("a GET started before a mutation cannot restore stale unread counts", async ({ context }) => {
  const { control, requests, errors } = await install(context);
  const first = await open(context); const second = await open(context);
  let release!: () => void;
  control.pauseGet = new Promise<void>(resolve => { release = resolve; });
  await first.getByRole("button", { name: "Focus", exact: true }).click();
  await expect.poll(() => requests.filter(item => item.method === "GET").length).toBeGreaterThan(2);
  control.pauseGet = undefined;
  await second.getByRole("button", { name: "Read", exact: true }).click();
  for (const page of [first, second]) await expect(state(page)).toContainText('"unread":0');
  release();
  await expect.poll(() => requests.every(item => item.settled)).toBe(true);
  await first.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
  for (const page of [first, second]) await expect(state(page)).toContainText('"unread":0');
  expect(errors).toEqual([]);
});

test("concurrent mutations converge and do not abort another window's successful save", async ({ context }) => {
  const { control, requests, errors } = await install(context);
  const first = await open(context); const second = await open(context);
  let release!: () => void;
  control.pausePost = new Promise<void>(resolve => { release = resolve; });
  await Promise.all([
    first.getByRole("button", { name: "Read", exact: true }).click(),
    second.getByRole("button", { name: "Archive", exact: true }).click(),
  ]);
  await expect.poll(() => requests.filter(item => item.method === "POST").length).toBe(2);
  release(); control.pausePost = undefined;
  for (const page of [first, second]) {
    await expect(state(page)).toContainText('"archived":1');
    await expect(state(page)).toContainText('"unread":0');
  }
  expect(errors).toEqual([]);
});

test("a delayed POST completion after logout cannot restore counts or delivery", async ({ context }) => {
  const { control, requests, errors } = await install(context);
  const first = await open(context); const second = await open(context);
  let release!: () => void;
  control.pausePost = new Promise<void>(resolve => { release = resolve; });
  await second.getByRole("button", { name: "Archive", exact: true }).click();
  await expect.poll(() => requests.filter(item => item.method === "POST").length).toBe(1);
  await first.getByRole("button", { name: "Logout", exact: true }).click();
  for (const page of [first, second]) await expect(state(page)).toContainText('"requestState":"idle"');
  release(); control.pausePost = undefined;
  await expect.poll(() => requests.every(item => item.settled)).toBe(true);
  await first.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
  for (const page of [first, second]) {
    await expect(state(page)).toContainText('"archived":0');
    await expect(state(page)).toContainText('"ids":[]');
    await expect(page.locator('[data-testid^="global-notification-toast-"]')).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

test("failed archive preserves rows/counts while a silent ordinary read failure stays silent", async ({ context }) => {
  const { control, requests, errors } = await install(context);
  const first = await open(context); const second = await open(context);
  control.failPost = true;
  await first.getByRole("button", { name: "Archive", exact: true }).click();
  await expect(state(first)).toContainText('"requestState":"error"');
  await expect(state(first)).toContainText('"unread":1');
  await expect(state(first)).toContainText("synthetic-one");
  await expect(state(second)).toContainText('"requestState":"ready"');
  const response = second.waitForResponse(value => value.url().endsWith("/synthetic-one/read"));
  await second.getByRole("button", { name: "Silent read", exact: true }).click();
  expect((await response).status()).toBe(503);
  expect(requests.filter(item => item.method === "POST")).toHaveLength(2);
  await expect(state(second)).toContainText('"requestState":"ready"');
  await expect(state(second)).toContainText('"unread":1');
  expect(errors).toEqual([]);
});

test("missing server scope preserves the existing independent 30-second refresh", async ({ context }) => {
  const { control, requests, errors } = await install(context);
  control.scope = false;
  const first = await context.newPage();
  await first.clock.install();
  await first.goto(`${origin}/tests/fixtures/notification-sharing-harness.html`);
  await expect(state(first)).toContainText('"requestState":"ready"');
  const before = requests.length;
  control.rows.push(row("synthetic-independent"));
  await first.clock.fastForward(30_000);
  await expect(state(first)).toContainText("synthetic-independent");
  expect(requests.length - before).toBe(1);
  expect(errors).toEqual([]);
});

test("login generation change drops an old delayed payload and resets backlog/toast state", async ({ context }) => {
  const { control, requests, errors } = await install(context);
  control.rows = [row("synthetic-urgent-old", "urgent")];
  const first = await open(context);
  await expect(first.getByTestId("global-notification-toast-synthetic-urgent-old")).toBeVisible();
  let release!: () => void;
  control.pauseGet = new Promise<void>(resolve => { release = resolve; });
  await first.getByRole("button", { name: "Focus", exact: true }).click();
  await expect.poll(() => requests.length).toBeGreaterThan(1);
  control.pauseGet = undefined;
  control.rows = [row("synthetic-login-b")];
  await first.getByRole("button", { name: "Change login", exact: true }).click();
  await expect(state(first)).toContainText("synthetic-login-b");
  await expect(first.locator('[data-testid^="global-notification-toast-"]')).toHaveCount(0);
  release();
  await expect.poll(() => requests.every(item => item.settled)).toBe(true);
  await first.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
  await expect(state(first)).not.toContainText("synthetic-urgent-old");
  await expect(first.locator('[data-testid^="global-notification-toast-"]')).toHaveCount(0);
  expect(errors).toEqual([]);
});
