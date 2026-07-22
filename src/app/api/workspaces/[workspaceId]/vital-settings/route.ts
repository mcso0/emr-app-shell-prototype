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
  createSupabaseWorkspaceVitalSettingsGateway,
  readWorkspaceVitalSettings,
  replaceWorkspaceVitalSettings,
  type SupabaseWorkspaceVitalSettingsClient,
} from "@/features/hospital-admin/vital-settings/server-workspace-vital-settings-core";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ workspaceId: string }> };

async function resolveContext(request: Request, workspaceId: string) {
  const identity = resolveRoleUpdateActorIdentity({
    serverSession: await readServerSession(),
    demoHeaderUserId: request.headers.get(demoSessionUserIdHeader),
  });
  if (!identity.ok) return { identity } as const;

  const client = identity.source === "supabase_session" ? await createClient() : null;
  const permissionAdapter = client
    ? await loadWorkspacePermissionAdapterFromDb({
        gateway: createSupabaseWorkspacePermissionGateway(
          client as unknown as SupabaseWorkspacePermissionClient,
        ),
        workspaceId,
        sessionUserId: identity.actorUserId,
      })
    : undefined;
  return { identity, client, permissionAdapter } as const;
}

export async function GET(request: Request, { params }: RouteContext) {
  const { workspaceId } = await params;
  const context = await resolveContext(request, workspaceId);
  if (!context.identity.ok) {
    return Response.json(
      { ok: false, denialReason: context.identity.denialReason },
      { status: 401 },
    );
  }

  const result = await readWorkspaceVitalSettings({
    actorUserId: context.identity.actorUserId,
    workspaceId,
    permissionAdapter: context.permissionAdapter,
    gateway: context.client
      ? createSupabaseWorkspaceVitalSettingsGateway(
          context.client as unknown as SupabaseWorkspaceVitalSettingsClient,
        )
      : undefined,
  });
  return Response.json(result, { status: result.status });
}

export async function PUT(request: Request, { params }: RouteContext) {
  const { workspaceId } = await params;
  const context = await resolveContext(request, workspaceId);
  if (!context.identity.ok) {
    return Response.json(
      { ok: false, denialReason: context.identity.denialReason },
      { status: 401 },
    );
  }

  let body: Record<string, unknown> | null = null;
  try {
    const value = await request.json();
    body = typeof value === "object" && value !== null && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  } catch {
    body = null;
  }

  const result = await replaceWorkspaceVitalSettings({
    actorUserId: context.identity.actorUserId,
    workspaceId,
    items: body?.items,
    permissionAdapter: context.permissionAdapter,
    gateway: context.client
      ? createSupabaseWorkspaceVitalSettingsGateway(
          context.client as unknown as SupabaseWorkspaceVitalSettingsClient,
        )
      : undefined,
  });
  return Response.json(result, { status: result.status });
}
