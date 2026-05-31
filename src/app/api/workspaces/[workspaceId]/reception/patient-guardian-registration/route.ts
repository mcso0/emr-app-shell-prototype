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
  createSupabaseReceptionPatientGuardianRegistrationGateway,
  registerReceptionPatientGuardian,
  type SupabaseReceptionPatientGuardianRegistrationRpcClient,
} from "@/features/reception/server-patient-guardian-registration";
import type { ReceptionPatientGuardianRegistrationInput } from "@/features/reception/patient-guardian-registration";
import { enforceWorkspaceMutationRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    workspaceId: string;
  }>;
};

export async function POST(request: Request, { params }: RouteContext) {
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
      { status: 401 }
    );
  }

  const rateLimitResponse = enforceWorkspaceMutationRateLimit({
    request,
    actorUserId: identity.actorUserId,
    workspaceId,
    operation: "reception_patient_guardian_registration_create",
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
  const result = await registerReceptionPatientGuardian({
    actorUserId: identity.actorUserId,
    workspaceId,
    input,
    permissionAdapter,
    gateway: client
      ? createSupabaseReceptionPatientGuardianRegistrationGateway(
          client as unknown as SupabaseReceptionPatientGuardianRegistrationRpcClient
        )
      : undefined,
  });

  return Response.json(result, { status: result.status });
}

async function readJsonBody(request: Request): Promise<ReceptionPatientGuardianRegistrationInput> {
  try {
    const value = (await request.json()) as unknown;
    return value && typeof value === "object"
      ? value as ReceptionPatientGuardianRegistrationInput
      : { mode: "new_guardian_patient", patient: {} };
  } catch {
    return { mode: "new_guardian_patient", patient: {} };
  }
}
