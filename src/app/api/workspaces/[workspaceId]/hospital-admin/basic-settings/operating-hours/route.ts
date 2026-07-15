import { loadWorkspacePermissionAdapterFromDb } from "@/features/auth/db-workspace-permission-adapter";
import { readServerSession } from "@/features/auth/server-session-reader";
import { demoSessionUserIdHeader, resolveRoleUpdateActorIdentity } from "@/features/auth/server-role-update-identity";
import { createSupabaseWorkspacePermissionGateway, type SupabaseWorkspacePermissionClient } from "@/features/auth/supabase-workspace-permission-gateway";
import {
  createSupabaseHospitalOperatingHoursGateway,
  readHospitalOperatingHours,
  updateHospitalOperatingHours,
  type HospitalOperatingHoursSettings,
  type SupabaseHospitalOperatingHoursClient,
} from "@/features/hospital-admin/settings/server-hospital-operating-hours-core";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ workspaceId: string }> };

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
  let settings: HospitalOperatingHoursSettings;
  try { settings = await request.json() as HospitalOperatingHoursSettings; }
  catch { return Response.json({ ok: false, error: "invalid_input" }, { status: 400 }); }
  const result = await updateHospitalOperatingHours({
    actorUserId: ctx.identity.actorUserId,
    workspaceId,
    settings,
    permissionAdapter: ctx.permissionAdapter,
    gateway: ctx.client ? createSupabaseHospitalOperatingHoursGateway(ctx.client as unknown as SupabaseHospitalOperatingHoursClient) : undefined,
  });
  return Response.json(result, { status: result.status });
}
