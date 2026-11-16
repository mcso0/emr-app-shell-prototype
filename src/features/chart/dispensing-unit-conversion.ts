import type { PlanOrderAuthorityConfig } from "./plan-order-authority-domain";

// Persisted aliases remain accepted; the picker deduplicates their display names.
export const DISPENSING_DOSE_UNITS = [
  "mcg", "mg", "g", "mL", "L", "tablet", "capsule", "drop", "pipette", "application", "spray",
  "mcg/kg", "mg/kg", "g/kg", "mL/kg", "L/kg", "ml", "ml/kg",
] as const;
export const DISPENSING_QUANTITY_UNITS = DISPENSING_DOSE_UNITS.filter(unit => !unit.endsWith("/kg"));

export function canonicalDispensingUnit(unit: string) {
  return unit === "ml" ? "mL" : unit === "ml/kg" ? "mL/kg" : unit;
}

export function equivalentDispensingQuantity(a: number, b: number) {
  return Number.isFinite(a) && Number.isFinite(b) &&
    Math.abs(a - b) <= Math.max(Math.abs(a), Math.abs(b)) * 1e-12;
}

type FactorResult = { ok: true; factor: number } | { ok: false; reason: "unit_conversion_missing" | "unit_conversion_ambiguous" | "configuration_missing" };
const positive = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value > 0;

/** SI edges do not cross mass/volume/count dimensions. Non-SI edges belong to this product only. */
function conversionFactors(config: PlanOrderAuthorityConfig, source: string): Map<string, number> | null {
  const edges: Array<[string, string, number]> = [["g", "mg", 1000], ["mg", "mcg", 1000], ["L", "mL", 1000]];
  for (const conversion of config.unitConversions ?? []) {
    if (!positive(conversion.factor) || !conversion.fromUnit || !conversion.toUnit ||
        conversion.fromUnit.includes("/") || conversion.toUnit.includes("/")) return null;
    edges.push([canonicalDispensingUnit(conversion.fromUnit), canonicalDispensingUnit(conversion.toUnit), conversion.factor]);
  }
  const graph = new Map<string, Array<[string, number]>>();
  for (const [from, to, factor] of edges) {
    graph.set(from, [...(graph.get(from) ?? []), [to, factor]]);
    graph.set(to, [...(graph.get(to) ?? []), [from, 1 / factor]]);
  }
  const values = new Map([[source, 1]]);
  const queue = [source];
  for (let index = 0; index < queue.length; index++) {
    const from = queue[index];
    for (const [to, multiplier] of graph.get(from) ?? []) {
      const factor = values.get(from)! * multiplier;
      if (!positive(factor)) return null;
      const previous = values.get(to);
      if (previous !== undefined) {
        if (!equivalentDispensingQuantity(previous, factor)) return null;
      } else {
        values.set(to, factor);
        queue.push(to);
      }
    }
  }
  return values;
}

/** Factor from an entered dose to the snapshot's product/output unit, before weight. */
export function resolveDispensingDoseFactor(config: PlanOrderAuthorityConfig | null, inputUnit: string, doseBasis: unknown): FactorResult {
  if (!config?.dispenseUnit || !["ingredient_based", "product_unit", "fixed_product"].includes(config.calculationMode)) {
    return { ok: false, reason: "configuration_missing" };
  }
  if (!["patient", "head", "kg"].includes(String(doseBasis)) || (inputUnit.endsWith("/kg") && doseBasis !== "kg")) {
    return { ok: false, reason: "unit_conversion_missing" };
  }
  const source = canonicalDispensingUnit(doseBasis === "kg" ? inputUnit.replace(/\/kg$/, "") : inputUnit);
  const output = canonicalDispensingUnit(config.dispenseUnit);
  const factors = conversionFactors(config, source);
  if (!factors) return { ok: false, reason: "unit_conversion_ambiguous" };
  const productFactor = factors.get(output);
  const strength = config.productStrength;
  let ingredientFactor: number | undefined;
  if (strength && config.referenceIngredientId) {
    if (!positive(strength.numeratorValue) || !positive(strength.denominatorValue)) return { ok: false, reason: "configuration_missing" };
    const numerator = canonicalDispensingUnit(strength.numeratorUnit);
    const denominator = canonicalDispensingUnit(strength.denominatorUnit);
    const outputFactors = conversionFactors(config, denominator);
    if (!outputFactors) return { ok: false, reason: "unit_conversion_ambiguous" };
    const denominatorFactor = outputFactors.get(output);
    if (denominatorFactor === undefined) return { ok: false, reason: "configuration_missing" };
    const toIngredient = factors.get(numerator);
    if (toIngredient !== undefined) ingredientFactor = toIngredient * strength.denominatorValue / strength.numeratorValue * denominatorFactor;
    if (ingredientFactor !== undefined && productFactor !== undefined && !equivalentDispensingQuantity(ingredientFactor, productFactor)) {
      // Preserve the existing ingredient input's exact numerator meaning. A g/g
      // product or another mass alias needs an explicit input-kind contract.
      if (config.calculationMode === "ingredient_based" && source === numerator && numerator !== denominator &&
          ((["mcg", "mg", "g"].includes(numerator) && ["mcg", "mg", "g"].includes(denominator)) ||
           (["mL", "L"].includes(numerator) && ["mL", "L"].includes(denominator)))) {
        return { ok: true, factor: ingredientFactor };
      }
      return { ok: false, reason: "unit_conversion_ambiguous" };
    }
  } else if (config.calculationMode === "ingredient_based") {
    return { ok: false, reason: "configuration_missing" };
  }
  const factor = ingredientFactor ?? productFactor;
  return positive(factor) ? { ok: true, factor } : { ok: false, reason: "unit_conversion_missing" };
}

export function convertDispensingDose(config: PlanOrderAuthorityConfig | null, dose: number, fromUnit: string, toUnit: string, doseBasis: unknown) {
  const from = resolveDispensingDoseFactor(config, fromUnit, doseBasis);
  const to = resolveDispensingDoseFactor(config, toUnit, doseBasis);
  if (!positive(dose) || !from.ok || !to.ok) return null;
  // Do not round to a display precision or dispensing increment during a unit switch.
  const converted = dose * from.factor / to.factor;
  return positive(converted) && equivalentDispensingQuantity(dose * from.factor, converted * to.factor) ? converted : null;
}
