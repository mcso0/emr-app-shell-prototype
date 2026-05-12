"use client";

import type { ReactNode } from "react";
import { EmrPageHeader } from "@/components/emr/page-header";
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
