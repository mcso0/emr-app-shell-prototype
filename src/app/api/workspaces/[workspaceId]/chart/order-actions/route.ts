import { readServerSession } from "@/features/auth/server-session-reader";
import { loadWorkspacePermissionAdapterFromDb } from "@/features/auth/db-workspace-permission-adapter";
import {
  demoSessionUserIdHeader,
  resolveRoleUpdateActorIdentity,
} from "@/features/auth/server-role-update-identity";
import { demoClientSessionIdHeader } from "@/features/auth/demo-actor";
import {
  createSupabaseWorkspacePermissionGateway,
  type SupabaseWorkspacePermissionClient,
} from "@/features/auth/supabase-workspace-permission-gateway";
import {
  createSupabaseChartOrderActionGateway,
  readChartOrderActions,
  saveChartOrderAction,
  type ChartOrderActionInput,
  type SupabaseChartOrderActionRpcClient,
} from "@/features/chart/server-order-action-persistence";
import {
  resolveServerChartEncounterId,
  type SupabaseEncounterIdBridgeClient,
} from "@/features/chart/server-encounter-id-bridge";
import {
  createSupabaseLiveAuditAppendGateway,
  type SupabaseLiveAuditAppendRpcClient,
} from "@/features/audit/server-audit-log-persistence";
import {
  createSupabaseInvoiceCandidateSyncGateway,
  type SupabaseInvoiceCandidateSyncRpcClient,
} from "@/features/billing/server-invoice-candidate-sync";
import {
  createSupabaseFulfillmentWorkItemGateway,
  type SupabaseFulfillmentWorkItemRpcClient,
} from "@/features/fulfillment/server-fulfillment-work-item";
import {
  createSupabaseOrderCatalogGateway,
  getDemoOrderCatalogGateway,
  type SupabaseOrderCatalogRpcClient,
} from "@/features/hospital-admin/server-order-catalog";
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
  const resolvedEncounter = await resolveServerChartEncounterId({
    client: client as unknown as SupabaseEncounterIdBridgeClient | null,
    encounterId,
    workspaceId,
  });
  if (!resolvedEncounter.ok) {
    return Response.json(resolvedEncounter, { status: resolvedEncounter.status });
  }
  const permissionAdapter = client
    ? await loadWorkspacePermissionAdapterFromDb({
        gateway: createSupabaseWorkspacePermissionGateway(
          client as unknown as SupabaseWorkspacePermissionClient
        ),
        workspaceId,
        sessionUserId: identity.actorUserId,
      })
    : undefined;
  const result = await readChartOrderActions({
    actorUserId: identity.actorUserId,
    workspaceId,
    encounterId: resolvedEncounter.encounterId,
    permissionAdapter,
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
  const resolvedEncounter = await resolveServerChartEncounterId({
    client: client as unknown as SupabaseEncounterIdBridgeClient | null,
    encounterId: input.encounterId,
    workspaceId,
  });
  if (!resolvedEncounter.ok) {
    return Response.json(resolvedEncounter, { status: resolvedEncounter.status });
  }
  const permissionAdapter = client
    ? await loadWorkspacePermissionAdapterFromDb({
        gateway: createSupabaseWorkspacePermissionGateway(
          client as unknown as SupabaseWorkspacePermissionClient
        ),
        workspaceId,
        sessionUserId: identity.actorUserId,
      })
    : undefined;
  const result = await saveChartOrderAction({
    actorUserId: identity.actorUserId,
    workspaceId,
    input: { ...input, encounterId: resolvedEncounter.encounterId },
    permissionAdapter,
    gateway: client
      ? createSupabaseChartOrderActionGateway(
          client as unknown as SupabaseChartOrderActionRpcClient
        )
      : undefined,
    catalogGateway: client
      ? createSupabaseOrderCatalogGateway(
          client as unknown as SupabaseOrderCatalogRpcClient
        )
      : getDemoOrderCatalogGateway(getDemoClientSessionId(request)),
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
    invoiceCandidateGateway: client
      ? createSupabaseInvoiceCandidateSyncGateway(
          client as unknown as SupabaseInvoiceCandidateSyncRpcClient
        )
      : undefined,
    auditRequestId: getAuditRequestId(request),
  });

  return Response.json(result, { status: result.status });
}

function getDemoClientSessionId(request: Request) {
  return request.headers.get(demoClientSessionIdHeader) ?? "shared";
}

async function readJsonBody(request: Request): Promise<ChartOrderActionInput> {
  try {
    const value = (await request.json()) as unknown;
    return value && typeof value === "object" ? value as ChartOrderActionInput : {};
  } catch {
    return {};
  }
}
