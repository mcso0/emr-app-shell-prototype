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
import {
  createMockOrderCatalogGateway,
  type ChartOrderCatalogSearchRow,
  type OrderCatalogGateway,
} from "@/features/hospital-admin/server-order-catalog-core";
import { mockEncounters, mockOrders } from "@/mocks/emr-domain";
import type {
  EmrOrder,
  EmrOrderType,
  Encounter,
  Species,
} from "@/types/emr-domain";

export type ChartOrderActionKind = "bill" | "confirm";

export type ChartOrderCatalogSelectionInput = {
  billingDisplayName?: string;
  guardianName?: string;
  orderId?: string;
  patientName?: string;
  quantity?: number;
  rowType?: "individual" | "set";
  sourcePresetId?: string;
};

export type ChartOrderActionInput = {
  action?: ChartOrderActionKind;
  catalogSelections?: ChartOrderCatalogSelectionInput[];
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
  orderType: EmrOrderType;
  patientName?: string;
  priceKrw: number;
  quantity: number;
  rowType: "individual";
  salesUnit: string;
  sourcePresetId: string;
  sourcePresetVersion: string;
  standardOrderName: string;
  targetSpecies: Species[];
  taskRequired?: boolean;
  taxIncluded: boolean;
  workspaceCatalogItemId?: string;
};

