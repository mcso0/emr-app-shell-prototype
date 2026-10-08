import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { classifyChartOrderSaveFailure } from "../src/features/chart/chart-order-save-failure-decision";
import {
  getChartOrderDraftInFlightSave,
  registerChartOrderDraftSaveOperation,
} from "../src/features/chart/chart-order-draft-save-operation";

// Execute the caller's real save/flush expressions with synthetic refs and I/O.
// This characterizes ownership; it does not simulate React or timer scheduling.
const source = readFileSync("src/features/chart/module.tsx", "utf8");
const ast = ts.createSourceFile("chart.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const orderArea = ast.statements.find((node): node is ts.FunctionDeclaration =>
  ts.isFunctionDeclaration(node) && node.name?.text === "OrderArea",
);
if (!orderArea) throw new Error("OrderArea source is required for characterization");

function variableExpression(name: string) {
  let expression: ts.Expression | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) {
      if (expression) throw new Error(`ambiguous caller variable: ${name}`);
      expression = node.initializer;
    }
    ts.forEachChild(node, visit);
  };
  visit(orderArea!);
  if (!expression) throw new Error(`missing caller variable: ${name}`);
  return expression.getText(ast);
}

function conditionsContaining(fragment: string) {
  const conditions: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isIfStatement(node) && node.expression.getText(ast).includes(fragment)) {
      conditions.push(node.expression.getText(ast));
    }
    ts.forEachChild(node, visit);
  };
  visit(orderArea!);
  return conditions;
}

const commitExpression = variableExpression("commitDraftRows");
const markExpression = variableExpression("markDraftTouched");
const flushExpression = variableExpression("flush");
const ref = <T,>(current: T) => ({ current });
type Row = { order: { id: string; originChartId: string }; quantityInput: string; runtimeRow?: { parentOrderId?: string } };
type SaveResult = { ok: false; status: number; error?: string; denialReason?: string } | { ok: true; status: number; etag?: string; billingSummary?: { workspaceId: string; encounterId: string } };
type Request = { chartId: string; encounterId: string; workspaceId: string; expectedEtag: string; rows: Row[]; removedOrderIds: string[] };
const row = (quantityInput = "2", id = "synthetic-order-a"): Row => ({ order: { id, originChartId: "synthetic-chart-a" }, quantityInput });
const failure: SaveResult = { ok: false, status: 503, error: "db_write_failed" };
const success: SaveResult = { ok: true, status: 200, etag: '"synthetic-a1"', billingSummary: { workspaceId: "synthetic-workspace", encounterId: "synthetic-encounter-a" } };

