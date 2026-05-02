"use client";

import { useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { CdsActionsListFilterIcon } from "@/components/cds-icons/actions-and-controls";
import { CdsUtilitiesSortIcon } from "@/components/cds-icons/utilities-and-misc";
import {
  EmrListHeader,
  EmrListHeaderIconButton,
  EmrListItem,
  EmrSubpanel,
  EmrSubpanelBody,
  EmrSubpanelTitle,
} from "@/components/emr/subpanel";
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
  type BillingGuardianGroup,
  type BillingQueueRow,
} from "@/features/billing/data";
import { useBillingStore, type BillingFilter } from "@/features/billing/store";
import { getStatusLabel } from "@/lib/emr-domain/status-labels";
import { getDemoScenarioFromParams } from "@/lib/emr-domain/demo-scenarios";
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
  dateTime ? dateTime.slice(2, 16).replace("T", " ") : "-";

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
        title={`${row.patient?.name ?? "환자 미상"} · ${row.invoice.invoiceNo}`}
        subtitle={`${row.guardian?.name ?? "보호자 미지정"} · ${row.encounter.encounterNo}`}
        meta={formatAmount(balance)}
        itemBadge={<Badge variant="outline">{getInvoiceStatusLabel(row.invoice.status)}</Badge>}
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
      />
      <div className="border-b px-3 py-2">
        <SegmentedControl
          aria-label="수납 목록 필터"
          value={filter}
          items={filterItems.map((item) => ({ ...item, count: counts[item.value] }))}
          variant="tabs"
          className="w-full"
          itemClassName="flex-1"
          onValueChange={setFilter}
        />
      </div>
      <EmrListHeader
        label={filterItems.find((item) => item.value === filter)?.label ?? "수납"}
        count={rows.length}
        headerActions={
          <>
            <EmrListHeaderIconButton ariaLabel="정렬">
              <CdsUtilitiesSortIcon className="size-4" />
            </EmrListHeaderIconButton>
            <EmrListHeaderIconButton ariaLabel="필터">
              <CdsActionsListFilterIcon className="size-4" />
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

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="text-[12px] font-medium text-muted-foreground">{label}</div>
      <div className="mt-2 truncate text-[16px] font-semibold">{value}</div>
    </div>
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
        {groups.map((group) => (
          <div
            key={group.guardian.id}
            className={[
              "rounded-md border bg-[var(--clair-color-background-surface)] p-3",
              group.guardian.id === selectedGuardianId
                ? "border-[var(--clair-color-atomic-sky-300)] bg-[var(--clair-color-atomic-sky-50)]"
                : "",
            ].join(" ")}
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
        ))}
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
      <Table>
        <TableHeader className="bg-[var(--clair-color-atomic-neutral-50)]">
          <TableRow>
            <TableHead>업무</TableHead>
            <TableHead>항목</TableHead>
            <TableHead>수량</TableHead>
            <TableHead>단가</TableHead>
            <TableHead>금액</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedLines.map((line) => (
            <TableRow key={line.id}>
              <TableCell>
                <Badge variant="outline">{getBillingLineCategory(line)}</Badge>
              </TableCell>
              <TableCell className="font-medium">{line.description}</TableCell>
              <TableCell>
                <Input
                  aria-label={`${line.description} 수량`}
                  className="h-8 w-20"
                  inputMode="numeric"
                  type="number"
                  value={line.quantity}
                  onChange={(event) => onUpdateQuantity(line.id, Number(event.target.value))}
                />
              </TableCell>
              <TableCell>{formatAmount(line.unitPrice)}</TableCell>
              <TableCell className="font-semibold">{formatAmount(line.lineTotal)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}

function PaymentPanel({
  balance,
  invoiceStatus,
  paidAmount,
  payments,
  paymentMethod,
  onIssue,
  onMarkPaid,
  onMarkUnpaid,
  onPaymentMethodChange,
}: {
  balance: number;
  invoiceStatus: InvoiceStatus;
  onIssue: () => void;
  onMarkPaid: () => void;
  onMarkUnpaid: () => void;
  onPaymentMethodChange: (paymentMethod: PaymentMethod) => void;
  paidAmount: number;
  payments: Payment[];
  paymentMethod: PaymentMethod;
}) {
  const approvedPayment = payments.find((payment) => payment.status === "approved");
  const approvedPaymentLabel = approvedPayment ? getStatusLabel("payment", approvedPayment.status) : "승인";
  const isPaid = invoiceStatus === "paid" || balance === 0;

  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[14px] font-semibold">수납 처리</h2>
          <div className="mt-1 text-[12px] text-muted-foreground">
            {isPaid ? "정산 완료" : `미납액 ${formatAmount(balance)}`}
          </div>
        </div>
        <SegmentedControl
          aria-label="결제 수단 선택"
          value={paymentMethod}
          items={paymentMethodItems}
          variant="tabs"
          onValueChange={onPaymentMethodChange}
        />
      </div>
      <div className="mt-4 rounded-md border bg-[var(--clair-color-background-surface)] px-3 py-2">
        <div className="text-[13px] font-semibold">
          {isPaid ? "세션 내 수납 완료" : "보호자 안내 후 수납 완료 처리"}
        </div>
        <div className="mt-1 text-[12px] text-muted-foreground">
          {isPaid
            ? `${formatAmount(paidAmount)} ${approvedPaymentLabel} 상태로 기록되었습니다.`
            : "실제 PG, 현금영수증, 영수증 출력 연동 없이 데모 세션에서만 상태를 변경합니다."}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={onIssue}>청구 확정</Button>
        <Button size="sm" variant="outline" onClick={onMarkUnpaid}>미납 처리</Button>
        <Button size="sm" onClick={onMarkPaid}>수납 완료</Button>
      </div>
    </section>
  );
}

export function BillingContent() {
  const searchParams = useSearchParams();
  const combinedInvoiceIds = useBillingStore((state) => state.combinedInvoiceIds);
  const invoiceLines = useBillingStore((state) => state.invoiceLines);
  const invoices = useBillingStore((state) => state.invoices);
  const paymentMethod = useBillingStore((state) => state.paymentMethod);
  const payments = useBillingStore((state) => state.payments);
  const selectedInvoiceId = useBillingStore((state) => state.selectedInvoiceId);
  const selectedInvoiceIds = useBillingStore((state) => state.selectedInvoiceIds);
  const clearCombinedInvoices = useBillingStore((state) => state.clearCombinedInvoices);
  const issueSelectedInvoice = useBillingStore((state) => state.issueSelectedInvoice);
  const markSelectedInvoicePaid = useBillingStore((state) => state.markSelectedInvoicePaid);
  const markSelectedInvoiceUnpaid = useBillingStore((state) => state.markSelectedInvoiceUnpaid);
  const setCombinedInvoices = useBillingStore((state) => state.setCombinedInvoices);
  const setPaymentMethod = useBillingStore((state) => state.setPaymentMethod);
  const toggleInvoiceSelection = useBillingStore((state) => state.toggleInvoiceSelection);
  const updateInvoiceLineQuantity = useBillingStore((state) => state.updateInvoiceLineQuantity);
  const selectInvoice = useBillingStore((state) => state.selectInvoice);
  const setFilter = useBillingStore((state) => state.setFilter);
  const scenario = getDemoScenarioFromParams(searchParams);
  const queryInvoiceId = searchParams.get("invoiceId") ?? scenario?.invoiceId;
  const effectiveInvoiceId = queryInvoiceId ?? selectedInvoiceId;
  const detail = getBillingDetail(effectiveInvoiceId, invoices, invoiceLines, payments)
    ?? getBillingDetail("invoice-coco-260501", invoices, invoiceLines, payments);
  const groups = useMemo(
    () => getBillingGuardianGroups(invoices, invoiceLines, payments),
    [invoiceLines, invoices, payments]
  );

  useEffect(() => {
    if (!queryInvoiceId || queryInvoiceId === selectedInvoiceId) return;

    const invoice = invoices.find((item) => item.id === queryInvoiceId);
    if (!invoice) return;

    selectInvoice(queryInvoiceId);
    setFilter(getBillingFilterForInvoice(invoice));
  }, [invoices, queryInvoiceId, selectInvoice, selectedInvoiceId, setFilter]);

  if (!detail) {
    return (
      <div className="flex h-full items-center justify-center text-[13px] text-muted-foreground">
        수납 목록에서 청구서를 선택해 주세요.
      </div>
    );
  }

  const balance = Math.max(0, detail.invoice.totalAmount - detail.paidAmount);
  const flowLabel = getBillingFlowLabel(detail.invoiceLines);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--clair-color-background-normal)]">
      <section className="border-b bg-card px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[20px] font-semibold leading-7">수납</h1>
              <Badge>{getInvoiceStatusLabel(detail.invoice.status)}</Badge>
            </div>
            <div className="mt-1 text-[13px] text-muted-foreground">
              {detail.invoice.invoiceNo} · {detail.patient?.name ?? "환자 미상"} ·{" "}
              {detail.guardian?.name ?? "보호자 미지정"} · {detail.encounter.encounterNo}
            </div>
            <div className="mt-2 text-[13px] font-medium text-[var(--clair-color-label-strong)]">
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
      <ScrollArea className="min-h-0 flex-1">
        <div className="grid gap-4 p-5">
          <div className="grid gap-3 md:grid-cols-4">
            <SummaryCard label="청구액" value={formatAmount(detail.invoice.totalAmount)} />
            <SummaryCard label="수납액" value={formatAmount(detail.paidAmount)} />
            <SummaryCard label="할인" value={formatAmount(detail.invoice.discountAmount)} />
            <SummaryCard label="발행" value={formatShortDateTime(detail.invoice.issuedAt)} />
          </div>
          <section className="rounded-lg border bg-card px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-[14px] font-semibold">오늘 수납 상태</h2>
                <div className="mt-1 text-[12px] text-muted-foreground">
                  {getInvoiceStatusDescription(detail.invoice.status, balance)}
                </div>
              </div>
              <div className="text-right">
                <Badge variant="outline">{getInvoiceStatusLabel(detail.invoice.status)}</Badge>
                <div className="mt-1 text-[12px] font-semibold">{formatAmount(detail.invoice.totalAmount)}</div>
              </div>
            </div>
          </section>
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
          <PaymentPanel
            balance={balance}
            invoiceStatus={detail.invoice.status}
            paidAmount={detail.paidAmount}
            payments={detail.payments}
            paymentMethod={paymentMethod}
            onIssue={issueSelectedInvoice}
            onMarkUnpaid={markSelectedInvoiceUnpaid}
            onMarkPaid={markSelectedInvoicePaid}
            onPaymentMethodChange={setPaymentMethod}
          />
        </div>
      </ScrollArea>
    </div>
  );
}
