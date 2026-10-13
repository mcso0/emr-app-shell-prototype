import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { Script } from "node:vm";
import ts from "typescript";
import { mergeChartOrderDraftRowsAfterSave } from "../src/features/chart/chart-order-draft-response-merge";
import { isChartOrderDraftRowInRootIds } from "../src/features/chart/chart-order-draft-identity";

import type { ChartOrderSetSelectionIntent } from "../src/features/hospital-admin/server-order-catalog";
import type { ClinicalOrderPriority } from "../src/types/emr-domain";

type Row = {
  order: { id: string; status: string };
  billingName: string;
  committedBillingName: string;
  quantityInput: string;
  committedQuantityInput: string;
  detailInputs: Record<string, unknown>;
  detailSchemaVersion: number;
  priority: ClinicalOrderPriority;
  setSelectionIntent?: ChartOrderSetSelectionIntent;
  runtimeRow?: { parentOrderId?: string };
  serverRevision: number;
};
const source = readFileSync("src/features/chart/chart-order-draft-save-executor.ts", "utf8");
const file = ts.createSourceFile("module.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
// Execute the actual save executor predicate for the mounted editing session.
let removalPredicate: ts.ArrowFunction | undefined;
function visit(node: ts.Node) {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === "isAttemptedRemovalRow" && node.initializer && ts.isArrowFunction(node.initializer)) removalPredicate = node.initializer;
  ts.forEachChild(node, visit);
}
visit(file);
if (!removalPredicate) throw new Error("current_attempted_removal_predicate_not_found");
const compiled = ts.transpileModule("export function predicate(attemptedRemovedRootOrderIds) { return (" + removalPredicate.getText(file) + "); }", {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exports = {} as { predicate: (attempted: ReadonlySet<string>) => (row: Row) => boolean };
new Script(compiled).runInNewContext({ exports, isChartOrderDraftRowInRootIds });
const merge = (rows: readonly Row[], committed: ReadonlyMap<string, Row>, attempted: ReadonlySet<string>) =>
  mergeChartOrderDraftRowsAfterSave(rows, committed, exports.predicate(attempted));

function row(id: string, overrides: Partial<Row> = {}): Row {
  return { order: { id, status: "draft" }, billingName: id, committedBillingName: id, quantityInput: "1", committedQuantityInput: "1", detailInputs: { note: "original" }, detailSchemaVersion: 1, priority: "normal", serverRevision: 1, ...overrides };
}
const committedMap = (...rows: Row[]) => new Map(rows.map(value => [value.order.id, value]));

test("save response metadata is applied while all six newer editable values survive", () => {
  const current = row("edited", { billingName: "local name", quantityInput: "3", detailInputs: { note: "new edit" }, detailSchemaVersion: 2, priority: "urgent", setSelectionIntent: { items: [{ revisionItemId: "leaf", selected: false, quantity: 2 }] } });
  const server = row("edited", { order: { id: "edited", status: "pending" }, serverRevision: 4, committedBillingName: "server name", committedQuantityInput: "2", setSelectionIntent: { items: [] } });
  const [result] = merge([current], committedMap(server), new Set());
  expect(result).toEqual({ ...server, billingName: current.billingName, detailInputs: current.detailInputs, detailSchemaVersion: current.detailSchemaVersion, priority: current.priority, quantityInput: current.quantityInput, setSelectionIntent: current.setSelectionIntent });
  expect(result.order).toBe(server.order);
  expect(result.detailInputs).toBe(current.detailInputs);
  expect(result.setSelectionIntent).toBe(current.setSelectionIntent);
});

test("new unmatched local rows keep identity and current row order", () => {
  const first = row("first"), added = row("new"), last = row("last");
  const result = merge([first, added, last], committedMap(row("last"), row("first")), new Set());
  expect(result.map(value => value.order.id)).toEqual(["first", "new", "last"]);
  expect(result[1]).toBe(added);
});

test("attempted root deletions remove the root and its children but preserve unrelated children", () => {
  const root = row("removed"), child = row("child", { runtimeRow: { parentOrderId: "removed" } }), keep = row("keep", { runtimeRow: { parentOrderId: "other" } });
  const result = merge([root, child, keep], committedMap(root, child, keep), new Set(["removed"]));
  expect(result.map(value => value.order.id)).toEqual(["keep"]);
});

test("later pending deletions are not acknowledged by an earlier save snapshot", () => {
  const pending = new Set(["earlier"]), attempted = new Set(pending);
  pending.add("later");
  const later = row("later");
  const result = merge([row("earlier"), later], committedMap(later), attempted);
  expect(result.map(value => value.order.id)).toEqual(["later"]);
  expect([...attempted]).toEqual(["earlier"]);
  expect([...pending]).toEqual(["earlier", "later"]);
});

test("server-only rows are not appended to the latest local draft", () => {
  const current = row("local");
  expect(merge([current], committedMap(row("local"), row("server-only")), new Set()).map(value => value.order.id)).toEqual(["local"]);
  expect(merge([], committedMap(row("server-only")), new Set())).toEqual([]);
});

test("a cleared local selection intent stays undefined after the response", () => {
  const current = row("selection", { setSelectionIntent: undefined });
  const [result] = merge([current], committedMap(row("selection", { setSelectionIntent: { items: [] } })), new Set());
  expect(result.setSelectionIntent).toBeUndefined();
  expect(Object.hasOwn(result, "setSelectionIntent")).toBe(true);
});

test("merging does not mutate rows, objects, map or attempted deletion set", () => {
  const current = row("one"), server = row("one", { serverRevision: 3 });
  Object.freeze(current.detailInputs); Object.freeze(current.order); Object.freeze(current);
  Object.freeze(server.detailInputs); Object.freeze(server.order); Object.freeze(server);
  const rows = Object.freeze([current]), committed = committedMap(server), attempted = new Set<string>();
  const before = JSON.stringify({ rows, committed: [...committed], attempted: [...attempted] });
  const [result] = merge(rows, committed, attempted);
  expect(result).not.toBe(current);
  expect(result).not.toBe(server);
  expect(JSON.stringify({ rows, committed: [...committed], attempted: [...attempted] })).toBe(before);
  expect(committed.get("one")).toBe(server);
});

test("without a newer edit the existing direct committed-row branch remains", () => {
  expect(source).toMatch(/if \(!draftTouchedRef\.current\) \{\s*setDraftRows\(nextCommittedRows\);\s*\} else \{/);
  expect(source).toMatch(/const attemptedRemovedRootOrderIds = new Set\(\s*pendingRemovedRootOrderIdsRef\.current,\s*\);/);
});
