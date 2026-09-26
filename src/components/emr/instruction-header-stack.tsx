"use client";

import type { ReactNode } from "react";
import { CdsFilesMoreHorizontalIcon } from "@/components/cds-icons/files-and-layout";
import { CdsUtilitiesHistoryIcon } from "@/components/cds-icons/utilities-and-misc";
import { DownloadIcon, PrinterIcon } from "@/components/icons";
import { EmrPageHeader } from "@/components/emr/page-header";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  disabled?: boolean;
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
      actionsClassName="ml-auto gap-2"
      badge={badge}
      className={cn(
        "min-h-12 flex-wrap gap-x-4 gap-y-2 py-2.5 [&>div:first-child]:gap-2",
        className,
      )}
      icon={icon}
      title={title}
      titleClassName={cn(
        "text-base leading-6 tracking-normal text-foreground",
        titleClassName,
      )}
    />
  );
}

export function EmrInstructionHistoryToggle({
  ariaLabelPrefix,
  controls,
  disabled = false,
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
            className="size-[var(--clair-control-height-xs)] rounded-[var(--clair-radius-atomic-6)] bg-card shadow-[var(--clair-shadow-xs)] data-[state=on]:border-[var(--clair-color-atomic-black-alpha-16)] data-[state=on]:bg-[var(--emr-state-selected)] data-[state=on]:text-[var(--emr-text-primary)] [&_svg]:size-3.5"
            aria-label={`${ariaLabelPrefix} 패널 ${expanded ? "접기" : "열기"}`}
            aria-controls={controls}
            aria-expanded={expanded}
            aria-pressed={expanded}
            disabled={disabled}
            data-state={expanded ? "on" : "off"}
            onClick={onClick}
          >
            <CdsUtilitiesHistoryIcon className="size-3.5" />
          </Button>
        }
      />
      <TooltipContent side="bottom" sideOffset={6}>
        {tooltipLabel}
      </TooltipContent>
    </Tooltip>
  );
}

export function EmrInstructionOutputMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-7 rounded-lg text-[var(--emr-text-secondary)] [&_svg]:size-4"
            aria-label="문서 추가 작업"
            data-testid="instruction-output-menu-trigger"
          />
        }
      >
        <CdsFilesMoreHorizontalIcon aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem className="h-8 gap-2 text-xs" disabled>
          <DownloadIcon aria-hidden="true" />
          PDF 다운로드
        </DropdownMenuItem>
        <DropdownMenuItem className="h-8 gap-2 text-xs" disabled>
          <PrinterIcon aria-hidden="true" />
          출력하기
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
