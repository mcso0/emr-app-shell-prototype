"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import { useParams, useSearchParams } from "next/navigation";
import guardianPersonIcon from "@/assets/figma/illustrations/interface-user-single-male-streamline-plump.svg";
import {
  CdsActionsListFilterIcon,
  CdsActionsSearchIcon,
} from "@/components/cds-icons/actions-and-controls";
import { CdsNavigationChevronsLeftIcon } from "@/components/cds-icons/navigation";
import { CdsUtilitiesSortIcon } from "@/components/cds-icons/utilities-and-misc";
import { EmrContentAsidePanel } from "@/components/emr/content-aside-panel";
import { EmrContentHistoryGroup } from "@/components/emr/content-history-list";
import { EmrDialogShell } from "@/components/emr/dialog-shell";
import {
  EmrInstructionHeaderStack,
  EmrInstructionHistoryToggle,
  EmrInstructionTitleBar,
} from "@/components/emr/instruction-header-stack";
import { EmrInlineAlert } from "@/components/emr/inline-alert";
import {
  EmrDateNavigator,
  EmrListHeader,
  EmrListHeaderIconButton,
  EmrSubpanel,
  EmrSubpanelBody,
  EmrSubpanelTitle,
} from "@/components/emr/subpanel";
import { EmrSidePanelCollapsibleGroup } from "@/components/emr/side-panel-collapsible-group";
import { EmrStatusBadge } from "@/components/emr/status-badge";
import {
  EmrTaskQueueCard,
  type EmrTaskQueueEventKind,
} from "@/components/emr/task-queue-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  getBillingDetail,
  getBillingCheckoutGroups,
  getBillingFilterForInvoice,
  getBillingGuardianLedgerRows,
  getBillingGuardianGroups,
  getBillingQueueRows,
  hasGuardianCoGuardianContext,
  isReasonBackedUnpaidInvoice,
  type BillingDetail,
  type BillingCheckoutGroup,
  type BillingGuardianLedgerRow,
  type BillingQueueRow,
} from "@/features/billing/data";
import { resolveBillingAmountInclusion } from "@/features/billing/billing-data-contract";
import { useAuthClient, type AuthSession } from "@/features/auth/auth-client";
import { getDemoActorHeaders } from "@/features/auth/demo-actor";
import {
  createPersonalProfileSession,
  getDefaultSessionPersonalProfile,
} from "@/features/auth/personal-profile-session";
import {
  useBillingStore,
  type BillingFilter,
  type BillingInvoiceStatusTransitionTarget,
} from "@/features/billing/store";
import { getDemoScenarioFromParams } from "@/lib/emr-domain/demo-scenarios";
import {
  isLegacySalesDemoWorkspace,
  resolveWorkspaceRouteParam,
} from "@/lib/emr-domain/demo-workspaces";
import { getStatusLabel } from "@/lib/emr-domain/status-labels";
import { cn } from "@/lib/utils";
import { readChartLiveEncounterHandoff } from "@/features/chart/live-encounter-handoff";
import { useLayoutStore } from "@/stores/layout-store";
import type { ShellComponentProps } from "@/types/emr";
import type {
  InvoiceLine,
  InvoiceStatus,
  Invoice,
  EmrOrderStatus,
  EmrOrderWorkStatus,
  Payment,
  PaymentMethod,
} from "@/types/emr-domain";
import animalDogIcon from "../../../icons/Illustration/animal-dog.svg";

const billingQueueGroups: Array<{
  colorToken: string;
  label: string;
  value: BillingFilter;
}> = [
  { label: "수납대기", value: "waiting", colorToken: "--emr-status-info-text" },
  { label: "미납", value: "unpaid", colorToken: "--emr-status-warning-text" },
  { label: "완료", value: "closed", colorToken: "--emr-status-success-text" },
];

type BillingLedgerDateRange = "1w" | "2w" | "1m" | "3m" | "6m" | "custom";

const billingLedgerDateRangeItems: Array<{
  label: string;
  value: BillingLedgerDateRange;
}> = [
  { label: "1주", value: "1w" },
  { label: "2주", value: "2w" },
  { label: "1달", value: "1m" },
  { label: "3달", value: "3m" },
  { label: "6개월", value: "6m" },
  { label: "직접", value: "custom" },
];

type BillingLedgerStatusFilter = "all" | BillingFilter | "cancelled";

const billingLedgerStatusFilterItems: Array<{
  label: string;
  value: BillingLedgerStatusFilter;
}> = [
  { label: "전체", value: "all" },
  { label: "대기", value: "waiting" },
  { label: "미납", value: "unpaid" },
  { label: "완료", value: "closed" },
  { label: "취소", value: "cancelled" },
];

const paymentMethodItems: Array<{ label: string; value: PaymentMethod }> = [
  { label: "카드", value: "card" },
  { label: "현금", value: "cash" },
  { label: "계좌이체", value: "transfer" },
  { label: "간편결제", value: "other" },
];

const formatAmount = (amount: number) => `${amount.toLocaleString()}원`;
const formatShortDateTime = (dateTime?: string) =>
  dateTime ? dateTime.slice(2, 16).replace("T", " ").replaceAll("-", ".") : "-";
const formatShortDate = (dateTime?: string) =>
  dateTime ? dateTime.slice(2, 10).replaceAll("-", ".") : "-";
const getAssetSrc = (asset: string | { src?: string }) =>
  typeof asset === "string" ? asset : asset.src ?? "";
const getBillingPaymentMethodLabel = (method: PaymentMethod) =>
  paymentMethodItems.find((item) => item.value === method)?.label ?? method;
const billingCandidateInvoiceLineIdPrefix = "invoice-line-billcand-";
const billingApiIdleState: BillingApiRequestState = { status: "idle" };
const billingApiLoadingState: BillingApiRequestState = { status: "loading" };
const billingApiReadyState: BillingApiRequestState = { status: "ready" };
const billingApiEmptyState: BillingApiRequestState = { status: "empty" };
const billingApiErrorState: BillingApiRequestState = { status: "error" };
const billingApiPermissionDeniedState: BillingApiRequestState = {
  status: "permission_denied",
};

type BillingFinancialAction = "issue_invoice" | "mark_unpaid" | "mark_paid";
type BillingPaymentFailureContext =
  | "payment_method"
  | "mark_unpaid"
  | "mark_paid";

type BillingApiRequestStatus =
  | "idle"
  | "loading"
  | "ready"
  | "empty"
  | "error"
  | "permission_denied";

type BillingApiRequestState = {
  status: BillingApiRequestStatus;
};

type BillingWorkspaceApiState = {
  invoiceLines: BillingApiRequestState;
  paymentStatus: BillingApiRequestState;
  retrySnapshots: () => void;
};

type BillingInvoiceCandidateSnapshot = {
  billingCandidateId: string;
  description: string;
  invoiceId: string;
  lineTotal: number;
  orderId: string;
  quantity: number;
  unitPrice: number;
};

type BillingInvoiceCandidateRouteResponse =
  | {
      ok: true;
      candidates: BillingInvoiceCandidateSnapshot[];
      status: number;
    }
  | {
      ok: false;
      denialReason?: string;
      error?: string;
      status: number;
    };

type BillingInvoiceLineRouteResponse =
  | {
      ok: true;
      enforcedBy: "billing-invoice-line-persistence";
      invoice: BillingPersistedInvoiceSnapshot;
      lines: InvoiceLine[];
      status: number;
    }
  | {
      ok: false;
      denialReason?: string;
      error?: string;
      status: number;
    };

type BillingPaymentStatusRouteResponse =
  | {
      ok: true;
      enforcedBy: "billing-payment-status-persistence";
      invoice: BillingPersistedInvoiceSnapshot;
      payments: Payment[];
      status: number;
    }
  | {
      ok: false;
      denialReason?: string;
      error?: string;
      status: number;
    };

type GuardianCheckoutLedgerRouteResponse =
  | {
      ok: true;
      enforcedBy: "guardian-billing-ledger";
      rows: GuardianCheckoutLedgerRowSnapshot[];
      status: number;
    }
  | {
      ok: false;
      denialReason?: string;
      error?: string;
      status: number;
    };

type GuardianCheckoutPrepareRouteResponse =
  | {
      ok: true;
      enforcedBy: "guardian-checkout-session";
      checkoutSession: GuardianCheckoutSessionSnapshot;
      invoiceSnapshots: GuardianCheckoutInvoiceSnapshot[];
      status: number;
    }
  | {
      ok: false;
      denialReason?: string;
      error?: string;
      status: number;
    };

type GuardianCheckoutTransitionRouteResponse =
  | {
      ok: true;
      enforcedBy: "billing-invoice-status-transition";
      invoice: BillingPersistedInvoiceSnapshot;
      payments: Payment[];
      status: number;
    }
  | {
      ok: false;
      denialReason?: string;
      error?: string;
      status: number;
    };

type BillingPersistedInvoiceSnapshot = {
  createdAt: string;
  discountAmount: number;
  encounterId: string;
  guardianId?: string;
  id: string;
  invoiceNo: string;
  issuedAt?: string;
  issuedByUserId?: string;
  paidAt?: string;
  paymentState?: "none" | "unpaid" | "paid" | "failed" | "refunded";
  selectedPaymentMethod?: PaymentMethod;
  status: InvoiceStatus;
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
  unpaidReason?: string;
  workspaceId: string;
};

type GuardianCheckoutLedgerRowSnapshot = {
  activityAt: string;
  amountInclusion: "payable" | "excluded";
  balanceAmount: number;
  invoiceId: string;
  payableAmount: number;
  status: "waiting" | "unpaid" | "paid" | "voided" | "refunded";
  totalAmount: number;
};

type GuardianCheckoutInvoiceSnapshot = {
  amountInclusion: "payable" | "excluded";
  balanceAmount: number;
  invoiceId: string;
  payableAmount: number;
};

type GuardianCheckoutSessionSnapshot = {
  excludedAmount: number;
  excludedCount: number;
  id: string;
  payableAmount: number;
  selectedInvoiceIds: string[];
  status: "prepared";
};

const emptyBillingInvoices: Invoice[] = [];
const emptyBillingInvoiceLines: InvoiceLine[] = [];
const emptyBillingPayments: Payment[] = [];

const invoiceStatusLabels: Record<InvoiceStatus, string> = {
  draft: "수납대기",
  issued: "수납진행",
  paid: "수납완료",
  refund_requested: "환불요청",
  refunded: "환불완료",
  voided: "무효",
};

const getInvoiceStatusLabel = (status: InvoiceStatus) =>
  invoiceStatusLabels[status] ?? getStatusLabel("invoice", status);

const getInvoiceStatusDescription = (
  status: InvoiceStatus,
  balance: number,
) => {
  if (status === "paid" || balance === 0) {
    return "수납이 완료되어 오늘 encounter를 마무리할 수 있습니다.";
  }

  if (status === "issued") {
    return "보호자 안내가 끝났고 결제 처리만 남아 있습니다.";
  }

  return "진료, 검사, 영상, 조제, 처치 항목을 확인한 뒤 수납할 단계입니다.";
};

const billingLineCategoryOrder = [
  "진료",
  "검사",
  "영상",
  "조제",
  "처치",
  "기타",
] as const;
type BillingLineCategory = (typeof billingLineCategoryOrder)[number];

const getBillingLineCategory = (line: InvoiceLine): BillingLineCategory => {
  if (line.serviceItemId?.startsWith("svc-consult")) return "진료";
  if (line.serviceItemId?.startsWith("svc-lab")) return "검사";
  if (line.serviceItemId?.startsWith("svc-imaging")) return "영상";
  if (line.serviceItemId?.startsWith("svc-med")) return "조제";
  if (line.serviceItemId?.startsWith("svc-treatment")) return "처치";

  return "기타";
};

const getBillingFlowLabel = (lines: InvoiceLine[]) => {
  const categories = billingLineCategoryOrder.filter(
    (category) =>
      category !== "기타" &&
      lines.some((line) => getBillingLineCategory(line) === category),
  );

  return categories.length ? categories.join(" / ") : "청구 항목";
};

function getDemoActorHeader(session: AuthSession | null) {
  return getDemoActorHeaders(session);
}

function getBillingAssignmentActorName(session: AuthSession | null) {
  if (!session) return "정하린";

  return getDefaultSessionPersonalProfile(
    createPersonalProfileSession(session),
  ).displayName;
}

async function loadBillingInvoiceCandidates({
  actorHeaders,
  encounterId,
  workspaceId,
}: {
  actorHeaders?: Record<string, string>;
  encounterId: string;
  workspaceId: string;
}): Promise<BillingInvoiceCandidateRouteResponse> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/billing/invoice-candidates?encounterId=${encodeURIComponent(encounterId)}`,
      {
        cache: "no-store",
        headers: actorHeaders,
      },
    );
    const body =
      (await response.json()) as BillingInvoiceCandidateRouteResponse;

    if (!response.ok || !body.ok) {
      if (!body.ok) return { ...body, status: response.status };
      return { ok: false, status: response.status, error: "db_read_failed" };
    }

    return body;
  } catch {
    return { ok: false, status: 500, error: "db_read_failed" };
  }
}

async function loadBillingInvoiceLines({
  actorHeaders,
  invoiceId,
  workspaceId,
}: {
  actorHeaders?: Record<string, string>;
  invoiceId: string;
  workspaceId: string;
}): Promise<BillingInvoiceLineRouteResponse> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/billing/invoice-lines?invoiceId=${encodeURIComponent(invoiceId)}`,
      {
        cache: "no-store",
        headers: actorHeaders,
      },
    );
    const body = (await response.json()) as BillingInvoiceLineRouteResponse;

    if (!response.ok || !body.ok) {
      if (!body.ok) return { ...body, status: response.status };
      return { ok: false, status: response.status, error: "db_read_failed" };
    }

    return body;
  } catch {
    return { ok: false, status: 500, error: "db_read_failed" };
  }
}

