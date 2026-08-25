import {
  createMockWorkspacePermissionAdapter,
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";
import type {
  ClinicalOrderDestinationModule,
  ClinicalOrderType,
  UniversalOrderTaskStatus,
} from "@/types/emr-domain";

export type ChartOrderExecutionTask = {
  attemptNo: number;
  cancelledAt: string | null;
  clinicalOrderType: ClinicalOrderType;
  completedAt: string | null;
  createdAt: string;
  destinationModule: ClinicalOrderDestinationModule | null;
  effectiveSnapshot: Record<string, unknown>;
  orderId: string;
  parentTaskId: string | null;
  priority: "normal" | "urgent";
  reRequestedFromTaskId: string | null;
  resultSnapshot: Record<string, unknown> | null;
  startedAt: string | null;
  status: UniversalOrderTaskStatus;
  taskId: string;
  taskRole: "aggregate" | "execution";
  updatedAt: string;
};

export type ChartOrderExecutionTaskEvent = {
  actorUserId: string;
  afterValues: Record<string, unknown>;
  beforeValues: Record<string, unknown>;
  commandId: string | null;
  createdAt: string;
  eventId: string;
  eventType:
    | "created"
    | "started"
    | "paused"
    | "resumed"
    | "completed"
    | "cancelled"
    | "amended"
    | "re_requested"
    | "priority_changed";
  orderId: string;
  reason: string | null;
  taskAttemptNo: number;
  taskId: string;
};

export type ChartOrderExecutionRevision = {
  actorUserId: string | null;
  affectedTasks: unknown[];
  afterValues: Record<string, unknown>;
  beforeValues: Record<string, unknown>;
  billingImpact: Record<string, unknown>;
  changeType:
    | "legacy"
    | "amendment"
    | "cancellation"
    | "priority_change"
    | "billing_correction"
    | "re_request";
  completedAt: string | null;
  createdAt: string;
  orderId: string;
  reason: string | null;
  revisionId: string;
  revisionNo: number;
};

export type ChartOrderQueueProjection = {
  destinationModule: ClinicalOrderDestinationModule;
  orderId: string;
  queueStatus: string;
  queueType: string;
  taskAttemptNo: number;
  taskId: string;
  updatedAt: string;
  workItemId: string;
};

export type ChartOrderBillingCandidateLink = {
  amount: number;
  billingCandidateId: string;
  invoiceLineId: string | null;
  orderId: string;
  status: "candidate_created" | "invoice_linked" | "cancelled";
  taskAttemptNo: number;
  taskId: string;
  updatedAt: string;
};

export type ChartOrderExecutionReconciliation = {
  aggregateQueueCount: number;
  confirmedAtomicCount: number;
  destinationlessQueueCount: number;
  draftArtifactCount: number;
  duplicateBillingCandidateCount: number;
  duplicateQueueCount: number;
  duplicateTaskCount: number;
  executionTaskCount: number;
  missingTaskCount: number;
  orphanBillingCandidateCount: number;
  orphanQueueCount: number;
  orphanTaskCount: number;
};

export type ChartOrderExecutionReadModel = {
  billingCandidates: ChartOrderBillingCandidateLink[];
  encounterId: string;
  events: ChartOrderExecutionTaskEvent[];
  queues: ChartOrderQueueProjection[];
  reconciliation: ChartOrderExecutionReconciliation;
  revisions: ChartOrderExecutionRevision[];
  tasks: ChartOrderExecutionTask[];
  workspaceId: string;
};

export type ChartOrderExecutionReadGatewayResult =
  | { ok: true; execution: ChartOrderExecutionReadModel }
  | { ok: false; status: 409; denialReason: "encounter_unavailable" }
  | { ok: false; status: 500; error: "db_read_failed" };

export type ChartOrderExecutionReadGateway = {
  readExecution(input: {
    encounterId: string;
    workspaceId: string;
  }): Promise<ChartOrderExecutionReadGatewayResult>;
};

export type ChartOrderExecutionReadResult =
  | {
      enforcedBy: "chart-order-execution-read-model";
      execution: ChartOrderExecutionReadModel;
      ok: true;
      status: 200;
    }
  | {
      error: "invalid_input";
      fieldErrors: { encounterId: string };
      ok: false;
      status: 400;
    }
  | {
      denialReason: WorkspacePermissionDenialReason;
      ok: false;
      status: 401 | 403;
    }
  | { denialReason: "encounter_unavailable"; ok: false; status: 409 }
  | { error: "db_read_failed" | "supabase_client_missing"; ok: false; status: 500 };

export async function readChartOrderExecution({
  actorUserId,
  encounterId,
  gateway = createMockChartOrderExecutionReadGateway(),
  permissionAdapter = createDemoChartOrderExecutionReadPermissionAdapter(),
  workspaceId,
}: {
  actorUserId: string | null;
  encounterId?: string | null;
  gateway?: ChartOrderExecutionReadGateway;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<ChartOrderExecutionReadResult> {
  const normalizedEncounterId = trimToUndefined(encounterId);
  if (!normalizedEncounterId) {
    return {
      ok: false,
      status: 400,
      error: "invalid_input",
      fieldErrors: { encounterId: "진료 차트를 선택해 주세요." },
    };
  }

  const permission = resolveWorkspacePermission(permissionAdapter, {
    sessionUserId: actorUserId,
    workspaceId,
    requiredPermission: "chart:view",
  });
  if (!permission.allowed) {
    return {
      ok: false,
      status: permission.denialReason === "unauthenticated" ? 401 : 403,
      denialReason: permission.denialReason ?? "permission_missing",
    };
  }

  const result = await gateway.readExecution({
    encounterId: normalizedEncounterId,
    workspaceId,
  });
  if (!result.ok) return result;
  return {
    ok: true,
    status: 200,
    enforcedBy: "chart-order-execution-read-model",
    execution: result.execution,
  };
}

export type SupabaseChartOrderExecutionReadRpcClient = {
  rpc(
    functionName: "clair_get_chart_order_execution_read_model",
    args: { p_encounter_id: string; p_workspace_id: string },
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
};

export function createSupabaseChartOrderExecutionReadGateway(
  client: SupabaseChartOrderExecutionReadRpcClient,
): ChartOrderExecutionReadGateway {
  return {
    async readExecution({ encounterId, workspaceId }) {
      const { data, error } = await client.rpc(
        "clair_get_chart_order_execution_read_model",
        { p_encounter_id: encounterId, p_workspace_id: workspaceId },
      );
      if (error) {
        return error.message?.includes("encounter_unavailable")
          ? { ok: false, status: 409, denialReason: "encounter_unavailable" }
          : { ok: false, status: 500, error: "db_read_failed" };
      }
      const execution = mapChartOrderExecutionReadModel(data);
      return execution
        ? { ok: true, execution }
        : { ok: false, status: 500, error: "db_read_failed" };
    },
  };
}

export function createMockChartOrderExecutionReadGateway(
  execution?: ChartOrderExecutionReadModel,
): ChartOrderExecutionReadGateway {
  return {
    async readExecution({ encounterId, workspaceId }) {
      return {
        ok: true,
        execution:
          execution ??
          {
            workspaceId,
            encounterId,
            tasks: [],
            events: [],
            revisions: [],
            queues: [],
            billingCandidates: [],
            reconciliation: emptyReconciliation(),
          },
      };
    },
  };
}

export function createDemoChartOrderExecutionReadPermissionAdapter() {
  return createMockWorkspacePermissionAdapter({
    users: [
      { id: "playwright-default-session", status: "active" },
      { id: "user-admin", status: "active" },
      { id: "user-vet", status: "active" },
      { id: "user-tech", status: "active" },
      { id: "user-front-desk", status: "active" },
    ],
    memberships: [
      { id: "membership-playwright-admin", workspaceId: "clair-demo", userId: "playwright-default-session", roles: ["hospital_admin"], status: "active" },
      { id: "membership-admin", workspaceId: "clair-demo", userId: "user-admin", roles: ["hospital_admin"], status: "active" },
      { id: "membership-vet", workspaceId: "clair-demo", userId: "user-vet", roles: ["vet"], status: "active" },
      { id: "membership-tech", workspaceId: "clair-demo", userId: "user-tech", roles: ["technician"], status: "active" },
      { id: "membership-front-desk", workspaceId: "clair-demo", userId: "user-front-desk", roles: ["front_desk"], status: "active" },
    ],
  });
}

export function mapChartOrderExecutionReadModel(
  value: unknown,
): ChartOrderExecutionReadModel | null {
  const root = asRecord(value);
  if (!root || typeof root.workspaceId !== "string" || typeof root.encounterId !== "string") {
    return null;
  }
  const tasks = mapArray(root.tasks, mapTask);
  const events = mapArray(root.events, mapEvent);
  const revisions = mapArray(root.revisions, mapRevision);
  const queues = mapArray(root.queues, mapQueue);
  const billingCandidates = mapArray(root.billingCandidates, mapBillingCandidate);
  const reconciliation = mapReconciliation(root.reconciliation);
  if (!tasks || !events || !revisions || !queues || !billingCandidates || !reconciliation) {
    return null;
  }
  return {
    workspaceId: root.workspaceId,
    encounterId: root.encounterId,
    tasks,
    events,
    revisions,
    queues,
    billingCandidates,
    reconciliation,
  };
}

const taskStatuses = new Set<UniversalOrderTaskStatus>([
  "pending",
  "in_progress",
  "paused",
  "partial_complete",
  "complete",
  "cancelled",
]);
const clinicalOrderTypes = new Set<ClinicalOrderType>([
  "consultation",
  "clinical_lab",
  "imaging",
  "external_lab",
  "dispensing",
  "treatment",
  "hospitalization",
  "other",
]);
const destinations = new Set<ClinicalOrderDestinationModule>([
  "consultation",
  "lab",
  "imaging",
  "external_lab",
  "dispensing",
  "treatment",
  "hospitalization",
  "other",
]);

function mapTask(value: unknown): ChartOrderExecutionTask | null {
  const row = asRecord(value);
  if (
    !row || typeof row.taskId !== "string" || typeof row.orderId !== "string" ||
    (row.taskRole !== "execution" && row.taskRole !== "aggregate") ||
    !clinicalOrderTypes.has(row.clinicalOrderType as ClinicalOrderType) ||
    !taskStatuses.has(row.status as UniversalOrderTaskStatus) ||
    (row.priority !== "normal" && row.priority !== "urgent") ||
    !isPositiveInteger(row.attemptNo) || typeof row.createdAt !== "string" ||
    typeof row.updatedAt !== "string" || !asRecord(row.effectiveSnapshot)
  ) return null;
  const destination = row.destinationModule;
  if (destination !== null && !destinations.has(destination as ClinicalOrderDestinationModule)) return null;
  return {
    taskId: row.taskId,
    orderId: row.orderId,
    parentTaskId: nullableString(row.parentTaskId),
    taskRole: row.taskRole,
    clinicalOrderType: row.clinicalOrderType as ClinicalOrderType,
    destinationModule: destination as ClinicalOrderDestinationModule | null,
    status: row.status as UniversalOrderTaskStatus,
    priority: row.priority,
    attemptNo: row.attemptNo,
    reRequestedFromTaskId: nullableString(row.reRequestedFromTaskId),
    effectiveSnapshot: asRecord(row.effectiveSnapshot) ?? {},
    resultSnapshot: row.resultSnapshot === null ? null : asRecord(row.resultSnapshot),
    startedAt: nullableString(row.startedAt),
    completedAt: nullableString(row.completedAt),
    cancelledAt: nullableString(row.cancelledAt),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapEvent(value: unknown): ChartOrderExecutionTaskEvent | null {
  const row = asRecord(value);
  const eventTypes = new Set([
    "created", "started", "paused", "resumed", "completed", "cancelled",
    "amended", "re_requested", "priority_changed",
  ]);
  if (!row || typeof row.eventId !== "string" || typeof row.taskId !== "string" ||
      typeof row.orderId !== "string" || !isPositiveInteger(row.taskAttemptNo) ||
      typeof row.actorUserId !== "string" || !eventTypes.has(String(row.eventType)) ||
      typeof row.createdAt !== "string" || !asRecord(row.beforeValues) ||
      !asRecord(row.afterValues)) return null;
  return {
    eventId: row.eventId,
    taskId: row.taskId,
    taskAttemptNo: row.taskAttemptNo,
    orderId: row.orderId,
    eventType: row.eventType as ChartOrderExecutionTaskEvent["eventType"],
    actorUserId: row.actorUserId,
    reason: nullableString(row.reason),
    beforeValues: asRecord(row.beforeValues) ?? {},
    afterValues: asRecord(row.afterValues) ?? {},
    commandId: nullableString(row.commandId),
    createdAt: row.createdAt,
  };
}

function mapRevision(value: unknown): ChartOrderExecutionRevision | null {
  const row = asRecord(value);
  const changeTypes = new Set([
    "legacy", "amendment", "cancellation", "priority_change",
    "billing_correction", "re_request",
  ]);
  if (!row || typeof row.revisionId !== "string" || typeof row.orderId !== "string" ||
      !isPositiveInteger(row.revisionNo) || !changeTypes.has(String(row.changeType)) ||
      typeof row.createdAt !== "string" || !asRecord(row.beforeValues) ||
      !asRecord(row.afterValues) || !Array.isArray(row.affectedTasks) ||
      !asRecord(row.billingImpact)) return null;
  return {
    revisionId: row.revisionId,
    orderId: row.orderId,
    revisionNo: row.revisionNo,
    changeType: row.changeType as ChartOrderExecutionRevision["changeType"],
    reason: nullableString(row.reason),
    actorUserId: nullableString(row.actorUserId),
    beforeValues: asRecord(row.beforeValues) ?? {},
    afterValues: asRecord(row.afterValues) ?? {},
    affectedTasks: row.affectedTasks,
    billingImpact: asRecord(row.billingImpact) ?? {},
    createdAt: row.createdAt,
    completedAt: nullableString(row.completedAt),
  };
}

function mapQueue(value: unknown): ChartOrderQueueProjection | null {
  const row = asRecord(value);
  if (!row || typeof row.workItemId !== "string" || typeof row.orderId !== "string" ||
      typeof row.taskId !== "string" || !isPositiveInteger(row.taskAttemptNo) ||
      !destinations.has(row.destinationModule as ClinicalOrderDestinationModule) ||
      typeof row.queueType !== "string" || typeof row.queueStatus !== "string" ||
      typeof row.updatedAt !== "string") return null;
  return row as ChartOrderQueueProjection;
}

function mapBillingCandidate(value: unknown): ChartOrderBillingCandidateLink | null {
  const row = asRecord(value);
  if (!row || typeof row.billingCandidateId !== "string" || typeof row.orderId !== "string" ||
      typeof row.taskId !== "string" || !isPositiveInteger(row.taskAttemptNo) ||
      !["candidate_created", "invoice_linked", "cancelled"].includes(String(row.status)) ||
      typeof row.amount !== "number" || typeof row.updatedAt !== "string") return null;
  return {
    billingCandidateId: row.billingCandidateId,
    orderId: row.orderId,
    taskId: row.taskId,
    taskAttemptNo: row.taskAttemptNo,
    status: row.status as ChartOrderBillingCandidateLink["status"],
    amount: row.amount,
    invoiceLineId: nullableString(row.invoiceLineId),
    updatedAt: row.updatedAt,
  };
}

function mapReconciliation(value: unknown): ChartOrderExecutionReconciliation | null {
  const row = asRecord(value);
  if (!row) return null;
  const empty = emptyReconciliation();
  for (const key of Object.keys(empty) as Array<keyof ChartOrderExecutionReconciliation>) {
    if (!Number.isInteger(row[key]) || Number(row[key]) < 0) return null;
    empty[key] = Number(row[key]);
  }
  return empty;
}

function emptyReconciliation(): ChartOrderExecutionReconciliation {
  return {
    aggregateQueueCount: 0,
    confirmedAtomicCount: 0,
    destinationlessQueueCount: 0,
    draftArtifactCount: 0,
    duplicateBillingCandidateCount: 0,
    duplicateQueueCount: 0,
    duplicateTaskCount: 0,
    executionTaskCount: 0,
    missingTaskCount: 0,
    orphanBillingCandidateCount: 0,
    orphanQueueCount: 0,
    orphanTaskCount: 0,
  };
}

function mapArray<T>(value: unknown, mapper: (entry: unknown) => T | null): T[] | null {
  if (!Array.isArray(value)) return null;
  const mapped = value.map(mapper);
  return mapped.some((entry) => entry === null) ? null : (mapped as T[]);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function trimToUndefined(value?: string | null) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
