import { readServerSession } from "@/features/auth/server-session-reader";
import {
  demoSessionUserIdHeader,
  resolveRoleUpdateActorIdentity,
} from "@/features/auth/server-role-update-identity";
import {
  createSupabaseChartOrderActionGateway,
  readChartOrderActions,
  saveChartOrderAction,
  type ChartOrderActionInput,
  type SupabaseChartOrderActionRpcClient,
} from "@/features/chart/server-order-action-persistence";
import {
  createSupabaseLiveAuditAppendGateway,
  type SupabaseLiveAuditAppendRpcClient,
} from "@/features/audit/server-audit-log-persistence";
import {
  createSupabaseFulfillmentWorkItemGateway,
  type SupabaseFulfillmentWorkItemRpcClient,
} from "@/features/fulfillment/server-fulfillment-work-item";
import { getAuditRequestId } from "@/features/audit/server-mutation-audit";
import { enforceWorkspaceMutationRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    workspaceId: string;
  }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const { workspaceId } = await params;
  const serverSession = await readServerSession();
  const identity = resolveRoleUpdateActorIdentity({
    serverSession,
    demoHeaderUserId: request.headers.get(demoSessionUserIdHeader),
  });

  if (!identity.ok) {
    return Response.json(
      {
        ok: false,
        denialReason: identity.denialReason,
        sessionStatus: identity.sessionStatus,
        sessionReason: identity.sessionReason,
      },
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const encounterId = url.searchParams.get("encounterId");
  const client = identity.source === "supabase_session" ? await createClient() : null;
  const result = await readChartOrderActions({
    actorUserId: identity.actorUserId,
    workspaceId,
    encounterId,
    gateway: client
      ? createSupabaseChartOrderActionGateway(
          client as unknown as SupabaseChartOrderActionRpcClient
        )
      : undefined,
  });

  return Response.json(result, { status: result.status });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { workspaceId } = await params;
  const serverSession = await readServerSession();
  const identity = resolveRoleUpdateActorIdentity({
    serverSession,
    demoHeaderUserId: request.headers.get(demoSessionUserIdHeader),
  });

  if (!identity.ok) {
    return Response.json(
      {
        ok: false,
        denialReason: identity.denialReason,
        sessionStatus: identity.sessionStatus,
        sessionReason: identity.sessionReason,
      },
      { status: 401 }
    );
  }

  const rateLimitResponse = enforceWorkspaceMutationRateLimit({
    request,
    actorUserId: identity.actorUserId,
    workspaceId,
    operation: "chart_order_action_save",
  });
  if (rateLimitResponse) return rateLimitResponse;

  const input = await readJsonBody(request);
  const client = identity.source === "supabase_session" ? await createClient() : null;
  const result = await saveChartOrderAction({
    actorUserId: identity.actorUserId,
    workspaceId,
    input,
    gateway: client
      ? createSupabaseChartOrderActionGateway(
          client as unknown as SupabaseChartOrderActionRpcClient
        )
      : undefined,
    auditGateway: client
      ? createSupabaseLiveAuditAppendGateway(
          client as unknown as SupabaseLiveAuditAppendRpcClient
        )
      : undefined,
    fulfillmentGateway: client
      ? createSupabaseFulfillmentWorkItemGateway(
          client as unknown as SupabaseFulfillmentWorkItemRpcClient
        )
      : undefined,
    auditRequestId: getAuditRequestId(request),
  });

  return Response.json(result, { status: result.status });
}

async function readJsonBody(request: Request): Promise<ChartOrderActionInput> {
  try {
    const value = (await request.json()) as unknown;
    return value && typeof value === "object" ? value as ChartOrderActionInput : {};
  } catch {
    return {};
  }
}