async function saveBillingInvoiceLines({
  actorHeaders,
  confirmBilling = false,
  invoiceId,
  lines,
  workspaceId,
}: {
  actorHeaders?: Record<string, string>;
  confirmBilling?: boolean;
  invoiceId: string;
  lines: Array<{ invoiceLineId: string; quantity: number }>;
  workspaceId: string;
}): Promise<BillingInvoiceLineRouteResponse> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/billing/invoice-lines`,
      {
        body: JSON.stringify({ invoiceId, lines, confirmBilling }),
        cache: "no-store",
        headers: {
          "content-type": "application/json",
          ...actorHeaders,
        },
        method: "PATCH",
      },
    );
    const body = (await response.json()) as BillingInvoiceLineRouteResponse;

    if (!response.ok || !body.ok) {
      if (!body.ok) return { ...body, status: response.status };
      return { ok: false, status: response.status, error: "db_write_failed" };
    }

    return body;
  } catch {
    return { ok: false, status: 500, error: "db_write_failed" };
  }
}

async function loadBillingPaymentStatus({
  actorHeaders,
  invoiceId,
  workspaceId,
}: {
  actorHeaders?: Record<string, string>;
  invoiceId: string;
  workspaceId: string;
}): Promise<BillingPaymentStatusRouteResponse> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/billing/payment-status?invoiceId=${encodeURIComponent(invoiceId)}`,
      {
        cache: "no-store",
        headers: actorHeaders,
      },
    );
    const body = (await response.json()) as BillingPaymentStatusRouteResponse;

    if (!response.ok || !body.ok) {
      if (!body.ok) return { ...body, status: response.status };
      return { ok: false, status: response.status, error: "db_read_failed" };
    }

    return body;
  } catch {
    return { ok: false, status: 500, error: "db_read_failed" };
  }
}

async function saveBillingPaymentStatus({
  action,
  actorHeaders,
  invoiceId,
  paymentMethod,
  unpaidReason,
  workspaceId,
}: {
  action: "select_payment_method" | "mark_unpaid" | "complete_payment";
  actorHeaders?: Record<string, string>;
  invoiceId: string;
  paymentMethod: PaymentMethod;
  unpaidReason?: string;
  workspaceId: string;
}): Promise<BillingPaymentStatusRouteResponse> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/billing/payment-status`,
      {
        body: JSON.stringify({
          action,
          invoiceId,
          paymentMethod,
          unpaidReason,
        }),
        cache: "no-store",
        headers: {
          "content-type": "application/json",
          ...actorHeaders,
        },
        method: "PATCH",
      },
    );
    const body = (await response.json()) as BillingPaymentStatusRouteResponse;

    if (!response.ok || !body.ok) {
      if (!body.ok) return { ...body, status: response.status };
      return { ok: false, status: response.status, error: "db_write_failed" };
    }

    return body;
  } catch {
    return { ok: false, status: 500, error: "db_write_failed" };
  }
}

async function loadGuardianCheckoutLedger({
  actorHeaders,
  guardianId,
  includeCoGuardianInvoices,
  statusFilter = "all",
  workspaceId,
}: {
  actorHeaders?: Record<string, string>;
  guardianId: string;
  includeCoGuardianInvoices: boolean;
  statusFilter?: "all" | "waiting" | "unpaid" | "paid" | "voided" | "refunded";
  workspaceId: string;
}): Promise<GuardianCheckoutLedgerRouteResponse> {
  try {
    const params = new URLSearchParams({
      guardianId,
      includeCoGuardianInvoices: includeCoGuardianInvoices ? "true" : "false",
      statusFilter,
    });
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/billing/guardian-checkout?${params.toString()}`,
      {
        cache: "no-store",
        headers: actorHeaders,
      },
    );
    const body = (await response.json()) as GuardianCheckoutLedgerRouteResponse;

    if (!response.ok || !body.ok) {
      if (!body.ok) return { ...body, status: response.status };
      return { ok: false, status: response.status, error: "db_read_failed" };
    }

    return body;
  } catch {
    return { ok: false, status: 500, error: "db_read_failed" };
  }
}

async function prepareGuardianCheckout({
  actorHeaders,
  invoiceIds,
  paymentMemo,
  paymentMethod,
  workspaceId,
}: {
  actorHeaders?: Record<string, string>;
  invoiceIds: string[];
  paymentMemo?: string;
  paymentMethod: PaymentMethod;
  workspaceId: string;
}): Promise<GuardianCheckoutPrepareRouteResponse> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/billing/guardian-checkout`,
      {
        body: JSON.stringify({
          invoiceIds,
          paymentMemo,
          paymentMethod,
        }),
        cache: "no-store",
        headers: {
          "content-type": "application/json",
          ...actorHeaders,
        },
        method: "POST",
      },
    );
    const body = (await response.json()) as GuardianCheckoutPrepareRouteResponse;

    if (!response.ok || !body.ok) {
      if (!body.ok) return { ...body, status: response.status };
      return { ok: false, status: response.status, error: "db_write_failed" };
    }

    return body;
  } catch {
    return { ok: false, status: 500, error: "db_write_failed" };
  }
}

async function transitionGuardianCheckoutInvoiceStatus({
  actorHeaders,
  invoiceId,
  paymentMethod,
  reason,
  target,
  workspaceId,
}: {
  actorHeaders?: Record<string, string>;
  invoiceId: string;
  paymentMethod: PaymentMethod;
  reason: string;
  target: BillingInvoiceStatusTransitionTarget;
  workspaceId: string;
}): Promise<GuardianCheckoutTransitionRouteResponse> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/billing/guardian-checkout`,
      {
        body: JSON.stringify({
          invoiceId,
          paymentMethod,
          reason,
          target,
        }),
        cache: "no-store",
        headers: {
          "content-type": "application/json",
          ...actorHeaders,
        },
        method: "PATCH",
      },
    );
    const body = (await response.json()) as GuardianCheckoutTransitionRouteResponse;

    if (!response.ok || !body.ok) {
      if (!body.ok) return { ...body, status: response.status };
      return { ok: false, status: response.status, error: "db_write_failed" };
    }

    return body;
  } catch {
    return { ok: false, status: 500, error: "db_write_failed" };
  }
}

function getBillingApiFailureState(result: {
  denialReason?: string;
  status: number;
}): BillingApiRequestState {
  if (result.status === 403 || result.denialReason === "permission_missing") {
    return billingApiPermissionDeniedState;
  }

  return billingApiErrorState;
}

const mergeInvoiceCandidateLines = (
  invoiceLines: InvoiceLine[],
  candidates: BillingInvoiceCandidateSnapshot[],
  targetInvoiceId?: string,
) => {
  let nextLines = invoiceLines;

  for (const candidate of candidates) {
    const invoiceId = targetInvoiceId ?? candidate.invoiceId;
    const existingLine = nextLines.find(
      (line) =>
        line.invoiceId === invoiceId &&
        line.orderId === candidate.orderId,
    );
    const candidateLine = {
      id:
        existingLine?.id ??
        `${billingCandidateInvoiceLineIdPrefix}${candidate.billingCandidateId}`,
      invoiceId,
      serviceItemId: existingLine?.serviceItemId,
      orderId: candidate.orderId,
      description: candidate.description,
      quantity: existingLine?.quantity ?? candidate.quantity,
      unitPrice: existingLine?.unitPrice ?? candidate.unitPrice,
      lineTotal: existingLine?.lineTotal ?? candidate.lineTotal,
    } satisfies InvoiceLine;

    nextLines = existingLine
      ? nextLines.map((line) =>
          line.id === existingLine.id ? candidateLine : line,
        )
      : [...nextLines, candidateLine];
  }

  return nextLines;
};

const isBillingCandidateInvoiceLine = (line: InvoiceLine) =>
  line.id.startsWith(billingCandidateInvoiceLineIdPrefix);

const getPersistedInvoiceLines = (lines: InvoiceLine[]) =>
  lines.filter((line) => !isBillingCandidateInvoiceLine(line));

function createLiveCandidateBillingDetail({
  candidates,
  encounterId,
  workspaceId,
}: {
  candidates: BillingInvoiceCandidateSnapshot[];
  encounterId?: string;
  workspaceId: string;
}): BillingDetail | null {
  if (!encounterId) return null;

  const handoff = readChartLiveEncounterHandoff(encounterId);
  if (!handoff) return null;

  const invoiceId = candidates[0]?.invoiceId ?? `invoice-live-${encounterId}`;
  const invoiceLines = candidates.map((candidate) => ({
    id: `${billingCandidateInvoiceLineIdPrefix}${candidate.billingCandidateId}`,
    invoiceId: candidate.invoiceId,
    orderId: candidate.orderId,
    description: candidate.description,
    quantity: candidate.quantity,
    unitPrice: candidate.unitPrice,
    lineTotal: candidate.lineTotal,
  }) satisfies InvoiceLine);
  const subtotalAmount = invoiceLines.reduce(
    (total, line) => total + line.lineTotal,
    0,
  );
  const invoice: Invoice = {
    id: invoiceId,
    workspaceId,
    encounterId,
    guardianId: handoff.primaryGuardian?.id,
    invoiceNo: `LIVE-${handoff.encounter.encounterNo}`,
    status: "draft",
    subtotalAmount,
    discountAmount: 0,
    taxAmount: 0,
    totalAmount: subtotalAmount,
    createdAt: handoff.updatedAt,
  };

  return {
    encounter: handoff.encounter,
    guardian: handoff.primaryGuardian,
    invoice,
    invoiceLines,
    lineCount: invoiceLines.length,
    lineSummary: getBillingFlowLabel(invoiceLines),
    paidAmount: 0,
    patient: handoff.patient,
    payments: [],
    requestedByName: "이수지",
  };
}

function useBillingWorkspaceData() {
  const params = useParams<{ workspaceId?: string | string[] }>();
  const searchParams = useSearchParams();
  const { session: authSession } = useAuthClient();
  const applyInvoiceSnapshot = useBillingStore(
    (state) => state.applyInvoiceSnapshot,
  );
  const applyPaymentStatusSnapshot = useBillingStore(
    (state) => state.applyPaymentStatusSnapshot,
  );
  const invoiceLines = useBillingStore((state) => state.invoiceLines);
  const invoices = useBillingStore((state) => state.invoices);
  const payments = useBillingStore((state) => state.payments);
  const selectedInvoiceId = useBillingStore((state) => state.selectedInvoiceId);
  const scenario = getDemoScenarioFromParams(searchParams);
  const workspaceId = resolveWorkspaceRouteParam(params.workspaceId);
  const legacySalesDemo = isLegacySalesDemoWorkspace(workspaceId);
  const queryInvoiceId = searchParams.get("invoiceId") ?? scenario?.invoiceId;
  const queryEncounterId = searchParams.get("encounterId") ?? scenario?.encounterId;
  const effectiveInvoiceId = queryInvoiceId ?? selectedInvoiceId;
  const [persistedCandidates, setPersistedCandidates] = useState<{
    candidates: BillingInvoiceCandidateSnapshot[];
    encounterId?: string;
  }>({ candidates: [] });
  const [invoiceLinesState, setInvoiceLinesState] =
    useState<BillingApiRequestState>(billingApiIdleState);
  const [paymentStatusState, setPaymentStatusState] =
    useState<BillingApiRequestState>(billingApiIdleState);
  const [snapshotReloadKey, setSnapshotReloadKey] = useState(0);
  const actorHeaders = useMemo(
    () => getDemoActorHeader(authSession),
    [authSession],
  );
  const workspaceInvoices = legacySalesDemo ? invoices : emptyBillingInvoices;
  const workspaceInvoiceLines = legacySalesDemo
    ? invoiceLines
    : emptyBillingInvoiceLines;
  const workspacePayments = legacySalesDemo ? payments : emptyBillingPayments;
  const retrySnapshots = () => setSnapshotReloadKey((current) => current + 1);
  const baseDetail =
    getBillingDetail(effectiveInvoiceId, workspaceInvoices, workspaceInvoiceLines, workspacePayments) ??
    (legacySalesDemo
      ? getBillingDetail("invoice-coco-260501", workspaceInvoices, workspaceInvoiceLines, workspacePayments)
      : null);
  const effectiveInvoiceLines =
    baseDetail && persistedCandidates.encounterId === baseDetail.encounter.id
      ? mergeInvoiceCandidateLines(
          workspaceInvoiceLines,
          persistedCandidates.candidates,
          baseDetail.invoice.id,
        )
      : workspaceInvoiceLines;
  const effectiveInvoices = useMemo(
    () =>
      workspaceInvoices.map((invoice) => {
        const subtotalAmount = effectiveInvoiceLines
          .filter((line) => line.invoiceId === invoice.id)
          .reduce((total, line) => total + line.lineTotal, 0);

        return {
          ...invoice,
          subtotalAmount,
          totalAmount: Math.max(
            0,
            subtotalAmount - invoice.discountAmount + invoice.taxAmount,
          ),
        };
      }),
    [effectiveInvoiceLines, workspaceInvoices],
  );
  const detail =
    getBillingDetail(
      effectiveInvoiceId,
      effectiveInvoices,
      effectiveInvoiceLines,
      workspacePayments,
    ) ??
    (legacySalesDemo
      ? getBillingDetail(
          "invoice-coco-260501",
          effectiveInvoices,
          effectiveInvoiceLines,
          workspacePayments,
        )
      : null);
  const baseEncounterId = baseDetail?.encounter.id;
  const baseEncounterWorkspaceId = baseDetail?.encounter.workspaceId;
  const baseInvoiceId = baseDetail?.invoice.id;
  const baseInvoiceWorkspaceId = baseDetail?.invoice.workspaceId;
  useEffect(() => {
    const encounterId = queryEncounterId ?? baseEncounterId;
    const candidateWorkspaceId = queryEncounterId ? workspaceId : baseEncounterWorkspaceId;
    if (!encounterId || !candidateWorkspaceId) return;
    const resolvedEncounterId = encounterId;
    const resolvedWorkspaceId = candidateWorkspaceId;
    let cancelled = false;

    async function loadPersistedCandidates() {
      const result = await loadBillingInvoiceCandidates({
        actorHeaders,
        encounterId: resolvedEncounterId,
        workspaceId: resolvedWorkspaceId,
      });

      if (cancelled || !result.ok) return;
      setPersistedCandidates({
        candidates: result.candidates,
        encounterId: resolvedEncounterId,
      });
    }

    void loadPersistedCandidates();

    return () => {
      cancelled = true;
    };
  }, [
    actorHeaders,
    baseEncounterId,
    baseEncounterWorkspaceId,
    queryEncounterId,
    workspaceId,
  ]);
  useEffect(() => {
    if (!baseInvoiceId || !baseInvoiceWorkspaceId) return;
    const invoiceId = baseInvoiceId;
    const workspaceId = baseInvoiceWorkspaceId;
    let cancelled = false;

    async function loadPersistedInvoiceLines() {
      setInvoiceLinesState(billingApiLoadingState);
      const result = await loadBillingInvoiceLines({
        actorHeaders,
        invoiceId,
        workspaceId,
      });

      if (cancelled) return;
      if (!result.ok) {
        setInvoiceLinesState(getBillingApiFailureState(result));
        return;
      }

      applyInvoiceSnapshot(result.invoice, result.lines);
      setInvoiceLinesState(
        result.lines.length ? billingApiReadyState : billingApiEmptyState,
      );
    }

    void loadPersistedInvoiceLines();

    return () => {
      cancelled = true;
    };
  }, [
    actorHeaders,
    applyInvoiceSnapshot,
    baseInvoiceId,
    baseInvoiceWorkspaceId,
    snapshotReloadKey,
  ]);
  useEffect(() => {
    if (!baseInvoiceId || !baseInvoiceWorkspaceId) return;
    const invoiceId = baseInvoiceId;
    const workspaceId = baseInvoiceWorkspaceId;
    let cancelled = false;

    async function loadPersistedPaymentStatus() {
      setPaymentStatusState(billingApiLoadingState);
      const result = await loadBillingPaymentStatus({
        actorHeaders,
        invoiceId,
        workspaceId,
      });

      if (cancelled) return;
      if (!result.ok) {
        setPaymentStatusState(getBillingApiFailureState(result));
        return;
      }

      applyPaymentStatusSnapshot(result.invoice, result.payments);
      setPaymentStatusState(billingApiReadyState);
    }

    void loadPersistedPaymentStatus();

    return () => {
      cancelled = true;
    };
  }, [
    actorHeaders,
    applyPaymentStatusSnapshot,
    baseInvoiceId,
    baseInvoiceWorkspaceId,
    snapshotReloadKey,
  ]);
  const groups = useMemo(
    () =>
      getBillingGuardianGroups(
        effectiveInvoices,
        effectiveInvoiceLines,
        workspacePayments,
      ),
    [effectiveInvoiceLines, effectiveInvoices, workspacePayments],
  );

  const liveCandidateDetail =
    queryEncounterId && persistedCandidates.encounterId === queryEncounterId
      ? createLiveCandidateBillingDetail({
          candidates: persistedCandidates.candidates,
          encounterId: queryEncounterId,
          workspaceId,
        })
      : null;

  return {
    apiState: {
      invoiceLines: invoiceLinesState,
      paymentStatus: paymentStatusState,
      retrySnapshots,
    },
    detail: queryEncounterId && liveCandidateDetail ? liveCandidateDetail : detail,
    groups,
    invoiceLines: effectiveInvoiceLines,
    invoices: effectiveInvoices,
    payments: workspacePayments,
    queryInvoiceId,
    selectedInvoiceId,
  };
}

