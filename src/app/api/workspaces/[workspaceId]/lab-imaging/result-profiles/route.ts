import { readServerSession } from "@/features/auth/server-session-reader";
import { readLabProfileConfiguration, mutateLabProfileConfiguration, type LabProfileRpcClient } from "@/features/lab-imaging/server-result-profile-core";
import { enforceWorkspaceMutationRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";
type Context = { params: Promise<{ workspaceId: string }> };
const respond = (result: { status: number }) => Response.json(result, { status: result.status, headers: { "Cache-Control": "no-store" } });
export async function GET(request: Request, { params }: Context) {
  const session = await readServerSession();
  if (!session.ok) return respond({ ok: false, status: 401, error: "unauthenticated" } as { status: number });
  const { workspaceId } = await params; const client = await createClient();
  if (!client) return respond({ ok: false, status: 503, error: "lab_profile_unavailable" } as { status: number });
  const url = new URL(request.url);
  return respond(await readLabProfileConfiguration(client as unknown as LabProfileRpcClient, workspaceId, url.searchParams.get("orderId") ?? undefined, url.searchParams.get("catalogItemId") ?? undefined));
}
export async function POST(request: Request, { params }: Context) {
  const session = await readServerSession();
  if (!session.ok) return respond({ ok: false, status: 401, error: "unauthenticated" } as { status: number });
  const { workspaceId } = await params;
  const limited = enforceWorkspaceMutationRateLimit({ request, actorUserId: session.sessionUserId, workspaceId, operation: "lab_result_profile_configuration" });
  if (limited) return limited;
  let input: unknown;
  try { const raw = await request.text(); if (raw.length > 10000) throw Error(); input = JSON.parse(raw); }
  catch { return respond({ ok: false, status: 400, error: "invalid_lab_profile_request" } as { status: number }); }
  const client = await createClient();
  if (!client) return respond({ ok: false, status: 503, error: "lab_profile_unavailable" } as { status: number });
  return respond(await mutateLabProfileConfiguration(client as unknown as LabProfileRpcClient, workspaceId, input));
}
