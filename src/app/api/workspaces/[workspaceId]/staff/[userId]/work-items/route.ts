import { loadWorkspacePermissionAdapterFromDb } from "@/features/auth/db-workspace-permission-adapter";
import { readServerSession } from "@/features/auth/server-session-reader";
import {
  demoSessionUserIdHeader,
  resolveRoleUpdateActorIdentity,
} from "@/features/auth/server-role-update-identity";
import {
  createSupabaseWorkspacePermissionGateway,
  type SupabaseWorkspacePermissionClient,
} from "@/features/auth/supabase-workspace-permission-gateway";
import {
  createSupabaseStaffAssignedWorkItemsGateway,
  readStaffAssignedWorkItems,
  type SupabaseStaffAssignedWorkItemsClient,
} from "@/features/staff/server-staff-assigned-work-items";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ userId: string; workspaceId: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const { userId, workspaceId } = await params;
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
        sessionReason: identity.sessionReason,
        sessionStatus: identity.sessionStatus,
      },
      { status: 401 },
    );
  }

  if (identity.source !== "supabase_session") {
    return Response.json(
      { ok: false, status: 503, error: "configured_data_source_required" },
      { status: 503 },
    );
  }
  const client = await createClient();
  if (!client) {
    return Response.json(
      { ok: false, status: 500, error: "supabase_client_missing" },
      { status: 500 },
    );
  }

  const permissionAdapter = await loadWorkspacePermissionAdapterFromDb({
    gateway: createSupabaseWorkspacePermissionGateway(
      client as unknown as SupabaseWorkspacePermissionClient,
    ),
    sessionUserId: identity.actorUserId,
    workspaceId,
  }).catch(() => null);
  if (!permissionAdapter) {
    return Response.json(
      { ok: false, status: 500, error: "db_read_failed" },
      { status: 500 },
    );
  }

  const url = new URL(request.url);
  const result = await readStaffAssignedWorkItems({
    actorUserId: identity.actorUserId,
    cursor: url.searchParams.get("cursor"),
    gateway: createSupabaseStaffAssignedWorkItemsGateway(
      client as unknown as SupabaseStaffAssignedWorkItemsClient,
    ),
    permissionAdapter,
    userId,
    workspaceId,
  });

  return Response.json(result, { status: result.status });
}
