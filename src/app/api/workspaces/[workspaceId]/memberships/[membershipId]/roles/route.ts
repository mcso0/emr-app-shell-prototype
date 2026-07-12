import { readServerSession } from "@/features/auth/server-session-reader";
import {
  demoSessionUserIdHeader,
  resolveRoleUpdateActorIdentity,
} from "@/features/auth/server-role-update-identity";
import { authorizeWorkspaceRoleUpdate } from "@/features/auth/server-role-update-enforcement";
import {
  emitLiveMutationAuditEvent,
  getAuditRequestId,
} from "@/features/audit/server-mutation-audit";
import { enforceWorkspaceMutationRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

type RoleUpdateRouteContext = {
  params: Promise<{
    workspaceId: string;
    membershipId: string;
  }>;
};

export async function POST(request: Request, { params }: RoleUpdateRouteContext) {
  const { workspaceId, membershipId } = await params;
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
    operation: "workspace_membership_role_update",
  });
  if (rateLimitResponse) return rateLimitResponse;

  const body = await readJsonBody(request);
  const nextRoles = Array.isArray(body.roles) ? body.roles.filter(isString) : [];
  const permissionRoleKey = getOptionalBodyString(body.permissionRoleKey);
  const jobPositionKey = getOptionalBodyString(body.jobPositionKey);

  if (identity.source === "supabase_session") {
    const client = await createClient();

    if (!client) {
      return Response.json(
        { ok: false, status: 500, error: "supabase_client_missing" },
        { status: 500 }
      );
    }

    const { data, error } = await client.rpc("clair_update_workspace_membership_roles", {
      p_workspace_id: workspaceId,
      p_membership_id: membershipId,
      p_next_roles: nextRoles,
      p_permission_role_key: permissionRoleKey,
      p_job_position_key: jobPositionKey,
      p_request_id: getAuditRequestId(request),
    });

    if (error) {
      const denialReason = error.message?.includes("self_action_protected")
        ? "self_action_protected"
        : error.message?.includes("owner_target_protected") || error.message?.includes("owner_scope_required")
          ? "owner_target_protected"
          : error.message?.includes("last_admin")
        ? "last_admin_protected"
        : error.message?.includes("workspace_membership_missing")
          ? "target_membership_missing"
          : "permission_missing";
      const status = denialReason.endsWith("protected") ? 409 : 403;

      return Response.json({ ok: false, denialReason }, { status });
    }

    const mutationData = isRecord(data) ? data : {};
    const updatedRoles = Array.isArray(mutationData.roles)
      ? mutationData.roles.filter(isString)
      : nextRoles;
    const updatedPermissionRoleKey =
      getOptionalBodyString(mutationData.permissionRoleKey) ?? permissionRoleKey;
    const updatedJobPositionKey =
      getOptionalBodyString(mutationData.jobPositionKey) ?? jobPositionKey;
    return Response.json(
      {
        ok: true,
        workspaceId,
        targetMembershipId: membershipId,
        updatedRoles,
        permissionRoleKey: updatedPermissionRoleKey,
        jobPositionKey: updatedJobPositionKey,
        enforcedBy: "server-permission-resolver",
      },
      { status: 200 }
    );
  }

  const result = authorizeWorkspaceRoleUpdate({
    actorUserId: identity.actorUserId,
    workspaceId,
    targetMembershipId: membershipId,
    nextRoles,
  });

  if (result.ok) {
    const audit = await emitLiveMutationAuditEvent({
      input: {
        workspaceId,
        actorUserId: identity.actorUserId,
        eventType: "workspace.membership_roles_changed",
        targetType: "membership",
        targetId: membershipId,
        requestId: getAuditRequestId(request),
        after: { roles: result.updatedRoles, permissionRoleKey, jobPositionKey },
        metadata: { source: "workspace-membership-role-route" },
      },
    });
    if (!audit.ok) {
      return Response.json({ ok: false, error: "audit_write_failed" }, { status: 500 });
    }
  }

  return Response.json(
    result.ok
      ? {
          ...result,
          permissionRoleKey,
          jobPositionKey,
        }
      : result,
    { status: result.status }
  );
}

async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const value = (await request.json()) as unknown;
    return isRecord(value) ? value : {};
  } catch {
    return {};
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function getOptionalBodyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}
