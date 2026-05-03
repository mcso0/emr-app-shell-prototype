"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { CdsFilesMoreHorizontalIcon } from "@/components/cds-icons/files-and-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type EmrSidePanelCardProps = {
  children: ReactNode;
  className?: string;
  selected: boolean;
  testId?: string;
  onSelect: () => void;
};

export function EmrSidePanelCard({
  children,
  className,
  selected,
  testId,
  onSelect,
}: EmrSidePanelCardProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        "group/emr-side-panel-card w-full rounded-[var(--clair-radius-atomic-8)] border border-[var(--clair-color-atomic-gray-200)] bg-card px-3 pb-2.5 pt-2 text-left outline-none transition-colors hover:bg-[var(--clair-color-atomic-black-alpha-4)] focus-visible:ring-3 focus-visible:ring-ring/50",
        selected &&
          "border-[var(--clair-color-atomic-sky-300)] bg-[var(--clair-color-atomic-sky-50)]",
        className
      )}
      data-testid={testId}
      data-selected={selected ? "true" : undefined}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>
  );
}

export function EmrSidePanelCardAction({
  ariaLabel,
  testId,
}: {
  ariaLabel: string;
  testId?: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon-xs"
      className="size-6 shrink-0 rounded-[var(--clair-radius-sm)] bg-card p-0 text-[var(--clair-color-label-normal)] opacity-0 transition-opacity hover:bg-[var(--clair-color-background-surface)] focus-visible:opacity-100 group-hover/emr-side-panel-card:opacity-100 group-focus-within/emr-side-panel-card:opacity-100 group-data-[selected=true]/emr-side-panel-card:opacity-100 [&_svg]:size-4"
      aria-label={ariaLabel}
      data-testid={testId}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <CdsFilesMoreHorizontalIcon aria-hidden="true" />
    </Button>
  );
}

export function EmrSidePanelTypeBadge({ label }: { label: string }) {
  const reservation = label === "예약";

  return (
    <Badge
      variant="secondary"
      className={cn(
        "h-5 shrink-0 rounded-[var(--clair-radius-atomic-6)] border-transparent px-1.5 text-[12px] font-medium leading-4 tracking-[0.3px]",
        reservation
          ? "bg-[var(--clair-color-atomic-sky-50)] text-[var(--clair-color-atomic-blue-600)]"
          : "bg-[var(--clair-color-atomic-gray-50)] text-[var(--clair-color-atomic-gray-900)]"
      )}
    >
      {label}
    </Badge>
  );
}

export function EmrSidePanelMetaBadge({
  label,
  maxWidthClassName = "max-w-[92px]",
  value,
}: {
  label: string;
  maxWidthClassName?: string;
  value: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-0.5 rounded-[var(--clair-radius-atomic-4)] border border-[var(--clair-color-atomic-black-alpha-8)] bg-card px-1.5 py-0.5 text-[12px] font-medium leading-4 tracking-[0.3px]",
        maxWidthClassName
      )}
    >
      <span className="shrink-0 text-[var(--clair-color-atomic-gray-500)]">{label}</span>
      <span className="truncate text-[var(--clair-color-atomic-gray-700)]">{value}</span>
    </span>
  );
}
