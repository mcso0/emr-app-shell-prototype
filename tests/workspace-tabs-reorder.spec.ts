import { expect, test, type Locator, type Page } from "@playwright/test";
import type { WorkspaceTab } from "../src/stores/workspace-tabs-store";

const workspaceId = "clair-demo";
const storageKey = `clair-workspace-tabs:v1:${workspaceId}`;
const homeRoute = `/w/${workspaceId}/home?modulePanel=open`;
const tabSessionPath = `/api/workspaces/${workspaceId}/app-shell/workspace-tabs`;
const timestamp = "2026-10-11T00:00:00.000Z";
const preferredTabWidth = 148;
const minimumTabWidth = 80;
const titles: Record<string, string> = {
  home: "원내 현황",
  lab: "검사",
  billing: "수납",
  imaging: "영상",
  dispensing: "조제",
};

type TabSession = { workspaceId: string; activeTabId: string; tabs: WorkspaceTab[] };
type ServerSession = Omit<TabSession, "workspaceId">;
type TrackedWindow = Window & { __workspaceTabSessionWrites?: string[] };

test.use({ viewport: { width: 1440, height: 1000 } });

function tab(id: string, moduleId: string): WorkspaceTab {
  const route = moduleId === "home" ? homeRoute : `/w/${workspaceId}/${moduleId}?modulePanel=open`;
  return {
    id,
    title: titles[moduleId],
    closable: true,
    history: [route],
    historyIndex: 0,
    moduleId,
    surfaceType: "module",
    surfaceId: moduleId,
    dedupeKey: `${workspaceId}:module:${moduleId}`,
    lastRoute: route,
    updatedAt: timestamp,
  };
}

function fixture(): TabSession {
  const home = tab("tab-reorder-home", "home");
  home.history = [`/w/${workspaceId}/reception?modulePanel=open`, homeRoute];
  home.historyIndex = 1;
  return {
    workspaceId,
    activeTabId: home.id,
    tabs: [home, tab("tab-reorder-lab", "lab"), tab("tab-reorder-billing", "billing")],
  };
}

function tablist(page: Page) {
  return page.getByRole("tablist", { name: "열린 업무 탭" });
}

function viewport(page: Page) {
  return page.locator('[data-slot="workspace-tab-viewport"]');
}

function wrapper(button: Locator) {
  return button.locator('xpath=ancestor::*[@data-slot="workspace-tab"][1]');
}

async function persisted(page: Page): Promise<TabSession> {
  return page.evaluate((key) => JSON.parse(sessionStorage.getItem(key) ?? "null"), storageKey);
}

async function localWriteCount(page: Page) {
  return page.evaluate(() => {
    const writes = (window as TrackedWindow).__workspaceTabSessionWrites;
    if (!writes) throw new Error("Workspace tab write tracking must be initialized");
    return writes.length;
  });
}

