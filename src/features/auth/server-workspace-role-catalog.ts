import {
  SESSION_WORKSPACE_DEFAULT_JOB_POSITIONS,
  SESSION_WORKSPACE_OWNER_ONLY_PERMISSION_IDS,
  SESSION_WORKSPACE_PERMISSION_ROLES,
  SESSION_WORKSPACE_SAFE_CUSTOM_PERMISSION_CATALOG,
  type SessionWorkspaceJobPosition,
  type SessionWorkspacePermissionRole,
  type SessionWorkspacePermissionRoleType,
} from "@/features/auth/workspace-session";

export type WorkspaceRoleCatalogMutation = {
  action: string;
  roleKey?: string;
  positionKey?: string;
  role?: {
    label?: string;
    description?: string;
    permissionIds?: unknown;
  };
  job?: {
    label?: string;
    description?: string;
  };
};

type NormalizedWorkspaceRoleCatalogMutation = {
  action: "role.create" | "role.update" | "role.delete" | "job.create" | "job.update" | "job.archive";
  roleKey: string | null;
  positionKey: string | null;
  label: string | null;
  description: string | null;
  permissionIds: string[];
};

type WorkspaceRoleCatalogMutationError =
  | "invalid_action"
  | "invalid_role_key"
  | "invalid_position_key"
  | "invalid_catalog_label"
  | "invalid_custom_role_permissions"
  | "system_role_immutable"
  | "system_job_immutable";

export type WorkspaceRoleCatalogMutationValidation =
  | { ok: true; value: NormalizedWorkspaceRoleCatalogMutation }
  | { ok: false; error: WorkspaceRoleCatalogMutationError };

export type WorkspaceRoleCatalogSnapshot = {
  permissionRoles: SessionWorkspacePermissionRole[];
  jobPositions: SessionWorkspaceJobPosition[];
  access: {
    canManage: boolean;
  };
  ownerReconciliation: {
    needsConfirmation: boolean;
    membershipIds: string[];
  };
};

export type SupabaseWorkspaceRoleCatalogRpcClient = {
  rpc(
    name: "clair_read_workspace_role_catalog" | "clair_mutate_workspace_role_catalog",
    args: Record<string, unknown>
  ): Promise<{ data: unknown; error: { code?: string; message?: string } | null }>;
};

export type WorkspaceRoleCatalogGatewayResult =
  | { ok: true; snapshot: WorkspaceRoleCatalogSnapshot }
  | { ok: false; error: "permission_missing" | "workspace_missing" | "conflict" | "invalid_input" | "unknown" };

const catalogActions = new Set<NormalizedWorkspaceRoleCatalogMutation["action"]>([
  "role.create",
  "role.update",
  "role.delete",
  "job.create",
  "job.update",
  "job.archive",
]);
const systemRoleKeys = new Set(SESSION_WORKSPACE_PERMISSION_ROLES.map((role) => role.roleKey));
const systemJobPositionKeys = new Set(
  SESSION_WORKSPACE_DEFAULT_JOB_POSITIONS.map((position) => position.positionKey)
);
const safeCustomPermissionIds = new Set(
  SESSION_WORKSPACE_SAFE_CUSTOM_PERMISSION_CATALOG.map((permission) => permission.id)
);
const ownerOnlyPermissionIds = new Set(SESSION_WORKSPACE_OWNER_ONLY_PERMISSION_IDS);
const catalogKeyPattern = /^[a-z0-9][a-z0-9_:-]{1,62}$/;

export function validateWorkspaceRoleCatalogMutation(
  input: unknown
): WorkspaceRoleCatalogMutationValidation {
  if (!isRecord(input) || !catalogActions.has(input.action as NormalizedWorkspaceRoleCatalogMutation["action"])) {
    return { ok: false, error: "invalid_action" };
  }

  const action = input.action as NormalizedWorkspaceRoleCatalogMutation["action"];
  const roleKey = normalizeKey(input.roleKey);
  const positionKey = normalizeKey(input.positionKey);

  if (action.startsWith("role.") && action !== "role.create") {
    if (!roleKey) return { ok: false, error: "invalid_role_key" };
    if (systemRoleKeys.has(roleKey)) return { ok: false, error: "system_role_immutable" };
  }

  if (action.startsWith("job.") && action !== "job.create") {
    if (!positionKey) return { ok: false, error: "invalid_position_key" };
    if (systemJobPositionKeys.has(positionKey)) return { ok: false, error: "system_job_immutable" };
  }

  if (action === "role.create" || action === "role.update") {
    const role = isRecord(input.role) ? input.role : null;
    const label = normalizeLabel(role?.label);
    const description = normalizeDescription(role?.description);
    const permissionIds = normalizePermissionIds(role?.permissionIds);

    if (!label) return { ok: false, error: "invalid_catalog_label" };
    if (!permissionIds || permissionIds.length === 0) {
      return { ok: false, error: "invalid_custom_role_permissions" };
    }

    return {
      ok: true,
      value: {
        action,
        roleKey,
        positionKey: null,
        label,
        description,
        permissionIds,
      },
    };
  }

  if (action === "job.create" || action === "job.update") {
    const job = isRecord(input.job) ? input.job : null;
    const label = normalizeLabel(job?.label);
    if (!label) return { ok: false, error: "invalid_catalog_label" };

    return {
      ok: true,
      value: {
        action,
        roleKey: null,
        positionKey,
        label,
        description: normalizeDescription(job?.description),
        permissionIds: [],
      },
    };
  }

  return {
    ok: true,
    value: {
      action,
      roleKey,
      positionKey,
      label: null,
      description: null,
      permissionIds: [],
    },
  };
}

