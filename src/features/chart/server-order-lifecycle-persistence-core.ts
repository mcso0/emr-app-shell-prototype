import {
  createMockWorkspacePermissionAdapter,
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";
import { mockEncounters, mockOrders } from "@/mocks/emr-domain";
import type { EmrOrder, Encounter } from "@/types/emr-domain";

export type ChartOrderLifecycleStatus = "requested" | "re_requested" | "in_progress" | "completed" | "cancelled";

export type ChartOrderLifecycleInput = {
  cancellationReason?: string;
  encounterId?: string;
  orderId?: string;
  status?: ChartOrderLifecycleStatus;
};

export type ChartOrderLifecycleLine = {
  cancellationReason?: string | null;
  encounterId: string;
  orderId: string;
  status: ChartOrderLifecycleStatus;
  updatedAt: string;
  updatedByUserId?: string | null;
};

export type ChartOrderLifecycleGatewayResult =
  | { ok: true; lifecycles: ChartOrderLifecycleLine[] }
  | { ok: false; status: 409; denialReason: "encounter_unavailable" | "order_unavailable" | "invalid_transition" }
  | { ok: false; status: 500; error: "db_read_failed" | "db_write_failed" };

export type ChartOrderLifecycleGateway = {
  readOrderLifecycles(input: {
    encounterId: string;
    workspaceId: string;
  }): Promise<ChartOrderLifecycleGatewayResult>;
  saveOrderLifecycleStatus(input: {
    actorUserId: string;
    cancellationReason?: string;
    encounterId: string;
    orderId: string;
    status: ChartOrderLifecycleStatus;
    workspaceId: string;
  }): Promise<ChartOrderLifecycleGatewayResult>;
};

export type ChartOrderLifecycleReadResult =
  | {
      ok: true;
      status: 200;
      lifecycles: ChartOrderLifecycleLine[];
      enforcedBy: "chart-order-lifecycle-persistence";
    }
  | { ok: false; status: 400; error: "invalid_input"; fieldErrors: Partial<Record<"encounterId", string>> }
  | { ok: false; status: 401 | 403; denialReason: WorkspacePermissionDenialReason }
  | { ok: false; status: 409; denialReason: "encounter_unavailable" | "order_unavailable" | "invalid_transition" }
  | { ok: false; status: 500; error: "db_read_failed" | "supabase_client_missing" };

export type ChartOrderLifecycleSaveResult =
  | {
      ok: true;
      status: 200;
      lifecycle: ChartOrderLifecycleLine;
      enforcedBy: "chart-order-lifecycle-persistence";
    }
  | {
      ok: false;
      status: 400;
      error: "invalid_input";
      fieldErrors: Partial<Record<"encounterId" | "orderId" | "status" | "cancellationReason", string>>;
    }
  | { ok: false; status: 401 | 403; denialReason: WorkspacePermissionDenialReason }
  | { ok: false; status: 409; denialReason: "encounter_unavailable" | "order_unavailable" | "invalid_transition" }
  | { ok: false; status: 500; error: "db_write_failed" | "supabase_client_missing" };

const mockOrderLifecycleStore = new Map<string, ChartOrderLifecycleLine[]>();
const lifecycleStatuses = new Set<ChartOrderLifecycleStatus>([
  "requested",
  "re_requested",
  "in_progress",
  "completed",
  "cancelled",
]);

export async function readChartOrderLifecycles({
  actorUserId,
  encounterId,
  gateway = createMockChartOrderLifecycleGateway(),
  permissionAdapter = createDemoChartOrderLifecyclePermissionAdapter(),
  workspaceId,
}: {
  actorUserId: string | null;
  encounterId: string | null | undefined;
  gateway?: Pick<ChartOrderLifecycleGateway, "readOrderLifecycles">;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<ChartOrderLifecycleReadResult> {
  const normalizedEncounterId = trimToUndefined(encounterId);
  if (!normalizedEncounterId) {
    return { ok: false, status: 400, error: "invalid_input", fieldErrors: { encounterId: "진료 차트를 선택해 주세요." } };
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

  const result = await gateway.readOrderLifecycles({ encounterId: normalizedEncounterId, workspaceId });
  if (!result.ok) {
    if (result.status === 409) return result;
    return { ok: false, status: 500, error: "db_read_failed" };
  }

  return { ok: true, status: 200, lifecycles: result.lifecycles, enforcedBy: "chart-order-lifecycle-persistence" };
}

export async function saveChartOrderLifecycleStatus({
  actorUserId,
  gateway = createMockChartOrderLifecycleGateway(),
  input,
  permissionAdapter = createDemoChartOrderLifecyclePermissionAdapter(),
  workspaceId,
}: {
  actorUserId: string | null;
  gateway?: Pick<ChartOrderLifecycleGateway, "saveOrderLifecycleStatus">;
  input: ChartOrderLifecycleInput;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<ChartOrderLifecycleSaveResult> {
  const normalized = normalizeLifecycleInput(input);
  const validation = validateLifecycleInput(normalized);
  if (!validation.valid) {
    return { ok: false, status: 400, error: "invalid_input", fieldErrors: validation.fieldErrors };
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

  const result = await gateway.saveOrderLifecycleStatus({
    actorUserId: actorUserId ?? "",
    cancellationReason: normalized.cancellationReason,
    encounterId: normalized.encounterId,
    orderId: normalized.orderId,
    status: normalized.status as ChartOrderLifecycleStatus,
    workspaceId,
  });
  if (!result.ok) {
    if (result.status === 409) return result;
    return { ok: false, status: 500, error: "db_write_failed" };
  }

  return {
    ok: true,
    status: 200,
    lifecycle: result.lifecycles[0],
    enforcedBy: "chart-order-lifecycle-persistence",
  };
}

export function createMockChartOrderLifecycleGateway(
  dataset: { encounters?: Encounter[]; orders?: EmrOrder[] } = { encounters: mockEncounters, orders: mockOrders },
  now = () => new Date().toISOString()
): ChartOrderLifecycleGateway {
  const encounters = dataset.encounters ?? [];
  const orders = dataset.orders ?? [];

  return {
    async readOrderLifecycles({ encounterId, workspaceId }) {
      if (!findEncounter(encounters, workspaceId, encounterId)) {
        return { ok: false, status: 409, denialReason: "encounter_unavailable" };
      }
      return { ok: true, lifecycles: getStoredOrSeedLifecycles({ encounterId, orders, workspaceId }) };
    },
    async saveOrderLifecycleStatus({ actorUserId, cancellationReason, encounterId, orderId, status, workspaceId }) {
      if (!findEncounter(encounters, workspaceId, encounterId)) {
        return { ok: false, status: 409, denialReason: "encounter_unavailable" };
      }
      const rows = getStoredOrSeedLifecycles({ encounterId, orders, workspaceId });
      const row = rows.find((item) => item.orderId === orderId);
      if (!row) return { ok: false, status: 409, denialReason: "order_unavailable" };
      if (!isAllowedTransition(row.status, status)) {
        return { ok: false, status: 409, denialReason: "invalid_transition" };
      }
      const nextRow: ChartOrderLifecycleLine = {
        ...row,
        cancellationReason: status === "cancelled" ? cancellationReason ?? "cancelled_by_user" : row.cancellationReason,
        status,
        updatedAt: now(),
        updatedByUserId: actorUserId,
      };
      const nextRows = rows.map((item) => item.orderId === orderId ? nextRow : item);
      mockOrderLifecycleStore.set(buildLifecycleKey(workspaceId, encounterId), nextRows);
      return { ok: true, lifecycles: [nextRow] };
    },
  };
}

export type SupabaseChartOrderLifecycleRpcClient = {
  rpc(functionName: "clair_get_chart_order_lifecycle", args: { p_workspace_id: string; p_encounter_id: string }): Promise<{ data: unknown; error: { message?: string } | null }>;
  rpc(functionName: "clair_save_chart_order_lifecycle", args: { p_workspace_id: string; p_actor_user_id: string; p_encounter_id: string; p_order_id?: string; p_status: ChartOrderLifecycleStatus; p_cancellation_reason?: string | null }): Promise<{ data: unknown; error: { message?: string } | null }>;
};

export function createSupabaseChartOrderLifecycleGateway(client: SupabaseChartOrderLifecycleRpcClient): ChartOrderLifecycleGateway {
  return {
    async readOrderLifecycles({ encounterId, workspaceId }) {
      const { data, error } = await client.rpc("clair_get_chart_order_lifecycle", { p_workspace_id: workspaceId, p_encounter_id: encounterId });
      if (error) return mapLifecycleError(error.message, "db_read_failed");
      return { ok: true, lifecycles: mapLifecycleRows(data) };
    },
    async saveOrderLifecycleStatus({ actorUserId, cancellationReason, encounterId, orderId, status, workspaceId }) {
      const { data, error } = await client.rpc("clair_save_chart_order_lifecycle", {
        p_workspace_id: workspaceId,
        p_actor_user_id: actorUserId,
        p_encounter_id: encounterId,
        p_order_id: normalizeUuidForRpc(orderId),
        p_status: status,
        p_cancellation_reason: cancellationReason ?? null,
      });
      if (error) return mapLifecycleError(error.message, "db_write_failed");
      return { ok: true, lifecycles: mapLifecycleRows(data) };
    },
  };
}

export function createDemoChartOrderLifecyclePermissionAdapter() {
  return createMockWorkspacePermissionAdapter({
    users: [
      { id: "playwright-default-session", status: "active" },
      { id: "user-admin", status: "active" },
      { id: "user-front-desk", status: "active" },
      { id: "user-vet", status: "active" },
      { id: "user-tech", status: "active" },
    ],
    memberships: [
      { id: "membership-playwright-admin", workspaceId: "clair-demo", userId: "playwright-default-session", roles: ["hospital_admin"], status: "active" },
      { id: "membership-admin", workspaceId: "clair-demo", userId: "user-admin", roles: ["hospital_admin"], status: "active" },
      { id: "membership-front-desk", workspaceId: "clair-demo", userId: "user-front-desk", roles: ["front_desk"], status: "active" },
      { id: "membership-vet", workspaceId: "clair-demo", userId: "user-vet", roles: ["vet"], status: "active" },
      { id: "membership-tech", workspaceId: "clair-demo", userId: "user-tech", roles: ["technician"], status: "active" },
    ],
  });
}

function getStoredOrSeedLifecycles({ encounterId, orders, workspaceId }: { encounterId: string; orders: EmrOrder[]; workspaceId: string }) {
  const stored = mockOrderLifecycleStore.get(buildLifecycleKey(workspaceId, encounterId));
  if (stored) return stored;
  return orders
    .filter((order) => order.workspaceId === workspaceId && order.encounterId === encounterId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((order) => ({
      cancellationReason: null,
      encounterId,
      orderId: order.id,
      status: order.status === "confirmed" ? "in_progress" : order.status,
      updatedAt: order.updatedAt,
      updatedByUserId: null,
    }) satisfies ChartOrderLifecycleLine);
}

function isAllowedTransition(current: ChartOrderLifecycleStatus, next: ChartOrderLifecycleStatus) {
  if (current === next) return true;
  if (current === "cancelled" || current === "completed") return false;
  if (next === "cancelled") return true;
  if (current === "requested" || current === "re_requested") return next === "in_progress";
  if (current === "in_progress") return next === "completed" || next === "re_requested";
  return false;
}

function normalizeLifecycleInput(input: ChartOrderLifecycleInput) {
  return {
    cancellationReason: trimToUndefined(input.cancellationReason),
    encounterId: trimToUndefined(input.encounterId) ?? "",
    orderId: trimToUndefined(input.orderId) ?? "",
    status: input.status && lifecycleStatuses.has(input.status) ? input.status : undefined,
  };
}

function validateLifecycleInput(input: ReturnType<typeof normalizeLifecycleInput>) {
  const fieldErrors: Partial<Record<"encounterId" | "orderId" | "status" | "cancellationReason", string>> = {};
  if (!input.encounterId) fieldErrors.encounterId = "진료 차트를 선택해 주세요.";
  if (!input.orderId) fieldErrors.orderId = "오더를 선택해 주세요.";
  if (!input.status) fieldErrors.status = "오더 상태를 선택해 주세요.";
  if (input.status === "cancelled" && !input.cancellationReason) {
    fieldErrors.cancellationReason = "취소 사유를 입력해 주세요.";
  }
  if (Object.keys(fieldErrors).length > 0) return { valid: false as const, fieldErrors };
  return { valid: true as const, fieldErrors: {} };
}

function findEncounter(encounters: Encounter[], workspaceId: string, encounterId: string) {
  return encounters.find((encounter) => encounter.id === encounterId && encounter.workspaceId === workspaceId && encounter.status !== "cancelled");
}

function buildLifecycleKey(workspaceId: string, encounterId: string) {
  return `${workspaceId}:${encounterId}`;
}

function trimToUndefined(value?: string | null) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeUuidForRpc(value?: string) {
  return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : undefined;
}

function mapLifecycleError(message: string | undefined, fallback: "db_read_failed" | "db_write_failed"): ChartOrderLifecycleGatewayResult {
  if (message?.includes("encounter_unavailable")) return { ok: false, status: 409, denialReason: "encounter_unavailable" };
  if (message?.includes("order_unavailable")) return { ok: false, status: 409, denialReason: "order_unavailable" };
  if (message?.includes("invalid_transition")) return { ok: false, status: 409, denialReason: "invalid_transition" };
  return { ok: false, status: 500, error: fallback };
}

function mapLifecycleRows(value: unknown): ChartOrderLifecycleLine[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is ChartOrderLifecycleLine => {
    const row = item as Partial<ChartOrderLifecycleLine>;
    return Boolean(row && typeof row.orderId === "string" && typeof row.encounterId === "string" && typeof row.status === "string" && typeof row.updatedAt === "string");
  });
}
