export const PLAN_ORDER_PRICE_BASES = [
  "per_order",
  "per_day",
  "per_administration",
  "per_product_unit",
  "per_kg",
  "fixed_set",
] as const;

export type PlanOrderPriceBasis = (typeof PLAN_ORDER_PRICE_BASES)[number];
export type PlanOrderTaxClass = "taxable" | "non_taxable";
export type PlanOrderSetBillingOwner = "parent" | "children";
export type PlanOrderSetAmountStrategy =
  | "fixed_set"
  | "included_order_sum"
  | "range_price";
export type PlanOrderDoseBasis = "head" | "kg";
export type PlanOrderCalculationMode =
  | "ingredient_based"
  | "fixed_product"
  | "not_applicable";
export type PlanOrderPreparationRoundingMode =
  | "nearest"
  | "up"
  | "down";

export type PlanOrderUnitConversion = {
  fromUnit: string;
  toUnit: string;
  factor: number;
};

export type PlanOrderProductStrength = {
  numeratorValue: number;
  numeratorUnit: string;
  denominatorValue: number;
  denominatorUnit: string;
};

export type PlanOrderPreparationPolicy = {
  increment: number;
  roundingMode: PlanOrderPreparationRoundingMode;
  displayPrecision: number;
  minimum?: number | null;
  maximum?: number | null;
  noReasonTolerance?: number | null;
};

export type PlanOrderAuthorityConfig = {
  schemaVersion: 1;
  calculationMode: PlanOrderCalculationMode;
  dispenseUnit?: string | null;
  referenceIngredientId?: string | null;
  productStrength?: PlanOrderProductStrength | null;
  unitConversions?: PlanOrderUnitConversion[];
  fixedProductQuantity?: number | null;
  fixedProductQuantityBasis?: PlanOrderDoseBasis | null;
  preparationPolicy?: PlanOrderPreparationPolicy | null;
  priceBasis?: PlanOrderPriceBasis | null;
  billingUnit?: string | null;
  taxClass?: PlanOrderTaxClass | null;
  setBillingOwner?: PlanOrderSetBillingOwner | null;
  setAmountStrategy?: PlanOrderSetAmountStrategy | null;
};

export type PlanOrderAuthorityIssue = {
  path: string;
  code: string;
};

export type PlanOrderAuthorityParseResult =
  | { valid: true; value: PlanOrderAuthorityConfig | null }
  | { valid: false; issues: PlanOrderAuthorityIssue[] };

const authorityKeys = new Set([
  "schemaVersion",
  "calculationMode",
  "dispenseUnit",
  "referenceIngredientId",
  "productStrength",
  "unitConversions",
  "fixedProductQuantity",
  "fixedProductQuantityBasis",
  "preparationPolicy",
  "priceBasis",
  "billingUnit",
  "taxClass",
  "setBillingOwner",
  "setAmountStrategy",
]);

const strengthKeys = new Set([
  "numeratorValue",
  "numeratorUnit",
  "denominatorValue",
  "denominatorUnit",
]);
const conversionKeys = new Set(["fromUnit", "toUnit", "factor"]);
const preparationKeys = new Set([
  "increment",
  "roundingMode",
  "displayPrecision",
  "minimum",
  "maximum",
  "noReasonTolerance",
]);

