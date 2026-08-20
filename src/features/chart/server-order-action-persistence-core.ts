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
  createMockInvoiceCandidateSyncGateway,
  type BillingInvoiceCandidateLine,
  type InvoiceCandidateSyncGateway,
} from "@/features/billing/server-invoice-candidate-sync-core";
import {
  createMockFulfillmentWorkItemGateway,
  type FulfillmentWorkItem,
  type FulfillmentWorkItemGateway,
} from "@/features/fulfillment/server-fulfillment-work-item-core";
import { mockEncounters, mockOrders } from "@/mocks/emr-domain";
import type {
  BillingCategory,
  EmrOrder,
  EmrOrderType,
  Encounter,
  Species,
} from "@/types/emr-domain";
import {
  getMockChartOrderDraftRuntimeRows,
  type ChartOrderReadbackQuantitySource,
  type ChartOrderRuntimeRow,
} from "@/features/chart/server-order-draft-persistence-core";

export type ChartOrderActionKind = "bill" | "confirm";

/**
 * Demo/mock compatibility mirror for the A3 server-owned category mapping.
 * Live RPCs derive this value from the locked catalog row; chart callers never
 * send it as input.
 */
export function mapCatalogCategoryToBillingCategory(
  categoryGroup: string,
): BillingCategory {
  switch (categoryGroup) {
    case "consultation":
      return "consultation";
    case "medication":
      return "dispensing";
    case "treatment":
      return "treatment";
    case "lab":
      return "laboratory";
    case "imaging":
      return "imaging";
    case "hospitalization":
    case "misc":
    default:
      return "other";
  }
}

/** @deprecated Client catalog/snapshot authority is rejected by the v2 DTO. */
export type ChartOrderCatalogSelectionInput = Record<string, unknown>;

export type ChartOrderActionInput = {
  action?: ChartOrderActionKind;
  /** @deprecated Replaced by persisted draft rows and server-owned snapshots. */
  catalogSelections?: ChartOrderCatalogSelectionInput[];
  expectedEtag?: string;
  encounterId?: string;
  orderIds?: string[];
};

export type ChartOrderAppliedSnapshot = {
  amountBasis: string;
  billingName: string;
  billingReflectionEnabled: boolean;
  careGuide?: string;
  destinationModule?: string;
  guardianName?: string;
  inHospitalOrderName: string;
  internalInstruction?: string;
  lineTotalSnapshot: number;
  orderType: "set" | EmrOrderType;
  patientName?: string;
  priceKrw: number | null;
  quantity: number;
  rowType: "individual" | "set" | "set_child";
  salesUnit?: string;
  sourcePresetId?: string;
  sourcePresetVersion?: string;
  standardOrderName: string;
  targetSpecies: Species[];
  taskRequired?: boolean;
  taxIncluded: boolean | null;
  workspaceCatalogItemId?: string;
  sourceMasterRecordId?: string;
  sourceMasterRevision?: number;
  workspaceCatalogRevision?: number;
  categoryGroup?: string;
  billingCategory?: BillingCategory;
};

export type ChartOrderActionLine = {
  rowType?: "individual" | "set" | "set_child";
  orderType?: "set" | EmrOrderType;
  parentOrderId?: string | null;
  sourceSetId?: string | null;
  sourceSetRevisionId?: string | null;
  sourceSetRevisionNo?: number | null;
  sourceSetVersion?: string | null;
  sourceSetRevisionItemId?: string | null;
  quantity?: number;
  quantitySource?: ChartOrderReadbackQuantitySource;
  unitPriceSnapshot?: number | null;
  lineTotalSnapshot?: number;
  snapshotSchemaVersion?: 0 | 1;
  snapshotHash?: string | null;
  appliedPriceSnapshot?: Record<string, unknown>;
  calculationInputs?: Record<string, unknown>;
  calculationOutputs?: Record<string, unknown>;
  billingReflectionEnabled?: boolean;
  appliedSnapshot?: ChartOrderAppliedSnapshot;
  billingCandidateId?: string | null;
  billingCandidateStatus:
    | "not_requested"
    | "candidate_created"
    | "invoice_linked"
    | "billing_cancelled";
  confirmedAt?: string | null;
  confirmedByUserId?: string | null;
  encounterId: string;
  orderConfirmationStatus:
    | "draft"
    | "pending"
    | "confirmed"
    | "billed"
    | "cancelled";
  orderId: string;
  serviceItemId?: string;
  workspaceCatalogItemId?: string;
  sourceMasterRecordId?: string;
  sourceMasterRevision?: number;
  workspaceCatalogRevision?: number | null;
  status:
    | "requested"
    | "re_requested"
    | "in_progress"
    | "confirmed"
    | "completed"
    | "cancelled";
  updatedAt: string;
};

