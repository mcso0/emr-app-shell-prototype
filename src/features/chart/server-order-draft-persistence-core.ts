import {
  createMockWorkspacePermissionAdapter,
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";
import { mockEncounters, mockInvoiceLines, mockOrders } from "@/mocks/emr-domain";
import type { EmrOrder, Encounter, InvoiceLine } from "@/types/emr-domain";

export type ChartOrderDraftLineInput = {
  orderId?: string;
  billingDisplayName?: string;
  quantity?: number;
};

export type ChartOrderDraftInput = {
  encounterId?: string;
  orders?: ChartOrderDraftLineInput[];
};

export type ChartOrderDraftLine = {
  billingDisplayName: string;
  encounterId: string;
  lineTotalSnapshot: number;
  orderId: string;
  quantity: number;
  unitPriceSnapshot: number;
  updatedAt: string;
};

type NormalizedOrderDraftLineInput = Required<ChartOrderDraftLineInput>;

export type ChartOrderDraftGatewayResult =
  | { ok: true; orderDrafts: ChartOrderDraftLine[] }
  | { ok: false; status: 409; denialReason: "encounter_unavailable" }
  | { ok: false; status: 500; error: "db_read_failed" | "db_write_failed" };

export type ChartOrderDraftGateway = {
  readOrderDraft(input: {
    encounterId: string;
    workspaceId: string;
  }): Promise<ChartOrderDraftGatewayResult>;
  saveOrderDraft(input: {
    actorUserId: string;
    encounterId: string;
    orders: NormalizedOrderDraftLineInput[];
    workspaceId: string;
  }): Promise<ChartOrderDraftGatewayResult>;
};

export type ChartOrderDraftReadResult =
  | {
      ok: true;
      status: 200;
      orderDrafts: ChartOrderDraftLine[];
      enforcedBy: "chart-order-draft-persistence";
    }
  | {
      ok: false;
      status: 400;
      error: "invalid_input";
      fieldErrors: Partial<Record<"encounterId", string>>;
    }
  | { ok: false; status: 401 | 403; denialReason: WorkspacePermissionDenialReason }
  | { ok: false; status: 409; denialReason: "encounter_unavailable" }
  | { ok: false; status: 500; error: "db_read_failed" | "supabase_client_missing" };

export type ChartOrderDraftSaveResult =
  | {
      ok: true;
      status: 200;
      orderDrafts: ChartOrderDraftLine[];
      enforcedBy: "chart-order-draft-persistence";
    }
  | {
      ok: false;
      status: 400;
      error: "invalid_input";
      fieldErrors: Partial<Record<"encounterId" | "orders", string>>;
    }
  | { ok: false; status: 401 | 403; denialReason: WorkspacePermissionDenialReason }
  | { ok: false; status: 409; denialReason: "encounter_unavailable" }
  | { ok: false; status: 500; error: "db_write_failed" | "supabase_client_missing" };

const mockOrderDraftStore = new Map<string, ChartOrderDraftLine[]>();

export async function readChartOrderDraft({
  actorUserId,
  encounterId,
  gateway = createMockChartOrderDraftGateway(),
  permissionAdapter = createDemoChartOrderDraftPermissionAdapter(),
  workspaceId,
}: {
  actorUserId: string | null;
  encounterId: string | null | undefined;
  gateway?: Pick<ChartOrderDraftGateway, "readOrderDraft">;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<ChartOrderDraftReadResult> {
  const normalizedEncounterId = trimToUndefined(encounterId);

  if (!normalizedEncounterId) {
    return {
      ok: false,
      status: 400,
      error: "invalid_input",
      fieldErrors: { encounterId: "진료 차트를 선택해 주세요." },
    };
  }

  const permission = resolveWorkspacePermission(permissionAdapter, {
    sessionUserId: actorUserId,
    workspaceId,
    requiredPermission: "chart:view",
  });

  if (!permission.allowed) {
    return {
      ok: false,
      status: permission.denialReason === "unauthenticated" ? 401 : 403,
      denialReason: permission.denialReason ?? "permission_missing",
    };
  }

  const result = await gateway.readOrderDraft({ encounterId: normalizedEncounterId, workspaceId });

  if (!result.ok) {
    if (result.status === 409) return result;
    return { ok: false, status: 500, error: "db_read_failed" };
  }

  return {
    ok: true,
    status: 200,
    orderDrafts: result.orderDrafts,
    enforcedBy: "chart-order-draft-persistence",
  };
}

export async function saveChartOrderDraft({
  actorUserId,
  gateway = createMockChartOrderDraftGateway(),
  input,
  permissionAdapter = createDemoChartOrderDraftPermissionAdapter(),
  workspaceId,
}: {
  actorUserId: string | null;
  gateway?: Pick<ChartOrderDraftGateway, "saveOrderDraft">;
  input: ChartOrderDraftInput;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<ChartOrderDraftSaveResult> {
  const normalized = normalizeOrderDraftInput(input);
  const validation = validateOrderDraftInput(normalized);

  if (!validation.valid) {
    return {
      ok: false,
      status: 400,
      error: "invalid_input",
      fieldErrors: validation.fieldErrors,
    };
  }

  const permission = resolveWorkspacePermission(permissionAdapter, {
    sessionUserId: actorUserId,
    workspaceId,
    requiredPermission: "chart:update",
  });

  if (!permission.allowed) {
    return {
      ok: false,
      status: permission.denialReason === "unauthenticated" ? 401 : 403,
      denialReason: permission.denialReason ?? "permission_missing",
    };
  }

  const result = await gateway.saveOrderDraft({
    actorUserId: actorUserId ?? "",
    encounterId: normalized.encounterId,
    orders: normalized.orders,
    workspaceId,
  });

  if (!result.ok) {
    if (result.status === 409) return result;
    return { ok: false, status: 500, error: "db_write_failed" };
  }

  return {
    ok: true,
    status: 200,
    orderDrafts: result.orderDrafts,
    enforcedBy: "chart-order-draft-persistence",
  };
}

export function createMockChartOrderDraftGateway(
  dataset: {
    encounters?: Encounter[];
    invoiceLines?: InvoiceLine[];
    orders?: EmrOrder[];
  } = {
    encounters: mockEncounters,
    invoiceLines: mockInvoiceLines,
    orders: mockOrders,
  },
  now = () => new Date().toISOString()
): ChartOrderDraftGateway {
  const encounters = dataset.encounters ?? [];
  const invoiceLines = dataset.invoiceLines ?? [];
  const orders = dataset.orders ?? [];

  return {
    async readOrderDraft({ encounterId, workspaceId }) {
      const encounter = findEncounter(encounters, workspaceId, encounterId);
      if (!encounter) return { ok: false, status: 409, denialReason: "encounter_unavailable" };

      return {
        ok: true,
        orderDrafts: getStoredOrSeedOrderDrafts({ encounterId, invoiceLines, orders, workspaceId }),
      };
    },
    async saveOrderDraft({ encounterId, orders: draftRows, workspaceId }) {
      const encounter = findEncounter(encounters, workspaceId, encounterId);
      if (!encounter) return { ok: false, status: 409, denialReason: "encounter_unavailable" };

      const seedRows = getStoredOrSeedOrderDrafts({ encounterId, invoiceLines, orders, workspaceId });
      const timestamp = now();
      const rows = draftRows.map((draft) => {
        const seed = seedRows.find((row) => row.orderId === draft.orderId);
        const unitPriceSnapshot = seed?.unitPriceSnapshot ?? 0;

        return {
          billingDisplayName: draft.billingDisplayName,
          encounterId,
          lineTotalSnapshot: roundMoney(draft.quantity * unitPriceSnapshot),
          orderId: draft.orderId,
          quantity: draft.quantity,
          unitPriceSnapshot,
          updatedAt: timestamp,
        } satisfies ChartOrderDraftLine;
      });

      mockOrderDraftStore.set(buildOrderDraftKey(workspaceId, encounterId), rows);

      return { ok: true, orderDrafts: rows };
    },
  };
}

export type SupabaseChartOrderDraftRpcClient = {
  rpc(
    functionName: "clair_get_chart_order_draft",
    args: {
      p_workspace_id: string;
      p_encounter_id: string;
    }
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
  rpc(
    functionName: "clair_save_chart_order_draft",
    args: {
      p_workspace_id: string;
      p_actor_user_id: string;
      p_encounter_id: string;
      p_orders: Array<{
        billingDisplayName: string;
        orderId?: string;
        quantity: number;
      }>;
    }
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
};

export function createSupabaseChartOrderDraftGateway(
  client: SupabaseChartOrderDraftRpcClient
): ChartOrderDraftGateway {
  return {
    async readOrderDraft({ encounterId, workspaceId }) {
      const { data, error } = await client.rpc("clair_get_chart_order_draft", {
        p_workspace_id: workspaceId,
        p_encounter_id: encounterId,
      });

      if (error) {
        if (error.message?.includes("encounter_unavailable")) {
          return { ok: false, status: 409, denialReason: "encounter_unavailable" };
        }
        return { ok: false, status: 500, error: "db_read_failed" };
      }

      return { ok: true, orderDrafts: mapOrderDraftRows(data) };
    },
    async saveOrderDraft({ actorUserId, encounterId, orders, workspaceId }) {
      const { data, error } = await client.rpc("clair_save_chart_order_draft", {
        p_workspace_id: workspaceId,
        p_actor_user_id: actorUserId,
        p_encounter_id: encounterId,
        p_orders: orders.map((order) => ({
          orderId: normalizeUuidForRpc(order.orderId),
          billingDisplayName: order.billingDisplayName,
          quantity: order.quantity,
        })),
      });

      if (error) {
        if (error.message?.includes("encounter_unavailable")) {
          return { ok: false, status: 409, denialReason: "encounter_unavailable" };
        }
        return { ok: false, status: 500, error: "db_write_failed" };
      }

      return { ok: true, orderDrafts: mapOrderDraftRows(data) };
    },
  };
}

export function createDemoChartOrderDraftPermissionAdapter() {
  return createMockWorkspacePermissionAdapter({
    users: [
      { id: "playwright-default-session", status: "active", displayName: "Playwright Admin" },
      { id: "user-admin", status: "active", displayName: "송민재" },
      { id: "user-front-desk", status: "active", displayName: "최유나" },
      { id: "user-vet", status: "active", displayName: "이수지" },
      { id: "user-tech", status: "active", displayName: "송하윤" },
    ],
    memberships: [
      {
        id: "membership-playwright-admin",
        workspaceId: "clair-demo",
        userId: "playwright-default-session",
        roles: ["hospital_admin"],
        status: "active",
      },
      {
        id: "membership-admin",
        workspaceId: "clair-demo",
        userId: "user-admin",
        roles: ["hospital_admin"],
        status: "active",
      },
      {
        id: "membership-front-desk",
        workspaceId: "clair-demo",
        userId: "user-front-desk",
        roles: ["front_desk"],
        status: "active",
      },
      {
        id: "membership-vet",
        workspaceId: "clair-demo",
        userId: "user-vet",
        roles: ["vet"],
        status: "active",
      },
      {
        id: "membership-tech",
        workspaceId: "clair-demo",
        userId: "user-tech",
        roles: ["technician"],
        status: "active",
      },
    ],
  });
}

function findEncounter(encounters: Encounter[], workspaceId: string, encounterId: string) {
  return encounters.find(
    (encounter) =>
      encounter.id === encounterId &&
      encounter.workspaceId === workspaceId &&
      encounter.status !== "cancelled"
  );
}

function getStoredOrSeedOrderDrafts({
  encounterId,
  invoiceLines,
  orders,
  workspaceId,
}: {
  encounterId: string;
  invoiceLines: InvoiceLine[];
  orders: EmrOrder[];
  workspaceId: string;
}) {
  const stored = mockOrderDraftStore.get(buildOrderDraftKey(workspaceId, encounterId));
  if (stored) return stored;

  return orders
    .filter((order) => order.workspaceId === workspaceId && order.encounterId === encounterId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((order) => {
      const invoiceLine = invoiceLines.find((line) => line.orderId === order.id);
      const unitPriceSnapshot = invoiceLine?.unitPrice ?? 0;
      const quantity = invoiceLine?.quantity ?? 1;

      return {
        billingDisplayName: invoiceLine?.description ?? order.displayName,
        encounterId,
        lineTotalSnapshot: roundMoney(quantity * unitPriceSnapshot),
        orderId: order.id,
        quantity,
        unitPriceSnapshot,
        updatedAt: order.updatedAt,
      };
    });
}

function buildOrderDraftKey(workspaceId: string, encounterId: string) {
  return `${workspaceId}:${encounterId}`;
}

function normalizeOrderDraftInput(input: ChartOrderDraftInput) {
  return {
    encounterId: trimToUndefined(input.encounterId) ?? "",
    orders: Array.isArray(input.orders)
      ? input.orders.map((row) => ({
          orderId: trimToUndefined(row.orderId) ?? "",
          billingDisplayName: normalizeField(row.billingDisplayName),
          quantity: typeof row.quantity === "number" ? row.quantity : Number(row.quantity),
        }))
      : [],
  };
}

function validateOrderDraftInput(input: ReturnType<typeof normalizeOrderDraftInput>) {
  const fieldErrors: Partial<Record<"encounterId" | "orders", string>> = {};

  if (!input.encounterId) fieldErrors.encounterId = "진료 차트를 선택해 주세요.";
  if (input.orders.length > 100) fieldErrors.orders = "오더 row가 너무 많습니다.";

  const hasInvalidRow = input.orders.some(
    (row) =>
      !row.orderId ||
      !row.billingDisplayName ||
      row.billingDisplayName.length > 500 ||
      !Number.isFinite(row.quantity) ||
      row.quantity <= 0 ||
      row.quantity > 9999
  );
  if (hasInvalidRow) fieldErrors.orders = "오더 수량을 확인해 주세요.";

  if (Object.keys(fieldErrors).length > 0) {
    return { valid: false as const, fieldErrors };
  }

  return { valid: true as const, fieldErrors: {} };
}

function normalizeField(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function trimToUndefined(value?: string | null) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function normalizeUuidForRpc(value?: string) {
  return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : undefined;
}

function mapOrderDraftRows(value: unknown): ChartOrderDraftLine[] {
  if (!Array.isArray(value)) return [];

  return value.reduce<ChartOrderDraftLine[]>((rows, item) => {
    const row = mapOrderDraftRow(item);
    if (row) rows.push(row);
    return rows;
  }, []);
}

function mapOrderDraftRow(value: unknown): ChartOrderDraftLine | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<ChartOrderDraftLine>;

  if (
    typeof row.orderId !== "string" ||
    typeof row.encounterId !== "string" ||
    typeof row.billingDisplayName !== "string" ||
    typeof row.quantity !== "number" ||
    typeof row.unitPriceSnapshot !== "number" ||
    typeof row.lineTotalSnapshot !== "number" ||
    typeof row.updatedAt !== "string"
  ) {
    return null;
  }

  return {
    billingDisplayName: row.billingDisplayName,
    encounterId: row.encounterId,
    lineTotalSnapshot: row.lineTotalSnapshot,
    orderId: row.orderId,
    quantity: row.quantity,
    unitPriceSnapshot: row.unitPriceSnapshot,
    updatedAt: row.updatedAt,
  };
}
