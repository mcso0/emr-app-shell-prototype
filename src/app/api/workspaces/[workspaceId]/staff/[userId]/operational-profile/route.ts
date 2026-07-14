import { loadWorkspacePermissionAdapterFromDb } from "@/features/auth/db-workspace-permission-adapter";
import { readServerSession } from "@/features/auth/server-session-reader";
import {
  demoSessionUserIdHeader,
  resolveRoleUpdateActorIdentity,
} from "@/features/auth/server-role-update-identity";
import {
  createSupabaseStaffOperationalProfileGateway,
  readStaffOperationalProfile,
  type SupabaseStaffOperationalProfileClient,
} from "@/features/staff/server-operational-profile";
import {
  createSupabaseWorkspacePermissionGateway,
  type SupabaseWorkspacePermissionClient,
} from "@/features/auth/supabase-workspace-permission-gateway";
import { isIsoOperatingDate } from "@/lib/emr-domain/demo-date";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ userId: string; workspaceId: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const { userId, workspaceId } = await params;
  const url = new URL(request.url);
  const date = url.searchParams.get("date");

  if (!date || !isIsoOperatingDate(date)) {
    return Response.json(
      { ok: false, status: 400, error: "invalid_date" },
      { status: 400 },
    );
  }
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

  const client =
    identity.source === "supabase_session" ? await createClient() : null;
  if (identity.source === "supabase_session" && !client) {
    return Response.json(
      { ok: false, status: 500, error: "supabase_client_missing" },
      { status: 500 },
    );
  }

  const permissionAdapter = client
    ? await loadWorkspacePermissionAdapterFromDb({
        gateway: createSupabaseWorkspacePermissionGateway(
          client as unknown as SupabaseWorkspacePermissionClient,
        ),
        workspaceId,
        sessionUserId: identity.actorUserId,
      }).catch(() => undefined)
    : undefined;
  if (client && !permissionAdapter) {
    return Response.json(
      { ok: false, status: 500, error: "db_read_failed" },
      { status: 500 },
    );
  }

  const result = await readStaffOperationalProfile({
    actorUserId: identity.actorUserId,
    date,
    gateway: client
      ? createSupabaseStaffOperationalProfileGateway(
          client as unknown as SupabaseStaffOperationalProfileClient,
        )
      : undefined,
    permissionAdapter,
    userId,
    workspaceId,
  });

  return Response.json(result, { status: result.status });
}
