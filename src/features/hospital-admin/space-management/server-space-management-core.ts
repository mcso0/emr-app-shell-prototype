import {
  createMockWorkspacePermissionAdapter,
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";
import {
  cloneWorkspaceSpaceManagementSnapshot,
  createDefaultWorkspaceSpaceManagementSnapshot,
  parseSpaceManagementMutationInput,
  parseWorkspaceSpaceManagementSnapshot,
  type SpaceManagementErrorCode,
  type SpaceManagementMutationInput,
  type WorkspaceSpaceManagementSnapshot,
} from "@/features/hospital-admin/space-management/model";

type GatewayError = Exclude<
  SpaceManagementErrorCode,
  | "db_read_failed"
  | "invalid_input"
  | "unauthenticated"
  | "permission_missing"
  | "workspace_membership_missing"
>;

export type WorkspaceSpaceManagementGateway = {
  get(workspaceId: string): Promise<
    | { ok: true; snapshot: WorkspaceSpaceManagementSnapshot }
    | { ok: false; error: "db_read_failed" }
  >;
  mutate(input: {
    actorUserId: string;
    workspaceId: string;
    command: SpaceManagementMutationInput;
  }): Promise<
    | { ok: true; snapshot: WorkspaceSpaceManagementSnapshot }
    | { ok: false; error: GatewayError }
  >;
};

type ReadResult =
  | ({
      ok: true;
      status: 200;
      enforcedBy: "workspace-space-management";
    } & WorkspaceSpaceManagementSnapshot)
  | { ok: false; status: 401 | 403; denialReason: WorkspacePermissionDenialReason }
  | { ok: false; status: 500; error: "db_read_failed" };

type MutationResult =
  | ({
      ok: true;
      status: 200;
      enforcedBy: "workspace-space-management";
    } & WorkspaceSpaceManagementSnapshot)
  | { ok: false; status: 400; error: "invalid_input" }
  | { ok: false; status: 401 | 403; denialReason: WorkspacePermissionDenialReason }
  | {
      ok: false;
      status: 404;
      error: "category_not_found" | "space_not_found";
    }
  | {
      ok: false;
      status: 409;
      error:
        | "duplicate_category_name"
        | "duplicate_space_name"
        | "category_move_target_required"
        | "invalid_move_target";
    }
  | { ok: false; status: 500; error: "db_write_failed" };

export async function readWorkspaceSpaceManagement(input: {
  actorUserId: string | null;
  workspaceId: string;
  gateway?: WorkspaceSpaceManagementGateway;
  permissionAdapter?: WorkspacePermissionAdapter;
}): Promise<ReadResult> {
  const permissionAdapter =
    input.permissionAdapter ?? demoPermissions(input.actorUserId, input.workspaceId);
  const readPermission = resolveWorkspacePermission(permissionAdapter, {
    sessionUserId: input.actorUserId,
    workspaceId: input.workspaceId,
    requiredPermission: "hospital_settings:view",
  });
  if (!readPermission.allowed) return denied(readPermission.denialReason);

  const result = await (
    input.gateway ?? createMockWorkspaceSpaceManagementGateway("shared")
  ).get(input.workspaceId);
  if (!result.ok) return { ok: false, status: 500, error: result.error };

  const managePermission = resolveWorkspacePermission(permissionAdapter, {
    sessionUserId: input.actorUserId,
    workspaceId: input.workspaceId,
    requiredPermission: "hospital_settings:manage",
  });
  return success({
    ...result.snapshot,
    canManage: managePermission.allowed,
  });
}

export async function mutateWorkspaceSpaceManagement(input: {
  actorUserId: string | null;
  workspaceId: string;
  input: unknown;
  gateway?: WorkspaceSpaceManagementGateway;
  permissionAdapter?: WorkspacePermissionAdapter;
}): Promise<MutationResult> {
  const permissionAdapter =
    input.permissionAdapter ?? demoPermissions(input.actorUserId, input.workspaceId);
  const permission = resolveWorkspacePermission(permissionAdapter, {
    sessionUserId: input.actorUserId,
    workspaceId: input.workspaceId,
    requiredPermission: "hospital_settings:manage",
  });
  if (!permission.allowed) return denied(permission.denialReason);

  const command = parseSpaceManagementMutationInput(input.input);
  if (!command) return { ok: false, status: 400, error: "invalid_input" };

  const result = await (
    input.gateway ?? createMockWorkspaceSpaceManagementGateway("shared")
  ).mutate({
    actorUserId: input.actorUserId ?? "",
    workspaceId: input.workspaceId,
    command,
  });
  if (!result.ok) return gatewayFailure(result.error);
  return success({ ...result.snapshot, canManage: true });
}

const mockSnapshots = new Map<string, WorkspaceSpaceManagementSnapshot>();
let mockIdSequence = 0;

export function createMockWorkspaceSpaceManagementGateway(
  scope = "shared",
): WorkspaceSpaceManagementGateway {
  const keyFor = (workspaceId: string) => `${scope}:${workspaceId}`;

  return {
    async get(workspaceId) {
      return {
        ok: true,
        snapshot: cloneWorkspaceSpaceManagementSnapshot(
          mockSnapshots.get(keyFor(workspaceId))
            ?? createDefaultWorkspaceSpaceManagementSnapshot(workspaceId),
        ),
      };
    },
    async mutate({ command, workspaceId }) {
      const key = keyFor(workspaceId);
      const snapshot = cloneWorkspaceSpaceManagementSnapshot(
        mockSnapshots.get(key) ?? createDefaultWorkspaceSpaceManagementSnapshot(workspaceId),
      );
      const result = applyMockMutation(snapshot, command);
      if (!result.ok) return result;
      mockSnapshots.set(key, cloneWorkspaceSpaceManagementSnapshot(result.snapshot));
      return {
        ok: true,
        snapshot: cloneWorkspaceSpaceManagementSnapshot(result.snapshot),
      };
    },
  };
}

export type SupabaseWorkspaceSpaceManagementClient = {
  rpc(
    functionName:
      | "clair_get_workspace_space_management"
      | "clair_mutate_workspace_space_management",
    args: Record<string, unknown>,
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
};

export function createSupabaseWorkspaceSpaceManagementGateway(
  client: SupabaseWorkspaceSpaceManagementClient,
): WorkspaceSpaceManagementGateway {
  return {
    async get(workspaceId) {
      const { data, error } = await client.rpc("clair_get_workspace_space_management", {
        p_workspace_id: workspaceId,
      });
      if (error) return { ok: false, error: "db_read_failed" };
      const snapshot = parseGatewaySnapshot(data, workspaceId);
      return snapshot
        ? { ok: true, snapshot }
        : { ok: false, error: "db_read_failed" };
    },
    async mutate({ actorUserId, workspaceId, command }) {
      const { data, error } = await client.rpc("clair_mutate_workspace_space_management", {
        p_actor_user_id: actorUserId,
        p_command: command,
        p_workspace_id: workspaceId,
      });
      if (error) return { ok: false, error: mapGatewayError(error.message) };
      const snapshot = parseGatewaySnapshot(data, workspaceId);
      return snapshot
        ? { ok: true, snapshot }
        : { ok: false, error: "db_write_failed" };
    },
  };
}

function applyMockMutation(
  snapshot: WorkspaceSpaceManagementSnapshot,
  command: SpaceManagementMutationInput,
):
  | { ok: true; snapshot: WorkspaceSpaceManagementSnapshot }
  | { ok: false; error: GatewayError } {
  if (command.action === "category.create") {
    if (hasCategoryName(snapshot, command.name)) {
      return { ok: false, error: "duplicate_category_name" };
    }
    snapshot.categories.push({
      id: nextMockId("category"),
      name: command.name,
      iconKey: "default",
      sortOrder: snapshot.categories.length,
      spaces: [],
    });
  }

  if (command.action === "category.rename") {
    const category = snapshot.categories.find((item) => item.id === command.categoryId);
    if (!category) return { ok: false, error: "category_not_found" };
    if (hasCategoryName(snapshot, command.name, category.id)) {
      return { ok: false, error: "duplicate_category_name" };
    }
    category.name = command.name;
  }

  if (command.action === "category.delete") {
    const categoryIndex = snapshot.categories.findIndex(
      (item) => item.id === command.categoryId,
    );
    if (categoryIndex < 0) return { ok: false, error: "category_not_found" };
    const category = snapshot.categories[categoryIndex];
    if (category.spaces.length > 0 && !command.moveTargetCategoryId) {
      return { ok: false, error: "category_move_target_required" };
    }
    if (command.moveTargetCategoryId) {
      const target = snapshot.categories.find(
        (item) => item.id === command.moveTargetCategoryId,
      );
      if (!target || target.id === category.id) {
        return { ok: false, error: "invalid_move_target" };
      }
      if (category.spaces.some((moving) =>
        target.spaces.some((space) => sameName(space.name, moving.name))
      )) {
        return { ok: false, error: "duplicate_space_name" };
      }
      target.spaces.push(...category.spaces.map((space, index) => ({
        ...space,
        categoryId: target.id,
        sortOrder: target.spaces.length + index,
      })));
    }
    snapshot.categories.splice(categoryIndex, 1);
  }

  if (command.action === "space.create") {
    const category = snapshot.categories.find((item) => item.id === command.categoryId);
    if (!category) return { ok: false, error: "category_not_found" };
    if (category.spaces.some((space) => sameName(space.name, command.name))) {
      return { ok: false, error: "duplicate_space_name" };
    }
    category.spaces.push({
      id: nextMockId("space"),
      categoryId: category.id,
      name: command.name,
      sortOrder: category.spaces.length,
    });
  }

  if (command.action === "space.update") {
    const source = snapshot.categories.find((category) =>
      category.spaces.some((space) => space.id === command.spaceId)
    );
    const target = snapshot.categories.find((category) => category.id === command.categoryId);
    if (!source) return { ok: false, error: "space_not_found" };
    if (!target) return { ok: false, error: "category_not_found" };
    const spaceIndex = source.spaces.findIndex((space) => space.id === command.spaceId);
    const space = source.spaces[spaceIndex];
    if (target.spaces.some((candidate) =>
      candidate.id !== space.id && sameName(candidate.name, command.name)
    )) {
      return { ok: false, error: "duplicate_space_name" };
    }
    source.spaces.splice(spaceIndex, 1);
    normalizeSpaceOrder(source);
    target.spaces.push({
      ...space,
      categoryId: target.id,
      name: command.name,
      sortOrder: target.spaces.length,
    });
  }

  if (command.action === "space.delete") {
    const category = snapshot.categories.find((item) =>
      item.spaces.some((space) => space.id === command.spaceId)
    );
    if (!category) return { ok: false, error: "space_not_found" };
    category.spaces = category.spaces.filter((space) => space.id !== command.spaceId);
    normalizeSpaceOrder(category);
  }

  snapshot.categories = snapshot.categories.map((category, index) => ({
    ...category,
    sortOrder: index,
  }));
  return { ok: true, snapshot };
}

function normalizeSpaceOrder(category: WorkspaceSpaceManagementSnapshot["categories"][number]) {
  category.spaces = category.spaces.map((space, index) => ({ ...space, sortOrder: index }));
}

function parseGatewaySnapshot(value: unknown, workspaceId: string) {
  return parseWorkspaceSpaceManagementSnapshot(
    typeof value === "object" && value !== null
      ? {
          ...(value as Record<string, unknown>),
          workspaceId,
          canManage: true,
        }
      : value,
  );
}

function hasCategoryName(
  snapshot: WorkspaceSpaceManagementSnapshot,
  name: string,
  excludedId?: string,
) {
  return snapshot.categories.some(
    (category) => category.id !== excludedId && sameName(category.name, name),
  );
}

function sameName(left: string, right: string) {
  return left.toLocaleLowerCase("ko-KR") === right.toLocaleLowerCase("ko-KR");
}

function nextMockId(prefix: "category" | "space") {
  mockIdSequence += 1;
  return `mock-${prefix}-${mockIdSequence}`;
}

function mapGatewayError(message?: string): GatewayError {
  const knownErrors: GatewayError[] = [
    "category_not_found",
    "space_not_found",
    "duplicate_category_name",
    "duplicate_space_name",
    "category_move_target_required",
    "invalid_move_target",
  ];
  return knownErrors.find((error) => message?.includes(error)) ?? "db_write_failed";
}

function gatewayFailure(error: GatewayError): MutationResult {
  if (error === "category_not_found" || error === "space_not_found") {
    return { ok: false, status: 404, error };
  }
  if (error === "db_write_failed") {
    return { ok: false, status: 500, error };
  }
  return { ok: false, status: 409, error };
}

function success(
  snapshot: WorkspaceSpaceManagementSnapshot,
): Extract<ReadResult | MutationResult, { ok: true }> {
  return {
    ok: true,
    status: 200,
    enforcedBy: "workspace-space-management",
    ...cloneWorkspaceSpaceManagementSnapshot(snapshot),
  };
}

function denied(
  denialReason: WorkspacePermissionDenialReason | undefined,
): Extract<ReadResult | MutationResult, { ok: false; status: 401 | 403 }> {
  return {
    ok: false,
    status: denialReason === "unauthenticated" ? 401 : 403,
    denialReason: denialReason ?? "permission_missing",
  };
}

function demoPermissions(actorUserId: string | null, workspaceId: string) {
  const userId = actorUserId ?? "missing-user";
  const role = userId === "user-front-desk"
    ? "front_desk"
    : userId === "user-vet"
      ? "vet"
      : "hospital_admin";
  return createMockWorkspacePermissionAdapter({
    users: [{ id: userId, status: "active" }],
    memberships: [{
      id: `space-management-${userId}`,
      workspaceId,
      userId,
      roles: [role],
      status: "active",
    }],
  });
}
