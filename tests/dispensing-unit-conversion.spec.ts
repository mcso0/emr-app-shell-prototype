import { expect, test } from "@playwright/test";
import { canonicalDispensingUnit, convertDispensingDose, DISPENSING_DOSE_UNITS, resolveDispensingDoseFactor } from "@/features/chart/dispensing-unit-conversion";
import { calculatePlanOrderDispenseQuantity, getPlanOrderSelectableUnits, type PlanOrderAuthorityConfig } from "@/features/chart/plan-order-authority-domain";
import { updateDispensingPrescriptionWithUnits } from "@/features/chart/dispense-request-quantity";
import { validateClinicalOrderDetailInputs } from "@/features/chart/order-execution-domain";

const liquid: PlanOrderAuthorityConfig = { schemaVersion: 1, calculationMode: "ingredient_based", dispenseUnit: "mL",
  referenceIngredientId: "synthetic-reference", productStrength: { numeratorValue: 16, numeratorUnit: "mg", denominatorValue: 1, denominatorUnit: "mL" } };
const factor = (unit: string, config = liquid, basis = "patient") => resolveDispensingDoseFactor(config, unit, basis);

test("mass and product-volume inputs describe the same liquid prescription", () => {
  for (const [dose, unit] of [[16, "mg"], [16000, "mcg"], [0.016, "g"], [1, "mL"], [1, "ml"], [0.001, "L"]] as const) {
    const result = calculatePlanOrderDispenseQuantity({ config: liquid, dosePerAdministration: dose, doseUnit: unit,
      doseBasis: "head", encounterId: "synthetic", confirmationAt: "2026-11-01T00:00:00Z" });
    expect(result).toMatchObject({ ok: true, quantity: 1, unit: "mL" });
    expect(validateClinicalOrderDetailInputs({ clinicalOrderType: "dispensing", schemaVersion: 1,
      requireComplete: false, detailInputs: { dose, doseUnit: unit, doseBasis: "patient" } }).valid).toBe(true);
  }
});

test("a unit switch updates dose and unit atomically without mutating source inputs", () => {
  const initial = { dose: 16, doseUnit: "mg", doseBasis: "patient", durationDays: 3, frequency: "bid" };
  const changed = updateDispensingPrescriptionWithUnits(initial, "doseUnit", "mL", liquid);
  expect(changed).toEqual({ ok: true, inputs: { ...initial, dose: 1, doseUnit: "mL" } });
  expect(initial.doseUnit).toBe("mg");
  expect(initial.dose).toBe(16);
  expect(updateDispensingPrescriptionWithUnits(initial, "doseUnit", "capsule", liquid).ok).toBe(false);
});

test("repeated unit changes do not apply display precision or dispensing rounding", () => {
  let value = 1;
  let unit = "mg";
  const thirds = { ...liquid, productStrength: { ...liquid.productStrength!, numeratorValue: 3 } };
  for (let repeat = 0; repeat < 100; repeat++) {
    for (const next of ["mL", "L", "g", "mcg", "mg"]) {
      value = convertDispensingDose(thirds, value, unit, next, "patient")!;
      expect(value).toBeGreaterThan(0);
      unit = next;
    }
  }
  expect(Math.abs(value - 1)).toBeLessThan(1e-12);
  expect(convertDispensingDose(liquid, 1, "mg", "mL", "patient")).toBe(0.0625);
});

test("tablet and capsule amount conversions require the pinned strength and reference ingredient", () => {
  for (const unit of ["tablet", "capsule"]) {
    const config = { ...liquid, dispenseUnit: unit, productStrength: { numeratorValue: 20, numeratorUnit: "mg", denominatorValue: 1, denominatorUnit: unit } };
    expect(convertDispensingDose(config, 10, "mg", unit, "patient")).toBe(0.5);
    expect(convertDispensingDose(config, 0.5, unit, "mg", "patient")).toBe(10);
    expect(factor("mg", { ...config, referenceIngredientId: null }).ok).toBe(false);
  }
});

test("product-only prescriptions allow volume scaling without inventing ingredient strength", () => {
  const config: PlanOrderAuthorityConfig = { schemaVersion: 2, calculationMode: "product_unit", dispenseUnit: "ml" };
  expect(convertDispensingDose(config, 1000, "mL", "L", "patient")).toBe(1);
  expect(factor("mg", config).ok).toBe(false);
  expect(factor("drop", config).ok).toBe(false);
});

