import type { EmrSidePanelStateIconState } from "@/components/emr/side-panel-state-icon";
import type { ChartOrderExecutionTask } from "./server-order-execution-read-model-core";

export type ChartOrderPresentationRow = {
  order: { id: string; status: string };
  runtimeRow?: {
    orderConfirmationStatus?: string;
    parentOrderId?: string | null;
    rowType?: string;
  };
  executionTask?: Pick<ChartOrderExecutionTask,
    "status" | "clinicalOrderType" | "detailedPhase" | "requestCycle" | "attemptNo">;
};

export type ChartOrderConfirmationState = "ready" | "invalid" | "confirmed";

export function isChartOrderPresentationConfirmed(row: ChartOrderPresentationRow) {
  const status = row.runtimeRow?.orderConfirmationStatus;
  if (status) return status !== "draft";
  return ["confirmed", "in_progress", "completed", "cancelled", "re_requested"].includes(row.order.status);
}

export function getChartOrderConfirmationState(
  row: ChartOrderPresentationRow,
  invalidOrderIds: ReadonlySet<string>,
): ChartOrderConfirmationState {
  if (isChartOrderPresentationConfirmed(row)) return "confirmed";
  return invalidOrderIds.has(row.order.id) ? "invalid" : "ready";
}

export function getChartOrderWorkPresentation(row: ChartOrderPresentationRow): {
  label: string;
  icon: EmrSidePanelStateIconState | null;
  unconfirmed: boolean;
} {
  if (!isChartOrderPresentationConfirmed(row)) {
    return { label: "—", icon: null, unconfirmed: true };
  }
  // Cancellation is a display override; immutable task results stay intact.
  if (row.order.status === "cancelled" || row.runtimeRow?.orderConfirmationStatus === "cancelled") {
    return { label: "취소", icon: "cancel", unconfirmed: false };
  }
  const task = row.executionTask;
  if (!task) return { label: "—", icon: null, unconfirmed: false };
  let label: string;
  let icon: EmrSidePanelStateIconState;
  switch (task.status) {
    case "cancelled": label = "취소"; icon = "cancel"; break;
    case "returned": label = "반려"; icon = "rework"; break;
    case "paused": label = "일시중지"; icon = "stop"; break;
    case "complete": label = task.clinicalOrderType === "imaging" ? "판독완" : "완료"; icon = "done"; break;
    case "partial_complete": label = "부분완"; icon = "done"; break;
    case "pending": {
      const requestedAgain = (task.requestCycle ?? task.attemptNo) > 1;
      label = requestedAgain ? "재요청" : "대기중";
      icon = requestedAgain ? "rework" : "to-do";
      break;
    }
    default: {
      const phases: Record<string, string> = {
        acquisition_preparing: "촬영준비", acquisition_completed: "촬영종료",
        interpretation_in_progress: "판독중", interpretation_completed: "판독완",
        inputting: "입력중", partial_complete: "부분완", dispensing: "조제중",
        treatment: "처치중", surgery: "수술중", surgery_completed: "수술완",
      };
      label = (task.detailedPhase && phases[task.detailedPhase]) ||
        (task.clinicalOrderType === "dispensing" ? "조제중" : task.clinicalOrderType === "treatment" ? "처치중" : "진행중");
      // Intermediate phases remain in progress even if their label says 종료.
      icon = ["interpretation_completed", "partial_complete", "surgery_completed"].includes(task.detailedPhase ?? "") ? "done" : "in-progress";
    }
  }
  return { label, icon, unconfirmed: false };
}

export const chartOrderConfirmationRank = { ready: 0, invalid: 1, confirmed: 2 } as const;

/** Sort complete sets, never individual children away from their parent. */
export function sortChartOrderGroups<T extends ChartOrderPresentationRow>(
  rows: readonly T[],
  compare: (a: T, b: T) => number,
  frozenOrderIds: readonly string[] | null = null,
): T[] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = row.runtimeRow?.parentOrderId ?? row.order.id;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  const rank = new Map(frozenOrderIds?.map((id, index) => [id, index]));
  const ordered = [...groups.entries()].map(([id, members]) => {
    const parent = members.find(row => row.order.id === id);
    return parent ? [parent, ...members.filter(row => row !== parent)] : members;
  });
  ordered.sort((a, b) => frozenOrderIds
    ? Math.min(...a.map(row => rank.get(row.order.id) ?? Number.MAX_SAFE_INTEGER)) -
      Math.min(...b.map(row => rank.get(row.order.id) ?? Number.MAX_SAFE_INTEGER))
    : compare(a[0], b[0]));
  return ordered.flat();
}
