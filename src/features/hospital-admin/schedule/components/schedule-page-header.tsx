import { EmrPageHeader } from "@/components/emr/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { HospitalScheduleRevision } from "../revision-types";

export function SchedulePageHeader({
  busy,
  dataState,
  draftRevision,
  hasPublishedRevision,
  onCreateDraft,
  onOpenEditor,
  onPublish,
}: {
  busy: boolean;
  dataState: "loading" | "ready" | "empty" | "error" | "read-only";
  draftRevision: HospitalScheduleRevision | null;
  hasPublishedRevision: boolean;
  onCreateDraft: () => void;
  onOpenEditor: () => void;
  onPublish: () => void;
}) {
  const status =
    dataState === "loading"
      ? "불러오는 중"
      : draftRevision
        ? "편집 중"
        : hasPublishedRevision
          ? "게시됨"
          : "미게시";

  return (
    <header className="sticky top-0 z-10 border-b bg-card px-4 py-4 md:px-6">
      <p className="emr-text-metadata text-muted-foreground">
        병원관리 / 인력 운영
      </p>
      <EmrPageHeader
        className="mt-1"
        title="근무표"
        badge={
          <Badge
            variant="outline"
            className={
              dataState === "loading"
                ? "border-border bg-muted text-muted-foreground"
                : draftRevision
                  ? "border-[var(--emr-schedule-shift-leave-border)] bg-[var(--emr-schedule-shift-leave-bg)] text-[var(--emr-schedule-shift-leave-text)]"
                  : "border-[var(--emr-schedule-shift-reception-border)] bg-[var(--emr-schedule-shift-reception-bg)] text-[var(--emr-schedule-shift-reception-text)]"
            }
          >
            {status}
          </Badge>
        }
        actions={
          <>
            {draftRevision ? (
              <Button size="sm" onClick={onOpenEditor} disabled={busy}>
                + 근무
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={onCreateDraft}
                disabled={
                  busy || dataState === "loading" || dataState === "error"
                }
              >
                {busy ? "준비 중" : "근무표 편집"}
              </Button>
            )}
            <Button
              size="sm"
              variant={draftRevision ? "default" : "outline"}
              onClick={onPublish}
              disabled={!draftRevision || busy}
            >
              게시하기
            </Button>
          </>
        }
      />
      <p className="mt-1 text-sm text-muted-foreground">
        직원별 근무시간을 입력한 뒤 게시하면 구성원 화면의 오늘 근무에 반영됩니다.
      </p>
    </header>
  );
}
