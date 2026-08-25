import { readServerSession } from "@/features/auth/server-session-reader";
import { loadWorkspacePermissionAdapterFromDb } from "@/features/auth/db-workspace-permission-adapter";
import {
  demoSessionUserIdHeader,
  resolveRoleUpdateActorIdentity,
} from "@/features/auth/server-role-update-identity";
import {
  createSupabaseWorkspacePermissionGateway,
  type SupabaseWorkspacePermissionClient,
} from "@/features/auth/supabase-workspace-permission-gateway";
import {
  createSupabaseDiagnosisCatalogGateway,
  searchDiagnosisCatalog,
  type SupabaseDiagnosisCatalogRpcClient,
} from "@/features/chart/server-diagnosis-catalog-core";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ workspaceId: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const { workspaceId } = await params;
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
        sessionStatus: identity.sessionStatus,
        sessionReason: identity.sessionReason,
      },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const rawLimit = url.searchParams.get("limit");
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
  const result = await searchDiagnosisCatalog({
    actorUserId: identity.actorUserId,
    workspaceId,
    input: {
      query: url.searchParams.get("q"),
      systemId: url.searchParams.get("systemId"),
      diseaseGroupId: url.searchParams.get("diseaseGroupId"),
      cursor: url.searchParams.get("cursor"),
      limit: rawLimit === null || rawLimit === "" ? 50 : Number(rawLimit),
    },
    permissionAdapter,
    gateway: client
      ? createSupabaseDiagnosisCatalogGateway(
          client as unknown as SupabaseDiagnosisCatalogRpcClient,
        )
      : undefined,
  });

  if (!result.ok) return Response.json(result, { status: result.status });
  return Response.json(
    {
      ok: true,
      status: result.status,
      ...result.page,
      enforcedBy: result.enforcedBy,
    },
    { status: result.status },
  );
}
