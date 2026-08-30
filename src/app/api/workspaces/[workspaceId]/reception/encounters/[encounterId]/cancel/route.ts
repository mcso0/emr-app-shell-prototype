import { readServerSession } from "@/features/auth/server-session-reader";
import {
  demoSessionUserIdHeader,
  resolveRoleUpdateActorIdentity,
} from "@/features/auth/server-role-update-identity";
import { loadWorkspacePermissionAdapterFromDb } from "@/features/auth/db-workspace-permission-adapter";
import {
  createSupabaseWorkspacePermissionGateway,
  type SupabaseWorkspacePermissionClient,
} from "@/features/auth/supabase-workspace-permission-gateway";
import {
  cancelReceptionEncounter,
  createSupabaseReceptionEncounterCancelGateway,
  type SupabaseReceptionEncounterCancelRpcClient,
} from "@/features/reception/server-encounter-cancel";
import {
  createSupabaseLiveAuditAppendGateway,
  type SupabaseLiveAuditAppendRpcClient,
} from "@/features/audit/server-audit-log-persistence";
import { getAuditRequestId } from "@/features/audit/server-mutation-audit";
import { enforceWorkspaceMutationRateLimit } from "@/lib/security/rate-limit";
import {
  createClient,
  normalizeSupabaseRequestId,
} from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    encounterId: string;
    workspaceId: string;
  }>;
};

type EncounterCancelRequestBody = {
  cancelReason?: string;
};

export async function POST(request: Request, context: RouteContext) {
  return handleEncounterCancel(request, context);
}

export async function PATCH(request: Request, context: RouteContext) {
  return handleEncounterCancel(request, context);
}

async function handleEncounterCancel(
  request: Request,
  { params }: RouteContext,
) {
  const { encounterId, workspaceId } = await params;
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
    operation: "reception_encounter_cancel",
  });
  if (rateLimitResponse) return rateLimitResponse;

  const input = await readJsonBody(request);
  const auditRequestId = normalizeSupabaseRequestId(getAuditRequestId(request));
  const client =
    identity.source === "supabase_session"
      ? await createClient({ requestId: auditRequestId })
      : null;
  const permissionAdapter = client
    ? await loadWorkspacePermissionAdapterFromDb({
        gateway: createSupabaseWorkspacePermissionGateway(
          client as unknown as SupabaseWorkspacePermissionClient,
        ),
        workspaceId,
        sessionUserId: identity.actorUserId,
      })
    : undefined;
  const result = await cancelReceptionEncounter({
    actorUserId: identity.actorUserId,
    cancelReason: input.cancelReason,
    encounterId,
    workspaceId,
    permissionAdapter,
    gateway: client
      ? createSupabaseReceptionEncounterCancelGateway(
          client as unknown as SupabaseReceptionEncounterCancelRpcClient,
        )
      : undefined,
    auditGateway: client
      ? createSupabaseLiveAuditAppendGateway(
          client as unknown as SupabaseLiveAuditAppendRpcClient,
        )
      : undefined,
    auditRequestId,
  });

  if (!result.ok && result.status === 500) {
    console.error("Reception encounter cancel failed", {
      operation: "reception_encounter_cancel",
      error: result.error,
    });
  }

  return Response.json(result, { status: result.status });
}

async function readJsonBody(
  request: Request,
): Promise<EncounterCancelRequestBody> {
  try {
    const value = (await request.json()) as unknown;
    return value && typeof value === "object"
      ? (value as EncounterCancelRequestBody)
      : {};
  } catch {
    return {};
  }
}
