import { loadWorkspacePermissionAdapterFromDb } from "@/features/auth/db-workspace-permission-adapter";
import { resolveWorkspacePermission } from "@/features/auth/permission-resolver";
import { readServerSession } from "@/features/auth/server-session-reader";
import {
  demoSessionUserIdHeader,
  resolveRoleUpdateActorIdentity,
} from "@/features/auth/server-role-update-identity";
import { createClient } from "@/lib/supabase/server";
import {
  createSupabaseWorkspacePermissionGateway,
  type SupabaseWorkspacePermissionClient,
} from "@/features/auth/supabase-workspace-permission-gateway";

type RouteContext = {
  params: Promise<{
    workspaceId: string;
  }>;
};

type LabResultSheetCatalogItem = {
  categoryId: string;
  categoryName: string;
  id: string;
  rowId?: string;
  resultInputType: "number" | "text" | "select" | "positive_negative" | "grade";
  resultValueKind?: "numeric" | "text" | "coded";
  decimalScale?: number;
  resultUnit?: string;
  sortOrder: number;
  testItemName: string;
};

type LabCatalogItemRow = {
  id?: unknown;
  in_hospital_order_name?: unknown;
  pricing_rule?: unknown;
  standard_order_name?: unknown;
};

type LabCatalogLinkRow = {
  lab_test_item_id?: unknown;
  sort_order?: unknown;
};

type LabTestItemRow = {
  category_id?: unknown;
  id?: unknown;
  result_input_type?: unknown;
  result_unit?: unknown;
  sort_order?: unknown;
  test_item_name?: unknown;
};

type LabTestCategoryRow = {
  category_name?: unknown;
  id?: unknown;
  sort_order?: unknown;
};

type SupabaseQueryBuilder = {
  eq: (column: string, value: unknown) => SupabaseQueryBuilder;
  in: (column: string, values: unknown[]) => SupabaseQueryBuilder;
  limit: (count: number) => SupabaseQueryBuilder;
  order: (column: string, options?: { ascending?: boolean }) => SupabaseQueryBuilder;
  select: (columns: string) => SupabaseQueryBuilder;
  then: <TResult1 = SupabaseQueryResult>(
    onfulfilled?: ((value: SupabaseQueryResult) => TResult1 | PromiseLike<TResult1>) | null,
  ) => Promise<TResult1>;
};

type SupabaseQueryResult = {
  data: unknown;
  error: { message?: string } | null;
};

type SupabaseCatalogClient = {
  from: (tableName: string) => SupabaseQueryBuilder;
  rpc: (
    functionName: "clair_get_lab_result_entry",
    args: {
      p_actor_user_id: string;
      p_order_id?: string | null;
      p_result_id?: string | null;
      p_work_item_id?: string | null;
      p_workspace_id: string;
    },
  ) => Promise<SupabaseQueryResult>;
};

const demoCatalogItems: Record<string, LabResultSheetCatalogItem[]> = {
  "den194-catalog-cbc": [
    {
      categoryId: "den194-labcat-hematology",
      categoryName: "Hematology",
      id: "den194-labitem-cbc-wbc",
      resultInputType: "number",
      resultUnit: "10^3/uL",
      sortOrder: 10,
      testItemName: "WBC",
    },
    {
      categoryId: "den194-labcat-hematology",
      categoryName: "Hematology",
      id: "den194-labitem-cbc-rbc",
      resultInputType: "number",
      resultUnit: "10^6/uL",
      sortOrder: 20,
      testItemName: "RBC",
    },
    {
      categoryId: "den194-labcat-hematology",
      categoryName: "Hematology",
      id: "den194-labitem-cbc-hct",
      resultInputType: "number",
      resultUnit: "%",
      sortOrder: 30,
      testItemName: "HCT",
    },
    {
      categoryId: "den194-labcat-hematology",
      categoryName: "Hematology",
      id: "den194-labitem-cbc-plt",
      resultInputType: "number",
      resultUnit: "10^3/uL",
      sortOrder: 40,
      testItemName: "Platelets",
    },
  ],
  "den194-catalog-urinalysis": [
    {
      categoryId: "den194-labcat-urinalysis",
      categoryName: "Urinalysis",
      id: "den194-labitem-ua-protein",
      resultInputType: "grade",
      sortOrder: 10,
      testItemName: "Protein",
    },
    {
      categoryId: "den194-labcat-urinalysis",
      categoryName: "Urinalysis",
      id: "den194-labitem-ua-ketones",
      resultInputType: "positive_negative",
      sortOrder: 20,
      testItemName: "Ketones",
    },
    {
      categoryId: "den194-labcat-urinalysis",
      categoryName: "Urinalysis",
      id: "den194-labitem-ua-specific-gravity",
      resultInputType: "number",
      sortOrder: 30,
      testItemName: "Specific gravity",
    },
    {
      categoryId: "den194-labcat-urinalysis",
      categoryName: "Urinalysis",
      id: "den194-labitem-ua-ph",
      resultInputType: "number",
      sortOrder: 40,
      testItemName: "pH",
    },
  ],
};

