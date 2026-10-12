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

  async function readyWithTabs() {
    const store = await ready();
    store.getState().createTab({ workspaceId: "synthetic", route: "/w/synthetic/home", moduleId: "home" });
    store.getState().createTab({ workspaceId: "synthetic", route: "/w/synthetic/lab?labResultId=result-a&patientId=patient-a&encounterId=encounter-a", moduleId: "lab" });
    store.getState().pushRoute("/w/synthetic/lab?labResultId=result-a&patientId=patient-a&encounterId=encounter-a&date=2026-10-11", "lab");
    store.getState().goBack();
    await vi.advanceTimersByTimeAsync(500);
    fetchMock.mockClear(); write.mockClear();
    return store;
  }

  it("reorders only the array, preserves active and tab identity, and persists once", async () => {
    const store = await readyWithTabs();
    store.setState((state) => ({ tabs: state.tabs.map((tab, index) => index === 1 ? { ...tab, closable: false } : tab) }));
    const before = store.getState();
    const fields = structuredClone(before.tabs);
    const orderedTabs = [before.tabs[1], before.tabs[2], before.tabs[0]];
    const changed = vi.fn(); const unsubscribe = store.subscribe(changed);

    store.getState().reorderTabs("synthetic", orderedTabs.map(tab => tab.id));

    expect(store.getState().activeTabId).toBe(before.activeTabId);
    expect(store.getState().tabs).not.toBe(before.tabs);
    expect(store.getState().tabs).toEqual(orderedTabs);
    for (const tab of store.getState().tabs) {
      const originalIndex = before.tabs.findIndex(original => original.id === tab.id);
      expect(tab).toBe(before.tabs[originalIndex]);
      expect(tab.history).toBe(before.tabs[originalIndex].history);
      expect(tab).toEqual(fields[originalIndex]);
    }
    expect(changed).toHaveBeenCalledOnce();
    expect(write).toHaveBeenCalledOnce();
    expect(JSON.parse(write.mock.calls[0][1])).toEqual({ workspaceId: "synthetic", tabs: orderedTabs, activeTabId: before.activeTabId });
    expect(fetchMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(499);
    expect(fetchMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/workspaces/synthetic/app-shell/workspace-tabs");
    expect(fetchMock.mock.calls[0][1].method).toBe("PUT");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ tabs: orderedTabs, activeTabId: before.activeTabId });
    unsubscribe();
  });

  it("does not write or notify for an unchanged order", async () => {
    const store = await readyWithTabs();
    const before = store.getState();
    const changed = vi.fn(); const unsubscribe = store.subscribe(changed);
    store.getState().reorderTabs("synthetic", before.tabs.map(tab => tab.id));
    await vi.advanceTimersByTimeAsync(1000);
    expect(store.getState()).toBe(before);
    expect(fetchMock).not.toHaveBeenCalled(); expect(write).not.toHaveBeenCalled();
    expect(changed).not.toHaveBeenCalled(); unsubscribe();
  });

  it.each(["duplicate", "missing", "extra", "unknown", "sparse", "foreign workspace", "not hydrated", "missing active tab", "no active tab"])("rejects %s without writing or notifying", async (invalid) => {
    const store = await readyWithTabs();
    const ids = store.getState().tabs.map(tab => tab.id);
    let orderedIds = [...ids].reverse();
    let workspaceId = "synthetic";
    if (invalid === "duplicate") orderedIds = [ids[0], ids[0], ids[2]];
    if (invalid === "missing") orderedIds = ids.slice(1);
    if (invalid === "extra") orderedIds = [...ids, "unknown"];
    if (invalid === "unknown") orderedIds = [ids[0], ids[1], "unknown"];
    if (invalid === "sparse") {
      orderedIds = new Array<string>(ids.length);
      orderedIds[0] = ids[0]; orderedIds[2] = ids[2];
    }
    if (invalid === "foreign workspace") workspaceId = "synthetic-b";
    if (invalid === "not hydrated") store.setState({ hydrated: false });
    if (invalid === "missing active tab") store.setState({ activeTabId: "unknown" });
    if (invalid === "no active tab") store.setState({ activeTabId: null });
    const before = store.getState();
    const changed = vi.fn(); const unsubscribe = store.subscribe(changed);
    store.getState().reorderTabs(workspaceId, orderedIds);
    await vi.advanceTimersByTimeAsync(1000);
    expect(store.getState()).toBe(before);
    expect(fetchMock).not.toHaveBeenCalled(); expect(write).not.toHaveBeenCalled();
    expect(changed).not.toHaveBeenCalled(); unsubscribe();
  });

  it("rejects a stale list after a tab is replaced without writing or notifying", async () => {
    const store = await readyWithTabs();
    const staleIds = store.getState().tabs.map(tab => tab.id).reverse();
    store.getState().closeTab(staleIds[1]);
    store.getState().createTab({ workspaceId: "synthetic", route: "/w/synthetic/lab?labResultId=result-b", moduleId: "lab" });
    await vi.advanceTimersByTimeAsync(500);
    fetchMock.mockClear(); write.mockClear();
    const before = store.getState();
    const changed = vi.fn(); const unsubscribe = store.subscribe(changed);
    expect(before.tabs).toHaveLength(staleIds.length);
    store.getState().reorderTabs("synthetic", staleIds);
    await vi.advanceTimersByTimeAsync(1000);
    expect(store.getState()).toBe(before);
    expect(fetchMock).not.toHaveBeenCalled(); expect(write).not.toHaveBeenCalled();
    expect(changed).not.toHaveBeenCalled(); unsubscribe();
  });

  it("restores the reordered tabs and active route from the browser session", async () => {
    const store = await readyWithTabs();
    store.getState().reorderTabs("synthetic", store.getState().tabs.map(tab => tab.id).reverse());
    await vi.advanceTimersByTimeAsync(500);
    const before = store.getState();
    const active = before.tabs.find(tab => tab.id === before.activeTabId)!;
    fetchMock.mockClear(); write.mockClear();
    vi.resetModules();
    const { useWorkspaceTabsStore: restored } = await import("../src/stores/workspace-tabs-store");
    await restored.getState().initialize({ workspaceId: "synthetic", route: active.history[active.historyIndex], moduleId: active.moduleId });
    expect(restored.getState().tabs).toEqual(before.tabs);
    expect(restored.getState().activeTabId).toBe(before.activeTabId);
    expect(fetchMock).not.toHaveBeenCalled(); expect(write).not.toHaveBeenCalled();
  });

  it("uses the reordered previous tab when the active tab closes", async () => {
    const store = await readyWithTabs();
    const [first, second, active] = store.getState().tabs;
    expect(store.getState().activeTabId).toBe(active.id);
    store.getState().reorderTabs("synthetic", [second.id, first.id, active.id]);
    expect(store.getState().closeTab(active.id)).toBe(first.history[first.historyIndex]);
    expect(store.getState().tabs.map(tab => tab.id)).toEqual([second.id, first.id]);
    expect(store.getState().activeTabId).toBe(first.id);
  });

  it("serializes reorder saves and sends only the latest pending order", async () => {
    const store = await readyWithTabs();
    const [first, second, active] = store.getState().tabs;
    let release!: (value: { ok: boolean }) => void;
    fetchMock.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    store.getState().reorderTabs("synthetic", [second.id, first.id, active.id]);
    await vi.advanceTimersByTimeAsync(500);
    store.getState().reorderTabs("synthetic", [active.id, first.id, second.id]);
    await vi.advanceTimersByTimeAsync(500);
    store.getState().reorderTabs("synthetic", [active.id, second.id, first.id]);
    await vi.advanceTimersByTimeAsync(500);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(write).toHaveBeenCalledTimes(3);
    release({ ok: true }); await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ tabs: store.getState().tabs, activeTabId: active.id });
    expect(vi.getTimerCount()).toBe(0);
  });

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
