"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmrDialogShell } from "@/components/emr/dialog-shell";
import { TaskInstructionCallout } from "./task-instruction-callout";
import { instructionScopeLabels } from "@/features/chart/overall-instructions-contract";
import { instructionReviewTargetId, type OrderRerequestChange, type EffectiveInstructions } from "../task-instruction-review-contract";
import type { TaskInstructionReviewController } from "../use-task-instruction-review";

function InstructionContent({ document }: { document: EffectiveInstructions | null }) {
  if (!document) return <p className="text-sm text-muted-foreground">기록 없음</p>;
  return document.entries.length ? <div className="space-y-3">{document.entries.map(item => <section key={`${item.scope}:${item.kind ?? item.legacy}:${item.orderId ?? ""}`}>
    <h4 className="text-xs font-medium text-muted-foreground">{item.kind === "clinical_edit" ? "업무 변경" : item.legacy ? "경구제 지시" : instructionScopeLabels[item.scope]}</h4>
    <p className="mt-1 whitespace-pre-wrap break-words text-sm">{item.deleted ? "지시 삭제됨" : item.instruction}</p>
    {item.createdAt && <p className="mt-1 text-xs text-muted-foreground">{item.actorName} · {new Date(item.createdAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</p>}
  </section>)}</div> : <p className="text-sm text-muted-foreground">작성된 지시 없음</p>;
}

function OrderChangeContent({ change, orderType }: { change: OrderRerequestChange; orderType: "조제" | "처치" }) {
  return <>
    <h3 className="break-words text-base font-semibold">{change.orderName}</h3>
    {change.entry.createdAt && <p className="mt-1 text-xs text-muted-foreground">
      {[change.entry.actorName, new Date(change.entry.createdAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })].filter(Boolean).join(" · ")}
    </p>}
    <div className="mt-3 overflow-hidden rounded-lg border border-[var(--emr-border-default)]">
      <table aria-label={`${orderType} 오더 변경 전후`} className="w-full table-fixed text-left text-sm">
        <thead className="bg-[var(--emr-surface-muted)] text-xs text-muted-foreground">
          <tr><th scope="col" className="w-[36%] px-3 py-2">항목</th>
            <th scope="col" className="px-3 py-2">변경 전</th>
            <th scope="col" className="bg-[var(--emr-status-warning-bg)] px-3 py-2">변경 후</th></tr>
        </thead>
        <tbody>{change.fields.map(field => <tr key={field.key} className="border-t border-[var(--emr-border-default)] align-top">
          <th scope="row" className="break-words px-3 py-2 font-medium">{field.label}</th>
          <td className="whitespace-pre-wrap break-words px-3 py-2 text-muted-foreground">{field.before}</td>
          <td className="whitespace-pre-wrap break-words bg-[var(--emr-status-warning-bg)] px-3 py-2 font-semibold text-[var(--emr-status-warning-text)]">{field.after}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <dl className="mt-4 flex gap-3 text-sm"><dt className="shrink-0 font-medium">변경 사유</dt>
      <dd className="min-w-0 whitespace-pre-wrap break-words">{change.reason}</dd></dl>
  </>;
}

/** Shared by real task callers and synthetic interaction stories. */
export function TaskInstructionReview({ controller, renderInstructions, orderChanges, orderType = "조제", readOnly = false }: {
  controller: TaskInstructionReviewController;
  renderInstructions?: (documents: EffectiveInstructions[]) => ReactNode;
  orderChanges?: ReadonlyMap<string, OrderRerequestChange | null>;
  orderType?: "조제" | "처치";
  readOnly?: boolean;
}) {
  const visible = controller.reviews.filter(item => item.current?.entries.length);
  const unique = visible.filter((item, index) => visible.findIndex(other => other.current?.chartId === item.current?.chartId && other.current?.versionKey === item.current?.versionKey) === index);
  const selected = controller.selected.filter((item, index) => controller.selected.findIndex(other => other.current?.chartId === item.current?.chartId && other.current?.versionKey === item.current?.versionKey) === index);
  const hasOrderChange = (item: (typeof selected)[number]) => Boolean(orderChanges?.get(instructionReviewTargetId(item)));
  const changedItems = selected.filter(hasOrderChange);
  const hasChanges = changedItems.length > 0;
  const reviewItems = hasChanges
    ? [...changedItems, ...selected.filter(item => !hasOrderChange(item))]
    : selected;
  const hasClinicalChange = selected.some(item => item.current?.entries.some(entry => entry.kind === "clinical_edit"));
  const hasPartialWork = selected.some(item => item.current?.partialWork?.length);
  const confirmLabel = hasClinicalChange
    ? hasChanges && !hasPartialWork ? "변경 확인" : "변경·남은 작업 범위 확인"
    : "최신 지시 확인";

  return <>
    {controller.error && !controller.open && <div role="alert" className="flex items-center justify-between gap-3 text-sm"><p>{controller.error}</p><Button size="sm" variant="outline" onClick={() => void controller.refresh()}>다시 확인</Button></div>}
    {renderInstructions ? renderInstructions(unique.map(item => item.current!)) : unique.map(item => <TaskInstructionCallout key={`${controller.workspaceId}:${item.current!.chartId}:${item.current!.versionKey}`}
      document={item.current!} workspaceId={controller.workspaceId} onReview={controller.show}
      orderType={orderType} orderChange={orderChanges?.get(instructionReviewTargetId(item)) ?? undefined} />)}
    <Dialog open={controller.open} onOpenChange={open => { if (!open) controller.close(); }}>
      <EmrDialogShell title={controller.restartOrder ? `${controller.restartOrder} 오더 변경 안내` : hasChanges ? `${orderType} 오더 변경 확인` : "지시사항 확인"}
        description={controller.restartOrder ? "변경된 지시를 확인해 주세요. 업무를 시작하면 진행중 상태가 됩니다." : undefined}
        variant="wide-form" showCloseButton={!controller.busy}
        secondaryAction={<Button variant="outline" disabled={controller.busy} onClick={controller.close}>{controller.restartOrder ? "취소" : "닫기"}</Button>}
        primaryAction={!readOnly && (controller.restartOrder || selected.some(item => item.requiresAcknowledgement)) && (
          <Button disabled={controller.busy || controller.loadingRestart || !selected.length}
            onClick={() => void controller.acknowledge()}>
            {controller.busy ? "확인 중…" : controller.continuationLabel ?? confirmLabel}
          </Button>
        )}>
        {controller.loadingRestart && <p className="text-sm text-muted-foreground" role="status">변경 내용을 불러오는 중이에요.</p>}
        <div className="space-y-6">{(controller.loadingRestart ? [] : reviewItems).map(item => {
          const targetId = instructionReviewTargetId(item);
          const change = orderChanges?.get(targetId);
          const otherEntries = change ? item.current?.entries.filter(entry => entry !== change.entry) ?? [] : [];
          const snapshots = orderChanges?.has(targetId)
            ? item.snapshots.filter(snapshot => snapshot.document.entries.length > 0)
            : item.snapshots;
          return <section key={targetId}>
            {change ? <>
              <OrderChangeContent change={change} orderType={orderType} />
              {item.current && otherEntries.length > 0 && <div className="mt-4 border-t pt-3">
                <h3 className="mb-2 text-sm font-medium">최신 지시</h3>
                <InstructionContent document={{ ...item.current, entries: otherEntries }} />
              </div>}
            </> : <div className="grid gap-4 sm:grid-cols-2"><div className="rounded-lg border p-3"><h3 className="mb-3 text-sm font-medium">이전 확인·요청 당시</h3><InstructionContent document={item.previous} /></div>
              <div className="rounded-lg border p-3"><h3 className="mb-3 text-sm font-medium">최신 지시</h3><InstructionContent document={item.current} /></div></div>}
            {!!item.current?.partialWork?.length && <section className="mt-3 rounded-lg border p-3 text-sm"><h4 className="mb-2 font-medium">이미 수행한 내용</h4>{item.current.partialWork.map((note, index) => <p className="mb-2 whitespace-pre-wrap" key={index}>{note.attemptNo}회차 · {note.actorName}: {note.note}</p>)}<p className="text-muted-foreground">남은 작업 범위를 확인해 주세요. 이전 수행량을 자동으로 차감하지 않아요.</p></section>}
            {snapshots.length > 0 && <details className="mt-3 text-sm"><summary className="cursor-pointer">요청·완료 당시 기록</summary><div className="mt-3 space-y-4">{snapshots.map((snapshot, index) => <section className="rounded-lg border p-3" key={index}><h4 className="mb-3 font-medium">{snapshot.legacy ? "이전 경구제 기록 · " : ""}{snapshot.attemptNo ? `${snapshot.attemptNo}회차 · ` : ""}{snapshot.phase === "requested" ? "요청 당시" : "완료 당시"} · {new Date(snapshot.capturedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</h4><InstructionContent document={snapshot.document} /></section>)}</div></details>}
          </section>;
        })}</div>
        {controller.error && <div role="alert" className="mt-4 text-sm"><p>{controller.error}</p><Button size="sm" variant="outline" disabled={controller.busy} onClick={() => void controller.refresh()}>최신 내용 조회</Button></div>}
      </EmrDialogShell>
    </Dialog>
  </>;
}
