import { expect, test } from "@playwright/test";
import { prepareChartOrderDraftRowsForPersistence, remapChartOrderIdSet } from "../src/features/chart/chart-order-draft-identity";

type Row = {
  order: { id: string; label: string };
  catalogSearchRow?: unknown;
  detailInputs: { note: string };
  runtimeRow?: { parentOrderId: string };
};
const ids = [
  "10000000-0000-4000-8000-000000000001",
  "10000000-0000-4000-8000-000000000002",
  "10000000-0000-4000-8000-000000000003",
];
const row = (id: string, overrides: Partial<Row> = {}): Row => ({
  order: { id, label: "synthetic order" }, detailInputs: { note: "keep this edit" }, ...overrides,
});
const neverCreateId = () => { throw new Error("an ID must not be created for this row"); };

test("existing UUID versions and letter case retain row identity even with catalog metadata", () => {
  const rows = [1, 2, 3, 4, 5].map(version => row(`ABCDEFAB-ABCD-${version}BCD-ABCD-ABCDEFABCDEF`, { catalogSearchRow: {} }));
  const result = prepareChartOrderDraftRowsForPersistence(rows, neverCreateId);
  expect(result.rows).not.toBe(rows);
  result.rows.forEach((value, index) => expect(value).toBe(rows[index]));
  expect(result.orderIdMap.size).toBe(0);
});

test("non-catalog identities and falsey catalog metadata are not replaced", () => {
  const rows = [row("existing-runtime-id"), row("catalog-other-id"), row("plain-id", { catalogSearchRow: null })];
  const result = prepareChartOrderDraftRowsForPersistence(rows, neverCreateId);
  result.rows.forEach((value, index) => expect(value).toBe(rows[index]));
  expect(result.orderIdMap.size).toBe(0);
});

test("legacy individual, set and explicit catalog identities each receive one ID and map entry", () => {
  const rows = [row("catalog-individual-item"), row("catalog-set-item"), row("temporary-id", { catalogSearchRow: { rowType: "individual" } })];
  let created = 0;
  const result = prepareChartOrderDraftRowsForPersistence(rows, () => ids[created++]);
  expect(created).toBe(3);
  expect(result.rows.map(value => value.order.id)).toEqual(ids);
  expect([...result.orderIdMap]).toEqual(rows.map((value, index) => [value.order.id, ids[index]]));
});

test("preparation preserves order and all other values without mutating or cloning unrelated rows", () => {
  const first = row(ids[1]), changed = row("catalog-set-item", { runtimeRow: { parentOrderId: "original-parent" } }), last = row("runtime-id");
  for (const value of [first, changed, last]) { Object.freeze(value.order); Object.freeze(value.detailInputs); Object.freeze(value); }
  const rows = [first, changed, last];
  Object.freeze(rows);
  const before = JSON.stringify(rows);
  const result = prepareChartOrderDraftRowsForPersistence(rows, () => ids[0]);
  expect(result.rows.map(value => value.order.id)).toEqual([ids[1], ids[0], "runtime-id"]);
  expect(result.rows[0]).toBe(first);
  expect(result.rows[2]).toBe(last);
  expect(result.rows[1]).toEqual({ ...changed, order: { ...changed.order, id: ids[0] } });
  expect(result.rows[1]).not.toBe(changed);
  expect(result.rows[1].order).not.toBe(changed.order);
  expect(result.rows[1].detailInputs).toBe(changed.detailInputs);
  expect(result.rows[1].runtimeRow).toBe(changed.runtimeRow);
  expect(JSON.stringify(rows)).toBe(before);
});

test("preparing already prepared rows does not change their IDs on a later save or confirmation", () => {
  const first = prepareChartOrderDraftRowsForPersistence([row("catalog-individual-item")], () => ids[0]);
  const second = prepareChartOrderDraftRowsForPersistence(first.rows, neverCreateId);
  expect(second.rows[0]).toBe(first.rows[0]);
  expect(second.rows[0].order.id).toBe(ids[0]);
  expect(second.orderIdMap.size).toBe(0);
});

test("empty drafts produce an empty result without creating IDs", () => {
  const rows: Row[] = [];
  const result = prepareChartOrderDraftRowsForPersistence(rows, neverCreateId);
  expect(result.rows).toEqual([]);
  expect(result.rows).not.toBe(rows);
  expect(result.orderIdMap.size).toBe(0);
});

test("an empty ID map preserves the selected Set instance", () => {
  const selected = new Set(["keep"]);
  expect(remapChartOrderIdSet(selected, new Map())).toBe(selected);
});

test("selection remapping preserves unrelated IDs, set semantics and both inputs", () => {
  const selected = new Set(["temporary", ids[0], "keep"]);
  const map = new Map([["temporary", ids[0]], ["not-selected", ids[1]]]);
  const result = remapChartOrderIdSet(selected, map);
  expect(result).not.toBe(selected);
  expect([...result]).toEqual([ids[0], "keep"]);
  expect([...selected]).toEqual(["temporary", ids[0], "keep"]);
  expect([...map]).toEqual([["temporary", ids[0]], ["not-selected", ids[1]]]);
  const unchanged = new Set(["keep"]);
  expect([...remapChartOrderIdSet(unchanged, map)]).toEqual(["keep"]);
  expect(remapChartOrderIdSet(unchanged, map)).not.toBe(unchanged);
});
