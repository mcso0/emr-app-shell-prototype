import { emptyPatientVitalWriteInput, type PatientVitalWriteInput } from "./patient-vital-types";
import { getRequiredWorkspaceVitalFieldErrors, toCanonicalVitalValue, type WorkspaceVitalKey, type WorkspaceVitalSettingsSnapshot } from "./workspace-vital-settings";

export type PatientVitalField = keyof PatientVitalWriteInput;
export type PatientVitalFieldFeedback = Partial<Record<PatientVitalField, string>>;
export type PatientVitalValidationContext = { species: string; weightKg?: number | null };

export const patientVitalStorageLimits: Record<PatientVitalField, number> = {
  weightKg: 9_999.99,
  temperatureC: 999.9,
  heartRateBpm: 2_147_483_647,
  respiratoryRateRpm: 2_147_483_647,
  bloodPressureSystolicMmhg: 2_147_483_647,
  bloodPressureDiastolicMmhg: 2_147_483_647,
};

export const workspaceVitalKeyByField: Record<PatientVitalField, WorkspaceVitalKey> = {
  weightKg: "weight", temperatureC: "temperature", heartRateBpm: "heart_rate",
  respiratoryRateRpm: "respiratory_rate", bloodPressureSystolicMmhg: "blood_pressure",
  bloodPressureDiastolicMmhg: "blood_pressure",
};

export function getPatientVitalValueError(key: PatientVitalField, value: unknown): string | undefined {
  if (value === null || value === undefined || value === "") return;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return "0보다 큰 숫자를 입력해 주세요.";
  if (value > patientVitalStorageLimits[key]) return "저장할 수 있는 범위를 넘었어요.";
  const decimals = key === "weightKg" ? 2 : key === "temperatureC" ? 1 : 0;
  if (!decimals && !Number.isInteger(value)) return "정수로 입력해 주세요.";
  const scaled = value * 10 ** decimals;
  if (decimals && Math.abs(scaled - Math.round(scaled)) > 1e-8) {
    return decimals === 2 ? "소수 둘째 자리까지 입력해 주세요." : "소수 첫째 자리까지 입력해 주세요.";
  }
}

export function getPatientVitalBloodPressureErrors(systolic: number | null | undefined, diastolic: number | null | undefined): PatientVitalFieldFeedback {
  if (diastolic == null) return {};
  if (systolic == null) return { bloodPressureDiastolicMmhg: "수축기를 먼저 입력해 주세요." };
  return diastolic >= systolic ? { bloodPressureDiastolicMmhg: "수축기보다 작게 입력해 주세요." } : {};
}

/** Shared reception/chart draft rules; values remain in canonical kg/°C. */
export function parsePatientVitalDraft({ draft, settings, enabledFields, retainedValues = emptyPatientVitalWriteInput }: {
  draft: Partial<Record<PatientVitalField, string>>;
  settings?: WorkspaceVitalSettingsSnapshot;
  enabledFields: readonly PatientVitalField[];
  retainedValues?: PatientVitalWriteInput;
}) {
  const values = { ...retainedValues };
  const fieldErrors: PatientVitalFieldFeedback = {};
  for (const key of enabledFields) {
    values[key] = null;
    const raw = draft[key]?.trim() ?? "";
    if (!raw) continue;
    const number = Number(raw);
    if (!Number.isFinite(number)) { fieldErrors[key] = "숫자로 입력해 주세요."; continue; }
    if (number <= 0) { fieldErrors[key] = "0보다 크게 입력해 주세요."; continue; }
    if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw)) { fieldErrors[key] = "숫자로 입력해 주세요."; continue; }
    const decimals = key === "weightKg" ? 2 : key === "temperatureC" ? 1 : 0;
    if (!decimals && !Number.isInteger(number)) { fieldErrors[key] = "정수로 입력해 주세요."; continue; }
    if (decimals && (raw.split(".")[1]?.length ?? 0) > decimals) {
      fieldErrors[key] = decimals === 2 ? "소수 둘째 자리까지 입력해 주세요." : "소수 첫째 자리까지 입력해 주세요.";
      continue;
    }
    const vitalKey = workspaceVitalKeyByField[key];
    const unit = settings?.items.find((item) => item.key === vitalKey)?.displayUnit ?? (vitalKey === "weight" ? "kg" : "°C");
    const canonical = toCanonicalVitalValue(vitalKey, number, unit);
    const error = getPatientVitalValueError(key, canonical);
    if (error) fieldErrors[key] = error;
    else values[key] = canonical;
  }
  if (enabledFields.includes("bloodPressureDiastolicMmhg")) {
    Object.assign(fieldErrors, { ...getPatientVitalBloodPressureErrors(values.bloodPressureSystolicMmhg, values.bloodPressureDiastolicMmhg), ...fieldErrors });
  }
  if (settings) Object.assign(fieldErrors, { ...getRequiredWorkspaceVitalFieldErrors(settings, draft), ...fieldErrors });
  return { values, fieldErrors };
}

/** Existing reception confirmation warnings, not new clinical thresholds. */
export function getPatientVitalFieldWarnings(values: Partial<PatientVitalWriteInput>, patient?: PatientVitalValidationContext, settings?: WorkspaceVitalSettingsSnapshot): PatientVitalFieldFeedback {
  const warnings: PatientVitalFieldFeedback = {};
  if (patient?.species !== "dog" && patient?.species !== "cat") return warnings;
  const unit = (key: WorkspaceVitalKey, fallback: string) => settings?.items.find((item) => item.key === key)?.displayUnit ?? fallback;
  const weight = values.weightKg;
  const prior = patient.weightKg;
  if (weight != null && (weight < .05 || weight > 200 || (prior != null && (weight < prior / 4 || weight > prior * 4)))) {
    warnings.weightKg = `기존 체중과 차이가 커요. ${unit("weight", "kg")} 단위와 측정값을 확인해 주세요.`;
  }
  if (values.temperatureC != null && (values.temperatureC < 30 || values.temperatureC > 45)) warnings.temperatureC = `체온이 매우 이례적이에요. ${unit("temperature", "°C")} 단위를 확인해 주세요.`;
  const ranges = [
    ["heartRateBpm", 20, 400, "심박수가"], ["respiratoryRateRpm", 5, 200, "호흡수가"],
    ["bloodPressureSystolicMmhg", 20, 400, "수축기 혈압이"], ["bloodPressureDiastolicMmhg", 10, 300, "이완기 혈압이"],
  ] as const;
  for (const [key, min, max, label] of ranges) {
    const value = values[key];
    if (value != null && (value < min || value > max)) warnings[key] = `${label} 매우 이례적이에요. 측정값을 확인해 주세요.`;
  }
  for (const key of Object.keys(warnings) as PatientVitalField[]) {
    if (settings && !settings.items.some((item) => item.key === workspaceVitalKeyByField[key] && item.enabled)) delete warnings[key];
  }
  return warnings;
}
