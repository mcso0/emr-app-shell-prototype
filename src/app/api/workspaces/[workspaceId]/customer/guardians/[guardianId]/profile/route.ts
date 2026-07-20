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
  createSupabaseCustomerGuardianProfileGateway,
  readCustomerGuardianProfile,
  updateCustomerGuardianProfile,
  type CustomerGuardianProfileUpdateInput,
  type SupabaseCustomerGuardianProfileClient,
} from "@/features/customer/server-guardian-profile";
import { enforceWorkspaceMutationRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    guardianId: string;
    workspaceId: string;
  }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const { guardianId, workspaceId } = await params;
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
  const result = await readCustomerGuardianProfile({
    actorUserId: identity.actorUserId,
    workspaceId,
    guardianId,
    permissionAdapter: permissionAdapter ?? undefined,
    gateway: client
      ? createSupabaseCustomerGuardianProfileGateway(
          client as unknown as SupabaseCustomerGuardianProfileClient
        )
      : undefined,
  });

  return Response.json(result, { status: result.status });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { guardianId, workspaceId } = await params;
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
    operation: "customer_guardian_profile_update",
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
  const result = await updateCustomerGuardianProfile({
    actorUserId: identity.actorUserId,
    workspaceId,
    guardianId,
    input,
    permissionAdapter: permissionAdapter ?? undefined,
    gateway: client
      ? createSupabaseCustomerGuardianProfileGateway(
          client as unknown as SupabaseCustomerGuardianProfileClient
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

async function readJsonBody(request: Request): Promise<CustomerGuardianProfileUpdateInput> {
  try {
    const value = (await request.json()) as unknown;
    return value && typeof value === "object" ? (value as CustomerGuardianProfileUpdateInput) : {};
  } catch {
    return {};
  }
}
