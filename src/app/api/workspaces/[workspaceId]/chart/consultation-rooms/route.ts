import { demoClientSessionIdHeader } from "@/features/auth/demo-actor";
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
import { readConsultationCallRooms } from "@/features/chart/server-consultation-flow";
import {
  createMockWorkspaceSpaceManagementGateway,
  createSupabaseWorkspaceSpaceManagementGateway,
  type SupabaseWorkspaceSpaceManagementClient,
} from "@/features/hospital-admin/space-management/server-space-management-core";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ workspaceId: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const { workspaceId } = await params;
  const identity = resolveRoleUpdateActorIdentity({
    serverSession: await readServerSession(),
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
        sessionUserId: identity.actorUserId,
        workspaceId,
      })
    : undefined;
  const spaceManagementGateway = identity.source === "demo_header_mock_mode"
    ? createMockWorkspaceSpaceManagementGateway(
        request.headers.get(demoClientSessionIdHeader) ?? "shared",
      )
    : client
      ? createSupabaseWorkspaceSpaceManagementGateway(
          client as unknown as SupabaseWorkspaceSpaceManagementClient,
        )
      : undefined;
  const result = await readConsultationCallRooms({
    actorUserId: identity.actorUserId,
    permissionAdapter,
    spaceManagementGateway,
    workspaceId,
  });

  return Response.json(result, { status: result.status });
}
