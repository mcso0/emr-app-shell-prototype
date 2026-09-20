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

const labels = { ready: "미확정", invalid: "미입력", confirmed: "확정" };
const tones = {
  ready: "bg-[var(--clair-color-atomic-gray-50)] text-[var(--clair-color-atomic-gray-600)] shadow-[inset_0_0_0_var(--clair-border-width-default)_var(--clair-color-atomic-gray-100)]",
  invalid: "bg-[var(--clair-color-atomic-orange-50)] text-[var(--clair-color-atomic-orange-600)] shadow-[inset_0_0_0_var(--clair-border-width-default)_var(--clair-color-atomic-orange-100)]",
  confirmed: "bg-[var(--clair-color-atomic-green-50)] text-[var(--clair-color-atomic-green-600)] shadow-[inset_0_0_0_var(--clair-border-width-default)_var(--clair-color-atomic-green-100)]",
};

export function ChartOrderConfirmationBadge({ state, onOpenDetail, disabled = false, issueDescription }: {
  state: ChartOrderConfirmationState;
  onOpenDetail: () => void;
  disabled?: boolean;
  issueDescription?: string;
}) {
  const className = cn("inline-flex h-[22px] items-center justify-center whitespace-nowrap rounded-[var(--clair-radius-atomic-6)] px-2 py-[3px] emr-text-status font-medium", tones[state]);
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
      <TooltipTrigger render={<span tabIndex={0} className="inline-flex items-center text-[var(--clair-color-atomic-neutral-400)]" aria-label="확정 후 업무 상태가 표시됩니다" aria-describedby={tooltipId} data-emr-order-work-status="unconfirmed" />}>
        <span aria-hidden="true" className="ml-0.5">-</span>
      </TooltipTrigger>
      <TooltipContent id={tooltipId} role="tooltip">확정 후 업무 상태가 표시됩니다</TooltipContent>
    </Tooltip>;
  }
  return <span className="inline-flex items-center gap-1 whitespace-nowrap emr-text-status text-[var(--clair-color-atomic-neutral-900)]" data-emr-order-work-status="confirmed">
    {state.icon ? <EmrSidePanelStateIcon state={state.icon} aria-hidden="true" /> : null}
    {state.label}
  </span>;
}
