import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { Script } from "node:vm";
import ts from "typescript";
import { remapChartOrderIdSet } from "../src/features/chart/chart-order-draft-identity";
import { mergeChartOrderDraftRowsAfterSave } from "../src/features/chart/chart-order-draft-response-merge";
import {
  getChartOrderDraftInFlightSave,
  registerChartOrderDraftSaveOperation,
} from "../src/features/chart/chart-order-draft-save-operation";
import { classifyChartOrderSaveFailure } from "../src/features/chart/chart-order-save-failure-decision";

// Execute the caller's current callbacks, following the repo's AST/VM convention.
// This fake effect lifecycle is explicit; it does not mount React or prove browser ordering.
const source = readFileSync("src/features/chart/module.tsx", "utf8");
const file = ts.createSourceFile("module.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const orderArea = file.statements.find((node): node is ts.FunctionDeclaration =>
  ts.isFunctionDeclaration(node) && node.name?.text === "OrderArea");
if (!orderArea?.body) throw new Error("OrderArea source not found");
const statements = orderArea.body.statements;
function variable(name: string) {
  const declaration = statements.flatMap(statement => ts.isVariableStatement(statement)
    ? [...statement.declarationList.declarations] : []).find(node => node.name.getText(file) === name);
  if (!declaration?.initializer) throw new Error(`Missing OrderArea callback: ${name}`);
  return declaration.initializer.getText(file);
}
function effect(marker: string, hook = "useEffect") {
  const callbacks = statements.flatMap(statement => {
    if (!ts.isExpressionStatement(statement) || !ts.isCallExpression(statement.expression)) return [];
    const call = statement.expression;
    return call.expression.getText(file) === hook && call.arguments[0]?.getText(file).includes(marker)
      ? [call.arguments[0].getText(file)] : [];
  });
  if (callbacks.length !== 1) throw new Error(`Expected one ${hook} callback for ${marker}`);
  return callbacks[0];
}
function evaluate<T>(expression: string, context: Record<string, unknown>): T {
  const compiled = ts.transpileModule(`(${expression})`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  return new Script(compiled).runInNewContext(context) as T;
}
const timerEffect = effect("}, draftSaveDelayMsRef.current);");
const registrationEffect = effect("flushOrderEdits: flush");
const blockerEffect = effect("orderSwitchBlockedRef.current =", "useLayoutEffect");
const loadEffect = effect("async function loadPersistedOrderDrafts()");
const ref = <T,>(current: T) => ({ current });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
async function drainMicrotasks() {
  for (let turn = 0; turn < 8; turn += 1) await Promise.resolve();
}

class Clock {
  now = 0;
  nextId = 0;
  tasks = new Map<number, { at: number; run: () => void }>();
  setTimeout = (run: () => void, delay: number) => {
    const id = ++this.nextId;
    this.tasks.set(id, { at: this.now + delay, run });
    return id;
  };
  clearTimeout = (id: number) => { this.tasks.delete(id); };
  advance(ms: number) {
    const end = this.now + ms;
    while (true) {
      const next = [...this.tasks].filter(([, task]) => task.at <= end)
        .sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (!next) break;
      this.now = next[1].at;
      this.tasks.delete(next[0]);
      next[1].run();
    }
    this.now = end;
  }
}
type SaveState = "idle" | "loading" | "saving" | "saved" | "error" | "conflict";
type Row = {
  order: { id: string }; quantityInput: string; billingName: string;
  detailInputs: Record<string, unknown>; detailSchemaVersion: number; priority: "normal";
};
const row = (quantityInput = "1"): Row => ({
  order: { id: "synthetic-order-a" }, quantityInput, billingName: "Synthetic order",
  detailInputs: {}, detailSchemaVersion: 1, priority: "normal",
});
type Reply = { ok: boolean; status?: number; error?: string; etag?: string; rows?: Row[]; billingSummary?: object };
function harness() {
  const clock = new Clock();
  const states: SaveState[] = [];
  const errors: string[] = [];
  const events: string[] = [];
  const listeners = new Set<(event: { preventDefault: () => void; returnValue?: string }) => void>();
  const store: { flushOrderEdits?: () => Promise<boolean> } = {};
  const calls: Array<{ input: { expectedEtag: string; rows: Row[] }; reply: ReturnType<typeof deferred<Reply>> }> = [];
  let committed: Row[] = [];
  const context = {
    chartOrderDiscreteSaveDelayMs: 150, chartOrderContinuousSaveDelayMs: 700,
    writeDisabled: false, draftWriteDisabled: false, orderDraftReadError: false,
    canUpdateOrders: true, orderDraftEtag: "etag-a0", orderDraftSaveState: "idle" as SaveState,
    draftRowsRef: ref([row()]), draftTouchedRef: ref(false), draftEditVersionRef: ref(0),
    draftSaveDelayMsRef: ref(700), orderDraftFailedAutoSaveVersionRef: ref<number | null>(null),
    orderDraftConflictRef: ref(false), orderDraftSaveInFlightRef: ref(false),
    orderDraftSavePromiseRef: ref<Promise<boolean> | null>(null),
    autoSaveDraftRef: ref<() => Promise<boolean>>(async () => false), orderDraftEtagRef: ref<string | undefined>("etag-a0"),
    inFlightDraftOrderIdsRef: ref(new Set<string>()), pendingAddedOrderIdsRef: ref(new Set<string>()),
    pendingRemovedRootOrderIdsRef: ref(new Set<string>()), orderSwitchBlockedRef: ref(false),
    prebillingSavingOrderIdsRef: ref(new Set<string>()), actualDispenseSavingOrderIdsRef: ref(new Set<string>()),
    intendedAssigneeSavingOrderIdsRef: ref(new Set<string>()), orderMutationDraft: null as { saving: boolean } | null,
    mutationChartId: "synthetic-chart-a", actorHeaders: {},
    bundle: { encounter: { id: "synthetic-encounter-a", workspaceId: "synthetic-workspace" } },
    window: {
      setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
      addEventListener: (_name: string, listener: (event: { preventDefault: () => void }) => void) => { listeners.add(listener); },
      removeEventListener: (_name: string, listener: (event: { preventDefault: () => void }) => void) => { listeners.delete(listener); },
    },
    toast: { error: (message: string) => errors.push(message), success: () => undefined },
    useChartStore: { getState: () => store, setState: (patch: object) => Object.assign(store, patch) },
    setOrderDraftSaveState: (state: SaveState) => { context.orderDraftSaveState = state; states.push(state); },
    setDraftRows: (next: Row[] | ((current: Row[]) => Row[])) => {
      context.draftRowsRef.current = typeof next === "function" ? next(context.draftRowsRef.current) : next;
    },
    setCommittedRows: (rows: Row[]) => { committed = rows; events.push("commit"); },
    setOrderDraftEtag: (etag: string) => { context.orderDraftEtag = etag; },
    setPendingRemovedRootOrderIds: () => undefined,
    prepareChartOrderDraftRowsForPersistence: (rows: Row[]) => ({ rows, orderIdMap: new Map() }),
    createChartOrderDraftId: () => { throw new Error("IDs are already prepared in this synthetic harness"); },
    applyPersistedOrderDrafts: (_rows: Row[], persisted: Row[]) => persisted,
    mergeChartOrderDraftRowsAfterSave,
    remapChartOrderIdSet,
    getChartOrderDraftInFlightSave,
    registerChartOrderDraftSaveOperation,
    classifyChartOrderSaveFailure,
    acceptAuthoritativeBillingSummary: () => { events.push("summary"); return true; },
    refreshBillingSummary: async () => { events.push("refresh-summary"); return true; },
    getChartOrderPersistenceErrorMessage: (error: string) => error,
    saveChartOrderDraftRoute: (input: { expectedEtag: string; rows: Row[] }) => {
      const reply = deferred<Reply>(); calls.push({ input, reply }); return reply.promise;
    },
  };
  const commit = (silent = true) => evaluate<(options: { silent: boolean }) => Promise<boolean>>(variable("commitDraftRows"), context)({ silent });
  context.autoSaveDraftRef.current = () => commit();
  const touch = (value = "2", timing: "continuous" | "discrete" = "continuous") => {
    context.draftRowsRef.current = [row(value)];
    evaluate<(timing: string) => void>(variable("markDraftTouched"), context)(timing);
  };
  const register = () => evaluate<() => () => void>(registrationEffect, context)();
  const renderTimer = () => evaluate<() => (() => void) | undefined>(timerEffect, context)();
  const succeed = (index: number, etag: string) => calls[index].reply.resolve({
    ok: true, etag, rows: calls[index].input.rows, billingSummary: {},
  });
  return { context, clock, states, errors, events, listeners, store, calls, commit, touch, register, renderTimer, succeed,
    get committed() { return committed; } };
}

test("continuous edits restart the trailing timer and discrete edits use 150ms", () => {
  const h = harness(); let saves = 0;
  h.context.autoSaveDraftRef.current = async () => { saves += 1; return true; };
  h.touch("2"); const cleanup = h.renderTimer();
  h.clock.advance(699); expect(saves).toBe(0);
  cleanup?.(); h.touch("3"); const continuousCleanup = h.renderTimer();
  h.clock.advance(699); expect(saves).toBe(0);
  h.clock.advance(1); expect(saves).toBe(1);
  continuousCleanup?.(); h.touch("4", "discrete"); h.renderTimer();
  h.clock.advance(149); expect(saves).toBe(1);
  h.clock.advance(1); expect(saves).toBe(2);
});

for (const guard of ["write-disabled", "no-saveable-changes", "no-etag", "loading", "saving", "in-flight", "same-failed-version", "clean"] as const) {
  test(`autosave schedules no timer when ${guard}`, () => {
    const h = harness(); h.touch();
    if (guard === "write-disabled") h.context.writeDisabled = true;
    if (guard === "no-saveable-changes") h.context.canUpdateOrders = false;
    if (guard === "no-etag") h.context.orderDraftEtag = "";
    if (guard === "loading" || guard === "saving") h.context.orderDraftSaveState = guard;
    if (guard === "in-flight") h.context.orderDraftSaveInFlightRef.current = true;
    if (guard === "same-failed-version") h.context.orderDraftFailedAutoSaveVersionRef.current = h.context.draftEditVersionRef.current;
    if (guard === "clean") h.context.draftTouchedRef.current = false;
    expect(h.renderTimer()).toBeUndefined(); expect(h.clock.tasks.size).toBe(0);
  });
}

for (const guard of ["clean", "in-flight", "same-failed-version"] as const) {
  test(`the timer rechecks ${guard} at firing time`, () => {
    const h = harness(); h.touch(); h.renderTimer();
    if (guard === "clean") h.context.draftTouchedRef.current = false;
    if (guard === "in-flight") h.context.orderDraftSaveInFlightRef.current = true;
    if (guard === "same-failed-version") h.context.orderDraftFailedAutoSaveVersionRef.current = h.context.draftEditVersionRef.current;
    h.clock.advance(700); expect(h.calls).toHaveLength(0);
  });
}

test("an immediate flush plus effect cleanup cancels the old debounce; unmount also cancels it", async () => {
  const h = harness(); h.touch(); const cleanup = h.renderTimer(); h.register();
  const pending = h.store.flushOrderEdits!(); cleanup?.();
  expect(h.calls).toHaveLength(1); h.clock.advance(1400); expect(h.calls).toHaveLength(1);
  h.succeed(0, "etag-a1"); expect(await pending).toBe(true);
  h.touch("3"); const unmount = h.renderTimer(); unmount?.();
  h.clock.advance(1400); expect(h.calls).toHaveLength(1);
});

test("repeated saves and navigation flushes wait for all newer edits and advance the ETag before S2", async () => {
  const h = harness(); h.touch(); h.register();
  const first = h.commit(); const repeated = h.commit();
  expect(repeated).toBe(first); expect(h.context.orderDraftSavePromiseRef.current).toBe(first);
  h.touch("3"); const navigations = [h.store.flushOrderEdits!(), h.store.flushOrderEdits!()];
  let navigationDone = false; void Promise.all(navigations).then(() => { navigationDone = true; });
  h.succeed(0, "etag-a1"); await drainMicrotasks();
  expect(h.calls).toHaveLength(2); expect(navigationDone).toBe(false);
  expect(h.calls.map(call => [call.input.expectedEtag, call.input.rows[0].quantityInput])).toEqual([["etag-a0", "2"], ["etag-a1", "3"]]);
  expect(h.context.draftRowsRef.current[0].quantityInput).toBe("3");
  h.succeed(1, "etag-a2"); expect(await first).toBe(true);
  expect(await Promise.all(navigations)).toEqual([true, true]);
  expect(h.events).toEqual(["summary", "commit", "summary", "commit"]);
  expect(h.context.orderDraftSavePromiseRef.current).toBeNull();
  expect(h.context.orderDraftSaveInFlightRef.current).toBe(false);
});

test("flush waits on a pending operation even when touched is currently false, then rechecks touched", async () => {
  const h = harness(); h.register(); const gate = deferred<boolean>();
  h.context.orderDraftSavePromiseRef.current = gate.promise;
  let autosaves = 0; h.context.autoSaveDraftRef.current = async () => { autosaves += 1; return true; };
  const pending = h.store.flushOrderEdits!(); await drainMicrotasks(); expect(autosaves).toBe(0);
  h.context.draftTouchedRef.current = true; gate.resolve(true);
  expect(await pending).toBe(true); expect(autosaves).toBe(1);
});

for (const blocker of ["switch", "prebilling", "actual-dispense", "assignee"] as const) {
  test(`flush blocks before waiting or saving when ${blocker} is active`, async () => {
    const h = harness(); h.touch(); h.register();
    if (blocker === "switch") h.context.orderSwitchBlockedRef.current = true;
    if (blocker === "prebilling") h.context.prebillingSavingOrderIdsRef.current.add("order");
    if (blocker === "actual-dispense") h.context.actualDispenseSavingOrderIdsRef.current.add("order");
    if (blocker === "assignee") h.context.intendedAssigneeSavingOrderIdsRef.current.add("order");
    expect(await h.store.flushOrderEdits!()).toBe(false); expect(h.calls).toHaveLength(0); expect(h.errors).toHaveLength(1);
  });
}

test("a mutation or saving state without a registered draft promise blocks switching", () => {
  const h = harness();
  const updateBlocker = () => evaluate<() => void>(blockerEffect, h.context)();
  h.context.orderMutationDraft = { saving: true }; updateBlocker(); expect(h.context.orderSwitchBlockedRef.current).toBe(true);
  h.context.orderMutationDraft = null; h.context.orderDraftSaveState = "saving";
  updateBlocker(); expect(h.context.orderSwitchBlockedRef.current).toBe(true);
  h.context.orderDraftSavePromiseRef.current = Promise.resolve(true);
  updateBlocker(); expect(h.context.orderSwitchBlockedRef.current).toBe(false);
});

for (const status of [409, 503]) {
  test(`${status} aborts the waiting flush and suppresses same-version autosave`, async () => {
    const h = harness(); h.touch(); h.register(); const pending = h.store.flushOrderEdits!();
    h.calls[0].reply.resolve({ ok: false, status, error: status === 409 ? "revision_conflict" : "db_write_failed" });
    expect(await pending).toBe(false); expect(h.context.draftRowsRef.current[0].quantityInput).toBe("2");
    expect(h.context.draftTouchedRef.current).toBe(true);
    expect(h.context.orderDraftFailedAutoSaveVersionRef.current).toBe(1);
    expect(h.context.orderDraftSaveState).toBe(status === 409 ? "conflict" : "error");
    expect(h.renderTimer()).toBeUndefined(); h.clock.advance(2100); expect(h.calls).toHaveLength(1);
    // A subsequent explicit navigation flush retries 503, just like the save button.
    // Conflict remains blocked by commitDraftRows even after a newer edit.
    const retry = h.store.flushOrderEdits!();
    if (status === 409) { expect(await retry).toBe(false); expect(h.calls).toHaveLength(1); }
    else { expect(h.calls).toHaveLength(2); h.succeed(1, "etag-a1"); expect(await retry).toBe(true); }
  });
}

test("a newer edit present at a 503 failure has a different version and can schedule another autosave", async () => {
  const h = harness(); h.touch(); const pending = h.commit(); h.touch("3");
  h.calls[0].reply.resolve({ ok: false, status: 503, error: "db_write_failed" });
  expect(await pending).toBe(false);
  expect(h.context.orderDraftFailedAutoSaveVersionRef.current).toBe(1);
  expect(h.context.draftEditVersionRef.current).toBe(2);
  h.renderTimer(); h.clock.advance(700); expect(h.calls).toHaveLength(2);
  expect(h.calls[1].input.rows[0].quantityInput).toBe("3");
  h.succeed(1, "etag-a1"); await drainMicrotasks();
});

test("a new edit clears version suppression while conflict keeps autosave and explicit commit blocked", async () => {
  const h = harness(); h.touch(); const pending = h.commit();
  h.calls[0].reply.resolve({ ok: false, status: 409, error: "revision_conflict" });
  expect(await pending).toBe(false); h.touch("3", "discrete");
  expect(h.context.orderDraftFailedAutoSaveVersionRef.current).toBeNull();
  expect(h.context.draftEditVersionRef.current).toBe(2);
  h.context.canUpdateOrders = evaluate<boolean>(variable("canUpdateOrders"), {
    hasDraftChanges: true, draftSaveInvalidOrderIds: new Set(), orderDraftSaveState: h.context.orderDraftSaveState,
  });
  expect(h.renderTimer()).toBeUndefined(); expect(await h.commit()).toBe(false);
  expect(h.calls).toHaveLength(1); expect(h.context.orderDraftSaveState).toBe("conflict");
});

test("a successful response without an accepted billing scope remains dirty and blocks flush", async () => {
  const h = harness(); h.touch(); h.register(); const pending = h.store.flushOrderEdits!();
  h.calls[0].reply.resolve({ ok: true, etag: "unaccepted-etag", rows: [row("2")] });
  expect(await pending).toBe(false); expect(h.committed).toEqual([]);
  expect(h.context.orderDraftEtagRef.current).toBe("etag-a0");
  expect(h.context.draftTouchedRef.current).toBe(true); expect(h.context.orderDraftSaveState).toBe("error");
});

test("the missing-ETag early return still unregisters the completed operation", async () => {
  const h = harness(); h.touch(); h.context.orderDraftEtagRef.current = undefined;
  const pending = h.commit(); expect(h.context.orderDraftSavePromiseRef.current).toBe(pending);
  expect(await pending).toBe(false); expect(h.calls).toHaveLength(0);
  expect(h.context.orderDraftSavePromiseRef.current).toBeNull();
  expect(h.context.orderDraftSaveInFlightRef.current).toBe(false); expect(h.context.draftTouchedRef.current).toBe(true);
});

test("registration cleanup removes its unload listener and cannot clear a newer patient's flush", () => {
  const h = harness(); const cleanupA = h.register(); const flushA = h.store.flushOrderEdits;
  const cleanupB = h.register(); const flushB = h.store.flushOrderEdits;
  expect(flushB).not.toBe(flushA); expect(h.listeners.size).toBe(2);
  cleanupA(); expect(h.store.flushOrderEdits).toBe(flushB); expect(h.listeners.size).toBe(1);
  cleanupB(); expect(h.store.flushOrderEdits).toBeUndefined(); expect(h.listeners.size).toBe(0);
});

test("beforeunload warns for touched or in-flight state and does not start an async flush", () => {
  const h = harness(); h.register();
  for (const [touched, inFlight, warned] of [[false, false, false], [true, false, true], [false, true, true]] as const) {
    h.context.draftTouchedRef.current = touched; h.context.orderDraftSaveInFlightRef.current = inFlight;
    let prevented = false; const event = { preventDefault: () => { prevented = true; }, returnValue: undefined as string | undefined };
    [...h.listeners][0](event); expect(prevented).toBe(warned); expect(event.returnValue).toBe(warned ? "" : undefined);
  }
  expect(h.calls).toHaveLength(0);
});

test("unregistering a patient does not abort its already-started save callback", async () => {
  const h = harness(); h.touch(); const cleanup = h.register(); const pending = h.commit();
  cleanup(); expect(h.store.flushOrderEdits).toBeUndefined();
  h.succeed(0, "etag-a1"); expect(await pending).toBe(true);
  expect(h.committed[0].quantityInput).toBe("2"); expect(h.context.orderDraftEtagRef.current).toBe("etag-a1");
  // These are detached session callbacks; React's keyed remount, not this cleanup, isolates new patient UI.
});

test("unmount before the initial draft read returns prevents late ETag and row application", async () => {
  const h = harness(); const read = deferred<Reply>();
  const context = { ...h.context, initialDraftRows: [row()],
    loadChartOrderDraft: () => read.promise,
    setOrderDraftReadError: () => undefined,
  };
  const cleanup = evaluate<() => () => void>(loadEffect, context)(); cleanup();
  read.resolve({ ok: true, etag: "late-etag", rows: [row("9")] }); await drainMicrotasks();
  expect(h.context.orderDraftEtagRef.current).toBe("etag-a0"); expect(h.committed).toEqual([]);
});

const storeSource = readFileSync("src/features/chart/store.ts", "utf8");
const storeFile = ts.createSourceFile("store.ts", storeSource, ts.ScriptTarget.Latest, true);
function storeCallback(name: string) {
  let initializer: ts.Expression | undefined;
  function visit(node: ts.Node) {
    if (ts.isPropertyAssignment(node) && node.name.getText(storeFile) === name) initializer = node.initializer;
    ts.forEachChild(node, visit);
  }
  visit(storeFile); if (!initializer) throw new Error(`Missing chart store callback: ${name}`);
  return initializer.getText(storeFile);
}

test("store flush order is diagnosis guard, SOAP, orders, then diagnosis recheck", async () => {
  const events: string[] = []; const soap = deferred<boolean>(); const orders = deferred<boolean>();
  const state = { diagnosisSaving: false,
    flushActiveChart: () => { events.push("soap"); return soap.promise; },
    flushOrderEdits: () => { events.push("orders"); return orders.promise; },
  };
  const flush = evaluate<() => Promise<boolean>>(storeCallback("flushEditors"), { get: () => state });
  state.diagnosisSaving = true; expect(await flush()).toBe(false); expect(events).toEqual([]);
  state.diagnosisSaving = false; const pending = flush(); expect(events).toEqual(["soap"]);
  soap.resolve(true); await drainMicrotasks(); expect(events).toEqual(["soap", "orders"]);
  state.diagnosisSaving = true; orders.resolve(true); expect(await pending).toBe(false);
});

test("repeated encounter selection shares order saves but does not coalesce navigation continuations", async () => {
  const h = harness(); h.touch(); h.register();
  const state = { selectedEncounterId: "a", historyViewEncounterId: "", flushEditors: () => h.store.flushOrderEdits!() };
  const selected: string[] = [];
  const select = evaluate<(id: string) => Promise<void>>(storeCallback("selectEncounter"), {
    get: () => state, set: (patch: { selectedEncounterId: string }) => { selected.push(patch.selectedEncounterId); Object.assign(state, patch); },
  });
  const attempts = [select("b"), select("b")]; expect(selected).toEqual([]); expect(h.calls).toHaveLength(1);
  h.succeed(0, "etag-a1"); await Promise.all(attempts);
  expect(selected).toEqual(["b", "b"]); expect(h.calls).toHaveLength(1);
});

test("chart selection rechecks its scope after flush before changing the selected chart", async () => {
  const gate = deferred<boolean>(); const selected: object[] = [];
  const state = { selectedChartId: "chart-a", encounterChartsScope: "patient-a", encounterCharts: [{ id: "chart-b" }], flushEditors: () => gate.promise };
  const select = evaluate<(id: string) => Promise<void>>(storeCallback("selectChart"), {
    get: () => state, set: (patch: object) => selected.push(patch),
  });
  const pending = select("chart-b"); state.encounterChartsScope = "patient-b"; gate.resolve(true);
  await pending; expect(selected).toEqual([]);
});

test("confirmation waits for the draft promise and returns on a conflict before its action request", async () => {
  const h = harness(); const gate = deferred<boolean>(); let actions = 0;
  h.context.orderDraftSavePromiseRef.current = gate.promise;
  const context = { ...h.context, confirmationTargetOrderIds: new Set<string>(), confirmationInvalidOrderIds: new Set<string>(),
    confirmationSelectedOrderRows: [], saveChartOrderActionRoute: () => { actions += 1; throw new Error("unexpected confirm request"); },
  };
  const confirm = evaluate<() => Promise<void>>(variable("commitOrderConfirmation"), context);
  const repeated = [confirm(), confirm()]; await drainMicrotasks(); expect(actions).toBe(0);
  h.context.orderDraftConflictRef.current = true; gate.resolve(false); await Promise.all(repeated);
  expect(actions).toBe(0); expect(h.errors).toHaveLength(2);
});

test("a non-conflict failed pending save leaves confirmation's dedicated draft-save path reachable", async () => {
  const h = harness(); h.touch(); const gate = deferred<boolean>();
  h.context.orderDraftSavePromiseRef.current = gate.promise;
  const context = { ...h.context, pendingConfirmationRef: ref(null),
    confirmationTargetOrderIds: new Set(["synthetic-order-a"]), confirmationInvalidOrderIds: new Set<string>(),
    confirmationSelectedOrderRows: [row("2")], getChartOrderSelectionCohort: () => "draft",
    isChartOrderTopLevelRow: () => true, chartActualRecords: {},
  };
  const pending = evaluate<() => Promise<void>>(variable("commitOrderConfirmation"), context)();
  expect(h.calls).toHaveLength(0); gate.resolve(false); await drainMicrotasks();
  expect(h.calls).toHaveLength(1); expect(h.calls[0].input.expectedEtag).toBe("etag-a0");
  h.calls[0].reply.resolve({ ok: false, status: 503, error: "synthetic_unavailable" });
  await pending; expect(h.context.orderDraftSaveState).toBe("error");
});
