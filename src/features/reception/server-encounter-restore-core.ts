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
import type { ReceptionEncounterRestoreRecord } from "@/features/reception/encounter-restore";
import { getReceptionMutationPermissionContract } from "@/features/reception/reception-mutation-permissions";
import { mockEncounters, mockWaitingQueueEntries } from "@/mocks/emr-domain";
import type { Encounter, WaitingQueueEntry } from "@/types/emr-domain";

export type ReceptionEncounterRestoreDenial =
  | "encounter_unavailable"
  | "encounter_not_restorable"
  | "encounter_already_active"
  | "queue_entry_unavailable";

export type ReceptionEncounterRestoreGatewayResult =
  | { ok: true; restoration: ReceptionEncounterRestoreRecord }
  | { ok: false; status: 409; denialReason: ReceptionEncounterRestoreDenial }
  | { ok: false; status: 500; error: "db_write_failed" };

export type ReceptionEncounterRestoreGateway = {
  restoreEncounter(input: {
    actorUserId: string;
    encounterId: string;
    workspaceId: string;
  }): Promise<ReceptionEncounterRestoreGatewayResult>;
};

export type ReceptionEncounterRestoreResult =
  | {
      ok: true;
      status: 200;
      workspaceId: string;
      restoration: ReceptionEncounterRestoreRecord;
      enforcedBy: "reception-encounter-restore";
    }
  | {
      ok: false;
      status: 400;
      error: "invalid_input";
      fieldErrors: { encounterId: string };
    }
  | {
      ok: false;
      status: 401 | 403;
      denialReason: WorkspacePermissionDenialReason;
    }
  | {
      ok: false;
      status: 409;
      denialReason: ReceptionEncounterRestoreDenial;
    }
  | {
      ok: false;
      status: 500;
      error: "db_write_failed" | "supabase_client_missing";
    };

