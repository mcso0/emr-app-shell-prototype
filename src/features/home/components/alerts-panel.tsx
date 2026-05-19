"use client";

import Link from "next/link";
import { BellIcon, InfoIcon, WarningIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { HomePanelCard } from "@/features/home/components/home-panel-card";
import type { HomeAlert } from "@/features/home/home.types";

type AlertsPanelProps = {
  alerts: HomeAlert[];
};

const groups = [
  { severity: "critical", label: "긴급", Icon: WarningIcon },
  { severity: "warning", label: "지연/주의", Icon: BellIcon },
  { severity: "info", label: "참고", Icon: InfoIcon },
] as const;

const groupTone: Record<HomeAlert["severity"], string> = {
  critical: "border-[var(--emr-status-danger-border)] bg-[var(--emr-status-danger-bg)]",
  warning: "border-[var(--emr-status-warning-border)] bg-[var(--emr-status-warning-bg)]",
  info: "border-border bg-card",
};

export function AlertsPanel({ alerts }: AlertsPanelProps) {
  return (
    <HomePanelCard className="gap-0 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold leading-5">알림/예외</h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">중요도별로 접힌 소음 없이 정리합니다.</p>
        </div>
        <Badge variant="outline" className="h-6 rounded-md px-2">
          {alerts.length}
        </Badge>
      </div>

      <div className="mt-3 grid gap-3">
        {groups.map(({ severity, label, Icon }) => {
          const items = alerts.filter((alert) => alert.severity === severity);

          return (
            <section key={severity}>
              <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold leading-4">
                <Icon className="size-3.5" aria-hidden="true" />
                {label}
                <span className="text-muted-foreground">{items.length}</span>
              </div>
              <div className="grid gap-1.5">
                {items.length > 0 ? (
                  items.map((alert) => (
                    <article
                      key={alert.id}
                      className={cn("rounded-[var(--clair-radius-md)] border px-2.5 py-2", groupTone[alert.severity])}
                    >
                      <div className="text-[12px] font-semibold leading-4">{alert.title}</div>
                      {alert.message ? (
                        <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-muted-foreground">
                          {alert.message}
                        </p>
                      ) : null}
                      {alert.actionHref ? (
                        <Link
                          className={cn(buttonVariants({ variant: "ghost", size: "xs" }), "mt-2 h-6 px-1.5")}
                          href={alert.actionHref}
                        >
                          {alert.actionLabel ?? "확인"}
                        </Link>
                      ) : null}
                    </article>
                  ))
                ) : (
                  <div className="rounded-[var(--clair-radius-sm)] border border-dashed border-border px-2.5 py-3 text-[11px] text-muted-foreground">
                    현재 {label} 알림이 없습니다.
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </HomePanelCard>
  );
}
