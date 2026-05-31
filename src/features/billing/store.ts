"use client";

import { create } from "zustand";
import { mockInvoiceLines, mockInvoices, mockPayments } from "@/mocks/emr-domain";
import type { EmrId, Invoice, InvoiceLine, Payment, PaymentMethod } from "@/types/emr-domain";

export type BillingFilter = "waiting" | "unpaid" | "closed";
export type BillingInvoiceStatusTransitionTarget = "waiting" | "unpaid" | "paid" | "voided";

type BillingStore = {
  combinedInvoiceIds: EmrId[];
  filter: BillingFilter;
  invoiceLines: InvoiceLine[];
  invoices: Invoice[];
  paymentMethod: PaymentMethod;
  payments: Payment[];
  selectedInvoiceId: EmrId;
  selectedInvoiceIds: EmrId[];
  applyInvoiceSnapshot: (invoice: Invoice, invoiceLines: InvoiceLine[]) => void;
  applyPaymentStatusSnapshot: (invoice: Invoice, payments: Payment[]) => void;
  issueSelectedInvoice: () => void;
  markSelectedInvoicePaid: () => void;
  markSelectedInvoiceUnpaid: (unpaidReason: string) => void;
  selectInvoice: (selectedInvoiceId: EmrId) => void;
  setFilter: (filter: BillingFilter) => void;
  setPaymentMethod: (paymentMethod: PaymentMethod) => void;
  setCombinedInvoices: () => void;
  clearCombinedInvoices: () => void;
  transitionInvoiceStatus: (invoiceId: EmrId, target: BillingInvoiceStatusTransitionTarget) => void;
  toggleInvoiceSelection: (invoiceId: EmrId) => void;
  updateInvoiceLineQuantity: (invoiceLineId: EmrId, quantity: number) => void;
};

const now = "2026-05-01T12:00:00+09:00";

const recalculateInvoice = (invoice: Invoice, invoiceLines: InvoiceLine[]) => {
  const subtotalAmount = invoiceLines
    .filter((line) => line.invoiceId === invoice.id)
    .reduce((total, line) => total + line.lineTotal, 0);

  return {
    ...invoice,
    subtotalAmount,
    totalAmount: Math.max(0, subtotalAmount - invoice.discountAmount + invoice.taxAmount),
  };
};

