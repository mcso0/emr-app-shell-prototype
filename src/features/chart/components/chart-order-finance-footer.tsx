"use client";

import { Button } from "@/components/ui/button";
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
      className="flex h-[52px] min-h-[52px] shrink-0 items-center justify-between gap-4 border-t border-[var(--emr-border-default)] bg-[var(--emr-surface-panel)] px-4 text-[12px] leading-4"
    >
      {accessibilitySummary ? <span className="sr-only">{accessibilitySummary}</span> : null}
      <div className="flex min-w-0 items-center gap-3 text-[var(--emr-text-secondary)]">
        <span className="font-semibold text-foreground">오더 {counts.total}건</span>
        <span data-testid="chart-order-save-status" role="status">
          · {saveStatusText}
        </span>
        <span aria-hidden className="h-3 w-px bg-[var(--emr-border-default)]" />
        <span>확정 후 <b className="text-foreground">{counts.confirmed}</b></span>
        <span>확정 전 <b className="text-[var(--emr-status-warning-text)]">{counts.draft}</b></span>
        {counts.recheck > 0 ? (
          <span className="text-[var(--emr-status-warning-text)]">재확인 {counts.recheck}</span>
        ) : null}
        {counts.requested > 0 ? <span>청구됨 {counts.requested}</span> : null}
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <div className="hidden items-center gap-3 text-[var(--emr-text-secondary)] xl:flex">
          <span>확정 후 <b className="tabular-nums text-foreground">{formatWon(amounts.confirmed)}</b></span>
          {amounts.draft > 0 ? (
            <span>확정 전 <b className="tabular-nums text-[var(--emr-status-warning-text)]">{formatWon(amounts.draft)}</b></span>
          ) : null}
          {amounts.discount > 0 ? (
            <span>할인 <b className="tabular-nums text-[var(--emr-text-success)]">-{formatWon(amounts.discount)}</b></span>
          ) : null}
        </div>
        <span aria-hidden className="h-5 w-px bg-[var(--emr-border-default)]" />
        <p className="whitespace-nowrap text-[13px] text-[var(--emr-text-secondary)]">
          {amountLabel}{" "}
          <strong className="ml-1 tabular-nums text-[16px] text-foreground">
            {formatWon(amounts.estimatedTotal)}
          </strong>
        </p>
        {freshnessText ? (
          <span
            role="status"
            className={cn(
              "whitespace-nowrap text-[11px]",
              displayState === "invalid" ||
                displayState === "save_error" ||
                freshness === "stale" ||
                freshness === "error"
                ? "text-[var(--emr-status-warning-text)]"
                : "text-[var(--emr-text-tertiary)]",
            )}
          >
            {freshnessText}
          </span>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="outline"
          aria-expanded={drawerOpen}
          aria-controls="chart-order-billing-detail-aside"
          onClick={onOpenDetails}
        >
          금액 상세
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={!canRequestBilling || requesting}
          onClick={onRequestBilling}
        >
          {requesting ? "이동 중" : "수납에서 청구"}
        </Button>
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
  const counts = summary.orderCounts;
  const amounts = summary.amounts;
  const freshnessText = getBillingStatusText(displayState, freshness);
  const amountLabel = getBillingAmountLabel(
    displayState,
    hasAuthoritativeSummary,
  );
  return (
    <aside
      id="chart-order-billing-detail-aside"
      aria-label="Plan/Order 금액 상세"
      aria-hidden={!open || undefined}
      inert={!open ? true : undefined}
      className={cn(
        "absolute inset-y-0 right-0 z-30 flex w-[360px] max-w-[42%] flex-col border-l border-[var(--emr-border-default)] bg-[var(--emr-surface-panel)] shadow-[var(--clair-shadow-lg)] transition-transform duration-200",
        open ? "translate-x-0" : "pointer-events-none translate-x-full",
      )}
    >
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--emr-border-default)] px-4">
        <div>
          <p className="text-[10px] font-semibold tracking-wide text-[var(--emr-text-tertiary)]">PLAN/ORDER</p>
          <h3 className="text-sm font-semibold">이 차트 금액 상세</h3>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>닫기</Button>
      </header>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <section className="rounded-xl border border-[var(--emr-border-accent)] bg-[var(--emr-surface-selected)] p-4">
          <div className="flex items-center justify-between text-xs text-[var(--emr-text-secondary)]">
            <span>
              {amountLabel}
            </span>
            <span>이 차트 청구 가능 {counts.requestable}건</span>
          </div>
          <p className="mt-1 text-[28px] font-bold leading-9 tabular-nums text-[var(--emr-text-accent)]">
            {formatWon(amounts.estimatedTotal)}
          </p>
          <p className="mt-1 text-xs text-[var(--emr-text-secondary)]">
            확정 전 금액은 예상에만 포함돼요. 접수 전체 청구와 결제는 수납에서 확인해 주세요.
          </p>
          {freshnessText ? (
            <div className="mt-3 flex items-center justify-between gap-3">
              <p
                role="status"
                className={cn(
                  "text-xs",
                  displayState === "invalid" ||
                    displayState === "save_error" ||
                    freshness === "stale" ||
                    freshness === "error"
                    ? "text-[var(--emr-status-warning-text)]"
                    : "text-[var(--emr-text-secondary)]",
                )}
              >
                {freshnessText}
              </p>
              {freshness === "stale" || freshness === "error" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={onRetry}
                >
                  금액 다시 확인
                </Button>
              ) : null}
            </div>
          ) : null}
        </section>

        <section aria-labelledby="billing-order-state-title">
          <div className="mb-2 flex items-center justify-between">
            <h4 id="billing-order-state-title" className="text-xs font-semibold">오더 상태</h4>
            {counts.recheck > 0 ? <span className="text-xs text-[var(--emr-status-warning-text)]">재확인 {counts.recheck}건</span> : null}
          </div>
          <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-[var(--emr-border-default)]">
            <div className="p-3">
              <p className="text-[11px] text-[var(--emr-text-secondary)]">확정 후</p>
              <p className="mt-1 font-semibold tabular-nums">{formatWon(amounts.confirmed)}</p>
              <p className="text-[11px] text-[var(--emr-text-tertiary)]">{counts.confirmed}건</p>
            </div>
            <div className="border-l border-[var(--emr-border-default)] bg-[var(--emr-surface-muted)] p-3">
              <p className="text-[11px] text-[var(--emr-text-secondary)]">확정 전</p>
              <p className="mt-1 font-semibold tabular-nums text-[var(--emr-status-warning-text)]">{formatWon(amounts.draft)}</p>
              <p className="text-[11px] text-[var(--emr-text-tertiary)]">{counts.draft}건 · 예상만</p>
            </div>
          </div>
        </section>

        <section aria-labelledby="billing-composition-title">
          <h4 id="billing-composition-title" className="mb-2 text-xs font-semibold">금액 구성</h4>
          <dl className="divide-y divide-[var(--emr-border-default)] rounded-lg border border-[var(--emr-border-default)] px-3 text-xs">
            <MoneyRow label="현재 발생 금액" value={amounts.gross} />
            <MoneyRow label="할인" value={-amounts.discount} tone="success" />
            {amounts.surcharge > 0 ? <MoneyRow label="할증" value={amounts.surcharge} /> : null}
          </dl>
          <p className="mt-2 text-[11px] leading-4 text-[var(--emr-text-tertiary)]">
            세금·기수납·접수 전체 합계는 다른 차트 오더와 섞지 않고 수납 화면에서 계산해요.
          </p>
        </section>

        {summary.unfinishedOrders.length > 0 ? (
          <section className="rounded-lg border border-[var(--emr-status-warning-border)] bg-[var(--emr-status-warning-bg)] p-3 text-xs">
            <p className="font-semibold">진행 중 오더 {summary.unfinishedOrders.length}건</p>
            <p className="mt-1 text-[var(--emr-text-secondary)]">
              중간 정산으로 청구할 수 있지만 오더 업무는 계속 진행돼요.
            </p>
            <ul className="mt-2 space-y-1">
              {summary.unfinishedOrders.slice(0, 3).map((order) => (
                <li key={order.orderId} className="truncate">{order.name} · {order.status}</li>
              ))}
            </ul>
          </section>
        ) : null}
        {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
      </div>
      <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-[var(--emr-border-default)] p-3">
        <p className="text-xs text-[var(--emr-text-secondary)]">이 차트 청구 가능 {formatWon(amounts.requestableTotal)}</p>
        <Button
          type="button"
          size="sm"
          disabled={!canRequestBilling || requesting}
          onClick={onRequestBilling}
        >
          {requesting ? "이동 중" : "수납에서 청구"}
        </Button>
      </footer>
    </aside>
  );
}

function MoneyRow({ label, tone, value }: { label: string; tone?: "success"; value: number }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <dt className="text-[var(--emr-text-secondary)]">{label}</dt>
      <dd className={cn("font-semibold tabular-nums", tone === "success" && "text-[var(--emr-text-success)]")}>
        {value > 0 ? "+" : ""}{formatWon(value)}
      </dd>
    </div>
  );
}

function formatWon(value: number) {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
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
