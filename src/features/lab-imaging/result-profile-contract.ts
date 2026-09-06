// Persisted profile rules are the only interpretation authority. No profile,
// unit or reference range is inferred from an analyte name or a device label.
export type LabProfileJudgment = "low" | "normal" | "high" | "critical" | "abnormal" | "not_judged";
export type LabProfileResultState = "not_entered" | "recorded" | "recorded_without_interval"
  | "instrument_no_result" | "qualified_result" | "flagged_result" | "outside_documented_display_range";
export type LabProfileRule = {
  testMasterKey: string; code: string; resultValueKind: "numeric" | "text" | "coded";
  unit: string | null; decimalScale: number | null; supported: boolean;
  numericMin: number | null; numericMax: number | null;
  referenceInterval: { low: number; high: number; lowInclusive: true; highInclusive: true } | null;
  displayRange: { low: number; high: number } | null;
  codes: Array<{ code: string; label: string; judgment: LabProfileJudgment }>;
  referenceStatus: "source_found" | "synthetic_functional_fixture" | "not_applicable" | "unavailable";
  provenance: Record<string, unknown>;
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
  const value = input.value?.trim() || null;
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
    const code = rule.codes.find(item => item.code === value);
    return code ? { valid: true, value, state: "recorded", judgment: code.judgment } : { valid: false, error: "invalid_code" };
  }
  if (!/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) return { valid: false, error: "invalid_number" };
  const number = Number(value);
  if (!Number.isFinite(number) || (rule.numericMin !== null && number < rule.numericMin)
    || (rule.numericMax !== null && number > rule.numericMax)) return { valid: false, error: "invalid_number" };
  // Precision describes display, not a silent rounding or clinical threshold.
  if (qualifier !== "exact") return { valid: true, value, state: "qualified_result", judgment: "not_judged" };
  if (deviceFlag) return { valid: true, value, state: "flagged_result", judgment: "not_judged" };
  if (rule.displayRange && (number < rule.displayRange.low || number > rule.displayRange.high))
    return { valid: true, value, state: "outside_documented_display_range", judgment: "not_judged" };
  if (!rule.referenceInterval) return { valid: true, value, state: "recorded_without_interval", judgment: "not_judged" };
  return { valid: true, value, state: "recorded", judgment: number < rule.referenceInterval.low ? "low" : number > rule.referenceInterval.high ? "high" : "normal" };
}
