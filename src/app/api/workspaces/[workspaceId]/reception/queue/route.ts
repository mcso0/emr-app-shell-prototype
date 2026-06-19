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
  createSupabaseReceptionQueueReadGateway,
  readReceptionQueue,
  type SupabaseReceptionQueueReadRpcClient,
} from "@/features/reception/server-reception-queue-read";
import { getWorkspaceOperatingDate } from "@/lib/emr-domain/demo-date";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    workspaceId: string;
  }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const { workspaceId } = await params;
  const url = new URL(request.url);
  const date = url.searchParams.get("date") ?? getWorkspaceOperatingDate(workspaceId);
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
  const result = await readReceptionQueue({
    actorUserId: identity.actorUserId,
    date,
    permissionAdapter,
    workspaceId,
    gateway: client
      ? createSupabaseReceptionQueueReadGateway(
          client as unknown as SupabaseReceptionQueueReadRpcClient
        )
      : undefined,
  });

  return Response.json(result, { status: result.status });
}