export async function restoreReceptionEncounter({
  actorUserId,
  auditGateway,
  auditNow,
  auditRequestId,
  encounterId,
  gateway = createMockReceptionEncounterRestoreGateway(),
  permissionAdapter = createDemoReceptionEncounterRestorePermissionAdapter(),
  workspaceId,
}: {
  actorUserId: string | null;
  auditGateway?: LiveMutationAuditOptions["auditGateway"];
  auditNow?: LiveMutationAuditOptions["auditNow"];
  auditRequestId?: LiveMutationAuditOptions["auditRequestId"];
  encounterId: string;
  gateway?: ReceptionEncounterRestoreGateway;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<ReceptionEncounterRestoreResult> {
  const normalizedEncounterId = trimToUndefined(encounterId);
  if (!normalizedEncounterId) {
    return {
      ok: false,
      status: 400,
      error: "invalid_input",
      fieldErrors: { encounterId: "복구할 접수를 선택해 주세요." },
    };
  }

  const permissionContract = getReceptionMutationPermissionContract("encounter_restore");
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

  const result = await gateway.restoreEncounter({
    actorUserId: actorUserId ?? "",
    encounterId: normalizedEncounterId,
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
      eventType: "reception.encounter_restored",
      targetType: "encounter",
      targetId: result.restoration.encounter.id,
      encounterId: result.restoration.encounter.id,
      patientId: result.restoration.encounter.patientId,
      guardianId: result.restoration.encounter.guardianId ?? null,
      requestId: auditRequestId,
      after: {
        queueStatus: result.restoration.queueEntry.status,
        status: result.restoration.encounter.status,
      },
      metadata: { source: "reception-encounter-restore" },
    },
  });
  if (!audit.ok) return { ok: false, status: 500, error: "db_write_failed" };

  return {
    ok: true,
    status: 200,
    workspaceId,
    restoration: result.restoration,
    enforcedBy: "reception-encounter-restore",
  };
}

export function createMockReceptionEncounterRestoreGateway(
  dataset: {
    encounters?: Encounter[];
    waitingQueueEntries?: WaitingQueueEntry[];
  } = {
    encounters: mockEncounters,
    waitingQueueEntries: mockWaitingQueueEntries,
  },
  now = new Date().toISOString(),
): ReceptionEncounterRestoreGateway {
  return {
    async restoreEncounter({ encounterId, workspaceId }) {
      const encounter = (dataset.encounters ?? []).find(
        (item) => item.id === encounterId && item.workspaceId === workspaceId,
      );
      if (!encounter) return { ok: false, status: 409, denialReason: "encounter_unavailable" };
      if (encounter.status !== "cancelled") {
        return { ok: false, status: 409, denialReason: "encounter_already_active" };
      }

      const queueEntry = (dataset.waitingQueueEntries ?? []).find(
        (item) =>
          item.workspaceId === workspaceId &&
          item.encounterId === encounter.id &&
          item.queueType === "consultation",
      );
      if (!queueEntry) return { ok: false, status: 409, denialReason: "queue_entry_unavailable" };
      if (queueEntry.status !== "cancelled") {
        return { ok: false, status: 409, denialReason: "encounter_not_restorable" };
      }

      return {
        ok: true,
        restoration: {
          encounter: { ...encounter, status: "waiting", updatedAt: now },
          queueEntry: { ...queueEntry, status: "waiting", finishedAt: undefined },
        },
      };
    },
  };
}

export type SupabaseReceptionEncounterRestoreRpcClient = {
  rpc(
    functionName: "clair_restore_reception_encounter",
    args: {
      p_workspace_id: string;
      p_actor_user_id: string;
      p_encounter_id: string;
    },
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
};

export function createSupabaseReceptionEncounterRestoreGateway(
  client: SupabaseReceptionEncounterRestoreRpcClient,
): ReceptionEncounterRestoreGateway {
  return {
    async restoreEncounter({ actorUserId, encounterId, workspaceId }) {
      const { data, error } = await client.rpc("clair_restore_reception_encounter", {
        p_workspace_id: workspaceId,
        p_actor_user_id: actorUserId,
        p_encounter_id: encounterId,
      });

      if (error) {
        const denialReason = mapEncounterRestoreDbDenial(error.message);
        if (denialReason) return { ok: false, status: 409, denialReason };
        return { ok: false, status: 500, error: "db_write_failed" };
      }

      const restoration = mapEncounterRestoreRecord(data);
      if (!restoration) return { ok: false, status: 500, error: "db_write_failed" };

      return { ok: true, restoration };
    },
  };
}

function mapEncounterRestoreDbDenial(message?: string) {
  if (!message) return null;
  if (message.includes("encounter_unavailable")) return "encounter_unavailable" as const;
  if (message.includes("encounter_not_restorable")) return "encounter_not_restorable" as const;
  if (message.includes("encounter_already_active")) return "encounter_already_active" as const;
  if (message.includes("queue_entry_unavailable")) return "queue_entry_unavailable" as const;
  return null;
}

function mapEncounterRestoreRecord(value: unknown): ReceptionEncounterRestoreRecord | null {
  if (!value || typeof value !== "object") return null;
  const row = value as { encounter?: unknown; queueEntry?: unknown; queue_entry?: unknown };
  const encounter = mapEncounter(row.encounter);
  const queueEntry = mapQueueEntry(row.queueEntry ?? row.queue_entry);
  if (!encounter || !queueEntry) return null;
  return { encounter, queueEntry };
}

function mapEncounter(value: unknown): Encounter | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const id = getString(row.id);
  const workspaceId = getString(row.workspaceId) ?? getString(row.workspace_id);
  const patientId = getString(row.patientId) ?? getString(row.patient_id);
  const encounterNo = getString(row.encounterNo) ?? getString(row.encounter_no);
  const status = getString(row.status);

  if (!id || !workspaceId || !patientId || !encounterNo || !status) return null;

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
    checkedInAt:
      getString(row.checkedInAt) ?? getString(row.checked_in_at) ?? new Date(0).toISOString(),
    checkedInByUserId:
      getString(row.checkedInByUserId) ?? getString(row.checked_in_by_user_id),
    cancellationReason:
      getString(row.cancellationReason) ?? getString(row.cancellation_reason),
    createdAt: getString(row.createdAt) ?? getString(row.created_at) ?? new Date(0).toISOString(),
    updatedAt: getString(row.updatedAt) ?? getString(row.updated_at) ?? new Date(0).toISOString(),
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

  if (!id || !workspaceId || !encounterId || !queueType || !status) return null;

  return {
    id,
    workspaceId,
    encounterId,
    queueType: queueType as WaitingQueueEntry["queueType"],
    status: status as WaitingQueueEntry["status"],
    priority: (getString(row.priority) as WaitingQueueEntry["priority"] | undefined) ?? "normal",
    sortOrder: getNumber(row.sortOrder) ?? getNumber(row.sort_order),
    enteredAt: getString(row.enteredAt) ?? getString(row.entered_at) ?? new Date(0).toISOString(),
    calledAt: getString(row.calledAt) ?? getString(row.called_at),
    finishedAt: getString(row.finishedAt) ?? getString(row.finished_at),
  };
}

function createDemoReceptionEncounterRestorePermissionAdapter() {
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

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function trimToUndefined(value?: string) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
