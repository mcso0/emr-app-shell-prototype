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
import type { ReceptionEncounterCancelRecord } from "@/features/reception/encounter-cancel";
import { getReceptionMutationPermissionContract } from "@/features/reception/reception-mutation-permissions";
import { mockEncounters, mockWaitingQueueEntries } from "@/mocks/emr-domain";
import type { Encounter, WaitingQueueEntry } from "@/types/emr-domain";

export type ReceptionEncounterCancelDenial =
  | "encounter_unavailable"
  | "encounter_not_cancelable"
  | "encounter_already_cancelled"
  | "queue_entry_unavailable";

export type ReceptionEncounterCancelGatewayResult =
  | {
      ok: true;
      cancellation: ReceptionEncounterCancelRecord;
      auditHandledBy?: "database_transaction";
      auditEventId?: string;
    }
  | { ok: false; status: 403; denialReason: "permission_missing" }
  | { ok: false; status: 409; denialReason: ReceptionEncounterCancelDenial }
  | { ok: false; status: 500; error: "db_write_failed" };

export type ReceptionEncounterCancelGateway = {
  cancelEncounter(input: {
    actorUserId: string;
    cancelReason: string;
    encounterId: string;
    workspaceId: string;
  }): Promise<ReceptionEncounterCancelGatewayResult>;
};

export type ReceptionEncounterCancelResult =
  | {
      ok: true;
      status: 200;
      workspaceId: string;
      cancellation: ReceptionEncounterCancelRecord;
      enforcedBy: "reception-encounter-cancel";
    }
  | {
      ok: false;
      status: 400;
      error: "invalid_input";
      fieldErrors: Partial<Record<"cancelReason" | "encounterId", string>>;
    }
  | {
      ok: false;
      status: 401 | 403;
      denialReason: WorkspacePermissionDenialReason;
    }
  | {
      ok: false;
      status: 409;
      denialReason: ReceptionEncounterCancelDenial;
    }
  | {
      ok: false;
      status: 500;
      error: "db_write_failed" | "supabase_client_missing";
    };

