"use client";

import { OralInstructionInfobar } from "./oral-instruction-infobar";
import { TaskInstructionReview } from "@/features/fulfillment/components/task-instruction-review";
import { EmrContentLoadingState } from "@/components/emr/empty-state";
import { useId, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ButtonGroup, ButtonGroupDivider, ButtonGroupIconButton, ButtonGroupPrimaryButton } from "@/components/ui/button-group";
import { CdsActionsCheckCircleIcon } from "@/components/cds-icons/actions-and-controls";
import { CdsNavigationChevronDownIcon } from "@/components/cds-icons/navigation";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Radio, RadioGroup } from "@/components/ui/radio-group";
import { EmrInstructionOutputMenu } from "@/components/emr/instruction-header-stack";
import { Dialog } from "@/components/ui/dialog";
import { EmrWorkEntryAction, EmrWorkEntryTrigger } from "@/components/emr/work-entry-action";
import { EmrDialogShell } from "@/components/emr/dialog-shell";
import { ExecutionResultDialog } from "@/features/fulfillment/components/execution-result-dialog";
import { instructionCompletionConfirmation } from "@/features/fulfillment/instruction-contract";
import { createInstructionView, getDispensingRerequestChanges, getInstructionStatusLabel, hasPendingInstructionRerequest, isWaitingInstruction } from "../instruction-view-model";
import type { FulfillmentInstructionController } from "../use-fulfillment-instruction";
import { InstructionDocumentTable } from "./instruction-document-table";

type Props = {
  controller: FulfillmentInstructionController;
  onChanged: () => void;
  workspaceId: string;
  prework?: boolean;
  inDocumentToolbar?: boolean;
  onEntered?: () => void;
  onCompletionOpenChange?: (open: boolean) => void;
};

function CompletionConfirmation(props: Props & { itemId?: string; open: boolean; onClose: () => void }) {
  return props.open && props.controller.document
    ? <CompletionFlow key={`${props.workspaceId}:${props.controller.document.rootTaskId}:${props.itemId ?? "all"}`} {...props} />
    : null;
}

function CompletionFlow({ controller, itemId, onClose, onChanged }: Props & { itemId?: string; onClose: () => void }) {
  const document = controller.document;
  if (!document) return null;
  const confirmation = instructionCompletionConfirmation(document, itemId);
  const busy = controller.busy || controller.loading;
  const canComplete = !document.finalized && (itemId ? document.items.some((item) => item.id === itemId && item.canComplete) : document.canCompleteAll);
  return (
    <Dialog open onOpenChange={(next) => { if (!next && !busy) onClose(); }}>
      <EmrDialogShell
        title={confirmation.title}
        description={confirmation.description}
        secondaryAction={<Button variant="outline" disabled={busy} onClick={onClose}>취소</Button>}
        primaryAction={<Button disabled={busy || !canComplete} onClick={async () => {
          if (await controller.mutate(itemId ? { action: "complete", itemId } : { action: "complete_all" })) {
            onClose(); onChanged();
          }
        }}>{controller.busy ? "저장 중" : "완료"}</Button>}
      >
        {controller.error && <p role="alert" className="text-sm text-destructive">{controller.error}</p>}
      </EmrDialogShell>
    </Dialog>
  );
}

function ReopenConfirmation({ controller, onChanged, onClose }: Props & { onClose: () => void }) {
  const document = controller.document!;
  const items = document.items.filter(item => item.status === "completed" && item.canReopen);
  const labelId = useId();
  const [revision] = useState(document.revision);
  const [itemId, setItemId] = useState(items.length === 1 ? items[0].id : "");
  const stale = revision !== document.revision;
  const busy = controller.busy || controller.loading;
  const canSubmit = !busy && !stale && items.some(item => item.id === itemId);
  const canClose = !busy || Boolean(controller.error);

  return <Dialog open onOpenChange={open => { if (!open && canClose) onClose(); }}>
    <EmrDialogShell title="진행 중으로 변경할까요?"
      description={document.isSet ? "선택한 항목만 다시 진행해요. 기존 수행기록은 유지돼요." : "기존 수행기록은 유지돼요."}
      showCloseButton={canClose}
      secondaryAction={<Button variant="outline" disabled={!canClose} onClick={onClose}>취소</Button>}
      primaryAction={<Button disabled={!canSubmit} onClick={async () => {
        if (await controller.mutate({ action: "reopen", itemId }, onClose)) {
          onClose();
          onChanged();
        }
      }}>{controller.busy ? "저장 중" : "진행 중으로 변경"}</Button>}>
      {document.isSet ? (
        <RadioGroup aria-label="다시 진행할 항목" value={itemId} disabled={busy || stale}
          onValueChange={value => setItemId(String(value))}
          className="max-h-[min(12rem,30dvh)] overflow-y-auto p-1">
          {items.map((item, index) => (
            <label key={item.id} className="flex min-w-0 items-center gap-2 text-sm">
              <Radio value={item.id} className="shrink-0" aria-labelledby={`${labelId}-${index}`} />
              <span id={`${labelId}-${index}`} className="min-w-0 break-words">{item.name}</span>
            </label>
          ))}
        </RadioGroup>
      ) : <p className="break-words text-sm font-medium">{document.name}</p>}
      {(stale || controller.error) && <p role="alert" className="mt-3 text-sm text-destructive">
        {stale ? "업무 상태가 변경됐어요. 창을 닫고 최신 상태를 확인해 주세요." : controller.error}
      </p>}
    </EmrDialogShell>
  </Dialog>;
}

