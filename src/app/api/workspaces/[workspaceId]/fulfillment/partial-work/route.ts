import { z } from "zod";
import { readServerSession } from "@/features/auth/server-session-reader";
import { resolveRoleUpdateActorIdentity } from "@/features/auth/server-role-update-identity";
import { partialWorkCommandSchema, partialWorkSchema } from "@/features/fulfillment/partial-order-work-contract";
import { createClient } from "@/lib/supabase/server";
import { enforceWorkspaceMutationRateLimit } from "@/lib/security/rate-limit";
type Context = { params: Promise<{ workspaceId: string }> };
async function handle(request: Request, context: Context, mutate: boolean) {
  const headers = { "Cache-Control": "no-store" };
  const identity = resolveRoleUpdateActorIdentity({ serverSession: await readServerSession(), demoHeaderUserId: null });
  if (!identity.ok) return Response.json({ ok: false, error: "unauthenticated" }, { status: 401, headers });
  if (identity.source !== "supabase_session") return Response.json({ ok: false, error: "unavailable" }, { status: 503, headers });
  const task = z.uuid().safeParse(new URL(request.url).searchParams.get("taskId"));
  const command = mutate ? partialWorkCommandSchema.safeParse(await request.json().catch(() => null)) : null;
  if (!task.success || (command && !command.success)) return Response.json({ ok: false, error: "invalid_input" }, { status: 400, headers });
  const client = await createClient();
 if (!client) return Response.json({ ok: false, error: "unavailable" }, { status: 503, headers }); const { workspaceId } = await context.params;
  if (mutate) { const denied = enforceWorkspaceMutationRateLimit({ request, workspaceId, actorUserId: identity.actorUserId, operation: "partial_order_work" }); if (denied) return denied; }
  const { data, error } = await client.rpc(mutate ? "clair_record_partial_order_work" : "clair_get_partial_order_work", {
    p_workspace_id: workspaceId, p_task_id: task.data, ...(command?.success ? { p_command: command.data } : {}),
  });
  const parsed = partialWorkSchema.safeParse(data);
  if (error || !parsed.success || parsed.data.taskId !== task.data) return Response.json({ ok: false, error: ["permission_missing", "current_assignee_required", "revision_conflict", "invalid_transition"].find(code => error?.message.includes(code)) ?? "unavailable" }, { status: error?.code === "42501" ? 403 : 409, headers });
  return Response.json({ ok: true, document: parsed.data }, { headers });
}
export const GET = (request: Request, context: Context) => handle(request, context, false);
export const POST = (request: Request, context: Context) => handle(request, context, true);
