"use client";

import type { ReactNode } from "react";
import { CdsNavigationChevronsLeftIcon } from "@/components/cds-icons/navigation";
import {
  EmrListHeader,
  EmrListHeaderIconButton,
} from "@/components/emr/subpanel";
import { cn } from "@/lib/utils";

type EmrContentAsidePanelProps = {
  children: ReactNode;
  className?: string;
  id?: string;
};

type EmrContentAsideHeaderProps = {
  label: ReactNode;
  actions?: ReactNode;
  className?: string;
  collapseAriaLabel?: string;
  count?: ReactNode;
  onCollapse: () => void;
  /** Replace the title/actions in the same frame without moving the list. */
  search?: ReactNode;
};

export function EmrContentAsidePanel({
  children,
  className,
  id,
}: EmrContentAsidePanelProps) {
  return (
    <div
      id={id}
      data-slot="content-aside-panel"
      className={cn(
        "flex h-full w-full min-w-[var(--emr-content-aside-width)] flex-col gap-[var(--emr-content-aside-section-gap)] bg-[var(--emr-content-aside-bg)] px-[var(--emr-content-aside-padding-x)] pt-[var(--emr-content-aside-header-padding-top)] [--emr-list-header-padding-x:var(--emr-content-aside-list-header-padding-x)] [--emr-list-header-padding-y:var(--emr-content-aside-list-header-padding-y)]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function EmrContentAsideHeader({
  actions,
  className,
  collapseAriaLabel,
  count,
  label,
  onCollapse,
  search,
}: EmrContentAsideHeaderProps) {
  const fallbackCollapseLabel =
    typeof label === "string" ? `${label} 목록 접기` : "이력 목록 접기";

  const header = (
    <EmrListHeader
      className={cn("mx-0 h-[var(--clair-layout-panel-header)] border-y-0", className)}
      count={count}
      label={label}
      headerActions={
        <>
          <EmrListHeaderIconButton
            ariaLabel={collapseAriaLabel ?? fallbackCollapseLabel}
            data-workspace-history-collapse="true"
            iconSize="md"
            onClick={onCollapse}
          >
            <CdsNavigationChevronsLeftIcon className="size-4" />
          </EmrListHeaderIconButton>
          {actions}
        </>
      }
    />
  );

  if (search === undefined) return header;

  return (
    <div data-slot="content-aside-search-header" className="relative shrink-0">
      <div className={search ? "invisible" : undefined} aria-hidden={search ? true : undefined} inert={search ? true : undefined}>
        {header}
      </div>
      {search ? <div className={cn("absolute inset-0 flex min-w-0 items-center", className)}>{search}</div> : null}
    </div>
  );
}
