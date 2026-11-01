import { readServerSession } from "@/features/auth/server-session-reader";
import { demoSessionUserIdHeader, resolveRoleUpdateActorIdentity } from "@/features/auth/server-role-update-identity";
import { overallInstructionsCommandSchema } from "@/features/chart/overall-instructions-contract";
import { executeOverallInstructionsRequest } from "@/features/chart/server-overall-instructions";
import type { InstructionRpcClient } from "@/features/fulfillment/server-instruction";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ workspaceId: string; chartId: string }> };
async function handle(request: Request, context: Context, mutate: boolean) {
  const headers = { "Cache-Control": "no-store" };
  const identity = resolveRoleUpdateActorIdentity({ demoHeaderUserId: request.headers.get(demoSessionUserIdHeader), serverSession: await readServerSession() });
  if (!identity.ok) return Response.json({ ok: false, error: "unauthenticated" }, { status: 401, headers });
  if (identity.source !== "supabase_session") return Response.json({ ok: false, error: "instruction_unavailable" }, { status: 503, headers });
  const parsed = mutate ? overallInstructionsCommandSchema.safeParse(await request.json().catch(() => null)) : null;
  if (parsed && !parsed.success) return Response.json({ ok: false, error: "invalid_input" }, { status: 400, headers });
  const result = await executeOverallInstructionsRequest({
    client: await createClient() as unknown as InstructionRpcClient, ...await context.params,
    ...(parsed?.success ? { command: parsed.data } : {}),
  });
  return Response.json(result, { status: result.status, headers });
}
export const GET = (request: Request, context: Context) => handle(request, context, false);
export const PATCH = (request: Request, context: Context) => handle(request, context, true);
