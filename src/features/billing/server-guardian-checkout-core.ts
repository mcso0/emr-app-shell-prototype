import {
  createMockWorkspacePermissionAdapter,
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";
import {
  buildBillingContractInvoiceSnapshot,
  resolveBillingActivityAt,
  resolveBillingAmountInclusion,
  resolveBillingLifecycleStatus,
  summarizeBillingContractInvoices,
  type BillingContractInvoiceSnapshot,
  type BillingLifecycleStatus,
} from "@/features/billing/billing-data-contract";
import {
  mockEncounters,
  mockGuardians,
  mockInvoiceLines,
  mockInvoices,
  mockOrders,
  mockPatientGuardians,
  mockPatients,
  mockPayments,
  mockStaffUsers,
} from "@/mocks/emr-domain";
import type {
  Encounter,
  Guardian,
  Invoice,
  InvoiceLine,
  Patient,
  PatientGuardian,
  Payment,
  PaymentMethod,
} from "@/types/emr-domain";

export type GuardianBillingLedgerStatusFilter =
  | "all"
  | "waiting"
  | "unpaid"
  | "paid"
  | "voided"
  | "refunded";

export type GuardianBillingLedgerInput = {
  guardianId?: string;
  includeCoGuardianInvoices?: boolean;
  statusFilter?: GuardianBillingLedgerStatusFilter;
};

export type GuardianBillingLedgerRow = {
  activityAt: string;
  activityBasis: BillingContractInvoiceSnapshot["activityBasis"];
  amountInclusion: BillingContractInvoiceSnapshot["amountInclusion"];
  balanceAmount: number;
  encounterId: string;
  guardianId?: string;
  guardianName?: string;
  invoiceId: string;
  invoiceNo: string;
  lineCount: number;
  lineSummary: string;
  patientId?: string;
  patientName?: string;
  payableAmount: number;
  requestedByName: string;
  status: BillingLifecycleStatus;
  totalAmount: number;
};

export type GuardianCheckoutAdjustmentInput = {
  adjustmentType: "discount" | "surcharge" | "manual_price_override" | "tax_override";
  amount: number;
  reason?: string;
  invoiceId?: string;
  invoiceLineId?: string;
};

export type GuardianCheckoutPrepareInput = {
  adjustmentReason?: string;
  adjustments?: GuardianCheckoutAdjustmentInput[];
  invoiceIds?: string[];
  paymentMemo?: string;
  paymentMethod?: PaymentMethod;
};

export type GuardianCheckoutSessionPayload = {
  checkoutSession: {
    id: string;
    status: "prepared";
    workspaceId: string;
    guardianId?: string;
    payerSnapshot: Record<string, unknown>;
    selectedInvoiceIds: string[];
    payableAmount: number;
    excludedAmount: number;
    excludedCount: number;
    paymentMethod?: PaymentMethod;
    paymentMemo?: string;
    preparedAt: string;
  };
  invoiceSnapshots: BillingContractInvoiceSnapshot[];
};

export type BillingInvoiceTransitionTarget = "waiting" | "unpaid" | "paid" | "voided";

export type BillingInvoiceTransitionInput = {
  invoiceId?: string;
  paymentMethod?: PaymentMethod;
  reason?: string;
  target?: BillingInvoiceTransitionTarget;
};

export type BillingInvoiceTransitionPayload = {
  auditEvent: {
    actorUserId: string | null;
    amountSnapshot: number;
    eventType: "billing.invoice_status_transitioned";
    invoiceId: string;
    previousStatus: BillingLifecycleStatus;
    reason: string;
    source: "guardian_checkout";
    targetStatus: BillingLifecycleStatus;
    transitionedAt: string;
  };
  invoice: Invoice;
  payments: Payment[];
};

export type GuardianCheckoutGatewayResult<T> =
  | ({ ok: true } & T)
  | { ok: false; status: 409; denialReason: "guardian_unavailable" | "invoice_unavailable" }
  | { ok: false; status: 500; error: "db_read_failed" | "db_write_failed" };

export type GuardianCheckoutGateway = {
  listLedger(input: {
    input: Required<GuardianBillingLedgerInput>;
    workspaceId: string;
  }): Promise<GuardianCheckoutGatewayResult<{ rows: GuardianBillingLedgerRow[] }>>;
  prepareCheckout(input: {
    actorUserId: string | null;
    input: Required<GuardianCheckoutPrepareInput>;
    workspaceId: string;
  }): Promise<GuardianCheckoutGatewayResult<GuardianCheckoutSessionPayload>>;
  transitionInvoiceStatus(input: {
    actorUserId: string | null;
    input: Required<BillingInvoiceTransitionInput>;
    workspaceId: string;
  }): Promise<GuardianCheckoutGatewayResult<BillingInvoiceTransitionPayload>>;
};

export type GuardianBillingLedgerResult =
  | ({
      ok: true;
      status: 200;
      enforcedBy: "guardian-billing-ledger";
      rows: GuardianBillingLedgerRow[];
    })
  | { ok: false; status: 400; error: "invalid_input"; fieldErrors: Partial<Record<"guardianId", string>> }
  | { ok: false; status: 401 | 403; denialReason: WorkspacePermissionDenialReason }
  | { ok: false; status: 409; denialReason: "guardian_unavailable" | "invoice_unavailable" }
  | { ok: false; status: 500; error: "db_read_failed" };

export type GuardianCheckoutPrepareResult =
  | ({
      ok: true;
      status: 200;
      enforcedBy: "guardian-checkout-session";
    } & GuardianCheckoutSessionPayload)
  | {
      ok: false;
      status: 400;
      error: "invalid_input";
      fieldErrors: Partial<Record<"invoiceIds" | "adjustments", string>>;
    }
  | { ok: false; status: 401 | 403; denialReason: WorkspacePermissionDenialReason }
  | { ok: false; status: 409; denialReason: "guardian_unavailable" | "invoice_unavailable" }
  | { ok: false; status: 500; error: "db_write_failed" };

export type BillingInvoiceTransitionResult =
  | ({
      ok: true;
      status: 200;
      enforcedBy: "billing-invoice-status-transition";
    } & BillingInvoiceTransitionPayload)
  | {
      ok: false;
      status: 400;
      error: "invalid_input";
      fieldErrors: Partial<Record<"invoiceId" | "target" | "reason" | "paymentMethod", string>>;
    }
  | { ok: false; status: 401 | 403; denialReason: WorkspacePermissionDenialReason }
  | { ok: false; status: 409; denialReason: "guardian_unavailable" | "invoice_unavailable" }
  | { ok: false; status: 500; error: "db_write_failed" };

const defaultLedgerInput: Required<GuardianBillingLedgerInput> = {
  guardianId: "",
  includeCoGuardianInvoices: false,
  statusFilter: "all",
};

const defaultPrepareInput: Required<GuardianCheckoutPrepareInput> = {
  adjustmentReason: "",
  adjustments: [],
  invoiceIds: [],
  paymentMemo: "",
  paymentMethod: "card",
};

const defaultTransitionInput: Required<BillingInvoiceTransitionInput> = {
  invoiceId: "",
  paymentMethod: "card",
  reason: "",
  target: "waiting",
};

export async function listGuardianBillingLedger({
  actorUserId,
  gateway = createMockGuardianCheckoutGateway(),
  input,
  permissionAdapter = createDemoGuardianCheckoutPermissionAdapter(),
  workspaceId,
}: {
  actorUserId: string | null;
  gateway?: Pick<GuardianCheckoutGateway, "listLedger">;
  input: GuardianBillingLedgerInput;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<GuardianBillingLedgerResult> {
  const normalized = { ...defaultLedgerInput, ...input, guardianId: trimToEmpty(input.guardianId) };
  if (!normalized.guardianId) {
    return { ok: false, status: 400, error: "invalid_input", fieldErrors: { guardianId: "보호자를 선택해 주세요." } };
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

  const result = await gateway.listLedger({ input: normalized, workspaceId });
  if (!result.ok) {
    if (result.status === 409) return result;
    return { ok: false, status: 500, error: "db_read_failed" };
  }

  return { ok: true, status: 200, enforcedBy: "guardian-billing-ledger", rows: result.rows };
}

export async function prepareGuardianCheckoutSession({
  actorUserId,
  gateway = createMockGuardianCheckoutGateway(),
  input,
  permissionAdapter = createDemoGuardianCheckoutPermissionAdapter(),
  workspaceId,
}: {
  actorUserId: string | null;
  gateway?: Pick<GuardianCheckoutGateway, "prepareCheckout">;
  input: GuardianCheckoutPrepareInput;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<GuardianCheckoutPrepareResult> {
  const normalized = normalizePrepareInput(input);
  const validation = validatePrepareInput(normalized);
  if (!validation.valid) return { ok: false, status: 400, error: "invalid_input", fieldErrors: validation.fieldErrors };

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

  const result = await gateway.prepareCheckout({ actorUserId, input: normalized, workspaceId });
  if (!result.ok) {
    if (result.status === 409) return result;
    return { ok: false, status: 500, error: "db_write_failed" };
  }

  return {
    ok: true,
    status: 200,
    enforcedBy: "guardian-checkout-session",
    checkoutSession: result.checkoutSession,
    invoiceSnapshots: result.invoiceSnapshots,
  };
}

export async function transitionBillingInvoiceStatus({
  actorUserId,
  gateway = createMockGuardianCheckoutGateway(),
  input,
  permissionAdapter = createDemoGuardianCheckoutPermissionAdapter(),
  workspaceId,
}: {
  actorUserId: string | null;
  gateway?: Pick<GuardianCheckoutGateway, "transitionInvoiceStatus">;
  input: BillingInvoiceTransitionInput;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<BillingInvoiceTransitionResult> {
  const normalized = normalizeTransitionInput(input);
  const validation = validateTransitionInput(normalized);
  if (!validation.valid) return { ok: false, status: 400, error: "invalid_input", fieldErrors: validation.fieldErrors };

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

  const result = await gateway.transitionInvoiceStatus({ actorUserId, input: normalized, workspaceId });
  if (!result.ok) {
    if (result.status === 409) return result;
    return { ok: false, status: 500, error: "db_write_failed" };
  }

  return {
    ok: true,
    status: 200,
    enforcedBy: "billing-invoice-status-transition",
    auditEvent: result.auditEvent,
    invoice: result.invoice,
    payments: result.payments,
  };
}

export function createMockGuardianCheckoutGateway(
  dataset: {
    encounters?: Encounter[];
    guardians?: Guardian[];
    invoiceLines?: InvoiceLine[];
    invoices?: Invoice[];
    patientGuardians?: PatientGuardian[];
    patients?: Patient[];
    payments?: Payment[];
  } = {},
  now = () => new Date().toISOString(),
): GuardianCheckoutGateway {
  const encounters = dataset.encounters ?? mockEncounters;
  const guardians = dataset.guardians ?? mockGuardians;
  const invoiceLines = dataset.invoiceLines ?? mockInvoiceLines;
  const invoices = dataset.invoices ?? mockInvoices;
  const patientGuardians = dataset.patientGuardians ?? mockPatientGuardians;
  const patients = dataset.patients ?? mockPatients;
  const payments = [...(dataset.payments ?? mockPayments)];

  return {
    async listLedger({ input, workspaceId }) {
      const guardian = guardians.find((item) => item.workspaceId === workspaceId && item.id === input.guardianId);
      if (!guardian) return { ok: false, status: 409, denialReason: "guardian_unavailable" };
      return {
        ok: true,
        rows: buildGuardianLedgerRows({
          encounters,
          guardianId: input.guardianId,
          guardians,
          includeCoGuardianInvoices: input.includeCoGuardianInvoices,
          invoiceLines,
          invoices,
          patientGuardians,
          patients,
          payments,
          statusFilter: input.statusFilter,
          workspaceId,
        }),
      };
    },
    async prepareCheckout({ input, workspaceId }) {
      const selectedInvoices = invoices.filter((invoice) => invoice.workspaceId === workspaceId && input.invoiceIds.includes(invoice.id));
      if (selectedInvoices.length !== input.invoiceIds.length) {
        return { ok: false, status: 409, denialReason: "invoice_unavailable" };
      }

      const summary = summarizeBillingContractInvoices({ invoices: selectedInvoices, payments });
      const firstGuardianId = selectedInvoices.find((invoice) => invoice.guardianId)?.guardianId;
      const guardian = firstGuardianId
        ? guardians.find((item) => item.workspaceId === workspaceId && item.id === firstGuardianId)
        : undefined;
      const preparedAt = now();

      return {
        ok: true,
        checkoutSession: {
          id: `checkout-${preparedAt}-${input.invoiceIds.join("-")}`,
          status: "prepared",
          workspaceId,
          guardianId: firstGuardianId,
          payerSnapshot: guardian
            ? { guardianId: guardian.id, name: guardian.name, mobilePhone: guardian.mobilePhone ?? null }
            : {},
          selectedInvoiceIds: input.invoiceIds,
          payableAmount: summary.payableAmount,
          excludedAmount: summary.excludedAmount,
          excludedCount: summary.excludedCount,
          paymentMethod: input.paymentMethod,
          paymentMemo: input.paymentMemo || undefined,
          preparedAt,
        },
        invoiceSnapshots: summary.snapshots,
      };
    },
    async transitionInvoiceStatus({ actorUserId, input, workspaceId }) {
      const invoice = invoices.find((item) => item.workspaceId === workspaceId && item.id === input.invoiceId);
      if (!invoice) return { ok: false, status: 409, denialReason: "invoice_unavailable" };
      const previousStatus = resolveBillingLifecycleStatus(invoice);
      const transitionedAt = now();
      const nextInvoice = applyTransition(invoice, input, transitionedAt);
      const nextPayments = input.target === "paid"
        ? upsertApprovedPayment(payments, nextInvoice, input.paymentMethod, transitionedAt)
        : payments.filter((payment) => payment.invoiceId !== invoice.id || payment.status !== "approved");

      return {
        ok: true,
        auditEvent: {
          actorUserId,
          amountSnapshot: invoice.totalAmount,
          eventType: "billing.invoice_status_transitioned",
          invoiceId: invoice.id,
          previousStatus,
          reason: input.reason,
          source: "guardian_checkout",
          targetStatus: resolveBillingLifecycleStatus(nextInvoice),
          transitionedAt,
        },
        invoice: nextInvoice,
        payments: nextPayments.filter((payment) => payment.invoiceId === invoice.id),
      };
    },
  };
}

export type SupabaseGuardianCheckoutRpcClient = {
  rpc(functionName: string, args: Record<string, unknown>): Promise<{ data: unknown; error: { message?: string } | null }>;
};

export function createSupabaseGuardianCheckoutGateway(
  client: SupabaseGuardianCheckoutRpcClient,
): GuardianCheckoutGateway {
  return {
    async listLedger({ input, workspaceId }) {
      const { data, error } = await client.rpc("clair_list_guardian_billing_ledger", {
        p_workspace_id: workspaceId,
        p_guardian_id: input.guardianId,
        p_include_co_guardian_invoices: input.includeCoGuardianInvoices,
        p_status_filter: input.statusFilter,
      });
      if (error) return mapGuardianCheckoutError(error.message, "db_read_failed");
      const payload = data as { rows?: GuardianBillingLedgerRow[] } | GuardianBillingLedgerRow[] | null;
      const rows = Array.isArray(payload) ? payload : payload?.rows;
      return Array.isArray(rows) ? { ok: true, rows } : { ok: false, status: 500, error: "db_read_failed" };
    },
    async prepareCheckout({ actorUserId, input, workspaceId }) {
      const { data, error } = await client.rpc("clair_prepare_billing_checkout_session", {
        p_workspace_id: workspaceId,
        p_actor_user_id: actorUserId,
        p_invoice_ids: input.invoiceIds,
        p_payment_method: input.paymentMethod,
        p_adjustments: input.adjustments,
        p_payment_memo: input.paymentMemo || null,
      });
      if (error) return mapGuardianCheckoutError(error.message, "db_write_failed");
      return mapCheckoutSessionPayload(data);
    },
    async transitionInvoiceStatus({ actorUserId, input, workspaceId }) {
      const { data, error } = await client.rpc("clair_transition_billing_invoice_status", {
        p_workspace_id: workspaceId,
        p_actor_user_id: actorUserId,
        p_invoice_id: input.invoiceId,
        p_target: input.target,
        p_payment_method: input.paymentMethod,
        p_reason: input.reason,
      });
      if (error) return mapGuardianCheckoutError(error.message, "db_write_failed");
      return mapTransitionPayload(data);
    },
  };
}

function buildGuardianLedgerRows({
  encounters,
  guardianId,
  guardians,
  includeCoGuardianInvoices,
  invoiceLines,
  invoices,
  patientGuardians,
  patients,
  payments,
  statusFilter,
  workspaceId,
}: {
  encounters: Encounter[];
  guardianId: string;
  guardians: Guardian[];
  includeCoGuardianInvoices: boolean;
  invoiceLines: InvoiceLine[];
  invoices: Invoice[];
  patientGuardians: PatientGuardian[];
  patients: Patient[];
  payments: Payment[];
  statusFilter: GuardianBillingLedgerStatusFilter;
  workspaceId: string;
}) {
  const ownedPatientIds = new Set(
    patientGuardians
      .filter((relationship) => relationship.guardianId === guardianId)
      .map((relationship) => relationship.patientId),
  );
  const encounterById = new Map(encounters.map((encounter) => [encounter.id, encounter]));
  const scopedEncounterIds = new Set(
    encounters.filter((encounter) => ownedPatientIds.has(encounter.patientId)).map((encounter) => encounter.id),
  );

  return invoices
    .filter((invoice) => invoice.workspaceId === workspaceId)
    .filter((invoice) => scopedEncounterIds.has(invoice.encounterId))
    .filter((invoice) => includeCoGuardianInvoices || invoice.guardianId === guardianId)
    .map<GuardianBillingLedgerRow | null>((invoice) => {
      const encounter = encounterById.get(invoice.encounterId);
      if (!encounter) return null;
      const patient = patients.find((item) => item.id === encounter.patientId);
      const guardian = invoice.guardianId ? guardians.find((item) => item.id === invoice.guardianId) : undefined;
      const lines = invoiceLines.filter((line) => line.invoiceId === invoice.id);
      const snapshot = buildBillingContractInvoiceSnapshot({ invoice, payments });
      const { activityAt, activityBasis } = resolveBillingActivityAt(invoice);

      return {
        activityAt,
        activityBasis,
        amountInclusion: resolveBillingAmountInclusion(invoice),
        balanceAmount: snapshot.balanceAmount,
        encounterId: encounter.id,
        guardianId: guardian?.id,
        guardianName: guardian?.name,
        invoiceId: invoice.id,
        invoiceNo: invoice.invoiceNo,
        lineCount: lines.length,
        lineSummary: summarizeLines(lines),
        patientId: patient?.id,
        patientName: patient?.name,
        payableAmount: snapshot.payableAmount,
        requestedByName: resolveRequesterName(invoice, lines, encounter),
        status: snapshot.status,
        totalAmount: invoice.totalAmount,
      };
    })
    .filter((row): row is GuardianBillingLedgerRow => Boolean(row))
    .filter((row) => statusFilter === "all" || row.status === statusFilter)
    .sort((a, b) => b.activityAt.localeCompare(a.activityAt));
}

function summarizeLines(lines: InvoiceLine[]) {
  if (lines.length === 0) return "청구 항목 없음";
  return lines.length > 1 ? `${lines[0].description} 외 ${lines.length - 1}건` : lines[0].description;
}

function getStaffName(userId?: string | null) {
  return userId ? mockStaffUsers.find((staff) => staff.id === userId)?.name : undefined;
}

function resolveRequesterName(invoice: Invoice, lines: InvoiceLine[], encounter: Encounter) {
  const firstOrderLine = lines.find((line) => line.orderId);
  const order = firstOrderLine?.orderId
    ? mockOrders.find((item) => item.id === firstOrderLine.orderId)
    : undefined;

  return (
    getStaffName(order?.requestedByUserId) ??
    getStaffName(invoice.issuedByUserId) ??
    getStaffName(encounter.primaryVeterinarianId) ??
    "이수지"
  );
}

function applyTransition(
  invoice: Invoice,
  input: Required<BillingInvoiceTransitionInput>,
  transitionedAt: string,
): Invoice {
  if (input.target === "paid") {
    return {
      ...invoice,
      issuedAt: invoice.issuedAt ?? transitionedAt,
      paidAt: transitionedAt,
      paymentState: "paid",
      selectedPaymentMethod: input.paymentMethod,
      status: "paid",
      unpaidReason: undefined,
    };
  }
  if (input.target === "unpaid") {
    return {
      ...invoice,
      issuedAt: invoice.issuedAt ?? transitionedAt,
      paidAt: undefined,
      paymentState: "unpaid",
      selectedPaymentMethod: input.paymentMethod,
      status: "issued",
      unpaidReason: input.reason,
    };
  }
  if (input.target === "voided") {
    return {
      ...invoice,
      paidAt: undefined,
      paymentState: "none",
      status: "voided",
      unpaidReason: undefined,
    };
  }

  return {
    ...invoice,
    paidAt: undefined,
    paymentState: "none",
    selectedPaymentMethod: undefined,
    status: "draft",
    unpaidReason: undefined,
  };
}

function upsertApprovedPayment(
  payments: Payment[],
  invoice: Invoice,
  paymentMethod: PaymentMethod,
  paidAt: string,
) {
  const existing = payments.find((payment) => payment.invoiceId === invoice.id && payment.status === "approved");
  const payment = {
    id: existing?.id ?? `payment-${invoice.id}-${paymentMethod}`,
    invoiceId: invoice.id,
    paymentMethod,
    amount: invoice.totalAmount,
    status: "approved" as const,
    paidAt,
    metadata: { prototype: true, source: "billing-invoice-status-transition" },
  };

  return existing
    ? payments.map((item) => item.id === existing.id ? payment : item)
    : [...payments, payment];
}

function normalizePrepareInput(input: GuardianCheckoutPrepareInput): Required<GuardianCheckoutPrepareInput> {
  return {
    ...defaultPrepareInput,
    ...input,
    adjustmentReason: input.adjustmentReason?.trim() ?? "",
    adjustments: input.adjustments ?? [],
    invoiceIds: Array.isArray(input.invoiceIds) ? input.invoiceIds.map((id) => id.trim()).filter(Boolean) : [],
    paymentMemo: input.paymentMemo?.trim() ?? "",
  };
}

function validatePrepareInput(input: Required<GuardianCheckoutPrepareInput>) {
  const fieldErrors: Partial<Record<"invoiceIds" | "adjustments", string>> = {};
  if (input.invoiceIds.length === 0) fieldErrors.invoiceIds = "checkout에 포함할 청구서를 선택해 주세요.";
  const adjustmentWithoutReason = input.adjustments.some(
    (adjustment) => adjustment.amount > 0 && !adjustment.reason?.trim(),
  );
  if (adjustmentWithoutReason) fieldErrors.adjustments = "할인/할증에는 사유가 필요합니다.";
  if (Object.keys(fieldErrors).length > 0) return { valid: false as const, fieldErrors };
  return { valid: true as const, fieldErrors: {} };
}

function normalizeTransitionInput(input: BillingInvoiceTransitionInput): Required<BillingInvoiceTransitionInput> {
  return {
    ...defaultTransitionInput,
    ...input,
    invoiceId: trimToEmpty(input.invoiceId),
    reason: input.reason?.trim() ?? "",
  };
}

function validateTransitionInput(input: Required<BillingInvoiceTransitionInput>) {
  const fieldErrors: Partial<Record<"invoiceId" | "target" | "reason" | "paymentMethod", string>> = {};
  if (!input.invoiceId) fieldErrors.invoiceId = "청구서를 선택해 주세요.";
  if (!["waiting", "unpaid", "paid", "voided"].includes(input.target)) fieldErrors.target = "변경할 상태를 선택해 주세요.";
  if (!input.reason) fieldErrors.reason = "상태 변경 사유를 입력해 주세요.";
  if ((input.target === "paid" || input.target === "unpaid") && !input.paymentMethod) {
    fieldErrors.paymentMethod = "결제 수단을 선택해 주세요.";
  }
  if (Object.keys(fieldErrors).length > 0) return { valid: false as const, fieldErrors };
  return { valid: true as const, fieldErrors: {} };
}

export function createDemoGuardianCheckoutPermissionAdapter() {
  return createMockWorkspacePermissionAdapter({
    users: [
      { id: "playwright-default-session", status: "active" },
      { id: "user-admin", status: "active" },
      { id: "user-front-desk", status: "active" },
      { id: "user-tech", status: "active" },
    ],
    memberships: [
      { id: "membership-playwright-admin", workspaceId: "clair-demo", userId: "playwright-default-session", roles: ["hospital_admin"], status: "active" },
      { id: "membership-admin", workspaceId: "clair-demo", userId: "user-admin", roles: ["hospital_admin"], status: "active" },
      { id: "membership-front-desk", workspaceId: "clair-demo", userId: "user-front-desk", roles: ["front_desk"], status: "active" },
      { id: "membership-tech", workspaceId: "clair-demo", userId: "user-tech", roles: ["technician"], status: "active" },
    ],
  });
}

function mapGuardianCheckoutError(
  message: string | undefined,
  fallback: "db_read_failed" | "db_write_failed",
): GuardianCheckoutGatewayResult<never> {
  if (message?.includes("guardian_unavailable")) return { ok: false, status: 409, denialReason: "guardian_unavailable" };
  if (message?.includes("invoice_unavailable")) return { ok: false, status: 409, denialReason: "invoice_unavailable" };
  return { ok: false, status: 500, error: fallback };
}

function mapCheckoutSessionPayload(value: unknown): GuardianCheckoutGatewayResult<GuardianCheckoutSessionPayload> {
  const payload = value as Partial<GuardianCheckoutSessionPayload> | null;
  if (!payload?.checkoutSession || !Array.isArray(payload.invoiceSnapshots)) {
    return { ok: false, status: 500, error: "db_write_failed" };
  }
  return {
    ok: true,
    checkoutSession: payload.checkoutSession as GuardianCheckoutSessionPayload["checkoutSession"],
    invoiceSnapshots: payload.invoiceSnapshots as BillingContractInvoiceSnapshot[],
  };
}

function mapTransitionPayload(value: unknown): GuardianCheckoutGatewayResult<BillingInvoiceTransitionPayload> {
  const payload = value as Partial<BillingInvoiceTransitionPayload> | null;
  if (!payload?.invoice || !Array.isArray(payload.payments) || !payload.auditEvent) {
    return { ok: false, status: 500, error: "db_write_failed" };
  }
  return {
    ok: true,
    auditEvent: payload.auditEvent as BillingInvoiceTransitionPayload["auditEvent"],
    invoice: payload.invoice,
    payments: payload.payments,
  };
}

function trimToEmpty(value?: string | null) {
  return typeof value === "string" ? value.trim() : "";
}
