"use client";

import type { ReactNode } from "react";
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
};

export function EmrInstructionTitleBar({
  actions,
  badge,
  className,
  icon,
  title,
}: EmrInstructionTitleBarProps) {
  return (
    <div className={cn("flex h-9 items-center justify-between", className)}>
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {icon}
          <h1 className="truncate text-[18px] font-semibold leading-[26px] tracking-[-0.002em] text-foreground">
            {title}
          </h1>
        </div>
        {badge}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
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
      <div data-slot="instruction-header-order-info" className="mt-6">
        {orderInfo}
      </div>
      {filters ? (
        <div data-slot="instruction-header-filters" className="mt-4">
          {filters}
        </div>
      ) : null}
      {resultDivider ? (
        <div
          data-slot="instruction-header-result-divider"
          className="mt-4 h-px w-full shrink-0 bg-[var(--clair-color-line-normal)]"
        />
      ) : null}
    </div>
  );
}
