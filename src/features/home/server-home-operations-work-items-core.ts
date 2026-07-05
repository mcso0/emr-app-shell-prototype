import {
  createMockWorkspacePermissionAdapter,
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";
import { getWorkspaceOperatingDate, isIsoOperatingDate } from "@/lib/emr-domain/demo-date";
import type { PermissionId } from "@/types/emr-domain";
import type {
  HomeOperationsAccessIssue,
  HomeOperationsAttentionSignal,
  HomeOperationsProgressState,
  HomeOperationsSourceType,
  HomeOperationsSummary,
  HomeOperationsWorkItem,
  HomeOperationsWorkItemsResponse,
} from "@/features/home/home.types";

export type HomeOperationsScope = "all" | "mine";

export type HomeOperationsWorkItemFilters = {
  date?: string | null;
  includeCancelled?: boolean;
  includeCompleted?: boolean;
  scope?: string | null;
};

export type HomeOperationsGatewayResult =
  | {
      ok: true;
      generatedAt: string;
      items: HomeOperationsWorkItem[];
      sourceStatus: "empty" | "live" | "partial";
      accessIssues?: HomeOperationsAccessIssue[];
    }
  | {
      ok: false;
      error: "db_read_failed";
      retryable?: boolean;
    };

export type HomeOperationsWorkItemGateway = {
  listHomeOperationsWorkItems(input: {
    actorUserId: string;
    includeCancelled: boolean;
    includeCompleted: boolean;
    operatingDate: string;
    scope: HomeOperationsScope;
    workspaceId: string;
  }): Promise<HomeOperationsGatewayResult>;
};

export type HomeOperationsWorkItemReadResult =
  | (Extract<HomeOperationsWorkItemsResponse, { ok: true }> & {
      enforcedBy: "home-operations-work-items";
      status: 200;
    })
  | (Extract<HomeOperationsWorkItemsResponse, { ok: false }> & {
      status: 400 | 401 | 403 | 500;
    });

const sourceTypes: HomeOperationsSourceType[] = [
  "reception",
  "appointment",
  "consultation",
  "lab",
  "imaging",
  "dispensing",
  "treatment",
  "billing",
  "inpatient",
];

const progressStates: HomeOperationsProgressState[] = [
  "waiting",
  "in_progress",
  "completed",
  "cancelled",
];

const attentionSignals: HomeOperationsAttentionSignal[] = [
  "urgent",
  "re_requested",
  "assignment_missing",
  "team_queue",
  "long_stay",
];

export async function readHomeOperationsWorkItems({
  actorUserId,
  filters,
  gateway,
  permissionAdapter = createMockWorkspacePermissionAdapter(),
  workspaceId,
}: {
  actorUserId: string | null;
  filters: HomeOperationsWorkItemFilters;
  gateway?: HomeOperationsWorkItemGateway;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<HomeOperationsWorkItemReadResult> {
  const operatingDate = normalizeOperatingDate(filters.date, workspaceId);
  if (!operatingDate) {
    return buildErrorResponse({
      code: "invalid_operating_date",
      message: "운영일 형식이 올바르지 않습니다.",
      operatingDate: getWorkspaceOperatingDate(workspaceId),
      retryable: false,
      sourceStatus: "error",
      status: 400,
      workspaceId,
    });
  }

  const scope = normalizeScope(filters.scope);
  if (!scope) {
    return buildErrorResponse({
      code: "invalid_scope",
      message: "업무 범위 값이 올바르지 않습니다.",
      operatingDate,
      retryable: false,
      sourceStatus: "error",
      status: 400,
      workspaceId,
    });
  }

  const boardPermission = resolveWorkspacePermission(permissionAdapter, {
    sessionUserId: actorUserId,
    workspaceId,
    requiredPermission: "reception:view",
  });
  if (!boardPermission.allowed) {
    return buildPermissionDeniedResponse({
      denialReason: boardPermission.denialReason,
      operatingDate,
      workspaceId,
    });
  }

  if (!gateway || !actorUserId) {
    return buildErrorResponse({
      code: "supabase_client_missing",
      message: "원내 현황 데이터를 읽을 서버 연결이 없습니다.",
      operatingDate,
      retryable: true,
      sourceStatus: "error",
      status: 500,
      workspaceId,
    });
  }

  const result = await gateway.listHomeOperationsWorkItems({
    actorUserId,
    includeCancelled: filters.includeCancelled === true,
    includeCompleted: filters.includeCompleted === true,
    operatingDate,
    scope,
    workspaceId,
  });

  if (!result.ok) {
    return buildErrorResponse({
      code: result.error,
      message: "원내 현황 데이터를 불러오지 못했습니다.",
      operatingDate,
      retryable: result.retryable ?? true,
      sourceStatus: "error",
      status: 500,
      workspaceId,
    });
  }

  const itemsWithMine = result.items
    .filter((item) => item.permissionMode !== "hidden")
    .map((item) => ({
      ...item,
      isMyWork: isMyOperationsWorkItem({
        actorUserId,
        item,
        permissionAdapter,
        workspaceId,
      }),
    }));
  const scopedItems = scope === "mine"
    ? itemsWithMine.filter((item) => item.isMyWork)
    : itemsWithMine;
  const summary = summarizeOperationsWorkItems(scopedItems);

  return {
    ok: true,
    status: 200,
    enforcedBy: "home-operations-work-items",
    workspaceId,
    operatingDate,
    sourceStatus: result.sourceStatus === "partial"
      ? "partial"
      : scopedItems.length > 0
        ? "live"
        : "empty",
    items: scopedItems,
    summary,
    ...(result.accessIssues?.length ? { accessIssues: result.accessIssues } : {}),
    generatedAt: result.generatedAt,
  };
}

export type SupabaseHomeOperationsWorkItemsRpcClient = {
  rpc(
    functionName: string,
    args: Record<string, unknown>,
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
  from?(tableName: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        limit(count: number): Promise<{ data: unknown[] | null; error: { message?: string } | null }>;
      };
    };
  };
};

export function createSupabaseHomeOperationsWorkItemGateway(
  client: SupabaseHomeOperationsWorkItemsRpcClient,
): HomeOperationsWorkItemGateway {
  return {
    async listHomeOperationsWorkItems({
      actorUserId,
      includeCancelled,
      includeCompleted,
      operatingDate,
      scope,
      workspaceId,
    }) {
      const { data, error } = await client.rpc("clair_list_home_operations_work_items", {
        p_workspace_id: workspaceId,
        p_actor_user_id: actorUserId,
        p_operating_date: operatingDate,
        p_scope: scope,
        p_include_completed: includeCompleted,
        p_include_cancelled: includeCancelled,
      });

      if (error) {
        const fallback = await listHomeOperationsWorkItemsFromExistingSources(client, {
          actorUserId,
          includeCancelled,
          includeCompleted,
          operatingDate,
          scope,
          workspaceId,
        });
        if (fallback.ok) return fallback;
        return { ok: false, error: "db_read_failed", retryable: true };
      }
      return mapRpcResponse(data);
    },
  };
}

async function listHomeOperationsWorkItemsFromExistingSources(
  client: SupabaseHomeOperationsWorkItemsRpcClient,
  input: {
    actorUserId: string;
    includeCancelled: boolean;
    includeCompleted: boolean;
    operatingDate: string;
    scope: HomeOperationsScope;
    workspaceId: string;
  },
): Promise<HomeOperationsGatewayResult> {
  const generatedAt = new Date().toISOString();
  const accessIssues: HomeOperationsAccessIssue[] = [];
  const items: HomeOperationsWorkItem[] = [];

  const calendar = await client.rpc("clair_list_reception_day_calendar", {
    p_workspace_id: input.workspaceId,
    p_day: input.operatingDate,
  });
  if (calendar.error) {
    accessIssues.push({
      code: "reception_calendar_read_failed",
      message: "접수/예약 업무를 불러오지 못했습니다.",
      sourceType: "reception",
    });
  } else {
    items.push(...mapCalendarFallbackItems(calendar.data, input));
  }

  if (client.from) {
    const fulfillment = await client
      .from("order_fulfillment_work_items")
      .select("id, workspace_id, queue_type, status, priority, encounter_id, assigned_to_user_id, source_snapshot, created_at, updated_at, returned_at, completed_at, cancelled_at")
      .eq("workspace_id", input.workspaceId)
      .limit(200);

    if (fulfillment.error) {
      accessIssues.push({
        code: "fulfillment_read_failed",
        message: "오더 기반 업무를 불러오지 못했습니다.",
      });
    } else {
      items.push(...mapFulfillmentFallbackItems(fulfillment.data ?? [], input));
    }
  } else {
    accessIssues.push({
      code: "fulfillment_reader_unavailable",
      message: "오더 기반 업무 리더를 사용할 수 없습니다.",
    });
  }

  if (items.length === 0 && accessIssues.length > 0) {
    return { ok: false, error: "db_read_failed", retryable: true };
  }

  return {
    ok: true,
    generatedAt,
    items: sortOperationsItems(deduplicateOperationsItems(items)),
    sourceStatus: accessIssues.length > 0 ? "partial" : items.length > 0 ? "live" : "empty",
    ...(accessIssues.length > 0 ? { accessIssues } : {}),
  };
}

export function createMockHomeOperationsWorkItemGateway(
  response: HomeOperationsGatewayResult,
): HomeOperationsWorkItemGateway {
  return {
    async listHomeOperationsWorkItems() {
      return response;
    },
  };
}

function mapCalendarFallbackItems(
  value: unknown,
  {
    includeCancelled,
    includeCompleted,
    operatingDate,
    workspaceId,
  }: {
    includeCancelled: boolean;
    includeCompleted: boolean;
    operatingDate: string;
    workspaceId: string;
  },
): HomeOperationsWorkItem[] {
  if (!Array.isArray(value)) return [];

  const items: HomeOperationsWorkItem[] = [];
  for (const recordValue of value) {
    if (!recordValue || typeof recordValue !== "object") continue;
    const record = recordValue as Record<string, unknown>;
    const appointment = getRecord(record.appointment);
    const encounter = getRecord(record.encounter);
    const patient = getRecord(record.patient);
    const guardian = getRecord(record.primaryGuardian);
    const queueEntry = getRecord(record.queueEntry);

    if (appointment) {
      const appointmentItem = mapAppointmentFallbackItem({
        appointment,
        encounter,
        guardian,
        includeCancelled,
        includeCompleted,
        operatingDate,
        patient,
        workspaceId,
      });
      if (appointmentItem) items.push(appointmentItem);
    }

    if (queueEntry && encounter) {
      const queueItem = mapQueueFallbackItem({
        encounter,
        guardian,
        includeCancelled,
        includeCompleted,
        operatingDate,
        patient,
        queueEntry,
        workspaceId,
      });
      if (queueItem) items.push(queueItem);
    }
  }

  return items;
}

function mapAppointmentFallbackItem({
  appointment,
  encounter,
  guardian,
  includeCancelled,
  includeCompleted,
  operatingDate,
  patient,
  workspaceId,
}: {
  appointment: Record<string, unknown>;
  encounter?: Record<string, unknown>;
  guardian?: Record<string, unknown>;
  includeCancelled: boolean;
  includeCompleted: boolean;
  operatingDate: string;
  patient?: Record<string, unknown>;
  workspaceId: string;
}): HomeOperationsWorkItem | null {
  const sourceId = getString(appointment.id);
  const sourceStatus = getString(appointment.status) ?? "unknown";
  const requestedAt = getString(appointment.scheduledStartAt) ?? getString(appointment.createdAt);
  if (!sourceId || !requestedAt) return null;

  const progressState = sourceStatus === "checked_in"
    ? "completed"
    : sourceStatus === "cancelled" || sourceStatus === "no_show"
      ? "cancelled"
      : "waiting";
  if (!shouldIncludeProgress(progressState, includeCompleted, includeCancelled)) return null;

  const patientName = getString(patient?.name);
  const teamQueueId = "reception";
  return {
    id: `appointment:${sourceId}`,
    workspaceId,
    sourceType: "appointment",
    sourceId,
    sourceStatus,
    encounterId: getString(encounter?.id),
    patientId: getString(appointment.patientId),
    guardianId: getString(appointment.guardianId),
    title: patientName ? `${patientName} 예약 확인` : "예약 확인",
    patientName,
    guardianName: getString(guardian?.name),
    progressState,
    attentionSignals: getFallbackAttentionSignals({
      priority: "normal",
      progressState,
      requestedAt,
      sourceStatus,
      teamQueueId,
      operatingDate,
    }),
    requestedAt,
    stateEnteredAt: getString(appointment.updatedAt) ?? requestedAt,
    operatingDate: toSeoulDate(requestedAt),
    sourceHref: `/w/${workspaceId}/reception?appointmentId=${sourceId}&modulePanel=open`,
    drawerSummary:
      getString(appointment.visitPurpose) ??
      getString(appointment.symptomNote) ??
      "예약 접수 상태를 확인합니다.",
    permissionMode: "full",
    teamQueueId,
    teamQueueLabel: "접수팀 큐",
  };
}

function mapQueueFallbackItem({
  encounter,
  guardian,
  includeCancelled,
  includeCompleted,
  operatingDate,
  patient,
  queueEntry,
  workspaceId,
}: {
  encounter: Record<string, unknown>;
  guardian?: Record<string, unknown>;
  includeCancelled: boolean;
  includeCompleted: boolean;
  operatingDate: string;
  patient?: Record<string, unknown>;
  queueEntry: Record<string, unknown>;
  workspaceId: string;
}): HomeOperationsWorkItem | null {
  const sourceId = getString(queueEntry.id);
  const encounterId = getString(encounter.id);
  const sourceStatus = getString(queueEntry.status) ?? "unknown";
  const requestedAt = getString(queueEntry.enteredAt);
  const queueType = getString(queueEntry.queueType) ?? "consultation";
  if (!sourceId || !encounterId || !requestedAt) return null;

  const encounterStatus = getString(encounter.status);
  const progressState = sourceStatus === "cancelled" || encounterStatus === "cancelled"
    ? "cancelled"
    : sourceStatus === "done" || encounterStatus === "completed" || encounterStatus === "ready_for_billing"
      ? "completed"
      : sourceStatus === "called" || sourceStatus === "in_progress" || encounterStatus === "in_consultation" || encounterStatus === "ordered"
        ? "in_progress"
        : "waiting";
  if (!shouldIncludeProgress(progressState, includeCompleted, includeCancelled)) return null;

  const sourceType = queueType === "billing"
    ? "billing"
    : queueType === "treatment"
      ? "treatment"
      : queueType === "reception"
        ? "reception"
        : "consultation";
  const teamQueueId = sourceType === "consultation" ? "consultation" : sourceType;
  const patientName = getString(patient?.name);

  return {
    id: `${sourceType}:${sourceId}`,
    workspaceId,
    sourceType,
    sourceId,
    sourceStatus,
    encounterId,
    patientId: getString(encounter.patientId),
    guardianId: getString(encounter.guardianId),
    title: getQueueFallbackTitle(sourceType, patientName),
    patientName,
    guardianName: getString(guardian?.name),
    progressState,
    attentionSignals: getFallbackAttentionSignals({
      priority: getString(queueEntry.priority),
      progressState,
      requestedAt,
      sourceStatus,
      teamQueueId,
      operatingDate,
    }),
    assigneeUserId: sourceType === "consultation" ? getString(encounter.primaryVeterinarianId) : undefined,
    requestedAt,
    stateEnteredAt: getString(queueEntry.finishedAt) ?? getString(queueEntry.calledAt) ?? requestedAt,
    operatingDate: toSeoulDate(requestedAt),
    sourceHref: getFallbackSourceHref({ encounterId, sourceType, workspaceId }),
    drawerSummary:
      getString(encounter.visitPurpose) ??
      getString(encounter.chiefComplaint) ??
      "접수 후 원내 대기 상태를 확인합니다.",
    permissionMode: "full",
    teamQueueId,
    teamQueueLabel: getFallbackTeamQueueLabel(sourceType),
  };
}

function mapFulfillmentFallbackItems(
  rows: unknown[],
  {
    includeCancelled,
    includeCompleted,
    operatingDate,
    workspaceId,
  }: {
    includeCancelled: boolean;
    includeCompleted: boolean;
    operatingDate: string;
    workspaceId: string;
  },
): HomeOperationsWorkItem[] {
  return rows
    .map((row) =>
      mapFulfillmentFallbackItem(row, {
        includeCancelled,
        includeCompleted,
        operatingDate,
        workspaceId,
      }),
    )
    .filter((item): item is HomeOperationsWorkItem => Boolean(item));
}

function mapFulfillmentFallbackItem(
  rowValue: unknown,
  {
    includeCancelled,
    includeCompleted,
    operatingDate,
    workspaceId,
  }: {
    includeCancelled: boolean;
    includeCompleted: boolean;
    operatingDate: string;
    workspaceId: string;
  },
): HomeOperationsWorkItem | null {
  if (!rowValue || typeof rowValue !== "object") return null;
  const row = rowValue as Record<string, unknown>;
  const sourceId = getString(row.id);
  const queueType = getSourceType(row.queue_type);
  const sourceStatus = getString(row.status) ?? "unknown";
  const requestedAt = getString(row.created_at);
  const encounterId = getString(row.encounter_id);
  if (!sourceId || !queueType || !requestedAt || !encounterId) return null;

  const progressState = sourceStatus === "completed"
    ? "completed"
    : sourceStatus === "cancelled"
      ? "cancelled"
      : sourceStatus === "in_progress"
        ? "in_progress"
        : "waiting";
  if (!shouldIncludeOperatingDate(progressState, requestedAt, operatingDate)) return null;
  if (!shouldIncludeProgress(progressState, includeCompleted, includeCancelled)) return null;

  const sourceSnapshot = getRecord(row.source_snapshot);
  const title =
    getString(sourceSnapshot?.orderDisplayName) ??
    getString(sourceSnapshot?.billingName) ??
    getFallbackFulfillmentTitle(queueType);

  return {
    id: `${queueType}:${sourceId}`,
    workspaceId,
    sourceType: queueType,
    sourceId,
    sourceStatus,
    encounterId,
    title,
    patientName: getString(sourceSnapshot?.patientName),
    guardianName: getString(sourceSnapshot?.guardianName),
    progressState,
    attentionSignals: getFallbackAttentionSignals({
      priority: getString(row.priority),
      progressState,
      requestedAt,
      sourceStatus,
      teamQueueId: queueType,
      operatingDate,
    }),
    assigneeUserId: getString(row.assigned_to_user_id),
    requestedAt,
    stateEnteredAt:
      getString(row.returned_at) ??
      getString(row.completed_at) ??
      getString(row.cancelled_at) ??
      getString(row.updated_at) ??
      requestedAt,
    operatingDate: toSeoulDate(requestedAt),
    sourceHref: getFallbackSourceHref({ encounterId, sourceType: queueType, workspaceId }),
    drawerSummary: getString(sourceSnapshot?.instruction) ?? "오더 기반 업무 상태를 확인합니다.",
    permissionMode: "full",
    teamQueueId: queueType,
    teamQueueLabel: getFallbackTeamQueueLabel(queueType),
  };
}

function getFallbackAttentionSignals({
  operatingDate,
  priority,
  progressState,
  requestedAt,
  sourceStatus,
  teamQueueId,
}: {
  operatingDate: string;
  priority?: string;
  progressState: HomeOperationsProgressState;
  requestedAt: string;
  sourceStatus: string;
  teamQueueId?: string;
}): HomeOperationsAttentionSignal[] {
  const signals: HomeOperationsAttentionSignal[] = [];
  if (priority === "urgent") signals.push("urgent");
  if (sourceStatus === "returned" || sourceStatus === "re_requested") signals.push("re_requested");
  if (teamQueueId) signals.push("team_queue");
  else signals.push("assignment_missing");
  if (progressState !== "completed" && progressState !== "cancelled" && toSeoulDate(requestedAt) < operatingDate) {
    signals.push("long_stay");
  }
  return signals;
}

function shouldIncludeProgress(
  progressState: HomeOperationsProgressState,
  includeCompleted: boolean,
  includeCancelled: boolean,
) {
  if (progressState === "completed" && !includeCompleted) return false;
  if (progressState === "cancelled" && !includeCancelled) return false;
  return true;
}

function shouldIncludeOperatingDate(
  progressState: HomeOperationsProgressState,
  requestedAt: string,
  operatingDate: string,
) {
  const sourceOperatingDate = toSeoulDate(requestedAt);
  if (sourceOperatingDate === operatingDate) return true;
  return (
    sourceOperatingDate < operatingDate &&
    progressState !== "completed" &&
    progressState !== "cancelled"
  );
}

function sortOperationsItems(items: HomeOperationsWorkItem[]) {
  return [...items].sort((first, second) => {
    const score = (item: HomeOperationsWorkItem) => {
      if (item.attentionSignals.includes("urgent")) return 0;
      if (item.attentionSignals.includes("re_requested")) return 1;
      if (item.attentionSignals.includes("assignment_missing")) return 2;
      if (item.progressState === "in_progress") return 3;
      if (item.progressState === "waiting") return 4;
      if (item.progressState === "completed") return 5;
      return 6;
    };
    return score(first) - score(second) || first.requestedAt.localeCompare(second.requestedAt);
  });
}

function deduplicateOperationsItems(items: HomeOperationsWorkItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function getQueueFallbackTitle(
  sourceType: HomeOperationsSourceType,
  patientName?: string,
) {
  const fallback = sourceType === "billing"
    ? "수납 대기"
    : sourceType === "treatment"
      ? "처치 대기"
      : sourceType === "reception"
        ? "접수 확인"
        : "진료 대기";
  return patientName ? `${patientName} ${fallback}` : fallback;
}

function getFallbackFulfillmentTitle(sourceType: HomeOperationsSourceType) {
  if (sourceType === "lab") return "임상병리 업무";
  if (sourceType === "imaging") return "영상 업무";
  if (sourceType === "dispensing") return "조제 업무";
  return "처치 업무";
}

function getFallbackTeamQueueLabel(sourceType: HomeOperationsSourceType) {
  if (sourceType === "appointment" || sourceType === "reception") return "접수팀 큐";
  if (sourceType === "consultation") return "진료 큐";
  if (sourceType === "lab") return "임상병리팀 큐";
  if (sourceType === "imaging") return "영상팀 큐";
  if (sourceType === "dispensing") return "조제팀 큐";
  if (sourceType === "billing") return "수납팀 큐";
  return "처치팀 큐";
}

function getFallbackSourceHref({
  encounterId,
  sourceType,
  workspaceId,
}: {
  encounterId: string;
  sourceType: HomeOperationsSourceType;
  workspaceId: string;
}) {
  if (sourceType === "lab") return `/w/${workspaceId}/lab?encounterId=${encounterId}&modulePanel=open`;
  if (sourceType === "imaging") return `/w/${workspaceId}/imaging?encounterId=${encounterId}&modulePanel=open`;
  if (sourceType === "dispensing" || sourceType === "treatment") {
    return `/w/${workspaceId}/dispensing?encounterId=${encounterId}&modulePanel=open`;
  }
  if (sourceType === "billing") return `/w/${workspaceId}/billing?encounterId=${encounterId}&modulePanel=open`;
  return `/w/${workspaceId}/treatment?encounterId=${encounterId}&modulePanel=open`;
}

function toSeoulDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Seoul",
    year: "numeric",
  });
  return formatter.format(date);
}

