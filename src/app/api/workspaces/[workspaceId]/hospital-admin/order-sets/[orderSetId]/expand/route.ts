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
  createSupabaseOrderCatalogGateway,
  expandOrderSetForChart,
  getDemoOrderCatalogGateway,
  type ChartOrderSetSelectionIntent,
  type SupabaseOrderCatalogRpcClient,
} from "@/features/hospital-admin/server-order-catalog";
import { demoClientSessionIdHeader } from "@/features/auth/demo-actor";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ orderSetId: string; workspaceId: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const { orderSetId, workspaceId } = await params;
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
  const encounterId = url.searchParams.get("encounterId")?.trim();
  const revisionId = url.searchParams.get("revisionId")?.trim();
  if (!encounterId || !revisionId) {
    return Response.json(
      { ok: false, status: 400, error: "invalid_order_set_selection", message: "진료 차트와 세트 버전을 확인해 주세요." },
      { status: 400 },
    );
  }
  const selectionIntent = parseSelectionIntent(url.searchParams.get("selectionIntent"));
  if (!selectionIntent) {
    return Response.json(
      { ok: false, status: 400, error: "invalid_order_set_selection", message: "세트 구성 선택을 확인해 주세요." },
      { status: 400 },
    );
  }
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
  const gateway = identity.source === "demo_header_mock_mode"
    ? getDemoOrderCatalogGateway(request.headers.get(demoClientSessionIdHeader) ?? "shared")
    : client
      ? createSupabaseOrderCatalogGateway(client as unknown as SupabaseOrderCatalogRpcClient)
      : undefined;

  const result = await expandOrderSetForChart({
    actorUserId: identity.actorUserId,
    encounterId,
    gateway,
    workspaceId,
    orderSetId,
    permissionAdapter,
    revisionId,
    selectionIntent,
  });

  return Response.json(result, { status: result.status });
}

function parseSelectionIntent(value: string | null): ChartOrderSetSelectionIntent | null {
  if (!value) return { items: [] };
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const input = parsed as Record<string, unknown>;
    const inputKeys = Object.keys(input);
    if (
      (inputKeys.length !== 1 && inputKeys.length !== 2) ||
      !inputKeys.every((key) => key === "items" || key === "rangeInput") ||
      !Array.isArray(input.items)
    ) return null;
    if (
      input.rangeInput !== undefined &&
      (typeof input.rangeInput !== "number" ||
        !Number.isFinite(input.rangeInput) ||
        input.rangeInput < 0 ||
        input.rangeInput > 999999999.999 ||
        input.rangeInput !== Math.round(input.rangeInput * 1000) / 1000)
    ) return null;
    const ids = new Set<string>();
    const items = input.items.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item));
    if (items.length !== input.items.length) return null;
    for (const item of items) {
      if (Object.keys(item).length !== 3 || typeof item.revisionItemId !== "string" || !item.revisionItemId.trim() || typeof item.selected !== "boolean" || typeof item.quantity !== "number" || !Number.isFinite(item.quantity) || item.quantity <= 0 || ids.has(item.revisionItemId)) return null;
      ids.add(item.revisionItemId);
    }
    return {
      items: items as ChartOrderSetSelectionIntent["items"],
      ...(input.rangeInput === undefined ? {} : { rangeInput: input.rangeInput }),
    };
  } catch {
    return null;
  }
}
