import { loadWorkspacePermissionAdapterFromDb } from "@/features/auth/db-workspace-permission-adapter";
import { readServerSession } from "@/features/auth/server-session-reader";
import { demoSessionUserIdHeader, resolveRoleUpdateActorIdentity } from "@/features/auth/server-role-update-identity";
import { createSupabaseWorkspacePermissionGateway, type SupabaseWorkspacePermissionClient } from "@/features/auth/supabase-workspace-permission-gateway";
import {
  createSupabaseHospitalOperatingHoursGateway,
  readHospitalOperatingHours,
  updateHospitalOperatingHours,
  type SupabaseHospitalOperatingHoursClient,
} from "@/features/hospital-admin/settings/server-hospital-operating-hours-core";
import { enforceWorkspaceMutationRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ workspaceId: string }> };
const maxRequestBytes = 64 * 1024;

async function context(request: Request, workspaceId: string) {
  const identity = resolveRoleUpdateActorIdentity({
    serverSession: await readServerSession(),
    demoHeaderUserId: request.headers.get(demoSessionUserIdHeader),
  });
  if (!identity.ok) return { identity } as const;
  const client = identity.source === "supabase_session" ? await createClient() : null;
  const permissionAdapter = client
    ? await loadWorkspacePermissionAdapterFromDb({
        gateway: createSupabaseWorkspacePermissionGateway(client as unknown as SupabaseWorkspacePermissionClient),
        workspaceId,
        sessionUserId: identity.actorUserId,
      })
    : undefined;
  return { identity, client, permissionAdapter } as const;
}

export async function GET(request: Request, { params }: RouteContext) {
  const { workspaceId } = await params;
  const ctx = await context(request, workspaceId);
  if (!ctx.identity.ok) return Response.json({ ok: false, denialReason: ctx.identity.denialReason }, { status: 401 });
  const result = await readHospitalOperatingHours({
    actorUserId: ctx.identity.actorUserId,
    workspaceId,
    permissionAdapter: ctx.permissionAdapter,
    gateway: ctx.client ? createSupabaseHospitalOperatingHoursGateway(ctx.client as unknown as SupabaseHospitalOperatingHoursClient) : undefined,
  });
  return Response.json(result, { status: result.status });
}

export async function PUT(request: Request, { params }: RouteContext) {
  const { workspaceId } = await params;
  const ctx = await context(request, workspaceId);
  if (!ctx.identity.ok) return Response.json({ ok: false, denialReason: ctx.identity.denialReason }, { status: 401 });
  const rateLimitResponse = enforceWorkspaceMutationRateLimit({
    request,
    actorUserId: ctx.identity.actorUserId,
    workspaceId,
    operation: "hospital_operating_hours_update",
  });
  if (rateLimitResponse) return rateLimitResponse;
  const settings = await readBoundedJsonBody(request);
  if (settings instanceof Response) return settings;
  const result = await updateHospitalOperatingHours({
    actorUserId: ctx.identity.actorUserId,
    workspaceId,
    settings,
    permissionAdapter: ctx.permissionAdapter,
    gateway: ctx.client ? createSupabaseHospitalOperatingHoursGateway(ctx.client as unknown as SupabaseHospitalOperatingHoursClient) : undefined,
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
  if (
    raw === null ||
    new TextEncoder().encode(raw).byteLength > maxRequestBytes
  ) {
    return requestTooLarge();
  }
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return invalidInput();
    }
    return value as Record<string, unknown>;
  } catch {
    return invalidInput();
  }
}

function invalidInput() {
  return Response.json(
    { ok: false, error: "invalid_input" },
    { status: 400 }
  );
}

function requestTooLarge() {
  return Response.json(
    { ok: false, error: "request_too_large" },
    { status: 413 }
  );
}
