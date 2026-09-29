import type { Encounter, Invoice } from "@/types/emr-domain";

/** Only fields displayed by a queue card, never a patient/guardian detail record. */
export type BillingQueueItem = {
  invoice: Pick<Invoice, "id" | "workspaceId" | "encounterId" | "invoiceNo" | "status" | "paymentState" | "unpaidReason" | "totalAmount" | "createdAt" | "issuedAt"> & { billingRequestedAt?: string };
  encounter: Pick<Encounter, "receptionType">;
  patient?: { name: string };
  guardian?: { name: string };
  lineCount: number;
  lineSummary: string;
  requestedByName: string;
};
