import {
  createMockWorkspacePermissionAdapter,
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";
import { createHash } from "node:crypto";
import { mockEncounters, mockInvoiceLines, mockOrders } from "@/mocks/emr-domain";
import type { EmrOrder, Encounter, InvoiceLine } from "@/types/emr-domain";
import type { ChartOrderSetSelectionIntent } from "@/features/hospital-admin/server-order-catalog-core";
import { createMockOrderCatalogGateway } from "@/features/hospital-admin/server-order-catalog-core";

export type ChartOrderQuantitySource =
  | "fixed_one"
  | "preset_quantity"
  | "manual_at_apply";
export type ChartOrderReadbackQuantitySource =
  | ChartOrderQuantitySource
  | "manual"
  | "days"
  | "total_count"
  | "dispense_quantity"
  | "actual_dispense_quantity";

export type ChartOrderRuntimeRow = {
  orderId: string;
  workspaceId?: string;
  encounterId: string;
  rowType: "individual" | "set" | "set_child";
  orderType: "set" | "lab" | "imaging" | "dispensing" | "treatment";
  parentOrderId: string | null;
  sourceSetId: string | null;
  sourceSetRevisionId: string | null;
  sourceSetRevisionNo: number | null;
  sourceSetVersion: string | null;
  sourceSetRevisionItemId: string | null;
  workspaceCatalogItemId: string | null;
  workspaceCatalogRevision: number | null;
  quantity: number;
  quantitySource: ChartOrderReadbackQuantitySource;
  unitPriceSnapshot: number | null;
  lineTotalSnapshot: number;
  snapshotSchemaVersion: 0 | 1;
  snapshotHash: string | null;
  appliedSnapshot: Record<string, unknown>;
  appliedPriceSnapshot: Record<string, unknown>;
  calculationInputs: Record<string, unknown>;
  calculationOutputs: Record<string, unknown>;
  billingReflectionEnabled: boolean;
  orderConfirmationStatus?: "draft" | "pending" | "confirmed" | "billed" | "cancelled";
  status?: string;
  updatedAt: string;
};

export type ChartOrderSetLeafIntent = {
  revisionItemId: string;
  selected: boolean;
  quantity: number;
};

export type ChartOrderDraftRowInput =
  | {
      rowType: "individual";
      orderId: string;
      workspaceCatalogItemId: string;
      quantity: number;
    }
  | {
      rowType: "set";
      orderId: string;
      sourceSetId: string;
      sourceSetRevisionId: string;
      sourceSetRevisionNo: number;
      selectionIntent: ChartOrderSetSelectionIntent;
    };

export type ChartOrderDraftInput = {
  encounterId?: string;
  expectedEtag?: string;
  rows?: ChartOrderDraftRowInput[];
};

export type ChartOrderDraftLine = {
  billingDisplayName: string;
  encounterId: string;
  lineTotalSnapshot: number;
  orderId: string;
  quantity: number;
  unitPriceSnapshot: number | null;
  serviceItemId?: string;
  workspaceCatalogItemId?: string;
  sourceMasterRecordId?: string;
  sourceMasterRevision?: number;
  workspaceCatalogRevision?: number;
  appliedSnapshot?: Record<string, unknown>;
  updatedAt: string;
};

export type ChartOrderDraftGatewayResult =
  | {
      ok: true;
      etag: string;
      rows: ChartOrderRuntimeRow[];
    }
  | {
      ok: false;
      status: 400 | 409 | 422 | 428;
      error: string;
    }
  | { ok: false; status: 500; error: "db_read_failed" | "db_write_failed" };

export type ChartOrderDraftGateway = {
  readOrderDraft(input: {
    encounterId: string;
    workspaceId: string;
  }): Promise<ChartOrderDraftGatewayResult>;
  saveOrderDraft(input: {
    actorUserId: string;
    encounterId: string;
    expectedEtag: string;
    rows: ChartOrderDraftRowInput[];
    workspaceId: string;
  }): Promise<ChartOrderDraftGatewayResult>;
};

export type ChartOrderDraftReadResult =
  | {
      ok: true;
      etag: string;
      rows: ChartOrderRuntimeRow[];
      status: 200;
      enforcedBy: "chart-order-draft-persistence";
    }
  | {
      ok: false;
      status: 400;
      error: "invalid_input";
      fieldErrors: Partial<Record<"encounterId" | "expectedEtag" | "rows", string>>;
    }
  | { ok: false; status: 401 | 403; denialReason: WorkspacePermissionDenialReason }
  | { ok: false; status: 409; denialReason: "encounter_unavailable" | "stale_status" | "revision_conflict" | "catalog_revision_requires_refresh" }
  | { ok: false; status: 428; error: "if_match_required" }
  | { ok: false; status: 500; error: "db_read_failed" | "supabase_client_missing" };

export type ChartOrderDraftSaveResult =
  | {
      ok: true;
      etag: string;
      rows: ChartOrderRuntimeRow[];
      status: 200;
      enforcedBy: "chart-order-draft-persistence";
    }
  | {
      ok: false;
      status: 400;
      error: "invalid_input";
      fieldErrors: Partial<Record<"encounterId" | "expectedEtag" | "rows", string>>;
    }
  | { ok: false; status: 401 | 403; denialReason: WorkspacePermissionDenialReason }
  | { ok: false; status: 409; denialReason: "encounter_unavailable" | "stale_status" | "revision_conflict" | "catalog_revision_requires_refresh" | "idempotency_conflict" }
  | { ok: false; status: 422; error: string }
  | { ok: false; status: 428; error: "if_match_required" }
  | { ok: false; status: 500; error: "db_write_failed" | "supabase_client_missing" };

const mockOrderDraftStore = new Map<string, ChartOrderDraftLine[]>();
const mockOrderDraftRuntimeStore = new Map<string, ChartOrderRuntimeRow[]>();

export function getMockChartOrderDraftRuntimeRows({
  encounterId,
  workspaceId,
}: {
  encounterId: string;
  workspaceId: string;
}) {
  return mockOrderDraftRuntimeStore.get(buildOrderDraftKey(workspaceId, encounterId));
}

export async function readChartOrderDraft({
  actorUserId,
  encounterId,
  gateway = createMockChartOrderDraftGateway(),
  permissionAdapter = createDemoChartOrderDraftPermissionAdapter(),
  workspaceId,
}: {
  actorUserId: string | null;
  encounterId: string | null | undefined;
  gateway?: Pick<ChartOrderDraftGateway, "readOrderDraft">;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<ChartOrderDraftReadResult> {
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

  const result = await gateway.readOrderDraft({ encounterId: normalizedEncounterId, workspaceId });

  if (!result.ok) {
    if (result.status === 409 && result.error === "encounter_unavailable") {
      return {
        ok: false,
        status: 409,
        denialReason: "encounter_unavailable",
      };
    }
    return { ok: false, status: 500, error: "db_read_failed" };
  }

  return {
    ok: true,
    status: 200,
    etag: result.etag,
    rows: result.rows,
    enforcedBy: "chart-order-draft-persistence",
  };
}

export async function saveChartOrderDraft({
  actorUserId,
  gateway = createMockChartOrderDraftGateway(),
  input,
  permissionAdapter = createDemoChartOrderDraftPermissionAdapter(),
  workspaceId,
}: {
  actorUserId: string | null;
  gateway?: Pick<ChartOrderDraftGateway, "saveOrderDraft">;
  input: ChartOrderDraftInput;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<ChartOrderDraftSaveResult> {
  const normalized = normalizeOrderDraftInput(input);
  const validation = validateOrderDraftInput(normalized);

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

  const result = await gateway.saveOrderDraft({
    actorUserId: actorUserId ?? "",
    encounterId: normalized.encounterId,
    expectedEtag: normalized.expectedEtag,
    rows: normalized.rows,
    workspaceId,
  });

  if (!result.ok) {
    if (result.status === 409) {
      if (result.error === "encounter_unavailable") {
        return { ok: false, status: 409, denialReason: "encounter_unavailable" };
      }
      if (result.error === "revision_conflict") {
        return { ok: false, status: 409, denialReason: "revision_conflict" };
      }
      if (result.error === "stale_status") {
        return { ok: false, status: 409, denialReason: "stale_status" };
      }
      if (result.error === "catalog_revision_requires_refresh") {
        return { ok: false, status: 409, denialReason: "catalog_revision_requires_refresh" };
      }
    }
    if (result.status === 428) return { ok: false, status: 428, error: "if_match_required" };
    if (result.status === 422) return { ok: false, status: 422, error: result.error };
    return { ok: false, status: 500, error: "db_write_failed" };
  }

  return {
    ok: true,
    status: 200,
    etag: result.etag,
    rows: result.rows,
    enforcedBy: "chart-order-draft-persistence",
  };
}

export function createMockChartOrderDraftGateway(
  dataset: {
    encounters?: Encounter[];
    invoiceLines?: InvoiceLine[];
    orders?: EmrOrder[];
  } = {
    encounters: mockEncounters,
    invoiceLines: mockInvoiceLines,
    orders: mockOrders,
  },
  now = () => new Date().toISOString()
): ChartOrderDraftGateway {
  const encounters = dataset.encounters ?? [];
  const invoiceLines = dataset.invoiceLines ?? [];
  const orders = dataset.orders ?? [];

  return {
    async readOrderDraft({ encounterId, workspaceId }) {
      const encounter = findEncounter(encounters, workspaceId, encounterId);
      if (!encounter) return { ok: false, status: 409, error: "encounter_unavailable" };
      const seedDrafts = getStoredOrSeedOrderDrafts({ encounterId, invoiceLines, orders, workspaceId });
      const rows =
        getMockChartOrderDraftRuntimeRows({ encounterId, workspaceId }) ??
        seedDraftLinesToRuntimeRows(seedDrafts, workspaceId);
      return {
        ok: true,
        etag: mockChartOrderEtag(rows),
        rows,
      };
    },
    async saveOrderDraft({ encounterId, rows: draftRows, expectedEtag, workspaceId }) {
      const encounter = findEncounter(encounters, workspaceId, encounterId);
      if (!encounter) return { ok: false, status: 409, error: "encounter_unavailable" };
      if (!canMutateChart(encounter)) return { ok: false, status: 409, error: "stale_status" };

      const seedRows = getStoredOrSeedOrderDrafts({ encounterId, invoiceLines, orders, workspaceId });
      const currentRows =
        getMockChartOrderDraftRuntimeRows({ encounterId, workspaceId }) ??
        seedDraftLinesToRuntimeRows(seedRows, workspaceId);
      if (expectedEtag !== mockChartOrderEtag(currentRows)) {
        return { ok: false, status: 409, error: "revision_conflict" };
      }
      const timestamp = now();
      const catalogResult = await createMockOrderCatalogGateway().listChartSearch({
        workspaceId,
      });
      const catalogById = new Map(
        catalogResult.ok
          ? catalogResult.rows
              .filter(
                (row) =>
                  row.rowType === "individual" &&
                  typeof row.workspaceCatalogItemId === "string",
              )
              .map((row) => [row.workspaceCatalogItemId as string, row])
          : [],
      );
      const nextRows = draftRows.map((draft) => {
        const seed = seedRows.find((row) => row.orderId === draft.orderId);
        const catalogRow =
          draft.rowType === "individual" && !seed?.serviceItemId
            ? catalogById.get(draft.workspaceCatalogItemId)
            : undefined;
        const unitPriceSnapshot =
          draft.rowType === "individual"
            ? seed?.unitPriceSnapshot ??
              catalogRow?.appliedSnapshot.appliedPriceKrw ??
              null
            : null;

        return {
          billingDisplayName:
            seed?.billingDisplayName ??
            catalogRow?.billingName ??
            (draft.rowType === "set"
              ? draft.sourceSetId
              : draft.workspaceCatalogItemId),
          encounterId,
          lineTotalSnapshot:
            draft.rowType === "individual"
              ? roundMoney(draft.quantity * (unitPriceSnapshot ?? 0))
              : 0,
          orderId: draft.orderId,
          quantity:
            draft.rowType === "individual" ? draft.quantity : 1,
          unitPriceSnapshot,
          workspaceCatalogItemId:
            draft.rowType === "individual" ? draft.workspaceCatalogItemId : undefined,
          sourceMasterRecordId:
            seed?.sourceMasterRecordId ?? catalogRow?.sourceMasterRecordId,
          sourceMasterRevision:
            seed?.sourceMasterRevision ?? catalogRow?.sourceMasterRevision,
          workspaceCatalogRevision:
            seed?.workspaceCatalogRevision ?? catalogRow?.workspaceCatalogRevision,
          appliedSnapshot:
            seed?.appliedSnapshot ?? catalogRow?.appliedSnapshot,
          updatedAt: timestamp,
        } satisfies ChartOrderDraftLine;
      });

      const setRuntimeRows = await buildMockSetRuntimeRows({
        encounterId,
        draftRows,
        existingRows:
          getMockChartOrderDraftRuntimeRows({ encounterId, workspaceId }) ??
          currentRows,
        now: timestamp,
        workspaceId,
      });
      if (!setRuntimeRows.ok) return setRuntimeRows;

      mockOrderDraftStore.set(buildOrderDraftKey(workspaceId, encounterId), nextRows);
      const runtimeRows = [
        ...nextRows
          .filter((row) => !draftRows.some((draft) => draft.rowType === "set" && draft.orderId === row.orderId))
          .map((row) => seedDraftLinesToRuntimeRows([row], workspaceId)[0]),
        ...setRuntimeRows.rows,
      ].filter((row): row is ChartOrderRuntimeRow => Boolean(row));
      mockOrderDraftRuntimeStore.set(
        buildOrderDraftKey(workspaceId, encounterId),
        runtimeRows,
      );
      // The demo fallback has separate draft/action gateway instances. Keep a
      // newly persisted intent visible to the subsequent action read without
      // giving the client any snapshot authority.
      for (const row of nextRows) {
        if (!row.workspaceCatalogItemId) continue;
        if (orders.some((order) => order.id === row.orderId)) continue;
        const template = orders.find(
          (order) =>
            order.workspaceId === workspaceId &&
            order.encounterId === encounterId &&
            order.status !== "cancelled",
        );
        if (!template) continue;
        orders.push({
          ...template,
          id: row.orderId,
          workspaceId,
          encounterId,
          serviceItemId: undefined,
          workspaceCatalogItemId: row.workspaceCatalogItemId,
          sourceMasterRecordId: row.sourceMasterRecordId,
          sourceMasterRevision: row.sourceMasterRevision,
          workspaceCatalogRevision: row.workspaceCatalogRevision,
          unitPriceSnapshot: row.unitPriceSnapshot,
          appliedSnapshot: row.appliedSnapshot,
          displayName:
            catalogById.get(row.workspaceCatalogItemId ?? "")?.displayName ??
            row.billingDisplayName,
          categoryGroup:
            catalogById.get(row.workspaceCatalogItemId ?? "")?.categoryGroup !==
            "set"
              ? (catalogById.get(row.workspaceCatalogItemId ?? "")
                  ?.categoryGroup as EmrOrder["categoryGroup"] | undefined)
              : undefined,
          orderType: mapCatalogCategoryToOrderType(
            catalogById.get(row.workspaceCatalogItemId ?? "")?.categoryGroup,
          ),
          status: "requested",
          workStatus: "pending",
          requestedAt: timestamp,
          sortOrder: nextRows.indexOf(row) + 1,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      }
      return {
        ok: true,
        etag: mockChartOrderEtag(runtimeRows),
        rows: runtimeRows,
      };
    },
  };
}

export type SupabaseChartOrderDraftRpcClient = {
  rpc(
    functionName: "clair_get_chart_order_draft",
    args: {
      p_workspace_id: string;
      p_encounter_id: string;
    }
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
  rpc(
    functionName: "clair_save_chart_order_draft",
    args: {
      p_workspace_id: string;
      p_actor_user_id: string;
      p_encounter_id: string;
      p_orders: {
        expectedEtag: string;
        rows: ChartOrderDraftRowInput[];
      };
    }
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
};

export function createSupabaseChartOrderDraftGateway(
  client: SupabaseChartOrderDraftRpcClient
): ChartOrderDraftGateway {
  return {
    async readOrderDraft({ encounterId, workspaceId }) {
      const { data, error } = await client.rpc("clair_get_chart_order_draft", {
        p_workspace_id: workspaceId,
        p_encounter_id: encounterId,
      });

      if (error) {
        if (error.message?.includes("encounter_unavailable")) return { ok: false, status: 409, error: "encounter_unavailable" };
        return { ok: false, status: 500, error: "db_read_failed" };
      }

      const mapped = mapOrderDraftResponse(data);
      if (!mapped) return { ok: false, status: 500, error: "db_read_failed" };
      return mapped;
    },
    async saveOrderDraft({ actorUserId, encounterId, expectedEtag, rows, workspaceId }) {
      const { data, error } = await client.rpc("clair_save_chart_order_draft", {
        p_workspace_id: workspaceId,
        p_actor_user_id: actorUserId,
        p_encounter_id: encounterId,
        p_orders: { expectedEtag, rows },
      });

      if (error) {
        if (error.message?.includes("encounter_unavailable")) return { ok: false, status: 409, error: "encounter_unavailable" };
        if (error.message?.includes("stale_status")) return { ok: false, status: 409, error: "stale_status" };
        if (error.message?.includes("revision_conflict")) return { ok: false, status: 409, error: "revision_conflict" };
        if (error.message?.includes("requires_refresh")) return { ok: false, status: 409, error: "catalog_revision_requires_refresh" };
        if (error.message?.includes("if_match_required")) return { ok: false, status: 428, error: "if_match_required" };
        if (error.message?.includes("order_set_")) return { ok: false, status: 422, error: mapChartDraftRpcError(error.message) };
        return { ok: false, status: 500, error: "db_write_failed" };
      }

      const mapped = mapOrderDraftResponse(data);
      if (!mapped) return { ok: false, status: 500, error: "db_write_failed" };
      return mapped;
    },
  };
}

export function createDemoChartOrderDraftPermissionAdapter() {
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

function canMutateChart(encounter: Encounter) {
  return encounter.status === "in_consultation" || encounter.status === "ordered";
}

function getStoredOrSeedOrderDrafts({
  encounterId,
  invoiceLines,
  orders,
  workspaceId,
}: {
  encounterId: string;
  invoiceLines: InvoiceLine[];
  orders: EmrOrder[];
  workspaceId: string;
}) {
  const stored = mockOrderDraftStore.get(buildOrderDraftKey(workspaceId, encounterId));
  if (stored) return stored;

  return orders
    .filter((order) => order.workspaceId === workspaceId && order.encounterId === encounterId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((order) => {
      const invoiceLine = invoiceLines.find((line) => line.orderId === order.id);
      const unitPriceSnapshot = invoiceLine
        ? invoiceLine.unitPrice
        : order.unitPriceSnapshot ?? null;
      const quantity = invoiceLine?.quantity ?? 1;

      return {
        billingDisplayName: invoiceLine?.description ?? order.displayName,
        encounterId,
        lineTotalSnapshot: roundMoney(quantity * (unitPriceSnapshot ?? 0)),
        orderId: order.id,
        quantity,
        unitPriceSnapshot,
        serviceItemId: order.serviceItemId,
        workspaceCatalogItemId: order.workspaceCatalogItemId,
        sourceMasterRecordId: order.sourceMasterRecordId,
        sourceMasterRevision: order.sourceMasterRevision,
        workspaceCatalogRevision: order.workspaceCatalogRevision,
        appliedSnapshot: order.appliedSnapshot,
        updatedAt: order.updatedAt,
      };
    });
}

function buildOrderDraftKey(workspaceId: string, encounterId: string) {
  return `${workspaceId}:${encounterId}`;
}

function normalizeOrderDraftInput(input: ChartOrderDraftInput) {
  const record = input && typeof input === "object"
    ? input as Record<string, unknown>
    : {};
  const hasExactEnvelope = Object.keys(record).every((key) =>
    key === "encounterId" || key === "expectedEtag" || key === "rows",
  );
  return {
    encounterId: trimToUndefined(input.encounterId) ?? "",
    expectedEtag: trimToUndefined(input.expectedEtag) ?? "",
    rows: Array.isArray(input.rows) ? input.rows : [],
    hasRows: Array.isArray(input.rows),
    hasExactEnvelope,
  };
}

function validateOrderDraftInput(input: ReturnType<typeof normalizeOrderDraftInput>) {
  const fieldErrors: Partial<Record<"encounterId" | "expectedEtag" | "rows", string>> = {};

  if (!input.encounterId) fieldErrors.encounterId = "진료 차트를 선택해 주세요.";
  if (!input.hasExactEnvelope || !input.hasRows) {
    fieldErrors.rows = "오더 rows 형식을 확인해 주세요.";
  }
  if (!input.expectedEtag || !/^"[0-9a-f]{64}"$/.test(input.expectedEtag)) {
    fieldErrors.expectedEtag = "오더 버전을 확인해 주세요.";
  }
  if (input.rows.length > 100) fieldErrors.rows = "오더 row가 너무 많습니다.";
  const invalidRows = input.rows.some((row) => !isValidDraftRow(row));
  if (invalidRows) fieldErrors.rows = "오더 선택과 수량을 확인해 주세요.";

  if (Object.keys(fieldErrors).length > 0) {
    return { valid: false as const, fieldErrors };
  }

  return { valid: true as const, fieldErrors: {} };
}

function isValidDraftRow(value: unknown): value is ChartOrderDraftRowInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  if (row.rowType === "individual") {
    return Object.keys(row).length === 4 &&
      typeof row.orderId === "string" && Boolean(row.orderId.trim()) &&
      typeof row.workspaceCatalogItemId === "string" && Boolean(row.workspaceCatalogItemId.trim()) &&
      typeof row.quantity === "number" && Number.isFinite(row.quantity) && row.quantity > 0 && row.quantity <= 999999999.999 && hasThreeDecimalPlaces(row.quantity);
  }
  if (row.rowType !== "set") return false;
  if (Object.keys(row).length !== 6 ||
      typeof row.orderId !== "string" || !row.orderId.trim() ||
      typeof row.sourceSetId !== "string" || !row.sourceSetId.trim() ||
      typeof row.sourceSetRevisionId !== "string" || !row.sourceSetRevisionId.trim() ||
      typeof row.sourceSetRevisionNo !== "number" || !Number.isInteger(row.sourceSetRevisionNo) || row.sourceSetRevisionNo <= 0 ||
      !isValidSelectionIntent(row.selectionIntent)) return false;
  return true;
}

function isValidSelectionIntent(value: unknown): value is ChartOrderSetSelectionIntent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const intent = value as Record<string, unknown>;
  const keys = Object.keys(intent);
  if (
    (keys.length !== 1 && keys.length !== 2) ||
    !keys.every((key) => key === "items" || key === "rangeInput") ||
    !Array.isArray(intent.items)
  ) return false;
  if (
    intent.rangeInput !== undefined &&
    (typeof intent.rangeInput !== "number" ||
      !Number.isFinite(intent.rangeInput) ||
      intent.rangeInput < 0 ||
      intent.rangeInput > 999999999.999 ||
      intent.rangeInput !== Math.round(intent.rangeInput * 1000) / 1000)
  ) return false;
  const ids = new Set<string>();
  return intent.items.every((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const entry = item as Record<string, unknown>;
    if (Object.keys(entry).length !== 3 || typeof entry.revisionItemId !== "string" ||
        !entry.revisionItemId.trim() || typeof entry.selected !== "boolean" ||
        typeof entry.quantity !== "number" || !Number.isFinite(entry.quantity) ||
        entry.quantity <= 0 || entry.quantity > 999999999.999 || !hasThreeDecimalPlaces(entry.quantity) || ids.has(entry.revisionItemId)) return false;
    ids.add(entry.revisionItemId);
    return true;
  });
}

function trimToUndefined(value?: string | null) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function mapCatalogCategoryToOrderType(
  categoryGroup?: string,
): EmrOrder["orderType"] {
  switch (categoryGroup) {
    case "lab":
      return "lab";
    case "imaging":
      return "imaging";
    case "medication":
      return "dispensing";
    default:
      return "treatment";
  }
}

function hasThreeDecimalPlaces(value: number) {
  return value === Math.round(value * 1000) / 1000;
}

function mapOrderDraftResponse(value: unknown): ChartOrderDraftGatewayResult | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  const etag = typeof body.etag === "string" ? body.etag : null;
  const rawRows = Array.isArray(body.rows) ? body.rows : null;
  if (!etag || !rawRows) return null;
  const rows = rawRows.map(mapRuntimeRow).filter(
    (row): row is ChartOrderRuntimeRow => Boolean(row),
  );
  if (rows.length !== rawRows.length) return null;
  return {
    ok: true,
    etag,
    rows,
  };
}

function mapRuntimeRow(value: unknown): ChartOrderRuntimeRow | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.orderId !== "string" || typeof row.encounterId !== "string" ||
      (row.rowType !== "individual" && row.rowType !== "set" && row.rowType !== "set_child") ||
      typeof row.orderType !== "string" || typeof row.quantity !== "number" ||
      typeof row.lineTotalSnapshot !== "number" || typeof row.updatedAt !== "string") return null;
  const quantitySource = row.quantitySource;
  if (!["fixed_one", "preset_quantity", "manual_at_apply", "manual", "days", "total_count", "dispense_quantity", "actual_dispense_quantity"].includes(String(quantitySource))) return null;
  const objectValue = (key: string) =>
    row[key] && typeof row[key] === "object" && !Array.isArray(row[key])
      ? row[key] as Record<string, unknown>
      : {};
  return {
    orderId: row.orderId,
    workspaceId: typeof row.workspaceId === "string" ? row.workspaceId : undefined,
    encounterId: row.encounterId,
    rowType: row.rowType,
    orderType: row.orderType as ChartOrderRuntimeRow["orderType"],
    parentOrderId: row.parentOrderId === null ? null : typeof row.parentOrderId === "string" ? row.parentOrderId : null,
    sourceSetId: row.sourceSetId === null ? null : typeof row.sourceSetId === "string" ? row.sourceSetId : null,
    sourceSetRevisionId: row.sourceSetRevisionId === null ? null : typeof row.sourceSetRevisionId === "string" ? row.sourceSetRevisionId : null,
    sourceSetRevisionNo: typeof row.sourceSetRevisionNo === "number" ? row.sourceSetRevisionNo : null,
    sourceSetVersion: row.sourceSetVersion === null ? null : typeof row.sourceSetVersion === "string" ? row.sourceSetVersion : null,
    sourceSetRevisionItemId: row.sourceSetRevisionItemId === null ? null : typeof row.sourceSetRevisionItemId === "string" ? row.sourceSetRevisionItemId : null,
    workspaceCatalogItemId: row.workspaceCatalogItemId === null ? null : typeof row.workspaceCatalogItemId === "string" ? row.workspaceCatalogItemId : null,
    workspaceCatalogRevision: typeof row.workspaceCatalogRevision === "number" ? row.workspaceCatalogRevision : null,
    quantity: row.quantity,
    quantitySource: quantitySource as ChartOrderReadbackQuantitySource,
    unitPriceSnapshot: row.unitPriceSnapshot === null ? null : typeof row.unitPriceSnapshot === "number" ? row.unitPriceSnapshot : null,
    lineTotalSnapshot: row.lineTotalSnapshot,
    snapshotSchemaVersion: row.snapshotSchemaVersion === 1 ? 1 : 0,
    snapshotHash: row.snapshotHash === null ? null : typeof row.snapshotHash === "string" ? row.snapshotHash : null,
    appliedSnapshot: objectValue("appliedSnapshot"),
    appliedPriceSnapshot: objectValue("appliedPriceSnapshot"),
    calculationInputs: objectValue("calculationInputs"),
    calculationOutputs: objectValue("calculationOutputs"),
    billingReflectionEnabled: row.billingReflectionEnabled !== false,
    orderConfirmationStatus: typeof row.orderConfirmationStatus === "string" ? row.orderConfirmationStatus as ChartOrderRuntimeRow["orderConfirmationStatus"] : undefined,
    status: typeof row.status === "string" ? row.status : undefined,
    updatedAt: row.updatedAt,
  };
}

async function buildMockSetRuntimeRows({
  encounterId,
  draftRows,
  existingRows,
  now,
  workspaceId,
}: {
  encounterId: string;
  draftRows: ChartOrderDraftRowInput[];
  existingRows: ChartOrderRuntimeRow[];
  now: string;
  workspaceId: string;
}): Promise<
  | { ok: true; rows: ChartOrderRuntimeRow[] }
  | { ok: false; status: 400 | 409 | 422; error: string }
> {
  const setRows = draftRows.filter(
    (row): row is Extract<ChartOrderDraftRowInput, { rowType: "set" }> =>
      row.rowType === "set",
  );
  if (setRows.length === 0) return { ok: true, rows: [] };

  const gateway = createMockOrderCatalogGateway();
  const runtimeRows: ChartOrderRuntimeRow[] = [];
  for (const row of setRows) {
    const previewResult = await gateway.previewOrderSet?.({
      encounterId,
      orderSetId: row.sourceSetId,
      revisionId: row.sourceSetRevisionId,
      selectionIntent: row.selectionIntent,
      workspaceId,
    });
    if (!previewResult || !previewResult.ok) {
      return previewResult && !previewResult.ok
        ? {
            ok: false,
            status:
              previewResult.status === 404 ||
              previewResult.status === 401 ||
              previewResult.status === 403
                ? 409
                : previewResult.status === 400
                  ? 400
                  : 422,
            error: previewResult.error,
          }
        : { ok: false, status: 422, error: "order_set_preview_required" };
    }

    const preview = previewResult.preview;
    if (preview.set.sourceSetRevisionNo !== row.sourceSetRevisionNo) {
      return { ok: false, status: 409, error: "revision_conflict" };
    }
    const previousParent = existingRows.find(
      (candidate) =>
        candidate.rowType === "set" &&
        candidate.orderId === row.orderId &&
        candidate.sourceSetId === row.sourceSetId &&
        candidate.sourceSetRevisionId === row.sourceSetRevisionId,
    );
    // The catalog preview is the only mock source for set pricing and
    // composition. Keep the demo projection deliberately thin: live SQL
    // owns the frozen snapshots and hashes, while the mock only preserves
    // the strict runtime row discriminator needed by the chart UI.
    const parentSnapshot = {
      ...preview.set,
      schemaVersion: preview.schemaVersion,
      rowType: "set",
      orderId: row.orderId,
      parentOrderId: null,
      sourceSetRevisionItemId: null,
      rangeInput: preview.pricing.rangeInput,
      selectedRangeId: preview.pricing.selectedRangeId,
      selectionIntent: row.selectionIntent,
      selectionFingerprint: preview.selectionFingerprint,
      items: preview.items,
    } as Record<string, unknown>;
    const parentPriceSnapshot = {
      ...preview.set,
      ...preview.pricing,
      schemaVersion: preview.schemaVersion,
      priceKrw: preview.set.setPriceKrw,
    } as Record<string, unknown>;
    const calculationInputs =
      preview.calculationInputs ??
      ({ selectionIntent: row.selectionIntent } as Record<string, unknown>);
    const calculationOutputs =
      preview.calculationOutputs ??
      ({ ...preview.pricing } as Record<string, unknown>);
    runtimeRows.push({
      orderId: row.orderId,
      workspaceId,
      encounterId,
      rowType: "set",
      orderType: "set",
      parentOrderId: null,
      sourceSetId: preview.set.sourceSetId,
      sourceSetRevisionId: preview.set.sourceSetRevisionId,
      sourceSetRevisionNo: preview.set.sourceSetRevisionNo,
      sourceSetVersion: preview.set.sourceSetVersion,
      sourceSetRevisionItemId: null,
      workspaceCatalogItemId: null,
      workspaceCatalogRevision: null,
      quantity: 1,
      quantitySource: "fixed_one",
      unitPriceSnapshot: preview.set.setPriceKrw,
      lineTotalSnapshot: preview.pricing.finalTotalKrw,
      snapshotSchemaVersion: 1,
      snapshotHash: null,
      appliedSnapshot: parentSnapshot,
      appliedPriceSnapshot: parentPriceSnapshot,
      calculationInputs,
      calculationOutputs,
      billingReflectionEnabled: preview.set.billingReflectionEnabled,
      orderConfirmationStatus: previousParent?.orderConfirmationStatus ?? "draft",
      status: previousParent?.status ?? "requested",
      updatedAt: now,
    });

    for (const item of preview.items.filter((candidate) => candidate.selected)) {
      const previousChild = existingRows.find(
        (candidate) =>
          candidate.rowType === "set_child" &&
          candidate.parentOrderId === row.orderId &&
          candidate.sourceSetRevisionItemId === item.revisionItemId,
      );
      const childOrderId = previousChild?.orderId ?? createMockOrderDraftUuid();
      const itemSnapshot = {
        ...(item.appliedSnapshot ?? {}),
        schemaVersion: preview.schemaVersion,
        rowType: "set_child",
        orderId: childOrderId,
        parentOrderId: row.orderId,
        sourceSetId: preview.set.sourceSetId,
        sourceSetRevisionId: preview.set.sourceSetRevisionId,
        sourceSetRevisionNo: preview.set.sourceSetRevisionNo,
        sourceSetVersion: preview.set.sourceSetVersion,
        sourceSetRevisionItemId: item.revisionItemId,
        selected: item.selected,
        quantity: item.quantity,
        quantitySource: item.quantitySource,
        billingReflectionEnabled: item.billingReflectionEnabled,
        selectionFingerprint: preview.selectionFingerprint,
      } as Record<string, unknown>;
      const childPriceSnapshot = {
        ...(item.appliedSnapshot ?? {}),
        schemaVersion: preview.schemaVersion,
        priceKrw: item.priceKrw,
        quantity: item.quantity,
        taxType: item.taxType,
        billingReflectionEnabled: item.billingReflectionEnabled,
      } as Record<string, unknown>;
      const childCalculationInputs = calculationInputs;
      const childCalculationOutputs = calculationOutputs;
      const childLineTotal =
        typeof itemSnapshot.lineTotalSnapshot === "number"
          ? itemSnapshot.lineTotalSnapshot
          : 0;
      runtimeRows.push({
        orderId: childOrderId,
        workspaceId,
        encounterId,
        rowType: "set_child",
        orderType: mapCatalogCategoryToOrderType(
          typeof itemSnapshot.categoryGroup === "string"
            ? itemSnapshot.categoryGroup
            : undefined,
        ),
        parentOrderId: row.orderId,
        sourceSetId: preview.set.sourceSetId,
        sourceSetRevisionId: preview.set.sourceSetRevisionId,
        sourceSetRevisionNo: preview.set.sourceSetRevisionNo,
        sourceSetVersion: preview.set.sourceSetVersion,
        sourceSetRevisionItemId: item.revisionItemId,
        workspaceCatalogItemId: item.workspaceCatalogItemId,
        workspaceCatalogRevision: item.appliedCatalogRevision,
        quantity: item.quantity,
        quantitySource: item.quantitySource,
        unitPriceSnapshot: item.priceKrw,
        lineTotalSnapshot: childLineTotal,
        snapshotSchemaVersion: 1,
        snapshotHash: null,
        appliedSnapshot: itemSnapshot,
        appliedPriceSnapshot: childPriceSnapshot,
        calculationInputs: childCalculationInputs,
        calculationOutputs: childCalculationOutputs,
        billingReflectionEnabled: item.billingReflectionEnabled,
        orderConfirmationStatus: previousChild?.orderConfirmationStatus ?? "draft",
        status: previousChild?.status ?? "requested",
        updatedAt: now,
      });
    }
  }

  return { ok: true, rows: runtimeRows };
}

function createMockOrderDraftUuid() {
  return `10000000-0000-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, "0")}`;
}

function seedDraftLinesToRuntimeRows(rows: ChartOrderDraftLine[], workspaceId: string): ChartOrderRuntimeRow[] {
  return rows.map((row) => ({
    orderId: row.orderId,
    workspaceId,
    encounterId: row.encounterId,
    rowType: "individual",
    orderType: "treatment",
    parentOrderId: null,
    sourceSetId: null,
    sourceSetRevisionId: null,
    sourceSetRevisionNo: null,
    sourceSetVersion: null,
    sourceSetRevisionItemId: null,
    workspaceCatalogItemId: row.workspaceCatalogItemId ?? null,
    workspaceCatalogRevision: row.workspaceCatalogRevision ?? null,
    quantity: row.quantity,
    quantitySource: "manual",
    unitPriceSnapshot: row.unitPriceSnapshot,
    lineTotalSnapshot: row.lineTotalSnapshot,
    snapshotSchemaVersion: 0,
    snapshotHash: null,
    appliedSnapshot: row.appliedSnapshot ?? {},
    appliedPriceSnapshot: {},
    calculationInputs: {},
    calculationOutputs: {},
    billingReflectionEnabled: true,
    orderConfirmationStatus: "draft",
    status: "requested",
    updatedAt: row.updatedAt,
  }));
}

function mockChartOrderEtag(rows: ChartOrderRuntimeRow[]) {
  return `"${createHash("sha256").update(JSON.stringify(rows)).digest("hex")}"`;
}

function mapChartDraftRpcError(message: string) {
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
  return known.find((code) => message.includes(code)) ?? "invalid_order_rows";
}
