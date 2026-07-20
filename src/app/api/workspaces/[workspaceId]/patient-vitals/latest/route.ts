import { loadWorkspacePermissionAdapterFromDb } from "@/features/auth/db-workspace-permission-adapter";
import { readServerSession } from "@/features/auth/server-session-reader";
import {
  demoSessionUserIdHeader,
  resolveRoleUpdateActorIdentity,
} from "@/features/auth/server-role-update-identity";
import {
  createSupabaseWorkspacePermissionGateway,
  type SupabaseWorkspacePermissionClient,
} from "@/features/auth/supabase-workspace-permission-gateway";
import {
  createSupabasePatientLatestVitalGateway,
  readPatientLatestVital,
  type SupabasePatientVitalClient,
} from "@/features/patient-vitals/server-patient-vital";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ workspaceId: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const { workspaceId } = await params;
  const identity = resolveRoleUpdateActorIdentity({
    serverSession: await readServerSession(),
    demoHeaderUserId: request.headers.get(demoSessionUserIdHeader),
  });
  if (!identity.ok) {
    return Response.json(
      {
        ok: false,
        denialReason: identity.denialReason,
        sessionReason: identity.sessionReason,
        sessionStatus: identity.sessionStatus,
      },
      { status: 401 },
    );
  }

  const encounterId = new URL(request.url).searchParams.get("encounterId")?.trim();
  if (!encounterId) {
    return Response.json({ ok: false, error: "encounter_unavailable" }, { status: 404 });
  }

  const client = identity.source === "supabase_session" ? await createClient() : null;
  if (!client) {
    return Response.json({ ok: false, error: "supabase_client_missing" }, { status: 500 });
  }

  const permissionAdapter = await loadWorkspacePermissionAdapterFromDb({
    gateway: createSupabaseWorkspacePermissionGateway(
      client as unknown as SupabaseWorkspacePermissionClient,
    ),
    sessionUserId: identity.actorUserId,
    workspaceId,
  });
  const result = await readPatientLatestVital({
    actorUserId: identity.actorUserId,
    encounterId,
    gateway: createSupabasePatientLatestVitalGateway(client as unknown as SupabasePatientVitalClient),
    permissionAdapter,
    workspaceId,
  });

  return Response.json(result, { status: result.status });
}
