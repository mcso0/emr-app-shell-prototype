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
  createSupabaseReceptionEncounterVitalGateway,
  readReceptionEncounterVital,
  type SupabaseReceptionEncounterVitalClient,
} from "@/features/reception/server-encounter-vital";
import {
  createSupabaseWorkspaceVitalSettingsGateway,
  type SupabaseWorkspaceVitalSettingsClient,
} from "@/features/hospital-admin/vital-settings/server-workspace-vital-settings-core";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    encounterId: string;
    workspaceId: string;
  }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const { encounterId, workspaceId } = await params;
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

  const client = identity.source === "supabase_session" ? await createClient() : null;
  if (!client) {
    return Response.json(
      { ok: false, error: "supabase_client_missing" },
      { status: 500 },
    );
  }

  const permissionAdapter = await loadWorkspacePermissionAdapterFromDb({
    gateway: createSupabaseWorkspacePermissionGateway(
      client as unknown as SupabaseWorkspacePermissionClient,
    ),
    sessionUserId: identity.actorUserId,
    workspaceId,
  });
  const result = await readReceptionEncounterVital({
    actorUserId: identity.actorUserId,
    encounterId,
    gateway: createSupabaseReceptionEncounterVitalGateway(
      client as unknown as SupabaseReceptionEncounterVitalClient,
    ),
    permissionAdapter,
    settingsGateway: createSupabaseWorkspaceVitalSettingsGateway(
      client as unknown as SupabaseWorkspaceVitalSettingsClient,
    ),
    workspaceId,
  });

  return Response.json(result, { status: result.status });
}
