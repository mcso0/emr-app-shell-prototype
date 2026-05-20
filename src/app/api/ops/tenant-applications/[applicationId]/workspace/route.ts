import { readServerSession } from "@/features/auth/server-session-reader";
import {
  demoSessionUserIdHeader,
  resolveRoleUpdateActorIdentity,
} from "@/features/auth/server-role-update-identity";
import { createApprovedTenantWorkspaceAndFirstAdminInvite } from "@/features/ops/server-tenant-workspace-action";
import { enforceWorkspaceMutationRateLimit } from "@/lib/security/rate-limit";

export async function POST(
  request: Request,
  context: { params: Promise<{ applicationId: string }> }
) {
  const [{ applicationId }, serverSession, body] = await Promise.all([
    context.params,
    readServerSession(),
    readJsonBody(request),
  ]);
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
    workspaceId: applicationId,
    operation: "ops_tenant_workspace_action",
  });
  if (rateLimitResponse) return rateLimitResponse;

  const result = await createApprovedTenantWorkspaceAndFirstAdminInvite({
    actorUserId: identity.actorUserId,
    applicationId,
    input: {
      firstAdminEmail: getBodyString(body.firstAdminEmail),
      firstAdminDisplayName: getBodyString(body.firstAdminDisplayName),
    },
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
