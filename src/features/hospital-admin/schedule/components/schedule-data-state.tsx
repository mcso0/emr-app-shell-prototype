import { EmrEmptyState } from "@/components/emr/empty-state";
import { EmrInlineAlert } from "@/components/emr/inline-alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function ScheduleDataState({
  onCreateDraft,
  onRetry,
  state,
}: {
  onCreateDraft?: () => void;
  onRetry?: () => void;
  state: "loading" | "empty" | "error" | "read-only";
}) {
  if (state === "loading") {
    return (
      <div
        className="overflow-hidden rounded-xl border bg-card"
        role="status"
        aria-busy="true"
        aria-live="polite"
      >
        <div className="h-1 overflow-hidden bg-muted">
          <div className="h-full w-full animate-pulse bg-primary/70 motion-reduce:animate-none" />
        </div>
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <p className="text-sm font-medium">근무표를 불러오고 있습니다</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              직원과 최신 게시 상태를 확인하는 중입니다.
            </p>
          </div>
          <span className="text-xs text-muted-foreground">
            잠시만 기다려 주세요
          </span>
        </div>
        <div className="grid grid-cols-[var(--emr-schedule-grid-staff-column)_repeat(5,minmax(7rem,1fr))] gap-px bg-border p-px">
          {Array.from({ length: 18 }, (_, index) => (
            <div key={index} className="min-h-16 bg-card p-3">
              <Skeleton
                className={index % 6 === 0 ? "h-4 w-20" : "h-8 w-full"}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <EmrInlineAlert
        severity="error"
        title="근무표를 불러오지 못했습니다"
        action={
          onRetry ? (
            <Button size="sm" variant="outline" onClick={onRetry}>
              다시 시도
            </Button>
          ) : undefined
        }
      >
        세션과 네트워크를 확인한 뒤 다시 불러와 주세요.
      </EmrInlineAlert>
    );
  }

  if (state === "read-only") {
    return (
      <EmrInlineAlert severity="info" title="현재 게시된 근무표입니다">
        내용을 바꾸려면 근무표 편집을 시작해 주세요. 편집 중인 변경은 다시
        게시하기 전까지 직원 화면에 보이지 않습니다.
      </EmrInlineAlert>
    );
  }

  return (
    <div className="flex min-h-80 flex-col items-center justify-center rounded-xl border border-dashed bg-card p-6 text-center">
      <EmrEmptyState
        kind="no-data"
        priority="primary-decision"
        surface="content"
        size="lg"
        title="이번 주 근무가 아직 없습니다"
        description="근무표 편집을 시작해 근무·휴무·휴가를 입력해 주세요."
        primaryAction={
          onCreateDraft ? (
            <Button onClick={onCreateDraft}>근무표 편집</Button>
          ) : undefined
        }
      />
    </div>
  );
}