export function parsePlanOrderAuthority(
  input: unknown,
): PlanOrderAuthorityParseResult {
  if (input === undefined || input === null) return { valid: true, value: null };
  if (!isRecord(input)) {
    return {
      valid: false,
      issues: [{ path: "planOrderAuthority", code: "object_required" }],
    };
  }

  const issues: PlanOrderAuthorityIssue[] = [];
  rejectUnknownKeys(input, authorityKeys, "planOrderAuthority", issues);
  if (input.schemaVersion !== 1) {
    issues.push({
      path: "planOrderAuthority.schemaVersion",
      code: "schema_version_invalid",
    });
  }
  if (!isCalculationMode(input.calculationMode)) {
    issues.push({
      path: "planOrderAuthority.calculationMode",
      code: "calculation_mode_invalid",
    });
  }

  const dispenseUnit = nullableString(
    input.dispenseUnit,
    "planOrderAuthority.dispenseUnit",
    issues,
  );
  const referenceIngredientId = nullableString(
    input.referenceIngredientId,
    "planOrderAuthority.referenceIngredientId",
    issues,
  );
  const productStrength = parseStrength(input.productStrength, issues);
  const unitConversions = parseConversions(input.unitConversions, issues);
  const fixedProductQuantity = nullablePositiveNumber(
    input.fixedProductQuantity,
    "planOrderAuthority.fixedProductQuantity",
    issues,
  );
  const fixedProductQuantityBasis = nullableEnum(
    input.fixedProductQuantityBasis,
    ["head", "kg"] as const,
    "planOrderAuthority.fixedProductQuantityBasis",
    issues,
  );
  const preparationPolicy = parsePreparationPolicy(
    input.preparationPolicy,
    issues,
  );
  const priceBasis = nullableEnum(
    input.priceBasis,
    PLAN_ORDER_PRICE_BASES,
    "planOrderAuthority.priceBasis",
    issues,
  );
  const billingUnit = nullableString(
    input.billingUnit,
    "planOrderAuthority.billingUnit",
    issues,
  );
  const taxClass = nullableEnum(
    input.taxClass,
    ["taxable", "non_taxable"] as const,
    "planOrderAuthority.taxClass",
    issues,
  );
  const setBillingOwner = nullableEnum(
    input.setBillingOwner,
    ["parent", "children"] as const,
    "planOrderAuthority.setBillingOwner",
    issues,
  );
  const setAmountStrategy = nullableEnum(
    input.setAmountStrategy,
    ["fixed_set", "included_order_sum", "range_price"] as const,
    "planOrderAuthority.setAmountStrategy",
    issues,
  );

  if (input.calculationMode === "ingredient_based") {
    if (!referenceIngredientId) {
      issues.push({
        path: "planOrderAuthority.referenceIngredientId",
        code: "required_for_ingredient_calculation",
      });
    }
    if (!productStrength) {
      issues.push({
        path: "planOrderAuthority.productStrength",
        code: "required_for_ingredient_calculation",
      });
    }
    if (!dispenseUnit) {
      issues.push({
        path: "planOrderAuthority.dispenseUnit",
        code: "required_for_calculation",
      });
    }
  }
  if (input.calculationMode === "fixed_product") {
    if (!fixedProductQuantity) {
      issues.push({
        path: "planOrderAuthority.fixedProductQuantity",
        code: "required_for_fixed_product",
      });
    }
    if (!fixedProductQuantityBasis) {
      issues.push({
        path: "planOrderAuthority.fixedProductQuantityBasis",
        code: "required_for_fixed_product",
      });
    }
    if (!dispenseUnit) {
      issues.push({
        path: "planOrderAuthority.dispenseUnit",
        code: "required_for_calculation",
      });
    }
  }
  if (preparationPolicy && input.calculationMode === "not_applicable") {
    issues.push({
      path: "planOrderAuthority.preparationPolicy",
      code: "not_applicable_conflict",
    });
  }
  if ((priceBasis && !billingUnit) || (!priceBasis && billingUnit)) {
    issues.push({
      path: "planOrderAuthority.billingUnit",
      code: "price_basis_and_billing_unit_required_together",
    });
  }
  if (priceBasis === "fixed_set" && setBillingOwner !== "parent") {
    issues.push({
      path: "planOrderAuthority.setBillingOwner",
      code: "fixed_set_requires_parent_billing",
    });
  }
  if (setBillingOwner === "children" && setAmountStrategy === "fixed_set") {
    issues.push({
      path: "planOrderAuthority.setAmountStrategy",
      code: "child_billing_fixed_set_conflict",
    });
  }

  if (issues.length > 0) return { valid: false, issues: sortIssues(issues) };

  return {
    valid: true,
    value: {
      schemaVersion: 1,
      calculationMode: input.calculationMode as PlanOrderCalculationMode,
      ...(dispenseUnit ? { dispenseUnit } : {}),
      ...(referenceIngredientId ? { referenceIngredientId } : {}),
      ...(productStrength ? { productStrength } : {}),
      ...(unitConversions.length > 0 ? { unitConversions } : {}),
      ...(fixedProductQuantity ? { fixedProductQuantity } : {}),
      ...(fixedProductQuantityBasis ? { fixedProductQuantityBasis } : {}),
      ...(preparationPolicy ? { preparationPolicy } : {}),
      ...(priceBasis ? { priceBasis } : {}),
      ...(billingUnit ? { billingUnit } : {}),
      ...(taxClass ? { taxClass } : {}),
      ...(setBillingOwner ? { setBillingOwner } : {}),
      ...(setAmountStrategy ? { setAmountStrategy } : {}),
    },
  };
}