export function summarizeOperationsWorkItems(
  items: HomeOperationsWorkItem[],
): HomeOperationsSummary {
  const bySourceType = Object.fromEntries(
    sourceTypes.map((sourceType) => [sourceType, 0]),
  ) as Record<HomeOperationsSourceType, number>;
  const byProgressState = Object.fromEntries(
    progressStates.map((progressState) => [progressState, 0]),
  ) as Record<HomeOperationsProgressState, number>;
  const byAttentionSignal = Object.fromEntries(
    attentionSignals.map((attentionSignal) => [attentionSignal, 0]),
  ) as Record<HomeOperationsAttentionSignal, number>;
  const byAssignmentState = {
    assignmentMissing: 0,
    personal: 0,
    teamQueue: 0,
  };

  for (const item of items) {
    bySourceType[item.sourceType] += 1;
    byProgressState[item.progressState] += 1;
    for (const signal of item.attentionSignals) {
      byAttentionSignal[signal] += 1;
    }
    if (item.attentionSignals.includes("assignment_missing")) {
      byAssignmentState.assignmentMissing += 1;
    } else if (item.assigneeUserId) {
      byAssignmentState.personal += 1;
    } else if (item.teamQueueId) {
      byAssignmentState.teamQueue += 1;
    }
  }

  return {
    byAssignmentState,
    byAttentionSignal,
    byProgressState,
    bySourceType,
    cancelledCount: byProgressState.cancelled,
    completedCount: byProgressState.completed,
    mineCount: items.filter((item) => item.isMyWork).length,
    totalVisible: items.length,
  };
}

