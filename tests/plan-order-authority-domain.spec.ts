import { expect, test } from "@playwright/test";

import {
  calculatePlanOrderCharge,
  calculatePlanOrderDispenseQuantity,
  derivePlanOrderBillingQuantity,
  derivePlanOrderTotalOccurrences,
  parsePlanOrderAuthority,
  proposePlanOrderActualDispenseQuantity,
  type PlanOrderAuthorityConfig,
} from "@/features/chart/plan-order-authority-domain";

const ingredientConfig: PlanOrderAuthorityConfig = {
  schemaVersion: 1,
  calculationMode: "ingredient_based",
  dispenseUnit: "mL",
  referenceIngredientId: "ingredient-amoxicillin",
  productStrength: {
    numeratorValue: 5,
    numeratorUnit: "mg",
    denominatorValue: 1,
    denominatorUnit: "mL",
  },
  preparationPolicy: {
    increment: 0.1,
    roundingMode: "nearest",
    displayPrecision: 1,
  },
  priceBasis: "per_product_unit",
  billingUnit: "mL",
  taxClass: "taxable",
};

test.describe("plan-order authority contract", () => {
  test("treats an absent master authority as an explicit unconfigured state", () => {
    expect(parsePlanOrderAuthority(undefined)).toEqual({
      valid: true,
      value: null,
    });
  });

  test("rejects partial ingredient configuration and unknown fields", () => {
    const result = parsePlanOrderAuthority({
      schemaVersion: 1,
      calculationMode: "ingredient_based",
      dispenseUnit: "mL",
      inventedDose: 2,
    });

    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues).toEqual(
      expect.arrayContaining([
        {
          path: "planOrderAuthority.inventedDose",
          code: "unknown_field",
        },
        {
          path: "planOrderAuthority.referenceIngredientId",
          code: "required_for_ingredient_calculation",
        },
        {
          path: "planOrderAuthority.productStrength",
          code: "required_for_ingredient_calculation",
        },
      ]),
    );
  });

  test("normalizes a complete source-authored authority without adding defaults", () => {
    expect(parsePlanOrderAuthority(ingredientConfig)).toEqual({
      valid: true,
      value: ingredientConfig,
    });
  });

  test("calculates kg-based ingredient quantity from the same encounter weight", () => {
    expect(
      calculatePlanOrderDispenseQuantity({
        config: ingredientConfig,
        doseBasis: "kg",
        dosePerAdministration: 2,
        doseUnit: "mg",
        encounterId: "encounter-1",
        confirmationAt: "2026-09-02T10:00:00.000Z",
        weightSnapshot: {
          valueKg: 10,
          measuredAt: "2026-09-02T09:30:00.000Z",
          encounterId: "encounter-1",
        },
      }),
    ).toEqual({
      ok: true,
      quantity: 4,
      unit: "mL",
      formula: "ingredient_based",
      weightSnapshot: {
        valueKg: 10,
        measuredAt: "2026-09-02T09:30:00.000Z",
        encounterId: "encounter-1",
      },
    });
  });

  test("fails closed for a foreign or future weight snapshot", () => {
    expect(
      calculatePlanOrderDispenseQuantity({
        config: ingredientConfig,
        doseBasis: "kg",
        dosePerAdministration: 2,
        doseUnit: "mg",
        encounterId: "encounter-1",
        confirmationAt: "2026-09-02T10:00:00.000Z",
        weightSnapshot: {
          valueKg: 10,
          measuredAt: "2026-09-02T10:30:00.000Z",
          encounterId: "encounter-2",
        },
      }),
    ).toEqual({ ok: false, reason: "weight_out_of_scope" });
  });

  test("requires an explicit unit conversion rather than guessing", () => {
    expect(
      calculatePlanOrderDispenseQuantity({
        config: ingredientConfig,
        doseBasis: "head",
        dosePerAdministration: 0.01,
        doseUnit: "g",
        encounterId: "encounter-1",
        confirmationAt: "2026-09-02T10:00:00.000Z",
      }),
    ).toEqual({ ok: false, reason: "unit_conversion_missing" });
  });

  test("copies exact theoretical quantity when no preparation rule exists", () => {
    expect(
      proposePlanOrderActualDispenseQuantity({
        config: { ...ingredientConfig, preparationPolicy: null },
        theoreticalQuantity: 4.08,
      }),
    ).toEqual({
      quantity: 4.08,
      unit: "mL",
      source: "copied_exact",
      manualOverrideAllowed: false,
    });
  });

  test("applies only the explicitly configured preparation increment", () => {
    expect(
      proposePlanOrderActualDispenseQuantity({
        config: ingredientConfig,
        theoreticalQuantity: 4.08,
      }),
    ).toEqual({
      quantity: 4.1,
      unit: "mL",
      source: "preparation_policy",
      manualOverrideAllowed: true,
    });
  });

  test("derives occurrence and price-basis quantities without clinical aliases", () => {
    expect(
      derivePlanOrderTotalOccurrences({
        kind: "daily",
        durationDays: 3,
        dailyCount: 2,
      }),
    ).toBe(6);
    expect(
      derivePlanOrderTotalOccurrences({
        kind: "custom",
        timezone: "Asia/Seoul",
        occurrences: [
          "2026-09-02T00:00:00.000Z",
          "2026-09-02T12:00:00.000Z",
        ],
      }),
    ).toBe(2);
    expect(
      derivePlanOrderBillingQuantity({
        priceBasis: "per_product_unit",
        actualDispenseQuantity: 0.5,
        totalOccurrences: 6,
      }),
    ).toBe(3);
  });

  test("rounds percentage adjustments to whole KRW half away from zero", () => {
    expect(
      calculatePlanOrderCharge({
        baseAmountKrw: 5,
        adjustment: { source: "percent", percent: -10 },
      }),
    ).toEqual({
      ok: true,
      adjustmentAmountKrw: -1,
      adjustmentPercent: -10,
      chargeAmountKrw: 4,
    });
    expect(
      calculatePlanOrderCharge({
        baseAmountKrw: 5,
        adjustment: { source: "percent", percent: 10 },
      }),
    ).toEqual({
      ok: true,
      adjustmentAmountKrw: 1,
      adjustmentPercent: 10,
      chargeAmountKrw: 6,
    });
  });
});
