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
  createSupabaseWorkspaceInvitationGateway,
  createWorkspaceInvitation,
  type SupabaseWorkspaceInvitationRpcClient,
} from "@/features/auth/server-workspace-invitation";
import { createResendWorkspaceInvitationEmailDelivery } from "@/features/auth/workspace-invitation-email-delivery";
import { enforceWorkspaceMutationRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

type WorkspaceInvitationRouteContext = {
  params: Promise<{
    workspaceId: string;
  }>;
};

export async function POST(request: Request, { params }: WorkspaceInvitationRouteContext) {
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
    operation: "workspace_invitation_create",
  });
  if (rateLimitResponse) return rateLimitResponse;

  const body = await readJsonBody(request);
  const client =
    identity.source === "supabase_session"
      ? await createClient()
      : null;
  const permissionAdapter = client
    ? await loadWorkspacePermissionAdapterFromDb({
        gateway: createSupabaseWorkspacePermissionGateway(
          client as unknown as SupabaseWorkspacePermissionClient
        ),
        workspaceId,
        sessionUserId: identity.actorUserId,
      })
    : undefined;
  const result = await createWorkspaceInvitation({
    actorUserId: identity.actorUserId,
    workspaceId,
    input: {
      email: getBodyString(body.email),
      roles: Array.isArray(body.roles) ? body.roles.filter(isString) : [],
      title: getBodyString(body.title),
      department: getBodyString(body.department),
      expiresAt: typeof body.expiresAt === "string" ? body.expiresAt : null,
    },
    permissionAdapter,
    gateway: client
      ? createSupabaseWorkspaceInvitationGateway(
          client as unknown as SupabaseWorkspaceInvitationRpcClient
        )
      : undefined,
    emailDelivery: createResendWorkspaceInvitationEmailDelivery({
      requestOrigin: new URL(request.url).origin,
    }),
  });

  return Response.json(result, { status: result.status });
}

async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const value = (await request.json()) as unknown;
    return value && typeof value === "object" ? value as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function getBodyString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}
