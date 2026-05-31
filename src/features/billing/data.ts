import {
  mockEncounters,
  mockGuardians,
  mockOrders,
  mockPatients,
  mockPatientGuardians,
  mockStaffUsers,
} from "@/mocks/emr-domain";
import type {
  EmrId,
  EmrOrder,
  Encounter,
  Guardian,
  Invoice,
  InvoiceLine,
  Patient,
  Payment,
} from "@/types/emr-domain";
import type { BillingFilter } from "@/features/billing/store";

export type BillingQueueRow = {
  encounter: Encounter;
  guardian?: Guardian;
  invoice: Invoice;
  lineCount: number;
  paidAmount: number;
  patient?: Patient;
};

export type BillingGuardianGroup = {
  guardian: Guardian;
  invoiceLines: InvoiceLine[];
  invoices: Invoice[];
  paidAmount: number;
  patients: Patient[];
  payments: Payment[];
  totalDueAmount: number;
};

export type BillingGuardianLedgerRow = BillingQueueRow & {
  activityAt: string;
  lineSummary: string;
  requestedByName: string;
  status: BillingFilter;
};

export type BillingCheckoutLine = {
  line: InvoiceLine;
  order?: EmrOrder;
  source: "chart_order" | "billing_add_on";
};

export type BillingCheckoutGroup = {
  encounter: Encounter;
  guardian?: Guardian;
  invoice: Invoice;
  lines: BillingCheckoutLine[];
  patient?: Patient;
  paidAmount: number;
  totalAmount: number;
};

export type BillingDetail = BillingQueueRow & {
  guardianGroup?: BillingGuardianGroup;
  invoiceLines: InvoiceLine[];
  payments: Payment[];
};

const closedStatuses = new Set(["paid", "refunded", "voided"]);

export const isReasonBackedUnpaidInvoice = (invoice: Invoice) =>
  invoice.paymentState === "unpaid" ||
  invoice.paymentState === "failed" ||
  Boolean(invoice.unpaidReason);

export const getBillingFilterForInvoice = (invoice: Invoice): BillingFilter => {
  if (closedStatuses.has(invoice.status)) return "closed";
  if (isReasonBackedUnpaidInvoice(invoice)) return "unpaid";

  return "waiting";
};

const getPaidAmount = (invoiceId: EmrId, payments: Payment[]) =>
  payments
    .filter((payment) => payment.invoiceId === invoiceId && payment.status === "approved")
    .reduce((total, payment) => total + payment.amount, 0);

const isBillingHistoryDemoInvoice = (invoice: Invoice) =>
  invoice.id.includes("-history-");

const getStaffName = (userId?: EmrId) =>
  userId ? mockStaffUsers.find((staff) => staff.id === userId)?.name : undefined;

const getInvoiceBillingLineSummary = (lines: InvoiceLine[]) => {
  if (!lines.length) return "청구 항목 없음";

  const firstOrderLine =
    lines.find((line) => line.orderId && mockOrders.some((order) => order.id === line.orderId)) ??
    lines[0];
  const remainingCount = Math.max(0, lines.length - 1);

  return remainingCount > 0
    ? `${firstOrderLine.description} 외 ${remainingCount}건`
    : firstOrderLine.description;
};

const getInvoiceBillingRequesterName = (invoice: Invoice, lines: InvoiceLine[]) => {
  const firstOrderLine = lines.find((line) => line.orderId);
  const order = firstOrderLine?.orderId
    ? mockOrders.find((item) => item.id === firstOrderLine.orderId)
    : undefined;

  return (
    getStaffName(order?.requestedByUserId) ??
    getStaffName(invoice.issuedByUserId) ??
    "요청자 미지정"
  );
};

export const getBillingQueueRows = (
  invoices: Invoice[],
  invoiceLines: InvoiceLine[],
  payments: Payment[],
  filter: BillingFilter
): BillingQueueRow[] =>
  invoices
    .filter((invoice) => !isBillingHistoryDemoInvoice(invoice))
    .filter((invoice) => getBillingFilterForInvoice(invoice) === filter)
    .reduce<BillingQueueRow[]>((rows, invoice) => {
      const encounter = mockEncounters.find((item) => item.id === invoice.encounterId);

      if (!encounter) return rows;

      rows.push({
        encounter,
        guardian: invoice.guardianId
          ? mockGuardians.find((guardian) => guardian.id === invoice.guardianId)
          : undefined,
        invoice,
        lineCount: invoiceLines.filter((line) => line.invoiceId === invoice.id).length,
        paidAmount: getPaidAmount(invoice.id, payments),
        patient: mockPatients.find((patient) => patient.id === encounter.patientId),
      });

      return rows;
    }, [])
    .sort((a, b) => (b.invoice.issuedAt ?? b.invoice.createdAt).localeCompare(a.invoice.issuedAt ?? a.invoice.createdAt));

export const hasGuardianCoGuardianContext = (guardianId?: EmrId) => {
  if (!guardianId) return false;

  const patientIds = mockPatientGuardians
    .filter((relationship) => relationship.guardianId === guardianId)
    .map((relationship) => relationship.patientId);

  return patientIds.some((patientId) =>
    mockPatientGuardians.some(
      (relationship) =>
        relationship.patientId === patientId &&
        relationship.guardianId !== guardianId,
    ),
  );
};

