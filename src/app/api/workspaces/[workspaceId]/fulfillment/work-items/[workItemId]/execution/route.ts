import { readServerSession } from "@/features/auth/server-session-reader";
import { readExecutionContext, recordExecutionResult, type ExecutionRpcClient } from "@/features/fulfillment/server-execution-result-core";
import { enforceWorkspaceMutationRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ workspaceId: string; workItemId: string }> };
const response = (value: { status: number }) => Response.json(value, { status: value.status, headers: { "Cache-Control": "no-store" } });

export async function GET(request: Request, { params }: Context) {
  const session = await readServerSession();
  // No demo-header identity or fixture fallback: actual records require the
  // authenticated server session and RPC workspace/queue permission checks.
  if (!session.ok) return response({ ok: false, status: 401, error: "unauthenticated" } as { status: number });
  const { workspaceId, workItemId } = await params;
  const client = await createClient();
  if (!client) return response({ ok: false, status: 503, error: "execution_unavailable" } as { status: number });
  return response(await readExecutionContext({ client: client as unknown as ExecutionRpcClient, workspaceId, workItemId,
    taskId: new URL(request.url).searchParams.get("taskId") ?? undefined }));
}

export async function POST(request: Request, { params }: Context) {
  const session = await readServerSession();
  if (!session.ok) return response({ ok: false, status: 401, error: "unauthenticated" } as { status: number });
  const { workspaceId, workItemId } = await params;
  const limited = enforceWorkspaceMutationRateLimit({ request, actorUserId: session.sessionUserId, workspaceId, operation: "record_order_execution_result" });
  if (limited) return limited;
  let input: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 40000) return response({ ok: false, status: 413, error: "invalid_execution_command" } as { status: number });
    input = JSON.parse(raw);
  } catch { return response({ ok: false, status: 400, error: "invalid_execution_command" } as { status: number }); }
  const client = await createClient();
  if (!client) return response({ ok: false, status: 503, error: "execution_unavailable" } as { status: number });
  return response(await recordExecutionResult({ client: client as unknown as ExecutionRpcClient,
    actorUserId: session.sessionUserId, workspaceId, workItemId, input }));
}
