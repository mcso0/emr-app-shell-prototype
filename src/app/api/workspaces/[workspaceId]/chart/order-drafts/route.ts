import { readServerSession } from "@/features/auth/server-session-reader";
import { loadWorkspacePermissionAdapterFromDb } from "@/features/auth/db-workspace-permission-adapter";
import { resolveWorkspacePermission } from "@/features/auth/permission-resolver";
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
  type ChartOrderDraftRowInput,
  type SupabaseChartOrderDraftRpcClient,
} from "@/features/chart/server-order-draft-persistence";
import {
  createSupabaseChartPreconsultationContextGateway,
  type SupabaseChartPreconsultationContextClient,
} from "@/features/chart/server-preconsultation-context-core";
import {
  createSupabaseOrderCatalogGateway,
  type SupabaseOrderCatalogRpcClient,
} from "@/features/hospital-admin/server-order-catalog-core";
import { chartOrderExpectedEtagHeader } from "@/features/chart/order-version-contract";
import {
  resolveServerChartEncounterId,
  type SupabaseEncounterIdBridgeClient,
} from "@/features/chart/server-encounter-id-bridge";
import { enforceWorkspaceMutationRateLimit } from "@/lib/security/rate-limit";
import { createServerTimingRecorder } from "@/lib/http/server-timing";
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
  const draftRows = input.rows;
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
  const permissionContext = await timing.measure("permission", async () => {
    const client = identity.source === "supabase_session" ? await createClient() : null;
    const resolvedEncounter = await resolveServerChartEncounterId({
      client: client as unknown as SupabaseEncounterIdBridgeClient | null,
      encounterId: input.encounterId,
      workspaceId,
    });
    if (!resolvedEncounter.ok) return { ok: false as const, resolvedEncounter };
    const permissionAdapter = client
      ? await loadWorkspacePermissionAdapterFromDb({
          gateway: createSupabaseWorkspacePermissionGateway(
            client as unknown as SupabaseWorkspacePermissionClient,
          ),
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
  }
  const result = await timing.measure("rpc", async () => {
    const runtimeRows = client
      ? await resolveConsultationRuntimeRows({
          client:
            client as unknown as ConsultationRuntimeResolutionInput["client"],
          encounterId: resolvedEncounter.encounterId,
          rows: draftRows,
          workspaceId,
        })
      : draftRows;
    return saveChartOrderDraft({
      actorUserId: identity.actorUserId,
      workspaceId,
      input: {
        ...input,
        encounterId: resolvedEncounter.encounterId,
        ...(runtimeRows ? { rows: runtimeRows } : {}),
      },
      permissionAdapter,
      gateway: client
        ? createSupabaseChartOrderDraftGateway(
            client as unknown as SupabaseChartOrderDraftRpcClient,
          )
        : undefined,
    });
  });

  return timing.respond(Response.json(result, { status: result.status }));
}

async function readJsonBody(request: Request): Promise<ChartOrderDraftInput> {
  try {
    const value = (await request.json()) as unknown;
    return value && typeof value === "object" ? value as ChartOrderDraftInput : {};
  } catch {
    return {};
  }
}

type ConsultationRuntimeResolutionInput = {
  client: SupabaseChartPreconsultationContextClient &
    SupabaseOrderCatalogRpcClient;
  encounterId: string;
  rows: ChartOrderDraftRowInput[];
  workspaceId: string;
};

async function resolveConsultationRuntimeRows({
  client,
  encounterId,
  rows,
  workspaceId,
}: ConsultationRuntimeResolutionInput): Promise<ChartOrderDraftRowInput[]> {
  const [contextResult, catalogResult] = await Promise.all([
    createSupabaseChartPreconsultationContextGateway(client).readContext({
      encounterId,
      workspaceId,
    }),
    createSupabaseOrderCatalogGateway(client).listChartSearch({ workspaceId }),
  ]);
  const primaryVeterinarianId =
    contextResult.ok ? contextResult.context.veterinarian?.id : undefined;
  const consultationCatalogItemIds = new Set(
    catalogResult.rows
      .filter(
        (row) =>
          row.rowType === "individual" &&
          row.clinicalOrderType === "consultation" &&
          typeof row.workspaceCatalogItemId === "string",
      )
      .map((row) => row.workspaceCatalogItemId as string),
  );
  const consultationSetChildKeys = new Set<string>();
  const catalogGateway = createSupabaseOrderCatalogGateway(client);
  await Promise.all(
    rows
      .filter(
        (row): row is Extract<ChartOrderDraftRowInput, { rowType: "set" }> =>
          row.rowType === "set" && Boolean(row.childInputs?.length),
      )
      .map(async (row) => {
        const preview = await catalogGateway.previewOrderSet?.({
          encounterId,
          orderSetId: row.sourceSetId,
          revisionId: row.sourceSetRevisionId,
          selectionIntent: row.selectionIntent,
          workspaceId,
        });
        if (!preview?.ok) return;
        for (const item of preview.preview.items) {
          if (item.appliedSnapshot?.clinicalOrderType !== "consultation") {
            continue;
          }
          consultationSetChildKeys.add(
            buildConsultationSetChildKey(
              row.sourceSetId,
              row.sourceSetRevisionId,
              item.revisionItemId,
            ),
          );
        }
      }),
  );

  return rows.map((row) => {
    if (row.rowType === "individual") {
      if (!consultationCatalogItemIds.has(row.workspaceCatalogItemId)) {
        return row;
      }
      return {
        ...row,
        ...mergeConsultationRuntimeInput({
          detailInputs: row.detailInputs,
          detailSchemaVersion: row.detailSchemaVersion,
          primaryVeterinarianId,
        }),
      };
    }

    const childInputs = row.childInputs?.map((child) => {
      const isConsultation = consultationSetChildKeys.has(
        buildConsultationSetChildKey(
          row.sourceSetId,
          row.sourceSetRevisionId,
          child.revisionItemId,
        ),
      );
      if (!isConsultation) return child;
      return {
        ...child,
        ...mergeConsultationRuntimeInput({
          detailInputs: child.detailInputs,
          detailSchemaVersion: child.detailSchemaVersion,
          primaryVeterinarianId,
        }),
      };
    });
    return childInputs ? { ...row, childInputs } : row;
  });
}

function mergeConsultationRuntimeInput({
  detailInputs,
  detailSchemaVersion,
  primaryVeterinarianId,
}: {
  detailInputs?: Record<string, unknown>;
  detailSchemaVersion?: number;
  primaryVeterinarianId?: string;
}) {
  const nextDetailInputs = { ...(detailInputs ?? {}) };
  const normalizedPrimaryVeterinarianId = primaryVeterinarianId?.trim();
  if (normalizedPrimaryVeterinarianId) {
    nextDetailInputs.responsibleClinicianId = normalizedPrimaryVeterinarianId;
  } else {
    delete nextDetailInputs.responsibleClinicianId;
  }
  return {
    detailInputs: nextDetailInputs,
    detailSchemaVersion: detailSchemaVersion ?? 1,
  };
}

function buildConsultationSetChildKey(
  sourceSetId: string,
  sourceSetRevisionId: string,
  revisionItemId: string,
) {
  return `${sourceSetId}:${sourceSetRevisionId}:${revisionItemId}`;
}
