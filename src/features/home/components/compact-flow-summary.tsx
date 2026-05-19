"use client";

import Link from "next/link";
import { ChevronRightIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { HomePanelCard } from "@/features/home/components/home-panel-card";
import type { HomeFlowSummaryItem } from "@/features/home/home.types";

type CompactFlowSummaryProps = {
  items: HomeFlowSummaryItem[];
  updatedAt: string;
};

const toneClass: Record<NonNullable<HomeFlowSummaryItem["tone"]>, string> = {
  attention:
    "border-[var(--emr-status-danger-border)] bg-[var(--emr-status-danger-bg)] text-[var(--emr-status-danger-text)]",
  normal:
    "border-[var(--emr-status-info-border)] bg-[var(--emr-status-info-bg)] text-[var(--emr-status-info-text)]",
  warning:
    "border-[var(--emr-status-warning-border)] bg-[var(--emr-status-warning-bg)] text-[var(--emr-status-warning-text)]",
};

function getUpdatedAtLabel(value: string) {
  return value.slice(11, 16);
}

export function CompactFlowSummary({ items, updatedAt }: CompactFlowSummaryProps) {
  return (
    <HomePanelCard
      data-testid="home-flow-summary-panel"
      className="w-full gap-0 p-4 lg:h-full lg:min-h-[420px]"
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
    </HomePanelCard>
  );
}
