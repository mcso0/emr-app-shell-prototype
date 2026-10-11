import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { test } from "@playwright/test";
import ts from "typescript";

// Execute the real hook callbacks and effects with controlled network completion.
const source = readFileSync("src/features/lab-imaging/module.tsx", "utf8");
const ast = ts.createSourceFile("module.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = new Set(["fulfillmentQueueCache", "fulfillmentQueueRequests", "fulfillmentQueueListeners", "emptyFulfillmentQueueSnapshot", "getFulfillmentQueueCacheKey", "setCachedFulfillmentQueue", "useFulfillmentQueue"]);
const extracted = ast.statements.filter(node => ts.isFunctionDeclaration(node) ? names.has(node.name?.text ?? "") : ts.isVariableStatement(node) && node.declarationList.declarations.some(declaration => names.has(declaration.name.getText(ast)))).map(node => node.getText(ast)).join("\n");
const script = ts.transpileModule(extracted + "\nexports.useQueue = useFulfillmentQueue; exports.cache = fulfillmentQueueCache; exports.pending = fulfillmentQueueRequests; exports.listeners = fulfillmentQueueListeners; exports;", { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
type Snapshot = { workItems: { id: string }[]; status?: string };
function harness() {
  let workspace = "synthetic-a";
  let visible = true;
  let effects: (() => (() => void) | void)[] = [];
  let state: { snapshot: Snapshot; status: string };
  const reads: { url: string; signal: AbortSignal; finish: (status: number, body: unknown) => void }[] = [];
  const bindings = {
    exports: {}, AbortController,
    useWorkspaceIdFromPath: () => workspace,
    useModuleSidePanel: () => ({ visible }),
    useRef: (current: unknown) => ({ current }),
    useState: (init: () => typeof state) => { state = init(); const owner = { value: state }; return [owner.value, (next: typeof state | ((old: typeof state) => typeof state)) => { owner.value = typeof next === "function" ? next(owner.value) : next; state = owner.value; }]; },
    useCallback: (callback: unknown) => callback,
    useEffect: (effect: () => (() => void) | void) => effects.push(effect),
    fetch: (url: string, options: { signal: AbortSignal }) => new Promise(resolve => reads.push({ url, signal: options.signal, finish: (status, body) => resolve({ status, ok: status === 200, json: async () => body }) })),
  };
  const api = runInNewContext(script, bindings);
  return {
    reads, api, get state() { return state; },
    mount: (options: { workspace?: string; visible?: boolean; date?: string; queue?: string; workItemId?: string; enabled?: boolean } = {}) => {
      workspace = options.workspace ?? "synthetic-a"; visible = options.visible ?? true; effects = [];
      const hook = api.useQueue(options.queue ?? "lab", options.date ?? "2026-10-11", options);
      const cleanups = effects.map(effect => effect());
      return { ...hook, dispose: () => cleanups.forEach(cleanup => cleanup?.()) };
    },
    settle: async () => { await new Promise(resolve => setTimeout(resolve, 0)); },
  };
}

test("same workspace/date/type consumers share a read until the last consumer leaves", async () => {
  const h = harness(); const a = h.mount(); const b = h.mount();
  assert.equal(h.reads.length, 1);
  a.dispose(); assert.equal(h.reads[0].signal.aborted, false);
  b.dispose(); assert.equal(h.reads[0].signal.aborted, true);
  h.reads[0].finish(200, { ok: true, workItems: [{ id: "stale" }] }); await h.settle();
  assert.equal(h.api.cache.size, 0); assert.equal(h.api.pending.size, 0); assert.equal(h.api.listeners.size, 0);
});

test("workspace, date, queue and selected item never share reads; hidden panels do not fetch", () => {
  const h = harness();
  const owners = [h.mount(), h.mount({ workspace: "synthetic-b" }), h.mount({ date: "2026-10-10" }), h.mount({ queue: "imaging" }), h.mount({ workItemId: "selected-item" }), h.mount({ visible: false }), h.mount({ enabled: false })];
  assert.equal(h.reads.length, 5);
  assert.ok(h.reads[4].url.includes("workItemId=selected-item"));
  owners.forEach(owner => owner.dispose()); assert.ok(h.reads.every(read => read.signal.aborted));
});

test("refresh supersedes a pre-mutation read and ignores its late result", async () => {
  const h = harness(); const owner = h.mount(); const refresh = owner.refresh();
  assert.equal(h.reads.length, 2); assert.equal(h.reads[0].signal.aborted, true);
  h.reads[1].finish(200, { ok: true, workItems: [{ id: "updated" }] }); await refresh;
  h.reads[0].finish(200, { ok: true, workItems: [{ id: "stale" }] }); await h.settle();
  assert.equal(h.state.snapshot.workItems[0].id, "updated"); owner.dispose();
});

test("permission denial drops previously cached rows, and final cleanup evicts completed data", async () => {
  const h = harness(); const owner = h.mount();
  h.reads[0].finish(200, { ok: true, workItems: [{ id: "previous" }] }); await h.settle();
  assert.equal(h.api.cache.size, 1);
  const refresh = owner.refresh(); h.reads[1].finish(403, {}); await refresh;
  assert.equal(h.state.status, "permission_denied"); assert.equal(h.state.snapshot.workItems.length, 0);
  owner.dispose(); assert.equal(h.api.cache.size, 0);
});