const catalogIdByServiceItemId: Record<string, string> = {
  "19429000-0000-4000-8000-000000000001": "den194-catalog-cbc",
  "19429000-0000-4000-8000-000000000005": "den194-catalog-urinalysis",
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
  const input = {
    catalogItemId: readOptionalParam(url, "catalogItemId"),
    orderId: readOptionalParam(url, "orderId"),
    orderDisplayName: readOptionalParam(url, "orderDisplayName"),
    resultId: readOptionalParam(url, "resultId"),
    serviceItemId: readOptionalParam(url, "serviceItemId"),
    workItemId: readOptionalParam(url, "workItemId"),
  };

  if (identity.source === "supabase_session") {
    const client = await createClient();
    if (!client) {
      return Response.json(
        { ok: false, status: 500, error: "supabase_client_missing" },
        { status: 500 },
      );
    }

    const requiredPermission =
      input.resultId || input.workItemId || input.orderId
        ? "lab:view"
        : "service_catalog:view";
    const permission = await resolveResultSheetCatalogPermission({
      client,
      requiredPermission,
      sessionUserId: identity.actorUserId,
      workspaceId,
    });
    if (!permission.ok) {
      return Response.json(permission.body, { status: permission.status });
    }

    const result = await readSupabaseResultSheetCatalog({
      actorUserId: identity.actorUserId,
      client: client as unknown as SupabaseCatalogClient,
      input,
      workspaceId,
    });
    return Response.json(result, { status: result.status });
  }

  const catalogItemId = resolveDemoCatalogItemId(input);
  const items = catalogItemId ? demoCatalogItems[catalogItemId] ?? [] : [];

  return Response.json(
    {
      ok: true,
      status: 200,
      catalogItemId,
      items,
      enforcedBy: "lab-result-sheet-catalog-read",
    },
    { status: 200 },
  );
}

function readOptionalParam(url: URL, key: string) {
  const value = url.searchParams.get(key)?.trim();
  return value ? value : undefined;
}

function resolveDemoCatalogItemId(input: {
  catalogItemId?: string;
  orderDisplayName?: string;
  serviceItemId?: string;
}) {
  if (input.catalogItemId) return input.catalogItemId;
  if (input.serviceItemId && catalogIdByServiceItemId[input.serviceItemId]) {
    return catalogIdByServiceItemId[input.serviceItemId];
  }

  const label = input.orderDisplayName?.toLowerCase() ?? "";
  if (label.includes("urinalysis") || label.includes("urinary") || label.includes("nabi")) {
    return "den194-catalog-urinalysis";
  }
  if (label.includes("cbc") || label.includes("kong")) return "den194-catalog-cbc";

  return undefined;
}

async function resolveResultSheetCatalogPermission({
  client,
  requiredPermission,
  sessionUserId,
  workspaceId,
}: {
  client: unknown;
  requiredPermission: "lab:view" | "service_catalog:view";
  sessionUserId: string;
  workspaceId: string;
}) {
  try {
    const adapter = await loadWorkspacePermissionAdapterFromDb({
      gateway: createSupabaseWorkspacePermissionGateway(
        client as SupabaseWorkspacePermissionClient,
      ),
      sessionUserId,
      workspaceId,
    });
    const permission = resolveWorkspacePermission(adapter, {
      requiredPermission,
      sessionUserId,
      workspaceId,
    });
    if (permission.allowed) return { ok: true as const };
    const status = permission.denialReason === "unauthenticated" ? 401 : 403;
    return {
      ok: false as const,
      status,
      body: {
        ok: false,
        status,
        denialReason: permission.denialReason ?? "permission_missing",
      },
    };
  } catch {
    return {
      ok: false as const,
      status: 500,
      body: { ok: false, status: 500, error: "permission_read_failed" },
    };
  }
}

