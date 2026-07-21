import { EmrEmptyState } from "@/components/emr/empty-state";
import { EmrInlineAlert } from "@/components/emr/inline-alert";
import { Button } from "@/components/ui/button";

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
      <div className="flex min-h-80 items-center justify-center rounded-xl border border-dashed bg-card p-6 text-sm text-muted-foreground">
        근무표를 불러오는 중이야.
      </div>
    );
  }

  if (state === "error") {
    return (
      <EmrInlineAlert
        severity="error"
        title="근무표를 불러오지 못했어"
        action={onRetry ? <Button size="sm" variant="outline" onClick={onRetry}>다시 시도</Button> : undefined}
      >
        세션과 네트워크를 확인한 뒤 다시 불러와줘.
      </EmrInlineAlert>
    );
  }

  if (state === "read-only") {
    return (
      <EmrInlineAlert severity="info" title="게시본을 보고 있어">
        변경하려면 초안을 시작해줘. 게시본 자체는 수정할 수 없어.
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
        title="등록된 근무가 없어"
        description="초안을 시작해 이번 주 근무·휴무·휴가를 편성해줘."
        primaryAction={onCreateDraft ? <Button onClick={onCreateDraft}>초안 시작</Button> : undefined}
      />
    </div>
  );
}
