"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import {
  CdsActionsListFilterIcon,
  CdsActionsSearchIcon,
} from "@/components/cds-icons/actions-and-controls";
import { CdsUtilitiesSortIcon } from "@/components/cds-icons/utilities-and-misc";
import { EmrDialogShell } from "@/components/emr/dialog-shell";
import { EmrInlineAlert } from "@/components/emr/inline-alert";
import { EmrPatientContextBar } from "@/components/emr/patient-context-bar";
import { EmrRowActionMenu } from "@/components/emr/row-action-menu";
import {
  EmrSidePanelCard,
  emrSidePanelCardHoverActionButtonClassName,
} from "@/components/emr/side-panel-card";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getBillingDetail,
  getBillingFilterForInvoice,
  getBillingGuardianGroups,
  getBillingQueueRows,
  type BillingDetail,
  type BillingGuardianGroup,
  type BillingQueueRow,
} from "@/features/billing/data";
import { useAuthClient, type AuthSession } from "@/features/auth/auth-client";
import { useBillingStore, type BillingFilter } from "@/features/billing/store";
import {
  getPatientDisplayAge,
  getPatientSexLabel,
  getSpeciesLabel,
} from "@/features/reception/data";
import { getDemoScenarioFromParams } from "@/lib/emr-domain/demo-scenarios";
import { getStatusLabel } from "@/lib/emr-domain/status-labels";
import { cn } from "@/lib/utils";
import { useLayoutStore } from "@/stores/layout-store";
import type { ShellComponentProps } from "@/types/emr";
import type { InvoiceLine, InvoiceStatus, Payment, PaymentMethod } from "@/types/emr-domain";

const billingQueueGroups: Array<{ colorToken: string; label: string; value: BillingFilter }> = [
  { label: "대기", value: "waiting", colorToken: "--emr-status-info-text" },
  { label: "미납", value: "unpaid", colorToken: "--emr-status-warning-text" },
  { label: "종료", value: "closed", colorToken: "--emr-status-success-text" },
];

const paymentMethodItems: Array<{ label: string; value: PaymentMethod }> = [
  { label: "카드", value: "card" },
  { label: "현금", value: "cash" },
  { label: "계좌이체", value: "transfer" },
  { label: "기타", value: "other" },
];

const formatAmount = (amount: number) => `${amount.toLocaleString()}원`;
const formatShortDateTime = (dateTime?: string) =>
  dateTime ? dateTime.slice(2, 16).replace("T", " ").replaceAll("-", ".") : "-";
const getBillingPaymentMethodLabel = (method: PaymentMethod) =>
  paymentMethodItems.find((item) => item.value === method)?.label ?? method;

type BillingFinancialAction = "issue_invoice" | "mark_unpaid" | "mark_paid";
type BillingPaymentFailureContext = "payment_method" | "mark_unpaid" | "mark_paid";

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

const invoiceStatusLabels: Record<InvoiceStatus, string> = {
  draft: "수납대기",
  issued: "청구확정",
  paid: "수납완료",
  refund_requested: "환불요청",
  refunded: "환불완료",
  voided: "무효",
};

const getInvoiceStatusLabel = (status: InvoiceStatus) =>
  invoiceStatusLabels[status] ?? getStatusLabel("invoice", status);

const getInvoiceStatusDescription = (status: InvoiceStatus, balance: number) => {
  if (status === "paid" || balance === 0) {
    return "수납이 완료되어 오늘 encounter를 마무리할 수 있습니다.";
  }

  if (status === "issued") {
    return "보호자 안내가 끝났고 결제 처리만 남아 있습니다.";
  }

  return "진료, 검사, 영상, 조제, 처치 항목을 확인한 뒤 수납할 단계입니다.";
};

const billingLineCategoryOrder = ["진료", "검사", "영상", "조제", "처치", "기타"] as const;
type BillingLineCategory = (typeof billingLineCategoryOrder)[number];
const billingInvoiceLineColumns = {
  category: "w-[88px]",
  description: "min-w-[220px]",
  unitPrice: "w-[104px]",
  quantity: "w-[86px]",
  discount: "w-[96px]",
  lineTotal: "w-[116px]",
} as const;
const billingAmountCellClassName = "whitespace-nowrap text-right tabular-nums";

const getBillingLineCategory = (line: InvoiceLine): BillingLineCategory => {
  if (line.serviceItemId?.startsWith("svc-consult")) return "진료";
  if (line.serviceItemId?.startsWith("svc-lab")) return "검사";
  if (line.serviceItemId?.startsWith("svc-imaging")) return "영상";
  if (line.serviceItemId?.startsWith("svc-med")) return "조제";
  if (line.serviceItemId?.startsWith("svc-treatment")) return "처치";

  return "기타";
};

const sortInvoiceLinesForDemoFlow = (lines: InvoiceLine[]) =>
  [...lines].sort((a, b) => {
    const categoryOrder =
      billingLineCategoryOrder.indexOf(getBillingLineCategory(a)) -
      billingLineCategoryOrder.indexOf(getBillingLineCategory(b));

    if (categoryOrder !== 0) return categoryOrder;

    return a.description.localeCompare(b.description);
  });

