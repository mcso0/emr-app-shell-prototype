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
    functionName: "clair_list_home_operations_work_items",
    args: {
      p_actor_user_id: string;
      p_include_cancelled: boolean;
      p_include_completed: boolean;
      p_operating_date: string;
      p_scope: HomeOperationsScope;
      p_workspace_id: string;
    },
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
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

      if (error) return { ok: false, error: "db_read_failed", retryable: true };
      return mapRpcResponse(data);
    },
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
