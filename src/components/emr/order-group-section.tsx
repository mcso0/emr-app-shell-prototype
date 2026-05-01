"use client";

import type { ReactNode } from "react";
import { CdsNavigationArrowDownIcon } from "@/components/cds-icons/navigation";
import { EmrIconButton } from "@/components/emr/icon-button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type EmrOrderGroupSectionProps = {
  title: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  collapsed?: boolean;
  count?: ReactNode;
  label?: ReactNode;
  meta?: ReactNode;
  onToggle?: () => void;
};

function getAccessibleTitle(title: ReactNode) {
  return typeof title === "string" ? title : "오더 그룹";
}

export function EmrOrderGroupSection({
  title,
  actions,
  children,
  className,
  collapsed = false,
  count,
  label,
  meta,
  onToggle,
}: EmrOrderGroupSectionProps) {
  const accessibleTitle = getAccessibleTitle(title);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {label ? (
        <div className="flex h-6 items-center text-[12px] font-medium text-[var(--clair-color-label-alternative)]">
          {label}
        </div>
      ) : null}
      <section
        className={cn(
          "overflow-hidden rounded-xl border border-[var(--clair-color-atomic-gray-200)] bg-card px-4",
          collapsed ? "pb-0" : "pb-4"
        )}
      >
        <div className="flex h-14 items-center justify-between px-1 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <EmrIconButton
              type="button"
              aria-expanded={!collapsed}
              aria-label={collapsed ? `${accessibleTitle} 펼치기` : `${accessibleTitle} 접기`}
              onClick={onToggle}
            >
              <CdsNavigationArrowDownIcon
                className={cn(
                  "transition-transform duration-[var(--clair-motion-duration-normal)] ease-[var(--clair-motion-easing-standard)]",
                  collapsed && "-rotate-90"
                )}
              />
            </EmrIconButton>
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="truncate text-[16px] font-semibold leading-6 text-[var(--clair-color-label-normal)]">
                {title}
              </span>
              {count !== undefined ? (
                <Badge
                  variant="secondary"
                  className="h-5 min-w-5 rounded-md px-1 text-[12px] font-medium text-[var(--clair-color-label-alternative)]"
                >
                  {count}
                </Badge>
              ) : null}
              {meta}
            </div>
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-3">{actions}</div> : null}
        </div>
        {collapsed ? null : children}
      </section>
    </div>
  );
}
