"use client";

import type { ReactNode } from "react";
import { CdsFilesClockIcon } from "@/components/cds-icons/files-and-layout";
import { EmrEmptyState } from "@/components/emr/empty-state";
import { EmrInlineAlert } from "@/components/emr/inline-alert";
import { EmrRowActionMenu } from "@/components/emr/row-action-menu";
import { EmrQueueLoadingState } from "@/components/emr/subpanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type ProfileWorkCategory = "lab" | "imaging" | "procedure" | "other";
export type ProfileFulfillmentStatus =
  | "requested"
  | "in_progress"
  | "paused"
  | "completed"
  | "cancelled"
  | "returned";

export type ProfileAssignedWorkItem = {
  category: ProfileWorkCategory;
  categoryLabel: string;
  id: string;
  guardianName?: string;
  href?: string | null;
  navigationAvailable?: boolean;
  patientName?: string;
  requestedAtLabel: string;
  requestedByName?: string;
  status: ProfileFulfillmentStatus;
  statusLabel: string;
  subtitle?: string;
  title: string;
};

export type ProfileWorkDateGroup = {
  dateLabel: string;
  items: ProfileAssignedWorkItem[];
};

const categoryTone: Record<ProfileWorkCategory, string> = {
  lab: "bg-[var(--emr-status-info-bg)] text-[var(--emr-status-info-text)]",
  imaging: "bg-[var(--clair-color-atomic-purple-50)] text-[var(--clair-color-atomic-purple-700)]",
  procedure: "bg-[var(--emr-status-warning-bg)] text-[var(--emr-status-warning-text)]",
  other: "bg-[var(--emr-surface-muted)] text-[var(--emr-text-secondary)]",
};

const statusTone: Record<ProfileFulfillmentStatus, string> = {
  requested: "bg-[var(--emr-surface-muted)] text-[var(--emr-text-secondary)]",
  in_progress: "bg-[var(--emr-status-warning-bg)] text-[var(--emr-status-warning-text)]",
  paused: "bg-[var(--emr-status-info-bg)] text-[var(--emr-status-info-text)]",
  completed: "bg-[var(--emr-status-success-bg)] text-[var(--emr-status-success-text)]",
  cancelled: "bg-[var(--emr-status-danger-bg)] text-[var(--emr-status-danger-text)]",
  returned: "bg-[var(--emr-status-warning-bg)] text-[var(--emr-status-warning-text)]",
};

export function WorkCategoryBadge({
  category,
  children,
}: {
  category: ProfileWorkCategory;
  children: ReactNode;
}) {
  return (
    <Badge className={cn("border-0", categoryTone[category])} data-work-category={category}>
      {children}
    </Badge>
  );
}

export function FulfillmentStatusBadge({
  children,
  status,
}: {
  children: ReactNode;
  status: ProfileFulfillmentStatus;
}) {
  return (
    <Badge className={cn("border-0", statusTone[status])} data-fulfillment-status={status}>
      {children}
    </Badge>
  );
}

export function ProfileAssignedWorkCard({
  item,
  onRequestNavigation,
}: {
  item: ProfileAssignedWorkItem;
  onRequestNavigation: (item: ProfileAssignedWorkItem) => void;
}) {
  return (
    <article
      className="rounded-[var(--clair-radius-atomic-10)] border border-[var(--emr-border-default)] bg-[var(--emr-surface-panel)] p-3 shadow-[var(--clair-shadow-xs)]"
      data-work-item-id={item.id}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <WorkCategoryBadge category={item.category}>{item.categoryLabel}</WorkCategoryBadge>
          <FulfillmentStatusBadge status={item.status}>{item.statusLabel}</FulfillmentStatusBadge>
        </div>
        <EmrRowActionMenu
          ariaLabel={`${item.title} 더보기`}
          density="compact"
          items={[
            {
              key: "navigate",
              label: "업무 보러가기",
              disabled:
                item.navigationAvailable === false || item.href === null,
              onSelect: () => onRequestNavigation(item),
            },
          ]}
        />
      </div>
      <h4 className="mt-2 truncate text-sm font-semibold text-[var(--emr-text-primary)]">
        {item.title}
      </h4>
      {item.subtitle ? (
        <p className="mt-1 line-clamp-2 text-sm text-[var(--emr-text-secondary)]">{item.subtitle}</p>
      ) : null}
      {item.patientName || item.guardianName ? (
        <p className="mt-2 truncate text-xs text-[var(--emr-text-secondary)]">
          {[item.patientName, item.guardianName].filter(Boolean).join(" · ")}
        </p>
      ) : null}
      <p className="mt-1 truncate text-xs text-[var(--emr-text-tertiary)]">
        요청자 {item.requestedByName || "미등록"}
      </p>
      <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--emr-text-tertiary)]">
        <CdsFilesClockIcon aria-hidden="true" className="size-3.5" />
        {item.requestedAtLabel}
      </p>
    </article>
  );
}

