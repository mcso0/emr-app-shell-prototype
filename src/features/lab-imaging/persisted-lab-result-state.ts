import type { LabResult } from "@/types/emr-domain";
import { parsePersistedLabResult, parsePriorLabResults } from "./persisted-result-contract";

export type PersistedLabResultState = {
  key: string; status: "loading" | "ready" | "empty" | "error" | "permission_denied"; payload?: unknown;
};

// A payload from another owner is never displayed. Parsing retains the frozen
// result contract's workspace, work-item, order and encounter validation.
export function getPersistedLabResultView({ enabled, state, key, base, workspaceId, workItemId, taskId, taskAttemptNo }: {
  enabled: boolean; state: PersistedLabResultState; key: string;
  base: LabResult | undefined; workspaceId: string; workItemId: string | undefined; taskId?: string | null; taskAttemptNo?: number | null;
}): { status: PersistedLabResultState["status"] | "idle"; result: LabResult | null; priorResults?: LabResult["priorResults"] } {
  const orderId = base?.orderId;
  const encounterId = base?.encounterId;
  if (!enabled) return { status: "idle" as const, result: null };
  if (state.key !== key) return { status: "loading" as const, result: null };
  const result = (state.status === "ready" || state.status === "loading" || state.status === "error") && base && workItemId && orderId && encounterId
    ? parsePersistedLabResult(state.payload, { workspaceId, workItemId, orderId, encounterId, taskId, taskAttemptNo }, base) : null;
  const payload = state.payload as Record<string, unknown> | undefined;
  const priorResults = state.status === "empty" && payload?.workspaceId === workspaceId && payload?.orderId === orderId
    ? parsePriorLabResults(payload.priorResults) ?? [] : result?.priorResults ?? [];
  return { ...(priorResults.length ? { priorResults } : {}), status: state.status === "ready" && !result ? "error" as const : state.status, result };
}
