import { readLiveNotificationCounts } from "@/features/notifications/server-notifications";
import { readPersistedLiveNotificationCounts } from "@/features/notifications/server-notification-persistence";
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

  if (actor.notificationPersistenceGateway) {
    const result = await readPersistedLiveNotificationCounts({
      actorUserId: actor.actorUserId,
      eventScopeId: actor.eventScopeId,
      gateway: actor.notificationPersistenceGateway,
      permissionAdapter: actor.permissionAdapter,
      stateScopeId: actor.stateScopeId,
      workspaceId,
    });

    if (!result.ok) return Response.json(result, { status: result.status });

    return Response.json(result, { status: 200 });
  }

  const result = await readLiveNotificationCounts({
    actorUserId: actor.actorUserId,
    eventScopeId: actor.eventScopeId,
    permissionAdapter: actor.permissionAdapter,
    stateScopeId: actor.stateScopeId,
    workspaceId,
  });

  if (!result.ok) {
    return Response.json(result, { status: result.status });
  }

  return Response.json(
    {
      ok: true,
      status: 200,
      workspaceId,
      counts: result.counts,
      enforcedBy: result.enforcedBy,
    },
    { status: 200 },
  );
}
