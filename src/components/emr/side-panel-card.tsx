"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { CdsCommunicationMessageSquareIcon } from "@/components/cds-icons/communication-and-media";
import { CdsFilesMoreHorizontalIcon } from "@/components/cds-icons/files-and-layout";
import { CdsPeopleUserCheckIcon } from "@/components/cds-icons/people-and-places";
import {
  EmrRowActionMenu,
  type EmrRowActionMenuDensity,
  type EmrRowActionMenuItem,
} from "@/components/emr/row-action-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type EmrSidePanelCardProps = {
  children: ReactNode;
  className?: string;
  selectionVariant?: "accentBar" | "modulePanel";
  selected: boolean;
  testId?: string;
  onSelect: () => void;
};

const sidePanelBadgeIconClassName =
  "flex size-3 shrink-0 items-center justify-center text-[var(--emr-sidepanel-task-card-chip-icon)] [&_svg]:size-3 [&_svg]:text-[var(--emr-sidepanel-task-card-chip-icon)]";
export const emrSidePanelCardHoverActionButtonClassName =
  "size-[var(--emr-sidepanel-task-card-action-size)] shrink-0 rounded-[var(--emr-sidepanel-task-card-action-radius)] border border-[var(--emr-sidepanel-task-card-action-border)] bg-[var(--emr-sidepanel-task-card-action-bg)] p-0 text-[var(--emr-text-secondary)] opacity-0 shadow-[var(--clair-shadow-xs)] transition-opacity hover:!opacity-100 hover:bg-[var(--emr-sidepanel-task-card-action-bg)] focus-visible:!opacity-100 group-hover/emr-side-panel-card:!opacity-100 group-focus-within/emr-side-panel-card:!opacity-100 data-popup-open:!opacity-100 data-popup-open:bg-[var(--emr-sidepanel-task-card-action-bg)] data-popup-open:text-[var(--emr-text-primary)] [&_svg]:size-[var(--emr-sidepanel-task-card-action-icon-size)]";
export const emrSidePanelCardActionButtonClassName = cn(
  emrSidePanelCardHoverActionButtonClassName,
  "group-data-[selected=true]/emr-side-panel-card:!opacity-100"
);

export function EmrSidePanelCard({
  children,
  className,
  selectionVariant = "accentBar",
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
        "group/emr-side-panel-card relative w-full overflow-hidden text-left outline-none transition-all duration-[var(--clair-motion-duration-fast)] focus-visible:ring-3 focus-visible:ring-ring/50 active:shadow-none",
        selectionVariant === "modulePanel"
          ? "flex flex-col gap-[var(--emr-sidepanel-task-card-gap)] rounded-[var(--emr-sidepanel-task-card-radius)] border border-[var(--emr-sidepanel-task-card-border)] bg-[var(--emr-sidepanel-task-card-bg)] p-[var(--emr-sidepanel-task-card-padding)] shadow-[var(--clair-shadow-xs)] hover:bg-[var(--emr-sidepanel-task-card-hover-bg)] hover:shadow-[var(--clair-shadow-xs)]"
          : "emr-density-card rounded-[var(--emr-radius-control)] border border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)] shadow-[var(--clair-shadow-xs)] hover:shadow-[var(--clair-shadow-sm)]",
        selected &&
          (selectionVariant === "modulePanel"
            ? "border-[var(--emr-sidepanel-task-card-selected-border)] bg-[var(--emr-sidepanel-task-card-bg)] hover:bg-[var(--emr-sidepanel-task-card-bg)] hover:shadow-none"
            : "border-[var(--emr-state-selected-border)] bg-[var(--emr-state-selected)] pl-3.5"),
        !selected && selectionVariant !== "modulePanel" && "hover:bg-[var(--emr-state-hover)]",
        className
      )}
      data-testid={testId}
      data-selected={selected ? "true" : undefined}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
    >
      {selected && selectionVariant === "accentBar" ? (
        <span
          className="absolute inset-y-0 left-0 w-1 bg-[var(--emr-state-selected-border)]"
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
    <div className="flex h-6 items-center gap-[var(--clair-spacing-12)] overflow-hidden">
      <div className="flex min-w-0 flex-1 items-center gap-[var(--clair-spacing-4)] overflow-hidden">
        {typeBadge}
        <div className="emr-text-body flex min-w-0 flex-1 items-center gap-[var(--clair-spacing-4)] overflow-hidden font-medium text-[var(--emr-sidepanel-task-card-title-text)]">
          <span className="truncate">{patientName}</span>
          <span className="shrink-0 text-[var(--emr-sidepanel-task-card-label-text)]">·</span>
          <span className="truncate">{guardianName}</span>
        </div>
      </div>
      {action}
    </div>
  );
}

export function EmrSidePanelCardAction({
  ariaLabel,
  density,
  items,
  testId,
}: {
  ariaLabel: string;
  density?: EmrRowActionMenuDensity;
  items?: EmrRowActionMenuItem[];
  testId?: string;
}) {
  if (items?.length) {
    return (
      <EmrRowActionMenu
        ariaLabel={ariaLabel}
        density={density}
        items={items}
        testId={testId}
        triggerClassName={emrSidePanelCardActionButtonClassName}
      />
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-xs"
      className={emrSidePanelCardActionButtonClassName}
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
        "emr-text-metadata h-5 shrink-0 rounded-[var(--clair-radius-atomic-6)] border-transparent bg-[var(--emr-sidepanel-task-card-type-bg)] px-[var(--clair-spacing-6)] py-[var(--clair-spacing-2)] font-medium text-[var(--emr-sidepanel-task-card-type-text)]",
        reservation
          ? "bg-[var(--emr-status-info-bg)] text-[var(--emr-status-info-text)]"
          : "bg-[var(--emr-sidepanel-task-card-type-bg)] text-[var(--emr-sidepanel-task-card-type-text)]"
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
        "emr-text-metadata inline-flex h-6 shrink-0 items-center gap-[var(--clair-spacing-2)] rounded-[var(--clair-radius-atomic-6)] border border-[var(--emr-sidepanel-task-card-chip-border)] bg-[var(--emr-sidepanel-task-card-chip-bg)] px-[var(--clair-spacing-6)] py-[var(--clair-spacing-2)] font-medium",
        maxWidthClassName
      )}
    >
      {resolvedIcon ? (
        <span className={sidePanelBadgeIconClassName}>
          {resolvedIcon}
        </span>
      ) : (
        <span className="shrink-0 text-[var(--emr-sidepanel-task-card-label-text)]">{label}</span>
      )}
      <span className="truncate text-[var(--emr-sidepanel-task-card-chip-text)]">{value}</span>
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
        "emr-text-metadata inline-flex h-6 shrink-0 items-center gap-[var(--clair-spacing-2)] rounded-[var(--clair-radius-atomic-6)] border border-[var(--emr-sidepanel-task-card-chip-border)] bg-[var(--emr-sidepanel-task-card-chip-bg)] px-[var(--clair-spacing-6)] py-[var(--clair-spacing-2)] font-medium text-[var(--emr-sidepanel-task-card-chip-text)]",
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
