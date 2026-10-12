import { expect, test } from "@playwright/test";

import { reconcileChartOrderConfirmationRows } from "../src/features/chart/chart-order-confirmation-readback";
import type { ChartOrderRuntimeRow } from "../src/features/chart/server-order-draft-persistence-core";

const workspaceId = "synthetic-workspace-a";
const encounterId = "synthetic-encounter-a";

function row(orderId: string, patch: Partial<ChartOrderRuntimeRow> = {}): ChartOrderRuntimeRow {
  return {
    orderId, workspaceId, encounterId, rowType: "individual", orderType: "lab",
    clinicalOrderType: "clinical_lab", destinationModule: "lab", executionMode: "routed",
    detailInputs: {}, detailSchemaVersion: 1, priority: "normal", billingEligible: true,
    revisionNo: 1, parentOrderId: null, sourceSetId: null, sourceSetRevisionId: null,
    sourceSetRevisionNo: null, sourceSetVersion: null, sourceSetRevisionItemId: null,
    workspaceCatalogItemId: "synthetic-catalog-item", workspaceCatalogRevision: 1,
    dispensingLineage: null, quantity: 1, quantitySource: "manual", unitPriceSnapshot: 1000,
    lineTotalSnapshot: 1000, snapshotSchemaVersion: 0, snapshotHash: null, appliedSnapshot: {},
    appliedPriceSnapshot: {}, calculationInputs: {}, calculationOutputs: {},
    billingReflectionEnabled: true, orderConfirmationStatus: "confirmed", status: "requested",
    updatedAt: "2026-10-12T00:00:00.000Z", ...patch,
  };
}

function reconcile(commandRows: readonly ChartOrderRuntimeRow[], readbackRows: readonly ChartOrderRuntimeRow[]) {
  return reconcileChartOrderConfirmationRows({ commandRows, readbackRows, confirmedRootOrderIds: ["root"], workspaceId, encounterId });
}

test("confirmed roots and their children refresh without replacing other local drafts or appending rows", () => {
  const root = row("root", { rowType: "set" });
  const child = row("child", { rowType: "set_child", parentOrderId: "root" });
  const draft = row("local-draft", { orderConfirmationStatus: "draft" });
  const freshRoot = row("root", { rowType: "set", revisionNo: 2 });
  const freshChild = row("child", { rowType: "set_child", parentOrderId: "root", revisionNo: 3 });
  const result = reconcile([root, child, draft], [freshChild, row("not-returned-child", { parentOrderId: "root" }), freshRoot, row("local-draft", { revisionNo: 9 })]);
  expect(result.map(item => item.orderId)).toEqual(["root", "child", "local-draft"]);
  expect(result[0]).toBe(freshRoot);
  expect(result[1]).toBe(freshChild);
  expect(result[2]).toBe(draft);
});

test("matching order IDs from another workspace, encounter or unspecified workspace do not replace command rows", () => {
  const original = row("root");
  for (const patch of [{ workspaceId: "synthetic-workspace-b" }, { encounterId: "synthetic-encounter-b" }, { workspaceId: undefined }]) {
    expect(reconcile([original], [row("root", { ...patch, revisionNo: 8 })])[0]).toBe(original);
  }
});

for (const status of ["draft", "pending", "cancelled", undefined] as const) {
  test(`readback confirmation state ${status ?? "missing"} cannot supersede a command row`, () => {
    const original = row("root");
    expect(reconcile([original], [row("root", { orderConfirmationStatus: status, status: "confirmed", revisionNo: 8 })])[0]).toBe(original);
  });
}

test("confirmed and billed readbacks are authoritative for the selected root", () => {
  const original = row("root");
  for (const orderConfirmationStatus of ["confirmed", "billed"] as const) {
    const fresh = row("root", { orderConfirmationStatus, revisionNo: 8 });
    expect(reconcile([original], [fresh])[0]).toBe(fresh);
  }
});

test("a child from another root cannot replace a selected child with the same order ID", () => {
  const child = row("child", { rowType: "set_child", parentOrderId: "root" });
  expect(reconcile([child], [row("child", { rowType: "set_child", parentOrderId: "other-root", revisionNo: 8 })])[0]).toBe(child);
});

test("missing readback rows preserve the command result and its ordering", () => {
  const root = row("root");
  const child = row("child", { rowType: "set_child", parentOrderId: "root" });
  expect(reconcile([child, root], [])).toEqual([child, root]);
  expect(reconcile([], [row("root")])).toEqual([]);
});

test("reconciliation preserves immutable input snapshots across repeated calls", () => {
  const original = Object.freeze(row("root"));
  const fresh = Object.freeze(row("root", { revisionNo: 2 }));
  const commandRows = Object.freeze([original]);
  const readbackRows = Object.freeze([fresh]);
  const first = reconcile(commandRows, readbackRows);
  const second = reconcile(commandRows, readbackRows);
  expect(first[0]).toBe(fresh);
  expect(second[0]).toBe(fresh);
  expect(commandRows[0]).toBe(original);
  expect(original.revisionNo).toBe(1);
  expect(first).not.toBe(commandRows);
});
