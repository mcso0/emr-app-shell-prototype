"use client";

import Link from "next/link";
import { ChevronRightIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { HomeFlowSummaryItem } from "@/features/home/home.types";

type CompactFlowSummaryProps = {
  items: HomeFlowSummaryItem[];
  updatedAt: string;
};

const toneClass: Record<NonNullable<HomeFlowSummaryItem["tone"]>, string> = {
  attention:
    "border-[var(--clair-color-atomic-red-200)] bg-[var(--clair-color-atomic-red-50)] text-[var(--clair-color-atomic-red-600)]",
  normal:
    "border-[var(--clair-color-atomic-sky-100)] bg-[var(--clair-color-atomic-sky-50)] text-[var(--clair-color-primary-normal)]",
  warning:
    "border-[var(--clair-color-atomic-orange-200)] bg-[var(--clair-color-atomic-orange-50)] text-[var(--clair-color-atomic-orange-600)]",
};

function getUpdatedAtLabel(value: string) {
  return value.slice(11, 16);
}

export function CompactFlowSummary({ items, updatedAt }: CompactFlowSummaryProps) {
  return (
    <aside
      data-testid="home-flow-summary-panel"
      className="w-full rounded-[var(--clair-radius-md)] border border-border bg-white p-4 lg:h-full lg:min-h-[420px]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold leading-5">병원 흐름 요약</h2>
          <p className="mt-1 text-[12px] text-muted-foreground">
            현재 업무 진입에 필요한 최소 현황
          </p>
        </div>
        <Badge variant="outline" className="h-6 rounded-md px-2 text-[11px]">
          {getUpdatedAtLabel(updatedAt)} 갱신
        </Badge>
      </div>

      <div className="mt-4 grid gap-2">
        {items.map((item) => (
          <Link
            key={item.id}
            className="group flex items-center justify-between gap-3 rounded-[var(--clair-radius-md)] border border-border bg-card px-3 py-2 transition-colors hover:bg-selection"
            href={item.href}
          >
            <span className="min-w-0">
              <span className="block text-[13px] font-medium leading-5 text-foreground">
                {item.label}
              </span>
              {item.detail ? (
                <span
                  className={cn(
                    "mt-1 inline-flex rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
                    toneClass[item.tone ?? "normal"]
                  )}
                >
                  {item.detail}
                </span>
              ) : null}
            </span>
            <span className="inline-flex shrink-0 items-center gap-1">
              <span className="text-[18px] font-semibold leading-6 text-foreground">
                {item.count}
              </span>
              <ChevronRightIcon
                className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </span>
          </Link>
        ))}
      </div>
    </aside>
  );
}
