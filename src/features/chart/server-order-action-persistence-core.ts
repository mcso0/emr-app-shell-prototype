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
  createMockFulfillmentWorkItemGateway,
  type FulfillmentWorkItem,
  type FulfillmentWorkItemGateway,
} from "@/features/fulfillment/server-fulfillment-work-item-core";
import { mockEncounters, mockOrders } from "@/mocks/emr-domain";
import type { EmrOrder, Encounter } from "@/types/emr-domain";

export type ChartOrderActionKind = "bill" | "confirm";

export type ChartOrderActionInput = {
  action?: ChartOrderActionKind;
  encounterId?: string;
  orderIds?: string[];
};

export type ChartOrderActionLine = {
  billingCandidateId?: string | null;
  billingCandidateStatus: "not_requested" | "candidate_created" | "invoice_linked" | "billing_cancelled";
  confirmedAt?: string | null;
  confirmedByUserId?: string | null;
  encounterId: string;
  orderConfirmationStatus: "draft" | "pending" | "confirmed" | "billed" | "cancelled";
  orderId: string;
  status: "requested" | "re_requested" | "in_progress" | "confirmed" | "completed" | "cancelled";
  updatedAt: string;
};

export type ChartOrderActionGatewayResult =
  | { ok: true; orderActions: ChartOrderActionLine[] }
  | { ok: false; status: 409; denialReason: "encounter_unavailable" | "order_unavailable" }
  | { ok: false; status: 500; error: "db_read_failed" | "db_write_failed" };

export type ChartOrderActionGateway = {
  readOrderActions(input: {
    encounterId: string;
    workspaceId: string;
  }): Promise<ChartOrderActionGatewayResult>;
  saveOrderAction(input: {
    action: ChartOrderActionKind;
    actorUserId: string;
    encounterId: string;
    orderIds: string[];
    workspaceId: string;
  }): Promise<ChartOrderActionGatewayResult>;
};

export type ChartOrderActionReadResult =
  | {
      ok: true;
      status: 200;
      orderActions: ChartOrderActionLine[];
      enforcedBy: "chart-order-action-persistence";
    }
  | {
      ok: false;
      status: 400;
      error: "invalid_input";
      fieldErrors: Partial<Record<"encounterId", string>>;
    }
  | { ok: false; status: 401 | 403; denialReason: WorkspacePermissionDenialReason }
  | { ok: false; status: 409; denialReason: "encounter_unavailable" | "order_unavailable" }
  | { ok: false; status: 500; error: "db_read_failed" | "supabase_client_missing" };

export type ChartOrderActionSaveResult =
  | {
      ok: true;
      status: 200;
      orderActions: ChartOrderActionLine[];
      fulfillmentWorkItems?: FulfillmentWorkItem[];
      enforcedBy: "chart-order-action-persistence";
    }
  | {
      ok: false;
      status: 400;
      error: "invalid_input";
      fieldErrors: Partial<Record<"action" | "encounterId" | "orderIds", string>>;
    }
  | { ok: false; status: 401 | 403; denialReason: WorkspacePermissionDenialReason }
  | {
      ok: false;
      status: 409;
      denialReason:
        | "encounter_unavailable"
        | "invalid_transition"
        | "order_unavailable"
        | "unsupported_order_type"
        | "work_item_unavailable";
    }
  | { ok: false; status: 500; error: "db_write_failed" | "supabase_client_missing" };

const mockOrderActionStore = new Map<string, ChartOrderActionLine[]>();