async function installSession(page: Page, initial = fixture()) {
  const baseURL = test.info().project.use.baseURL;
  if (!baseURL) throw new Error("Tab reorder tests require a local baseURL");
  const server = new URL(baseURL);
  if (server.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(server.hostname)) {
    throw new Error("Tab reorder tests require an HTTP localhost server");
  }
  // A reused dev server can ignore the mock env in playwright.config.ts.
  const authProbe = await page.request.get("/api/workspaces", {
    headers: { "x-clair-demo-session-user-id": "playwright-default-session" },
  });
  expect(authProbe.status(), "The local server must accept the synthetic mock session").toBe(200);
  expect((await authProbe.json()).ok).toBe(true);

  const puts: ServerSession[] = [];
  const reads: string[] = [];
  const unexpected: string[] = [];
  const pageErrors: string[] = [];
  let serverSession: ServerSession | null = null;
  page.on("pageerror", (error) => pageErrors.push(error.stack ?? error.message));
  await page.addInitScript((key) => {
    const trackedWindow = window as TrackedWindow;
    const writes: string[] = [];
    trackedWindow.__workspaceTabSessionWrites = writes;
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (this === sessionStorage && name === key) writes.push(value);
      return setItem.call(this, name, value);
    };
  }, storageKey);

  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    if (url.origin !== server.origin) {
      unexpected.push(`${method} ${url.origin}${url.pathname}`);
      await route.abort("blockedbyclient");
      return;
    }
    if (url.pathname.endsWith("/app-shell/workspace-tabs")) {
      if (url.pathname !== tabSessionPath || !["GET", "PUT"].includes(method)) {
        unexpected.push(`${method} ${url.pathname}`);
        await route.abort("blockedbyclient");
        return;
      }
      if (method === "PUT") {
        serverSession = request.postDataJSON() as ServerSession;
        puts.push(structuredClone(serverSession));
      } else reads.push(url.pathname);
      await route.fulfill({
        json: { ok: true, status: 200, payload: serverSession, enforcedBy: "workspace-tabs-session" },
      });
      return;
    }
    if (url.pathname.startsWith("/api/") && method !== "GET") {
      unexpected.push(`${method} ${url.pathname}`);
      await route.abort("blockedbyclient");
      return;
    }
    if (url.pathname === "/api/workspaces") {
      await route.fulfill({ json: { ok: true, workspaces: [{
        id: workspaceId,
        displayName: "합성 탭 테스트 병원",
        membershipId: "tab-reorder-synthetic-membership",
        roles: ["hospital_admin"],
        status: "active",
      }] } });
      return;
    }
    await route.continue();
  });

  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.evaluate(({ key, initial }) => {
    sessionStorage.setItem(key, JSON.stringify(initial));
  }, { key: storageKey, initial });
  await page.goto(homeRoute);
  await expect(tablist(page).getByRole("tab")).toHaveCount(initial.tabs.length);
  await expect(page.getByTestId("home-workspace")).toBeVisible();
  await expect(tablist(page).getByRole("tab", { name: "원내 현황", exact: true }).first()).toHaveAttribute("aria-selected", "true");
  // Settle the store's known 500ms server-save debounce before counting gesture writes.
  await page.waitForTimeout(650);
  return {
    puts,
    reads,
    assertTraffic() {
      expect(unexpected, "No remote traffic or unrelated API mutations").toEqual([]);
      expect(pageErrors).toEqual([]);
    },
  };
}

async function startDrag(page: Page, fromIndex = 1, toIndex = 2) {
  const source = tablist(page).getByRole("tab").nth(fromIndex);
  const target = tablist(page).getByRole("tab").nth(toIndex);
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  if (!sourceBox || !targetBox) throw new Error("Workspace tab drag targets must be visible");
  const start = { x: sourceBox.x + sourceBox.width / 2, y: sourceBox.y + sourceBox.height / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 10, start.y, { steps: 3 });
  await expect(wrapper(source)).toHaveAttribute("data-dragging", "true");
  await page.mouse.move(targetBox.x + targetBox.width / 2, start.y, { steps: 12 });
  return source;
}

async function expectHomeUnchanged(page: Page, url: string) {
  await expect(page).toHaveURL(url);
  await expect(tablist(page).getByRole("tab", { name: "원내 현황", exact: true })).toHaveAttribute("aria-selected", "true");
  expect((await persisted(page)).activeTabId).toBe("tab-reorder-home");
}

