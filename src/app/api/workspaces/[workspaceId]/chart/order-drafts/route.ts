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
import { createClient } from "@/lib/supabase/server";

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

  const rateLimitResponse = enforceWorkspaceMutationRateLimit({
    request,
    actorUserId: identity.actorUserId,
    workspaceId,
    operation: "chart_order_draft_save",
  });
  if (rateLimitResponse) return rateLimitResponse;

  const input = await readJsonBody(request);
  const expectedEtagHeader = request.headers.get(
    chartOrderExpectedEtagHeader,
  );
  const inputKeys = Object.keys(input as Record<string, unknown>);
  if (
    inputKeys.some(
      (key) =>
        key !== "encounterId" &&
        key !== "expectedEtag" &&
        key !== "removedOrderIds" &&
        key !== "rows",
    )
  ) {
    return Response.json(
      {
        ok: false,
        status: 400,
        error: "invalid_input",
        fieldErrors: { rows: "오더 rows 형식을 확인해 주세요." },
      },
      { status: 400 },
    );
  }
  if (!Array.isArray(input.rows) || !input.expectedEtag) {
    return Response.json(
      { ok: false, status: 428, error: "if_match_required", message: "오더 버전 확인이 필요합니다." },
      { status: 428 },
    );
  }
  if (
    input.removedOrderIds !== undefined &&
    !Array.isArray(input.removedOrderIds)
  ) {
    return Response.json(
      {
        ok: false,
        status: 400,
        error: "invalid_input",
        fieldErrors: { removedOrderIds: "삭제할 오더 후보를 확인해 주세요." },
      },
      { status: 400 },
    );
  }
  if (!expectedEtagHeader) {
    return Response.json(
      { ok: false, status: 428, error: "if_match_required", message: "오더 버전 확인이 필요합니다." },
      { status: 428 },
    );
  }
  if (expectedEtagHeader !== input.expectedEtag) {
    return Response.json(
      { ok: false, status: 400, error: "etag_header_body_mismatch", message: "오더 버전 정보가 일치하지 않습니다." },
      { status: 400 },
    );
  }
  const client = identity.source === "supabase_session" ? await createClient() : null;
  const resolvedEncounter = await resolveServerChartEncounterId({
    client: client as unknown as SupabaseEncounterIdBridgeClient | null,
    encounterId: input.encounterId,
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
  const result = await saveChartOrderDraft({
    actorUserId: identity.actorUserId,
    workspaceId,
    input: { ...input, encounterId: resolvedEncounter.encounterId },
    permissionAdapter,
    gateway: client
      ? createSupabaseChartOrderDraftGateway(
          client as unknown as SupabaseChartOrderDraftRpcClient
        )
      : undefined,
  });

  return Response.json(result, { status: result.status });
}

async function readJsonBody(request: Request): Promise<ChartOrderDraftInput> {
  try {
    const value = (await request.json()) as unknown;
    return value && typeof value === "object" ? value as ChartOrderDraftInput : {};
  } catch {
    return {};
  }
}
