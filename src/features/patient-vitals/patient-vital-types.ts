import {
  fromCanonicalVitalValue,
  getEnabledWorkspaceVitalSettings,
  type WorkspaceVitalKey,
  type WorkspaceVitalSettingsSnapshot,
  type WorkspaceVitalUnit,
} from "@/features/patient-vitals/workspace-vital-settings";

export type PatientVitalMeasurement = {
  bloodPressureDiastolicMmhg?: number;
  bloodPressureSystolicMmhg?: number;
  encounterId: string;
  id: string;
  heartRateBpm?: number;
  measuredAt: string;
  patientId: string;
  respiratoryRateRpm?: number;
  temperatureC?: number;
  weightKg?: number;
};

export type PatientVitalWriteInput = {
  bloodPressureDiastolicMmhg: number | null;
  bloodPressureSystolicMmhg: number | null;
  heartRateBpm: number | null;
  respiratoryRateRpm: number | null;
  temperatureC: number | null;
  weightKg: number | null;
};

export type PatientVitalDisplayItem = {
  label: string;
  value: string;
};

type PatientVitalDisplayMeasurement = Pick<
  PatientVitalMeasurement,
  | "weightKg"
  | "temperatureC"
  | "heartRateBpm"
  | "respiratoryRateRpm"
  | "bloodPressureSystolicMmhg"
  | "bloodPressureDiastolicMmhg"
>;

export const emptyPatientVitalWriteInput: PatientVitalWriteInput = {
  bloodPressureDiastolicMmhg: null,
  bloodPressureSystolicMmhg: null,
  heartRateBpm: null,
  respiratoryRateRpm: null,
  temperatureC: null,
  weightKg: null,
};

export function toPatientVitalWriteInput(
  measurement?: Pick<
    PatientVitalMeasurement,
    | "weightKg"
    | "temperatureC"
    | "heartRateBpm"
    | "respiratoryRateRpm"
    | "bloodPressureSystolicMmhg"
    | "bloodPressureDiastolicMmhg"
  >,
): PatientVitalWriteInput {
  return {
    weightKg: measurement?.weightKg ?? null,
    temperatureC: measurement?.temperatureC ?? null,
    heartRateBpm: measurement?.heartRateBpm ?? null,
    respiratoryRateRpm: measurement?.respiratoryRateRpm ?? null,
    bloodPressureSystolicMmhg: measurement?.bloodPressureSystolicMmhg ?? null,
    bloodPressureDiastolicMmhg: measurement?.bloodPressureDiastolicMmhg ?? null,
  };
}

export function hasPatientVitalValue(values: PatientVitalWriteInput) {
  return Object.values(values).some((value) => value !== null);
}

export function formatPatientVitalDisplayItems(
  measurement?: PatientVitalDisplayMeasurement | null,
): PatientVitalDisplayItem[] {
  return [
    {
      label: "체중",
      value: measurement?.weightKg === undefined ? "—" : `${measurement.weightKg.toFixed(2)} kg`,
    },
    {
      label: "체온",
      value:
        measurement?.temperatureC === undefined ? "—" : `${measurement.temperatureC.toFixed(1)}°C`,
    },
    {
      label: "호흡",
      value:
        measurement?.respiratoryRateRpm === undefined
          ? "—"
          : `${measurement.respiratoryRateRpm} rpm`,
    },
    {
      label: "심박수",
      value:
        measurement?.heartRateBpm === undefined
          ? "—"
          : `${measurement.heartRateBpm} bpm`,
    },
    {
      label: "혈압",
      value:
        measurement?.bloodPressureSystolicMmhg === undefined ||
        measurement.bloodPressureDiastolicMmhg === undefined
          ? "—"
          : `${measurement.bloodPressureSystolicMmhg}/${measurement.bloodPressureDiastolicMmhg} mmHg`,
    },
  ];
}

export function formatPatientVitalDisplayItemsForSettings(
  measurement: PatientVitalDisplayMeasurement | null | undefined,
  settings: WorkspaceVitalSettingsSnapshot,
): PatientVitalDisplayItem[] {
  return getEnabledWorkspaceVitalSettings(settings).map((setting) => ({
    label: getPatientVitalDisplayLabel(setting.key),
    value: formatPatientVitalDisplayValue(measurement, setting.key, setting.displayUnit),
  }));
}

function getPatientVitalDisplayLabel(key: WorkspaceVitalKey) {
  return ({
    weight: "체중",
    temperature: "체온",
    heart_rate: "심박수",
    respiratory_rate: "호흡",
    blood_pressure: "혈압",
  } satisfies Record<WorkspaceVitalKey, string>)[key];
}

function formatPatientVitalDisplayValue(
  measurement: PatientVitalDisplayMeasurement | null | undefined,
  key: WorkspaceVitalKey,
  unit: WorkspaceVitalUnit,
) {
  if (key === "weight") {
    if (measurement?.weightKg === undefined) return "—";
    const value = fromCanonicalVitalValue(key, measurement.weightKg, unit);
    return `${value.toFixed(unit === "g" ? 0 : 2)} ${unit}`;
  }
  if (key === "temperature") {
    if (measurement?.temperatureC === undefined) return "—";
    const value = fromCanonicalVitalValue(key, measurement.temperatureC, unit);
    return `${value.toFixed(1)}${unit}`;
  }
  if (key === "heart_rate") {
    return measurement?.heartRateBpm === undefined ? "—" : `${measurement.heartRateBpm} ${unit}`;
  }
  if (key === "respiratory_rate") {
    return measurement?.respiratoryRateRpm === undefined
      ? "—"
      : `${measurement.respiratoryRateRpm} ${unit}`;
  }
  if (measurement?.bloodPressureSystolicMmhg === undefined) return "—";
  return measurement.bloodPressureDiastolicMmhg === undefined
    ? `${measurement.bloodPressureSystolicMmhg} ${unit}`
    : `${measurement.bloodPressureSystolicMmhg}/${measurement.bloodPressureDiastolicMmhg} ${unit}`;
}
