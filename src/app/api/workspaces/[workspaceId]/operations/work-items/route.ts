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
  createDemoHomeOperationsPermissionAdapter,
  createDemoHomeOperationsWorkItemGateway,
  createSupabaseHomeOperationsWorkItemGateway,
  readHomeOperationsWorkItems,
  type SupabaseHomeOperationsWorkItemsRpcClient,
} from "@/features/home/server-home-operations-work-items";
import { isLegacySalesDemoWorkspace } from "@/lib/emr-domain/demo-workspaces";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    workspaceId: string;
  }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const { workspaceId } = await params;
  const serverSession = await readServerSession();
  const identity = resolveRoleUpdateActorIdentity({
    serverSession,
    demoHeaderUserId: request.headers.get(demoSessionUserIdHeader),
  });
  const url = new URL(request.url);

  if (!identity.ok) {
    return Response.json(
      {
        ok: false,
        workspaceId,
        operatingDate: url.searchParams.get("date") ?? "",
        sourceStatus: "permission_denied",
        error: {
          code: identity.denialReason,
          message: "원내 현황을 볼 권한이 없습니다.",
          retryable: false,
        },
        sessionStatus: identity.sessionStatus,
        sessionReason: identity.sessionReason,
      },
      { status: 401 },
    );
  }

  const client = identity.source === "supabase_session" ? await createClient() : null;
  const canUseDemoGateway =
    identity.source === "demo_header_mock_mode" &&
    isLegacySalesDemoWorkspace(workspaceId);
  const permissionAdapter = client
    ? await loadWorkspacePermissionAdapterFromDb({
        gateway: createSupabaseWorkspacePermissionGateway(
          client as unknown as SupabaseWorkspacePermissionClient,
        ),
        workspaceId,
        sessionUserId: identity.actorUserId,
      })
    : canUseDemoGateway
      ? createDemoHomeOperationsPermissionAdapter()
      : undefined;
  const result = await readHomeOperationsWorkItems({
    actorUserId: identity.actorUserId,
    workspaceId,
    filters: {
      date: url.searchParams.get("date"),
      scope: url.searchParams.get("scope"),
      includeCompleted: parseBooleanParam(url.searchParams.get("includeCompleted")),
      includeCancelled: parseBooleanParam(url.searchParams.get("includeCancelled")),
    },
    permissionAdapter,
    gateway: client
      ? createSupabaseHomeOperationsWorkItemGateway(
          client as unknown as SupabaseHomeOperationsWorkItemsRpcClient,
        )
      : canUseDemoGateway
        ? createDemoHomeOperationsWorkItemGateway()
        : undefined,
  });

  return Response.json(result, { status: result.status });
}

function parseBooleanParam(value: string | null) {
  return value === "true" || value === "1";
}
