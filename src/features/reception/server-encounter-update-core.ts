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
  ReceptionEncounterUpdateInput,
  ReceptionEncounterUpdateRecord,
} from "@/features/reception/encounter-update";
import { getReceptionMutationPermissionContract } from "@/features/reception/reception-mutation-permissions";
import {
  mockEncounters,
  mockPatients,
  mockWaitingQueueEntries,
} from "@/mocks/emr-domain";
import type { Encounter, Patient, WaitingQueueEntry } from "@/types/emr-domain";

export type ReceptionEncounterUpdateDenial =
  | "encounter_unavailable"
  | "encounter_not_editable"
  | "patient_unavailable"
  | "primary_veterinarian_unavailable"
  | "queue_entry_unavailable";

export type ReceptionEncounterUpdateFieldErrors = Partial<
  Record<keyof ReceptionEncounterUpdateInput, string>
>;

export type ReceptionEncounterUpdateGatewayResult =
  | { ok: true; update: ReceptionEncounterUpdateRecord }
  | { ok: false; status: 409; denialReason: ReceptionEncounterUpdateDenial }
  | { ok: false; status: 500; error: "db_write_failed" };

export type ReceptionEncounterUpdateGateway = {
  updateEncounter(input: {
    actorUserId: string;
    encounterId: string;
    input: ReceptionEncounterUpdateInput;
    workspaceId: string;
  }): Promise<ReceptionEncounterUpdateGatewayResult>;
};

export type ReceptionEncounterUpdateResult =
  | {
      ok: true;
      status: 200;
      workspaceId: string;
      update: ReceptionEncounterUpdateRecord;
      enforcedBy: "reception-encounter-update";
    }
  | {
      ok: false;
      status: 400;
      error: "invalid_input";
      fieldErrors: ReceptionEncounterUpdateFieldErrors & { encounterId?: string };
    }
  | {
      ok: false;
      status: 401 | 403;
      denialReason: WorkspacePermissionDenialReason;
    }
  | {
      ok: false;
      status: 409;
      denialReason: ReceptionEncounterUpdateDenial;
    }
  | {
      ok: false;
      status: 500;
      error: "db_write_failed" | "supabase_client_missing";
    };