export function StaffWorkTimeline({
  groups,
  onRequestNavigation,
}: {
  groups: ProfileWorkDateGroup[];
  onRequestNavigation: (item: ProfileAssignedWorkItem) => void;
}) {
  return (
    <div className="grid gap-5">
      {groups.map((group) => (
        <section className="relative pl-4" key={group.dateLabel}>
          <span
            aria-hidden="true"
            className="absolute bottom-0 left-0 top-7 w-px bg-[var(--emr-border-default)]"
            data-timeline-line
          />
          <h3 className="mb-2 text-sm font-semibold text-[var(--emr-text-secondary)]">
            {group.dateLabel}
          </h3>
          <div className="grid gap-2">
            {group.items.map((item) => (
              <ProfileAssignedWorkCard
                item={item}
                key={item.id}
                onRequestNavigation={onRequestNavigation}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export type ProfileWorkStatusState = "loading" | "ready" | "empty" | "error";

export function ProfileWorkStatusTab({
  groups,
  hasNextPage = false,
  loadingNextPage = false,
  nextPageError = false,
  onLoadMore,
  onRetryNextPage,
  onRequestNavigation,
  onRetry,
  state,
}: {
  groups: ProfileWorkDateGroup[];
  hasNextPage?: boolean;
  loadingNextPage?: boolean;
  nextPageError?: boolean;
  onLoadMore?: () => void;
  onRetryNextPage?: () => void;
  onRequestNavigation: (item: ProfileAssignedWorkItem) => void;
  onRetry?: () => void;
  state: ProfileWorkStatusState;
}) {
  if (state === "loading") {
    return <EmrQueueLoadingState title="배정된 업무를 불러오는 중입니다" />;
  }

  if (state === "empty") {
    return (
      <div className="flex min-h-[260px] items-center justify-center px-4">
        <EmrEmptyState
          kind="no-data"
          size="md"
          surface="queue"
          title="배정된 업무가 없어요"
          description="현재 이 구성원에게 배정된 업무가 없습니다."
        />
      </div>
    );
  }

  if (state === "error") {
    return (
      <EmrInlineAlert
        severity="error"
        title="업무 현황을 불러오지 못했어요"
        action={
          onRetry ? (
            <Button type="button" size="sm" variant="outline" onClick={onRetry}>
              다시 시도
            </Button>
          ) : undefined
        }
      >
        잠시 후 다시 확인해 주세요.
      </EmrInlineAlert>
    );
  }

  return (
    <div className="grid gap-4">
      <StaffWorkTimeline groups={groups} onRequestNavigation={onRequestNavigation} />
      {nextPageError ? (
        <EmrInlineAlert
          severity="error"
          title="이전 업무를 더 불러오지 못했어요"
          action={
            onRetryNextPage ? (
              <Button type="button" size="sm" variant="outline" onClick={onRetryNextPage}>
                다시 시도
              </Button>
            ) : undefined
          }
        >
          이미 불러온 업무는 그대로 유지돼요.
        </EmrInlineAlert>
      ) : null}
      {hasNextPage ? (
        <Button
          type="button"
          variant="outline"
          disabled={loadingNextPage}
          onClick={onLoadMore}
        >
          {loadingNextPage ? "불러오는 중" : "이전 업무 더보기"}
        </Button>
      ) : null}
    </div>
  );
}

export function WorkNavigationDialog({
  item,
  onConfirm,
  onOpenChange,
  open,
}: {
  item: ProfileAssignedWorkItem | null;
  onConfirm: (item: ProfileAssignedWorkItem) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>업무 화면으로 이동할까요?</DialogTitle>
          <DialogDescription>
            {item
              ? [item.patientName, item.guardianName, item.title]
                  .filter(Boolean)
                  .join(" · ") + " 업무 화면을 엽니다."
              : "선택한 업무 화면을 엽니다."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>취소</DialogClose>
          <Button type="button" disabled={!item} onClick={() => item && onConfirm(item)}>
            이동
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
