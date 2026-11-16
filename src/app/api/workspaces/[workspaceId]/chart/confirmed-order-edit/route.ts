import { readServerSession } from "@/features/auth/server-session-reader";
import { resolveRoleUpdateActorIdentity } from "@/features/auth/server-role-update-identity";
import { executeConfirmedOrderEdit, executeConfirmedOrderEditSession } from "@/features/chart/server-confirmed-order-edit";
import type { InstructionRpcClient } from "@/features/fulfillment/server-instruction";
import { createClient } from "@/lib/supabase/server";
import { enforceWorkspaceMutationRateLimit } from "@/lib/security/rate-limit";
type Context = { params: Promise<{ workspaceId: string }> };
async function handle(request: Request, context: Context, mode: "read" | "save" | "session") {
  const headers = { "Cache-Control": "no-store" };
  const identity = resolveRoleUpdateActorIdentity({ serverSession: await readServerSession(), demoHeaderUserId: null });
  if (!identity.ok) return Response.json({ ok: false, error: "unauthenticated" }, { status: 401, headers });
  if (identity.source !== "supabase_session") return Response.json({ ok: false, error: "unavailable" }, { status: 503, headers });
  const { workspaceId } = await context.params;
  if (mode !== "read") {
    const denied = enforceWorkspaceMutationRateLimit({ request, actorUserId: identity.actorUserId, workspaceId, operation: "confirmed_order_edit" });
    if (denied) return denied;
  }
  const query = new URL(request.url).searchParams;
  const client = await createClient() as unknown as InstructionRpcClient;
  const input = mode === "read" ? undefined : await request.json().catch(() => null);
  const result = mode === "session"
    ? await executeConfirmedOrderEditSession(client, workspaceId, input)
    : await executeConfirmedOrderEdit({ client, workspaceId,
      ...(mode === "save" ? { input } : { orderId: query.get("orderId"), chartId: query.get("chartId") }),
    });
  return Response.json(result, { status: result.status, headers });
}
export const GET = (request: Request, context: Context) => handle(request, context, "read");
export const POST = (request: Request, context: Context) => handle(request, context, "save");
export const PATCH = (request: Request, context: Context) => handle(request, context, "session");
