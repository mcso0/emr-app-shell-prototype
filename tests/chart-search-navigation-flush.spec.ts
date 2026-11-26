import { expect, test } from "@playwright/test";
import { Script } from "node:vm";
import ts from "typescript";
import { sourceFunction } from "./fixtures/chart-order-source-owners";

// Execute the real callback with a delayed editor flush. Browser ordering is
// covered separately by chart-search-navigation-browser.spec.ts.
const { file, owner } = sourceFunction("src/shell/app-shell.tsx", "runWithSavedEditors");
const compiled = ts.transpileModule(`(${owner.getText(file)})`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;
const ref = <T,>(current: T) => ({ current });

function harness() {
  let resolve!: (saved: boolean) => void;
  let reject!: (reason: Error) => void;
  const saved = new Promise<boolean>((done, fail) => { resolve = done; reject = fail; });
  const tab = { id: "treatment-tab", history: ["/w/synthetic/treatment"], historyIndex: 0 };
  const state = { activeTabId: tab.id, tabs: [tab] };
  const context = {
    tabNavigationPendingRef: ref(false), workspaceSwitchPendingRef: ref<object | null>(null),
    workspaceSwitchScopeRef: ref<object | null>({ moduleId: "chart-search" }),
    tabNavigationScopeRef: ref<object | null>({ workspaceId: "synthetic", sessionId: "user-a" }),
    useWorkspaceTabsStore: { getState: () => state },
    useChartStore: { getState: () => ({ flushEditors: () => saved }) },
    toast: { error: (message: string) => errors.push(message) },
  };
  const errors: string[] = [];
  let navigations = 0;
  const run = new Script(compiled).runInNewContext(context) as (navigate: () => void) => Promise<void>;
  return { context, state, tab, errors, resolve, reject,
    run: () => run(() => { navigations += 1; }), get navigations() { return navigations; } };
}

test("reopen survives a previous tab's module commit while editor flush is pending", async () => {
  const h = harness();
  const pending = h.run();
  h.context.workspaceSwitchScopeRef.current = { moduleId: "treatment" };
  h.resolve(true);
  await pending;
  expect(h.navigations).toBe(1);
  expect(h.context.tabNavigationPendingRef.current).toBe(false);
});

for (const change of ["owner", "owner-return", "unmount", "tab", "route"] as const) {
  test(`pending navigation is canceled after ${change} changes`, async () => {
    const h = harness();
    const pending = h.run();
    if (change === "owner") h.context.tabNavigationScopeRef.current = { sessionId: "user-b" };
    if (change === "owner-return") {
      h.context.tabNavigationScopeRef.current = { sessionId: "user-b" };
      h.context.tabNavigationScopeRef.current = { workspaceId: "synthetic", sessionId: "user-a" };
    }
    if (change === "unmount") h.context.tabNavigationScopeRef.current = null;
    if (change === "tab") h.state.activeTabId = "another-tab";
    if (change === "route") h.tab.history[0] += "?chartId=another-chart";
    h.resolve(true);
    await pending;
    expect(h.navigations).toBe(0);
    expect(h.context.tabNavigationPendingRef.current).toBe(false);
  });
}

test("failed saves and concurrent requests do not navigate", async () => {
  const h = harness();
  const pending = h.run();
  await h.run();
  h.resolve(false);
  await pending;
  expect(h.navigations).toBe(0);
  const switching = harness();
  switching.context.workspaceSwitchPendingRef.current = {};
  await switching.run();
  expect(switching.navigations).toBe(0);
});

test("a rejected save reports an error only to the same owner", async () => {
  for (const changed of [false, true]) {
    const h = harness();
    const pending = h.run();
    if (changed) h.context.tabNavigationScopeRef.current = { sessionId: "user-b" };
    h.reject(new Error("synthetic save failure"));
    await pending;
    expect(h.errors).toHaveLength(changed ? 0 : 1);
    expect(h.navigations).toBe(0);
    expect(h.context.tabNavigationPendingRef.current).toBe(false);
  }
});
