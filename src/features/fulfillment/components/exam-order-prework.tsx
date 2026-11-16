"use client";

import { EmrWorkEntryAction } from "@/components/emr/work-entry-action";
import { EmrWorkEntrySection, EmrWorkEntrySummary } from "@/components/emr/work-entry-page";
import { PatientOrderPrework } from "./patient-order-prework";
import { TaskInstructionReview } from "./task-instruction-review";
import type { TaskInstructionReviewController } from "../use-task-instruction-review";
import type { FulfillmentWorkItem } from "../server-fulfillment-work-item-core";
import { getFulfillmentOrderDisplayName } from "../patient-history-aside";

export function ExamOrderPrework({ workItem, review, busy, error, onConfirm, onEntered }: {
  workItem: Pick<FulfillmentWorkItem, "id" | "workspaceId" | "encounterId" | "patientId" | "patientName" | "guardianName" | "requesterName" | "queueType" | "rowRevision" | "canManage" | "assignedToUserId" | "assignedToDisplayName"> & { createdAt?: string; sourceSnapshot?: Record<string, unknown> };
  review: TaskInstructionReviewController;
  busy: boolean;
  error?: string | null;
  onConfirm: () => Promise<boolean | "review_required">;
  onEntered: () => void;
}) {
  const label = workItem.queueType === "lab" ? "임상검사" : "영상검사";
  const owns = Boolean(workItem.canManage && workItem.assignedToUserId);
  const name = getFulfillmentOrderDisplayName(workItem.sourceSnapshot) ?? "검사 오더";
  const instruction = workItem.sourceSnapshot?.instruction;
  return <PatientOrderPrework workItem={workItem} label={label} testId={`${workItem.queueType}-prework`} excludeWorkItemIds={[workItem.id]}
    actions={<EmrWorkEntryAction scopeKey={`${workItem.workspaceId}:${workItem.id}`} authorityKey={`${workItem.rowRevision}:${workItem.canManage}:${workItem.assignedToUserId}`}
      mode={owns ? "start" : workItem.canManage && !workItem.assignedToUserId ? "claim" : "blocked"}
      assigneeName={workItem.assignedToDisplayName} busy={busy} error={error} onConfirm={onConfirm} onEntered={onEntered}
      context={<><strong>{label} · {name}</strong><p>현재 담당: {workItem.assignedToDisplayName ?? "미지정"}</p></>} /> }>
    <TaskInstructionReview controller={review} />
    <EmrWorkEntrySection title="요청 정보"><EmrWorkEntrySummary items={[
      ["요청 일시", workItem.createdAt ? new Date(workItem.createdAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }) : "—"],
      ["요청 수의사", workItem.requesterName ?? "—"], ["요청 항목", name], ["담당자", workItem.assignedToDisplayName ?? "미지정"], ["시작 상태", "미시작"],
    ]} /></EmrWorkEntrySection>
    <EmrWorkEntrySection title={`요청된 ${label} 오더`}><div className="rounded-lg border border-border p-4 text-sm"><p className="font-medium">{name}</p>{typeof instruction === "string" && instruction && <p className="mt-2 whitespace-pre-wrap">{instruction}</p>}</div></EmrWorkEntrySection>
  </PatientOrderPrework>;
}
