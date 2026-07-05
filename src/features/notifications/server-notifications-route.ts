import { loadWorkspacePermissionAdapterFromDb } from "@/features/auth/db-workspace-permission-adapter";
import { readServerSession } from "@/features/auth/server-session-reader";
import {
  demoSessionUserIdHeader,
  resolveRoleUpdateActorIdentity,
} from "@/features/auth/server-role-update-identity";
import { demoClientSessionIdHeader } from "@/features/auth/demo-actor";
import {
  createSupabaseWorkspacePermissionGateway,
  type SupabaseWorkspacePermissionClient,
} from "@/features/auth/supabase-workspace-permission-gateway";
import type { WorkspacePermissionAdapter } from "@/features/auth/permission-resolver";
import {
  createSupabaseNotificationPersistenceGateway,
  type NotificationPersistenceGateway,
  type SupabaseNotificationPersistenceRpcClient,
} from "@/features/notifications/server-notification-persistence";
import { createClient } from "@/lib/supabase/server";

export type NotificationRouteActorContext =
  | {
      ok: true;
      actorUserId: string;
      eventScopeId?: string;
      notificationPersistenceGateway?: NotificationPersistenceGateway;
      permissionAdapter?: WorkspacePermissionAdapter;
      stateScopeId?: string;
    }
  | {
      ok: false;
      response: Response;
    };

export async function resolveNotificationRouteActor({
  request,
  workspaceId,
}: {
  request: Request;
  workspaceId: string;
}): Promise<NotificationRouteActorContext> {
  const serverSession = await readServerSession();
  const identity = resolveRoleUpdateActorIdentity({
    serverSession,
    demoHeaderUserId: request.headers.get(demoSessionUserIdHeader),
  });

  if (!identity.ok) {
    return {
      ok: false,
      response: Response.json(
        {
          ok: false,
          workspaceId,
          denialReason: identity.denialReason,
          sessionStatus: identity.sessionStatus,
          sessionReason: identity.sessionReason,
        },
        { status: 401 },
      ),
    };
  }

  if (identity.source !== "supabase_session") {
    return {
      ok: true,
      actorUserId: identity.actorUserId,
      eventScopeId: getDemoNotificationEventScopeId(
        request.headers.get(demoClientSessionIdHeader),
      ),
      stateScopeId: getDemoNotificationStateScopeId({
        actorUserId: identity.actorUserId,
        clientSessionId: request.headers.get(demoClientSessionIdHeader),
      }),
    };
  }

  const client = await createClient();
  if (!client) {
    return {
      ok: false,
      response: Response.json(
        {
          ok: false,
          workspaceId,
          denialReason: "unauthenticated",
          error: {
            code: "supabase_client_missing",
            message: "알림을 볼 서버 세션을 확인할 수 없습니다.",
            retryable: true,
          },
        },
        { status: 401 },
      ),
    };
  }

  const permissionAdapter = await loadWorkspacePermissionAdapterFromDb({
    gateway: createSupabaseWorkspacePermissionGateway(
      client as unknown as SupabaseWorkspacePermissionClient,
    ),
    workspaceId,
    sessionUserId: identity.actorUserId,
  });

  return {
    ok: true,
    actorUserId: identity.actorUserId,
    notificationPersistenceGateway: createSupabaseNotificationPersistenceGateway(
      client as unknown as SupabaseNotificationPersistenceRpcClient,
    ),
    permissionAdapter,
    stateScopeId: identity.actorUserId,
  };
}

export function getDemoNotificationEventScopeId(clientSessionId: string | null) {
  if (!clientSessionId) return undefined;
  if (clientSessionId.length > 128) return undefined;
  if (!/^[a-zA-Z0-9:_-]+$/.test(clientSessionId)) return undefined;

  return clientSessionId;
}

function getDemoNotificationStateScopeId({
  actorUserId,
  clientSessionId,
}: {
  actorUserId: string;
  clientSessionId: string | null;
}) {
  if (!clientSessionId) return actorUserId;
  if (clientSessionId.length > 128) return actorUserId;
  if (!/^[a-zA-Z0-9:_-]+$/.test(clientSessionId)) return actorUserId;

  return `${actorUserId}:${clientSessionId}`;
}
