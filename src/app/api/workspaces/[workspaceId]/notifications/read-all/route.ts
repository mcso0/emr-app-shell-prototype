import { markAllLiveNotificationsRead } from "@/features/notifications/server-notifications";
import { markAllPersistedLiveNotificationsRead } from "@/features/notifications/server-notification-persistence";
import { resolveNotificationRouteActor } from "@/features/notifications/server-notifications-route";

type RouteContext = {
  params: Promise<{
    workspaceId: string;
  }>;
};

export async function POST(request: Request, { params }: RouteContext) {
  const { workspaceId } = await params;
  const actor = await resolveNotificationRouteActor({ request, workspaceId });

  if (!actor.ok) return actor.response;

  if (actor.notificationPersistenceGateway) {
    const result = await markAllPersistedLiveNotificationsRead({
      actorUserId: actor.actorUserId,
      eventScopeId: actor.eventScopeId,
      gateway: actor.notificationPersistenceGateway,
      permissionAdapter: actor.permissionAdapter,
      stateScopeId: actor.stateScopeId,
      workspaceId,
    });

    return Response.json(result, { status: result.status });
  }

  const result = await markAllLiveNotificationsRead({
    actorUserId: actor.actorUserId,
    eventScopeId: actor.eventScopeId,
    permissionAdapter: actor.permissionAdapter,
    stateScopeId: actor.stateScopeId,
    workspaceId,
  });

  return Response.json(result, { status: result.status });
}