const getBillingFlowLabel = (lines: InvoiceLine[]) => {
  const categories = billingLineCategoryOrder.filter(
    (category) => category !== "기타" && lines.some((line) => getBillingLineCategory(line) === category)
  );

  return categories.length ? categories.join(" / ") : "청구 항목";
};

function getDemoActorHeader(session: AuthSession | null) {
  return session && (!("provider" in session) || session.provider !== "supabase")
    ? {
        "x-clair-demo-client-session-id": getDemoClientSessionId(),
        "x-clair-demo-session-user-id": session.id,
      }
    : undefined;
}

function getDemoClientSessionId() {
  if (typeof window === "undefined") return "server-render";

  const storageKey = "clair-demo-client-session-id";
  const existing = window.sessionStorage.getItem(storageKey);
  if (existing) return existing;

  const next =
    typeof window.crypto?.randomUUID === "function"
      ? window.crypto.randomUUID()
      : `demo-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.sessionStorage.setItem(storageKey, next);
  return next;
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
      }
    );
    const body = (await response.json()) as BillingInvoiceCandidateRouteResponse;

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
      }
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
      }
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
      }
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
        body: JSON.stringify({ action, invoiceId, paymentMethod, unpaidReason }),
        cache: "no-store",
        headers: {
          "content-type": "application/json",
          ...actorHeaders,
        },
        method: "PATCH",
      }
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

const mergeInvoiceCandidateLines = (
  invoiceLines: InvoiceLine[],
  candidates: BillingInvoiceCandidateSnapshot[]
) => {
  let nextLines = invoiceLines;

  for (const candidate of candidates) {
    const existingLine = nextLines.find(
      (line) => line.invoiceId === candidate.invoiceId && line.orderId === candidate.orderId
    );
    const candidateLine = {
      id: existingLine?.id ?? `invoice-line-${candidate.billingCandidateId}`,
      invoiceId: candidate.invoiceId,
      serviceItemId: existingLine?.serviceItemId,
      orderId: candidate.orderId,
      description: candidate.description,
      quantity: existingLine?.quantity ?? candidate.quantity,
      unitPrice: existingLine?.unitPrice ?? candidate.unitPrice,
      lineTotal: existingLine?.lineTotal ?? candidate.lineTotal,
    } satisfies InvoiceLine;

    nextLines = existingLine
      ? nextLines.map((line) => line.id === existingLine.id ? candidateLine : line)
      : [...nextLines, candidateLine];
  }

  return nextLines;
};

function useBillingWorkspaceData() {
  const searchParams = useSearchParams();
  const { session: authSession } = useAuthClient();
  const applyInvoiceSnapshot = useBillingStore((state) => state.applyInvoiceSnapshot);
  const applyPaymentStatusSnapshot = useBillingStore((state) => state.applyPaymentStatusSnapshot);
  const invoiceLines = useBillingStore((state) => state.invoiceLines);
  const invoices = useBillingStore((state) => state.invoices);
  const payments = useBillingStore((state) => state.payments);
  const selectedInvoiceId = useBillingStore((state) => state.selectedInvoiceId);
  const scenario = getDemoScenarioFromParams(searchParams);
  const queryInvoiceId = searchParams.get("invoiceId") ?? scenario?.invoiceId;
  const effectiveInvoiceId = queryInvoiceId ?? selectedInvoiceId;
  const [persistedCandidates, setPersistedCandidates] = useState<{
    candidates: BillingInvoiceCandidateSnapshot[];
    encounterId?: string;
  }>({ candidates: [] });
  const actorHeaders = useMemo(() => getDemoActorHeader(authSession), [authSession]);
  const baseDetail =
    getBillingDetail(effectiveInvoiceId, invoices, invoiceLines, payments) ??
    getBillingDetail("invoice-coco-260501", invoices, invoiceLines, payments);
  const effectiveInvoiceLines =
    baseDetail && persistedCandidates.encounterId === baseDetail.encounter.id
      ? mergeInvoiceCandidateLines(invoiceLines, persistedCandidates.candidates)
      : invoiceLines;
  const effectiveInvoices = useMemo(
    () =>
      invoices.map((invoice) => {
        const subtotalAmount = effectiveInvoiceLines
          .filter((line) => line.invoiceId === invoice.id)
          .reduce((total, line) => total + line.lineTotal, 0);

        return {
          ...invoice,
          subtotalAmount,
          totalAmount: Math.max(0, subtotalAmount - invoice.discountAmount + invoice.taxAmount),
        };
      }),
    [effectiveInvoiceLines, invoices]
  );
  const detail =
    getBillingDetail(effectiveInvoiceId, effectiveInvoices, effectiveInvoiceLines, payments) ??
    getBillingDetail("invoice-coco-260501", effectiveInvoices, effectiveInvoiceLines, payments);
  const baseEncounterId = baseDetail?.encounter.id;
  const baseEncounterWorkspaceId = baseDetail?.encounter.workspaceId;
  const baseInvoiceId = baseDetail?.invoice.id;
  const baseInvoiceWorkspaceId = baseDetail?.invoice.workspaceId;
  useEffect(() => {
    if (!baseEncounterId || !baseEncounterWorkspaceId) return;
    const encounterId = baseEncounterId;
    const workspaceId = baseEncounterWorkspaceId;
    let cancelled = false;

    async function loadPersistedCandidates() {
      const result = await loadBillingInvoiceCandidates({
        actorHeaders,
        encounterId,
        workspaceId,
      });

      if (cancelled || !result.ok) return;
      setPersistedCandidates({
        candidates: result.candidates,
        encounterId,
      });
    }

    void loadPersistedCandidates();

    return () => {
      cancelled = true;
    };
  }, [actorHeaders, baseEncounterId, baseEncounterWorkspaceId]);
  useEffect(() => {
    if (!baseInvoiceId || !baseInvoiceWorkspaceId) return;
    const invoiceId = baseInvoiceId;
    const workspaceId = baseInvoiceWorkspaceId;
    let cancelled = false;

    async function loadPersistedInvoiceLines() {
      const result = await loadBillingInvoiceLines({
        actorHeaders,
        invoiceId,
        workspaceId,
      });

      if (cancelled || !result.ok) return;
      applyInvoiceSnapshot(result.invoice, result.lines);
    }

    void loadPersistedInvoiceLines();

    return () => {
      cancelled = true;
    };
  }, [actorHeaders, applyInvoiceSnapshot, baseInvoiceId, baseInvoiceWorkspaceId]);
  useEffect(() => {
    if (!baseInvoiceId || !baseInvoiceWorkspaceId) return;
    const invoiceId = baseInvoiceId;
    const workspaceId = baseInvoiceWorkspaceId;
    let cancelled = false;

    async function loadPersistedPaymentStatus() {
      const result = await loadBillingPaymentStatus({
        actorHeaders,
        invoiceId,
        workspaceId,
      });

      if (cancelled || !result.ok) return;
      applyPaymentStatusSnapshot(result.invoice, result.payments);
    }

    void loadPersistedPaymentStatus();

    return () => {
      cancelled = true;
    };
  }, [actorHeaders, applyPaymentStatusSnapshot, baseInvoiceId, baseInvoiceWorkspaceId]);
  const groups = useMemo(
    () => getBillingGuardianGroups(effectiveInvoices, effectiveInvoiceLines, payments),
    [effectiveInvoiceLines, effectiveInvoices, payments]
  );

  return {
    detail,
    groups,
    invoices: effectiveInvoices,
    queryInvoiceId,
    selectedInvoiceId,
  };
}

function getBillingBalance(detail: BillingDetail) {
  return Math.max(0, detail.invoice.totalAmount - detail.paidAmount);
}

function QueueItem({
  onSelect,
  row,
  selected,
}: {
  onSelect: () => void;
  row: BillingQueueRow;
  selected: boolean;
}) {
  const balance = Math.max(0, row.invoice.totalAmount - row.paidAmount);

  return (
    <EmrSidePanelCard
      selected={selected}
      selectionVariant="modulePanel"
      testId={`billing-queue-item-${row.invoice.id}`}
      onSelect={onSelect}
    >
      <div className="flex min-h-6 items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold leading-5 text-[var(--emr-text-primary)]">
            {row.patient?.name ?? "환자 미상"} · {row.invoice.invoiceNo}
          </div>
          <div className="truncate text-[12px] font-medium leading-4 tracking-[0.3px] text-[var(--emr-text-secondary)]">
            {row.guardian?.name ?? "보호자 미지정"} · {row.encounter.encounterNo}
          </div>
        </div>
        <EmrRowActionMenu
          ariaLabel={`${row.patient?.name ?? "환자 미상"} ${row.invoice.invoiceNo} 수납 작업`}
          contentClassName="w-52"
          items={[
            {
              key: "open",
              label: "수납 상세 보기",
              description: "현재 청구서 열기",
              onSelect,
            },
          ]}
          testId={`billing-queue-action-${row.invoice.id}`}
          triggerClassName={emrSidePanelCardHoverActionButtonClassName}
        />
      </div>
      <div className="mt-1 min-w-0 truncate text-[12px] leading-4 text-muted-foreground">
        {balance === 0 ? "정산 완료" : `미납 ${formatAmount(balance)}`}
      </div>
      <div className="mt-2 flex min-h-5 items-center justify-between gap-2 border-t border-[var(--emr-line-hairline)] pt-1.5 text-[11px] text-muted-foreground">
        <span>{formatShortDateTime(row.invoice.issuedAt ?? row.invoice.createdAt)}</span>
        <span>{formatAmount(row.invoice.totalAmount)}</span>
      </div>
    </EmrSidePanelCard>
  );
}

export function BillingSidePanel({ moduleLabel }: ShellComponentProps) {
  const invoices = useBillingStore((state) => state.invoices);
  const payments = useBillingStore((state) => state.payments);
  const selectedInvoiceId = useBillingStore((state) => state.selectedInvoiceId);
  const selectInvoice = useBillingStore((state) => state.selectInvoice);
  const setModulePanelOpen = useLayoutStore((state) => state.setModulePanelOpen);
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<BillingFilter>>(() => new Set());
  const groupedRows = useMemo(
    () =>
      billingQueueGroups.map((group) => ({
        ...group,
        rows: getBillingQueueRows(invoices, payments, group.value),
      })),
    [invoices, payments]
  );
  const totalRowCount = groupedRows.reduce((total, group) => total + group.rows.length, 0);
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
      <EmrDateNavigator dateLabel="26.05.01 (금)" todayLabel="오늘" />
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
  label,
  rows,
  selectedInvoiceId,
  onSelectInvoice,
  onToggle,
}: {
  collapsed: boolean;
  colorToken: string;
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
          row={row}
          selected={row.invoice.id === selectedInvoiceId}
          onSelect={() => onSelectInvoice(row.invoice.id)}
        />
      ))}
    </EmrSidePanelCollapsibleGroup>
  );
}

export function BillingHeader({ hasRightPanel }: ShellComponentProps) {
  const { detail } = useBillingWorkspaceData();
  const rightPanelOpen = useLayoutStore((state) => state.rightPanelOpen);
  const setRightPanelOpen = useLayoutStore((state) => state.setRightPanelOpen);

  if (!detail) return null;

  return (
    <EmrPatientContextBar
      patientItems={[
        { label: "환자", value: detail.patient?.name ?? "환자 미상" },
        { label: "보호자", value: detail.guardian?.name ?? "보호자 미지정" },
        { label: "품종", value: detail.patient ? detail.patient.breed ?? getSpeciesLabel(detail.patient) : "-" },
        { label: "나이", value: detail.patient ? getPatientDisplayAge(detail.patient) : "-" },
        { label: "성별", value: detail.patient ? getPatientSexLabel(detail.patient) : "-" },
      ]}
      memoActions={[
        { label: "방문목적" },
        { label: "보호자메모", locked: true },
        { label: "수납메모" },
      ]}
      trailingItems={[
        { label: "청구서", value: detail.invoice.invoiceNo },
        { label: "상태", value: getInvoiceStatusLabel(detail.invoice.status) },
      ]}
      rightPanelToggleLabel="수납 요약"
      rightPanelDisabled={!hasRightPanel}
      rightPanelOpen={rightPanelOpen}
      onToggleRightPanel={() => setRightPanelOpen(!rightPanelOpen)}
    />
  );
}

function BillingTitleCard({ detail }: { detail: BillingDetail }) {
  const balance = getBillingBalance(detail);
  const flowLabel = getBillingFlowLabel(detail.invoiceLines);

  return (
    <section className="rounded-lg border bg-card px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[18px] font-semibold leading-[26px]">수납</h1>
            <EmrStatusBadge label={getInvoiceStatusLabel(detail.invoice.status)} marker="none" />
          </div>
          <div className="mt-1 text-[13px] text-muted-foreground">
            {detail.invoice.invoiceNo} · {detail.patient?.name ?? "환자 미상"} ·{" "}
            {detail.guardian?.name ?? "보호자 미지정"} · {detail.encounter.encounterNo}
          </div>
          <div className="mt-2 text-[13px] font-medium text-[var(--emr-text-secondary)]">
            {flowLabel} 항목을 보호자 {detail.guardian?.name ?? "보호자"}에게 안내합니다.
          </div>
        </div>
        <div className="text-right">
          <div className="text-[20px] font-semibold">{formatAmount(detail.invoice.totalAmount)}</div>
          <div className="text-[12px] text-muted-foreground">
            {balance === 0 ? "정산 완료" : `미납 ${formatAmount(balance)}`}
          </div>
        </div>
      </div>
    </section>
  );
}

function GuardianGroups({
  groups,
  selectedGuardianId,
}: {
  groups: BillingGuardianGroup[];
  selectedGuardianId?: string;
}) {
  return (
    <section className="rounded-lg border bg-card">
      <div className="flex h-11 items-center justify-between border-b px-4">
        <h2 className="text-[14px] font-semibold">보호자 청구 묶음</h2>
        <Badge variant="secondary">{groups.length}</Badge>
      </div>
      <div className="grid gap-3 p-4 md:grid-cols-3">
        {groups.map((group) => {
          const active = group.guardian.id === selectedGuardianId;

          return (
            <div
              key={group.guardian.id}
              className={cn(
                "rounded-md border bg-card p-3",
                active && "border-[var(--emr-state-selected-border)] bg-[var(--emr-state-selected)]"
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium">{group.guardian.name}</div>
                <Badge variant="outline">{group.invoices.length}건</Badge>
              </div>
              <div className="mt-2 truncate text-[12px] text-muted-foreground">
                {group.patients.map((patient) => patient.name).join(", ")}
              </div>
              <div className="mt-3 text-[15px] font-semibold">{formatAmount(group.totalDueAmount)}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function CombinePanel({
  group,
  selectedInvoiceIds,
  combinedInvoiceIds,
  onClear,
  onCombine,
  onToggle,
}: {
  combinedInvoiceIds: string[];
  group?: BillingGuardianGroup;
  onClear: () => void;
  onCombine: () => void;
  onToggle: (invoiceId: string) => void;
  selectedInvoiceIds: string[];
}) {
  return (
    <section className="rounded-lg border bg-card">
      <div className="flex h-11 items-center justify-between border-b px-4">
        <h2 className="text-[14px] font-semibold">합산/해제</h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onCombine}>합산</Button>
          <Button size="sm" variant="outline" onClick={onClear}>합산 해제</Button>
        </div>
      </div>
      <div className="divide-y">
        {(group?.invoices ?? []).map((invoice) => (
          <label
            key={invoice.id}
            className="flex cursor-pointer items-center gap-3 px-4 py-3 text-[13px]"
          >
            <Checkbox
              aria-label={`${invoice.invoiceNo} 합산 선택`}
              checked={selectedInvoiceIds.includes(invoice.id)}
              onClick={(event) => {
                event.preventDefault();
                onToggle(invoice.id);
              }}
            />
            <span className="font-medium">{invoice.invoiceNo}</span>
            <span className="text-muted-foreground">{getInvoiceStatusLabel(invoice.status)}</span>
            <span className="ml-auto font-semibold">{formatAmount(invoice.totalAmount)}</span>
          </label>
        ))}
      </div>
      <div className="border-t px-4 py-3 text-[12px] text-muted-foreground">
        합산 대상 {selectedInvoiceIds.length}건 · 적용 {combinedInvoiceIds.length}건
      </div>
    </section>
  );
}

function InvoiceLinesTable({
  lines,
  persistenceState,
  totalAmount,
  onUpdateQuantity,
}: {
  lines: InvoiceLine[];
  persistenceState: "idle" | "saving" | "saved" | "error";
  totalAmount: number;
  onUpdateQuantity: (lineId: string, quantity: number) => void;
}) {
  const sortedLines = sortInvoiceLinesForDemoFlow(lines);
  const flowLabel = getBillingFlowLabel(lines);

  return (
    <section className="rounded-lg border bg-card">
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-2 border-b px-4 py-2">
        <div>
          <h2 className="text-[14px] font-semibold">청구 항목 편집</h2>
          <div className="mt-1 text-[12px] text-muted-foreground">
            {flowLabel} 항목이 오늘 수납액 {formatAmount(totalAmount)}으로 묶입니다.
          </div>
        </div>
        <Badge variant={persistenceState === "error" ? "destructive" : "secondary"}>
          {persistenceState === "saving"
            ? "저장 중"
            : persistenceState === "saved"
              ? "저장됨"
              : persistenceState === "error"
                ? "저장 실패"
                : sortedLines.length}
        </Badge>
      </div>
      <BillingScopeNotice>
        실제 할인 정책, 영수증, VAT, 부분 결제 연동 없이 현재 청구 항목 수량과 청구 확정만 저장합니다.
      </BillingScopeNotice>
      <div className="overflow-x-auto">
        <Table className="min-w-[720px] table-fixed text-[13px]">
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className={billingInvoiceLineColumns.category}>업무</TableHead>
              <TableHead className={billingInvoiceLineColumns.description}>항목</TableHead>
              <TableHead className={cn(billingInvoiceLineColumns.unitPrice, billingAmountCellClassName)}>
                단가
              </TableHead>
              <TableHead className={cn(billingInvoiceLineColumns.quantity, "text-center")}>
                수량
              </TableHead>
              <TableHead className={cn(billingInvoiceLineColumns.discount, billingAmountCellClassName)}>
                할인
              </TableHead>
              <TableHead className={cn(billingInvoiceLineColumns.lineTotal, billingAmountCellClassName)}>
                청구금액
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedLines.map((line) => (
              <TableRow key={line.id}>
                <TableCell className={billingInvoiceLineColumns.category}>
                  <Badge variant="outline">{getBillingLineCategory(line)}</Badge>
                </TableCell>
                <TableCell className={cn(billingInvoiceLineColumns.description, "truncate font-medium")}>
                  {line.description}
                </TableCell>
                <TableCell className={billingAmountCellClassName}>{formatAmount(line.unitPrice)}</TableCell>
                <TableCell className={billingInvoiceLineColumns.quantity}>
                  <Input
                    aria-label={`${line.description} 수량`}
                    className="mx-auto h-8 w-16 text-right tabular-nums"
                    inputMode="numeric"
                    type="number"
                    value={line.quantity}
                    onChange={(event) => onUpdateQuantity(line.id, Number(event.target.value))}
                  />
                </TableCell>
                <TableCell className={cn(billingAmountCellClassName, "text-muted-foreground")}>
                  0원
                </TableCell>
                <TableCell className={cn(billingAmountCellClassName, "font-semibold")}>
                  {formatAmount(line.lineTotal)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

function BillingScopeNotice({ children }: { children: ReactNode }) {
  return (
    <div className="border-b bg-[var(--emr-status-warning-bg)] px-4 py-2 text-[12px] text-[var(--emr-status-warning-text)]">
      {children}
    </div>
  );
}

export function BillingContent() {
  const { detail, groups, invoices, queryInvoiceId, selectedInvoiceId } = useBillingWorkspaceData();
  const { session: authSession } = useAuthClient();
  const actorHeaders = useMemo(() => getDemoActorHeader(authSession), [authSession]);
  const applyInvoiceSnapshot = useBillingStore((state) => state.applyInvoiceSnapshot);
  const combinedInvoiceIds = useBillingStore((state) => state.combinedInvoiceIds);
  const selectedInvoiceIds = useBillingStore((state) => state.selectedInvoiceIds);
  const clearCombinedInvoices = useBillingStore((state) => state.clearCombinedInvoices);
  const selectInvoice = useBillingStore((state) => state.selectInvoice);
  const setCombinedInvoices = useBillingStore((state) => state.setCombinedInvoices);
  const setFilter = useBillingStore((state) => state.setFilter);
  const toggleInvoiceSelection = useBillingStore((state) => state.toggleInvoiceSelection);
  const updateInvoiceLineQuantity = useBillingStore((state) => state.updateInvoiceLineQuantity);
  const [linePersistenceState, setLinePersistenceState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    if (!queryInvoiceId || queryInvoiceId === selectedInvoiceId) return;

    const invoice = invoices.find((item) => item.id === queryInvoiceId);
    if (!invoice) return;

    selectInvoice(queryInvoiceId);
    setFilter(getBillingFilterForInvoice(invoice));
  }, [invoices, queryInvoiceId, selectInvoice, selectedInvoiceId, setFilter]);

  if (!detail) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--emr-surface-workspace)] text-[13px] text-muted-foreground">
        수납 목록에서 청구서를 선택해 주세요.
      </div>
    );
  }

  async function handleUpdateInvoiceLineQuantity(lineId: string, quantity: number) {
    if (!detail) return;
    const safeQuantity = Math.max(1, Math.round(quantity * 1000) / 1000 || 1);
    updateInvoiceLineQuantity(lineId, safeQuantity);
    setLinePersistenceState("saving");

    const result = await saveBillingInvoiceLines({
      actorHeaders,
      invoiceId: detail.invoice.id,
      lines: [{ invoiceLineId: lineId, quantity: safeQuantity }],
      workspaceId: detail.invoice.workspaceId,
    });

    if (!result.ok) {
      setLinePersistenceState("error");
      return;
    }

    applyInvoiceSnapshot(result.invoice, result.lines);
    setLinePersistenceState("saved");
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--emr-surface-workspace)]">
      <ScrollArea className="min-h-0 flex-1">
        <div className="grid gap-4 p-4">
          <BillingTitleCard detail={detail} />
          <GuardianGroups groups={groups} selectedGuardianId={detail.guardian?.id} />
          <CombinePanel
            group={detail.guardianGroup}
            selectedInvoiceIds={selectedInvoiceIds}
            combinedInvoiceIds={combinedInvoiceIds}
            onToggle={toggleInvoiceSelection}
            onCombine={setCombinedInvoices}
            onClear={clearCombinedInvoices}
          />
          <InvoiceLinesTable
            lines={detail.invoiceLines}
            persistenceState={linePersistenceState}
            totalAmount={detail.invoice.totalAmount}
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
    <div className="flex min-h-9 items-center justify-between gap-3 border-b border-[var(--emr-line-subtle)] text-[13px]">
      <span className={muted ? "text-muted-foreground" : "text-[var(--emr-text-secondary)]"}>
        {label}
      </span>
      <span
        className={cn(
          "text-right font-medium",
          emphasis && "text-primary",
          muted && "text-muted-foreground"
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
  const approvedPayment = payments.find((payment) => payment.status === "approved");
  const approvedPaymentLabel = approvedPayment ? getStatusLabel("payment", approvedPayment.status) : "승인";
  const isPaid = invoiceStatus === "paid" || balance === 0;

  return (
    <div className="rounded-md border bg-[var(--emr-surface-muted)] px-3 py-2">
      <div className="text-[13px] font-semibold">
        {isPaid ? "세션 내 수납 완료" : "보호자 안내 후 수납 완료 처리"}
      </div>
      <div className="mt-1 text-[12px] leading-5 text-muted-foreground">
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
  const actorHeaders = useMemo(() => getDemoActorHeader(authSession), [authSession]);
  const applyInvoiceSnapshot = useBillingStore((state) => state.applyInvoiceSnapshot);
  const applyPaymentStatusSnapshot = useBillingStore((state) => state.applyPaymentStatusSnapshot);
  const paymentMethod = useBillingStore((state) => state.paymentMethod);
  const setPaymentMethod = useBillingStore((state) => state.setPaymentMethod);
  const [confirmationState, setConfirmationState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [paymentState, setPaymentState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [paymentFailureContext, setPaymentFailureContext] =
    useState<BillingPaymentFailureContext | null>(null);
  const [pendingFinancialAction, setPendingFinancialAction] =
    useState<BillingFinancialAction | null>(null);

  if (!detail) return null;

  const balance = getBillingBalance(detail);
  const statusLabel = getInvoiceStatusLabel(detail.invoice.status);
  const handleIssueInvoice = async () => {
    setConfirmationState("saving");
    const result = await saveBillingInvoiceLines({
      actorHeaders,
      confirmBilling: true,
      invoiceId: detail.invoice.id,
      lines: detail.invoiceLines.map((line) => ({
        invoiceLineId: line.id,
        quantity: line.quantity,
      })),
      workspaceId: detail.invoice.workspaceId,
    });

    if (!result.ok) {
      setConfirmationState("error");
      return false;
    }

    applyInvoiceSnapshot(result.invoice, result.lines);
    setConfirmationState("saved");
    return true;
  };
  const handlePaymentMethodChange = async (nextPaymentMethod: PaymentMethod) => {
    setPaymentMethod(nextPaymentMethod);
    setPaymentState("saving");
    const result = await saveBillingPaymentStatus({
      action: "select_payment_method",
      actorHeaders,
      invoiceId: detail.invoice.id,
      paymentMethod: nextPaymentMethod,
      workspaceId: detail.invoice.workspaceId,
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
    setPaymentState("saving");
    const result = await saveBillingPaymentStatus({
      action: "mark_unpaid",
      actorHeaders,
      invoiceId: detail.invoice.id,
      paymentMethod,
      unpaidReason: "owner_will_pay_later",
      workspaceId: detail.invoice.workspaceId,
    });

    if (!result.ok) {
      setPaymentFailureContext("mark_unpaid");
      setPaymentState("error");
      return false;
    }

    applyPaymentStatusSnapshot(result.invoice, result.payments);
    setPaymentFailureContext(null);
    setPaymentState("saved");
    return true;
  };
  const handleMarkPaid = async () => {
    setPaymentState("saving");
    const result = await saveBillingPaymentStatus({
      action: "complete_payment",
      actorHeaders,
      invoiceId: detail.invoice.id,
      paymentMethod,
      workspaceId: detail.invoice.workspaceId,
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
      <div className="flex h-[50px] shrink-0 items-center justify-between border-b px-4">
        <h2 className="text-[14px] font-semibold">수납 요약</h2>
        <EmrStatusBadge label={statusLabel} marker="none" />
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="px-4 py-3">
          <div className="text-[12px] text-muted-foreground">{detail.invoice.invoiceNo}</div>
          <div className="mt-1 text-[18px] font-semibold">{formatAmount(detail.invoice.totalAmount)}</div>
          <div className="mt-1 text-[12px] text-muted-foreground">
            {getInvoiceStatusDescription(detail.invoice.status, balance)}
          </div>

          <div className="mt-4">
            <SummaryLine label="청구액" value={formatAmount(detail.invoice.totalAmount)} emphasis />
            <SummaryLine label="수납액" value={formatAmount(detail.paidAmount)} emphasis={detail.paidAmount > 0} />
            <SummaryLine label="미납액" value={formatAmount(balance)} emphasis={balance > 0} />
            <SummaryLine label="할인" value={formatAmount(detail.invoice.discountAmount)} />
            <SummaryLine label="발행" value={formatShortDateTime(detail.invoice.issuedAt)} />
          </div>

          <div className="mt-5 text-[13px] font-semibold">읽기 전용 수납 정보</div>
          <div className="mt-2 rounded-md border bg-[var(--emr-surface-muted)] px-3">
            <SummaryLine label="영수증 금액" value="미연동" muted />
            <SummaryLine label="VAT 세부" value={formatAmount(detail.invoice.taxAmount)} muted />
            <SummaryLine label="부분 결제 입력" value="미지원" muted />
          </div>

          <div className="mt-5 text-[13px] font-semibold">결제 수단</div>
          <div className="mt-2">
            <PaymentMethodControl
              paymentMethod={paymentMethod}
              onPaymentMethodChange={handlePaymentMethodChange}
            />
          </div>

          <div className="mt-4">
            <PaymentStatusNote
              balance={balance}
              invoiceStatus={detail.invoice.status}
              paidAmount={detail.paidAmount}
              payments={detail.payments}
            />
          </div>
          {confirmationState === "error" ? (
            <BillingPaymentErrorMessage
              title="청구 확정이 저장되지 않았어"
              actionLabel="청구 확정 다시 시도"
              onRetry={() => setPendingFinancialAction("issue_invoice")}
            >
              금액과 항목은 화면에 남아 있지만 서버 저장은 완료되지 않았어. 실제 PG, VAT, 영수증
              연동은 아직 없는 MVP 범위야.
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
                  paymentFailureContext === "mark_unpaid" ? "mark_unpaid" : "mark_paid"
                );
              }}
            >
              수납 상태는 아직 확정되지 않았어. 결제 수단과 금액을 확인한 뒤 다시 시도해.
            </BillingPaymentErrorMessage>
          ) : null}
        </div>
      </ScrollArea>
      <BillingPaymentActionFooter
        confirmationState={confirmationState}
        paymentState={paymentState}
        onIssueInvoice={() => setPendingFinancialAction("issue_invoice")}
        onMarkPaid={() => setPendingFinancialAction("mark_paid")}
        onMarkUnpaid={() => setPendingFinancialAction("mark_unpaid")}
      />
      <BillingFinancialPreflightDialog
        action={pendingFinancialAction}
        balance={balance}
        detail={detail}
        paymentMethod={paymentMethod}
        confirmationState={confirmationState}
        paymentState={paymentState}
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
      className="mt-3 text-[12px]"
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
  paymentMethod,
  paymentState,
}: {
  action: BillingFinancialAction | null;
  balance: number;
  confirmationState: "idle" | "saving" | "saved" | "error";
  detail: BillingDetail;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  paymentMethod: PaymentMethod;
  paymentState: "idle" | "saving" | "saved" | "error";
}) {
  const isIssueAction = action === "issue_invoice";
  const isSaving = isIssueAction ? confirmationState === "saving" : paymentState === "saving";
  const amount = isIssueAction ? detail.invoice.totalAmount : balance;
  const lineCount = detail.invoiceLines.length;
  const dialogTitle =
    action === "issue_invoice"
      ? "청구 확정 전 확인"
      : action === "mark_unpaid"
        ? "미납 처리 전 확인"
        : "수납 완료 전 확인";
  const primaryLabel =
    action === "issue_invoice"
      ? "청구 확정 저장"
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
    action === "issue_invoice" ? "청구확정" : action === "mark_unpaid" ? "미납" : "수납완료";

  return (
    <Dialog open={action !== null} onOpenChange={onOpenChange}>
      <EmrDialogShell
        variant="confirm"
        title={dialogTitle}
        description="금액 상태가 바뀌는 financial CTA라서 저장 전에 보호자, 청구서, 금액, MVP 경계를 확인해."
        footerMeta="실제 PG, VAT, 영수증, 환불, 정산 연동은 이번 MVP 범위 밖이야."
        primaryAction={
          <Button type="button" size="sm" disabled={isSaving} onClick={onConfirm}>
            {isSaving ? savingLabel : primaryLabel}
          </Button>
        }
        secondaryAction={
          <Button type="button" size="sm" variant="outline" disabled={isSaving} onClick={() => onOpenChange(false)}>
            취소
          </Button>
        }
      >
        <div className="grid gap-2 rounded-md border bg-[var(--emr-surface-muted)] px-3 py-2">
          <BillingPreflightLine label="청구서" value={detail.invoice.invoiceNo} />
          <BillingPreflightLine
            label="보호자 / 환자"
            value={`${detail.guardian?.name ?? "보호자 미지정"} / ${detail.patient?.name ?? "환자 미상"}`}
          />
          <BillingPreflightLine label="청구 항목" value={`${lineCount}건`} />
          <BillingPreflightLine label="확인 금액" value={formatAmount(amount)} emphasis />
          <BillingPreflightLine label="결제 수단" value={getBillingPaymentMethodLabel(paymentMethod)} />
          <BillingPreflightLine label="변경 후 상태" value={nextStateLabel} emphasis />
        </div>
        <EmrInlineAlert
          severity="warning"
          title="저장 실패 시 상태는 확정되지 않아"
          className="mt-3 text-[12px]"
        >
          실패하면 이 패널에 다시 시도 안내를 남기고, 실제 결제나 영수증 발행이 된 것처럼 표시하지 않아.
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
    <div className="flex min-h-7 items-center justify-between gap-3 text-[12px]">
      <span className="text-[var(--emr-text-tertiary)]">{label}</span>
      <span className={cn("text-right font-medium", emphasis && "text-primary")}>{value}</span>
    </div>
  );
}

function BillingPaymentActionFooter({
  confirmationState,
  paymentState,
  onIssueInvoice,
  onMarkPaid,
  onMarkUnpaid,
}: {
  confirmationState: "idle" | "saving" | "saved" | "error";
  paymentState: "idle" | "saving" | "saved" | "error";
  onIssueInvoice: () => void;
  onMarkPaid: () => void;
  onMarkUnpaid: () => void;
}) {
  return (
    <div className="grid shrink-0 grid-cols-2 gap-2 border-t p-4">
      <Button
        size="sm"
        variant="outline"
        disabled={paymentState === "saving"}
        onClick={onMarkUnpaid}
      >
        미납 처리
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={confirmationState === "saving"}
        onClick={onIssueInvoice}
      >
        {confirmationState === "saving" ? "확정 중" : confirmationState === "saved" ? "확정됨" : "청구 확정"}
      </Button>
      <Button
        className="col-span-2"
        size="sm"
        disabled={paymentState === "saving"}
        onClick={onMarkPaid}
      >
        {paymentState === "saving" ? "저장 중" : "수납 완료"}
      </Button>
    </div>
  );
}
