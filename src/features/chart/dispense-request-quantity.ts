import { convertDispensingDose, resolveDispensingDoseFactor } from "./dispensing-unit-conversion";
import type { PlanOrderAuthorityConfig } from "./plan-order-authority-domain";

/** Course request quantities. Execution results and historical V1/V2 math stay separate. */
export type DispenseQuantityRule = {
  mode: "exact" | "nearest" | "up" | "down";
  increment: number;
  unit: string;
  displayPrecision: number;
};
export type DispenseRuleSettings = {
  revision: number;
  defaultRules: Record<string, DispenseQuantityRule>;
  productRules: Record<string, DispenseQuantityRule>;
};
export const emptyDispenseRuleSettings: DispenseRuleSettings = {
  revision: 0, defaultRules: {}, productRules: {},
};

export function isDispenseQuantityRule(value: unknown): value is DispenseQuantityRule {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const rule = value as DispenseQuantityRule;
  return Object.keys(rule).every(key => ["mode", "increment", "unit", "displayPrecision"].includes(key)) &&
    ["exact", "nearest", "up", "down"].includes(rule.mode) &&
    typeof rule.unit === "string" && rule.unit.trim().length > 0 && rule.unit.length <= 40 &&
    Number.isFinite(rule.increment) && rule.increment > 0 &&
    Number.isInteger(rule.displayPrecision) && rule.displayPrecision >= 0 && rule.displayPrecision <= 9 &&
    (rule.mode === "exact" || decimalPlaces(rule.increment) <= rule.displayPrecision);
}

function decimalParts(value: number): { integer: bigint; scale: number } {
  const [mantissa, exponent = "0"] = String(value).toLowerCase().split("e");
  const [whole, fraction = ""] = mantissa.split(".");
  const scale = fraction.length - Number(exponent);
  return { integer: BigInt(whole + fraction) * BigInt(10) ** BigInt(Math.max(0, -scale)), scale: Math.max(0, scale) };
}
function decimalPlaces(value: number) { return decimalParts(value).scale; }

export function calculateDispenseRequestTotal(
  theoreticalTotal: number, unit: string, rule: DispenseQuantityRule | null,
): { ok: true; quantity: number } | { ok: false; reason: string } {
  if (!Number.isFinite(theoreticalTotal) || theoreticalTotal <= 0) return { ok: false, reason: "invalid_quantity" };
  if (!rule) return { ok: true, quantity: theoreticalTotal };
  if (!isDispenseQuantityRule(rule)) return { ok: false, reason: "invalid_rule" };
  if (rule.mode === "exact") return { ok: true, quantity: theoreticalTotal };
  if (rule.unit !== unit) return { ok: false, reason: "rule_unit_mismatch" };
  const total = decimalParts(theoreticalTotal), step = decimalParts(rule.increment);
  const scale = Math.max(total.scale, step.scale);
  const numerator = total.integer * BigInt(10) ** BigInt(scale - total.scale);
  const denominator = step.integer * BigInt(10) ** BigInt(scale - step.scale);
  let count = numerator / denominator;
  const remainder = numerator % denominator;
  if ((rule.mode === "up" && remainder > BigInt(0)) || (rule.mode === "nearest" && remainder * BigInt(2) >= denominator)) count++;
  const quantity = Number(count * denominator) / 10 ** scale;
  return quantity > 0 && Number.isFinite(quantity) ? { ok: true, quantity } : { ok: false, reason: "non_positive_request" };
}

