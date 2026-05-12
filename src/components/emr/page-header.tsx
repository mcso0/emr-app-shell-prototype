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
      className={cn("flex h-9 items-center justify-between gap-4", className)}
    >
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {icon}
          <h1
            className={cn(
              "truncate text-[16px] font-semibold leading-6 tracking-[-0.002em] text-foreground",
              titleClassName
            )}
          >
            {title}
          </h1>
        </div>
        {badge}
      </div>
      {actions ? (
        <div className={cn("flex shrink-0 items-center gap-2", actionsClassName)}>
          {actions}
        </div>
      ) : null}
    </div>
  );
}