export async function cancelReceptionEncounter({
  actorUserId,
  auditGateway,
  auditNow,
  auditRequestId,
  cancelReason,
  encounterId,
  gateway = createMockReceptionEncounterCancelGateway(),
  permissionAdapter = createDemoReceptionEncounterCancelPermissionAdapter(),
  workspaceId,
}: {
  actorUserId: string | null;
  auditGateway?: LiveMutationAuditOptions["auditGateway"];
  auditNow?: LiveMutationAuditOptions["auditNow"];
  auditRequestId?: LiveMutationAuditOptions["auditRequestId"];
  cancelReason?: string;
  encounterId: string;
  gateway?: ReceptionEncounterCancelGateway;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<ReceptionEncounterCancelResult> {
  const normalizedEncounterId = trimToUndefined(encounterId);
  const normalizedCancelReason = trimToUndefined(cancelReason);
  if (
    !normalizedEncounterId ||
    !normalizedCancelReason ||
    normalizedCancelReason.length > 500
  ) {
    return {
      ok: false,
      status: 400,
      error: "invalid_input",
      fieldErrors: {
        ...(normalizedEncounterId
          ? {}
          : { encounterId: "접수를 선택해 주세요." }),
        ...(normalizedCancelReason
          ? normalizedCancelReason.length > 500
            ? { cancelReason: "진료 취소 사유는 500자 이하로 입력해 주세요." }
            : {}
          : { cancelReason: "진료 취소 사유를 입력해 주세요." }),
      },
    };
  }

  const permissionContract =
    getReceptionMutationPermissionContract("encounter_cancel");
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

  const result = await gateway.cancelEncounter({
    actorUserId: actorUserId ?? "",
    cancelReason: normalizedCancelReason,
    encounterId: normalizedEncounterId,
    workspaceId,
  });

  if (!result.ok) {
    if (result.status === 403) {
      return { ok: false, status: 403, denialReason: result.denialReason };
    }

    if (result.status === 409) {
      return { ok: false, status: 409, denialReason: result.denialReason };
    }

    return { ok: false, status: 500, error: result.error };
  }

  const hasTransactionalAudit =
    result.auditHandledBy === "database_transaction" &&
    typeof result.auditEventId === "string" &&
    result.auditEventId.trim().length > 0;

  if (!hasTransactionalAudit) {
    const audit = await emitLiveMutationAuditEvent({
      auditGateway,
      auditNow,
      input: {
        workspaceId,
        actorUserId,
        eventType: "reception.encounter_cancelled",
        targetType: "encounter",
        targetId: result.cancellation.encounter.id,
        encounterId: result.cancellation.encounter.id,
        patientId: result.cancellation.encounter.patientId,
        guardianId: result.cancellation.encounter.guardianId ?? null,
        requestId: auditRequestId,
        after: {
          reason: normalizedCancelReason,
          queueStatus: result.cancellation.queueEntry.status,
          status: result.cancellation.encounter.status,
        },
        metadata: { source: "reception-encounter-cancel" },
      },
    });
    if (!audit.ok) return { ok: false, status: 500, error: "db_write_failed" };
  }

  return {
    ok: true,
    status: 200,
    workspaceId,
    cancellation: result.cancellation,
    enforcedBy: "reception-encounter-cancel",
  };
}

export function createMockReceptionEncounterCancelGateway(
  dataset: {
    encounters?: Encounter[];
    waitingQueueEntries?: WaitingQueueEntry[];
  } = {
    encounters: mockEncounters,
    waitingQueueEntries: mockWaitingQueueEntries,
  },
  now = new Date().toISOString(),
): ReceptionEncounterCancelGateway {
  return {
    async cancelEncounter({ cancelReason, encounterId, workspaceId }) {
      const encounter = (dataset.encounters ?? []).find(
        (item) => item.id === encounterId && item.workspaceId === workspaceId,
      );
      if (!encounter) {
        return {
          ok: false,
          status: 409,
          denialReason: "encounter_unavailable",
        };
      }
      if (encounter.status === "cancelled") {
        return {
          ok: false,
          status: 409,
          denialReason: "encounter_already_cancelled",
        };
      }
      if (!isReceptionCancelableEncounter(encounter)) {
        return {
          ok: false,
          status: 409,
          denialReason: "encounter_not_cancelable",
        };
      }

      const queueEntry = (dataset.waitingQueueEntries ?? []).find(
        (item) =>
          item.workspaceId === workspaceId &&
          item.encounterId === encounter.id &&
          item.queueType === "consultation",
      );
      if (!queueEntry) {
        return {
          ok: false,
          status: 409,
          denialReason: "queue_entry_unavailable",
        };
      }
      if (queueEntry.status === "cancelled") {
        return {
          ok: false,
          status: 409,
          denialReason: "encounter_already_cancelled",
        };
      }
      if (!isReceptionCancelableQueueEntry(queueEntry)) {
        return {
          ok: false,
          status: 409,
          denialReason: "encounter_not_cancelable",
        };
      }

      return {
        ok: true,
        cancellation: {
          encounter: {
            ...encounter,
            status: "cancelled",
            cancellationReason: cancelReason,
            updatedAt: now,
          },
          queueEntry: { ...queueEntry, status: "cancelled", finishedAt: now },
        },
      };
    },
  };
}

export type SupabaseReceptionEncounterCancelRpcClient = {
  rpc(
    functionName: "clair_cancel_reception_encounter",
    args: {
      p_workspace_id: string;
      p_actor_user_id: string;
      p_encounter_id: string;
      p_cancel_reason: string;
    },
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
};

export function createSupabaseReceptionEncounterCancelGateway(
  client: SupabaseReceptionEncounterCancelRpcClient,
): ReceptionEncounterCancelGateway {
  return {
    async cancelEncounter({
      actorUserId,
      cancelReason,
      encounterId,
      workspaceId,
    }) {
      const { data, error } = await client.rpc(
        "clair_cancel_reception_encounter",
        {
          p_workspace_id: workspaceId,
          p_actor_user_id: actorUserId,
          p_encounter_id: encounterId,
          p_cancel_reason: cancelReason,
        },
      );

      if (error) {
        if (isEncounterCancelDbPermissionDenial(error.message)) {
          return { ok: false, status: 403, denialReason: "permission_missing" };
        }
        const denialReason = mapEncounterCancelDbDenial(error.message);
        if (denialReason) return { ok: false, status: 409, denialReason };
        return { ok: false, status: 500, error: "db_write_failed" };
      }

      const cancellation = mapEncounterCancelRecord(data);
      if (!cancellation) {
        return { ok: false, status: 500, error: "db_write_failed" };
      }

      const auditEventId = mapTransactionalAuditEventId(data);
      return auditEventId
        ? {
            ok: true,
            cancellation,
            auditHandledBy: "database_transaction",
            auditEventId,
          }
        : { ok: true, cancellation };
    },
  };
}

function isReceptionCancelableEncounter(encounter: Encounter) {
  return (
    encounter.status === "waiting" || encounter.status === "in_consultation"
  );
}

function isReceptionCancelableQueueEntry(queueEntry: WaitingQueueEntry) {
  return (
    queueEntry.status === "waiting" ||
    queueEntry.status === "called" ||
    queueEntry.status === "in_progress"
  );
}

function mapEncounterCancelDbDenial(message?: string) {
  if (!message) return null;
  if (message.includes("encounter_unavailable"))
    return "encounter_unavailable" as const;
  if (message.includes("encounter_not_cancelable"))
    return "encounter_not_cancelable" as const;
  if (message.includes("encounter_already_cancelled")) {
    return "encounter_already_cancelled" as const;
  }
  if (message.includes("queue_entry_unavailable")) {
    return "queue_entry_unavailable" as const;
  }
  return null;
}

function isEncounterCancelDbPermissionDenial(message?: string) {
  if (!message) return false;
  return (
    message.includes("actor_mismatch") ||
    message.includes("workspace_membership_missing") ||
    message.includes("permission_missing")
  );
}

function mapEncounterCancelRecord(
  value: unknown,
): ReceptionEncounterCancelRecord | null {
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

function mapTransactionalAuditEventId(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const row = value as {
    auditHandledBy?: unknown;
    auditEventId?: unknown;
    audit_handled_by?: unknown;
    audit_event_id?: unknown;
  };
  const handledBy = row.auditHandledBy ?? row.audit_handled_by;
  const eventId = row.auditEventId ?? row.audit_event_id;
  return handledBy === "database_transaction" &&
    typeof eventId === "string" &&
    eventId.trim()
    ? eventId.trim()
    : undefined;
}

function mapEncounter(value: unknown): Encounter | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<Encounter> & {
    receptionType?: string;
    reception_type?: string;
    cancellationReason?: string;
    cancellation_reason?: string;
  };
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
    receptionType: (row.receptionType ??
      row.reception_type) as Encounter["receptionType"],
    department: trimToUndefined(row.department),
    durationMinutes:
      typeof row.durationMinutes === "number" ? row.durationMinutes : undefined,
    chiefComplaint: trimToUndefined(row.chiefComplaint),
    visitPurpose: trimToUndefined(row.visitPurpose),
    receptionMemo: trimToUndefined(row.receptionMemo),
    status: row.status as Encounter["status"],
    checkedInAt: trimToUndefined(row.checkedInAt) ?? new Date(0).toISOString(),
    checkedInByUserId: trimToUndefined(row.checkedInByUserId),
    cancellationReason:
      trimToUndefined(row.cancellationReason) ??
      trimToUndefined(row.cancellation_reason),
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

function createDemoReceptionEncounterCancelPermissionAdapter() {
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

function trimToUndefined(value?: string) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
