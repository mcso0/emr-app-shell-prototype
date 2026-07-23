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
import { getAuditRequestId } from "@/features/audit/server-mutation-audit-core";
import {
  createSupabaseHospitalLogoGateway,
  discardHospitalLogoUpload,
  finalizeHospitalLogoUpload,
  prepareHospitalLogoUpload,
  removeHospitalLogo,
  type SupabaseHospitalLogoClient,
} from "@/features/hospital-admin/settings/server-hospital-logo";
import { enforceWorkspaceMutationRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
const maxRequestBytes = 2_048;

type RouteContext = { params: Promise<{ workspaceId: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const { workspaceId } = await params;
  const identity = await readLogoIdentity(request);
  if (identity instanceof Response) return identity;
  const body = await readBoundedJsonBody(request);
  if (body instanceof Response) return body;
  const payload = parsePostPayload(body);
  if (!payload) return invalidRequest();

  const rateLimitResponse = enforceWorkspaceMutationRateLimit({
    request,
    actorUserId: identity.actorUserId,
    workspaceId,
    operation: `hospital_logo_${payload.action}`,
  });
  if (rateLimitResponse) return rateLimitResponse;

  const context = await loadLogoContext(
    identity.actorUserId,
    workspaceId,
    getAuditRequestId(request)
  );
  if (context instanceof Response) return context;

  if (payload.action === "prepare") {
    const result = await prepareHospitalLogoUpload({
      actorUserId: identity.actorUserId,
      workspaceId,
      uploadId: randomUUID(),
      gateway: context.gateway,
      permissionAdapter: context.permissionAdapter,
    });
    return Response.json(result, { status: result.status });
  }
  if (payload.action === "finalize") {
    const result = await finalizeHospitalLogoUpload({
      actorUserId: identity.actorUserId,
      workspaceId,
      uploadId: payload.uploadId,
      logoId: randomUUID(),
      declaredMime: payload.declaredMime,
      expectedRevision: payload.revision,
      gateway: context.gateway,
      permissionAdapter: context.permissionAdapter,
    });
    return Response.json(result, { status: result.status });
  }
  const result = await discardHospitalLogoUpload({
    actorUserId: identity.actorUserId,
    workspaceId,
    uploadId: payload.uploadId,
    gateway: context.gateway,
    permissionAdapter: context.permissionAdapter,
  });
  return Response.json(result, { status: result.status });
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const { workspaceId } = await params;
  const identity = await readLogoIdentity(request);
  if (identity instanceof Response) return identity;
  const body = await readBoundedJsonBody(request);
  if (
    body instanceof Response ||
    !hasOnlyKeys(body, ["revision"]) ||
    !isRevision(body.revision)
  ) {
    return body instanceof Response ? body : invalidRequest();
  }
  const rateLimitResponse = enforceWorkspaceMutationRateLimit({
    request,
    actorUserId: identity.actorUserId,
    workspaceId,
    operation: "hospital_logo_remove",
  });
  if (rateLimitResponse) return rateLimitResponse;
  const context = await loadLogoContext(
    identity.actorUserId,
    workspaceId,
    getAuditRequestId(request)
  );
  if (context instanceof Response) return context;
  const result = await removeHospitalLogo({
    actorUserId: identity.actorUserId,
    workspaceId,
    expectedRevision: body.revision,
    gateway: context.gateway,
    permissionAdapter: context.permissionAdapter,
  });
  return Response.json(result, { status: result.status });
}

async function readLogoIdentity(request: Request) {
  const identity = resolveRoleUpdateActorIdentity({
    serverSession: await readServerSession(),
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
  if (identity.source !== "supabase_session") {
    return Response.json(
      { ok: false, error: "configured_data_source_required" },
      { status: 503 }
    );
  }
  return { actorUserId: identity.actorUserId };
}

async function loadLogoContext(
  actorUserId: string,
  workspaceId: string,
  requestId: string | null
) {
  const client = await createClient();
  if (!client) {
    return Response.json(
      { ok: false, error: "supabase_client_missing" },
      { status: 500 }
    );
  }
  const permissionAdapter = await loadWorkspacePermissionAdapterFromDb({
    gateway: createSupabaseWorkspacePermissionGateway(
      client as unknown as SupabaseWorkspacePermissionClient
    ),
    workspaceId,
    sessionUserId: actorUserId,
  }).catch(() => null);
  if (!permissionAdapter) {
    return Response.json({ ok: false, error: "db_read_failed" }, { status: 500 });
  }
  return {
    permissionAdapter,
    gateway: createSupabaseHospitalLogoGateway(
      client as unknown as SupabaseHospitalLogoClient,
      workspaceId,
      requestId
    ),
  };
}

type PostPayload =
  | { action: "prepare"; revision: number }
  | {
      action: "finalize";
      uploadId: string;
      declaredMime: "image/jpeg" | "image/png";
      revision: number;
    }
  | { action: "discard"; uploadId: string };

function parsePostPayload(value: Record<string, unknown>): PostPayload | null {
  if (
    value.action === "prepare" &&
    hasOnlyKeys(value, ["action", "revision"]) &&
    isRevision(value.revision)
  ) {
    return { action: "prepare", revision: value.revision };
  }
  if (
    value.action === "finalize" &&
    hasOnlyKeys(value, [
      "action",
      "uploadId",
      "declaredMime",
      "revision",
    ]) &&
    isUuid(value.uploadId) &&
    (value.declaredMime === "image/jpeg" ||
      value.declaredMime === "image/png") &&
    isRevision(value.revision)
  ) {
    return {
      action: "finalize",
      uploadId: value.uploadId,
      declaredMime: value.declaredMime,
      revision: value.revision,
    };
  }
  if (
    value.action === "discard" &&
    hasOnlyKeys(value, ["action", "uploadId"]) &&
    isUuid(value.uploadId)
  ) {
    return { action: "discard", uploadId: value.uploadId };
  }
  return null;
}

async function readBoundedJsonBody(
  request: Request
): Promise<Record<string, unknown> | Response> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    return Response.json(
      { ok: false, error: "unsupported_media_type" },
      { status: 415 }
    );
  }
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxRequestBytes) {
    return requestTooLarge();
  }
  const raw = await request.text().catch(() => null);
  if (raw === null || new TextEncoder().encode(raw).byteLength > maxRequestBytes) {
    return requestTooLarge();
  }
  try {
    const value = JSON.parse(raw) as unknown;
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : invalidRequest();
  } catch {
    return invalidRequest();
  }
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: string[]) {
  const keys = Object.keys(value);
  return (
    keys.length === allowed.length &&
    keys.every((key) => allowed.includes(key))
  );
}

function isRevision(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 1;
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

function invalidRequest() {
  return Response.json(
    { ok: false, error: "invalid_request" },
    { status: 400 }
  );
}

function requestTooLarge() {
  return Response.json(
    { ok: false, error: "request_too_large" },
    { status: 413 }
  );
}
