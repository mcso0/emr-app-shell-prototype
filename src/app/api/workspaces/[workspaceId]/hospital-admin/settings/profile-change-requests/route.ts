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
import { parseHospitalProfileChangeRequestInput } from "@/features/hospital-admin/settings/hospital-profile-model";
import {
  createHospitalProfileChangeRequest,
  createSupabaseHospitalProfileGateway,
  type SupabaseHospitalProfileClient,
} from "@/features/hospital-admin/settings/server-hospital-profile";
import { enforceWorkspaceMutationRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

const maxRequestBytes = 8_192;
type RouteContext = { params: Promise<{ workspaceId: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const { workspaceId } = await params;
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

  const rateLimitResponse = enforceWorkspaceMutationRateLimit({
    request,
    actorUserId: identity.actorUserId,
    workspaceId,
    operation: "hospital_profile_change_request",
  });
  if (rateLimitResponse) return rateLimitResponse;

  const body = await readBoundedJsonBody(request);
  if (body instanceof Response) return body;
  const parsed = parseHospitalProfileChangeRequestInput(body);
  if (!parsed.ok) return Response.json(parsed, { status: 400 });

  let permissionAdapter;
  let gateway;
  if (identity.source === "supabase_session") {
    const client = await createClient();
    if (!client) {
      return Response.json(
        { ok: false, error: "supabase_client_missing" },
        { status: 500 }
      );
    }
    permissionAdapter = await loadWorkspacePermissionAdapterFromDb({
      gateway: createSupabaseWorkspacePermissionGateway(
        client as unknown as SupabaseWorkspacePermissionClient
      ),
      workspaceId,
      sessionUserId: identity.actorUserId,
    }).catch(() => null);
    if (!permissionAdapter) {
      return Response.json(
        { ok: false, error: "db_read_failed" },
        { status: 500 }
      );
    }
    gateway = createSupabaseHospitalProfileGateway(
      client as unknown as SupabaseHospitalProfileClient
    );
  }

  const result = await createHospitalProfileChangeRequest({
    actorUserId: identity.actorUserId,
    workspaceId,
    input: parsed.value,
    requestId: getAuditRequestId(request),
    permissionAdapter,
    gateway,
  });
  return Response.json(result, { status: result.status });
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