test("dragging an inactive tab commits one order and preserves the active screen, input and histories", async ({ page }) => {
  const session = await installSession(page);
  const home = page.getByTestId("home-workspace");
  await home.getByRole("button", { name: "검색", exact: true }).click();
  const search = home.getByRole("textbox", { name: /내 업무 검색|환자 보호자 업무 검색/ });
  await search.fill("합성 입력 유지");
  const contentNode = await home.elementHandle();
  if (!contentNode) throw new Error("Active home content must be mounted");
  const initial = await persisted(page);
  const url = page.url();
  const localWrites = await localWriteCount(page);
  const serverWrites = session.puts.length;

  await startDrag(page);
  expect(await persisted(page)).toEqual(initial);
  expect(await localWriteCount(page)).toBe(localWrites);
  expect(session.puts).toHaveLength(serverWrites);
  await expectHomeUnchanged(page, url);
  await page.mouse.up();

  await expect(tablist(page).getByRole("tab")).toHaveText(["원내 현황", "수납", "검사"]);
  const expected = { ...initial, tabs: [initial.tabs[0], initial.tabs[2], initial.tabs[1]] };
  expect(await persisted(page)).toEqual(expected);
  expect(await localWriteCount(page)).toBe(localWrites + 1);
  await expectHomeUnchanged(page, url);
  await expect(search).toHaveValue("합성 입력 유지");
  expect(await contentNode.evaluate((node) => node.isConnected && node === document.querySelector('[data-testid="home-workspace"]'))).toBe(true);
  await expect.poll(() => session.puts.length).toBe(serverWrites + 1);
  await page.waitForTimeout(650);
  expect(session.puts).toHaveLength(serverWrites + 1);
  expect(session.puts.at(-1)).toEqual({ activeTabId: expected.activeTabId, tabs: expected.tabs });
  await page.screenshot({ path: "output/playwright/workspace-tabs-reorder.png" });

  await page.reload();
  await expect(tablist(page).getByRole("tab")).toHaveText(["원내 현황", "수납", "검사"]);
  await expectHomeUnchanged(page, url);
  expect(await persisted(page)).toEqual(expected);
  // Also restore from the mocked server when the immediate browser copy is absent.
  await page.evaluate((key) => sessionStorage.removeItem(key), storageKey);
  await page.reload();
  await expect(tablist(page).getByRole("tab")).toHaveText(["원내 현황", "수납", "검사"]);
  await expectHomeUnchanged(page, url);
  expect(session.reads).toHaveLength(1);
  session.assertTraffic();
});

for (const cancellation of ["Escape", "outside", "pointercancel", "window blur"] as const) {
  test(`${cancellation} cancels an inactive tab drag without changing selection or persistence`, async ({ page }) => {
    const session = await installSession(page);
    const initial = await persisted(page);
    const url = page.url();
    const localWrites = await localWriteCount(page);
    const serverWrites = session.puts.length;
    const contentNode = await page.getByTestId("home-workspace").elementHandle();
    if (!contentNode) throw new Error("Active home content must be mounted");
    const source = await startDrag(page);

    if (cancellation === "Escape") await page.keyboard.press("Escape");
    else if (cancellation === "outside") {
      const stripBox = await viewport(page).boundingBox();
      if (!stripBox) throw new Error("Workspace tab viewport must be visible");
      await page.mouse.move(stripBox.x + stripBox.width / 2, stripBox.y + stripBox.height + 100, { steps: 10 });
    } else if (cancellation === "pointercancel") {
      await source.dispatchEvent("pointercancel", { pointerId: 1, pointerType: "mouse", bubbles: true });
    } else await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await page.mouse.up();

    await expect(wrapper(source)).toHaveAttribute("data-dragging", "false");
    await expect(tablist(page).getByRole("tab")).toHaveText(["원내 현황", "검사", "수납"]);
    await expectHomeUnchanged(page, url);
    expect(await persisted(page)).toEqual(initial);
    expect(await localWriteCount(page)).toBe(localWrites);
    await page.waitForTimeout(650);
    expect(session.puts).toHaveLength(serverWrites);
    expect(await contentNode.evaluate((node) => node.isConnected)).toBe(true);
    session.assertTraffic();
  });
}

test("closing a reordered inactive tab preserves the active screen and remaining histories", async ({ page }) => {
  const session = await installSession(page);
  const url = page.url();
  const initial = await persisted(page);
  const contentNode = await page.getByTestId("home-workspace").elementHandle();
  if (!contentNode) throw new Error("Active home content must be mounted");
  const serverWrites = session.puts.length;
  await startDrag(page);
  await page.mouse.up();
  await expect(tablist(page).getByRole("tab")).toHaveText(["원내 현황", "수납", "검사"]);
  await expect.poll(() => session.puts.length).toBe(serverWrites + 1);
  const localWrites = await localWriteCount(page);
  await tablist(page).getByRole("button", { name: "수납 탭 닫기", exact: true }).press("Enter");
  await expect(tablist(page).getByRole("tab")).toHaveText(["원내 현황", "검사"]);
  await expectHomeUnchanged(page, url);
  expect(await persisted(page)).toEqual({ ...initial, tabs: [initial.tabs[0], initial.tabs[1]] });
  expect(await localWriteCount(page)).toBe(localWrites + 1);
  await expect.poll(() => session.puts.length).toBe(serverWrites + 2);
  expect(await contentNode.evaluate((node) => node.isConnected)).toBe(true);
  session.assertTraffic();
});

