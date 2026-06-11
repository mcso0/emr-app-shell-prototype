import { readServerSession } from "@/features/auth/server-session-reader";
import {
  demoSessionUserIdHeader,
  resolveRoleUpdateActorIdentity,
} from "@/features/auth/server-role-update-identity";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    workspaceId: string;
  }>;
};

type LabResultSheetCatalogItem = {
  categoryId: string;
  categoryName: string;
  id: string;
  resultInputType: "number" | "text" | "select" | "positive_negative" | "grade";
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
    orderDisplayName: readOptionalParam(url, "orderDisplayName"),
    serviceItemId: readOptionalParam(url, "serviceItemId"),
  };

  if (identity.source === "supabase_session") {
    const client = await createClient();
    if (!client) {
      return Response.json(
        { ok: false, status: 500, error: "supabase_client_missing" },
        { status: 500 },
      );
    }

    const result = await readSupabaseResultSheetCatalog({
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

async function readSupabaseResultSheetCatalog({
  client,
  input,
  workspaceId,
}: {
  client: SupabaseCatalogClient;
  input: {
    catalogItemId?: string;
    orderDisplayName?: string;
    serviceItemId?: string;
  };
  workspaceId: string;
}) {
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
