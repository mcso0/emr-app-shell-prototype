import { getPatientVitalValueError, getPatientVitalBloodPressureErrors } from "./patient-vital-validation";
import {
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";
import {
  emptyPatientVitalWriteInput,
  type PatientVitalMeasurement,
  type PatientVitalSummary,
  type PatientVitalWriteInput,
} from "@/features/patient-vitals/patient-vital-types";
import {
  getRequiredWorkspaceVitalFieldErrors,
  type WorkspaceVitalSettingsSnapshot,
} from "@/features/patient-vitals/workspace-vital-settings";

export const patientVitalWritePermission = "vital:write" as const;

export type PatientVitalWriteFieldErrors = Partial<
  Record<keyof PatientVitalWriteInput | "vitals", string>
>;

export type PatientVitalWriteGateway = {
  writeVital(input: {
    actorUserId: string;
    encounterId: string;
    values: PatientVitalWriteInput;
    workspaceId: string;
  }): Promise<
    | { ok: true; vital: PatientVitalMeasurement }
    | {
        ok: false;
        status: 409;
        denialReason: "stale_status" | "vital_value_required";
      }
    | { ok: false; status: 500; error: "db_write_failed" }
  >;
};

export type PatientLatestVitalGateway = {
  readLatestVital(input: {
    encounterId: string;
    workspaceId: string;
  }): Promise<
    | { ok: true; vital: PatientVitalMeasurement | null; summary?: PatientVitalSummary }
    | { ok: false; error: "db_read_failed" | "encounter_unavailable" }
  >;
};

export type PatientVitalWriteResult =
  | {
      ok: true;
      status: 200;
      enforcedBy: "patient-vital-write";
      vital: PatientVitalMeasurement;
    }
  | {
      ok: false;
      status: 400;
      error: "invalid_input";
      fieldErrors: PatientVitalWriteFieldErrors;
    }
  | {
      ok: false;
      status: 401 | 403;
      denialReason: WorkspacePermissionDenialReason | "vital_writer_role_required";
    }
  | {
      ok: false;
      status: 409;
      denialReason: "stale_status" | "vital_value_required";
    }
  | { ok: false; status: 500; error: "db_write_failed" | "supabase_client_missing" };

export type PatientLatestVitalReadResult =
  | {
      ok: true;
      status: 200;
      canWriteVitals: boolean;
      enforcedBy: "patient-latest-vital-read";
      vital: PatientVitalMeasurement | null;
      summary?: PatientVitalSummary;
    }
  | {
      ok: false;
      status: 401 | 403;
      denialReason: WorkspacePermissionDenialReason;
    }
  | { ok: false; status: 404; error: "encounter_unavailable" }
  | { ok: false; status: 500; error: "db_read_failed" | "supabase_client_missing" };

export function canWritePatientVitals({
  actorUserId,
  permissionAdapter,
  workspaceId,
}: {
  actorUserId: string | null | undefined;
  permissionAdapter: WorkspacePermissionAdapter;
  workspaceId: string;
}) {
  const permission = resolveWorkspacePermission(permissionAdapter, {
    sessionUserId: actorUserId,
    workspaceId,
    requiredPermission: patientVitalWritePermission,
  });

  return {
    allowed:
      permission.allowed &&
      (permission.assignedRoles.includes("hospital_admin") ||
        permission.jobPosition?.key === "veterinarian" ||
        permission.jobPosition?.key === "technician" ||
        permission.assignedRoles.includes("vet") ||
        permission.assignedRoles.includes("technician")),
    denialReason: permission.allowed ? "vital_writer_role_required" : permission.denialReason,
  } as const;
}

export function validatePatientVitalWriteInput(
  value: unknown,
  vitalSettings?: WorkspaceVitalSettingsSnapshot,
):
  | { valid: true; values: PatientVitalWriteInput }
  | { valid: false; fieldErrors: PatientVitalWriteFieldErrors } {
  if (!isRecord(value)) {
    return { valid: false, fieldErrors: { vitals: "바이탈 값을 다시 확인해 주세요." } };
  }

  const values: PatientVitalWriteInput = { ...emptyPatientVitalWriteInput };
  const fieldErrors: PatientVitalWriteFieldErrors = {};

  for (const key of Object.keys(values) as (keyof PatientVitalWriteInput)[]) {
    const rawValue = value[key];
    if (rawValue === null || rawValue === undefined || rawValue === "") {
      values[key] = null;
      continue;
    }
    const error = getPatientVitalValueError(key, rawValue);
    if (error) fieldErrors[key] = error;
    else values[key] = rawValue as number;
  }

  // Disabled historical fields are retained; current visible BP fields use reception rules.
  if (!vitalSettings || vitalSettings.items.some((item) => item.key === "blood_pressure" && item.enabled)) {
    Object.assign(fieldErrors, getPatientVitalBloodPressureErrors(values.bloodPressureSystolicMmhg, values.bloodPressureDiastolicMmhg));
  }
  if (vitalSettings) {
    Object.assign(fieldErrors, {
      ...getRequiredWorkspaceVitalFieldErrors(vitalSettings, values),
      ...fieldErrors,
    });
  }

  return Object.keys(fieldErrors).length
    ? { valid: false, fieldErrors }
    : { valid: true, values };
}

export async function writePatientVital({
  actorUserId,
  encounterId,
  gateway,
  input,
  permissionAdapter,
  vitalSettings,
  workspaceId,
}: {
  actorUserId: string | null;
  encounterId: string;
  gateway: PatientVitalWriteGateway | null;
  input: unknown;
  permissionAdapter: WorkspacePermissionAdapter;
  vitalSettings?: WorkspaceVitalSettingsSnapshot;
  workspaceId: string;
}): Promise<PatientVitalWriteResult> {
  const validation = validatePatientVitalWriteInput(input, vitalSettings);
  if (!validation.valid) {
    return { ok: false, status: 400, error: "invalid_input", fieldErrors: validation.fieldErrors };
  }

  const access = canWritePatientVitals({ actorUserId, permissionAdapter, workspaceId });
  if (!access.allowed) {
    return {
      ok: false,
      status: access.denialReason === "unauthenticated" ? 401 : 403,
      denialReason: access.denialReason ?? "permission_missing",
    };
  }

  if (!gateway) return { ok: false, status: 500, error: "supabase_client_missing" };

  const result = await gateway.writeVital({
    actorUserId: actorUserId ?? "",
    encounterId,
    values: validation.values,
    workspaceId,
  });
  if (!result.ok) {
    return result.status === 409
      ? { ok: false, status: 409, denialReason: result.denialReason }
      : { ok: false, status: 500, error: result.error };
  }

  return {
    ok: true,
    status: 200,
    enforcedBy: "patient-vital-write",
    vital: result.vital,
  };
}

export async function readPatientLatestVital({
  actorUserId,
  encounterId,
  gateway,
  permissionAdapter,
  workspaceId,
}: {
  actorUserId: string | null;
  encounterId: string;
  gateway: PatientLatestVitalGateway | null;
  permissionAdapter: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<PatientLatestVitalReadResult> {
  const permission = resolveWorkspacePermission(permissionAdapter, {
    sessionUserId: actorUserId,
    workspaceId,
    requiredPermission: "patient:view",
  });
  if (!permission.allowed) {
    return {
      ok: false,
      status: permission.denialReason === "unauthenticated" ? 401 : 403,
      denialReason: permission.denialReason ?? "permission_missing",
    };
  }

  if (!gateway) return { ok: false, status: 500, error: "supabase_client_missing" };

  const result = await gateway.readLatestVital({ encounterId, workspaceId });
  if (!result.ok) {
    return result.error === "encounter_unavailable"
      ? { ok: false, status: 404, error: result.error }
      : { ok: false, status: 500, error: result.error };
  }

  return {
    ok: true,
    status: 200,
    canWriteVitals: canWritePatientVitals({
      actorUserId,
      permissionAdapter,
      workspaceId,
    }).allowed,
    enforcedBy: "patient-latest-vital-read",
    vital: result.vital,
    summary: result.summary,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
