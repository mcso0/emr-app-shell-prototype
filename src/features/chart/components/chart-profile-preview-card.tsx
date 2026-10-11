"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ChartProfilePreviewItem = {
  label: string;
  value?: ReactNode;
};

export function ChartProfilePreviewCard({
  onOpenProfile,
  items,
  kind,
  notes = [],
  title,
}: {
  onOpenProfile: () => void;
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
        <Button
          type="button"
          variant="outline"
          size="xs"
          className="shrink-0"
          onClick={onOpenProfile}
        >
          프로필 보기
        </Button>
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
        <div className="grid gap-1 rounded-md bg-[var(--emr-surface-muted)] px-2.5 py-2 text-xs leading-5 text-[var(--emr-text-secondary)]">
          {notes.map((note, index) => (
            <p key={`${note}-${index}`}>{note}</p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
