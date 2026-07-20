export type PatientVitalMeasurement = {
  bloodPressureDiastolicMmhg?: number;
  bloodPressureSystolicMmhg?: number;
  encounterId: string;
  id: string;
  measuredAt: string;
  patientId: string;
  respiratoryRateRpm?: number;
  temperatureC?: number;
  weightKg?: number;
};

export type PatientVitalWriteInput = {
  bloodPressureDiastolicMmhg: number | null;
  bloodPressureSystolicMmhg: number | null;
  respiratoryRateRpm: number | null;
  temperatureC: number | null;
  weightKg: number | null;
};

export type PatientVitalDisplayItem = {
  label: string;
  value: string;
};

export const emptyPatientVitalWriteInput: PatientVitalWriteInput = {
  bloodPressureDiastolicMmhg: null,
  bloodPressureSystolicMmhg: null,
  respiratoryRateRpm: null,
  temperatureC: null,
  weightKg: null,
};

export function toPatientVitalWriteInput(
  measurement?: Pick<
    PatientVitalMeasurement,
    | "weightKg"
    | "temperatureC"
    | "respiratoryRateRpm"
    | "bloodPressureSystolicMmhg"
    | "bloodPressureDiastolicMmhg"
  >,
): PatientVitalWriteInput {
  return {
    weightKg: measurement?.weightKg ?? null,
    temperatureC: measurement?.temperatureC ?? null,
    respiratoryRateRpm: measurement?.respiratoryRateRpm ?? null,
    bloodPressureSystolicMmhg: measurement?.bloodPressureSystolicMmhg ?? null,
    bloodPressureDiastolicMmhg: measurement?.bloodPressureDiastolicMmhg ?? null,
  };
}

export function hasPatientVitalValue(values: PatientVitalWriteInput) {
  return Object.values(values).some((value) => value !== null);
}

export function formatPatientVitalDisplayItems(
  measurement?: Pick<
    PatientVitalMeasurement,
    | "weightKg"
    | "temperatureC"
    | "respiratoryRateRpm"
    | "bloodPressureSystolicMmhg"
    | "bloodPressureDiastolicMmhg"
  > | null,
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
      label: "혈압",
      value:
        measurement?.bloodPressureSystolicMmhg === undefined ||
        measurement.bloodPressureDiastolicMmhg === undefined
          ? "—"
          : `${measurement.bloodPressureSystolicMmhg}/${measurement.bloodPressureDiastolicMmhg} mmHg`,
    },
  ];
}
