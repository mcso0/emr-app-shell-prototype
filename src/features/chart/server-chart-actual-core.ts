import { isExecutionRecord, isExecutionUuid } from "@/features/fulfillment/execution-result-contract";
import { isActualTimestamp, parseChartActualContext, parseChartActualPayload, type ChartActualContext } from "./chart-actual-contract";

export type ChartActualRpcClient = { rpc(name: "clair_get_chart_actual_context" | "clair_amend_chart_actual_result", args: Record<string, unknown>):
  PromiseLike<{ data: unknown; error: { message?: string } | null }> };
type Result = { ok: true; status: 200; context: ChartActualContext } | { ok: false; status: number; error: string };
const known = new Set(["actor_mismatch", "permission_missing", "task_unavailable", "invalid_chart_actual", "invalid_performed_at",
  "idempotency_conflict", "plan_revision_conflict", "result_revision_conflict"]);
const fail = (message?: string): Result => ({ ok: false, status: message === "permission_missing" || message === "actor_mismatch" ? 403 : known.has(message ?? "") ? 409 : 500,
  error: known.has(message ?? "") ? message! : "chart_actual_unavailable" });
export async function readChartActual({ client, workspaceId, taskId }: { client: ChartActualRpcClient; workspaceId: string; taskId: string }): Promise<Result> {
  if (!workspaceId.trim() || !isExecutionUuid(taskId)) return { ok: false, status: 400, error: "invalid_chart_actual" };
  try {
    const { data, error } = await client.rpc("clair_get_chart_actual_context", { p_workspace_id: workspaceId, p_task_id: taskId });
    if (error) return fail(error.message);
    const context = parseChartActualContext(data, workspaceId, taskId);
    return context ? { ok: true, status: 200, context } : { ok: false, status: 502, error: "invalid_execution_response" };
  } catch { return fail(); }
}
export async function amendChartActual({ client, actorUserId, workspaceId, taskId, input }: {
  client: ChartActualRpcClient; actorUserId: string; workspaceId: string; taskId: string; input: unknown;
}): Promise<Result> {
  if (!isExecutionUuid(actorUserId) || !isExecutionRecord(input) || !isExecutionUuid(input.commandId)
    || Object.keys(input).some(key => !["commandId", "expectedResultVersion", "expectedPlanSha256", "performedAt", "payload", "amendmentReason"].includes(key))
    || !Number.isSafeInteger(input.expectedResultVersion) || Number(input.expectedResultVersion) < 1
    || typeof input.expectedPlanSha256 !== "string" || !/^[a-f0-9]{64}$/.test(input.expectedPlanSha256)
    || !isActualTimestamp(input.performedAt) || typeof input.amendmentReason !== "string"
    || !input.amendmentReason.trim() || input.amendmentReason.length > 500) return { ok: false, status: 400, error: "invalid_chart_actual" };
  const current = await readChartActual({ client, workspaceId, taskId });
  if (!current.ok) return current;
  if (!current.context.canAmend) return fail("permission_missing");
  const payload = parseChartActualPayload(current.context.clinicalOrderType, input.payload);
  if (!payload) return { ok: false, status: 400, error: "invalid_chart_actual" };
  try {
    const { data, error } = await client.rpc("clair_amend_chart_actual_result", {
      p_workspace_id: workspaceId, p_actor_user_id: actorUserId, p_task_id: taskId,
      p_expected_plan_sha256: input.expectedPlanSha256, p_expected_result_version: input.expectedResultVersion,
      p_command_id: input.commandId, p_performed_at: input.performedAt, p_payload: payload, p_amendment_reason: input.amendmentReason.trim(),
    });
    if (error) return fail(error.message);
    const context = parseChartActualContext(data, workspaceId, taskId);
    return context ? { ok: true, status: 200, context } : { ok: false, status: 502, error: "invalid_execution_response" };
  } catch { return fail(); }
}