export type PlanOrderWeightSnapshot = {
  valueKg: number;
  measuredAt: string;
  encounterId: string;
};

export type PlanOrderDispenseCalculationInput = {
  config: PlanOrderAuthorityConfig | null;
  doseBasis: PlanOrderDoseBasis;
  dosePerAdministration: number;
  doseUnit: string;
  encounterId: string;
  confirmationAt: string;
  weightSnapshot?: PlanOrderWeightSnapshot | null;
};

export type PlanOrderDispenseCalculationResult =
  | {
      ok: true;
      quantity: number;
      unit: string;
      weightSnapshot: PlanOrderWeightSnapshot | null;
      formula: "ingredient_based" | "fixed_product";
    }
  | {
      ok: false;
      reason:
        | "not_applicable"
        | "configuration_missing"
        | "invalid_input"
        | "weight_missing"
        | "weight_out_of_scope"
        | "unit_conversion_missing";
    };

export function calculatePlanOrderDispenseQuantity(
  input: PlanOrderDispenseCalculationInput,
): PlanOrderDispenseCalculationResult {
  const { config } = input;
  if (!config) return { ok: false, reason: "configuration_missing" };
  if (config.calculationMode === "not_applicable") {
    return { ok: false, reason: "not_applicable" };
  }
  if (
    !isPositive(input.dosePerAdministration) ||
    !nonEmpty(input.doseUnit) ||
    !nonEmpty(input.encounterId) ||
    Number.isNaN(Date.parse(input.confirmationAt))
  ) {
    return { ok: false, reason: "invalid_input" };
  }

  const weight = resolveWeight(input);
  if (!weight.ok) return weight;
  const basisMultiplier =
    input.doseBasis === "kg" && weight.value ? weight.value.valueKg : 1;

  if (config.calculationMode === "fixed_product") {
    if (
      !isPositive(config.fixedProductQuantity) ||
      !config.fixedProductQuantityBasis ||
      !config.dispenseUnit ||
      config.fixedProductQuantityBasis !== input.doseBasis
    ) {
      return { ok: false, reason: "configuration_missing" };
    }
    return {
      ok: true,
      quantity: config.fixedProductQuantity * basisMultiplier,
      unit: config.dispenseUnit,
      weightSnapshot: weight.value,
      formula: "fixed_product",
    };
  }

  const strength = config.productStrength;
  if (!strength || !config.referenceIngredientId || !config.dispenseUnit) {
    return { ok: false, reason: "configuration_missing" };
  }
  const convertedDose = convertUnit(
    input.dosePerAdministration * basisMultiplier,
    input.doseUnit,
    strength.numeratorUnit,
    config.unitConversions ?? [],
  );
  if (convertedDose === null) {
    return { ok: false, reason: "unit_conversion_missing" };
  }
  if (strength.denominatorUnit !== config.dispenseUnit) {
    return { ok: false, reason: "unit_conversion_missing" };
  }
  return {
    ok: true,
    quantity:
      (convertedDose * strength.denominatorValue) / strength.numeratorValue,
    unit: config.dispenseUnit,
    weightSnapshot: weight.value,
    formula: "ingredient_based",
  };
}

export type PlanOrderPreparedQuantity = {
  quantity: number;
  unit: string;
  source: "copied_exact" | "preparation_policy";
  manualOverrideAllowed: boolean;
};

export function proposePlanOrderActualDispenseQuantity({
  config,
  theoreticalQuantity,
}: {
  config: PlanOrderAuthorityConfig;
  theoreticalQuantity: number;
}): PlanOrderPreparedQuantity | null {
  if (
    config.calculationMode === "not_applicable" ||
    !config.dispenseUnit ||
    !isPositive(theoreticalQuantity)
  ) {
    return null;
  }
  const policy = config.preparationPolicy;
  if (!policy) {
    return {
      quantity: theoreticalQuantity,
      unit: config.dispenseUnit,
      source: "copied_exact",
      manualOverrideAllowed: false,
    };
  }
  const scaled = theoreticalQuantity / policy.increment;
  const roundedSteps =
    policy.roundingMode === "up"
      ? Math.ceil(scaled)
      : policy.roundingMode === "down"
        ? Math.floor(scaled)
        : roundHalfAwayFromZero(scaled);
  const quantity = roundToPrecision(
    roundedSteps * policy.increment,
    policy.displayPrecision,
  );
  if (
    (policy.minimum !== null &&
      policy.minimum !== undefined &&
      quantity < policy.minimum) ||
    (policy.maximum !== null &&
      policy.maximum !== undefined &&
      quantity > policy.maximum)
  ) {
    return null;
  }
  return {
    quantity,
    unit: config.dispenseUnit,
    source: "preparation_policy",
    manualOverrideAllowed: true,
  };
}

