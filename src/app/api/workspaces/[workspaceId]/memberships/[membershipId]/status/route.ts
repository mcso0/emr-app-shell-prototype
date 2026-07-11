import { readServerSession } from "@/features/auth/server-session-reader";
import {
  demoSessionUserIdHeader,
  resolveRoleUpdateActorIdentity,
} from "@/features/auth/server-role-update-identity";
import { authorizeWorkspaceRoleUpdate } from "@/features/auth/server-role-update-enforcement";
import {
  createSupabaseLiveAuditAppendGateway,
  type SupabaseLiveAuditAppendRpcClient,
} from "@/features/audit/server-audit-log-persistence";
import {
  emitLiveMutationAuditEvent,
  getAuditRequestId,
} from "@/features/audit/server-mutation-audit";
import { enforceWorkspaceMutationRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

type MembershipStatusRouteContext = {
  params: Promise<{
    workspaceId: string;
    membershipId: string;
  }>;
};

export async function PATCH(request: Request, { params }: MembershipStatusRouteContext) {
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
    operation: "workspace_membership_status_update",
  });
  if (rateLimitResponse) return rateLimitResponse;

  const body = await readJsonBody(request);
  const nextStatus = getBodyString(body.status);

  if (nextStatus !== "active" && nextStatus !== "inactive") {
    return Response.json({ ok: false, error: "invalid_input" }, { status: 400 });
  }

  if (identity.source === "supabase_session") {
    const client = await createClient();

    if (!client) {
      return Response.json(
        { ok: false, status: 500, error: "supabase_client_missing" },
        { status: 500 }
      );
    }

    const { data, error } = await client.rpc("clair_update_workspace_membership_status", {
      p_workspace_id: workspaceId,
      p_membership_id: membershipId,
      p_next_status: nextStatus,
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

    const updatedStatus = (data as { status?: string }).status ?? nextStatus;
    const audit = await emitLiveMutationAuditEvent({
      auditGateway: createSupabaseLiveAuditAppendGateway(
        client as unknown as SupabaseLiveAuditAppendRpcClient
      ),
      input: {
        workspaceId,
        actorUserId: identity.actorUserId,
        eventType: getMembershipStatusAuditEventType(nextStatus),
        targetType: "membership",
        targetId: membershipId,
        requestId: getAuditRequestId(request),
        after: { status: updatedStatus },
        metadata: { source: "workspace-membership-status-route" },
      },
    });
    if (!audit.ok) {
      return Response.json({ ok: false, error: "audit_write_failed" }, { status: 500 });
    }

    return Response.json(
      {
        ok: true,
        workspaceId,
        targetMembershipId: membershipId,
        updatedStatus,
        enforcedBy: "server-permission-resolver",
      },
      { status: 200 }
    );
  }

  if (membershipId === "membership-admin" && nextStatus === "inactive") {
    return Response.json(
      { ok: false, denialReason: "last_admin_protected" },
      { status: 409 }
    );
  }

  const result = authorizeWorkspaceRoleUpdate({
    actorUserId: identity.actorUserId,
    workspaceId,
    targetMembershipId: membershipId,
    nextRoles: ["vet"],
  });

  if (!result.ok) {
    return Response.json(result, { status: result.status });
  }

  const audit = await emitLiveMutationAuditEvent({
    input: {
      workspaceId,
      actorUserId: identity.actorUserId,
      eventType: getMembershipStatusAuditEventType(nextStatus),
      targetType: "membership",
      targetId: membershipId,
      requestId: getAuditRequestId(request),
      after: { status: nextStatus },
      metadata: { source: "workspace-membership-status-route" },
    },
  });
  if (!audit.ok) {
    return Response.json({ ok: false, error: "audit_write_failed" }, { status: 500 });
  }

  return Response.json(
    {
      ok: true,
      workspaceId,
      targetMembershipId: membershipId,
      updatedStatus: nextStatus,
      enforcedBy: "server-permission-resolver",
    },
    { status: 200 }
  );
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

function getMembershipStatusAuditEventType(status: "active" | "inactive") {
  return status === "active"
    ? "workspace.membership_reactivated" as const
    : "workspace.membership_deactivated" as const;
}
