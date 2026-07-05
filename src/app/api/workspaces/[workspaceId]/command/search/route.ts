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
  type SupabaseReceptionPatientGuardianLookupRpcClient,
} from "@/features/reception/server-patient-guardian-lookup";
import {
  createSupabaseReceptionQueueReadGateway,
  type SupabaseReceptionQueueReadRpcClient,
} from "@/features/reception/server-reception-queue-read";
import {
  createSupabaseWorkspaceStaffReadGateway,
  type SupabaseWorkspaceStaffClient,
} from "@/features/staff/server-workspace-staff";
import { searchCommand } from "@/features/command/server-command-search";
import { getWorkspaceOperatingDate } from "@/lib/emr-domain/demo-date";
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
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("query") ?? "";
  const filter = url.searchParams.get("filter");
  const client = identity.source === "supabase_session" ? await createClient() : null;
  const permissionAdapter = client
    ? await loadWorkspacePermissionAdapterFromDb({
        gateway: createSupabaseWorkspacePermissionGateway(
          client as unknown as SupabaseWorkspacePermissionClient,
        ),
        workspaceId,
        sessionUserId: identity.actorUserId,
      })
    : undefined;
  const result = await searchCommand({
    actorUserId: identity.actorUserId,
    date: getWorkspaceOperatingDate(workspaceId),
    filter,
    patientGuardianGateway: client
      ? createSupabaseReceptionPatientGuardianLookupGateway(
          client as unknown as SupabaseReceptionPatientGuardianLookupRpcClient,
        )
      : undefined,
    permissionAdapter,
    query,
    receptionQueueGateway: client
      ? createSupabaseReceptionQueueReadGateway(
          client as unknown as SupabaseReceptionQueueReadRpcClient,
        )
      : undefined,
    staffGateway: client
      ? createSupabaseWorkspaceStaffReadGateway(
          client as unknown as SupabaseWorkspaceStaffClient,
        )
      : undefined,
    workspaceId,
  });

  return Response.json(result, { status: result.status });
}
