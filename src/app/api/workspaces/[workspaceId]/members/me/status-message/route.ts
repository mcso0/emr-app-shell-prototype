import { loadWorkspacePermissionAdapterFromDb } from "@/features/auth/db-workspace-permission-adapter";
import { readServerSession } from "@/features/auth/server-session-reader";
import {
  demoSessionUserIdHeader,
  resolveRoleUpdateActorIdentity,
} from "@/features/auth/server-role-update-identity";
import {
  createSupabaseWorkspacePermissionGateway,
  type SupabaseWorkspacePermissionClient,
} from "@/features/auth/supabase-workspace-permission-gateway";
import {
  createSupabaseWorkspaceStatusMessageGateway,
  updateWorkspaceStatusMessage,
  type SupabaseWorkspaceStatusMessageClient,
} from "@/features/staff/server-workspace-status-message";
import { createClient } from "@/lib/supabase/server";

const maxRequestBytes = 1_024;

type RouteContext = {
  params: Promise<{ workspaceId: string }>;
};

export async function PATCH(request: Request, { params }: RouteContext) {
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
        sessionReason: identity.sessionReason,
        sessionStatus: identity.sessionStatus,
      },
      { status: 401 },
    );
  }
  if (identity.source !== "supabase_session") {
    return Response.json(
      { ok: false, status: 503, error: "configured_data_source_required" },
      { status: 503 },
    );
  }

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    return Response.json(
      { ok: false, status: 415, error: "unsupported_media_type" },
      { status: 415 },
    );
  }
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxRequestBytes) {
    return Response.json(
      { ok: false, status: 413, error: "request_too_large" },
      { status: 413 },
    );
  }
  const rawBody = await request.text().catch(() => null);
  if (
    rawBody === null ||
    new TextEncoder().encode(rawBody).byteLength > maxRequestBytes
  ) {
    return Response.json(
      { ok: false, status: 413, error: "request_too_large" },
      { status: 413 },
    );
  }
  const payload = parsePatchPayload(rawBody);
  if (!payload) {
    return Response.json(
      { ok: false, status: 400, error: "invalid_request" },
      { status: 400 },
    );
  }

  const client = await createClient();
  if (!client) {
    return Response.json(
      { ok: false, status: 500, error: "supabase_client_missing" },
      { status: 500 },
    );
  }
  const permissionAdapter = await loadWorkspacePermissionAdapterFromDb({
    gateway: createSupabaseWorkspacePermissionGateway(
      client as unknown as SupabaseWorkspacePermissionClient,
    ),
    sessionUserId: identity.actorUserId,
    workspaceId,
  }).catch(() => null);
  if (!permissionAdapter) {
    return Response.json(
      { ok: false, status: 500, error: "db_read_failed" },
      { status: 500 },
    );
  }

  const result = await updateWorkspaceStatusMessage({
    actorUserId: identity.actorUserId,
    expectedUpdatedAt: payload.expectedUpdatedAt,
    gateway: createSupabaseWorkspaceStatusMessageGateway(
      client as unknown as SupabaseWorkspaceStatusMessageClient,
    ),
    message: payload.message,
    permissionAdapter,
    workspaceId,
  });
  return Response.json(result, { status: result.status });
}

function parsePatchPayload(rawBody: string) {
  try {
    const value = JSON.parse(rawBody) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value))
      return null;
    const payload = value as Record<string, unknown>;
    if (typeof payload.message !== "string") return null;
    if (
      payload.expectedUpdatedAt !== null &&
      typeof payload.expectedUpdatedAt !== "string"
    ) {
      return null;
    }
    return {
      expectedUpdatedAt: payload.expectedUpdatedAt as string | null,
      message: payload.message,
    };
  } catch {
    return null;
  }
}
