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
  createSupabaseWorkspaceStaffReadGateway,
  readWorkspaceStaff,
  type SupabaseWorkspaceStaffClient,
} from "@/features/staff/server-workspace-staff";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    workspaceId: string;
  }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const { workspaceId } = await params;
  const url = new URL(request.url);
  const role = url.searchParams.get("role") ?? undefined;
  const operatingDate = url.searchParams.get("date") ?? undefined;
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
  const result = await readWorkspaceStaff({
    actorUserId: identity.actorUserId,
    gateway: client
      ? createSupabaseWorkspaceStaffReadGateway(
          client as unknown as SupabaseWorkspaceStaffClient,
        )
      : undefined,
    operatingDate,
    permissionAdapter,
    role,
    workspaceId,
  });

  return Response.json(result, { status: result.status });
}