async function readSupabaseResultSheetCatalog({
  actorUserId,
  client,
  input,
  workspaceId,
}: {
  actorUserId: string;
  client: SupabaseCatalogClient;
  input: {
    catalogItemId?: string;
    orderId?: string;
    orderDisplayName?: string;
    resultId?: string;
    serviceItemId?: string;
    workItemId?: string;
  };
  workspaceId: string;
}) {
  if (input.resultId || input.workItemId || input.orderId) {
    const result = await client.rpc("clair_get_lab_result_entry", {
      p_actor_user_id: actorUserId,
      p_order_id: input.orderId ?? null,
      p_result_id: input.resultId ?? null,
      p_work_item_id: input.workItemId ?? null,
      p_workspace_id: workspaceId,
    });
    if (result.error) {
      if (result.error.message?.includes("permission_missing")) {
        return { ok: false, status: 403, denialReason: "permission_missing" };
      }
      if (result.error.message?.includes("workspace_membership_missing")) {
        return {
          ok: false,
          status: 403,
          denialReason: "workspace_membership_missing",
        };
      }
      return { ok: false, status: 500, error: "db_read_failed" };
    }
    return mapStoredResultSheetSnapshot(result.data);
  }

  const catalogItemsResult = await client
    .from("order_catalog_items")
    .select("id, standard_order_name, in_hospital_order_name, pricing_rule")
    .eq("workspace_id", workspaceId)
    .eq("category_group", "lab")
    .limit(50);
  if (catalogItemsResult.error) {
    return { ok: false, status: 500, error: "db_read_failed" };
  }

  const catalogItemId =
    input.catalogItemId ??
    resolveCatalogItemIdFromRows(
      Array.isArray(catalogItemsResult.data)
        ? (catalogItemsResult.data as LabCatalogItemRow[])
        : [],
      input,
    );
  if (!catalogItemId) {
    return {
      ok: true,
      status: 200,
      catalogItemId: undefined,
      items: [],
      enforcedBy: "lab-result-sheet-catalog-read",
    };
  }

  const linksResult = await client
    .from("order_catalog_lab_test_item_links")
    .select("lab_test_item_id, sort_order")
    .eq("workspace_id", workspaceId)
    .eq("order_catalog_item_id", catalogItemId)
    .order("sort_order", { ascending: true });
  if (linksResult.error) {
    return { ok: false, status: 500, error: "db_read_failed" };
  }

  const links = Array.isArray(linksResult.data)
    ? (linksResult.data as LabCatalogLinkRow[])
    : [];
  const itemIds = links
    .map((link) => readString(link.lab_test_item_id))
    .filter((itemId): itemId is string => Boolean(itemId));
  if (!itemIds.length) {
    return {
      ok: true,
      status: 200,
      catalogItemId,
      items: [],
      enforcedBy: "lab-result-sheet-catalog-read",
    };
  }

  const itemsResult = await client
    .from("lab_test_items")
    .select("id, category_id, test_item_name, result_input_type, result_unit, sort_order")
    .eq("workspace_id", workspaceId)
    .in("id", itemIds)
    .eq("availability_status", "active")
    .order("sort_order", { ascending: true });
  if (itemsResult.error) {
    return { ok: false, status: 500, error: "db_read_failed" };
  }

  const items = Array.isArray(itemsResult.data)
    ? (itemsResult.data as LabTestItemRow[])
    : [];
  const categoryIds = Array.from(
    new Set(
      items
        .map((item) => readString(item.category_id))
        .filter((categoryId): categoryId is string => Boolean(categoryId)),
    ),
  );
  const categoriesResult = categoryIds.length
    ? await client
        .from("lab_test_categories")
        .select("id, category_name, sort_order")
        .eq("workspace_id", workspaceId)
        .in("id", categoryIds)
        .order("sort_order", { ascending: true })
    : { data: [], error: null };
  if (categoriesResult.error) {
    return { ok: false, status: 500, error: "db_read_failed" };
  }

  const categoriesById = new Map(
    (Array.isArray(categoriesResult.data)
      ? (categoriesResult.data as LabTestCategoryRow[])
      : []
    ).map((category) => [
      readString(category.id) ?? "",
      readString(category.category_name) ?? "Uncategorized",
    ]),
  );
  const itemsById = new Map(
    items.map((item) => [readString(item.id) ?? "", item]),
  );
  const rows = links
    .map((link) => {
      const itemId = readString(link.lab_test_item_id);
      const item = itemId ? itemsById.get(itemId) : undefined;
      if (!itemId || !item) return null;
      const categoryId = readString(item.category_id) ?? "uncategorized";
      const row: LabResultSheetCatalogItem = {
        categoryId,
        categoryName: categoriesById.get(categoryId) ?? "Uncategorized",
        id: itemId,
        resultInputType: readResultInputType(item.result_input_type),
        resultUnit: readString(item.result_unit),
        sortOrder: readNumber(link.sort_order) ?? readNumber(item.sort_order) ?? 0,
        testItemName: readString(item.test_item_name) ?? itemId,
      };
      return row;
    })
    .filter((item): item is LabResultSheetCatalogItem => Boolean(item));

  return {
    ok: true,
    status: 200,
    catalogItemId,
    items: rows,
    enforcedBy: "lab-result-sheet-catalog-read",
  };
}

