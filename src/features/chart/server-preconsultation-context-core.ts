import {
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";
import type {
  ChartPreconsultationContext,
  ChartPreconsultationHistoryEntry,
  ChartPreconsultationVitalMeasurement,
} from "@/features/chart/preconsultation-context";
import { canWritePatientVitals } from "@/features/patient-vitals/server-patient-vital-core";

export type ChartPreconsultationContextGateway = {
  readContext(input: {
    encounterId: string;
    workspaceId: string;
  }): Promise<
    | { ok: true; context: ChartPreconsultationContext }
    | { ok: false; error: "db_read_failed" | "encounter_unavailable" }
  >;
};

export type ChartPreconsultationContextReadResult =
  | {
      ok: true;
      status: 200;
      context: ChartPreconsultationContext;
      canWriteVitals: boolean;
      enforcedBy: "chart-preconsultation-context-read";
    }
  | {
      ok: false;
      status: 401 | 403;
      denialReason: WorkspacePermissionDenialReason;
    }
  | {
      ok: false;
      status: 404;
      error: "encounter_unavailable";
    }
  | {
      ok: false;
      status: 500;
      error: "db_read_failed" | "supabase_client_missing";
    };

export async function readChartPreconsultationContext({
  actorUserId,
  encounterId,
  gateway,
  permissionAdapter,
  workspaceId,
}: {
  actorUserId: string | null;
  encounterId: string;
  gateway: ChartPreconsultationContextGateway | null;
  permissionAdapter: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<ChartPreconsultationContextReadResult> {
  const permission = resolveWorkspacePermission(permissionAdapter, {
    sessionUserId: actorUserId,
    workspaceId,
    requiredPermission: "chart:view",
  });

  if (!permission.allowed) {
    return {
      ok: false,
      status: permission.denialReason === "unauthenticated" ? 401 : 403,
      denialReason: permission.denialReason ?? "permission_missing",
    };
  }

  if (!gateway) {
    return { ok: false, status: 500, error: "supabase_client_missing" };
  }

  const result = await gateway.readContext({ encounterId, workspaceId });
  if (!result.ok) {
    if (result.error === "encounter_unavailable") {
      return { ok: false, status: 404, error: result.error };
    }
    return { ok: false, status: 500, error: result.error };
  }

  return {
    ok: true,
    status: 200,
    context: result.context,
    canWriteVitals: canWritePatientVitals({
      actorUserId,
      permissionAdapter,
      workspaceId,
    }).allowed,
    enforcedBy: "chart-preconsultation-context-read",
  };
}

export type SupabaseChartPreconsultationContextClient = {
  rpc(
    functionName: "clair_get_chart_preconsultation_context",
    args: { p_encounter_id: string; p_workspace_id: string },
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
};

export function createSupabaseChartPreconsultationContextGateway(
  client: SupabaseChartPreconsultationContextClient,
): ChartPreconsultationContextGateway {
  return {
    async readContext({ encounterId, workspaceId }) {
      const { data, error } = await client.rpc(
        "clair_get_chart_preconsultation_context",
        {
          p_encounter_id: encounterId,
          p_workspace_id: workspaceId,
        },
      );

      if (error) {
        return {
          ok: false,
          error: error.message?.includes("encounter_unavailable")
            ? "encounter_unavailable"
            : "db_read_failed",
        };
      }

      const context = parseChartPreconsultationContext(data);
      return context
        ? { ok: true, context }
        : { ok: false, error: "db_read_failed" };
    },
  };
}

export function parseChartPreconsultationContext(
  value: unknown,
): ChartPreconsultationContext | null {
  if (!isRecord(value)) return null;

  const encounter = parseEncounter(value.encounter);
  const queue = parseQueue(value.queue);
  const patient = parsePatient(value.patient);
  if (!encounter || !queue || !patient) return null;

  const guardian = parseGuardian(value.guardian);
  const appointment = parseAppointment(value.appointment);
  const veterinarian = parseVeterinarian(value.veterinarian);
  const vitals = Array.isArray(value.vitals)
    ? value.vitals.flatMap((item) => {
        const parsed = parseVital(item);
        return parsed ? [parsed] : [];
      })
    : [];
  const history = Array.isArray(value.history)
    ? value.history.flatMap((item) => {
        const parsed = parseHistory(item);
        return parsed ? [parsed] : [];
      })
    : [];

  return {
    encounter,
    queue,
    patient,
    ...(guardian ? { guardian } : {}),
    ...(appointment ? { appointment } : {}),
    ...(veterinarian ? { veterinarian } : {}),
    priorEncounterCount: getFiniteNumber(value.priorEncounterCount) ?? 0,
    vitals,
    history,
  };
}

function parseEncounter(value: unknown): ChartPreconsultationContext["encounter"] | null {
  if (!isRecord(value)) return null;
  const id = getString(value.id);
  const encounterNo = getString(value.encounterNo);
  const checkedInAt = getString(value.checkedInAt);
  const status = getString(value.status);
  const receptionType = getString(value.receptionType);
  if (
    !id ||
    !encounterNo ||
    !checkedInAt ||
    !status ||
    (receptionType !== "appointment" && receptionType !== "walk_in")
  ) {
    return null;
  }

  return {
    id,
    encounterNo,
    checkedInAt,
    status,
    receptionType,
    ...optionalStringFields(value, [
      "appointmentId",
      "visitPurpose",
      "chiefComplaint",
      "receptionMemo",
    ]),
  };
}

function parseQueue(value: unknown): ChartPreconsultationContext["queue"] | null {
  if (!isRecord(value)) return null;
  const id = getString(value.id);
  const status = getString(value.status);
  return id && status ? { id, status } : null;
}

function parsePatient(value: unknown): ChartPreconsultationContext["patient"] | null {
  if (!isRecord(value)) return null;
  const id = getString(value.id);
  const patientNo = getString(value.patientNo);
  const name = getString(value.name);
  const species = getString(value.species);
  const sex = getString(value.sex);
  if (!id || !patientNo || !name || !species || !sex) return null;

  const patient: ChartPreconsultationContext["patient"] = {
    id,
    patientNo,
    name,
    species,
    sex,
    ...optionalStringFields(value, [
      "breed",
      "birthDate",
      "estimatedAgeText",
      "allergyNote",
      "specialNote",
      "handlingCautionNote",
    ]),
  };
  const neutered = getBoolean(value.neutered);
  const weightKg = getFiniteNumber(value.weightKg);
  if (neutered !== undefined) patient.neutered = neutered;
  if (weightKg !== undefined) patient.weightKg = weightKg;
  return patient;
}

function parseGuardian(value: unknown): ChartPreconsultationContext["guardian"] | undefined {
  if (!isRecord(value)) return undefined;
  const id = getString(value.id);
  const name = getString(value.name);
  if (!id || !name) return undefined;
  return { id, name, ...optionalStringFields(value, ["memo"]) };
}

function parseAppointment(value: unknown): ChartPreconsultationContext["appointment"] | undefined {
  if (!isRecord(value)) return undefined;
  const id = getString(value.id);
  if (!id) return undefined;
  return {
    id,
    ...optionalStringFields(value, ["visitPurpose", "symptomNote"]),
  };
}

function parseVeterinarian(value: unknown): ChartPreconsultationContext["veterinarian"] | undefined {
  if (!isRecord(value)) return undefined;
  const id = getString(value.id);
  const displayName = getString(value.displayName);
  return id && displayName ? { id, displayName } : undefined;
}

function parseVital(value: unknown): ChartPreconsultationVitalMeasurement | null {
  if (!isRecord(value)) return null;
  const id = getString(value.id);
  const encounterId = getString(value.encounterId);
  const measuredAt = getString(value.measuredAt);
  if (!id || !encounterId || !measuredAt) return null;

  const vital: ChartPreconsultationVitalMeasurement = { id, encounterId, measuredAt };
  assignOptionalNumber(vital, "weightKg", value.weightKg);
  assignOptionalNumber(vital, "temperatureC", value.temperatureC);
  assignOptionalNumber(vital, "respiratoryRateRpm", value.respiratoryRateRpm);
  assignOptionalNumber(
    vital,
    "bloodPressureSystolicMmhg",
    value.bloodPressureSystolicMmhg,
  );
  assignOptionalNumber(
    vital,
    "bloodPressureDiastolicMmhg",
    value.bloodPressureDiastolicMmhg,
  );
  return vital;
}

function parseHistory(value: unknown): ChartPreconsultationHistoryEntry | null {
  if (!isRecord(value)) return null;
  const encounterId = getString(value.encounterId);
  const encounterNo = getString(value.encounterNo);
  const checkedInAt = getString(value.checkedInAt);
  const status = getString(value.status);
  if (!encounterId || !encounterNo || !checkedInAt || !status) return null;
  return {
    encounterId,
    encounterNo,
    checkedInAt,
    status,
    ...optionalStringFields(value, [
      "visitPurpose",
      "chiefComplaint",
      "receptionMemo",
      "subjective",
      "assessment",
      "plan",
      "primaryDiagnosis",
    ]),
  };
}

function optionalStringFields<T extends string>(value: Record<string, unknown>, keys: T[]) {
  return keys.reduce<Partial<Record<T, string>>>((result, key) => {
    const nextValue = getString(value[key]);
    if (nextValue) result[key] = nextValue;
    return result;
  }, {});
}

function assignOptionalNumber<T extends object, K extends keyof T>(
  target: T,
  key: K,
  value: unknown,
) {
  const parsed = getFiniteNumber(value);
  if (parsed !== undefined) target[key] = parsed as T[K];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function getBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function getFiniteNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
