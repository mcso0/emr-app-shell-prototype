import { EmrPageHeader } from "@/components/emr/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { HospitalScheduleRevision } from "../revision-types";

export function SchedulePageHeader({
  draftRevision,
  onCreateDraft,
  onOpenEditor,
  onPublish,
}: {
  draftRevision: HospitalScheduleRevision | null;
  onCreateDraft: () => void;
  onOpenEditor: () => void;
  onPublish: () => void;
}) {
  const status = draftRevision ? "초안" : "게시본";

  return (
    <header className="border-b bg-card px-4 py-4 md:px-6">
      <p className="emr-text-metadata text-muted-foreground">병원관리 / 인력 운영</p>
      <EmrPageHeader
        className="mt-1"
        title="근무표"
        badge={
          <Badge
            variant="outline"
            className={
              draftRevision
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
              <Button size="sm" onClick={onOpenEditor}>
                + 근무
              </Button>
            ) : (
              <Button size="sm" onClick={onCreateDraft}>
                초안 시작
              </Button>
            )}
            <Button size="sm" variant={draftRevision ? "default" : "outline"} onClick={onPublish} disabled={!draftRevision}>
              게시하기
            </Button>
          </>
        }
      />
      <p className="mt-1 text-sm text-muted-foreground">
        초안을 검증한 뒤 게시하면 직원 프로필의 오늘 근무 정보가 최신 게시본으로 전환돼.
      </p>
    </header>
  );
}
