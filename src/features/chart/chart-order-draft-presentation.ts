import type { ChartOrderDraftSaveState } from "./chart-order-draft-types";

// Save notices are a projection. This function never marks edits saved or
// controls retry, confirmation or billing authority.
export function getChartOrderDraftStatusText({
  orderLoading, orderDraftSaveState, orderDraftReadError, hasDraftChanges,
  changedDraftOrderCount, invalidDraftOrderCount,
}: {
  orderLoading: boolean; orderDraftSaveState: ChartOrderDraftSaveState;
  orderDraftReadError: boolean; hasDraftChanges: boolean;
  changedDraftOrderCount: number; invalidDraftOrderCount: number;
}) {
  return orderLoading
    ? "오더 정보를 불러오는 중"
    : orderDraftSaveState === "saving"
      ? "저장 중"
      : orderDraftSaveState === "error"
        ? orderDraftReadError ? "조회 실패" : "저장 실패"
        : orderDraftSaveState === "conflict"
          ? "충돌 해결 필요"
          : hasDraftChanges
            ? `변경 대기 ${changedDraftOrderCount}건${invalidDraftOrderCount ? ` · 입력 확인 필요 ${invalidDraftOrderCount}건` : ""}`
            : "저장됨";
}