function getBillingBalance(detail: BillingDetail) {
  return Math.max(0, detail.invoice.totalAmount - detail.paidAmount);
}

function createCheckoutGroupFromBillingDetail(detail: BillingDetail): BillingCheckoutGroup {
  return {
    encounter: detail.encounter,
    guardian: detail.guardian,
    invoice: detail.invoice,
    lines: detail.invoiceLines.map((line) => ({
      line,
      source: line.orderId ? "chart_order" as const : "billing_add_on" as const,
    })),
    paidAmount: detail.paidAmount,
    patient: detail.patient,
    totalAmount: detail.invoiceLines.reduce(
      (total, line) => total + line.lineTotal,
      0,
    ),
  };
}

function mergeBillingDetailStoreSnapshot({
  detail,
  invoiceLines,
  invoices,
  payments,
}: {
  detail: BillingDetail;
  invoiceLines: InvoiceLine[];
  invoices: Invoice[];
  payments: Payment[];
}): BillingDetail {
  const invoice = invoices.find((item) => item.id === detail.invoice.id) ?? detail.invoice;
  const persistedLines = invoiceLines.filter((line) => line.invoiceId === invoice.id);
  const persistedPayments = payments.filter((payment) => payment.invoiceId === invoice.id);
  const effectiveInvoiceLines = persistedLines.length ? persistedLines : detail.invoiceLines;
  const effectivePayments = persistedPayments.length ? persistedPayments : detail.payments;

  return {
    ...detail,
    invoice,
    invoiceLines: effectiveInvoiceLines,
    lineCount: effectiveInvoiceLines.length,
    lineSummary: getBillingFlowLabel(effectiveInvoiceLines),
    paidAmount: getInvoicePaidAmount(invoice.id, effectivePayments),
    payments: effectivePayments,
  };
}

function getBillingCheckoutGroupBalance(group: BillingCheckoutGroup) {
  return Math.max(0, group.totalAmount - group.paidAmount);
}

function isCheckoutSummaryExcludedInvoice(invoice: Invoice) {
  return resolveBillingAmountInclusion(invoice) === "excluded";
}

function getBillingCheckoutTransitionTargets(
  invoice: Invoice,
): BillingInvoiceStatusTransitionTarget[] {
  if (invoice.status === "paid") return ["waiting", "unpaid", "voided"];
  if (invoice.status === "voided") return ["waiting", "unpaid", "paid"];

  return [];
}

function getBillingCheckoutTransitionLabel(
  target: BillingInvoiceStatusTransitionTarget,
) {
  if (target === "waiting") return "대기";
  if (target === "unpaid") return "미납";
  if (target === "paid") return "완료";

  return "취소";
}

function getBillingCheckoutGroupStatusLabel(invoice: Invoice) {
  if (invoice.status === "voided") return "취소";

  const filter = getBillingFilterForInvoice(invoice);
  if (filter === "waiting") return "대기";

  return getBillingFilterLabel(filter);
}

function getBillingFilterLabel(filter: BillingFilter) {
  if (filter === "closed") return "완료";
  if (filter === "unpaid") return "미납";

  return "수납대기";
}

function getBillingLedgerRowStatusLabel(row: BillingGuardianLedgerRow) {
  if (isBillingLedgerRowCancelled(row)) return "취소";
  if (row.status === "waiting") return "대기";

  return getBillingFilterLabel(row.status);
}

function getOrderStatusBadgeLabel(status?: EmrOrderStatus) {
  if (!status) return "수납 추가";
  if (status === "requested") return "요청";
  if (status === "re_requested") return "재요청";
  if (status === "in_progress") return "진행중";
  if (status === "confirmed") return "확인";
  if (status === "completed") return "완료";
  if (status === "cancelled") return "취소";

  return status;
}

function getOrderWorkStatusBadgeLabel(status?: EmrOrderWorkStatus) {
  if (!status) return "비임상";

  return status === "completed" ? "업무완료" : "업무진행";
}

function getBillingLedgerRangeStart(range: BillingLedgerDateRange) {
  const current = new Date("2026-05-01T23:59:59+09:00");
  const start = new Date(current);

  if (range === "1w") start.setDate(current.getDate() - 7);
  if (range === "2w") start.setDate(current.getDate() - 14);
  if (range === "1m") start.setMonth(current.getMonth() - 1);
  if (range === "3m") start.setMonth(current.getMonth() - 3);
  if (range === "6m") start.setMonth(current.getMonth() - 6);
  if (range === "custom") start.setMonth(current.getMonth() - 6);

  return start;
}

function isBillingLedgerRowInRange(
  row: BillingGuardianLedgerRow,
  range: BillingLedgerDateRange,
) {
  return new Date(row.activityAt) >= getBillingLedgerRangeStart(range);
}

function isBillingLedgerRowCancelled(row: BillingGuardianLedgerRow) {
  return row.invoice.status === "voided";
}

function isBillingLedgerRowMatchingStatusFilter(
  row: BillingGuardianLedgerRow,
  statusFilters: Set<BillingLedgerStatusFilter>,
) {
  if (statusFilters.has("all")) return true;
  if (statusFilters.has("cancelled") && isBillingLedgerRowCancelled(row)) {
    return true;
  }

  if (row.status === "closed" && isBillingLedgerRowCancelled(row)) {
    return false;
  }

  return statusFilters.has(row.status);
}

function groupBillingLedgerRowsByDate(rows: BillingGuardianLedgerRow[]) {
  return rows.reduce<Array<{ dateLabel: string; rows: BillingGuardianLedgerRow[] }>>(
    (groups, row) => {
      const dateLabel = formatShortDate(row.activityAt);
      const currentGroup = groups.find((group) => group.dateLabel === dateLabel);

      if (currentGroup) {
        currentGroup.rows.push(row);
      } else {
        groups.push({ dateLabel, rows: [row] });
      }

      return groups;
    },
    [],
  );
}

function getBillingReceptionTypeLabel(row: BillingQueueRow) {
  return row.encounter.appointmentId ? "예약" : "외래";
}

function getBillingQueueEventKind(row: BillingQueueRow): EmrTaskQueueEventKind {
  return row.invoice.status === "voided" ? "cancel" : "request";
}

function QueueItem({
  assigneeName,
  onSelect,
  row,
  selected,
}: {
  assigneeName?: string;
  onSelect: () => void;
  row: BillingQueueRow;
  selected: boolean;
}) {
  const guardianName = row.guardian?.name ?? "보호자 미지정";
  const patientName = row.patient?.name ?? "환자 미상";

  return (
    <EmrTaskQueueCard
      item={{
        actionAriaLabel: `${guardianName} ${row.invoice.invoiceNo} 수납 작업`,
        actionTestId: `billing-queue-action-${row.invoice.id}`,
        assigneeName,
        eventActorName: row.requestedByName,
        eventKind: getBillingQueueEventKind(row),
        eventTime: formatShortDateTime(row.invoice.issuedAt ?? row.invoice.createdAt).slice(9),
        guardianName,
        patientName,
        receptionType: getBillingReceptionTypeLabel(row),
        secondLineText: `오더 ${row.lineCount}건 · ${formatAmount(row.invoice.totalAmount)}`,
        testId: `billing-queue-item-${row.invoice.id}`,
      }}
      selected={selected}
      onSelect={onSelect}
    />
  );
}

export function BillingSidePanel({ moduleLabel, workspaceId }: ShellComponentProps) {
  const invoiceAssignees = useBillingStore((state) => state.invoiceAssignees);
  const invoices = useBillingStore((state) => state.invoices);
  const invoiceLines = useBillingStore((state) => state.invoiceLines);
  const payments = useBillingStore((state) => state.payments);
  const selectedInvoiceId = useBillingStore((state) => state.selectedInvoiceId);
  const selectInvoice = useBillingStore((state) => state.selectInvoice);
  const setModulePanelOpen = useLayoutStore(
    (state) => state.setModulePanelOpen,
  );
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<
    Set<BillingFilter>
  >(() => new Set());
  const legacySalesDemo = isLegacySalesDemoWorkspace(workspaceId);
  const groupedRows = useMemo(
    () =>
      billingQueueGroups.map((group) => ({
        ...group,
        rows: legacySalesDemo
          ? getBillingQueueRows(invoices, invoiceLines, payments, group.value)
          : [],
      })),
    [invoiceLines, invoices, payments, legacySalesDemo],
  );
  const totalRowCount = groupedRows.reduce(
    (total, group) => total + group.rows.length,
    0,
  );
  const toggleGroup = (groupId: BillingFilter) => {
    setCollapsedGroupIds((current) => {
      const next = new Set(current);

      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }

      return next;
    });
  };

  return (
    <EmrSubpanel>
      <EmrSubpanelTitle
        title={moduleLabel}
        collapseLabel="사이드 패널 접기"
        onCollapse={() => setModulePanelOpen(false)}
      />
      <EmrDateNavigator dateLabel={legacySalesDemo ? "26.05.01 (금)" : "오늘"} todayLabel="오늘" />
      <EmrListHeader
        label="전체"
        count={totalRowCount}
        headerActions={
          <>
            <EmrListHeaderIconButton ariaLabel="정렬">
              <CdsUtilitiesSortIcon className="size-4" />
            </EmrListHeaderIconButton>
            <EmrListHeaderIconButton ariaLabel="필터">
              <CdsActionsListFilterIcon className="size-4" />
            </EmrListHeaderIconButton>
            <EmrListHeaderIconButton ariaLabel="검색">
              <CdsActionsSearchIcon className="size-4" />
            </EmrListHeaderIconButton>
          </>
        }
      />
      <EmrSubpanelBody>
        {groupedRows.map((group) => (
          <BillingQueueGroup
            key={group.value}
            collapsed={collapsedGroupIds.has(group.value)}
            colorToken={group.colorToken}
            invoiceAssignees={invoiceAssignees}
            label={group.label}
            rows={group.rows}
            selectedInvoiceId={selectedInvoiceId}
            onSelectInvoice={selectInvoice}
            onToggle={() => toggleGroup(group.value)}
          />
        ))}
      </EmrSubpanelBody>
    </EmrSubpanel>
  );
}

function BillingQueueGroup({
  collapsed,
  colorToken,
  invoiceAssignees,
  label,
  rows,
  selectedInvoiceId,
  onSelectInvoice,
  onToggle,
}: {
  collapsed: boolean;
  colorToken: string;
  invoiceAssignees: Record<string, string | undefined>;
  label: string;
  rows: BillingQueueRow[];
  selectedInvoiceId: string;
  onSelectInvoice: (invoiceId: string) => void;
  onToggle: () => void;
}) {
  return (
    <EmrSidePanelCollapsibleGroup
      collapsed={collapsed}
      count={rows.length}
      countBadgeColorToken={colorToken}
      dataTestId={`billing-queue-group-${label}`}
      indicatorColorToken={colorToken}
      indicatorVisible={false}
      label={label}
      onToggle={onToggle}
    >
      {rows.map((row) => (
        <QueueItem
          key={row.invoice.id}
          assigneeName={invoiceAssignees[row.invoice.id]}
          row={row}
          selected={row.invoice.id === selectedInvoiceId}
          onSelect={() => onSelectInvoice(row.invoice.id)}
        />
      ))}
    </EmrSidePanelCollapsibleGroup>
  );
}

