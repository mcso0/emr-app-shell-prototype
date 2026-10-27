import { readServerSession } from "@/features/auth/server-session-reader";
import {
  demoSessionUserIdHeader,
  resolveRoleUpdateActorIdentity,
} from "@/features/auth/server-role-update-identity";
import { instructionCommandSchema } from "@/features/fulfillment/instruction-contract";
import {
  executeInstructionRequest,
  type InstructionRpcClient,
} from "@/features/fulfillment/server-instruction";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ workspaceId: string; workItemId: string }> };

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
    ? instructionCommandSchema.safeParse(await request.json().catch(() => null))
    : null;
  if (command && !command.success)
    return Response.json(
      { ok: false, error: "invalid_input" },
      { status: 400 },
    );
  const result = await executeInstructionRequest({
    ...(await context.params),
    client: (await createClient()) as unknown as InstructionRpcClient,
    ...(command?.success ? { command: command.data } : {}),
  });
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
