import { readServerSession } from "@/features/auth/server-session-reader";
import { demoClientSessionIdHeader } from "@/features/auth/demo-actor";
import {
  demoSessionUserIdHeader,
  resolveRoleUpdateActorIdentity,
} from "@/features/auth/server-role-update-identity";
import { loadWorkspacePermissionAdapterFromDb } from "@/features/auth/db-workspace-permission-adapter";
import {
  createSupabaseWorkspacePermissionGateway,
  type SupabaseWorkspacePermissionClient,
} from "@/features/auth/supabase-workspace-permission-gateway";
import {
  createSupabaseNotificationPersistenceGateway,
  type SupabaseNotificationPersistenceRpcClient,
} from "@/features/notifications/server-notification-persistence";
import {
  createSupabaseFulfillmentWorkItemGateway,
  updateFulfillmentWorkItem,
  type FulfillmentWorkItemUpdateInput,
  type SupabaseFulfillmentWorkItemRpcClient,
} from "@/features/fulfillment/server-fulfillment-work-item";
import {
  createSupabaseLiveAuditAppendGateway,
  type SupabaseLiveAuditAppendRpcClient,
} from "@/features/audit/server-audit-log-persistence";
import { getAuditRequestId } from "@/features/audit/server-mutation-audit";
import {
  createSupabaseInvoiceCandidateSyncGateway,
  type SupabaseInvoiceCandidateSyncRpcClient,
} from "@/features/billing/server-invoice-candidate-sync";
import {
  createSupabaseChartOrderLifecycleGateway,
  type SupabaseChartOrderLifecycleRpcClient,
} from "@/features/chart/server-order-lifecycle-persistence";
import { enforceWorkspaceMutationRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    workspaceId: string;
    workItemId: string;
  }>;
};

export async function PATCH(request: Request, { params }: RouteContext) {
  const { workspaceId, workItemId } = await params;
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
    operation: "fulfillment_work_item_update",
  });
  if (rateLimitResponse) return rateLimitResponse;

  const input = await readJsonBody(request);
  const client = identity.source === "supabase_session" ? await createClient() : null;
  const permissionAdapter = client
    ? await loadWorkspacePermissionAdapterFromDb({
        gateway: createSupabaseWorkspacePermissionGateway(
          client as unknown as SupabaseWorkspacePermissionClient
        ),
        workspaceId,
        sessionUserId: identity.actorUserId,
      })
    : undefined;
  const result = await updateFulfillmentWorkItem({
    actorUserId: identity.actorUserId,
    workspaceId,
    workItemId,
    input,
    emitBillingReadyNotifications: true,
    notificationEventScopeId:
      identity.source === "demo_header_mock_mode"
        ? request.headers.get(demoClientSessionIdHeader)
        : null,
    notificationPersistenceGateway: client
      ? createSupabaseNotificationPersistenceGateway(
          client as unknown as SupabaseNotificationPersistenceRpcClient,
        )
      : undefined,
    permissionAdapter,
    gateway: client
      ? createSupabaseFulfillmentWorkItemGateway(
          client as unknown as SupabaseFulfillmentWorkItemRpcClient
        )
      : undefined,
    lifecycleGateway: client
      ? createSupabaseChartOrderLifecycleGateway(
          client as unknown as SupabaseChartOrderLifecycleRpcClient
        )
      : undefined,
    // Fulfillment transitions select the queue-specific completion wrapper;
    // source snapshots remain server-built and immutable on retry.
    invoiceCandidateGateway: client
      ? createSupabaseInvoiceCandidateSyncGateway(
          client as unknown as SupabaseInvoiceCandidateSyncRpcClient
        )
      : undefined,
    auditGateway: client
      ? createSupabaseLiveAuditAppendGateway(
          client as unknown as SupabaseLiveAuditAppendRpcClient
        )
      : undefined,
    auditRequestId: getAuditRequestId(request),
  });

  return Response.json(result, { status: result.status });
}

async function readJsonBody(request: Request): Promise<FulfillmentWorkItemUpdateInput> {
  try {
    const value = (await request.json()) as unknown;
    return value && typeof value === "object" ? value as FulfillmentWorkItemUpdateInput : {};
  } catch {
    return {};
  }
}
