import { readServerSession } from "@/features/auth/server-session-reader";
import {
  demoSessionUserIdHeader,
  resolveRoleUpdateActorIdentity,
} from "@/features/auth/server-role-update-identity";
import {
  updateCustomerArchiveState,
  type CustomerArchiveActionInput,
} from "@/features/customer/server-customer-archive";
import { enforceWorkspaceMutationRateLimit } from "@/lib/security/rate-limit";

type RouteContext = {
  params: Promise<{
    patientId: string;
    workspaceId: string;
  }>;
};

export async function PATCH(request: Request, { params }: RouteContext) {
  const { patientId, workspaceId } = await params;
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
    operation: "customer_patient_archive_update",
  });
  if (rateLimitResponse) return rateLimitResponse;

  const result = await updateCustomerArchiveState({
    actorUserId: identity.actorUserId,
    workspaceId,
    target: "patient",
    targetId: patientId,
    input: await readJsonBody(request),
  });

  return Response.json(result, { status: result.status });
}

async function readJsonBody(request: Request): Promise<CustomerArchiveActionInput> {
  try {
    const value = (await request.json()) as unknown;
    return value && typeof value === "object" ? (value as CustomerArchiveActionInput) : { action: "soft_delete" };
  } catch {
    return { action: "soft_delete" };
  }
}
