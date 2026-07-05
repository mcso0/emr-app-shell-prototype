import { restoreLiveNotification } from "@/features/notifications/server-notifications";
import { restorePersistedLiveNotification } from "@/features/notifications/server-notification-persistence";
import { resolveNotificationRouteActor } from "@/features/notifications/server-notifications-route";

type RouteContext = {
  params: Promise<{
    notificationId: string;
    workspaceId: string;
  }>;
};

export async function POST(request: Request, { params }: RouteContext) {
  const { notificationId, workspaceId } = await params;
  const actor = await resolveNotificationRouteActor({ request, workspaceId });

  if (!actor.ok) return actor.response;

  if (actor.notificationPersistenceGateway) {
    const result = await restorePersistedLiveNotification({
      actorUserId: actor.actorUserId,
      eventScopeId: actor.eventScopeId,
      gateway: actor.notificationPersistenceGateway,
      notificationId,
      permissionAdapter: actor.permissionAdapter,
      stateScopeId: actor.stateScopeId,
      workspaceId,
    });

    return Response.json(result, { status: result.status });
  }

  const result = await restoreLiveNotification({
    actorUserId: actor.actorUserId,
    eventScopeId: actor.eventScopeId,
    notificationId,
    permissionAdapter: actor.permissionAdapter,
    stateScopeId: actor.stateScopeId,
    workspaceId,
  });

  return Response.json(result, { status: result.status });
}
