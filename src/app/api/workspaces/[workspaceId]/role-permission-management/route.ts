import {
  handleWorkspaceRoleCatalogGet,
  handleWorkspaceRoleCatalogMutation,
} from "./route-core";
import type { WorkspaceRoleCatalogRouteDependencies } from "./route-core";

type RouteContext = {
  params: Promise<{
    workspaceId: string;
  }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const { workspaceId } = await params;
  return handleWorkspaceRoleCatalogGet(request, { workspaceId }, await getRouteDependencies());
}

export async function POST(request: Request, { params }: RouteContext) {
  const { workspaceId } = await params;
  return handleWorkspaceRoleCatalogMutation(request, { workspaceId }, await getRouteDependencies());
}

export async function PATCH(request: Request, context: RouteContext) {
  return POST(request, context);
}

export async function DELETE(request: Request, context: RouteContext) {
  return POST(request, context);
}

async function getRouteDependencies(): Promise<WorkspaceRoleCatalogRouteDependencies<object>> {
  const [
    { readServerSession },
    { createClient: createSupabaseServerClient },
    { createSupabaseWorkspaceRoleCatalogGateway },
    { enforceWorkspaceMutationRateLimit },
    { emitLiveMutationAuditEvent },
    { createSupabaseLiveAuditAppendGateway },
  ] = await Promise.all([
    import("@/features/auth/server-session-reader"),
    import("@/lib/supabase/server"),
    import("@/features/auth/server-workspace-role-catalog"),
    import("@/lib/security/rate-limit"),
    import("@/features/audit/server-mutation-audit"),
    import("@/features/audit/server-audit-log-persistence"),
  ]);

  return {
    readServerSession,
    async createClient() {
      return (await createSupabaseServerClient()) as object | null;
    },
    createSupabaseWorkspaceRoleCatalogGateway(client) {
      return createSupabaseWorkspaceRoleCatalogGateway(client as never);
    },
    createAuditGateway(client) {
      return createSupabaseLiveAuditAppendGateway(client as never);
    },
    enforceWorkspaceMutationRateLimit,
    emitLiveMutationAuditEvent,
  };
}
