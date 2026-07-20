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
  createSupabaseCustomerRelationshipGateway,
  updateCustomerPatientGuardianRelationship,
  type CustomerRelationshipActionInput,
  type SupabaseCustomerRelationshipClient,
} from "@/features/customer/server-patient-guardian-relationship";
import { enforceWorkspaceMutationRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ workspaceId: string }>;
};

export async function PATCH(request: Request, { params }: RouteContext) {
  const { workspaceId } = await params;
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
    operation: "customer_patient_guardian_relationship_update",
  });
  if (rateLimitResponse) return rateLimitResponse;

  const input = await readJsonBody(request);
  const client = identity.source === "supabase_session" ? await createClient() : null;
  const permissionAdapter = client
    ? await loadWorkspacePermissionAdapterFromDb({
        gateway: createSupabaseWorkspacePermissionGateway(
          client as unknown as SupabaseWorkspacePermissionClient,
        ),
        sessionUserId: identity.actorUserId,
        workspaceId,
      }).catch(() => null)
    : undefined;
  if (client && !permissionAdapter) {
    return Response.json(
      { ok: false, status: 500, error: "db_read_failed" },
      { status: 500 },
    );
  }
  const result = await updateCustomerPatientGuardianRelationship({
    actorUserId: identity.actorUserId,
    input,
    permissionAdapter: permissionAdapter ?? undefined,
    workspaceId,
    gateway: client
      ? createSupabaseCustomerRelationshipGateway(
          client as unknown as SupabaseCustomerRelationshipClient,
        )
      : undefined,
  });

  return Response.json(result, { status: result.status });
}

async function readJsonBody(request: Request): Promise<CustomerRelationshipActionInput> {
  try {
    const value = (await request.json()) as CustomerRelationshipActionInput;
    return value;
  } catch {
    return { action: "set_primary", guardianId: "", patientId: "" };
  }
}