export type PlanOrderOccurrenceRule =
  | { kind: "daily"; durationDays: number; dailyCount: number }
  | { kind: "interval" | "custom"; timezone: string; occurrences: string[] }
  | { kind: "prn"; maximumAuthorizedCount: number };

export function derivePlanOrderTotalOccurrences(
  rule: PlanOrderOccurrenceRule,
): number | null {
  if (rule.kind === "daily") {
    if (
      !Number.isInteger(rule.durationDays) ||
      rule.durationDays < 1 ||
      !Number.isInteger(rule.dailyCount) ||
      rule.dailyCount < 1
    ) {
      return null;
    }
    return rule.durationDays * rule.dailyCount;
  }
  if (rule.kind === "prn") {
    return Number.isInteger(rule.maximumAuthorizedCount) &&
      rule.maximumAuthorizedCount > 0
      ? rule.maximumAuthorizedCount
      : null;
  }
  if (!nonEmpty(rule.timezone) || rule.occurrences.length < 1) return null;
  const unique = new Set(rule.occurrences);
  if (
    unique.size !== rule.occurrences.length ||
    rule.occurrences.some((value) => Number.isNaN(Date.parse(value)))
  ) {
    return null;
  }
  return rule.occurrences.length;
}

export function derivePlanOrderBillingQuantity({
  actualDispenseQuantity,
  durationDays,
  priceBasis,
  totalOccurrences,
  weightKg,
}: {
  actualDispenseQuantity?: number | null;
  durationDays?: number | null;
  priceBasis: PlanOrderPriceBasis;
  totalOccurrences?: number | null;
  weightKg?: number | null;
}): number | null {
  if (priceBasis === "per_order" || priceBasis === "fixed_set") return 1;
  if (priceBasis === "per_day") return positiveOrNull(durationDays);
  if (priceBasis === "per_administration") {
    return positiveOrNull(totalOccurrences);
  }
  if (priceBasis === "per_kg") return positiveOrNull(weightKg);
  const actual = positiveOrNull(actualDispenseQuantity);
  const count = positiveOrNull(totalOccurrences);
  return actual && count ? actual * count : null;
}

export type PlanOrderAdjustmentInput =
  | { source: "amount"; amountKrw: number }
  | { source: "percent"; percent: number };

export function calculatePlanOrderCharge({
  baseAmountKrw,
  adjustment,
}: {
  baseAmountKrw: number;
  adjustment: PlanOrderAdjustmentInput;
}):
  | {
      ok: true;
      adjustmentAmountKrw: number;
      adjustmentPercent: number;
      chargeAmountKrw: number;
    }
  | { ok: false; reason: "invalid_amount" | "negative_charge" } {
  if (!Number.isSafeInteger(baseAmountKrw) || baseAmountKrw < 0) {
    return { ok: false, reason: "invalid_amount" };
  }
  const adjustmentAmountKrw =
    adjustment.source === "amount"
      ? adjustment.amountKrw
      : roundHalfAwayFromZero((baseAmountKrw * adjustment.percent) / 100);
  if (!Number.isSafeInteger(adjustmentAmountKrw)) {
    return { ok: false, reason: "invalid_amount" };
  }
  const chargeAmountKrw = baseAmountKrw + adjustmentAmountKrw;
  if (chargeAmountKrw < 0) return { ok: false, reason: "negative_charge" };
  const adjustmentPercent =
    baseAmountKrw === 0
      ? 0
      : adjustment.source === "percent"
        ? adjustment.percent
        : (adjustmentAmountKrw / baseAmountKrw) * 100;
  return {
    ok: true,
    adjustmentAmountKrw,
    adjustmentPercent,
    chargeAmountKrw,
  };
}