function mapRpcResponse(value: unknown): HomeOperationsGatewayResult {
  if (!value || typeof value !== "object") {
    return {
      ok: true,
      generatedAt: new Date().toISOString(),
      items: [],
      sourceStatus: "empty",
    };
  }

  const row = value as Record<string, unknown>;
  const items = Array.isArray(row.items)
    ? row.items.map(mapWorkItem).filter((item): item is HomeOperationsWorkItem => Boolean(item))
    : [];
  const sourceStatus = getSourceStatus(row.sourceStatus ?? row.source_status, items.length);

  return {
    ok: true,
    generatedAt: getString(row.generatedAt) ?? getString(row.generated_at) ?? new Date().toISOString(),
    items,
    sourceStatus,
  };
}

function mapWorkItem(value: unknown): HomeOperationsWorkItem | null {
  if (!value || typeof value !== "object") return null;

  const row = value as Record<string, unknown>;
  const id = getString(row.id);
  const workspaceId = getString(row.workspaceId) ?? getString(row.workspace_id);
  const sourceType = getSourceType(row.sourceType ?? row.source_type);
  const sourceId = getString(row.sourceId) ?? getString(row.source_id);
  const sourceStatus = getString(row.sourceStatus) ?? getString(row.source_status);
  const title = getString(row.title);
  const progressState = getProgressState(row.progressState ?? row.progress_state);
  const requestedAt = getString(row.requestedAt) ?? getString(row.requested_at);
  const operatingDate = getString(row.operatingDate) ?? getString(row.operating_date);
  const sourceHref = getString(row.sourceHref) ?? getString(row.source_href);

  if (
    !id ||
    !workspaceId ||
    !sourceType ||
    !sourceId ||
    !sourceStatus ||
    !title ||
    !progressState ||
    !requestedAt ||
    !operatingDate ||
    !sourceHref
  ) {
    return null;
  }

  return {
    id,
    workspaceId,
    sourceType,
    sourceId,
    sourceStatus,
    encounterId: getString(row.encounterId) ?? getString(row.encounter_id),
    patientId: getString(row.patientId) ?? getString(row.patient_id),
    guardianId: getString(row.guardianId) ?? getString(row.guardian_id),
    title,
    patientName: getString(row.patientName) ?? getString(row.patient_name),
    guardianName: getString(row.guardianName) ?? getString(row.guardian_name),
    progressState,
    attentionSignals: getAttentionSignals(row.attentionSignals ?? row.attention_signals),
    assigneeUserId: getString(row.assigneeUserId) ?? getString(row.assignee_user_id),
    assigneeName: getString(row.assigneeName) ?? getString(row.assignee_name),
    teamQueueId: getString(row.teamQueueId) ?? getString(row.team_queue_id),
    teamQueueLabel: getString(row.teamQueueLabel) ?? getString(row.team_queue_label),
    requestedAt,
    stateEnteredAt: getString(row.stateEnteredAt) ?? getString(row.state_entered_at),
    operatingDate,
    sourceHref,
    drawerSummary: getString(row.drawerSummary) ?? getString(row.drawer_summary),
    permissionMode: getPermissionMode(row.permissionMode ?? row.permission_mode),
  };
}