export type ChartOrderActionLine = {
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
  | { ok: true; orderActions: ChartOrderActionLine[] }
  | {
      ok: false;
      status: 409;
      denialReason: "encounter_unavailable" | "order_unavailable";
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
    catalogSnapshots?: Map<string, ChartOrderAppliedSnapshot>;
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
  | {
      ok: false;
      status: 401 | 403;
      denialReason: WorkspacePermissionDenialReason;
    }
  | {
      ok: false;
      status: 409;
      denialReason: "encounter_unavailable" | "order_unavailable";
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
        Record<"action" | "encounterId" | "orderIds", string>
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
        | "order_unavailable"
        | "unsupported_order_type"
        | "work_item_unavailable";
    }
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
  catalogGateway = createMockOrderCatalogGateway(),
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
  catalogGateway?: Pick<OrderCatalogGateway, "listChartSearch">;
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

  const catalogSnapshots = await resolveCatalogSnapshotsForConfirmation({
    catalogGateway,
    input: normalized,
    workspaceId,
  });
  if (!catalogSnapshots.ok) return catalogSnapshots;

  const result = await gateway.saveOrderAction({
    action: normalized.action as ChartOrderActionKind,
    actorUserId: actorUserId ?? "",
    catalogSnapshots: catalogSnapshots.snapshots,
    encounterId: normalized.encounterId,
    orderIds: normalized.orderIds,
    workspaceId,
  });

  if (!result.ok) {
    if (result.status === 409) return result;
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
          orderSnapshots: result.orderActions
            .filter((row) => row.appliedSnapshot)
            .map((row) => ({
              billingName: row.appliedSnapshot?.billingName,
              billingReflectionEnabled:
                row.appliedSnapshot?.billingReflectionEnabled ?? true,
              destinationModule: row.appliedSnapshot?.destinationModule,
              inHospitalOrderName: row.appliedSnapshot?.inHospitalOrderName,
              internalInstruction: row.appliedSnapshot?.internalInstruction,
              lineTotalSnapshot: row.appliedSnapshot?.lineTotalSnapshot,
              orderId: row.orderId,
              guardianName: row.appliedSnapshot?.guardianName,
              patientName: row.appliedSnapshot?.patientName,
              priceKrw: row.appliedSnapshot?.priceKrw,
              quantity: row.appliedSnapshot?.quantity,
              sourcePresetId: row.appliedSnapshot?.sourcePresetId,
              standardOrderName: row.appliedSnapshot?.standardOrderName,
              taskRequired: row.appliedSnapshot?.taskRequired,
            })),
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
          orderSnapshots: result.orderActions
            .filter((row) => row.appliedSnapshot)
            .map(mapAppliedSnapshotToBillingInput),
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
        return {
          ok: false,
          status: 409,
          denialReason: "encounter_unavailable",
        };

      return {
        ok: true,
        orderActions: getStoredOrSeedOrderActions({
          encounterId,
          orders,
          workspaceId,
        }),
      };
    },
    async saveOrderAction({
      action,
      actorUserId,
      catalogSnapshots,
      encounterId,
      orderIds,
      workspaceId,
    }) {
      const encounter = findEncounter(encounters, workspaceId, encounterId);
      if (!encounter)
        return {
          ok: false,
          status: 409,
          denialReason: "encounter_unavailable",
        };

      const seedRows = mergeCatalogSnapshotRows(
        getStoredOrSeedOrderActions({ encounterId, orders, workspaceId }),
        catalogSnapshots,
        encounterId,
        now(),
      );
      const selected = new Set(orderIds);
      if (
        orderIds.some(
          (orderId) => !seedRows.some((row) => row.orderId === orderId),
        )
      ) {
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

      return {
        ok: true,
        orderActions: rows.filter((row) => selected.has(row.orderId)),
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
          return {
            ok: false,
            status: 409,
            denialReason: "encounter_unavailable",
          };
        }
        return { ok: false, status: 500, error: "db_read_failed" };
      }

      return { ok: true, orderActions: mapOrderActionRows(data) };
    },
    async saveOrderAction({
      action,
      actorUserId,
      catalogSnapshots,
      encounterId,
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
        },
      );

      if (error) {
        if (error.message?.includes("encounter_unavailable")) {
          return {
            ok: false,
            status: 409,
            denialReason: "encounter_unavailable",
          };
        }
        if (error.message?.includes("order_unavailable")) {
          return { ok: false, status: 409, denialReason: "order_unavailable" };
        }
        return { ok: false, status: 500, error: "db_write_failed" };
      }

      return {
        ok: true,
        orderActions: mergeCatalogSnapshotRows(
          mapOrderActionRows(data),
          catalogSnapshots,
          encounterId,
          new Date().toISOString(),
        ),
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
  if (stored) return stored;

  return orders
    .filter(
      (order) =>
        order.workspaceId === workspaceId && order.encounterId === encounterId,
    )
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(
      (order) =>
        ({
          billingCandidateId: null,
          billingCandidateStatus: "not_requested",
          confirmedAt: null,
          confirmedByUserId: null,
          encounterId,
          orderConfirmationStatus:
            order.status === "completed" ? "confirmed" : "draft",
          orderId: order.id,
          status: order.status,
          updatedAt: order.updatedAt,
        }) satisfies ChartOrderActionLine,
    );
}

function mergeCatalogSnapshotRows(
  rows: ChartOrderActionLine[],
  catalogSnapshots: Map<string, ChartOrderAppliedSnapshot> | undefined,
  encounterId: string,
  updatedAt: string,
) {
  if (!catalogSnapshots || catalogSnapshots.size === 0) return rows;
  const rowByOrderId = new Map(rows.map((row) => [row.orderId, row]));

  for (const [orderId, snapshot] of catalogSnapshots) {
    const existing = rowByOrderId.get(orderId);
    rowByOrderId.set(orderId, {
      ...(existing ?? {
        billingCandidateId: null,
        billingCandidateStatus: "not_requested" as const,
        confirmedAt: null,
        confirmedByUserId: null,
        encounterId,
        orderConfirmationStatus: "draft" as const,
        orderId,
        status: "requested" as const,
        updatedAt,
      }),
      appliedSnapshot: existing?.appliedSnapshot ?? snapshot,
    });
  }

  return [...rowByOrderId.values()];
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
    catalogSelections: normalizeCatalogSelections(input.catalogSelections),
    encounterId: trimToUndefined(input.encounterId) ?? "",
    orderIds: Array.isArray(input.orderIds)
      ? Array.from(
          new Set(
            input.orderIds
              .map(trimToUndefined)
              .filter((orderId): orderId is string => Boolean(orderId)),
          ),
        )
      : [],
  };
}

function normalizeCatalogSelections(
  selections?: ChartOrderCatalogSelectionInput[],
) {
  if (!Array.isArray(selections)) return [];

  return selections
    .map((selection) => {
      const orderId = trimToUndefined(selection.orderId);
      const sourcePresetId = trimToUndefined(selection.sourcePresetId);
      return {
        billingDisplayName: trimToUndefined(selection.billingDisplayName),
        guardianName: trimToUndefined(selection.guardianName),
        orderId,
        patientName: trimToUndefined(selection.patientName),
        quantity:
          typeof selection.quantity === "number" &&
          Number.isFinite(selection.quantity)
            ? selection.quantity
            : 1,
        rowType:
          selection.rowType === "set"
            ? ("set" as const)
            : selection.rowType === "individual"
              ? ("individual" as const)
              : undefined,
        sourcePresetId,
      };
    })
    .filter((selection) =>
      Boolean(
        selection.orderId && selection.rowType && selection.sourcePresetId,
      ),
    );
}

function validateOrderActionInput(
  input: ReturnType<typeof normalizeOrderActionInput>,
) {
  const fieldErrors: Partial<
    Record<"action" | "encounterId" | "orderIds", string>
  > = {};

  if (!input.action) fieldErrors.action = "오더 작업을 선택해 주세요.";
  if (!input.encounterId)
    fieldErrors.encounterId = "진료 차트를 선택해 주세요.";
  if (!input.orderIds.length) fieldErrors.orderIds = "오더를 선택해 주세요.";
  if (input.orderIds.length > 100)
    fieldErrors.orderIds = "선택 오더가 너무 많습니다.";

  if (Object.keys(fieldErrors).length > 0) {
    return { valid: false as const, fieldErrors };
  }

  return { valid: true as const, fieldErrors: {} };
}

async function resolveCatalogSnapshotsForConfirmation({
  catalogGateway,
  input,
  workspaceId,
}: {
  catalogGateway: Pick<OrderCatalogGateway, "listChartSearch">;
  input: ReturnType<typeof normalizeOrderActionInput>;
  workspaceId: string;
}): Promise<
  | { ok: true; snapshots: Map<string, ChartOrderAppliedSnapshot> }
  | {
      ok: false;
      status: 409;
      denialReason: "order_unavailable" | "unsupported_order_type";
    }
  | { ok: false; status: 500; error: "db_write_failed" }
> {
  if (input.action !== "confirm" || input.catalogSelections.length === 0) {
    return { ok: true, snapshots: new Map() };
  }

  const selectedOrderIds = new Set(input.orderIds);
  const relevantSelections = input.catalogSelections.filter((selection) =>
    selection.orderId ? selectedOrderIds.has(selection.orderId) : false,
  );
  if (relevantSelections.length === 0)
    return { ok: true, snapshots: new Map() };
  if (relevantSelections.some((selection) => selection.rowType === "set")) {
    return { ok: false, status: 409, denialReason: "unsupported_order_type" };
  }

  try {
    const result = await catalogGateway.listChartSearch({ workspaceId });
    const catalogRows = result.rows;
    const snapshots = new Map<string, ChartOrderAppliedSnapshot>();

    for (const selection of relevantSelections) {
      if (
        !selection.orderId ||
        !selection.sourcePresetId ||
        selection.rowType !== "individual"
      ) {
        return { ok: false, status: 409, denialReason: "order_unavailable" };
      }

      const catalogRow = catalogRows.find(
        (row) =>
          row.rowType === selection.rowType &&
          row.sourcePresetId === selection.sourcePresetId,
      );
      if (!catalogRow)
        return { ok: false, status: 409, denialReason: "order_unavailable" };

      snapshots.set(
        selection.orderId,
        buildConfirmedCatalogSnapshot({
          catalogRow,
          guardianName: selection.guardianName,
          patientName: selection.patientName,
          quantity: selection.quantity,
        }),
      );
    }

    return { ok: true, snapshots };
  } catch {
    return { ok: false, status: 500, error: "db_write_failed" };
  }
}

function buildConfirmedCatalogSnapshot({
  catalogRow,
  guardianName,
  patientName,
  quantity,
}: {
  catalogRow: ChartOrderCatalogSearchRow;
  guardianName?: string;
  patientName?: string;
  quantity: number;
}): ChartOrderAppliedSnapshot {
  const snapshot = catalogRow.appliedSnapshot;
  const safeQuantity = Math.max(1, Math.min(999, quantity || 1));

  return {
    amountBasis: snapshot.appliedAmountBasis,
    billingName: snapshot.appliedBillingName,
    billingReflectionEnabled: snapshot.billingReflectionEnabled,
    careGuide: snapshot.appliedCareGuide,
    destinationModule: snapshot.appliedDestinationModule,
    guardianName,
    inHospitalOrderName: snapshot.appliedDisplayName,
    internalInstruction: snapshot.appliedInternalInstruction,
    lineTotalSnapshot: roundMoney(safeQuantity * snapshot.appliedPriceKrw),
    orderType: mapCatalogCategoryToOrderType(catalogRow.categoryGroup),
    patientName,
    priceKrw: snapshot.appliedPriceKrw,
    quantity: safeQuantity,
    rowType: "individual",
    salesUnit: snapshot.appliedSalesUnit,
    sourcePresetId: snapshot.sourcePresetId,
    sourcePresetVersion: snapshot.sourcePresetVersion,
    standardOrderName:
      snapshot.appliedStandardOrderName ?? snapshot.appliedDisplayName,
    targetSpecies: [
      ...(snapshot.appliedTargetSpecies ?? catalogRow.targetSpecies),
    ],
    taskRequired: snapshot.appliedTaskRequired,
    taxIncluded: snapshot.appliedTaxIncluded,
    workspaceCatalogItemId: snapshot.workspaceCatalogItemId,
  };
}

function mapCatalogCategoryToOrderType(
  category: ChartOrderCatalogSearchRow["categoryGroup"],
): EmrOrderType {
  if (category === "lab") return "lab";
  if (category === "imaging") return "imaging";
  if (category === "medication") return "dispensing";
  return "treatment";
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
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
  return row.appliedSnapshot?.billingReflectionEnabled !== false;
}

function mapAppliedSnapshotToBillingInput(row: ChartOrderActionLine) {
  const snapshot = row.appliedSnapshot;
  return {
    billingName: snapshot?.billingName,
    billingReflectionEnabled: snapshot?.billingReflectionEnabled ?? true,
    destinationModule: snapshot?.destinationModule,
    inHospitalOrderName: snapshot?.inHospitalOrderName,
    lineTotalSnapshot: snapshot?.lineTotalSnapshot,
    orderId: row.orderId,
    priceKrw: snapshot?.priceKrw,
    quantity: snapshot?.quantity,
    sourcePresetId: snapshot?.sourcePresetId,
    standardOrderName: snapshot?.standardOrderName,
    taskRequired: snapshot?.taskRequired,
  };
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
    typeof (value as Partial<ChartOrderAppliedSnapshot>).sourcePresetId ===
      "string" &&
    typeof (value as Partial<ChartOrderAppliedSnapshot>).priceKrw ===
      "number" &&
    typeof (value as Partial<ChartOrderAppliedSnapshot>).lineTotalSnapshot ===
      "number",
  );
}
