"use client";

import Link from "next/link";
import { ClockIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  HomeTask,
  HomeTaskDomain,
  HomeTaskPriority,
} from "@/features/home/home.types";

type TaskListItemProps = {
  task: HomeTask;
};

const priorityTone: Record<HomeTaskPriority, string> = {
  urgent:
    "border-[var(--emr-status-danger-border)] bg-[var(--emr-status-danger-bg)] text-[var(--emr-status-danger-text)]",
  high:
    "border-[var(--emr-status-warning-border)] bg-[var(--emr-status-warning-bg)] text-[var(--emr-status-warning-text)]",
  normal:
    "border-[var(--emr-status-info-border)] bg-[var(--emr-status-info-bg)] text-[var(--emr-status-info-text)]",
  low: "border-border bg-card text-muted-foreground",
};

const priorityLabel: Record<HomeTaskPriority, string> = {
  urgent: "긴급",
  high: "높음",
  normal: "보통",
  low: "낮음",
};

const domainLabel: Record<HomeTaskDomain, string> = {
  appointment: "예약",
  billing: "수납",
  chart: "진료",
  dispensing: "조제/처치",
  imaging: "영상",
  inpatient: "입원",
  lab: "검사",
  reception: "접수",
  treatment: "처치",
};

function getTimeLabel(value?: string) {
  if (!value) return "기한 없음";

  return value.slice(11, 16);
}

export function TaskListItem({ task }: TaskListItemProps) {
  const context = [task.patientName, task.clientName, task.encounterLabel]
    .filter(Boolean)
    .join(" · ");
  const source = [task.roleQueueLabel, task.sourceLabel, task.requestedBy ? `${task.requestedBy} 요청` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="rounded-[var(--clair-radius-md)] border border-border bg-card px-3.5 py-3">
      <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge
              variant="outline"
              className={cn("h-5 rounded-md px-1.5 text-[11px]", priorityTone[task.priority])}
            >
              {priorityLabel[task.priority]}
            </Badge>
            <Badge variant="outline" className="h-5 rounded-md px-1.5 text-[11px] text-muted-foreground">
              {domainLabel[task.domain]}
            </Badge>
            {task.assignment === "roleQueue" ? (
              <Badge
                variant="outline"
                className="h-5 rounded-md border-[var(--emr-status-info-border)] bg-[var(--emr-status-info-bg)] px-1.5 text-[11px] text-[var(--emr-status-info-text)]"
              >
                미배정 큐
              </Badge>
            ) : null}
          </div>
          <h3 className="mt-2 text-[14px] font-semibold leading-5 text-foreground">
            {task.title}
          </h3>
          {context ? (
            <p className="mt-0.5 text-[12px] leading-4 text-muted-foreground">{context}</p>
          ) : null}
          <p className="mt-1 text-[12px] leading-4 text-muted-foreground">{source}</p>
          <p className="mt-2 text-[12px] leading-5 text-foreground">
            <span className="font-semibold">추천: </span>
            {task.recommendedAction}
          </p>
        </div>
        <div className="flex shrink-0 items-center justify-between gap-2 md:flex-col md:items-end">
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <ClockIcon className="size-3" aria-hidden="true" />
            {getTimeLabel(task.dueAt)}
          </span>
          <Link
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-7")}
            href={task.actionHref}
          >
            {task.actionLabel}
          </Link>
        </div>
      </div>
    </article>
  );
}