function isMyOperationsWorkItem({
  actorUserId,
  item,
  permissionAdapter,
  workspaceId,
}: {
  actorUserId: string | null;
  item: HomeOperationsWorkItem;
  permissionAdapter: WorkspacePermissionAdapter;
  workspaceId: string;
}) {
  if (!actorUserId) return false;
  if (item.assigneeUserId === actorUserId) return true;
  if (!item.teamQueueId || item.assigneeUserId) return false;

  const requiredPermission = getProcessPermissionForSource(item.sourceType);
  if (!requiredPermission) return false;

  const permission = resolveWorkspacePermission(permissionAdapter, {
    sessionUserId: actorUserId,
    workspaceId,
    requiredPermission,
  });
  return permission.allowed;
}

function getProcessPermissionForSource(
  sourceType: HomeOperationsSourceType,
): PermissionId | null {
  if (sourceType === "appointment" || sourceType === "reception") return "reception:view";
  if (sourceType === "consultation") return "chart:view";
  if (sourceType === "lab") return "lab:view";
  if (sourceType === "imaging") return "imaging:view";
  if (sourceType === "dispensing" || sourceType === "treatment") return "dispensing:view";
  if (sourceType === "billing") return "billing:view";
  return null;
}

function buildPermissionDeniedResponse({
  denialReason,
  operatingDate,
  workspaceId,
}: {
  denialReason?: WorkspacePermissionDenialReason;
  operatingDate: string;
  workspaceId: string;
}): HomeOperationsWorkItemReadResult {
  const status = denialReason === "unauthenticated" ? 401 : 403;
  return buildErrorResponse({
    code: denialReason ?? "permission_missing",
    message: "원내 현황을 볼 권한이 없습니다.",
    operatingDate,
    retryable: false,
    sourceStatus: "permission_denied",
    status,
    workspaceId,
  });
}

