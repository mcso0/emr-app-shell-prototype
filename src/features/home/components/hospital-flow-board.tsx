"use client";

import Link from "next/link";
import { ChevronRightIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { HospitalFlowItem } from "@/features/home/home.types";

type HospitalFlowBoardProps = {
  items: HospitalFlowItem[];
};

export function HospitalFlowBoard({ items }: HospitalFlowBoardProps) {
  return (
    <section className="rounded-[var(--clair-radius-md)] border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold leading-5">병원 전체 흐름</h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            예약부터 수납 완료까지 현재 병목을 한 줄로 확인합니다.
          </p>
        </div>
        <Badge variant="outline" className="h-6 rounded-md px-2">
          updated 09:42
        </Badge>
      </div>

      <div className="mt-3 overflow-x-auto pb-1">
        <div className="grid min-w-[920px] grid-cols-10 gap-2">
          {items.map((item) => {
            const hasDelay = Boolean(item.delayedCount && item.delayedCount > 0);

            return (
              <Link
                key={item.status}
                href={item.actionHref ?? "/w/clair-demo/home"}
                className={cn(
                  "group flex min-h-[126px] flex-col justify-between rounded-[var(--clair-radius-md)] border p-2.5 transition-colors hover:bg-[var(--emr-state-hover)]",
                  hasDelay
                    ? "border-[var(--emr-status-warning-border)] bg-[var(--emr-status-warning-bg)]"
                    : "border-border bg-card"
                )}
              >
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate text-[12px] font-semibold leading-4">
                      {item.label}
                    </span>
                    <ChevronRightIcon className="size-3 text-muted-foreground" aria-hidden="true" />
                  </div>
                  <div className="mt-2 text-[26px] font-semibold leading-8">{item.count}</div>
                </div>
                <div className="grid gap-1 text-[11px] leading-4 text-muted-foreground">
                  {typeof item.averageWaitMinutes === "number" ? (
                    <span>평균 {item.averageWaitMinutes}분</span>
                  ) : null}
                  {hasDelay ? (
                    <span className="font-semibold text-[var(--emr-status-warning-text)]">
                      지연 {item.delayedCount}건
                    </span>
                  ) : (
                    <span>지연 없음</span>
                  )}
                  {item.topIssue ? <span className="line-clamp-2">{item.topIssue}</span> : null}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