export function createSupabaseWorkspaceRoleCatalogGateway(
  client: SupabaseWorkspaceRoleCatalogRpcClient
) {
  return {
    async read({ workspaceId }: { workspaceId: string }): Promise<WorkspaceRoleCatalogGatewayResult> {
      const { data, error } = await client.rpc("clair_read_workspace_role_catalog", {
        p_workspace_id: workspaceId,
      });

      return error ? { ok: false, error: mapWorkspaceRoleCatalogRpcError(error) } : toGatewayResult(data);
    },

    async mutate({
      workspaceId,
      mutation,
    }: {
      workspaceId: string;
      mutation: unknown;
    }): Promise<WorkspaceRoleCatalogGatewayResult> {
      const validation = validateWorkspaceRoleCatalogMutation(mutation);
      if (!validation.ok) return { ok: false, error: "invalid_input" };

      const { value } = validation;
      const { data, error } = await client.rpc("clair_mutate_workspace_role_catalog", {
        p_workspace_id: workspaceId,
        p_action: value.action,
        p_role_key: value.roleKey,
        p_position_key: value.positionKey,
        p_label: value.label,
        p_description: value.description,
        p_permission_ids: value.permissionIds,
      });

      return error ? { ok: false, error: mapWorkspaceRoleCatalogRpcError(error) } : toGatewayResult(data);
    },
  };
}

function normalizeKey(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return catalogKeyPattern.test(normalized) ? normalized : null;
}

function normalizeLabel(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function normalizeDescription(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function normalizePermissionIds(value: unknown) {
  if (!Array.isArray(value) || value.some((permissionId) => typeof permissionId !== "string")) {
    return null;
  }

  const permissionIds = Array.from(
    new Set(value.map((permissionId) => permissionId.trim()).filter(Boolean))
  ).sort();

  if (
    permissionIds.some(
      (permissionId) =>
        ownerOnlyPermissionIds.has(permissionId) || !safeCustomPermissionIds.has(permissionId)
    )
  ) {
    return null;
  }

  return permissionIds;
}

function toGatewayResult(data: unknown): WorkspaceRoleCatalogGatewayResult {
  const snapshot = toWorkspaceRoleCatalogSnapshot(data);
  return snapshot ? { ok: true, snapshot } : { ok: false, error: "unknown" };
}

function toWorkspaceRoleCatalogSnapshot(data: unknown): WorkspaceRoleCatalogSnapshot | null {
  if (!isRecord(data) || !Array.isArray(data.permissionRoles) || !Array.isArray(data.jobPositions)) {
    return null;
  }

  const permissionRoles = data.permissionRoles
    .map(toPermissionRole)
    .filter((role): role is SessionWorkspacePermissionRole => role !== null);
  const jobPositions = data.jobPositions
    .map(toJobPosition)
    .filter((position): position is SessionWorkspaceJobPosition => position !== null);
  const ownerReconciliation = isRecord(data.ownerReconciliation) ? data.ownerReconciliation : {};
  const access = isRecord(data.access) ? data.access : {};

  return {
    permissionRoles,
    jobPositions,
    access: {
      canManage: access.canManage === true,
    },
    ownerReconciliation: {
      needsConfirmation: ownerReconciliation.needsConfirmation === true,
      membershipIds: Array.isArray(ownerReconciliation.membershipIds)
        ? ownerReconciliation.membershipIds.filter((membershipId): membershipId is string => typeof membershipId === "string")
        : [],
    },
  };
}

function toPermissionRole(value: unknown): SessionWorkspacePermissionRole | null {
  if (!isRecord(value) || !isPermissionRoleType(value.roleType)) return null;
  if (
    typeof value.roleKey !== "string" ||
    typeof value.label !== "string" ||
    !Array.isArray(value.permissionIds) ||
    value.permissionIds.some((permissionId) => typeof permissionId !== "string")
  ) {
    return null;
  }

  return {
    workspaceId: null,
    roleKey: value.roleKey,
    label: value.label,
    description: typeof value.description === "string" ? value.description : undefined,
    roleType: value.roleType,
    permissionIds: value.permissionIds,
    isSystem: value.isSystem === true,
    isAssignable: value.isAssignable !== false,
    sortOrder: typeof value.sortOrder === "number" ? value.sortOrder : 100,
  };
}

function toJobPosition(value: unknown): SessionWorkspaceJobPosition | null {
  if (!isRecord(value) || typeof value.positionKey !== "string" || typeof value.label !== "string") {
    return null;
  }

  return {
    workspaceId: null,
    positionKey: value.positionKey,
    label: value.label,
    description: typeof value.description === "string" ? value.description : undefined,
    isSystem: value.isSystem === true,
    isActive: value.isActive !== false,
    sortOrder: typeof value.sortOrder === "number" ? value.sortOrder : 100,
  };
}

function isPermissionRoleType(value: unknown): value is SessionWorkspacePermissionRoleType {
  return value === "owner" || value === "admin" || value === "standard" || value === "custom";
}

function mapWorkspaceRoleCatalogRpcError(error: { code?: string; message?: string }) {
  const message = error.message ?? "";
  if (message.includes("workspace_membership_missing")) return "permission_missing" as const;
  if (error.code === "23503" || message.includes("role_catalog_referenced")) return "conflict" as const;
  if (error.code === "22023" || message.includes("invalid_")) return "invalid_input" as const;
  if (error.code === "40400" || message.includes("missing")) return "workspace_missing" as const;
  if (message.includes("unauthenticated") || message.includes("required") || message.includes("permission")) {
    return "permission_missing" as const;
  }
  return "unknown" as const;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}