function mapStoredResultSheetSnapshot(data: unknown) {
  if (!data || typeof data !== "object") {
    return { ok: false, status: 500, error: "db_read_failed" };
  }
  const response = data as Record<string, unknown>;
  const savedResult =
    response.savedResult && typeof response.savedResult === "object"
      ? (response.savedResult as Record<string, unknown>)
      : response;
  const rows = Array.isArray(savedResult.rows) ? savedResult.rows : [];
  const items = rows.flatMap((value, index) => {
    if (!value || typeof value !== "object") return [];
    const row = value as Record<string, unknown>;
    const itemId = readString(row.labTestItemId);
    const rowId = readString(row.id) ?? readString(row.rowId);
    if (!itemId || !rowId) return [];
    return [
      {
        categoryId: "result-snapshot",
        categoryName: "결과 스냅샷",
        decimalScale: readNumber(row.decimalScale),
        id: itemId,
        resultInputType: readResultInputType(row.resultInputType),
        resultValueKind: readResultValueKind(row.resultValueKind),
        resultUnit: readString(row.unit),
        rowId,
        sortOrder:
          readNumber(row.effectiveSortOrder) ??
          readNumber(row.sourceOrdinal) ??
          index,
        testItemName: readString(row.analyteName) ?? itemId,
      } satisfies LabResultSheetCatalogItem,
    ];
  });
  return {
    ok: true,
    status: 200,
    catalogItemId: undefined,
    items,
    enforcedBy: "lab-result-definition-snapshot-read",
  };
}

function resolveCatalogItemIdFromRows(
  rows: LabCatalogItemRow[],
  input: { orderDisplayName?: string; serviceItemId?: string },
) {
  if (input.serviceItemId) {
    const row = rows.find((item) => {
      const pricingRule = item.pricing_rule;
      return (
        pricingRule &&
        typeof pricingRule === "object" &&
        "linkedServiceItemId" in pricingRule &&
        pricingRule.linkedServiceItemId === input.serviceItemId
      );
    });
    const id = readString(row?.id);
    if (id) return id;
  }

  const label = input.orderDisplayName?.toLowerCase() ?? "";
  if (!label) return undefined;
  const row = rows.find((item) => {
    const standardName = readString(item.standard_order_name)?.toLowerCase() ?? "";
    const inHospitalName = readString(item.in_hospital_order_name)?.toLowerCase() ?? "";
    return standardName.includes(label) || inHospitalName.includes(label) || label.includes(inHospitalName);
  });
  return readString(row?.id);
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readResultInputType(value: unknown): LabResultSheetCatalogItem["resultInputType"] {
  if (
    value === "number" ||
    value === "text" ||
    value === "select" ||
    value === "positive_negative" ||
    value === "grade"
  ) {
    return value;
  }

  return "text";
}

function readResultValueKind(
  value: unknown,
): NonNullable<LabResultSheetCatalogItem["resultValueKind"]> | undefined {
  if (value === "numeric" || value === "text" || value === "coded") {
    return value;
  }
  return undefined;
}
