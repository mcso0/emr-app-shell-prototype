import { readServerSession } from "@/features/auth/server-session-reader";
import {
  demoSessionUserIdHeader,
  resolveRoleUpdateActorIdentity,
} from "@/features/auth/server-role-update-identity";
import { oralInstructionCommandSchema, oralInstructionSchema, oralInstructionTargetSchema } from "@/features/chart/chart-oral-instruction-contract";
import type { InstructionRpcClient } from "@/features/fulfillment/server-instruction";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ workspaceId: string; chartId: string }> };

async function handle(request: Request, context: Context, mutate: boolean) {
  const identity = resolveRoleUpdateActorIdentity({
    demoHeaderUserId: request.headers.get(demoSessionUserIdHeader),
    serverSession: await readServerSession(),
  });
  if (!identity.ok)
    return Response.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 },
    );
  // A live read/write never falls back to demo state.
  if (identity.source !== "supabase_session")
    return Response.json(
      { ok: false, error: "instruction_unavailable" },
      { status: 503 },
    );
  const command = mutate
    ? oralInstructionCommandSchema.safeParse(await request.json().catch(() => null))
    : null;
  if (command && !command.success)
    return Response.json(
      { ok: false, error: "invalid_input" },
      { status: 400 },
    );
  const target = oralInstructionTargetSchema.safeParse(await context.params);
  if (!target.success) return Response.json({ ok: false, error: "invalid_input" }, { status: 400 });
  const { workspaceId, chartId } = target.data;
  const client = (await createClient()) as unknown as InstructionRpcClient;
  const response = await client.rpc(mutate ? "clair_save_chart_oral_instruction" : "clair_get_chart_oral_instruction", {
    p_workspace_id: workspaceId, p_chart_id: chartId,
    ...(command?.success ? { p_expected_revision: command.data.expectedRevision, p_instruction: command.data.instruction } : {}),
  });
  const parsed = oralInstructionSchema.safeParse(response.data);
  const known = ["permission_missing", "chart_unavailable", "revision_conflict", "signed_chart_read_only", "invalid_input"].find(code => response.error?.message?.includes(code));
  const status = known === "permission_missing" ? 403 : known === "chart_unavailable" ? 404 : known === "invalid_input" ? 400 : known ? 409 : 500;
  const result = !response.error && parsed.success
    ? { ok: true, status: 200, document: parsed.data }
    : { ok: false, status, error: known ?? "instruction_unavailable" };
  return Response.json(result, {
    status: result.status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function GET(request: Request, context: Context) {
  return handle(request, context, false);
}
export function PATCH(request: Request, context: Context) {
  return handle(request, context, true);
}
