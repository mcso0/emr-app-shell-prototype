"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { CdsCommunicationMessageSquareIcon } from "@/components/cds-icons/communication-and-media";
import { CdsFilesMoreHorizontalIcon } from "@/components/cds-icons/files-and-layout";
import { CdsPeopleUserCheckIcon } from "@/components/cds-icons/people-and-places";
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

const sidePanelBadgeIconClassName =
  "flex size-3.5 shrink-0 items-center justify-center text-[var(--clair-color-atomic-gray-400)] [&_svg]:text-[var(--clair-color-atomic-gray-400)]";

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
        "group/emr-side-panel-card relative w-full overflow-hidden rounded-[var(--emr-radius-control)] border border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)] px-3 pb-2.5 pt-2 text-left outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
        selected &&
          "border-[var(--emr-accent)] bg-[var(--emr-surface-selected)] pl-3.5 focus-visible:ring-[var(--emr-accent-subtle)]",
        !selected && "hover:bg-[var(--emr-surface-muted)]",
        className
      )}
      data-testid={testId}
      data-selected={selected ? "true" : undefined}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
    >
      {selected ? (
        <span
          className="absolute inset-y-0 left-0 w-1 bg-[var(--emr-accent)]"
          aria-hidden="true"
        />
      ) : null}
      {children}
    </div>
  );
}

export function EmrSidePanelIdentityLine({
  action,
  guardianName,
  patientName,
  typeBadge,
}: {
  action?: ReactNode;
  guardianName: ReactNode;
  patientName: ReactNode;
  typeBadge?: ReactNode;
}) {
  return (
    <div className="flex min-h-6 items-center gap-1.5 overflow-hidden">
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden text-[14px] font-semibold leading-5 tracking-normal text-[var(--clair-color-label-strong)]">
        <span className="truncate">{patientName}</span>
        <span className="shrink-0 font-medium text-[var(--clair-color-atomic-gray-500)]">·</span>
        <span className="truncate">{guardianName}</span>
        {typeBadge}
      </div>
      {action}
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
      className="size-6 shrink-0 rounded-[var(--clair-radius-sm)] bg-[var(--emr-surface-panel)] p-0 text-[var(--clair-color-label-normal)] opacity-0 transition-opacity hover:bg-[var(--emr-surface-muted)] focus-visible:opacity-100 group-hover/emr-side-panel-card:opacity-100 group-focus-within/emr-side-panel-card:opacity-100 group-data-[selected=true]/emr-side-panel-card:opacity-100 [&_svg]:size-4"
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
  icon,
  label,
  maxWidthClassName = "max-w-[92px]",
  value,
}: {
  icon?: ReactNode;
  label: string;
  maxWidthClassName?: string;
  value: string;
}) {
  const resolvedIcon = icon ?? getDefaultMetaBadgeIcon(label);

  return (
    <span
      aria-label={`${label} ${value}`}
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-0.5 rounded-[var(--clair-radius-atomic-4)] border border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)] py-0.5 pl-1 pr-1.5 text-[12px] font-medium leading-4 tracking-[0.3px]",
        maxWidthClassName
      )}
    >
      {resolvedIcon ? (
        <span className={sidePanelBadgeIconClassName}>
          {resolvedIcon}
        </span>
      ) : (
        <span className="shrink-0 text-[var(--clair-color-atomic-gray-500)]">{label}</span>
      )}
      <span className="truncate text-[var(--clair-color-atomic-gray-700)]">{value}</span>
    </span>
  );
}

function getDefaultMetaBadgeIcon(label: string) {
  if (label === "요청") {
    return <CdsCommunicationMessageSquareIcon className="size-3" aria-hidden="true" />;
  }

  if (label === "담당") {
    return <CdsPeopleUserCheckIcon className="size-3" aria-hidden="true" />;
  }

  return null;
}

export function EmrSidePanelStatusBadge({
  children,
  icon,
  maxWidthClassName = "max-w-[112px]",
}: {
  children: ReactNode;
  icon?: ReactNode;
  maxWidthClassName?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-0.5 rounded-[var(--clair-radius-atomic-6)] border border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)] py-0.5 pl-1 pr-1.5 text-[12px] font-medium leading-4 tracking-[0.3px] text-[var(--clair-color-atomic-gray-600)]",
        maxWidthClassName
      )}
    >
      {icon ? (
        <span className={sidePanelBadgeIconClassName}>
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
}
