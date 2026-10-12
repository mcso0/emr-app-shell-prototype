import type { ChartOrderCatalogSearchRow, ChartOrderSetPreview, ChartOrderSetSelectionIntent } from "../hospital-admin/server-order-catalog";
import type { ChartOrderRuntimeRow } from "./server-order-draft-persistence-core";
import type { ChartOrderExecutionTask } from "./server-order-execution-read-model-core";
import type { ClinicalOrderPriority, EmrOrder } from "@/types/emr-domain";
import type { ChartOrderBillingSummary } from "./chart-order-billing-summary-contract";

export type ChartOrderDraftSaveState = "idle" | "loading" | "saving" | "saved" | "error" | "conflict";

export type ChartOrderTableRow = {
  groupTitle: string;
  order: EmrOrder;
};

export type ChartOrderDraftRow = ChartOrderTableRow & {
  billingCandidateId?: string | null;
  billingCandidateStatus?:
    | "candidate_created"
    | "billing_review_required"
    | "invoice_linked"
    | "cancelled";
  billingName: string;
  committedBillingName: string;
  committedQuantityInput: string;
  catalogSearchRow?: ChartOrderCatalogSearchRow;
  detailInputs: Record<string, unknown>;
  detailSchemaVersion: number;
  executionTask?: ChartOrderExecutionTask;
  priority: ClinicalOrderPriority;
  runtimeRow?: ChartOrderRuntimeRow;
  setChildIncluded?: boolean;
  setSelectionIntent?: ChartOrderSetSelectionIntent;
  setPreview?: ChartOrderSetPreview;
  quantityInput: string;
  unitPrice?: number | null;
};

export type ChartOrderDraftRouteResponse =
  | {
      ok: true;
      status: number;
      billingSummary?: ChartOrderBillingSummary;
      etag?: string;
      rows?: ChartOrderRuntimeRow[];
    }
  | {
      ok: false;
      status: number;
      denialReason?: string;
      error?: string;
    };
