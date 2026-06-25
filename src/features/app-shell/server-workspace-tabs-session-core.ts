import {
  createMockWorkspacePermissionAdapter,
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";

export type WorkspaceTabSurfaceType =
  | "module"
  | "encounter"
  | "labResult"
  | "imagingStudy"
  | "invoice"
  | "queueItem"
  | "patient";

export type WorkspaceTabSessionItem = {
  id: string;
  title: string;
  closable: boolean;
  history: string[];
  historyIndex: number;
  moduleId: string;
  surfaceType: WorkspaceTabSurfaceType;
  surfaceId: string;
  dedupeKey: string;
  lastRoute: string;
  updatedAt: string;
  patientId?: string;
  encounterId?: string;
};

export type WorkspaceTabsSessionPayload = {
  tabs: WorkspaceTabSessionItem[];
  activeTabId: string;
};

export type WorkspaceTabsSessionGateway = {
  read(input: {
    actorUserId: string;
    workspaceId: string;
  }): Promise<WorkspaceTabsSessionGatewayResult>;
  save(input: {
    actorUserId: string;
    workspaceId: string;
    payload: WorkspaceTabsSessionPayload;
  }): Promise<WorkspaceTabsSessionGatewayResult>;
};

export type WorkspaceTabsSessionGatewayResult =
  | { ok: true; payload: WorkspaceTabsSessionPayload | null; updatedAt?: string }
  | { ok: false; status: 500; error: "db_read_failed" | "db_write_failed" };

export type WorkspaceTabsSessionResult =
  | {
      ok: true;
      status: 200;
      payload: WorkspaceTabsSessionPayload | null;
      enforcedBy: "workspace-tabs-session";
    }
  | { ok: false; status: 400; error: "invalid_input"; fieldErrors: Record<string, string> }
  | { ok: false; status: 401 | 403; denialReason: WorkspacePermissionDenialReason }
  | { ok: false; status: 500; error: "db_read_failed" | "db_write_failed" };

const mockSessionStore = new Map<string, WorkspaceTabsSessionPayload>();
const allowedTabKeys = new Set([
  "id",
  "title",
  "closable",
  "history",
  "historyIndex",
  "moduleId",
  "surfaceType",
  "surfaceId",
  "dedupeKey",
  "lastRoute",
  "updatedAt",
  "patientId",
  "encounterId",
]);

export async function readWorkspaceTabsSession({
  actorUserId,
  gateway = createMockWorkspaceTabsSessionGateway(),
  permissionAdapter = createDemoWorkspaceTabsPermissionAdapter(),
  workspaceId,
}: {
  actorUserId: string | null;
  gateway?: Pick<WorkspaceTabsSessionGateway, "read">;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<WorkspaceTabsSessionResult> {
  const permission = resolveWorkspacePermission(permissionAdapter, {
    sessionUserId: actorUserId,
    workspaceId,
  });

  if (!permission.allowed) {
    return {
      ok: false,
      status: permission.denialReason === "unauthenticated" ? 401 : 403,
      denialReason: permission.denialReason ?? "workspace_membership_missing",
    };
  }

  const result = await gateway.read({ actorUserId: actorUserId ?? "", workspaceId });
  if (!result.ok) return { ok: false, status: 500, error: "db_read_failed" };

  return {
    ok: true,
    status: 200,
    payload: result.payload,
    enforcedBy: "workspace-tabs-session",
  };
}

export async function saveWorkspaceTabsSession({
  actorUserId,
  gateway = createMockWorkspaceTabsSessionGateway(),
  input,
  permissionAdapter = createDemoWorkspaceTabsPermissionAdapter(),
  workspaceId,
}: {
  actorUserId: string | null;
  gateway?: Pick<WorkspaceTabsSessionGateway, "save">;
  input: unknown;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<WorkspaceTabsSessionResult> {
  const permission = resolveWorkspacePermission(permissionAdapter, {
    sessionUserId: actorUserId,
    workspaceId,
  });

  if (!permission.allowed) {
    return {
      ok: false,
      status: permission.denialReason === "unauthenticated" ? 401 : 403,
      denialReason: permission.denialReason ?? "workspace_membership_missing",
    };
  }

  const sanitized = sanitizeWorkspaceTabsPayload(input, workspaceId);
  if (!sanitized.ok) {
    return { ok: false, status: 400, error: "invalid_input", fieldErrors: sanitized.fieldErrors };
  }

  const result = await gateway.save({
    actorUserId: actorUserId ?? "",
    workspaceId,
    payload: sanitized.payload,
  });
  if (!result.ok) return { ok: false, status: 500, error: "db_write_failed" };

  return {
    ok: true,
    status: 200,
    payload: result.payload,
    enforcedBy: "workspace-tabs-session",
  };
}

export function createMockWorkspaceTabsSessionGateway(): WorkspaceTabsSessionGateway {
  return {
    async read({ actorUserId, workspaceId }) {
      return {
        ok: true,
        payload: mockSessionStore.get(buildSessionKey(workspaceId, actorUserId)) ?? null,
      };
    },
    async save({ actorUserId, payload, workspaceId }) {
      mockSessionStore.set(buildSessionKey(workspaceId, actorUserId), payload);
      return { ok: true, payload, updatedAt: new Date().toISOString() };
    },
  };
}

export type SupabaseWorkspaceTabsSessionClient = {
  from(table: "user_workspace_tab_sessions"): {
    select(columns: string): SupabaseWorkspaceTabsSelectQuery;
    upsert(
      value: Record<string, unknown>,
      options: { onConflict: string }
    ): {
      select(columns: string): {
        maybeSingle(): Promise<{ data: unknown; error: { message?: string } | null }>;
      };
    };
  };
};

type SupabaseWorkspaceTabsSelectQuery = {
  eq(column: string, value: string): SupabaseWorkspaceTabsSelectQuery;
  maybeSingle(): Promise<{ data: unknown; error: { message?: string } | null }>;
};

export function createSupabaseWorkspaceTabsSessionGateway(
  client: SupabaseWorkspaceTabsSessionClient
): WorkspaceTabsSessionGateway {
  return {
    async read({ actorUserId, workspaceId }) {
      const { data, error } = await client
        .from("user_workspace_tab_sessions")
        .select("tabs,active_tab_id,updated_at")
        .eq("workspace_id", workspaceId)
        .eq("user_id", actorUserId)
        .maybeSingle();

      if (error) return { ok: false, status: 500, error: "db_read_failed" };
      if (!data || typeof data !== "object") return { ok: true, payload: null };

      const row = data as { tabs?: unknown; active_tab_id?: unknown; updated_at?: unknown };
      const sanitized = sanitizeWorkspaceTabsPayload(
        { tabs: row.tabs, activeTabId: row.active_tab_id },
        workspaceId
      );
      if (!sanitized.ok) return { ok: true, payload: null };

      return {
        ok: true,
        payload: sanitized.payload,
        updatedAt: typeof row.updated_at === "string" ? row.updated_at : undefined,
      };
    },
    async save({ actorUserId, payload, workspaceId }) {
      const { data, error } = await client
        .from("user_workspace_tab_sessions")
        .upsert(
          {
            workspace_id: workspaceId,
            user_id: actorUserId,
            tabs: payload.tabs,
            active_tab_id: payload.activeTabId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "workspace_id,user_id" }
        )
        .select("tabs,active_tab_id,updated_at")
        .maybeSingle();

      if (error) return { ok: false, status: 500, error: "db_write_failed" };
      if (!data || typeof data !== "object") return { ok: true, payload };

      const row = data as { tabs?: unknown; active_tab_id?: unknown; updated_at?: unknown };
      const sanitized = sanitizeWorkspaceTabsPayload(
        { tabs: row.tabs, activeTabId: row.active_tab_id },
        workspaceId
      );

      return {
        ok: true,
        payload: sanitized.ok ? sanitized.payload : payload,
        updatedAt: typeof row.updated_at === "string" ? row.updated_at : undefined,
      };
    },
  };
}

export function createDemoWorkspaceTabsPermissionAdapter() {
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

function sanitizeWorkspaceTabsPayload(
  value: unknown,
  workspaceId: string
):
  | { ok: true; payload: WorkspaceTabsSessionPayload }
  | { ok: false; fieldErrors: Record<string, string> } {
  if (!isRecord(value)) return invalid("payload", "탭 세션 형식이 올바르지 않습니다.");
  if (!Array.isArray(value.tabs)) return invalid("tabs", "탭 목록이 필요합니다.");
  if (typeof value.activeTabId !== "string") return invalid("activeTabId", "활성 탭이 필요합니다.");

  const tabs = value.tabs.map((tab) => sanitizeTab(tab, workspaceId));
  if (tabs.some((tab) => tab === null)) return invalid("tabs", "탭 목록에 잘못된 항목이 있습니다.");

  const sanitizedTabs = tabs.filter((tab): tab is WorkspaceTabSessionItem => tab !== null);
  if (sanitizedTabs.length === 0) return invalid("tabs", "최소 한 개의 탭이 필요합니다.");
  if (!sanitizedTabs.some((tab) => tab.id === value.activeTabId)) {
    return invalid("activeTabId", "활성 탭이 탭 목록에 없습니다.");
  }

  return { ok: true, payload: { tabs: sanitizedTabs, activeTabId: value.activeTabId } };
}

function sanitizeTab(value: unknown, workspaceId: string): WorkspaceTabSessionItem | null {
  if (!isRecord(value)) return null;
  if (Object.keys(value).some((key) => !allowedTabKeys.has(key))) return null;
  if (typeof value.id !== "string" || typeof value.title !== "string") return null;
  if (typeof value.closable !== "boolean" || typeof value.moduleId !== "string") return null;
  if (!Array.isArray(value.history) || value.history.length === 0) return null;
  if (!value.history.every((route) => typeof route === "string" && isWorkspaceRoute(route, workspaceId))) {
    return null;
  }
  if (typeof value.historyIndex !== "number" || !Number.isInteger(value.historyIndex)) return null;
  if (value.historyIndex < 0 || value.historyIndex >= value.history.length) return null;
  if (!isSurfaceType(value.surfaceType) || typeof value.surfaceId !== "string") return null;
  if (typeof value.dedupeKey !== "string" || typeof value.lastRoute !== "string") return null;
  if (!isWorkspaceRoute(value.lastRoute, workspaceId)) return null;
  if (typeof value.updatedAt !== "string" || Number.isNaN(Date.parse(value.updatedAt))) return null;
  if (value.patientId !== undefined && typeof value.patientId !== "string") return null;
  if (value.encounterId !== undefined && typeof value.encounterId !== "string") return null;

  const expectedDedupeKey = `${workspaceId}:${value.surfaceType}:${value.surfaceId}`;
  if (value.dedupeKey !== expectedDedupeKey) return null;

  return {
    id: value.id,
    title: value.title,
    closable: value.closable,
    history: value.history,
    historyIndex: value.historyIndex,
    moduleId: value.moduleId,
    surfaceType: value.surfaceType,
    surfaceId: value.surfaceId,
    dedupeKey: value.dedupeKey,
    lastRoute: value.lastRoute,
    updatedAt: value.updatedAt,
    patientId: value.patientId,
    encounterId: value.encounterId,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalid(field: string, message: string) {
  return { ok: false as const, fieldErrors: { [field]: message } };
}

function isWorkspaceRoute(route: string, workspaceId: string) {
  return route.split("?")[0]?.startsWith(`/w/${workspaceId}/`) ?? false;
}

function isSurfaceType(value: unknown): value is WorkspaceTabSurfaceType {
  return (
    value === "module" ||
    value === "encounter" ||
    value === "labResult" ||
    value === "imagingStudy" ||
    value === "invoice" ||
    value === "queueItem" ||
    value === "patient"
  );
}

function buildSessionKey(workspaceId: string, actorUserId: string) {
  return `${workspaceId}:${actorUserId}`;
}
