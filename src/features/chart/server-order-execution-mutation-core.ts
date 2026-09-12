import {
  createMockWorkspacePermissionAdapter,
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";
import {
  createMockChartOrderBillingSummaryFromMutationRows,
  mapChartOrderBillingSummary,
  type ChartOrderBillingSummary,
} from "@/features/chart/chart-order-billing-summary-contract";
import { getMockChartOrderDraftRuntimeRows } from "@/features/chart/server-order-draft-persistence-core";
import { getMockEncounterCharts } from "@/features/chart/server-soap-note-persistence-core";
import { mockEncounters, mockOrders } from "@/mocks/emr-domain";

export const chartOrderExecutionMutationActions = [
  "amend",
  "cancel",
  "priority_change",
  "re_request",
] as const;

export type ChartOrderExecutionMutationAction =
  (typeof chartOrderExecutionMutationActions)[number];

export type ChartOrderExecutionMutationInput = {
  chartId?: string;
  action?: ChartOrderExecutionMutationAction;
  changes?: Record<string, unknown>;
  expectedRevisionNo?: number;
  idempotencyKey?: string;
  orderId?: string;
  reason?: string;
};

export type ChartOrderExecutionMutationTaskEffect = {
  attemptNo?: number;
  effect?: string;
  orderId?: string;
  taskId?: string;
  [key: string]: unknown;
};

export type ChartOrderExecutionMutationResult = {
  action: ChartOrderExecutionMutationAction;
  affectedTasks: ChartOrderExecutionMutationTaskEffect[];
  billingImpact: Record<string, unknown>;
  confirmedSnapshotPreserved: boolean;
  order: Record<string, unknown>;
  orderId: string;
  orderRevisionId: string;
  revisionNo: number;
};

export type ChartOrderExecutionMutationDenialReason =
  | "order_chart_mismatch"
  | "chart_unavailable"
  | "chart_id_required"
  | "aggregate_direct_mutation_forbidden"
  | "amendment_requires_pending"
  | "actual_dispense_out_of_policy"
  | "actual_dispense_override_disabled"
  | "actual_dispense_reconfirmation_invalid"
  | "actual_dispense_reconfirmation_required"
  | "billing_quantity_calculation_incomplete"
  | "billing_review_required"
  | "billing_reversal_required"
  | "billing_candidate_locked"
  | "billing_candidate_unavailable"
  | "idempotency_conflict"
  | "order_unavailable"
  | "re_request_transition_invalid"
  | "revision_conflict"
  | "set_child_independent_mutation_forbidden"
  | "task_unavailable";

export type ChartOrderExecutionMutationGatewayResult =
  | {
      ok: true;
      billingSummary: ChartOrderBillingSummary;
      mutation: ChartOrderExecutionMutationResult;
    }
  | {
      ok: false;
      status: 403;
      denialReason: "actor_mismatch" | "permission_missing";
    }
  | {
      ok: false;
      status: 409;
      denialReason: ChartOrderExecutionMutationDenialReason;
    }
  | { ok: false; status: 500; error: "db_write_failed" | "invalid_rpc_result" };

export type ChartOrderExecutionMutationGateway = {
  mutateOrderExecution(input: {
    chartId?: string;
    action: ChartOrderExecutionMutationAction;
    actorUserId: string;
    changes: Record<string, unknown>;
    expectedRevisionNo: number;
    idempotencyKey: string;
    orderId: string;
    reason: string;
    workspaceId: string;
  }): Promise<ChartOrderExecutionMutationGatewayResult>;
};

type MutationField =
  | "action"
  | "changes"
  | "expectedRevisionNo"
  | "idempotencyKey"
  | "orderId"
  | "reason";

export type ChartOrderExecutionMutationSaveResult =
  | {
      ok: true;
      billingSummary: ChartOrderBillingSummary;
      status: 200;
      mutation: ChartOrderExecutionMutationResult;
      enforcedBy: "chart-order-execution-mutation";
    }
  | {
      ok: false;
      status: 400;
      error: "invalid_input";
      fieldErrors: Partial<Record<MutationField, string>>;
    }
  | { ok: false; status: 401 | 403; denialReason: WorkspacePermissionDenialReason }
  | {
      ok: false;
      status: 409;
      denialReason: ChartOrderExecutionMutationDenialReason;
    }
  | { ok: false; status: 500; error: "db_write_failed" | "invalid_rpc_result" };

const actionSet = new Set<string>(chartOrderExecutionMutationActions);

export async function mutateChartOrderExecution({
  actorUserId,
  gateway = createMockChartOrderExecutionMutationGateway(),
  input,
  permissionAdapter = createDemoChartOrderExecutionMutationPermissionAdapter(),
  workspaceId,
}: {
  actorUserId: string | null;
  gateway?: ChartOrderExecutionMutationGateway;
  input: ChartOrderExecutionMutationInput;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<ChartOrderExecutionMutationSaveResult> {
  const normalized = normalizeMutationInput(input);
  const validation = validateMutationInput(normalized);
  if (!validation.valid) {
    return {
      ok: false,
      status: 400,
      error: "invalid_input",
      fieldErrors: validation.fieldErrors,
    };
  }
  const validInput = normalized as {
    action: ChartOrderExecutionMutationAction;
    changes: Record<string, unknown>;
    expectedRevisionNo: number;
    idempotencyKey: string;
    orderId: string;
    reason: string;
  };

  const permission = resolveWorkspacePermission(permissionAdapter, {
    sessionUserId: actorUserId,
    workspaceId,
    requiredPermission: "order:update",
  });
  if (!permission.allowed) {
    return {
      ok: false,
      status: permission.denialReason === "unauthenticated" ? 401 : 403,
      denialReason: permission.denialReason ?? "permission_missing",
    };
  }

  const chartViewPermission = resolveWorkspacePermission(permissionAdapter, {
    sessionUserId: actorUserId,
    workspaceId,
    requiredPermission: "chart:view",
  });
  if (!chartViewPermission.allowed) {
    return {
      ok: false,
      status: chartViewPermission.denialReason === "unauthenticated" ? 401 : 403,
      denialReason: chartViewPermission.denialReason ?? "permission_missing",
    };
  }

  const result = await gateway.mutateOrderExecution({
    chartId: typeof input.chartId === "string" ? input.chartId.trim() || undefined : undefined,
    action: validInput.action,
    actorUserId: actorUserId ?? "",
    changes: validInput.changes,
    expectedRevisionNo: validInput.expectedRevisionNo,
    idempotencyKey: validInput.idempotencyKey,
    orderId: validInput.orderId,
    reason: validInput.reason,
    workspaceId,
  });
  if (!result.ok) {
    if (result.status === 403) {
      return { ok: false, status: 403, denialReason: "permission_missing" };
    }
    return result;
  }

  return {
    ok: true,
    billingSummary: result.billingSummary,
    status: 200,
    mutation: result.mutation,
    enforcedBy: "chart-order-execution-mutation",
  };
}

export type SupabaseChartOrderExecutionMutationRpcClient = {
  rpc(
    functionName: "clair_mutate_chart_order_execution" | "clair_mutate_chart_order_execution_for_chart",
    args: {
      p_chart_id?: string;
      p_action: ChartOrderExecutionMutationAction;
      p_actor_user_id: string;
      p_changes: Record<string, unknown>;
      p_expected_revision_no: number;
      p_idempotency_key: string;
      p_order_id: string;
      p_reason: string;
      p_workspace_id: string;
    }
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
};

export function createSupabaseChartOrderExecutionMutationGateway(
  client: SupabaseChartOrderExecutionMutationRpcClient
): ChartOrderExecutionMutationGateway {
  return {
    async mutateOrderExecution(input) {
      const { data, error } = await client.rpc(
        input.chartId ? "clair_mutate_chart_order_execution_for_chart" : "clair_mutate_chart_order_execution",
        {
          ...(input.chartId ? { p_chart_id: input.chartId } : {}),
          p_action: input.action,
          p_actor_user_id: input.actorUserId,
          p_changes: input.changes,
          p_expected_revision_no: input.expectedRevisionNo,
          p_idempotency_key: input.idempotencyKey,
          p_order_id: input.orderId,
          p_reason: input.reason,
          p_workspace_id: input.workspaceId,
        }
      );
      if (error) return mapMutationError(error.message);
      const mutation = mapMutationResult(data);
      const billingSummary = isPlainObject(data)
        ? mapChartOrderBillingSummary(data.billingSummary)
        : null;
      return mutation && billingSummary
        ? { ok: true, billingSummary, mutation }
        : { ok: false, status: 500, error: "invalid_rpc_result" };
    },
  };
}

export function createMockChartOrderExecutionMutationGateway(
  now = () => new Date().toISOString()
): ChartOrderExecutionMutationGateway {
  const requests = new Map<
    string,
    { request: string; result: ChartOrderExecutionMutationResult }
  >();

  return {
    async mutateOrderExecution(input) {
      const runtime = mockEncounters.filter((encounter) => encounter.workspaceId === input.workspaceId)
        .flatMap((encounter) => getMockChartOrderDraftRuntimeRows({ workspaceId: input.workspaceId, encounterId: encounter.id }) ?? [])
        .find((row) => row.orderId === input.orderId);
      const seeded = mockOrders.find((row) => row.workspaceId === input.workspaceId && row.id === input.orderId);
      const origin = runtime?.originChartId ?? seeded?.originChartId ?? null;
      if (origin !== (input.chartId ?? null)) return { ok: false, status: 409, denialReason: "order_chart_mismatch" };
      if (input.chartId && !getMockEncounterCharts(input.workspaceId, runtime?.encounterId ?? seeded?.encounterId ?? "").some((chart) => chart.id === input.chartId)) {
        return { ok: false, status: 409, denialReason: "chart_unavailable" };
      }
      const key = `${input.workspaceId}:${input.idempotencyKey}`;
      const request = JSON.stringify({
        chartId: input.chartId,
        action: input.action,
        changes: input.changes,
        expectedRevisionNo: input.expectedRevisionNo,
        orderId: input.orderId,
        reason: input.reason,
      });
      const existing = requests.get(key);
      if (existing) {
        return existing.request === request
          ? {
              ok: true,
              billingSummary: buildMockExecutionBillingSummary(
                input.workspaceId,
                input.orderId,
                existing.result,
                now(),
              ),
              mutation: existing.result,
            }
          : { ok: false, status: 409, denialReason: "idempotency_conflict" };
      }

      const mutation: ChartOrderExecutionMutationResult = {
        action: input.action,
        affectedTasks: [
          {
            attemptNo: input.action === "re_request" ? 2 : 1,
            effect: `${input.action}_applied`,
            orderId: input.orderId,
            taskId: `mock-task-${input.orderId}`,
          },
        ],
        billingImpact: {},
        confirmedSnapshotPreserved: input.action !== "re_request",
        order: {
          orderStatus: input.action === "cancel" ? "cancelled" : "confirmed",
          revisionNo: input.expectedRevisionNo + 1,
          updatedAt: now(),
        },
        orderId: input.orderId,
        orderRevisionId: `mock-revision-${input.idempotencyKey}`,
        revisionNo: input.expectedRevisionNo + 1,
      };
      requests.set(key, { request, result: mutation });
      return {
        ok: true,
        billingSummary: buildMockExecutionBillingSummary(
          input.workspaceId,
          input.orderId,
          mutation,
          now(),
        ),
        mutation,
      };
    },
  };
}

export function createDemoChartOrderExecutionMutationPermissionAdapter() {
  return createMockWorkspacePermissionAdapter({
    users: [
      { id: "playwright-default-session", status: "active" },
      { id: "user-admin", status: "active" },
      { id: "user-front-desk", status: "active" },
      { id: "user-vet", status: "active" },
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

function normalizeMutationInput(input: ChartOrderExecutionMutationInput) {
  return {
    action: typeof input.action === "string" && actionSet.has(input.action)
      ? input.action as ChartOrderExecutionMutationAction
      : undefined,
    changes: isPlainObject(input.changes) ? input.changes : undefined,
    expectedRevisionNo: input.expectedRevisionNo,
    idempotencyKey: trimToUndefined(input.idempotencyKey),
    orderId: trimToUndefined(input.orderId),
    reason: trimToUndefined(input.reason),
  };
}

function validateMutationInput(input: ReturnType<typeof normalizeMutationInput>) {
  const fieldErrors: Partial<Record<MutationField, string>> = {};
  if (!input.action) fieldErrors.action = "정정 작업을 선택해 주세요.";
  if (!input.orderId) fieldErrors.orderId = "오더를 선택해 주세요.";
  if (!Number.isInteger(input.expectedRevisionNo) || (input.expectedRevisionNo ?? -1) < 0) {
    fieldErrors.expectedRevisionNo = "현재 오더 revision을 확인해 주세요.";
  }
  if (!input.idempotencyKey || input.idempotencyKey.length < 8 || input.idempotencyKey.length > 160) {
    fieldErrors.idempotencyKey = "유효한 멱등 키가 필요합니다.";
  }
  if (!input.reason || input.reason.length < 3 || input.reason.length > 500) {
    fieldErrors.reason = "사유를 3자 이상 500자 이하로 입력해 주세요.";
  }
  if (!input.changes) {
    fieldErrors.changes = "변경 값은 객체여야 합니다.";
  } else if (input.action) {
    validateActionChanges(input.action, input.changes, fieldErrors);
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { valid: false as const, fieldErrors };
  }
  return {
    valid: true as const,
    fieldErrors: {},
    action: input.action as ChartOrderExecutionMutationAction,
  };
}

function validateActionChanges(
  action: ChartOrderExecutionMutationAction,
  changes: Record<string, unknown>,
  fieldErrors: Partial<Record<MutationField, string>>
) {
  const keys = Object.keys(changes);
  const allowed = action === "amend"
    ? new Set(["detailInputs", "detailSchemaVersion"])
    : action === "priority_change"
      ? new Set(["priority"])
      : action === "re_request"
          ? new Set([
              "detailInputs",
              "detailSchemaVersion",
              "priority",
              "actualDispenseQuantity",
            ])
          : new Set<string>();
  if (keys.some((key) => !allowed.has(key))) {
    fieldErrors.changes = "허용되지 않은 변경 필드가 포함되어 있습니다.";
    return;
  }
  if (action === "cancel" && keys.length > 0) {
    fieldErrors.changes = "취소는 별도 변경 값을 받지 않습니다.";
  }
  if (action === "amend" && keys.length === 0) {
    fieldErrors.changes = "정정할 값을 입력해 주세요.";
  }
  if (action === "priority_change" && !["normal", "urgent"].includes(String(changes.priority))) {
    fieldErrors.changes = "우선순위는 normal 또는 urgent여야 합니다.";
  }
  if (
    action === "re_request" &&
    changes.actualDispenseQuantity !== undefined &&
    (typeof changes.actualDispenseQuantity !== "number" ||
      !Number.isFinite(changes.actualDispenseQuantity) ||
      changes.actualDispenseQuantity <= 0)
  ) {
    fieldErrors.changes = "실조제량은 0보다 큰 숫자여야 합니다.";
  }
}

function mapMutationResult(value: unknown): ChartOrderExecutionMutationResult | null {
  if (!isPlainObject(value)) return null;
  const action = value.action;
  if (typeof action !== "string" || !actionSet.has(action)
    || !Array.isArray(value.affectedTasks)
    || !isPlainObject(value.billingImpact)
    || typeof value.confirmedSnapshotPreserved !== "boolean"
    || !isPlainObject(value.order)
    || typeof value.orderId !== "string"
    || typeof value.orderRevisionId !== "string"
    || typeof value.revisionNo !== "number") {
    return null;
  }
  return {
    action: action as ChartOrderExecutionMutationAction,
    affectedTasks: value.affectedTasks.filter(isPlainObject),
    billingImpact: value.billingImpact,
    confirmedSnapshotPreserved: value.confirmedSnapshotPreserved,
    order: value.order,
    orderId: value.orderId,
    orderRevisionId: value.orderRevisionId,
    revisionNo: value.revisionNo,
  };
}

function buildMockExecutionBillingSummary(
  workspaceId: string,
  orderId: string,
  mutation: ChartOrderExecutionMutationResult,
  generatedAt: string,
) {
  const encounterId = mockOrders.find(
    (order) => order.workspaceId === workspaceId && order.id === orderId,
  )?.encounterId ?? `encounter-${orderId}`;
  return createMockChartOrderBillingSummaryFromMutationRows({
    encounterId,
    etag: `"mock-execution-${mutation.revisionNo}"`,
    generatedAt,
    rows: [
      {
        orderConfirmationStatus: "confirmed",
        orderId,
        rowType: "individual",
        status: mutation.order.orderStatus === "cancelled" ? "cancelled" : "confirmed",
      },
    ],
    workspaceId,
  });
}

function mapMutationError(message?: string): ChartOrderExecutionMutationGatewayResult {
  if (message?.includes("actor_mismatch")) {
    return { ok: false, status: 403, denialReason: "actor_mismatch" };
  }
  if (message?.includes("permission_missing")) {
    return { ok: false, status: 403, denialReason: "permission_missing" };
  }
  const reasons: ChartOrderExecutionMutationDenialReason[] = [
    "order_chart_mismatch", "chart_unavailable", "chart_id_required",
    "aggregate_direct_mutation_forbidden",
    "amendment_requires_pending",
    "actual_dispense_out_of_policy",
    "actual_dispense_override_disabled",
    "actual_dispense_reconfirmation_invalid",
    "actual_dispense_reconfirmation_required",
    "billing_quantity_calculation_incomplete",
    "billing_review_required",
    "billing_reversal_required",
    "billing_candidate_locked",
    "billing_candidate_unavailable",
    "idempotency_conflict",
    "order_unavailable",
    "re_request_transition_invalid",
    "revision_conflict",
    "set_child_independent_mutation_forbidden",
    "task_unavailable",
  ];
  const denialReason = reasons.find((reason) => message?.includes(reason));
  return denialReason
    ? { ok: false, status: 409, denialReason }
    : { ok: false, status: 500, error: "db_write_failed" };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function trimToUndefined(value?: string | null) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
