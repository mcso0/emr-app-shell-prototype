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
  createSupabaseCustomerPatientProfileGateway,
  readCustomerPatientProfile,
  updateCustomerPatientProfile,
  type CustomerPatientProfileUpdateInput,
  type SupabaseCustomerPatientProfileClient,
} from "@/features/customer/server-patient-profile";
import { enforceWorkspaceMutationRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    patientId: string;
    workspaceId: string;
  }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const { patientId, workspaceId } = await params;
  const identity = await getIdentity(request);
  if (!identity.ok) return identity.response;
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
  if (client && !permissionAdapter) return databasePermissionReadError();

  const result = await readCustomerPatientProfile({
    actorUserId: identity.actorUserId,
    workspaceId,
    patientId,
    permissionAdapter: permissionAdapter ?? undefined,
    gateway: client
      ? createSupabaseCustomerPatientProfileGateway(
          client as unknown as SupabaseCustomerPatientProfileClient,
        )
      : undefined,
  });

  return Response.json(result, { status: result.status });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { patientId, workspaceId } = await params;
  const identity = await getIdentity(request);
  if (!identity.ok) return identity.response;

  const rateLimitResponse = enforceWorkspaceMutationRateLimit({
    request,
    actorUserId: identity.actorUserId,
    workspaceId,
    operation: "customer_patient_profile_update",
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
  if (client && !permissionAdapter) return databasePermissionReadError();
  const result = await updateCustomerPatientProfile({
    actorUserId: identity.actorUserId,
    workspaceId,
    patientId,
    input,
    permissionAdapter: permissionAdapter ?? undefined,
    gateway: client
      ? createSupabaseCustomerPatientProfileGateway(
          client as unknown as SupabaseCustomerPatientProfileClient,
        )
      : undefined,
  });

  return Response.json(result, { status: result.status });
}

function databasePermissionReadError() {
  return Response.json(
    { ok: false, status: 500, error: "db_read_failed" },
    { status: 500 },
  );
}

async function getIdentity(request: Request) {
  const serverSession = await readServerSession();
  const identity = resolveRoleUpdateActorIdentity({
    serverSession,
    demoHeaderUserId: request.headers.get(demoSessionUserIdHeader),
  });

  if (identity.ok) return identity;

  return {
    ok: false as const,
    response: Response.json(
      {
        ok: false,
        denialReason: identity.denialReason,
        sessionStatus: identity.sessionStatus,
        sessionReason: identity.sessionReason,
      },
      { status: 401 }
    ),
  };
}

async function readJsonBody(request: Request): Promise<CustomerPatientProfileUpdateInput> {
  try {
    const value = (await request.json()) as unknown;
    return value && typeof value === "object" ? (value as CustomerPatientProfileUpdateInput) : {};
  } catch {
    return {};
  }
}
