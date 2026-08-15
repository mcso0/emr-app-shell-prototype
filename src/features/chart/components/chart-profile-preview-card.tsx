"use client";

import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type ChartProfilePreviewItem = {
  label: string;
  value?: ReactNode;
};

export function ChartProfilePreviewCard({
  badge,
  items,
  kind,
  notes = [],
  title,
}: {
  badge: string;
  items: ChartProfilePreviewItem[];
  kind: "patient" | "guardian";
  notes?: string[];
  title: string;
}) {
  return (
    <div
      data-slot={`chart-${kind}-profile-preview`}
      className="grid gap-3"
    >
      <div className="flex min-w-0 items-center justify-between gap-3">
        <strong className="min-w-0 truncate text-sm font-semibold text-foreground">
          {title}
        </strong>
        <Badge
          variant="secondary"
          className="h-[22px] shrink-0 rounded-md px-2 text-xs font-medium"
        >
          {badge}
        </Badge>
      </div>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 text-xs leading-5">
        {items.map((item) => (
          <div className="contents" key={item.label}>
            <dt className="text-[var(--emr-text-tertiary)]">{item.label}</dt>
            <dd
              className={cn(
                "min-w-0 break-words font-medium text-[var(--emr-text-secondary)]",
                item.value === undefined && "text-[var(--emr-text-placeholder)]",
              )}
            >
              {item.value ?? "미입력"}
            </dd>
          </div>
        ))}
      </dl>
      {notes.length ? (
        <div className="grid gap-1 rounded-md bg-[var(--emr-status-warning-bg)] px-2.5 py-2 text-xs leading-5 text-[var(--emr-status-warning-text)]">
          {notes.map((note, index) => (
            <p key={`${note}-${index}`}>{note}</p>
          ))}
        </div>
      ) : null}
      <p className="border-t border-[var(--emr-line-subtle)] pt-2 text-[11px] leading-4 text-[var(--emr-text-tertiary)]">
        클릭하면 전체 프로필을 열어요.
      </p>
    </div>
  );
}