export async function createReceptionEncounterUpdate({
  actorUserId,
  auditGateway,
  auditNow,
  auditRequestId,
  encounterId,
  gateway = createMockReceptionEncounterUpdateGateway(),
  input,
  permissionAdapter = createDemoReceptionEncounterUpdatePermissionAdapter(),
  workspaceId,
}: {
  actorUserId: string | null;
  auditGateway?: LiveMutationAuditOptions["auditGateway"];
  auditNow?: LiveMutationAuditOptions["auditNow"];
  auditRequestId?: LiveMutationAuditOptions["auditRequestId"];
  encounterId: string;
  gateway?: ReceptionEncounterUpdateGateway;
  input: ReceptionEncounterUpdateInput;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<ReceptionEncounterUpdateResult> {
  const normalizedEncounterId = trimToUndefined(encounterId);
  const normalized = normalizeEncounterUpdateInput(input);
  const validation = validateEncounterUpdateInput(normalized);

  if (!normalizedEncounterId) {
    return {
      ok: false,
      status: 400,
      error: "invalid_input",
      fieldErrors: { encounterId: "접수를 선택해 주세요." },
    };
  }

  if (!validation.valid) {
    return {
      ok: false,
      status: 400,
      error: "invalid_input",
      fieldErrors: validation.fieldErrors,
    };
  }

  const permissionContract = getReceptionMutationPermissionContract("encounter_update");
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

  const result = await gateway.updateEncounter({
    actorUserId: actorUserId ?? "",
    encounterId: normalizedEncounterId,
    input: normalized,
    workspaceId,
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
      eventType: "reception.encounter_updated",
      targetType: "encounter",
      targetId: result.update.encounter.id,
      encounterId: result.update.encounter.id,
      patientId: result.update.encounter.patientId,
      guardianId: result.update.encounter.guardianId ?? null,
      requestId: auditRequestId,
      after: {
        department: result.update.encounter.department,
        durationMinutes: result.update.encounter.durationMinutes,
        primaryVeterinarianId: result.update.encounter.primaryVeterinarianId,
        status: result.update.encounter.status,
        visitPurpose: result.update.encounter.visitPurpose,
        weightKg: result.update.patient?.weightKg,
      },
      metadata: { source: "reception-encounter-update" },
    },
  });
  if (!audit.ok) return { ok: false, status: 500, error: "db_write_failed" };

  return {
    ok: true,
    status: 200,
    workspaceId,
    update: result.update,
    enforcedBy: "reception-encounter-update",
  };
}

export function createMockReceptionEncounterUpdateGateway(
  dataset: {
    encounters?: Encounter[];
    patients?: Patient[];
    waitingQueueEntries?: WaitingQueueEntry[];
  } = {
    encounters: mockEncounters,
    patients: mockPatients,
    waitingQueueEntries: mockWaitingQueueEntries,
  },
  now = new Date().toISOString(),
): ReceptionEncounterUpdateGateway {
  return {
    async updateEncounter({ encounterId, input, workspaceId }) {
      const encounter = (dataset.encounters ?? []).find(
        (item) => item.id === encounterId && item.workspaceId === workspaceId,
      );
      if (!encounter) {
        return { ok: false, status: 409, denialReason: "encounter_unavailable" };
      }
      if (!isEditableReceptionEncounter(encounter)) {
        return { ok: false, status: 409, denialReason: "encounter_not_editable" };
      }

      const patient = (dataset.patients ?? []).find(
        (item) =>
          item.id === encounter.patientId &&
          item.workspaceId === workspaceId &&
          item.status === "active",
      );
      if (!patient) {
        return { ok: false, status: 409, denialReason: "patient_unavailable" };
      }

      const queueEntry = (dataset.waitingQueueEntries ?? []).find(
        (item) =>
          item.workspaceId === workspaceId &&
          item.encounterId === encounter.id &&
          item.queueType === "consultation",
      );

      return {
        ok: true,
        update: {
          encounter: {
            ...encounter,
            department: input.department,
            durationMinutes: input.durationMinutes,
            primaryVeterinarianId: input.primaryVeterinarianId,
            chiefComplaint: input.visitPurpose,
            visitPurpose: input.visitPurpose ?? encounter.visitPurpose,
            receptionMemo: input.memo,
            updatedAt: now,
          },
          patient:
            input.weightKg === undefined
              ? patient
              : { ...patient, weightKg: input.weightKg, updatedAt: now },
          queueEntry,
        },
      };
    },
  };
}

export type SupabaseReceptionEncounterUpdateRpcClient = {
  rpc(
    functionName: "clair_update_reception_encounter",
    args: {
      p_workspace_id: string;
      p_actor_user_id: string;
      p_encounter_id: string;
      p_patch: ReceptionEncounterUpdateInput;
    },
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
};

export function createSupabaseReceptionEncounterUpdateGateway(
  client: SupabaseReceptionEncounterUpdateRpcClient,
): ReceptionEncounterUpdateGateway {
  return {
    async updateEncounter({ actorUserId, encounterId, input, workspaceId }) {
      const { data, error } = await client.rpc("clair_update_reception_encounter", {
        p_workspace_id: workspaceId,
        p_actor_user_id: actorUserId,
        p_encounter_id: encounterId,
        p_patch: input,
      });

      if (error) {
        const denialReason = mapEncounterUpdateDbDenial(error.message);
        if (denialReason) return { ok: false, status: 409, denialReason };
        return { ok: false, status: 500, error: "db_write_failed" };
      }

      const update = mapEncounterUpdateRecord(data);
      if (!update) return { ok: false, status: 500, error: "db_write_failed" };

      return { ok: true, update };
    },
  };
}

function normalizeEncounterUpdateInput(
  input: ReceptionEncounterUpdateInput,
): ReceptionEncounterUpdateInput {
  return {
    department: trimToUndefined(input.department),
    durationMinutes:
      typeof input.durationMinutes === "number" &&
      Number.isFinite(input.durationMinutes)
        ? Math.round(input.durationMinutes)
        : undefined,
    memo: trimToUndefined(input.memo),
    primaryVeterinarianId: trimToUndefined(input.primaryVeterinarianId),
    visitPurpose: trimToUndefined(input.visitPurpose),
    weightKg:
      typeof input.weightKg === "number" && Number.isFinite(input.weightKg)
        ? Math.round(input.weightKg * 100) / 100
        : undefined,
  };
}

function validateEncounterUpdateInput(input: ReceptionEncounterUpdateInput) {
  const fieldErrors: ReceptionEncounterUpdateFieldErrors = {};

  if (input.durationMinutes !== undefined && input.durationMinutes <= 0) {
    fieldErrors.durationMinutes = "예상 진료시간을 확인해 주세요.";
  }
  if (input.weightKg !== undefined && input.weightKg <= 0) {
    fieldErrors.weightKg = "체중은 0보다 커야 합니다.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { valid: false as const, fieldErrors };
  }

  return { valid: true as const, fieldErrors: {} };
}

function isEditableReceptionEncounter(encounter: Encounter) {
  return encounter.status === "waiting" || encounter.status === "in_consultation";
}

function mapEncounterUpdateDbDenial(message?: string) {
  if (!message) return null;
  if (message.includes("encounter_unavailable")) return "encounter_unavailable" as const;
  if (message.includes("encounter_not_editable")) return "encounter_not_editable" as const;
  if (message.includes("patient_unavailable")) return "patient_unavailable" as const;
  if (message.includes("primary_veterinarian_unavailable")) {
    return "primary_veterinarian_unavailable" as const;
  }
  if (message.includes("queue_entry_unavailable")) {
    return "queue_entry_unavailable" as const;
  }
  return null;
}

function mapEncounterUpdateRecord(value: unknown): ReceptionEncounterUpdateRecord | null {
  if (!value || typeof value !== "object") return null;
  const row = value as {
    encounter?: unknown;
    patient?: unknown;
    queueEntry?: unknown;
    queue_entry?: unknown;
  };
  const encounter = mapEncounter(row.encounter);
  if (!encounter) return null;

  return {
    encounter,
    patient: mapPatient(row.patient),
    queueEntry: mapQueueEntry(row.queueEntry ?? row.queue_entry),
  };
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

function mapPatient(value: unknown): Patient | undefined {
  if (!value || typeof value !== "object") return undefined;
  const row = value as Record<string, unknown>;
  const id = trimToUndefined(row.id);
  const patientNo = trimToUndefined(row.patientNo) ?? trimToUndefined(row.patient_no);
  const workspaceId = trimToUndefined(row.workspaceId) ?? trimToUndefined(row.workspace_id);
  const name = trimToUndefined(row.name);
  const species = trimToUndefined(row.species);
  const status = trimToUndefined(row.status);
  if (!id || !patientNo || !workspaceId || !name || !species || !status) {
    return undefined;
  }

  return {
    id,
    patientNo,
    workspaceId,
    name,
    species: species as Patient["species"],
    breed: trimToUndefined(row.breed),
    birthDate: trimToUndefined(row.birthDate) ?? trimToUndefined(row.birth_date),
    estimatedAgeText:
      trimToUndefined(row.estimatedAgeText) ?? trimToUndefined(row.estimated_age_text),
    sex: (trimToUndefined(row.sex) as Patient["sex"] | undefined) ?? "unknown",
    neutered: typeof row.neutered === "boolean" ? row.neutered : false,
    microchipNo: trimToUndefined(row.microchipNo) ?? trimToUndefined(row.microchip_no),
    patientRegistrationNo:
      trimToUndefined(row.patientRegistrationNo) ??
      trimToUndefined(row.patient_registration_no),
    weightKg: getNumber(row.weightKg) ?? getNumber(row.weight_kg),
    specialNote: trimToUndefined(row.specialNote) ?? trimToUndefined(row.special_note),
    handlingCautionLocked:
      typeof row.handlingCautionLocked === "boolean"
        ? row.handlingCautionLocked
        : typeof row.handling_caution_locked === "boolean"
          ? row.handling_caution_locked
          : false,
    status: status as Patient["status"],
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

function mapQueueEntry(value: unknown): WaitingQueueEntry | undefined {
  if (!value || typeof value !== "object") return undefined;
  const row = value as Record<string, unknown>;
  const id = trimToUndefined(row.id);
  const workspaceId = trimToUndefined(row.workspaceId) ?? trimToUndefined(row.workspace_id);
  const encounterId = trimToUndefined(row.encounterId) ?? trimToUndefined(row.encounter_id);
  const queueType = trimToUndefined(row.queueType) ?? trimToUndefined(row.queue_type);
  const status = trimToUndefined(row.status);
  if (!id || !workspaceId || !encounterId || !queueType || !status) return undefined;

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

function createDemoReceptionEncounterUpdatePermissionAdapter() {
  return createMockWorkspacePermissionAdapter({
    now: new Date().toISOString(),
    users: [
      { id: "playwright-default-session", status: "active", displayName: "Playwright Admin" },
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