export function InstructionActions(props: Props) {
  return <InstructionActionsContent key={`${props.workspaceId}:${props.controller.document?.rootTaskId}:${props.controller.document?.queueType}`} {...props} />;
}

function InstructionActionsContent({ controller, onChanged, workspaceId, prework = false, inDocumentToolbar = false, onEntered, onCompletionOpenChange }: Props) {
  const [takeover, setTakeover] = useState(false);
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [reopen, setReopen] = useState(false);
  const document = controller.document;
  if (!document) return null;
  const busy = controller.busy || controller.loading;
  const continuingRerequest = Boolean(document.firstStartedAt) && hasPendingInstructionRerequest(document);
  const entryMode = document.canClaim ? "claim" : document.canTakeover ? "takeover" : document.canStart ? "start" : "blocked";
  const claimStartsWork = isWaitingInstruction(document);
  const claimIntent = { action: "claim" as const, ...(claimStartsWork ? { startWork: true as const } : {}) };
  const completionLabel = document.queueType === "dispensing" ? "조제 완료" : "처치 완료";
  const openCompletion = () => {
    setConfirm(true);
    onCompletionOpenChange?.(true);
  };
  const canReopen = !prework && document.items.some(item => item.status === "completed" && item.canReopen);
  const canUnassign = !prework && !document.finalized && document.canUnassign;
  const showStatusMenu = canReopen || canUnassign;
  const canComplete = !document.finalized && document.canCompleteAll;
  const primaryCompletion = canComplete && !document.canClaim;
  const splitCompletion = inDocumentToolbar && canComplete && showStatusMenu;
  const separateStatus = !inDocumentToolbar || document.finalized;
  const completionMenuAction = canComplete
    ? { label: completionLabel, triggerLabel: "완료 메뉴 열기", onSelect: openCompletion }
    : undefined;
  const change = async (action: "claim" | "start" | "resume" | "unassign") => {
    const intent = action === "claim" ? claimIntent : { action };
    const onSuccess = () => {
      onChanged();
      if (action === "claim" || action === "start") onEntered?.();
    };
    const continuing = !prework && continuingRerequest && (action === "start" || (action === "claim" && claimStartsWork));
    const continueAfterReview = continuing ? {
      label: document.queueType === "dispensing" ? "확인하고 조제 계속" : "확인하고 처치 계속",
      onSuccess,
    } : undefined;
    if (await controller.mutate(intent, undefined, continueAfterReview)) onSuccess();
  };
  const statusMenu = showStatusMenu ? (
    <DropdownMenu>
      <DropdownMenuTrigger render={splitCompletion || separateStatus ? (
        <ButtonGroupIconButton type="button" size="sm" variant={splitCompletion && primaryCompletion ? "default" : "ghost"}
          className={splitCompletion ? "rounded-r-lg" : undefined} aria-label="업무 상태 변경" disabled={busy} />
      ) : (
        <Button type="button" size="icon-sm" variant="outline" aria-label="업무 상태 변경" disabled={busy} />
      )}>
        <CdsNavigationChevronDownIcon className="size-3" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-max">
        {canReopen && <DropdownMenuItem onClick={() => setReopen(true)}>
          {document.finalized ? "진행 중으로 변경" : "완료 항목 다시 진행"}
        </DropdownMenuItem>}
        {canUnassign && <DropdownMenuItem onClick={() => void change("unassign")}>담당 취소</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null;
  const completionContent = (
    <>
      {inDocumentToolbar ? <CdsActionsCheckCircleIcon data-icon="inline-start" aria-hidden="true" /> : null}
      {completionLabel}
    </>
  );
  return (
    <>
      {!prework && !inDocumentToolbar && document.mainAssigneeName ? (
        <span className="text-sm text-muted-foreground">
          {document.mainAssigneeName}
        </span>
      ) : null}
      {prework && entryMode === "start" ? (
        <EmrWorkEntryTrigger size="default" label="업무 시작하기" disabled={busy} onClick={() => void change("start")} menuAction={completionMenuAction} />
      ) : prework ? <EmrWorkEntryAction
        size="default"
        menuAction={completionMenuAction}
        scopeKey={`${workspaceId}:${document.rootTaskId}:${document.queueType}`}
        authorityKey={document.revision}
        mode={entryMode}
        assigneeName={document.mainAssigneeName}
        busy={busy} error={controller.error}
        description={entryMode === "claim" && claimStartsWork
          ? "담당을 지정하면 업무가 바로 시작됩니다."
          : entryMode === "takeover"
            ? "담당을 변경하면 업무가 바로 시작됩니다. 변경 사유는 요청 수의사에게 전달됩니다."
            : undefined}
        onConfirm={entryMode === "blocked" ? undefined : async (reason) => {
          const intent = entryMode === "claim" ? claimIntent
            : { action: "takeover" as const, startWork: true as const, reason };
          let reviewRequired = false;
          const succeeded = await controller.mutate(intent, () => { reviewRequired = true; });
          if (succeeded) onChanged();
          return reviewRequired ? "review_required" : succeeded;
        }}
        onEntered={onEntered}
      >
        {entryMode !== "blocked" && (
          <div className={entryMode === "takeover" ? "mb-4" : undefined}>
            <p className="break-words text-sm font-medium">
              {entryMode === "claim" ? "미지정" : document.mainAssigneeName?.trim() || "기존 담당자"} → 나
            </p>
            <ul aria-label="대상 오더" className="mt-2 max-h-[min(7rem,20dvh)] list-disc space-y-1 overflow-y-auto pl-5 text-sm text-muted-foreground">
              {document.items.map((item) => <li key={item.id} className="break-words">{item.name}</li>)}
            </ul>
          </div>
        )}
      </EmrWorkEntryAction> : null}
      {!prework && document.canClaim ? (
        <Button size="sm" disabled={busy} onClick={() => void change("claim")}>
          {continuingRerequest && claimStartsWork ? "업무 계속하기" : "담당하기"}
        </Button>
      ) : null}
      {!prework && document.canTakeover ? <Button size="sm" disabled={busy} onClick={() => setTakeover(true)}>담당하기</Button> : null}
      <Dialog open={takeover} onOpenChange={(open) => { if (!busy) setTakeover(open); }}>
        <EmrDialogShell title="담당자를 변경할까요?"
          description={`해당 업무는 ${document.mainAssigneeName ?? "다른 담당자"}님이 담당자로 지정된 업무입니다. 담당을 변경하고 ${continuingRerequest ? "업무를 이어갑니다." : "바로 업무를 시작합니다."} 요청 수의사에게 사유가 전달됩니다.`}
          secondaryAction={<Button variant="outline" disabled={busy} onClick={() => setTakeover(false)}>취소</Button>}
          primaryAction={<Button disabled={busy || !reason.trim() || !document.canTakeover} onClick={async () => {
            if (await controller.mutate({ action: "takeover", startWork: true, reason: reason.trim() }, () => setTakeover(false))) {
              setTakeover(false); setReason(""); onChanged(); onEntered?.();
            }
          }}>{controller.busy ? "저장 중" : "담당하기"}</Button>}>
          <label className="mb-2 block text-sm font-medium" htmlFor="takeover-reason">담당 변경 사유</label>
          <Textarea id="takeover-reason" value={reason} maxLength={1000} disabled={busy} onChange={(event) => setReason(event.target.value)} />
          {controller.error && <p role="alert" className="mt-2 text-sm text-destructive">{controller.error}</p>}
        </EmrDialogShell>
      </Dialog>
      {!prework && document.canStart ? (
        <Button size="sm" disabled={busy} onClick={() => void change("start")}>
          {continuingRerequest ? "업무 계속하기" : document.queueType === "dispensing" ? "조제 시작" : "처치 시작"}
        </Button>
      ) : null}
      {document.canResume ? (
        <Button size="sm" disabled={busy} onClick={() => void change("resume")}>
          재개
        </Button>
      ) : null}
      {!prework && canComplete ? (splitCompletion ? (
        <ButtonGroup aria-label={`${completionLabel} 보조 작업`} className={primaryCompletion ? "shrink-0" : "shrink-0 rounded-lg border border-border bg-card"}>
          <ButtonGroupPrimaryButton size="sm" variant={primaryCompletion ? "default" : "outline"} className="rounded-l-lg" disabled={busy} onClick={openCompletion}>
            {completionContent}
          </ButtonGroupPrimaryButton>
          <ButtonGroupDivider className={primaryCompletion ? undefined : "bg-border"} />
          {statusMenu}
        </ButtonGroup>
      ) : (
        <Button size="sm" variant={primaryCompletion ? "default" : "outline"} disabled={busy} onClick={openCompletion}>
          {completionContent}
        </Button>
      )) : null}
      {!splitCompletion && (separateStatus && statusMenu ? (
        <ButtonGroup aria-label="업무 상태" className="shrink-0 items-center rounded-md border border-border bg-card">
          <span className="flex items-center px-2 text-sm">{getInstructionStatusLabel(document)}</span>
          <ButtonGroupDivider className="bg-border" />
          {statusMenu}
        </ButtonGroup>
      ) : document.finalized ? <span className="text-sm">완료</span> : statusMenu)}
      {reopen && <ReopenConfirmation controller={controller} workspaceId={workspaceId} onChanged={onChanged} onClose={() => setReopen(false)} />}
      <CompletionConfirmation
        controller={controller}
        workspaceId={workspaceId}
        onChanged={onChanged}
        open={confirm}
        onClose={() => { setConfirm(false); onCompletionOpenChange?.(false); }}
      />
    </>
  );
}

export function InstructionBody({
  controller,
  focusedItemId,
  onChanged,
  workspaceId,
}: Props & { focusedItemId?: string }) {
  const [confirmItem, setConfirmItem] = useState<string | null>(null);
  const [historyItem, setHistoryItem] = useState<string | null | undefined>(
    undefined,
  );
  const [executionHistory, setExecutionHistory] = useState(false);
  const [editInstruction, setEditInstruction] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const document = controller.document;
  const view = document ? createInstructionView(document) : null;
  const historyEvents = (document?.changes ?? []).flatMap(change => {
    const event = view?.events.find(event => event.id === change.id);
    if (!event) return [];
    const fields = historyItem ? event.changes.filter(field => field.itemId === historyItem) : event.changes;
    return fields.length ? [{ ...event, changes: fields }] : [];
  });
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
      {controller.instructionReview && <TaskInstructionReview controller={controller.instructionReview}
        dispensingChanges={document?.queueType === "dispensing"
          ? getDispensingRerequestChanges(document, controller.instructionReview.reviews)
          : undefined} />}
      {!controller.instructionReview && document?.oralInstruction && <OralInstructionInfobar key={document.oralInstruction.chartId} instruction={document.oralInstruction} />}
      {view ? (
        <InstructionDocumentTable
          {...view}
          focusedItemId={focusedItemId}
          refresh={controller.refresh}
          editSetInstruction={document?.canEditInstruction && !document.finalized ? () => setEditInstruction(true) : undefined}
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
            if (!extra?.itemId || !document || document.finalized || controller.busy || controller.loading) return;
            const item = document.items.find(item => item.id === extra.itemId);
            if (action === "complete") {
              if (item?.canComplete && item.status !== "completed") setConfirmItem(item.id);
              return;
            }
            const assigneeId = extra.assignees?.[0];
            if (item?.canAssign && assigneeId && await controller.mutate({ action: "assign", itemId: item.id, assigneeId })) onChanged();
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
            {historyEvents.map(event => (
              <li key={event.id} className="border-l-2 pl-4 text-sm">
                <p>
                  {view?.names[event.actor] ?? "작성자 정보 없음"} ·{" "}
                  {new Date(event.at).toLocaleString("ko-KR", {
                    timeZone: "Asia/Seoul",
                  })}
                </p>
                {event.changes.map((field) => (
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
                        total: document?.queueType === "dispensing" ? "요청 조제량" : "총량",
                        totalUnit: document?.queueType === "dispensing" ? "요청 조제량 단위" : "총량 단위",
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
            ))}
          </ol>
          {!historyEvents.length ? (
            <p className="text-sm text-muted-foreground">수정 이력이 없어요.</p>
          ) : null}
        </EmrDialogShell>
      </Dialog>
      {executionHistory && (
        <InstructionRecords controller={controller} workspaceId={workspaceId} onChanged={onChanged}
          mode="history" onClose={() => setExecutionHistory(false)} />
      )}
      {document && editInstruction && (
        <InstructionEdit controller={controller} workspaceId={workspaceId} onChanged={onChanged}
          onClose={() => setEditInstruction(false)} />
      )}
    </div>
  );
}

function InstructionEdit({ controller, onChanged, onClose, completed = false }: Props & { onClose: () => void; completed?: boolean }) {
  const document = controller.document!;
  const [draft, setDraft] = useState(document.instruction);
  const [revision] = useState(document.revision);
  const busy = controller.busy || controller.loading;
  const stale = revision !== document.revision || document.finalized !== completed;
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <EmrDialogShell
      title={document.isSet ? "세트 공통 지시 수정" : "오더 지시 수정"}
      description="완료 상태는 유지됩니다."
      secondaryAction={<Button variant="outline" disabled={busy} onClick={onClose}>취소</Button>}
      primaryAction={<Button disabled={busy || stale || !document.canEditInstruction || draft === document.instruction} onClick={async () => {
        if (await controller.mutate({ action: "edit_instruction", instruction: draft })) {
          onClose();
          onChanged();
        }
      }}>{controller.busy ? "저장 중" : "저장"}</Button>}>
      <Textarea aria-label="공통 지시" maxLength={5000} value={draft} disabled={busy || stale} onChange={event => setDraft(event.target.value)} />
      {(stale || controller.error) && <p role="alert" className="mt-2 text-sm text-destructive">
        {stale ? "지시서가 변경됐어요. 창을 닫고 최신 내용을 확인해 주세요." : controller.error}
      </p>}
    </EmrDialogShell>
  </Dialog>;
}

function InstructionRecords({ controller, workspaceId, onChanged, onClose, mode }: Props & { onClose: () => void; mode: "history" | "amend" }) {
  const [itemId, setItemId] = useState<string | null>(null);
  const document = controller.document;
  const items = document?.items.filter(item => item.hasResult && (mode === "history" || (item.status === "completed" && item.canReopen))) ?? [];
  const item = items.find(item => item.id === itemId);
  const busy = controller.loading || controller.busy;
  return item ? <ExecutionResultDialog
    workspaceId={workspaceId}
    workItemId={item.id}
    open
    ownershipAllowed={!busy && (mode === "amend" ? !!document?.finalized : !document?.finalized && (item.canComplete || item.canReopen))}
    ownershipKey={document?.revision}
    authorityStatus={item.status}
    onOpenChange={open => { if (!open) setItemId(null); }}
    onSaved={async () => { controller.refresh(); onChanged(); }}
  /> : <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <EmrDialogShell title={mode === "amend" ? "수행기록 정정" : "수행기록"} description={document?.name}>
      <ul className="space-y-2">
        {items.map(item => <li key={item.id}>
          <Button variant="ghost" disabled={busy} onClick={() => setItemId(item.id)}>{item.name}</Button>
        </li>)}
      </ul>
    </EmrDialogShell>
  </Dialog>;
}

export function InstructionDocumentOutputMenu(props: Props) {
  const document = props.controller.document;
  return <InstructionDocumentOutputActions key={`${props.workspaceId}:${document?.rootTaskId}:${document?.queueType}:${document?.finalized}`} {...props} />;
}

function InstructionDocumentOutputActions(props: Props) {
  const [action, setAction] = useState<"amend" | "edit" | null>(null);
  const { document, busy, loading } = props.controller;
  const canEdit = document?.finalized && document.canEditInstruction;
  const canAmend = document?.finalized && document.items.some(item => item.status === "completed" && item.canReopen && item.hasResult);
  return <>
    <EmrInstructionOutputMenu>
      {canEdit && <DropdownMenuItem disabled={busy || loading} onClick={() => setAction("edit")}>{document.isSet ? "세트 공통 지시 수정" : "오더 지시 수정"}</DropdownMenuItem>}
      {canAmend && <DropdownMenuItem disabled={busy || loading} onClick={() => setAction("amend")}>수행기록 정정</DropdownMenuItem>}
      {(canEdit || canAmend) && <DropdownMenuSeparator />}
    </EmrInstructionOutputMenu>
    {document?.finalized && action === "edit" && <InstructionEdit {...props} completed onClose={() => setAction(null)} />}
    {document?.finalized && action === "amend" && <InstructionRecords {...props} mode="amend" onClose={() => setAction(null)} />}
  </>;
}
