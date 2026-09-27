import {
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";
import {
  emptyPatientVitalWriteInput,
  type PatientVitalMeasurement,
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
    | { ok: true; vital: PatientVitalMeasurement | null }
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
    if (typeof rawValue !== "number" || !Number.isFinite(rawValue) || rawValue <= 0) {
      fieldErrors[key] = "0보다 큰 숫자를 입력해 주세요.";
      continue;
    }
    if (key === "weightKg" && !hasAtMostDecimalPlaces(rawValue, 2)) {
      fieldErrors[key] = "소수점 둘째 자리까지 입력해 주세요.";
      continue;
    }
    if (key === "temperatureC" && !hasAtMostDecimalPlaces(rawValue, 1)) {
      fieldErrors[key] = "소수점 첫째 자리까지 입력해 주세요.";
      continue;
    }
    if (
      (key === "respiratoryRateRpm" ||
        key === "heartRateBpm" ||
        key === "bloodPressureSystolicMmhg" ||
        key === "bloodPressureDiastolicMmhg") &&
      !Number.isInteger(rawValue)
    ) {
      fieldErrors[key] = "정수로 입력해 주세요.";
      continue;
    }
    values[key] = rawValue;
  }

  const hasDiastolic = values.bloodPressureDiastolicMmhg !== null;
  if (hasDiastolic && values.bloodPressureSystolicMmhg === null) {
    fieldErrors.bloodPressureDiastolicMmhg = "이완기 혈압을 입력하려면 수축기 혈압이 필요합니다.";
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
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasAtMostDecimalPlaces(value: number, decimalPlaces: number) {
  const factor = 10 ** decimalPlaces;
  return Math.abs(value * factor - Math.round(value * factor)) < Number.EPSILON * factor * 8;
}
