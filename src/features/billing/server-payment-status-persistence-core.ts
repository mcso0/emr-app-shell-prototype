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
import { mockInvoices, mockPayments } from "@/mocks/emr-domain";
import type { Invoice, InvoicePaymentState, InvoiceStatus, Payment, PaymentMethod } from "@/types/emr-domain";

export type BillingPaymentStatusAction = "select_payment_method" | "mark_unpaid" | "complete_payment";

export type BillingPaymentStatusInput = {
  action?: BillingPaymentStatusAction;
  invoiceId?: string;
  paymentMethod?: PaymentMethod;
  unpaidReason?: string;
};

type NormalizedBillingPaymentStatusInput = {
  action: BillingPaymentStatusAction;
  invoiceId: string;
  paymentMethod: PaymentMethod;
  unpaidReason: string | null;
};

export type BillingPaymentStatusInvoice = Invoice & {
  paidAt?: string;
  paymentState: InvoicePaymentState;
  selectedPaymentMethod?: PaymentMethod;
  unpaidReason?: string;
};

export type BillingPaymentStatusPayload = {
  invoice: BillingPaymentStatusInvoice;
  payments: Payment[];
};

export type BillingPaymentStatusGatewayResult =
  | ({ ok: true } & BillingPaymentStatusPayload)
  | { ok: false; status: 403; denialReason: "permission_missing" }
  | { ok: false; status: 409; denialReason: "billing_review_required" | "invoice_unavailable" }
  | { ok: false; status: 500; error: "db_read_failed" | "db_write_failed" };

export type BillingPaymentStatusGateway = {
  getPaymentStatus(input: {
    invoiceId: string;
    workspaceId: string;
  }): Promise<BillingPaymentStatusGatewayResult>;
  savePaymentStatus(input: {
    actorUserId: string;
    input: NormalizedBillingPaymentStatusInput;
    workspaceId: string;
  }): Promise<BillingPaymentStatusGatewayResult>;
};

export type BillingPaymentStatusReadResult =
  | ({
      ok: true;
      status: 200;
      enforcedBy: "billing-payment-status-persistence";
    } & BillingPaymentStatusPayload)
  | { ok: false; status: 400; error: "invalid_input"; fieldErrors: Partial<Record<"invoiceId", string>> }
  | { ok: false; status: 401 | 403; denialReason: WorkspacePermissionDenialReason }
  | { ok: false; status: 409; denialReason: "billing_review_required" | "invoice_unavailable" }
  | { ok: false; status: 500; error: "db_read_failed" | "supabase_client_missing" };

export type BillingPaymentStatusSaveResult =
  | ({
      ok: true;
      status: 200;
      enforcedBy: "billing-payment-status-persistence";
    } & BillingPaymentStatusPayload)
  | {
      ok: false;
      status: 400;
      error: "invalid_input";
      fieldErrors: Partial<Record<"action" | "invoiceId" | "paymentMethod" | "unpaidReason", string>>;
    }
  | { ok: false; status: 401 | 403; denialReason: WorkspacePermissionDenialReason }
  | { ok: false; status: 409; denialReason: "billing_review_required" | "invoice_unavailable" }
  | { ok: false; status: 500; error: "db_write_failed" | "supabase_client_missing" };

const paymentStatusStore = new Map<string, BillingPaymentStatusPayload>();
const paymentMethods = new Set<PaymentMethod>(["card", "cash", "transfer", "other"]);
const paymentActions = new Set<BillingPaymentStatusAction>([
  "select_payment_method",
  "mark_unpaid",
  "complete_payment",
]);

