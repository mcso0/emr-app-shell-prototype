"use client";

import type { ReactNode } from "react";
import { CdsActionsSearchIcon } from "@/components/cds-icons/actions-and-controls";
import { EmrPageHeader } from "@/components/emr/page-header";
import { CircleCloseFillIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type CustomerListHeaderProps = {
  className?: string;
  count: number;
  countLoading?: boolean;
  onSearchChange: (value: string) => void;
  primaryAction?: ReactNode;
  searchPlaceholder: string;
  searchValue: string;
  tableControls?: ReactNode;
  title: string;
};

export function CustomerListHeader({
  className,
  count,
  countLoading = false,
  onSearchChange,
  primaryAction,
  searchPlaceholder,
  searchValue,
  tableControls,
  title,
}: CustomerListHeaderProps) {
  return (
    <header
      className={cn(
        "flex min-h-[108px] shrink-0 flex-col gap-3 bg-[var(--emr-surface-workspace)] px-12 py-4",
        className,
      )}
      data-testid="customer-page-header"
    >
      <EmrPageHeader
        title={title}
        badge={
          <Badge
            variant="secondary"
            className="h-7 min-w-5 rounded-md bg-[var(--clair-color-atomic-black-alpha-4)] px-2 py-0 text-[16px] font-medium leading-6 tracking-[0.096px] text-[var(--clair-color-atomic-neutral-900)]"
          >
            {countLoading ? (
              <Skeleton
                aria-label={`${title} 수 불러오는 중`}
                className="h-3 w-5 rounded-[var(--emr-radius-control)] bg-[var(--emr-surface-muted)]"
                data-testid="customer-page-header-count-skeleton"
              />
            ) : (
              count
            )}
          </Badge>
        }
        className="min-h-8 justify-start gap-3"
        titleClassName="text-[24px] font-bold leading-8 tracking-[-0.552px] text-[var(--clair-color-atomic-neutral-900)]"
      />

      <div className="flex min-w-0 flex-wrap items-center gap-6">
        <div className="flex min-w-[260px] flex-1 items-center">
          <div className="relative w-80 max-w-full min-w-0">
            <Input
              aria-label="고객관리 검색"
              placeholder={searchPlaceholder}
              value={searchValue}
              className={cn(
                "h-8 rounded-lg border-[var(--clair-color-atomic-neutral-200)] bg-[var(--clair-color-atomic-common-100)] px-2.5 py-1.5 text-[14px] font-medium leading-5 tracking-[0.196px] shadow-none",
                searchValue ? "pr-8" : "pr-9",
              )}
              onValueChange={onSearchChange}
            />
            {searchValue ? (
              <button
                type="button"
                className="absolute right-1 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-[var(--clair-color-atomic-black-alpha-4)] focus-visible:ring-3 focus-visible:ring-[var(--clair-color-atomic-neutral-300)]"
                aria-label="고객관리 검색어 초기화"
                onClick={() => onSearchChange("")}
              >
                <CircleCloseFillIcon className="size-4" aria-hidden="true" />
              </button>
            ) : (
              <span className="pointer-events-none absolute right-1 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center">
                <CdsActionsSearchIcon
                  className="size-4 text-[var(--clair-color-atomic-neutral-500)]"
                  aria-hidden="true"
                />
              </span>
            )}
          </div>
        </div>

        <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-3">
          {tableControls}
          {primaryAction ? (
            <>
              <span
                aria-hidden="true"
                className="h-4 w-px bg-[var(--clair-color-atomic-neutral-200)]"
              />
              <div className="[&_[data-slot=dropdown-menu-trigger]]:h-8 [&_[data-slot=dropdown-menu-trigger]]:min-h-8 [&_[data-slot=dropdown-menu-trigger]]:rounded-lg [&_[data-slot=dropdown-menu-trigger]]:border-transparent [&_[data-slot=dropdown-menu-trigger]]:bg-[var(--clair-color-atomic-neutral-900)] [&_[data-slot=dropdown-menu-trigger]]:px-3 [&_[data-slot=dropdown-menu-trigger]]:py-1.5 [&_[data-slot=dropdown-menu-trigger]]:font-medium [&_[data-slot=dropdown-menu-trigger]]:text-[var(--clair-color-atomic-common-100)] [&_[data-slot=dropdown-menu-trigger]]:shadow-none [&_[data-slot=dropdown-menu-trigger]]:hover:bg-[var(--clair-color-atomic-neutral-800)]">
                {primaryAction}
              </div>
            </>
          ) : null}
        </div>
      </div>

      <span className="sr-only">
        {countLoading ? `${title} 정보를 불러오는 중` : `${title} ${count}`}
      </span>
    </header>
  );
}
