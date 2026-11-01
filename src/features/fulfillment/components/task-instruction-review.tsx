"use client";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmrDialogShell } from "@/components/emr/dialog-shell";
import { TaskInstructionCallout } from "./task-instruction-callout";
import { instructionScopeLabels } from "@/features/chart/overall-instructions-contract";
import { instructionReviewTargetId, type EffectiveInstructions } from "../task-instruction-review-contract";
import type { TaskInstructionReviewController } from "../use-task-instruction-review";

function InstructionContent({ document }: { document: EffectiveInstructions | null }) {
  if (!document) return <p className="text-sm text-muted-foreground">기록 없음</p>;
  return document.entries.length ? <div className="space-y-3">{document.entries.map(item => <section key={`${item.scope}:${item.legacy}`}>
    <h4 className="text-xs font-medium text-muted-foreground">{item.legacy ? "경구제 지시" : instructionScopeLabels[item.scope]}</h4>
    <p className="mt-1 whitespace-pre-wrap break-words text-sm">{item.deleted ? "지시 삭제됨" : item.instruction}</p>
    {item.createdAt && <p className="mt-1 text-xs text-muted-foreground">{item.actorName} · {new Date(item.createdAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</p>}
  </section>)}</div> : <p className="text-sm text-muted-foreground">작성된 지시 없음</p>;
}

/** Shared by real task callers and synthetic interaction stories. */
export function TaskInstructionReview({ controller }: { controller: TaskInstructionReviewController }) {
  const visible = controller.reviews.filter(item => item.current?.entries.length);
  const unique = visible.filter((item, index) => visible.findIndex(other => other.current?.chartId === item.current?.chartId && other.current?.versionKey === item.current?.versionKey) === index);
  const selected = controller.selected.filter((item, index) => controller.selected.findIndex(other => other.current?.chartId === item.current?.chartId && other.current?.versionKey === item.current?.versionKey) === index);
  return <>
    {controller.error && !controller.open && <div role="alert" className="flex items-center justify-between gap-3 text-sm"><p>{controller.error}</p><Button size="sm" variant="outline" onClick={() => void controller.refresh()}>다시 확인</Button></div>}
    {unique.map(item => <TaskInstructionCallout key={`${controller.workspaceId}:${item.current!.chartId}:${item.current!.versionKey}`}
      document={item.current!} workspaceId={controller.workspaceId} onReview={controller.show} />)}
    <Dialog open={controller.open} onOpenChange={open => { if (!open) controller.close(); }}>
      <EmrDialogShell title="지시사항 확인" variant="wide-form" showCloseButton={!controller.busy}
        secondaryAction={<Button variant="outline" disabled={controller.busy} onClick={controller.close}>닫기</Button>}
        primaryAction={selected.some(item => item.requiresAcknowledgement) && <Button disabled={controller.busy} onClick={() => void controller.acknowledge()}>{controller.busy ? "확인 중…" : "최신 지시 확인"}</Button>}>
        <div className="space-y-6">{selected.map(item => <section key={instructionReviewTargetId(item)}>
          <div className="grid gap-4 sm:grid-cols-2"><div className="rounded-lg border p-3"><h3 className="mb-3 text-sm font-medium">이전 확인·요청 당시</h3><InstructionContent document={item.previous} /></div>
            <div className="rounded-lg border p-3"><h3 className="mb-3 text-sm font-medium">최신 지시</h3><InstructionContent document={item.current} /></div></div>
          {item.snapshots.length > 0 && <details className="mt-3 text-sm"><summary className="cursor-pointer">요청·완료 당시 기록</summary><div className="mt-3 space-y-4">{item.snapshots.map((snapshot, index) => <section className="rounded-lg border p-3" key={index}><h4 className="mb-3 font-medium">{snapshot.legacy ? "이전 경구제 기록 · " : ""}{snapshot.attemptNo ? `${snapshot.attemptNo}회차 · ` : ""}{snapshot.phase === "requested" ? "요청 당시" : "완료 당시"} · {new Date(snapshot.capturedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</h4><InstructionContent document={snapshot.document} /></section>)}</div></details>}
        </section>)}</div>
        {controller.error && <div role="alert" className="mt-4 text-sm"><p>{controller.error}</p><Button size="sm" variant="outline" disabled={controller.busy} onClick={() => void controller.refresh()}>최신 내용 조회</Button></div>}
      </EmrDialogShell>
    </Dialog>
  </>;
}