export async function readBillingPaymentStatus({
  actorUserId,
  gateway = createMockBillingPaymentStatusGateway(),
  invoiceId,
  permissionAdapter = createDemoBillingPaymentStatusPermissionAdapter(),
  workspaceId,
}: {
  actorUserId: string | null;
  gateway?: Pick<BillingPaymentStatusGateway, "getPaymentStatus">;
  invoiceId: string | null | undefined;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<BillingPaymentStatusReadResult> {
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

  const result = await gateway.getPaymentStatus({ invoiceId: normalizedInvoiceId, workspaceId });
  if (!result.ok) {
    if (result.status === 409 || result.status === 403) return result;
    return { ok: false, status: 500, error: "db_read_failed" };
  }

  return { ok: true, status: 200, invoice: result.invoice, payments: result.payments, enforcedBy: "billing-payment-status-persistence" };
}

export async function saveBillingPaymentStatus({
  actorUserId,
  auditGateway,
  auditNow,
  auditRequestId,
  gateway = createMockBillingPaymentStatusGateway(),
  input,
  permissionAdapter = createDemoBillingPaymentStatusPermissionAdapter(),
  workspaceId,
}: {
  actorUserId: string | null;
  auditGateway?: LiveMutationAuditOptions["auditGateway"];
  auditNow?: LiveMutationAuditOptions["auditNow"];
  auditRequestId?: LiveMutationAuditOptions["auditRequestId"];
  gateway?: Pick<BillingPaymentStatusGateway, "savePaymentStatus">;
  input: BillingPaymentStatusInput;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<BillingPaymentStatusSaveResult> {
  const normalized = normalizePaymentStatusInput(input);
  const validation = validatePaymentStatusInput(normalized);
  if (!validation.valid) {
    return { ok: false, status: 400, error: "invalid_input", fieldErrors: validation.fieldErrors };
  }
  const gatewayInput = normalized as NormalizedBillingPaymentStatusInput;

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

  const result = await gateway.savePaymentStatus({
    actorUserId: actorUserId ?? "",
    input: gatewayInput,
    workspaceId,
  });
  if (!result.ok) {
    if (result.status === 409 || result.status === 403) return result;
    return { ok: false, status: 500, error: "db_write_failed" };
  }

  const audit = await emitLiveMutationAuditEvent({
    auditGateway,
    auditNow,
    input: {
      workspaceId,
      actorUserId,
      eventType: "billing.payment_state_changed",
      targetType: "invoice",
      targetId: result.invoice.id,
      requestId: auditRequestId,
      after: {
        invoiceStatus: result.invoice.status,
        paymentState: result.invoice.paymentState,
        selectedPaymentMethod: result.invoice.selectedPaymentMethod ?? null,
      },
      metadata: {
        action: gatewayInput.action,
        paymentCount: result.payments.length,
        source: "billing-payment-status-persistence",
      },
    },
  });
  if (!audit.ok) return { ok: false, status: 500, error: "db_write_failed" };

  return { ok: true, status: 200, invoice: result.invoice, payments: result.payments, enforcedBy: "billing-payment-status-persistence" };
}

export function createMockBillingPaymentStatusGateway(
  dataset: {
    invoices?: Invoice[];
    payments?: Payment[];
  } = {
    invoices: mockInvoices,
    payments: mockPayments,
  },
  now = () => new Date().toISOString(),
  storeNamespace = "default"
): BillingPaymentStatusGateway {
  const seedInvoices = dataset.invoices ?? [];
  const seedPayments = dataset.payments ?? [];

  return {
    async getPaymentStatus({ invoiceId, workspaceId }) {
      const snapshot = getStoredOrSeedPaymentStatus({
        invoiceId,
        invoices: seedInvoices,
        payments: seedPayments,
        storeNamespace,
        workspaceId,
      });
      if (!snapshot) return { ok: false, status: 409, denialReason: "invoice_unavailable" };
      return { ok: true, invoice: snapshot.invoice, payments: snapshot.payments };
    },
    async savePaymentStatus({ actorUserId, input, workspaceId }) {
      const snapshot = getStoredOrSeedPaymentStatus({
        invoiceId: input.invoiceId,
        invoices: seedInvoices,
        payments: seedPayments,
        storeNamespace,
        workspaceId,
      });
      if (!snapshot) return { ok: false, status: 409, denialReason: "invoice_unavailable" };

      const timestamp = now();
      const invoice = applyPaymentStatusAction(snapshot.invoice, input, actorUserId, timestamp);
      const payments = input.action === "complete_payment"
        ? upsertApprovedPayment(snapshot.payments, invoice, input.paymentMethod, timestamp)
        : input.action === "mark_unpaid"
          ? snapshot.payments.filter((payment) => payment.invoiceId !== invoice.id || payment.status !== "approved")
          : snapshot.payments;

      paymentStatusStore.set(buildPaymentStatusKey(storeNamespace, workspaceId, input.invoiceId), { invoice, payments });
      return { ok: true, invoice, payments };
    },
  };
}

export type SupabaseBillingPaymentStatusRpcClient = {
  rpc(functionName: "clair_get_billing_payment_status", args: { p_workspace_id: string; p_invoice_id: string }): Promise<{ data: unknown; error: { message?: string } | null }>;
  rpc(functionName: "clair_save_billing_payment_status", args: {
    p_workspace_id: string;
    p_actor_user_id: string;
    p_invoice_id: string;
    p_action: BillingPaymentStatusAction;
    p_payment_method: PaymentMethod;
    p_unpaid_reason: string | null;
  }): Promise<{ data: unknown; error: { message?: string } | null }>;
};

export function createSupabaseBillingPaymentStatusGateway(
  client: SupabaseBillingPaymentStatusRpcClient
): BillingPaymentStatusGateway {
  return {
    async getPaymentStatus({ invoiceId, workspaceId }) {
      const { data, error } = await client.rpc("clair_get_billing_payment_status", {
        p_workspace_id: workspaceId,
        p_invoice_id: invoiceId,
      });
      if (error) return mapPaymentStatusError(error.message, "db_read_failed");
      return mapPaymentStatusPayload(data, "db_read_failed");
    },
    async savePaymentStatus({ actorUserId, input, workspaceId }) {
      const { data, error } = await client.rpc("clair_save_billing_payment_status", {
        p_workspace_id: workspaceId,
        p_actor_user_id: actorUserId,
        p_invoice_id: input.invoiceId,
        p_action: input.action,
        p_payment_method: input.paymentMethod,
        p_unpaid_reason: input.unpaidReason ?? null,
      });
      if (error) return mapPaymentStatusError(error.message, "db_write_failed");
      return mapPaymentStatusPayload(data, "db_write_failed");
    },
  };
}

export function createDemoBillingPaymentStatusPermissionAdapter() {
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

function getStoredOrSeedPaymentStatus({
  invoiceId,
  invoices,
  payments,
  storeNamespace,
  workspaceId,
}: {
  invoiceId: string;
  invoices: Invoice[];
  payments: Payment[];
  storeNamespace: string;
  workspaceId: string;
}) {
  const stored = paymentStatusStore.get(buildPaymentStatusKey(storeNamespace, workspaceId, invoiceId));
  if (stored) return stored;

  const invoice = invoices.find((item) => item.workspaceId === workspaceId && item.id === invoiceId);
  if (!invoice) return null;

  const invoicePayments = payments.filter((payment) => payment.invoiceId === invoice.id).map((payment) => ({ ...payment }));
  return {
    invoice: normalizeInvoicePaymentStatus(invoice, invoicePayments),
    payments: invoicePayments,
  };
}

function normalizeInvoicePaymentStatus(invoice: Invoice, payments: Payment[]): BillingPaymentStatusInvoice {
  const hasApprovedPayment = payments.some((payment) => payment.status === "approved");
  const paymentState = invoice.paymentState ?? (invoice.status === "paid" || hasApprovedPayment ? "paid" : invoice.unpaidReason ? "unpaid" : "none");
  const selectedPaymentMethod =
    invoice.selectedPaymentMethod ?? payments.find((payment) => payment.status === "approved")?.paymentMethod;
  return {
    ...invoice,
    paymentState,
    selectedPaymentMethod,
  };
}

function applyPaymentStatusAction(
  invoice: BillingPaymentStatusInvoice,
  input: NormalizedBillingPaymentStatusInput,
  actorUserId: string,
  timestamp: string
): BillingPaymentStatusInvoice {
  if (input.action === "select_payment_method") {
    return {
      ...invoice,
      selectedPaymentMethod: input.paymentMethod,
    };
  }

  if (input.action === "mark_unpaid") {
    return {
      ...invoice,
      issuedAt: invoice.issuedAt ?? timestamp,
      issuedByUserId: invoice.issuedByUserId ?? actorUserId,
      paidAt: undefined,
      paymentState: "unpaid",
      selectedPaymentMethod: input.paymentMethod,
      status: "issued" as InvoiceStatus,
      unpaidReason: input.unpaidReason ?? "",
    };
  }

  return {
    ...invoice,
    issuedAt: invoice.issuedAt ?? timestamp,
    issuedByUserId: invoice.issuedByUserId ?? actorUserId,
    paidAt: timestamp,
    paymentState: "paid",
    selectedPaymentMethod: input.paymentMethod,
    status: "paid" as InvoiceStatus,
    unpaidReason: undefined,
  };
}

function upsertApprovedPayment(
  payments: Payment[],
  invoice: BillingPaymentStatusInvoice,
  paymentMethod: PaymentMethod,
  paidAt: string
) {
  const existing = payments.find((payment) => payment.invoiceId === invoice.id && payment.status === "approved");
  const payment = {
    id: existing?.id ?? `payment-${invoice.id}-${paymentMethod}`,
    invoiceId: invoice.id,
    paymentMethod,
    amount: invoice.totalAmount,
    status: "approved" as const,
    paidAt,
    metadata: { prototype: true, externalProvider: "not_connected" },
  };

  return existing
    ? payments.map((item) => item.id === existing.id ? payment : item)
    : [...payments, payment];
}

function normalizePaymentStatusInput(input: BillingPaymentStatusInput) {
  const action = paymentActions.has(input.action as BillingPaymentStatusAction)
    ? input.action as BillingPaymentStatusAction
    : undefined;
  const paymentMethod = paymentMethods.has(input.paymentMethod as PaymentMethod)
    ? input.paymentMethod as PaymentMethod
    : undefined;

  return {
    action,
    invoiceId: trimToUndefined(input.invoiceId) ?? "",
    paymentMethod,
    unpaidReason: trimToUndefined(input.unpaidReason) ?? null,
  };
}

function validatePaymentStatusInput(input: ReturnType<typeof normalizePaymentStatusInput>) {
  const fieldErrors: Partial<Record<"action" | "invoiceId" | "paymentMethod" | "unpaidReason", string>> = {};
  if (!input.action) fieldErrors.action = "수납 상태 변경 작업을 선택해 주세요.";
  if (!input.invoiceId) fieldErrors.invoiceId = "청구서를 선택해 주세요.";
  if (!input.paymentMethod) fieldErrors.paymentMethod = "결제 수단을 선택해 주세요.";
  if (input.action === "mark_unpaid" && !input.unpaidReason) {
    fieldErrors.unpaidReason = "미납 처리 사유를 입력해 주세요.";
  }
  if (Object.keys(fieldErrors).length > 0) return { valid: false as const, fieldErrors };
  return { valid: true as const, fieldErrors: {} };
}

function buildPaymentStatusKey(storeNamespace: string, workspaceId: string, invoiceId: string) {
  return `${storeNamespace}:${workspaceId}:${invoiceId}`;
}

function trimToUndefined(value?: string | null) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function mapPaymentStatusError(
  message: string | undefined,
  fallback: "db_read_failed" | "db_write_failed"
): BillingPaymentStatusGatewayResult {
  if (message?.includes("current_assignee_required") || message?.includes("permission_missing") || message?.includes("actor_mismatch")) return { ok: false, status: 403, denialReason: "permission_missing" };
  if (message?.includes("billing_review_required")) return { ok: false, status: 409, denialReason: "billing_review_required" };
  if (message?.includes("invoice_unavailable")) return { ok: false, status: 409, denialReason: "invoice_unavailable" };
  return { ok: false, status: 500, error: fallback };
}

function mapPaymentStatusPayload(
  value: unknown,
  fallback: "db_read_failed" | "db_write_failed"
): BillingPaymentStatusGatewayResult {
  const payload = value as Partial<BillingPaymentStatusPayload> | null;
  if (!payload || !isPaymentStatusInvoice(payload.invoice) || !Array.isArray(payload.payments)) {
    return { ok: false, status: 500, error: fallback };
  }
  return {
    ok: true,
    invoice: payload.invoice,
    payments: payload.payments.filter(isPaymentSnapshot),
  };
}

function isPaymentStatusInvoice(value: unknown): value is BillingPaymentStatusInvoice {
  const invoice = value as Partial<BillingPaymentStatusInvoice> | null;
  return Boolean(
    invoice &&
    typeof invoice.id === "string" &&
    typeof invoice.workspaceId === "string" &&
    typeof invoice.encounterId === "string" &&
    typeof invoice.invoiceNo === "string" &&
    typeof invoice.status === "string" &&
    typeof invoice.paymentState === "string" &&
    typeof invoice.subtotalAmount === "number" &&
    typeof invoice.discountAmount === "number" &&
    typeof invoice.taxAmount === "number" &&
    typeof invoice.totalAmount === "number"
  );
}

function isPaymentSnapshot(value: unknown): value is Payment {
  const payment = value as Partial<Payment> | null;
  return Boolean(
    payment &&
    typeof payment.id === "string" &&
    typeof payment.invoiceId === "string" &&
    typeof payment.paymentMethod === "string" &&
    typeof payment.amount === "number" &&
    typeof payment.status === "string" &&
    typeof payment.paidAt === "string"
  );
}
