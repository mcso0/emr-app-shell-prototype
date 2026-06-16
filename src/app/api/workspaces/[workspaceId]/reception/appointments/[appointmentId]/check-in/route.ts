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
  createReceptionAppointmentCheckIn,
  createSupabaseReceptionAppointmentCheckInGateway,
  type SupabaseReceptionAppointmentCheckInRpcClient,
} from "@/features/reception/server-appointment-check-in";
import {
  createSupabaseLiveAuditAppendGateway,
  type SupabaseLiveAuditAppendRpcClient,
} from "@/features/audit/server-audit-log-persistence";
import { getAuditRequestId } from "@/features/audit/server-mutation-audit";
import type { ReceptionAppointmentCheckInInput } from "@/features/reception/appointment-check-in";
import { enforceWorkspaceMutationRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    appointmentId: string;
    workspaceId: string;
  }>;
};

export async function POST(request: Request, { params }: RouteContext) {
  const { appointmentId, workspaceId } = await params;
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
    operation: "reception_appointment_check_in",
  });
  if (rateLimitResponse) return rateLimitResponse;

  const input = await readJsonBody(request);
  const client = identity.source === "supabase_session" ? await createClient() : null;
  const permissionAdapter = client
    ? await loadWorkspacePermissionAdapterFromDb({
        gateway: createSupabaseWorkspacePermissionGateway(
          client as unknown as SupabaseWorkspacePermissionClient
        ),
        workspaceId,
        sessionUserId: identity.actorUserId,
      })
    : undefined;
  const result = await createReceptionAppointmentCheckIn({
    actorUserId: identity.actorUserId,
    appointmentId,
    input,
    workspaceId,
    permissionAdapter,
    gateway: client
      ? createSupabaseReceptionAppointmentCheckInGateway(
          client as unknown as SupabaseReceptionAppointmentCheckInRpcClient
        )
      : undefined,
    auditGateway: client
      ? createSupabaseLiveAuditAppendGateway(
          client as unknown as SupabaseLiveAuditAppendRpcClient
        )
      : undefined,
    auditRequestId: getAuditRequestId(request),
  });

  return Response.json(result, { status: result.status });
}

async function readJsonBody(request: Request): Promise<ReceptionAppointmentCheckInInput | undefined> {
  try {
    const value = (await request.json()) as unknown;
    return value && typeof value === "object"
      ? (value as ReceptionAppointmentCheckInInput)
      : undefined;
  } catch {
    return undefined;
  }
}
