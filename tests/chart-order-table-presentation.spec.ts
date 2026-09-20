import { expect, test } from "@playwright/test";
import {
  chartOrderConfirmationRank,
  getChartOrderConfirmationState,
  getChartOrderProjectedLineTotal,
  getChartOrderWorkPresentation,
  formatPlanOrderTableUnit,
  sortChartOrderGroups,
  type ChartOrderPresentationRow,
} from "../src/features/chart/chart-order-table-presentation";

test("Plan/Order table units use the approved clinical display labels", () => {
  const cases = [
    ["mg", "mg"],
    ["MG", "mg"],
    ["mg/kg", "mg/kg"],
    ["ml", "mL"],
    ["mL", "mL"],
    ["ML", "mL"],
    ["ml/kg", "mL/kg"],
    ["mL/kg", "mL/kg"],
    ["g", "g"],
    ["kg", "kg"],
    ["Kg", "kg"],
    ["tablet", "TAB"],
    ["T", "TAB"],
    ["capsule", "CAP"],
    ["drop", "DROPS"],
    ["spray", "SPRAY"],
    ["pipette", "PIP"],
    ["application", "APPL"],
    ["vial", "VIAL"],
    ["sachet", "PKT"],
    ["bottle", "BOT"],
    ["applicator", "AP"],
    ["syringe", "SYR"],
    ["tube", "TUBE"],
  ] as const;

  for (const [input, expected] of cases) {
    expect(formatPlanOrderTableUnit(input)).toBe(expected);
  }
  expect(formatPlanOrderTableUnit(null)).toBe("");
  expect(formatPlanOrderTableUnit(undefined)).toBe("");
  expect(formatPlanOrderTableUnit("   ")).toBe("");
  expect(formatPlanOrderTableUnit(" custom-unit ")).toBe("custom-unit");
});

test("pre-confirmation product-unit totals use the required dispense quantity", () => {
  expect(getChartOrderProjectedLineTotal({
    amountBasis: "unit_price",
    draftQuantity: 1,
    priceBasis: "per_product_unit",
    totalRequiredDispenseQuantity: 3,
    unitPrice: 1000,
  })).toBe(3000);
  expect(getChartOrderProjectedLineTotal({
    amountBasis: "unit_price",
    draftQuantity: 1,
    priceBasis: "per_product_unit",
    totalRequiredDispenseQuantity: null,
    unitPrice: 1000,
  })).toBe(1000);
  expect(getChartOrderProjectedLineTotal({
    amountBasis: "fixed_order_price",
    draftQuantity: 1,
    priceBasis: "per_product_unit",
    totalRequiredDispenseQuantity: 3,
    unitPrice: 1000,
  })).toBe(1000);
});

function row(id: string, status = "confirmed", taskStatus?: "complete" | "returned" | "pending" | "paused"): ChartOrderPresentationRow {
  return {
    order: { id, status },
    runtimeRow: { orderConfirmationStatus: status },
    ...(taskStatus ? { executionTask: { status: taskStatus, clinicalOrderType: "clinical_lab", attemptNo: 1 } } : {}),
  };
}

test("unconfirmed orders hide stale task state and validation never replaces confirmed history", () => {
  const draft = row("draft", "draft", "complete");
  expect(getChartOrderWorkPresentation(draft)).toEqual({ label: "-", icon: null, unconfirmed: true });
  expect(getChartOrderConfirmationState(draft, new Set(["draft"]))).toBe("invalid");
  const cancelled = row("cancelled", "cancelled", "complete");
  expect(getChartOrderConfirmationState(cancelled, new Set(["cancelled"]))).toBe("confirmed");
});

for (const task of [undefined, "complete", "returned", "pending"] as const) {
  test(`order cancellation overrides ${task ?? "absent"} task without altering its history`, () => {
    const cancelled = row("cancelled", "cancelled", task);
    const before = structuredClone(cancelled);
    expect(getChartOrderWorkPresentation(cancelled)).toEqual({ label: "취소", icon: "cancel", unconfirmed: false });
    expect(cancelled).toEqual(before);
  });
}

test("no-task confirmation stays empty; return, repeat request, pause and imaging retain distinct meaning", () => {
  expect(getChartOrderWorkPresentation(row("no-task")).label).toBe("-");
  expect(getChartOrderWorkPresentation(row("returned", "confirmed", "returned"))).toMatchObject({ label: "반려", icon: "rework" });
  const repeated = row("again", "confirmed", "pending");
  repeated.executionTask!.requestCycle = 2;
  expect(getChartOrderWorkPresentation(repeated)).toMatchObject({ label: "재요청", icon: "rework" });
  expect(getChartOrderWorkPresentation(row("paused", "confirmed", "paused"))).toMatchObject({ label: "일시중지", icon: "stop" });
  const imaging = row("image", "confirmed", "complete");
  imaging.executionTask!.clinicalOrderType = "imaging";
  expect(getChartOrderWorkPresentation(imaging)).toMatchObject({ label: "판독완", icon: "done" });
});

test("confirmation ordering is stable, keeps sets together, and includes cancellation in confirmed group", () => {
  const rows = [row("confirmed"), row("parent", "draft"), row("child", "draft"), row("ready", "draft"), row("cancelled", "cancelled")];
  rows[2].runtimeRow!.parentOrderId = "parent";
  const invalid = new Set(["parent", "child"]);
  const compare = (a: ChartOrderPresentationRow, b: ChartOrderPresentationRow) =>
    chartOrderConfirmationRank[getChartOrderConfirmationState(a, invalid)] - chartOrderConfirmationRank[getChartOrderConfirmationState(b, invalid)];
  expect(sortChartOrderGroups(rows, compare).map(r => r.order.id)).toEqual(["ready", "parent", "child", "confirmed", "cancelled"]);
  // While editing, changed values are visible but positions do not move.
  expect(sortChartOrderGroups(rows, compare, rows.map(r => r.order.id)).map(r => r.order.id)).toEqual(rows.map(r => r.order.id));
  // Explicit ordering wins over confirmation state but cannot split children.
  expect(sortChartOrderGroups(rows, (a,b) => b.order.id.localeCompare(a.order.id)).map(r => r.order.id)).toEqual(["ready", "parent", "child", "confirmed", "cancelled"]);
});
