import type {
  CopyHistoryItem,
  CopyIntent,
  CopyResult,
  PendingCopy,
  SearchPage,
  SearchParams,
  SearchVisit,
} from "./contract";
export async function chartRequest<T>(
  workspace: string,
  action: string,
  input: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const res = await fetch(
    `/api/workspaces/${encodeURIComponent(workspace)}/chart/advanced-search`,
    {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, input }),
    },
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "request_failed");
  return data;
}
export const chartSearchApi = (workspace: string) => ({
  search: (input: SearchParams, signal?: AbortSignal) =>
    chartRequest<SearchPage>(workspace, "search", input, signal),
  history: (chartId: string, signal?: AbortSignal) =>
    chartRequest<CopyHistoryItem[]>(workspace, "history", { chartId }, signal),
  visits: () => chartRequest<SearchVisit[]>(workspace, "visits", {}),
  apply: (input: CopyIntent) =>
    chartRequest<CopyResult>(workspace, "apply", input),
  park: (input: CopyIntent) =>
    chartRequest<{ id: string }>(workspace, "park", input),
  pending: (
    input: { targetId: string; encounterId: string; patientId: string; pendingId?: string },
    signal?: AbortSignal,
  ) => chartRequest<PendingCopy | null>(workspace, "pending", input, signal),
  discard: (id: string) => chartRequest<object>(workspace, "discard", { id }),
});
export type ChartSearchApi = ReturnType<typeof chartSearchApi>;
export const orderCopyPermissionMessage =
  "오더를 복사하려면 병원 오더 목록 조회 권한이 필요합니다.";
export function errorMessage(error: unknown) {
  const key = error instanceof Error ? error.message : "";
  if (key === "target_patient_deleted")
    return "선택한 환자가 삭제되어 복사할 수 없습니다. 다른 대상을 선택해 주세요.";
  if (key === "catalog_permission_missing")
    return orderCopyPermissionMessage;
  if (key === "permission_missing" || key === "unauthenticated")
    return "차트를 열거나 수정할 권한을 확인해 주세요.";
  if (key === "invalid_resume")
    return "이 복사 대기를 이어갈 수 없습니다. 첫 차트를 다시 열어 적용 이력과 현재 담당자를 확인해 주세요.";
  if (key === "pending_exists")
    return "이 방문에 이어갈 복사가 이미 있습니다. 첫 차트에서 확인해 주세요.";
  if (key === "revision_conflict" || key === "price_changed")
    return "원본이나 대상이 변경됐습니다. 최신 기록을 다시 확인해 주세요.";
  if (key.includes("unavailable") || key === "stale_status")
    return "선택한 차트 또는 항목을 사용할 수 없습니다. 현재 상태를 확인해 주세요.";
  if (key === "invalid_selection" || key.includes("duplicate"))
    return "선택 항목과 중복 여부, 처방 값을 확인해 주세요.";
  return "요청을 완료하지 못했습니다. 다시 시도해 주세요.";
}
