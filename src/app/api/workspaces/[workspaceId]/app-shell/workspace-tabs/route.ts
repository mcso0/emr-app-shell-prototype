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
  createSupabaseWorkspaceTabsSessionGateway,
  readWorkspaceTabsSession,
  saveWorkspaceTabsSession,
  type SupabaseWorkspaceTabsSessionClient,
} from "@/features/app-shell/server-workspace-tabs-session";
import { enforceWorkspaceMutationRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    workspaceId: string;
  }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const { workspaceId } = await params;
  const identity = await resolveIdentity(request);

  if (!identity.ok) {
    return Response.json(identity.body, { status: 401 });
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
  const result = await readWorkspaceTabsSession({
    actorUserId: identity.actorUserId,
    workspaceId,
    permissionAdapter,
    gateway: client
      ? createSupabaseWorkspaceTabsSessionGateway(
          client as unknown as SupabaseWorkspaceTabsSessionClient
        )
      : undefined,
  });

  return Response.json(result, { status: result.status });
}

export async function PUT(request: Request, { params }: RouteContext) {
  const { workspaceId } = await params;
  const identity = await resolveIdentity(request);

  if (!identity.ok) {
    return Response.json(identity.body, { status: 401 });
  }

  const rateLimitResponse = enforceWorkspaceMutationRateLimit({
    request,
    actorUserId: identity.actorUserId,
    workspaceId,
    operation: "workspace_tabs_session_save",
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
  const result = await saveWorkspaceTabsSession({
    actorUserId: identity.actorUserId,
    workspaceId,
    input,
    permissionAdapter,
    gateway: client
      ? createSupabaseWorkspaceTabsSessionGateway(
          client as unknown as SupabaseWorkspaceTabsSessionClient
        )
      : undefined,
  });

  return Response.json(result, { status: result.status });
}

async function resolveIdentity(request: Request) {
  const serverSession = await readServerSession();
  const identity = resolveRoleUpdateActorIdentity({
    serverSession,
    demoHeaderUserId: request.headers.get(demoSessionUserIdHeader),
  });

  if (!identity.ok) {
    return {
      ok: false as const,
      body: {
        ok: false,
        denialReason: identity.denialReason,
        sessionStatus: identity.sessionStatus,
        sessionReason: identity.sessionReason,
      },
    };
  }

  return identity;
}

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
