import { readServerSession } from "@/features/auth/server-session-reader";
import { demoClientSessionIdHeader } from "@/features/auth/demo-actor";
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
  createSupabaseNotificationPersistenceGateway,
  type SupabaseNotificationPersistenceRpcClient,
} from "@/features/notifications/server-notification-persistence";
import {
  createSupabaseReceptionCalendarReadGateway,
  type SupabaseReceptionCalendarReadRpcClient,
} from "@/features/reception/server-reception-calendar-read";
import {
  createSupabaseReceptionQueueReadGateway,
  type SupabaseReceptionQueueReadRpcClient,
} from "@/features/reception/server-reception-queue-read";
import { readReceptionSnapshot } from "@/features/reception/server-reception-snapshot-read";
import { getWorkspaceOperatingDate } from "@/lib/emr-domain/demo-date";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    workspaceId: string;
  }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const { workspaceId } = await params;
  const url = new URL(request.url);
  const date = url.searchParams.get("date") ?? getWorkspaceOperatingDate(workspaceId);
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
  const result = await readReceptionSnapshot({
    actorUserId: identity.actorUserId,
    calendarGateway: client
      ? createSupabaseReceptionCalendarReadGateway(
          client as unknown as SupabaseReceptionCalendarReadRpcClient,
        )
      : undefined,
    date,
    emitWaitingNotifications: true,
    notificationEventScopeId:
      identity.source === "demo_header_mock_mode"
        ? request.headers.get(demoClientSessionIdHeader)
        : null,
    notificationPersistenceGateway: client
      ? createSupabaseNotificationPersistenceGateway(
          client as unknown as SupabaseNotificationPersistenceRpcClient,
        )
      : undefined,
    permissionAdapter,
    queueGateway: client
      ? createSupabaseReceptionQueueReadGateway(
          client as unknown as SupabaseReceptionQueueReadRpcClient,
        )
      : undefined,
    workspaceId,
  });

  return Response.json(result, { status: result.status });
}
