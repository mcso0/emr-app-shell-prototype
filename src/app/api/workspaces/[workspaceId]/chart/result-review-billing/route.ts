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
  createSupabaseInvoiceCandidateSyncGateway,
  type SupabaseInvoiceCandidateSyncRpcClient,
} from "@/features/billing/server-invoice-candidate-sync";
import {
  createSupabaseLiveAuditAppendGateway,
  type SupabaseLiveAuditAppendRpcClient,
} from "@/features/audit/server-audit-log-persistence";
import { getAuditRequestId } from "@/features/audit/server-mutation-audit";
import {
  createSupabaseFulfillmentWorkItemGateway,
  syncVetReviewedBillingCandidates,
  type FulfillmentVetReviewBillingInput,
  type SupabaseFulfillmentWorkItemRpcClient,
} from "@/features/fulfillment/server-fulfillment-work-item";
import { enforceWorkspaceMutationRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    workspaceId: string;
  }>;
};

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
      { status: 401 },
    );
  }

  const rateLimitResponse = enforceWorkspaceMutationRateLimit({
    request,
    actorUserId: identity.actorUserId,
    workspaceId,
    operation: "chart_result_review_billing",
  });
  if (rateLimitResponse) return rateLimitResponse;

  const input = await readJsonBody(request);
  const client = identity.source === "supabase_session" ? await createClient() : null;
  const permissionAdapter = client
    ? await loadWorkspacePermissionAdapterFromDb({
        gateway: createSupabaseWorkspacePermissionGateway(
          client as unknown as SupabaseWorkspacePermissionClient,
        ),
        workspaceId,
        sessionUserId: identity.actorUserId,
      })
    : undefined;

  const result = await syncVetReviewedBillingCandidates({
    actorUserId: identity.actorUserId,
    workspaceId,
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
    auditGateway: client
      ? createSupabaseLiveAuditAppendGateway(
          client as unknown as SupabaseLiveAuditAppendRpcClient,
        )
      : undefined,
    auditRequestId: getAuditRequestId(request),
    gateway: client
      ? createSupabaseFulfillmentWorkItemGateway(
          client as unknown as SupabaseFulfillmentWorkItemRpcClient,
        )
      : undefined,
    // The fulfillment review core selects the queue-scoped completion wrapper
    // for every reviewed order before billing sync.
    invoiceCandidateGateway: client
      ? createSupabaseInvoiceCandidateSyncGateway(
          client as unknown as SupabaseInvoiceCandidateSyncRpcClient,
        )
      : undefined,
  });

  return Response.json(result, { status: result.status });
}

async function readJsonBody(
  request: Request,
): Promise<FulfillmentVetReviewBillingInput> {
  try {
    const value = (await request.json()) as unknown;
    if (!value || typeof value !== "object") return {};
    const row = value as Partial<FulfillmentVetReviewBillingInput>;
    return {
      encounterId: typeof row.encounterId === "string" ? row.encounterId : undefined,
      orderIds: Array.isArray(row.orderIds)
        ? row.orderIds.filter((orderId): orderId is string => typeof orderId === "string")
        : undefined,
    };
  } catch {
    return {};
  }
}
