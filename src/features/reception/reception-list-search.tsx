"use client";

import type * as React from "react";
import { CdsActionsSearchIcon } from "@/components/cds-icons/actions-and-controls";
import { CircleCloseFillIcon } from "@/components/icons";
import { EmrQueueEmptyState } from "@/components/emr/subpanel";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type ReceptionSearchInputProps = {
  "aria-label": string;
  className?: string;
  clearLabel?: string;
  inputClassName?: string;
  placeholder: string;
  value: string;
  onValueChange: (value: string) => void;
};

export function ReceptionSearchInput({
  "aria-label": ariaLabel,
  className,
  clearLabel = "검색어 초기화",
  inputClassName,
  placeholder,
  value,
  onValueChange,
}: ReceptionSearchInputProps) {
  return (
    <div className={cn("relative", className)}>
      <CdsActionsSearchIcon
        className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        aria-label={ariaLabel}
        className={cn("pl-8", value ? "pr-8" : "pr-3", inputClassName)}
        placeholder={placeholder}
        value={value}
        onValueChange={onValueChange}
      />
      {value ? (
        <button
          type="button"
          className="absolute right-2 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:text-[var(--emr-text-secondary)] focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-label={clearLabel}
          onClick={() => onValueChange("")}
        >
          <CircleCloseFillIcon className="size-4" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

type ReceptionPanelStateMessageProps = {
  children: React.ReactNode;
  tone?: "danger" | "muted" | "warning";
};

export function ReceptionPanelStateMessage({
  children,
  tone = "muted",
}: ReceptionPanelStateMessageProps) {
  return (
    <div
      className={cn(
        "border-b px-4 py-2 emr-text-metadata font-medium",
        tone === "danger" && "border-[var(--emr-status-danger-border)] bg-[var(--emr-status-danger-bg)] text-[var(--emr-status-danger-text)]",
        tone === "muted" && "border-[var(--emr-line-subtle)] bg-muted/50 text-muted-foreground",
        tone === "warning" && "border-[var(--emr-status-warning-border)] bg-[var(--emr-status-warning-bg)] text-[var(--emr-status-warning-text)]"
      )}
    >
      {children}
    </div>
  );
}

export function ReceptionEmptyState({ children }: { children: React.ReactNode }) {
  return (
    <EmrQueueEmptyState iconClassName="mb-1.5">{children}</EmrQueueEmptyState>
  );
}
