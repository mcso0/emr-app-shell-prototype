"use client";

import { OralInstructionInfobar } from "./oral-instruction-infobar";
import { TaskInstructionReview } from "@/features/fulfillment/components/task-instruction-review";
import { EmrContentLoadingState } from "@/components/emr/empty-state";
import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmrDialogShell } from "@/components/emr/dialog-shell";
import { ExecutionResultDialog } from "@/features/fulfillment/components/execution-result-dialog";
import { instructionCompletionConfirmation } from "@/features/fulfillment/instruction-contract";
import { createInstructionView } from "../instruction-view-model";
import type { FulfillmentInstructionController } from "../use-fulfillment-instruction";
import { InstructionDocumentTable } from "./instruction-document-table";

type Props = {
  controller: FulfillmentInstructionController;
  onChanged: () => void;
  workspaceId: string;
};

function CompletionConfirmation(props: Props & { itemId?: string; open: boolean; onClose: () => void }) {
  return props.open && props.controller.document
    ? <CompletionFlow key={`${props.workspaceId}:${props.controller.document.rootTaskId}:${props.itemId ?? "all"}`} {...props} />
    : null;
}

function CompletionFlow({ controller, workspaceId, itemId, onClose, onChanged }: Props & { itemId?: string; onClose: () => void }) {
  const [resultItem, setResultItem] = useState<string | null>(null);
  const document = controller.document;
  if (!document) return null;
  const confirmation = instructionCompletionConfirmation(document, itemId);
  const targets = document.items.filter((item) => !itemId || item.id === itemId);
  const missingResults = targets.filter((item) => item.resultRequired && !["completed", "cancelled", "returned"].includes(item.status));
  const busy = controller.busy || controller.loading;
  const canComplete = itemId ? targets.some((item) => item.canComplete) : document.canCompleteAll;
  const executionItem = document.items.find((item) => item.id === resultItem);
  return <>
    <Dialog open={resultItem === null} onOpenChange={(next) => { if (!next && !busy) onClose(); }}>
      <EmrDialogShell
        title={confirmation.title}
        description={missingResults.length ? "완료할 항목의 실제 수행값을 먼저 기록해 주세요." : confirmation.description}
        secondaryAction={<Button variant="outline" disabled={busy} onClick={onClose}>취소</Button>}
        primaryAction={<Button disabled={busy || !canComplete || missingResults.length > 0} onClick={async () => {
          if (await controller.mutate(itemId ? { action: "complete", itemId } : { action: "complete_all" })) {
            onClose(); onChanged();
          }
        }}>{controller.busy ? "저장 중" : "완료"}</Button>}
      >
        {missingResults.length > 0 && <ul className="space-y-2">
          {missingResults.map((item) => <li key={item.id} className="flex items-center justify-between gap-3">
            <span className="min-w-0 break-words">{item.name}</span>
            <Button variant="outline" disabled={busy || !item.canComplete} aria-label={`${item.name} 수행값 입력`} onClick={() => setResultItem(item.id)}>수행값 입력</Button>
          </li>)}
        </ul>}
        {controller.error && <p role="alert" className="text-sm text-destructive">{controller.error}</p>}
      </EmrDialogShell>
    </Dialog>
    {executionItem && <ExecutionResultDialog
      workspaceId={workspaceId} workItemId={executionItem.id} open
      instructionCompletion
      ownershipAllowed={!busy && executionItem.canComplete}
      ownershipKey={document.revision} authorityStatus={executionItem.status}
      onOpenChange={(next) => { if (!next) setResultItem(null); }}
      onSaved={async () => {
        setResultItem(null);
        controller.refresh();
        onChanged();
        if (itemId || !document.isSet) onClose();
      }}
    />}
  </>;
}

export function InstructionActions(props: Props) {
  return <InstructionActionsContent key={`${props.workspaceId}:${props.controller.document?.rootTaskId}`} {...props} />;
}