function harness() {
  const requests: Request[] = [];
  const responses: Array<(result: SaveResult) => void> = [];
  const notices: string[] = [];
  const context = {
    writeDisabled: false, draftWriteDisabled: false, orderDraftReadError: false,
    orderDraftSaveState: "idle", mutationChartId: "synthetic-chart-a", actorHeaders: undefined,
    bundle: { encounter: { id: "synthetic-encounter-a", workspaceId: "synthetic-workspace", primaryVeterinarianId: "synthetic-vet" } },
    draftRowsRef: ref([row()]), draftTouchedRef: ref(true), draftEditVersionRef: ref(1),
    draftSaveDelayMsRef: ref(800), orderDraftFailedAutoSaveVersionRef: ref<number | null>(null),
    orderDraftConflictRef: ref(false), orderDraftSaveInFlightRef: ref(false),
    orderDraftSavePromiseRef: ref<Promise<boolean> | null>(null), orderDraftEtagRef: ref<string | undefined>('"synthetic-a0"'),
    pendingRemovedRootOrderIdsRef: ref(new Set<string>()), pendingAddedOrderIdsRef: ref(new Set<string>()),
    inFlightDraftOrderIdsRef: ref(new Set<string>()), orderSwitchBlockedRef: ref(false),
    prebillingSavingOrderIdsRef: ref(new Set<string>()), actualDispenseSavingOrderIdsRef: ref(new Set<string>()), intendedAssigneeSavingOrderIdsRef: ref(new Set<string>()),
    autoSaveDraftRef: ref<() => Promise<boolean>>(async () => false),
    chartOrderContinuousSaveDelayMs: 800, chartOrderDiscreteSaveDelayMs: 0,
    committedRows: [row("1")], billingRefreshes: 0,
    classifyChartOrderSaveFailure,
    getChartOrderDraftInFlightSave,
    registerChartOrderDraftSaveOperation,
    prepareChartOrderDraftRowsForPersistence: (rows: Row[]) => ({ rows, orderIdMap: new Map() }),
    createChartOrderDraftId: () => { throw new Error("fixture identities must remain unchanged"); },
    remapChartOrderIdSet: (ids: Set<string>) => ids,
    mergeChartOrderDraftRowsAfterSave: (rows: Row[]) => rows,
    applyPersistedOrderDrafts: (rows: Row[]) => rows,
    getChartOrderPersistenceErrorMessage: (error?: string) => error ?? "generic failure",
    toast: { error: (message: string) => notices.push(message), success: (message: string) => notices.push(message) },
    refreshBillingSummary: () => { context.billingRefreshes += 1; return Promise.resolve(true); },
    acceptAuthoritativeBillingSummary: (summary: { workspaceId: string; encounterId: string }) => summary.workspaceId === context.bundle.encounter.workspaceId && summary.encounterId === context.bundle.encounter.id,
    setOrderDraftSaveState: (state: string) => { context.orderDraftSaveState = state; },
    setOrderDraftEtag: () => {}, setPendingRemovedRootOrderIds: () => {}, setSelectedOrderIds: () => {},
    setCommittedRows: (rows: Row[]) => { context.committedRows = rows; },
    setDraftRows: (next: Row[] | ((rows: Row[]) => Row[])) => { context.draftRowsRef.current = typeof next === "function" ? next(context.draftRowsRef.current) : next; },
    saveChartOrderDraftRoute: (input: Request) => { requests.push(input); return new Promise<SaveResult>(resolve => responses.push(resolve)); },
  };
  const compiled = ts.transpileModule(
    `globalThis.api = { commit: ${commitExpression}, mark: ${markExpression}, flush: ${flushExpression} };`,
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  const api = runInNewContext(compiled, context) as {
    commit: (options?: { silent?: boolean }) => Promise<boolean>;
    mark: (timing?: "continuous" | "discrete") => void;
    flush: () => Promise<boolean>;
  };
  context.autoSaveDraftRef.current = () => api.commit({ silent: true });
  return { api, context, requests, responses, notices };
}

test("failure records the attempted version while preserving edits made during the request", async () => {
  const h = harness();
  const pending = h.api.commit({ silent: true });
  h.context.draftRowsRef.current = [row("3")];
  h.api.mark();
  h.responses[0](failure);
  expect(await pending).toBe(false);
  expect(h.context.draftRowsRef.current[0].quantityInput).toBe("3");
  expect(h.context.draftEditVersionRef.current).toBe(2);
  expect(h.context.orderDraftFailedAutoSaveVersionRef.current).toBe(1);
  expect(h.context.draftTouchedRef.current).toBe(true);
  expect(h.context.orderDraftEtagRef.current).toBe('"synthetic-a0"');
  expect(h.context.committedRows[0].quantityInput).toBe("1");
  expect(h.requests).toHaveLength(1);
});

test("a new edit clears a failed marker without clearing the revision conflict lock", async () => {
  const h = harness();
  const pending = h.api.commit({ silent: true });
  h.responses[0]({ ok: false, status: 409, denialReason: "revision_conflict" });
  expect(await pending).toBe(false);
  expect(h.context.orderDraftConflictRef.current).toBe(true);
  expect(h.context.orderDraftSaveState).toBe("conflict");
  expect(h.context.billingRefreshes).toBe(1);
  h.api.mark();
  expect(h.context.orderDraftFailedAutoSaveVersionRef.current).toBeNull();
  expect(h.context.orderDraftConflictRef.current).toBe(true);
  expect(await h.api.commit()).toBe(false);
  expect(h.requests).toHaveLength(1);
  expect(h.context.draftRowsRef.current[0].quantityInput).toBe("2");
});

test("shared pending save fails a chart-switch flush without starting another request", async () => {
  const h = harness();
  const pending = h.api.commit({ silent: true });
  expect(h.api.commit()).toBe(pending);
  const flush = h.api.flush();
  h.responses[0](failure);
  expect(await pending).toBe(false);
  expect(await flush).toBe(false);
  expect(h.requests).toHaveLength(1);
  expect(h.requests[0]).toMatchObject({ chartId: "synthetic-chart-a", encounterId: "synthetic-encounter-a", workspaceId: "synthetic-workspace", expectedEtag: '"synthetic-a0"' });
  expect(h.context.orderDraftSavePromiseRef.current).toBeNull();
  expect(h.context.orderDraftSaveInFlightRef.current).toBe(false);
});

test("explicit retry can save the same failed version using the original scope and ETag", async () => {
  const h = harness();
  const first = h.api.commit({ silent: true });
  h.responses[0](failure);
  expect(await first).toBe(false);
  const retry = h.api.commit();
  expect(h.requests).toHaveLength(2);
  expect(h.requests[1]).toEqual(h.requests[0]);
  h.responses[1](success);
  expect(await retry).toBe(true);
  expect(h.context.orderDraftFailedAutoSaveVersionRef.current).toBeNull();
  expect(h.context.orderDraftEtagRef.current).toBe('"synthetic-a1"');
});

test("missing ETag reports an error before a request and does not record a failed version", async () => {
  const h = harness();
  h.context.orderDraftEtagRef.current = undefined;
  expect(await h.api.commit()).toBe(false);
  expect(h.requests).toHaveLength(0);
  expect(h.context.draftTouchedRef.current).toBe(true);
  expect(h.context.orderDraftFailedAutoSaveVersionRef.current).toBeNull();
  expect(h.context.orderDraftSaveState).toBe("error");
});

test("wrong encounter billing summary keeps pending changes and the old ETag on a successful response", async () => {
  const h = harness();
  h.context.pendingAddedOrderIdsRef.current.add("synthetic-order-a");
  h.context.pendingRemovedRootOrderIdsRef.current.add("synthetic-old-root");
  const pending = h.api.commit({ silent: true });
  h.responses[0]({ ...success, billingSummary: { workspaceId: "synthetic-workspace", encounterId: "synthetic-encounter-b" } });
  expect(await pending).toBe(false);
  expect(h.context.orderDraftFailedAutoSaveVersionRef.current).toBe(1);
  expect(h.context.draftTouchedRef.current).toBe(true);
  expect(h.context.orderDraftEtagRef.current).toBe('"synthetic-a0"');
  expect([...h.context.pendingAddedOrderIdsRef.current]).toEqual(["synthetic-order-a"]);
  expect([...h.context.pendingRemovedRootOrderIdsRef.current]).toEqual(["synthetic-old-root"]);
  expect(h.context.committedRows[0].quantityInput).toBe("1");
});

test("failed in-flight addition removed locally cleans only its root and child pending removal", async () => {
  const h = harness();
  h.context.pendingAddedOrderIdsRef.current.add("synthetic-order-a");
  h.context.draftRowsRef.current.push({ ...row("1", "synthetic-child"), runtimeRow: { parentOrderId: "synthetic-order-a" } }, row("1", "synthetic-kept"));
  const pending = h.api.commit({ silent: true });
  h.context.pendingRemovedRootOrderIdsRef.current.add("synthetic-order-a");
  h.context.pendingRemovedRootOrderIdsRef.current.add("synthetic-other-root");
  h.responses[0](failure);
  expect(await pending).toBe(false);
  expect(h.context.draftRowsRef.current.map(value => value.order.id)).toEqual(["synthetic-kept"]);
  expect([...h.context.pendingRemovedRootOrderIdsRef.current]).toEqual(["synthetic-other-root"]);
  expect([...h.context.pendingAddedOrderIdsRef.current]).toEqual(["synthetic-order-a"]);
  expect(h.notices).toContain("db_write_failed");
});

test("both real autosave gates block the failed version and permit a later edit version", async () => {
  const h = harness();
  const gates = conditionsContaining("orderDraftFailedAutoSaveVersionRef.current");
  expect(gates).toHaveLength(2);
  const blocked = () => gates.map(condition => runInNewContext(`Boolean(${condition})`, {
    ...h.context, canUpdateOrders: true, orderDraftEtag: h.context.orderDraftEtagRef.current,
  }));
  const pending = h.api.commit({ silent: true });
  h.responses[0](failure);
  expect(await pending).toBe(false);
  expect(blocked()).toEqual([true, true]);
  // An edit made while the failed request was pending is already a newer version.
  h.context.draftEditVersionRef.current = 2;
  expect(blocked()).toEqual([false, false]);
  h.context.draftEditVersionRef.current = 1;
  h.api.mark();
  expect(blocked()).toEqual([false, false]);
  expect(h.requests).toHaveLength(1);
});

test("pending confirmation reuse requires unchanged edits, ETag and order selection", () => {
  const conditions = conditionsContaining("pendingConfirmation.expectedEtag");
  expect(conditions).toHaveLength(1);
  const sameSelection = ast.statements.find((node): node is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(node) && node.name?.text === "hasSameChartOrderSelection",
  );
  if (!sameSelection) throw new Error("selection comparison source is required");
  const scope = {
    pendingConfirmation: { expectedEtag: '"synthetic-a0"', orderIds: ["synthetic-order-a"] },
    draftTouchedRef: ref(false), orderDraftEtagRef: ref('"synthetic-a0"'), selectedRootOrderIds: ["synthetic-order-a"],
  };
  const evaluate = () => runInNewContext(ts.transpileModule(
    `${sameSelection.getText(ast)}\nBoolean(${conditions[0]});`,
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
  ).outputText, scope);
  expect(evaluate()).toBe(true);
  scope.draftTouchedRef.current = true;
  expect(evaluate()).toBe(false);
  scope.draftTouchedRef.current = false;
  scope.orderDraftEtagRef.current = '"synthetic-a1"';
  expect(evaluate()).toBe(false);
  scope.orderDraftEtagRef.current = '"synthetic-a0"';
  scope.selectedRootOrderIds = ["synthetic-order-b"];
  expect(evaluate()).toBe(false);
});