/** Never use display precision to round a persisted request. */
export function formatDispenseRequestQuantity(value: number, minimumDecimals = 0): string {
  if (!Number.isFinite(value)) return "";
  const { integer, scale } = decimalParts(value);
  const negative = integer < BigInt(0);
  const digits = (negative ? -integer : integer).toString().padStart(scale + 1, "0");
  const whole = scale ? digits.slice(0, -scale) : digits;
  const fraction = (scale ? digits.slice(-scale) : "").padEnd(Math.min(9, Math.max(0, minimumDecimals)), "0");
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

export function resolveDispenseRule(settings: DispenseRuleSettings, productKey: string, unit: string) {
  const exception = settings.productRules[productKey];
  return { rule: exception ?? settings.defaultRules[unit] ?? null,
    source: exception ? "product" as const : settings.defaultRules[unit] ? "hospital" as const : "theoretical" as const,
    version: settings.revision };
}

/** Daily occurrence counts are derived; a stale explicit count must not win. */
export function updateDispensingPrescriptionInput(inputs: Record<string, unknown>, key: string, value: unknown) {
  const next = { ...inputs };
  if (value === undefined || value === "") delete next[key]; else next[key] = value;
  if (["frequency", "durationDays"].includes(key) && ["once", "sid", "bid", "tid", "qid"].includes(String(next.frequency))) {
    delete next.totalOccurrences;
    delete next.maximumAuthorizedCount;
  }
  return next;
}

/** Unit and amount are committed in one draft update. Never relabel an existing quantity. */
export function updateDispensingPrescriptionWithUnits(inputs: Record<string, unknown>, key: string, value: unknown, config: PlanOrderAuthorityConfig | null):
  { ok: true; inputs: Record<string, unknown> } | { ok: false; message: string } {
  if (key === "doseBasis" && ["patient", "head"].includes(String(value)) && inputs.doseBasis === "kg" &&
      typeof inputs.doseUnit === "string" && inputs.doseUnit.endsWith("/kg")) {
    // This is an explicit basis change, not a unit-only edit: retain the entered
    // dose and remove its obsolete per-kg suffix before weight is recalculated.
    return { ok: true, inputs: { ...inputs, doseBasis: value, doseUnit: inputs.doseUnit.slice(0, -3) } };
  }
  if (key !== "doseUnit" || value === inputs.doseUnit) return { ok: true, inputs: updateDispensingPrescriptionInput(inputs, key, value) };
  if (typeof value !== "string" || !resolveDispensingDoseFactor(config, value, inputs.doseBasis).ok) {
    return { ok: false, message: "이 약품에서 환산할 수 없는 단위예요. 단위 설정을 확인해 주세요." };
  }
  if (!inputs.doseUnit) return { ok: true, inputs: { ...inputs, doseUnit: value } };
  const converted = typeof inputs.dose === "number" && typeof inputs.doseUnit === "string"
    ? convertDispensingDose(config, inputs.dose, inputs.doseUnit, value, inputs.doseBasis) : null;
  if (converted === null) return { ok: false, message: "현재 용량과 단위를 환산할 수 없어요. 처방 값과 제품 함량을 확인해 주세요." };
  return { ok: true, inputs: { ...inputs, dose: converted, doseUnit: value } };
}

export function getDispenseRequestCourseQuantity(outputs: Record<string, unknown>): number | null {
  const total = outputs.plannedPracticalTotalQuantity ?? outputs.totalRequiredDispenseQuantity;
  if (typeof total === "number" && Number.isFinite(total)) return total;
  const actual = outputs.actualDispenseQuantity;
  if (typeof actual !== "number" || !Number.isFinite(actual)) return null;
  if (outputs.preparationQuantityScope === "course_total") return actual;
  const count = outputs.totalOccurrences;
  return typeof count === "number" && count > 0 && Number.isFinite(count) ? actual * count : null;
}

export function getDispenseRequestDisplayPrecision(outputs: Record<string, unknown>): number {
  const policy = outputs.preparationPolicy;
  if (!policy || typeof policy !== "object" || Array.isArray(policy)) return 0;
  const precision = (policy as Record<string, unknown>).displayPrecision;
  return typeof precision === "number" && Number.isInteger(precision) && precision >= 0 && precision <= 9 ? precision : 0;
}
