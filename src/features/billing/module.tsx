"use client";

import { useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  CdsActionsListFilterIcon,
  CdsActionsSearchIcon,
} from "@/components/cds-icons/actions-and-controls";
import { CdsUtilitiesSortIcon } from "@/components/cds-icons/utilities-and-misc";
import { EmrPatientContextBar } from "@/components/emr/patient-context-bar";
import {
  EmrListHeader,
  EmrListHeaderIconButton,
  EmrListItem,
  EmrSubpanel,
  EmrSubpanelBody,
  EmrSubpanelTitle,
} from "@/components/emr/subpanel";
import { EmrStatusBadge } from "@/components/emr/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

const filterItems: Array<{ label: string; value: BillingFilter }> = [
  { label: "대기", value: "waiting" },
  { label: "미납", value: "unpaid" },
  { label: "종료", value: "closed" },
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

function useBillingWorkspaceData() {
  const searchParams = useSearchParams();
  const invoiceLines = useBillingStore((state) => state.invoiceLines);
  const invoices = useBillingStore((state) => state.invoices);
  const payments = useBillingStore((state) => state.payments);
  const selectedInvoiceId = useBillingStore((state) => state.selectedInvoiceId);
  const scenario = getDemoScenarioFromParams(searchParams);
  const queryInvoiceId = searchParams.get("invoiceId") ?? scenario?.invoiceId;
  const effectiveInvoiceId = queryInvoiceId ?? selectedInvoiceId;
  const detail =
    getBillingDetail(effectiveInvoiceId, invoices, invoiceLines, payments) ??
    getBillingDetail("invoice-coco-260501", invoices, invoiceLines, payments);
  const groups = useMemo(
    () => getBillingGuardianGroups(invoices, invoiceLines, payments),
    [invoiceLines, invoices, payments]
  );

  return {
    detail,
    groups,
    invoices,
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
    <div data-testid={`billing-queue-item-${row.invoice.id}`}>
      <EmrListItem
        selected={selected}
        variant="outline"
        className={
          selected
            ? "border-[var(--clair-color-atomic-sky-200)] bg-[var(--clair-color-atomic-sky-50)] shadow-xs hover:bg-[var(--clair-color-atomic-sky-50)]"
            : undefined
        }
        title={`${row.patient?.name ?? "환자 미상"} · ${row.invoice.invoiceNo}`}
        subtitle={`${row.guardian?.name ?? "보호자 미지정"} · ${row.encounter.encounterNo}`}
        meta={balance === 0 ? "정산 완료" : `미납 ${formatAmount(balance)}`}
        itemBadge={<EmrStatusBadge label={getInvoiceStatusLabel(row.invoice.status)} marker="none" />}
        footer={
          <>
            <span>{formatShortDateTime(row.invoice.issuedAt ?? row.invoice.createdAt)}</span>
            <span>{formatAmount(row.invoice.totalAmount)}</span>
          </>
        }
        onSelect={onSelect}
      />
    </div>
  );
}

export function BillingSidePanel({ moduleLabel }: ShellComponentProps) {
  const filter = useBillingStore((state) => state.filter);
  const invoices = useBillingStore((state) => state.invoices);
  const payments = useBillingStore((state) => state.payments);
  const selectedInvoiceId = useBillingStore((state) => state.selectedInvoiceId);
  const selectInvoice = useBillingStore((state) => state.selectInvoice);
  const setFilter = useBillingStore((state) => state.setFilter);
  const setModulePanelOpen = useLayoutStore((state) => state.setModulePanelOpen);
  const rows = useMemo(
    () => getBillingQueueRows(invoices, payments, filter),
    [filter, invoices, payments]
  );
  const counts = useMemo(
    () =>
      filterItems.reduce<Record<BillingFilter, number>>(
        (next, item) => ({
          ...next,
          [item.value]: invoices.filter((invoice) => getBillingFilterForInvoice(invoice) === item.value).length,
        }),
        { waiting: 0, unpaid: 0, closed: 0 }
      ),
    [invoices]
  );

  return (
    <EmrSubpanel>
      <EmrSubpanelTitle
        title={moduleLabel}
        collapseLabel="사이드 패널 접기"
        onCollapse={() => setModulePanelOpen(false)}
        tabs={
          <SegmentedControl
            aria-label="수납 목록 필터"
            value={filter}
            items={filterItems.map((item) => ({ ...item, count: counts[item.value] }))}
            variant="tabs"
            className="shrink-0"
            onValueChange={setFilter}
          />
        }
      />
      <EmrListHeader
        label={`${filterItems.find((item) => item.value === filter)?.label ?? "수납"} 청구서`}
        count={rows.length}
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
        {rows.map((row) => (
          <QueueItem
            key={row.invoice.id}
            row={row}
            selected={row.invoice.id === selectedInvoiceId}
            onSelect={() => selectInvoice(row.invoice.id)}
          />
        ))}
      </EmrSubpanelBody>
    </EmrSubpanel>
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
  totalAmount,
  onUpdateQuantity,
}: {
  lines: InvoiceLine[];
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
        <Badge variant="secondary">{sortedLines.length}</Badge>
      </div>
      <div className="border-b bg-[var(--emr-status-warning-bg)] px-4 py-2 text-[12px] text-[var(--emr-status-warning-text)]">
        실제 할인 정책, 영수증, VAT, 부분 결제 연동 없이 현재 청구 항목 수량만 session-only로 조정합니다.
      </div>
      <Table className="table-fixed text-[13px]">
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="w-[88px]">업무</TableHead>
            <TableHead>항목</TableHead>
            <TableHead className="w-[104px] text-right">단가</TableHead>
            <TableHead className="w-[86px] text-center">수량</TableHead>
            <TableHead className="w-[96px] text-right">할인</TableHead>
            <TableHead className="w-[116px] text-right">청구금액</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedLines.map((line) => (
            <TableRow key={line.id}>
              <TableCell>
                <Badge variant="outline">{getBillingLineCategory(line)}</Badge>
              </TableCell>
              <TableCell className="font-medium">{line.description}</TableCell>
              <TableCell className="text-right">{formatAmount(line.unitPrice)}</TableCell>
              <TableCell>
                <Input
                  aria-label={`${line.description} 수량`}
                  className="mx-auto h-8 w-16 text-right"
                  inputMode="numeric"
                  type="number"
                  value={line.quantity}
                  onChange={(event) => onUpdateQuantity(line.id, Number(event.target.value))}
                />
              </TableCell>
              <TableCell className="text-right text-muted-foreground">0원</TableCell>
              <TableCell className="text-right font-semibold">{formatAmount(line.lineTotal)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}

export function BillingContent() {
  const { detail, groups, invoices, queryInvoiceId, selectedInvoiceId } = useBillingWorkspaceData();
  const combinedInvoiceIds = useBillingStore((state) => state.combinedInvoiceIds);
  const selectedInvoiceIds = useBillingStore((state) => state.selectedInvoiceIds);
  const clearCombinedInvoices = useBillingStore((state) => state.clearCombinedInvoices);
  const selectInvoice = useBillingStore((state) => state.selectInvoice);
  const setCombinedInvoices = useBillingStore((state) => state.setCombinedInvoices);
  const setFilter = useBillingStore((state) => state.setFilter);
  const toggleInvoiceSelection = useBillingStore((state) => state.toggleInvoiceSelection);
  const updateInvoiceLineQuantity = useBillingStore((state) => state.updateInvoiceLineQuantity);

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
            totalAmount={detail.invoice.totalAmount}
            onUpdateQuantity={updateInvoiceLineQuantity}
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
  const paymentMethod = useBillingStore((state) => state.paymentMethod);
  const issueSelectedInvoice = useBillingStore((state) => state.issueSelectedInvoice);
  const markSelectedInvoicePaid = useBillingStore((state) => state.markSelectedInvoicePaid);
  const markSelectedInvoiceUnpaid = useBillingStore((state) => state.markSelectedInvoiceUnpaid);
  const setPaymentMethod = useBillingStore((state) => state.setPaymentMethod);

  if (!detail) return null;

  const balance = getBillingBalance(detail);
  const statusLabel = getInvoiceStatusLabel(detail.invoice.status);

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
              onPaymentMethodChange={setPaymentMethod}
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
        </div>
      </ScrollArea>
      <div className="grid shrink-0 grid-cols-2 gap-2 border-t p-4">
        <Button size="sm" variant="outline" onClick={markSelectedInvoiceUnpaid}>미납 처리</Button>
        <Button size="sm" variant="outline" onClick={issueSelectedInvoice}>청구 확정</Button>
        <Button className="col-span-2" size="sm" onClick={markSelectedInvoicePaid}>수납 완료</Button>
      </div>
    </div>
  );
}
