import type {
  EmrId,
  Invoice,
  InvoicePaymentState,
  InvoiceStatus,
  IsoDateTime,
  Payment,
} from "@/types/emr-domain";

export type BillingLifecycleStatus = "waiting" | "unpaid" | "paid" | "voided" | "refunded";

export type BillingAmountInclusion = "payable" | "excluded";

export type BillingActivityBasis =
  | "billing_requested_at"
  | "issued_at"
  | "paid_at"
  | "voided_at"
  | "created_at";

export type BillingInvoiceContractInput = Pick<
  Invoice,
  | "createdAt"
  | "id"
  | "issuedAt"
  | "paidAt"
  | "paymentState"
  | "status"
  | "totalAmount"
  | "unpaidReason"
> & {
  billingRequestedAt?: IsoDateTime;
  voidedAt?: IsoDateTime;
};

export type BillingContractInvoiceSnapshot = {
  activityAt: IsoDateTime;
  activityBasis: BillingActivityBasis;
  amountInclusion: BillingAmountInclusion;
  balanceAmount: number;
  invoiceId: EmrId;
  paidAmount: number;
  payableAmount: number;
  status: BillingLifecycleStatus;
  totalAmount: number;
};

const terminalExcludedStatuses = new Set<InvoiceStatus>(["paid", "refunded", "voided"]);

export function resolveBillingLifecycleStatus(
  invoice: Pick<Invoice, "paymentState" | "status" | "unpaidReason">,
): BillingLifecycleStatus {
  if (invoice.status === "voided") return "voided";
  if (invoice.status === "refunded" || invoice.paymentState === "refunded") return "refunded";
  if (invoice.status === "paid" || invoice.paymentState === "paid") return "paid";
  if (
    invoice.paymentState === "unpaid" ||
    invoice.paymentState === "failed" ||
    Boolean(invoice.unpaidReason)
  ) {
    return "unpaid";
  }

  return "waiting";
}

export function isBillingCheckoutPayableInvoice(
  invoice: Pick<Invoice, "paymentState" | "status" | "unpaidReason">,
) {
  const status = resolveBillingLifecycleStatus(invoice);
  return status === "waiting" || status === "unpaid";
}

export function resolveBillingAmountInclusion(
  invoice: Pick<Invoice, "paymentState" | "status" | "unpaidReason">,
): BillingAmountInclusion {
  return isBillingCheckoutPayableInvoice(invoice) ? "payable" : "excluded";
}

export function resolveBillingActivityAt(invoice: BillingInvoiceContractInput): {
  activityAt: IsoDateTime;
  activityBasis: BillingActivityBasis;
} {
  const status = resolveBillingLifecycleStatus(invoice);

  if (invoice.billingRequestedAt) {
    return { activityAt: invoice.billingRequestedAt, activityBasis: "billing_requested_at" };
  }
  if (status === "paid" && invoice.paidAt) {
    return { activityAt: invoice.paidAt, activityBasis: "paid_at" };
  }
  if (status === "voided" && invoice.voidedAt) {
    return { activityAt: invoice.voidedAt, activityBasis: "voided_at" };
  }
  if (invoice.issuedAt) {
    return { activityAt: invoice.issuedAt, activityBasis: "issued_at" };
  }

  return { activityAt: invoice.createdAt, activityBasis: "created_at" };
}

export function getInvoiceApprovedPaidAmount(invoiceId: EmrId, payments: Payment[]) {
  return payments
    .filter((payment) => payment.invoiceId === invoiceId && payment.status === "approved")
    .reduce((total, payment) => total + payment.amount, 0);
}

export function buildBillingContractInvoiceSnapshot({
  invoice,
  payments,
}: {
  invoice: BillingInvoiceContractInput;
  payments: Payment[];
}): BillingContractInvoiceSnapshot {
  const { activityAt, activityBasis } = resolveBillingActivityAt(invoice);
  const paidAmount = getInvoiceApprovedPaidAmount(invoice.id, payments);
  const amountInclusion = resolveBillingAmountInclusion(invoice);
  const balanceAmount = Math.max(0, invoice.totalAmount - paidAmount);

  return {
    activityAt,
    activityBasis,
    amountInclusion,
    balanceAmount,
    invoiceId: invoice.id,
    paidAmount,
    payableAmount: amountInclusion === "payable" ? balanceAmount : 0,
    status: resolveBillingLifecycleStatus(invoice),
    totalAmount: invoice.totalAmount,
  };
}

export function summarizeBillingContractInvoices({
  invoices,
  payments,
}: {
  invoices: BillingInvoiceContractInput[];
  payments: Payment[];
}) {
  const snapshots = invoices.map((invoice) =>
    buildBillingContractInvoiceSnapshot({ invoice, payments }),
  );

  return {
    excludedAmount: snapshots
      .filter((snapshot) => snapshot.amountInclusion === "excluded")
      .reduce((total, snapshot) => total + snapshot.balanceAmount, 0),
    excludedCount: snapshots.filter((snapshot) => snapshot.amountInclusion === "excluded").length,
    payableAmount: snapshots.reduce((total, snapshot) => total + snapshot.payableAmount, 0),
    payableCount: snapshots.filter((snapshot) => snapshot.amountInclusion === "payable").length,
    snapshots,
  };
}

export function isTerminalExcludedInvoiceStatus(status: InvoiceStatus, paymentState?: InvoicePaymentState) {
  return terminalExcludedStatuses.has(status) || paymentState === "refunded";
}
