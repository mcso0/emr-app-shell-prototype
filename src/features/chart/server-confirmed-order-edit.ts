import type { InstructionRpcClient } from "@/features/fulfillment/server-instruction";
import { confirmedOrderContextSchema, confirmedOrderEditSchema, confirmedOrderErrors } from "./confirmed-order-edit-contract";
import { z } from "zod";
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
    if (error) {
      const code = Object.keys(confirmedOrderErrors).find(code => error.message?.includes(code)) ?? "unavailable";
      return { ok: false as const, status: code === "permission_missing" ? 403 : code === "invalid_input" ? 400 : code === "unavailable" ? 500 : 409, error: code };
    }
    const parsed = confirmedOrderContextSchema.safeParse(data);
    if (!parsed.success || parsed.data.orderId !== target.data.orderId || parsed.data.chartId !== target.data.chartId) return { ok: false as const, status: 502, error: "unavailable" };
    return { ok: true as const, status: 200, context: parsed.data };
  } catch { return { ok: false as const, status: 500, error: "unavailable" }; }
}
