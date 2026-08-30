import {
  createMockWorkspacePermissionAdapter,
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";
import {
  mapChartOrderBillingSummary,
  type ChartOrderBillingSummary,
} from "@/features/chart/chart-order-billing-summary-contract";

type GatewayError =
  | "db_read_failed"
  | "db_write_failed"
  | "encounter_unavailable"
  | "billing_request_in_progress"
  | "idempotency_conflict"
  | "revision_conflict"
  | "unfinished_ack_required"
  | "no_billable_orders";

export type ChartOrderBillingSummaryGateway = {
  read(input: { encounterId: string; workspaceId: string }): Promise<
    | { ok: true; summary: ChartOrderBillingSummary }
    | { ok: false; error: GatewayError }
  >;
  requestBilling(input: {
    acknowledgeUnfinished: boolean;
    actorUserId: string;
    encounterId: string;
    expectedEtag: string;
    idempotencyKey: string;
    workspaceId: string;
  }): Promise<
    | { ok: true; summary: ChartOrderBillingSummary }
    | { ok: false; error: GatewayError }
  >;
};

type DeniedResult = {
  denialReason: WorkspacePermissionDenialReason;
  ok: false;
  status: 401 | 403;
};

export type ReadChartOrderBillingSummaryResult =
  | { enforcedBy: "chart-order-billing-summary"; ok: true; status: 200; summary: ChartOrderBillingSummary }
  | DeniedResult
  | { error: "invalid_input"; ok: false; status: 400 }
  | { error: "encounter_unavailable"; ok: false; status: 409 }
  | { error: "db_read_failed"; ok: false; status: 500 };

export type RequestChartOrderBillingResult =
  | { enforcedBy: "chart-order-billing-summary"; ok: true; status: 200; summary: ChartOrderBillingSummary }
  | DeniedResult
  | { error: "invalid_input"; ok: false; status: 400 }
  | { error: "revision_conflict" | "unfinished_ack_required" | "idempotency_conflict" | "billing_request_in_progress"; ok: false; status: 409 }
  | { error: "encounter_unavailable" | "no_billable_orders"; ok: false; status: 422 }
  | { error: "db_write_failed"; ok: false; status: 500 };

export async function readChartOrderBillingSummary({
  actorUserId,
  encounterId,
  gateway = createMockChartOrderBillingSummaryGateway(),
  permissionAdapter = createDemoPermissionAdapter(),
  workspaceId,
}: {
  actorUserId: string | null;
  encounterId?: string | null;
  gateway?: ChartOrderBillingSummaryGateway;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<ReadChartOrderBillingSummaryResult> {
  if (!encounterId?.trim()) return { ok: false, status: 400, error: "invalid_input" };
  const denial = requirePermission(permissionAdapter, actorUserId, workspaceId, "chart:view");
  if (denial) return denial;
  const result = await gateway.read({ encounterId: encounterId.trim(), workspaceId });
  if (result.ok) return { ok: true, status: 200, enforcedBy: "chart-order-billing-summary", summary: result.summary };
  return result.error === "encounter_unavailable"
    ? { ok: false, status: 409, error: result.error }
    : { ok: false, status: 500, error: "db_read_failed" };
}

export async function requestChartOrderBilling({
  acknowledgeUnfinished = false,
  actorUserId,
  encounterId,
  expectedEtag,
  idempotencyKey,
  gateway = createMockChartOrderBillingSummaryGateway(),
  permissionAdapter = createDemoPermissionAdapter(),
  workspaceId,
}: {
  acknowledgeUnfinished?: boolean;
  actorUserId: string | null;
  encounterId?: string | null;
  expectedEtag?: string | null;
  idempotencyKey?: string | null;
  gateway?: ChartOrderBillingSummaryGateway;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<RequestChartOrderBillingResult> {
  if (
    !encounterId?.trim() ||
    !expectedEtag?.trim() ||
    !idempotencyKey?.trim() ||
    idempotencyKey.trim().length < 8 ||
    idempotencyKey.trim().length > 160
  ) {
    return { ok: false, status: 400, error: "invalid_input" };
  }
  const denial = requirePermission(permissionAdapter, actorUserId, workspaceId, "chart:update");
  if (denial) return denial;
  const result = await gateway.requestBilling({
    acknowledgeUnfinished,
    actorUserId: actorUserId!,
    encounterId: encounterId.trim(),
    expectedEtag: expectedEtag.trim(),
    idempotencyKey: idempotencyKey.trim(),
    workspaceId,
  });
  if (result.ok) return { ok: true, status: 200, enforcedBy: "chart-order-billing-summary", summary: result.summary };
  if (
    result.error === "revision_conflict" ||
    result.error === "unfinished_ack_required" ||
    result.error === "idempotency_conflict" ||
    result.error === "billing_request_in_progress"
  ) {
    return { ok: false, status: 409, error: result.error };
  }
  if (result.error === "encounter_unavailable" || result.error === "no_billable_orders") {
    return { ok: false, status: 422, error: result.error };
  }
  return { ok: false, status: 500, error: "db_write_failed" };
}

export type SupabaseChartOrderBillingSummaryRpcClient = {
  rpc(functionName: "clair_get_chart_order_billing_summary", args: {
    p_encounter_id: string;
    p_workspace_id: string;
  }): Promise<{ data: unknown; error: { message?: string } | null }>;
  rpc(functionName: "clair_request_chart_order_billing", args: {
    p_acknowledge_unfinished: boolean;
    p_actor_user_id: string;
    p_encounter_id: string;
    p_expected_etag: string;
    p_idempotency_key: string;
    p_workspace_id: string;
  }): Promise<{ data: unknown; error: { message?: string } | null }>;
};

export function createSupabaseChartOrderBillingSummaryGateway(
  client: SupabaseChartOrderBillingSummaryRpcClient,
): ChartOrderBillingSummaryGateway {
  return {
    async read({ encounterId, workspaceId }) {
      const { data, error } = await client.rpc("clair_get_chart_order_billing_summary", {
        p_encounter_id: encounterId,
        p_workspace_id: workspaceId,
      });
      if (error) return { ok: false, error: mapDbError(error.message, "db_read_failed") };
      const summary = mapChartOrderBillingSummary(data);
      return summary ? { ok: true, summary } : { ok: false, error: "db_read_failed" };
    },
    async requestBilling(input) {
      const { data, error } = await client.rpc("clair_request_chart_order_billing", {
        p_acknowledge_unfinished: input.acknowledgeUnfinished,
        p_actor_user_id: input.actorUserId,
        p_encounter_id: input.encounterId,
        p_expected_etag: input.expectedEtag,
        p_idempotency_key: input.idempotencyKey,
        p_workspace_id: input.workspaceId,
      });
      if (error) return { ok: false, error: mapDbError(error.message, "db_write_failed") };
      const summary = mapChartOrderBillingSummary(data);
      return summary ? { ok: true, summary } : { ok: false, error: "db_write_failed" };
    },
  };
}

export function createMockChartOrderBillingSummaryGateway(
  initial?: ChartOrderBillingSummary,
): ChartOrderBillingSummaryGateway {
  let state = initial;
  const completed = new Map<
    string,
    { etag: string; summary: ChartOrderBillingSummary }
  >();
  return {
    async read({ encounterId, workspaceId }) {
      state ??= createEmptySummary(workspaceId, encounterId);
      return { ok: true, summary: state };
    },
    async requestBilling({ encounterId, expectedEtag, idempotencyKey, workspaceId }) {
      state ??= createEmptySummary(workspaceId, encounterId);
      const replay = completed.get(idempotencyKey);
      if (replay) return replay.etag === expectedEtag
        ? { ok: true, summary: replay.summary }
        : { ok: false, error: "idempotency_conflict" };
      if (state.etag !== expectedEtag) return { ok: false, error: "revision_conflict" };
      if (state.orderCounts.requestable === 0) return { ok: false, error: "no_billable_orders" };
      state = {
        ...state,
        etag: `\"mock-${Date.now()}\"`,
        generatedAt: new Date().toISOString(),
        invoiceId: state.invoiceId ?? "invoice-chart-order-demo",
        orderCounts: {
          ...state.orderCounts,
          requested: state.orderCounts.requested + state.orderCounts.requestable,
          requestable: 0,
        },
        amounts: { ...state.amounts, requestableTotal: 0 },
        requestableOrderIds: [],
      };
      completed.set(idempotencyKey, { etag: expectedEtag, summary: state });
      return { ok: true, summary: state };
    },
  };
}

function createEmptySummary(workspaceId: string, encounterId: string): ChartOrderBillingSummary {
  return {
    workspaceId,
    encounterId,
    etag: '"mock-empty"',
    generatedAt: new Date().toISOString(),
    currency: "KRW",
    context: null,
    invoiceId: null,
    orderCounts: { total: 0, confirmed: 0, draft: 0, recheck: 0, requested: 0, requestable: 0, cancelled: 0 },
    amounts: { gross: 0, confirmed: 0, draft: 0, discount: 0, surcharge: 0, tax: 0, paid: 0, outstanding: 0, estimatedTotal: 0, requestableTotal: 0 },
    requestableOrderIds: [],
    unfinishedOrders: [],
  };
}

function requirePermission(
  adapter: WorkspacePermissionAdapter,
  actorUserId: string | null,
  workspaceId: string,
  requiredPermission: "chart:view" | "chart:update",
): DeniedResult | null {
  const permission = resolveWorkspacePermission(adapter, {
    sessionUserId: actorUserId,
    workspaceId,
    requiredPermission,
  });
  return permission.allowed ? null : {
    ok: false,
    status: permission.denialReason === "unauthenticated" ? 401 : 403,
    denialReason: permission.denialReason ?? "permission_missing",
  };
}

function mapDbError(message: string | undefined, fallback: GatewayError): GatewayError {
  const known: GatewayError[] = [
    "encounter_unavailable", "revision_conflict", "unfinished_ack_required", "no_billable_orders",
    "idempotency_conflict", "billing_request_in_progress",
  ];
  return known.find((error) => message?.includes(error)) ?? fallback;
}

function createDemoPermissionAdapter() {
  return createMockWorkspacePermissionAdapter({
    users: [
      { id: "playwright-default-session", status: "active" },
      { id: "user-admin", status: "active" },
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
        id: "membership-vet",
        workspaceId: "clair-demo",
        userId: "user-vet",
        roles: ["vet"],
        status: "active",
      },
    ],
  });
}