function buildErrorResponse({
  code,
  message,
  operatingDate,
  retryable,
  sourceStatus,
  status,
  workspaceId,
}: {
  code: string;
  message: string;
  operatingDate: string;
  retryable: boolean;
  sourceStatus: "error" | "permission_denied";
  status: 400 | 401 | 403 | 500;
  workspaceId: string;
}): HomeOperationsWorkItemReadResult {
  return {
    ok: false,
    status,
    workspaceId,
    operatingDate,
    sourceStatus,
    error: {
      code,
      message,
      retryable,
    },
  };
}

function normalizeOperatingDate(date: string | null | undefined, workspaceId: string) {
  if (!date) return getWorkspaceOperatingDate(workspaceId);
  return isIsoOperatingDate(date) ? date : null;
}

function normalizeScope(scope: string | null | undefined): HomeOperationsScope | null {
  if (!scope || scope === "all") return "all";
  if (scope === "mine") return "mine";
  return null;
}

function getSourceStatus(value: unknown, itemCount: number): "empty" | "live" | "partial" {
  if (value === "partial") return "partial";
  if (value === "live") return "live";
  if (value === "empty") return "empty";
  return itemCount > 0 ? "live" : "empty";
}

function getSourceType(value: unknown): HomeOperationsSourceType | null {
  return typeof value === "string" && sourceTypes.includes(value as HomeOperationsSourceType)
    ? (value as HomeOperationsSourceType)
    : null;
}

function getProgressState(value: unknown): HomeOperationsProgressState | null {
  return typeof value === "string" && progressStates.includes(value as HomeOperationsProgressState)
    ? (value as HomeOperationsProgressState)
    : null;
}

function getAttentionSignals(value: unknown): HomeOperationsAttentionSignal[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (signal): signal is HomeOperationsAttentionSignal =>
      typeof signal === "string" &&
      attentionSignals.includes(signal as HomeOperationsAttentionSignal),
  );
}

function getPermissionMode(value: unknown): HomeOperationsWorkItem["permissionMode"] {
  if (value === "hidden" || value === "redacted") return value;
  return "full";
}

function getString(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function getRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
