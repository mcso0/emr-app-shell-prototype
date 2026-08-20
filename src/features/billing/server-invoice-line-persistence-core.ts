import {
  createMockWorkspacePermissionAdapter,
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";
import { mockInvoiceLines, mockInvoices } from "@/mocks/emr-domain";
import type {
  BillingCategory,
  Invoice,
  InvoiceLine,
  InvoiceStatus,
  ServiceItemType,
} from "@/types/emr-domain";

export type InvoiceLineEditInput = {
  confirmBilling?: boolean;
  invoiceId?: string;
  lines?: Array<{
    invoiceLineId?: string;
    quantity?: number;
  }>;
};

type NormalizedInvoiceLineEditInput = {
  confirmBilling: boolean;
  invoiceId: string;
  lines: Array<{
    invoiceLineId: string;
    quantity: number;
  }>;
};

export type BillingPersistedInvoice = Pick<
  Invoice,
  | "createdAt"
  | "discountAmount"
  | "encounterId"
  | "guardianId"
  | "id"
  | "invoiceNo"
  | "issuedAt"
  | "status"
  | "subtotalAmount"
  | "taxAmount"
  | "totalAmount"
  | "workspaceId"
> & {
  issuedByUserId?: string;
};

export type BillingInvoiceLineSnapshot = InvoiceLine;

export type InvoiceLinePersistencePayload = {
  invoice: BillingPersistedInvoice;
  lines: BillingInvoiceLineSnapshot[];
};

export type InvoiceLinePersistenceGatewayResult =
  | ({ ok: true } & InvoiceLinePersistencePayload)
  | { ok: false; status: 409; denialReason: "invoice_unavailable" | "line_unavailable" }
  | { ok: false; status: 500; error: "db_read_failed" | "db_write_failed" };

export type InvoiceLinePersistenceGateway = {
  getInvoiceLines(input: {
    invoiceId: string;
    workspaceId: string;
  }): Promise<InvoiceLinePersistenceGatewayResult>;
  saveInvoiceLineEdits(input: {
    actorUserId: string;
    input: NormalizedInvoiceLineEditInput;
    workspaceId: string;
  }): Promise<InvoiceLinePersistenceGatewayResult>;
};

export type InvoiceLineReadResult =
  | ({
      ok: true;
      status: 200;
      enforcedBy: "billing-invoice-line-persistence";
    } & InvoiceLinePersistencePayload)
  | { ok: false; status: 400; error: "invalid_input"; fieldErrors: Partial<Record<"invoiceId", string>> }
  | { ok: false; status: 401 | 403; denialReason: WorkspacePermissionDenialReason }
  | { ok: false; status: 409; denialReason: "invoice_unavailable" | "line_unavailable" }
  | { ok: false; status: 500; error: "db_read_failed" | "supabase_client_missing" };

export type InvoiceLineSaveResult =
  | ({
      ok: true;
      status: 200;
      enforcedBy: "billing-invoice-line-persistence";
    } & InvoiceLinePersistencePayload)
  | {
      ok: false;
      status: 400;
      error: "invalid_input";
      fieldErrors: Partial<Record<"invoiceId" | "lines", string>>;
    }
  | { ok: false; status: 401 | 403; denialReason: WorkspacePermissionDenialReason }
  | { ok: false; status: 409; denialReason: "invoice_unavailable" | "line_unavailable" }
  | { ok: false; status: 500; error: "db_write_failed" | "supabase_client_missing" };

type StoredInvoice = BillingPersistedInvoice;

const mockInvoiceLineStore = new Map<
  string,
  {
    invoice: StoredInvoice;
    lines: BillingInvoiceLineSnapshot[];
  }
>();

export async function readInvoiceLines({
  actorUserId,
  gateway = createMockInvoiceLinePersistenceGateway(),
  invoiceId,
  permissionAdapter = createDemoInvoiceLinePermissionAdapter(),
  workspaceId,
}: {
  actorUserId: string | null;
  gateway?: Pick<InvoiceLinePersistenceGateway, "getInvoiceLines">;
  invoiceId: string | null | undefined;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<InvoiceLineReadResult> {
  const normalizedInvoiceId = trimToUndefined(invoiceId);
  if (!normalizedInvoiceId) {
    return { ok: false, status: 400, error: "invalid_input", fieldErrors: { invoiceId: "청구서를 선택해 주세요." } };
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

  const result = await gateway.getInvoiceLines({ invoiceId: normalizedInvoiceId, workspaceId });
  if (!result.ok) {
    if (result.status === 409) return result;
    return { ok: false, status: 500, error: "db_read_failed" };
  }

  return {
    ok: true,
    status: 200,
    invoice: result.invoice,
    lines: result.lines,
    enforcedBy: "billing-invoice-line-persistence",
  };
}

export async function saveInvoiceLineEdits({
  actorUserId,
  gateway = createMockInvoiceLinePersistenceGateway(),
  input,
  permissionAdapter = createDemoInvoiceLinePermissionAdapter(),
  workspaceId,
}: {
  actorUserId: string | null;
  gateway?: Pick<InvoiceLinePersistenceGateway, "saveInvoiceLineEdits">;
  input: InvoiceLineEditInput;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<InvoiceLineSaveResult> {
  const normalized = normalizeSaveInput(input);
  const validation = validateSaveInput(normalized);
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

  const result = await gateway.saveInvoiceLineEdits({
    actorUserId: actorUserId ?? "",
    input: normalized,
    workspaceId,
  });
  if (!result.ok) {
    if (result.status === 409) return result;
    return { ok: false, status: 500, error: "db_write_failed" };
  }

  return {
    ok: true,
    status: 200,
    invoice: result.invoice,
    lines: result.lines,
    enforcedBy: "billing-invoice-line-persistence",
  };
}

export function createMockInvoiceLinePersistenceGateway(
  dataset: {
    invoiceLines?: InvoiceLine[];
    invoices?: Invoice[];
  } = {
    invoiceLines: mockInvoiceLines,
    invoices: mockInvoices,
  },
  now = () => new Date().toISOString(),
  storeNamespace = "default"
): InvoiceLinePersistenceGateway {
  const seedInvoiceLines = dataset.invoiceLines ?? [];
  const seedInvoices = dataset.invoices ?? [];

  return {
    async getInvoiceLines({ invoiceId, workspaceId }) {
      const snapshot = getStoredOrSeedInvoice({ invoiceId, invoiceLines: seedInvoiceLines, invoices: seedInvoices, storeNamespace, workspaceId });
      if (!snapshot) return { ok: false, status: 409, denialReason: "invoice_unavailable" };
      return { ok: true, invoice: snapshot.invoice, lines: snapshot.lines };
    },
    async saveInvoiceLineEdits({ actorUserId, input, workspaceId }) {
      const snapshot = getStoredOrSeedInvoice({
        invoiceId: input.invoiceId,
        invoiceLines: seedInvoiceLines,
        invoices: seedInvoices,
        storeNamespace,
        workspaceId,
      });
      if (!snapshot) return { ok: false, status: 409, denialReason: "invoice_unavailable" };

      const targetLineIds = new Set(input.lines.map((line) => line.invoiceLineId));
      const existingLineIds = new Set(snapshot.lines.map((line) => line.id));
      if ([...targetLineIds].some((lineId) => !existingLineIds.has(lineId))) {
        return { ok: false, status: 409, denialReason: "line_unavailable" };
      }

      const timestamp = now();
      const quantityByLineId = new Map(input.lines.map((line) => [line.invoiceLineId, line.quantity]));
      const lines = snapshot.lines.map((line) => {
        const quantity = quantityByLineId.get(line.id);
        if (quantity === undefined) return line;
        return {
          ...line,
          quantity,
          lineTotal: roundMoney(quantity * line.unitPrice),
        };
      });
      const subtotalAmount = roundMoney(lines.reduce((total, line) => total + line.lineTotal, 0));
      const invoice = {
        ...snapshot.invoice,
        status: input.confirmBilling ? "issued" as InvoiceStatus : snapshot.invoice.status,
        subtotalAmount,
        totalAmount: Math.max(0, roundMoney(subtotalAmount - snapshot.invoice.discountAmount + snapshot.invoice.taxAmount)),
        issuedAt: input.confirmBilling ? timestamp : snapshot.invoice.issuedAt,
        issuedByUserId: input.confirmBilling ? actorUserId : snapshot.invoice.issuedByUserId,
      };

      mockInvoiceLineStore.set(buildInvoiceKey(storeNamespace, workspaceId, input.invoiceId), { invoice, lines });
      return { ok: true, invoice, lines };
    },
  };
}

export type SupabaseInvoiceLinePersistenceRpcClient = {
  rpc(functionName: "clair_get_billing_invoice_lines", args: { p_workspace_id: string; p_invoice_id: string }): Promise<{ data: unknown; error: { message?: string } | null }>;
  rpc(functionName: "clair_save_billing_invoice_lines", args: {
    p_workspace_id: string;
    p_actor_user_id: string;
    p_invoice_id: string;
    p_lines: Array<{ invoiceLineId: string; quantity: number }>;
    p_confirm_billing: boolean;
  }): Promise<{ data: unknown; error: { message?: string } | null }>;
};

export function createSupabaseInvoiceLinePersistenceGateway(
  client: SupabaseInvoiceLinePersistenceRpcClient
): InvoiceLinePersistenceGateway {
  return {
    async getInvoiceLines({ invoiceId, workspaceId }) {
      const { data, error } = await client.rpc("clair_get_billing_invoice_lines", {
        p_workspace_id: workspaceId,
        p_invoice_id: invoiceId,
      });
      if (error) return mapPersistenceError(error.message, "db_read_failed");
      return mapPersistencePayload(data, "db_read_failed");
    },
    async saveInvoiceLineEdits({ actorUserId, input, workspaceId }) {
      const { data, error } = await client.rpc("clair_save_billing_invoice_lines", {
        p_workspace_id: workspaceId,
        p_actor_user_id: actorUserId,
        p_invoice_id: input.invoiceId,
        p_lines: input.lines,
        p_confirm_billing: input.confirmBilling,
      });
      if (error) return mapPersistenceError(error.message, "db_write_failed");
      return mapPersistencePayload(data, "db_write_failed");
    },
  };
}

export function createDemoInvoiceLinePermissionAdapter() {
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

function getStoredOrSeedInvoice({
  invoiceId,
  invoiceLines,
  invoices,
  storeNamespace,
  workspaceId,
}: {
  invoiceId: string;
  invoiceLines: InvoiceLine[];
  invoices: Invoice[];
  storeNamespace: string;
  workspaceId: string;
}) {
  const stored = mockInvoiceLineStore.get(buildInvoiceKey(storeNamespace, workspaceId, invoiceId));
  if (stored) return stored;

  const invoice = invoices.find((item) => item.workspaceId === workspaceId && item.id === invoiceId);
  if (!invoice) return null;

  return {
    invoice: { ...invoice },
    lines: invoiceLines.filter((line) => line.invoiceId === invoiceId).map((line) => ({ ...line })),
  };
}

function normalizeSaveInput(input: InvoiceLineEditInput) {
  return {
    confirmBilling: input.confirmBilling === true,
    invoiceId: trimToUndefined(input.invoiceId) ?? "",
    lines: Array.isArray(input.lines)
      ? input.lines
          .map((line) => ({
            invoiceLineId: trimToUndefined(line.invoiceLineId) ?? "",
            quantity: typeof line.quantity === "number" && Number.isFinite(line.quantity)
              ? Math.round(line.quantity * 1000) / 1000
              : Number.NaN,
          }))
          .filter((line, index, lines) =>
            line.invoiceLineId && lines.findIndex((item) => item.invoiceLineId === line.invoiceLineId) === index
          )
      : [],
  };
}

function validateSaveInput(input: ReturnType<typeof normalizeSaveInput>) {
  const fieldErrors: Partial<Record<"invoiceId" | "lines", string>> = {};
  if (!input.invoiceId) fieldErrors.invoiceId = "청구서를 선택해 주세요.";
  if (!input.confirmBilling && input.lines.length === 0) {
    fieldErrors.lines = "수정할 청구 항목이나 청구 확정 요청이 필요합니다.";
  }
  if (input.lines.length > 100) fieldErrors.lines = "수정 항목이 너무 많습니다.";
  if (input.lines.some((line) => !line.invoiceLineId || !Number.isFinite(line.quantity) || line.quantity <= 0)) {
    fieldErrors.lines = "청구 항목 수량은 0보다 커야 합니다.";
  }
  if (Object.keys(fieldErrors).length > 0) return { valid: false as const, fieldErrors };
  return { valid: true as const, fieldErrors: {} };
}

function buildInvoiceKey(storeNamespace: string, workspaceId: string, invoiceId: string) {
  return `${storeNamespace}:${workspaceId}:${invoiceId}`;
}

function trimToUndefined(value?: string | null) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function mapPersistenceError(
  message: string | undefined,
  fallback: "db_read_failed" | "db_write_failed"
): InvoiceLinePersistenceGatewayResult {
  if (message?.includes("invoice_unavailable")) return { ok: false, status: 409, denialReason: "invoice_unavailable" };
  if (message?.includes("line_unavailable")) return { ok: false, status: 409, denialReason: "line_unavailable" };
  return { ok: false, status: 500, error: fallback };
}

function mapPersistencePayload(
  value: unknown,
  fallback: "db_read_failed" | "db_write_failed"
): InvoiceLinePersistenceGatewayResult {
  const payload = value as Partial<InvoiceLinePersistencePayload> | null;
  if (!payload || !isPersistedInvoice(payload.invoice) || !Array.isArray(payload.lines)) {
    return { ok: false, status: 500, error: fallback };
  }
  const lines = payload.lines
    .map(mapInvoiceLineSnapshot)
    .filter((line): line is InvoiceLine => line !== null);
  return { ok: true, invoice: payload.invoice, lines };
}

function isPersistedInvoice(value: unknown): value is BillingPersistedInvoice {
  const invoice = value as Partial<BillingPersistedInvoice> | null;
  return Boolean(
    invoice &&
    typeof invoice.id === "string" &&
    typeof invoice.workspaceId === "string" &&
    typeof invoice.encounterId === "string" &&
    typeof invoice.invoiceNo === "string" &&
    typeof invoice.status === "string" &&
    typeof invoice.subtotalAmount === "number" &&
    typeof invoice.discountAmount === "number" &&
    typeof invoice.taxAmount === "number" &&
    typeof invoice.totalAmount === "number"
  );
}

function mapInvoiceLineSnapshot(value: unknown): BillingInvoiceLineSnapshot | null {
  const line = value as Partial<BillingInvoiceLineSnapshot> & Record<string, unknown> | null;
  if (!line) return null;

  const id = readString(line, "id");
  const invoiceId = readString(line, "invoiceId", "invoice_id");
  const description = readString(line, "description");
  const quantity = readNumber(line, "quantity");
  const unitPrice = readNumber(line, "unitPrice", "unit_price");
  const lineTotal = readNumber(line, "lineTotal", "line_total");
  if (!id || !invoiceId || !description || quantity === undefined || unitPrice === undefined || lineTotal === undefined) {
    return null;
  }

  const sourceOrderSnapshot = readRecord(line, "sourceOrderSnapshot", "source_order_snapshot");
  const billingNameSnapshot =
    readString(line, "billingNameSnapshot", "billing_name_snapshot") ??
    readString(sourceOrderSnapshot, "billingNameSnapshot", "billing_name_snapshot");
  const workspaceCatalogItemId =
    readString(line, "workspaceCatalogItemId", "workspace_catalog_item_id") ??
    readString(sourceOrderSnapshot, "workspaceCatalogItemId", "workspace_catalog_item_id");
  const sourceMasterRecordId =
    readString(line, "sourceMasterRecordId", "source_master_record_id") ??
    readString(sourceOrderSnapshot, "sourceMasterRecordId", "source_master_record_id");
  const sourceMasterRevision =
    readNumber(line, "sourceMasterRevision", "source_master_revision") ??
    readNumber(sourceOrderSnapshot, "sourceMasterRevision", "source_master_revision");
  const workspaceCatalogRevision =
    readNumber(line, "workspaceCatalogRevision", "workspace_catalog_revision") ??
    readNumber(sourceOrderSnapshot, "workspaceCatalogRevision", "workspace_catalog_revision");
  const rawCategoryGroup =
    readString(line, "categoryGroup", "category_group") ??
    readString(sourceOrderSnapshot, "categoryGroup", "category_group");
  const categoryGroup = asCategoryGroup(rawCategoryGroup);
  const billingCategory = asBillingCategory(
    readString(line, "billingCategory", "billing_category") ??
      readString(sourceOrderSnapshot, "billingCategory", "billing_category"),
    rawCategoryGroup,
  );

  return {
    id,
    invoiceId,
    serviceItemId: readString(line, "serviceItemId", "service_item_id"),
    ...(workspaceCatalogItemId ? { workspaceCatalogItemId } : {}),
    ...(sourceMasterRecordId ? { sourceMasterRecordId } : {}),
    ...(sourceMasterRevision !== undefined ? { sourceMasterRevision } : {}),
    ...(workspaceCatalogRevision !== undefined ? { workspaceCatalogRevision } : {}),
    ...(categoryGroup ? { categoryGroup } : {}),
    ...(billingCategory ? { billingCategory } : {}),
    ...(sourceOrderSnapshot ? { sourceOrderSnapshot } : {}),
    ...(billingNameSnapshot ? { billingNameSnapshot } : {}),
    orderId: readString(line, "orderId", "order_id"),
    description,
    quantity,
    unitPrice,
    lineTotal,
  };
}

function readString(
  value: Record<string, unknown> | undefined,
  ...keys: string[]
): string | undefined {
  if (!value) return undefined;
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  }
  return undefined;
}

function readNumber(
  value: Record<string, unknown> | undefined,
  ...keys: string[]
): number | undefined {
  if (!value) return undefined;
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === "number" && Number.isFinite(candidate)) return candidate;
  }
  return undefined;
}

function readRecord(
  value: Record<string, unknown> | undefined,
  ...keys: string[]
): Record<string, unknown> | undefined {
  if (!value) return undefined;
  for (const key of keys) {
    const candidate = value[key];
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
      return candidate as Record<string, unknown>;
    }
  }
  return undefined;
}

function asCategoryGroup(value: string | undefined): ServiceItemType | undefined {
  return value && [
    "consultation",
    "medication",
    "treatment",
    "lab",
    "imaging",
    "hospitalization",
    "misc",
  ].includes(value)
    ? (value as ServiceItemType)
    : undefined;
}

function asBillingCategory(
  value: string | undefined,
  categoryGroup?: string,
): BillingCategory | undefined {
  if (categoryGroup === "set") return "other";
  return value && [
    "consultation",
    "laboratory",
    "imaging",
    "dispensing",
    "treatment",
    "other",
  ].includes(value)
    ? (value as BillingCategory)
    : undefined;
}
