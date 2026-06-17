import {
  createMockWorkspacePermissionAdapter,
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";
import type { ReceptionQueueReadRecord } from "@/features/reception/reception-queue-read";
import { mockEncounters, mockWaitingQueueEntries } from "@/mocks/emr-domain";
import type { Encounter, Guardian, Patient, WaitingQueueEntry } from "@/types/emr-domain";

export type ReceptionQueueReadGateway = {
  listReceptionQueue(input: {
    workspaceId: string;
  }): Promise<
    | { ok: true; queue: ReceptionQueueReadRecord[] }
    | { ok: false; error: "db_read_failed" }
  >;
};

export type ReceptionQueueReadResult =
  | {
      ok: true;
      status: 200;
      queue: ReceptionQueueReadRecord[];
      enforcedBy: "reception-queue-read";
    }
  | {
      ok: false;
      status: 401 | 403;
      denialReason: WorkspacePermissionDenialReason;
    }
  | {
      ok: false;
      status: 500;
      error: "db_read_failed" | "supabase_client_missing";
    };

export async function readReceptionQueue({
  actorUserId,
  gateway = createMockReceptionQueueReadGateway({ queue: [] }),
  permissionAdapter = createDemoReceptionQueueReadPermissionAdapter(),
  workspaceId,
}: {
  actorUserId: string | null;
  gateway?: ReceptionQueueReadGateway;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<ReceptionQueueReadResult> {
  const permission = resolveWorkspacePermission(permissionAdapter, {
    sessionUserId: actorUserId,
    workspaceId,
    requiredPermission: "reception:view",
  });

  if (!permission.allowed) {
    return {
      ok: false,
      status: permission.denialReason === "unauthenticated" ? 401 : 403,
      denialReason: permission.denialReason ?? "permission_missing",
    };
  }

  const result = await gateway.listReceptionQueue({ workspaceId });

  if (!result.ok) return { ok: false, status: 500, error: result.error };

  return {
    ok: true,
    status: 200,
    queue: result.queue,
    enforcedBy: "reception-queue-read",
  };
}

export function createMockReceptionQueueReadGateway(
  dataset: {
    encounters?: Encounter[];
    queue?: ReceptionQueueReadRecord[];
    waitingQueueEntries?: WaitingQueueEntry[];
  } = {
    encounters: mockEncounters,
    waitingQueueEntries: mockWaitingQueueEntries,
  }
): ReceptionQueueReadGateway {
  return {
    async listReceptionQueue({ workspaceId }) {
      if (dataset.queue) {
        return {
          ok: true,
          queue: dataset.queue.filter((record) => record.encounter.workspaceId === workspaceId),
        };
      }

      const encounters = dataset.encounters ?? [];
      const waitingQueueEntries = dataset.waitingQueueEntries ?? [];

      return {
        ok: true,
        queue: waitingQueueEntries
          .filter(
            (entry) =>
              entry.workspaceId === workspaceId &&
              (entry.queueType === "consultation" || entry.queueType === "billing")
          )
          .map((queueEntry) => {
            const encounter = encounters.find(
              (item) => item.id === queueEntry.encounterId && item.workspaceId === workspaceId
            );
            return encounter ? { encounter, queueEntry } : null;
          })
          .filter((record): record is ReceptionQueueReadRecord => Boolean(record)),
      };
    },
  };
}

export type SupabaseReceptionQueueReadRpcClient = {
  rpc(
    functionName: "clair_list_reception_queue",
    args: {
      p_workspace_id: string;
      p_limit: number;
    }
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
};

export function createSupabaseReceptionQueueReadGateway(
  client: SupabaseReceptionQueueReadRpcClient
): ReceptionQueueReadGateway {
  return {
    async listReceptionQueue({ workspaceId }) {
      const { data, error } = await client.rpc("clair_list_reception_queue", {
        p_workspace_id: workspaceId,
        p_limit: 100,
      });

      if (error) return { ok: false, error: "db_read_failed" };

      return { ok: true, queue: mapQueueRows(data) };
    },
  };
}

export function createDemoReceptionQueueReadPermissionAdapter() {
  return createMockWorkspacePermissionAdapter({
    users: [
      { id: "user-admin", status: "active" },
      { id: "user-front-desk", status: "active" },
      { id: "user-vet", status: "active" },
    ],
    memberships: [
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

function mapQueueRows(data: unknown): ReceptionQueueReadRecord[] {
  if (!Array.isArray(data)) return [];

  return data
    .map((row): ReceptionQueueReadRecord | null => {
      const value = row as {
        encounter?: unknown;
        patient?: unknown;
        primaryGuardian?: unknown;
        primary_guardian?: unknown;
        queueEntry?: unknown;
        queue_entry?: unknown;
      };
      const encounter = mapEncounter(value.encounter);
      const patient = mapPatient(value.patient);
      const primaryGuardian = mapGuardian(value.primaryGuardian ?? value.primary_guardian);
      const queueEntry = mapQueueEntry(value.queueEntry ?? value.queue_entry);

      if (!encounter || !queueEntry) return null;

      return {
        encounter,
        ...(patient ? { patient } : {}),
        ...(primaryGuardian ? { primaryGuardian } : {}),
        queueEntry,
      };
    })
    .filter((record): record is ReceptionQueueReadRecord => Boolean(record));
}

function mapEncounter(value: unknown): Encounter | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const id = getString(row.id);
  const workspaceId = getString(row.workspaceId) ?? getString(row.workspace_id);
  const patientId = getString(row.patientId) ?? getString(row.patient_id);
  const encounterNo = getString(row.encounterNo) ?? getString(row.encounter_no);
  const status = getString(row.status);
  const createdAt = getString(row.createdAt) ?? getString(row.created_at);
  const updatedAt = getString(row.updatedAt) ?? getString(row.updated_at);

  if (!id || !workspaceId || !patientId || !encounterNo || !status || !createdAt || !updatedAt) {
    return null;
  }

  return {
    id,
    workspaceId,
    patientId,
    guardianId: getString(row.guardianId) ?? getString(row.guardian_id),
    appointmentId: getString(row.appointmentId) ?? getString(row.appointment_id),
    primaryVeterinarianId:
      getString(row.primaryVeterinarianId) ?? getString(row.primary_veterinarian_id),
    encounterNo,
    receptionType:
      row.receptionType === "walk_in" || row.receptionType === "appointment"
        ? row.receptionType
        : row.reception_type === "walk_in" || row.reception_type === "appointment"
          ? row.reception_type
        : undefined,
    department: getString(row.department),
    durationMinutes: getNumber(row.durationMinutes) ?? getNumber(row.duration_minutes),
    chiefComplaint: getString(row.chiefComplaint) ?? getString(row.chief_complaint),
    visitPurpose: getString(row.visitPurpose) ?? getString(row.visit_purpose),
    receptionMemo: getString(row.receptionMemo) ?? getString(row.reception_memo),
    status: status as Encounter["status"],
    checkedInAt: getString(row.checkedInAt) ?? getString(row.checked_in_at),
    startedAt: getString(row.startedAt) ?? getString(row.started_at),
    completedAt: getString(row.completedAt) ?? getString(row.completed_at),
    createdAt,
    updatedAt,
  };
}

function mapQueueEntry(value: unknown): WaitingQueueEntry | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const id = getString(row.id);
  const workspaceId = getString(row.workspaceId) ?? getString(row.workspace_id);
  const encounterId = getString(row.encounterId) ?? getString(row.encounter_id);
  const queueType = getString(row.queueType) ?? getString(row.queue_type);
  const status = getString(row.status);
  const enteredAt = getString(row.enteredAt) ?? getString(row.entered_at);

  if (!id || !workspaceId || !encounterId || !queueType || !status || !enteredAt) {
    return null;
  }

  return {
    id,
    workspaceId,
    encounterId,
    queueType: queueType as WaitingQueueEntry["queueType"],
    status: status as WaitingQueueEntry["status"],
    priority: (getString(row.priority) as WaitingQueueEntry["priority"] | undefined) ?? "normal",
    sortOrder: getNumber(row.sortOrder) ?? getNumber(row.sort_order),
    enteredAt,
    calledAt: getString(row.calledAt) ?? getString(row.called_at),
    finishedAt: getString(row.finishedAt) ?? getString(row.finished_at),
  };
}

function mapPatient(value: unknown): Patient | undefined {
  if (!value || typeof value !== "object") return undefined;
  const row = value as Record<string, unknown>;
  const id = getString(row.id);
  const workspaceId = getString(row.workspaceId) ?? getString(row.workspace_id);
  const patientNo = getString(row.patientNo) ?? getString(row.patient_no);
  const name = getString(row.name);
  const species = getString(row.species);
  const sex = getString(row.sex);
  const status = getString(row.status);

  if (!id || !workspaceId || !patientNo || !name || !species || !sex || !status) {
    return undefined;
  }

  return {
    id,
    workspaceId,
    patientNo,
    name,
    species: species as Patient["species"],
    breed: getString(row.breed),
    birthDate: getString(row.birthDate) ?? getString(row.birth_date),
    estimatedAgeText: getString(row.estimatedAgeText) ?? getString(row.estimated_age_text),
    sex: sex as Patient["sex"],
    neutered: getBoolean(row.neutered),
    microchipNo: getString(row.microchipNo) ?? getString(row.microchip_no),
    patientRegistrationNo:
      getString(row.patientRegistrationNo) ?? getString(row.patient_registration_no),
    weightKg: getNumber(row.weightKg) ?? getNumber(row.weight_kg),
    allergyNote: getString(row.allergyNote) ?? getString(row.allergy_note),
    specialNote: getString(row.specialNote) ?? getString(row.special_note),
    handlingCautionNote:
      getString(row.handlingCautionNote) ?? getString(row.handling_caution_note),
    handlingCautionLocked:
      getBoolean(row.handlingCautionLocked) ?? getBoolean(row.handling_caution_locked) ?? true,
    status: status as Patient["status"],
    createdAt: getString(row.createdAt) ?? getString(row.created_at) ?? new Date(0).toISOString(),
    updatedAt: getString(row.updatedAt) ?? getString(row.updated_at) ?? new Date(0).toISOString(),
  };
}

function mapGuardian(value: unknown): Guardian | undefined {
  if (!value || typeof value !== "object") return undefined;
  const row = value as Record<string, unknown>;
  const id = getString(row.id);
  const workspaceId = getString(row.workspaceId) ?? getString(row.workspace_id);
  const name = getString(row.name);

  if (!id || !workspaceId || !name) return undefined;

  return {
    id,
    workspaceId,
    name,
    mobilePhone: getString(row.mobilePhone) ?? getString(row.mobile_phone),
    phone: getString(row.phone),
    email: getString(row.email),
    birthDate: getString(row.birthDate) ?? getString(row.birth_date),
    address: getString(row.address),
    occupation: getString(row.occupation),
    memo: getString(row.memo),
    createdAt: getString(row.createdAt) ?? getString(row.created_at) ?? new Date(0).toISOString(),
    updatedAt: getString(row.updatedAt) ?? getString(row.updated_at) ?? new Date(0).toISOString(),
  };
}

function getBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
