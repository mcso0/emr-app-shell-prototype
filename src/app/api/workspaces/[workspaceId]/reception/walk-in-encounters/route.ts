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
  createReceptionWalkInEncounter,
  createSupabaseReceptionWalkInEncounterGateway,
  type SupabaseReceptionWalkInEncounterRpcClient,
} from "@/features/reception/server-walk-in-encounter";
import {
  createSupabaseLiveAuditAppendGateway,
  type SupabaseLiveAuditAppendRpcClient,
} from "@/features/audit/server-audit-log-persistence";
import { getAuditRequestId } from "@/features/audit/server-mutation-audit";
import type { ReceptionWalkInEncounterInput } from "@/features/reception/walk-in-encounter";
import { enforceWorkspaceMutationRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";
import {
  createSupabaseWorkspaceVitalSettingsGateway,
  type SupabaseWorkspaceVitalSettingsClient,
} from "@/features/hospital-admin/vital-settings/server-workspace-vital-settings-core";

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
    operation: "reception_walk_in_encounter_create",
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
  const vitalSettingsResult = client
    ? await createSupabaseWorkspaceVitalSettingsGateway(
        client as unknown as SupabaseWorkspaceVitalSettingsClient,
      ).get(workspaceId)
    : null;
  if (vitalSettingsResult && !vitalSettingsResult.ok) {
    return Response.json({ ok: false, error: "db_read_failed" }, { status: 500 });
  }
  const result = await createReceptionWalkInEncounter({
    actorUserId: identity.actorUserId,
    workspaceId,
    input,
    vitalSettings: vitalSettingsResult?.ok ? vitalSettingsResult.snapshot : undefined,
    permissionAdapter,
    gateway: client
      ? createSupabaseReceptionWalkInEncounterGateway(
          client as unknown as SupabaseReceptionWalkInEncounterRpcClient
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

async function readJsonBody(request: Request): Promise<ReceptionWalkInEncounterInput> {
  try {
    const value = (await request.json()) as unknown;
    return value && typeof value === "object"
      ? value as ReceptionWalkInEncounterInput
      : { patientId: "" };
  } catch {
    return { patientId: "" };
  }
}
