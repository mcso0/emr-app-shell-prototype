"use client";

import { EmrInlineAlert } from "@/components/emr/inline-alert";
import { Button } from "@/components/ui/button";
import { EmrMeasuredLoading } from "@/components/emr/measured-loading";

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
    return <EmrMeasuredLoading label="다가오는 일정 불러오는 중">
      <ProfileAvailabilitySummary state="ready" eventLabel="1월 2일 휴무" returnLabel="1월 3일 복귀" />
    </EmrMeasuredLoading>;
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

  if (state === "empty") {
    return (
      <section className="flex h-[70px] items-center justify-center rounded-xl border border-[var(--emr-border-default)] px-4">
        <p className="text-sm font-medium tracking-[0.014em] text-[var(--emr-text-placeholder)]">
          예정된 일정이 없습니다
        </p>
      </section>
    );
  }

  return (
    <section className="flex h-[70px] items-center gap-4 rounded-xl border border-[var(--emr-border-default)] px-4 py-[14px]">
      <CalendarDateTile label={eventLabel} />
      <div className="min-w-0">
        <p className="truncate text-base leading-6 font-semibold tracking-[0.006em] text-[var(--emr-text-primary)]">
          {getAvailabilityTitle(eventLabel)}
        </p>
        <p className="truncate text-sm leading-[18px] font-medium tracking-[0.014em] text-[var(--emr-text-secondary)]">
          {returnLabel ?? getAvailabilityDateLabel(eventLabel)}
        </p>
      </div>
    </section>
  );
}

function CalendarDateTile({ label }: { label?: string }) {
  const day = getAvailabilityDay(label);
  return (
    <div
      aria-hidden="true"
      className="grid size-[42px] shrink-0 overflow-hidden rounded-md border border-[var(--emr-border-default)] bg-[var(--emr-surface-panel)]"
    >
      <span className="h-3 bg-[var(--emr-surface-muted)]" />
      <span className="flex items-center justify-center pb-0.5 text-base leading-4 font-semibold tabular-nums text-[var(--clair-color-atomic-sky-500)]">
        {day}
      </span>
    </div>
  );
}

function getAvailabilityDay(label: string | undefined) {
  const match = label?.match(/(\d{1,2})일/);
  return match?.[1] ?? "-";
}

function getAvailabilityDateLabel(label: string | undefined) {
  return label?.replace(/\s+(휴가|휴무)$/, "") ?? "일정 정보 확인 중";
}

function getAvailabilityTitle(label: string | undefined) {
  if (label?.endsWith("휴가")) return "휴가";
  if (label?.endsWith("휴무")) return "휴무";
  return "다가오는 일정";
}
