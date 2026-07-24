import { readServerSession } from "@/features/auth/server-session-reader";
import {
  demoSessionUserIdHeader,
  resolveRoleUpdateActorIdentity,
} from "@/features/auth/server-role-update-identity";
import {
  createSupabaseWorkspaceCreationGateway,
  createWorkspaceWithCreator,
  type SupabaseWorkspaceCreationRpcClient,
} from "@/features/auth/server-workspace-creation";
import {
  createSupabaseWorkspaceListGateway,
  listActorWorkspaces,
  type SupabaseWorkspaceListRpcClient,
} from "@/features/auth/server-workspace-list";
import { enforceWorkspaceMutationRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
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

  const client =
    identity.source === "supabase_session"
      ? await createClient()
      : null;
  const result = await listActorWorkspaces({
    actorUserId: identity.actorUserId,
    gateway: client
      ? createSupabaseWorkspaceListGateway(
          client as unknown as SupabaseWorkspaceListRpcClient
        )
      : undefined,
  });

  return Response.json(result, {
    status: result.status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(request: Request) {
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

  const rateLimitResponse = enforceWorkspaceMutationRateLimit({
    request,
    actorUserId: identity.actorUserId,
    workspaceId: "new",
    operation: "workspace_create",
  });
  if (rateLimitResponse) return rateLimitResponse;

  const body = await readJsonBody(request);
  const client =
    identity.source === "supabase_session"
      ? await createClient()
      : null;

  const result = await createWorkspaceWithCreator({
    actorUserId: identity.actorUserId,
    input: {
      hospitalName: getBodyString(body.hospitalName),
      adminDisplayName: getBodyString(body.adminDisplayName),
      contactEmail: getBodyString(body.contactEmail),
      contactPhone: getBodyString(body.contactPhone),
    },
    gateway: client
      ? createSupabaseWorkspaceCreationGateway(
          client as unknown as SupabaseWorkspaceCreationRpcClient
        )
      : undefined,
  });

  return Response.json(result, { status: result.status });
}

async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const value = (await request.json()) as unknown;
    return value && typeof value === "object" ? value as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function getBodyString(value: unknown) {
  return typeof value === "string" ? value : "";
}
