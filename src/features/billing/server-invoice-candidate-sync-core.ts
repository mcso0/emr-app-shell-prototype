import {
  createMockWorkspacePermissionAdapter,
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";
import {
  mockEncounters,
  mockInvoiceLines,
  mockInvoices,
  mockOrders,
} from "@/mocks/emr-domain";
import type {
  EmrOrder,
  Encounter,
  Invoice,
  InvoiceLine,
} from "@/types/emr-domain";

export type InvoiceCandidatePublicSyncInput = {
  encounterId?: string;
  orderIds?: string[];
};

export type InvoiceCandidateSyncInput = InvoiceCandidatePublicSyncInput & {
  surface?: "direct" | "chart" | "fulfillment";
};

export type InvoiceCandidateGatewaySyncInput = {
  actorUserId: string;
  encounterId: string;
  orderIds: string[];
  surface?: "direct" | "chart" | "fulfillment";
  workspaceId: string;
};

type InvoiceCandidateFrozenOrderSnapshot = {
  amountBasis?:
    | "included_order_sum"
    | "set_fixed_price"
    | "range_price"
    | string;
  appliedPriceSnapshot?: Record<string, unknown>;
  appliedSnapshot?: Record<string, unknown>;
  billedAs?: "set_parent" | "atomic_child" | "nonbillable_parent";
  billingName?: string;
  billingReflectionEnabled: boolean;
  billingCategory?: string;
  categoryGroup?: string;
  destinationModule?: string;
  explicitExtra?: boolean;
  frozenOrderSnapshot?: Record<string, unknown>;
  inHospitalOrderName?: string;
  lineTotalSnapshot?: number | null;
  orderId: string;
  parentOrderId?: string | null;
  priceKrw?: number | null;
  quantity?: number;
  rangeBasis?: "patient_weight_kg" | "manual_value" | string | null;
  rangeId?: string | null;
  rangeInput?: number | null;
  roundingResultKrw?: number | null;
  roundingRule?: "as_is" | "ceil" | "floor" | "round";
  rowType?: "individual" | "set" | "set_child" | string;
  sourceOrderSnapshot?: Record<string, unknown>;
  sourceSetId?: string;
  sourceSetRevisionId?: string;
  sourceSetRevisionItemId?: string;
  sourceSetRevisionNo?: number;
  sourcePresetId?: string;
  workspaceCatalogItemId?: string;
  sourceMasterRecordId?: string;
  sourceMasterRevision?: number;
  workspaceCatalogRevision?: number;
  standardOrderName?: string;
  taskRequired?: boolean;
};

export type BillingInvoiceCandidateLine = {
  billingCandidateId: string;
  description: string;
  invoiceId: string;
  lineTotal: number;
  orderId: string;
  quantity: number;
  syncedAt: string;
  unitPrice: number;
  serviceItemId?: string;
  workspaceCatalogItemId?: string;
  sourceMasterRecordId?: string;
  sourceMasterRevision?: number;
  workspaceCatalogRevision?: number;
  categoryGroup?: string;
  billingCategory?: string;
  sourceOrderSnapshot?: Record<string, unknown>;
};

export type InvoiceCandidateSyncGatewayResult =
  | { ok: true; candidates: BillingInvoiceCandidateLine[] }
  | {
      ok: false;
      status: 409;
      denialReason:
        | "encounter_unavailable"
        | "order_unavailable"
        | "invoice_unavailable"
        | "invoice_anchor_conflict"
        | "billable_price_required";
    }
  | { ok: false; status: 500; error: "db_read_failed" | "db_write_failed" };

export type InvoiceCandidateSyncGateway = {
  listInvoiceCandidates(input: {
    encounterId: string;
    workspaceId: string;
  }): Promise<InvoiceCandidateSyncGatewayResult>;
  syncInvoiceCandidates<T extends InvoiceCandidateGatewaySyncInput>(
    input: T,
  ): Promise<InvoiceCandidateSyncGatewayResult>;
};

export type InvoiceCandidateReadResult =
  | {
      ok: true;
      status: 200;
      candidates: BillingInvoiceCandidateLine[];
      enforcedBy: "billing-invoice-candidate-sync";
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
      denialReason:
        | "encounter_unavailable"
        | "order_unavailable"
        | "invoice_unavailable"
        | "invoice_anchor_conflict"
        | "billable_price_required";
    }
  | {
      ok: false;
      status: 500;
      error: "db_read_failed" | "supabase_client_missing";
    };

export type InvoiceCandidateSyncResult =
  | {
      ok: true;
      status: 200;
      candidates: BillingInvoiceCandidateLine[];
      enforcedBy: "billing-invoice-candidate-sync";
    }
  | {
      ok: false;
      status: 400;
      error: "invalid_input";
      fieldErrors: Partial<Record<"encounterId" | "orderIds", string>>;
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
        | "order_unavailable"
        | "invoice_unavailable"
        | "invoice_anchor_conflict"
        | "billable_price_required";
    }
  | {
      ok: false;
      status: 500;
      error: "db_write_failed" | "supabase_client_missing";
    };

const mockInvoiceCandidateStore = new Map<
  string,
  BillingInvoiceCandidateLine[]
>();

export async function readInvoiceCandidates({
  actorUserId,
  encounterId,
  gateway = createMockInvoiceCandidateSyncGateway(),
  permissionAdapter = createDemoInvoiceCandidatePermissionAdapter(),
  workspaceId,
}: {
  actorUserId: string | null;
  encounterId: string | null | undefined;
  gateway?: Pick<InvoiceCandidateSyncGateway, "listInvoiceCandidates">;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<InvoiceCandidateReadResult> {
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
    requiredPermission: "billing:view",
  });
  if (!permission.allowed) {
    return {
      ok: false,
      status: permission.denialReason === "unauthenticated" ? 401 : 403,
      denialReason: permission.denialReason ?? "permission_missing",
    };
  }

  const result = await gateway.listInvoiceCandidates({
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
    candidates: result.candidates,
    enforcedBy: "billing-invoice-candidate-sync",
  };
}

export async function syncInvoiceCandidates({
  actorUserId,
  gateway = createMockInvoiceCandidateSyncGateway(),
  input,
  permissionAdapter = createDemoInvoiceCandidatePermissionAdapter(),
  workspaceId,
}: {
  actorUserId: string | null;
  gateway?: Pick<InvoiceCandidateSyncGateway, "syncInvoiceCandidates">;
  input: InvoiceCandidateSyncInput;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<InvoiceCandidateSyncResult> {
  const normalized = normalizeSyncInput(input);
  const validation = validateSyncInput(normalized);
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
    requiredPermission:
      input.surface === "chart"
        ? "chart:update"
        : input.surface === "fulfillment"
          ? "dispensing:complete"
          : "billing:issue",
  });
  if (!permission.allowed) {
    return {
      ok: false,
      status: permission.denialReason === "unauthenticated" ? 401 : 403,
      denialReason: permission.denialReason ?? "permission_missing",
    };
  }

  const result = await gateway.syncInvoiceCandidates({
    actorUserId: actorUserId ?? "",
    encounterId: normalized.encounterId,
    orderIds: normalized.orderIds,
    surface: input.surface ?? "direct",
    workspaceId,
  });
  if (!result.ok) {
    if (result.status === 409) return result;
    return { ok: false, status: 500, error: "db_write_failed" };
  }

  return {
    ok: true,
    status: 200,
    candidates: result.candidates,
    enforcedBy: "billing-invoice-candidate-sync",
  };
}

export function createMockInvoiceCandidateSyncGateway(
  dataset: {
    encounters?: Encounter[];
    invoiceLines?: InvoiceLine[];
    invoices?: Invoice[];
    orders?: EmrOrder[];
  } = {
    encounters: mockEncounters,
    invoiceLines: mockInvoiceLines,
    invoices: mockInvoices,
    orders: mockOrders,
  },
  now = () => new Date().toISOString(),
): InvoiceCandidateSyncGateway {
  const encounters = dataset.encounters ?? [];
  const invoiceLines = dataset.invoiceLines ?? [];
  const invoices = dataset.invoices ?? [];
  const orders = dataset.orders ?? [];

  return {
    async listInvoiceCandidates({ encounterId, workspaceId }) {
      const encounter = findEncounter(encounters, workspaceId, encounterId);
      if (!encounter)
        return {
          ok: false,
          status: 409,
          denialReason: "encounter_unavailable",
        };

      return {
        ok: true,
        candidates: getStoredOrSeedCandidates({
          encounterId,
          invoiceLines,
          invoices,
          orders,
          workspaceId,
        }),
      };
    },
  async syncInvoiceCandidates<T extends InvoiceCandidateGatewaySyncInput>({
      encounterId,
      orderIds,
      workspaceId,
    }: T) {
      const encounter = findEncounter(encounters, workspaceId, encounterId);
      if (!encounter)
        return {
          ok: false,
          status: 409,
          denialReason: "encounter_unavailable",
        };

      const invoice = invoices.find(
        (item) =>
          item.workspaceId === workspaceId && item.encounterId === encounterId,
      );
      if (!invoice)
        return { ok: false, status: 409, denialReason: "invoice_unavailable" };

      const candidates = getStoredOrSeedCandidates({
        encounterId,
        invoiceLines,
        invoices,
        orders,
        workspaceId,
      });
      const timestamp = now();
      const nextCandidates = [...candidates];
      const synced: BillingInvoiceCandidateLine[] = [];

      for (const orderId of orderIds) {
        const order = orders.find(
          (item) =>
            item.workspaceId === workspaceId &&
            item.encounterId === encounterId &&
            item.id === orderId,
        );
        const snapshot = getFrozenOrderSnapshot(order);

        // B3 downstreams receive atomic children and the set root only. A
        // nested container is never an invoice line, even if a stale caller
        // includes it in the retry tuple.
        if (isNestedContainer(order, snapshot)) continue;
        if (isSetParent(order, snapshot) && !shouldBillSetParent(snapshot)) {
          continue;
        }
        if (snapshot?.billingReflectionEnabled === false) continue;
        if (!order && !snapshot) {
          return { ok: false, status: 409, denialReason: "order_unavailable" };
        }
        if (order && order.status === "cancelled") {
          return { ok: false, status: 409, denialReason: "order_unavailable" };
        }

        const existing = nextCandidates.find(
          (candidate) => candidate.orderId === orderId,
        );
        if (existing) {
          synced.push({ ...existing, syncedAt: timestamp });
          continue;
        }

        const sourceLine = invoiceLines.find(
          (line) => line.orderId === orderId,
        );
        const quantity = snapshot?.quantity ?? sourceLine?.quantity ?? 1;
        const snapshotOwnsPrice = snapshot !== undefined;
        if (
          snapshotOwnsPrice &&
          snapshot.billingReflectionEnabled === true &&
          (snapshot.priceKrw === null || snapshot.priceKrw === undefined)
        ) {
          return { ok: false, status: 409, denialReason: "billable_price_required" };
        }
        const unitPrice = snapshot?.priceKrw ?? sourceLine?.unitPrice;
        if (unitPrice === undefined) {
          return { ok: false, status: 409, denialReason: "billable_price_required" };
        }
        const categoryGroup =
          snapshot?.categoryGroup ??
          readSnapshotString(order?.appliedSnapshot, "categoryGroup") ??
          order?.categoryGroup;
        const billingCategory = mapBillingCategory(
          snapshot?.billingCategory ??
            readSnapshotString(order?.appliedSnapshot, "billingCategory") ??
            order?.billingCategory,
          categoryGroup,
        );
        const sourceOrderSnapshot = getSourceOrderSnapshot(
          order,
          snapshot,
          sourceLine,
        );
        const candidate = {
          billingCandidateId: `billcand-${orderId}`,
          description: getCandidateDescription({ order, snapshot, sourceLine }),
          invoiceId: invoice.id,
          lineTotal: getFrozenLineTotal({
            quantity,
            snapshot,
            unitPrice,
          }),
          orderId,
          quantity,
          syncedAt: timestamp,
          unitPrice,
          serviceItemId: order?.serviceItemId ?? sourceLine?.serviceItemId,
          workspaceCatalogItemId:
            snapshot?.workspaceCatalogItemId ?? order?.workspaceCatalogItemId,
          sourceMasterRecordId:
            snapshot?.sourceMasterRecordId ?? order?.sourceMasterRecordId,
          sourceMasterRevision:
            snapshot?.sourceMasterRevision ?? order?.sourceMasterRevision,
          workspaceCatalogRevision:
            snapshot?.workspaceCatalogRevision ?? order?.workspaceCatalogRevision,
          ...(categoryGroup ? { categoryGroup } : {}),
          ...(billingCategory ? { billingCategory } : {}),
          ...(sourceOrderSnapshot
            ? { sourceOrderSnapshot: cloneSnapshot(sourceOrderSnapshot) }
            : {}),
        } satisfies BillingInvoiceCandidateLine;
        nextCandidates.push(candidate);
        synced.push(candidate);
      }

      mockInvoiceCandidateStore.set(
        buildCandidateKey(workspaceId, encounterId),
        nextCandidates,
      );
      return { ok: true, candidates: synced };
    },
  };
}

export type SupabaseInvoiceCandidateSyncRpcClient = {
  rpc(
    functionName: "clair_list_billing_invoice_candidates",
    args: { p_workspace_id: string; p_encounter_id: string },
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
  rpc(
    functionName:
      | "clair_sync_billing_invoice_candidates"
      | "clair_sync_billing_invoice_candidates_from_chart"
      | "clair_sync_billing_invoice_candidates_from_fulfillment",
    args: {
      p_workspace_id: string;
      p_actor_user_id: string;
      p_encounter_id: string;
      p_order_ids: string[];
    },
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
};

export function createSupabaseInvoiceCandidateSyncGateway(
  client: SupabaseInvoiceCandidateSyncRpcClient,
): InvoiceCandidateSyncGateway {
  return {
    async listInvoiceCandidates({ encounterId, workspaceId }) {
      const { data, error } = await client.rpc(
        "clair_list_billing_invoice_candidates",
        { p_workspace_id: workspaceId, p_encounter_id: encounterId },
      );
      if (error) return mapSyncError(error.message, "db_read_failed");
      return { ok: true, candidates: mapCandidateRows(data) };
    },
    async syncInvoiceCandidates<T extends InvoiceCandidateGatewaySyncInput>({
      actorUserId,
      encounterId,
      orderIds,
      surface = "direct",
      workspaceId,
    }: T) {
      const functionName =
        surface === "chart"
          ? "clair_sync_billing_invoice_candidates_from_chart"
          : surface === "fulfillment"
            ? "clair_sync_billing_invoice_candidates_from_fulfillment"
            : "clair_sync_billing_invoice_candidates";
      const { data, error } = await client.rpc(
        functionName,
        {
          p_workspace_id: workspaceId,
          p_actor_user_id: actorUserId,
          p_encounter_id: encounterId,
          p_order_ids: orderIds
            .map(normalizeUuidForRpc)
            .filter((orderId): orderId is string => Boolean(orderId)),
        },
      );
      if (error) return mapSyncError(error.message, "db_write_failed");
      return { ok: true, candidates: mapCandidateRows(data) };
    },
  };
}

export function createDemoInvoiceCandidatePermissionAdapter() {
  return createMockWorkspacePermissionAdapter({
    users: [
      { id: "playwright-default-session", status: "active" },
      { id: "user-admin", status: "active" },
      { id: "user-front-desk", status: "active" },
      { id: "user-vet", status: "active" },
      { id: "user-tech", status: "active" },
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

function getStoredOrSeedCandidates({
  encounterId,
  invoiceLines,
  invoices,
  orders,
  workspaceId,
}: {
  encounterId: string;
  invoiceLines: InvoiceLine[];
  invoices: Invoice[];
  orders: EmrOrder[];
  workspaceId: string;
}) {
  const stored = mockInvoiceCandidateStore.get(
    buildCandidateKey(workspaceId, encounterId),
  );
  if (stored) return stored;

  const invoice = invoices.find(
    (item) =>
      item.workspaceId === workspaceId && item.encounterId === encounterId,
  );
  if (!invoice) return [];
  const orderIds = new Set(
    orders
      .filter(
        (order) =>
          order.workspaceId === workspaceId &&
          order.encounterId === encounterId,
      )
      .map((order) => order.id),
  );

  return invoiceLines
    .filter(
      (line) =>
        line.invoiceId === invoice.id &&
        line.orderId &&
        orderIds.has(line.orderId),
    )
    .map((line) => ({
      billingCandidateId: `billcand-${line.orderId}`,
      description: line.description,
      invoiceId: invoice.id,
      lineTotal: line.lineTotal,
      orderId: line.orderId ?? "",
      quantity: line.quantity,
      syncedAt: new Date(0).toISOString(),
      unitPrice: line.unitPrice,
      ...(line.serviceItemId ? { serviceItemId: line.serviceItemId } : {}),
      ...(line.workspaceCatalogItemId
        ? { workspaceCatalogItemId: line.workspaceCatalogItemId }
        : {}),
      ...(line.sourceMasterRecordId
        ? { sourceMasterRecordId: line.sourceMasterRecordId }
        : {}),
      ...(line.sourceMasterRevision !== undefined
        ? { sourceMasterRevision: line.sourceMasterRevision }
        : {}),
      ...(line.workspaceCatalogRevision !== undefined
        ? { workspaceCatalogRevision: line.workspaceCatalogRevision }
        : {}),
      ...(line.categoryGroup ? { categoryGroup: line.categoryGroup } : {}),
      ...(line.billingCategory || (line.categoryGroup as string | undefined) === "set"
        ? {
            billingCategory:
              mapBillingCategory(line.billingCategory, line.categoryGroup) ??
              "other",
          }
        : {}),
      ...(line.sourceOrderSnapshot
        ? { sourceOrderSnapshot: line.sourceOrderSnapshot }
        : {}),
    }));
}

function normalizeSyncInput(input: InvoiceCandidatePublicSyncInput) {
  return {
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

function validateSyncInput(input: ReturnType<typeof normalizeSyncInput>) {
  const fieldErrors: Partial<Record<"encounterId" | "orderIds", string>> = {};
  if (!input.encounterId)
    fieldErrors.encounterId = "진료 차트를 선택해 주세요.";
  if (!input.orderIds.length) fieldErrors.orderIds = "오더를 선택해 주세요.";
  if (input.orderIds.length > 100)
    fieldErrors.orderIds = "선택 오더가 너무 많습니다.";
  if (Object.keys(fieldErrors).length > 0)
    return { valid: false as const, fieldErrors };
  return { valid: true as const, fieldErrors: {} };
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

function buildCandidateKey(workspaceId: string, encounterId: string) {
  return `${workspaceId}:${encounterId}`;
}

function trimToUndefined(value?: string | null) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function getFrozenOrderSnapshot(
  order: EmrOrder | undefined,
): InvoiceCandidateFrozenOrderSnapshot | undefined {
  const appliedSnapshot = asSnapshotRecord(order?.appliedSnapshot);
  if (!order || !appliedSnapshot) return undefined;
  const appliedPriceSnapshot = asSnapshotRecord(
    (order as EmrOrder & { appliedPriceSnapshot?: unknown }).appliedPriceSnapshot,
  );

  const priceKrw = readSnapshotNumberOrNull(appliedSnapshot, "priceKrw");
  const lineTotalSnapshot = readSnapshotNumberOrNull(
    appliedSnapshot,
    "lineTotalSnapshot",
  );
  const billingReflectionEnabled = readSnapshotBoolean(
    appliedSnapshot,
    "billingReflectionEnabled",
  );
  return {
    amountBasis: readSnapshotString(appliedSnapshot, "amountBasis"),
    appliedPriceSnapshot,
    appliedSnapshot,
    billedAs: readSnapshotString(appliedSnapshot, "billedAs") as
      | InvoiceCandidateFrozenOrderSnapshot["billedAs"]
      | undefined,
    billingName:
      readSnapshotString(
        appliedSnapshot,
        "effectiveBillingName",
        "billingName",
      ) ?? order.displayName,
    billingReflectionEnabled: billingReflectionEnabled ?? true,
    billingCategory: readSnapshotString(appliedSnapshot, "billingCategory"),
    categoryGroup: readSnapshotString(appliedSnapshot, "categoryGroup"),
    destinationModule: readSnapshotString(
      appliedSnapshot,
      "destinationModule",
    ),
    explicitExtra: readSnapshotBoolean(appliedSnapshot, "explicitExtra"),
    frozenOrderSnapshot: appliedSnapshot,
    inHospitalOrderName: readSnapshotString(
      appliedSnapshot,
      "effectiveDisplayName",
      "displayName",
    ),
    lineTotalSnapshot,
    orderId: order.id,
    parentOrderId: readSnapshotString(appliedSnapshot, "parentOrderId") ?? null,
    priceKrw:
      priceKrw !== undefined
        ? priceKrw
        : readSnapshotNumberOrNull(appliedSnapshot, "setPriceKrw") ??
          order.unitPriceSnapshot ??
          undefined,
    quantity: readSnapshotNumber(appliedSnapshot, "quantity"),
    rangeBasis: readSnapshotString(appliedSnapshot, "rangeBasis"),
    rangeId: readSnapshotString(appliedSnapshot, "rangeId") ?? null,
    rangeInput: readSnapshotNumberOrNull(appliedSnapshot, "rangeInput"),
    roundingResultKrw: readSnapshotNumberOrNull(
      appliedSnapshot,
      "roundingResultKrw",
      "roundingResult",
    ),
    roundingRule: readSnapshotString(appliedSnapshot, "roundingRule") as
      | InvoiceCandidateFrozenOrderSnapshot["roundingRule"]
      | undefined,
    rowType: readSnapshotString(appliedSnapshot, "rowType"),
    sourceOrderSnapshot: appliedSnapshot,
    sourceSetId: readSnapshotString(appliedSnapshot, "sourceSetId"),
    sourceSetRevisionId: readSnapshotString(
      appliedSnapshot,
      "sourceSetRevisionId",
    ),
    sourceSetRevisionItemId: readSnapshotString(
      appliedSnapshot,
      "sourceSetRevisionItemId",
    ),
    sourceSetRevisionNo: readSnapshotNumber(
      appliedSnapshot,
      "sourceSetRevisionNo",
    ),
    sourcePresetId:
      readSnapshotString(appliedSnapshot, "sourcePresetId") ??
      order.serviceItemId,
    sourceMasterRecordId: order.sourceMasterRecordId,
    sourceMasterRevision: order.sourceMasterRevision,
    workspaceCatalogItemId:
      readSnapshotString(appliedSnapshot, "workspaceCatalogItemId") ??
      order.workspaceCatalogItemId,
    workspaceCatalogRevision: order.workspaceCatalogRevision,
    standardOrderName: readSnapshotString(
      appliedSnapshot,
      "standardOrderName",
    ),
    taskRequired: readSnapshotBoolean(appliedSnapshot, "taskRequired"),
  };
}

function getSourceOrderSnapshot(
  order: EmrOrder | undefined,
  snapshot: InvoiceCandidateFrozenOrderSnapshot | undefined,
  sourceLine: InvoiceLine | undefined,
) {
  return (
    snapshot?.sourceOrderSnapshot ??
    snapshot?.frozenOrderSnapshot ??
    snapshot?.appliedSnapshot ??
    asSnapshotRecord(order?.appliedSnapshot) ??
    sourceLine?.sourceOrderSnapshot
  );
}

function getFrozenLineTotal({
  quantity,
  snapshot,
  unitPrice,
}: {
  quantity: number;
  snapshot?: InvoiceCandidateFrozenOrderSnapshot;
  unitPrice: number;
}) {
  const explicitLineTotal = snapshot?.lineTotalSnapshot;
  if (typeof explicitLineTotal === "number" && Number.isFinite(explicitLineTotal)) {
    return explicitLineTotal;
  }
  const roundingResult = snapshot?.roundingResultKrw;
  if (typeof roundingResult === "number" && Number.isFinite(roundingResult)) {
    return roundingResult;
  }
  const calculationOutputs =
    asSnapshotRecord(snapshot?.appliedPriceSnapshot) ??
    asSnapshotRecord(snapshot?.appliedSnapshot?.calculationOutputs);
  const calculatedLineTotal =
    readSnapshotNumber(calculationOutputs, "lineTotalKrw", "lineTotalSnapshot") ??
    readSnapshotNumber(calculationOutputs, "roundingResultKrw");
  if (calculatedLineTotal !== undefined) return calculatedLineTotal;
  return roundMoney(quantity * unitPrice);
}

function isSetParent(
  order: EmrOrder | undefined,
  snapshot: InvoiceCandidateFrozenOrderSnapshot | undefined,
) {
  return (
    snapshot?.rowType === "set" ||
    readSnapshotString(order as (EmrOrder & Record<string, unknown>) | undefined, "rowType") ===
      "set" ||
    readSnapshotString(order?.appliedSnapshot, "rowType") === "set" ||
    readSnapshotString(order?.appliedSnapshot, "orderType") === "set" ||
    readSnapshotString(
      order as (EmrOrder & Record<string, unknown>) | undefined,
      "orderType",
    ) === "set"
  );
}

function isNestedContainer(
  order: EmrOrder | undefined,
  snapshot: InvoiceCandidateFrozenOrderSnapshot | undefined,
) {
  const rowType =
    snapshot?.rowType ??
    readSnapshotString(
      order as (EmrOrder & Record<string, unknown>) | undefined,
      "rowType",
    ) ??
    readSnapshotString(order?.appliedSnapshot, "rowType");
  const orderRecord = order as (EmrOrder & Record<string, unknown>) | undefined;
  const appliedSnapshot = asSnapshotRecord(
    snapshot?.appliedSnapshot ?? order?.appliedSnapshot,
  );
  return (
    rowType === "set_child_container" ||
    rowType === "order_set" ||
    readSnapshotString(orderRecord, "itemKind", "childKind") === "order_set" ||
    readSnapshotString(appliedSnapshot, "itemKind", "childKind") ===
      "order_set"
  );
}

function shouldBillSetParent(snapshot: InvoiceCandidateFrozenOrderSnapshot | undefined) {
  if (snapshot?.amountBasis === "included_order_sum") return false;
  return snapshot?.billingReflectionEnabled !== false;
}

function mapBillingCategory(value?: string, categoryGroup?: string) {
  if (
    value === "consultation" ||
    value === "laboratory" ||
    value === "imaging" ||
    value === "dispensing" ||
    value === "treatment" ||
    value === "other"
  ) {
    return value;
  }
  if (categoryGroup === "set") return "other";
  return undefined;
}

function asSnapshotRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function cloneSnapshot(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function readSnapshotString(
  value: unknown,
  ...keys: string[]
): string | undefined {
  const record = asSnapshotRecord(value);
  if (!record) return undefined;
  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  }
  return undefined;
}

function readSnapshotNumber(
  value: unknown,
  ...keys: string[]
): number | undefined {
  const record = asSnapshotRecord(value);
  if (!record) return undefined;
  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === "number" && Number.isFinite(candidate)) return candidate;
  }
  return undefined;
}

function readSnapshotNumberOrNull(
  value: unknown,
  ...keys: string[]
): number | null | undefined {
  const record = asSnapshotRecord(value);
  if (!record) return undefined;
  for (const key of keys) {
    const candidate = record[key];
    if (candidate === null) return null;
    if (typeof candidate === "number" && Number.isFinite(candidate)) return candidate;
  }
  return undefined;
}

function readSnapshotBoolean(
  value: unknown,
  ...keys: string[]
): boolean | undefined {
  const record = asSnapshotRecord(value);
  if (!record) return undefined;
  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === "boolean") return candidate;
  }
  return undefined;
}

function getCandidateDescription({
  order,
  snapshot,
  sourceLine,
}: {
  order?: EmrOrder;
  snapshot?: InvoiceCandidateFrozenOrderSnapshot;
  sourceLine?: InvoiceLine;
}) {
  return (
    snapshot?.billingName ??
    sourceLine?.description ??
    snapshot?.inHospitalOrderName ??
    snapshot?.standardOrderName ??
    order?.displayName ??
    "청구 후보"
  );
}

function normalizeUuidForRpc(value?: string) {
  return value &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
    ? value
    : undefined;
}

function mapSyncError(
  message: string | undefined,
  fallback: "db_read_failed" | "db_write_failed",
): InvoiceCandidateSyncGatewayResult {
  if (message?.includes("encounter_unavailable"))
    return { ok: false, status: 409, denialReason: "encounter_unavailable" };
  if (message?.includes("order_unavailable"))
    return { ok: false, status: 409, denialReason: "order_unavailable" };
  if (message?.includes("invoice_unavailable"))
    return { ok: false, status: 409, denialReason: "invoice_unavailable" };
  if (message?.includes("invoice_anchor_conflict"))
    return { ok: false, status: 409, denialReason: "invoice_anchor_conflict" };
  if (message?.includes("billable_price_required"))
    return { ok: false, status: 409, denialReason: "billable_price_required" };
  return { ok: false, status: 500, error: fallback };
}

function mapCandidateRows(value: unknown): BillingInvoiceCandidateLine[] {
  if (!Array.isArray(value)) return [];
  return value.reduce<BillingInvoiceCandidateLine[]>((rows, item) => {
    if (!item || typeof item !== "object") return rows;
    const row = item as Partial<BillingInvoiceCandidateLine> &
      Record<string, unknown>;
    if (
      typeof row.billingCandidateId !== "string" ||
      typeof row.description !== "string" ||
      typeof row.invoiceId !== "string" ||
      typeof row.lineTotal !== "number" ||
      typeof row.orderId !== "string" ||
      typeof row.quantity !== "number" ||
      typeof row.syncedAt !== "string" ||
      typeof row.unitPrice !== "number"
    ) {
      return rows;
    }
    const categoryGroup =
      typeof row.categoryGroup === "string" ? row.categoryGroup : undefined;
    const billingCategory = mapBillingCategory(
      typeof row.billingCategory === "string" ? row.billingCategory : undefined,
      categoryGroup,
    );
    rows.push({
      ...row,
      ...(categoryGroup ? { categoryGroup } : {}),
      ...(billingCategory ? { billingCategory } : {}),
    } as BillingInvoiceCandidateLine);
    return rows;
  }, []);
}
