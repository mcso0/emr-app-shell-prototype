import {
  handleMembershipStatusGet,
  resolveMembershipStatusIncludeArchived,
} from "./route-core";
import type { MembershipRouteDependencies } from "./route-core";
import type {
  SupabaseWorkspaceMembershipStatusRpcClient,
} from "@/features/auth/server-workspace-membership-status";
import type { SupabaseWorkspacePermissionClient } from "@/features/auth/supabase-workspace-permission-gateway";

type MembershipRouteSupabaseClient = SupabaseWorkspacePermissionClient &
  SupabaseWorkspaceMembershipStatusRpcClient;

type RouteContext = {
  params: Promise<{
    workspaceId: string;
  }>;
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
