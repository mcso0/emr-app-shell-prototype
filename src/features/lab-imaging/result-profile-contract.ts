// Persisted profile rules are the only interpretation authority. No profile,
// unit or reference range is inferred from an analyte name or a device label.
export type LabProfileJudgment = "low" | "normal" | "high" | "critical" | "abnormal" | "not_judged";
export type LabProfileResultState = "not_entered" | "recorded" | "recorded_without_interval"
  | "instrument_no_result" | "qualified_result" | "flagged_result" | "outside_documented_display_range"
  | "invalid_numeric_format" | "outside_input_range" | "unrecognized_code" | "unsupported_qualifier";
export type LabResultQualifier = "exact" | "less_than" | "greater_than";
export type LabProfileRule = {
  testMasterKey: string; code: string; resultValueKind: "numeric" | "text" | "coded";
  unit: string | null; decimalScale: number | null; supported: boolean;
  numericMin: number | null; numericMax: number | null;
  referenceInterval: { low: number; high: number; lowInclusive: true; highInclusive: true } | null;
  displayRange: { low: number; high: number } | null;
  codes: Array<{ code: string; label: string; judgment: LabProfileJudgment }>;
  referenceStatus: "source_found" | "synthetic_functional_fixture" | "not_applicable" | "unavailable";
  provenance: Record<string, unknown>;
  // Optional on older frozen rules. UI defaults to exact; old qualified results remain readable.
  allowedQualifiers?: LabResultQualifier[];
};
export type LabResultProfile = {
  schemaVersion: 1; id: string; profileKey: string; revision: number; name: string;
  species: "dog" | "cat"; specimenMasterKey: string; method: string;
  device: { manufacturer: string; model: string; kind: "manual" | "analyzer_reference" };
  entryMode: "manual_entry"; integrationStatus: "not_integrated";
  dataOrigin: "synthetic_research_informed" | "synthetic_functional_fixture";
  clinicalUseAllowed: false; clinicalValidation: "not_clinically_validated";
  rules: LabProfileRule[]; provenance: Record<string, unknown>;
};
export type LabProfileValueInput = { value: string | null; qualifier?: "exact" | "less_than" | "greater_than";
  deviceFlag?: string | null; resultState?: "value" | "instrument_no_result" };
export type LabProfileEvaluation = { valid: true; state: LabProfileResultState; judgment: LabProfileJudgment; value: string | null }
  | { valid: false; error: "unsupported_parameter" | "invalid_number" | "invalid_code" | "invalid_result_metadata" | "invalid_text" };
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown, limit = 4000): v is string => typeof v === "string" && v.trim().length > 0 && v.length <= limit;
const nullableNumber = (v: unknown) => v === null || typeof v === "number" && Number.isFinite(v);
const judgments = ["low", "normal", "high", "critical", "abnormal", "not_judged"];
const range = (v: unknown) => v === null || record(v) && typeof v.low === "number" && Number.isFinite(v.low)
  && typeof v.high === "number" && Number.isFinite(v.high) && v.low <= v.high;

export function isLabProfileRule(v: unknown): v is LabProfileRule {
  if (!record(v) || !text(v.testMasterKey, 200) || !text(v.code, 100)
    || !["numeric", "text", "coded"].includes(String(v.resultValueKind)) || typeof v.supported !== "boolean"
    || !(v.unit === null || text(v.unit, 100)) || !(v.decimalScale === null || Number.isInteger(v.decimalScale) && Number(v.decimalScale) >= 0 && Number(v.decimalScale) <= 9)
    || !nullableNumber(v.numericMin) || !nullableNumber(v.numericMax) || !range(v.referenceInterval) || !range(v.displayRange)
    || !["source_found", "synthetic_functional_fixture", "not_applicable", "unavailable"].includes(String(v.referenceStatus))
    || !record(v.provenance) || !Array.isArray(v.codes) || v.codes.length > 100
    || v.codes.some(c => !record(c) || !text(c.code, 100) || !text(c.label, 200) || !judgments.includes(String(c.judgment)))
    || new Set(v.codes.map(c => c.code)).size !== v.codes.length) return false;
  if (record(v.referenceInterval) && (v.referenceInterval.lowInclusive !== true || v.referenceInterval.highInclusive !== true)) return false;
  if (typeof v.numericMin === "number" && typeof v.numericMax === "number" && v.numericMin > v.numericMax) return false;
  if (v.allowedQualifiers !== undefined && (v.resultValueKind !== "numeric" || !Array.isArray(v.allowedQualifiers)
    || !v.allowedQualifiers.includes("exact") || v.allowedQualifiers.length > 3
    || v.allowedQualifiers.some(q => typeof q !== "string" || !["exact", "less_than", "greater_than"].includes(q))
    || new Set(v.allowedQualifiers).size !== v.allowedQualifiers.length)) return false;
  if (v.resultValueKind === "numeric") return v.codes.length === 0;
  return v.referenceInterval === null && v.displayRange === null && v.numericMin === null && v.numericMax === null
    && v.decimalScale === null && (v.resultValueKind !== "coded" || v.codes.length > 0);
}

