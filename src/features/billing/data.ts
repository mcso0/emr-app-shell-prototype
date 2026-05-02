import {
  mockEncounters,
  mockGuardians,
  mockPatients,
} from "@/mocks/emr-domain";
import type {
  EmrId,
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

export type BillingDetail = BillingQueueRow & {
  guardianGroup?: BillingGuardianGroup;
  invoiceLines: InvoiceLine[];
  payments: Payment[];
};

const closedStatuses = new Set(["paid", "refunded", "voided"]);

export const getBillingFilterForInvoice = (invoice: Invoice): BillingFilter => {
  if (invoice.status === "draft") return "waiting";
  if (closedStatuses.has(invoice.status)) return "closed";

  return "unpaid";
};

const getPaidAmount = (invoiceId: EmrId, payments: Payment[]) =>
  payments
    .filter((payment) => payment.invoiceId === invoiceId && payment.status === "approved")
    .reduce((total, payment) => total + payment.amount, 0);

export const getBillingQueueRows = (
  invoices: Invoice[],
  payments: Payment[],
  filter: BillingFilter
): BillingQueueRow[] =>
  invoices
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
        paidAmount: getPaidAmount(invoice.id, payments),
        patient: mockPatients.find((patient) => patient.id === encounter.patientId),
      });

      return rows;
    }, [])
    .sort((a, b) => (b.invoice.issuedAt ?? b.invoice.createdAt).localeCompare(a.invoice.issuedAt ?? a.invoice.createdAt));

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

  return {
    encounter,
    guardian,
    guardianGroup: guardian ? groups.find((group) => group.guardian.id === guardian.id) : undefined,
    invoice,
    invoiceLines: invoiceLines.filter((line) => line.invoiceId === invoice.id),
    paidAmount: getPaidAmount(invoice.id, payments),
    patient: mockPatients.find((item) => item.id === encounter.patientId),
    payments: payments.filter((payment) => payment.invoiceId === invoice.id),
  };
};
