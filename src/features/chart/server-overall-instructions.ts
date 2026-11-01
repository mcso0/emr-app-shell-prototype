import type { InstructionRpcClient } from "@/features/fulfillment/server-instruction";
import { overallInstructionsCommandSchema, overallInstructionsSchema, overallInstructionsTargetSchema, type OverallInstructionsCommand } from "./overall-instructions-contract";

const errorStatus: Record<string, number> = {
  permission_missing: 403, workspace_membership_missing: 403, chart_unavailable: 404,
  encounter_read_only: 409, stale_status: 409, encounter_unavailable: 404,
  signed_chart_read_only: 409, terminal_orders: 409, no_confirmed_orders: 409,
  revision_conflict: 409, idempotency_conflict: 409, invalid_input: 400,
};
export async function executeOverallInstructionsRequest({ client, workspaceId, chartId, command }: {
  client: InstructionRpcClient; workspaceId: string; chartId: string; command?: OverallInstructionsCommand;
}) {
  if (!overallInstructionsTargetSchema.safeParse({ workspaceId, chartId }).success ||
    (command && !overallInstructionsCommandSchema.safeParse(command).success)) return { ok: false as const, status: 400, error: "invalid_input" };
  try {
    const result = await client.rpc(command ? "clair_apply_overall_instructions" : "clair_get_overall_instructions", {
      p_workspace_id: workspaceId, p_chart_id: chartId, ...(command ? { p_command: command } : {}),
    });
    if (result.error) {
      const error = Object.keys(errorStatus).find(key => result.error?.message?.includes(key));
      return { ok: false as const, status: error ? errorStatus[error] : 500, error: error ?? "instruction_unavailable" };
    }
    const parsed = overallInstructionsSchema.safeParse(result.data);
    return parsed.success && parsed.data.chartId === chartId ? { ok: true as const, status: 200, document: parsed.data } : { ok: false as const, status: 500, error: "instruction_unavailable" };
  } catch {
    return { ok: false as const, status: 500, error: "instruction_unavailable" };
  }
}
