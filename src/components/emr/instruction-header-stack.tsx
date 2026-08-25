"use client";

import type { ReactNode } from "react";
import { CdsUtilitiesHistoryIcon } from "@/components/cds-icons/utilities-and-misc";
import { EmrPageHeader } from "@/components/emr/page-header";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type EmrInstructionHeaderStackProps = {
  titleBar: ReactNode;
  orderInfo: ReactNode;
  filters?: ReactNode;
  className?: string;
  resultDivider?: boolean;
};

type EmrInstructionTitleBarProps = {
  actions?: ReactNode;
  badge?: ReactNode;
  className?: string;
  icon?: ReactNode;
  title: ReactNode;
  titleClassName?: string;
};

type EmrInstructionHistoryToggleProps = {
  ariaLabelPrefix: string;
  controls: string;
  expanded: boolean;
  onClick: () => void;
  tooltipLabel: string;
};

export function EmrInstructionTitleBar({
  actions,
  badge,
  className,
  icon,
  title,
  titleClassName,
}: EmrInstructionTitleBarProps) {
  return (
    <EmrPageHeader
      actions={actions}
      badge={badge}
      className={className}
      icon={icon}
      title={title}
      titleClassName={titleClassName}
    />
  );
}

export function EmrInstructionHistoryToggle({
  ariaLabelPrefix,
  controls,
  expanded,
  onClick,
  tooltipLabel,
}: EmrInstructionHistoryToggleProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="size-[var(--emr-page-title-height)] rounded-[var(--emr-context-bar-button-radius)] bg-card shadow-[var(--clair-shadow-xs)] data-[state=on]:border-[var(--clair-color-atomic-black-alpha-16)] data-[state=on]:bg-[var(--emr-state-selected)] data-[state=on]:text-[var(--emr-text-primary)] [&_svg]:size-4"
            aria-label={`${ariaLabelPrefix} 패널 ${expanded ? "접기" : "열기"}`}
            aria-controls={controls}
            aria-expanded={expanded}
            aria-pressed={expanded}
            data-state={expanded ? "on" : "off"}
            onClick={onClick}
          >
            <CdsUtilitiesHistoryIcon className="size-4" />
          </Button>
        }
      />
      <TooltipContent side="bottom" sideOffset={6}>
        {tooltipLabel}
      </TooltipContent>
    </Tooltip>
  );
}

export function EmrInstructionHeaderStack({
  titleBar,
  orderInfo,
  filters,
  className,
  resultDivider = false,
}: EmrInstructionHeaderStackProps) {
  return (
    <div data-slot="instruction-header-stack" className={cn("flex shrink-0 flex-col", className)}>
      <div data-slot="instruction-header-title-bar">{titleBar}</div>
      <div data-slot="instruction-header-order-info" className="mt-3">
        {orderInfo}
      </div>
      {filters ? (
        <div data-slot="instruction-header-filters" className="mt-3">
          {filters}
        </div>
      ) : null}
      {resultDivider ? (
        <div
          data-slot="instruction-header-result-divider"
          className="mt-3 h-px w-full shrink-0 bg-[var(--emr-border-subtle)]"
        />
      ) : null}
    </div>
  );
}
