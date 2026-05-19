import { readServerSession } from "@/features/auth/server-session-reader";
import {
  demoSessionUserIdHeader,
  resolveRoleUpdateActorIdentity,
} from "@/features/auth/server-role-update-identity";
import {
  createSupabaseLiveAuditReviewGateway,
  readLiveAuditReviewEvents,
  type SupabaseLiveAuditReviewRpcClient,
} from "@/features/audit/server-audit-event-review";
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
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const filter = {
    eventType: url.searchParams.get("eventType"),
    limit: Number(url.searchParams.get("limit") ?? 50),
    query: url.searchParams.get("query"),
  };

  if (identity.source === "supabase_session") {
    const client = await createClient();
    if (!client) {
      return Response.json(
        { ok: false, status: 500, error: "supabase_client_missing" },
        { status: 500 }
      );
    }

    const gateway = createSupabaseLiveAuditReviewGateway(
      client as unknown as SupabaseLiveAuditReviewRpcClient
    );
    const result = await gateway.listEvents({
      workspaceId,
      eventType: filter.eventType as never,
      limit: Number.isFinite(filter.limit) ? filter.limit : 50,
      query: filter.query,
    });

    if (!result.ok) {
      return Response.json({ ok: false, error: "db_read_failed" }, { status: 500 });
    }

    return Response.json(
      {
        ok: true,
        status: 200,
        events: result.events,
        enforcedBy: "live-audit-review-reader",
      },
      { status: 200 }
    );
  }

  const result = await readLiveAuditReviewEvents({
    actorUserId: identity.actorUserId,
    workspaceId,
    filter,
  });

  return Response.json(result, { status: result.status });
}