function InstructionActionsContent({ controller, onChanged, workspaceId }: Props) {
  const [confirm, setConfirm] = useState(false);
  const document = controller.document;
  if (!document) return null;
  const busy = controller.busy || controller.loading;
  const change = async (action: "claim" | "start" | "resume" | "unassign") => {
    if (await controller.mutate({ action })) onChanged();
  };
  return (
    <>
      {document.mainAssigneeName ? (
        <span className="text-sm text-muted-foreground">
          {document.mainAssigneeName}
        </span>
      ) : null}
      {document.canClaim ? (
        <Button size="sm" disabled={busy} onClick={() => void change("claim")}>
          담당하기
        </Button>
      ) : null}
      {document.canStart ? (
        <Button size="sm" disabled={busy} onClick={() => void change("start")}>
          {document.queueType === "dispensing" ? "조제 시작" : "처치 시작"}
        </Button>
      ) : null}
      {document.canResume ? (
        <Button size="sm" disabled={busy} onClick={() => void change("resume")}>
          재개
        </Button>
      ) : null}
      {document.canUnassign ? (
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => void change("unassign")}
        >
          담당 취소
        </Button>
      ) : null}
      {document.canCompleteAll ? (
        <Button size="sm" variant={document.canClaim ? "outline" : "default"} disabled={busy} onClick={() => setConfirm(true)}>
          {document.queueType === "dispensing" ? "조제 완료" : "처치 완료"}
        </Button>
      ) : null}
      {document.finalized ? <span className="text-sm">완료</span> : null}
      <CompletionConfirmation
        controller={controller}
        workspaceId={workspaceId}
        onChanged={onChanged}
        open={confirm}
        onClose={() => setConfirm(false)}
      />
    </>
  );
}