export type ChartOrderActionGatewayResult =
  | {
      ok: true;
      etag: string;
      rows: ChartOrderRuntimeRow[];
      orderActions: ChartOrderActionLine[];
      stored?: boolean;
    }
  | {
      ok: false;
      status: 400 | 409 | 422 | 428;
      error: string;
    }
  | { ok: false; status: 500; error: "db_read_failed" | "db_write_failed" };

export type ChartOrderActionGateway = {
  readOrderActions(input: {
    encounterId: string;
    workspaceId: string;
  }): Promise<ChartOrderActionGatewayResult>;
  saveOrderAction(input: {
    action: ChartOrderActionKind;
    actorUserId: string;
    /** @deprecated Ignored; snapshots come from persisted chart rows. */
    catalogSnapshots?: unknown;
    encounterId: string;
    expectedEtag?: string;
    orderIds: string[];
    workspaceId: string;
  }): Promise<ChartOrderActionGatewayResult>;
};

export type ChartOrderActionReadResult =
  | {
      ok: true;
      status: 200;
      etag: string;
      rows: ChartOrderRuntimeRow[];
      orderActions: ChartOrderActionLine[];
      enforcedBy: "chart-order-action-persistence";
    }
  | {
      ok: false;
      status: 400;
      error: "invalid_input";
      fieldErrors: Partial<Record<"encounterId" | "expectedEtag", string>>;
    }
  | {
      ok: false;
      status: 401 | 403;
      denialReason: WorkspacePermissionDenialReason;
    }
  | {
      ok: false;
      status: 409;
      denialReason: "encounter_unavailable" | "order_unavailable" | "revision_conflict" | "idempotency_conflict" | "invalid_order_selection";
    }
  | {
      ok: false;
      status: 500;
      error: "db_read_failed" | "supabase_client_missing";
    };

