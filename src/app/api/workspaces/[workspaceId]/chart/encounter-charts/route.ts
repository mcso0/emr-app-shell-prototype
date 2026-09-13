import { readServerSession } from "@/features/auth/server-session-reader";
import { loadWorkspacePermissionAdapterFromDb } from "@/features/auth/db-workspace-permission-adapter";
import { demoSessionUserIdHeader, resolveRoleUpdateActorIdentity } from "@/features/auth/server-role-update-identity";
import { createSupabaseWorkspacePermissionGateway, type SupabaseWorkspacePermissionClient } from "@/features/auth/supabase-workspace-permission-gateway";
import { createSupabaseLiveAuditAppendGateway, type SupabaseLiveAuditAppendRpcClient } from "@/features/audit/server-audit-log-persistence";
import { getAuditRequestId } from "@/features/audit/server-mutation-audit";
import { createSupabaseEncounterChartsGateway, manageEncounterCharts, type EncounterChartsInput, type EncounterChartsRpcClient } from "@/features/chart/server-encounter-charts";
import { enforceWorkspaceMutationRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ workspaceId: string }> };
export function GET(request: Request, context: Context) { return handle(request, context, "list"); }
export function POST(request: Request, context: Context) { return handle(request, context, "create"); }
export function PUT(request: Request, context: Context) { return handle(request, context, "ensure"); }
export function PATCH(request: Request, context: Context) { return handle(request, context, "sign"); }
async function handle(request: Request, { params }: Context, operation: "list" | "create" | "ensure" | "sign") {
  const { workspaceId } = await params;
  const identity = resolveRoleUpdateActorIdentity({ serverSession: await readServerSession(),
    demoHeaderUserId: request.headers.get(demoSessionUserIdHeader) });
  if (!identity.ok) return Response.json({ ok: false, denialReason: identity.denialReason }, { status: 401 });
  if (operation !== "list") {
    const limited = enforceWorkspaceMutationRateLimit({ request, actorUserId: identity.actorUserId, workspaceId, operation: `chart_${operation}` });
    if (limited) return limited;
  }
  let input: EncounterChartsInput;
  if (operation === "list") input = { encounterId: new URL(request.url).searchParams.get("encounterId") ?? undefined };
  else {
    try {
      const body: unknown = await request.json();
      if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({ ok: false, error: "invalid_input" }, { status: 400 });
      input = body as EncounterChartsInput;
    } catch { return Response.json({ ok: false, error: "invalid_input" }, { status: 400 }); }
  }
  const client = identity.source === "supabase_session" ? await createClient() : null;
  if (identity.source === "supabase_session" && !client) return Response.json({ ok: false, error: "supabase_client_missing" }, { status: 500 });
  const permissionAdapter = client ? await loadWorkspacePermissionAdapterFromDb({
    gateway: createSupabaseWorkspacePermissionGateway(client as unknown as SupabaseWorkspacePermissionClient),
    workspaceId, sessionUserId: identity.actorUserId,
  }) : undefined;
  const result = await manageEncounterCharts({ operation, workspaceId, actorUserId: identity.actorUserId, input, permissionAdapter,
    gateway: client ? createSupabaseEncounterChartsGateway(client as unknown as EncounterChartsRpcClient) : undefined,
    auditGateway: client ? createSupabaseLiveAuditAppendGateway(client as unknown as SupabaseLiveAuditAppendRpcClient) : undefined,
    auditRequestId: getAuditRequestId(request),
  });
  return Response.json(result, { status: result.status });
}
