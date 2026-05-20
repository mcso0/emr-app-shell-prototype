import { readServerSession } from "@/features/auth/server-session-reader";
import {
  demoSessionUserIdHeader,
  resolveRoleUpdateActorIdentity,
} from "@/features/auth/server-role-update-identity";
import { listCustomerArchiveRecords, type CustomerArchiveStatus } from "@/features/customer/server-customer-archive";

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
  const status = normalizeStatus(url.searchParams.get("status"));
  const result = await listCustomerArchiveRecords({
    actorUserId: identity.actorUserId,
    workspaceId,
    status,
  });

  return Response.json(result, { status: result.status });
}

function normalizeStatus(value: string | null): CustomerArchiveStatus | undefined {
  return value === "active" || value === "soft_deleted" ? value : undefined;
}
