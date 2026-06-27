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
import {
  getConsultationCallRoomById,
  type ConsultationCallRoom,
} from "@/features/chart/data";
import { mockEncounters, mockWaitingQueueEntries } from "@/mocks/emr-domain";
import type { Encounter, WaitingQueueEntry } from "@/types/emr-domain";

export type ConsultationFlowAction = "call" | "start" | "return_to_waiting";

export type ConsultationFlowInput = {
  action?: ConsultationFlowAction;
  encounterId?: string;
  roomId?: string;
};

export type ConsultationCallEvent = {
  id: string;
  workspaceId: string;
  encounterId: string;
  queueEntryId: string;
  eventType: "did_call_requested";
  displayText: string;
  deliveryStatus: "queued";
  roomId: string;
  roomName: string;
  createdAt: string;
  createdByUserId: string;
};

export type ConsultationFlowSnapshot = {
  callEvent?: ConsultationCallEvent;
  encounter: Encounter;
  queueEntry: WaitingQueueEntry;
};

export type ConsultationFlowGatewayResult =
  | { ok: true; flow: ConsultationFlowSnapshot }
  | {
      ok: false;
      status: 409;
      denialReason:
        | "encounter_unavailable"
        | "queue_entry_unavailable"
        | "room_unavailable"
        | "stale_status";
    }
  | { ok: false; status: 500; error: "db_write_failed" };

export type ConsultationFlowGateway = {
  callConsultation(input: {
    actorUserId: string;
    encounterId: string;
    room: ConsultationCallRoom;
    workspaceId: string;
  }): Promise<ConsultationFlowGatewayResult>;
  startConsultation(input: {
    actorUserId: string;
    encounterId: string;
    workspaceId: string;
  }): Promise<ConsultationFlowGatewayResult>;
  returnConsultationToWaiting(input: {
    actorUserId: string;
    encounterId: string;
    workspaceId: string;
  }): Promise<ConsultationFlowGatewayResult>;
};

export type ConsultationFlowMutationResult =
  | {
      ok: true;
      status: 200;
      flow: ConsultationFlowSnapshot;
      enforcedBy: "chart-consultation-flow";
    }
  | {
      ok: false;
      status: 400;
      error: "invalid_input";
      fieldErrors: Partial<Record<keyof ConsultationFlowInput, string>>;
    }
  | { ok: false; status: 401 | 403; denialReason: WorkspacePermissionDenialReason }
  | {
      ok: false;
      status: 409;
      denialReason:
        | "encounter_unavailable"
        | "queue_entry_unavailable"
        | "room_unavailable"
        | "stale_status";
    }
  | { ok: false; status: 500; error: "db_write_failed" | "supabase_client_missing" };

const mockCallEventStore = new Map<string, ConsultationCallEvent[]>();