function parseStrength(
  input: unknown,
  issues: PlanOrderAuthorityIssue[],
): PlanOrderProductStrength | null {
  if (input === undefined || input === null) return null;
  if (!isRecord(input)) {
    issues.push({
      path: "planOrderAuthority.productStrength",
      code: "object_required",
    });
    return null;
  }
  rejectUnknownKeys(
    input,
    strengthKeys,
    "planOrderAuthority.productStrength",
    issues,
  );
  const numeratorValue = requiredPositiveNumber(
    input.numeratorValue,
    "planOrderAuthority.productStrength.numeratorValue",
    issues,
  );
  const numeratorUnit = requiredString(
    input.numeratorUnit,
    "planOrderAuthority.productStrength.numeratorUnit",
    issues,
  );
  const denominatorValue = requiredPositiveNumber(
    input.denominatorValue,
    "planOrderAuthority.productStrength.denominatorValue",
    issues,
  );
  const denominatorUnit = requiredString(
    input.denominatorUnit,
    "planOrderAuthority.productStrength.denominatorUnit",
    issues,
  );
  return numeratorValue && numeratorUnit && denominatorValue && denominatorUnit
    ? { numeratorValue, numeratorUnit, denominatorValue, denominatorUnit }
    : null;
}

function parseConversions(
  input: unknown,
  issues: PlanOrderAuthorityIssue[],
): PlanOrderUnitConversion[] {
  if (input === undefined) return [];
  if (!Array.isArray(input)) {
    issues.push({
      path: "planOrderAuthority.unitConversions",
      code: "array_required",
    });
    return [];
  }
  const conversions: PlanOrderUnitConversion[] = [];
  input.forEach((entry, index) => {
    const path = `planOrderAuthority.unitConversions[${index}]`;
    if (!isRecord(entry)) {
      issues.push({ path, code: "object_required" });
      return;
    }
    rejectUnknownKeys(entry, conversionKeys, path, issues);
    const fromUnit = requiredString(entry.fromUnit, `${path}.fromUnit`, issues);
    const toUnit = requiredString(entry.toUnit, `${path}.toUnit`, issues);
    const factor = requiredPositiveNumber(entry.factor, `${path}.factor`, issues);
    if (fromUnit && toUnit && factor) {
      conversions.push({ fromUnit, toUnit, factor });
    }
  });
  const pairs = new Set<string>();
  conversions.forEach((entry, index) => {
    const pair = `${entry.fromUnit}\u0000${entry.toUnit}`;
    if (pairs.has(pair)) {
      issues.push({
        path: `planOrderAuthority.unitConversions[${index}]`,
        code: "duplicate_conversion",
      });
    }
    pairs.add(pair);
  });
  return conversions;
}

function parsePreparationPolicy(
  input: unknown,
  issues: PlanOrderAuthorityIssue[],
): PlanOrderPreparationPolicy | null {
  if (input === undefined || input === null) return null;
  if (!isRecord(input)) {
    issues.push({
      path: "planOrderAuthority.preparationPolicy",
      code: "object_required",
    });
    return null;
  }
  rejectUnknownKeys(
    input,
    preparationKeys,
    "planOrderAuthority.preparationPolicy",
    issues,
  );
  const increment = requiredPositiveNumber(
    input.increment,
    "planOrderAuthority.preparationPolicy.increment",
    issues,
  );
  const roundingMode = nullableEnum(
    input.roundingMode,
    ["nearest", "up", "down"] as const,
    "planOrderAuthority.preparationPolicy.roundingMode",
    issues,
  );
  const displayPrecision = requiredInteger(
    input.displayPrecision,
    0,
    12,
    "planOrderAuthority.preparationPolicy.displayPrecision",
    issues,
  );
  const minimum = nullablePositiveNumber(
    input.minimum,
    "planOrderAuthority.preparationPolicy.minimum",
    issues,
  );
  const maximum = nullablePositiveNumber(
    input.maximum,
    "planOrderAuthority.preparationPolicy.maximum",
    issues,
  );
  const noReasonTolerance = nullableNonNegativeNumber(
    input.noReasonTolerance,
    "planOrderAuthority.preparationPolicy.noReasonTolerance",
    issues,
  );
  if (minimum && maximum && minimum > maximum) {
    issues.push({
      path: "planOrderAuthority.preparationPolicy.maximum",
      code: "range_invalid",
    });
  }
  if (!increment || !roundingMode || displayPrecision === null) return null;
  return {
    increment,
    roundingMode,
    displayPrecision,
    ...(minimum !== null ? { minimum } : {}),
    ...(maximum !== null ? { maximum } : {}),
    ...(noReasonTolerance !== null ? { noReasonTolerance } : {}),
  };
}

