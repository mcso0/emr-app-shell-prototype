import {
  createMockWorkspacePermissionAdapter,
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";
import {
  cloneWorkspaceVitalSettingsSnapshot,
  createDefaultWorkspaceVitalSettingsSnapshot,
  defaultWorkspaceVitalPresets,
  parseWorkspaceVitalSettingsSnapshot,
  type WorkspaceVitalSetting,
  type WorkspaceVitalSettingsSnapshot,
} from "@/features/patient-vitals/workspace-vital-settings";

export type WorkspaceVitalSettingsGateway = {
  get(workspaceId: string): Promise<
    | { ok: true; snapshot: WorkspaceVitalSettingsSnapshot }
    | { ok: false; error: "db_read_failed" }
  >;
  replace(input: {
    actorUserId: string;
    items: WorkspaceVitalSetting[];
    workspaceId: string;
  }): Promise<
    | { ok: true; snapshot: WorkspaceVitalSettingsSnapshot }
    | { ok: false; error: "db_write_failed" }
  >;
};

type WorkspaceVitalSettingsResult =
  | ({
      ok: true;
      status: 200;
      enforcedBy: "workspace-vital-settings";
    } & WorkspaceVitalSettingsSnapshot)
  | { ok: false; status: 400; error: "invalid_input" }
  | { ok: false; status: 401 | 403; denialReason: WorkspacePermissionDenialReason }
  | { ok: false; status: 500; error: "db_read_failed" | "db_write_failed" };

export async function readWorkspaceVitalSettings(input: {
  actorUserId: string | null;
  gateway?: WorkspaceVitalSettingsGateway;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<WorkspaceVitalSettingsResult> {
  const permissionAdapter = input.permissionAdapter ?? demoPermissions(input.actorUserId, input.workspaceId);
  const readPermission = resolveWorkspacePermission(permissionAdapter, {
    sessionUserId: input.actorUserId,
    workspaceId: input.workspaceId,
    requiredPermission: "hospital_settings:view",
  });
  if (!readPermission.allowed) return denied(readPermission.denialReason);

  const result = await (input.gateway ?? createMockWorkspaceVitalSettingsGateway()).get(input.workspaceId);
  if (!result.ok) return { ok: false, status: 500, error: result.error };

  const managePermission = resolveWorkspacePermission(permissionAdapter, {
    sessionUserId: input.actorUserId,
    workspaceId: input.workspaceId,
    requiredPermission: "hospital_settings:manage",
  });
  return {
    ok: true,
    status: 200,
    enforcedBy: "workspace-vital-settings",
    ...cloneWorkspaceVitalSettingsSnapshot({
      ...result.snapshot,
      canManage: managePermission.allowed,
    }),
  };
}

export async function replaceWorkspaceVitalSettings(input: {
  actorUserId: string | null;
  gateway?: WorkspaceVitalSettingsGateway;
  items: unknown;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<WorkspaceVitalSettingsResult> {
  const permissionAdapter = input.permissionAdapter ?? demoPermissions(input.actorUserId, input.workspaceId);
  const permission = resolveWorkspacePermission(permissionAdapter, {
    sessionUserId: input.actorUserId,
    workspaceId: input.workspaceId,
    requiredPermission: "hospital_settings:manage",
  });
  if (!permission.allowed) return denied(permission.denialReason);

  const items = validateItems(input.items);
  if (!items) return { ok: false, status: 400, error: "invalid_input" };

  const result = await (input.gateway ?? createMockWorkspaceVitalSettingsGateway()).replace({
    actorUserId: input.actorUserId ?? "",
    items,
    workspaceId: input.workspaceId,
  });
  if (!result.ok) return { ok: false, status: 500, error: result.error };
  return {
    ok: true,
    status: 200,
    enforcedBy: "workspace-vital-settings",
    ...cloneWorkspaceVitalSettingsSnapshot({ ...result.snapshot, canManage: true }),
  };
}

const mockSnapshots = new Map<string, WorkspaceVitalSettingsSnapshot>();

export function createMockWorkspaceVitalSettingsGateway(): WorkspaceVitalSettingsGateway {
  return {
    async get(workspaceId) {
      const snapshot = mockSnapshots.get(workspaceId) ?? createDefaultWorkspaceVitalSettingsSnapshot();
      return { ok: true, snapshot: cloneWorkspaceVitalSettingsSnapshot(snapshot) };
    },
    async replace({ items, workspaceId }) {
      const snapshot: WorkspaceVitalSettingsSnapshot = {
        canManage: true,
        presets: defaultWorkspaceVitalPresets,
        items,
      };
      mockSnapshots.set(workspaceId, cloneWorkspaceVitalSettingsSnapshot(snapshot));
      return { ok: true, snapshot: cloneWorkspaceVitalSettingsSnapshot(snapshot) };
    },
  };
}

export type SupabaseWorkspaceVitalSettingsClient = {
  rpc(
    functionName: "clair_get_workspace_vital_settings" | "clair_replace_workspace_vital_settings",
    args: Record<string, unknown>,
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
};

export function createSupabaseWorkspaceVitalSettingsGateway(
  client: SupabaseWorkspaceVitalSettingsClient,
): WorkspaceVitalSettingsGateway {
  return {
    async get(workspaceId) {
      const { data, error } = await client.rpc("clair_get_workspace_vital_settings", {
        p_workspace_id: workspaceId,
      });
      if (error) return { ok: false, error: "db_read_failed" };
      const snapshot = parseGatewaySnapshot(data);
      return snapshot
        ? { ok: true, snapshot }
        : { ok: false, error: "db_read_failed" };
    },
    async replace({ actorUserId, items, workspaceId }) {
      const { data, error } = await client.rpc("clair_replace_workspace_vital_settings", {
        p_actor_user_id: actorUserId,
        p_items: items,
        p_workspace_id: workspaceId,
      });
      if (error) return { ok: false, error: "db_write_failed" };
      const snapshot = parseGatewaySnapshot(data);
      return snapshot
        ? { ok: true, snapshot }
        : { ok: false, error: "db_write_failed" };
    },
  };
}

function parseGatewaySnapshot(value: unknown) {
  return parseWorkspaceVitalSettingsSnapshot(
    typeof value === "object" && value !== null
      ? { ...(value as Record<string, unknown>), canManage: true }
      : value,
  );
}

function validateItems(value: unknown): WorkspaceVitalSetting[] | null {
  const parsed = parseWorkspaceVitalSettingsSnapshot({
    canManage: true,
    presets: defaultWorkspaceVitalPresets,
    items: value,
  });
  if (!parsed || parsed.items.some((item, index) => item.sortOrder !== index)) return null;
  const requiredKeys = parsed.presets
    .filter((preset) => preset.requiredInWorkspace)
    .map((preset) => preset.key);
  if (requiredKeys.some((key) => !parsed.items.some(
    (item) => item.key === key && item.enabled,
  ))) return null;
  return parsed.items;
}

function denied(
  denialReason: WorkspacePermissionDenialReason | undefined,
): Extract<WorkspaceVitalSettingsResult, { ok: false; status: 401 | 403 }> {
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
      id: `vital-settings-${userId}`,
      workspaceId,
      userId,
      roles: [role],
      status: "active",
    }],
  });
}