test("drop and spray conversions are product-specific and support supplied inverse ratios", () => {
  expect(factor("drop").ok).toBe(false);
  const config = { ...liquid, unitConversions: [{ fromUnit: "mL", toUnit: "drop", factor: 20 }, { fromUnit: "spray", toUnit: "drop", factor: 2 }] };
  expect(convertDispensingDose(config, 20, "drop", "mg", "patient")).toBe(16);
  expect(convertDispensingDose(config, 16, "mg", "spray", "patient")).toBe(10);
  expect(factor("drop", { ...liquid }).ok).toBe(false);
});

test("inconsistent explicit ratios and strength contradictions fail closed", () => {
  for (const unitConversions of [
    [{ fromUnit: "mL", toUnit: "drop", factor: 20 }, { fromUnit: "drop", toUnit: "ml", factor: 0.1 }],
    [{ fromUnit: "mg", toUnit: "g", factor: 1 }],
    [{ fromUnit: "mg", toUnit: "mL", factor: 1 }],
  ]) expect(factor("mg", { ...liquid, unitConversions }).ok).toBe(false);
});

test("invalid strength and unknown reference cannot enable ingredient conversion", () => {
  for (const numeratorValue of [0, -1, NaN, Infinity]) {
    expect(factor("mg", { ...liquid, productStrength: { ...liquid.productStrength!, numeratorValue } }).ok).toBe(false);
  }
  expect(factor("mg", { ...liquid, productStrength: null }).ok).toBe(false);
  expect(factor("mg", { ...liquid, referenceIngredientId: null }).ok).toBe(false);
  expect(factor("tablet").ok).toBe(false);
});

test("ambiguous mass-per-mass product units are excluded; historical exact ingredient unit retains its meaning", () => {
  const powder = { ...liquid, dispenseUnit: "g", productStrength: { numeratorValue: 10, numeratorUnit: "mg", denominatorValue: 1, denominatorUnit: "g" } };
  expect(factor("mg", powder)).toEqual({ ok: true, factor: 0.1 });
  expect(factor("g", powder)).toEqual({ ok: false, reason: "unit_conversion_ambiguous" });
  expect(getPlanOrderSelectableUnits({ config: powder, candidates: [...DISPENSING_DOSE_UNITS], fieldKey: "doseUnit", doseBasis: "patient" })).toEqual(["mg"]);
});

test("weight basis is independent from unit scaling and uses only the encounter weight", () => {
  const input = { config: liquid, dosePerAdministration: 16, doseUnit: "mg/kg", doseBasis: "kg" as const,
    encounterId: "synthetic", confirmationAt: "2026-11-01T00:00:00Z",
    weightSnapshot: { valueKg: 5, measuredAt: "2026-10-31T23:00:00Z", encounterId: "synthetic" } };
  expect(calculatePlanOrderDispenseQuantity(input)).toMatchObject({ ok: true, quantity: 5 });
  expect(calculatePlanOrderDispenseQuantity({ ...input, dosePerAdministration: 1, doseUnit: "mL/kg" })).toMatchObject({ ok: true, quantity: 5 });
  expect(calculatePlanOrderDispenseQuantity({ ...input, weightSnapshot: null })).toMatchObject({ ok: false, reason: "weight_missing" });
  expect(calculatePlanOrderDispenseQuantity({ ...input, weightSnapshot: { ...input.weightSnapshot, encounterId: "foreign" } })).toMatchObject({ ok: false, reason: "weight_out_of_scope" });
  expect(factor("mg/kg", liquid, "patient").ok).toBe(false);
  expect(updateDispensingPrescriptionWithUnits({ dose: 16, doseUnit: "mg/kg", doseBasis: "kg" }, "doseBasis", "patient", liquid))
    .toEqual({ ok: true, inputs: { dose: 16, doseUnit: "mg", doseBasis: "patient" } });
  expect(factor("mg", liquid, "body_surface_area").ok).toBe(false);
});

test("picker canonicalizes legacy mL aliases without offering arbitrary units", () => {
  expect(canonicalDispensingUnit("ml")).toBe("mL");
  expect(getPlanOrderSelectableUnits({ config: liquid, candidates: [...DISPENSING_DOSE_UNITS], fieldKey: "doseUnit", doseBasis: "patient" })).toEqual(["mcg", "mg", "g", "mL", "L"]);
  expect(validateClinicalOrderDetailInputs({ clinicalOrderType: "dispensing", schemaVersion: 1, requireComplete: false,
    detailInputs: { doseUnit: "bucket" } }).valid).toBe(false);
});
