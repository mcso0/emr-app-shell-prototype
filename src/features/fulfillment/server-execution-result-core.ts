import {
  isExecutionUuid, parseExecutionCommand, parseExecutionContext, parseExecutionPayload,
  type ExecutionContext,
} from "./execution-result-contract";

export type ExecutionRpcClient = {
  rpc(name: "clair_get_order_execution_context" | "clair_record_order_execution_result", args: Record<string, unknown>):
    PromiseLike<{ data: unknown; error: { message?: string; code?: string } | null }>;
};
type ExecutionResponse = { ok: true; status: 200; context: ExecutionContext }
  | { ok: false; status: number; error: string };
const knownErrors = new Set([
  "current_assignee_required", "actor_mismatch", "workspace_membership_missing", "permission_missing", "work_item_unavailable",
  "queue_projection_task_mismatch", "invalid_execution_command", "invalid_performed_at", "reason_too_long",
  "invalid_execution_payload", "instruction_ack_required", "idempotency_conflict", "revision_conflict", "plan_revision_conflict",
  "result_revision_conflict", "invalid_transition", "amendment_reason_required", "variance_reason_required",
  "treatment_medication_link_required", "treatment_medication_link_invalid",
  "actual_execution_result_required", "terminal_work_item_immutable",
]);
function failure(message?: string): ExecutionResponse {
  const error = knownErrors.has(message ?? "") ? message! : "execution_request_failed";
  return { ok: false, status: ["current_assignee_required", "actor_mismatch", "workspace_membership_missing", "permission_missing"].includes(error) ? 403
    : error === "execution_request_failed" ? 500 : 409, error };
}

export async function readExecutionContext({ client, workspaceId, workItemId, taskId }: {
  client: ExecutionRpcClient; workspaceId: string; workItemId: string; taskId?: string;
}): Promise<ExecutionResponse> {
  if (!workspaceId.trim() || !isExecutionUuid(workItemId) || (taskId !== undefined && !isExecutionUuid(taskId))) {
    return { ok: false, status: 400, error: "invalid_execution_command" };
  }
  try {
    const { data, error } = await client.rpc("clair_get_order_execution_context", {
      p_workspace_id: workspaceId, p_work_item_id: workItemId, p_task_id: taskId ?? null,
    });
    if (error) return failure(error.message);
    const context = parseExecutionContext(data, workspaceId, workItemId, taskId);
    return context ? { ok: true, status: 200, context } : { ok: false, status: 502, error: "invalid_execution_response" };
  } catch { return failure(); }
}

export async function recordExecutionResult({ client, actorUserId, workspaceId, workItemId, input }: {
  client: ExecutionRpcClient; actorUserId: string; workspaceId: string; workItemId: string; input: unknown;
}): Promise<ExecutionResponse> {
  const command = parseExecutionCommand(input);
  if (!command || !isExecutionUuid(actorUserId)) return { ok: false, status: 400, error: "invalid_execution_command" };
  const current = await readExecutionContext({ client, workspaceId, workItemId });
  if (!current.ok) return current;
  // A lost successful first-result response must reach the actor-bound RPC receipt.
  // The RPC rejects changed commands; this exception never grants amendment authority.
  const mayReplayInitialResult = command.expectedResultVersion === 0 && current.context.results.length > 0;
  if (!current.context.canRecord && !mayReplayInitialResult) return { ok: false, status: 403, error: "permission_missing" };
  if (!parseExecutionPayload(current.context.clinicalOrderType, command.payload, current.context.planSnapshot)) return { ok: false, status: 400, error: "invalid_execution_payload" };
  // CAS and idempotency are intentionally enforced in the write transaction,
  // not inferred from this advisory read (which can already be stale).
  try {
    const { data, error } = await client.rpc("clair_record_order_execution_result", {
      p_workspace_id: workspaceId, p_actor_user_id: actorUserId, p_work_item_id: workItemId,
      p_expected_revision: command.expectedRevision, p_expected_plan_sha256: command.expectedPlanSha256,
      p_expected_result_version: command.expectedResultVersion, p_command_id: command.commandId,
      p_performed_at: command.performedAt, p_payload: command.payload,
      p_variance_reason: command.varianceReason ?? null, p_amendment_reason: command.amendmentReason ?? null,
    });
    if (error) return failure(error.message);
    const context = parseExecutionContext(data, workspaceId, workItemId);
    return context ? { ok: true, status: 200, context } : { ok: false, status: 502, error: "invalid_execution_response" };
  } catch { return failure(); }
}
