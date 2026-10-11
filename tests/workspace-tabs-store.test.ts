import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/modules/registry", () => ({
  modules: [{ id: "home", label: "원내 현황" }, { id: "lab", label: "검사" }],
  normalizeModuleId: (id: string) => id,
}));

describe("workspace tab session persistence", () => {
  let storage: Map<string, string>;
  let fetchMock: ReturnType<typeof vi.fn>;
  let write: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    storage = new Map();
    write = vi.fn((key: string, value: string) => storage.set(key, value));
    vi.stubGlobal("window", { setTimeout, clearTimeout, sessionStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: write } });
    fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, payload: null }) }));
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  async function ready() {
    const { useWorkspaceTabsStore: store } = await import("../src/stores/workspace-tabs-store");
    await store.getState().initialize({ workspaceId: "synthetic", route: "/w/synthetic/lab", moduleId: "lab" });
    await vi.advanceTimersByTimeAsync(500);
    fetchMock.mockClear(); write.mockClear();
    return store;
  }

  it("does not write or notify for an already-active tab or unchanged route", async () => {
    const store = await ready();
    const changed = vi.fn(); const unsubscribe = store.subscribe(changed);
    store.getState().activateTab(store.getState().activeTabId!);
    store.getState().pushRoute("/w/synthetic/lab", "lab");
    store.getState().syncActiveRoute("/w/synthetic/lab", "lab");
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchMock).not.toHaveBeenCalled(); expect(write).not.toHaveBeenCalled();
    expect(changed).not.toHaveBeenCalled(); unsubscribe();
  });

  it("serializes a slow save and then writes only the newest pending snapshot", async () => {
    const store = await ready();
    let release!: (value: { ok: boolean }) => void;
    fetchMock.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    store.getState().createTab({ workspaceId: "synthetic", route: "/w/synthetic/home", moduleId: "home" });
    await vi.advanceTimersByTimeAsync(500);
    const newTab = store.getState().activeTabId!;
    store.getState().createTab({ workspaceId: "synthetic", route: "/w/synthetic/lab?date=2026-10-10", moduleId: "lab" });
    await vi.advanceTimersByTimeAsync(500);
    store.getState().closeTab(newTab);
    await vi.advanceTimersByTimeAsync(500);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    release({ ok: true }); await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const latest = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(latest.tabs).toEqual(store.getState().tabs);
    expect(latest.activeTabId).toBe(store.getState().activeTabId);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps the session copy on an HTTP failure and does not restore stale server tabs over it", async () => {
    const store = await ready();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    fetchMock.mockResolvedValueOnce({ ok: false, status: 429 });
    store.getState().createTab({ workspaceId: "synthetic", route: "/w/synthetic/home", moduleId: "home" });
    await vi.advanceTimersByTimeAsync(500);
    expect(warn).toHaveBeenCalledOnce();
    const saved = JSON.parse(storage.get("clair-workspace-tabs:v1:synthetic")!);
    expect(saved.tabs).toHaveLength(2);
    fetchMock.mockClear();
    await store.getState().initialize({ workspaceId: "synthetic", route: "/w/synthetic/home", moduleId: "home" });
    expect(store.getState().tabs).toEqual(saved.tabs);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not discard a pending save when another workspace becomes active", async () => {
    const store = await ready();
    store.getState().createTab({ workspaceId: "synthetic", route: "/w/synthetic/home", moduleId: "home" });
    store.getState().createTab({ workspaceId: "synthetic-b", route: "/w/synthetic-b/home", moduleId: "home" });
    await vi.advanceTimersByTimeAsync(500);
    expect(fetchMock.mock.calls.map(call => call[0])).toEqual([
      "/api/workspaces/synthetic/app-shell/workspace-tabs",
      "/api/workspaces/synthetic-b/app-shell/workspace-tabs",
    ]);
  });

  it("preserves all server tabs after a slow restore whose active route is unchanged", async () => {
    const store = await ready();
    store.getState().createTab({ workspaceId: "synthetic", route: "/w/synthetic/home", moduleId: "home" });
    await vi.advanceTimersByTimeAsync(500);
    const payload = JSON.parse(storage.get("clair-workspace-tabs:v1:synthetic")!);
    storage.clear(); fetchMock.mockClear();
    let release!: (value: unknown) => void;
    fetchMock.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const restore = store.getState().initialize({ workspaceId: "synthetic", route: "/w/synthetic/home", moduleId: "home" });
    await vi.advanceTimersByTimeAsync(1500);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    release({ ok: true, json: async () => ({ ok: true, payload }) }); await restore;
    await vi.advanceTimersByTimeAsync(500);
    expect(store.getState().tabs).toHaveLength(2);
    expect(JSON.parse(storage.get("clair-workspace-tabs:v1:synthetic")!).tabs).toHaveLength(2);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).tabs).toHaveLength(2);
  });
});
