import {
  createMockWorkspacePermissionAdapter,
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";

export type OrderActualDispenseState = {
  actualDispenseOverride: Record<string, unknown> | null;
  actualDispenseQuantity: number;
  actualDispenseSource: "manual_override" | "preparation_policy";
  actualDispenseUnit: string;
  orderId: string;
  overrideId: string;
  requiresReconfirmation: boolean;
  updatedAt: string;
  versionNo: number;
};

type GatewayError =
  | "actual_dispense_calculation_unavailable"
  | "actual_dispense_command_in_progress"
  | "actual_dispense_out_of_policy"
  | "actual_dispense_override_disabled"
  | "actual_dispense_reason_required"
  | "db_write_failed"
  | "idempotency_conflict"
  | "invalid_actual_dispense_input"
  | "order_unavailable"
  | "revision_conflict";

export type OrderActualDispenseGateway = {
  save(input: {
    actorUserId: string;
    actualQuantity: number;
    expectedOrderUpdatedAt: string;
    idempotencyKey: string;
    orderId: string;
    reason: string | null;
    workspaceId: string;
  }): Promise<
    | { ok: true; state: OrderActualDispenseState }
    | { error: GatewayError; ok: false }
  >;
};

type PermissionDenied = {
  denialReason: WorkspacePermissionDenialReason;
  ok: false;
  status: 401 | 403;
};

export type SaveOrderActualDispenseResult =
  | {
      enforcedBy: "order-actual-dispense";
      ok: true;
      state: OrderActualDispenseState;
      status: 200;
    }
  | PermissionDenied
  | { error: "invalid_input"; ok: false; status: 400 }
  | {
      error:
        | "actual_dispense_command_in_progress"
        | "idempotency_conflict"
        | "order_unavailable"
        | "revision_conflict";
      ok: false;
      status: 409;
    }
  | {
      error:
        | "actual_dispense_calculation_unavailable"
        | "actual_dispense_out_of_policy"
        | "actual_dispense_override_disabled"
        | "actual_dispense_reason_required";
      ok: false;
      status: 422;
    }
  | { error: "db_write_failed"; ok: false; status: 500 };

export async function saveOrderActualDispense({
  actorUserId,
  actualQuantity,
  expectedOrderUpdatedAt,
  gateway = createMockOrderActualDispenseGateway(),
  idempotencyKey,
  orderId,
  permissionAdapter = createDemoPermissionAdapter(),
  reason,
  workspaceId,
}: {
  actorUserId: string | null;
  actualQuantity?: number | null;
  expectedOrderUpdatedAt?: string | null;
  gateway?: OrderActualDispenseGateway;
  idempotencyKey?: string | null;
  orderId?: string | null;
  permissionAdapter?: WorkspacePermissionAdapter;
  reason?: string | null;
  workspaceId: string;
}): Promise<SaveOrderActualDispenseResult> {
  const expectedUpdatedAt = trimToUndefined(expectedOrderUpdatedAt);
  const key = trimToUndefined(idempotencyKey);
  const normalizedOrderId = trimToUndefined(orderId);
  const normalizedReason = trimToUndefined(reason) ?? null;
  if (
    !expectedUpdatedAt ||
    !Number.isFinite(Date.parse(expectedUpdatedAt)) ||
    !key ||
    key.length < 8 ||
    key.length > 160 ||
    !normalizedOrderId ||
    typeof actualQuantity !== "number" ||
    !Number.isFinite(actualQuantity) ||
    actualQuantity <= 0 ||
    (normalizedReason !== null &&
      (normalizedReason.length < 3 || normalizedReason.length > 500))
  ) {
    return { error: "invalid_input", ok: false, status: 400 };
  }

  const permission = resolveWorkspacePermission(permissionAdapter, {
    requiredPermission: "chart:update",
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

  const result = await gateway.save({
    actorUserId: actorUserId!,
    actualQuantity,
    expectedOrderUpdatedAt: expectedUpdatedAt,
    idempotencyKey: key,
    orderId: normalizedOrderId,
    reason: normalizedReason,
    workspaceId,
  });
  if (result.ok) {
    return {
      enforcedBy: "order-actual-dispense",
      ok: true,
      state: result.state,
      status: 200,
    };
  }
  if (
    result.error === "actual_dispense_command_in_progress" ||
    result.error === "idempotency_conflict" ||
    result.error === "order_unavailable" ||
    result.error === "revision_conflict"
  ) {
    return { error: result.error, ok: false, status: 409 };
  }
  if (
    result.error === "actual_dispense_calculation_unavailable" ||
    result.error === "actual_dispense_out_of_policy" ||
    result.error === "actual_dispense_override_disabled" ||
    result.error === "actual_dispense_reason_required"
  ) {
    return { error: result.error, ok: false, status: 422 };
  }
  return { error: "db_write_failed", ok: false, status: 500 };
}

export type SupabaseOrderActualDispenseRpcClient = {
  rpc(
    functionName: "clair_save_order_actual_dispense_override",
    args: Record<string, unknown>,
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
};

export function createSupabaseOrderActualDispenseGateway(
  client: SupabaseOrderActualDispenseRpcClient,
): OrderActualDispenseGateway {
  return {
    async save(input) {
      const { data, error } = await client.rpc(
        "clair_save_order_actual_dispense_override",
        {
          p_actual_quantity: input.actualQuantity,
          p_actor_user_id: input.actorUserId,
          p_expected_order_updated_at: input.expectedOrderUpdatedAt,
          p_idempotency_key: input.idempotencyKey,
          p_order_id: input.orderId,
          p_reason: input.reason,
          p_workspace_id: input.workspaceId,
        },
      );
      if (error) return { error: mapDbError(error.message), ok: false };
      const state = mapState(data);
      return state
        ? { ok: true, state }
        : { error: "db_write_failed", ok: false };
    },
  };
}

export function createMockOrderActualDispenseGateway(): OrderActualDispenseGateway {
  const commands = new Map<
    string,
    { request: string; state: OrderActualDispenseState }
  >();
  const versions = new Map<string, number>();
  return {
    async save(input) {
      const commandKey = `${input.workspaceId}:${input.idempotencyKey}`;
      const request = JSON.stringify(input);
      const previous = commands.get(commandKey);
      if (previous) {
        return previous.request === request
          ? { ok: true, state: previous.state }
          : { error: "idempotency_conflict", ok: false };
      }
      const stateKey = `${input.workspaceId}:${input.orderId}`;
      const versionNo = (versions.get(stateKey) ?? 0) + 1;
      const now = new Date().toISOString();
      const state: OrderActualDispenseState = {
        actualDispenseOverride: input.reason
          ? { reason: input.reason, versionNo }
          : null,
        actualDispenseQuantity: input.actualQuantity,
        actualDispenseSource: input.reason
          ? "manual_override"
          : "preparation_policy",
        actualDispenseUnit: "mL",
        orderId: input.orderId,
        overrideId: `actual-dispense-${input.idempotencyKey}`,
        requiresReconfirmation: false,
        updatedAt: now,
        versionNo,
      };
      versions.set(stateKey, versionNo);
      commands.set(commandKey, { request, state });
      return { ok: true, state };
    },
  };
}

function mapState(value: unknown): OrderActualDispenseState | null {
  if (
    !isRecord(value) ||
    typeof value.overrideId !== "string" ||
    !Number.isInteger(value.versionNo) ||
    typeof value.orderId !== "string" ||
    typeof value.actualDispenseQuantity !== "number" ||
    typeof value.actualDispenseUnit !== "string" ||
    (value.actualDispenseSource !== "manual_override" &&
      value.actualDispenseSource !== "preparation_policy") ||
    !(
      value.actualDispenseOverride === null ||
      isRecord(value.actualDispenseOverride)
    ) ||
    typeof value.requiresReconfirmation !== "boolean" ||
    typeof value.updatedAt !== "string"
  ) {
    return null;
  }
  return value as OrderActualDispenseState;
}

function mapDbError(message?: string): GatewayError {
  const errors: GatewayError[] = [
    "actual_dispense_calculation_unavailable",
    "actual_dispense_command_in_progress",
    "actual_dispense_out_of_policy",
    "actual_dispense_override_disabled",
    "actual_dispense_reason_required",
    "idempotency_conflict",
    "invalid_actual_dispense_input",
    "order_unavailable",
    "revision_conflict",
  ];
  return errors.find((error) => message?.includes(error)) ?? "db_write_failed";
}

function createDemoPermissionAdapter() {
  return createMockWorkspacePermissionAdapter({
    memberships: [
      {
        id: "membership-vet",
        permissionRole: {
          key: "chart-writer",
          label: "Chart writer",
          permissionIds: ["chart:update"],
          roleType: "custom",
        },
        roles: ["vet"],
        status: "active",
        userId: "user-vet",
        workspaceId: "clair-demo",
      },
    ],
    users: [{ id: "user-vet", status: "active" }],
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function trimToUndefined(value?: string | null) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
