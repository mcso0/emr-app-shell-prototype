import {
  createMockWorkspacePermissionAdapter,
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";
import { mockEncounters, mockInvoiceLines, mockInvoices, mockOrders } from "@/mocks/emr-domain";
import type { EmrOrder, Encounter, Invoice, InvoiceLine } from "@/types/emr-domain";

export type InvoiceCandidateSyncInput = {
  encounterId?: string;
  orderIds?: string[];
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
};

export type InvoiceCandidateSyncGatewayResult =
  | { ok: true; candidates: BillingInvoiceCandidateLine[] }
  | { ok: false; status: 409; denialReason: "encounter_unavailable" | "order_unavailable" | "invoice_unavailable" }
  | { ok: false; status: 500; error: "db_read_failed" | "db_write_failed" };

export type InvoiceCandidateSyncGateway = {
  listInvoiceCandidates(input: {
    encounterId: string;
    workspaceId: string;
  }): Promise<InvoiceCandidateSyncGatewayResult>;
  syncInvoiceCandidates(input: {
    actorUserId: string;
    encounterId: string;
    orderIds: string[];
    workspaceId: string;
  }): Promise<InvoiceCandidateSyncGatewayResult>;
};

export type InvoiceCandidateReadResult =
  | {
      ok: true;
      status: 200;
      candidates: BillingInvoiceCandidateLine[];
      enforcedBy: "billing-invoice-candidate-sync";
    }
  | { ok: false; status: 400; error: "invalid_input"; fieldErrors: Partial<Record<"encounterId", string>> }
  | { ok: false; status: 401 | 403; denialReason: WorkspacePermissionDenialReason }
  | { ok: false; status: 409; denialReason: "encounter_unavailable" | "order_unavailable" | "invoice_unavailable" }
  | { ok: false; status: 500; error: "db_read_failed" | "supabase_client_missing" };

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
  | { ok: false; status: 401 | 403; denialReason: WorkspacePermissionDenialReason }
  | { ok: false; status: 409; denialReason: "encounter_unavailable" | "order_unavailable" | "invoice_unavailable" }
  | { ok: false; status: 500; error: "db_write_failed" | "supabase_client_missing" };

const mockInvoiceCandidateStore = new Map<string, BillingInvoiceCandidateLine[]>();

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
    return { ok: false, status: 400, error: "invalid_input", fieldErrors: { encounterId: "진료 차트를 선택해 주세요." } };
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

  const result = await gateway.listInvoiceCandidates({ encounterId: normalizedEncounterId, workspaceId });
  if (!result.ok) {
    if (result.status === 409) return result;
    return { ok: false, status: 500, error: "db_read_failed" };
  }

  return { ok: true, status: 200, candidates: result.candidates, enforcedBy: "billing-invoice-candidate-sync" };
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
    return { ok: false, status: 400, error: "invalid_input", fieldErrors: validation.fieldErrors };
  }

  const permission = resolveWorkspacePermission(permissionAdapter, {
    sessionUserId: actorUserId,
    workspaceId,
    requiredPermission: "billing:issue",
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
    workspaceId,
  });
  if (!result.ok) {
    if (result.status === 409) return result;
    return { ok: false, status: 500, error: "db_write_failed" };
  }

  return { ok: true, status: 200, candidates: result.candidates, enforcedBy: "billing-invoice-candidate-sync" };
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
  now = () => new Date().toISOString()
): InvoiceCandidateSyncGateway {
  const encounters = dataset.encounters ?? [];
  const invoiceLines = dataset.invoiceLines ?? [];
  const invoices = dataset.invoices ?? [];
  const orders = dataset.orders ?? [];

  return {
    async listInvoiceCandidates({ encounterId, workspaceId }) {
      const encounter = findEncounter(encounters, workspaceId, encounterId);
      if (!encounter) return { ok: false, status: 409, denialReason: "encounter_unavailable" };

      return { ok: true, candidates: getStoredOrSeedCandidates({ encounterId, invoiceLines, invoices, orders, workspaceId }) };
    },
    async syncInvoiceCandidates({ encounterId, orderIds, workspaceId }) {
      const encounter = findEncounter(encounters, workspaceId, encounterId);
      if (!encounter) return { ok: false, status: 409, denialReason: "encounter_unavailable" };

      const invoice = invoices.find((item) => item.workspaceId === workspaceId && item.encounterId === encounterId);
      if (!invoice) return { ok: false, status: 409, denialReason: "invoice_unavailable" };

      const candidates = getStoredOrSeedCandidates({ encounterId, invoiceLines, invoices, orders, workspaceId });
      const timestamp = now();
      const nextCandidates = [...candidates];
      const synced: BillingInvoiceCandidateLine[] = [];

      for (const orderId of orderIds) {
        const order = orders.find((item) => item.workspaceId === workspaceId && item.encounterId === encounterId && item.id === orderId);
        if (!order || order.status === "cancelled") {
          return { ok: false, status: 409, denialReason: "order_unavailable" };
        }

        const existing = nextCandidates.find((candidate) => candidate.orderId === orderId);
        if (existing) {
          synced.push({ ...existing, syncedAt: timestamp });
          continue;
        }

        const sourceLine = invoiceLines.find((line) => line.orderId === orderId);
        const quantity = sourceLine?.quantity ?? 1;
        const unitPrice = sourceLine?.unitPrice ?? 0;
        const candidate = {
          billingCandidateId: `billcand-${orderId}`,
          description: sourceLine?.description ?? order.displayName,
          invoiceId: invoice.id,
          lineTotal: roundMoney(quantity * unitPrice),
          orderId,
          quantity,
          syncedAt: timestamp,
          unitPrice,
        } satisfies BillingInvoiceCandidateLine;
        nextCandidates.push(candidate);
        synced.push(candidate);
      }

      mockInvoiceCandidateStore.set(buildCandidateKey(workspaceId, encounterId), nextCandidates);
      return { ok: true, candidates: synced };
    },
  };
}

