import type { WorkspacePermissionDbGateway } from "@/features/auth/db-workspace-permission-adapter-core";
import type { WorkspacePermissionAdapter } from "@/features/auth/permission-resolver";
import {
  demoSessionUserIdHeader,
  resolveRoleUpdateActorIdentity,
} from "@/features/auth/server-role-update-identity";
import type { ServerSessionReaderResult } from "@/features/auth/server-session-contract";
import type {
  SupabaseWorkspaceMembershipStatusRpcClient,
  WorkspaceMembershipStatusGateway,
  WorkspaceMembershipStatusResult,
} from "@/features/auth/server-workspace-membership-status";
import type { SupabaseWorkspacePermissionClient } from "@/features/auth/supabase-workspace-permission-gateway";

type MembershipRouteSupabaseClient = SupabaseWorkspacePermissionClient &
  SupabaseWorkspaceMembershipStatusRpcClient;

type RouteContext = {
  params: Promise<{
    workspaceId: string;
  }>;
};

export type MembershipRouteDependencies<Client extends object> = {
  readServerSession(): Promise<ServerSessionReaderResult>;
  createClient(): Promise<Client | null>;
  loadWorkspacePermissionAdapterFromDb(input: {
    gateway: WorkspacePermissionDbGateway;
    workspaceId: string;
    sessionUserId: string;
  }): Promise<WorkspacePermissionAdapter>;
  createSupabaseWorkspacePermissionGateway(client: Client): WorkspacePermissionDbGateway;
  createSupabaseWorkspaceMembershipStatusGateway(
    client: Client,
    workspaceId: string
  ): WorkspaceMembershipStatusGateway;
  readWorkspaceMembershipStatus(input: {
    actorUserId: string | null;
    workspaceId: string;
    includeArchived?: boolean;
    permissionAdapter?: WorkspacePermissionAdapter;
    gateway?: WorkspaceMembershipStatusGateway;
  }): Promise<WorkspaceMembershipStatusResult>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const { workspaceId } = await params;
  const includeArchived = resolveMembershipStatusIncludeArchived(request.url);
  return handleMembershipStatusGet(
    request,
    { workspaceId, includeArchived },
    await getMembershipRouteDependencies()
  );
}

export async function handleMembershipStatusGet<Client extends object>(
  request: Request,
  { workspaceId, includeArchived = false }: { workspaceId: string; includeArchived?: boolean },
  dependencies: MembershipRouteDependencies<Client>
) {
  const serverSession = await dependencies.readServerSession();
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

  let permissionAdapter: WorkspacePermissionAdapter | undefined;
  let gateway: WorkspaceMembershipStatusGateway | undefined;

  if (identity.source === "supabase_session") {
    const client = await dependencies.createClient();

    if (!client) {
      return Response.json(
        { ok: false, status: 500, error: "supabase_client_missing" },
        { status: 500 }
      );
    }

    try {
      permissionAdapter = await dependencies.loadWorkspacePermissionAdapterFromDb({
        gateway: dependencies.createSupabaseWorkspacePermissionGateway(client),
        workspaceId,
        sessionUserId: identity.actorUserId,
      });
    } catch (error) {
      if (error instanceof Error) {
        return Response.json({ ok: false, status: 500, error: "db_read_failed" }, { status: 500 });
      }

      throw error;
    }

    gateway = dependencies.createSupabaseWorkspaceMembershipStatusGateway(client, workspaceId);
  }

  const result = await dependencies.readWorkspaceMembershipStatus({
    actorUserId: identity.actorUserId,
    permissionAdapter,
    workspaceId,
    gateway,
    includeArchived,
  });

  return Response.json(result, { status: result.status });
}

export function resolveMembershipStatusIncludeArchived(url: string) {
  const params = new URL(url).searchParams;
  return params.get("includeArchived") === "true" || params.get("includeDeleted") === "true";
}

async function getMembershipRouteDependencies(): Promise<
  MembershipRouteDependencies<MembershipRouteSupabaseClient>
> {
  const [
    { loadWorkspacePermissionAdapterFromDb },
    { readServerSession },
    { createSupabaseWorkspaceMembershipStatusGateway, readWorkspaceMembershipStatus },
    { createSupabaseWorkspacePermissionGateway },
    { createClient: createSupabaseServerClient },
  ] = await Promise.all([
    import("@/features/auth/db-workspace-permission-adapter"),
    import("@/features/auth/server-session-reader"),
    import("@/features/auth/server-workspace-membership-status"),
    import("@/features/auth/supabase-workspace-permission-gateway"),
    import("@/lib/supabase/server"),
  ]);

  return {
    readServerSession,
    async createClient() {
      const client = await createSupabaseServerClient();

      if (!client) {
        return null;
      }

      return isMembershipRouteSupabaseClient(client) ? client : null;
    },
    loadWorkspacePermissionAdapterFromDb,
    createSupabaseWorkspacePermissionGateway,
    createSupabaseWorkspaceMembershipStatusGateway,
    readWorkspaceMembershipStatus,
  };
}

function isMembershipRouteSupabaseClient(client: object): client is MembershipRouteSupabaseClient {
  return (
    "from" in client &&
    typeof client.from === "function" &&
    "rpc" in client &&
    typeof client.rpc === "function"
  );
}
