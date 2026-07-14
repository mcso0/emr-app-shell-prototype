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
  createSupabaseReceptionPatientGuardianLookupGateway,
  lookupReceptionPatientGuardians,
  type SupabaseReceptionPatientGuardianLookupRpcClient,
} from "@/features/reception/server-patient-guardian-lookup";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    workspaceId: string;
  }>;
};

export async function GET(request: Request, { params }: RouteContext) {
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

  const searchParams = new URL(request.url).searchParams;
  const query = searchParams.get("query") ?? "";
  const allowSyntheticAliases = searchParams.get("syntheticAliases") !== "false";
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
  const result = await lookupReceptionPatientGuardians({
    actorUserId: identity.actorUserId,
    allowSyntheticAliases,
    workspaceId,
    query,
    permissionAdapter,
    gateway: client
      ? createSupabaseReceptionPatientGuardianLookupGateway(
          client as unknown as SupabaseReceptionPatientGuardianLookupRpcClient
        )
      : undefined,
  });

  return Response.json(result, { status: result.status });
}
