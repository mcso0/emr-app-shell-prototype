"use client";

import { useId } from "react";
import { EmrSidePanelStateIcon } from "@/components/emr/side-panel-state-icon";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  getChartOrderWorkPresentation,
  type ChartOrderConfirmationState,
  type ChartOrderPresentationRow,
} from "../chart-order-table-presentation";

const labels = { ready: "확정 대기", invalid: "입력 필요", confirmed: "확정" };
const tones = {
  ready: "border-[var(--emr-status-neutral-border)] bg-[var(--emr-status-neutral-bg)] text-[var(--emr-status-neutral-text)]",
  invalid: "border-[var(--emr-status-warning-border)] bg-[var(--emr-status-warning-bg)] text-[var(--emr-status-warning-text)]",
  confirmed: "border-[var(--emr-status-success-border)] bg-[var(--emr-status-success-bg)] text-[var(--emr-status-success-text)]",
};

export function ChartOrderConfirmationBadge({ state, onOpenDetail, disabled = false, issueDescription }: {
  state: ChartOrderConfirmationState;
  onOpenDetail: () => void;
  disabled?: boolean;
  issueDescription?: string;
}) {
  const className = cn("inline-flex h-[22px] items-center justify-center whitespace-nowrap rounded-md border px-2 emr-text-status font-medium", tones[state]);
  return state === "invalid" ? (
    <button type="button" className={cn(className, "focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50")}
      data-row-interactive="true" disabled={disabled} onClick={onOpenDetail}
      title={issueDescription ? `${issueDescription} 상세에서 확인해 주세요.` : undefined}>
      {labels[state]}
    </button>
  ) : <span className={className}>{labels[state]}</span>;
}

export function ChartOrderWorkStatus({ row }: { row: ChartOrderPresentationRow }) {
  const tooltipId = useId();
  const state = getChartOrderWorkPresentation(row);
  if (state.unconfirmed) {
    return <Tooltip>
      <TooltipTrigger render={<span tabIndex={0} className="text-[var(--emr-text-tertiary)]" aria-label="확정 후 업무 상태가 표시됩니다" aria-describedby={tooltipId} />}>
        —
      </TooltipTrigger>
      <TooltipContent id={tooltipId} role="tooltip">확정 후 업무 상태가 표시됩니다</TooltipContent>
    </Tooltip>;
  }
  return <span className="inline-flex items-center gap-1.5 whitespace-nowrap emr-text-status text-[var(--emr-text-secondary)]">
    {state.icon ? <EmrSidePanelStateIcon state={state.icon} aria-hidden="true" /> : null}
    {state.label}
  </span>;
}
