import { readServerSession } from "@/features/auth/server-session-reader";
import { demoSessionUserIdHeader, resolveRoleUpdateActorIdentity } from "@/features/auth/server-role-update-identity";
import { executeTaskInstructionReview } from "@/features/fulfillment/server-task-instruction-review";
import type { InstructionRpcClient } from "@/features/fulfillment/server-instruction";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ workspaceId: string }> };
async function handle(request: Request, context: Context, acknowledge: boolean) {
  const headers = { "Cache-Control": "no-store" };
  const identity = resolveRoleUpdateActorIdentity({ demoHeaderUserId: request.headers.get(demoSessionUserIdHeader), serverSession: await readServerSession() });
  if (!identity.ok) return Response.json({ ok: false, error: "unauthenticated" }, { status: 401, headers });
  if (identity.source !== "supabase_session") return Response.json({ ok: false, error: "instruction_unavailable" }, { status: 503, headers });
  const query = new URL(request.url).searchParams;
  const result = await executeTaskInstructionReview({ client: await createClient() as unknown as InstructionRpcClient,
    ...await context.params, ...(acknowledge ? { acknowledgement: await request.json().catch(() => null) } : { taskIds: query.get("taskIds")?.split(","), orderIds: query.get("orderIds")?.split(",") }),
  });
  return Response.json(result, { status: result.status, headers });
}
export const GET = (request: Request, context: Context) => handle(request, context, false);
export const POST = (request: Request, context: Context) => handle(request, context, true);