export function parseLabResultProfile(value: unknown): LabResultProfile | null {
  if (!record(value) || value.schemaVersion !== 1 || typeof value.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.id) || !text(value.profileKey, 200)
    || !Number.isSafeInteger(value.revision) || Number(value.revision) < 1 || !text(value.name, 300)
    || !["dog", "cat"].includes(String(value.species)) || !text(value.specimenMasterKey, 200) || !text(value.method)
    || !record(value.device) || !text(value.device.manufacturer, 200) || !text(value.device.model, 200)
    || !["manual", "analyzer_reference"].includes(String(value.device.kind))
    || value.entryMode !== "manual_entry" || value.integrationStatus !== "not_integrated"
    || !["synthetic_research_informed", "synthetic_functional_fixture"].includes(String(value.dataOrigin))
    || value.clinicalUseAllowed !== false || value.clinicalValidation !== "not_clinically_validated"
    || !record(value.provenance) || !Array.isArray(value.rules) || value.rules.length < 1 || value.rules.length > 200
    || value.rules.some(r => !isLabProfileRule(r)) || new Set(value.rules.map(r => r.testMasterKey)).size !== value.rules.length
    || new Set(value.rules.map(r => r.code)).size !== value.rules.length) return null;
  return value as LabResultProfile;
}

export function evaluateLabProfileValue(rule: LabProfileRule, input: LabProfileValueInput): LabProfileEvaluation {
  if (!rule.supported) return { valid: false, error: "unsupported_parameter" };
  const qualifier = input.qualifier ?? "exact";
  const deviceFlag = input.deviceFlag?.trim() || null;
  if (!["exact", "less_than", "greater_than"].includes(qualifier) || (input.deviceFlag !== undefined && input.deviceFlag !== null && !text(input.deviceFlag, 200))
    || (input.resultState !== undefined && !["value", "instrument_no_result"].includes(input.resultState))) return { valid: false, error: "invalid_result_metadata" };
  const token = input.value?.trim() || null;
  // Evaluate the trimmed token, but retain the entered nonblank string verbatim.
  const value = token === null ? null : input.value!;
  if (input.resultState === "instrument_no_result") {
    return value !== null || qualifier !== "exact" || deviceFlag !== null ? { valid: false, error: "invalid_result_metadata" }
      : { valid: true, value: null, state: "instrument_no_result", judgment: "not_judged" };
  }
  if (value === null) return qualifier !== "exact" || deviceFlag !== null ? { valid: false, error: "invalid_result_metadata" }
    : { valid: true, value: null, state: "not_entered", judgment: "not_judged" };
  if (value.length > 4096) return { valid: false, error: "invalid_text" };
  if (rule.resultValueKind !== "numeric") {
    if (qualifier !== "exact" || deviceFlag !== null) return { valid: false, error: "invalid_result_metadata" };
    if (rule.resultValueKind === "text") return { valid: true, value, state: "recorded_without_interval", judgment: "not_judged" };
    const code = rule.codes.find(item => item.code === token);
    return code ? { valid: true, value, state: "recorded", judgment: code.judgment }
      : { valid: true, value, state: "unrecognized_code", judgment: "not_judged" };
  }
  if (!/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(token!))
    return { valid: true, value, state: "invalid_numeric_format", judgment: "not_judged" };
  const number = Number(token);
  if (!Number.isFinite(number)) return { valid: true, value, state: "invalid_numeric_format", judgment: "not_judged" };
  if ((rule.numericMin !== null && compareDecimalToBound(token!, rule.numericMin) < 0)
    || (rule.numericMax !== null && compareDecimalToBound(token!, rule.numericMax) > 0))
    return { valid: true, value, state: "outside_input_range", judgment: "not_judged" };
  if (rule.allowedQualifiers && !rule.allowedQualifiers.includes(qualifier))
    return { valid: true, value, state: "unsupported_qualifier", judgment: "not_judged" };
  // Precision describes display, not a silent rounding or clinical threshold.
  if (qualifier !== "exact") return { valid: true, value, state: "qualified_result", judgment: "not_judged" };
  if (deviceFlag) return { valid: true, value, state: "flagged_result", judgment: "not_judged" };
  if (rule.displayRange && (compareDecimalToBound(token!, rule.displayRange.low) < 0 || compareDecimalToBound(token!, rule.displayRange.high) > 0))
    return { valid: true, value, state: "outside_documented_display_range", judgment: "not_judged" };
  if (!rule.referenceInterval) return { valid: true, value, state: "recorded_without_interval", judgment: "not_judged" };
  return { valid: true, value, state: "recorded", judgment: compareDecimalToBound(token!, rule.referenceInterval.low) < 0 ? "low"
    : compareDecimalToBound(token!, rule.referenceInterval.high) > 0 ? "high" : "normal" };
}

// Match PostgreSQL numeric comparisons without rounding the entered decimal to float64.
function compareDecimalToBound(value: string, bound: number): number {
  const parts = (token: string) => {
    const [mantissa, exponent = "0"] = token.toLowerCase().split("e");
    const [whole, fraction = ""] = mantissa.replace(/^-/, "").split(".");
    const coefficient = BigInt((whole || "0") + fraction) * BigInt(mantissa.startsWith("-") ? -1 : 1);
    return { coefficient, scale: fraction.length - Number(exponent) };
  };
  const a = parts(value), b = parts(String(bound));
  const scale = Math.max(a.scale, b.scale);
  const left = a.coefficient * BigInt(10) ** BigInt(scale - a.scale);
  const right = b.coefficient * BigInt(10) ** BigInt(scale - b.scale);
  return left < right ? -1 : left > right ? 1 : 0;
}

export function getLabResultWarning(state?: LabProfileResultState): string | null {
  switch (state) {
    case "invalid_numeric_format": return "수치 형식이 아닙니다. 입력한 값은 저장됩니다.";
    case "outside_input_range": return "설정된 입력 범위를 벗어납니다. 값을 확인해 주세요.";
    case "unrecognized_code": return "정해진 선택지에 없는 결과입니다. 입력한 값은 저장됩니다.";
    case "unsupported_qualifier": return "이 검사에 허용된 부등호가 아닙니다. 원 결과를 확인해 주세요.";
    case "outside_documented_display_range": return "설정된 표시 범위를 벗어납니다. 값을 확인해 주세요.";
    default: return null;
  }
}