function resolveWeight(
  input: PlanOrderDispenseCalculationInput,
):
  | { ok: true; value: PlanOrderWeightSnapshot | null }
  | {
      ok: false;
      reason: "weight_missing" | "weight_out_of_scope" | "invalid_input";
    } {
  if (input.doseBasis === "head") return { ok: true, value: null };
  const weight = input.weightSnapshot;
  if (!weight || !isPositive(weight.valueKg)) {
    return { ok: false, reason: "weight_missing" };
  }
  if (
    weight.encounterId !== input.encounterId ||
    Number.isNaN(Date.parse(weight.measuredAt)) ||
    Date.parse(weight.measuredAt) > Date.parse(input.confirmationAt)
  ) {
    return { ok: false, reason: "weight_out_of_scope" };
  }
  return { ok: true, value: weight };
}

function convertUnit(
  value: number,
  fromUnit: string,
  toUnit: string,
  conversions: readonly PlanOrderUnitConversion[],
) {
  if (fromUnit === toUnit) return value;
  const direct = conversions.find(
    (entry) => entry.fromUnit === fromUnit && entry.toUnit === toUnit,
  );
  return direct ? value * direct.factor : null;
}

function rejectUnknownKeys(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  path: string,
  issues: PlanOrderAuthorityIssue[],
) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      issues.push({ path: `${path}.${key}`, code: "unknown_field" });
    }
  }
}

function requiredString(
  value: unknown,
  path: string,
  issues: PlanOrderAuthorityIssue[],
) {
  const parsed = nullableString(value, path, issues);
  if (!parsed) issues.push({ path, code: "required" });
  return parsed;
}

function nullableString(
  value: unknown,
  path: string,
  issues: PlanOrderAuthorityIssue[],
): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !value.trim()) {
    issues.push({ path, code: "non_empty_string_required" });
    return null;
  }
  return value.trim();
}

function requiredPositiveNumber(
  value: unknown,
  path: string,
  issues: PlanOrderAuthorityIssue[],
) {
  const parsed = nullablePositiveNumber(value, path, issues);
  if (parsed === null) issues.push({ path, code: "required" });
  return parsed;
}

function nullablePositiveNumber(
  value: unknown,
  path: string,
  issues: PlanOrderAuthorityIssue[],
): number | null {
  if (value === undefined || value === null) return null;
  if (!isPositive(value)) {
    issues.push({ path, code: "positive_number_required" });
    return null;
  }
  return value;
}

function nullableNonNegativeNumber(
  value: unknown,
  path: string,
  issues: PlanOrderAuthorityIssue[],
): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    issues.push({ path, code: "non_negative_number_required" });
    return null;
  }
  return value;
}

function requiredInteger(
  value: unknown,
  min: number,
  max: number,
  path: string,
  issues: PlanOrderAuthorityIssue[],
) {
  if (!Number.isInteger(value) || Number(value) < min || Number(value) > max) {
    issues.push({ path, code: "integer_out_of_range" });
    return null;
  }
  return Number(value);
}

function nullableEnum<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  path: string,
  issues: PlanOrderAuthorityIssue[],
): T[number] | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || !allowed.includes(value)) {
    issues.push({ path, code: "invalid_value" });
    return null;
  }
  return value as T[number];
}

function isCalculationMode(value: unknown): value is PlanOrderCalculationMode {
  return (
    value === "ingredient_based" ||
    value === "fixed_product" ||
    value === "not_applicable"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isPositive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function positiveOrNull(value: number | null | undefined) {
  return isPositive(value) ? value : null;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && Boolean(value.trim());
}

function roundHalfAwayFromZero(value: number) {
  return value < 0 ? -Math.round(Math.abs(value)) : Math.round(value);
}

function roundToPrecision(value: number, precision: number) {
  const factor = 10 ** precision;
  return roundHalfAwayFromZero(value * factor) / factor;
}

function sortIssues(issues: PlanOrderAuthorityIssue[]) {
  return [...issues].sort(
    (left, right) =>
      left.path.localeCompare(right.path) || left.code.localeCompare(right.code),
  );
}
