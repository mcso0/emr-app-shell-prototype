import { readServerSession } from "@/features/auth/server-session-reader";
import {
  demoSessionUserIdHeader,
  resolveRoleUpdateActorIdentity,
} from "@/features/auth/server-role-update-identity";
import {
  authorizeWorkspaceMembershipArchive,
  normalizeWorkspaceMembershipArchiveAction,
  type WorkspaceMembershipArchiveAction,
} from "@/features/auth/server-workspace-membership-archive";
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

  if (action === "archive" && !reason) {
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
      p_request_id: getAuditRequestId(request),
    });

    if (error) {
      const denialReason = getArchiveDenialReason(error.message);
      return Response.json(
        { ok: false, denialReason },
        { status: getArchiveDenialStatus(denialReason) }
      );
    }

    const mutation = isRecord(data) ? data : {};
    const updatedStatus = getOptionalBodyString(mutation.status) ?? (action === "archive" ? "archived" : "inactive");
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
        action === "archive"
          ? "workspace.membership_archived"
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
  return normalizeWorkspaceMembershipArchiveAction(value);
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
  if (message?.includes("owner_target_protected")) return "owner_target_protected";
  if (message?.includes("membership_not_archivable") || message?.includes("membership_not_restorable")) {
    return "membership_state_conflict";
  }
  return "permission_missing";
}

function getArchiveDenialStatus(denialReason: ReturnType<typeof getArchiveDenialReason>) {
  if (denialReason === "target_membership_missing") return 404;
  if (denialReason.endsWith("protected") || denialReason === "membership_state_conflict") {
    return 409;
  }
  return 403;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}