export type ChartOrderActionSaveResult =
  | {
      ok: true;
      status: 200;
      etag: string;
      rows: ChartOrderRuntimeRow[];
      billingCandidates?: BillingInvoiceCandidateLine[];
      orderActions: ChartOrderActionLine[];
      fulfillmentWorkItems?: FulfillmentWorkItem[];
      enforcedBy: "chart-order-action-persistence";
    }
  | {
      ok: false;
      status: 400;
      error: "invalid_input";
      fieldErrors: Partial<
        Record<"action" | "encounterId" | "orderIds" | "expectedEtag", string>
      >;
    }
  | {
      ok: false;
      status: 401 | 403;
      denialReason: WorkspacePermissionDenialReason;
    }
  | {
      ok: false;
      status: 409;
      denialReason:
        | "encounter_unavailable"
        | "invalid_transition"
        | "invoice_unavailable"
        | "invoice_anchor_conflict"
        | "billable_price_required"
        | "order_unavailable"
        | "stale_status"
        | "unsupported_order_type"
        | "catalog_revision_requires_refresh"
        | "child_revision_requires_refresh"
        | "revision_conflict"
        | "idempotency_conflict"
        | "invalid_order_selection"
        | "order_set_member_unavailable"
        | "order_set_price_unset"
        | "range_coverage_decision_pending"
        | "work_item_unavailable";
    }
  | { ok: false; status: 422; error: string }
  | { ok: false; status: 428; error: "if_match_required" }
  | {
      ok: false;
      status: 500;
      error: "db_write_failed" | "supabase_client_missing";
    };

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

  const result = await gateway.readOrderActions({
    encounterId: normalizedEncounterId,
    workspaceId,
  });

  if (!result.ok) {
    if (result.status === 409 && ["encounter_unavailable", "order_unavailable", "revision_conflict", "idempotency_conflict", "invalid_order_selection"].includes(result.error)) {
      return { ok: false, status: 409, denialReason: result.error as "encounter_unavailable" | "order_unavailable" | "revision_conflict" | "idempotency_conflict" | "invalid_order_selection" };
    }
    return { ok: false, status: 500, error: "db_read_failed" };
  }

  return {
    ok: true,
    status: 200,
    etag: result.etag,
    rows: result.rows,
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
  invoiceCandidateGateway = createMockInvoiceCandidateSyncGateway(),
  permissionAdapter = createDemoChartOrderActionPermissionAdapter(),
  workspaceId,
}: {
  actorUserId: string | null;
  auditGateway?: LiveMutationAuditOptions["auditGateway"];
  auditNow?: LiveMutationAuditOptions["auditNow"];
  auditRequestId?: LiveMutationAuditOptions["auditRequestId"];
  /** @deprecated Ignored; the action RPC owns catalog snapshot resolution. */
  catalogGateway?: unknown;
  fulfillmentGateway?: Pick<FulfillmentWorkItemGateway, "syncFromOrders">;
  gateway?: Pick<ChartOrderActionGateway, "saveOrderAction">;
  input: ChartOrderActionInput;
  invoiceCandidateGateway?: Pick<
    InvoiceCandidateSyncGateway,
    "syncInvoiceCandidates"
  >;
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
    expectedEtag: normalized.expectedEtag,
    orderIds: normalized.orderIds,
    workspaceId,
  });

  if (!result.ok) {
    if (result.status === 409) {
      if (["encounter_unavailable", "order_unavailable", "revision_conflict", "idempotency_conflict", "stale_status", "catalog_revision_requires_refresh", "child_revision_requires_refresh"].includes(result.error)) {
        return { ok: false, status: 409, denialReason: result.error as "encounter_unavailable" | "order_unavailable" | "revision_conflict" | "idempotency_conflict" | "stale_status" | "catalog_revision_requires_refresh" | "child_revision_requires_refresh" };
      }
      if (result.error === "invalid_order_selection") return { ok: false, status: 422, error: result.error };
      return { ok: false, status: 409, denialReason: "order_unavailable" };
    }
    if (result.status === 422) return { ok: false, status: 422, error: result.error };
    if (result.status === 428) return { ok: false, status: 428, error: "if_match_required" };
    return { ok: false, status: 500, error: "db_write_failed" };
  }

  const fulfillmentOrderIds = result.orderActions
    .filter((row) => shouldCreateFulfillmentWorkItem(row.appliedSnapshot))
    .map((row) => row.orderId);
  const fulfillmentResult =
    normalized.action === "confirm" && fulfillmentOrderIds.length > 0
      ? await fulfillmentGateway.syncFromOrders({
          actorUserId: actorUserId ?? "",
          encounterId: normalized.encounterId,
          orderIds: fulfillmentOrderIds,
          workspaceId,
        })
      : null;

  if (fulfillmentResult && !fulfillmentResult.ok) {
    if (fulfillmentResult.status === 409) return fulfillmentResult;
    return { ok: false, status: 500, error: "db_write_failed" };
  }

  const billingOrderIds = result.orderActions
    .filter((row) =>
      shouldCreateBillingCandidateForOrderAction(
        normalized.action as ChartOrderActionKind,
        row,
      ),
    )
    .map((row) => row.orderId);
  const billingResult =
    billingOrderIds.length > 0
      ? await invoiceCandidateGateway.syncInvoiceCandidates({
          actorUserId: actorUserId ?? "",
          encounterId: normalized.encounterId,
          orderIds: billingOrderIds,
          surface: "chart",
          workspaceId,
        })
      : null;

  if (billingResult && !billingResult.ok) {
    if (billingResult.status === 409) return billingResult;
    return { ok: false, status: 500, error: "db_write_failed" };
  }

  for (const row of result.orderActions) {
    const audit = await emitLiveMutationAuditEvent({
      auditGateway,
      auditNow,
      input: {
        workspaceId,
        actorUserId,
        eventType:
          normalized.action === "confirm"
            ? "order.confirmed"
            : "order.billing_candidate_requested",
        targetType: "order",
        targetId: row.orderId,
        encounterId: normalized.encounterId,
        requestId: auditRequestId,
        after: {
          appliedSnapshot: row.appliedSnapshot,
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
    etag: result.etag,
    rows: result.rows,
    billingCandidates: billingResult?.candidates,
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
  now = () => new Date().toISOString(),
): ChartOrderActionGateway {
  const encounters = dataset.encounters ?? [];
  const orders = dataset.orders ?? [];

  return {
    async readOrderActions({ encounterId, workspaceId }) {
      const encounter = findEncounter(encounters, workspaceId, encounterId);
      if (!encounter)
      return { ok: false, status: 409, error: "encounter_unavailable" };

      const orderActions = getStoredOrSeedOrderActions({
        encounterId,
        orders,
        workspaceId,
      });
      const rows = actionLinesToRuntimeRows(orderActions, workspaceId);
      return {
        ok: true,
        etag: mockChartActionEtag(rows),
        rows,
        orderActions,
      };
    },
    async saveOrderAction({
      action,
      actorUserId,
      encounterId,
      expectedEtag = "legacy",
      orderIds,
      workspaceId,
    }) {
      const encounter = findEncounter(encounters, workspaceId, encounterId);
      if (!encounter)
        return { ok: false, status: 409, error: "encounter_unavailable" };
      if (!canMutateChart(encounter)) {
        return { ok: false, status: 409, error: "stale_status" };
      }

      const seedRows = getStoredOrSeedOrderActions({ encounterId, orders, workspaceId });
      const currentRows = actionLinesToRuntimeRows(seedRows, workspaceId);
      if (expectedEtag !== "legacy" && expectedEtag !== mockChartActionEtag(currentRows) && mockOrderActionStore.has(buildOrderActionKey(workspaceId, encounterId))) {
        return { ok: false, status: 409, error: "revision_conflict" };
      }
      const selected = new Set(orderIds);
      if (
        orderIds.some(
          (orderId) => !seedRows.some((row) => row.orderId === orderId),
        )
      ) {
        return { ok: false, status: 409, error: "order_unavailable" };
      }

      const timestamp = now();
      const rows = seedRows.map((row) => {
        const selectedByParent =
          typeof row.parentOrderId === "string" && selected.has(row.parentOrderId);
        if (!selected.has(row.orderId) && !selectedByParent) return row;

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

        if (!shouldCreateBillingCandidateForOrderAction(action, row)) {
          return row;
        }

        return {
          ...row,
          billingCandidateId:
            row.billingCandidateId ?? `billcand-${row.orderId}`,
          billingCandidateStatus: "candidate_created" as const,
          updatedAt: timestamp,
        };
      });

      mockOrderActionStore.set(
        buildOrderActionKey(workspaceId, encounterId),
        rows,
      );

      const selectedRows = rows.filter(
        (row) => selected.has(row.orderId) ||
          (typeof row.parentOrderId === "string" && selected.has(row.parentOrderId)),
      );
      const runtimeRows = actionLinesToRuntimeRows(rows, workspaceId);
      return {
        ok: true,
        etag: mockChartActionEtag(runtimeRows),
        rows: runtimeRows,
        orderActions: selectedRows,
      };
    },
  };
}

export type SupabaseChartOrderActionRpcClient = {
  rpc(
    functionName: "clair_get_chart_order_actions",
    args: {
      p_workspace_id: string;
      p_encounter_id: string;
    },
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
  rpc(
    functionName: "clair_save_chart_order_action",
    args: {
      p_workspace_id: string;
      p_actor_user_id: string;
      p_encounter_id: string;
      p_action: ChartOrderActionKind;
      p_order_ids: string[];
      p_expected_etag: string;
    },
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
};

export function createSupabaseChartOrderActionGateway(
  client: SupabaseChartOrderActionRpcClient,
): ChartOrderActionGateway {
  return {
    async readOrderActions({ encounterId, workspaceId }) {
      const { data, error } = await client.rpc(
        "clair_get_chart_order_actions",
        {
          p_workspace_id: workspaceId,
          p_encounter_id: encounterId,
        },
      );

      if (error) {
        if (error.message?.includes("encounter_unavailable")) {
          return { ok: false, status: 409, error: "encounter_unavailable" };
        }
        return { ok: false, status: 500, error: "db_read_failed" };
      }

      const mapped = mapOrderActionResponse(data);
      if (!mapped) return { ok: false, status: 500, error: "db_read_failed" };
      return mapped;
    },
    async saveOrderAction({
      action,
      actorUserId,
      encounterId,
      expectedEtag = "legacy",
      orderIds,
      workspaceId,
    }) {
      const { data, error } = await client.rpc(
        "clair_save_chart_order_action",
        {
          p_workspace_id: workspaceId,
          p_actor_user_id: actorUserId,
          p_encounter_id: encounterId,
          p_action: action,
          p_order_ids: orderIds
            .map(normalizeUuidForRpc)
            .filter((orderId): orderId is string => Boolean(orderId)),
          p_expected_etag: expectedEtag,
        },
      );

      if (error) {
        if (error.message?.includes("encounter_unavailable")) return { ok: false, status: 409, error: "encounter_unavailable" };
        if (error.message?.includes("order_unavailable")) return { ok: false, status: 409, error: "order_unavailable" };
        if (error.message?.includes("stale_status")) return { ok: false, status: 409, error: "stale_status" };
        if (error.message?.includes("revision_conflict")) return { ok: false, status: 409, error: "revision_conflict" };
        if (error.message?.includes("idempotency_conflict")) return { ok: false, status: 409, error: "idempotency_conflict" };
        if (error.message?.includes("invalid_order_selection")) return { ok: false, status: 422, error: "invalid_order_selection" };
        if (error.message?.includes("if_match_required")) return { ok: false, status: 428, error: "if_match_required" };
        if (error.message?.includes("order_set_")) return { ok: false, status: 422, error: mapChartActionRpcError(error.message) };
        return { ok: false, status: 500, error: "db_write_failed" };
      }

      const mapped = mapOrderActionResponse(data);
      if (!mapped) return { ok: false, status: 500, error: "db_read_failed" };
      return {
        ...mapped,
      };
    },
  };
}

export function createDemoChartOrderActionPermissionAdapter() {
  return createMockWorkspacePermissionAdapter({
    users: [
      {
        id: "playwright-default-session",
        status: "active",
        displayName: "Playwright Admin",
      },
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

function findEncounter(
  encounters: Encounter[],
  workspaceId: string,
  encounterId: string,
) {
  return encounters.find(
    (encounter) =>
      encounter.id === encounterId &&
      encounter.workspaceId === workspaceId &&
      encounter.status !== "cancelled",
  );
}

function canMutateChart(encounter: Encounter) {
  return encounter.status === "in_consultation" || encounter.status === "ordered";
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
  const stored = mockOrderActionStore.get(
    buildOrderActionKey(workspaceId, encounterId),
  );
  const draftRuntimeRows =
    getMockChartOrderDraftRuntimeRows({ encounterId, workspaceId }) ?? [];
  const draftActions = draftRuntimeRows.map(runtimeRowToActionLine);
  const seedActions = orders
    .filter(
      (order) =>
        order.workspaceId === workspaceId && order.encounterId === encounterId,
    )
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(orderToActionLine);
  const nextRows = stored ? [...stored] : [...draftActions];
  const existingOrderIds = new Set(nextRows.map((row) => row.orderId));

  for (const row of [...draftActions, ...seedActions]) {
    if (existingOrderIds.has(row.orderId)) continue;
    existingOrderIds.add(row.orderId);
    nextRows.push(row);
  }

  return nextRows;
}

function orderToActionLine(order: EmrOrder): ChartOrderActionLine {
  const appliedSnapshot = order.appliedSnapshot;
  const rowType =
    appliedSnapshot && typeof appliedSnapshot.rowType === "string"
      ? appliedSnapshot.rowType
      : undefined;
  const billingReflectionEnabled =
    appliedSnapshot && typeof appliedSnapshot.billingReflectionEnabled === "boolean"
      ? appliedSnapshot.billingReflectionEnabled
      : undefined;
  const parentOrderId =
    appliedSnapshot && typeof appliedSnapshot.parentOrderId === "string"
      ? appliedSnapshot.parentOrderId
      : undefined;
  return {
    appliedSnapshot: isChartOrderAppliedSnapshot(appliedSnapshot)
      ? appliedSnapshot
      : undefined,
    billingCandidateId: null,
    billingCandidateStatus: "not_requested",
    confirmedAt: null,
    confirmedByUserId: null,
    encounterId: order.encounterId,
    orderConfirmationStatus:
      order.status === "completed" ? "confirmed" : "draft",
    orderId: order.id,
    parentOrderId,
    billingReflectionEnabled,
    rowType:
      rowType === "individual" || rowType === "set" || rowType === "set_child"
        ? rowType
        : undefined,
    status: order.status,
    updatedAt: order.updatedAt,
  };
}

function buildOrderActionKey(workspaceId: string, encounterId: string) {
  return `${workspaceId}:${encounterId}`;
}

function normalizeOrderActionInput(input: ChartOrderActionInput) {
  return {
    action:
      input.action === "bill" || input.action === "confirm"
        ? input.action
        : undefined,
    expectedEtag: trimToUndefined(input.expectedEtag) ?? "legacy",
    encounterId: trimToUndefined(input.encounterId) ?? "",
    orderIds: Array.isArray(input.orderIds)
      ? input.orderIds
          .map(trimToUndefined)
          .filter((orderId): orderId is string => Boolean(orderId))
      : [],
    hasClientSnapshotAuthority: Array.isArray(input.catalogSelections),
  };
}

function validateOrderActionInput(
  input: ReturnType<typeof normalizeOrderActionInput>,
) {
  const fieldErrors: Partial<
    Record<"action" | "encounterId" | "orderIds" | "expectedEtag", string>
  > = {};

  if (!input.action) fieldErrors.action = "오더 작업을 선택해 주세요.";
  if (!input.encounterId)
    fieldErrors.encounterId = "진료 차트를 선택해 주세요.";
  if (!input.orderIds.length) fieldErrors.orderIds = "오더를 선택해 주세요.";
  if (input.orderIds.length > 100)
    fieldErrors.orderIds = "선택 오더가 너무 많습니다.";
  if (input.hasClientSnapshotAuthority) {
    fieldErrors.orderIds = "저장된 오더 초안을 사용해 주세요.";
  }
  if (input.expectedEtag !== "legacy" && !/^"[0-9a-f]{64}"$/.test(input.expectedEtag)) {
    fieldErrors.expectedEtag = "오더 버전을 확인해 주세요.";
  }
  if (new Set(input.orderIds).size !== input.orderIds.length) {
    fieldErrors.orderIds = "중복 오더를 선택할 수 없습니다.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { valid: false as const, fieldErrors };
  }

  return { valid: true as const, fieldErrors: {} };
}

function shouldCreateFulfillmentWorkItem(snapshot?: ChartOrderAppliedSnapshot) {
  if (!snapshot) return true;
  if (snapshot.taskRequired === false) return false;
  return (
    snapshot.destinationModule === "lab" ||
    snapshot.destinationModule === "imaging" ||
    snapshot.destinationModule === "dispensing" ||
    snapshot.destinationModule === "treatment"
  );
}

function shouldCreateBillingCandidateOnChartConfirmation(
  snapshot?: ChartOrderAppliedSnapshot,
) {
  if (!snapshot || snapshot.billingReflectionEnabled === false) return false;
  if (snapshot.destinationModule !== "billing_only") return false;
  return snapshot.taskRequired !== true;
}

function shouldCreateBillingCandidateForOrderAction(
  action: ChartOrderActionKind,
  row: ChartOrderActionLine,
) {
  if (action === "confirm") {
    return shouldCreateBillingCandidateOnChartConfirmation(row.appliedSnapshot);
  }

  if (row.status === "cancelled") return false;
  if (row.billingReflectionEnabled === false) return false;
  if (row.rowType === "set_child" && row.billingReflectionEnabled !== true) {
    return false;
  }
  return row.appliedSnapshot?.billingReflectionEnabled !== false;
}

function trimToUndefined(value?: string | null) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeUuidForRpc(value?: string) {
  return value &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
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

function mapOrderActionResponse(value: unknown): ChartOrderActionGatewayResult | null {
  if (Array.isArray(value)) {
    const orderActions = mapOrderActionRows(value);
    const rows = actionLinesToRuntimeRows(orderActions, "");
    return { ok: true, etag: mockChartActionEtag(rows), rows, orderActions };
  }
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  if (typeof body.etag !== "string" || !Array.isArray(body.rows)) return null;
  const rows = body.rows
    .map(mapRuntimeActionRow)
    .filter((row): row is ChartOrderRuntimeRow => Boolean(row));
  if (rows.length !== body.rows.length) return null;
  const orderActions = rows.map(runtimeRowToActionLine);
  return {
    ok: true,
    etag: body.etag,
    rows,
    orderActions,
    stored: body.stored === true,
  };
}

function mapRuntimeActionRow(value: unknown): ChartOrderRuntimeRow | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const rowType = row.rowType;
  if (typeof row.orderId !== "string" || typeof row.encounterId !== "string" ||
      (rowType !== "individual" && rowType !== "set" && rowType !== "set_child") ||
      typeof row.orderType !== "string" || typeof row.quantity !== "number" ||
      typeof row.lineTotalSnapshot !== "number" || typeof row.updatedAt !== "string") return null;
  const objectOf = (key: string) => row[key] && typeof row[key] === "object" && !Array.isArray(row[key]) ? row[key] as Record<string, unknown> : {};
  const quantitySource = String(row.quantitySource);
  if (!["fixed_one", "preset_quantity", "manual_at_apply", "manual", "days", "total_count", "dispense_quantity", "actual_dispense_quantity"].includes(quantitySource)) return null;
  return {
    orderId: row.orderId,
    workspaceId: typeof row.workspaceId === "string" ? row.workspaceId : undefined,
    encounterId: row.encounterId,
    rowType,
    orderType: row.orderType as ChartOrderRuntimeRow["orderType"],
    parentOrderId: typeof row.parentOrderId === "string" ? row.parentOrderId : null,
    sourceSetId: typeof row.sourceSetId === "string" ? row.sourceSetId : null,
    sourceSetRevisionId: typeof row.sourceSetRevisionId === "string" ? row.sourceSetRevisionId : null,
    sourceSetRevisionNo: typeof row.sourceSetRevisionNo === "number" ? row.sourceSetRevisionNo : null,
    sourceSetVersion: typeof row.sourceSetVersion === "string" ? row.sourceSetVersion : null,
    sourceSetRevisionItemId: typeof row.sourceSetRevisionItemId === "string" ? row.sourceSetRevisionItemId : null,
    workspaceCatalogItemId: typeof row.workspaceCatalogItemId === "string" ? row.workspaceCatalogItemId : null,
    workspaceCatalogRevision: typeof row.workspaceCatalogRevision === "number" ? row.workspaceCatalogRevision : null,
    quantity: row.quantity,
    quantitySource: quantitySource as ChartOrderRuntimeRow["quantitySource"],
    unitPriceSnapshot: row.unitPriceSnapshot === null ? null : typeof row.unitPriceSnapshot === "number" ? row.unitPriceSnapshot : null,
    lineTotalSnapshot: row.lineTotalSnapshot,
    snapshotSchemaVersion: row.snapshotSchemaVersion === 1 ? 1 : 0,
    snapshotHash: typeof row.snapshotHash === "string" ? row.snapshotHash : null,
    appliedSnapshot: objectOf("appliedSnapshot"),
    appliedPriceSnapshot: objectOf("appliedPriceSnapshot"),
    calculationInputs: objectOf("calculationInputs"),
    calculationOutputs: objectOf("calculationOutputs"),
    billingReflectionEnabled: row.billingReflectionEnabled !== false,
    orderConfirmationStatus: typeof row.orderConfirmationStatus === "string" ? row.orderConfirmationStatus as ChartOrderRuntimeRow["orderConfirmationStatus"] : undefined,
    status: typeof row.status === "string" ? row.status : undefined,
    updatedAt: row.updatedAt,
  };
}

function runtimeRowToActionLine(row: ChartOrderRuntimeRow): ChartOrderActionLine {
  const snapshot = row.appliedSnapshot;
  return {
    rowType: row.rowType,
    orderType: row.orderType,
    parentOrderId: row.parentOrderId,
    sourceSetId: row.sourceSetId,
    sourceSetRevisionId: row.sourceSetRevisionId,
    sourceSetRevisionNo: row.sourceSetRevisionNo,
    sourceSetVersion: row.sourceSetVersion,
    sourceSetRevisionItemId: row.sourceSetRevisionItemId,
    workspaceCatalogRevision: row.workspaceCatalogRevision,
    quantity: row.quantity,
    quantitySource: row.quantitySource,
    unitPriceSnapshot: row.unitPriceSnapshot,
    lineTotalSnapshot: row.lineTotalSnapshot,
    snapshotSchemaVersion: row.snapshotSchemaVersion,
    snapshotHash: row.snapshotHash,
    appliedPriceSnapshot: row.appliedPriceSnapshot,
    calculationInputs: row.calculationInputs,
    calculationOutputs: row.calculationOutputs,
    billingReflectionEnabled: row.billingReflectionEnabled,
    appliedSnapshot: snapshot as ChartOrderAppliedSnapshot,
    billingCandidateId: null,
    billingCandidateStatus: "not_requested",
    confirmedAt: null,
    confirmedByUserId: null,
    encounterId: row.encounterId,
    orderConfirmationStatus: row.orderConfirmationStatus ?? "draft",
    orderId: row.orderId,
    workspaceCatalogItemId: row.workspaceCatalogItemId ?? undefined,
    status: (row.status ?? "requested") as ChartOrderActionLine["status"],
    updatedAt: row.updatedAt,
  };
}

function actionLinesToRuntimeRows(rows: ChartOrderActionLine[], workspaceId: string): ChartOrderRuntimeRow[] {
  return rows.map((row) => ({
    orderId: row.orderId,
    workspaceId,
    encounterId: row.encounterId,
    rowType: row.rowType ?? "individual",
    orderType: row.orderType ?? "treatment",
    parentOrderId: row.parentOrderId ?? null,
    sourceSetId: row.sourceSetId ?? null,
    sourceSetRevisionId: row.sourceSetRevisionId ?? null,
    sourceSetRevisionNo: row.sourceSetRevisionNo ?? null,
    sourceSetVersion: row.sourceSetVersion ?? null,
    sourceSetRevisionItemId: row.sourceSetRevisionItemId ?? null,
    workspaceCatalogItemId: row.workspaceCatalogItemId ?? null,
    workspaceCatalogRevision: row.workspaceCatalogRevision ?? null,
    quantity: row.quantity ?? row.appliedSnapshot?.quantity ?? 1,
    quantitySource: row.quantitySource ?? "manual",
    unitPriceSnapshot: row.unitPriceSnapshot ?? row.appliedSnapshot?.priceKrw ?? null,
    lineTotalSnapshot: row.lineTotalSnapshot ?? row.appliedSnapshot?.lineTotalSnapshot ?? 0,
    snapshotSchemaVersion: row.snapshotSchemaVersion ?? 0,
    snapshotHash: row.snapshotHash ?? null,
    appliedSnapshot: (row.appliedSnapshot ?? {}) as Record<string, unknown>,
    appliedPriceSnapshot: row.appliedPriceSnapshot ?? {},
    calculationInputs: row.calculationInputs ?? {},
    calculationOutputs: row.calculationOutputs ?? {},
    billingReflectionEnabled: row.billingReflectionEnabled ?? row.appliedSnapshot?.billingReflectionEnabled ?? true,
    orderConfirmationStatus: row.orderConfirmationStatus,
    status: row.status,
    updatedAt: row.updatedAt,
  }));
}

function mockChartActionEtag(rows: ChartOrderRuntimeRow[]) {
  return `"${mockChartActionHash(rows)}"`;
}

function mockChartActionHash(value: unknown) {
  const text = JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0").repeat(8);
}

function mapChartActionRpcError(message: string) {
  const known = [
    "order_set_member_unavailable",
    "order_set_composition_review_required",
    "order_set_price_unset",
    "order_set_empty_selection",
    "order_set_quantity_invalid",
    "order_set_duplicate_atomic",
    "order_set_depth_exceeded",
    "order_set_cycle_detected",
    "order_set_range_input_required",
    "order_set_range_input_invalid",
    "order_set_range_no_match",
  ];
  return known.find((code) => message.includes(code)) ?? "order_set_member_unavailable";
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
    appliedSnapshot: isChartOrderAppliedSnapshot(row.appliedSnapshot)
      ? row.appliedSnapshot
      : undefined,
    billingCandidateId: row.billingCandidateId ?? null,
    billingCandidateStatus: row.billingCandidateStatus,
    confirmedAt: row.confirmedAt ?? null,
    confirmedByUserId: row.confirmedByUserId ?? null,
    encounterId: row.encounterId,
    orderConfirmationStatus: row.orderConfirmationStatus,
    orderId: row.orderId,
    serviceItemId: typeof row.serviceItemId === "string" ? row.serviceItemId : undefined,
    workspaceCatalogItemId:
      typeof row.workspaceCatalogItemId === "string" ? row.workspaceCatalogItemId : undefined,
    sourceMasterRecordId:
      typeof row.sourceMasterRecordId === "string" ? row.sourceMasterRecordId : undefined,
    sourceMasterRevision:
      typeof row.sourceMasterRevision === "number" ? row.sourceMasterRevision : undefined,
    workspaceCatalogRevision:
      typeof row.workspaceCatalogRevision === "number" ? row.workspaceCatalogRevision : undefined,
    status: row.status,
    updatedAt: row.updatedAt,
  } as ChartOrderActionLine;
}

function isChartOrderAppliedSnapshot(
  value: unknown,
): value is ChartOrderAppliedSnapshot {
  return Boolean(
    value &&
    typeof value === "object" &&
    ((value as Partial<ChartOrderAppliedSnapshot>).sourcePresetId === undefined ||
      typeof (value as Partial<ChartOrderAppliedSnapshot>).sourcePresetId === "string") &&
    ((value as Partial<ChartOrderAppliedSnapshot>).priceKrw === null ||
      typeof (value as Partial<ChartOrderAppliedSnapshot>).priceKrw === "number") &&
    typeof (value as Partial<ChartOrderAppliedSnapshot>).lineTotalSnapshot ===
      "number",
  );
}
