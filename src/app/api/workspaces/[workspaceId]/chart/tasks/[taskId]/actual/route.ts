import { readServerSession } from "@/features/auth/server-session-reader";
import { amendChartActual, recordChartActual, readChartActual, type ChartActualRpcClient } from "@/features/chart/server-chart-actual-core";
import { enforceWorkspaceMutationRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ workspaceId: string; taskId: string }> };
const response = (value: { status: number }) => Response.json(value, { status: value.status, headers: { "Cache-Control": "no-store" } });
const error = (status: number, message: string) => response({ ok: false, status, error: message } as { status: number });
export async function GET(_request: Request, { params }: Context) {
  const session = await readServerSession();
  if (!session.ok) return error(401, "unauthenticated");
  const { workspaceId, taskId } = await params;
  const client = await createClient();
  if (!client) return error(503, "chart_actual_unavailable");
  return response(await readChartActual({ client: client as unknown as ChartActualRpcClient, workspaceId, taskId }));
}
export async function POST(request: Request, { params }: Context) {
  const session = await readServerSession();
  if (!session.ok) return error(401, "unauthenticated");
  const { workspaceId, taskId } = await params;
  const limited = enforceWorkspaceMutationRateLimit({ request, actorUserId: session.sessionUserId, workspaceId, operation: "amend_chart_actual" });
  if (limited) return limited;
  let input: unknown;
  try { const raw = await request.text(); if (raw.length > 20000) return error(413, "invalid_chart_actual"); input = JSON.parse(raw); }
  catch { return error(400, "invalid_chart_actual"); }
  const client = await createClient();
  if (!client) return error(503, "chart_actual_unavailable");
  const mutate = input && typeof input === "object" && "action" in input && input.action === "record" ? recordChartActual : amendChartActual;
  return response(await mutate({ client: client as unknown as ChartActualRpcClient, actorUserId: session.sessionUserId, workspaceId, taskId, input }));
}
