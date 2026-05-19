import { readServerSession } from "@/features/auth/server-session-reader";
import {
  demoSessionUserIdHeader,
  resolveRoleUpdateActorIdentity,
} from "@/features/auth/server-role-update-identity";
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

  const client = identity.source === "supabase_session" ? await createClient() : null;
  const result = await createReceptionAppointmentCheckIn({
    actorUserId: identity.actorUserId,
    appointmentId,
    workspaceId,
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