test("tabs shrink equally to the available screen width before horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 1000 });
  const initial = fixture();
  for (const moduleId of ["imaging", "dispensing", "lab"]) {
    initial.tabs.push(tab(`tab-shrink-${moduleId}`, moduleId));
  }
  const session = await installSession(page, initial);
  const strip = viewport(page);
  const tabs = tablist(page).locator('[data-slot="workspace-tab"]');
  const widths = await tabs.evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().width));
  expect(widths).toHaveLength(6);
  expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(1);
  for (const width of widths) {
    expect(width).toBeGreaterThan(minimumTabWidth + 1);
    expect(width).toBeLessThan(preferredTabWidth - 1);
  }
  expect(await strip.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
  await expect(page.getByRole("button", { name: "새 업무 탭", exact: true })).toBeVisible();
  await page.screenshot({ path: "output/playwright/workspace-tabs-reorder-shrink.png" });

  await page.setViewportSize({ width: 1800, height: 1000 });
  await expect.poll(() => tabs.evaluateAll((elements) => Math.min(...elements.map((element) => element.getBoundingClientRect().width)))).toBeGreaterThanOrEqual(preferredTabWidth - 1);
  const expandedWidths = await tabs.evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().width));
  for (const width of expandedWidths) expect(width).toBeLessThanOrEqual(preferredTabWidth + 1);
  expect(await strip.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
  expect(await persisted(page)).toEqual(initial);
  session.assertTraffic();
});

test("many tabs keep the minimum width and scroll inside the strip while add and right chrome stay visible", async ({ page }) => {
  const initial = fixture();
  for (let index = 0; index < 13; index += 1) {
    const moduleId = ["lab", "billing", "imaging", "dispensing"][index % 4];
    initial.tabs.push(tab(`tab-overflow-${index}`, moduleId));
  }
  const session = await installSession(page, initial);
  const strip = viewport(page);
  const topbar = page.getByTestId("workspace-tabs-bar");
  const stripBox = await strip.boundingBox();
  const topbarBox = await topbar.boundingBox();
  if (!stripBox || !topbarBox) throw new Error("Desktop topbar and tab viewport must be visible");
  const metrics = await strip.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    overflowX: getComputedStyle(element).overflowX,
  }));
  expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth);
  expect(metrics.overflowX).toBe("auto");
  const widths = await tablist(page).locator('[data-slot="workspace-tab"]').evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().width));
  expect(widths).toHaveLength(initial.tabs.length);
  for (const width of widths) expect(Math.abs(width - minimumTabWidth)).toBeLessThanOrEqual(1);
  expect(stripBox.x).toBeGreaterThanOrEqual(topbarBox.x - 1);
  expect(stripBox.x + stripBox.width).toBeLessThanOrEqual(topbarBox.x + topbarBox.width + 1);
  const newButton = topbar.getByRole("button", { name: "새 업무 탭", exact: true });
  for (const control of [newButton, topbar.getByRole("button", { name: /알림 센터 열기/ }), topbar.getByRole("button", { name: /프로필 메뉴/ })]) {
    await expect(control).toBeVisible();
    const box = await control.boundingBox();
    if (!box) throw new Error("Topbar controls must have visible bounds");
    expect(box.x).toBeGreaterThanOrEqual(topbarBox.x - 1);
    expect(box.x + box.width).toBeLessThanOrEqual(topbarBox.x + topbarBox.width + 1);
  }
  const newBox = await newButton.boundingBox();
  if (!newBox) throw new Error("New tab control must be visible");
  expect(stripBox.x + stripBox.width).toBeLessThanOrEqual(newBox.x + 1);
  await strip.hover();
  await page.mouse.wheel(650, 0);
  await expect.poll(() => strip.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  expect(await persisted(page)).toEqual(initial);
  await expect(newButton).toBeVisible();
  session.assertTraffic();
});
