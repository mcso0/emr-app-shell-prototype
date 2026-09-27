import {
  createMockWorkspacePermissionAdapter,
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";
import {
  emitLiveMutationAuditEvent,
  type LiveMutationAuditOptions,
} from "@/features/audit/server-mutation-audit-core";
import type {
  ReceptionVitalMeasurementInput,
  ReceptionWalkInEncounterInput,
  ReceptionWalkInEncounterRecord,
} from "@/features/reception/walk-in-encounter";
import { getReceptionMutationPermissionContract } from "@/features/reception/reception-mutation-permissions";
import { createInitialHospitalBasicSettingsDraft, type HospitalBasicSettingsDraft } from "@/features/hospital-admin/settings/hospital-basic-settings-model";
import { isReceptionTimeAllowed } from "@/features/reception/effective-operating-hours";
import {
  mockGuardians,
  mockPatientGuardians,
  mockPatients,
} from "@/mocks/emr-domain";
import {
  isReceptionDurationMinutesValid,
  receptionDurationValidationMessage,
} from "@/features/reception/reception-duration";
import {
  createDefaultWorkspaceVitalSettingsSnapshot,
  getRequiredWorkspaceVitalFieldErrors,
  type WorkspaceVitalSettingsSnapshot,
} from "@/features/patient-vitals/workspace-vital-settings";
import type {
  Encounter,
  Guardian,
  Patient,
  PatientGuardian,
  WaitingQueueEntry,
} from "@/types/emr-domain";

export type ReceptionWalkInEncounterFieldErrorKey =
  | "assignedStaffUserIds"
  | "patientId"
  | "durationMinutes"
  | "plannedStartAt"
  | "vitals"
  | "vitals.weightKg"
  | "vitals.temperatureC"
  | "vitals.heartRateBpm"
  | "vitals.respiratoryRateRpm"
  | "vitals.bloodPressure"
  | "vitals.bloodPressure.systolicMmhg"
  | "vitals.bloodPressure.diastolicMmhg";

export type ReceptionWalkInEncounterFieldErrors = Partial<
  Record<ReceptionWalkInEncounterFieldErrorKey, string>
>;

type SupabaseWalkInMembershipRow = {
  id: string;
  roles: string[] | null;
  status: string;
  user_id: string;
  workspace_id: string;
};

type SupabaseWalkInUserRow = {
  id: string;
  status: string;
};

type SupabaseWalkInQueryBuilder<Row> = PromiseLike<{
  data: Row[] | null;
  error: { message?: string } | null;
}> & {
  eq(column: string, value: string): SupabaseWalkInQueryBuilder<Row>;
  select(columns: string): SupabaseWalkInQueryBuilder<Row>;
};

export type ReceptionWalkInEncounterGatewayResult =
  | { ok: true; walkIn: ReceptionWalkInEncounterRecord }
  | {
      ok: false;
      status: 409;
	      denialReason:
	        | "patient_unavailable"
	        | "guardian_unavailable"
	        | "patient_guardian_link_missing"
	        | "primary_veterinarian_unavailable"
	        | "assigned_staff_unavailable"
	        | "walk_in_outside_business_hours";
    }
  | { ok: false; status: 500; error: "db_write_failed" };

export type ReceptionWalkInEncounterGateway = {
  createWalkInEncounter(input: {
    actorUserId: string;
    workspaceId: string;
    input: ReceptionWalkInEncounterInput;
  }): Promise<ReceptionWalkInEncounterGatewayResult>;
};

export type ReceptionWalkInEncounterResult =
  | {
      ok: true;
      status: 201;
      workspaceId: string;
      walkIn: ReceptionWalkInEncounterRecord;
      enforcedBy: "reception-walk-in-encounter";
    }
  | {
      ok: false;
      status: 400;
      error: "invalid_input";
      fieldErrors: ReceptionWalkInEncounterFieldErrors;
    }
  | {
      ok: false;
      status: 401 | 403;
      denialReason: WorkspacePermissionDenialReason;
    }
  | {
      ok: false;
      status: 409;
	      denialReason:
	        | "patient_unavailable"
	        | "guardian_unavailable"
	        | "patient_guardian_link_missing"
	        | "primary_veterinarian_unavailable"
	        | "assigned_staff_unavailable"
	        | "walk_in_outside_business_hours";
    }
  | {
      ok: false;
      status: 500;
      error: "db_write_failed" | "supabase_client_missing";
    };


export async function createReceptionWalkInEncounter({
  actorUserId,
  auditGateway,
  auditNow,
  auditRequestId,
  gateway = createMockReceptionWalkInEncounterGateway(),
  input,
  vitalSettings = createDefaultWorkspaceVitalSettingsSnapshot(),
  permissionAdapter = createDemoReceptionWalkInPermissionAdapter(),
  workspaceId,
}: {
  actorUserId: string | null;
  auditGateway?: LiveMutationAuditOptions["auditGateway"];
  auditNow?: LiveMutationAuditOptions["auditNow"];
  auditRequestId?: LiveMutationAuditOptions["auditRequestId"];
  gateway?: ReceptionWalkInEncounterGateway;
  input: ReceptionWalkInEncounterInput;
  vitalSettings?: WorkspaceVitalSettingsSnapshot;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<ReceptionWalkInEncounterResult> {
  const validation = validateWalkInInput(input, vitalSettings);

  if (!validation.valid) {
    return {
      ok: false,
      status: 400,
      error: "invalid_input",
      fieldErrors: validation.fieldErrors,
    };
  }

  const normalized = normalizeWalkInInput(input);

  const permissionContract = getReceptionMutationPermissionContract(
    "walk_in_encounter_create",
  );
  const permission = resolveWorkspacePermission(permissionAdapter, {
    sessionUserId: actorUserId,
    workspaceId,
    requiredPermission: permissionContract.requiredPermission,
  });

  if (!permission.allowed) {
    return {
      ok: false,
      status: permission.denialReason === "unauthenticated" ? 401 : 403,
      denialReason: permission.denialReason ?? "permission_missing",
    };
  }

  const result = await gateway.createWalkInEncounter({
    actorUserId: actorUserId ?? "",
    workspaceId,
    input: normalized,
  });

  if (!result.ok) {
    if (result.status === 409) {
      return { ok: false, status: 409, denialReason: result.denialReason };
    }

    return { ok: false, status: 500, error: result.error };
  }

  const audit = await emitLiveMutationAuditEvent({
    auditGateway,
    auditNow,
    input: {
      workspaceId,
      actorUserId,
      eventType: "reception.walk_in_created",
      targetType: "encounter",
      targetId: result.walkIn.encounter.id,
      encounterId: result.walkIn.encounter.id,
      patientId: result.walkIn.encounter.patientId,
      guardianId: result.walkIn.encounter.guardianId ?? null,
      requestId: auditRequestId,
      after: {
        queueStatus: result.walkIn.queueEntry.status,
        receptionType: result.walkIn.encounter.receptionType,
        status: result.walkIn.encounter.status,
      },
      metadata: { source: "reception-walk-in-encounter" },
    },
  });
  if (!audit.ok) return { ok: false, status: 500, error: "db_write_failed" };

  return {
    ok: true,
    status: 201,
    workspaceId,
    walkIn: result.walkIn,
    enforcedBy: "reception-walk-in-encounter",
  };
}

export function createMockReceptionWalkInEncounterGateway(
  dataset: {
    guardians: Guardian[];
    patientGuardians: PatientGuardian[];
    patients: Patient[];
    operatingHours?: Pick<HospitalBasicSettingsDraft, "timezone" | "weeklyHours" | "exceptions">;
  } = {
    guardians: mockGuardians,
    patientGuardians: mockPatientGuardians,
    patients: mockPatients,
  },
  now = new Date().toISOString(),
): ReceptionWalkInEncounterGateway {
  return {
    async createWalkInEncounter({ workspaceId, input }) {
      const eventTime = input.plannedStartAt ?? now;
      const availability = isReceptionTimeAllowed({
        scheduledStartAt: eventTime,
        durationMinutes: input.durationMinutes ?? 30,
        settings: dataset.operatingHours ?? createInitialHospitalBasicSettingsDraft(),
      });
      if (!availability.allowed) {
        return { ok: false, status: 409, denialReason: "walk_in_outside_business_hours" };
      }
      const patient = dataset.patients.find(
        (item) =>
          item.id === input.patientId &&
          item.workspaceId === workspaceId &&
          item.status === "active",
      );

      if (!patient)
        return { ok: false, status: 409, denialReason: "patient_unavailable" };

      if (input.guardianId) {
        const guardian = dataset.guardians.find(
          (item) =>
            item.id === input.guardianId && item.workspaceId === workspaceId,
        );
        if (!guardian)
          return {
            ok: false,
            status: 409,
            denialReason: "guardian_unavailable",
          };

        const linked = dataset.patientGuardians.some(
          (link) =>
            link.patientId === patient.id && link.guardianId === guardian.id,
        );
        if (!linked) {
          return {
            ok: false,
            status: 409,
            denialReason: "patient_guardian_link_missing",
          };
        }
      }

	      const seed = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
	      const encounter: Encounter = {
        id: `encounter-walkin-${seed}`,
        workspaceId,
        patientId: patient.id,
        guardianId: input.guardianId,
        primaryVeterinarianId: input.primaryVeterinarianId,
        assignedStaffUserIds: getWalkInAssignedStaffUserIds(input),
        encounterNo: `E-WALKIN-${seed.slice(-6).toUpperCase()}`,
        receptionType: "walk_in",
        department: input.department,
        durationMinutes: input.durationMinutes,
        chiefComplaint: input.visitPurpose,
        visitPurpose: input.visitPurpose ?? "현장 접수",
        receptionMemo: input.memo,
        status: "waiting",
	        checkedInAt: eventTime,
	        createdAt: now,
	        updatedAt: now,
      };
      const queueEntry: WaitingQueueEntry = {
        id: `queue-${encounter.id}`,
        workspaceId,
        encounterId: encounter.id,
        queueType: "consultation",
        status: "waiting",
        priority: "normal",
	        enteredAt: eventTime,
	      };

      if (input.vitals?.weightKg !== undefined) {
        patient.weightKg = input.vitals.weightKg;
        patient.updatedAt = eventTime;
      }

      return { ok: true, walkIn: { encounter, queueEntry } };
    },
  };
}

export type SupabaseReceptionWalkInEncounterRpcClient = {
  from(table: "user_memberships"): SupabaseWalkInQueryBuilder<SupabaseWalkInMembershipRow>;
  from(table: "users"): SupabaseWalkInQueryBuilder<SupabaseWalkInUserRow>;
  rpc(
    functionName: "clair_create_reception_walk_in_encounter",
    args: {
      p_workspace_id: string;
      p_actor_user_id: string;
      p_walk_in: ReceptionWalkInEncounterInput;
    },
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
  rpc(
    functionName: "clair_search_reception_patient_guardian_lookup",
    args: {
      p_workspace_id: string;
      p_query: string;
      p_limit: number;
    },
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
};

export function createSupabaseReceptionWalkInEncounterGateway(
  client: SupabaseReceptionWalkInEncounterRpcClient,
): ReceptionWalkInEncounterGateway {
  return {
    async createWalkInEncounter({ actorUserId, workspaceId, input }) {
	      const resolvedInput = await resolveStagingSyntheticWalkInInput({
	        client,
	        input,
	        workspaceId,
	      });
      if (!resolvedInput.ok) {
	        return { ok: false, status: 409, denialReason: "patient_unavailable" };
	      }

	      const veterinarianValidation = await validateSupabaseWalkInVeterinarian({
	        client,
	        primaryVeterinarianId: resolvedInput.input.primaryVeterinarianId,
	        workspaceId,
	      });
	      if (!veterinarianValidation.ok) {
	        if (veterinarianValidation.error === "db_read_failed") {
	          return { ok: false, status: 500, error: "db_write_failed" };
	        }
	        return {
	          ok: false,
	          status: 409,
	          denialReason: "primary_veterinarian_unavailable",
	        };
	      }

	      const { data, error } = await client.rpc(
        "clair_create_reception_walk_in_encounter",
        {
          p_workspace_id: workspaceId,
          p_actor_user_id: actorUserId,
          p_walk_in: normalizeSupabaseWalkInRpcInput(resolvedInput.input),
        },
      );

      if (error) {
        const denialReason = mapWalkInDbDenial(error.message);
        if (denialReason) return { ok: false, status: 409, denialReason };
        return { ok: false, status: 500, error: "db_write_failed" };
      }

      const walkIn = mapWalkInRecord(data);
      if (!walkIn) return { ok: false, status: 500, error: "db_write_failed" };

      return { ok: true, walkIn };
    },
  };
}

async function resolveStagingSyntheticWalkInInput({
  client,
  input,
  workspaceId,
}: {
  client: SupabaseReceptionWalkInEncounterRpcClient;
  input: ReceptionWalkInEncounterInput;
  workspaceId: string;
}): Promise<
  { ok: true; input: ReceptionWalkInEncounterInput } | { ok: false }
> {
  if (uuidPattern.test(input.patientId)) return { ok: true, input };

  const inputWithDisplayName = input as ReceptionWalkInEncounterInput & {
    patientName?: string;
  };
  const lookupQuery =
    stagingMockPatientLookupTerms[input.patientId] ??
    inputWithDisplayName.patientName;
  if (!lookupQuery) return { ok: true, input };

  const { data, error } = await client.rpc(
    "clair_search_reception_patient_guardian_lookup",
    {
      p_workspace_id: workspaceId,
      p_query: lookupQuery,
      p_limit: 5,
    },
  );
  if (error || !Array.isArray(data)) return { ok: false };

  const resolved = data
    .map((row) => {
      const value = row as {
        patient?: { id?: unknown };
        primaryGuardian?: { id?: unknown };
        primary_guardian?: { id?: unknown };
      };
      const patientId =
        typeof value.patient?.id === "string" ? value.patient.id : undefined;
      const primaryGuardian = value.primaryGuardian ?? value.primary_guardian;
      const guardianId =
        typeof primaryGuardian?.id === "string"
          ? primaryGuardian.id
          : undefined;

      return patientId && uuidPattern.test(patientId)
        ? { guardianId, patientId }
        : null;
    })
    .find((row): row is { guardianId: string | undefined; patientId: string } =>
      Boolean(row),
    );

  if (!resolved) return { ok: false };

  return {
    ok: true,
    input: {
      ...input,
      guardianId:
        input.guardianId && uuidPattern.test(input.guardianId)
          ? input.guardianId
          : resolved.guardianId,
      patientId: resolved.patientId,
    },
  };
}

function normalizeWalkInInput(
  input: ReceptionWalkInEncounterInput,
): ReceptionWalkInEncounterInput {
  const vitals = normalizeVitals(input.vitals);

  return {
    assignedStaffUserIds: normalizeAssignedStaffUserIds(input.assignedStaffUserIds),
    department: trimToUndefined(input.department),
    durationMinutes:
      typeof input.durationMinutes === "number" &&
      Number.isFinite(input.durationMinutes)
        ? Math.round(input.durationMinutes)
        : undefined,
	    guardianId: trimToUndefined(input.guardianId),
	    memo: trimToUndefined(input.memo),
    patientId: trimToUndefined(input.patientId) ?? "",
    plannedStartAt: trimToUndefined(input.plannedStartAt),
    primaryVeterinarianId: trimToUndefined(input.primaryVeterinarianId),
    visitPurpose: trimToUndefined(input.visitPurpose),
	    ...(vitals ? { vitals } : {}),
	  };
}

function normalizeVitals(
  vitals: ReceptionVitalMeasurementInput | undefined,
): ReceptionVitalMeasurementInput | undefined {
  if (!vitals) return undefined;
  const normalized: ReceptionVitalMeasurementInput = {};

  if (vitals.weightKg !== undefined) {
    normalized.weightKg = Math.round(vitals.weightKg * 100) / 100;
  }
  if (vitals.temperatureC !== undefined) {
    normalized.temperatureC = Math.round(vitals.temperatureC * 10) / 10;
  }
  if (vitals.heartRateBpm !== undefined) {
    normalized.heartRateBpm = vitals.heartRateBpm;
  }
  if (vitals.respiratoryRateRpm !== undefined) {
    normalized.respiratoryRateRpm = vitals.respiratoryRateRpm;
  }
  if (vitals.bloodPressure) {
    normalized.bloodPressure = {
      systolicMmhg: vitals.bloodPressure.systolicMmhg,
      ...(vitals.bloodPressure.diastolicMmhg === undefined
        ? {}
        : { diastolicMmhg: vitals.bloodPressure.diastolicMmhg }),
    };
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeSupabaseWalkInRpcInput(
  input: ReceptionWalkInEncounterInput,
): ReceptionWalkInEncounterInput {
  return input;
}

function validateWalkInInput(
  input: ReceptionWalkInEncounterInput,
  vitalSettings: WorkspaceVitalSettingsSnapshot,
) {
  const fieldErrors: ReceptionWalkInEncounterFieldErrors = {};

  const rawAssignedStaffUserIds = (input as { assignedStaffUserIds?: unknown })
    .assignedStaffUserIds;
  if (
    !Array.isArray(rawAssignedStaffUserIds) ||
    rawAssignedStaffUserIds.length !== 1 ||
      rawAssignedStaffUserIds.some(
        (value) => typeof value !== "string" || !value.trim(),
      )
  ) {
    fieldErrors.assignedStaffUserIds = "접수 담당자를 1명 선택해 주세요.";
  }

  if (!trimToUndefined(input.patientId)) {
    fieldErrors.patientId = "환자를 선택해 주세요.";
  }
  if (!isReceptionDurationMinutesValid(input.durationMinutes)) {
    fieldErrors.durationMinutes = receptionDurationValidationMessage;
  }
  if (
    input.plannedStartAt !== undefined &&
    Number.isNaN(new Date(input.plannedStartAt).getTime())
  ) {
    fieldErrors.plannedStartAt = "접수 예정 시간을 확인해 주세요.";
  }
  validateVitals(input, fieldErrors);
  const requiredErrors = getRequiredWorkspaceVitalFieldErrors(vitalSettings, {
    weightKg: input.vitals?.weightKg,
    temperatureC: input.vitals?.temperatureC,
    heartRateBpm: input.vitals?.heartRateBpm,
    respiratoryRateRpm: input.vitals?.respiratoryRateRpm,
    bloodPressureSystolicMmhg: input.vitals?.bloodPressure?.systolicMmhg,
    bloodPressureDiastolicMmhg: input.vitals?.bloodPressure?.diastolicMmhg,
  });
  for (const [key, message] of Object.entries(requiredErrors)) {
    const fieldKey = key.startsWith("bloodPressure")
      ? `vitals.bloodPressure.${key === "bloodPressureSystolicMmhg" ? "systolicMmhg" : "diastolicMmhg"}`
      : `vitals.${key}`;
    fieldErrors[fieldKey as ReceptionWalkInEncounterFieldErrorKey] ??= message;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { valid: false as const, fieldErrors };
  }

  return { valid: true as const, fieldErrors: {} };
}

function validateVitals(
  input: ReceptionWalkInEncounterInput,
  fieldErrors: ReceptionWalkInEncounterFieldErrors,
) {
  const rawVitals = (input as { vitals?: unknown }).vitals;
  if (rawVitals === undefined) return;
  if (!isRecord(rawVitals)) {
    fieldErrors.vitals = "바이탈 값을 확인해 주세요.";
    return;
  }

  validatePositiveNumber(
    rawVitals.weightKg,
    "vitals.weightKg",
    "체중은 0보다 큰 숫자로 입력해 주세요.",
    fieldErrors,
    false,
    9_999.99,
  );
  validatePositiveNumber(
    rawVitals.temperatureC,
    "vitals.temperatureC",
    "체온은 0보다 큰 숫자로 입력해 주세요.",
    fieldErrors,
    false,
    999.9,
  );
  validatePositiveNumber(
    rawVitals.heartRateBpm,
    "vitals.heartRateBpm",
    "심박수는 0보다 큰 정수로 입력해 주세요.",
    fieldErrors,
    true,
    2_147_483_647,
  );
  validatePositiveNumber(
    rawVitals.respiratoryRateRpm,
    "vitals.respiratoryRateRpm",
    "호흡수는 0보다 큰 정수로 입력해 주세요.",
    fieldErrors,
    true,
    2_147_483_647,
  );

  const rawBloodPressure = rawVitals.bloodPressure;
  if (rawBloodPressure === undefined) return;
  if (!isRecord(rawBloodPressure)) {
    fieldErrors["vitals.bloodPressure"] = "혈압 값을 확인해 주세요.";
    return;
  }

  const systolic = rawBloodPressure.systolicMmhg;
  const diastolic = rawBloodPressure.diastolicMmhg;
  if (systolic === undefined && diastolic === undefined) {
    fieldErrors["vitals.bloodPressure"] =
      "수축기와 이완기 혈압을 함께 입력해 주세요.";
    return;
  }
  if (systolic === undefined) {
    fieldErrors["vitals.bloodPressure.systolicMmhg"] =
      "수축기 혈압을 입력해 주세요.";
  } else {
    validatePositiveNumber(
      systolic,
      "vitals.bloodPressure.systolicMmhg",
      "수축기 혈압은 0보다 큰 정수로 입력해 주세요.",
      fieldErrors,
      true,
      2_147_483_647,
    );
  }
  if (diastolic !== undefined) {
    validatePositiveNumber(
      diastolic,
      "vitals.bloodPressure.diastolicMmhg",
      "이완기 혈압은 0보다 큰 정수로 입력해 주세요.",
      fieldErrors,
      true,
      2_147_483_647,
    );
  }
  if (
    typeof systolic === "number" &&
    Number.isInteger(systolic) &&
    systolic > 0 &&
    typeof diastolic === "number" &&
    Number.isInteger(diastolic) &&
    diastolic > 0 &&
    diastolic >= systolic
  ) {
    fieldErrors["vitals.bloodPressure.diastolicMmhg"] =
      "이완기 혈압은 수축기보다 작게 입력해 주세요.";
  }
}

function validatePositiveNumber(
  value: unknown,
  key: ReceptionWalkInEncounterFieldErrorKey,
  message: string,
  fieldErrors: ReceptionWalkInEncounterFieldErrors,
  integer = false,
  maxValue?: number,
) {
  if (value === undefined) return;
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value <= 0 ||
    (integer && !Number.isInteger(value)) ||
    (maxValue !== undefined && value > maxValue)
  ) {
    fieldErrors[key] =
      maxValue !== undefined && typeof value === "number" && value > maxValue
        ? "저장할 수 있는 범위를 넘었어요."
        : message;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mapWalkInDbDenial(message?: string) {
  if (!message) return null;
  if (message.includes("patient_unavailable"))
    return "patient_unavailable" as const;
  if (message.includes("guardian_unavailable"))
    return "guardian_unavailable" as const;
	  if (message.includes("patient_guardian_link_missing")) {
	    return "patient_guardian_link_missing" as const;
	  }
	  if (message.includes("primary_veterinarian_unavailable")) {
	    return "primary_veterinarian_unavailable" as const;
	  }
	  if (message.includes("assigned_staff_unavailable")) {
	    return "assigned_staff_unavailable" as const;
	  }
	  if (message.includes("walk_in_outside_business_hours")) {
	    return "walk_in_outside_business_hours" as const;
	  }
	  return null;
}

async function validateSupabaseWalkInVeterinarian({
  client,
  primaryVeterinarianId,
  workspaceId,
}: {
  client: SupabaseReceptionWalkInEncounterRpcClient;
  primaryVeterinarianId?: string;
  workspaceId: string;
}): Promise<
  | { ok: true }
  | { ok: false; error: "db_read_failed" | "primary_veterinarian_unavailable" }
> {
  const veterinarianId = trimToUndefined(primaryVeterinarianId);
  if (!veterinarianId) return { ok: true };
  if (!uuidPattern.test(veterinarianId)) {
    return { ok: false, error: "primary_veterinarian_unavailable" };
  }

  const [{ data: membershipRows, error: membershipError }, { data: userRows, error: userError }] =
    await Promise.all([
      client
        .from("user_memberships")
        .select("id, workspace_id, user_id, roles, status")
        .eq("workspace_id", workspaceId)
        .eq("user_id", veterinarianId),
      client
        .from("users")
        .select("id, status")
        .eq("id", veterinarianId),
    ]);

  if (membershipError || userError) return { ok: false, error: "db_read_failed" };

  const activeUser = (userRows ?? []).some(
    (row) => row.id === veterinarianId && row.status === "active",
  );
  const activeVetMembership = (membershipRows ?? []).some(
    (row) =>
      row.workspace_id === workspaceId &&
      row.user_id === veterinarianId &&
      row.status === "active" &&
      (row.roles ?? []).includes("vet"),
  );

  return activeUser && activeVetMembership
    ? { ok: true }
    : { ok: false, error: "primary_veterinarian_unavailable" };
}

function mapWalkInRecord(
  value: unknown,
): ReceptionWalkInEncounterRecord | null {
  if (!value || typeof value !== "object") return null;
  const row = value as {
    encounter?: unknown;
    queueEntry?: unknown;
    queue_entry?: unknown;
  };
  const encounter = mapEncounter(row.encounter);
  const queueEntry = mapQueueEntry(row.queueEntry ?? row.queue_entry);
  if (!encounter || !queueEntry) return null;
  return { encounter, queueEntry };
}

function mapEncounter(value: unknown): Encounter | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const id = trimToUndefined(row.id);
  const workspaceId = trimToUndefined(row.workspaceId) ?? trimToUndefined(row.workspace_id);
  const patientId = trimToUndefined(row.patientId) ?? trimToUndefined(row.patient_id);
  const encounterNo = trimToUndefined(row.encounterNo) ?? trimToUndefined(row.encounter_no);
  const status = trimToUndefined(row.status);

  if (!id || !workspaceId || !patientId || !encounterNo || !status) return null;

  return {
    id,
    workspaceId,
    patientId,
    guardianId: trimToUndefined(row.guardianId) ?? trimToUndefined(row.guardian_id),
    appointmentId: trimToUndefined(row.appointmentId) ?? trimToUndefined(row.appointment_id),
    primaryVeterinarianId:
      trimToUndefined(row.primaryVeterinarianId) ??
      trimToUndefined(row.primary_veterinarian_id),
    assignedStaffUserIds: getAssignedStaffUserIdsFromRow(row),
    encounterNo,
    receptionType: (trimToUndefined(row.receptionType) ??
      trimToUndefined(row.reception_type)) as Encounter["receptionType"],
    department: trimToUndefined(row.department),
    durationMinutes: getNumber(row.durationMinutes) ?? getNumber(row.duration_minutes),
    chiefComplaint: trimToUndefined(row.chiefComplaint) ?? trimToUndefined(row.chief_complaint),
    visitPurpose: trimToUndefined(row.visitPurpose) ?? trimToUndefined(row.visit_purpose),
    receptionMemo: trimToUndefined(row.receptionMemo) ?? trimToUndefined(row.reception_memo),
    status: status as Encounter["status"],
    checkedInAt:
      trimToUndefined(row.checkedInAt) ??
      trimToUndefined(row.checked_in_at) ??
      new Date(0).toISOString(),
    checkedInByUserId:
      trimToUndefined(row.checkedInByUserId) ?? trimToUndefined(row.checked_in_by_user_id),
    createdAt:
      trimToUndefined(row.createdAt) ??
      trimToUndefined(row.created_at) ??
      new Date(0).toISOString(),
    updatedAt:
      trimToUndefined(row.updatedAt) ??
      trimToUndefined(row.updated_at) ??
      new Date(0).toISOString(),
  };
}

function normalizeAssignedStaffUserIds(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const normalized = Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
  return normalized.length > 0 ? normalized : undefined;
}

function getWalkInAssignedStaffUserIds(
  input: ReceptionWalkInEncounterInput,
): string[] | undefined {
  return normalizeAssignedStaffUserIds([
    input.primaryVeterinarianId,
    ...(input.assignedStaffUserIds ?? []),
  ]);
}

function getAssignedStaffUserIdsFromRow(
  row: Record<string, unknown>,
): string[] | undefined {
  const raw = row.assignedStaffUserIds ?? row.assigned_staff_user_ids;
  const assigned = normalizeAssignedStaffUserIds(raw);
  if (assigned) return assigned;
  const primaryVeterinarianId =
    trimToUndefined(row.primaryVeterinarianId) ??
    trimToUndefined(row.primary_veterinarian_id);
  return primaryVeterinarianId ? [primaryVeterinarianId] : undefined;
}

function mapQueueEntry(value: unknown): WaitingQueueEntry | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const id = trimToUndefined(row.id);
  const workspaceId = trimToUndefined(row.workspaceId) ?? trimToUndefined(row.workspace_id);
  const encounterId = trimToUndefined(row.encounterId) ?? trimToUndefined(row.encounter_id);
  const queueType = trimToUndefined(row.queueType) ?? trimToUndefined(row.queue_type);
  const status = trimToUndefined(row.status);

  if (!id || !workspaceId || !encounterId || !queueType || !status) return null;

  return {
    id,
    workspaceId,
    encounterId,
    queueType: queueType as WaitingQueueEntry["queueType"],
    status: status as WaitingQueueEntry["status"],
    priority: (trimToUndefined(row.priority) as WaitingQueueEntry["priority"] | undefined) ?? "normal",
    sortOrder: getNumber(row.sortOrder) ?? getNumber(row.sort_order),
    enteredAt:
      trimToUndefined(row.enteredAt) ??
      trimToUndefined(row.entered_at) ??
      new Date(0).toISOString(),
    calledAt: trimToUndefined(row.calledAt) ?? trimToUndefined(row.called_at),
    finishedAt: trimToUndefined(row.finishedAt) ?? trimToUndefined(row.finished_at),
  };
}

function createDemoReceptionWalkInPermissionAdapter() {
  return createMockWorkspacePermissionAdapter({
    now: new Date().toISOString(),
    users: [
      {
        id: "playwright-default-session",
        status: "active",
        displayName: "Playwright Admin",
      },
      { id: "user-admin", status: "active", displayName: "송민재" },
      { id: "user-front-desk", status: "active", displayName: "최유나" },
      { id: "user-vet", status: "active", displayName: "이수지" },
    ],
    memberships: [
      {
        id: "membership-playwright-admin",
        workspaceId: "clair-demo",
        userId: "playwright-default-session",
        roles: ["hospital_admin"],
        status: "active",
      },
      {
        id: "membership-admin",
        workspaceId: "clair-demo",
        userId: "user-admin",
        roles: ["hospital_admin"],
        status: "active",
      },
      {
        id: "membership-front-desk",
        workspaceId: "clair-demo",
        userId: "user-front-desk",
        roles: ["front_desk"],
        status: "active",
      },
      {
        id: "membership-vet",
        workspaceId: "clair-demo",
        userId: "user-vet",
        roles: ["vet"],
        status: "active",
      },
    ],
  });
}

function trimToUndefined(value?: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const stagingMockPatientLookupTerms: Record<string, string> = {
  "patient-coco": "choco",
  "patient-dubu": "dubu",
  "patient-haru": "mango",
  "patient-kong": "kong",
  "patient-nabi": "nabi",
};