export type SupabaseInvoiceCandidateSyncRpcClient = {
  rpc(functionName: "clair_list_billing_invoice_candidates", args: { p_workspace_id: string; p_encounter_id: string }): Promise<{ data: unknown; error: { message?: string } | null }>;
  rpc(functionName: "clair_sync_billing_invoice_candidates", args: { p_workspace_id: string; p_actor_user_id: string; p_encounter_id: string; p_order_ids: string[] }): Promise<{ data: unknown; error: { message?: string } | null }>;
};

export function createSupabaseInvoiceCandidateSyncGateway(client: SupabaseInvoiceCandidateSyncRpcClient): InvoiceCandidateSyncGateway {
  return {
    async listInvoiceCandidates({ encounterId, workspaceId }) {
      const { data, error } = await client.rpc("clair_list_billing_invoice_candidates", { p_workspace_id: workspaceId, p_encounter_id: encounterId });
      if (error) return mapSyncError(error.message, "db_read_failed");
      return { ok: true, candidates: mapCandidateRows(data) };
    },
    async syncInvoiceCandidates({ actorUserId, encounterId, orderIds, workspaceId }) {
      const { data, error } = await client.rpc("clair_sync_billing_invoice_candidates", {
        p_workspace_id: workspaceId,
        p_actor_user_id: actorUserId,
        p_encounter_id: encounterId,
        p_order_ids: orderIds.map(normalizeUuidForRpc).filter((orderId): orderId is string => Boolean(orderId)),
      });
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
      { id: "membership-playwright-admin", workspaceId: "clair-demo", userId: "playwright-default-session", roles: ["hospital_admin"], status: "active" },
      { id: "membership-admin", workspaceId: "clair-demo", userId: "user-admin", roles: ["hospital_admin"], status: "active" },
      { id: "membership-front-desk", workspaceId: "clair-demo", userId: "user-front-desk", roles: ["front_desk"], status: "active" },
      { id: "membership-vet", workspaceId: "clair-demo", userId: "user-vet", roles: ["vet"], status: "active" },
      { id: "membership-tech", workspaceId: "clair-demo", userId: "user-tech", roles: ["technician"], status: "active" },
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
  const stored = mockInvoiceCandidateStore.get(buildCandidateKey(workspaceId, encounterId));
  if (stored) return stored;

  const invoice = invoices.find((item) => item.workspaceId === workspaceId && item.encounterId === encounterId);
  if (!invoice) return [];
  const orderIds = new Set(orders.filter((order) => order.workspaceId === workspaceId && order.encounterId === encounterId).map((order) => order.id));

  return invoiceLines
    .filter((line) => line.invoiceId === invoice.id && line.orderId && orderIds.has(line.orderId))
    .map((line) => ({
      billingCandidateId: `billcand-${line.orderId}`,
      description: line.description,
      invoiceId: invoice.id,
      lineTotal: line.lineTotal,
      orderId: line.orderId ?? "",
      quantity: line.quantity,
      syncedAt: new Date(0).toISOString(),
      unitPrice: line.unitPrice,
    }));
}

function normalizeSyncInput(input: InvoiceCandidateSyncInput) {
  return {
    encounterId: trimToUndefined(input.encounterId) ?? "",
    orderIds: Array.isArray(input.orderIds)
      ? Array.from(new Set(input.orderIds.map(trimToUndefined).filter((orderId): orderId is string => Boolean(orderId))))
      : [],
  };
}

function validateSyncInput(input: ReturnType<typeof normalizeSyncInput>) {
  const fieldErrors: Partial<Record<"encounterId" | "orderIds", string>> = {};
  if (!input.encounterId) fieldErrors.encounterId = "진료 차트를 선택해 주세요.";
  if (!input.orderIds.length) fieldErrors.orderIds = "오더를 선택해 주세요.";
  if (input.orderIds.length > 100) fieldErrors.orderIds = "선택 오더가 너무 많습니다.";
  if (Object.keys(fieldErrors).length > 0) return { valid: false as const, fieldErrors };
  return { valid: true as const, fieldErrors: {} };
}

function findEncounter(encounters: Encounter[], workspaceId: string, encounterId: string) {
  return encounters.find((encounter) => encounter.id === encounterId && encounter.workspaceId === workspaceId && encounter.status !== "cancelled");
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

function normalizeUuidForRpc(value?: string) {
  return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : undefined;
}

function mapSyncError(message: string | undefined, fallback: "db_read_failed" | "db_write_failed"): InvoiceCandidateSyncGatewayResult {
  if (message?.includes("encounter_unavailable")) return { ok: false, status: 409, denialReason: "encounter_unavailable" };
  if (message?.includes("order_unavailable")) return { ok: false, status: 409, denialReason: "order_unavailable" };
  if (message?.includes("invoice_unavailable")) return { ok: false, status: 409, denialReason: "invoice_unavailable" };
  return { ok: false, status: 500, error: fallback };
}

function mapCandidateRows(value: unknown): BillingInvoiceCandidateLine[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is BillingInvoiceCandidateLine => {
    const row = item as Partial<BillingInvoiceCandidateLine>;
    return Boolean(
      row &&
      typeof row.billingCandidateId === "string" &&
      typeof row.description === "string" &&
      typeof row.invoiceId === "string" &&
      typeof row.lineTotal === "number" &&
      typeof row.orderId === "string" &&
      typeof row.quantity === "number" &&
      typeof row.syncedAt === "string" &&
      typeof row.unitPrice === "number"
    );
  });
}
