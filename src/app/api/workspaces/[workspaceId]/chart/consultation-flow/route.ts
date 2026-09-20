import { loadWorkspacePermissionAdapterFromDb } from "@/features/auth/db-workspace-permission-adapter";
import { demoClientSessionIdHeader } from "@/features/auth/demo-actor";
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
  createSupabaseLiveAuditAppendGateway,
  type SupabaseLiveAuditAppendRpcClient,
} from "@/features/audit/server-audit-log-persistence";
import { getAuditRequestId } from "@/features/audit/server-mutation-audit";
import {
  createSupabaseConsultationFlowGateway,
  mutateConsultationFlow,
  type ConsultationFlowInput,
  type SupabaseConsultationFlowRpcClient,
} from "@/features/chart/server-consultation-flow";
import {
  createMockWorkspaceSpaceManagementGateway,
  createSupabaseWorkspaceSpaceManagementGateway,
  type SupabaseWorkspaceSpaceManagementClient,
} from "@/features/hospital-admin/space-management/server-space-management-core";
import { enforceWorkspaceMutationRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    workspaceId: string;
  }>;
};

export async function PATCH(request: Request, { params }: RouteContext) {
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
      { status: 401 },
    );
  }

  const rateLimitResponse = enforceWorkspaceMutationRateLimit({
    request,
    actorUserId: identity.actorUserId,
    workspaceId,
    operation: "chart_consultation_flow",
  });
  if (rateLimitResponse) return rateLimitResponse;

  const input = await readJsonBody(request);
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
  const result = await mutateConsultationFlow({
    actorUserId: identity.actorUserId,
    workspaceId,
    input,
    gateway: client
      ? createSupabaseConsultationFlowGateway(
          client as unknown as SupabaseConsultationFlowRpcClient,
        )
      : undefined,
    permissionAdapter,
    spaceManagementGateway,
    auditGateway: client
      ? createSupabaseLiveAuditAppendGateway(
          client as unknown as SupabaseLiveAuditAppendRpcClient,
        )
      : undefined,
    auditRequestId: getAuditRequestId(request),
  });

  return Response.json(result, { status: result.status });
}

async function readJsonBody(request: Request): Promise<ConsultationFlowInput> {
  try {
    const value = (await request.json()) as unknown;
    return value && typeof value === "object" ? value as ConsultationFlowInput : {};
  } catch {
    return {};
  }
}