type BillingGuardianMetric = {
  amount: number;
  count: number;
};

function getInvoicePaidAmount(invoiceId: string, payments: Payment[]) {
  return payments
    .filter(
      (payment) =>
        payment.invoiceId === invoiceId && payment.status === "approved",
    )
    .reduce((total, payment) => total + payment.amount, 0);
}

function getInvoiceBalanceAmount(invoice: Invoice, payments: Payment[]) {
  return Math.max(0, invoice.totalAmount - getInvoicePaidAmount(invoice.id, payments));
}

function getGuardianBillingHeaderSummary(detail: BillingDetail) {
  const invoices = detail.guardianGroup?.invoices ?? [detail.invoice];
  const payments = detail.guardianGroup?.payments ?? detail.payments;
  const patientNames = detail.guardianGroup?.patients.length
    ? detail.guardianGroup.patients.map((patient) => patient.name)
    : detail.patient
      ? [detail.patient.name]
      : [];
  const waiting = invoices.reduce<BillingGuardianMetric>(
    (summary, invoice) => {
      if (getBillingFilterForInvoice(invoice) !== "waiting") return summary;

      return {
        amount: summary.amount + getInvoiceBalanceAmount(invoice, payments),
        count: summary.count + 1,
      };
    },
    { amount: 0, count: 0 },
  );
  const unpaid = invoices.reduce<BillingGuardianMetric>(
    (summary, invoice) => {
      if (!isReasonBackedUnpaidInvoice(invoice)) return summary;

      const balance = getInvoiceBalanceAmount(invoice, payments);
      if (balance <= 0) return summary;

      return {
        amount: summary.amount + balance,
        count: summary.count + 1,
      };
    },
    { amount: 0, count: 0 },
  );
  const recentPayment = [...payments]
    .filter((payment) => payment.status === "approved" && payment.paidAt)
    .sort((a, b) => (b.paidAt ?? "").localeCompare(a.paidAt ?? ""))
    .at(0);

  return {
    patientNames,
    recentPaymentAt: recentPayment?.paidAt,
    unpaid,
    waiting,
  };
}

function getMaskedGuardianContact(detail: BillingDetail) {
  const contact = detail.guardian?.mobilePhone ?? detail.guardian?.phone;
  if (!contact) return "연락처 없음";

  return contact.replace(
    /^(\d{2,3})-?(\d{3,4})-?(\d{4})$/,
    (_match, prefix: string, _middle: string, suffix: string) =>
      `${prefix}-****-${suffix}`,
  );
}

function getBillingHeaderStatusLabel(status: InvoiceStatus) {
  if (status === "issued") return "수납진행";

  return getInvoiceStatusLabel(status);
}

function BillingGuardianContextBadge({
  label,
  tone = "neutral",
  value,
}: {
  label: ReactNode;
  tone?: "neutral" | "warning";
  value: ReactNode;
}) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "emr-text-dense-label h-[22px] shrink-0 gap-1 rounded-[var(--clair-radius-atomic-6)] border-transparent bg-[var(--emr-status-neutral-bg)] px-2 py-0.5 font-medium",
        tone === "warning" &&
          "bg-[var(--emr-status-warning-bg)] text-[var(--emr-status-warning-text)]",
      )}
    >
      <span
        className={cn(
          "text-[var(--emr-text-tertiary)]",
          tone === "warning" && "text-[var(--emr-status-warning-text)]",
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "max-w-[220px] truncate text-[var(--emr-text-secondary)]",
          tone === "warning" && "text-[var(--emr-status-warning-text)]",
        )}
      >
        {value}
      </span>
    </Badge>
  );
}

function BillingGuardianContextDivider() {
  return <div className="h-[18px] w-px shrink-0 bg-border" aria-hidden="true" />;
}

