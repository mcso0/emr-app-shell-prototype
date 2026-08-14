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
import { parseHospitalContactUpdateInput } from "@/features/hospital-admin/settings/hospital-profile-model";
import {
  createSupabaseHospitalProfileGateway,
  readHospitalProfile,
  updateHospitalContact,
  type SupabaseHospitalProfileClient,
} from "@/features/hospital-admin/settings/server-hospital-profile";
import { enforceWorkspaceMutationRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const maxRequestBytes = 16_384;

type RouteContext = { params: Promise<{ workspaceId: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  const { workspaceId } = await params;
  const context = await loadContext(request, workspaceId);
  if (context instanceof Response) return context;
  const result = await readHospitalProfile({
    actorUserId: context.actorUserId,
    workspaceId,
    permissionAdapter: context.permissionAdapter,
    gateway: context.gateway,
  });
  return Response.json(result, {
    status: result.status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { workspaceId } = await params;
  const context = await loadContext(request, workspaceId);
  if (context instanceof Response) return context;

  const rateLimitResponse = enforceWorkspaceMutationRateLimit({
    request,
    actorUserId: context.actorUserId,
    workspaceId,
    operation: "hospital_profile_contact_update",
  });
  if (rateLimitResponse) return rateLimitResponse;

  const body = await readBoundedJsonBody(request);
  if (body instanceof Response) return body;
  const parsed = parseHospitalContactUpdateInput(body);
  if (!parsed.ok) {
    return Response.json(parsed, { status: 400 });
  }

  const result = await updateHospitalContact({
    actorUserId: context.actorUserId,
    workspaceId,
    input: parsed.value,
    requestId: getAuditRequestId(request),
    permissionAdapter: context.permissionAdapter,
    gateway: context.gateway,
  });
  return Response.json(result, { status: result.status });
}

async function loadContext(request: Request, workspaceId: string) {
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

  if (identity.source === "demo_header_mock_mode") {
    return { actorUserId: identity.actorUserId };
  }

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
    sessionUserId: identity.actorUserId,
  }).catch(() => null);
  if (!permissionAdapter) {
    return Response.json({ ok: false, error: "db_read_failed" }, { status: 500 });
  }

  return {
    actorUserId: identity.actorUserId,
    permissionAdapter,
    gateway: createSupabaseHospitalProfileGateway(
      client as unknown as SupabaseHospitalProfileClient
    ),
  };
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
      : Response.json({ ok: false, error: "invalid_input" }, { status: 400 });
  } catch {
    return Response.json({ ok: false, error: "invalid_input" }, { status: 400 });
  }
}

function requestTooLarge() {
  return Response.json(
    { ok: false, error: "request_too_large" },
    { status: 413 }
  );
}