export async function readChartOrderActions({
  actorUserId,
  encounterId,
  gateway = createMockChartOrderActionGateway(),
  permissionAdapter = createDemoChartOrderActionPermissionAdapter(),
  workspaceId,
}: {
  actorUserId: string | null;
  encounterId: string | null | undefined;
  gateway?: Pick<ChartOrderActionGateway, "readOrderActions">;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<ChartOrderActionReadResult> {
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

  const result = await gateway.readOrderActions({ encounterId: normalizedEncounterId, workspaceId });

  if (!result.ok) {
    if (result.status === 409) return result;
    return { ok: false, status: 500, error: "db_read_failed" };
  }

  return {
    ok: true,
    status: 200,
    orderActions: result.orderActions,
    enforcedBy: "chart-order-action-persistence",
  };
}

export async function saveChartOrderAction({
  actorUserId,
  auditGateway,
  auditNow,
  auditRequestId,
  fulfillmentGateway = createMockFulfillmentWorkItemGateway(),
  gateway = createMockChartOrderActionGateway(),
  input,
  permissionAdapter = createDemoChartOrderActionPermissionAdapter(),
  workspaceId,
}: {
  actorUserId: string | null;
  auditGateway?: LiveMutationAuditOptions["auditGateway"];
  auditNow?: LiveMutationAuditOptions["auditNow"];
  auditRequestId?: LiveMutationAuditOptions["auditRequestId"];
  fulfillmentGateway?: Pick<FulfillmentWorkItemGateway, "syncFromOrders">;
  gateway?: Pick<ChartOrderActionGateway, "saveOrderAction">;
  input: ChartOrderActionInput;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<ChartOrderActionSaveResult> {
  const normalized = normalizeOrderActionInput(input);
  const validation = validateOrderActionInput(normalized);

  if (!validation.valid) {
    return {
      ok: false,
      status: 400,
      error: "invalid_input",
      fieldErrors: validation.fieldErrors,
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

  const result = await gateway.saveOrderAction({
    action: normalized.action as ChartOrderActionKind,
    actorUserId: actorUserId ?? "",
    encounterId: normalized.encounterId,
    orderIds: normalized.orderIds,
    workspaceId,
  });

  if (!result.ok) {
    if (result.status === 409) return result;
    return { ok: false, status: 500, error: "db_write_failed" };
  }

  const fulfillmentResult = normalized.action === "confirm"
    ? await fulfillmentGateway.syncFromOrders({
        actorUserId: actorUserId ?? "",
        encounterId: normalized.encounterId,
        orderIds: result.orderActions.map((row) => row.orderId),
        workspaceId,
      })
    : null;

  if (fulfillmentResult && !fulfillmentResult.ok) {
    if (fulfillmentResult.status === 409) return fulfillmentResult;
    return { ok: false, status: 500, error: "db_write_failed" };
  }

  for (const row of result.orderActions) {
    const audit = await emitLiveMutationAuditEvent({
      auditGateway,
      auditNow,
      input: {
        workspaceId,
        actorUserId,
        eventType: normalized.action === "confirm" ? "order.confirmed" : "order.billing_candidate_requested",
        targetType: "order",
        targetId: row.orderId,
        encounterId: normalized.encounterId,
        requestId: auditRequestId,
        after: {
          billingCandidateStatus: row.billingCandidateStatus,
          orderConfirmationStatus: row.orderConfirmationStatus,
          status: row.status,
        },
        metadata: {
          action: normalized.action,
          source: "chart-order-action-persistence",
        },
      },
    });
    if (!audit.ok) return { ok: false, status: 500, error: "db_write_failed" };
  }

  return {
    ok: true,
    status: 200,
    orderActions: result.orderActions,
    fulfillmentWorkItems: fulfillmentResult?.workItems,
    enforcedBy: "chart-order-action-persistence",
  };
}

export function createMockChartOrderActionGateway(
  dataset: {
    encounters?: Encounter[];
    orders?: EmrOrder[];
  } = {
    encounters: mockEncounters,
    orders: mockOrders,
  },
  now = () => new Date().toISOString()
): ChartOrderActionGateway {
  const encounters = dataset.encounters ?? [];
  const orders = dataset.orders ?? [];

  return {
    async readOrderActions({ encounterId, workspaceId }) {
      const encounter = findEncounter(encounters, workspaceId, encounterId);
      if (!encounter) return { ok: false, status: 409, denialReason: "encounter_unavailable" };

      return {
        ok: true,
        orderActions: getStoredOrSeedOrderActions({ encounterId, orders, workspaceId }),
      };
    },
    async saveOrderAction({ action, actorUserId, encounterId, orderIds, workspaceId }) {
      const encounter = findEncounter(encounters, workspaceId, encounterId);
      if (!encounter) return { ok: false, status: 409, denialReason: "encounter_unavailable" };

      const seedRows = getStoredOrSeedOrderActions({ encounterId, orders, workspaceId });
      const selected = new Set(orderIds);
      if (orderIds.some((orderId) => !seedRows.some((row) => row.orderId === orderId))) {
        return { ok: false, status: 409, denialReason: "order_unavailable" };
      }

      const timestamp = now();
      const rows = seedRows.map((row) => {
        if (!selected.has(row.orderId)) return row;

        if (action === "confirm") {
          return {
            ...row,
            confirmedAt: timestamp,
            confirmedByUserId: actorUserId,
            orderConfirmationStatus: "confirmed" as const,
            status: "confirmed" as const,
            updatedAt: timestamp,
          };
        }

        return {
          ...row,
          billingCandidateId: row.billingCandidateId ?? `billcand-${row.orderId}`,
          billingCandidateStatus: "candidate_created" as const,
          updatedAt: timestamp,
        };
      });

      mockOrderActionStore.set(buildOrderActionKey(workspaceId, encounterId), rows);

      return { ok: true, orderActions: rows.filter((row) => selected.has(row.orderId)) };
    },
  };
}

export type SupabaseChartOrderActionRpcClient = {
  rpc(
    functionName: "clair_get_chart_order_actions",
    args: {
      p_workspace_id: string;
      p_encounter_id: string;
    }
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
  rpc(
    functionName: "clair_save_chart_order_action",
    args: {
      p_workspace_id: string;
      p_actor_user_id: string;
      p_encounter_id: string;
      p_action: ChartOrderActionKind;
      p_order_ids: string[];
    }
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
};

export function createSupabaseChartOrderActionGateway(
  client: SupabaseChartOrderActionRpcClient
): ChartOrderActionGateway {
  return {
    async readOrderActions({ encounterId, workspaceId }) {
      const { data, error } = await client.rpc("clair_get_chart_order_actions", {
        p_workspace_id: workspaceId,
        p_encounter_id: encounterId,
      });

      if (error) {
        if (error.message?.includes("encounter_unavailable")) {
          return { ok: false, status: 409, denialReason: "encounter_unavailable" };
        }
        return { ok: false, status: 500, error: "db_read_failed" };
      }

      return { ok: true, orderActions: mapOrderActionRows(data) };
    },
    async saveOrderAction({ action, actorUserId, encounterId, orderIds, workspaceId }) {
      const { data, error } = await client.rpc("clair_save_chart_order_action", {
        p_workspace_id: workspaceId,
        p_actor_user_id: actorUserId,
        p_encounter_id: encounterId,
        p_action: action,
        p_order_ids: orderIds.map(normalizeUuidForRpc).filter((orderId): orderId is string => Boolean(orderId)),
      });

      if (error) {
        if (error.message?.includes("encounter_unavailable")) {
          return { ok: false, status: 409, denialReason: "encounter_unavailable" };
        }
        if (error.message?.includes("order_unavailable")) {
          return { ok: false, status: 409, denialReason: "order_unavailable" };
        }
        return { ok: false, status: 500, error: "db_write_failed" };
      }

      return { ok: true, orderActions: mapOrderActionRows(data) };
    },
  };
}

export function createDemoChartOrderActionPermissionAdapter() {
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

function findEncounter(encounters: Encounter[], workspaceId: string, encounterId: string) {
  return encounters.find(
    (encounter) =>
      encounter.id === encounterId &&
      encounter.workspaceId === workspaceId &&
      encounter.status !== "cancelled"
  );
}

function getStoredOrSeedOrderActions({
  encounterId,
  orders,
  workspaceId,
}: {
  encounterId: string;
  orders: EmrOrder[];
  workspaceId: string;
}) {
  const stored = mockOrderActionStore.get(buildOrderActionKey(workspaceId, encounterId));
  if (stored) return stored;

  return orders
    .filter((order) => order.workspaceId === workspaceId && order.encounterId === encounterId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((order) => ({
      billingCandidateId: null,
      billingCandidateStatus: "not_requested",
      confirmedAt: null,
      confirmedByUserId: null,
      encounterId,
      orderConfirmationStatus: order.status === "completed" ? "confirmed" : "draft",
      orderId: order.id,
      status: order.status,
      updatedAt: order.updatedAt,
    }) satisfies ChartOrderActionLine);
}

function buildOrderActionKey(workspaceId: string, encounterId: string) {
  return `${workspaceId}:${encounterId}`;
}

function normalizeOrderActionInput(input: ChartOrderActionInput) {
  return {
    action: input.action === "bill" || input.action === "confirm" ? input.action : undefined,
    encounterId: trimToUndefined(input.encounterId) ?? "",
    orderIds: Array.isArray(input.orderIds)
      ? Array.from(new Set(input.orderIds.map(trimToUndefined).filter((orderId): orderId is string => Boolean(orderId))))
      : [],
  };
}

function validateOrderActionInput(input: ReturnType<typeof normalizeOrderActionInput>) {
  const fieldErrors: Partial<Record<"action" | "encounterId" | "orderIds", string>> = {};

  if (!input.action) fieldErrors.action = "오더 작업을 선택해 주세요.";
  if (!input.encounterId) fieldErrors.encounterId = "진료 차트를 선택해 주세요.";
  if (!input.orderIds.length) fieldErrors.orderIds = "오더를 선택해 주세요.";
  if (input.orderIds.length > 100) fieldErrors.orderIds = "선택 오더가 너무 많습니다.";

  if (Object.keys(fieldErrors).length > 0) {
    return { valid: false as const, fieldErrors };
  }

  return { valid: true as const, fieldErrors: {} };
}

function trimToUndefined(value?: string | null) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeUuidForRpc(value?: string) {
  return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : undefined;
}

function mapOrderActionRows(value: unknown): ChartOrderActionLine[] {
  if (!Array.isArray(value)) return [];

  return value.reduce<ChartOrderActionLine[]>((rows, item) => {
    const row = mapOrderActionRow(item);
    if (row) rows.push(row);
    return rows;
  }, []);
}

function mapOrderActionRow(value: unknown): ChartOrderActionLine | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<ChartOrderActionLine>;

  if (
    typeof row.orderId !== "string" ||
    typeof row.encounterId !== "string" ||
    typeof row.orderConfirmationStatus !== "string" ||
    typeof row.billingCandidateStatus !== "string" ||
    typeof row.status !== "string" ||
    typeof row.updatedAt !== "string"
  ) {
    return null;
  }

  return {
    billingCandidateId: row.billingCandidateId ?? null,
    billingCandidateStatus: row.billingCandidateStatus,
    confirmedAt: row.confirmedAt ?? null,
    confirmedByUserId: row.confirmedByUserId ?? null,
    encounterId: row.encounterId,
    orderConfirmationStatus: row.orderConfirmationStatus,
    orderId: row.orderId,
    status: row.status,
    updatedAt: row.updatedAt,
  } as ChartOrderActionLine;
}
