import type { InstructionRpcClient } from "@/features/fulfillment/server-instruction";
import { confirmedOrderContextSchema, confirmedOrderEditSchema, confirmedOrderEditSessionSchema, confirmedOrderErrors } from "./confirmed-order-edit-contract";
import { z } from "zod";
function editError(message?: string) {
  const error = Object.keys(confirmedOrderErrors).find(code => message?.includes(code)) ?? "unavailable";
  return {
    ok: false as const,
    status: error === "permission_missing" ? 403 : error === "invalid_input" ? 400 : error === "unavailable" ? 500 : 409,
    error,
  };
}

export async function executeConfirmedOrderEditSession(client: InstructionRpcClient, workspaceId: string, input: unknown) {
  const command = confirmedOrderEditSessionSchema.safeParse(input);
  if (!command.success) return editError("invalid_input");
  const { orderId, chartId, sessionId, action } = command.data;
  try {
    const { data, error } = await client.rpc("clair_manage_confirmed_order_edit_session", {
      p_workspace_id: workspaceId, p_chart_id: chartId, p_order_id: orderId,
      p_session_id: sessionId, p_action: action,
    });
    if (error) return editError(error.message);
    const parsed = z.object({ context: confirmedOrderContextSchema.optional(), editSessionId: z.uuid().nullable() }).safeParse(data);
    if (!parsed.success || (parsed.data.editSessionId !== null && parsed.data.editSessionId !== sessionId)) {
      return { ok: false as const, status: 502, error: "unavailable" };
    }
    const context = parsed.data.context;
    if (action === "begin" && (context?.orderId !== orderId || context?.chartId !== chartId)) {
      return { ok: false as const, status: 502, error: "unavailable" };
    }
    return { ok: true as const, status: 200, ...parsed.data };
  } catch {
    return editError();
  }
}

export async function executeConfirmedOrderEdit({ client, workspaceId, orderId, chartId, input }: {
  client: InstructionRpcClient; workspaceId: string; orderId?: unknown; chartId?: unknown; input?: unknown;
}) {
  const command = input === undefined ? null : confirmedOrderEditSchema.safeParse(input);
  const target = z.object({ orderId: z.uuid(), chartId: z.uuid() }).safeParse(command?.success ? command.data : { orderId, chartId });
  if (!target.success || (command && !command.success)) return { ok: false as const, status: 400, error: "invalid_input" };
  try {
    const { data, error } = await client.rpc(command ? "clair_edit_confirmed_order" : "clair_get_confirmed_order_edit", {
      p_workspace_id: workspaceId, p_chart_id: target.data.chartId, p_order_id: target.data.orderId,
      ...(command?.success ? { p_command: command.data } : {}),
    });
    if (error) return editError(error.message);
    const parsed = confirmedOrderContextSchema.safeParse(data);
    if (!parsed.success || parsed.data.orderId !== target.data.orderId || parsed.data.chartId !== target.data.chartId) return { ok: false as const, status: 502, error: "unavailable" };
    return { ok: true as const, status: 200, context: parsed.data };
  } catch { return { ok: false as const, status: 500, error: "unavailable" }; }
}
