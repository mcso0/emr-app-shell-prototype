import { expect, test } from "@playwright/test";
import {
  createMockChartOrderPrebillingOverrideGateway,
  saveChartOrderPrebillingOverride,
  type ChartOrderPrebillingOverridePatch,
} from "../src/features/chart/server-order-prebilling-override-core";
import { calculatePlanOrderCharge } from "../src/features/chart/plan-order-authority-domain";

const scope = {
  actorUserId: "user-admin",
  workspaceId: "clair-demo",
  encounterId: "synthetic-contract-encounter",
  orderId: "synthetic-contract-order",
};

test("optional blank reasons normalize to null without dropping signed adjustment", async () => {
  for (const adjustmentReason of ["", "   ", "\n\t", null]) {
    const result = await saveChartOrderPrebillingOverride({
      ...scope,
      expectedVersion: 0,
      idempotencyKey: "optional-reason-test",
      override: { adjustmentSource: "amount", adjustmentAmountKrw: 10000, adjustmentReason },
    });
    expect(result).toMatchObject({ ok: true, override: {
      adjustmentAmountKrw: 10000, adjustmentSource: "amount", adjustmentReason: null,
    } });
  }
});

test("reason-only clear preserves the adjustment and source, and zeroing preserves free text", async () => {
  const gateway = createMockChartOrderPrebillingOverrideGateway();
  const save = (expectedVersion: number, override: ChartOrderPrebillingOverridePatch) =>
    saveChartOrderPrebillingOverride({ ...scope, gateway, expectedVersion,
      idempotencyKey: `optional-reason-${expectedVersion}`, override });
  expect(await save(0, { adjustmentSource: "amount", adjustmentAmountKrw: 10000, adjustmentReason: "임의 메모 <b>" }))
    .toMatchObject({ ok: true, override: { adjustmentReason: "임의 메모 <b>" } });
  expect(await save(1, { adjustmentReason: null })).toMatchObject({ ok: true, override: {
    adjustmentAmountKrw: 10000, adjustmentSource: "amount", adjustmentReason: null,
  } });
  expect(await save(2, { adjustmentReason: "자유 사유" })).toMatchObject({ ok: true });
  expect(await save(3, { adjustmentSource: "amount", adjustmentAmountKrw: 0 }))
    .toMatchObject({ ok: true, override: { adjustmentReason: "자유 사유", adjustmentAmountKrw: 0 } });
});

test("untrusted reason and billing name types return invalid_input without throwing", async () => {
  for (const override of [{ adjustmentReason: 1 }, { adjustmentReason: {} }, { billingName: false }]) {
    await expect(saveChartOrderPrebillingOverride({ ...scope, expectedVersion: 0,
      idempotencyKey: "invalid-type-contract", override: override as unknown as ChartOrderPrebillingOverridePatch,
    })).resolves.toMatchObject({ ok: false, status: 400, error: "invalid_input" });
  }
});

test("signed adjustment is applied once with server-compatible negative-half rounding", () => {
  for (const sign of [-1, 1]) {
    const amount = calculatePlanOrderCharge({ baseAmountKrw: 100000, adjustment: { source: "amount", amountKrw: sign * 10000 } });
    const percent = calculatePlanOrderCharge({ baseAmountKrw: 100000, adjustment: { source: "percent", percent: sign * 10 } });
    expect(amount).toEqual(percent);
    expect(amount).toMatchObject({ ok: true, chargeAmountKrw: 100000 + sign * 10000 });
  }
  expect(calculatePlanOrderCharge({ baseAmountKrw: 5, adjustment: { source: "percent", percent: -10 } }))
    .toMatchObject({ ok: true, adjustmentAmountKrw: -1, chargeAmountKrw: 4 });
  expect(calculatePlanOrderCharge({ baseAmountKrw: 0, adjustment: { source: "amount", amountKrw: 100 } }))
    .toMatchObject({ ok: true, adjustmentPercent: 0, chargeAmountKrw: 100 });
  expect(calculatePlanOrderCharge({ baseAmountKrw: 100, adjustment: { source: "amount", amountKrw: -101 } }))
    .toEqual({ ok: false, reason: "negative_charge" });
});

test("zero-base percent source retains its explicit rate just like SQL, without dividing by zero", () => {
  expect(calculatePlanOrderCharge({ baseAmountKrw: 0, adjustment: { source: "percent", percent: 10 } }))
    .toEqual({ ok: true, adjustmentAmountKrw: 0, adjustmentPercent: 10, chargeAmountKrw: 0 });
});

test("charge arithmetic rejects unsafe totals instead of returning imprecise money", () => {
  expect(calculatePlanOrderCharge({ baseAmountKrw: Number.MAX_SAFE_INTEGER,
    adjustment: { source: "amount", amountKrw: 1 } }))
    .toEqual({ ok: false, reason: "invalid_amount" });
});
