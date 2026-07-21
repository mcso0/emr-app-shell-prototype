import { EmrConfirmDialogContent } from "@/components/emr/confirm-dialog-content";
import { Dialog } from "@/components/ui/dialog";
import type { HospitalScheduleIssue } from "../revision-types";

export function SchedulePublishReviewDialog({
  issues,
  onOpenChange,
  onPublish,
  open,
  publishing,
}: {
  issues: HospitalScheduleIssue[];
  onOpenChange: (open: boolean) => void;
  onPublish: () => Promise<void>;
  open: boolean;
  publishing: boolean;
}) {
  const blockers = issues.filter((issue) => issue.severity === "blocker");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <EmrConfirmDialogContent
        title="게시 전 검토"
        description={
          <div className="space-y-3">
            <p>게시하면 이 주의 최신 리비전이 직원 프로필과 운영 화면의 기준이 돼.</p>
            {blockers.length ? (
              <ul className="max-h-48 space-y-2 overflow-y-auto rounded-lg border bg-muted/30 p-3 text-sm">
                {blockers.map((issue, index) => (
                  <li key={`${issue.code}-${issue.entryId ?? index}`}>{issue.message}</li>
                ))}
              </ul>
            ) : (
              <p className="rounded-lg border bg-[var(--emr-schedule-shift-reception-bg)] p-3 text-sm text-[var(--emr-schedule-shift-reception-text)]">
                현재 저장된 검증 이슈가 없어. 게시 직전에 서버가 한 번 더 검증해.
              </p>
            )}
          </div>
        }
        cancelLabel="취소"
        confirmLabel={publishing ? "게시 중" : "게시하기"}
        confirmDisabled={publishing || blockers.length > 0}
        onCancel={() => onOpenChange(false)}
        onConfirm={() => void onPublish()}
      />
    </Dialog>
  );
}
