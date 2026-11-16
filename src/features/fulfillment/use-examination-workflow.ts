"use client";

import { useLayoutEffect, useRef } from "react";
import { toast } from "sonner";
import { useTaskInstructionReview } from "./use-task-instruction-review";
import { useRerequestReviewOnEntry } from "./use-rerequest-review-on-entry";
import { isPendingFulfillmentRerequest } from "./rerequest";
import type { FulfillmentWorkItem, FulfillmentWorkItemAction } from "./server-fulfillment-work-item-core";
import type { FulfillmentTransitionOptions } from "./components/work-lifecycle-action";

type Transition = (id: string, transitions: ({ action: FulfillmentWorkItemAction } & FulfillmentTransitionOptions)[], onError?: (code: string) => void) => Promise<boolean>;

/** Examinations use the same acknowledgement and explicit restart as instructions. */
export function useExaminationWorkflow(workspaceId: string, item: Pick<FulfillmentWorkItem, "id" | "taskId" | "taskAttemptNo" | "rowRevision" | "pauseReason" | "canManage" | "assignedToUserId" | "status" | "queueType"> | undefined, enabled: boolean, loading: boolean, updateStatus: Transition) {
  const authority = `${workspaceId}:${item?.taskId}:${item?.taskAttemptNo}:${item?.rowRevision}:${item?.pauseReason ?? ""}:${item?.canManage}`;
  const latest = useRef(authority);
  useLayoutEffect(() => { latest.current = authority; }, [authority]);
  const review = useTaskInstructionReview(workspaceId, enabled && item?.taskId ? [item.taskId] : [], authority);
  const pendingRerequest = Boolean(item && isPendingFulfillmentRerequest(item.status, item.taskAttemptNo ?? 1, item.assignedToUserId));
  const assignedRerequest = pendingRerequest && Boolean(item?.assignedToUserId);
  const execute = async (action: FulfillmentWorkItemAction, options?: FulfillmentTransitionOptions) => {
    if (!item || item.pauseReason || latest.current !== authority) return false;
    return updateStatus(item.id, [{ action, ...options }], code => {
      if (code === "instruction_ack_required") review.requireReview();
    });
  };
  const continueWork = async (action: FulfillmentWorkItemAction, options?: FulfillmentTransitionOptions) => {
    try {
      if (await execute(action, options)) return;
    } catch { /* Keep the queue unchanged and offer another explicit attempt. */ }
    toast.error("업무를 시작하지 못했습니다. 최신 상태를 확인하고 다시 시도해 주세요.");
  };
  const transition = async (action: FulfillmentWorkItemAction, options?: FulfillmentTransitionOptions) => {
    if (!item || item.pauseReason) return false;
    if (["claim", "start", "resume", "complete"].includes(action)) {
      const continuation = pendingRerequest && action === "claim" ? {
        label: "확인하고 업무 시작", run: () => continueWork(action, options),
      } : undefined;
      if (!await review.check(undefined, continuation)) return "review_required" as const;
    }
    return execute(action, options);
  };
  const openRerequestReview = () => {
    if (!assignedRerequest || !item?.canManage || item.pauseReason || loading) return;
    review.requireReview({ label: "업무 시작하기", restartOrder: item.queueType === "lab" ? "임상병리" : "영상",
      run: () => continueWork("start", { detailedPhase: item.queueType === "lab" ? "inputting" : "interpretation_in_progress" }) });
  };
  useRerequestReviewOnEntry(enabled && assignedRerequest && item?.canManage && !item.pauseReason && !loading ? `${workspaceId}:${item.taskId}` : "", openRerequestReview);
  return { review, transition, assignedRerequest, openRerequestReview };
}
