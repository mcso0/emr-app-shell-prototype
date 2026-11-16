import { readServerSession } from "@/features/auth/server-session-reader";
import { loadWorkspacePermissionAdapterFromDb } from "@/features/auth/db-workspace-permission-adapter";
import { resolveWorkspacePermission } from "@/features/auth/permission-resolver";
import {
  demoSessionUserIdHeader,
  resolveRoleUpdateActorIdentity,
} from "@/features/auth/server-role-update-identity";
import {
  createSupabaseWorkspacePermissionGateway,
  loadChartDraftPermissionAdapter,
  type ChartDraftPermissionClient,
  type SupabaseWorkspacePermissionClient,
} from "@/features/auth/supabase-workspace-permission-gateway";
import {
  createSupabaseChartOrderDraftGateway,
  readChartOrderDraft,
  saveChartOrderDraft,
  type ChartOrderDraftInput,
  type SupabaseChartOrderDraftRpcClient,
} from "@/features/chart/server-order-draft-persistence";
import { chartOrderExpectedEtagHeader } from "@/features/chart/order-version-contract";
import {
  resolveServerChartEncounterId,
  type SupabaseEncounterIdBridgeClient,
} from "@/features/chart/server-encounter-id-bridge";
import { enforceWorkspaceMutationRateLimit } from "@/lib/security/rate-limit";
import { createServerTimingRecorder } from "@/lib/http/server-timing";
import { createClient, normalizeSupabaseRequestId } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    workspaceId: string;
  }>;
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
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const encounterId = url.searchParams.get("encounterId");
  const client = identity.source === "supabase_session" ? await createClient() : null;
  const resolvedEncounter = await resolveServerChartEncounterId({
    client: client as unknown as SupabaseEncounterIdBridgeClient | null,
    encounterId,
    workspaceId,
  });
  if (!resolvedEncounter.ok) {
    return Response.json(resolvedEncounter, { status: resolvedEncounter.status });
  }
  const permissionAdapter = client
    ? await loadWorkspacePermissionAdapterFromDb({
        gateway: createSupabaseWorkspacePermissionGateway(
          client as unknown as SupabaseWorkspacePermissionClient
        ),
        workspaceId,
        sessionUserId: identity.actorUserId,
      })
    : undefined;
  const result = await readChartOrderDraft({
    actorUserId: identity.actorUserId,
    workspaceId,
    encounterId: resolvedEncounter.encounterId,
    permissionAdapter,
    gateway: client
      ? createSupabaseChartOrderDraftGateway(
          client as unknown as SupabaseChartOrderDraftRpcClient
        )
      : undefined,
  });

  const response = Response.json(result, { status: result.status });
  if (result.ok) response.headers.set("ETag", result.etag);
  return response;
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const timing = createServerTimingRecorder({
    method: "PATCH",
    route: "chart_order_draft",
  });
  const { workspaceId } = await params;
  const identity = await timing.measure("session", async () =>
    resolveRoleUpdateActorIdentity({
      serverSession: await readServerSession(),
      demoHeaderUserId: request.headers.get(demoSessionUserIdHeader),
    }),
  );

  if (!identity.ok) {
    return timing.respond(
      Response.json(
        {
          ok: false,
          denialReason: identity.denialReason,
          sessionStatus: identity.sessionStatus,
          sessionReason: identity.sessionReason,
        },
        { status: 401 },
      ),
    );
  }

  const rateLimitResponse = enforceWorkspaceMutationRateLimit({
    request,
    actorUserId: identity.actorUserId,
    workspaceId,
    operation: "chart_order_draft_save",
  });
  if (rateLimitResponse) return timing.respond(rateLimitResponse);

  const input = await readJsonBody(request);
  const expectedEtagHeader = request.headers.get(
    chartOrderExpectedEtagHeader,
  );
  const inputKeys = Object.keys(input as Record<string, unknown>);
  if (
    inputKeys.some(
      (key) =>
        key !== "chartId" &&
        key !== "encounterId" &&
        key !== "expectedEtag" &&
        key !== "removedOrderIds" &&
        key !== "rows",
    )
  ) {
    return timing.respond(
      Response.json(
        {
          ok: false,
          status: 400,
          error: "invalid_input",
          fieldErrors: { rows: "오더 rows 형식을 확인해 주세요." },
        },
        { status: 400 },
      ),
    );
  }
  if (!Array.isArray(input.rows) || !input.expectedEtag) {
    return timing.respond(
      Response.json(
        { ok: false, status: 428, error: "if_match_required", message: "오더 버전 확인이 필요합니다." },
        { status: 428 },
      ),
    );
  }
  if (
    input.removedOrderIds !== undefined &&
    !Array.isArray(input.removedOrderIds)
  ) {
    return timing.respond(
      Response.json(
        {
          ok: false,
          status: 400,
          error: "invalid_input",
          fieldErrors: { removedOrderIds: "삭제할 오더 후보를 확인해 주세요." },
        },
        { status: 400 },
      ),
    );
  }
  if (!expectedEtagHeader) {
    return timing.respond(
      Response.json(
        { ok: false, status: 428, error: "if_match_required", message: "오더 버전 확인이 필요합니다." },
        { status: 428 },
      ),
    );
  }
  if (expectedEtagHeader !== input.expectedEtag) {
    return timing.respond(
      Response.json(
        { ok: false, status: 400, error: "etag_header_body_mismatch", message: "오더 버전 정보가 일치하지 않습니다." },
        { status: 400 },
      ),
    );
  }
  const requestId = crypto.randomUUID();
  const upstreamDurations: Record<string, number> = {};
  let supabaseRequestId: string | null = null;
  const fetchWithSaveTiming: typeof fetch = async (resource, init) => {
    const url = resource instanceof Request ? resource.url : String(resource);
    if (!/\/rest\/v1\/rpc\/clair_save_chart_order_draft(?:_for_chart)?$/.test(url)) {
      return fetch(resource, init);
    }

    const startedAt = performance.now();
    const response = await fetch(resource, init);
    upstreamDurations.rpc_headers = performance.now() - startedAt;
    supabaseRequestId = normalizeSupabaseRequestId(response.headers.get("sb-request-id"));
    const envoyTime = response.headers.get("x-envoy-upstream-service-time");
    if (envoyTime && /^[0-9]{1,9}$/.test(envoyTime)) {
      upstreamDurations.supabase_upstream = Number(envoyTime);
    }

    for (const entry of response.headers.get("x-clair-draft-timing")?.split(",") ?? []) {
      const match = /^\s*(db_function|db_chart_guard|db_initial_locks);dur=([0-9]{1,9}(?:\.[0-9]{1,3})?)\s*$/.exec(entry);
      if (match) upstreamDurations[match[1]] = Number(match[2]);
    }
    const transaction = /(?:^|,)\s*transaction;dur=([0-9]{1,9}(?:\.[0-9]{1,3})?)(?=\s*(?:,|$))/.exec(
      response.headers.get("server-timing") ?? "",
    );
    if (transaction) upstreamDurations.postgrest_transaction = Number(transaction[1]);
    return response;
  };
  const permissionContext = await timing.measure("permission", async () => {
    const client = identity.source === "supabase_session"
      ? await createClient({ requestId, fetch: fetchWithSaveTiming })
      : null;
    const resolvedEncounter = await resolveServerChartEncounterId({
      client: client as unknown as SupabaseEncounterIdBridgeClient | null,
      encounterId: input.encounterId,
      workspaceId,
    });
    if (!resolvedEncounter.ok) return { ok: false as const, resolvedEncounter };
    const permissionAdapter = client
      ? await loadChartDraftPermissionAdapter({
          client: client as unknown as ChartDraftPermissionClient,
          workspaceId,
          sessionUserId: identity.actorUserId,
        })
      : undefined;
    return { ok: true as const, client, permissionAdapter, resolvedEncounter };
  });
  if (!permissionContext.ok) {
    return timing.respond(
      Response.json(permissionContext.resolvedEncounter, {
        status: permissionContext.resolvedEncounter.status,
      }),
    );
  }
  const { client, permissionAdapter, resolvedEncounter } = permissionContext;
  if (client && permissionAdapter) {
    const updatePermission = resolveWorkspacePermission(permissionAdapter, {
      sessionUserId: identity.actorUserId,
      workspaceId,
      requiredPermission: "chart:update",
    });
    if (!updatePermission.allowed) {
      const status =
        updatePermission.denialReason === "unauthenticated" ? 401 : 403;
      return timing.respond(
        Response.json(
          {
            ok: false,
            status,
            denialReason:
              updatePermission.denialReason ?? "permission_missing",
          },
          { status },
        ),
      );
    }
    const viewPermission = resolveWorkspacePermission(permissionAdapter, {
      sessionUserId: identity.actorUserId,
      workspaceId,
      requiredPermission: "chart:view",
    });
    if (!viewPermission.allowed) {
      const status =
        viewPermission.denialReason === "unauthenticated" ? 401 : 403;
      return timing.respond(
        Response.json(
          {
            ok: false,
            status,
            denialReason: viewPermission.denialReason ?? "permission_missing",
          },
          { status },
        ),
      );
    }
    // Catalog reads previously enforced this capability. Keep the boundary
    // without fetching the catalog; the save RPC owns consultation normalization.
    const catalogPermission = resolveWorkspacePermission(permissionAdapter, {
      sessionUserId: identity.actorUserId,
      workspaceId,
      requiredPermission: "service_catalog:view",
    });
    if (!catalogPermission.allowed) {
      const status =
        catalogPermission.denialReason === "unauthenticated" ? 401 : 403;
      return timing.respond(
        Response.json(
          {
            ok: false,
            status,
            denialReason: catalogPermission.denialReason ?? "permission_missing",
          },
          { status },
        ),
      );
    }
  }
  const result = await timing.measure("rpc", async () => {
    return saveChartOrderDraft({
      actorUserId: identity.actorUserId,
      workspaceId,
      input: {
        ...input,
        encounterId: resolvedEncounter.encounterId,
      },
      permissionAdapter,
      gateway: client
        ? createSupabaseChartOrderDraftGateway(
            client as unknown as SupabaseChartOrderDraftRpcClient,
          )
        : undefined,
    });
  });

  return timing.respond(Response.json(result, { status: result.status }), client
    ? {
        requestId,
        supabaseRequestId,
        submittedSet: input.rows.some((row) => row?.rowType === "set"),
        durations: upstreamDurations,
      }
    : undefined);
}

async function readJsonBody(request: Request): Promise<ChartOrderDraftInput> {
  try {
    const value = (await request.json()) as unknown;
    return value && typeof value === "object"
      ? (value as ChartOrderDraftInput)
      : {};
  } catch {
    return {};
  }
}
