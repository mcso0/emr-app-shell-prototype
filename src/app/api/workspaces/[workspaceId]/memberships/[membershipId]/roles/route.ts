import { readServerSession } from "@/features/auth/server-session-reader";
import {
  demoSessionUserIdHeader,
  resolveRoleUpdateActorIdentity,
} from "@/features/auth/server-role-update-identity";
import { authorizeWorkspaceRoleUpdate } from "@/features/auth/server-role-update-enforcement";
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
  const nextRoles = Array.isArray(body.roles) ? body.roles : [];

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
    });

    if (error) {
      const denialReason = error.message?.includes("last_admin")
        ? "last_admin_protected"
        : error.message?.includes("workspace_membership_missing")
          ? "target_membership_missing"
          : "permission_missing";
      const status = denialReason === "last_admin_protected" ? 409 : 403;

      return Response.json({ ok: false, denialReason }, { status });
    }

    return Response.json(
      {
        ok: true,
        workspaceId,
        targetMembershipId: membershipId,
        updatedRoles: Array.isArray((data as { roles?: unknown }).roles)
          ? (data as { roles: unknown[] }).roles
          : nextRoles,
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

  return Response.json(result, { status: result.status });
}

async function readJsonBody(request: Request): Promise<{ roles?: unknown }> {
  try {
    const value = (await request.json()) as unknown;
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}
