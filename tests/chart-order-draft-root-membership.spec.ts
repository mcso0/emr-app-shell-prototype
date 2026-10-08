import { expect, test } from "@playwright/test";
import { isChartOrderDraftRowInRootIds } from "../src/features/chart/chart-order-draft-identity";

type Row = Parameters<typeof isChartOrderDraftRowInRootIds>[0];
const cases: { name: string; row: Row; ids: string[]; expected: boolean }[] = [
  { name: "root deletion includes its own row", row: { order: { id: "root" } }, ids: ["root"], expected: true },
  { name: "root deletion includes a child", row: { order: { id: "child" }, runtimeRow: { parentOrderId: "root" } }, ids: ["root"], expected: true },
  { name: "a row's own ID matches even when its parent differs", row: { order: { id: "child" }, runtimeRow: { parentOrderId: "other" } }, ids: ["child"], expected: true },
  { name: "an unrelated root is retained", row: { order: { id: "other" } }, ids: ["root"], expected: false },
  { name: "an unrelated child is retained", row: { order: { id: "child" }, runtimeRow: { parentOrderId: "other" } }, ids: ["root"], expected: false },
  { name: "an empty parent does not match an empty ID in the set", row: { order: { id: "child" }, runtimeRow: { parentOrderId: "" } }, ids: [""], expected: false },
  { name: "an undefined parent does not match", row: { order: { id: "child" }, runtimeRow: {} }, ids: ["root"], expected: false },
  { name: "a null parent does not match", row: { order: { id: "child" }, runtimeRow: { parentOrderId: null } }, ids: ["root"], expected: false },
  { name: "missing runtime metadata does not invent a parent", row: { order: { id: "child" } }, ids: ["root"], expected: false },
  { name: "null runtime metadata does not invent a parent", row: { order: { id: "child" }, runtimeRow: null }, ids: ["root"], expected: false },
];

for (const { name, row, ids, expected } of cases) {
  test(name, () => {
    expect(isChartOrderDraftRowInRootIds(row, new Set(ids))).toBe(expected);
  });
}

test("an own-ID match short-circuits access to parent metadata", () => {
  const row: Row = {
    order: { id: "root" },
    get runtimeRow(): Row["runtimeRow"] { throw new Error("parent metadata must not be read"); },
  };
  expect(isChartOrderDraftRowInRootIds(row, new Set(["root"]))).toBe(true);
});

test("checking membership does not change rows or the caller's root set", () => {
  const row: Row = Object.freeze({ order: Object.freeze({ id: "child" }), runtimeRow: Object.freeze({ parentOrderId: "root" }) });
  const rootIds = new Set(["root", "other"]);
  expect(isChartOrderDraftRowInRootIds(row, rootIds)).toBe(true);
  expect(row).toEqual({ order: { id: "child" }, runtimeRow: { parentOrderId: "root" } });
  expect([...rootIds]).toEqual(["root", "other"]);
});
