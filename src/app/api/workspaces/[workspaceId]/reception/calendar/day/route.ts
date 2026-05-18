import { readServerSession } from "@/features/auth/server-session-reader";
import {
  demoSessionUserIdHeader,
  resolveRoleUpdateActorIdentity,
} from "@/features/auth/server-role-update-identity";
import {
  createSupabaseReceptionCalendarReadGateway,
  readReceptionDayCalendar,
  type SupabaseReceptionCalendarReadRpcClient,
} from "@/features/reception/server-reception-calendar-read";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    workspaceId: string;
  }>;
};

const defaultReceptionCalendarDate = "2026-05-01";

export async function GET(request: Request, { params }: RouteContext) {
  const { workspaceId } = await params;
  const url = new URL(request.url);
  const date = url.searchParams.get("date") ?? defaultReceptionCalendarDate;
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

  const client = identity.source === "supabase_session" ? await createClient() : null;
  const result = await readReceptionDayCalendar({
    actorUserId: identity.actorUserId,
    date,
    workspaceId,
    gateway: client
      ? createSupabaseReceptionCalendarReadGateway(
          client as unknown as SupabaseReceptionCalendarReadRpcClient
        )
      : undefined,
  });

  return Response.json(result, { status: result.status });
}
