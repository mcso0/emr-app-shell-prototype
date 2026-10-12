export type PersistedLabResultScope = {
  workspaceId: string; workItemId: string; orderId: string; encounterId: string;
};
export type PersistedLabResultReply = {
  status: "ready" | "empty" | "error" | "permission_denied"; payload: unknown;
};

// This read never commits React state. The caller owns cancellation and keeps
// any retryable previous payload only for the same scope.
export async function loadPersistedLabResult(
  { workspaceId, workItemId, orderId }: PersistedLabResultScope,
  signal: AbortSignal,
): Promise<PersistedLabResultReply | null> {
  const params = new URLSearchParams({ workItemId, orderId });
  const response = await fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/lab-imaging/result-entries?${params}`, {
    cache: "no-store", signal,
  });
  const payload = await response.json();
  if (signal.aborted) return null;
  const status = response.status === 401 || response.status === 403 ? "permission_denied"
    : !response.ok || payload?.ok !== true ? "error" : payload.savedResult === null ? "empty" : "ready";
  return { status, payload };
}
