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
  createSupabaseChartPatientVitalWriteGateway,
  createSupabasePatientVitalWriteGateway,
  writePatientVital,
  type SupabasePatientVitalClient,
} from "@/features/patient-vitals/server-patient-vital";
import { createClient } from "@/lib/supabase/server";

export async function handlePatientVitalPatch({
  mode,
  request,
  workspaceId,
}: {
  mode: "chart" | "waiting";
  request: Request;
  workspaceId: string;
}) {
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
  const encounterId =
    typeof body?.encounterId === "string" ? body.encounterId.trim() : "";
  if (!encounterId) {
    return Response.json(
      {
        ok: false,
        error: "invalid_input",
        fieldErrors: { vitals: "진료 접수를 다시 선택해 주세요." },
      },
      { status: 400 },
    );
  }

  const client = identity.source === "supabase_session" ? await createClient() : null;
  if (!client) {
    return Response.json(
      { ok: false, error: "supabase_client_missing" },
      { status: 500 },
    );
  }

  const permissionAdapter = await loadWorkspacePermissionAdapterFromDb({
    gateway: createSupabaseWorkspacePermissionGateway(
      client as unknown as SupabaseWorkspacePermissionClient,
    ),
    sessionUserId: identity.actorUserId,
    workspaceId,
  });
  const vitalClient = client as unknown as SupabasePatientVitalClient;
  const result = await writePatientVital({
    actorUserId: identity.actorUserId,
    encounterId,
    gateway:
      mode === "waiting"
        ? createSupabasePatientVitalWriteGateway(vitalClient)
        : createSupabaseChartPatientVitalWriteGateway(vitalClient),
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