export async function mutateConsultationFlow({
  actorUserId,
  auditGateway,
  auditNow,
  auditRequestId,
  gateway = createMockConsultationFlowGateway(),
  input,
  permissionAdapter = createDemoConsultationFlowPermissionAdapter(),
  workspaceId,
}: {
  actorUserId: string | null;
  auditGateway?: LiveMutationAuditOptions["auditGateway"];
  auditNow?: LiveMutationAuditOptions["auditNow"];
  auditRequestId?: LiveMutationAuditOptions["auditRequestId"];
  gateway?: ConsultationFlowGateway;
  input: ConsultationFlowInput;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<ConsultationFlowMutationResult> {
  const encounterId = trimToUndefined(input.encounterId);
  const action = input.action;
  const room = action === "call" ? getConsultationCallRoomById(input.roomId) : undefined;

  if (
    !encounterId ||
    (action !== "call" && action !== "start" && action !== "return_to_waiting") ||
    (action === "call" && !room)
  ) {
    return {
      ok: false,
      status: 400,
      error: "invalid_input",
      fieldErrors: {
        ...(encounterId ? {} : { encounterId: "진료 차트를 선택해 주세요." }),
        ...(action !== "call" || room ? {} : { roomId: "진료실을 선택해 주세요." }),
        ...(action === "call" || action === "start" || action === "return_to_waiting"
          ? {}
          : { action: "지원하지 않는 진료 흐름 액션이에요." }),
      },
    };
  }

  const permission = resolveWorkspacePermission(permissionAdapter, {
    sessionUserId: actorUserId,
    workspaceId,
    requiredPermission: "chart:update",
  });

  if (!permission.allowed) {
    return {
      ok: false,
      status: permission.denialReason === "unauthenticated" ? 401 : 403,
      denialReason: permission.denialReason ?? "permission_missing",
    };
  }

  const result =
    action === "call"
      ? await gateway.callConsultation({
          actorUserId: actorUserId ?? "",
          encounterId,
          room: room!,
          workspaceId,
        })
      : action === "return_to_waiting"
        ? await gateway.returnConsultationToWaiting({
            actorUserId: actorUserId ?? "",
            encounterId,
            workspaceId,
          })
        : await gateway.startConsultation({
            actorUserId: actorUserId ?? "",
            encounterId,
            workspaceId,
          });

  if (!result.ok) {
    if (result.status === 409) return result;
    return { ok: false, status: 500, error: "db_write_failed" };
  }

  const audit = await emitLiveMutationAuditEvent({
    auditGateway,
    auditNow,
    input: {
      workspaceId,
      actorUserId,
      eventType:
        action === "call"
          ? "chart.patient_called"
          : action === "return_to_waiting"
            ? "chart.consultation_returned_to_waiting"
            : "chart.consultation_started",
      targetType: "encounter",
      targetId: encounterId,
      encounterId,
      requestId: auditRequestId,
      after: {
        encounterStatus: result.flow.encounter.status,
        queueStatus: result.flow.queueEntry.status,
        calledAt: result.flow.queueEntry.calledAt ?? null,
        roomId: result.flow.callEvent?.roomId ?? null,
        roomName: result.flow.callEvent?.roomName ?? null,
        startedAt: result.flow.encounter.startedAt ?? null,
      },
      metadata: {
        source: "chart-consultation-flow",
        didProvider: "not_configured",
        action,
      },
    },
  });
  if (!audit.ok) return { ok: false, status: 500, error: "db_write_failed" };

  return {
    ok: true,
    status: 200,
    flow: result.flow,
    enforcedBy: "chart-consultation-flow",
  };
}

export function createMockConsultationFlowGateway(
  dataset: {
    encounters?: Encounter[];
    waitingQueueEntries?: WaitingQueueEntry[];
  } = {
    encounters: mockEncounters,
    waitingQueueEntries: mockWaitingQueueEntries,
  },
  now = () => new Date().toISOString(),
): ConsultationFlowGateway {
  const encounters = dataset.encounters ?? [];
  const queueEntries = dataset.waitingQueueEntries ?? [];

  return {
    async callConsultation({ actorUserId, encounterId, room, workspaceId }) {
      const found = findConsultationFlowRows(encounters, queueEntries, workspaceId, encounterId);
      if (!found.encounter) {
        return { ok: false, status: 409, denialReason: "encounter_unavailable" };
      }
      if (!found.queueEntry) {
        return { ok: false, status: 409, denialReason: "queue_entry_unavailable" };
      }
      if (found.encounter.status !== "waiting" || found.queueEntry.status !== "waiting") {
        return { ok: false, status: 409, denialReason: "stale_status" };
      }

      const timestamp = now();
      found.encounter.status = "in_consultation";
      found.encounter.startedAt = timestamp;
      found.encounter.updatedAt = timestamp;
      found.queueEntry.status = "in_progress";
      found.queueEntry.calledAt = timestamp;

      const callEvent: ConsultationCallEvent = {
        id: `call-event-${encounterId}-${timestamp}`,
        workspaceId,
        encounterId,
        queueEntryId: found.queueEntry.id,
        eventType: "did_call_requested",
        displayText: `${room.name}로 환자를 호출하고 진료를 시작합니다.`,
        deliveryStatus: "queued",
        roomId: room.id,
        roomName: room.name,
        createdAt: timestamp,
        createdByUserId: actorUserId,
      };
      const key = buildCallEventKey(workspaceId, encounterId);
      mockCallEventStore.set(key, [...(mockCallEventStore.get(key) ?? []), callEvent]);

      return {
        ok: true,
        flow: {
          callEvent,
          encounter: { ...found.encounter },
          queueEntry: { ...found.queueEntry },
        },
      };
    },
    async startConsultation({ encounterId, workspaceId }) {
      const found = findConsultationFlowRows(encounters, queueEntries, workspaceId, encounterId);
      if (!found.encounter) {
        return { ok: false, status: 409, denialReason: "encounter_unavailable" };
      }
      if (!found.queueEntry) {
        return { ok: false, status: 409, denialReason: "queue_entry_unavailable" };
      }
      if (found.encounter.status !== "waiting" || found.queueEntry.status !== "called") {
        return { ok: false, status: 409, denialReason: "stale_status" };
      }

      const timestamp = now();
      found.encounter.status = "in_consultation";
      found.encounter.startedAt = timestamp;
      found.encounter.updatedAt = timestamp;
      found.queueEntry.status = "in_progress";

      return {
        ok: true,
        flow: {
          encounter: { ...found.encounter },
          queueEntry: { ...found.queueEntry },
        },
      };
    },
    async returnConsultationToWaiting({ encounterId, workspaceId }) {
      const found = findConsultationFlowRows(encounters, queueEntries, workspaceId, encounterId);
      if (!found.encounter) {
        return { ok: false, status: 409, denialReason: "encounter_unavailable" };
      }
      if (!found.queueEntry) {
        return { ok: false, status: 409, denialReason: "queue_entry_unavailable" };
      }
      if (
        found.encounter.status !== "in_consultation" ||
        found.queueEntry.status !== "in_progress"
      ) {
        return { ok: false, status: 409, denialReason: "stale_status" };
      }

      const timestamp = now();
      found.encounter.status = "waiting";
      found.encounter.startedAt = undefined;
      found.encounter.updatedAt = timestamp;
      found.queueEntry.status = "waiting";

      return {
        ok: true,
        flow: {
          encounter: { ...found.encounter },
          queueEntry: { ...found.queueEntry },
        },
      };
    },
  };
}

export type SupabaseConsultationFlowRpcClient = {
  rpc(
    functionName: "clair_call_consultation_queue",
    args: {
      p_workspace_id: string;
      p_actor_user_id: string;
      p_encounter_id: string;
      p_room_id: string;
    },
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
  rpc(
    functionName: "clair_start_consultation",
    args: {
      p_workspace_id: string;
      p_actor_user_id: string;
      p_encounter_id: string;
    },
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
  rpc(
    functionName: "clair_return_consultation_to_waiting",
    args: {
      p_workspace_id: string;
      p_actor_user_id: string;
      p_encounter_id: string;
    },
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
};

export function createSupabaseConsultationFlowGateway(
  client: SupabaseConsultationFlowRpcClient,
): ConsultationFlowGateway {
  return {
    async callConsultation({ actorUserId, encounterId, room, workspaceId }) {
      const { data, error } = await client.rpc("clair_call_consultation_queue", {
        p_workspace_id: workspaceId,
        p_actor_user_id: actorUserId,
        p_encounter_id: encounterId,
        p_room_id: room.id,
      });

      return mapSupabaseMutationResult(data, error, "db_write_failed");
    },
    async startConsultation({ actorUserId, encounterId, workspaceId }) {
      const { data, error } = await client.rpc("clair_start_consultation", {
        p_workspace_id: workspaceId,
        p_actor_user_id: actorUserId,
        p_encounter_id: encounterId,
      });

      return mapSupabaseMutationResult(data, error, "db_write_failed");
    },
    async returnConsultationToWaiting({ actorUserId, encounterId, workspaceId }) {
      const { data, error } = await client.rpc("clair_return_consultation_to_waiting", {
        p_workspace_id: workspaceId,
        p_actor_user_id: actorUserId,
        p_encounter_id: encounterId,
      });

      return mapSupabaseMutationResult(data, error, "db_write_failed");
    },
  };
}

export function createDemoConsultationFlowPermissionAdapter() {
  return createMockWorkspacePermissionAdapter({
    users: [
      { id: "playwright-default-session", status: "active", displayName: "Playwright Admin" },
      { id: "user-admin", status: "active", displayName: "송민재" },
      { id: "user-front-desk", status: "active", displayName: "최유나" },
      { id: "user-vet", status: "active", displayName: "이수지" },
      { id: "user-tech", status: "active", displayName: "송하윤" },
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
      {
        id: "membership-tech",
        workspaceId: "clair-demo",
        userId: "user-tech",
        roles: ["technician"],
        status: "active",
      },
    ],
  });
}

function findConsultationFlowRows(
  encounters: Encounter[],
  queueEntries: WaitingQueueEntry[],
  workspaceId: string,
  encounterId: string,
) {
  const encounter = encounters.find(
    (row) =>
      row.id === encounterId &&
      row.workspaceId === workspaceId &&
      row.status !== "cancelled",
  );
  const queueEntry = queueEntries.find(
    (row) =>
      row.workspaceId === workspaceId &&
      row.encounterId === encounterId &&
      row.queueType === "consultation" &&
      row.status !== "cancelled",
  );

  return { encounter, queueEntry };
}

function mapSupabaseMutationResult(
  data: unknown,
  error: { message?: string } | null,
  fallbackError: "db_write_failed",
): ConsultationFlowGatewayResult {
  if (error) {
    const denialReason = mapConflictReason(error.message);
    if (denialReason) return { ok: false, status: 409, denialReason };
    return { ok: false, status: 500, error: fallbackError };
  }

  const flow = mapConsultationFlowSnapshot(data);
  if (!flow) return { ok: false, status: 500, error: fallbackError };

  return { ok: true, flow };
}

function mapConflictReason(message?: string) {
  if (message?.includes("queue_entry_unavailable")) return "queue_entry_unavailable";
  if (message?.includes("room_unavailable")) return "room_unavailable";
  if (message?.includes("stale_status")) return "stale_status";
  if (message?.includes("encounter_unavailable")) return "encounter_unavailable";
  return null;
}

function mapConsultationFlowSnapshot(value: unknown): ConsultationFlowSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const row = value as { callEvent?: unknown; call_event?: unknown; encounter?: unknown; queueEntry?: unknown; queue_entry?: unknown };
  const encounter = mapEncounter(row.encounter);
  const queueEntry = mapQueueEntry(row.queueEntry ?? row.queue_entry);
  if (!encounter || !queueEntry) return null;

  const callEvent = mapCallEvent(row.callEvent ?? row.call_event);
  return {
    ...(callEvent ? { callEvent } : {}),
    encounter,
    queueEntry,
  };
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
    checkedInByUserId: getString(row.checkedInByUserId) ?? getString(row.checked_in_by_user_id),
    startedAt: getString(row.startedAt) ?? getString(row.started_at),
    chartCompletedAt: getString(row.chartCompletedAt) ?? getString(row.chart_completed_at),
    chartCompletedByUserId:
      getString(row.chartCompletedByUserId) ?? getString(row.chart_completed_by_user_id),
    completedAt: getString(row.completedAt) ?? getString(row.completed_at),
    cancellationReason:
      getString(row.cancellationReason) ?? getString(row.cancellation_reason),
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

function mapCallEvent(value: unknown): ConsultationCallEvent | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const id = getString(row.id);
  const workspaceId = getString(row.workspaceId) ?? getString(row.workspace_id);
  const encounterId = getString(row.encounterId) ?? getString(row.encounter_id);
  const queueEntryId = getString(row.queueEntryId) ?? getString(row.queue_entry_id);
  const eventType = getString(row.eventType) ?? getString(row.event_type);
  const displayText = getString(row.displayText) ?? getString(row.display_text);
  const deliveryStatus = getString(row.deliveryStatus) ?? getString(row.delivery_status);
  const roomId = getString(row.roomId) ?? getString(row.room_id);
  const roomName = getString(row.roomName) ?? getString(row.room_name);
  const createdAt = getString(row.createdAt) ?? getString(row.created_at);
  const createdByUserId = getString(row.createdByUserId) ?? getString(row.created_by_user_id);

  if (
    !id ||
    !workspaceId ||
    !encounterId ||
    !queueEntryId ||
    eventType !== "did_call_requested" ||
    !displayText ||
    deliveryStatus !== "queued" ||
    !roomId ||
    !roomName ||
    !createdAt ||
    !createdByUserId
  ) {
    return null;
  }

  return {
    id,
    workspaceId,
    encounterId,
    queueEntryId,
    eventType,
    displayText,
    deliveryStatus,
    roomId,
    roomName,
    createdAt,
    createdByUserId,
  };
}

function buildCallEventKey(workspaceId: string, encounterId: string) {
  return `${workspaceId}:${encounterId}`;
}

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function trimToUndefined(value?: string | null) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
