"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmrEmptyState } from "@/components/emr/empty-state";
import { CloseIcon } from "@/components/icons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ChartOrderBillingSummary } from "@/features/chart/chart-order-billing-summary-contract";

export type ChartOrderBillingSummaryFreshness =
  | "loading"
  | "fresh"
  | "refreshing"
  | "stale"
  | "error";

export type ChartOrderBillingAmountDisplayState =
  | "authoritative"
  | "preview"
  | "invalid"
  | "save_error";

export function ChartOrderFinanceFooter({
  accessibilitySummary,
  canRequestBilling,
  confirmationCounts,
  drawerOpen,
  error,
  displayState,
  freshness,
  hasAuthoritativeSummary,
  onOpenDetails,
  onRequestBilling,
  requesting,
  saveStatusText,
  summary,
}: {
  accessibilitySummary?: string;
  canRequestBilling: boolean;
  confirmationCounts: {
    confirmed: number;
    invalid: number;
    ready: number;
  };
  drawerOpen: boolean;
  error?: string;
  displayState: ChartOrderBillingAmountDisplayState;
  freshness: ChartOrderBillingSummaryFreshness;
  hasAuthoritativeSummary: boolean;
  onOpenDetails: () => void;
  onRequestBilling: () => void;
  requesting: boolean;
  saveStatusText: string;
  summary: ChartOrderBillingSummary;
}) {
  const counts = summary.orderCounts;
  const amounts = summary.amounts;
  const freshnessText = getBillingStatusText(displayState, freshness);
  const amountLabel = getBillingAmountLabel(
    displayState,
    hasAuthoritativeSummary,
  );
  return (
    <footer
      data-testid="chart-order-footer"
      className="flex h-[52px] min-h-[52px] shrink-0 items-center gap-[var(--clair-spacing-24)] border-t border-[var(--clair-color-atomic-neutral-200)] bg-[var(--clair-color-atomic-common-100)] p-[var(--clair-spacing-12)]"
    >
      {accessibilitySummary ? <span className="sr-only">{accessibilitySummary}</span> : null}
      <div className="flex min-w-0 flex-1 items-center gap-[var(--clair-spacing-12)]">
        <div className="flex shrink-0 items-center gap-[var(--clair-spacing-8)] rounded-[var(--clair-radius-atomic-6)] bg-[var(--clair-color-atomic-black-alpha-4)] px-[var(--clair-spacing-8)] py-[var(--clair-spacing-4)] text-[12px] font-medium leading-[16px] tracking-[var(--clair-typography-label-2-letter-spacing)]">
          <span className="text-[var(--clair-color-atomic-gray-600)]">
            미확정 오더 {confirmationCounts.ready}
          </span>
          <span
            aria-hidden
            className="h-[10px] w-px bg-[var(--clair-color-atomic-neutral-200)]"
          />
          <span className="text-[var(--clair-color-atomic-orange-600)]">
            미입력 오더 {confirmationCounts.invalid}
          </span>
          <span
            aria-hidden
            className="h-[10px] w-px bg-[var(--clair-color-atomic-neutral-200)]"
          />
          <span className="text-[var(--clair-color-atomic-green-600)]">
            확정 오더 {confirmationCounts.confirmed}
          </span>
        </div>
        <span data-testid="chart-order-save-status" role="status" className="sr-only">
          {saveStatusText}
        </span>
        <span className="sr-only">
          {counts.recheck > 0 ? `재확인 ${counts.recheck}건. ` : ""}
          {counts.requested > 0 ? `청구됨 ${counts.requested}건.` : ""}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-[var(--clair-spacing-12)]">
        <div className="flex items-center justify-end gap-[var(--clair-spacing-8)] whitespace-nowrap text-[16px] font-medium leading-[24px] tracking-[var(--clair-typography-body-1-normal-letter-spacing)]">
          <span className="text-[var(--clair-color-atomic-neutral-500)]">총 금액</span>
          <span className="flex items-center gap-[var(--clair-spacing-4)] font-semibold tracking-[var(--clair-typography-headline-1-letter-spacing)] text-[var(--clair-color-atomic-neutral-900)]">
            <span className="tabular-nums">{formatWonNumber(amounts.estimatedTotal)}</span>
            <span>원</span>
          </span>
        </div>
        <span
          aria-hidden
          className="h-[18px] w-px bg-[var(--clair-color-atomic-neutral-200)]"
        />
        <span className="sr-only">{amountLabel}</span>
        {freshnessText ? (
          <span
            role="status"
            className="sr-only"
          >
            {freshnessText}
          </span>
        ) : null}
        <div className="flex items-center gap-[var(--clair-spacing-8)]">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="!shadow-none"
            aria-expanded={drawerOpen}
            aria-controls="chart-order-billing-detail-aside"
            onClick={onOpenDetails}
          >
            금액 상세
          </Button>
          <Button
            type="button"
            size="sm"
            className="!shadow-none"
            aria-label={requesting ? "전체 수납 청구 이동 중" : "전체 수납 청구"}
            disabled={!canRequestBilling || requesting}
            onClick={onRequestBilling}
          >
            {requesting ? "이동 중" : "전체 수납 청구"}
          </Button>
        </div>
        <span className="sr-only" aria-live="polite">{error}</span>
      </div>
    </footer>
  );
}

