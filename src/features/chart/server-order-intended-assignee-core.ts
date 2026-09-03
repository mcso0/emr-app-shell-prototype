import {
  createMockWorkspacePermissionAdapter,
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";
import type { FulfillmentEligibleAssignee } from "@/features/fulfillment/server-fulfillment-assignee-core";

export type OrderIntendedAssigneeState = {
  commandId: string;
  intendedAssigneeUserId: string | null;
  orderId: string;
  updatedAt: string;
};

type GatewayError =
  | "assignee_ineligible"
  | "db_read_failed"
  | "db_write_failed"
  | "idempotency_conflict"
  | "intended_assignee_command_in_progress"
  | "order_unavailable"
  | "revision_conflict";

export type OrderIntendedAssigneeGateway = {
  list(input: {
    orderId: string;
    workspaceId: string;
  }): Promise<
    | { assignees: FulfillmentEligibleAssignee[]; ok: true }
    | { error: GatewayError; ok: false }
  >;
  save(input: {
    actorUserId: string;
    expectedOrderUpdatedAt: string;
    idempotencyKey: string;
    intendedAssigneeUserId: string | null;
    orderId: string;
    workspaceId: string;
  }): Promise<
    | { ok: true; state: OrderIntendedAssigneeState }
    | { error: GatewayError; ok: false }
  >;
};

type PermissionDenied = {
  denialReason: WorkspacePermissionDenialReason;
  ok: false;
  status: 401 | 403;
};

export type ReadOrderIntendedAssigneesResult =
  | {
      assignees: FulfillmentEligibleAssignee[];
      enforcedBy: "order-intended-assignee";
      ok: true;
      status: 200;
    }
  | PermissionDenied
  | { error: "invalid_input"; ok: false; status: 400 }
  | { error: "order_unavailable"; ok: false; status: 409 }
  | { error: "db_read_failed"; ok: false; status: 500 };

export type SaveOrderIntendedAssigneeResult =
  | {
      enforcedBy: "order-intended-assignee";
      ok: true;
      state: OrderIntendedAssigneeState;
      status: 200;
    }
  | PermissionDenied
  | { error: "invalid_input"; ok: false; status: 400 }
  | {
      error:
        | "assignee_ineligible"
        | "idempotency_conflict"
        | "intended_assignee_command_in_progress"
        | "order_unavailable"
        | "revision_conflict";
      ok: false;
      status: 409;
    }
  | { error: "db_write_failed"; ok: false; status: 500 };

export async function readOrderIntendedAssignees({
  actorUserId,
  gateway = createMockOrderIntendedAssigneeGateway(),
  orderId,
  permissionAdapter = createDemoPermissionAdapter(),
  workspaceId,
}: {
  actorUserId: string | null;
  gateway?: Pick<OrderIntendedAssigneeGateway, "list">;
  orderId?: string | null;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<ReadOrderIntendedAssigneesResult> {
  const normalizedOrderId = trimToUndefined(orderId);
  if (!normalizedOrderId) {
    return { error: "invalid_input", ok: false, status: 400 };
  }
  const denied = resolvePermission({ actorUserId, permissionAdapter, workspaceId });
  if (denied) return denied;
  const result = await gateway.list({ orderId: normalizedOrderId, workspaceId });
  if (result.ok) {
    return {
      assignees: result.assignees,
      enforcedBy: "order-intended-assignee",
      ok: true,
      status: 200,
    };
  }
  return result.error === "order_unavailable"
    ? { error: result.error, ok: false, status: 409 }
    : { error: "db_read_failed", ok: false, status: 500 };
}

export async function saveOrderIntendedAssignee({
  actorUserId,
  expectedOrderUpdatedAt,
  gateway = createMockOrderIntendedAssigneeGateway(),
  idempotencyKey,
  intendedAssigneeUserId,
  orderId,
  permissionAdapter = createDemoPermissionAdapter(),
  workspaceId,
}: {
  actorUserId: string | null;
  expectedOrderUpdatedAt?: string | null;
  gateway?: Pick<OrderIntendedAssigneeGateway, "save">;
  idempotencyKey?: string | null;
  intendedAssigneeUserId?: string | null;
  orderId?: string | null;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<SaveOrderIntendedAssigneeResult> {
  const expectedUpdatedAt = trimToUndefined(expectedOrderUpdatedAt);
  const key = trimToUndefined(idempotencyKey);
  const normalizedOrderId = trimToUndefined(orderId);
  const normalizedAssignee = trimToUndefined(intendedAssigneeUserId) ?? null;
  if (
    !expectedUpdatedAt ||
    !Number.isFinite(Date.parse(expectedUpdatedAt)) ||
    !key ||
    key.length < 8 ||
    key.length > 160 ||
    !normalizedOrderId
  ) {
    return { error: "invalid_input", ok: false, status: 400 };
  }
  const denied = resolvePermission({ actorUserId, permissionAdapter, workspaceId });
  if (denied) return denied;
  const result = await gateway.save({
    actorUserId: actorUserId!,
    expectedOrderUpdatedAt: expectedUpdatedAt,
    idempotencyKey: key,
    intendedAssigneeUserId: normalizedAssignee,
    orderId: normalizedOrderId,
    workspaceId,
  });
  if (result.ok) {
    return {
      enforcedBy: "order-intended-assignee",
      ok: true,
      state: result.state,
      status: 200,
    };
  }
  if (result.error === "db_write_failed" || result.error === "db_read_failed") {
    return { error: "db_write_failed", ok: false, status: 500 };
  }
  return { error: result.error, ok: false, status: 409 };
}

export type SupabaseOrderIntendedAssigneeRpcClient = {
  rpc(
    functionName:
      | "clair_list_order_intended_assignees"
      | "clair_save_order_intended_assignee",
    args: Record<string, unknown>,
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
};

export function createSupabaseOrderIntendedAssigneeGateway(
  client: SupabaseOrderIntendedAssigneeRpcClient,
): OrderIntendedAssigneeGateway {
  return {
    async list({ orderId, workspaceId }) {
      const { data, error } = await client.rpc(
        "clair_list_order_intended_assignees",
        { p_order_id: orderId, p_workspace_id: workspaceId },
      );
      if (error) return { error: mapDbError(error.message), ok: false };
      const assignees = mapAssignees(data);
      return assignees
        ? { assignees, ok: true }
        : { error: "db_read_failed", ok: false };
    },
    async save(input) {
      const { data, error } = await client.rpc(
        "clair_save_order_intended_assignee",
        {
          p_actor_user_id: input.actorUserId,
          p_expected_order_updated_at: input.expectedOrderUpdatedAt,
          p_idempotency_key: input.idempotencyKey,
          p_intended_assignee_user_id: input.intendedAssigneeUserId,
          p_order_id: input.orderId,
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

export function createMockOrderIntendedAssigneeGateway(): OrderIntendedAssigneeGateway {
  const commands = new Map<string, { request: string; state: OrderIntendedAssigneeState }>();
  return {
    async list() {
      return {
        assignees: [
          { displayName: "송하윤", title: "테크니션", userId: "user-tech" },
          { displayName: "송민재", title: "병원 관리자", userId: "user-admin" },
        ],
        ok: true,
      };
    },
    async save(input) {
      const key = `${input.workspaceId}:${input.idempotencyKey}`;
      const request = JSON.stringify(input);
      const previous = commands.get(key);
      if (previous) {
        return previous.request === request
          ? { ok: true, state: previous.state }
          : { error: "idempotency_conflict", ok: false };
      }
      const state: OrderIntendedAssigneeState = {
        commandId: `assignee-${input.idempotencyKey}`,
        intendedAssigneeUserId: input.intendedAssigneeUserId,
        orderId: input.orderId,
        updatedAt: new Date().toISOString(),
      };
      commands.set(key, { request, state });
      return { ok: true, state };
    },
  };
}

function resolvePermission({
  actorUserId,
  permissionAdapter,
  workspaceId,
}: {
  actorUserId: string | null;
  permissionAdapter: WorkspacePermissionAdapter;
  workspaceId: string;
}): PermissionDenied | null {
  const permission = resolveWorkspacePermission(permissionAdapter, {
    requiredPermission: "chart:update",
    sessionUserId: actorUserId,
    workspaceId,
  });
  return permission.allowed
    ? null
    : {
        denialReason: permission.denialReason ?? "permission_missing",
        ok: false,
        status: permission.denialReason === "unauthenticated" ? 401 : 403,
      };
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

function mapDbError(message?: string): GatewayError {
  const errors: GatewayError[] = [
    "assignee_ineligible",
    "idempotency_conflict",
    "intended_assignee_command_in_progress",
    "order_unavailable",
    "revision_conflict",
  ];
  return errors.find((error) => message?.includes(error)) ?? "db_write_failed";
}

function mapAssignees(value: unknown) {
  if (!Array.isArray(value)) return null;
  const assignees: FulfillmentEligibleAssignee[] = [];
  for (const valueRow of value) {
    if (!isRecord(valueRow)) return null;
    if (typeof valueRow.userId !== "string" || typeof valueRow.displayName !== "string") {
      return null;
    }
    assignees.push({
      department: typeof valueRow.department === "string" ? valueRow.department : null,
      displayName: valueRow.displayName,
      title: typeof valueRow.title === "string" ? valueRow.title : null,
      userId: valueRow.userId,
    });
  }
  return assignees;
}

function mapState(value: unknown): OrderIntendedAssigneeState | null {
  if (
    !isRecord(value) ||
    typeof value.commandId !== "string" ||
    !(value.intendedAssigneeUserId === null || typeof value.intendedAssigneeUserId === "string") ||
    typeof value.orderId !== "string" ||
    typeof value.updatedAt !== "string"
  ) {
    return null;
  }
  return {
    commandId: value.commandId,
    intendedAssigneeUserId: value.intendedAssigneeUserId,
    orderId: value.orderId,
    updatedAt: value.updatedAt,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function trimToUndefined(value?: string | null) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
