import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { reconcileChartOrderConfirmationRows } from "../src/features/chart/chart-order-confirmation-readback";

const source = readFileSync("src/features/chart/module.tsx", "utf8");
const ast = ts.createSourceFile("chart.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function extract(name: string) {
  let text = "";
  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) text = node.getText(ast);
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) text = `const ${node.getText(ast)};`;
    ts.forEachChild(node, visit);
  }
  visit(ast);
  expect(text).not.toBe("");
  return ts.transpileModule(`${text}\n${name};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, jsxFactory: "element" },
  }).outputText;
}

const order = { id: "order-a", workspaceId: "workspace-a", encounterId: "encounter-a", displayName: "초진", updatedAt: "2026-09-07" };
const plan = { snapshotSchemaVersion: 1, workspaceId: order.workspaceId, encounterId: order.encounterId, orderId: order.id, revisionNo: 1 };
function history({ tasks = [], workspaceId = order.workspaceId, hash = null }: { tasks?: unknown[]; workspaceId?: string; hash?: string | null } = {}) {
  const render = runInNewContext(extract("ChartOrderHistorySheet"), {
    element: (_tag: unknown, _props: unknown, ...children: unknown[]) => children.flat(Infinity).filter((value) => typeof value === "string" || typeof value === "number").join(" "),
    ...Object.fromEntries(["Sheet", "SheetContent", "SheetHeader", "SheetTitle", "SheetDescription", "Badge", "ChartActualHistory", "ChartRoutedExecutionActions", "ChartOrderRevisionHistoryItem", "ChartOrderTaskEventHistoryItem"].map((name) => [name, name])),
    getChartOrderStatusLabel: () => "확정", getShortDateTime: (value: string) => value,
    getUniversalTaskStatusLabel: () => "완료", isRecordValue: (value: unknown) => Boolean(value && typeof value === "object"), isChartActualType: () => false,
  });
  return render({ workspaceId: order.workspaceId, open: true, onOpenChange: () => {}, onExecutionSaved: async () => {}, row: { order, runtimeRow: { revisionNo: 1, snapshotHash: hash } }, execution: { workspaceId, encounterId: order.encounterId, tasks, events: [], revisions: [], queues: [], billingCandidates: [] } }) as string;
}
const task = { taskId: "task-a", orderId: order.id, attemptNo: 1, taskRole: "execution", clinicalOrderType: "consultation", effectiveSnapshot: plan, updatedAt: "2026-09-07" };

test("catalog individual with no B3 hash still shows its scoped execution plan", () => {
  const text = history({ tasks: [task] });
  expect(text).toContain("수행 계획 snapshot");
  expect(text).toContain("Task 계획 보관됨");
  expect(text).not.toContain("legacy snapshot입니다");
});

test("missing task and legacy plans do not claim a stored execution plan", () => {
  expect(history()).toContain("수행 계획 snapshot을 확인하지 못했어요");
  expect(history({ tasks: [{ ...task, effectiveSnapshot: { legacyBackfill: true } }] })).not.toContain("Task 계획 보관됨");
});

for (const boundary of ["workspace", "order", "plan"] as const) {
  test(`history does not borrow a ${boundary}-mismatched plan`, () => {
    const text = history({ workspaceId: boundary === "workspace" ? "foreign" : order.workspaceId, tasks: [{ ...task, orderId: boundary === "order" ? "foreign" : order.id, effectiveSnapshot: boundary === "plan" ? { ...plan, workspaceId: "foreign" } : plan }] });
    expect(text).not.toContain("Task 계획 보관됨");
  });
}

test("B3 applied hash is labelled separately, never invented as confirmed hash", () => {
  const text = history({ hash: "set-applied-hash" });
  expect(text).toContain("세트 적용 hash set-applied-hash");
  expect(text).not.toContain("Task 계획 보관됨");
});

async function applyConfirmation(readback: Record<string, unknown>, withChild = false) {
  const original = { ...order, orderId: order.id, workspaceId: order.workspaceId, encounterId: order.encounterId, revisionNo: 0, orderConfirmationStatus: "confirmed" };
  const confirmedRows = withChild
    ? [original, { ...original, orderId: "selected-child", parentOrderId: order.id }]
    : [original];
  let rows = [...confirmedRows, { ...original, orderId: "untouched", revisionNo: 4 }];
  let pending: unknown = { command: "already-confirmed" };
  const errors: string[] = [];
  const states: string[] = [];
  const orderDraftEtagRef = { current: "old" };
  const etagUpdates: string[] = [];
  let readCount = 0;
  const apply = runInNewContext(extract("applyConfirmedResult"), {
    reconcileChartOrderConfirmationRows,
    bundle: { encounter: { id: order.encounterId, workspaceId: order.workspaceId } }, actorHeaders: undefined,
    acceptAuthoritativeBillingSummary: () => true, refreshBillingSummary: async () => true,
    loadChartOrderActions: async () => { readCount += 1; return readback; },
    applyPersistedOrderActions: (current: typeof rows, snapshots: typeof rows) => current.map((row) => snapshots.find((snapshot) => snapshot.orderId === row.orderId) ?? row),
    applyBillingCandidatesToOrderRows: (value: unknown) => value,
    setCommittedRows: () => {}, setDraftRows: (updater: (current: typeof rows) => typeof rows) => { rows = updater(rows); },
    orderDraftEtagRef, setOrderDraftEtag: (value: string) => etagUpdates.push(value),
    pendingConfirmationRef: { get current() { return pending; }, set current(value: unknown) { pending = value; } },
    confirmationSource: "selection",
    setConfirmationOrderIds: () => {}, setConfirmationSource: () => {},
    setSelectedOrderIds: () => {}, setOrderActionDialog: () => {}, setOrderDraftSaveState: (value: string) => states.push(value),
    refreshOrderExecution: async () => {}, toast: { success: () => {}, error: (value: string) => errors.push(value) }, onNavigateToDispensing: undefined,
  });
  const ok = await apply({ rows: confirmedRows, orderActions: [{ orderId: order.id }], billingCandidates: [], billingSummary: {}, etag: "confirmed-etag", tasks: [] }, [order.id]);
  return { ok, rows, pending, errors, states, readCount, etag: orderDraftEtagRef.current, etagUpdates };
}

test("confirmation hydrates fresh revision without changing other local rows", async () => {
  const result = await applyConfirmation({ ok: true, rows: [{ ...order, orderId: order.id, revisionNo: 1, orderConfirmationStatus: "confirmed" }, { ...order, orderId: "untouched", revisionNo: 9 }] });
  expect(result.rows.map((row) => row.revisionNo)).toEqual([1, 4]);
  expect(result.readCount).toBe(1);
  expect(result.pending).toBeNull();
});

test("failed history refresh never changes a successful confirmation into failure or retry", async () => {
  const result = await applyConfirmation({ ok: false, status: 500, error: "db_read_failed" });
  expect(result.ok).toBe(true);
  expect(result.pending).toBeNull();
  expect(result.errors).toEqual([]);
  expect(result.states).toEqual(["saved"]);
  expect(result.rows[0].revisionNo).toBe(0);
});

test("fresh action rows from another workspace cannot hydrate confirmation", async () => {
  const result = await applyConfirmation({ ok: true, rows: [{ ...order, workspaceId: "foreign", orderId: order.id, revisionNo: 99, orderConfirmationStatus: "confirmed" }] });
  expect(result.rows[0].revisionNo).toBe(0);
  expect(result.ok).toBe(true);
});

test("selected root children hydrate from the same scoped action readback", async () => {
  const result = await applyConfirmation({ ok: true, rows: [
    { ...order, orderId: order.id, revisionNo: 1, orderConfirmationStatus: "confirmed" },
    { ...order, orderId: "selected-child", parentOrderId: order.id, revisionNo: 2, orderConfirmationStatus: "confirmed" },
  ] }, true);
  expect(result.rows.map((row) => [row.orderId, row.revisionNo])).toEqual([
    [order.id, 1], ["selected-child", 2], ["untouched", 4],
  ]);
});

test("a matching child ID from a different parent cannot hydrate confirmation", async () => {
  const result = await applyConfirmation({ ok: true, rows: [
    { ...order, orderId: "selected-child", parentOrderId: "other-parent", revisionNo: 99, orderConfirmationStatus: "confirmed" },
  ] }, true);
  expect(result.rows.find((row) => row.orderId === "selected-child")?.revisionNo).toBe(0);
  expect(result.ok).toBe(true);
});

test("neither root nor selected child from another encounter can hydrate confirmation", async () => {
  const result = await applyConfirmation({ ok: true, rows: [
    { ...order, encounterId: "other-encounter", orderId: order.id, revisionNo: 98, orderConfirmationStatus: "confirmed" },
    { ...order, encounterId: "other-encounter", orderId: "selected-child", parentOrderId: order.id, revisionNo: 99, orderConfirmationStatus: "confirmed" },
  ] }, true);
  expect(result.rows.map((row) => row.revisionNo)).toEqual([0, 0, 4]);
  expect(result.ok).toBe(true);
});

test("history hydration preserves the confirmation ETag rather than adopting unrelated readback changes", async () => {
  const result = await applyConfirmation({ ok: true, etag: "newer-readback-etag", rows: [
    { ...order, orderId: order.id, revisionNo: 1, orderConfirmationStatus: "confirmed" },
  ] });
  expect(result.rows[0].revisionNo).toBe(1);
  expect(result.etag).toBe("confirmed-etag");
  expect(result.etagUpdates).toEqual(["confirmed-etag"]);
});
