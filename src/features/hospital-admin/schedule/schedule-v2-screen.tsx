"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { EmrConfirmDialogContent } from "@/components/emr/confirm-dialog-content";
import { EmrInlineAlert } from "@/components/emr/inline-alert";
import { EmrMainContentHeader } from "@/components/emr/main-content-header";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { addDaysToIsoDate } from "@/lib/emr-domain/demo-date";
import {
  HospitalScheduleRevisionRequestError,
  readHospitalScheduleRevision,
  sendHospitalScheduleRevisionCommand,
  verifyHospitalScheduleProfileReadback,
  type HospitalScheduleRevisionRemoteSnapshot,
  type HospitalScheduleProfileReadbackStatus,
} from "./revision-persistence-client";
import type {
  HospitalScheduleNonWorkEntry,
  HospitalScheduleWorkBlock,
} from "./revision-types";
import { ScheduleDataState } from "./components/schedule-data-state";
import { ScheduleDayList } from "./components/schedule-day-list";
import {
  ScheduleFixedWeekDialog,
  type FixedWeekValue,
} from "./components/schedule-fixed-week-dialog";
import { SchedulePageHeader } from "./components/schedule-page-header";
import { SchedulePublishReviewDialog } from "./components/schedule-publish-review-dialog";
import {
  ScheduleShiftEditorSheet,
  type ScheduleEditorValue,
  type ScheduleEntryEditorTarget,
} from "./components/schedule-shift-editor-sheet";
import { ScheduleWeekGrid } from "./components/schedule-week-grid";
import { ScheduleWeekNavigator } from "./components/schedule-week-navigator";

