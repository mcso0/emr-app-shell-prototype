import { readServerSession } from "@/features/auth/server-session-reader";
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
  createSupabaseFulfillmentWorkItemGateway,
  readFulfillmentWorkItemHistory,
  type SupabaseFulfillmentWorkItemRpcClient,
} from "@/features/fulfillment/server-fulfillment-work-item";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    workspaceId: string;
    workItemId: string;
  }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const { workspaceId, workItemId } = await params;
  const searchParams = new URL(request.url).searchParams;
  const requestedLimit = searchParams.get("limit");
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

  const client =
    identity.source === "supabase_session" ? await createClient() : null;
  const permissionAdapter = client
    ? await loadWorkspacePermissionAdapterFromDb({
        gateway: createSupabaseWorkspacePermissionGateway(
          client as unknown as SupabaseWorkspacePermissionClient,
        ),
        workspaceId,
        sessionUserId: identity.actorUserId,
      })
    : undefined;
  const result = await readFulfillmentWorkItemHistory({
    actorUserId: identity.actorUserId,
    beforeCreatedAt: searchParams.get("beforeCreatedAt"),
    beforeEventId: searchParams.get("beforeEventId"),
    gateway: client
      ? createSupabaseFulfillmentWorkItemGateway(
          client as unknown as SupabaseFulfillmentWorkItemRpcClient,
        )
      : undefined,
    permissionAdapter,
    limit: requestedLimit === null ? 50 : Number(requestedLimit),
    workItemId,
    workspaceId,
  });

  return Response.json(result, { status: result.status });
}
