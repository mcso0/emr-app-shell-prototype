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
  createSupabaseFulfillmentWorkItemGateway,
  readFulfillmentWorkItems,
  type SupabaseFulfillmentWorkItemRpcClient,
} from "@/features/fulfillment/server-fulfillment-work-item";
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
  const result = await readFulfillmentWorkItems({
    actorUserId: identity.actorUserId,
    workspaceId,
    permissionAdapter,
    filters: {
      date: url.searchParams.get("date"),
      encounterId: url.searchParams.get("encounterId"),
      orderId: url.searchParams.get("orderId"),
      patientId: url.searchParams.get("patientId"),
      workItemId: url.searchParams.get("workItemId"),
      queueType: url.searchParams.get("queueType"),
      status: url.searchParams.get("status"),
    },
    gateway: client
      ? createSupabaseFulfillmentWorkItemGateway(
          client as unknown as SupabaseFulfillmentWorkItemRpcClient
        )
      : undefined,
  });

  return Response.json(result, { status: result.status });
}
