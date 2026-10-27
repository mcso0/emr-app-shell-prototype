import {
  instructionCommandSchema,
  instructionDocumentSchema,
  type InstructionCommand,
} from "./instruction-contract";

export type InstructionRpcClient = {
  rpc(
    name: string,
    args: Record<string, unknown>,
  ): Promise<{
    data: unknown;
    error: { message?: string } | null;
  }>;
};

const errors: Record<string, number> = {
  permission_missing: 403,
  actor_mismatch: 403,
  workspace_membership_missing: 403,
  work_item_unavailable: 404,
  revision_conflict: 409,
  idempotency_conflict: 409,
  invalid_transition: 409,
  billing_locked: 409,
  actual_execution_result_required: 409,
};

/** The session-bound RPC owns workspace, current attempt and executor checks. */
export async function executeInstructionRequest({
  client,
  workspaceId,
  workItemId,
  command,
}: {
  client: InstructionRpcClient;
  workspaceId: string;
  workItemId: string;
  command?: InstructionCommand;
}) {
  if (
    !workspaceId.trim() ||
    !workItemId.trim() ||
    (command && !instructionCommandSchema.safeParse(command).success)
  ) {
    return { ok: false as const, status: 400, error: "invalid_input" };
  }
  const result = await client.rpc(
    command
      ? "clair_mutate_fulfillment_instruction"
      : "clair_get_fulfillment_instruction",
    {
      p_workspace_id: workspaceId,
      p_work_item_id: workItemId,
      ...(command ? { p_command: command } : {}),
    },
  );
  if (result.error) {
    const error = Object.keys(errors).find((key) =>
      result.error?.message?.includes(key),
    );
    return {
      ok: false as const,
      status: error ? errors[error] : 500,
      error: error ?? "instruction_unavailable",
    };
  }
  const parsed = instructionDocumentSchema.safeParse(result.data);
  if (!parsed.success)
    return {
      ok: false as const,
      status: 500,
      error: "instruction_unavailable",
    };
  return { ok: true as const, status: 200, document: parsed.data };
}
