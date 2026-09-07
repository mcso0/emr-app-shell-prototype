import { readServerSession } from "@/features/auth/server-session-reader";
import { createAtomicLabRetest } from "@/features/lab-imaging/server-atomic-retest-core";
import type { LabProfileRpcClient } from "@/features/lab-imaging/server-result-profile-core";
import { enforceWorkspaceMutationRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";
type Context = { params: Promise<{ workspaceId: string }> };
export async function POST(request: Request, { params }: Context) {
  const session = await readServerSession();
  const respond = (result: { status: number }) => Response.json(result, { status: result.status, headers: { "Cache-Control": "no-store" } });
  if (!session.ok) return respond({ ok: false, status: 401, error: "unauthenticated" } as { status: number });
  const { workspaceId } = await params;
  const limited = enforceWorkspaceMutationRateLimit({ request, actorUserId: session.sessionUserId, workspaceId, operation: "lab_atomic_retest" });
  if (limited) return limited;
  let input: unknown;
  try { const raw = await request.text(); if (raw.length > 10000) throw Error(); input = JSON.parse(raw); }
  catch { return respond({ ok: false, status: 400, error: "invalid_lab_retest_request" } as { status: number }); }
  const client = await createClient();
  if (!client) return respond({ ok: false, status: 503, error: "lab_retest_unavailable" } as { status: number });
  return respond(await createAtomicLabRetest(client as unknown as LabProfileRpcClient, workspaceId, input));
}
