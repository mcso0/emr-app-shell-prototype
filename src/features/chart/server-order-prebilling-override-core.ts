import {
  createMockWorkspacePermissionAdapter,
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";
import { calculatePlanOrderCharge } from "@/features/chart/plan-order-authority-domain";

export type ChartOrderPrebillingOverridePatch = {
  adjustmentAmountKrw?: number;
  adjustmentPercent?: number;
  adjustmentReason?: string | null;
  adjustmentSource?: "amount" | "percent" | null;
  billingName?: string;
  billingQuantity?: number;
  billingReflectionEnabled?: boolean;
};

export type ChartOrderPrebillingOverride = {
  adjustmentAmountKrw: number;
  adjustmentPercent: number;
  adjustmentReason: string | null;
  adjustmentSource: "amount" | "percent" | null;
  baseAmountKrw: number;
  billingName: string;
  billingQuantity: number;
  billingReflectionEnabled: boolean;
  chargeAmountKrw: number;
  orderId: string;
  versionNo: number;
};

type GatewayError =
  | "adjustment_reason_not_allowed"
  | "adjustment_reason_required"
  | "billing_candidate_unavailable"
  | "db_write_failed"
  | "idempotency_conflict"
  | "negative_charge"
  | "order_unavailable"
  | "revision_conflict";

export type ChartOrderPrebillingOverrideGateway = {
  save(input: {
    actorUserId: string;
    encounterId: string;
    expectedVersion: number;
    idempotencyKey: string;
    orderId: string;
    override: ChartOrderPrebillingOverridePatch;
    workspaceId: string;
  }): Promise<
    | { ok: true; override: ChartOrderPrebillingOverride }
    | { error: GatewayError; ok: false }
  >;
};

type DeniedResult = {
  denialReason: WorkspacePermissionDenialReason;
  ok: false;
  status: 401 | 403;
};

export type SaveChartOrderPrebillingOverrideResult =
  | {
      enforcedBy: "chart-order-prebilling-override";
      ok: true;
      override: ChartOrderPrebillingOverride;
      status: 200;
    }
  | DeniedResult
  | { error: "invalid_input"; ok: false; status: 400 }
  | {
      error:
        | "billing_candidate_unavailable"
        | "idempotency_conflict"
        | "order_unavailable"
        | "revision_conflict";
      ok: false;
      status: 409;
    }
  | {
      error:
        | "adjustment_reason_not_allowed"
        | "adjustment_reason_required"
        | "negative_charge";
      ok: false;
      status: 422;
    }
  | { error: "db_write_failed"; ok: false; status: 500 };

export async function saveChartOrderPrebillingOverride({
  actorUserId,
  encounterId,
  expectedVersion,
  gateway = createMockChartOrderPrebillingOverrideGateway(),
  idempotencyKey,
  orderId,
  override,
  permissionAdapter = createDemoPermissionAdapter(),
  workspaceId,
}: {
  actorUserId: string | null;
  encounterId?: string | null;
  expectedVersion?: number | null;
  gateway?: ChartOrderPrebillingOverrideGateway;
  idempotencyKey?: string | null;
  orderId?: string | null;
  override?: ChartOrderPrebillingOverridePatch | null;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<SaveChartOrderPrebillingOverrideResult> {
  const normalizedEncounterId = trimToUndefined(encounterId);
  const normalizedOrderId = trimToUndefined(orderId);
  const normalizedIdempotencyKey = trimToUndefined(idempotencyKey);
  if (
    !normalizedEncounterId ||
    !normalizedOrderId ||
    !normalizedIdempotencyKey ||
    normalizedIdempotencyKey.length < 8 ||
    normalizedIdempotencyKey.length > 160 ||
    !Number.isInteger(expectedVersion) ||
    (expectedVersion ?? -1) < 0 ||
    !isValidOverridePatch(override)
  ) {
    return { error: "invalid_input", ok: false, status: 400 };
  }

  for (const requiredPermission of ["chart:update", "billing:issue"] as const) {
    const permission = resolveWorkspacePermission(permissionAdapter, {
      requiredPermission,
      sessionUserId: actorUserId,
      workspaceId,
    });
    if (!permission.allowed) {
      return {
        denialReason: permission.denialReason ?? "permission_missing",
        ok: false,
        status: permission.denialReason === "unauthenticated" ? 401 : 403,
      };
    }
  }

  const result = await gateway.save({
    actorUserId: actorUserId!,
    encounterId: normalizedEncounterId,
    expectedVersion: expectedVersion!,
    idempotencyKey: normalizedIdempotencyKey,
    orderId: normalizedOrderId,
    override: normalizeOverridePatch(override!),
    workspaceId,
  });
  if (result.ok) {
    return {
      enforcedBy: "chart-order-prebilling-override",
      ok: true,
      override: result.override,
      status: 200,
    };
  }
  if (
    result.error === "billing_candidate_unavailable" ||
    result.error === "idempotency_conflict" ||
    result.error === "order_unavailable" ||
    result.error === "revision_conflict"
  ) {
    return { error: result.error, ok: false, status: 409 };
  }
  if (
    result.error === "adjustment_reason_not_allowed" ||
    result.error === "adjustment_reason_required" ||
    result.error === "negative_charge"
  ) {
    return { error: result.error, ok: false, status: 422 };
  }
  return { error: "db_write_failed", ok: false, status: 500 };
}

export type SupabaseChartOrderPrebillingOverrideRpcClient = {
  rpc(functionName: "clair_save_chart_order_prebilling_override", args: {
    p_actor_user_id: string;
    p_encounter_id: string;
    p_expected_version: number;
    p_idempotency_key: string;
    p_order_id: string;
    p_override: ChartOrderPrebillingOverridePatch;
    p_workspace_id: string;
  }): Promise<{ data: unknown; error: { message?: string } | null }>;
};

export function createSupabaseChartOrderPrebillingOverrideGateway(
  client: SupabaseChartOrderPrebillingOverrideRpcClient,
): ChartOrderPrebillingOverrideGateway {
  return {
    async save(input) {
      const { data, error } = await client.rpc(
        "clair_save_chart_order_prebilling_override",
        {
          p_actor_user_id: input.actorUserId,
          p_encounter_id: input.encounterId,
          p_expected_version: input.expectedVersion,
          p_idempotency_key: input.idempotencyKey,
          p_order_id: input.orderId,
          p_override: input.override,
          p_workspace_id: input.workspaceId,
        },
      );
      if (error) return { error: mapDbError(error.message), ok: false };
      const override = mapOverride(data);
      return override
        ? { ok: true, override }
        : { error: "db_write_failed", ok: false };
    },
  };
}

export function createMockChartOrderPrebillingOverrideGateway(): ChartOrderPrebillingOverrideGateway {
  const states = new Map<string, ChartOrderPrebillingOverride>();
  const commands = new Map<
    string,
    { override: ChartOrderPrebillingOverride; request: string }
  >();
  return {
    async save(input) {
      const commandKey = `${input.workspaceId}:${input.idempotencyKey}`;
      const request = JSON.stringify({
        encounterId: input.encounterId,
        expectedVersion: input.expectedVersion,
        orderId: input.orderId,
        override: input.override,
      });
      const replay = commands.get(commandKey);
      if (replay) {
        return replay.request === request
          ? { ok: true, override: replay.override }
          : { error: "idempotency_conflict", ok: false };
      }
      const stateKey = `${input.workspaceId}:${input.orderId}`;
      const previous = states.get(stateKey);
      if ((previous?.versionNo ?? 0) !== input.expectedVersion) {
        return { error: "revision_conflict", ok: false };
      }
      const has = (key: keyof ChartOrderPrebillingOverridePatch) =>
        Object.prototype.hasOwnProperty.call(input.override, key);
      const billingQuantity = has("billingQuantity")
        ? input.override.billingQuantity!
        : previous?.billingQuantity ?? 1;
      const baseAmountKrw = previous?.baseAmountKrw ?? 0;
      const adjustmentSource = has("adjustmentSource")
        ? input.override.adjustmentSource ?? null
        : previous?.adjustmentSource ?? null;
      const requestedAdjustment = adjustmentSource === "percent"
        ? { source: "percent" as const, percent: input.override.adjustmentPercent ?? previous?.adjustmentPercent ?? 0 }
        : adjustmentSource === "amount"
          ? { source: "amount" as const, amountKrw: has("adjustmentAmountKrw") ? input.override.adjustmentAmountKrw! : previous?.adjustmentAmountKrw ?? 0 }
          : null;
      const calculation = requestedAdjustment
        ? calculatePlanOrderCharge({ baseAmountKrw, adjustment: requestedAdjustment })
        : { ok: true as const, adjustmentAmountKrw: 0, adjustmentPercent: 0, chargeAmountKrw: baseAmountKrw };
      if (!calculation.ok) {
        return calculation.reason === "negative_charge"
          ? { error: "negative_charge", ok: false }
          : { error: "db_write_failed", ok: false };
      }
      const adjustmentAmountKrw = calculation.adjustmentAmountKrw;
      const adjustmentPercent = calculation.adjustmentPercent;
      const next: ChartOrderPrebillingOverride = {
        adjustmentAmountKrw,
        adjustmentPercent,
        adjustmentReason: has("adjustmentReason")
          ? input.override.adjustmentReason ?? null
          : previous?.adjustmentReason ?? null,
        adjustmentSource,
        baseAmountKrw,
        billingName: input.override.billingName ?? previous?.billingName ?? "Order",
        billingQuantity,
        billingReflectionEnabled: input.override.billingReflectionEnabled ?? previous?.billingReflectionEnabled ?? true,
        chargeAmountKrw: calculation.chargeAmountKrw,
        orderId: input.orderId,
        versionNo: input.expectedVersion + 1,
      };
      states.set(stateKey, next);
      commands.set(commandKey, { override: next, request });
      return { ok: true, override: next };
    },
  };
}

function isValidOverridePatch(
  value: ChartOrderPrebillingOverridePatch | null | undefined,
): value is ChartOrderPrebillingOverridePatch {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entries = Object.entries(value);
  if (entries.length === 0) return false;
  const allowed = new Set([
    "adjustmentAmountKrw",
    "adjustmentPercent",
    "adjustmentReason",
    "adjustmentSource",
    "billingName",
    "billingQuantity",
    "billingReflectionEnabled",
  ]);
  if (entries.some(([key]) => !allowed.has(key))) return false;
  if (value.billingName !== undefined && (typeof value.billingName !== "string" || !value.billingName.trim())) return false;
  if (value.billingQuantity !== undefined && (typeof value.billingQuantity !== "number" || !Number.isFinite(value.billingQuantity) || value.billingQuantity <= 0)) return false;
  if (value.adjustmentAmountKrw !== undefined && (typeof value.adjustmentAmountKrw !== "number" || !Number.isSafeInteger(value.adjustmentAmountKrw))) return false;
  if (value.adjustmentPercent !== undefined && (typeof value.adjustmentPercent !== "number" || !Number.isFinite(value.adjustmentPercent))) return false;
  if (value.adjustmentReason !== undefined && value.adjustmentReason !== null && typeof value.adjustmentReason !== "string") return false;
  if (value.adjustmentSource !== undefined && value.adjustmentSource !== null && (typeof value.adjustmentSource !== "string" || !["amount", "percent"].includes(value.adjustmentSource))) return false;
  return value.billingReflectionEnabled === undefined || typeof value.billingReflectionEnabled === "boolean";
}

function normalizeOverridePatch(value: ChartOrderPrebillingOverridePatch) {
  return {
    ...value,
    ...(value.billingName !== undefined ? { billingName: value.billingName.trim() } : {}),
    ...(value.adjustmentReason !== undefined
      ? { adjustmentReason: typeof value.adjustmentReason === "string" ? value.adjustmentReason.trim() || null : value.adjustmentReason }
      : {}),
  };
}

function mapOverride(value: unknown): ChartOrderPrebillingOverride | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Partial<ChartOrderPrebillingOverride>;
  if (
    typeof row.orderId !== "string" ||
    !Number.isInteger(row.versionNo) ||
    typeof row.billingName !== "string" ||
    typeof row.billingReflectionEnabled !== "boolean" ||
    typeof row.billingQuantity !== "number" ||
    (row.adjustmentSource !== null && row.adjustmentSource !== "amount" && row.adjustmentSource !== "percent") ||
    typeof row.adjustmentAmountKrw !== "number" ||
    typeof row.adjustmentPercent !== "number" ||
    (row.adjustmentReason !== null && typeof row.adjustmentReason !== "string") ||
    typeof row.baseAmountKrw !== "number" ||
    typeof row.chargeAmountKrw !== "number"
  ) return null;
  return row as ChartOrderPrebillingOverride;
}

function mapDbError(message?: string): GatewayError {
  const known: GatewayError[] = [
    "adjustment_reason_not_allowed",
    "adjustment_reason_required",
    "billing_candidate_unavailable",
    "idempotency_conflict",
    "negative_charge",
    "order_unavailable",
    "revision_conflict",
  ];
  return known.find((error) => message?.includes(error)) ?? "db_write_failed";
}

function trimToUndefined(value?: string | null) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function createDemoPermissionAdapter() {
  return createMockWorkspacePermissionAdapter({
    users: [
      { id: "playwright-default-session", status: "active" },
      { id: "user-admin", status: "active" },
      { id: "user-vet", status: "active" },
    ],
    memberships: [
      { id: "membership-playwright-admin", workspaceId: "clair-demo", userId: "playwright-default-session", roles: ["hospital_admin"], status: "active" },
      { id: "membership-admin", workspaceId: "clair-demo", userId: "user-admin", roles: ["hospital_admin"], status: "active" },
      { id: "membership-vet", workspaceId: "clair-demo", userId: "user-vet", roles: ["vet"], status: "active" },
    ],
  });
}
