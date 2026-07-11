import { readServerSession } from "@/features/auth/server-session-reader";
import {
  demoSessionUserIdHeader,
  resolveRoleUpdateActorIdentity,
} from "@/features/auth/server-role-update-identity";
import {
  authorizeWorkspaceMembershipArchive,
  type WorkspaceMembershipArchiveAction,
} from "@/features/auth/server-workspace-membership-archive";
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

type MembershipArchiveRouteContext = {
  params: Promise<{ workspaceId: string; membershipId: string }>;
};

export async function POST(request: Request, { params }: MembershipArchiveRouteContext) {
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
    operation: "workspace_membership_archive",
  });
  if (rateLimitResponse) return rateLimitResponse;

  const body = await readJsonBody(request);
  const action = getArchiveAction(body.action);
  const reason = getOptionalBodyString(body.reason);

  if (!action) {
    return Response.json({ ok: false, error: "invalid_input" }, { status: 400 });
  }

  if (action === "soft_delete" && !reason) {
    return Response.json({ ok: false, error: "invalid_reason" }, { status: 400 });
  }

  if (identity.source === "supabase_session") {
    const client = await createClient();

    if (!client) {
      return Response.json({ ok: false, error: "supabase_client_missing" }, { status: 500 });
    }

    const { data, error } = await client.rpc("clair_archive_workspace_membership", {
      p_workspace_id: workspaceId,
      p_membership_id: membershipId,
      p_action: action,
      p_deleted_reason: reason,
    });

    if (error) {
      const denialReason = getArchiveDenialReason(error.message);
      return Response.json(
        { ok: false, denialReason },
        { status: denialReason === "target_membership_missing" ? 404 : denialReason.endsWith("protected") ? 409 : 403 }
      );
    }

    const mutation = isRecord(data) ? data : {};
    const updatedStatus = getOptionalBodyString(mutation.status) ?? (action === "soft_delete" ? "soft_deleted" : "inactive");
    const audit = await emitLiveMutationAuditEvent({
      auditGateway: createSupabaseLiveAuditAppendGateway(
        client as unknown as SupabaseLiveAuditAppendRpcClient
      ),
      input: {
        workspaceId,
        actorUserId: identity.actorUserId,
        eventType:
          action === "soft_delete"
            ? "workspace.membership_soft_deleted"
            : "workspace.membership_restored",
        targetType: "membership",
        targetId: membershipId,
        requestId: getAuditRequestId(request),
        reason,
        after: { status: updatedStatus },
        metadata: { action, source: "workspace-membership-archive-route" },
      },
    });

    if (!audit.ok) {
      return Response.json({ ok: false, error: "audit_write_failed" }, { status: 500 });
    }

    return Response.json({
      ok: true,
      action,
      workspaceId,
      targetMembershipId: membershipId,
      updatedStatus,
      enforcedBy: "server-permission-resolver",
    });
  }

  const result = authorizeWorkspaceMembershipArchive({
    action,
    actorUserId: identity.actorUserId,
    workspaceId,
    targetMembershipId: membershipId,
  });

  if (!result.ok) {
    return Response.json(result, { status: result.status });
  }

  const audit = await emitLiveMutationAuditEvent({
    input: {
      workspaceId,
      actorUserId: identity.actorUserId,
      eventType:
        action === "soft_delete"
          ? "workspace.membership_soft_deleted"
          : "workspace.membership_restored",
      targetType: "membership",
      targetId: membershipId,
      requestId: getAuditRequestId(request),
      reason,
      after: { status: result.updatedStatus },
      metadata: { action, source: "workspace-membership-archive-route" },
    },
  });

  if (!audit.ok) {
    return Response.json({ ok: false, error: "audit_write_failed" }, { status: 500 });
  }

  return Response.json(result, { status: 200 });
}

async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const value = (await request.json()) as unknown;
    return isRecord(value) ? value : {};
  } catch {
    return {};
  }
}

function getArchiveAction(value: unknown): WorkspaceMembershipArchiveAction | null {
  return value === "soft_delete" || value === "restore" ? value : null;
}

function getOptionalBodyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getArchiveDenialReason(message?: string) {
  if (message?.includes("self_action_protected")) return "self_action_protected";
  if (message?.includes("last_active_workspace_owner_protected") || message?.includes("last_admin")) {
    return "last_admin_protected";
  }
  if (message?.includes("workspace_membership_missing")) return "target_membership_missing";
  return "permission_missing";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}
