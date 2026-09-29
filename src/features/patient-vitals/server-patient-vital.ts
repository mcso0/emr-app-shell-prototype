export * from "@/features/patient-vitals/server-patient-vital-core";

import {
  type PatientLatestVitalGateway,
  type PatientVitalWriteGateway,
} from "@/features/patient-vitals/server-patient-vital-core";
import { emptyPatientVitalWriteInput, type PatientVitalMeasurement, type PatientVitalSummary, type PatientVitalWriteInput } from "@/features/patient-vitals/patient-vital-types";

export type SupabasePatientVitalClient = {
  rpc(
    functionName: "clair_get_patient_latest_vital_for_encounter",
    args: { p_encounter_id: string; p_workspace_id: string },
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
  rpc(
    functionName: "clair_upsert_waiting_encounter_vitals",
    args: {
      p_actor_user_id: string;
      p_encounter_id: string;
      p_vitals: PatientVitalWriteInput;
      p_workspace_id: string;
    },
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
  rpc(
    functionName: "clair_upsert_chart_encounter_vitals",
    args: {
      p_actor_user_id: string;
      p_encounter_id: string;
      p_vitals: PatientVitalWriteInput;
      p_workspace_id: string;
    },
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
};

export function createSupabasePatientVitalWriteGateway(
  client: SupabasePatientVitalClient,
): PatientVitalWriteGateway {
  return createSupabasePatientVitalWriteGatewayForRpc(
    client,
    "clair_upsert_waiting_encounter_vitals",
  );
}

export function createSupabaseChartPatientVitalWriteGateway(
  client: SupabasePatientVitalClient,
): PatientVitalWriteGateway {
  return createSupabasePatientVitalWriteGatewayForRpc(
    client,
    "clair_upsert_chart_encounter_vitals",
  );
}

function createSupabasePatientVitalWriteGatewayForRpc(
  client: SupabasePatientVitalClient,
  functionName:
    | "clair_upsert_waiting_encounter_vitals"
    | "clair_upsert_chart_encounter_vitals",
): PatientVitalWriteGateway {
  return {
    async writeVital({ actorUserId, encounterId, values, workspaceId }) {
      const args = {
        p_actor_user_id: actorUserId,
        p_encounter_id: encounterId,
        p_vitals: values,
        p_workspace_id: workspaceId,
      };
      const { data, error } =
        functionName === "clair_upsert_waiting_encounter_vitals"
          ? await client.rpc("clair_upsert_waiting_encounter_vitals", args)
          : await client.rpc("clair_upsert_chart_encounter_vitals", args);
      if (error) {
        if (error.message?.includes("stale_status")) {
          return { ok: false, status: 409 as const, denialReason: "stale_status" as const };
        }
        if (error.message?.includes("vital_value_required")) {
          return { ok: false, status: 409 as const, denialReason: "vital_value_required" as const };
        }
        return { ok: false, status: 500 as const, error: "db_write_failed" as const };
      }

      const vital = parsePatientVitalMeasurement(data);
      return vital
        ? { ok: true as const, vital }
        : { ok: false as const, status: 500 as const, error: "db_write_failed" as const };
    },
  };
}

export function createSupabasePatientLatestVitalGateway(
  client: SupabasePatientVitalClient,
): PatientLatestVitalGateway {
  return {
    async readLatestVital({ encounterId, workspaceId }) {
      const { data, error } = await client.rpc("clair_get_patient_latest_vital_for_encounter", {
        p_encounter_id: encounterId,
        p_workspace_id: workspaceId,
      });
      if (error) {
        return {
          ok: false as const,
          error: error.message?.includes("encounter_unavailable")
            ? ("encounter_unavailable" as const)
            : ("db_read_failed" as const),
        };
      }
      if (!isRecord(data)) return { ok: false as const, error: "db_read_failed" as const };
      if (data.vital === null || data.vital === undefined) return { ok: true as const, vital: null, summary: parsePatientVitalSummary(data.summary) };

      const vital = parsePatientVitalMeasurement(data.vital);
      return vital
        ? { ok: true as const, vital, summary: parsePatientVitalSummary(data.summary) }
        : { ok: false as const, error: "db_read_failed" as const };
    },
  };
}

export function parsePatientVitalMeasurement(value: unknown): PatientVitalMeasurement | null {
  if (!isRecord(value)) return null;
  const id = getString(value.id);
  const patientId = getString(value.patientId);
  const encounterId = getString(value.encounterId);
  const measuredAt = getString(value.measuredAt);
  if (!id || !patientId || !encounterId || !measuredAt) return null;

  const vital: PatientVitalMeasurement = { id, patientId, encounterId, measuredAt };
  vital.updatedAt = getString(value.updatedAt);
  vital.createdAt = getString(value.createdAt);
  vital.recordedByName = getString(value.recordedByName);
  assignOptionalNumber(vital, "weightKg", value.weightKg);
  assignOptionalNumber(vital, "temperatureC", value.temperatureC);
  assignOptionalNumber(vital, "heartRateBpm", value.heartRateBpm);
  assignOptionalNumber(vital, "respiratoryRateRpm", value.respiratoryRateRpm);
  assignOptionalNumber(vital, "bloodPressureSystolicMmhg", value.bloodPressureSystolicMmhg);
  assignOptionalNumber(vital, "bloodPressureDiastolicMmhg", value.bloodPressureDiastolicMmhg);
  return vital;
}

function parsePatientVitalSummary(value: unknown): PatientVitalSummary | undefined {
  if (!isRecord(value) || !isRecord(value.values) || !isRecord(value.measuredAtByField)) return undefined;
  const summary: PatientVitalSummary = { values: {}, measuredAtByField: {} };
  for (const key of Object.keys(emptyPatientVitalWriteInput) as (keyof PatientVitalWriteInput)[]) {
    const number = value.values[key];
    const time = value.measuredAtByField[key];
    if (typeof number === "number" && Number.isFinite(number) && typeof time === "string") {
      summary.values[key] = number;
      summary.measuredAtByField[key] = time;
    }
  }
  return summary;
}

function assignOptionalNumber<T extends Record<string, unknown>>(
  target: T,
  key: keyof PatientVitalMeasurement,
  value: unknown,
) {
  if (typeof value === "number" && Number.isFinite(value)) {
    target[key as keyof T] = value as T[keyof T];
  }
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
