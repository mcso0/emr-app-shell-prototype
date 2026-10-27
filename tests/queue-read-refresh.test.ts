import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { createSharedVisibleResource, subscribeVisibleRefresh } from "../src/lib/visible-refresh";

// Run the actual module hook/effect, with synthetic network and React lifecycle.
// The same scenarios can execute an immutable pre-change source for comparison.
const baseline = process.env.QUEUE_READ_BASELINE;
function source(path: string) {
  return baseline ? execFileSync("git", ["show", `${baseline}:${path}`], { encoding: "utf8" }) : readFileSync(path, "utf8");
}
const dispensing = source("src/features/dispensing/module.tsx");
const declarations = dispensing.slice(dispensing.indexOf("const fulfillmentQueue"), dispensing.indexOf("function findFulfillmentForQueueItem("));
const script = ts.transpileModule(`${declarations}\nexports.useQueue = useDispensingFulfillmentQueue;`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const reception = ts.createSourceFile("reception.tsx", source("src/features/reception/module.tsx"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let receptionEffect = "";
function visit(node: ts.Node) {
  if (ts.isCallExpression(node) && node.expression.getText(reception) === "useEffect") {
    const text = node.arguments[0]?.getText(reception) ?? "";
    if (text.includes("liveStaffSourceEnabled") && text.includes("refreshReceptionReads") && text.includes("60_000")) receptionEffect = text;
  }
  ts.forEachChild(node, visit);
}
visit(reception);
if (!receptionEffect) throw new Error("Reception refresh effect not found");

let browser: EventTarget & { setInterval: typeof setInterval; clearInterval: typeof clearInterval };
let doc: EventTarget & { visibilityState: string };
const cleanups: Array<() => void> = [];
beforeEach(() => {
  vi.useFakeTimers();
  browser = Object.assign(new EventTarget(), { setInterval, clearInterval });
  doc = Object.assign(new EventTarget(), { visibilityState: "visible" });
  vi.stubGlobal("window", browser); vi.stubGlobal("document", doc);
});
afterEach(() => { cleanups.splice(0).forEach(stop => stop()); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });
const settle = () => vi.advanceTimersByTimeAsync(0);
type Snapshot = { status: string; workItems: Array<{ id: string; rowRevision: number }>; sourceTotalCount?: number };
type Hook = Snapshot & { refresh: () => Promise<void>; updateStatus: (id: string, transitions: string[]) => Promise<boolean> };
type Read = { url: string; method: string; signal?: AbortSignal; finish: (status: number, body: unknown) => void; fail: () => void };
type Slot = { value?: unknown; deps?: unknown[]; stop?: () => void };
function harness() {
  let workspace = "synthetic-alpha", actor: string | null = "actor-a", visible = true;
  let slots: Slot[] = [], index = 0;
  let effects: Array<() => void> = [];
  const reads: Read[] = [];
  const authListeners = new Set<() => void>();
  const realtime = new Set<() => Promise<void> | void>();
  const same = (a?: unknown[], b?: unknown[]) => a && b && a.length === b.length && a.every((item, i) => Object.is(item, b[i]));
  const exports: { useQueue?: (date?: string) => Hook } = {};
  runInNewContext(script, {
    exports, Map, Set, Promise, AbortController, crypto, window: browser, document: doc,
    createSharedVisibleResource,
    getWorkspaceIdFromPath: () => workspace,
    useModuleSidePanel: () => ({ visible }),
    useAuthClient: () => ({ session: { id: "synthetic-session", role: "supabase", userId: actor } }),
    useSharedReadActorScope: () => actor,
    getSharedReadActorScope: () => actor,
    isLiveAuthRuntime: () => true,
    subscribeSharedReadActorScope: (listener: () => void) => { authListeners.add(listener); return () => authListeners.delete(listener); },
    subscribeQueueRealtimeRefresh: ({ onQueueChange }: { onQueueChange: () => Promise<void> | void }) => { realtime.add(onQueueChange); return () => realtime.delete(onQueueChange); },
    useRef: (value: unknown) => { const slot = slots[index++] ??= { value: { current: value } }; return slot.value; },
    useState: (init: unknown) => {
      const slot = slots[index++] ??= { value: typeof init === "function" ? init() : init };
      return [slot.value, (next: unknown) => { slot.value = typeof next === "function" ? next(slot.value) : next; }];
    },
    useCallback: (value: unknown, deps: unknown[]) => {
      const slot = slots[index++] ??= {};
      if (!same(slot.deps, deps)) { slot.value = value; slot.deps = deps; }
      return slot.value;
    },
    useEffect: (effect: () => (() => void) | undefined, deps: unknown[]) => {
      const slot = slots[index++] ??= {};
      if (!same(slot.deps, deps)) { slot.deps = deps; effects.push(() => { slot.stop?.(); slot.stop = effect(); }); }
    },
    fetch: (url: string, options: RequestInit = {}) => new Promise((resolve, reject) => reads.push({
      url, method: options.method ?? "GET", signal: options.signal ?? undefined,
      finish: (status, body) => resolve({ status, ok: status >= 200 && status < 300, json: async () => body }),
      fail: () => reject(new Error("synthetic network failure")),
    })),
  });
  const mount = (date = "2026-10-27", options: { workspace?: string; visible?: boolean } = {}) => {
    const owned: Slot[] = [];
    let selectedDate = date;
    const render = () => {
      slots = owned; index = 0; effects = []; workspace = options.workspace ?? "synthetic-alpha"; visible = options.visible ?? true;
      const hook = exports.useQueue!(selectedDate); effects.forEach(effect => effect()); return hook;
    };
    let disposed = false;
    const stop = () => { if (disposed) return; disposed = true; owned.forEach(slot => slot.stop?.()); };
    cleanups.push(stop); render();
    return { get hook() { return render(); }, stop, date: (next: string) => { selectedDate = next; render(); } };
  };
  return { reads, mount, realtime, setActor: (next: string | null) => { actor = next; authListeners.forEach(notify => notify()); },
    finish: (from = 0, id = "synthetic-item", status = 200) => reads.slice(from).forEach(read => read.finish(status, { ok: status === 200, workItems: [{ id, rowRevision: 1 }] })) };
}

describe("request count baseline and candidate", () => {
  it("two actual dispensing consumers request each queue only once", async () => {
    const h = harness(); const panel = h.mount(); const content = h.mount(); await settle();
    expect(h.reads.length).toBe(baseline ? 4 : 2);
    expect(h.reads.filter(read => read.url.includes("queueType=dispensing"))).toHaveLength(baseline ? 2 : 1);
    h.finish(); await settle();
    expect(panel.hook.status).toBe("ready"); expect(content.hook.workItems).toHaveLength(2);
    console.log(`dispensing simultaneous consumers: ${h.reads.length} GETs`);
  });
  it.each([false, true])("one reception return after a completed response (reverse=%s)", async reverse => {
    let reads = 0;
    const refreshReceptionReads = async () => { reads++; };
    const effect = runInNewContext(ts.transpileModule(`(${receptionEffect})`, {}).outputText, { window: browser, document: doc, liveStaffSourceEnabled: true, refreshReceptionReads, subscribeVisibleRefresh });
    cleanups.push(effect());
    (reverse ? browser : doc).dispatchEvent(new Event(reverse ? "focus" : "visibilitychange"));
    await vi.advanceTimersByTimeAsync(25);
    (reverse ? doc : browser).dispatchEvent(new Event(reverse ? "visibilitychange" : "focus"));
    await settle(); expect(reads).toBe(baseline ? 2 : 1);
    console.log(`reception paired return: ${reads} GETs`);
  });
});

describe.skipIf(Boolean(baseline))("dispensing lifecycle", () => {
  it("one consumer leaving keeps the shared read; last unsubscribe aborts and drops old rows", async () => {
    const h = harness(); const first = h.mount(), second = h.mount(); await settle();
    first.stop(); expect(h.reads[0].signal?.aborted).toBe(false);
    second.stop(); expect(h.reads[0].signal?.aborted).toBe(true);
    h.finish(); await settle(); const next = h.mount(); await settle();
    expect(next.hook.workItems).toEqual([]); expect(h.reads).toHaveLength(4);
  });
  it("isolates dates, workspaces and actors and skips hidden panels", async () => {
    const h = harness(); h.mount(); h.mount("2026-10-26"); h.mount(undefined, { workspace: "synthetic-beta" }); h.mount(undefined, { visible: false });
    await settle(); expect(h.reads).toHaveLength(6);
    h.setActor("actor-b"); const next = h.mount(); await settle(); expect(h.reads).toHaveLength(8);
    h.reads.slice(0, 6).forEach(read => read.finish(200, { ok: true, workItems: [{ id: "old-actor" }] }));
    await settle(); expect(next.hook.workItems).toEqual([]);
    h.finish(6, "new-actor"); await settle(); expect(next.hook.workItems[0].id).toBe("new-actor");
    h.setActor(null); await settle(); expect(next.hook.workItems).toEqual([]);
  });
  it("one realtime subscription serves two consumers and a later change gets a new read", async () => {
    const h = harness(); const a = h.mount(); h.mount(); await settle(); h.finish(); await settle();
    expect(h.realtime.size).toBe(1);
    const changed = [...h.realtime][0]; const first = changed(); await settle(); expect(h.reads).toHaveLength(4);
    const second = changed(); await settle(); expect(h.reads).toHaveLength(6);
    h.finish(4, "newest"); await second; h.reads.slice(2, 4).forEach(read => read.finish(200, { ok: true, workItems: [{ id: "older", rowRevision: 1 }] })); await first;
    expect(a.hook.workItems[0].id).toBe("newest");
  });
  it.each([401, 403])("denial %s clears rows even when the other queue fails", async status => {
    const h = harness(); const a = h.mount(); await settle(); h.finish(); await settle();
    const refresh = a.hook.refresh(); await settle(); h.reads[2].finish(status, {}); h.reads[3].fail(); await refresh;
    expect(a.hook.status).toBe("permission_denied"); expect(a.hook.workItems).toEqual([]);
  });
  it("failed reads retain existing rows and retry; empty results stay empty", async () => {
    const h = harness(); const a = h.mount(); await settle(); h.finish(); await settle();
    let pending = a.hook.refresh(); await settle(); h.reads[2].fail(); h.reads[3].fail(); await pending;
    expect(a.hook.status).toBe("error"); expect(a.hook.workItems).toHaveLength(2);
    pending = a.hook.refresh(); await settle(); h.reads.slice(4).forEach(read => read.finish(200, { ok: true, workItems: [] })); await pending;
    expect(a.hook.status).toBe("empty"); expect(a.hook.workItems).toEqual([]);
  });
  it.each([200, 409])("PATCH %s forces a fresh read; a pre-mutation response cannot overwrite it", async patchStatus => {
    const h = harness(); const a = h.mount(); await settle(); h.finish(); await settle();
    const old = a.hook.refresh(); await settle();
    const mutation = a.hook.updateStatus("synthetic-item", ["start"]); await settle();
    expect(h.reads[4].method).toBe("PATCH"); h.reads[4].finish(patchStatus, { workItems: [{ id: "synthetic-item", rowRevision: 2 }] }); await settle();
    expect(h.reads).toHaveLength(7); h.finish(5, "post-mutation"); expect(await mutation).toBe(patchStatus === 200);
    h.reads.slice(2, 4).forEach(read => read.finish(200, { ok: true, workItems: [{ id: "stale", rowRevision: 1 }] })); await old;
    expect(a.hook.workItems[0].id).toBe("post-mutation");
  });
  it("a PATCH completing after logout cannot trigger another command or read", async () => {
    const h = harness(); const a = h.mount(); await settle(); h.finish(); await settle();
    const mutation = a.hook.updateStatus("synthetic-item", ["start", "complete"]); await settle();
    h.setActor(null); h.reads[2].finish(200, { workItems: [{ id: "synthetic-item", rowRevision: 2 }] });
    expect(await mutation).toBe(false); expect(h.reads).toHaveLength(3); expect(a.hook.workItems).toEqual([]);
  });
  it("successive edits each read new state and a network failure remains retryable", async () => {
    const h = harness(); const a = h.mount(); await settle(); h.finish(); await settle();
    const failed = a.hook.updateStatus("synthetic-item", ["start"]);
    const failure = expect(failed).rejects.toThrow("synthetic network failure");
    await settle(); h.reads[2].fail(); await failure;
    for (let i = 0; i < 2; i++) {
      const offset = h.reads.length;
      const mutation = a.hook.updateStatus("synthetic-item", ["start"]); await settle();
      h.reads[offset].finish(200, { workItems: [{ id: "synthetic-item", rowRevision: i + 2 }] }); await settle();
      expect(h.reads).toHaveLength(offset + 3); h.finish(offset + 1); expect(await mutation).toBe(true);
    }
  });
  it("date changes and logout discard pending old responses", async () => {
    const h = harness(); const a = h.mount(); await settle(); a.date("2026-10-26"); await settle();
    h.finish(2, "new-date"); await settle(); h.reads.slice(0, 2).forEach(read => read.finish(200, { ok: true, workItems: [{ id: "old-date" }] })); await settle();
    expect(a.hook.workItems[0].id).toBe("new-date");
    const pending = a.hook.refresh(); await settle(); h.setActor(null); h.finish(4, "late"); await pending;
    expect(a.hook.workItems).toEqual([]);
  });
});

describe("reception lifecycle", () => {
  function mount(enabled = true) {
    const refresh = vi.fn().mockResolvedValue(undefined);
    const effect = runInNewContext(ts.transpileModule(`(${receptionEffect})`, {}).outputText, { window: browser, document: doc, liveStaffSourceEnabled: enabled, refreshReceptionReads: refresh, subscribeVisibleRefresh });
    const stop = effect(); if (stop) cleanups.push(stop); return { refresh, stop };
  }
  it("keeps 60-second visible refresh, independent returns, and removes listeners/timers", async () => {
    const { refresh, stop } = mount(); await vi.advanceTimersByTimeAsync(60_000); expect(refresh).toHaveBeenCalledTimes(1);
    browser.dispatchEvent(new Event("focus")); await vi.advanceTimersByTimeAsync(300); doc.dispatchEvent(new Event("visibilitychange")); expect(refresh).toHaveBeenCalledTimes(3);
    stop(); await vi.advanceTimersByTimeAsync(180_000); browser.dispatchEvent(new Event("focus")); expect(refresh).toHaveBeenCalledTimes(3);
  });
  it("skips hidden ticks/events and does not subscribe in disabled mode", async () => {
    const hidden = mount(); doc.visibilityState = "hidden"; await vi.advanceTimersByTimeAsync(180_000);
    browser.dispatchEvent(new Event("focus")); doc.dispatchEvent(new Event("visibilitychange")); expect(hidden.refresh).not.toHaveBeenCalled();
    hidden.stop(); doc.visibilityState = "visible"; const disabled = mount(false);
    await vi.advanceTimersByTimeAsync(60_000); browser.dispatchEvent(new Event("focus")); expect(disabled.refresh).not.toHaveBeenCalled();
  });
});
