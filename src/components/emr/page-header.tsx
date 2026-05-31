"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type EmrPageHeaderProps = {
  actions?: ReactNode;
  actionsClassName?: string;
  badge?: ReactNode;
  className?: string;
  icon?: ReactNode;
  title: ReactNode;
  titleClassName?: string;
};

export function EmrPageHeader({
  actions,
  actionsClassName,
  badge,
  className,
  icon,
  title,
  titleClassName,
}: EmrPageHeaderProps) {
  return (
    <div
      data-slot="emr-page-header"
      className={cn("flex min-h-[var(--emr-page-title-height)] items-center justify-between gap-[var(--emr-page-title-section-gap)]", className)}
    >
      <div className="flex min-w-0 items-center gap-[var(--emr-page-title-left-gap)]">
        <div className="flex min-w-0 items-center gap-[var(--emr-page-title-wrap-gap)]">
          {icon}
          <h1
            className={cn(
              "truncate text-[18px] font-semibold leading-[26px] tracking-[-0.036px] text-[var(--emr-context-bar-chip-value)]",
              titleClassName
            )}
          >
            {title}
          </h1>
        </div>
        {badge}
      </div>
      {actions ? (
        <div className={cn("flex shrink-0 items-center gap-[var(--emr-page-title-action-gap)]", actionsClassName)}>
          {actions}
        </div>
      ) : null}
    </div>
  );
}