function BillingGuardianContextBar({
  detail,
}: {
  detail: BillingDetail;
}) {
  const summary = getGuardianBillingHeaderSummary(detail);
  const guardianName = detail.guardian?.name ?? "보호자 미지정";
  const patientNames = summary.patientNames.length
    ? summary.patientNames.join(", ")
    : "환자 미상";
  const guardianMemoLabel =
    detail.guardian?.memo?.trim() ||
    (summary.unpaid.count > 0 ? "미납 주의" : "메모 없음");

  return (
    <div className="flex h-12 items-center gap-3 border-b border-[var(--emr-line-default)] bg-[var(--emr-surface-workspace)] px-4">
      <div className="relative min-w-0 flex-1">
        <div
          className="flex min-w-0 items-center gap-3 overflow-x-auto overflow-y-hidden pr-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="보호자 수납 컨텍스트 정보"
        >
          <div className="flex shrink-0 items-center gap-1.5">
            <BillingGuardianContextIcon
              src={getAssetSrc(guardianPersonIcon)}
              alt=""
            />
            <BillingGuardianContextBadge label="보호자" value={guardianName} />
            <BillingGuardianContextBadge label="관계" value="주 보호자" />
            <BillingGuardianContextBadge
              label="연락처"
              value={getMaskedGuardianContact(detail)}
            />
          </div>
          <BillingGuardianContextDivider />
          <div className="flex shrink-0 items-center gap-1.5">
            <BillingGuardianContextIcon src={getAssetSrc(animalDogIcon)} alt="" />
            <BillingGuardianContextBadge label="환자" value={patientNames} />
            <BillingGuardianContextBadge
              label="최근 수납"
              value={
                summary.recentPaymentAt
                  ? formatShortDateTime(summary.recentPaymentAt)
                  : "기록 없음"
              }
            />
          </div>
          <BillingGuardianContextDivider />
          <div className="flex shrink-0 items-center gap-1.5">
            <BillingGuardianContextBadge
              label="수납대기"
              value={`${summary.waiting.count}건 · ${formatAmount(summary.waiting.amount)}`}
            />
            <BillingGuardianContextBadge
              label="미납"
              value={`${summary.unpaid.count}건 · ${formatAmount(summary.unpaid.amount)}`}
              tone={summary.unpaid.count > 0 ? "warning" : "neutral"}
            />
            <BillingGuardianContextBadge
              label="보호자 메모"
              value={guardianMemoLabel}
              tone={summary.unpaid.count > 0 ? "warning" : "neutral"}
            />
          </div>
        </div>
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-4 bg-gradient-to-r from-transparent to-[var(--emr-surface-workspace)]"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

function BillingGuardianContextIcon({
  alt,
  src,
}: {
  alt: string;
  src: string;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      width={20}
      height={20}
      unoptimized
      aria-hidden={alt ? undefined : true}
      className="size-5 shrink-0 object-contain"
      draggable={false}
    />
  );
}

export function BillingHeader() {
  const { detail } = useBillingWorkspaceData();

  if (!detail) return null;

  return <BillingGuardianContextBar detail={detail} />;
}

function BillingInstructionInfo({ detail }: { detail: BillingDetail }) {
  const balance = getBillingBalance(detail);
  const flowLabel = getBillingFlowLabel(detail.invoiceLines);
  const paymentStatus =
    detail.invoice.status === "paid" || balance === 0
      ? {
          label: "수납완료",
          description: "정산 완료",
          tone: "success" as const,
        }
      : isReasonBackedUnpaidInvoice(detail.invoice)
        ? {
            label: "미납 처리",
            description: detail.invoice.unpaidReason ?? "사유 기록됨",
            tone: "warning" as const,
          }
        : detail.invoice.status === "issued"
          ? {
              label: "결제 대기",
              description: detail.invoice.selectedPaymentMethod
                ? `${getBillingPaymentMethodLabel(detail.invoice.selectedPaymentMethod)} 선택`
                : "결제 수단 미선택",
              tone: "info" as const,
            }
          : {
              label: "수납대기",
              description: "보호자 안내 전",
              tone: "info" as const,
            };
  const statusTextClassName =
    paymentStatus.tone === "success"
      ? "text-[var(--emr-status-success-text)]"
      : paymentStatus.tone === "warning"
        ? "text-[var(--emr-status-warning-text)]"
        : "text-[var(--emr-status-info-text)]";
  const infoItems: Array<{ label: string; value: ReactNode }> = [
    {
      label: "청구서",
      value: (
        <span className="grid gap-0.5">
          <span className="font-semibold">{detail.invoice.invoiceNo}</span>
          <span className="emr-text-metadata font-medium text-muted-foreground">
            {detail.encounter.encounterNo}
          </span>
        </span>
      ),
    },
    {
      label: "보호자 / 환자",
      value: (
        <span className="grid gap-0.5">
          <span className="font-semibold">
            {detail.guardian?.name ?? "보호자 미지정"} ·{" "}
            {detail.patient?.name ?? "환자 미상"}
          </span>
          <span className="emr-text-metadata font-medium text-muted-foreground">
            {flowLabel} 항목
          </span>
        </span>
      ),
    },
    {
      label: "수납 상태",
      value: (
        <span className="grid gap-0.5">
          <span className="font-semibold text-[var(--emr-status-info-text)]">
            {getInvoiceStatusLabel(detail.invoice.status)}
          </span>
          <span className="emr-text-metadata font-medium text-muted-foreground">
            {formatShortDateTime(detail.invoice.issuedAt ?? detail.invoice.createdAt)}
          </span>
        </span>
      ),
    },
    {
      label: "결제 상태",
      value: (
        <span className="grid gap-0.5">
          <span className={cn("font-semibold", statusTextClassName)}>
            {paymentStatus.label}
          </span>
          <span className="emr-text-metadata font-medium text-muted-foreground">
            {paymentStatus.description}
          </span>
        </span>
      ),
    },
  ];

  return (
    <div
      data-testid="billing-instruction-info"
      className="grid gap-0 rounded-[var(--emr-radius-panel)] border border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)] px-4 py-3 md:grid-cols-4"
    >
      {infoItems.map(({ label, value }) => (
        <div
          key={label}
          className="border-b border-[var(--emr-line-hairline)] px-0 py-3 last:border-b-0 md:border-b-0 md:border-r md:px-3 md:py-0 md:last:border-r-0"
        >
          <div className="emr-text-metadata font-medium text-muted-foreground">
            {label}
          </div>
          <div className="mt-1 flex min-h-8 items-center emr-text-dense font-medium text-foreground">
            {value}
          </div>
        </div>
      ))}
    </div>
  );
}

function BillingTitleCard({
  detail,
  hasRightPanel,
}: {
  detail: BillingDetail;
  hasRightPanel: boolean;
}) {
  const { session: authSession } = useAuthClient();
  const {
    contentAsideOpen,
    rightPanelOpen,
    setContentAsideOpen,
    setRightPanelOpen,
  } = useLayoutStore();
  const assignmentActorName = useMemo(
    () => getBillingAssignmentActorName(authSession),
    [authSession],
  );
  const assignInvoice = useBillingStore((state) => state.assignInvoice);
  const clearInvoiceAssignee = useBillingStore(
    (state) => state.clearInvoiceAssignee,
  );
  const assigneeName = useBillingStore(
    (state) => state.invoiceAssignees[detail.invoice.id],
  );

  return (
    <EmrInstructionHeaderStack
      titleBar={
        <EmrInstructionTitleBar
          title="수납"
          icon={
            <EmrInstructionHistoryToggle
              ariaLabelPrefix="수납이력"
              controls="billing-content-aside"
              expanded={contentAsideOpen}
              tooltipLabel="수납이력"
              onClick={() => setContentAsideOpen(!contentAsideOpen)}
            />
          }
          badge={
            <Badge
              variant="secondary"
              className="h-5 rounded-md px-2 emr-text-micro text-muted-foreground"
            >
              {detail.invoice.invoiceNo}
            </Badge>
          }
          actions={
            <div className="flex items-center gap-2">
              {assigneeName ? (
                <Badge
                  variant="secondary"
                  className="h-[var(--emr-page-title-height)] rounded-[var(--emr-context-bar-button-radius)] px-[var(--clair-spacing-8)] emr-text-status"
                >
                  담당 {assigneeName}
                </Badge>
              ) : null}
              <Button
                type="button"
                size="xs"
                variant={assigneeName ? "outline" : "default"}
                className="emr-text-status h-[var(--emr-page-title-height)] rounded-[var(--emr-context-bar-button-radius)] px-[var(--clair-spacing-10)] shadow-[var(--clair-shadow-xs)]"
                onClick={() => {
                  if (assigneeName) {
                    clearInvoiceAssignee(detail.invoice.id);
                    return;
                  }

                  assignInvoice(detail.invoice.id, assignmentActorName);
                }}
              >
                {assigneeName ? "담당 취소" : "담당하기"}
              </Button>
              <Button
                type="button"
                size="xs"
                variant="outline"
                className="emr-text-status h-[var(--emr-page-title-height)] rounded-[var(--emr-context-bar-button-radius)] bg-card px-[var(--clair-spacing-10)] text-[var(--emr-text-secondary)] shadow-[var(--clair-shadow-xs)] data-[state=on]:border-[var(--clair-color-atomic-black-alpha-16)] data-[state=on]:bg-[var(--clair-color-atomic-black-alpha-4)] data-[state=on]:text-[var(--emr-text-primary)] disabled:bg-card disabled:text-[var(--emr-text-disabled)] disabled:opacity-100"
                disabled={!hasRightPanel}
                aria-label={rightPanelOpen ? "수납 요약 패널 접기" : "수납 요약 패널 열기"}
                aria-expanded={rightPanelOpen}
                aria-pressed={rightPanelOpen}
                data-state={rightPanelOpen ? "on" : "off"}
                onClick={() => setRightPanelOpen(!rightPanelOpen)}
              >
                수납 요약
              </Button>
            </div>
          }
        />
      }
      orderInfo={<BillingInstructionInfo detail={detail} />}
    />
  );
}

function SelectedCheckoutWorkspace({
  checkoutSession,
  checkoutState,
  groups,
  invoiceAssignees,
  persistenceState,
  onRetryCheckout,
  onTransitionStatus,
  onUpdateQuantity,
}: {
  checkoutSession?: GuardianCheckoutSessionSnapshot;
  checkoutState: BillingApiRequestState;
  groups: BillingCheckoutGroup[];
  invoiceAssignees: Record<string, string | undefined>;
  onRetryCheckout: () => void;
  onTransitionStatus: (
    invoiceId: string,
    target: BillingInvoiceStatusTransitionTarget,
  ) => void;
  persistenceState: "idle" | "saving" | "saved" | "error";
  onUpdateQuantity: (lineId: string, quantity: number) => void;
}) {
  const checkoutTotalAmount = groups
    .filter((group) => !isCheckoutSummaryExcludedInvoice(group.invoice))
    .reduce((total, group) => total + group.totalAmount, 0);
  const excludedGroupCount = groups.filter((group) =>
    isCheckoutSummaryExcludedInvoice(group.invoice),
  ).length;
  const displayedCheckoutTotalAmount =
    checkoutSession?.payableAmount ?? checkoutTotalAmount;
  const displayedExcludedGroupCount =
    checkoutSession?.excludedCount ?? excludedGroupCount;
  const lineCount = groups.reduce((total, group) => total + group.lines.length, 0);

  return (
    <section className="rounded-lg border bg-card" data-testid="billing-checkout-workspace">
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-2 border-b px-4 py-2">
        <div>
          <h2 className="emr-text-body font-semibold">선택된 checkout 작업대</h2>
          <div className="mt-1 emr-text-metadata text-muted-foreground">
            보호자 ledger에서 선택한 수납 건을 환자, 진료, 청구서별로 확인합니다.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" data-testid="billing-checkout-total">
            {groups.length}건 · {lineCount}항목 · 수납 합산{" "}
            {formatAmount(displayedCheckoutTotalAmount)}
          </Badge>
          {displayedExcludedGroupCount ? (
            <Badge variant="outline">
              합산 제외 {displayedExcludedGroupCount}건
            </Badge>
          ) : null}
          <Badge
            variant={persistenceState === "error" ? "destructive" : "secondary"}
          >
            {persistenceState === "saving"
              ? "저장 중"
              : persistenceState === "saved"
                ? "저장됨"
                : persistenceState === "error"
                  ? "저장 실패"
                  : "편집 가능"}
          </Badge>
        </div>
      </div>
      <BillingScopeNotice>
        실제 할인 정책, 영수증, VAT, 부분 결제 연동 없이 현재 청구 항목 수량과
        수납 진행 snapshot만 저장합니다.
      </BillingScopeNotice>
      <BillingCheckoutStateNotice
        checkoutState={checkoutState}
        onRetryCheckout={onRetryCheckout}
      />
      <div className="grid gap-3 p-4">
        {groups.length ? (
          groups.map((group) => {
            const isSummaryExcluded = isCheckoutSummaryExcludedInvoice(group.invoice);
            const hasBillingAssignee = Boolean(invoiceAssignees[group.invoice.id]);
            const transitionTargets = getBillingCheckoutTransitionTargets(
              group.invoice,
            );
            return (
              <div
                key={group.invoice.id}
                className="overflow-hidden rounded-md border bg-[var(--emr-surface-panel)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 border-b bg-[var(--emr-surface-muted)] px-3 py-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="emr-text-dense font-semibold">
                        {group.patient?.name ?? "환자 미상"}
                      </span>
                      <Badge variant="outline">
                        {group.encounter.encounterNo}
                      </Badge>
                      <Badge variant="secondary">
                        {getBillingCheckoutGroupStatusLabel(group.invoice)}
                      </Badge>
                      {isSummaryExcluded ? (
                        <Badge variant="outline">수납 합산 제외</Badge>
                      ) : null}
                    </div>
                    <div className="mt-1 emr-text-metadata text-muted-foreground">
                      {group.invoice.invoiceNo} · {group.guardian?.name ?? "보호자 미지정"}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {transitionTargets.length ? (
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <span className="emr-text-micro text-muted-foreground">
                          상태 변경
                        </span>
                        {transitionTargets.map((target) => (
                          <Button
                            key={target}
                            type="button"
                            size="xs"
                            variant="outline"
                            className="bg-card"
                            disabled={!hasBillingAssignee}
                            onClick={() =>
                              onTransitionStatus(group.invoice.id, target)
                            }
                          >
                            {getBillingCheckoutTransitionLabel(target)}
                          </Button>
                        ))}
                      </div>
                    ) : null}
                    <div className="rounded-md border bg-card px-2.5 py-1.5 text-right">
                      <div className="emr-text-micro text-muted-foreground">
                        그룹 합계
                      </div>
                      <div className="emr-text-dense font-semibold tabular-nums">
                        {formatAmount(group.totalAmount)}
                      </div>
                    </div>
                  </div>
                </div>
                {isSummaryExcluded ? (
                  <div className="border-b bg-[var(--emr-status-warning-bg)] px-3 py-2 emr-text-metadata text-[var(--emr-status-warning-text)]">
                    완료/취소 이력은 세부 내역 확인용으로 표시되며, 현재 수납
                    요약 금액에는 합산되지 않습니다.
                  </div>
                ) : null}
                <div className="overflow-x-auto">
                  <table
                    aria-label="청구 항목 테이블"
                    className="w-full min-w-[720px] border-collapse emr-text-dense"
                  >
                    <thead>
                      <tr className="border-b bg-[var(--emr-surface-muted)] emr-text-metadata text-muted-foreground">
                        <th className="w-[42%] px-3 py-2 text-left font-medium">
                          항목
                        </th>
                        <th className="w-[22%] px-3 py-2 text-left font-medium">
                          출처 / 진행
                        </th>
                        <th className="w-[12%] px-3 py-2 text-right font-medium">
                          단가
                        </th>
                        <th className="w-[10%] px-3 py-2 text-center font-medium">
                          수량
                        </th>
                        <th className="w-[14%] px-3 py-2 text-right font-medium">
                          청구금액
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.lines.map(({ line, order, source }) => (
                        <tr key={line.id} className="border-b last:border-b-0">
                          <td className="px-3 py-2 align-top">
                            <div className="min-w-0">
                              <div className="truncate font-medium">
                                {line.description}
                              </div>
                              <div className="mt-1 emr-text-metadata text-muted-foreground">
                                {getBillingLineCategory(line)}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2 align-top">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Badge variant="outline">
                                {source === "chart_order" ? "차트 청구" : "수납 추가"}
                              </Badge>
                              {isBillingCandidateInvoiceLine(line) ? (
                                <Badge variant="secondary">수납 후보</Badge>
                              ) : null}
                            </div>
                            <div className="mt-1 emr-text-metadata text-muted-foreground">
                              {getOrderStatusBadgeLabel(order?.status)} ·{" "}
                              {getOrderWorkStatusBadgeLabel(order?.workStatus)}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right align-top tabular-nums">
                            {formatAmount(line.unitPrice)}
                          </td>
                          <td className="px-3 py-2 text-center align-top">
                            {isBillingCandidateInvoiceLine(line) ? (
                              <span className="block text-center tabular-nums">
                                {line.quantity}
                              </span>
                            ) : (
                              <Input
                                aria-label={`${line.description} 수량`}
                                className="mx-auto h-7 w-14 bg-card text-right tabular-nums"
                                inputMode="numeric"
                                type="number"
                                value={line.quantity}
                                onChange={(event) =>
                                  onUpdateQuantity(
                                    line.id,
                                    Number(event.target.value),
                                  )
                                }
                              />
                            )}
                          </td>
                          <td className="px-3 py-2 text-right align-top font-semibold tabular-nums">
                            {formatAmount(line.lineTotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t bg-[var(--emr-surface-muted)]">
                        <td colSpan={3} className="px-3 py-2">
                          <Button size="sm" variant="outline" className="bg-card">
                            수납 추가 항목
                          </Button>
                          <span className="ml-2 align-middle emr-text-metadata text-muted-foreground">
                            사료, 일반 판매품 같은 비임상 항목 placeholder
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right emr-text-metadata font-medium text-muted-foreground">
                          {isSummaryExcluded ? "합산 제외" : "그룹 합계"}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums">
                          {isSummaryExcluded
                            ? formatAmount(0)
                            : formatAmount(group.totalAmount)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-md border border-dashed p-4 emr-text-dense text-muted-foreground">
            왼쪽 보호자 ledger에서 수납할 건을 선택해 주세요.
          </div>
        )}
      </div>
    </section>
  );
}

function GuardianBillingLedgerRow({
  row,
  selected,
  onToggle,
}: {
  onToggle: (invoiceId: string) => void;
  row: BillingGuardianLedgerRow;
  selected: boolean;
}) {
  const balance = Math.max(0, row.invoice.totalAmount - row.paidAmount);
  const statusLabel = getBillingLedgerRowStatusLabel(row);

  return (
    <label
      className={cn(
        "flex cursor-pointer gap-3 border-b border-[var(--emr-line-subtle)] px-2 py-2.5 transition-colors hover:bg-[var(--emr-state-hover)]",
        selected && "bg-[var(--emr-state-selected)]",
      )}
      data-testid={`billing-ledger-row-${row.invoice.id}`}
    >
      <Checkbox
        aria-label={`${row.invoice.invoiceNo} 수납 ledger 선택`}
        checked={selected}
        onClick={(event) => {
          event.preventDefault();
          onToggle(row.invoice.id);
        }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate emr-text-body font-semibold text-[var(--emr-text-secondary)]">
              {row.patient?.name ?? "환자 미상"}
            </div>
            <div className="mt-0.5 truncate emr-text-metadata text-muted-foreground">
              {row.lineSummary}
            </div>
          </div>
          <Badge
            variant={
              row.status === "unpaid" || isBillingLedgerRowCancelled(row)
                ? "destructive"
                : "secondary"
            }
            className="shrink-0"
          >
            {statusLabel}
          </Badge>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 emr-text-metadata">
          <span className="truncate text-muted-foreground">
            {row.requestedByName}
          </span>
          <span className="font-semibold tabular-nums text-[var(--emr-text-primary)]">
            {statusLabel === "완료" || balance === 0
              ? formatAmount(row.invoice.totalAmount)
              : formatAmount(balance)}
          </span>
        </div>
      </div>
    </label>
  );
}

export function BillingContentAside() {
  const { detail } = useBillingWorkspaceData();
  const { session: authSession } = useAuthClient();
  const actorHeaders = useMemo(
    () => getDemoActorHeader(authSession),
    [authSession],
  );
  const invoiceLines = useBillingStore((state) => state.invoiceLines);
  const invoices = useBillingStore((state) => state.invoices);
  const payments = useBillingStore((state) => state.payments);
  const selectedInvoiceIds = useBillingStore((state) => state.selectedInvoiceIds);
  const toggleInvoiceSelection = useBillingStore(
    (state) => state.toggleInvoiceSelection,
  );
  const setContentAsideOpen = useLayoutStore(
    (state) => state.setContentAsideOpen,
  );
  const [dateRange, setDateRange] = useState<BillingLedgerDateRange>("3m");
  const [statusFilters, setStatusFilters] = useState<
    Set<BillingLedgerStatusFilter>
  >(
    () => new Set(["all"]),
  );
  const [includeCoGuardianInvoices, setIncludeCoGuardianInvoices] =
    useState(false);
  const guardianId = detail?.guardian?.id;
  const workspaceId = detail?.invoice.workspaceId;
  const hasCoGuardianContext = hasGuardianCoGuardianContext(guardianId);
  const [serverLedgerRows, setServerLedgerRows] =
    useState<GuardianCheckoutLedgerRowSnapshot[]>();
  useEffect(() => {
    if (!guardianId || !workspaceId) return;

    const resolvedGuardianId = guardianId;
    const resolvedWorkspaceId = workspaceId;
    let cancelled = false;
    async function loadServerLedgerRows() {
      const result = await loadGuardianCheckoutLedger({
        actorHeaders,
        guardianId: resolvedGuardianId,
        includeCoGuardianInvoices,
        workspaceId: resolvedWorkspaceId,
      });

      if (cancelled) return;
      setServerLedgerRows(result.ok ? result.rows : undefined);
    }

    void loadServerLedgerRows();

    return () => {
      cancelled = true;
    };
  }, [actorHeaders, guardianId, includeCoGuardianInvoices, workspaceId]);
  const localLedgerRows = useMemo(
    () =>
      getBillingGuardianLedgerRows({
        guardianId,
        includeCoGuardianInvoices,
        invoiceLines,
        invoices,
        payments,
      }),
    [guardianId, includeCoGuardianInvoices, invoiceLines, invoices, payments],
  );
  const ledgerRows = useMemo(() => {
    if (!serverLedgerRows?.length) return localLedgerRows;

    const serverOrder = new Map(
      serverLedgerRows.map((row, index) => [row.invoiceId, index]),
    );
    const serverInvoiceIds = new Set(serverLedgerRows.map((row) => row.invoiceId));
    const compatibleRows = localLedgerRows.filter((row) =>
      serverInvoiceIds.has(row.invoice.id),
    );

    if (!compatibleRows.length) return localLedgerRows;

    return compatibleRows.sort(
      (a, b) =>
        (serverOrder.get(a.invoice.id) ?? Number.MAX_SAFE_INTEGER) -
        (serverOrder.get(b.invoice.id) ?? Number.MAX_SAFE_INTEGER),
    );
  }, [localLedgerRows, serverLedgerRows]);
  const visibleRows = useMemo(
    () =>
      ledgerRows.filter(
        (row) =>
          isBillingLedgerRowMatchingStatusFilter(row, statusFilters) &&
          isBillingLedgerRowInRange(row, dateRange),
      ),
    [dateRange, ledgerRows, statusFilters],
  );
  const visibleRowGroups = useMemo(
    () => groupBillingLedgerRowsByDate(visibleRows),
    [visibleRows],
  );
  const toggleStatusFilter = (filter: BillingLedgerStatusFilter) => {
    setStatusFilters((current) => {
      if (filter === "all") return new Set(["all"]);

      const next = new Set(current);
      next.delete("all");

      if (next.has(filter)) {
        next.delete(filter);
      } else {
        next.add(filter);
      }

      return next.size ? next : new Set(["all"]);
    });
  };

  return (
    <EmrContentAsidePanel id="billing-content-aside">
      <EmrListHeader
        className="mx-0 h-6 border-y-0"
        count={visibleRows.length}
        label="수납이력"
        leadingAction={
          <EmrListHeaderIconButton
            ariaLabel="보호자 수납 이력 접기"
            iconSize="md"
            onClick={() => setContentAsideOpen(false)}
          >
            <CdsNavigationChevronsLeftIcon className="size-4" />
          </EmrListHeaderIconButton>
        }
        headerActions={
          <>
            <EmrListHeaderIconButton ariaLabel="정렬">
              <CdsUtilitiesSortIcon className="size-4" />
            </EmrListHeaderIconButton>
            <EmrListHeaderIconButton ariaLabel="검색">
              <CdsActionsSearchIcon className="size-4" />
            </EmrListHeaderIconButton>
          </>
        }
      />
      <div className="h-px w-full shrink-0 bg-[var(--emr-line-hairline)]" />
      <div className="flex flex-wrap gap-1.5">
        {billingLedgerDateRangeItems.map((item) => (
          <Button
            key={item.value}
            type="button"
            size="sm"
            variant={dateRange === item.value ? "secondary" : "outline"}
            className="h-7 bg-card px-2 emr-text-metadata"
            aria-pressed={dateRange === item.value}
            onClick={() => setDateRange(item.value)}
          >
            {item.label}
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {billingLedgerStatusFilterItems.map((group) => (
          <Button
            key={group.value}
            type="button"
            size="sm"
            variant={statusFilters.has(group.value) ? "secondary" : "outline"}
            className="h-7 bg-card px-1.5 emr-text-metadata"
            aria-pressed={statusFilters.has(group.value)}
            onClick={() => toggleStatusFilter(group.value)}
          >
            {group.label}
          </Button>
        ))}
      </div>
      {hasCoGuardianContext ? (
        <label className="flex cursor-pointer items-center gap-2 rounded-md border bg-card px-3 py-2 emr-text-metadata">
          <Checkbox
            aria-label="타 보호자 청구서 포함"
            checked={includeCoGuardianInvoices}
            onClick={(event) => {
              event.preventDefault();
              setIncludeCoGuardianInvoices((current) => !current);
            }}
          />
          <span>타 보호자 청구서 포함</span>
        </label>
      ) : null}
      <ScrollArea className="min-h-0 flex-1">
        <div className="emr-density-stack-sm">
          {visibleRowGroups.length ? (
            visibleRowGroups.map((group) => (
              <EmrContentHistoryGroup
                key={group.dateLabel}
                count={group.rows.length}
                dataTestId="billing-guardian-ledger-group"
                label={group.dateLabel}
              >
                {group.rows.map((row) => (
                  <GuardianBillingLedgerRow
                    key={row.invoice.id}
                    row={row}
                    selected={selectedInvoiceIds.includes(row.invoice.id)}
                    onToggle={toggleInvoiceSelection}
                  />
                ))}
              </EmrContentHistoryGroup>
            ))
          ) : (
            <div className="rounded-md border border-dashed p-4 emr-text-dense text-muted-foreground">
              조건에 맞는 수납 이력이 없습니다.
            </div>
          )}
        </div>
      </ScrollArea>
      <div className="shrink-0 border-t border-[var(--emr-line-hairline)] bg-[var(--emr-surface-workspace)] py-3 emr-text-metadata text-muted-foreground">
        선택 {selectedInvoiceIds.length}건 · 중앙 checkout에 반영
      </div>
    </EmrContentAsidePanel>
  );
}

function BillingScopeNotice({ children }: { children: ReactNode }) {
  return (
    <div className="border-b bg-[var(--emr-status-warning-bg)] px-4 py-2 emr-text-metadata text-[var(--emr-status-warning-text)]">
      {children}
    </div>
  );
}

function getBillingApiStateNotice(apiState: BillingWorkspaceApiState) {
  const states = [apiState.invoiceLines.status, apiState.paymentStatus.status];

  if (states.includes("permission_denied")) {
    return {
      action: null,
      description:
        "현재 사용자 권한으로 invoice line 또는 payment status API 응답을 볼 수 없습니다.",
      severity: "error" as const,
      title: "수납 API 권한이 없습니다.",
    };
  }

  if (states.includes("error")) {
    return {
      action: (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="bg-card"
          data-testid="billing-api-state-retry-button"
          onClick={apiState.retrySnapshots}
        >
          재시도
        </Button>
      ),
      description:
        "기존 화면 fallback은 유지하지만, API 기반 수납 상태를 확인하려면 다시 불러와야 합니다.",
      severity: "warning" as const,
      title: "수납 API 응답을 불러오지 못했습니다.",
    };
  }

  if (states.includes("loading")) {
    return {
      action: null,
      description:
        "청구 항목과 결제 상태를 API/server boundary에서 다시 읽는 중입니다.",
      severity: "info" as const,
      title: "수납 데이터를 불러오는 중입니다.",
    };
  }

  if (states.includes("empty")) {
    return {
      action: (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="bg-card"
          data-testid="billing-api-state-retry-button"
          onClick={apiState.retrySnapshots}
        >
          다시 확인
        </Button>
      ),
      description:
        "API readback에는 청구 항목이 없어서 화면은 현재 선택된 수납 context를 유지합니다.",
      severity: "warning" as const,
      title: "API 청구 항목이 비어 있습니다.",
    };
  }

  return null;
}

function BillingApiStateNotice({
  apiState,
}: {
  apiState: BillingWorkspaceApiState;
}) {
  const notice = getBillingApiStateNotice(apiState);

  if (!notice) return null;

  return (
    <EmrInlineAlert
      severity={notice.severity}
      title={notice.title}
      action={notice.action}
      testId="billing-api-state"
    >
      {notice.description}
    </EmrInlineAlert>
  );
}

function getBillingCheckoutStateNotice(
  checkoutState: BillingApiRequestState,
  onRetryCheckout: () => void,
) {
  if (checkoutState.status === "permission_denied") {
    return {
      action: null,
      description:
        "현재 사용자 권한으로 guardian checkout session을 준비할 수 없습니다.",
      severity: "error" as const,
      title: "Checkout 권한이 없습니다.",
    };
  }

  if (checkoutState.status === "error") {
    return {
      action: (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="bg-card"
          data-testid="billing-checkout-retry-button"
          onClick={onRetryCheckout}
        >
          재시도
        </Button>
      ),
      description:
        "선택된 청구서 금액은 화면에 남아 있지만, checkout session payable amount는 다시 확인해야 합니다.",
      severity: "warning" as const,
      title: "Checkout session을 준비하지 못했습니다.",
    };
  }

  if (checkoutState.status === "loading") {
    return {
      action: null,
      description: "선택된 청구서로 checkout session payable amount를 계산하는 중입니다.",
      severity: "info" as const,
      title: "Checkout session을 준비하는 중입니다.",
    };
  }

  if (checkoutState.status === "empty") {
    return {
      action: (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="bg-card"
          data-testid="billing-checkout-retry-button"
          onClick={onRetryCheckout}
        >
          다시 확인
        </Button>
      ),
      description:
        "선택된 청구서가 없어 checkout session을 만들지 않았습니다. 수납 ledger에서 청구서를 선택해 주세요.",
      severity: "warning" as const,
      title: "Checkout 대상이 비어 있습니다.",
    };
  }

  return null;
}

function BillingCheckoutStateNotice({
  checkoutState,
  onRetryCheckout,
}: {
  checkoutState: BillingApiRequestState;
  onRetryCheckout: () => void;
}) {
  const notice = getBillingCheckoutStateNotice(checkoutState, onRetryCheckout);

  if (!notice) return null;

  return (
    <div className="px-4 pt-3">
      <EmrInlineAlert
        severity={notice.severity}
        title={notice.title}
        action={notice.action}
        testId="billing-checkout-state"
      >
        {notice.description}
      </EmrInlineAlert>
    </div>
  );
}

export function BillingContent({ hasRightPanel }: ShellComponentProps) {
  const {
    apiState,
    detail,
    invoices,
    queryInvoiceId,
    selectedInvoiceId,
  } =
    useBillingWorkspaceData();
  const { session: authSession } = useAuthClient();
  const actorHeaders = useMemo(
    () => getDemoActorHeader(authSession),
    [authSession],
  );
  const applyInvoiceSnapshot = useBillingStore(
    (state) => state.applyInvoiceSnapshot,
  );
  const applyPaymentStatusSnapshot = useBillingStore(
    (state) => state.applyPaymentStatusSnapshot,
  );
  const invoiceAssignees = useBillingStore((state) => state.invoiceAssignees);
  const storedInvoiceLines = useBillingStore((state) => state.invoiceLines);
  const storedInvoices = useBillingStore((state) => state.invoices);
  const storedPayments = useBillingStore((state) => state.payments);
  const selectedInvoiceIds = useBillingStore(
    (state) => state.selectedInvoiceIds,
  );
  const selectInvoice = useBillingStore((state) => state.selectInvoice);
  const setFilter = useBillingStore((state) => state.setFilter);
  const transitionInvoiceStatus = useBillingStore(
    (state) => state.transitionInvoiceStatus,
  );
  const updateInvoiceLineQuantity = useBillingStore(
    (state) => state.updateInvoiceLineQuantity,
  );
  const [linePersistenceState, setLinePersistenceState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [checkoutSession, setCheckoutSession] =
    useState<GuardianCheckoutSessionSnapshot>();
  const [checkoutState, setCheckoutState] =
    useState<BillingApiRequestState>(billingApiIdleState);
  const [checkoutReloadKey, setCheckoutReloadKey] = useState(0);
  const retryCheckout = () => setCheckoutReloadKey((current) => current + 1);
  const effectiveDetail = useMemo(
    () =>
      detail
        ? mergeBillingDetailStoreSnapshot({
            detail,
            invoiceLines: storedInvoiceLines,
            invoices: storedInvoices,
            payments: storedPayments,
          })
        : null,
    [detail, storedInvoiceLines, storedInvoices, storedPayments],
  );
  const checkoutGroups = useMemo(() => {
    const detailInvoiceIsOutsideStore = effectiveDetail
      ? !storedInvoices.some((invoice) => invoice.id === effectiveDetail.invoice.id)
      : false;
    if (detailInvoiceIsOutsideStore && effectiveDetail) {
      return [createCheckoutGroupFromBillingDetail(effectiveDetail)];
    }

    const groups = getBillingCheckoutGroups({
      invoiceLines: storedInvoiceLines,
      invoices: storedInvoices,
      payments: storedPayments,
      selectedInvoiceIds,
    }).filter((group) => group.invoice.workspaceId === effectiveDetail?.invoice.workspaceId);

    if (groups.length || !effectiveDetail) return groups;

    return [createCheckoutGroupFromBillingDetail(effectiveDetail)];
  }, [effectiveDetail, selectedInvoiceIds, storedInvoiceLines, storedInvoices, storedPayments]);
  const checkoutInvoiceIds = useMemo(
    () => checkoutGroups.map((group) => group.invoice.id),
    [checkoutGroups],
  );
  const checkoutTableLines = useMemo(
    () =>
      checkoutGroups.length
        ? checkoutGroups.flatMap((group) =>
            group.lines.map((checkoutLine) => checkoutLine.line),
          )
        : (effectiveDetail?.invoiceLines ?? []),
    [checkoutGroups, effectiveDetail?.invoiceLines],
  );
  const checkoutWorkspaceId = checkoutGroups[0]?.invoice.workspaceId ?? effectiveDetail?.invoice.workspaceId;
  const effectiveCheckoutState =
    !checkoutWorkspaceId || checkoutInvoiceIds.length === 0
      ? billingApiEmptyState
      : checkoutState;
  useEffect(() => {
    if (!checkoutWorkspaceId || checkoutInvoiceIds.length === 0) {
      return;
    }

    const resolvedWorkspaceId = checkoutWorkspaceId;
    let cancelled = false;
    async function prepareSelectedCheckout() {
      setCheckoutState(billingApiLoadingState);
      const result = await prepareGuardianCheckout({
        actorHeaders,
        invoiceIds: checkoutInvoiceIds,
        paymentMethod: "card",
        workspaceId: resolvedWorkspaceId,
      });

      if (cancelled) return;
      if (!result.ok) {
        setCheckoutSession(undefined);
        setCheckoutState(getBillingApiFailureState(result));
        return;
      }

      setCheckoutSession(result.checkoutSession);
      setCheckoutState(billingApiReadyState);
    }

    void prepareSelectedCheckout();

    return () => {
      cancelled = true;
    };
  }, [actorHeaders, checkoutInvoiceIds, checkoutReloadKey, checkoutWorkspaceId]);
  useEffect(() => {
    if (!queryInvoiceId || queryInvoiceId === selectedInvoiceId) return;

    const invoice = invoices.find((item) => item.id === queryInvoiceId);
    if (!invoice) return;

    selectInvoice(queryInvoiceId);
    setFilter(getBillingFilterForInvoice(invoice));
  }, [invoices, queryInvoiceId, selectInvoice, selectedInvoiceId, setFilter]);

  if (!effectiveDetail) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--emr-surface-workspace)] emr-text-dense text-muted-foreground">
        수납 목록에서 청구서를 선택해 주세요.
      </div>
    );
  }

  async function handleUpdateInvoiceLineQuantity(
    lineId: string,
    quantity: number,
  ) {
    if (!effectiveDetail) return;
    const safeQuantity = Math.max(1, Math.round(quantity * 1000) / 1000 || 1);
    const targetLine =
      checkoutTableLines.find((line) => line.id === lineId) ??
      effectiveDetail.invoiceLines.find((line) => line.id === lineId);
    const targetInvoice =
      targetLine
        ? storedInvoices.find((invoice) => invoice.id === targetLine.invoiceId) ??
          invoices.find((invoice) => invoice.id === targetLine.invoiceId)
        : effectiveDetail.invoice;
    if (!targetLine || !targetInvoice) return;

    updateInvoiceLineQuantity(lineId, safeQuantity);
    setLinePersistenceState("saving");

    const result = await saveBillingInvoiceLines({
      actorHeaders,
      invoiceId: targetInvoice.id,
      lines: [{ invoiceLineId: lineId, quantity: safeQuantity }],
      workspaceId: targetInvoice.workspaceId,
    });

    if (!result.ok) {
      setLinePersistenceState("error");
      return;
    }

    applyInvoiceSnapshot(result.invoice, result.lines);
    setLinePersistenceState("saved");
  }

  async function handleTransitionInvoiceStatus(
    invoiceId: string,
    target: BillingInvoiceStatusTransitionTarget,
  ) {
    const targetInvoice =
      storedInvoices.find((invoice) => invoice.id === invoiceId) ??
      invoices.find((invoice) => invoice.id === invoiceId) ??
      (effectiveDetail?.invoice.id === invoiceId ? effectiveDetail.invoice : undefined);
    if (!targetInvoice || !invoiceAssignees[invoiceId]) return;

    setLinePersistenceState("saving");
    const result = await transitionGuardianCheckoutInvoiceStatus({
      actorHeaders,
      invoiceId,
      paymentMethod: "card",
      reason: `수납 화면에서 ${getBillingCheckoutTransitionLabel(target)} 상태로 변경`,
      target,
      workspaceId: targetInvoice.workspaceId,
    });

    if (!result.ok) {
      transitionInvoiceStatus(invoiceId, target);
      setLinePersistenceState("error");
      return;
    }

    applyPaymentStatusSnapshot(result.invoice, result.payments);
    setLinePersistenceState("saved");
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--emr-surface-workspace)]">
      <ScrollArea className="min-h-0 flex-1">
        <div className="grid gap-4 p-4">
          <BillingTitleCard
            detail={effectiveDetail}
            hasRightPanel={Boolean(hasRightPanel)}
          />
          <BillingApiStateNotice apiState={apiState} />
          <SelectedCheckoutWorkspace
            checkoutSession={
              checkoutInvoiceIds.length ? checkoutSession : undefined
            }
            checkoutState={effectiveCheckoutState}
            groups={checkoutGroups}
            invoiceAssignees={invoiceAssignees}
            persistenceState={linePersistenceState}
            onRetryCheckout={retryCheckout}
            onTransitionStatus={handleTransitionInvoiceStatus}
            onUpdateQuantity={handleUpdateInvoiceLineQuantity}
          />
        </div>
      </ScrollArea>
    </div>
  );
}

function SummaryLine({
  label,
  value,
  emphasis = false,
  muted = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex min-h-9 items-center justify-between gap-3 border-b border-[var(--emr-line-subtle)] emr-text-dense">
      <span
        className={
          muted ? "text-muted-foreground" : "text-[var(--emr-text-secondary)]"
        }
      >
        {label}
      </span>
      <span
        className={cn(
          "text-right font-medium",
          emphasis && "text-primary",
          muted && "text-muted-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function PaymentMethodControl({
  paymentMethod,
  onPaymentMethodChange,
}: {
  onPaymentMethodChange: (paymentMethod: PaymentMethod) => void;
  paymentMethod: PaymentMethod;
}) {
  return (
    <SegmentedControl
      aria-label="결제 수단 선택"
      value={paymentMethod}
      items={paymentMethodItems}
      variant="tabs"
      className="grid w-full grid-cols-2"
      itemClassName="w-full"
      onValueChange={onPaymentMethodChange}
    />
  );
}

function PaymentStatusNote({
  balance,
  invoiceStatus,
  paidAmount,
  payments,
}: {
  balance: number;
  invoiceStatus: InvoiceStatus;
  paidAmount: number;
  payments: Payment[];
}) {
  const approvedPayment = payments.find(
    (payment) => payment.status === "approved",
  );
  const approvedPaymentLabel = approvedPayment
    ? getStatusLabel("payment", approvedPayment.status)
    : "승인";
  const isPaid = invoiceStatus === "paid" || balance === 0;

  return (
    <div className="rounded-md border bg-[var(--emr-surface-muted)] px-3 py-2">
      <div className="emr-text-dense font-semibold">
        {isPaid ? "세션 내 수납 완료" : "보호자 안내 후 수납 완료 처리"}
      </div>
      <div className="mt-1 emr-text-metadata leading-5 text-muted-foreground">
        {isPaid
          ? `${formatAmount(paidAmount)} ${approvedPaymentLabel} 상태로 기록되었습니다.`
          : "실제 PG, 현금영수증, 영수증 출력 연동 없이 데모 세션에서만 상태를 변경합니다."}
      </div>
    </div>
  );
}

export function BillingRightPanel() {
  const { detail } = useBillingWorkspaceData();
  const { session: authSession } = useAuthClient();
  const actorHeaders = useMemo(
    () => getDemoActorHeader(authSession),
    [authSession],
  );
  const applyInvoiceSnapshot = useBillingStore(
    (state) => state.applyInvoiceSnapshot,
  );
  const applyPaymentStatusSnapshot = useBillingStore(
    (state) => state.applyPaymentStatusSnapshot,
  );
  const invoiceAssignees = useBillingStore((state) => state.invoiceAssignees);
  const invoiceLines = useBillingStore((state) => state.invoiceLines);
  const invoices = useBillingStore((state) => state.invoices);
  const paymentMethod = useBillingStore((state) => state.paymentMethod);
  const payments = useBillingStore((state) => state.payments);
  const selectedInvoiceIds = useBillingStore(
    (state) => state.selectedInvoiceIds,
  );
  const setPaymentMethod = useBillingStore((state) => state.setPaymentMethod);
  const [confirmationState, setConfirmationState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [paymentState, setPaymentState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [paymentFailureContext, setPaymentFailureContext] =
    useState<BillingPaymentFailureContext | null>(null);
  const [pendingFinancialAction, setPendingFinancialAction] =
    useState<BillingFinancialAction | null>(null);
  const [unpaidReason, setUnpaidReason] = useState("");
  const [paymentMemo, setPaymentMemo] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [checkoutSession, setCheckoutSession] =
    useState<GuardianCheckoutSessionSnapshot>();
  const effectiveDetail = useMemo(
    () =>
      detail
        ? mergeBillingDetailStoreSnapshot({
            detail,
            invoiceLines,
            invoices,
            payments,
          })
        : null,
    [detail, invoiceLines, invoices, payments],
  );
  const selectedCheckoutGroups = useMemo(() => {
    if (!effectiveDetail) return [];

    return getBillingCheckoutGroups({
      invoiceLines,
      invoices,
      payments,
      selectedInvoiceIds,
    }).filter((group) => group.invoice.workspaceId === effectiveDetail.invoice.workspaceId);
  }, [effectiveDetail, invoiceLines, invoices, payments, selectedInvoiceIds]);
  const summaryGroups = useMemo(() => {
    if (selectedCheckoutGroups.length) return selectedCheckoutGroups;
    return effectiveDetail ? [createCheckoutGroupFromBillingDetail(effectiveDetail)] : [];
  }, [effectiveDetail, selectedCheckoutGroups]);
  const checkoutInvoiceIds = useMemo(
    () => summaryGroups.map((group) => group.invoice.id),
    [summaryGroups],
  );
  const checkoutWorkspaceId =
    summaryGroups[0]?.invoice.workspaceId ?? effectiveDetail?.invoice.workspaceId;
  useEffect(() => {
    if (!checkoutWorkspaceId || checkoutInvoiceIds.length === 0) return;

    const resolvedWorkspaceId = checkoutWorkspaceId;
    let cancelled = false;
    async function prepareSelectedCheckout() {
      const result = await prepareGuardianCheckout({
        actorHeaders,
        invoiceIds: checkoutInvoiceIds,
        paymentMemo,
        paymentMethod,
        workspaceId: resolvedWorkspaceId,
      });

      if (cancelled) return;
      setCheckoutSession(result.ok ? result.checkoutSession : undefined);
    }

    void prepareSelectedCheckout();

    return () => {
      cancelled = true;
    };
  }, [
    actorHeaders,
    checkoutInvoiceIds,
    checkoutWorkspaceId,
    paymentMemo,
    paymentMethod,
  ]);

  if (!effectiveDetail) return null;

  const payableSummaryGroups = summaryGroups.filter(
    (group) => !isCheckoutSummaryExcludedInvoice(group.invoice),
  );
  const excludedSummaryGroupCount =
    summaryGroups.length - payableSummaryGroups.length;
  const summaryTotalAmount = payableSummaryGroups.reduce(
    (total, group) => total + group.totalAmount,
    0,
  );
  const summaryPaidAmount = payableSummaryGroups.reduce(
    (total, group) => total + group.paidAmount,
    0,
  );
  const summaryBalance = payableSummaryGroups.reduce(
    (total, group) => total + getBillingCheckoutGroupBalance(group),
    0,
  );
  const dataBackedSummaryBalance =
    checkoutSession?.payableAmount ?? summaryBalance;
  const dataBackedExcludedSummaryGroupCount =
    checkoutSession?.excludedCount ?? excludedSummaryGroupCount;
  const actionDetail =
    payableSummaryGroups.length === 1
      ? getBillingDetail(
          payableSummaryGroups[0].invoice.id,
          invoices,
          invoiceLines,
          payments,
        ) ??
        (payableSummaryGroups[0].invoice.id === effectiveDetail.invoice.id
          ? effectiveDetail
          : null)
      : null;
  const actionBalance = actionDetail ? getBillingBalance(actionDetail) : 0;
  const actionInvoiceId = actionDetail?.invoice.id;
  const actionAssigneeName = actionInvoiceId
    ? invoiceAssignees[actionInvoiceId]
    : undefined;
  const statusLabel =
    payableSummaryGroups.length === 0
      ? "합산 제외"
      : payableSummaryGroups.length > 1
        ? "합산 수납"
        : getBillingHeaderStatusLabel(payableSummaryGroups[0].invoice.status);
  const summaryInvoiceLabel =
    summaryGroups.length === 1
      ? summaryGroups[0].invoice.invoiceNo
      : `${summaryGroups.length}건 선택`;
  const financialActionDisabled =
    !actionDetail || payableSummaryGroups.length !== 1 || !actionAssigneeName;
  const handleIssueInvoice = async () => {
    if (!actionDetail || !actionAssigneeName) return false;
    setConfirmationState("saving");
    const result = await saveBillingInvoiceLines({
      actorHeaders,
      confirmBilling: true,
      invoiceId: actionDetail.invoice.id,
      lines: getPersistedInvoiceLines(actionDetail.invoiceLines).map((line) => ({
        invoiceLineId: line.id,
        quantity: line.quantity,
      })),
      workspaceId: actionDetail.invoice.workspaceId,
    });

    if (!result.ok) {
      setConfirmationState("error");
      return false;
    }

    applyInvoiceSnapshot(result.invoice, result.lines);
    setConfirmationState("saved");
    return true;
  };
  const handlePaymentMethodChange = async (
    nextPaymentMethod: PaymentMethod,
  ) => {
    if (!actionDetail) return false;
    setPaymentMethod(nextPaymentMethod);
    setPaymentState("saving");
    const result = await saveBillingPaymentStatus({
      action: "select_payment_method",
      actorHeaders,
      invoiceId: actionDetail.invoice.id,
      paymentMethod: nextPaymentMethod,
      workspaceId: actionDetail.invoice.workspaceId,
    });

    if (!result.ok) {
      setPaymentFailureContext("payment_method");
      setPaymentState("error");
      return false;
    }

    applyPaymentStatusSnapshot(result.invoice, result.payments);
    setPaymentFailureContext(null);
    setPaymentState("saved");
    return true;
  };
  const handleMarkUnpaid = async () => {
    if (!actionDetail || !actionAssigneeName) return false;
    const normalizedUnpaidReason = unpaidReason.trim();
    if (!normalizedUnpaidReason) return false;

    setPaymentState("saving");
    const transitionResult = await transitionGuardianCheckoutInvoiceStatus({
      actorHeaders,
      invoiceId: actionDetail.invoice.id,
      paymentMethod,
      reason: normalizedUnpaidReason,
      target: "unpaid",
      workspaceId: actionDetail.invoice.workspaceId,
    });
    const result = transitionResult.ok
      ? transitionResult
      : await saveBillingPaymentStatus({
          action: "mark_unpaid",
          actorHeaders,
          invoiceId: actionDetail.invoice.id,
          paymentMethod,
          unpaidReason: normalizedUnpaidReason,
          workspaceId: actionDetail.invoice.workspaceId,
        });

    if (!result.ok) {
      setPaymentFailureContext("mark_unpaid");
      setPaymentState("error");
      return false;
    }

    applyPaymentStatusSnapshot(result.invoice, result.payments);
    setPaymentFailureContext(null);
    setUnpaidReason("");
    setPaymentState("saved");
    return true;
  };
  const handleMarkPaid = async () => {
    if (!actionDetail || !actionAssigneeName) return false;
    setPaymentState("saving");
    const transitionResult = await transitionGuardianCheckoutInvoiceStatus({
      actorHeaders,
      invoiceId: actionDetail.invoice.id,
      paymentMethod,
      reason: "보호자 수납 완료",
      target: "paid",
      workspaceId: actionDetail.invoice.workspaceId,
    });
    const result = transitionResult.ok
      ? transitionResult
      : await saveBillingPaymentStatus({
          action: "complete_payment",
          actorHeaders,
          invoiceId: actionDetail.invoice.id,
          paymentMethod,
          workspaceId: actionDetail.invoice.workspaceId,
        });

    if (!result.ok) {
      setPaymentFailureContext("mark_paid");
      setPaymentState("error");
      return false;
    }

    applyPaymentStatusSnapshot(result.invoice, result.payments);
    setPaymentFailureContext(null);
    setPaymentState("saved");
    return true;
  };
  const handleConfirmFinancialAction = async () => {
    if (!pendingFinancialAction) return;
    if (pendingFinancialAction === "issue_invoice") {
      await handleIssueInvoice();
    } else if (pendingFinancialAction === "mark_unpaid") {
      await handleMarkUnpaid();
    } else {
      await handleMarkPaid();
    }

    setPendingFinancialAction(null);
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-card">
      <div className="flex h-12 shrink-0 items-center justify-between border-b px-4">
        <h2 className="emr-text-body font-semibold">수납 요약</h2>
        <div className="flex items-center gap-2">
          <EmrStatusBadge label={statusLabel} marker="none" />
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="px-4 py-3">
          <div className="emr-text-metadata text-muted-foreground">
            {summaryInvoiceLabel}
          </div>
          <div className="mt-1 text-[18px] font-semibold">
            {formatAmount(dataBackedSummaryBalance)}
          </div>
          <div className="mt-1 emr-text-metadata text-muted-foreground">
            {dataBackedExcludedSummaryGroupCount
              ? `완료/취소 ${dataBackedExcludedSummaryGroupCount}건은 현재 수납 합산에서 제외됩니다.`
              : actionDetail
                ? getInvoiceStatusDescription(actionDetail.invoice.status, actionBalance)
                : "여러 수납 가능 건은 checkout session 확정 후 처리합니다."}
          </div>

          <div className="mt-4">
            <SummaryLine
              label="최종 결제금액"
              value={formatAmount(dataBackedSummaryBalance)}
              emphasis
            />
            <SummaryLine
              label="청구액"
              value={formatAmount(summaryTotalAmount)}
            />
            <SummaryLine
              label="수납액"
              value={formatAmount(summaryPaidAmount)}
              emphasis={summaryPaidAmount > 0}
            />
            <SummaryLine
              label="미납액"
              value={formatAmount(dataBackedSummaryBalance)}
              emphasis={dataBackedSummaryBalance > 0}
            />
            <SummaryLine
              label="할인"
              value={formatAmount(
                payableSummaryGroups.reduce(
                  (total, group) => total + group.invoice.discountAmount,
                  0,
                ),
              )}
            />
            <SummaryLine
              label="할증"
              value={formatAmount(0)}
              muted
            />
            <SummaryLine
              label="발행"
              value={
                actionDetail
                  ? formatShortDateTime(actionDetail.invoice.issuedAt)
                  : `${payableSummaryGroups.length}건 대상`
              }
            />
          </div>
          {dataBackedExcludedSummaryGroupCount ? (
            <EmrInlineAlert
              severity="warning"
              title="수납 합산에서 제외된 이력이 있어"
              className="mt-3 emr-text-metadata"
            >
              완료/취소 건은 중앙 작업대에서 세부 내역과 상태 변경만 확인하고,
              오른쪽 결제 금액에는 더하지 않습니다.
            </EmrInlineAlert>
          ) : null}
          {actionDetail && !actionAssigneeName ? (
            <EmrInlineAlert
              severity="info"
              title="담당하기 후 수납 액션 가능"
              className="mt-3 emr-text-metadata"
            >
              수납 진행, 수납 완료, 미납 처리는 담당자를 지정한 뒤 실행할 수
              있습니다.
            </EmrInlineAlert>
          ) : null}

          <div className="mt-5 emr-text-dense font-semibold">
            읽기 전용 수납 정보
          </div>
          <div className="mt-2 rounded-md border bg-[var(--emr-surface-muted)] px-3">
            <SummaryLine label="영수증 금액" value="미연동" muted />
            <SummaryLine
              label="VAT 세부"
              value={formatAmount(effectiveDetail.invoice.taxAmount)}
              muted
            />
            <SummaryLine label="부분 결제 입력" value="미지원" muted />
          </div>

          <div className="mt-5 emr-text-dense font-semibold">결제 수단</div>
          <div className="mt-2">
            <PaymentMethodControl
              paymentMethod={paymentMethod}
              onPaymentMethodChange={handlePaymentMethodChange}
            />
          </div>
          <div className="mt-2 rounded-md border bg-[var(--emr-surface-muted)] px-3 py-2">
            <SummaryLine
              label="카드 개월 수"
              value={paymentMethod === "card" ? "일시불" : "해당 없음"}
              muted
            />
            <SummaryLine
              label="간편결제"
              value={paymentMethod === "other" ? "선택됨" : "미선택"}
              muted
            />
          </div>

          <div className="mt-5 emr-text-dense font-semibold">할인/할증 사유</div>
          <div className="mt-2">
            <Input
              aria-label="할인 또는 할증 사유"
              placeholder="할인/할증이 있을 때 사유를 입력"
              value={adjustmentReason}
              onChange={(event) => setAdjustmentReason(event.target.value)}
            />
          </div>

          <div className="mt-5 emr-text-dense font-semibold">수납 메모</div>
          <div className="mt-2">
            <Input
              aria-label="수납 메모"
              placeholder="수납 이력에 남길 메모"
              value={paymentMemo}
              onChange={(event) => setPaymentMemo(event.target.value)}
            />
          </div>

          <div className="mt-4">
            {actionDetail ? (
              <PaymentStatusNote
                balance={actionBalance}
                invoiceStatus={actionDetail.invoice.status}
                paidAmount={summaryPaidAmount}
                payments={actionDetail.payments}
              />
            ) : (
              <div className="rounded-md border bg-[var(--emr-surface-muted)] px-3 py-2">
                <div className="emr-text-dense font-semibold">
                  조회 전용 수납 이력
                </div>
                <div className="mt-1 emr-text-metadata leading-5 text-muted-foreground">
                  완료/취소만 선택되어 있거나 여러 수납 가능 건이 선택된 경우,
                  이 패널에서는 결제 상태를 변경하지 않습니다.
                </div>
              </div>
            )}
          </div>
          {confirmationState === "error" ? (
            <BillingPaymentErrorMessage
              title="수납 진행이 저장되지 않았어"
              actionLabel="수납 진행 다시 시도"
              onRetry={() => setPendingFinancialAction("issue_invoice")}
            >
              금액과 항목은 화면에 남아 있지만 서버 저장은 완료되지 않았어. 실제
              PG, VAT, 영수증 연동은 아직 없는 MVP 범위야.
            </BillingPaymentErrorMessage>
          ) : null}
          {paymentState === "error" ? (
            <BillingPaymentErrorMessage
              title={
                paymentFailureContext === "payment_method"
                  ? "결제 수단이 저장되지 않았어"
                  : "수납 상태가 저장되지 않았어"
              }
              actionLabel={
                paymentFailureContext === "payment_method"
                  ? "결제 수단 다시 저장"
                  : paymentFailureContext === "mark_unpaid"
                    ? "미납 처리 다시 시도"
                    : "수납 완료 다시 시도"
              }
              onRetry={() => {
                if (paymentFailureContext === "payment_method") {
                  void handlePaymentMethodChange(paymentMethod);
                  return;
                }

                setPendingFinancialAction(
                  paymentFailureContext === "mark_unpaid"
                    ? "mark_unpaid"
                    : "mark_paid",
                );
              }}
            >
              수납 상태는 아직 확정되지 않았어. 결제 수단과 금액을 확인한 뒤
              다시 시도해.
            </BillingPaymentErrorMessage>
          ) : null}
        </div>
      </ScrollArea>
      <BillingPaymentActionFooter
        confirmationState={confirmationState}
        disabled={financialActionDisabled}
        paymentState={paymentState}
        onIssueInvoice={() => setPendingFinancialAction("issue_invoice")}
        onMarkPaid={() => setPendingFinancialAction("mark_paid")}
        onMarkUnpaid={() => setPendingFinancialAction("mark_unpaid")}
      />
      <BillingFinancialPreflightDialog
        action={pendingFinancialAction}
        balance={actionBalance}
        detail={actionDetail ?? effectiveDetail}
        paymentMethod={paymentMethod}
        unpaidReason={unpaidReason}
        confirmationState={confirmationState}
        paymentState={paymentState}
        onUnpaidReasonChange={setUnpaidReason}
        onConfirm={handleConfirmFinancialAction}
        onOpenChange={(open) => {
          if (!open) setPendingFinancialAction(null);
        }}
      />
    </div>
  );
}

function BillingPaymentErrorMessage({
  actionLabel,
  children,
  onRetry,
  title,
}: {
  actionLabel: string;
  children: ReactNode;
  onRetry: () => void;
  title: string;
}) {
  return (
    <EmrInlineAlert
      severity="error"
      title={title}
      className="mt-3 emr-text-metadata"
      action={
        <Button size="sm" variant="outline" onClick={onRetry}>
          {actionLabel}
        </Button>
      }
      testId="billing-financial-error-alert"
    >
      {children}
    </EmrInlineAlert>
  );
}

function BillingFinancialPreflightDialog({
  action,
  balance,
  confirmationState,
  detail,
  onConfirm,
  onOpenChange,
  onUnpaidReasonChange,
  paymentMethod,
  paymentState,
  unpaidReason,
}: {
  action: BillingFinancialAction | null;
  balance: number;
  confirmationState: "idle" | "saving" | "saved" | "error";
  detail: BillingDetail;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  onUnpaidReasonChange: (reason: string) => void;
  paymentMethod: PaymentMethod;
  paymentState: "idle" | "saving" | "saved" | "error";
  unpaidReason: string;
}) {
  const isIssueAction = action === "issue_invoice";
  const isUnpaidAction = action === "mark_unpaid";
  const normalizedUnpaidReason = unpaidReason.trim();
  const isSaving = isIssueAction
    ? confirmationState === "saving"
    : paymentState === "saving";
  const amount = isIssueAction ? detail.invoice.totalAmount : balance;
  const lineCount = detail.invoiceLines.length;
  const dialogTitle =
    action === "issue_invoice"
      ? "수납 진행 전 확인"
      : action === "mark_unpaid"
        ? "미납 처리 전 확인"
        : "수납 완료 전 확인";
  const primaryLabel =
    action === "issue_invoice"
      ? "수납 진행 저장"
      : action === "mark_unpaid"
        ? "미납 처리 저장"
        : "수납 완료 저장";
  const savingLabel =
    action === "issue_invoice"
      ? "확정 중"
      : action === "mark_unpaid"
        ? "미납 저장 중"
        : "수납 저장 중";
  const nextStateLabel =
    action === "issue_invoice"
      ? "수납진행"
      : action === "mark_unpaid"
        ? "미납"
        : "수납완료";

  return (
    <Dialog open={action !== null} onOpenChange={onOpenChange}>
      <EmrDialogShell
        variant="confirm"
        title={dialogTitle}
        description="금액 상태가 바뀌는 financial CTA라서 저장 전에 보호자, 청구서, 금액, MVP 경계를 확인해."
        footerMeta="실제 PG, VAT, 영수증, 환불, 정산 연동은 이번 MVP 범위 밖이야."
        primaryAction={
          <Button
            type="button"
            size="sm"
            disabled={isSaving || (isUnpaidAction && !normalizedUnpaidReason)}
            onClick={onConfirm}
          >
            {isSaving ? savingLabel : primaryLabel}
          </Button>
        }
        secondaryAction={
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isSaving}
            onClick={() => onOpenChange(false)}
          >
            취소
          </Button>
        }
      >
        <div className="grid gap-2 rounded-md border bg-[var(--emr-surface-muted)] px-3 py-2">
          <BillingPreflightLine
            label="청구서"
            value={detail.invoice.invoiceNo}
          />
          <BillingPreflightLine
            label="보호자 / 환자"
            value={`${detail.guardian?.name ?? "보호자 미지정"} / ${detail.patient?.name ?? "환자 미상"}`}
          />
          <BillingPreflightLine label="청구 항목" value={`${lineCount}건`} />
          <BillingPreflightLine
            label="확인 금액"
            value={formatAmount(amount)}
            emphasis
          />
          <BillingPreflightLine
            label="결제 수단"
            value={getBillingPaymentMethodLabel(paymentMethod)}
          />
          <BillingPreflightLine
            label="변경 후 상태"
            value={nextStateLabel}
            emphasis
          />
        </div>
        {isUnpaidAction ? (
          <div className="mt-3">
            <label className="emr-text-metadata font-semibold text-[var(--emr-text-secondary)]">
              미납 처리 사유
            </label>
            <Input
              className="mt-2"
              aria-label="미납 처리 사유"
              placeholder="예: 보호자 요청으로 다음 방문 시 결제"
              value={unpaidReason}
              onChange={(event) => onUnpaidReasonChange(event.target.value)}
            />
            {!normalizedUnpaidReason ? (
              <div className="mt-1 emr-text-metadata text-[var(--emr-status-warning-text)]">
                미납 처리는 사유를 입력해야 저장할 수 있습니다.
              </div>
            ) : null}
          </div>
        ) : null}
        <EmrInlineAlert
          severity="warning"
          title="저장 실패 시 상태는 확정되지 않아"
          className="mt-3 emr-text-metadata"
        >
          실패하면 이 패널에 다시 시도 안내를 남기고, 실제 결제나 영수증 발행이
          된 것처럼 표시하지 않아.
        </EmrInlineAlert>
      </EmrDialogShell>
    </Dialog>
  );
}

function BillingPreflightLine({
  emphasis = false,
  label,
  value,
}: {
  emphasis?: boolean;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-h-7 items-center justify-between gap-3 emr-text-metadata">
      <span className="text-[var(--emr-text-tertiary)]">{label}</span>
      <span
        className={cn("text-right font-medium", emphasis && "text-primary")}
      >
        {value}
      </span>
    </div>
  );
}

function BillingPaymentActionFooter({
  confirmationState,
  disabled = false,
  paymentState,
  onIssueInvoice,
  onMarkPaid,
  onMarkUnpaid,
}: {
  confirmationState: "idle" | "saving" | "saved" | "error";
  disabled?: boolean;
  paymentState: "idle" | "saving" | "saved" | "error";
  onIssueInvoice: () => void;
  onMarkPaid: () => void;
  onMarkUnpaid: () => void;
}) {
  return (
    <div className="grid shrink-0 gap-2 border-t p-4">
      <Button
        size="sm"
        className="w-full"
        disabled={disabled || confirmationState === "saving"}
        onClick={onIssueInvoice}
      >
        {confirmationState === "saving"
          ? "진행 중"
          : confirmationState === "saved"
            ? "수납 진행됨"
            : "수납 진행"}
      </Button>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={disabled || paymentState === "saving"}
          onClick={onMarkPaid}
        >
          {paymentState === "saving" ? "저장 중" : "수납 완료"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled || paymentState === "saving"}
          onClick={onMarkUnpaid}
        >
          미납 처리
        </Button>
      </div>
    </div>
  );
}