export const getBillingGuardianLedgerRows = ({
  guardianId,
  includeCoGuardianInvoices,
  invoiceLines,
  invoices,
  payments,
}: {
  guardianId?: EmrId;
  includeCoGuardianInvoices: boolean;
  invoiceLines: InvoiceLine[];
  invoices: Invoice[];
  payments: Payment[];
}): BillingGuardianLedgerRow[] => {
  if (!guardianId) return [];

  const ownedPatientIds = new Set(
    mockPatientGuardians
      .filter((relationship) => relationship.guardianId === guardianId)
      .map((relationship) => relationship.patientId),
  );
  const encounterIds = new Set(
    mockEncounters
      .filter((encounter) => ownedPatientIds.has(encounter.patientId))
      .map((encounter) => encounter.id),
  );
  const scopedInvoices = invoices.filter((invoice) => {
    if (!encounterIds.has(invoice.encounterId)) return false;
    if (includeCoGuardianInvoices) return true;

    return invoice.guardianId === guardianId;
  });

  return scopedInvoices
    .reduce<BillingGuardianLedgerRow[]>((rows, invoice) => {
      const encounter = mockEncounters.find((item) => item.id === invoice.encounterId);
      if (!encounter) return rows;

      const invoiceScopedLines = invoiceLines.filter((line) => line.invoiceId === invoice.id);

      rows.push({
        activityAt: invoice.issuedAt ?? invoice.createdAt,
        encounter,
        guardian: invoice.guardianId
          ? mockGuardians.find((item) => item.id === invoice.guardianId)
          : undefined,
        invoice,
        lineCount: invoiceScopedLines.length,
        lineSummary: getInvoiceBillingLineSummary(invoiceScopedLines),
        paidAmount: getPaidAmount(invoice.id, payments),
        patient: mockPatients.find((patient) => patient.id === encounter.patientId),
        requestedByName: getInvoiceBillingRequesterName(invoice, invoiceScopedLines),
        status: getBillingFilterForInvoice(invoice),
      });

      return rows;
    }, [])
    .sort((a, b) => b.activityAt.localeCompare(a.activityAt));
};

export const getBillingCheckoutGroups = ({
  invoiceLines,
  invoices,
  payments,
  selectedInvoiceIds,
}: {
  invoiceLines: InvoiceLine[];
  invoices: Invoice[];
  payments: Payment[];
  selectedInvoiceIds: EmrId[];
}): BillingCheckoutGroup[] =>
  selectedInvoiceIds
    .reduce<BillingCheckoutGroup[]>((groups, invoiceId) => {
      const invoice = invoices.find((item) => item.id === invoiceId);
      if (!invoice) return groups;

      const encounter = mockEncounters.find((item) => item.id === invoice.encounterId);
      if (!encounter) return groups;

      const lines = invoiceLines
        .filter((line) => line.invoiceId === invoice.id)
        .map<BillingCheckoutLine>((line) => {
          const order = line.orderId
            ? mockOrders.find((item) => item.id === line.orderId)
            : undefined;

          return {
            line,
            order,
            source: order ? "chart_order" : "billing_add_on",
          };
        });

      groups.push({
        encounter,
        guardian: invoice.guardianId
          ? mockGuardians.find((item) => item.id === invoice.guardianId)
          : undefined,
        invoice,
        lines,
        paidAmount: getPaidAmount(invoice.id, payments),
        patient: mockPatients.find((patient) => patient.id === encounter.patientId),
        totalAmount: lines.reduce((total, item) => total + item.line.lineTotal, 0),
      });

      return groups;
    }, []);

export const getBillingGuardianGroups = (
  invoices: Invoice[],
  invoiceLines: InvoiceLine[],
  payments: Payment[]
): BillingGuardianGroup[] =>
  mockGuardians
    .map((guardian) => {
      const guardianInvoices = invoices.filter((invoice) => invoice.guardianId === guardian.id);
      const invoiceIds = new Set(guardianInvoices.map((invoice) => invoice.id));
      const encounterIds = new Set(guardianInvoices.map((invoice) => invoice.encounterId));
      const patientIds = new Set(
        mockEncounters
          .filter((encounter) => encounterIds.has(encounter.id))
          .map((encounter) => encounter.patientId)
      );
      const guardianPayments = payments.filter((payment) => invoiceIds.has(payment.invoiceId));
      const paidAmount = guardianPayments
        .filter((payment) => payment.status === "approved")
        .reduce((total, payment) => total + payment.amount, 0);

      return {
        guardian,
        invoiceLines: invoiceLines.filter((line) => invoiceIds.has(line.invoiceId)),
        invoices: guardianInvoices,
        paidAmount,
        patients: mockPatients.filter((patient) => patientIds.has(patient.id)),
        payments: guardianPayments,
        totalDueAmount: guardianInvoices
          .filter((invoice) => !closedStatuses.has(invoice.status))
          .reduce((total, invoice) => total + invoice.totalAmount, 0),
      };
    })
    .filter((group) => group.invoices.length > 0);

export const getBillingDetail = (
  invoiceId: EmrId,
  invoices: Invoice[],
  invoiceLines: InvoiceLine[],
  payments: Payment[]
): BillingDetail | null => {
  const invoice = invoices.find((item) => item.id === invoiceId);
  const encounter = invoice
    ? mockEncounters.find((item) => item.id === invoice.encounterId)
    : undefined;

  if (!invoice || !encounter) return null;

  const guardian = invoice.guardianId
    ? mockGuardians.find((item) => item.id === invoice.guardianId)
    : undefined;
  const groups = getBillingGuardianGroups(invoices, invoiceLines, payments);
  const detailInvoiceLines = invoiceLines.filter((line) => line.invoiceId === invoice.id);

  return {
    encounter,
    guardian,
    guardianGroup: guardian ? groups.find((group) => group.guardian.id === guardian.id) : undefined,
    invoice,
    invoiceLines: detailInvoiceLines,
    lineCount: detailInvoiceLines.length,
    paidAmount: getPaidAmount(invoice.id, payments),
    patient: mockPatients.find((item) => item.id === encounter.patientId),
    payments: payments.filter((payment) => payment.invoiceId === invoice.id),
  };
};
