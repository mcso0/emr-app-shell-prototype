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
import {
  createMockWorkspaceSpaceManagementGateway,
  createSupabaseWorkspaceSpaceManagementGateway,
  mutateWorkspaceSpaceManagement,
  readWorkspaceSpaceManagement,
  type SupabaseWorkspaceSpaceManagementClient,
} from "@/features/hospital-admin/space-management/server-space-management-core";
import { enforceWorkspaceMutationRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ workspaceId: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const { workspaceId } = await params;
  const context = await resolveContext(request, workspaceId);
  if (!context.ok) return context.response;

  const result = await readWorkspaceSpaceManagement({
    actorUserId: context.actorUserId,
    workspaceId,
    permissionAdapter: context.permissionAdapter,
    gateway: context.gateway,
  });
  return Response.json(result, { status: result.status });
}

export async function POST(request: Request, { params }: RouteContext) {
  const { workspaceId } = await params;
  const context = await resolveContext(request, workspaceId);
  if (!context.ok) return context.response;

  const rateLimitResponse = enforceWorkspaceMutationRateLimit({
    request,
    actorUserId: context.actorUserId,
    workspaceId,
    operation: "hospital_admin_space_management_mutation",
  });
  if (rateLimitResponse) return rateLimitResponse;

  const result = await mutateWorkspaceSpaceManagement({
    actorUserId: context.actorUserId,
    workspaceId,
    input: await readJsonBody(request),
    permissionAdapter: context.permissionAdapter,
    gateway: context.gateway,
  });
  return Response.json(result, { status: result.status });
}

async function resolveContext(request: Request, workspaceId: string) {
  const identity = resolveRoleUpdateActorIdentity({
    serverSession: await readServerSession(),
    demoHeaderUserId: request.headers.get(demoSessionUserIdHeader),
  });
  if (!identity.ok) {
    return {
      ok: false as const,
      response: Response.json(
        {
          ok: false,
          denialReason: identity.denialReason,
          sessionStatus: identity.sessionStatus,
          sessionReason: identity.sessionReason,
        },
        { status: 401 },
      ),
    };
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
  const gateway = identity.source === "demo_header_mock_mode"
    ? createMockWorkspaceSpaceManagementGateway(
        request.headers.get(demoClientSessionIdHeader) ?? "shared",
      )
    : client
      ? createSupabaseWorkspaceSpaceManagementGateway(
          client as unknown as SupabaseWorkspaceSpaceManagementClient,
        )
      : undefined;

  return {
    ok: true as const,
    actorUserId: identity.actorUserId,
    gateway,
    permissionAdapter,
  };
}

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
