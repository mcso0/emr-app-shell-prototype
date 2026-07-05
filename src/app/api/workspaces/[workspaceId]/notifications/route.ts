import { readLiveNotifications } from "@/features/notifications/server-notifications";
import { readPersistedLiveNotifications } from "@/features/notifications/server-notification-persistence";
import { resolveNotificationRouteActor } from "@/features/notifications/server-notifications-route";

type RouteContext = {
  params: Promise<{
    workspaceId: string;
  }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const { workspaceId } = await params;
  const actor = await resolveNotificationRouteActor({ request, workspaceId });

  if (!actor.ok) return actor.response;

  const url = new URL(request.url);
  if (actor.notificationPersistenceGateway) {
    const result = await readPersistedLiveNotifications({
      actorUserId: actor.actorUserId,
      eventScopeId: actor.eventScopeId,
      filter: url.searchParams.get("filter"),
      gateway: actor.notificationPersistenceGateway,
      limit: Number(url.searchParams.get("limit") ?? 20),
      permissionAdapter: actor.permissionAdapter,
      stateScopeId: actor.stateScopeId,
      workspaceId,
    });

    return Response.json(result, { status: result.status });
  }

  const result = await readLiveNotifications({
    actorUserId: actor.actorUserId,
    eventScopeId: actor.eventScopeId,
    filter: url.searchParams.get("filter"),
    limit: Number(url.searchParams.get("limit") ?? 20),
    permissionAdapter: actor.permissionAdapter,
    stateScopeId: actor.stateScopeId,
    workspaceId,
  });

  return Response.json(result, { status: result.status });
}