export const useBillingStore = create<BillingStore>()((set, get) => ({
  combinedInvoiceIds: [],
  filter: "waiting",
  invoiceLines: mockInvoiceLines.map((line) => ({ ...line })),
  invoices: mockInvoices.map((invoice) => ({ ...invoice })),
  paymentMethod: "card",
  payments: mockPayments.map((payment) => ({ ...payment })),
  selectedInvoiceId: "invoice-coco-260501",
  selectedInvoiceIds: ["invoice-coco-260501"],
  applyInvoiceSnapshot: (invoice, invoiceLines) =>
    set((state) => ({
      invoiceLines: [
        ...state.invoiceLines.filter((line) => line.invoiceId !== invoice.id),
        ...invoiceLines.map((line) => ({ ...line })),
      ],
      invoices: state.invoices.map((item) => item.id === invoice.id ? { ...item, ...invoice } : item),
    })),
  applyPaymentStatusSnapshot: (invoice, payments) =>
    set((state) => ({
      invoices: state.invoices.map((item) => item.id === invoice.id ? { ...item, ...invoice } : item),
      paymentMethod: invoice.selectedPaymentMethod ?? state.paymentMethod,
      payments: [
        ...state.payments.filter((payment) => payment.invoiceId !== invoice.id),
        ...payments.map((payment) => ({ ...payment })),
      ],
    })),
  issueSelectedInvoice: () => {
    const { selectedInvoiceId } = get();
    set((state) => ({
      invoices: state.invoices.map((invoice) =>
        invoice.id === selectedInvoiceId
          ? { ...invoice, status: "issued", issuedAt: invoice.issuedAt ?? now }
          : invoice
      ),
    }));
  },
  markSelectedInvoicePaid: () => {
    const { paymentMethod, selectedInvoiceId } = get();

    set((state) => {
      const invoice = state.invoices.find((item) => item.id === selectedInvoiceId);

      if (!invoice) return state;

      const existingPayment = state.payments.find(
        (payment) => payment.invoiceId === selectedInvoiceId && payment.status === "approved"
      );
      const nextPayments = existingPayment
        ? state.payments
        : [
            ...state.payments,
            {
              id: `payment-${selectedInvoiceId}-${paymentMethod}`,
              invoiceId: selectedInvoiceId,
              paymentMethod,
              amount: invoice.totalAmount,
              status: "approved" as const,
              paidAt: now,
              metadata: { prototype: true },
            },
          ];

      return {
        invoices: state.invoices.map((item) =>
          item.id === selectedInvoiceId
            ? { ...item, status: "paid", issuedAt: item.issuedAt ?? now, paidAt: now, paymentState: "paid" }
            : item
        ),
        payments: nextPayments,
      };
    });
  },
  markSelectedInvoiceUnpaid: (unpaidReason) => {
    const { selectedInvoiceId } = get();
    const normalizedUnpaidReason = unpaidReason.trim();
    if (!normalizedUnpaidReason) return;
    set((state) => ({
      invoices: state.invoices.map((invoice) =>
        invoice.id === selectedInvoiceId
          ? {
              ...invoice,
              status: "issued",
              issuedAt: invoice.issuedAt ?? now,
              paidAt: undefined,
              paymentState: "unpaid",
              unpaidReason: normalizedUnpaidReason,
            }
          : invoice
      ),
    }));
  },
  selectInvoice: (selectedInvoiceId) =>
    set({
      selectedInvoiceId,
      selectedInvoiceIds: [selectedInvoiceId],
    }),
  setFilter: (filter) => set({ filter }),
  setPaymentMethod: (paymentMethod) => set({ paymentMethod }),
  setCombinedInvoices: () => {
    const { selectedInvoiceIds } = get();
    set({ combinedInvoiceIds: selectedInvoiceIds });
  },
  clearCombinedInvoices: () => set({ combinedInvoiceIds: [] }),
  transitionInvoiceStatus: (invoiceId, target) =>
    set((state) => {
      const invoice = state.invoices.find((item) => item.id === invoiceId);
      if (!invoice) return state;

      const paymentMethod = invoice.selectedPaymentMethod ?? state.paymentMethod;
      const clearApprovedPayments = state.payments.filter(
        (payment) => payment.invoiceId !== invoiceId || payment.status !== "approved",
      );
      const approvedPayment = {
        id: `payment-${invoiceId}-${paymentMethod}`,
        invoiceId,
        paymentMethod,
        amount: invoice.totalAmount,
        status: "approved" as const,
        paidAt: now,
        metadata: { prototype: true, source: "billing-status-transition" },
      };
      const nextInvoice =
        target === "paid"
          ? {
              ...invoice,
              issuedAt: invoice.issuedAt ?? now,
              paidAt: now,
              paymentState: "paid" as const,
              selectedPaymentMethod: paymentMethod,
              status: "paid" as const,
              unpaidReason: undefined,
            }
          : target === "unpaid"
            ? {
                ...invoice,
                issuedAt: invoice.issuedAt ?? now,
                paidAt: undefined,
                paymentState: "unpaid" as const,
                status: "issued" as const,
                unpaidReason: invoice.unpaidReason ?? "상태 변경: 미납으로 전환",
              }
            : target === "voided"
              ? {
                  ...invoice,
                  paidAt: undefined,
                  paymentState: "none" as const,
                  status: "voided" as const,
                  unpaidReason: undefined,
                }
              : {
                  ...invoice,
                  paidAt: undefined,
                  paymentState: "none" as const,
                  selectedPaymentMethod: undefined,
                  status: "draft" as const,
                  unpaidReason: undefined,
                };

      return {
        invoices: state.invoices.map((item) =>
          item.id === invoiceId ? nextInvoice : item,
        ),
        payments: target === "paid"
          ? [...clearApprovedPayments, approvedPayment]
          : clearApprovedPayments,
      };
    }),
  toggleInvoiceSelection: (invoiceId) =>
    set((state) => {
      const selectedInvoiceIds = state.selectedInvoiceIds.includes(invoiceId)
        ? state.selectedInvoiceIds.filter((id) => id !== invoiceId)
        : [...state.selectedInvoiceIds, invoiceId];

      return {
        selectedInvoiceId: invoiceId,
        selectedInvoiceIds: selectedInvoiceIds.length ? selectedInvoiceIds : [invoiceId],
      };
    }),
  updateInvoiceLineQuantity: (invoiceLineId, quantity) =>
    set((state) => {
      const safeQuantity = Math.max(1, Math.trunc(quantity) || 1);
      const invoiceLines = state.invoiceLines.map((line) =>
        line.id === invoiceLineId
          ? { ...line, quantity: safeQuantity, lineTotal: safeQuantity * line.unitPrice }
          : line
      );
      const line = invoiceLines.find((item) => item.id === invoiceLineId);

      if (!line) return { invoiceLines };

      return {
        invoiceLines,
        invoices: state.invoices.map((invoice) =>
          invoice.id === line.invoiceId ? recalculateInvoice(invoice, invoiceLines) : invoice
        ),
      };
    }),
}));
