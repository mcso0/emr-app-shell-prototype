import type { InstructionRpcClient } from "./server-instruction";
import { instructionReviewTargetId, instructionAcknowledgementSchema, instructionReviewListSchema, instructionReviewTasksSchema, taskInstructionReviewSchema } from "./task-instruction-review-contract";

export async function executeTaskInstructionReview({ client, workspaceId, taskIds, orderIds, acknowledgement }: {
  client: InstructionRpcClient; workspaceId: string; taskIds?: unknown; orderIds?: unknown; acknowledgement?: unknown;
}) {
  const ack = acknowledgement === undefined ? null : instructionAcknowledgementSchema.safeParse(acknowledgement);
  const orderTarget = ack?.success ? "orderId" in ack.data : orderIds !== undefined;
  const targets = instructionReviewTasksSchema.safeParse(ack?.success ? ["orderId" in ack.data ? ack.data.orderId : ack.data.taskId] : orderTarget ? orderIds : taskIds);
  if (taskIds !== undefined && orderIds !== undefined) return { ok: false as const, status: 400, error: "invalid_input" };
  if (!workspaceId.trim() || (ack && !ack.success) || !targets.success) return { ok: false as const, status: 400, error: "invalid_input" };
  try {
    const result = await client.rpc(ack?.success ? orderTarget ? "clair_acknowledge_order_instructions" : "clair_acknowledge_task_instructions" : orderTarget ? "clair_get_order_instruction_reviews" : "clair_get_instruction_reviews", {
      p_workspace_id: workspaceId,
      ...(ack?.success ? { [orderTarget ? "p_order_id" : "p_task_id"]: targets.data[0], p_version_key: ack.data.versionKey } : { [orderTarget ? "p_order_ids" : "p_task_ids"]: targets.data }),
    });
    if (result.error) {
      const error = ["permission_missing", "task_unavailable", "instruction_version_conflict", "invalid_input"].find(code => result.error?.message?.includes(code)) ?? "instruction_unavailable";
      return { ok: false as const, status: error === "permission_missing" ? 403 : error === "task_unavailable" ? 404 : error === "instruction_version_conflict" ? 409 : error === "invalid_input" ? 400 : 500, error };
    }
    const parsed = ack?.success ? taskInstructionReviewSchema.safeParse(result.data) : instructionReviewListSchema.safeParse(result.data);
    if (!parsed.success) return { ok: false as const, status: 502, error: "instruction_unavailable" };
    const reviews = Array.isArray(parsed.data) ? parsed.data : [parsed.data];
    if (reviews.length !== new Set(targets.data).size || new Set(reviews.map(instructionReviewTargetId)).size !== new Set(targets.data).size || reviews.some(item => !targets.data.includes(instructionReviewTargetId(item)) || (orderTarget ? !item.orderId : !item.taskId)))
      return { ok: false as const, status: 502, error: "instruction_unavailable" };
    return { ok: true as const, status: 200, reviews };
  } catch { return { ok: false as const, status: 500, error: "instruction_unavailable" }; }
}
