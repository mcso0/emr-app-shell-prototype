import { readChartOrderRequester, type ChartOrderRequester } from "./order-requester";
import { getMockEncounterCharts } from "@/features/chart/server-soap-note-persistence-core";
import { readPersistedOrderDefaults } from "@/features/hospital-admin/persisted-order-defaults";
import {
  createMockWorkspacePermissionAdapter,
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";
import { createHash } from "node:crypto";
import { mockEncounters, mockInvoiceLines, mockOrders } from "@/mocks/emr-domain";
import type { EmrOrder, Encounter, InvoiceLine } from "@/types/emr-domain";
import type {
  OrderCatalogGateway,
  ChartOrderSetSelectionIntent,
  DispensingOrderLineageSnapshot,
} from "@/features/hospital-admin/server-order-catalog-core";
import {
  createMockOrderCatalogGateway,
  mapDispensingOrderLineageSnapshot,
} from "@/features/hospital-admin/server-order-catalog-core";
import {
  CLINICAL_ORDER_DESTINATION_MODULES,
  isClinicalOrderType,
  resolveClinicalOrderMasterContract,
  validateClinicalOrderDetailInputs,
} from "@/features/chart/order-execution-domain";
import {
  createMockChartOrderBillingSummaryFromMutationRows,
  mapChartOrderBillingSummary,
  type ChartOrderBillingSummary,
} from "@/features/chart/chart-order-billing-summary-contract";
import type {
  ClinicalOrderDestinationModule,
  ClinicalOrderExecutionMode,
  ClinicalOrderPriority,
  ClinicalOrderType,
} from "@/types/emr-domain";

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

export type ChartOrderRuntimeRow = ChartOrderRequester & {
  instruction?: string;
  originChartId?: string | null;
  orderId: string;
  workspaceId?: string;
  encounterId: string;
  rowType: "individual" | "set" | "set_child";
  orderType: "set" | "lab" | "imaging" | "dispensing" | "treatment";
  clinicalOrderType: ClinicalOrderType;
  destinationModule: ClinicalOrderDestinationModule | null;
  executionMode: ClinicalOrderExecutionMode;
  detailInputs: Record<string, unknown>;
  detailSchemaVersion: number;
  priority: ClinicalOrderPriority;
  billingEligible: boolean;
  revisionNo: number;
  parentOrderId: string | null;
  sourceSetId: string | null;
  sourceSetRevisionId: string | null;
  sourceSetRevisionNo: number | null;
  sourceSetVersion: string | null;
  sourceSetRevisionItemId: string | null;
  workspaceCatalogItemId: string | null;
  workspaceCatalogRevision: number | null;
  dispensingAuthoritySnapshot?: Record<string, unknown>;
  dispensingLineage: DispensingOrderLineageSnapshot | null;
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
  billingAdjustmentReasons?: string[];
  preBillingOverride?: Record<string, unknown>;
  billingCandidateStatus?:
    | "candidate_created"
    | "billing_review_required"
    | "invoice_linked"
    | "cancelled";
  billingReflectionEnabled: boolean;
  intendedAssigneeUserId?: string | null;
  orderConfirmationStatus?: "draft" | "pending" | "confirmed" | "billed" | "cancelled";
  status?: string;
  updatedAt: string;
};

export type ChartOrderSetLeafIntent = {
  revisionItemId: string;
  selected: boolean;
  quantity: number;
};

export type ChartOrderDraftEditableValues = {
  detailInputs?: Record<string, unknown>;
  detailSchemaVersion?: number;
  priority?: ClinicalOrderPriority;
};

export type ChartOrderSetChildDraftInput = {
  revisionItemId: string;
  detailInputs: Record<string, unknown>;
  detailSchemaVersion: number;
  priority: ClinicalOrderPriority;
};

export type ChartOrderDraftRowInput =
  | {
      rowType: "individual";
      orderId: string;
      workspaceCatalogItemId: string;
      quantity: number;
    } & ChartOrderDraftEditableValues
  | {
      rowType: "set";
      instruction?: string;
      orderId: string;
      sourceSetId: string;
      sourceSetRevisionId: string;
      sourceSetRevisionNo: number;
      selectionIntent: ChartOrderSetSelectionIntent;
      childInputs?: ChartOrderSetChildDraftInput[];
    } & ChartOrderDraftEditableValues;

export type ChartOrderDraftInput = {
  chartId?: string;
  encounterId?: string;
  expectedEtag?: string;
  removedOrderIds?: string[];
  rows?: ChartOrderDraftRowInput[];
};

export type ChartOrderDraftLine = {
  originChartId?: string | null;
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
  dispensingLineage?: DispensingOrderLineageSnapshot;
  appliedSnapshot?: Record<string, unknown>;
  clinicalOrderType?: ClinicalOrderType;
  destinationModule?: ClinicalOrderDestinationModule | null;
  executionMode?: ClinicalOrderExecutionMode;
  detailInputs?: Record<string, unknown>;
  detailSchemaVersion?: number;
  priority?: ClinicalOrderPriority;
  billingEligible?: boolean;
  revisionNo?: number;
  updatedAt: string;
};

export type ChartOrderDraftGatewayResult =
  | {
      ok: true;
      billingSummary?: ChartOrderBillingSummary;
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
    chartId?: string;
    actorUserId: string;
    encounterId: string;
    expectedEtag: string;
    removedOrderIds?: string[];
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
      fieldErrors: Partial<Record<"encounterId" | "expectedEtag" | "removedOrderIds" | "rows", string>>;
    }
  | { ok: false; status: 401 | 403; denialReason: WorkspacePermissionDenialReason }
  | { ok: false; status: 409; denialReason: "encounter_unavailable" | "stale_status" | "revision_conflict" | "catalog_revision_requires_refresh" }
  | { ok: false; status: 428; error: "if_match_required" }
  | { ok: false; status: 500; error: "db_read_failed" | "supabase_client_missing" };

export type ChartOrderDraftSaveResult =
  | {
      ok: true;
      billingSummary: ChartOrderBillingSummary;
      etag: string;
      rows: ChartOrderRuntimeRow[];
      status: 200;
      enforcedBy: "chart-order-draft-persistence";
    }
  | {
      ok: false;
      status: 400;
      error: "invalid_input";
      fieldErrors: Partial<Record<"encounterId" | "expectedEtag" | "removedOrderIds" | "rows", string>>;
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

export function getMockChartOrderDraftEtag({
  encounterId,
  workspaceId,
}: {
  encounterId: string;
  workspaceId: string;
}) {
  const rows = getMockChartOrderDraftRuntimeRows({ encounterId, workspaceId });
  return rows ? mockChartOrderEtag(rows) : undefined;
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

  const result = await gateway.saveOrderDraft({
    chartId: normalized.chartId,
    actorUserId: actorUserId ?? "",
    encounterId: normalized.encounterId,
    expectedEtag: normalized.expectedEtag,
    removedOrderIds: normalized.removedOrderIds,
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

  if (!result.billingSummary) {
    return { ok: false, status: 500, error: "db_write_failed" };
  }

  return {
    ok: true,
    status: 200,
    billingSummary: result.billingSummary,
    etag: result.etag,
    rows: result.rows,
    enforcedBy: "chart-order-draft-persistence",
  };
}

export function createMockChartOrderDraftGateway(
  dataset: {
    catalogGateway?: Pick<
      OrderCatalogGateway,
      "listChartSearch" | "previewOrderSet"
    >;
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
  const catalogGateway =
    dataset.catalogGateway ?? createMockOrderCatalogGateway();

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
    async saveOrderDraft({ chartId, encounterId, removedOrderIds = [], rows: draftRows, expectedEtag, workspaceId }) {
      const encounter = findEncounter(encounters, workspaceId, encounterId);
      if (!encounter) return { ok: false, status: 409, error: "encounter_unavailable" };
      if (!canMutateChart(encounter)) return { ok: false, status: 409, error: "stale_status" };

      const seedRows = getStoredOrSeedOrderDrafts({ encounterId, invoiceLines, orders, workspaceId });
      const currentRows =
        getMockChartOrderDraftRuntimeRows({ encounterId, workspaceId }) ??
        seedDraftLinesToRuntimeRows(seedRows, workspaceId);
      const charts = getMockEncounterCharts(workspaceId, encounterId);
      const chart = charts.find((row) => row.id === chartId);
      if (chartId && (!chart || (chart.status !== "draft" && chart.status !== "autosaved"))) return { ok: false, status: 409, error: "chart_unavailable" };
      const targetIds = [...draftRows.map((row) => row.orderId), ...removedOrderIds];
      if (currentRows.some((row) => targetIds.includes(row.orderId) && (row.originChartId ?? null) !== (chartId ?? null))) {
        return { ok: false, status: 409, error: "order_chart_mismatch" };
      }
      if (!chartId && charts.length && draftRows.some((row) => !currentRows.some((existing) => existing.orderId === row.orderId))) {
        return { ok: false, status: 409, error: "chart_id_required" };
      }
      if (expectedEtag !== mockChartOrderEtag(currentRows)) {
        return { ok: false, status: 409, error: "revision_conflict" };
      }
      const submittedOrderIds = new Set(draftRows.map((row) => row.orderId));
      const removedRootOrderIds = new Set(removedOrderIds);
      const invalidRemoval = removedOrderIds.some((orderId) => {
        const row = currentRows.find((candidate) => candidate.orderId === orderId);
        return !row || row.rowType === "set_child" || submittedOrderIds.has(orderId);
      });
      if (invalidRemoval) {
        return { ok: false, status: 422, error: "invalid_removed_order_ids" };
      }
      const timestamp = now();
      const catalogResult = await catalogGateway.listChartSearch({
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
        const legacyOrder = orders.find(
          (order) =>
            order.workspaceId === workspaceId && order.id === draft.orderId,
        );
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
        const canonical =
          catalogRow?.clinicalOrderType &&
          catalogRow.executionMode &&
          catalogRow.destinationModule !== undefined
          ? {
              clinicalOrderType: catalogRow.clinicalOrderType,
              destinationModule: catalogRow.destinationModule,
              executionMode: catalogRow.executionMode,
            }
          : catalogRow
            ? resolveMockDraftCanonicalContract({
                categoryGroup: catalogRow.categoryGroup,
              })
            : legacyOrder
              ? resolveMockDraftCanonicalContract({
                  categoryGroup: legacyOrder.categoryGroup,
                  legacyOrderType: legacyOrder.orderType,
                })
              : resolveMockDraftCanonicalContract({ existing: seed });
        const detailInputs = mergeConsultationResponsibleClinician({
          clinicalOrderType: canonical.clinicalOrderType,
          detailInputs:
            draft.detailInputs ??
            seed?.detailInputs ??
            readMockCatalogDefaultDetailInputs(catalogRow?.appliedSnapshot),
          primaryVeterinarianId: encounter.primaryVeterinarianId,
        });
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
              ? calculateMockCatalogLineTotal({
                  appliedSnapshot: catalogRow?.appliedSnapshot,
                  quantity: draft.quantity,
                  unitPrice: unitPriceSnapshot,
                })
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
          dispensingLineage:
            seed?.dispensingLineage ?? catalogRow?.dispensingLineage,
          appliedSnapshot:
            seed?.appliedSnapshot ?? catalogRow?.appliedSnapshot,
          clinicalOrderType: canonical.clinicalOrderType,
          destinationModule: canonical.destinationModule,
          executionMode: canonical.executionMode,
          detailInputs,
          detailSchemaVersion:
            draft.detailSchemaVersion ?? seed?.detailSchemaVersion ?? 1,
          priority: draft.priority ?? seed?.priority ?? "normal",
          billingEligible: seed?.billingEligible ?? true,
          revisionNo: seed?.revisionNo ?? 0,
          updatedAt: timestamp,
        } satisfies ChartOrderDraftLine;
      });
      for (const draft of draftRows) {
        if (draft.rowType !== "individual" || !draft.detailInputs) continue;
        const persisted = nextRows.find((row) => row.orderId === draft.orderId);
        if (
          !persisted?.clinicalOrderType ||
          !validateClinicalOrderDetailInputs({
            clinicalOrderType: persisted.clinicalOrderType,
            detailInputs: persisted.detailInputs,
            requireComplete: false,
            schemaVersion: draft.detailSchemaVersion ?? 1,
          }).valid
        ) {
          return { ok: false, status: 422, error: "detail_inputs_invalid" };
        }
      }

      const setRuntimeRows = await buildMockSetRuntimeRows({
        encounterId,
        draftRows,
        existingRows:
          getMockChartOrderDraftRuntimeRows({ encounterId, workspaceId }) ??
          currentRows,
        now: timestamp,
        primaryVeterinarianId: encounter.primaryVeterinarianId,
        catalogGateway,
        workspaceId,
      });
      if (!setRuntimeRows.ok) return setRuntimeRows;

      mockOrderDraftStore.set(buildOrderDraftKey(workspaceId, encounterId), nextRows);
      const submittedRuntimeRows = [
        ...nextRows
          .filter((row) => !draftRows.some((draft) => draft.rowType === "set" && draft.orderId === row.orderId))
          .map((row) => seedDraftLinesToRuntimeRows([row], workspaceId)[0]),
        ...setRuntimeRows.rows,
      ].filter((row): row is ChartOrderRuntimeRow => Boolean(row));
      const runtimeRows = [
        ...currentRows.filter(
          (row) =>
            !submittedOrderIds.has(row.orderId) &&
            !removedRootOrderIds.has(row.orderId) &&
            !(row.parentOrderId && removedRootOrderIds.has(row.parentOrderId)),
        ),
        ...submittedRuntimeRows.map((row) => ({ ...row, originChartId: chartId ?? null })),
      ];
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
          originChartId: chartId,
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
      const etag = mockChartOrderEtag(runtimeRows);
      return {
        ok: true,
        billingSummary: createMockChartOrderBillingSummaryFromMutationRows({
          encounterId,
          etag,
          rows: runtimeRows,
          workspaceId,
        }),
        etag,
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
    functionName: "clair_save_chart_order_draft" | "clair_save_chart_order_draft_for_chart",
    args: {
      p_chart_id?: string;
      p_workspace_id: string;
      p_actor_user_id: string;
      p_encounter_id: string;
      p_orders: {
        expectedEtag: string;
        removedOrderIds: string[];
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
        const chartError = ["order_chart_mismatch", "chart_id_required", "signed_chart_read_only", "chart_unavailable"].find((reason) => error.message?.includes(reason));
        if (chartError) return { ok: false, status: 409, error: chartError };
        if (error.message?.includes("encounter_unavailable")) return { ok: false, status: 409, error: "encounter_unavailable" };
        return { ok: false, status: 500, error: "db_read_failed" };
      }

      const mapped = mapOrderDraftResponse(data);
      if (!mapped) return { ok: false, status: 500, error: "db_read_failed" };
      return mapped;
    },
    async saveOrderDraft({ actorUserId, chartId, encounterId, expectedEtag, removedOrderIds = [], rows, workspaceId }) {
      const { data, error } = await client.rpc(chartId ? "clair_save_chart_order_draft_for_chart" : "clair_save_chart_order_draft", {
        ...(chartId ? { p_chart_id: chartId } : {}),
        p_workspace_id: workspaceId,
        p_actor_user_id: actorUserId,
        p_encounter_id: encounterId,
        p_orders: { expectedEtag, removedOrderIds, rows },
      });

      if (error) {
        const chartError = ["order_chart_mismatch", "chart_id_required", "signed_chart_read_only", "chart_unavailable"].find((reason) => error.message?.includes(reason));
        if (chartError) return { ok: false, status: 409, error: chartError };
        if (error.message?.includes("encounter_unavailable")) return { ok: false, status: 409, error: "encounter_unavailable" };
        if (error.message?.includes("stale_status")) return { ok: false, status: 409, error: "stale_status" };
        if (error.message?.includes("revision_conflict")) return { ok: false, status: 409, error: "revision_conflict" };
        if (error.message?.includes("requires_refresh")) return { ok: false, status: 409, error: "catalog_revision_requires_refresh" };
        if (error.message?.includes("if_match_required")) return { ok: false, status: 428, error: "if_match_required" };
        if (
          error.message?.includes("invalid_removed_order_ids") ||
          error.message?.includes("order_removal_unavailable") ||
          error.message?.includes("order_removal_has_downstream_artifacts")
        ) return { ok: false, status: 422, error: mapChartDraftRpcError(error.message) };
        if (
          error.message?.includes("detail_inputs_invalid") ||
          error.message?.includes("child_detail_inputs_invalid") ||
          error.message?.includes("set_child_input_unavailable")
        ) return { ok: false, status: 422, error: mapChartDraftRpcError(error.message) };
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

function mergeConsultationResponsibleClinician({
  clinicalOrderType,
  detailInputs,
  primaryVeterinarianId,
}: {
  clinicalOrderType: ClinicalOrderType;
  detailInputs: Record<string, unknown>;
  primaryVeterinarianId?: string;
}) {
  const normalizedPrimaryVeterinarianId = primaryVeterinarianId?.trim();
  if (clinicalOrderType !== "consultation") {
    return detailInputs;
  }
  const nextDetailInputs = { ...detailInputs };
  if (!normalizedPrimaryVeterinarianId) {
    delete nextDetailInputs.responsibleClinicianId;
    return nextDetailInputs;
  }
  return {
    ...nextDetailInputs,
    responsibleClinicianId: normalizedPrimaryVeterinarianId,
  };
}

function readMockCatalogDefaultDetailInputs(
  appliedSnapshot: Record<string, unknown> | undefined,
): Record<string, unknown> {
  return readPersistedOrderDefaults(appliedSnapshot ?? {}).values ?? {};
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
}): ChartOrderDraftLine[] {
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
      const canonical = resolveMockDraftCanonicalContract({
        categoryGroup: order.categoryGroup,
        legacyOrderType: order.orderType,
      });

      return {
        billingDisplayName: invoiceLine?.description ?? order.displayName,
        encounterId,
        originChartId: order.originChartId ?? null,
        lineTotalSnapshot: calculateMockCatalogLineTotal({
          appliedSnapshot: order.appliedSnapshot,
          quantity,
          unitPrice: unitPriceSnapshot,
        }),
        orderId: order.id,
        quantity,
        unitPriceSnapshot,
        serviceItemId: order.serviceItemId,
        workspaceCatalogItemId: order.workspaceCatalogItemId,
        sourceMasterRecordId: order.sourceMasterRecordId,
        sourceMasterRevision: order.sourceMasterRevision,
        workspaceCatalogRevision: order.workspaceCatalogRevision,
        appliedSnapshot: order.appliedSnapshot,
        ...canonical,
        detailInputs: getMockSeedDetailInputs(order, canonical.clinicalOrderType),
        detailSchemaVersion: 1,
        priority: order.priority === "urgent" ? "urgent" : "normal",
        billingEligible:
          order.appliedSnapshot?.billingReflectionEnabled !== false,
        revisionNo: 0,
        updatedAt: order.updatedAt,
      } satisfies ChartOrderDraftLine;
    });
}

function getMockSeedDetailInputs(
  order: EmrOrder,
  clinicalOrderType: ClinicalOrderType,
): Record<string, unknown> {
  if (order.id === "order-kong-maropitant") {
    return {
      doseBasis: "patient",
      dose: 16,
      doseUnit: "mg",
      route: "PO",
      frequency: "once",
      durationDays: 1,
      totalQuantity: 1,
    };
  }
  if (order.id === "order-kong-cbc") {
    return {
      specimenType: "blood",
      testPanel: "CBC",
      collectionCondition: "EDTA 전혈",
    };
  }
  if (order.id === "order-kong-fluid") {
    return {
      method: "피하 수액",
      site: "등쪽 피하",
      administeredAmount: 100,
      frequency: "once",
      schedule: "즉시",
    };
  }
  if (order.id === "order-kong-abdomen") {
    return {
      bodyRegion: "복부",
      position: "VD/LAT",
      viewCount: 2,
      contrastRequired: false,
      sedationRequired: false,
    };
  }

  const instruction = order.instruction?.trim() || order.displayName;
  switch (clinicalOrderType) {
    case "consultation":
      return {
        responsibleClinicianId: order.requestedByUserId,
        occurrenceCount: 1,
        timing: "now",
        instructionSummary: instruction,
      };
    case "clinical_lab":
      return {
        specimenType: "blood",
        testPanel: order.displayName,
        collectionCondition: instruction,
      };
    case "imaging":
      return {
        bodyRegion: order.displayName,
        position: "standard",
        viewCount: 1,
        contrastRequired: false,
        sedationRequired: false,
      };
    case "external_lab":
      return {
        providerId: "mock-external-lab",
        specimenType: "blood",
        testItem: order.displayName,
        shippingCondition: instruction,
      };
    case "dispensing":
      return {
        doseBasis: "patient",
        dose: 1,
        doseUnit: "tablet",
        route: "PO",
        frequency: "once",
        durationDays: 1,
        totalQuantity: 1,
      };
    case "treatment":
      return {
        method: order.displayName,
        site: "patient",
        administeredAmount: 1,
        frequency: "once",
        schedule: instruction,
      };
    case "hospitalization":
      return {
        durationDays: 1,
        wardOrCage: "mock-ward",
        careLevel: "standard",
        monitoringInterval: 60,
      };
    case "system_exam":
      return {
        bodySystem: "전신상태·활력",
        examScope: "전신 상태와 활력 평가",
        examMethod: "표준 신체검사",
        findingSummary: instruction,
      };
    case "other":
      return { structuredValue: instruction };
  }
}

function buildOrderDraftKey(workspaceId: string, encounterId: string) {
  return `${workspaceId}:${encounterId}`;
}

function normalizeOrderDraftInput(input: ChartOrderDraftInput) {
  const record = input && typeof input === "object"
    ? input as Record<string, unknown>
    : {};
  const hasExactEnvelope = Object.keys(record).every((key) =>
    key === "chartId" || key === "encounterId" || key === "expectedEtag" || key === "removedOrderIds" || key === "rows",
  );
  return {
    encounterId: trimToUndefined(input.encounterId) ?? "",
    chartId: trimToUndefined(input.chartId),
    expectedEtag: trimToUndefined(input.expectedEtag) ?? "",
    removedOrderIds: Array.isArray(input.removedOrderIds)
      ? input.removedOrderIds.map((orderId) => trimToUndefined(orderId) ?? "")
      : [],
    hasRemovedOrderIds:
      input.removedOrderIds === undefined || Array.isArray(input.removedOrderIds),
    rows: Array.isArray(input.rows) ? input.rows : [],
    hasRows: Array.isArray(input.rows),
    hasExactEnvelope,
  };
}

function validateOrderDraftInput(input: ReturnType<typeof normalizeOrderDraftInput>) {
  const fieldErrors: Partial<Record<"encounterId" | "expectedEtag" | "removedOrderIds" | "rows", string>> = {};

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
  const submittedOrderIds = new Set(input.rows.map((row) => row.orderId));
  if (
    !input.hasRemovedOrderIds ||
    input.removedOrderIds.length > 100 ||
    input.removedOrderIds.some((orderId) => !orderId) ||
    new Set(input.removedOrderIds).size !== input.removedOrderIds.length ||
    input.removedOrderIds.some((orderId) => submittedOrderIds.has(orderId))
  ) {
    fieldErrors.removedOrderIds = "삭제할 오더 후보를 확인해 주세요.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { valid: false as const, fieldErrors };
  }

  return { valid: true as const, fieldErrors: {} };
}

function isValidDraftRow(value: unknown): value is ChartOrderDraftRowInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  if (row.rowType === "individual") {
    return hasOnlyKeys(row, [
      "rowType",
      "orderId",
      "workspaceCatalogItemId",
      "quantity",
      "detailInputs",
      "detailSchemaVersion",
      "priority",
    ]) &&
      typeof row.orderId === "string" && Boolean(row.orderId.trim()) &&
      typeof row.workspaceCatalogItemId === "string" && Boolean(row.workspaceCatalogItemId.trim()) &&
      typeof row.quantity === "number" && Number.isFinite(row.quantity) && row.quantity > 0 && row.quantity <= 999999999.999 && hasThreeDecimalPlaces(row.quantity) &&
      isValidEditableDraftValues(row);
  }
  if (row.rowType !== "set") return false;
  if (!hasOnlyKeys(row, [
        "rowType",
        "orderId",
        "sourceSetId",
        "sourceSetRevisionId",
        "sourceSetRevisionNo",
        "selectionIntent",
        "instruction",
        "detailInputs",
        "detailSchemaVersion",
        "priority",
        "childInputs",
      ]) ||
      typeof row.orderId !== "string" || !row.orderId.trim() ||
      typeof row.sourceSetId !== "string" || !row.sourceSetId.trim() ||
      typeof row.sourceSetRevisionId !== "string" || !row.sourceSetRevisionId.trim() ||
      typeof row.sourceSetRevisionNo !== "number" || !Number.isInteger(row.sourceSetRevisionNo) || row.sourceSetRevisionNo <= 0 ||
      (row.instruction !== undefined && (typeof row.instruction !== "string" || row.instruction.length > 5000)) ||
      !isValidSelectionIntent(row.selectionIntent) ||
      !isValidEditableDraftValues(row) ||
      !isValidSetChildInputs(row.childInputs)) return false;
  return true;
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: string[]) {
  const keys = Object.keys(value);
  return keys.every((key) => allowed.includes(key));
}

function isValidEditableDraftValues(value: Record<string, unknown>) {
  const hasDetails = Object.hasOwn(value, "detailInputs");
  const hasVersion = Object.hasOwn(value, "detailSchemaVersion");
  if (hasDetails !== hasVersion) return false;
  if (
    hasDetails &&
    (!value.detailInputs ||
      typeof value.detailInputs !== "object" ||
      Array.isArray(value.detailInputs) ||
      typeof value.detailSchemaVersion !== "number" ||
      !Number.isInteger(value.detailSchemaVersion) ||
      value.detailSchemaVersion <= 0)
  ) return false;
  return value.priority === undefined ||
    value.priority === "normal" ||
    value.priority === "urgent";
}

function isValidSetChildInputs(value: unknown) {
  if (value === undefined) return true;
  if (!Array.isArray(value)) return false;
  const ids = new Set<string>();
  return value.every((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
    const row = entry as Record<string, unknown>;
    if (
      Object.keys(row).length !== 4 ||
      !hasOnlyKeys(row, [
        "revisionItemId",
        "detailInputs",
        "detailSchemaVersion",
        "priority",
      ]) ||
      typeof row.revisionItemId !== "string" ||
      !row.revisionItemId.trim() ||
      ids.has(row.revisionItemId) ||
      !isValidEditableDraftValues(row) ||
      !Object.hasOwn(row, "detailInputs") ||
      (row.priority !== "normal" && row.priority !== "urgent")
    ) return false;
    ids.add(row.revisionItemId);
    return true;
  });
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

function calculateMockCatalogLineTotal({
  appliedSnapshot,
  quantity,
  unitPrice,
}: {
  appliedSnapshot?: Record<string, unknown>;
  quantity: number;
  unitPrice: number | null;
}) {
  const amountBasis =
    appliedSnapshot?.appliedAmountBasis ?? appliedSnapshot?.amountBasis;
  return roundMoney(
    amountBasis === "fixed_order_price"
      ? (unitPrice ?? 0)
      : quantity * (unitPrice ?? 0),
  );
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

function resolveMockDraftCanonicalContract({
  categoryGroup,
  existing,
  legacyOrderType,
}: {
  categoryGroup?: string;
  existing?: Partial<ChartOrderDraftLine>;
  legacyOrderType?: unknown;
}): {
  clinicalOrderType: ClinicalOrderType;
  destinationModule: ClinicalOrderDestinationModule | null;
  executionMode: ClinicalOrderExecutionMode;
} {
  if (
    existing?.clinicalOrderType &&
    existing.executionMode &&
    existing.destinationModule !== undefined
  ) {
    return {
      clinicalOrderType: existing.clinicalOrderType,
      destinationModule: existing.destinationModule,
      executionMode: existing.executionMode,
    };
  }

  switch (categoryGroup ?? legacyOrderType) {
    case "set":
      return {
        clinicalOrderType: "other",
        destinationModule: null,
        executionMode: "aggregate",
      };
    case "consultation":
      return {
        clinicalOrderType: "consultation",
        destinationModule: null,
        executionMode: "immediate_complete",
      };
    case "lab":
      return {
        clinicalOrderType: "clinical_lab",
        destinationModule: "lab",
        executionMode: "routed",
      };
    case "imaging":
      return {
        clinicalOrderType: "imaging",
        destinationModule: "imaging",
        executionMode: "routed",
      };
    case "medication":
    case "dispensing":
      return {
        clinicalOrderType: "dispensing",
        destinationModule: "dispensing",
        executionMode: "routed",
      };
    case "hospitalization":
      return {
        clinicalOrderType: "hospitalization",
        destinationModule: "hospitalization",
        executionMode: "routed",
      };
    case "treatment":
      return {
        clinicalOrderType: "treatment",
        destinationModule: "treatment",
        executionMode: "routed",
      };
    default:
      return {
        clinicalOrderType: "other",
        destinationModule: null,
        executionMode: "immediate_complete",
      };
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
  const billingSummary = body.billingSummary === undefined
    ? undefined
    : (mapChartOrderBillingSummary(body.billingSummary) ?? undefined);
  if (body.billingSummary !== undefined && !billingSummary) return null;
  return {
    ok: true,
    billingSummary,
    etag,
    rows,
  };
}

function mapRuntimeRow(value: unknown): ChartOrderRuntimeRow | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const lineTotalSnapshot = typeof row.lineTotalSnapshot === "number"
    ? row.lineTotalSnapshot
    : row.rowType === "set" &&
        row.billingReflectionEnabled === false &&
        row.lineTotalSnapshot === null
      ? 0
      : undefined;
  if (typeof row.orderId !== "string" || typeof row.encounterId !== "string" ||
      (row.rowType !== "individual" && row.rowType !== "set" && row.rowType !== "set_child") ||
      typeof row.orderType !== "string" || typeof row.quantity !== "number" ||
      lineTotalSnapshot === undefined || typeof row.updatedAt !== "string") return null;
  const quantitySource = row.quantitySource;
  if (!["fixed_one", "preset_quantity", "manual_at_apply", "manual", "days", "total_count", "dispense_quantity", "actual_dispense_quantity"].includes(String(quantitySource))) return null;
  const objectValue = (key: string) =>
    row[key] && typeof row[key] === "object" && !Array.isArray(row[key])
      ? row[key] as Record<string, unknown>
      : {};
  const appliedSnapshot = objectValue("appliedSnapshot");
  const categoryGroup = appliedSnapshot.categoryGroup;
  const fallbackCanonical = resolveMockDraftCanonicalContract({
    categoryGroup:
      typeof categoryGroup === "string" ? categoryGroup : undefined,
    legacyOrderType: row.orderType,
  });
  const clinicalOrderType = isClinicalOrderType(row.clinicalOrderType)
    ? row.clinicalOrderType
    : fallbackCanonical.clinicalOrderType;
  const destinationModule =
    row.destinationModule === null ||
    (typeof row.destinationModule === "string" &&
      (CLINICAL_ORDER_DESTINATION_MODULES as readonly string[]).includes(
        row.destinationModule,
      ))
      ? (row.destinationModule as ClinicalOrderDestinationModule | null)
      : fallbackCanonical.destinationModule;
  const executionMode =
    row.executionMode === "routed" ||
    row.executionMode === "immediate_complete" ||
    row.executionMode === "aggregate"
      ? row.executionMode
      : fallbackCanonical.executionMode;
  return {
    ...readChartOrderRequester(row),
    orderId: row.orderId,
    workspaceId: typeof row.workspaceId === "string" ? row.workspaceId : undefined,
    encounterId: row.encounterId,
    originChartId: typeof row.originChartId === "string" ? row.originChartId : null,
    rowType: row.rowType,
    instruction: typeof row.instruction === "string" ? row.instruction : undefined,
    orderType: row.orderType as ChartOrderRuntimeRow["orderType"],
    clinicalOrderType,
    destinationModule,
    executionMode,
    detailInputs: objectValue("detailInputs"),
    detailSchemaVersion:
      typeof row.detailSchemaVersion === "number" &&
      Number.isInteger(row.detailSchemaVersion)
        ? row.detailSchemaVersion
        : 1,
    priority: row.priority === "urgent" ? "urgent" : "normal",
    billingEligible: row.billingEligible !== false,
    revisionNo:
      typeof row.revisionNo === "number" && Number.isInteger(row.revisionNo)
        ? row.revisionNo
        : 0,
    parentOrderId: row.parentOrderId === null ? null : typeof row.parentOrderId === "string" ? row.parentOrderId : null,
    sourceSetId: row.sourceSetId === null ? null : typeof row.sourceSetId === "string" ? row.sourceSetId : null,
    sourceSetRevisionId: row.sourceSetRevisionId === null ? null : typeof row.sourceSetRevisionId === "string" ? row.sourceSetRevisionId : null,
    sourceSetRevisionNo: typeof row.sourceSetRevisionNo === "number" ? row.sourceSetRevisionNo : null,
    sourceSetVersion: row.sourceSetVersion === null ? null : typeof row.sourceSetVersion === "string" ? row.sourceSetVersion : null,
    sourceSetRevisionItemId: row.sourceSetRevisionItemId === null ? null : typeof row.sourceSetRevisionItemId === "string" ? row.sourceSetRevisionItemId : null,
    workspaceCatalogItemId: row.workspaceCatalogItemId === null ? null : typeof row.workspaceCatalogItemId === "string" ? row.workspaceCatalogItemId : null,
    workspaceCatalogRevision: typeof row.workspaceCatalogRevision === "number" ? row.workspaceCatalogRevision : null,
    dispensingAuthoritySnapshot: objectValue("dispensingAuthoritySnapshot"),
    dispensingLineage: mapDispensingOrderLineageSnapshot(
      row.dispensingLineage ?? objectValue("appliedSnapshot").dispensingLineage,
    ) ?? null,
    quantity: row.quantity,
    quantitySource: quantitySource as ChartOrderReadbackQuantitySource,
    unitPriceSnapshot: row.unitPriceSnapshot === null ? null : typeof row.unitPriceSnapshot === "number" ? row.unitPriceSnapshot : null,
    lineTotalSnapshot,
    snapshotSchemaVersion: row.snapshotSchemaVersion === 1 ? 1 : 0,
    snapshotHash: row.snapshotHash === null ? null : typeof row.snapshotHash === "string" ? row.snapshotHash : null,
    appliedSnapshot: objectValue("appliedSnapshot"),
    appliedPriceSnapshot: objectValue("appliedPriceSnapshot"),
    calculationInputs: objectValue("calculationInputs"),
    calculationOutputs: objectValue("calculationOutputs"),
    billingAdjustmentReasons: Array.isArray(row.billingAdjustmentReasons)
      ? row.billingAdjustmentReasons.filter(
          (reason): reason is string => typeof reason === "string" && Boolean(reason.trim()),
        )
      : [],
    preBillingOverride: objectValue("preBillingOverride"),
    billingReflectionEnabled: row.billingReflectionEnabled !== false,
    intendedAssigneeUserId:
      row.intendedAssigneeUserId === null
        ? null
        : typeof row.intendedAssigneeUserId === "string"
          ? row.intendedAssigneeUserId
          : undefined,
    orderConfirmationStatus: typeof row.orderConfirmationStatus === "string" ? row.orderConfirmationStatus as ChartOrderRuntimeRow["orderConfirmationStatus"] : undefined,
    status: typeof row.status === "string" ? row.status : undefined,
    updatedAt: row.updatedAt,
  };
}

async function buildMockSetRuntimeRows({
  catalogGateway,
  encounterId,
  draftRows,
  existingRows,
  now,
  primaryVeterinarianId,
  workspaceId,
}: {
  catalogGateway: Pick<
    OrderCatalogGateway,
    "listChartSearch" | "previewOrderSet"
  >;
  encounterId: string;
  draftRows: ChartOrderDraftRowInput[];
  existingRows: ChartOrderRuntimeRow[];
  now: string;
  primaryVeterinarianId?: string;
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

  const runtimeRows: ChartOrderRuntimeRow[] = [];
  for (const row of setRows) {
    const previewResult = await catalogGateway.previewOrderSet?.({
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
      clinicalOrderType: "other",
      destinationModule: null,
      executionMode: "aggregate",
      instruction: row.instruction ?? previousParent?.instruction ?? "",
      detailInputs: row.detailInputs ?? previousParent?.detailInputs ?? {},
      detailSchemaVersion:
        row.detailSchemaVersion ?? previousParent?.detailSchemaVersion ?? 1,
      priority: row.priority ?? previousParent?.priority ?? "normal",
      billingEligible: false,
      revisionNo: previousParent?.revisionNo ?? 0,
      parentOrderId: null,
      sourceSetId: preview.set.sourceSetId,
      sourceSetRevisionId: preview.set.sourceSetRevisionId,
      sourceSetRevisionNo: preview.set.sourceSetRevisionNo,
      sourceSetVersion: preview.set.sourceSetVersion,
      sourceSetRevisionItemId: null,
      workspaceCatalogItemId: null,
      workspaceCatalogRevision: null,
      dispensingLineage: null,
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
      const childInput = row.childInputs?.find(
        (candidate) => candidate.revisionItemId === item.revisionItemId,
      );
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
      const childClinicalOrderType = isClinicalOrderType(
        itemSnapshot.clinicalOrderType,
      )
        ? itemSnapshot.clinicalOrderType
        : undefined;
      const childCanonical = childClinicalOrderType
        ? resolveClinicalOrderMasterContract({
            billingEligible: itemSnapshot.billingEligible,
            billingReflectionEnabled: item.billingReflectionEnabled,
            categoryGroup: "treatment",
            clinicalOrderType: childClinicalOrderType,
            defaultDestinationModule: itemSnapshot.appliedDestinationModule,
            defaultTaskRequired: itemSnapshot.appliedTaskRequired,
            destinationModule: itemSnapshot.destinationModule,
            detailSchemaVersion: itemSnapshot.detailSchemaVersion,
            executionMode: itemSnapshot.executionMode,
          })
        : resolveMockDraftCanonicalContract({
            categoryGroup:
              typeof itemSnapshot.categoryGroup === "string"
                ? itemSnapshot.categoryGroup
                : undefined,
            legacyOrderType: mapCatalogCategoryToOrderType(
              typeof itemSnapshot.categoryGroup === "string"
                ? itemSnapshot.categoryGroup
                : undefined,
            ),
          });
      const childDetailInputs = mergeConsultationResponsibleClinician({
        clinicalOrderType: childCanonical.clinicalOrderType,
        detailInputs:
          childInput?.detailInputs ??
          previousChild?.detailInputs ??
          readMockCatalogDefaultDetailInputs(itemSnapshot),
        primaryVeterinarianId,
      });
      if (
        childInput &&
        !validateClinicalOrderDetailInputs({
          clinicalOrderType: childCanonical.clinicalOrderType,
          detailInputs: childDetailInputs,
          requireComplete: false,
          schemaVersion: childInput.detailSchemaVersion,
        }).valid
      ) {
        return {
          ok: false,
          status: 422,
          error: "child_detail_inputs_invalid",
        };
      }
      runtimeRows.push({
        orderId: childOrderId,
        workspaceId,
        encounterId,
        rowType: "set_child",
        orderType:
          childCanonical.clinicalOrderType === "clinical_lab" ||
          childCanonical.clinicalOrderType === "external_lab"
            ? "lab"
            : childCanonical.clinicalOrderType === "imaging"
              ? "imaging"
              : childCanonical.clinicalOrderType === "dispensing"
                ? "dispensing"
                : "treatment",
        clinicalOrderType: childCanonical.clinicalOrderType,
        destinationModule: childCanonical.destinationModule,
        executionMode: childCanonical.executionMode,
        detailInputs: childDetailInputs,
        detailSchemaVersion:
          childInput?.detailSchemaVersion ??
          previousChild?.detailSchemaVersion ??
          1,
        priority: childInput?.priority ?? previousChild?.priority ?? "normal",
        billingEligible: previousChild?.billingEligible ?? true,
        revisionNo: previousChild?.revisionNo ?? 0,
        parentOrderId: row.orderId,
        sourceSetId: preview.set.sourceSetId,
        sourceSetRevisionId: preview.set.sourceSetRevisionId,
        sourceSetRevisionNo: preview.set.sourceSetRevisionNo,
        sourceSetVersion: preview.set.sourceSetVersion,
        sourceSetRevisionItemId: item.revisionItemId,
        workspaceCatalogItemId: item.workspaceCatalogItemId,
        workspaceCatalogRevision: item.appliedCatalogRevision,
        dispensingLineage: mapDispensingOrderLineageSnapshot(
          itemSnapshot.dispensingLineage,
        ) ?? null,
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
  return rows.map((row) => {
    const canonical = resolveMockDraftCanonicalContract({ existing: row });
    return {
    orderId: row.orderId,
    workspaceId,
    encounterId: row.encounterId,
    originChartId: typeof row.originChartId === "string" ? row.originChartId : null,
    rowType: "individual",
    orderType: "treatment",
    clinicalOrderType: row.clinicalOrderType ?? canonical.clinicalOrderType,
    destinationModule:
      row.destinationModule !== undefined
        ? row.destinationModule
        : canonical.destinationModule,
    executionMode: row.executionMode ?? canonical.executionMode,
    detailInputs: row.detailInputs ?? {},
    detailSchemaVersion: row.detailSchemaVersion ?? 1,
    priority: row.priority ?? "normal",
    billingEligible: row.billingEligible ?? true,
    revisionNo: row.revisionNo ?? 0,
    parentOrderId: null,
    sourceSetId: null,
    sourceSetRevisionId: null,
    sourceSetRevisionNo: null,
    sourceSetVersion: null,
    sourceSetRevisionItemId: null,
    workspaceCatalogItemId: row.workspaceCatalogItemId ?? null,
    workspaceCatalogRevision: row.workspaceCatalogRevision ?? null,
    dispensingLineage:
      row.dispensingLineage ??
      mapDispensingOrderLineageSnapshot(row.appliedSnapshot?.dispensingLineage) ??
      null,
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
    };
  });
}

function mockChartOrderEtag(rows: ChartOrderRuntimeRow[]) {
  return `"${createHash("sha256").update(JSON.stringify(rows)).digest("hex")}"`;
}

function mapChartDraftRpcError(message: string) {
  const known = [
    "detail_inputs_invalid",
    "child_detail_inputs_invalid",
    "set_child_input_unavailable",
    "invalid_removed_order_ids",
    "order_removal_unavailable",
    "order_removal_has_downstream_artifacts",
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
