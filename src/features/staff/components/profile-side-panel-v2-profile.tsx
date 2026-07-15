"use client";

import { CdsFilesCalendarIcon } from "@/components/cds-icons/files-and-layout";
import { EmrInlineAlert } from "@/components/emr/inline-alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export type ProfileAvailabilityState = "loading" | "ready" | "empty" | "error";

export function ProfileAvailabilitySummary({
  eventLabel,
  onRetry,
  returnLabel,
  state,
}: {
  eventLabel?: string;
  onRetry?: () => void;
  returnLabel?: string;
  state: ProfileAvailabilityState;
}) {
  if (state === "loading") {
    return (
      <section aria-label="근무 가능 일정 불러오는 중" className="rounded-xl border p-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-3 h-5 w-40" />
        <Skeleton className="mt-2 h-4 w-32" />
      </section>
    );
  }

  if (state === "error") {
    return (
      <EmrInlineAlert
        severity="error"
        title="근무 가능 일정을 불러오지 못했어요"
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
    <section className="rounded-xl border border-[var(--emr-border-default)] bg-[var(--emr-surface-panel)] p-3">
      <div className="flex items-center gap-2 text-sm font-medium text-[var(--emr-text-secondary)]">
        <CdsFilesCalendarIcon aria-hidden="true" className="size-4 text-[var(--emr-text-tertiary)]" />
        예정된 휴무와 복귀
      </div>
      {state === "empty" ? (
        <p className="mt-3 text-sm text-[var(--emr-text-placeholder)]">예정된 휴무가 없어요</p>
      ) : (
        <dl className="mt-3 grid gap-2 text-sm">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-[var(--emr-text-tertiary)]">다음 휴무</dt>
            <dd className="text-right font-medium text-[var(--emr-text-primary)]">{eventLabel}</dd>
          </div>
          {returnLabel ? (
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-[var(--emr-text-tertiary)]">다음 근무</dt>
              <dd className="text-right font-medium text-[var(--emr-text-primary)]">{returnLabel}</dd>
            </div>
          ) : null}
        </dl>
      )}
    </section>
  );
}