export function HospitalScheduleV2Screen({ workspaceId }: { workspaceId: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedWeekStart = searchParams.get("weekStart") ?? undefined;
  const [snapshot, setSnapshot] = useState<HospitalScheduleRevisionRemoteSnapshot | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "empty" | "error" | "read-only">("loading");
  const [error, setError] = useState<HospitalScheduleRevisionRequestError | null>(null);
  const [editor, setEditor] = useState<ScheduleEntryEditorTarget>(null);
  const [editorDirty, setEditorDirty] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [fixedWeekOpen, setFixedWeekOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [profileReadback, setProfileReadback] = useState<
    "checking" | HospitalScheduleProfileReadbackStatus | null
  >(null);

  const load = useCallback(
    async (weekStart?: string) => {
      setState("loading");
      setError(null);
      try {
        const next = await readHospitalScheduleRevision({ weekStart, workspaceId });
        if (!next) {
          setSnapshot(null);
          setState("error");
          return;
        }
        setSnapshot(next);
        if (!next.revision && !next.latestPublishedRevision) setState("empty");
        else if (!next.revision) setState("read-only");
        else setState("ready");
        if (next.canonicalWeekStart !== weekStart) {
          replaceWeekStart(next.canonicalWeekStart, pathname, router, searchParams);
        }
      } catch (caught) {
        setSnapshot(null);
        setError(toRequestError(caught));
        setState("error");
      }
    },
    [pathname, router, searchParams, workspaceId],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load(requestedWeekStart);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load, requestedWeekStart]);

  const requestWeekChange = (weekStart: string) => {
    if (editorDirty) {
      setPendingNavigation(weekStart);
      return;
    }
    replaceWeekStart(weekStart, pathname, router, searchParams);
  };

  const commitCommand = async (command: Record<string, unknown>) => {
    setPendingAction(typeof command.type === "string" ? command.type : "saving");
    try {
      const response = await sendHospitalScheduleRevisionCommand({ command, workspaceId });
      setSnapshot(response.snapshot);
      setState(
        response.snapshot.revision
          ? "ready"
          : response.snapshot.latestPublishedRevision
            ? "read-only"
            : "empty",
      );
      return response;
    } catch (caught) {
      const requestError = toRequestError(caught);
      setError(requestError);
      if (requestError.code === "stale_schedule_revision") {
        setState("error");
      }
      toast.error(requestError.message);
      throw requestError;
    } finally {
      setPendingAction(null);
    }
  };

  const createDraft = async (sourceRevisionId = snapshot?.latestPublishedRevision?.id ?? null) => {
    const weekStart = snapshot?.weekStart ?? requestedWeekStart;
    if (!weekStart) return;
    await commitCommand({ type: "create_draft", weekStart, sourceRevisionId });
  };

  const copyPreviousPublishedWeek = async () => {
    if (!snapshot) return;
    const previous = await readHospitalScheduleRevision({
      workspaceId,
      weekStart: addDaysToIsoDate(snapshot.weekStart, -7),
    });
    await createDraft(previous?.latestPublishedRevision?.id ?? null);
  };

  const restorePreviousPublishedRevision = async () => {
    const sourceRevision = snapshot?.publishedRevisions.find(
      (revision) => revision.id !== snapshot.latestPublishedRevision?.id,
    );
    if (!sourceRevision) return;
    await createDraft(sourceRevision.id);
  };

  const previousPublishedRevision = snapshot?.publishedRevisions.find(
    (revision) => revision.id !== snapshot.latestPublishedRevision?.id,
  );

  const saveEditor = async (draft: ScheduleEditorValue) => {
    if (!snapshot?.revision) return;
    if (draft.kind === "work") {
      await commitCommand({
        type: "save_work_block",
        revisionId: snapshot.revision.id,
        expectedLockVersion: snapshot.revision.lockVersion,
        workBlock: {
          id: draft.id,
          staffProfileId: draft.staffProfileId,
          shiftDate: draft.date,
          startMinutes: draft.startMinutes,
          endMinutes: draft.endMinutes,
          workKind: draft.workKind,
          workLabelSnapshot: draft.workLabel,
          locationLabelSnapshot: null,
          privateNote: null,
        },
      });
      return;
    }
    if (!draft.staffProfileId) return;
    await commitCommand({
      type: "save_non_work_entry",
      revisionId: snapshot.revision.id,
      expectedLockVersion: snapshot.revision.lockVersion,
      nonWorkEntry: {
        id: draft.id,
        staffProfileId: draft.staffProfileId,
        entryDate: draft.date,
        entryKind: draft.kind,
        leaveSubtype: draft.kind === "leave" ? "annual" : null,
        startMinutes: draft.kind === "leave" ? draft.startMinutes : null,
        endMinutes: draft.kind === "leave" ? draft.endMinutes : null,
        privateNote: null,
      },
    });
  };

  const validate = async () => {
    if (!snapshot?.revision) return;
    await commitCommand({
      type: "validate_revision",
      revisionId: snapshot.revision.id,
      expectedLockVersion: snapshot.revision.lockVersion,
    });
  };

  const applyFixedWeek = async (value: FixedWeekValue) => {
    if (!snapshot?.revision) return;
    const response = await commitCommand({
      type: "apply_fixed_week",
      revisionId: snapshot.revision.id,
      expectedLockVersion: snapshot.revision.lockVersion,
      weekdays: value.weekdays,
      startMinutes: value.startMinutes,
      endMinutes: value.endMinutes,
      roles: value.roles,
    });
    const result = asRecord(response.result);
    const insertedCount = typeof result.insertedCount === "number" ? result.insertedCount : null;
    const skippedCount = typeof result.skippedCount === "number" ? result.skippedCount : null;
    setFixedWeekOpen(false);
    toast.success(
      insertedCount === null
        ? "기본 근무를 현재 주에 입력했습니다."
        : `${insertedCount}건을 입력했습니다${skippedCount ? `. 기존 입력 ${skippedCount}건은 유지했습니다` : ""}.`,
    );
  };

  const publish = async () => {
    if (!snapshot?.revision) return;
    setPublishing(true);
    setProfileReadback("checking");
    try {
      const response = await commitCommand({
        type: "publish_revision",
        revisionId: snapshot.revision.id,
        expectedLockVersion: snapshot.revision.lockVersion,
      });
      setProfileReadback(response.profileReadback ?? "verification_failed");
      setPublishOpen(false);
      toast.success(
        response.profileReadback === "confirmed"
          ? "근무표를 게시했고 프로필 반영까지 확인했습니다."
          : "근무표를 게시했습니다. 프로필 반영 확인이 필요합니다.",
      );
    } catch {
      setProfileReadback(null);
    } finally {
      setPublishing(false);
    }
  };

  const retryProfileReadback = async () => {
    const revisionId = snapshot?.latestPublishedRevision?.id;
    if (!revisionId) return;
    setProfileReadback("checking");
    try {
      setProfileReadback(await verifyHospitalScheduleProfileReadback({ revisionId, workspaceId }));
    } catch {
      setProfileReadback("verification_failed");
    }
  };

  const deleteEntry = async (entryKind: "work_block" | "non_work_entry", entryId: string) => {
    if (!snapshot?.revision) return;
    setDeleting(true);
    try {
      await commitCommand({
        type: "delete_entry",
        revisionId: snapshot.revision.id,
        expectedLockVersion: snapshot.revision.lockVersion,
        entryKind,
        entryId,
      });
      setEditor(null);
      setEditorDirty(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <main data-testid="hospital-admin-schedule-v2-screen" className="flex h-full min-h-0 flex-col overflow-y-auto bg-[var(--emr-surface-canvas)]">
      <EmrMainContentHeader aria-hidden="true" heightMode="adaptive" />
      <SchedulePageHeader
        busy={pendingAction !== null}
        dataState={state}
        draftRevision={snapshot?.revision ?? null}
        hasPublishedRevision={Boolean(snapshot?.latestPublishedRevision)}
        onCreateDraft={() => void createDraft()}
        onOpenEditor={() => setEditor({ mode: "create", date: snapshot?.weekStart ?? requestedWeekStart ?? "" })}
        onPublish={() => setPublishOpen(true)}
      />
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        {snapshot ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ScheduleWeekNavigator weekStart={snapshot.weekStart} onChangeWeek={requestWeekChange} />
            <div className="flex items-center gap-2">
              {!snapshot.revision ? (
                <>
                  <Button size="sm" variant="outline" disabled={pendingAction !== null} onClick={() => void copyPreviousPublishedWeek()}>
                    지난주 근무표 가져오기
                  </Button>
                  {previousPublishedRevision ? (
                    <Button size="sm" variant="outline" disabled={pendingAction !== null} onClick={() => void restorePreviousPublishedRevision()}>
                      이전 버전으로 편집
                    </Button>
                  ) : null}
                </>
              ) : null}
              {snapshot.revision ? (
                <>
                  <Button size="sm" variant="outline" disabled={pendingAction !== null} onClick={() => setFixedWeekOpen(true)}>
                    기본 근무 입력
                  </Button>
                  <Button size="sm" variant="outline" disabled={pendingAction !== null} onClick={() => void validate()}>
                    게시 전 확인
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        ) : null}

        {error ? (
          <EmrInlineAlert
            severity={error.code === "stale_schedule_revision" ? "warning" : "error"}
            title={error.code === "stale_schedule_revision" ? "다른 관리자의 변경이 있습니다" : "근무표 작업을 완료하지 못했습니다"}
            action={<Button size="sm" variant="outline" onClick={() => void load(snapshot?.weekStart ?? requestedWeekStart)}>서버 상태 다시 불러오기</Button>}
          >
            {error.code === "publication_blocked" && error.issues.length
              ? error.issues.map((issue) => issue.message).join(" ")
              : error.message}
          </EmrInlineAlert>
        ) : null}

        {profileReadback === "checking" ? (
          <EmrInlineAlert severity="info" title="반영 확인 중">
            게시된 근무가 직원 프로필의 오늘 근무 정보에 반영됐는지 확인하고 있습니다.
          </EmrInlineAlert>
        ) : null}
        {profileReadback === "confirmed" ? (
          <EmrInlineAlert severity="success" title="게시 완료 · 프로필 반영 확인됨">
            최신 게시본이 프로필 소비부에서 정상적으로 조회되었습니다.
          </EmrInlineAlert>
        ) : null}
        {profileReadback === "verification_failed" ? (
          <EmrInlineAlert
            severity="warning"
            title="게시 완료 · 프로필 확인 필요"
            action={<Button size="sm" variant="outline" onClick={() => void retryProfileReadback()}>읽기 확인 다시 시도</Button>}
          >
            게시를 다시 실행하지 말고 프로필 읽기 확인만 다시 시도해 주세요.
          </EmrInlineAlert>
        ) : null}

        {state === "loading" || state === "empty" || state === "error" || state === "read-only" ? (
          <ScheduleDataState
            state={state}
            onCreateDraft={state === "empty" ? () => void createDraft(null) : undefined}
            onRetry={state === "error" ? () => void load(snapshot?.weekStart ?? requestedWeekStart) : undefined}
          />
        ) : null}

        {snapshot && (state === "ready" || state === "read-only") ? (
          <>
            <ScheduleWeekGrid
              editable={Boolean(snapshot.revision)}
              staff={snapshot.staff}
              weekStart={snapshot.weekStart}
              workBlocks={snapshot.workBlocks}
              nonWorkEntries={snapshot.nonWorkEntries}
              onEditWorkBlock={(block) => setEditor({ mode: "work", block })}
              onEditNonWorkEntry={(entry) => setEditor({ mode: "non_work", entry })}
            />
            <ScheduleDayList
              editable={Boolean(snapshot.revision)}
              staff={snapshot.staff}
              weekStart={snapshot.weekStart}
              workBlocks={snapshot.workBlocks}
              nonWorkEntries={snapshot.nonWorkEntries}
              onEditWorkBlock={(block) => setEditor({ mode: "work", block })}
              onEditNonWorkEntry={(entry) => setEditor({ mode: "non_work", entry })}
            />
          </>
        ) : null}
      </div>

      <ScheduleShiftEditorSheet
        key={editor?.mode === "work" ? editor.block.id : editor?.mode === "non_work" ? editor.entry.id : editor?.mode ?? "closed"}
        target={editor}
        staff={snapshot?.staff ?? []}
        deleting={deleting}
        onDelete={async () => {
          if (editor?.mode === "work") {
            await deleteEntry("work_block", editor.block.id);
          } else if (editor?.mode === "non_work") {
            await deleteEntry("non_work_entry", editor.entry.id);
          }
        }}
        onDirtyChange={setEditorDirty}
        onOpenChange={(open) => {
          if (!open && editorDirty) {
            setPendingNavigation("__close_editor__");
            return;
          }
          if (!open) setEditor(null);
        }}
        onSave={saveEditor}
      />

      <ScheduleFixedWeekDialog
        open={fixedWeekOpen}
        applying={pendingAction === "apply_fixed_week"}
        staff={snapshot?.staff ?? []}
        onOpenChange={(open) => {
          if (!pendingAction) setFixedWeekOpen(open);
        }}
        onApply={applyFixedWeek}
      />

      <SchedulePublishReviewDialog
        open={publishOpen}
        publishing={publishing}
        issues={snapshot?.issues ?? []}
        onOpenChange={setPublishOpen}
        onPublish={publish}
      />

      <Dialog open={pendingNavigation !== null} onOpenChange={(open) => !open && setPendingNavigation(null)}>
        <EmrConfirmDialogContent
          title="저장하지 않은 변경이 있습니다"
          description="이동하거나 닫으면 현재 입력 중인 내용은 저장되지 않습니다."
          cancelLabel="계속 편집"
          confirmLabel="저장하지 않고 이동"
          onCancel={() => setPendingNavigation(null)}
          onConfirm={() => {
            const destination = pendingNavigation;
            setPendingNavigation(null);
            setEditorDirty(false);
            setEditor(null);
            if (destination && destination !== "__close_editor__") {
              replaceWeekStart(destination, pathname, router, searchParams);
            }
          }}
        />
      </Dialog>
    </main>
  );
}

function replaceWeekStart(
  weekStart: string,
  pathname: string,
  router: ReturnType<typeof useRouter>,
  searchParams: ReturnType<typeof useSearchParams>,
) {
  const params = new URLSearchParams(searchParams.toString());
  params.set("weekStart", weekStart);
  router.replace(`${pathname}?${params.toString()}`);
}

function toRequestError(value: unknown) {
  if (value instanceof HospitalScheduleRevisionRequestError) return value;
  return new HospitalScheduleRevisionRequestError(
    value instanceof Error ? value.message : "근무표 작업을 완료하지 못했습니다.",
    "schedule_request_failed",
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function toWorkEditorTarget(block: HospitalScheduleWorkBlock): ScheduleEntryEditorTarget {
  return { mode: "work", block };
}

export function toNonWorkEditorTarget(entry: HospitalScheduleNonWorkEntry): ScheduleEntryEditorTarget {
  return { mode: "non_work", entry };
}
