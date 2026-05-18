import {
  createMockWorkspacePermissionAdapter,
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";
import type {
  ReceptionWalkInEncounterInput,
  ReceptionWalkInEncounterRecord,
} from "@/features/reception/walk-in-encounter";
import { getReceptionMutationPermissionContract } from "@/features/reception/reception-mutation-permissions";
import {
  mockGuardians,
  mockPatientGuardians,
  mockPatients,
} from "@/mocks/emr-domain";
import type { Encounter, Guardian, Patient, PatientGuardian, WaitingQueueEntry } from "@/types/emr-domain";

export type ReceptionWalkInEncounterFieldErrors = Partial<
  Record<"patientId" | "durationMinutes", string>
>;

export type ReceptionWalkInEncounterGatewayResult =
  | { ok: true; walkIn: ReceptionWalkInEncounterRecord }
  | {
      ok: false;
      status: 409;
      denialReason:
        | "patient_unavailable"
        | "guardian_unavailable"
        | "patient_guardian_link_missing";
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
        | "patient_guardian_link_missing";
    }
  | { ok: false; status: 500; error: "db_write_failed" | "supabase_client_missing" };

export async function createReceptionWalkInEncounter({
  actorUserId,
  gateway = createMockReceptionWalkInEncounterGateway(),
  input,
  permissionAdapter = createDemoReceptionWalkInPermissionAdapter(),
  workspaceId,
}: {
  actorUserId: string | null;
  gateway?: ReceptionWalkInEncounterGateway;
  input: ReceptionWalkInEncounterInput;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<ReceptionWalkInEncounterResult> {
  const normalized = normalizeWalkInInput(input);
  const validation = validateWalkInInput(normalized);

  if (!validation.valid) {
    return {
      ok: false,
      status: 400,
      error: "invalid_input",
      fieldErrors: validation.fieldErrors,
    };
  }

  const permissionContract = getReceptionMutationPermissionContract("walk_in_encounter_create");
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
  } = {
    guardians: mockGuardians,
    patientGuardians: mockPatientGuardians,
    patients: mockPatients,
  },
  now = new Date().toISOString()
): ReceptionWalkInEncounterGateway {
  return {
    async createWalkInEncounter({ workspaceId, input }) {
      const patient = dataset.patients.find(
        (item) =>
          item.id === input.patientId &&
          item.workspaceId === workspaceId &&
          item.status === "active"
      );

      if (!patient) return { ok: false, status: 409, denialReason: "patient_unavailable" };

      if (input.guardianId) {
        const guardian = dataset.guardians.find(
          (item) => item.id === input.guardianId && item.workspaceId === workspaceId
        );
        if (!guardian) return { ok: false, status: 409, denialReason: "guardian_unavailable" };

        const linked = dataset.patientGuardians.some(
          (link) => link.patientId === patient.id && link.guardianId === guardian.id
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
        encounterNo: `E-WALKIN-${seed.slice(-6).toUpperCase()}`,
        receptionType: "walk_in",
        department: input.department,
        durationMinutes: input.durationMinutes,
        chiefComplaint: input.visitPurpose,
        visitPurpose: input.visitPurpose ?? "현장 접수",
        receptionMemo: input.memo,
        status: "waiting",
        checkedInAt: now,
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
        enteredAt: now,
      };

      return { ok: true, walkIn: { encounter, queueEntry } };
    },
  };
}

export type SupabaseReceptionWalkInEncounterRpcClient = {
  rpc(
    functionName: "clair_create_reception_walk_in_encounter",
    args: {
      p_workspace_id: string;
      p_actor_user_id: string;
      p_walk_in: ReceptionWalkInEncounterInput;
    }
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
};

export function createSupabaseReceptionWalkInEncounterGateway(
  client: SupabaseReceptionWalkInEncounterRpcClient
): ReceptionWalkInEncounterGateway {
  return {
    async createWalkInEncounter({ actorUserId, workspaceId, input }) {
      const { data, error } = await client.rpc("clair_create_reception_walk_in_encounter", {
        p_workspace_id: workspaceId,
        p_actor_user_id: actorUserId,
        p_walk_in: input,
      });

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

function normalizeWalkInInput(input: ReceptionWalkInEncounterInput): ReceptionWalkInEncounterInput {
  return {
    department: trimToUndefined(input.department),
    durationMinutes:
      typeof input.durationMinutes === "number" && Number.isFinite(input.durationMinutes)
        ? Math.round(input.durationMinutes)
        : undefined,
    guardianId: trimToUndefined(input.guardianId),
    memo: trimToUndefined(input.memo),
    patientId: trimToUndefined(input.patientId) ?? "",
    primaryVeterinarianId: trimToUndefined(input.primaryVeterinarianId),
    visitPurpose: trimToUndefined(input.visitPurpose),
  };
}

function validateWalkInInput(input: ReceptionWalkInEncounterInput) {
  const fieldErrors: ReceptionWalkInEncounterFieldErrors = {};

  if (!input.patientId) fieldErrors.patientId = "환자를 선택해 주세요.";
  if (input.durationMinutes !== undefined && input.durationMinutes <= 0) {
    fieldErrors.durationMinutes = "예상 진료시간을 확인해 주세요.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { valid: false as const, fieldErrors };
  }

  return { valid: true as const, fieldErrors: {} };
}

function mapWalkInDbDenial(message?: string) {
  if (!message) return null;
  if (message.includes("patient_unavailable")) return "patient_unavailable" as const;
  if (message.includes("guardian_unavailable")) return "guardian_unavailable" as const;
  if (message.includes("patient_guardian_link_missing")) {
    return "patient_guardian_link_missing" as const;
  }
  return null;
}

function mapWalkInRecord(value: unknown): ReceptionWalkInEncounterRecord | null {
  if (!value || typeof value !== "object") return null;
  const row = value as { encounter?: unknown; queueEntry?: unknown; queue_entry?: unknown };
  const encounter = mapEncounter(row.encounter);
  const queueEntry = mapQueueEntry(row.queueEntry ?? row.queue_entry);
  if (!encounter || !queueEntry) return null;
  return { encounter, queueEntry };
}

function mapEncounter(value: unknown): Encounter | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<Encounter> & { receptionType?: string; reception_type?: string };
  if (
    typeof row.id !== "string" ||
    typeof row.workspaceId !== "string" ||
    typeof row.patientId !== "string" ||
    typeof row.encounterNo !== "string" ||
    typeof row.status !== "string"
  ) {
    return null;
  }

  return {
    id: row.id,
    workspaceId: row.workspaceId,
    patientId: row.patientId,
    guardianId: trimToUndefined(row.guardianId),
    appointmentId: trimToUndefined(row.appointmentId),
    primaryVeterinarianId: trimToUndefined(row.primaryVeterinarianId),
    encounterNo: row.encounterNo,
    receptionType: (row.receptionType ?? row.reception_type) as Encounter["receptionType"],
    department: trimToUndefined(row.department),
    durationMinutes:
      typeof row.durationMinutes === "number" ? row.durationMinutes : undefined,
    chiefComplaint: trimToUndefined(row.chiefComplaint),
    visitPurpose: trimToUndefined(row.visitPurpose),
    receptionMemo: trimToUndefined(row.receptionMemo),
    status: row.status as Encounter["status"],
    checkedInAt: trimToUndefined(row.checkedInAt) ?? new Date(0).toISOString(),
    checkedInByUserId: trimToUndefined(row.checkedInByUserId),
    createdAt: trimToUndefined(row.createdAt) ?? new Date(0).toISOString(),
    updatedAt: trimToUndefined(row.updatedAt) ?? new Date(0).toISOString(),
  };
}

function mapQueueEntry(value: unknown): WaitingQueueEntry | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<WaitingQueueEntry>;
  if (
    typeof row.id !== "string" ||
    typeof row.workspaceId !== "string" ||
    typeof row.encounterId !== "string" ||
    typeof row.queueType !== "string" ||
    typeof row.status !== "string"
  ) {
    return null;
  }

  return {
    id: row.id,
    workspaceId: row.workspaceId,
    encounterId: row.encounterId,
    queueType: row.queueType as WaitingQueueEntry["queueType"],
    status: row.status as WaitingQueueEntry["status"],
    priority: row.priority ?? "normal",
    sortOrder: typeof row.sortOrder === "number" ? row.sortOrder : undefined,
    enteredAt: trimToUndefined(row.enteredAt) ?? new Date(0).toISOString(),
    calledAt: trimToUndefined(row.calledAt),
    finishedAt: trimToUndefined(row.finishedAt),
  };
}

function createDemoReceptionWalkInPermissionAdapter() {
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

function trimToUndefined(value?: string) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
