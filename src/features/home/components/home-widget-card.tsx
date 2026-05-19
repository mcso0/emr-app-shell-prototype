"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { HomePanelCard } from "@/features/home/components/home-panel-card";
import type { HomePriority, HomeWidget } from "@/features/home/home.types";

type HomeWidgetCardProps = {
  widget: HomeWidget;
};

const itemPriorityTone: Record<HomePriority, string> = {
  critical: "bg-[var(--emr-status-danger-bg)] text-[var(--emr-status-danger-text)]",
  high: "bg-[var(--emr-status-warning-bg)] text-[var(--emr-status-warning-text)]",
  medium: "bg-[var(--emr-status-info-bg)] text-[var(--emr-status-info-text)]",
  normal: "bg-[var(--emr-status-info-bg)] text-[var(--emr-status-info-text)]",
  urgent: "bg-[var(--emr-status-danger-bg)] text-[var(--emr-status-danger-text)]",
  low: "bg-[var(--emr-surface-muted)] text-muted-foreground",
};

export function HomeWidgetCard({ widget }: HomeWidgetCardProps) {
  return (
    <HomePanelCard className="min-h-[188px] gap-0 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-[14px] font-semibold leading-5">{widget.title}</h3>
          {widget.description ? (
            <p className="mt-1 line-clamp-2 text-[12px] leading-4 text-muted-foreground">
              {widget.description}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {widget.value ? (
            <span className="text-[18px] font-semibold leading-6 text-foreground">{widget.value}</span>
          ) : null}
          {widget.badge ? (
            <Badge variant="outline" className="h-5 rounded-md px-1.5 text-[11px]">
              {widget.badge}
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="mt-3 grid gap-1.5">
        {widget.items.length > 0 ? (
          widget.items.slice(0, 4).map((item) => (
            <div
              key={item.id}
              className="flex min-h-9 items-center justify-between gap-3 rounded-[var(--clair-radius-sm)] bg-[var(--emr-surface-muted)] px-2.5 py-1.5"
            >
              <div className="min-w-0">
                <div className="truncate text-[12px] font-medium leading-4 text-foreground">
                  {item.title}
                </div>
                {item.meta ? (
                  <div className="truncate text-[11px] leading-4 text-muted-foreground">
                    {item.meta}
                  </div>
                ) : null}
              </div>
              <div className="shrink-0 text-right">
                {item.value ? (
                  <div className="text-[12px] font-semibold leading-4">{item.value}</div>
                ) : null}
                {item.status ? (
                  <div className="text-[11px] leading-4 text-muted-foreground">{item.status}</div>
                ) : null}
                {item.priority ? (
                  <span
                    className={cn(
                      "inline-flex h-5 items-center rounded-md px-1.5 text-[11px] font-medium",
                      itemPriorityTone[item.priority]
                    )}
                  >
                    {item.priority === "critical" ? "긴급" : item.priority === "high" ? "주의" : "확인"}
                  </span>
                ) : null}
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-[var(--clair-radius-sm)] border border-dashed border-border px-3 py-4 text-center text-[12px] text-muted-foreground">
            {widget.emptyState ?? "표시할 항목이 없습니다."}
          </div>
        )}
      </div>

      {widget.primaryAction ? (
        <div className="mt-3">
          <Link
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full")}
            href={widget.primaryAction.href}
          >
            {widget.primaryAction.label}
          </Link>
        </div>
      ) : null}
    </HomePanelCard>
  );
}
