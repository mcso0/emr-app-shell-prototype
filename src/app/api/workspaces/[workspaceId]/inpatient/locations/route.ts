import { readServerSession } from "@/features/auth/server-session-reader";
import { readInpatientLocations, saveInpatientLocation, type InpatientLocationRpcClient } from "@/features/inpatient/server-inpatient-location-core";
import { enforceWorkspaceMutationRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";
type Context = { params: Promise<{ workspaceId: string }> };
const respond = (result: { status: number; [key: string]: unknown }) => Response.json(result, { status: result.status, headers: { "Cache-Control": "no-store" } });
export async function GET(_request: Request, { params }: Context) {
  const session = await readServerSession();
  if (!session.ok) return respond({ ok: false, status: 401, error: "unauthenticated" });
  const { workspaceId } = await params;
  const client = await createClient();
  if (!client) return respond({ ok: false, status: 503, error: "inpatient_location_unavailable" });
  return respond(await readInpatientLocations(client as unknown as InpatientLocationRpcClient, workspaceId));
}
export async function POST(request: Request, { params }: Context) {
  const session = await readServerSession();
  if (!session.ok) return respond({ ok: false, status: 401, error: "unauthenticated" });
  const { workspaceId } = await params;
  const limited = enforceWorkspaceMutationRateLimit({ request, actorUserId: session.sessionUserId, workspaceId, operation: "inpatient_location_configuration" });
  if (limited) return limited;
  let input: unknown;
  try { const raw = await request.text(); if (raw.length > 4000) throw Error(); input = JSON.parse(raw); }
  catch { return respond({ ok: false, status: 400, error: "inpatient_location_invalid" }); }
  const client = await createClient();
  if (!client) return respond({ ok: false, status: 503, error: "inpatient_location_unavailable" });
  return respond(await saveInpatientLocation(client as unknown as InpatientLocationRpcClient, workspaceId, input));
}
