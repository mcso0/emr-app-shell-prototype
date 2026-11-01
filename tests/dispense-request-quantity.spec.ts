import { expect, test } from "@playwright/test";
import { calculateDispenseRequestTotal, formatDispenseRequestQuantity, isDispenseQuantityRule, resolveDispenseRule, type DispenseQuantityRule } from "../src/features/chart/dispense-request-quantity";
import { isDispenseRuleMutation } from "../src/features/hospital-admin/dispense-quantity-rule-contract";
import { saveOrderActualDispense, type OrderActualDispenseGateway } from "../src/features/chart/server-order-actual-dispense-core";
const base: DispenseQuantityRule = { mode: "up", increment: 0.5, unit: "tablet", displayPrecision: 1 };

test("rules apply once to course total, exact and unconfigured preserve theoretical quantity", () => {
  expect(calculateDispenseRequestTotal(0.25 * 15, "tablet", base)).toEqual({ ok: true, quantity: 4 });
  expect(calculateDispenseRequestTotal(3.75, "tablet", null)).toEqual({ ok: true, quantity: 3.75 });
  expect(calculateDispenseRequestTotal(3.75, "tablet", { ...base, mode: "exact", displayPrecision: 0 })).toEqual({ ok: true, quantity: 3.75 });
  expect(calculateDispenseRequestTotal(3.75, "tablet", { ...base, mode: "down" })).toEqual({ ok: true, quantity: 3.5 });
  expect(calculateDispenseRequestTotal(3.75, "tablet", { ...base, mode: "nearest" })).toEqual({ ok: true, quantity: 4 });
});
test("decimal boundaries already on a step do not drift, half rounds up", () => {
  for (const mode of ["up", "down", "nearest"] as const) {
    expect(calculateDispenseRequestTotal(0.3, "tablet", { ...base, mode, increment: 0.1 })).toEqual({ ok: true, quantity: 0.3 });
    expect(calculateDispenseRequestTotal(4, "tablet", { ...base, mode })).toEqual({ ok: true, quantity: 4 });
  }
  expect(calculateDispenseRequestTotal(0.15, "tablet", { ...base, mode: "nearest", increment: 0.1 })).toEqual({ ok: true, quantity: 0.2 });
});
test("display never hides stored precision, invalid rules and non-positive totals fail", () => {
  expect(formatDispenseRequestQuantity(1.2345, 1)).toBe("1.2345");
  expect(formatDispenseRequestQuantity(1, 2)).toBe("1.00");
  expect(isDispenseQuantityRule({ ...base, displayPrecision: 0 })).toBe(false);
  expect(calculateDispenseRequestTotal(1, "ml", base)).toEqual({ ok: false, reason: "rule_unit_mismatch" });
  expect(calculateDispenseRequestTotal(0.1, "tablet", { ...base, mode: "down" }).ok).toBe(false);
  for (const invalid of [0, -1, NaN, Infinity]) expect(calculateDispenseRequestTotal(invalid, "tablet", null).ok).toBe(false);
});
test("product exceptions precede unit-specific hospital defaults; unrelated units stay exact", () => {
  const settings = { revision: 4, defaultRules: { tablet: base }, productRules: { productA: { ...base, mode: "exact" as const } } };
  expect(resolveDispenseRule(settings, "productA", "tablet")).toMatchObject({ source: "product", version: 4, rule: { mode: "exact" } });
  expect(resolveDispenseRule(settings, "productB", "tablet")).toMatchObject({ source: "hospital", version: 4 });
  expect(resolveDispenseRule(settings, "productC", "ml")).toMatchObject({ source: "theoretical", rule: null });
});
test("rule mutations require a bounded selection, matching unit and expected revision", () => {
  const mutation = { expectedRevision: 0, target: "products", unit: "tablet", rule: base, catalogItemIds: ["catalog-a"] };
  expect(isDispenseRuleMutation(mutation)).toBe(true);
  expect(isDispenseRuleMutation({ ...mutation, catalogItemIds: [] })).toBe(false);
  expect(isDispenseRuleMutation({ ...mutation, expectedRevision: -1 })).toBe(false);
  expect(isDispenseRuleMutation({ ...mutation, target: "hospital", unit: "ml" })).toBe(false);
});
test("manual arbitrary quantity needs no reason, reset and reconfirm remain explicit", async () => {
  const received: unknown[] = [];
  const gateway: OrderActualDispenseGateway = { async save(input) {
    received.push(input); return { ok: false, error: "revision_conflict" };
  } };
  for (const mode of ["manual", "automatic", "reconfirm"] as const) {
    await saveOrderActualDispense({ actorUserId: "user-vet", workspaceId: "clair-demo", orderId: "order-a", expectedOrderUpdatedAt: "2026-10-31T01:00:00Z", idempotencyKey: `dispense-${mode}`, actualQuantity: 1.2, mode, reason: "ignored legacy value", gateway });
  }
  expect(received).toHaveLength(3);
  expect(received.map(value => (value as {mode: string}).mode)).toEqual(["manual", "automatic", "reconfirm"]);
  for (const value of received) expect(value).not.toHaveProperty("reason");
});

test("historical per-administration quantities become course totals without double multiplying V2", async () => {
  const { getDispenseRequestCourseQuantity, updateDispensingPrescriptionInput } = await import("../src/features/chart/dispense-request-quantity");
  expect(getDispenseRequestCourseQuantity({ actualDispenseQuantity: 1, totalOccurrences: 15 })).toBe(15);
  expect(getDispenseRequestCourseQuantity({ actualDispenseQuantity: 15, totalOccurrences: 15, preparationQuantityScope: "course_total" })).toBe(15);
  expect(getDispenseRequestCourseQuantity({ actualDispenseQuantity: 1 })).toBeNull();
  expect(updateDispensingPrescriptionInput({ frequency: "bid", durationDays: 3, totalOccurrences: 6 }, "durationDays", 5)).toEqual({ frequency: "bid", durationDays: 5 });
  expect(updateDispensingPrescriptionInput({ frequency: "custom", totalOccurrences: 6 }, "durationDays", 5)).toEqual({ frequency: "custom", totalOccurrences: 6, durationDays: 5 });
});
