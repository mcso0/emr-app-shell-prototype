import { readServerSession } from "@/features/auth/server-session-reader";
import { loadWorkspacePermissionAdapterFromDb } from "@/features/auth/db-workspace-permission-adapter";
import {
  demoSessionUserIdHeader,
  resolveRoleUpdateActorIdentity,
} from "@/features/auth/server-role-update-identity";
import {
  createSupabaseWorkspacePermissionGateway,
  type SupabaseWorkspacePermissionClient,
} from "@/features/auth/supabase-workspace-permission-gateway";
import {
  createSupabaseChartOrderPrebillingOverrideGateway,
  saveChartOrderPrebillingOverride,
  type ChartOrderPrebillingOverridePatch,
  type SupabaseChartOrderPrebillingOverrideRpcClient,
} from "@/features/chart/server-order-prebilling-override";
import {
  resolveServerChartEncounterId,
  type SupabaseEncounterIdBridgeClient,
} from "@/features/chart/server-encounter-id-bridge";
import { enforceWorkspaceMutationRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ workspaceId: string }> };

type RequestBody = {
  encounterId?: string;
  expectedVersion?: number;
  idempotencyKey?: string;
  orderId?: string;
  override?: ChartOrderPrebillingOverridePatch;
};

export async function POST(request: Request, { params }: RouteContext) {
  const { workspaceId } = await params;
  const body = await readBody(request);
  const identity = resolveRoleUpdateActorIdentity({
    serverSession: await readServerSession(),
    demoHeaderUserId: request.headers.get(demoSessionUserIdHeader),
  });
  if (!identity.ok) {
    return Response.json(
      { ok: false, denialReason: identity.denialReason },
      { status: 401 },
    );
  }

  const rateLimitResponse = enforceWorkspaceMutationRateLimit({
    actorUserId: identity.actorUserId,
    operation: "chart_order_prebilling_override",
    request,
    workspaceId,
  });
  if (rateLimitResponse) return rateLimitResponse;

  const client = identity.source === "supabase_session" ? await createClient() : null;
  const encounter = await resolveServerChartEncounterId({
    client: client as unknown as SupabaseEncounterIdBridgeClient | null,
    encounterId: body.encounterId,
    workspaceId,
  });
  if (!encounter.ok) {
    return Response.json(encounter, { status: encounter.status });
  }
  const permissionAdapter = client
    ? await loadWorkspacePermissionAdapterFromDb({
        gateway: createSupabaseWorkspacePermissionGateway(
          client as unknown as SupabaseWorkspacePermissionClient,
        ),
        sessionUserId: identity.actorUserId,
        workspaceId,
      })
    : undefined;

  const result = await saveChartOrderPrebillingOverride({
    actorUserId: identity.actorUserId,
    encounterId: encounter.encounterId,
    expectedVersion: body.expectedVersion,
    gateway: client
      ? createSupabaseChartOrderPrebillingOverrideGateway(
          client as unknown as SupabaseChartOrderPrebillingOverrideRpcClient,
        )
      : undefined,
    idempotencyKey: body.idempotencyKey,
    orderId: body.orderId,
    override: body.override,
    permissionAdapter,
    workspaceId,
  });
  return Response.json(result, { status: result.status });
}

async function readBody(request: Request): Promise<RequestBody> {
  try {
    const value = await request.json() as unknown;
    return value && typeof value === "object" ? value as RequestBody : {};
  } catch {
    return {};
  }
}
