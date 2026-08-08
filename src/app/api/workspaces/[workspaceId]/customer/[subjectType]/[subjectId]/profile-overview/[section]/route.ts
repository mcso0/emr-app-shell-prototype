import { loadWorkspacePermissionAdapterFromDb } from "@/features/auth/db-workspace-permission-adapter";
import {
  createSupabaseWorkspacePermissionGateway,
  type SupabaseWorkspacePermissionClient,
} from "@/features/auth/supabase-workspace-permission-gateway";
import {
  demoSessionUserIdHeader,
  resolveRoleUpdateActorIdentity,
} from "@/features/auth/server-role-update-identity";
import {
  createSupabaseCustomerProfileOverviewGateway,
  readCustomerProfileSection,
  type CustomerProfileSection,
  type CustomerProfileSubjectType,
  type SupabaseCustomerProfileOverviewRpcClient,
} from "@/features/customer/server-profile-overview-core";
import { readServerSession } from "@/features/auth/server-session-reader";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    section: string;
    subjectId: string;
    subjectType: string;
    workspaceId: string;
  }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const { section, subjectId, subjectType, workspaceId } = await params;
  if (!isSubjectType(subjectType) || !isSection(section) || !isUuid(subjectId)) {
    return Response.json({ ok: false, status: 404, error: "subject_not_found" }, { status: 404 });
  }

  const identity = await getIdentity(request);
  if (!identity.ok) return identity.response;

  const searchParams = new URL(request.url).searchParams;
  const limit = parseBoundedInteger(searchParams.get("limit"), 20, 50);
  const months = searchParams.get("months") === "12" ? 12 : 6;
  const cursor = searchParams.get("cursor") ?? undefined;
  const rawPatientId = searchParams.get("patientId");
  if (rawPatientId && !isUuid(rawPatientId)) {
    return Response.json({ ok: false, status: 400, error: "invalid_filter" }, { status: 400 });
  }
  const patientId = rawPatientId ?? undefined;
  const month = searchParams.get("month") ?? undefined;
  const client = identity.source === "supabase_session" ? await createClient() : null;
  if (identity.source === "supabase_session" && !client) {
    return Response.json({ ok: false, status: 500, error: "supabase_client_missing" }, { status: 500 });
  }
  const permissionAdapter = client
    ? await loadWorkspacePermissionAdapterFromDb({
        gateway: createSupabaseWorkspacePermissionGateway(
          client as unknown as SupabaseWorkspacePermissionClient,
        ),
        sessionUserId: identity.actorUserId,
        workspaceId,
      }).catch(() => null)
    : undefined;
  if (client && !permissionAdapter) {
    return Response.json({ ok: false, status: 500, error: "db_read_failed" }, { status: 500 });
  }
  const result = await readCustomerProfileSection({
    actorUserId: identity.actorUserId,
    cursor,
    gateway: client
      ? createSupabaseCustomerProfileOverviewGateway(
          client as unknown as SupabaseCustomerProfileOverviewRpcClient,
        )
      : undefined,
    limit,
    months,
    patientId,
    permissionAdapter: permissionAdapter ?? undefined,
    section,
    subjectId,
    subjectType,
    workspaceId,
    month,
  });

  return Response.json(result, { status: result.status });
}

async function getIdentity(request: Request) {
  const serverSession = await readServerSession();
  const identity = resolveRoleUpdateActorIdentity({
    serverSession,
    demoHeaderUserId: request.headers.get(demoSessionUserIdHeader),
  });

  if (identity.ok) return identity;

  return {
    ok: false as const,
    response: Response.json(
      {
        ok: false,
        denialReason: identity.denialReason,
        sessionStatus: identity.sessionStatus,
        sessionReason: identity.sessionReason,
      },
      { status: 401 },
    ),
  };
}

function isSubjectType(value: string): value is CustomerProfileSubjectType {
  return value === "patient" || value === "guardian";
}

function isSection(value: string): value is CustomerProfileSection {
  return value === "history" || value === "reservations" || value === "billing";
}

function parseBoundedInteger(value: string | null, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.floor(parsed), 1), max);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