export function InstructionBody({
  controller,
  onChanged,
  workspaceId,
}: Props) {
  const [confirmItem, setConfirmItem] = useState<string | null>(null);
  const [historyItem, setHistoryItem] = useState<string | null | undefined>(
    undefined,
  );
  const [resultItem, setResultItem] = useState<string | null>(null);
  const [executionHistory, setExecutionHistory] = useState(false);
  const [instructionDraft, setInstructionDraft] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const document = controller.document;
  const view = document ? createInstructionView(document) : null;
  return (
    <div
      className="instruction-document-surface"
      aria-busy={controller.loading || controller.busy}
    >
      {controller.error ? (
        <div
          role="alert"
          className="mb-3 flex items-center gap-3 text-sm text-destructive"
        >
          <span>{controller.error}</span>
          <Button size="sm" variant="outline" onClick={controller.refresh}>
            다시 조회
          </Button>
        </div>
      ) : null}
      {controller.loading && !document ? <EmrContentLoadingState testId="instruction-document-loading" title="조제/처치 업무를 불러오는 중입니다" /> : null}
      {controller.instructionReview && <TaskInstructionReview controller={controller.instructionReview} />}
      {!controller.instructionReview && document?.oralInstruction && <OralInstructionInfobar key={document.oralInstruction.chartId} instruction={document.oralInstruction} />}
      <Dialog
        open={instructionDraft !== null}
        onOpenChange={(open) => {
          if (!open && !controller.busy) setInstructionDraft(null);
        }}
      >
        <EmrDialogShell
          title={document?.isSet ? "세트 공통 지시 수정" : "오더 지시 수정"}
          description="완료 상태는 유지됩니다."
          secondaryAction={
            <Button
              variant="outline"
              disabled={controller.busy}
              onClick={() => setInstructionDraft(null)}
            >
              취소
            </Button>
          }
          primaryAction={
            <Button
              disabled={
                controller.busy ||
                controller.loading ||
                instructionDraft === document?.instruction
              }
              onClick={async () => {
                if (
                  instructionDraft !== null &&
                  (await controller.mutate({
                    action: "edit_instruction",
                    instruction: instructionDraft,
                  }))
                ) {
                  setInstructionDraft(null);
                  onChanged();
                }
              }}
            >
              {controller.busy ? "저장 중" : "저장"}
            </Button>
          }
        >
          <Textarea
            aria-label="공통 지시"
            maxLength={5000}
            value={instructionDraft ?? ""}
            disabled={controller.busy}
            onChange={(event) => setInstructionDraft(event.target.value)}
          />
          {controller.error ? (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {controller.error}
            </p>
          ) : null}
        </EmrDialogShell>
      </Dialog>
      {view ? (
        <InstructionDocumentTable
          {...view}
          refresh={controller.refresh}
          editSetInstruction={document?.canEditInstruction ? () => setInstructionDraft(document.instruction) : undefined}
          openExecutionHistory={() => setExecutionHistory(true)}
          busy={controller.busy || controller.loading}
          names={{
            ...view.names,
            ...Object.fromEntries(
              controller.assignees.map((item) => [
                item.userId,
                item.displayName,
              ]),
            ),
          }}
          eligibleAssignees={controller.assignees.map((item) => item.userId)}
          history={(_orderId, itemId) => setHistoryItem(itemId ?? null)}
          notify={setNotice}
          act={async (_orderId, action, extra) => {
            if (!extra?.itemId) return;
            const item = document?.items.find(
              (item) => item.id === extra.itemId,
            );
            if (action === "toggle_complete" && item?.status !== "completed") {
              setConfirmItem(extra.itemId);
              return;
            }
            const intent =
              action === "toggle_complete"
                ? { action: "reopen" as const, itemId: extra.itemId }
                : {
                    action: "assign" as const,
                    itemId: extra.itemId,
                    assigneeId: extra.assignees?.[0] ?? "",
                  };
            if (await controller.mutate(intent)) onChanged();
          }}
        />
      ) : null}
      {document && !document.items.length ? (
        <p className="p-6 text-sm text-muted-foreground">
          표시할 오더가 없어요.
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="mt-2 text-sm">
          {notice}
        </p>
      ) : null}
      <CompletionConfirmation
        controller={controller}
        workspaceId={workspaceId}
        onChanged={onChanged}
        itemId={confirmItem ?? undefined}
        open={confirmItem !== null}
        onClose={() => setConfirmItem(null)}
      />
      <Dialog
        open={historyItem !== undefined}
        onOpenChange={(open) => {
          if (!open) setHistoryItem(undefined);
        }}
      >
        <EmrDialogShell
          variant="wide-form"
          title="수정 이력"
          description={document?.name}
        >
          <ol className="space-y-5">
            {document?.changes
              .filter(
                (change) =>
                  !historyItem ||
                  change.orderId ===
                    document.items.find((item) => item.id === historyItem)
                      ?.orderId,
              )
              .map((change) => {
                const event = view?.events.find(
                  (event) => event.id === change.id,
                );
                return (
                  <li key={change.id} className="border-l-2 pl-4 text-sm">
                    <p>
                      {change.actorName ?? "작성자 정보 없음"} ·{" "}
                      {new Date(change.createdAt).toLocaleString("ko-KR", {
                        timeZone: "Asia/Seoul",
                      })}
                    </p>
                    {event?.changes.map((field) => (
                      <p
                        key={`${field.itemId}:${field.field}`}
                        className="mt-1 whitespace-pre-wrap text-muted-foreground"
                      >
                        {(
                          {
                            dose: "1회량",
                            doseUnit: "단위",
                            frequency: "횟수",
                            days: "일수",
                            total: "총량",
                            totalUnit: "총량 단위",
                            route: "경로",
                            medicationGuide: "복약",
                            storage: "보관",
                            note: "지시",
                            instruction: "공통 지시",
                          } as Record<string, string>
                        )[field.field] ?? field.field}
                        : {field.before || "없음"} → {field.after || "없음"}
                      </p>
                    ))}
                  </li>
                );
              })}
          </ol>
          {!document?.changes.length ? (
            <p className="text-sm text-muted-foreground">수정 이력이 없어요.</p>
          ) : null}
        </EmrDialogShell>
      </Dialog>
      <Dialog open={executionHistory && !resultItem} onOpenChange={setExecutionHistory}>
        <EmrDialogShell title="수행기록" description={document?.name}>
          <ul className="space-y-2">
            {document?.items.filter((item) => item.hasResult).map((item) => <li key={item.id}>
              <Button variant="ghost" disabled={controller.loading || controller.busy} onClick={() => setResultItem(item.id)}>{item.name}</Button>
            </li>)}
          </ul>
        </EmrDialogShell>
      </Dialog>
      {resultItem ? (
        <ExecutionResultDialog
          workspaceId={workspaceId}
          workItemId={resultItem}
          open
          ownershipAllowed={!(controller.loading || controller.busy) && (
            document?.items.find((item) => item.id === resultItem)
              ?.canComplete ||
            document?.items.find((item) => item.id === resultItem)?.canReopen)
          }
          ownershipKey={document?.revision}
          authorityStatus={document?.items.find((item) => item.id === resultItem)?.status}
          onOpenChange={(open) => {
            if (!open) setResultItem(null);
          }}
          onSaved={async () => {
            controller.refresh();
            onChanged();
          }}
        />
      ) : null}
    </div>
  );
}
