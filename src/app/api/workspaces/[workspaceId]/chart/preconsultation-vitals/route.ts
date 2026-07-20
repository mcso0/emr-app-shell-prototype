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
  createSupabasePatientVitalWriteGateway,
  writePatientVital,
  type SupabasePatientVitalClient,
} from "@/features/patient-vitals/server-patient-vital";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ workspaceId: string }>;
};

export async function PATCH(request: Request, { params }: RouteContext) {
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
        sessionReason: identity.sessionReason,
        sessionStatus: identity.sessionStatus,
      },
      { status: 401 },
    );
  }

  const body = await readJson(request);
  const encounterId = typeof body?.encounterId === "string" ? body.encounterId.trim() : "";
  if (!encounterId) {
    return Response.json(
      {
        ok: false,
        error: "invalid_input",
        fieldErrors: { vitals: "대기 중인 접수를 다시 선택해 주세요." },
      },
      { status: 400 },
    );
  }

  const client = identity.source === "supabase_session" ? await createClient() : null;
  if (!client) {
    return Response.json({ ok: false, error: "supabase_client_missing" }, { status: 500 });
  }

  const permissionAdapter = await loadWorkspacePermissionAdapterFromDb({
    gateway: createSupabaseWorkspacePermissionGateway(
      client as unknown as SupabaseWorkspacePermissionClient,
    ),
    sessionUserId: identity.actorUserId,
    workspaceId,
  });
  const result = await writePatientVital({
    actorUserId: identity.actorUserId,
    encounterId,
    gateway: createSupabasePatientVitalWriteGateway(client as unknown as SupabasePatientVitalClient),
    input: body?.vitals,
    permissionAdapter,
    workspaceId,
  });

  return Response.json(result, { status: result.status });
}

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return typeof body === "object" && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