export function ChartOrderBillingDetailAside({
  canRequestBilling,
  displayState,
  error,
  freshness,
  hasAuthoritativeSummary,
  onClose,
  onRetry,
  onRequestBilling,
  open,
  requesting,
  summary,
}: {
  canRequestBilling: boolean;
  displayState: ChartOrderBillingAmountDisplayState;
  error?: string;
  freshness: ChartOrderBillingSummaryFreshness;
  hasAuthoritativeSummary: boolean;
  onClose: () => void;
  onRetry: () => void;
  onRequestBilling: () => void;
  open: boolean;
  requesting: boolean;
  summary: ChartOrderBillingSummary;
}) {
  const [amountScope, setAmountScope] = useState<"all" | "confirmed" | "draft">("all");
  const counts = summary.orderCounts;
  const amounts = summary.amounts;
  const selectedAmount = amountScope === "all"
    ? amounts.confirmed + amounts.draft
    : amounts[amountScope];
  const countText = amountScope === "all"
    ? `총 ${counts.total}건(확정 ${counts.confirmed} + 미확정 ${counts.draft})`
    : `${amountScope === "confirmed" ? "확정 오더" : "미확정 오더"} ${counts[amountScope]}건`;
  const freshnessText = getBillingStatusText(displayState, freshness);
  const isInitialLoading = !hasAuthoritativeSummary && freshness === "loading";
  const isInitialError = !hasAuthoritativeSummary && freshness === "error";
  const hasNoOrders = counts.total === 0 && !isInitialLoading && !isInitialError;
  return (
    <aside
      id="chart-order-billing-detail-aside"
      aria-label="Plan/Order 금액 상세"
      aria-hidden={!open || undefined}
      inert={!open ? true : undefined}
      className={cn(
        "absolute inset-y-0 right-0 z-30 box-content flex w-[var(--emr-chart-order-amount-detail-width)] flex-col border-l border-[var(--emr-border-default)] bg-[var(--emr-surface-panel)] shadow-[var(--emr-chart-order-amount-detail-shadow)] transition-transform duration-200",
        open ? "translate-x-0" : "pointer-events-none translate-x-full",
      )}
    >
      <header
        className="flex h-[var(--emr-chart-order-amount-detail-header-height)] shrink-0 items-center justify-between gap-[var(--clair-spacing-16)] px-[var(--clair-spacing-16)]"
        data-testid="chart-order-amount-detail-header"
      >
        <h3 className="emr-text-body font-medium text-[var(--clair-color-atomic-neutral-900)]">
          금액 상세
        </h3>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="금액 상세 닫기"
          className="rounded-[var(--clair-radius-atomic-6)]"
          onClick={onClose}
        >
          <CloseIcon
            aria-hidden="true"
            className="size-[var(--emr-chart-order-amount-detail-close-icon-size)]"
          />
        </Button>
      </header>
      <div
        className="min-h-0 flex-1 overflow-y-auto px-[var(--clair-spacing-16)] py-[var(--clair-spacing-8)]"
        data-testid="chart-order-amount-detail-body"
      >
        {isInitialLoading ? (
          <EmrEmptyState className="mx-auto min-h-[var(--emr-chart-order-amount-detail-empty-height)] justify-center" kind="upstream-pending" reserveActionSpace={false} size="md" surface="drawer" title="금액을 불러오는 중입니다" />
        ) : isInitialError ? (
          <EmrEmptyState className="mx-auto min-h-[var(--emr-chart-order-amount-detail-empty-height)] justify-center" kind="read-error" primaryAction={<Button size="sm" variant="outline" onClick={onRetry}>다시 시도</Button>} priority="local-recovery" reserveActionSpace={false} size="md" surface="drawer" title="금액을 불러오지 못했습니다" />
        ) : hasNoOrders ? (
          <EmrEmptyState className="mx-auto min-h-[var(--emr-chart-order-amount-detail-empty-height)] justify-center" kind="no-data" reserveActionSpace={false} size="md" surface="drawer" testId="chart-order-amount-detail-empty" title="오더가 없습니다" />
        ) : (
          <div className="flex flex-col gap-[var(--clair-spacing-16)]">
            <section aria-labelledby="billing-order-total-title">
              <AmountDetailCard muted testId="chart-order-amount-detail-total-card">
                <AmountDetailCardTitle
                  id="billing-order-total-title"
                  title="총 오더 합계"
                >
                  <Select value={amountScope} onValueChange={(value) => setAmountScope(value as "all" | "confirmed" | "draft")}>
                    <SelectTrigger
                      aria-label="오더 합계 조회 범위"
                      size="sm"
                      className="min-w-[106px] bg-[var(--clair-color-atomic-common-100)]"
                    >
                      <SelectValue>
                        {amountScope === "all" ? "전체" : amountScope === "confirmed" ? "확정 오더" : "미확정 오더"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent align="end" alignItemWithTrigger={false}>
                      <SelectItem value="all">전체</SelectItem>
                      <SelectItem value="confirmed">확정 오더</SelectItem>
                      <SelectItem value="draft">미확정 오더</SelectItem>
                    </SelectContent>
                  </Select>
                </AmountDetailCardTitle>
                <div aria-live="polite" className="flex flex-col gap-[var(--clair-spacing-4)]">
                  <strong className="font-[var(--clair-typography-heading-1-font-weight)] text-[length:var(--clair-typography-heading-1-font-size)] leading-[var(--clair-typography-heading-1-line-height)] tracking-[var(--clair-typography-heading-1-letter-spacing)] tabular-nums text-[var(--clair-color-atomic-neutral-900)]">
                    {formatWonSpaced(selectedAmount)}
                  </strong>
                  <p className="emr-text-dense font-medium text-[var(--clair-color-atomic-neutral-500)]">
                    {countText}
                  </p>
                </div>
              </AmountDetailCard>
            </section>
            <section aria-labelledby="billing-order-detail-title">
              <AmountDetailCard testId="chart-order-amount-detail-order-card">
                <AmountDetailCardTitle
                  id="billing-order-detail-title"
                  title="오더 상세"
                />
                <div className="flex flex-col gap-[var(--clair-spacing-8)] pt-[var(--clair-spacing-8)]">
                  <OrderDetailRow
                    amount={amounts.draft}
                    count={counts.draft}
                    state="draft"
                  />
                  <AmountDetailDivider />
                  <OrderDetailRow
                    amount={amounts.confirmed}
                    count={counts.confirmed}
                    state="confirmed"
                  />
                </div>
              </AmountDetailCard>
            </section>
            <section aria-labelledby="billing-composition-title">
              <AmountDetailCard testId="chart-order-amount-detail-composition-card">
                <AmountDetailCardTitle
                  id="billing-composition-title"
                  title="금액 구성"
                >
                  <span className="emr-text-dense text-[var(--clair-color-atomic-neutral-500)]">전체 청구 기준</span>
                </AmountDetailCardTitle>
                <dl className="flex flex-col gap-[var(--clair-spacing-8)] pt-[var(--clair-spacing-8)]">
                  <MoneyRow label="총 금액" value={formatWonSpaced(amounts.gross)} />
                  <AmountDetailDivider />
                  <MoneyRow
                    label="할인"
                    testId="billing-discount-value"
                    tone="adjustment"
                    value={`- ${formatWonNumber(amounts.discount)} 원`}
                  />
                  <AmountDetailDivider />
                  <MoneyRow
                    label="할증"
                    testId="billing-surcharge-value"
                    value={`+ ${formatSurchargePercent(amounts.surcharge, amounts.gross)} %(${formatWon(amounts.surcharge)})`}
                  />
                </dl>
              </AmountDetailCard>
            </section>
            {freshnessText ? <div className="flex items-center justify-between gap-[var(--clair-spacing-12)]"><p role="status" className={cn("emr-text-metadata", displayState === "invalid" || displayState === "save_error" || freshness === "stale" || freshness === "error" ? "text-[var(--emr-status-warning-text)]" : "text-[var(--emr-text-secondary)]")}>{freshnessText}</p>{freshness === "stale" || freshness === "error" ? <Button type="button" size="sm" variant="outline" onClick={onRetry}>다시 확인</Button> : null}</div> : null}
            {summary.unfinishedOrders.length > 0 ? <section className="rounded-[var(--clair-radius-atomic-8)] border border-[var(--emr-status-warning-border)] bg-[var(--emr-status-warning-bg)] p-[var(--clair-spacing-12)] emr-text-metadata"><p className="font-semibold">진행 중 오더 {summary.unfinishedOrders.length}건</p><ul className="mt-[var(--clair-spacing-8)] space-y-[var(--clair-spacing-4)]">{summary.unfinishedOrders.slice(0, 3).map((order) => <li key={order.orderId} className="truncate">{order.name} · {order.status}</li>)}</ul></section> : null}
            {error ? <p role="alert" className="emr-text-metadata text-destructive">{error}</p> : null}
          </div>
        )}
      </div>
      <footer
        className="flex h-[var(--emr-chart-order-amount-detail-footer-height)] shrink-0 items-center justify-end gap-[var(--clair-spacing-8)] overflow-hidden border-t border-[var(--emr-border-default)] px-[var(--clair-spacing-16)]"
        data-testid="chart-order-amount-detail-footer"
      >
        <Button type="button" size="sm" variant="outline" onClick={onClose}>
          닫기
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={!canRequestBilling || requesting}
          onClick={onRequestBilling}
        >
          {requesting ? "이동 중" : "전체 수납 청구"}
        </Button>
      </footer>
    </aside>
  );
}

function AmountDetailCard({
  children,
  muted = false,
  testId,
}: {
  children: ReactNode;
  muted?: boolean;
  testId: string;
}) {
  return (
    <Card
      size="sm"
      data-testid={testId}
      className={cn(
        "rounded-[var(--clair-radius-atomic-8)] border-[var(--clair-color-atomic-neutral-200)] ring-0 shadow-none data-[size=sm]:gap-0 data-[size=sm]:py-0",
        muted && "bg-[var(--clair-color-atomic-neutral-50)]",
      )}
    >
      <CardContent className="flex flex-col gap-[var(--clair-spacing-8)] px-[var(--clair-spacing-10)] pb-[var(--clair-spacing-10)] pt-[var(--clair-spacing-8)] group-data-[size=sm]/card:px-[var(--clair-spacing-10)]">
        {children}
      </CardContent>
    </Card>
  );
}

function AmountDetailCardTitle({
  children,
  id,
  title,
}: {
  children?: ReactNode;
  id: string;
  title: string;
}) {
  return (
    <div className="flex h-[var(--emr-chart-order-amount-detail-title-row-height)] items-center justify-between">
      <h4
        id={id}
        className="emr-text-metadata font-medium text-[var(--clair-color-atomic-neutral-500)]"
      >
        {title}
      </h4>
      {children}
    </div>
  );
}

function OrderDetailRow({
  amount,
  count,
  state,
}: {
  amount: number;
  count: number;
  state: "confirmed" | "draft";
}) {
  const confirmed = state === "confirmed";
  return (
    <div className="flex items-center justify-between">
      <Badge
        size="md"
        variant="outline"
        className={cn(
          "rounded-[var(--clair-radius-atomic-6)] px-[var(--clair-spacing-8)]",
          confirmed
            ? "border-[var(--clair-color-atomic-green-100)] bg-[var(--clair-color-atomic-green-50)] text-[var(--clair-color-atomic-green-600)]"
            : "border-[var(--clair-color-atomic-gray-100)] bg-[var(--clair-color-atomic-gray-50)] text-[var(--clair-color-atomic-gray-600)]",
        )}
      >
        {confirmed ? "확정된" : "미확정"} 오더 {count}건
      </Badge>
      <span className="emr-text-body font-medium tabular-nums text-[var(--clair-color-atomic-neutral-900)]">
        {formatWonSpaced(amount)}
      </span>
    </div>
  );
}

function AmountDetailDivider() {
  return (
    <div
      aria-hidden="true"
      className="h-px w-full bg-[var(--clair-color-atomic-neutral-200)]"
    />
  );
}

function MoneyRow({ label, testId, tone, value }: { label: string; testId?: string; tone?: "adjustment"; value: string }) {
  return (
    <div className="emr-text-body flex items-center justify-between font-medium">
      <dt className="text-[var(--clair-color-atomic-neutral-600)]">{label}</dt>
      <dd
        className={cn(
          "tabular-nums text-[var(--clair-color-atomic-neutral-900)]",
          tone === "adjustment" &&
            "text-[var(--emr-chart-order-amount-detail-adjustment-text)]",
        )}
        data-testid={testId}
      >
        {value}
      </dd>
    </div>
  );
}

function formatSurchargePercent(surcharge: number, gross: number) {
  if (gross <= 0 || surcharge <= 0) return "0";
  const percent = Math.round((surcharge / gross) * 1_000) / 10;
  return percent.toLocaleString("ko-KR", { maximumFractionDigits: 1 });
}

function formatWon(value: number) {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

function formatWonSpaced(value: number) {
  return `${formatWonNumber(value)} 원`;
}

function formatWonNumber(value: number) {
  return Math.round(value).toLocaleString("ko-KR");
}

function getFreshnessText(freshness: ChartOrderBillingSummaryFreshness) {
  if (freshness === "loading" || freshness === "refreshing") {
    return "금액 갱신 중";
  }
  if (freshness === "stale" || freshness === "error") {
    return "최신 금액 확인 필요";
  }
  return undefined;
}

function getBillingAmountLabel(
  displayState: ChartOrderBillingAmountDisplayState,
  hasAuthoritativeSummary: boolean,
) {
  if (displayState === "preview") return "이 차트 오더 예상";
  return hasAuthoritativeSummary ? "이 차트 오더 합계" : "이 차트 오더 예상";
}

function getBillingStatusText(
  displayState: ChartOrderBillingAmountDisplayState,
  freshness: ChartOrderBillingSummaryFreshness,
) {
  if (displayState === "preview") return "예상 · 저장 중";
  if (displayState === "invalid") return "입력 확인 필요 · 예상 금액";
  if (displayState === "save_error") return "저장 실패 · 예상 금액";
  return getFreshnessText(freshness);
}
