import { randomUUID } from "node:crypto";

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
  createSupabaseProfileAvatarGateway,
  discardProfileAvatarUpload,
  finalizeProfileAvatarUpload,
  prepareProfileAvatarUpload,
  removeProfileAvatar,
  type SupabaseProfileAvatarClient,
} from "@/features/staff/server-profile-avatar";
import { enforceWorkspaceMutationRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const maxRequestBytes = 2_048;

type PostPayload =
  | { action: "prepare"; workspaceId: string }
  | {
      action: "finalize";
      workspaceId: string;
      uploadId: string;
      declaredMime: string;
    }
  | { action: "discard"; workspaceId: string; uploadId: string };

export async function POST(request: Request) {
  const identity = await readAvatarIdentity(request);
  if (identity instanceof Response) return identity;

  const body = await readBoundedJsonBody(request);
  if (body instanceof Response) return body;
  const payload = parsePostPayload(body);
  if (!payload) return invalidRequest();

  const rateLimitResponse = enforceWorkspaceMutationRateLimit({
    request,
    actorUserId: identity.actorUserId,
    workspaceId: payload.workspaceId,
    operation: `profile_avatar_${payload.action}`,
  });
  if (rateLimitResponse) return rateLimitResponse;

  const context = await loadAvatarContext(
    identity.actorUserId,
    payload.workspaceId,
  );
  if (context instanceof Response) return context;

  if (payload.action === "prepare") {
    const result = await prepareProfileAvatarUpload({
      actorUserId: identity.actorUserId,
      gateway: context.gateway,
      permissionAdapter: context.permissionAdapter,
      uploadId: randomUUID(),
      workspaceId: payload.workspaceId,
    });
    return Response.json(result, { status: result.status });
  }

  if (payload.action === "finalize") {
    const result = await finalizeProfileAvatarUpload({
      actorUserId: identity.actorUserId,
      avatarId: randomUUID(),
      declaredMime: payload.declaredMime,
      gateway: context.gateway,
      permissionAdapter: context.permissionAdapter,
      uploadId: payload.uploadId,
      workspaceId: payload.workspaceId,
    });
    return Response.json(result, { status: result.status });
  }

  const result = await discardProfileAvatarUpload({
    actorUserId: identity.actorUserId,
    gateway: context.gateway,
    permissionAdapter: context.permissionAdapter,
    uploadId: payload.uploadId,
    workspaceId: payload.workspaceId,
  });
  return Response.json(result, { status: result.status });
}

export async function DELETE(request: Request) {
  const identity = await readAvatarIdentity(request);
  if (identity instanceof Response) return identity;

  const body = await readBoundedJsonBody(request);
  if (body instanceof Response) return body;
  if (
    !hasOnlyKeys(body, ["workspaceId"]) ||
    !isWorkspaceId(body.workspaceId)
  ) {
    return invalidRequest();
  }

  const workspaceId = body.workspaceId;
  const rateLimitResponse = enforceWorkspaceMutationRateLimit({
    request,
    actorUserId: identity.actorUserId,
    workspaceId,
    operation: "profile_avatar_remove",
  });
  if (rateLimitResponse) return rateLimitResponse;

  const context = await loadAvatarContext(identity.actorUserId, workspaceId);
  if (context instanceof Response) return context;
  const result = await removeProfileAvatar({
    actorUserId: identity.actorUserId,
    gateway: context.gateway,
    permissionAdapter: context.permissionAdapter,
    workspaceId,
  });
  return Response.json(result, { status: result.status });
}

async function readAvatarIdentity(request: Request) {
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
  return { actorUserId: identity.actorUserId };
}

async function loadAvatarContext(actorUserId: string, workspaceId: string) {
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
    sessionUserId: actorUserId,
    workspaceId,
  }).catch(() => null);
  if (!permissionAdapter) {
    return Response.json(
      { ok: false, status: 500, error: "db_read_failed" },
      { status: 500 },
    );
  }
  return {
    gateway: createSupabaseProfileAvatarGateway(
      client as unknown as SupabaseProfileAvatarClient,
      actorUserId,
    ),
    permissionAdapter,
  };
}

async function readBoundedJsonBody(
  request: Request,
): Promise<Record<string, unknown> | Response> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    return Response.json(
      { ok: false, status: 415, error: "unsupported_media_type" },
      { status: 415 },
    );
  }
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxRequestBytes) {
    return requestTooLarge();
  }
  const rawBody = await request.text().catch(() => null);
  if (
    rawBody === null ||
    new TextEncoder().encode(rawBody).byteLength > maxRequestBytes
  ) {
    return requestTooLarge();
  }
  try {
    const value = JSON.parse(rawBody) as unknown;
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : invalidRequest();
  } catch {
    return invalidRequest();
  }
}

function parsePostPayload(value: Record<string, unknown>): PostPayload | null {
  if (!isWorkspaceId(value.workspaceId)) return null;
  if (
    value.action === "prepare" &&
    hasOnlyKeys(value, ["action", "workspaceId"])
  ) {
    return { action: "prepare", workspaceId: value.workspaceId };
  }
  if (
    value.action === "finalize" &&
    hasOnlyKeys(value, [
      "action",
      "workspaceId",
      "uploadId",
      "declaredMime",
    ]) &&
    isUuid(value.uploadId) &&
    isSupportedMime(value.declaredMime)
  ) {
    return {
      action: "finalize",
      workspaceId: value.workspaceId,
      uploadId: value.uploadId,
      declaredMime: value.declaredMime,
    };
  }
  if (
    value.action === "discard" &&
    hasOnlyKeys(value, ["action", "workspaceId", "uploadId"]) &&
    isUuid(value.uploadId)
  ) {
    return {
      action: "discard",
      workspaceId: value.workspaceId,
      uploadId: value.uploadId,
    };
  }
  return null;
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: string[]) {
  const keys = Object.keys(value);
  return keys.length === allowed.length && keys.every((key) => allowed.includes(key));
}

function isWorkspaceId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 3 &&
    value.length <= 64 &&
    /^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(value)
  );
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function isSupportedMime(value: unknown): value is string {
  return (
    value === "image/jpeg" || value === "image/png" || value === "image/webp"
  );
}

function invalidRequest() {
  return Response.json(
    { ok: false, status: 400, error: "invalid_request" },
    { status: 400 },
  );
}

function requestTooLarge() {
  return Response.json(
    { ok: false, status: 413, error: "request_too_large" },
    { status: 413 },
  );
}
